#!/usr/bin/env node
// Stop hook: anti-rationalization enforcement during autonomous builds.
// Detects premature completion signals in the Executor's responses and
// forces continuation when the build plan's acceptance criteria aren't met.
//
// This is a structural enforcement layer complementing instruction-level
// anti-rationalization design. Instructions counter rationalization through
// persuasion; this hook fires at the decision point and is harder to
// override through context pressure.
//
// Active only during autonomous builds (workflowStep: "executor-build").
// Outside builds, all stops are allowed immediately.

const { readFileSync, existsSync } = require("fs");
const { join } = require("path");

// Read hook payload from stdin
let payload;
try {
  const input = readFileSync(0, "utf-8");
  payload = JSON.parse(input);
} catch {
  // Can't parse input — allow stop
  process.exit(0);
}

// Guard: if stop_hook_active is true, a previous stop hook already forced
// continuation. Allow this stop to prevent infinite loops.
if (payload.stop_hook_active) {
  process.exit(0);
}

// Check if we're in an autonomous build
const cwd = payload.cwd || process.cwd();
const statePath = join(cwd, ".fctry", "state.json");

let state = {};
try {
  if (existsSync(statePath)) {
    state = JSON.parse(readFileSync(statePath, "utf-8"));
  }
} catch {
  // Can't read state — allow stop
  process.exit(0);
}

// Only active during executor builds
if (state.workflowStep !== "executor-build") {
  process.exit(0);
}

// Check if build has pending chunks (not all completed)
const buildRun = state.buildRun;
if (!buildRun || buildRun.status !== "running") {
  process.exit(0);
}

const chunks = buildRun.chunks || [];
const pendingChunks = chunks.filter(
  (c) => c.status === "planned" || c.status === "active"
);

// If all chunks are completed or failed, the build is genuinely done
if (pendingChunks.length === 0) {
  process.exit(0);
}

// Get the response text to evaluate
const response = payload.last_assistant_message || "";

// Premature completion patterns — phrases that signal rationalization
// rather than genuine completion of the current chunk's work
const rationalizationPatterns = [
  // "Good enough" framing
  /\bthis is good enough\b/i,
  /\bgood enough for now\b/i,
  /\bsufficient for now\b/i,
  /\badequate for now\b/i,

  // Scope deferral
  /\bthe rest is out of scope\b/i,
  /\bout of scope for this\b/i,
  /\bbeyond the scope\b/i,
  /\bcan be addressed in a follow[- ]?up\b/i,
  /\baddress(?:ed)? later\b/i,
  /\bdefer(?:red)? to a future\b/i,
  /\bleave that for (?:a )?later\b/i,
  /\bhandle(?:d)? in a separate\b/i,

  // Premature chunk completion
  /\blet'?s move on to the next chunk\b/i,
  /\bmoving on to (?:the )?next\b/i,
  /\bwe can skip\b/i,
  /\bskip(?:ping)? (?:this|the remaining)\b/i,

  // False completion signals
  /\bthat covers (?:the )?(?:main|key|essential|important) (?:parts?|pieces?|aspects?)\b/i,
  /\bthat should be (?:enough|sufficient)\b/i,
  /\bthe (?:core|main|essential) (?:work|implementation) is (?:done|complete)\b/i,
  /\bI'?ve done (?:the )?(?:main|most important)\b/i,

  // Rationalized stopping
  /\bdiminishing returns\b/i,
  /\bnot worth the (?:effort|time|tokens?)\b/i,
  /\bperfect is the enemy\b/i,
  /\bgold[- ]?plat(?:e|ing)\b/i,
];

// Check for rationalization patterns
const matchedPatterns = [];
for (const pattern of rationalizationPatterns) {
  if (pattern.test(response)) {
    matchedPatterns.push(pattern.source);
  }
}

if (matchedPatterns.length === 0) {
  // No rationalization detected — allow stop
  process.exit(0);
}

// Build the continuation reason with context about what's pending
const activeChunk = chunks.find((c) => c.status === "active");
const chunkName = activeChunk ? activeChunk.name : pendingChunks[0].name;
const pendingCount = pendingChunks.length;
const totalCount = chunks.length;
const completedCount = chunks.filter((c) => c.status === "completed").length;

const reason =
  `Anti-rationalization check: premature completion detected. ` +
  `Build progress: ${completedCount}/${totalCount} chunks completed, ` +
  `${pendingCount} remaining. Current chunk: "${chunkName}". ` +
  `Continue building — complete the current chunk's acceptance criteria ` +
  `before stopping. The plan was approved by the user and all chunks ` +
  `must be attempted.`;

// Output JSON to force continuation
const output = JSON.stringify({ decision: "block", reason });
process.stdout.write(output);
