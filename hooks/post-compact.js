#!/usr/bin/env node

// PostCompact hook — fires after Claude Code auto-compacts context.
// Emits a context-compacted event to the viewer and updates state.json
// with compaction metadata so the status line and mission control reflect it.

const { readFileSync, writeFileSync, existsSync } = require("fs");
const { join } = require("path");
const { execSync } = require("child_process");

const cwd = process.env.PWD || process.cwd();
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || "";
const statePath = join(cwd, ".fctry", "state.json");

// Read stdin for compaction context (if Claude Code provides it)
let compactData = {};
try {
  const input = readFileSync(0, "utf-8");
  if (input.trim()) compactData = JSON.parse(input);
} catch {
  // No stdin or bad JSON — proceed with defaults
}

// Update state.json with compaction event
try {
  if (existsSync(statePath)) {
    const state = JSON.parse(readFileSync(statePath, "utf-8"));

    // Track compaction count for this session
    state.contextHealth = state.contextHealth || {};
    state.contextHealth.compactionCount =
      (state.contextHealth.compactionCount || 0) + 1;
    state.contextHealth.lastCompactedAt = new Date().toISOString();

    writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
  }
} catch {
  // State file missing or malformed — non-fatal
}

// Emit context-compacted event to viewer
try {
  if (pluginRoot) {
    const emitScript = join(pluginRoot, "hooks", "emit-event.sh");
    if (existsSync(emitScript)) {
      const payload = JSON.stringify({
        summary: `Context compacted (session total: ${
          (compactData.compactionCount || 0) + 1
        })`,
      });
      execSync(`bash "${emitScript}" context-compacted '${payload}'`, {
        cwd,
        timeout: 5000,
        stdio: "ignore",
      });
    }
  }
} catch {
  // Viewer not running or emit failed — non-fatal
}
