#!/usr/bin/env node
/**
 * Assess section readiness for an fctry project.
 *
 * Compares spec sections against the codebase to determine readiness:
 *   draft            — section content is incomplete or placeholder
 *   needs-spec-update — code exists but spec doesn't describe it
 *   spec-ahead       — spec describes it but code doesn't exist yet
 *   aligned          — spec and code match
 *   ready-to-execute — aligned and no open issues
 *   satisfied        — scenarios passing
 *
 * Usage:
 *   node assess-readiness.js <project-dir>
 *
 * Writes readiness values to the SQLite spec index and outputs a summary
 * to stdout as JSON (for the status line and viewer to consume).
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { SpecIndex } from "./index.js";

/**
 * Heuristic: determine if a section has "real" content or is just a stub.
 * A draft section has fewer than 30 words of content.
 */
function isDraft(section) {
  return section.word_count < 30;
}

/**
 * Heuristic: search for code files that relate to a section's alias or heading.
 * Returns true if any source files reference this concept.
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

  // Check for code directories/files that match the section's alias
  const srcDir = join(projectDir, "src");
  if (!existsSync(srcDir)) return false;

  const alias = section.alias || "";
  const heading = (section.heading || "").toLowerCase();

  // Map common section aliases to likely code locations
  const codeHints = {
    "first-run": ["commands/init"],
    "core-flow": ["commands/init", "agents/interviewer"],
    "multi-session": ["agents/interviewer"],
    "evolve-flow": ["commands/evolve"],
    "ref-flow": ["commands/ref"],
    "review-flow": ["commands/review"],
    "execute-flow": ["commands/execute", "agents/executor"],
    "navigate-sections": ["references/alias-resolution"],
    "spec-viewer": ["src/viewer"],
    "error-handling": ["references/error-conventions"],
    "details": ["references/shared-concepts"],
    "status-line": ["src/statusline"],
    capabilities: ["agents/", "commands/"],
    entities: ["references/state-protocol"],
    rules: ["references/", "agents/"],
    "external-connections": ["agents/researcher", "agents/visual-translator"],
  };

  const hints = codeHints[alias] || [];
  for (const hint of hints) {
    const fullPath = join(projectDir, hint);
    if (existsSync(fullPath) || existsSync(fullPath + ".md") || existsSync(fullPath + ".js")) {
      return true;
    }
  }

  // Fallback: check if the alias appears in any src/ files
  try {
    const files = walkDir(srcDir, 3);
    for (const f of files) {
      try {
        const content = readFileSync(f, "utf-8");
        if (alias && content.toLowerCase().includes(alias.replace(/-/g, ""))) {
          return true;
        }
      } catch { /* skip unreadable files */ }
    }
  } catch { /* src dir not walkable */ }

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
        } else if (/\.(js|ts|jsx|tsx|md|sh|json)$/.test(entry)) {
          results.push(full);
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return results;
}

/**
 * Assess readiness for all sections in the index.
 *
 * @param {string} projectDir - Project root directory
 * @returns {{ summary: Object, sections: Array }} Readiness results
 */
export function assessReadiness(projectDir) {
  const idx = new SpecIndex(projectDir);

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
      return { summary: {}, sections: [] };
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

  for (const section of sections) {
    // Skip structural headings:
    // - Parent containers (single-digit number with children, e.g., "## 2. The Experience")
    // - Headings with no number and no alias (TOC, appendices, unnumbered structural headings)
    const isParentContainer = section.number && !section.number.includes(".") && parentNumbers.has(section.number);
    const isUnnumberedStructural = !section.number && !section.alias;
    if (isParentContainer || isUnnumberedStructural) continue;

    let readiness = "draft";

    if (isDraft(section)) {
      readiness = "draft";
    } else {
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
        readiness = "spec-ahead";
      }
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
    });
  }

  // Compute summary from results (not DB) so skipped parent sections aren't counted
  const summary = {};
  for (const r of results) {
    summary[r.readiness] = (summary[r.readiness] || 0) + 1;
  }
  idx.close();

  return { summary, sections: results };
}

// CLI entry point — only runs when executed directly, not when imported
const isMainModule = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  const projectDir = process.argv[2] || process.cwd();
  const { summary, sections } = assessReadiness(resolve(projectDir));
  console.log(JSON.stringify({ summary, sections }, null, 2));
}
