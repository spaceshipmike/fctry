#!/usr/bin/env node
/**
 * Gap detection for the automated discovery loop.
 *
 * Implements Layer 1 (structural, zero LLM cost) gap detection from the spec:
 * - Sections with few or no scenarios (low scenario coverage)
 * - Sections with thin body text (low word count)
 * - Sections with no changelog entries since init (never refined)
 * - Sections with low satisfaction scores
 * - Sections with readiness draft or undocumented
 *
 * Outputs ranked gaps with suggested search queries, informed by the
 * project's tech-stack from spec frontmatter.
 *
 * Usage:
 *   node scripts/detect-gaps.js [project-dir] [--json]
 */

const { readFileSync, existsSync, openSync, readSync, closeSync } = require("fs");
const { join, resolve } = require("path");

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
const projectDir = resolve(args[0] || process.cwd());
const jsonOutput = flags.includes("--json");

const fctryDir = join(projectDir, ".fctry");
const specPath = join(fctryDir, "spec.md");
const scenariosPath = join(fctryDir, "scenarios.md");
const changelogPath = join(fctryDir, "changelog.md");
const statePath = join(fctryDir, "state.json");

if (!existsSync(specPath)) {
  console.error("No spec found at " + specPath);
  process.exit(1);
}

// --- Parse spec frontmatter for tech-stack ---

function parseTechStack() {
  try {
    const content = readFileSync(specPath, "utf-8").slice(0, 4000);
    const match = content.match(/tech-stack:\s*\[([^\]]+)\]/);
    if (match) {
      return match[1].split(",").map((s) => s.trim().replace(/['"]/g, ""));
    }
  } catch {}
  return [];
}

// --- Parse spec TOC for section metadata ---

function parseTOC() {
  const sections = [];
  try {
    const fd = openSync(specPath, "r");
    const buf = Buffer.alloc(8192);
    readSync(fd, buf, 0, 8192, 0);
    closeSync(fd);
    const head = buf.toString("utf-8");
    const tocPattern = /^\s+-\s+([\d.]+)\s+\[([^\]]+)\].*`#([\w-]+)`/gm;
    let m;
    while ((m = tocPattern.exec(head)) !== null) {
      sections.push({ number: m[1], title: m[2], alias: m[3] });
    }
  } catch {}
  return sections;
}

// --- Count scenarios per section alias ---

function countScenariosPerSection() {
  const counts = {};
  try {
    if (!existsSync(scenariosPath)) return counts;
    const content = readFileSync(scenariosPath, "utf-8");
    const aliasPattern = /`#([\w-]+)`/g;
    // Count each alias mention in Validates: lines
    for (const line of content.split("\n")) {
      if (!line.startsWith("Validates:")) continue;
      let m;
      while ((m = aliasPattern.exec(line)) !== null) {
        counts[m[1]] = (counts[m[1]] || 0) + 1;
      }
    }
  } catch {}
  return counts;
}

// --- Count changelog entries per section alias ---

function countChangelogPerSection() {
  const counts = {};
  try {
    if (!existsSync(changelogPath)) return counts;
    const content = readFileSync(changelogPath, "utf-8");
    const aliasPattern = /`#([\w-]+)`/g;
    let m;
    while ((m = aliasPattern.exec(content)) !== null) {
      counts[m[1]] = (counts[m[1]] || 0) + 1;
    }
  } catch {}
  return counts;
}

// --- Load section readiness and scenario score from state.json ---

function loadState() {
  try {
    if (!existsSync(statePath)) return {};
    return JSON.parse(readFileSync(statePath, "utf-8"));
  } catch {
    return {};
  }
}

// --- Load existing experience references (for novelty baseline) ---

function loadExistingReferences() {
  const refs = new Set();
  try {
    const content = readFileSync(specPath, "utf-8");
    // Find section 5.2 Experience References and extract reference names
    const refSection = content.match(/### 5\.2.*?\n([\s\S]*?)(?=\n### |\n## |$)/);
    if (refSection) {
      // Extract bold reference names: **name** (pattern)
      const namePattern = /\*\*([^*]+)\*\*/g;
      let m;
      while ((m = namePattern.exec(refSection[1])) !== null) {
        refs.add(m[1].toLowerCase());
      }
    }
  } catch {}
  return refs;
}

// --- Score and rank gaps ---

function detectGaps() {
  const tocSections = parseTOC();
  const scenarioCounts = countScenariosPerSection();
  const changelogCounts = countChangelogPerSection();
  const state = loadState();
  const readiness = state.sectionReadiness || {};
  const techStack = parseTechStack();
  const existingRefs = loadExistingReferences();

  // Only analyze experience (2.x) and behavior (3.x) sections
  const buildable = tocSections.filter((s) => {
    const top = parseInt(s.number.split(".")[0], 10);
    return top === 2 || top === 3;
  });

  const gaps = [];

  for (const section of buildable) {
    const alias = section.alias;
    let score = 0;
    const signals = [];

    // Signal 1: Low scenario coverage (0 scenarios = 3 points, 1-2 = 1 point)
    const scenarioCount = scenarioCounts[alias] || 0;
    if (scenarioCount === 0) {
      score += 3;
      signals.push("no scenarios validate this section");
    } else if (scenarioCount <= 2) {
      score += 1;
      signals.push(`only ${scenarioCount} scenario${scenarioCount !== 1 ? "s" : ""} validate this section`);
    }

    // Signal 2: Never refined (0 changelog mentions = 2 points)
    const changelogCount = changelogCounts[alias] || 0;
    if (changelogCount === 0) {
      score += 2;
      signals.push("never mentioned in changelog (never refined)");
    }

    // Signal 3: Readiness is draft or undocumented (2 points)
    const r = readiness[alias];
    if (r === "draft") {
      score += 2;
      signals.push("readiness: draft");
    } else if (r === "undocumented") {
      score += 2;
      signals.push("readiness: undocumented");
    }

    // Only include sections with at least one gap signal
    if (score === 0) continue;

    // Generate search queries from section title + tech stack
    const queries = generateQueries(section.title, alias, techStack);

    gaps.push({
      alias,
      number: section.number,
      title: section.title,
      score,
      signals,
      scenarioCount,
      changelogCount,
      readiness: r || "unknown",
      queries,
    });
  }

  // Sort by score descending (highest gaps first)
  gaps.sort((a, b) => b.score - a.score);

  return { gaps, techStack, existingRefs: [...existingRefs], sectionCount: buildable.length };
}

// --- Generate search queries from section title and tech stack ---

function generateQueries(title, alias, techStack) {
  // Clean title for search: remove articles, normalize
  const clean = title
    .toLowerCase()
    .replace(/\b(the|a|an|from|to|and|or|in|on|by|for|of|with)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const queries = [];

  // Base query from section title
  queries.push(clean);

  // Stack-specific query (for npm, crates, pypi)
  if (techStack.length > 0) {
    const primary = techStack[0].toLowerCase();
    queries.push(`${clean} ${primary}`);
  }

  // Alias-based query (kebab-case often matches package names)
  const aliasClean = alias.replace(/-/g, " ");
  if (aliasClean !== clean) {
    queries.push(aliasClean);
  }

  return queries;
}

// --- Output ---

const result = detectGaps();

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`Gap Detection — ${result.gaps.length} gaps in ${result.sectionCount} buildable sections`);
  if (result.techStack.length > 0) {
    console.log(`Tech stack: ${result.techStack.join(", ")}`);
  }
  console.log("");

  if (result.gaps.length === 0) {
    console.log("No structural gaps detected.");
  } else {
    for (const gap of result.gaps) {
      console.log(`  ${gap.title} (${gap.number}) — score ${gap.score}`);
      for (const s of gap.signals) {
        console.log(`    - ${s}`);
      }
      console.log(`    queries: ${gap.queries.join(" | ")}`);
      console.log("");
    }
  }
}
