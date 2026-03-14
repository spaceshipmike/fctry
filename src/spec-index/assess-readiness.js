#!/usr/bin/env node
/**
 * Bootstrap readiness assessment for any fctry project.
 *
 * This is a lightweight heuristic — a starting point for the State Owner's
 * deeper analysis. It uses only structural analysis (section number prefix
 * for meta vs. buildable) and basic code-directory detection. It contains
 * NO project-specific hints and works identically for any codebase.
 *
 * The State Owner writes the authoritative per-section readiness to
 * state.json (sectionReadiness map). This script is used as a bootstrap
 * when no agent assessment exists yet, and by the State Owner as a
 * starting point to refine.
 *
 * Readiness values:
 *   draft            — section content is incomplete or placeholder
 *   undocumented     — code exists but spec doesn't describe it
 *   ready-to-build   — spec describes it but code doesn't exist yet
 *   aligned          — spec and code match
 *   ready-to-execute — aligned and no open issues
 *   satisfied        — scenarios passing
 *
 * Usage:
 *   node assess-readiness.js <project-dir>
 *
 * Writes readiness values to the SQLite spec index and outputs a summary
 * to stdout as JSON.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { SpecIndex } from "./index.js";
import { readinessToStatus, translateSummary } from "./human-labels.js";

/**
 * Heuristic: determine if a section has "real" content or is just a stub.
 * A draft section has fewer than 30 words of content.
 */
function isDraft(section) {
  return section.word_count < 30;
}

/**
 * Known alias → code path mappings.
 * Supplements the generic alias-matching heuristic for cases where the alias
 * doesn't match the directory name (e.g., spec-viewer → src/viewer/).
 * This is the same data as detect-untracked.js's section map, inverted.
 */
const ALIAS_CODE_PATHS = {
  "first-run": ["commands/init"],
  "core-flow": ["commands/init", "agents/interviewer"],
  "multi-session": ["commands/init", "agents/interviewer"],
  "evolve-flow": ["commands/evolve", "agents/interviewer"],
  "ref-flow": ["commands/ref", "agents/researcher"],
  "review-flow": ["commands/review"],
  "execute-flow": ["commands/execute", "agents/executor"],
  "navigate-sections": ["references/alias-resolution", "src/spec-index/human-labels"],
  "spec-viewer": ["src/viewer"],
  "error-handling": ["references/error-conventions"],
  "details": ["references/shared-concepts"],
  "status-line": ["src/statusline"],
  "next-action": ["commands/next"],
  "capabilities": ["agents/state-owner", "agents/spec-writer", "src/memory", "scripts/foreman"],
  "entities": ["references/state-protocol", "src/spec-index"],
  "rules": ["src/spec-index/assess-readiness", "references/context-management"],
  "external-connections": ["agents/researcher", "agents/visual-translator"],
  "performance": ["src/spec-index"],
};

/**
 * Heuristic: search for code files that relate to a section's alias or heading.
 * Returns true if code exists, false if not, null if the section is a meta-concept
 * (not expected to have code).
 *
 * Checks known alias→path mappings first, then falls back to generic
 * alias-matching. The known map handles cases where aliases don't match
 * directory names (e.g., spec-viewer → src/viewer/).
 */
function hasRelatedCode(section, projectDir) {
  // NLSpec v2 structure: sections 1.x (Vision), 4.x (Boundaries), 5.x (Reference),
  // 6.x (Satisfaction) describe meta-concepts — never buildable code features.
  // Only sections 2.x (Experience) and 3.x (System Behavior) may have related code.
  // Detect structurally by number prefix rather than maintaining a hardcoded alias list.
  if (section.number) {
    const topLevel = parseInt(section.number.split(".")[0], 10);
    if (topLevel !== 2 && topLevel !== 3) return null; // meta section
  }
  if (!section.number && !section.alias) return null; // unnumbered, unaliased = meta

  // Check known alias → code path mappings first (handles alias/directory mismatches)
  const alias = section.alias || "";
  if (alias && ALIAS_CODE_PATHS[alias]) {
    for (const codePath of ALIAS_CODE_PATHS[alias]) {
      const full = join(projectDir, codePath);
      // Check if path exists as file or directory (with common extensions)
      if (existsSync(full) || existsSync(full + ".md") || existsSync(full + ".js")) {
        return true;
      }
    }
  }

  // Look for code in common source directories
  const codeDirs = ["src", "lib", "app", "commands", "agents", "references",
    "hooks", "scripts", "pkg", "internal", "cmd"];
  const existingCodeDirs = codeDirs
    .map((d) => join(projectDir, d))
    .filter((d) => existsSync(d));

  // If no code directories exist at all, can't determine — assume ready-to-build
  if (existingCodeDirs.length === 0) return false;

  const heading = (section.heading || "").toLowerCase();

  // Check if any code directory or file name matches the alias
  // (e.g., alias "viewer" matches src/viewer/, alias "status-line" matches src/statusline/)
  if (alias) {
    const aliasVariants = [
      alias,                          // "status-line"
      alias.replace(/-/g, ""),        // "statusline"
      alias.replace(/-/g, "_"),       // "status_line"
    ];
    for (const dir of existingCodeDirs) {
      try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          const entryLower = entry.toLowerCase().replace(/\.[^.]+$/, "");
          if (aliasVariants.some((v) => entryLower === v || entryLower.includes(v))) {
            return true;
          }
        }
      } catch { /* skip */ }
    }
  }

  // Broader check: walk source files and look for the alias or heading words
  // in file/directory names (not file contents — content matching is too noisy)
  if (alias) {
    for (const dir of existingCodeDirs) {
      try {
        const allPaths = walkDir(dir, 3);
        const aliasClean = alias.replace(/-/g, "").toLowerCase();
        for (const p of allPaths) {
          const pathLower = p.toLowerCase();
          if (pathLower.includes(aliasClean)) return true;
        }
      } catch { /* skip */ }
    }
  }

  return false;
}

/**
 * Walk a directory tree up to a given depth.
 */
function walkDir(dir, maxDepth, depth = 0) {
  if (depth >= maxDepth) return [];
  const results = [];
  try {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith(".") || entry === "node_modules") continue;
      const full = join(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          results.push(...walkDir(full, maxDepth, depth + 1));
        } else if (/\.(js|ts|jsx|tsx|py|rb|rs|go|java|kt|swift|c|cpp|h|cs|md|sh|json|toml|yaml|yml)$/.test(entry)) {
          results.push(full);
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return results;
}

/**
 * Freshness skip: compares the section's most recent changelog entry against
 * the most recent git commit touching its code neighborhood.
 *
 * Three outcomes:
 *   - spec newer than code, code exists → "spec-ahead" (code built, spec evolved past it)
 *   - spec newer than code, no code    → "ready-to-build" (nothing implemented yet)
 *   - code newer or equal              → null (needs full scan to determine)
 *
 * @param {Object} section - Section row from the index
 * @param {string} projectDir - Project root directory
 * @param {SpecIndex} idx - Open SpecIndex instance
 * @returns {string|null} Readiness label if skip applies, null if can't determine
 */
export function freshnessSkip(section, projectDir, idx) {
  const alias = section.alias;
  if (!alias) return null;

  try {
    // Find the most recent changelog entry that mentions this section's alias.
    const entries = idx.getChangelogEntries(); // already sorted newest-first
    let changelogTimestamp = null;
    for (const entry of entries) {
      const changes = entry.changes || "";
      if (changes.includes(`#${alias}`) || changes.includes(`\`#${alias}\``) ||
          changes.includes(`\`${alias}\``)) {
        changelogTimestamp = entry.timestamp;
        break; // newest first, so first match is the most recent
      }
    }

    if (!changelogTimestamp) return null; // no changelog entry for this section

    // Find code files related to this section.
    const codePaths = findCodeNeighborhood(section, projectDir);

    // No code neighborhood at all — check hasRelatedCode for broader match
    if (codePaths.length === 0) {
      const codeExists = hasRelatedCode(section, projectDir);
      if (codeExists === null) return null; // meta section
      if (codeExists) return "spec-ahead"; // code exists somewhere, spec is newer
      return "ready-to-build"; // no code found, spec describes unbuilt feature
    }

    // Get the most recent git commit timestamp for those paths.
    let gitTimestamp = null;
    try {
      const pathArgs = codePaths.map((p) => `"${p}"`).join(" ");
      const result = execSync(
        `git log -1 --format=%aI -- ${pathArgs}`,
        { cwd: projectDir, encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }
      ).trim();
      if (result) {
        gitTimestamp = result;
      }
    } catch {
      return null; // not a git repo or git error — can't determine
    }

    if (!gitTimestamp) return null; // no git history for these files

    // Compare timestamps
    const changelogDate = new Date(changelogTimestamp);
    const gitDate = new Date(gitTimestamp);

    if (changelogDate > gitDate) {
      // Spec is newer than code — but code exists (we found code paths above)
      return "spec-ahead";
    }

    return null; // git is newer or equal — need full scan
  } catch {
    return null; // any error — graceful fallback to full scan
  }
}

/**
 * Find code files/directories in the section's "code neighborhood" — the set
 * of paths that hasRelatedCode would match against. Returns actual file paths
 * rather than a boolean so the caller can pass them to git log.
 *
 * @param {Object} section - Section row from the index
 * @param {string} projectDir - Project root directory
 * @returns {string[]} Array of matching file/directory paths (may be empty)
 */
function findCodeNeighborhood(section, projectDir) {
  // Same meta-section exclusion as hasRelatedCode
  if (section.number) {
    const topLevel = parseInt(section.number.split(".")[0], 10);
    if (topLevel !== 2 && topLevel !== 3) return [];
  }
  if (!section.number && !section.alias) return [];

  // Check known alias → code path mappings first
  const sectionAlias = section.alias || "";
  if (sectionAlias && ALIAS_CODE_PATHS[sectionAlias]) {
    const knownPaths = [];
    for (const codePath of ALIAS_CODE_PATHS[sectionAlias]) {
      const full = join(projectDir, codePath);
      if (existsSync(full)) knownPaths.push(full);
      else if (existsSync(full + ".md")) knownPaths.push(full + ".md");
      else if (existsSync(full + ".js")) knownPaths.push(full + ".js");
    }
    if (knownPaths.length > 0) return knownPaths;
  }

  const codeDirs = ["src", "lib", "app", "commands", "agents", "references",
    "hooks", "scripts", "pkg", "internal", "cmd"];
  const existingCodeDirs = codeDirs
    .map((d) => join(projectDir, d))
    .filter((d) => existsSync(d));

  if (existingCodeDirs.length === 0) return [];

  const alias = section.alias || "";
  if (!alias) return [];

  const matches = [];
  const aliasVariants = [
    alias,
    alias.replace(/-/g, ""),
    alias.replace(/-/g, "_"),
  ];

  // Check direct children of code directories
  for (const dir of existingCodeDirs) {
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const entryLower = entry.toLowerCase().replace(/\.[^.]+$/, "");
        if (aliasVariants.some((v) => entryLower === v || entryLower.includes(v))) {
          matches.push(join(dir, entry));
        }
      }
    } catch { /* skip */ }
  }

  // Walk deeper (same as hasRelatedCode's broader check)
  if (matches.length === 0) {
    const aliasClean = alias.replace(/-/g, "").toLowerCase();
    for (const dir of existingCodeDirs) {
      try {
        const allPaths = walkDir(dir, 3);
        for (const p of allPaths) {
          if (p.toLowerCase().includes(aliasClean)) {
            matches.push(p);
          }
        }
      } catch { /* skip */ }
    }
  }

  return matches;
}

/**
 * Semantic stability skip: if a section's content hash matches its stored hash
 * (meaning content is identical since last assessment), the previous readiness
 * still holds. This avoids redundant deep comparisons for sections with no
 * content change.
 *
 * NOTE: This is content-hash-only — no ONNX runtime in this script. Full
 * embedding comparison happens at the State Owner agent level. This function
 * provides the data scaffolding for that.
 *
 * @param {Object} section - Section row from the index
 * @param {SpecIndex} idx - Open SpecIndex instance
 * @returns {{ readiness: string }|null} Carry-forward readiness, or null if can't skip
 */
export function semanticStabilitySkip(section, idx, projectDir) {
  const alias = section.alias;
  if (!alias) return null;

  try {
    // Get stored content hash from section_embeddings
    const storedHash = idx.getContentHash(alias);
    if (!storedHash) return null; // no stored hash — can't determine stability

    // Compute current content hash
    const currentHash = SpecIndex.contentHash(section.content);

    if (currentHash === storedHash) {
      // Content is identical — carry forward the stored readiness,
      // but upgrade "ready-to-build" to "spec-ahead" if code exists
      // (the stored value may be stale from before the spec-ahead state existed).
      let storedReadiness = section.readiness;
      if (storedReadiness === "ready-to-build") {
        const codeExists = hasRelatedCode(section, projectDir);
        if (codeExists === true) storedReadiness = "spec-ahead";
      }
      if (storedReadiness && storedReadiness !== "draft") {
        return { readiness: storedReadiness };
      }
      // If stored readiness is "draft" but content hasn't changed, that's
      // the bootstrap default — can't meaningfully carry forward
      return null;
    }

    // Content hash differs — can't skip without embedding comparison.
    // No ONNX runtime here, so return null. The State Owner agent will
    // do the full embedding comparison if needed.
    return null;
  } catch {
    return null; // graceful degradation
  }
}

/**
 * Write scan progress to state.json so the status line can display it.
 * Read-modify-write to preserve other state fields.
 *
 * @param {string} projectDir - Project root directory
 * @param {{ total: number, scanned: number, skipped: number }} progress
 */
function writeScanProgress(projectDir, progress) {
  const stateFile = join(projectDir, ".fctry", "state.json");
  try {
    let state = {};
    if (existsSync(stateFile)) {
      state = JSON.parse(readFileSync(stateFile, "utf-8"));
    }
    state.scanProgress = progress;
    writeFileSync(stateFile, JSON.stringify(state, null, 2), "utf-8");
  } catch { /* non-fatal — status line just won't update */ }
}

/**
 * Assess readiness for all sections in the index.
 *
 * Applies selective scanning: freshness skip and semantic stability skip
 * eliminate redundant deep comparisons. Sections that pass a skip filter
 * get their readiness assigned without code scanning. Only sections that
 * fail both skips proceed to the heuristic code-matching logic.
 *
 * @param {string} projectDir - Project root directory
 * @returns {{ summary: Object, sections: Array, scanProgress: { total: number, skipped: number, scanned: number } }} Readiness results
 */
export function assessReadiness(projectDir) {
  const idx = new SpecIndex(projectDir);

  // Check for authoritative per-section readiness from State Owner in state.json.
  // If present, use it instead of heuristics — the State Owner does actual code
  // analysis and is the source of truth.
  const stateFile = join(projectDir, ".fctry", "state.json");
  let agentReadiness = null;
  if (existsSync(stateFile)) {
    try {
      const state = JSON.parse(readFileSync(stateFile, "utf-8"));
      if (state.sectionReadiness && typeof state.sectionReadiness === "object" &&
          Object.keys(state.sectionReadiness).length > 0) {
        agentReadiness = state.sectionReadiness;
      }
    } catch { /* ignore parse errors */ }
  }

  // Find spec file: .fctry/spec.md (new convention) or *-spec.md at root (legacy)
  const fctrySpec = join(projectDir, ".fctry", "spec.md");
  let specPath, changelogPath;
  if (existsSync(fctrySpec)) {
    specPath = fctrySpec;
    const fctryChangelog = join(projectDir, ".fctry", "changelog.md");
    changelogPath = existsSync(fctryChangelog) ? fctryChangelog : null;
  } else {
    const specFiles = readdirSync(projectDir).filter((f) =>
      f.endsWith("-spec.md")
    );
    if (specFiles.length === 0) {
      idx.close();
      return { summary: {}, sections: [], scanProgress: { total: 0, skipped: 0, scanned: 0 } };
    }
    specPath = join(projectDir, specFiles[0]);
    const changelogFiles = readdirSync(projectDir).filter((f) =>
      f.endsWith("-changelog.md")
    );
    changelogPath = changelogFiles.length
      ? join(projectDir, changelogFiles[0])
      : null;
  }

  // Rebuild index from current spec
  idx.rebuild(specPath, changelogPath);

  const sections = idx.getAllSections();
  const results = [];

  // Identify parent container numbers (e.g., "1", "2") — sections whose
  // number is a prefix of other sections' numbers. These are structural
  // groupings, not buildable sections.
  const allNumbers = new Set(sections.map((s) => s.number).filter(Boolean));
  const parentNumbers = new Set();
  for (const num of allNumbers) {
    if (num.includes(".")) {
      parentNumbers.add(num.split(".")[0]);
    }
  }

  // Count assessable sections (excluding structural headings) for scan progress
  const assessable = sections.filter((s) => {
    const isParentContainer = s.number && !s.number.includes(".") && parentNumbers.has(s.number);
    const isUnnumberedStructural = !s.number && !s.alias;
    return !isParentContainer && !isUnnumberedStructural;
  });

  let skippedCount = 0;
  let deepScannedCount = 0;

  // Write initial scan progress
  writeScanProgress(projectDir, {
    total: assessable.length,
    scanned: 0,
    skipped: 0,
  });

  for (const section of sections) {
    // Skip structural headings:
    // - Parent containers (single-digit number with children, e.g., "## 2. The Experience")
    // - Headings with no number and no alias (TOC, appendices, unnumbered structural headings)
    const isParentContainer = section.number && !section.number.includes(".") && parentNumbers.has(section.number);
    const isUnnumberedStructural = !section.number && !section.alias;
    if (isParentContainer || isUnnumberedStructural) continue;

    let readiness = "draft";
    let skipReason = null;

    // Priority 1: Authoritative State Owner assessment (always wins)
    const agentKey = section.alias || section.number;
    if (agentReadiness && agentKey && agentReadiness[agentKey]) {
      readiness = agentReadiness[agentKey];
    } else if (isDraft(section)) {
      readiness = "draft";
      deepScannedCount++;
    } else {
      // Priority 2: Freshness skip — changelog newer than git for this section's code
      const freshnessResult = freshnessSkip(section, projectDir, idx);
      if (freshnessResult) {
        readiness = freshnessResult;
        skipReason = "skipped (freshness)";
        skippedCount++;
      } else {
        // Priority 3: Semantic stability skip — content hash unchanged
        const stabilityResult = semanticStabilitySkip(section, idx, projectDir);
        if (stabilityResult) {
          readiness = stabilityResult.readiness;
          skipReason = "skipped (stability)";
          skippedCount++;
        } else {
          // Priority 4: Full heuristic scan
          const codeExists = hasRelatedCode(section, projectDir);

          if (codeExists === null) {
            // Meta section — if it has content, it's aligned
            readiness = "aligned";
          } else if (codeExists) {
            // Both spec and code exist — assume aligned (deeper analysis
            // would compare content, but that requires the State Owner's
            // full scan which is beyond this script's scope)
            readiness = "aligned";
          } else {
            // Spec has content but no code found
            readiness = "ready-to-build";
          }
          deepScannedCount++;
        }
      }

      // Update scan progress after each section is processed
      writeScanProgress(projectDir, {
        total: assessable.length,
        scanned: deepScannedCount,
        skipped: skippedCount,
      });
    }

    // Use id-based update for sections without alias or number
    if (section.alias || section.number) {
      idx.setReadiness(section.alias || section.number, readiness);
    } else {
      idx.setReadinessById(section.id, readiness);
    }
    results.push({
      alias: section.alias,
      number: section.number,
      heading: section.heading,
      readiness,
      status: readinessToStatus(readiness),
      ...(skipReason ? { skipReason } : {}),
    });
  }

  const scanProgress = {
    total: assessable.length,
    skipped: skippedCount,
    scanned: deepScannedCount,
  };

  // Write final scan progress
  writeScanProgress(projectDir, scanProgress);

  // Compute summary from results (not DB) so skipped parent sections aren't counted
  const summary = {};
  for (const r of results) {
    summary[r.readiness] = (summary[r.readiness] || 0) + 1;
  }
  idx.close();

  const statusSummary = translateSummary(summary);

  return { summary, statusSummary, sections: results, scanProgress };
}

/**
 * Write readiness results to state.json so downstream consumers
 * (evaluate-scenarios.js, status line, viewer) can read from a single source.
 *
 * @param {string} projectDir - Project root directory
 * @param {Object} summary - Readiness summary counts
 * @param {Object[]} sections - Per-section readiness results
 */
export function writeReadinessState(projectDir, summary, sections) {
  const stateFile = join(projectDir, ".fctry", "state.json");
  try {
    let state = {};
    if (existsSync(stateFile)) {
      state = JSON.parse(readFileSync(stateFile, "utf-8"));
    }
    // Build per-section readiness map (alias → readiness label)
    const sectionReadiness = {};
    for (const s of sections) {
      const key = s.alias || s.number;
      if (key) sectionReadiness[key] = s.readiness;
    }
    state.sectionReadiness = sectionReadiness;
    state.readinessSummary = summary;
    writeFileSync(stateFile, JSON.stringify(state, null, 2), "utf-8");
  } catch { /* non-fatal */ }
}

// CLI entry point — only runs when executed directly, not when imported
const isMainModule = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
  const projectDir = resolve(args[0] || process.cwd());
  const { summary, statusSummary, sections, scanProgress } = assessReadiness(projectDir);

  if (flags.includes("--write-state")) {
    writeReadinessState(projectDir, summary, sections);
  }

  console.log(JSON.stringify({ summary, statusSummary, sections, scanProgress }, null, 2));
}
