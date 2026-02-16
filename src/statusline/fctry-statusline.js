#!/usr/bin/env node

// fctry terminal status line for Claude Code
// Reads: stdin (session JSON), .fctry/state.json, .git/HEAD, git tags
// Outputs: one or two ANSI-colored lines (compact when idle)

const { readFileSync, existsSync } = require("fs");
const { join, basename } = require("path");
const { execSync } = require("child_process");

// ANSI color helpers
const reset = "\x1b[0m";
const dim = "\x1b[2m";
const magenta = "\x1b[35m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const red = "\x1b[31m";
const cyan = "\x1b[36m";

function colorForPercent(pct) {
  if (pct >= 90) return red;
  if (pct >= 70) return yellow;
  return green;
}

function colorForScore(satisfied, total) {
  if (total === 0) return dim;
  const ratio = satisfied / total;
  if (ratio >= 0.8) return green;
  if (ratio >= 0.5) return yellow;
  return red;
}

// Read all of stdin synchronously
let sessionData = {};
try {
  const input = readFileSync(0, "utf-8");
  if (input.trim()) sessionData = JSON.parse(input);
} catch {
  // No stdin or bad JSON — proceed with defaults
}

const cwd = sessionData.workspace?.current_dir || sessionData.cwd || process.cwd();
const contextPct = sessionData.context_window?.used_percentage;

// Read .fctry/state.json
let state = {};
const statePath = join(cwd, ".fctry", "state.json");
try {
  if (existsSync(statePath)) {
    state = JSON.parse(readFileSync(statePath, "utf-8"));
  }
} catch {
  // Missing or bad state file — proceed with empty state
}

// Read git branch from .git/HEAD
let branch = null;
try {
  const headPath = join(cwd, ".git", "HEAD");
  if (existsSync(headPath)) {
    const head = readFileSync(headPath, "utf-8").trim();
    if (head.startsWith("ref: refs/heads/")) {
      branch = head.replace("ref: refs/heads/", "");
    } else {
      branch = head.slice(0, 7); // detached HEAD — show short hash
    }
  }
} catch {
  // No git — that's fine
}

// Get latest git version tag (vX.Y.Z)
let appVersion = null;
try {
  appVersion = execSync("git describe --tags --abbrev=0 --match 'v*' 2>/dev/null", {
    cwd,
    encoding: "utf-8",
    timeout: 2000,
  }).trim();
} catch {
  // No tags — that's fine
}

const sep = ` ${dim}│${reset} `;

// Build row 1: project │ branch │ spec vX.Y │ app vX.Y.Z │ ctx%
const projectName = basename(cwd);
const row1Parts = [projectName];

if (branch) row1Parts.push(branch);
if (state.specVersion) row1Parts.push(`spec v${state.specVersion}`);
if (appVersion) row1Parts.push(appVersion);
if (contextPct != null) {
  const color = colorForPercent(contextPct);
  row1Parts.push(`${color}ctx ${Math.round(contextPct)}%${reset}`);
}

// Build row 2 parts: command │ chunk │ section │ scenarios │ ready │ untracked │ next
const row2Parts = [];

// Active command (highlighted)
if (state.currentCommand) row2Parts.push(`${cyan}${state.currentCommand}${reset}`);

// Chunk progress during execute builds
if (state.chunkProgress && state.chunkProgress.total > 0) {
  const { current, total } = state.chunkProgress;
  row2Parts.push(`chunk ${current}/${total}`);
}

// Active section being worked on
if (state.activeSection) {
  const label = state.activeSectionNumber
    ? `${state.activeSection} (${state.activeSectionNumber})`
    : state.activeSection;
  row2Parts.push(`${magenta}${label}${reset}`);
}

// Scenario score
if (state.scenarioScore && state.scenarioScore.total > 0) {
  const { satisfied, total } = state.scenarioScore;
  if (satisfied > 0) {
    const color = colorForScore(satisfied, total);
    row2Parts.push(`${color}${satisfied}/${total} scenarios${reset}`);
  } else {
    row2Parts.push(`${dim}${total} scenarios${reset}`);
  }
}

// Section readiness
if (state.readinessSummary) {
  const r = state.readinessSummary;
  const total = Object.values(r).reduce((a, b) => a + b, 0);
  const ready = (r.aligned || 0) + (r["ready-to-execute"] || 0) + (r.satisfied || 0);
  const color = colorForScore(ready, total);
  row2Parts.push(`${color}${ready}/${total} ready${reset}`);
}

// Untracked changes
if (state.untrackedChanges && state.untrackedChanges.length > 0) {
  const count = state.untrackedChanges.length;
  row2Parts.push(`${yellow}${count} untracked${reset}`);
}

// Next step suggestion
if (state.nextStep) row2Parts.push(`Next: ${state.nextStep}`);

// Compact mode: if row 2 has no active work (no command, no section, no chunk,
// no untracked, no next step), fold scenarios/ready into row 1 and skip row 2
const hasActiveWork = state.currentCommand || state.activeSection ||
  state.chunkProgress || state.nextStep ||
  (state.untrackedChanges && state.untrackedChanges.length > 0);

let output;
if (!hasActiveWork) {
  // Compact: one line with summary stats appended to row 1
  if (state.scenarioScore && state.scenarioScore.total > 0) {
    const { satisfied, total } = state.scenarioScore;
    if (satisfied > 0) {
      const color = colorForScore(satisfied, total);
      row1Parts.push(`${color}${satisfied}/${total} scenarios${reset}`);
    } else {
      row1Parts.push(`${dim}${total} scenarios${reset}`);
    }
  }
  if (state.readinessSummary) {
    const r = state.readinessSummary;
    const total = Object.values(r).reduce((a, b) => a + b, 0);
    const ready = (r.aligned || 0) + (r["ready-to-execute"] || 0) + (r.satisfied || 0);
    const color = colorForScore(ready, total);
    row1Parts.push(`${color}${ready}/${total} ready${reset}`);
  }
  output = row1Parts.join(sep);
} else {
  // Two lines
  output = row1Parts.join(sep);
  if (row2Parts.length > 0) {
    output += "\n" + row2Parts.join(sep);
  }
}

process.stdout.write(output);
