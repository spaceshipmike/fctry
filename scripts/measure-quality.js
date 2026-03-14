#!/usr/bin/env node

/**
 * Quality metrics capture for the hard ratchet.
 *
 * Measures structural code quality metrics at zero LLM cost.
 * Run before and after a chunk to detect regressions.
 *
 * Usage:
 *   node scripts/measure-quality.js [project-dir]              # measure all tracked files
 *   node scripts/measure-quality.js [project-dir] --files a.js b.js  # measure specific files
 *   node scripts/measure-quality.js [project-dir] --diff <baseline.json>  # compare against baseline
 *
 * Output: JSON with per-file and aggregate metrics.
 *
 * Metrics captured:
 *   - totalLines: total line count across measured files
 *   - totalFiles: number of files measured
 *   - fileSizes: per-file byte sizes
 *   - maxFileLines: longest file in lines
 *   - functionCount: total named functions (via regex, no ast-grep dependency)
 *   - maxFunctionLength: longest function body in lines (heuristic)
 *   - importCount: total import/require statements (fan-out proxy)
 *   - circularDeps: count of circular dependency chains (if detectable)
 *   - perFile: per-file breakdown { lines, bytes, functions, imports }
 */

const { readFileSync, statSync, existsSync } = require("fs");
const { join, resolve, relative, extname } = require("path");
const { execSync } = require("child_process");

const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = process.argv.slice(2);
const projectDir = resolve(positional[0] || process.cwd());
const diffIdx = flags.indexOf("--diff");
const diffBaseline = diffIdx >= 0 ? flags[diffIdx + 1] : null;
const filesIdx = flags.indexOf("--files");
const explicitFiles = filesIdx >= 0 ? flags.slice(filesIdx + 1).filter((f) => !f.startsWith("--")) : null;

const CODE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".rs", ".go", ".rb", ".java", ".kt", ".swift", ".c", ".cpp", ".h", ".css", ".html", ".vue", ".svelte"]);

// --- File Discovery ---

function getTrackedFiles() {
  if (explicitFiles) {
    return explicitFiles.map((f) => resolve(projectDir, f)).filter(existsSync);
  }

  try {
    const result = execSync("git ls-files --cached --others --exclude-standard", {
      cwd: projectDir,
      encoding: "utf-8",
      timeout: 10000,
    });
    return result
      .trim()
      .split("\n")
      .filter((f) => f && CODE_EXTENSIONS.has(extname(f)))
      .map((f) => join(projectDir, f));
  } catch {
    return [];
  }
}

// --- Per-File Metrics ---

function measureFile(filePath) {
  try {
    const content = readFileSync(filePath, "utf-8");
    const stat = statSync(filePath);
    const lines = content.split("\n");
    const lineCount = lines.length;
    const bytes = stat.size;

    // Count functions (named function declarations, arrow functions assigned to const/let/var, methods)
    const functionPatterns = [
      /^\s*(?:async\s+)?function\s+\w+/gm,                    // function declarations
      /^\s*(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(/gm, // arrow/anonymous assigned
      /^\s*(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?function/gm, // function expressions
      /^\s*\w+\s*\([^)]*\)\s*\{/gm,                           // method shorthand (class/object)
    ];
    let functionCount = 0;
    for (const pattern of functionPatterns) {
      const matches = content.match(pattern);
      if (matches) functionCount += matches.length;
    }

    // Count imports/requires
    const importPattern = /^\s*(?:import\s|const\s+\w+\s*=\s*require\(|let\s+\w+\s*=\s*require\(|var\s+\w+\s*=\s*require\()/gm;
    const importMatches = content.match(importPattern);
    const importCount = importMatches ? importMatches.length : 0;

    // Estimate max function length (heuristic: track brace depth after function declarations)
    let maxFuncLen = 0;
    let inFunc = false;
    let braceDepth = 0;
    let funcStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!inFunc && /(?:async\s+)?function\s+\w+|=>\s*\{/.test(line)) {
        inFunc = true;
        braceDepth = 0;
        funcStart = i;
      }
      if (inFunc) {
        for (const ch of line) {
          if (ch === "{") braceDepth++;
          if (ch === "}") braceDepth--;
        }
        if (braceDepth <= 0 && i > funcStart) {
          const funcLen = i - funcStart + 1;
          if (funcLen > maxFuncLen) maxFuncLen = funcLen;
          inFunc = false;
        }
      }
    }

    return {
      path: relative(projectDir, filePath),
      lines: lineCount,
      bytes,
      functions: functionCount,
      imports: importCount,
      maxFunctionLength: maxFuncLen,
    };
  } catch {
    return null;
  }
}

// --- Aggregate ---

function measure() {
  const files = getTrackedFiles();
  const perFile = {};
  let totalLines = 0;
  let totalBytes = 0;
  let totalFunctions = 0;
  let totalImports = 0;
  let maxFileLines = 0;
  let maxFunctionLength = 0;

  for (const f of files) {
    const m = measureFile(f);
    if (!m) continue;
    perFile[m.path] = m;
    totalLines += m.lines;
    totalBytes += m.bytes;
    totalFunctions += m.functions;
    totalImports += m.imports;
    if (m.lines > maxFileLines) maxFileLines = m.lines;
    if (m.maxFunctionLength > maxFunctionLength) maxFunctionLength = m.maxFunctionLength;
  }

  return {
    timestamp: new Date().toISOString(),
    project: projectDir,
    totalFiles: Object.keys(perFile).length,
    totalLines,
    totalBytes,
    totalFunctions,
    totalImports,
    maxFileLines,
    maxFunctionLength,
    perFile,
  };
}

// --- Diff Mode ---

function diff(current, baseline) {
  const regressions = [];
  const improvements = [];

  // Aggregate comparisons
  const checks = [
    { name: "totalLines", direction: "lower-is-better", threshold: 0 },
    { name: "totalImports", direction: "lower-is-better", threshold: 0 },
    { name: "maxFileLines", direction: "lower-is-better", threshold: 50 },
    { name: "maxFunctionLength", direction: "lower-is-better", threshold: 10 },
    { name: "totalBytes", direction: "lower-is-better", threshold: 0 },
  ];

  for (const check of checks) {
    const before = baseline[check.name] || 0;
    const after = current[check.name] || 0;
    const delta = after - before;

    if (delta > check.threshold) {
      regressions.push({
        metric: check.name,
        before,
        after,
        delta,
        severity: delta > check.threshold * 3 ? "high" : "low",
      });
    } else if (delta < -check.threshold) {
      improvements.push({
        metric: check.name,
        before,
        after,
        delta,
      });
    }
  }

  // Per-file new/removed detection
  const newFiles = Object.keys(current.perFile).filter((f) => !baseline.perFile[f]);
  const removedFiles = Object.keys(baseline.perFile).filter((f) => !current.perFile[f]);

  return {
    regressions,
    improvements,
    newFiles,
    removedFiles,
    verdict: regressions.filter((r) => r.severity === "high").length > 0 ? "regressed" : "ok",
  };
}

// --- Main ---

const metrics = measure();

if (diffBaseline) {
  try {
    const baseline = JSON.parse(readFileSync(diffBaseline, "utf-8"));
    const result = diff(metrics, baseline);
    console.log(JSON.stringify({ current: metrics, diff: result }, null, 2));
  } catch (err) {
    console.error(`Could not read baseline: ${err.message}`);
    console.log(JSON.stringify(metrics, null, 2));
  }
} else {
  console.log(JSON.stringify(metrics, null, 2));
}
