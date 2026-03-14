#!/usr/bin/env node
// PostToolUse hook: detect doom loops during autonomous builds.
// Tracks recent tool call signatures (tool name + input hash) and warns
// when the same call is made 3+ times consecutively. This catches the
// pattern where the Executor spins on the same failing approach.
//
// State is persisted in a temp file (.fctry/doom-loop-state.json) that
// resets on session start.

const { readFileSync, writeFileSync, existsSync } = require("fs");
const { join } = require("path");
const { createHash } = require("crypto");

// Read hook payload from stdin
let payload;
try {
  const input = readFileSync(0, "utf-8");
  payload = JSON.parse(input);
} catch {
  process.exit(0);
}

const cwd = payload.session?.cwd || process.cwd();
const fctryDir = join(cwd, ".fctry");
const statePath = join(fctryDir, "state.json");
const doomStatePath = join(fctryDir, "doom-loop-state.json");

// Only active during autonomous builds
let state = {};
try {
  if (existsSync(statePath)) {
    state = JSON.parse(readFileSync(statePath, "utf-8"));
  }
} catch {}

if (state.workflowStep !== "executor-build") process.exit(0);

// Build a signature for this tool call
const toolName = payload.tool_name || "";
const toolInput = payload.tool_input || {};
const inputStr = JSON.stringify(toolInput);
const sig = `${toolName}:${createHash("md5").update(inputStr).digest("hex").slice(0, 12)}`;

// Load doom-loop state
let doomState = { recent: [], count: 0, lastSig: "" };
try {
  if (existsSync(doomStatePath)) {
    doomState = JSON.parse(readFileSync(doomStatePath, "utf-8"));
  }
} catch {}

// Track consecutive identical calls
if (sig === doomState.lastSig) {
  doomState.count++;
} else {
  doomState.count = 1;
  doomState.lastSig = sig;
}

// Keep last 10 sigs for pattern analysis
doomState.recent.push(sig);
if (doomState.recent.length > 10) doomState.recent.shift();

// Save state
try {
  writeFileSync(doomStatePath, JSON.stringify(doomState) + "\n");
} catch {}

// Detect doom loop: 3+ consecutive identical tool calls
const THRESHOLD = 3;
if (doomState.count >= THRESHOLD) {
  const shortName = toolName.split("__").pop() || toolName;
  const inputPreview = inputStr.length > 80 ? inputStr.slice(0, 80) + "..." : inputStr;
  process.stdout.write(
    `\n⚠ Doom loop detected: ${shortName} called ${doomState.count} times with identical arguments.\n` +
    `  Signature: ${sig}\n` +
    `  Input: ${inputPreview}\n` +
    `  → Break out of this loop. Try a different approach or escalate to the next retry stage.\n`
  );
}
