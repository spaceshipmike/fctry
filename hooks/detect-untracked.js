#!/usr/bin/env node
// PostToolUse hook: detect file writes outside fctry commands.
// Fires after Write or Edit tool calls. Checks if the changed file
// maps to a spec section and whether we're inside an fctry command.
// If outside fctry, records the change and outputs a nudge.

const { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } = require("fs");
const { join, relative } = require("path");

// Read hook payload from stdin
let payload;
try {
  const input = readFileSync(0, "utf-8");
  payload = JSON.parse(input);
} catch {
  process.exit(0);
}

const filePath = payload.tool_input?.file_path;
if (!filePath) process.exit(0);

const cwd = payload.session?.cwd || process.cwd();
const fctryDir = join(cwd, ".fctry");
const statePath = join(fctryDir, "fctry-state.json");

// Check if this is a spec project (has .fctry/ and *-spec.md)
let hasSpec = false;
try {
  hasSpec = existsSync(fctryDir) && readdirSync(cwd).some(f => f.endsWith("-spec.md"));
} catch {}
if (!hasSpec) process.exit(0);

// Get relative path — skip files outside project
const relPath = relative(cwd, filePath);
if (relPath.startsWith("..")) process.exit(0);

// Skip non-source files and special directories
if (
  relPath.startsWith(".fctry") ||
  relPath.startsWith(".git") ||
  relPath.startsWith("node_modules") ||
  relPath.includes("/node_modules/")
) {
  process.exit(0);
}

// Read current state
let state = {};
try {
  if (existsSync(statePath)) {
    state = JSON.parse(readFileSync(statePath, "utf-8"));
  }
} catch {
  process.exit(0);
}

// If currentCommand is set, we're inside fctry — skip
if (state.currentCommand) process.exit(0);

// Reverse mapping: file path patterns → {alias, number}
// Most specific patterns first for correct matching
const sectionMap = [
  { pattern: "src/statusline", alias: "status-line", number: "2.12" },
  { pattern: "src/viewer", alias: "spec-viewer", number: "2.9" },
  { pattern: "src/spec-index", alias: "entities", number: "3.2" },
  { pattern: "commands/init", alias: "first-run", number: "2.1" },
  { pattern: "commands/evolve", alias: "evolve-flow", number: "2.4" },
  { pattern: "commands/ref", alias: "ref-flow", number: "2.5" },
  { pattern: "commands/review", alias: "review-flow", number: "2.6" },
  { pattern: "commands/execute", alias: "execute-flow", number: "2.7" },
  { pattern: "agents/interviewer", alias: "core-flow", number: "2.2" },
  { pattern: "agents/executor", alias: "execute-flow", number: "2.7" },
  { pattern: "agents/researcher", alias: "external-connections", number: "3.4" },
  { pattern: "agents/visual-translator", alias: "external-connections", number: "3.4" },
  { pattern: "agents/state-owner", alias: "capabilities", number: "3.1" },
  { pattern: "agents/spec-writer", alias: "capabilities", number: "3.1" },
  { pattern: "agents/scenario-crafter", alias: "capabilities", number: "3.1" },
  { pattern: "references/alias-resolution", alias: "navigate-sections", number: "2.8" },
  { pattern: "references/error-conventions", alias: "error-handling", number: "2.10" },
  { pattern: "references/shared-concepts", alias: "details", number: "2.11" },
  { pattern: "references/state-protocol", alias: "entities", number: "3.2" },
  { pattern: "hooks/", alias: "capabilities", number: "3.1" },
  { pattern: "agents/", alias: "capabilities", number: "3.1" },
  { pattern: "commands/", alias: "capabilities", number: "3.1" },
];

// Find matching section (longest pattern match wins)
let match = null;
let matchLen = 0;
for (const entry of sectionMap) {
  if (relPath.includes(entry.pattern) && entry.pattern.length > matchLen) {
    match = entry;
    matchLen = entry.pattern.length;
  }
}

// No match — file isn't covered by a spec section
if (!match) process.exit(0);

// Record the untracked change (deduplicate by file path)
const changes = state.untrackedChanges || [];
if (!changes.some(c => c.file === relPath)) {
  changes.push({
    file: relPath,
    section: match.alias,
    sectionNumber: match.number,
    timestamp: new Date().toISOString(),
  });
  state.untrackedChanges = changes;
  try {
    mkdirSync(fctryDir, { recursive: true });
    writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch {
    // State write failed — nudge still works
  }
}

// Output nudge for the agent to surface to the user
process.stdout.write(
  `This file is covered by \`#${match.alias}\` (${match.number}). ` +
  `Want to update the spec first? ` +
  `(1) Run /fctry:evolve ${match.alias}, ` +
  `(2) Continue — I'll reconcile later`
);
