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

    // Format A: canonical fctry format — "Validates: `#alias`"
    const aliasPattern = /`#([\w-]+)`/g;
    let hasValidatesLines = false;
    for (const line of content.split("\n")) {
      if (!line.startsWith("Validates:")) continue;
      hasValidatesLines = true;
      let m;
      while ((m = aliasPattern.exec(line)) !== null) {
        counts[m[1]] = (counts[m[1]] || 0) + 1;
      }
    }

    // Format B: alternate format — "## S1: Title" with no Validates lines.
    // Try to associate scenarios with sections by matching scenario titles
    // against TOC section titles (fuzzy: lowercase keyword overlap).
    if (!hasValidatesLines) {
      const tocSections = parseTOC();
      const scenarioTitles = [];
      const titlePattern = /^##\s+S\d+:\s*(.+)/gm;
      let m;
      while ((m = titlePattern.exec(content)) !== null) {
        scenarioTitles.push(m[1].trim().toLowerCase());
      }

      // Also count "#### Scenario:" without Validates (partial canonical)
      const altPattern = /^####\s+Scenario:\s*(.+)/gm;
      while ((m = altPattern.exec(content)) !== null) {
        scenarioTitles.push(m[1].trim().toLowerCase());
      }

      if (scenarioTitles.length > 0 && tocSections.length > 0) {
        // Build keyword sets for each section
        const sectionKeywords = tocSections.map((s) => ({
          alias: s.alias,
          words: new Set(
            s.title.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/)
              .filter((w) => w.length > 2 && !["the", "and", "for", "from", "with", "what", "when", "that", "this"].includes(w))
          ),
        }));

        for (const title of scenarioTitles) {
          const titleWords = new Set(
            title.replace(/[^\w\s]/g, "").split(/\s+/)
              .filter((w) => w.length > 2)
          );

          // Find best matching section by keyword overlap
          let bestAlias = null;
          let bestScore = 0;
          for (const sec of sectionKeywords) {
            let overlap = 0;
            for (const w of titleWords) {
              if (sec.words.has(w)) overlap++;
            }
            if (overlap > bestScore) {
              bestScore = overlap;
              bestAlias = sec.alias;
            }
          }

          if (bestAlias && bestScore > 0) {
            counts[bestAlias] = (counts[bestAlias] || 0) + 1;
          }
        }
      }

      // If no matches were possible, at least record total count so we
      // don't report "0 scenarios" when there are clearly scenarios present.
      if (Object.keys(counts).length === 0 && scenarioTitles.length > 0) {
        counts._totalUnmapped = scenarioTitles.length;
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

// --- Load spec section body text for UX/UI analysis ---

function loadSectionBodies() {
  const bodies = {};
  try {
    const content = readFileSync(specPath, "utf-8");
    // Split on section headings (### N.N Title {#alias})
    const sectionPattern = /^###?\s+(\d+(?:\.\d+)*)\s+.+?\{#([\w-]+)\}/gm;
    const matches = [...content.matchAll(sectionPattern)];
    for (let i = 0; i < matches.length; i++) {
      const alias = matches[i][2];
      const start = matches[i].index + matches[i][0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
      bodies[alias] = content.slice(start, end);
    }
  } catch {}
  return bodies;
}

// --- UX/UI Quality Signals ---

const UX_VOCABULARY = new Set([
  "sees", "feels", "clicks", "drags", "hovers", "transitions", "appears",
  "fades", "animates", "scrolls", "taps", "swipes", "glances", "notices",
  "discovers", "expects", "experiences", "visual", "smooth", "responsive",
  "feedback", "indicator", "toast", "modal", "overlay", "tooltip", "badge",
  "highlight", "glow", "pulse", "shimmer",
]);

const INTERACTION_STATES = [
  "error", "loading", "empty", "hover", "disabled", "active", "selected",
  "focused", "collapsed", "expanded",
];

function measureUxDensity(text) {
  if (!text) return { density: 0, statesCovered: [], statesMissing: INTERACTION_STATES };
  const words = text.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/);
  const totalWords = words.length;
  if (totalWords === 0) return { density: 0, statesCovered: [], statesMissing: INTERACTION_STATES };

  let uxCount = 0;
  for (const w of words) {
    if (UX_VOCABULARY.has(w)) uxCount++;
  }
  const density = uxCount / totalWords;

  const textLower = text.toLowerCase();
  const statesCovered = INTERACTION_STATES.filter((s) => textLower.includes(s));
  const statesMissing = INTERACTION_STATES.filter((s) => !textLower.includes(s));

  return { density, statesCovered, statesMissing };
}

// --- Count experience references per section alias ---

function countExperienceRefsPerSection() {
  const refs = {};
  try {
    const content = readFileSync(specPath, "utf-8");
    // Find section 5.2 and extract which aliases are mentioned
    const refSection = content.match(/### 5\.2.*?\n([\s\S]*?)(?=\n### |\n## |$)/);
    if (refSection) {
      const aliasPattern = /`#([\w-]+)`/g;
      let m;
      while ((m = aliasPattern.exec(refSection[1])) !== null) {
        refs[m[1]] = (refs[m[1]] || 0) + 1;
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
  const sectionBodies = loadSectionBodies();
  const expRefCounts = countExperienceRefsPerSection();

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
    // If scenarios exist but couldn't be mapped to sections (unmapped format),
    // skip this signal — we know scenarios exist, just can't attribute them.
    const scenarioCount = scenarioCounts[alias] || 0;
    const hasUnmappedScenarios = scenarioCounts._totalUnmapped > 0;
    if (scenarioCount === 0 && !hasUnmappedScenarios) {
      score += 3;
      signals.push("no scenarios validate this section");
    } else if (scenarioCount === 0 && hasUnmappedScenarios) {
      score += 1;
      signals.push(`scenarios exist (${scenarioCounts._totalUnmapped} total) but use non-standard format — cannot map to sections`);
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

    // Signal 4: Low UX vocabulary density (< 1% = 2 points, < 2% = 1 point)
    const ux = measureUxDensity(sectionBodies[alias]);
    if (ux.density < 0.01) {
      score += 2;
      signals.push(`low experience-language density (${(ux.density * 100).toFixed(1)}% UX vocabulary — section may be implementation-heavy)`);
    } else if (ux.density < 0.02) {
      score += 1;
      signals.push(`moderate experience-language density (${(ux.density * 100).toFixed(1)}% UX vocabulary)`);
    }

    // Signal 5: Missing interaction state coverage (sections describing UI should mention states)
    // Only flag for 2.x sections (experience sections likely to have UI)
    const isExperienceSection = section.number.startsWith("2.");
    if (isExperienceSection && ux.statesMissing.length >= 8) {
      score += 1;
      signals.push(`missing interaction states: no mention of ${ux.statesMissing.slice(0, 4).join(", ")} (common UX blind spots)`);
    }

    // Signal 6: No experience references linked (0 refs in §5.2 = 1 point)
    const refCount = expRefCounts[alias] || 0;
    if (refCount === 0 && isExperienceSection) {
      score += 1;
      signals.push("no experience references linked in §5.2 (no design inspiration)");
    }

    // Only include sections with at least one gap signal
    if (score === 0) continue;

    // Generate search queries from section title + tech stack
    // When UX signals dominate, generate design-oriented queries
    const isDesignGap = ux.density < 0.02 && isExperienceSection;
    const queries = generateQueries(section.title, alias, techStack, isDesignGap);

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
      uxDensity: Math.round(ux.density * 1000) / 1000,
      designGap: isDesignGap || false,
    });
  }

  // Sort by score descending (highest gaps first)
  gaps.sort((a, b) => b.score - a.score);

  return { gaps, techStack, existingRefs: [...existingRefs], sectionCount: buildable.length };
}

// --- Generate search queries from section title and tech stack ---

function generateQueries(title, alias, techStack, isDesignGap) {
  // Clean title for search: remove articles, normalize
  const clean = title
    .toLowerCase()
    .replace(/\b(the|a|an|from|to|and|or|in|on|by|for|of|with)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const queries = [];

  // Domain-contextualized query (section title + "coding agent" or "spec" or "plugin")
  // This produces better results than bare section titles like "external connections"
  const domainHints = {
    "external-connections": "MCP server API integration",
    "performance": "claude code plugin performance optimization",
    "capabilities": "AI agent capabilities autonomous",
    "entities": "specification data model tracking",
    "rules": "spec validation rules enforcement",
    "status-line": "terminal status line CLI",
    "error-handling": "error recovery agent graceful",
    "details": "developer experience polish",
    "navigate-sections": "document section navigation",
    "multi-session": "multi session state persistence interview",
  };

  const contextual = domainHints[alias] || clean;

  // Design-aware query generation: when UX signals dominate,
  // search for interaction patterns and design inspiration
  if (isDesignGap) {
    queries.push(`${clean} interaction patterns UX`);
    queries.push(`${clean} design system component`);
  } else {
    queries.push(contextual);
  }

  // Stack-specific query (for npm, crates, pypi)
  if (techStack.length > 0) {
    const primary = techStack[0].toLowerCase();
    queries.push(`${contextual} ${primary}`);
  }

  // Alias-based query as fallback
  const aliasClean = alias.replace(/-/g, " ");
  if (aliasClean !== contextual) {
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
