#!/usr/bin/env node

// fctry terminal status line for Claude Code
// Reads: stdin (session JSON), .fctry/state.json, .fctry/config.json (version registry), .git/HEAD
// Outputs: two ANSI-colored lines — always shows a next step recommendation

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

// Material Design Icons (Supplementary PUA-A — survives Claude Code's BMP PUA filter)
const ICON_BRANCH       = String.fromCodePoint(0xF062C);  // 󰘬 source-branch
const ICON_SPEC         = String.fromCodePoint(0xF0219);  // 󰈙 file-document
const ICON_CONTEXT      = String.fromCodePoint(0xF1396);  // 󱎖 circle-half-full
const ICON_CHUNK        = String.fromCodePoint(0xF040A);  // 󰐊 play
const ICON_CHECK        = String.fromCodePoint(0xF012C);  // 󰄬 check
const ICON_FAIL         = String.fromCodePoint(0xF0156);  // 󰅖 close
const ICON_READY        = String.fromCodePoint(0xF0565);  // 󰕥 shield-check
const ICON_UNTRACKED    = String.fromCodePoint(0xF0026);  // 󰀦 alert
const ICON_UPGRADE      = String.fromCodePoint(0xF0737);  // 󰜷 arrow-up-bold
const ICON_NEXT         = String.fromCodePoint(0xF0142);  // 󰅂 chevron-right

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

// Derive a next step recommendation from state (priority order matters)
function deriveNextStep(state, hasSpec) {
  if (!hasSpec) return "/fctry:init to create a spec";

  const score = state.scenarioScore;
  const readiness = state.readinessSummary;
  const readyToBuild = readiness?.["ready-to-build"] || 0;
  const draft = readiness?.draft || 0;
  const untracked = state.untrackedChanges?.length || 0;

  if (untracked > 0) return "/fctry:evolve to update spec with recent changes";
  if (score && score.satisfied > 0 && score.satisfied >= score.total)
    return "All scenarios satisfied! /fctry:review to confirm";
  if (readyToBuild > 0) return "/fctry:execute to build ready-to-build sections";
  if (score && score.total > 0 && score.satisfied < score.total)
    return "/fctry:execute to satisfy remaining scenarios";
  if (draft > 0) return "/fctry:evolve to flesh out draft sections";
  return "/fctry:evolve to refine, or /fctry:execute to build";
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

// Context percentage — match CC's "usable context" metric.
// CC's "Context left until auto-compact: X%" measures against the compaction
// threshold (~84% of total window), not the full window. We compute the same
// ratio so our number matches CC's display.
const AUTO_COMPACT_THRESHOLD = 0.84;
const rawContextPct = sessionData.context_window?.used_percentage;
const contextPct = rawContextPct != null
  ? Math.min(100, Math.round(rawContextPct / (AUTO_COMPACT_THRESHOLD * 100) * 100))
  : null;

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

// Get external version from version registry (.fctry/config.json), fall back to git tags
let appVersion = null;
const configPath = join(cwd, ".fctry", "config.json");
try {
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const extVersion = config.versions?.external?.current;
    if (extVersion) appVersion = `v${extVersion}`;
  }
} catch {
  // Bad config — fall through to git tags
}
if (!appVersion) {
  try {
    appVersion = execSync("git describe --tags --abbrev=0 --match 'v*' 2>/dev/null", {
      cwd,
      encoding: "utf-8",
      timeout: 2000,
    }).trim();
  } catch {
    // No tags — that's fine
  }
}

// Check if spec exists
const fctryDir = join(cwd, ".fctry");
const hasSpec = existsSync(join(fctryDir, "spec.md")) ||
  (() => { try { return require("fs").readdirSync(cwd).some(f => f.endsWith("-spec.md")); } catch { return false; } })();

const sep = ` ${dim}│${reset} `;

// Row 1: project vX.Y.Z │ 󰘬 branch │ 󰈙 spec vX.Y │ 󰪾 ctx%
const projectName = basename(cwd);
const row1Parts = [appVersion ? `${projectName} ${appVersion.replace(/^v/, '')}` : projectName];

if (branch) row1Parts.push(`${ICON_BRANCH} ${branch}`);
// Spec version: prefer registry, fall back to state.json cache
let specVersion = state.specVersion;
try {
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const regSpecVersion = config.versions?.spec?.current;
    if (regSpecVersion) specVersion = regSpecVersion;
  }
} catch {
  // Fall back to state.specVersion
}
if (specVersion) row1Parts.push(`${ICON_SPEC} ${specVersion}`);
// Spec status from frontmatter (draft/active/stable)
let specStatus = null;
try {
  const specPath = join(fctryDir, "spec.md");
  if (existsSync(specPath)) {
    const specHead = readFileSync(specPath, "utf-8").slice(0, 500);
    const statusMatch = specHead.match(/^status:\s*(\w+)/m);
    if (statusMatch) specStatus = statusMatch[1];
  }
} catch {}
if (specStatus && specStatus !== "active") {
  const statusColor = specStatus === "stable" ? green : specStatus === "draft" ? yellow : dim;
  row1Parts.push(`${statusColor}${specStatus}${reset}`);
}
if (contextPct != null) {
  const color = colorForPercent(contextPct);
  row1Parts.push(`${color}${ICON_CONTEXT} ${contextPct}%${reset}`);
}

// Row 2: command │ 󰐊 chunk │ section │ 󰄬 scenarios │ 󰕥 ready │ 󰀦 untracked │ 󰅂 next
const row2Parts = [];

if (state.currentCommand) {
  const sp = state.scanProgress;
  if (sp && sp.total > 0 && state.currentCommand === "review") {
    row2Parts.push(`${cyan}${state.currentCommand}${reset} ${dim}| scanning${reset} ${sp.scanned}/${sp.total}`);
  } else {
    row2Parts.push(`${cyan}${state.currentCommand}${reset}`);
  }
}

if (state.chunkProgress && state.chunkProgress.total > 0) {
  const { current, total, chunks } = state.chunkProgress;

  if (chunks && Array.isArray(chunks)) {
    // Extended format: show completed+active(retry)/total
    const completed = chunks.filter(c => c.status === "completed").length;
    const active = chunks.filter(c => c.status === "active" || c.status === "retrying");
    const failed = chunks.filter(c => c.status === "failed").length;

    let label = `${completed}`;
    if (active.length > 0) {
      const retrying = active.find(c => c.status === "retrying");
      const activeStr = retrying && retrying.attempt > 1
        ? `+${active.length}(r${retrying.attempt})`
        : `+${active.length}`;
      label += activeStr;
    }
    label += `/${total}`;
    if (failed > 0) label += ` ${red}${failed}${ICON_FAIL}${reset}`;
    row2Parts.push(`${ICON_CHUNK} ${label}`);
  } else {
    // Legacy format: simple current/total
    row2Parts.push(`${ICON_CHUNK} ${current}/${total}`);
  }
}

if (state.activeSection) {
  const label = state.activeSectionNumber
    ? `${state.activeSection} (${state.activeSectionNumber})`
    : state.activeSection;
  row2Parts.push(`${magenta}${label}${reset}`);
}

if (state.scenarioScore && state.scenarioScore.total > 0) {
  const { satisfied, total } = state.scenarioScore;
  if (satisfied > 0) {
    const color = colorForScore(satisfied, total);
    row2Parts.push(`${color}${ICON_CHECK} ${satisfied}/${total}${reset}`);
  } else {
    row2Parts.push(`${dim}${ICON_CHECK} ${total}${reset}`);
  }
}

if (state.readinessSummary) {
  const r = state.readinessSummary;
  const total = Object.values(r).reduce((a, b) => a + b, 0);
  const ready = (r.aligned || 0) + (r["ready-to-execute"] || 0) + (r.satisfied || 0) + (r.deferred || 0);
  const color = colorForScore(ready, total);
  row2Parts.push(`${color}${ICON_READY} ${ready}/${total}${reset}`);
}

if (state.untrackedChanges && state.untrackedChanges.length > 0) {
  const count = state.untrackedChanges.length;
  row2Parts.push(`${yellow}${ICON_UNTRACKED} ${count}${reset}`);
}

if (state.upgradeApplied) {
  row2Parts.push(`${green}${ICON_UPGRADE}${reset}`);
}

// Next step — explicit from agent, or derived from state when idle
const nextStep = state.nextStep || (!state.currentCommand ? deriveNextStep(state, hasSpec) : null);
if (nextStep) row2Parts.push(`${ICON_NEXT} ${nextStep}`);

// Output — always two lines (row 2 has at least the next step)
let output = row1Parts.join(sep);
if (row2Parts.length > 0) {
  output += "\n" + row2Parts.join(sep);
}

process.stdout.write(output);
