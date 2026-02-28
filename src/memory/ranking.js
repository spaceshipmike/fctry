/**
 * Fused multi-signal ranking algorithm for the global memory store.
 *
 * Parses ~/.fctry/memory.md, scores each active entry across three signals
 * (section alias match, recency, type priority), applies a diversity penalty
 * so no single section dominates, and selects entries within a ~2000 token budget.
 *
 * No external dependencies — pure Node.js.
 *
 * Usage:
 *   import { selectMemoryEntries } from './ranking.js';
 *   const entries = selectMemoryEntries(memoryMarkdown, {
 *     targetAliases: ['core-flow', 'error-handling'],
 *     broadScan: false,
 *     tokenBudget: 2000,
 *     currentProject: 'my-project',
 *     currentTechStack: 'node, express',
 *   });
 */

// --- Entry Parsing ---

/**
 * Parse memory.md into structured entries.
 * Entry header format: ### {ISO timestamp} | {type} | {project-name}
 */
export function parseMemoryEntries(markdown) {
  if (!markdown || !markdown.trim()) return [];

  const entries = [];
  const headerRegex = /^### (.+?)\s*\|\s*([\w-]+)\s*\|\s*(.+)$/gm;
  const positions = [];
  let match;

  while ((match = headerRegex.exec(markdown)) !== null) {
    positions.push({
      timestamp: match[1].trim(),
      type: match[2].trim(),
      project: match[3].trim(),
      start: match.index,
      headerEnd: match.index + match[0].length,
    });
  }

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const bodyEnd = i < positions.length - 1 ? positions[i + 1].start : markdown.length;
    const body = markdown.slice(pos.headerEnd, bodyEnd).trim();

    const sectionM = body.match(/\*\*Section:\*\*\s*#([\w-]+)\s*\(([^)]+)\)/);
    const contentM = body.match(/\*\*Content:\*\*\s*(.+?)(?=\n\*\*|\n*$)/s);
    const authorityM = body.match(/\*\*Authority:\*\*\s*(user|agent)/);
    const statusM = body.match(/\*\*Status:\*\*\s*(\w+)/);
    const supersededByM = body.match(/\*\*Superseded-By:\*\*\s*(.+)/);
    const supersededAtM = body.match(/\*\*Superseded-At:\*\*\s*(.+)/);
    // Structured lesson metadata (optional)
    const componentM = body.match(/\*\*Component:\*\*\s*(.+)/);
    const severityM = body.match(/\*\*Severity:\*\*\s*(.+)/);
    const tagsM = body.match(/\*\*Tags:\*\*\s*(.+)/);

    entries.push({
      timestamp: pos.timestamp,
      type: pos.type,
      project: pos.project,
      section: sectionM ? { alias: sectionM[1], number: sectionM[2] } : null,
      content: contentM ? contentM[1].trim() : "",
      authority: authorityM ? authorityM[1] : "agent",
      status: statusM ? statusM[1] : "active",
      supersededBy: supersededByM ? supersededByM[1].trim() : null,
      supersededAt: supersededAtM ? supersededAtM[1].trim() : null,
      component: componentM ? componentM[1].trim() : null,
      severity: severityM ? severityM[1].trim() : null,
      tags: tagsM ? tagsM[1].trim().split(/,\s*/) : [],
      rawBody: body,
      rawStart: pos.start,
      rawEnd: bodyEnd,
    });
  }

  return entries;
}

// --- Token Estimation ---

/**
 * Rough token estimate: ~4 chars per token for English text.
 * Includes the entry header + body in the estimate.
 */
function estimateTokens(entry) {
  const headerLen = `### ${entry.timestamp} | ${entry.type} | ${entry.project}`.length;
  const bodyLen = entry.rawBody.length;
  return Math.ceil((headerLen + bodyLen) / 4);
}

// --- Scoring ---

// Weights for the fused ranking (sum to 1.0)
const WEIGHTS = {
  sectionMatch: 0.50, // strongest signal per spec
  recency: 0.30,
  typePriority: 0.20,
};

// Type priority scores (higher = more valuable for injection)
const TYPE_SCORES = {
  "decision-record": 1.0,
  "cross-project-lesson": 0.75,
  "conversation-digest": 0.50,
  "user-preference": 0.25,
};

// Diversity penalty factor applied per same-section entry selected
const DIVERSITY_PENALTY = 0.6;

/**
 * Score an entry against the current context.
 *
 * @param {object} entry - Parsed memory entry
 * @param {object} opts
 * @param {string[]} opts.targetAliases - Section aliases the current command targets
 * @param {boolean} opts.broadScan - True for full review/execute (all entries are candidates)
 * @param {number} opts.now - Current timestamp in ms
 * @param {number} opts.oldestTimestamp - Oldest entry timestamp in ms (for normalization)
 * @returns {number} Score in [0, 1]
 */
function scoreEntry(entry, { targetAliases, broadScan, now, oldestTimestamp }) {
  // (a) Section alias match
  let sectionScore = 0;
  if (broadScan) {
    // All entries are candidates in a broad scan; give a baseline
    sectionScore = 0.5;
    // Boost if the entry happens to match a target alias
    if (entry.section && targetAliases.includes(entry.section.alias)) {
      sectionScore = 1.0;
    }
  } else if (entry.section && targetAliases.includes(entry.section.alias)) {
    sectionScore = 1.0;
  } else if (entry.section) {
    // Partial credit if the entry has a section (may be tangentially relevant)
    sectionScore = 0.1;
  } else {
    // Entries without a section (e.g., user-preference) get moderate baseline
    sectionScore = entry.type === "user-preference" ? 0.4 : 0.2;
  }

  // (b) Recency — normalize to [0, 1] range
  let recencyScore = 0.5; // default for unparseable timestamps
  try {
    const entryTime = new Date(entry.timestamp).getTime();
    if (!isNaN(entryTime) && now > oldestTimestamp) {
      recencyScore = (entryTime - oldestTimestamp) / (now - oldestTimestamp);
    }
  } catch {
    // unparseable timestamp, keep default
  }

  // (c) Type priority
  const typeScore = TYPE_SCORES[entry.type] || 0.25;

  // Authority boost: user-authored entries get a small boost
  const authorityBoost = entry.authority === "user" ? 0.05 : 0;

  // Fused weighted sum
  return (
    WEIGHTS.sectionMatch * sectionScore +
    WEIGHTS.recency * recencyScore +
    WEIGHTS.typePriority * typeScore +
    authorityBoost
  );
}

// --- Selection ---

/**
 * Select memory entries within the token budget using fused ranking + diversity.
 *
 * @param {string} markdown - Raw contents of ~/.fctry/memory.md
 * @param {object} opts
 * @param {string[]} [opts.targetAliases=[]] - Section aliases the current command targets
 * @param {boolean} [opts.broadScan=false] - True for full review/execute
 * @param {number} [opts.tokenBudget=2000] - Max tokens to inject
 * @param {string} [opts.currentProject] - Current project name (for cross-project matching)
 * @param {string} [opts.currentTechStack] - Current project tech stack description
 * @returns {object} { selected: Entry[], totalTokens: number, budget: number }
 */
export function selectMemoryEntries(markdown, opts = {}) {
  const {
    targetAliases = [],
    broadScan = false,
    tokenBudget = 2000,
    currentProject = "",
    currentTechStack = "",
  } = opts;

  const allEntries = parseMemoryEntries(markdown);

  // Filter to active entries only (skip superseded, consolidated)
  const activeEntries = allEntries.filter((e) => e.status === "active");

  if (activeEntries.length === 0) {
    return { selected: [], totalTokens: 0, budget: tokenBudget };
  }

  // Compute timestamp range for recency normalization
  const now = Date.now();
  let oldestTimestamp = now;
  for (const entry of activeEntries) {
    try {
      const t = new Date(entry.timestamp).getTime();
      if (!isNaN(t) && t < oldestTimestamp) oldestTimestamp = t;
    } catch {
      // skip
    }
  }

  // Score all entries
  const scored = activeEntries.map((entry) => ({
    entry,
    baseScore: scoreEntry(entry, { targetAliases, broadScan, now, oldestTimestamp }),
    tokens: estimateTokens(entry),
  }));

  // Sort by base score descending
  scored.sort((a, b) => b.baseScore - a.baseScore);

  // Greedy selection with diversity penalty
  const selected = [];
  let totalTokens = 0;
  const sectionCounts = {}; // track how many entries per section alias are selected

  for (const item of scored) {
    if (totalTokens + item.tokens > tokenBudget) continue;

    // Apply diversity penalty based on how many entries from this section are already selected
    const sectionKey = item.entry.section ? item.entry.section.alias : "__no_section__";
    const count = sectionCounts[sectionKey] || 0;
    const adjustedScore = item.baseScore * Math.pow(DIVERSITY_PENALTY, count);

    // Skip if the adjusted score is too low (below threshold)
    if (adjustedScore < 0.05 && selected.length > 0) continue;

    selected.push({
      ...item.entry,
      score: adjustedScore,
      tokens: item.tokens,
    });

    totalTokens += item.tokens;
    sectionCounts[sectionKey] = count + 1;
  }

  // Re-sort selected by score after diversity adjustment
  selected.sort((a, b) => b.score - a.score);

  return { selected, totalTokens, budget: tokenBudget };
}

// --- Cross-Project Structural Matching ---

/**
 * Check whether a cross-project lesson structurally matches the current project.
 *
 * Conservative matching: false negatives are better than false positives.
 *
 * @param {object} lesson - Parsed memory entry of type cross-project-lesson
 * @param {object} context
 * @param {string[]} context.projectAliases - Section aliases in the current project
 * @param {string} context.techStack - Current project tech stack description
 * @param {string} context.currentProject - Current project name
 * @returns {boolean} Whether the lesson is structurally relevant
 */
export function matchesCrossProject(lesson, context) {
  // Never match lessons from the same project (they're already in lessons.md)
  if (lesson.project === context.currentProject) return false;

  // Must be a cross-project-lesson type
  if (lesson.type !== "cross-project-lesson") return false;

  let matchSignals = 0;

  // Signal 1: Section alias match
  if (lesson.section && context.projectAliases.includes(lesson.section.alias)) {
    matchSignals += 2; // strong signal
  }

  // Signal 2: Tech stack overlap
  if (lesson.content && context.techStack) {
    const lessonTech = lesson.content.toLowerCase();
    const currentTech = context.techStack.toLowerCase();
    // Check for common tech stack keywords
    const techKeywords = [
      "react", "next.js", "nextjs", "node", "express", "python", "django",
      "flask", "rust", "cargo", "go", "vue", "angular", "svelte", "sqlite",
      "postgres", "mongodb", "redis", "playwright", "jest", "vitest",
      "typescript", "javascript", "esm", "commonjs",
    ];
    const lessonKeywords = techKeywords.filter((kw) => lessonTech.includes(kw));
    const currentKeywords = techKeywords.filter((kw) => currentTech.includes(kw));
    const overlap = lessonKeywords.filter((kw) => currentKeywords.includes(kw));
    if (overlap.length > 0) matchSignals += 1;
  }

  // Signal 3: Tag overlap (if lesson has tags)
  if (lesson.tags && lesson.tags.length > 0 && context.projectAliases) {
    const tagOverlap = lesson.tags.filter((t) => context.projectAliases.includes(t));
    if (tagOverlap.length > 0) matchSignals += 1;
  }

  // Conservative: require at least 2 match signals
  return matchSignals >= 2;
}

// --- Decision Supersession ---

/**
 * Detect and mark superseded decision records in the memory store.
 * Groups decisions by (section alias, decision type pattern) and marks
 * older entries as superseded. Respects authority: agent entries cannot
 * supersede user entries.
 *
 * @param {object[]} entries - All parsed entries from the memory file
 * @returns {object[]} Updated entries with supersession fields set
 */
export function applySupersession(entries) {
  // Group decision records by section alias
  const decisionGroups = {};
  for (const entry of entries) {
    if (entry.type !== "decision-record" || entry.status === "superseded") continue;
    const key = entry.section ? entry.section.alias : "__global__";
    if (!decisionGroups[key]) decisionGroups[key] = [];
    decisionGroups[key].push(entry);
  }

  const changes = [];

  for (const [key, group] of Object.entries(decisionGroups)) {
    if (group.length <= 1) continue;

    // Sort by timestamp descending (newest first)
    group.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime() || 0;
      const tb = new Date(b.timestamp).getTime() || 0;
      return tb - ta;
    });

    const newest = group[0];

    for (let i = 1; i < group.length; i++) {
      const older = group[i];

      // Authority check: agent cannot supersede user
      if (older.authority === "user" && newest.authority === "agent") continue;

      // Check if they cover the same pattern (content similarity heuristic)
      if (!contentOverlaps(newest.content, older.content)) continue;

      // Mark as superseded
      older.status = "superseded";
      older.supersededBy = newest.timestamp;
      older.supersededAt = new Date().toISOString();
      changes.push(older);
    }
  }

  return changes;
}

/**
 * Heuristic check for whether two decision record contents cover the same pattern.
 * Looks for shared key nouns/phrases (section names, action words).
 */
function contentOverlaps(contentA, contentB) {
  if (!contentA || !contentB) return false;

  const normalize = (s) =>
    s
      .toLowerCase()
      .replace(/[^\w\s#-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3);

  const wordsA = new Set(normalize(contentA));
  const wordsB = new Set(normalize(contentB));

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }

  // Require at least 30% overlap of the smaller set
  const minSize = Math.min(wordsA.size, wordsB.size);
  return minSize > 0 && overlap / minSize >= 0.3;
}

// --- Formatting ---

/**
 * Format selected entries for injection into a State Owner briefing.
 *
 * @param {object} result - Output from selectMemoryEntries
 * @returns {string} Markdown-formatted memory section
 */
export function formatForBriefing(result) {
  if (result.selected.length === 0) return "";

  const lines = [
    `### Relevant Memory`,
    `${result.selected.length} entries selected (${result.totalTokens} tokens of ~${result.budget} budget):`,
  ];

  for (const entry of result.selected) {
    const sectionTag = entry.section
      ? `#${entry.section.alias} (${entry.section.number})`
      : "";
    const projectTag = entry.project || "unknown";
    const snippet =
      entry.content.length > 120 ? entry.content.slice(0, 117) + "..." : entry.content;
    lines.push(
      `- ${entry.type} | ${projectTag} | ${entry.timestamp}: ${snippet}${sectionTag ? ` [${sectionTag}]` : ""}`
    );
  }

  return lines.join("\n");
}

/**
 * Format a decision record as a numbered default proposal.
 *
 * @param {object} entry - The decision record entry
 * @param {string} alternative - Description of the alternative option
 * @returns {string} Formatted proposal string
 */
export function formatDecisionProposal(entry, alternative) {
  const choiceSummary =
    entry.content.length > 100
      ? entry.content.slice(0, 97) + "..."
      : entry.content;
  return [
    `(1) ${choiceSummary} (your previous preference)`,
    `(2) ${alternative}`,
  ].join("\n");
}
