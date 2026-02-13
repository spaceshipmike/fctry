#!/usr/bin/env node

// fctry terminal status line for Claude Code
// Reads: stdin (session JSON), .fctry/fctry-state.json, .git/HEAD
// Outputs: two ANSI-colored lines

const { readFileSync, existsSync } = require("fs");
const { join, basename } = require("path");

// ANSI color helpers
const reset = "\x1b[0m";
const dim = "\x1b[2m";
const magenta = "\x1b[35m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const red = "\x1b[31m";

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

// Read .fctry/fctry-state.json
let state = {};
const statePath = join(cwd, ".fctry", "fctry-state.json");
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

// Build row 1: [fctry] project │ branch │ version │ scenarios
const projectName = basename(cwd);
const row1Parts = [`${dim}[fctry]${reset} ${projectName}`];

if (branch) row1Parts.push(branch);
if (state.specVersion) row1Parts.push(`v${state.specVersion}`);
if (state.scenarioScore && state.scenarioScore.evaluated && state.scenarioScore.total > 0) {
  const { satisfied, total } = state.scenarioScore;
  const color = colorForScore(satisfied, total);
  row1Parts.push(`${color}${satisfied}/${total} scenarios${reset}`);
}
if (state.readinessSummary) {
  const r = state.readinessSummary;
  const total = Object.values(r).reduce((a, b) => a + b, 0);
  const ready = (r.aligned || 0) + (r["ready-to-execute"] || 0) + (r.satisfied || 0);
  const color = colorForScore(ready, total);
  row1Parts.push(`${color}${ready}/${total} ready${reset}`);
}

// Build row 2: section │ command │ next │ ctx %
const row2Parts = [];

if (state.activeSection) {
  const label = state.activeSectionNumber
    ? `${state.activeSection} (${state.activeSectionNumber})`
    : state.activeSection;
  row2Parts.push(`${magenta}${label}${reset}`);
}
if (state.currentCommand) row2Parts.push(state.currentCommand);
if (state.nextStep) row2Parts.push(`Next: ${state.nextStep}`);
if (contextPct != null) {
  const color = colorForPercent(contextPct);
  row2Parts.push(`${color}ctx ${Math.round(contextPct)}%${reset}`);
}

const sep = ` ${dim}│${reset} `;
let output = row1Parts.join(sep);
if (row2Parts.length > 0) {
  output += "\n" + row2Parts.join(sep);
}

process.stdout.write(output);
