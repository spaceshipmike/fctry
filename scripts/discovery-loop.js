#!/usr/bin/env node

/**
 * Discovery Loop — self-improvement runner for a single fctry project.
 *
 * Runs the cheap (zero LLM) discovery pipeline:
 *   detect-gaps → discover-sources → novelty filter → queue to inbox
 *
 * Results land as inbox recommendations in the viewer. No Claude session
 * needed, no LLM tokens spent. The user reviews and incorporates at their pace.
 *
 * Usage:
 *   node ~/Code/fctry/scripts/discovery-loop.js              # run in current project
 *   node ~/Code/fctry/scripts/discovery-loop.js /path/to/proj # explicit project
 *   node ~/Code/fctry/scripts/discovery-loop.js --dry-run     # preview without queuing
 *
 * Schedule overnight via launchd (see com.fctry.discovery.plist template).
 *
 * The loop respects per-section cooldowns (24h default) from discover-sources.js,
 * so running it frequently is safe — it won't re-research the same gaps.
 */

const { readFileSync, appendFileSync, existsSync, mkdirSync } = require("fs");
const { join, resolve } = require("path");
const { execSync } = require("child_process");

const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
const dryRun = flags.has("--dry-run");
const projectDir = resolve(positional[0] || process.cwd());

const fctryDir = join(projectDir, ".fctry");
const specPath = join(fctryDir, "spec.md");
const fctryHome = join(require("os").homedir(), ".fctry");
const logPath = join(fctryHome, "discovery-loop.log");
const discoverScript = join(__dirname, "discover-sources.js");

// --- Logging ---

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    mkdirSync(fctryHome, { recursive: true });
    appendFileSync(logPath, line + "\n");
  } catch {}
}

// --- Validation ---

if (!existsSync(specPath)) {
  console.error(`No spec found at ${specPath}`);
  console.error("Run this from a project directory with .fctry/spec.md, or pass the path as an argument.");
  process.exit(1);
}

if (!existsSync(discoverScript)) {
  console.error(`discover-sources.js not found at ${discoverScript}`);
  process.exit(1);
}

// --- Project Name ---

function getProjectName() {
  try {
    const head = readFileSync(specPath, "utf-8").slice(0, 2000);
    const match = head.match(/^#\s+(.+)/m);
    return match ? match[1].trim() : projectDir.split("/").pop();
  } catch {
    return projectDir.split("/").pop();
  }
}

// --- Run Discovery ---

function main() {
  const name = getProjectName();
  log(`Discovery loop: ${name} (${projectDir})${dryRun ? " [dry run]" : ""}`);

  try {
    const flag = dryRun ? "--dry-run" : "";
    const result = execSync(
      `node "${discoverScript}" "${projectDir}" ${flag}`,
      {
        encoding: "utf-8",
        timeout: 120000, // 2 minutes (network calls)
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    const lines = result.trim().split("\n");
    for (const line of lines) {
      log(`  ${line}`);
    }

    // Parse total line
    const totalLine = lines.find((l) => l.includes("queued to inbox") || l.includes("No gaps"));
    const queued = totalLine
      ? parseInt(totalLine.match(/(\d+) queued/)?.[1] || "0", 10)
      : 0;

    log(`Done — ${queued} recommendation${queued !== 1 ? "s" : ""} queued`);

    // Notify viewer if running (so inbox badge updates)
    if (queued > 0) {
      try {
        const portPath = join(fctryHome, "viewer.port.json");
        if (existsSync(portPath)) {
          const { port } = JSON.parse(readFileSync(portPath, "utf-8"));
          execSync(`curl -s "http://localhost:${port}/api/foreman?action=discovery-complete&queued=${queued}" 2>/dev/null || true`, {
            timeout: 3000, stdio: "pipe",
          });
        }
      } catch {}
    }
  } catch (err) {
    const msg = err.stderr?.trim()?.slice(0, 300) || err.message?.slice(0, 300) || "unknown error";
    log(`Error: ${msg}`);
    process.exit(1);
  }
}

main();
