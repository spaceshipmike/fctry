#!/usr/bin/env node
// PostToolUse hook: auto-increment patch version after chunk commits.
// Fires after Bash tool calls. Detects git commit during an active build,
// reads the version registry, bumps the patch, propagates to all targets,
// and creates a git tag.

const { readFileSync, writeFileSync, existsSync } = require("fs");
const { join } = require("path");
const { execSync } = require("child_process");

// Read hook payload from stdin
let payload;
try {
  const input = readFileSync(0, "utf-8");
  payload = JSON.parse(input);
} catch {
  process.exit(0);
}

// Only act on Bash tool calls
if (payload.tool_name !== "Bash") process.exit(0);

// Check if the command was a git commit
const command = payload.tool_input?.command || "";
if (!command.includes("git commit")) process.exit(0);

// Check if the commit succeeded (tool_result should not indicate failure)
const result = payload.tool_result || "";
if (result.includes("nothing to commit") || result.includes("error:") || result.includes("fatal:")) {
  process.exit(0);
}

const cwd = payload.session?.cwd || process.cwd();
const fctryDir = join(cwd, ".fctry");
const configPath = join(fctryDir, "config.json");
const statePath = join(fctryDir, "state.json");

// Must have a config.json with version registry
if (!existsSync(configPath)) process.exit(0);

let config;
try {
  config = JSON.parse(readFileSync(configPath, "utf-8"));
} catch {
  process.exit(0);
}

// Check increment rules — only auto-bump if patch rule is "auto-per-chunk"
const rules = config.versions?.external?.incrementRules;
if (!rules || rules.patch !== "auto-per-chunk") process.exit(0);

// Must be in an active build
let state = {};
try {
  if (existsSync(statePath)) {
    state = JSON.parse(readFileSync(statePath, "utf-8"));
  }
} catch {}

if (!state.buildRun || state.buildRun.status !== "running") process.exit(0);

// Check if this chunk already had a version bump (prevent double-bump)
const currentChunk = state.buildRun.chunks?.find(c => c.status === "active" || c.status === "building");
const bumpedChunks = state._versionBumpedChunks || [];
if (currentChunk && bumpedChunks.includes(currentChunk.id)) process.exit(0);

// Increment patch version
const currentVersion = config.versions.external.current;
if (!currentVersion) process.exit(0);

const parts = currentVersion.split(".");
if (parts.length !== 3) process.exit(0);

const newVersion = `${parts[0]}.${parts[1]}.${parseInt(parts[2], 10) + 1}`;

// Update the registry
config.versions.external.current = newVersion;

// Propagate to all declared targets
const targets = config.versions.external.propagationTargets || [];
const results = [];

for (const target of targets) {
  const targetPath = join(cwd, target.file);
  if (!existsSync(targetPath)) {
    results.push({ file: target.file, status: "skipped", reason: "file not found" });
    continue;
  }

  try {
    let content = readFileSync(targetPath, "utf-8");

    if (target.field && target.file.endsWith(".json")) {
      // JSON field replacement
      const json = JSON.parse(content);
      if (target.pattern) {
        // Pattern-based replacement (e.g., "Software Factory v{version}")
        const oldPattern = target.pattern.replace("{version}", currentVersion);
        const newPattern = target.pattern.replace("{version}", newVersion);
        json[target.field] = (json[target.field] || "").replace(oldPattern, newPattern);
      } else {
        json[target.field] = newVersion;
      }
      content = JSON.stringify(json, null, 2) + "\n";
    } else if (target.field && target.file.endsWith(".md")) {
      // Markdown frontmatter field replacement
      const fieldRegex = new RegExp(`(${target.field}:\\s*)${currentVersion.replace(/\./g, "\\.")}`);
      content = content.replace(fieldRegex, `$1${newVersion}`);
    } else {
      // Generic string replacement
      content = content.replace(currentVersion, newVersion);
    }

    writeFileSync(targetPath, content);
    results.push({ file: target.file, status: "updated" });
  } catch (e) {
    results.push({ file: target.file, status: "failed", reason: e.message });
  }
}

// Write updated config
try {
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
} catch (e) {
  process.stderr.write(`auto-version: failed to write config: ${e.message}\n`);
  process.exit(0);
}

// Track that this chunk was bumped (prevent double-bump on retry)
if (currentChunk) {
  bumpedChunks.push(currentChunk.id);
  state._versionBumpedChunks = bumpedChunks;
  try {
    writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch {}
}

// Stage propagation target files and create git tag
try {
  const updatedFiles = results.filter(r => r.status === "updated").map(r => r.file);
  if (updatedFiles.length > 0) {
    // Stage config.json and all updated targets
    const filesToStage = [".fctry/config.json", ...updatedFiles].map(f => `"${f}"`).join(" ");
    execSync(`git add ${filesToStage}`, { cwd, stdio: "pipe" });
    execSync(`git commit --amend --no-edit`, { cwd, stdio: "pipe" });
  }

  // Tag
  execSync(`git tag v${newVersion}`, { cwd, stdio: "pipe" });
} catch (e) {
  // Git operations are best-effort — version registry is already updated
  process.stderr.write(`auto-version: git operation warning: ${e.message}\n`);
}

// Report to the agent
const updated = results.filter(r => r.status === "updated").length;
const failed = results.filter(r => r.status === "failed");
let msg = `Auto-versioned: ${currentVersion} → ${newVersion} (${updated} targets updated, tagged v${newVersion})`;
if (failed.length > 0) {
  msg += `. Failed: ${failed.map(f => `${f.file} (${f.reason})`).join(", ")}`;
}
process.stdout.write(msg);
