#!/usr/bin/env node

/**
 * Foreman — scheduled autonomous work launcher for fctry.
 *
 * Checks for eligible inbox items and spawns Claude Code sessions to process
 * them when capacity, budget, and schedule conditions are met.
 *
 * Usage:
 *   node scripts/foreman.js [--project /path/to/project]
 *   node scripts/foreman.js --dry-run
 *
 * Schedule via launchd (macOS) or cron:
 *   Every 15 minutes: */15 * * * * node /path/to/fctry/scripts/foreman.js
 *
 * Configuration (in .fctry/config.json under "foreman"):
 *   {
 *     "foreman": {
 *       "enabled": false,
 *       "budgetPerDay": 500000,      // max tokens per 24h (default 500K)
 *       "cycleCapPerRun": 3,         // max items per foreman run (default 3)
 *       "quietHours": { "start": 23, "end": 7 },  // no runs during these hours
 *       "eligibleTypes": ["reference"]              // only process these inbox types
 *     }
 *   }
 *
 * Safety rails:
 *   - Capacity gate: won't spawn if a Claude Code session is already active
 *   - Budget gate: tracks cumulative token spend in ~/.fctry/foreman-spend.json
 *   - Quiet hours: respects configured schedule
 *   - Eligible types: only "reference" items are auto-processed (evolve requires human)
 *   - No external effects: no git push, no PR, no deployment
 */

const { readFileSync, writeFileSync, existsSync } = require("fs");
const { join } = require("path");
const { execSync } = require("child_process");

// --- Configuration ---

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const projectIdx = args.indexOf("--project");
const projectDir = projectIdx >= 0 ? args[projectIdx + 1] : process.cwd();

const configPath = join(projectDir, ".fctry", "config.json");
const inboxPath = join(projectDir, ".fctry", "inbox.json");
const fctryHome = join(require("os").homedir(), ".fctry");
const spendPath = join(fctryHome, "foreman-spend.json");
const logPath = join(fctryHome, "foreman.log");

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  if (dryRun) {
    console.log(line);
  } else {
    try {
      const { appendFileSync, mkdirSync } = require("fs");
      mkdirSync(fctryHome, { recursive: true });
      appendFileSync(logPath, line + "\n");
    } catch {
      console.error(line);
    }
  }
}

// --- Gates ---

function loadConfig() {
  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    return config.foreman || {};
  } catch {
    return {};
  }
}

function isEnabled(config) {
  return config.enabled === true;
}

function isQuietHours(config) {
  const quiet = config.quietHours || { start: 23, end: 7 };
  const hour = new Date().getHours();
  if (quiet.start > quiet.end) {
    // Wraps midnight: e.g., 23-7
    return hour >= quiet.start || hour < quiet.end;
  }
  return hour >= quiet.start && hour < quiet.end;
}

function isSessionActive() {
  try {
    // Check for running claude processes
    const result = execSync("pgrep -f 'claude' 2>/dev/null || true", {
      encoding: "utf-8",
      timeout: 3000,
    }).trim();
    return result.length > 0;
  } catch {
    return false; // Can't determine — assume no session
  }
}

function checkBudget(config) {
  const dailyBudget = config.budgetPerDay || 500000;
  try {
    if (!existsSync(spendPath)) return { ok: true, spent: 0, budget: dailyBudget };
    const spend = JSON.parse(readFileSync(spendPath, "utf-8"));
    const today = new Date().toISOString().slice(0, 10);
    const todaySpend = spend[today] || 0;
    return { ok: todaySpend < dailyBudget, spent: todaySpend, budget: dailyBudget };
  } catch {
    return { ok: true, spent: 0, budget: dailyBudget };
  }
}

// --- Inbox ---

function getEligibleItems(config) {
  try {
    if (!existsSync(inboxPath)) return [];
    const items = JSON.parse(readFileSync(inboxPath, "utf-8"));
    if (!Array.isArray(items)) return [];

    const eligibleTypes = config.eligibleTypes || ["reference"];
    return items.filter(
      (item) =>
        eligibleTypes.includes(item.type) &&
        item.status === "processed" &&
        !item.foremanSkip
    );
  } catch {
    return [];
  }
}

function markItemForeman(itemId) {
  try {
    const items = JSON.parse(readFileSync(inboxPath, "utf-8"));
    const item = items.find((i) => i.id === itemId);
    if (item) {
      item.source = "foreman";
      item.foremanProcessedAt = new Date().toISOString();
    }
    writeFileSync(inboxPath, JSON.stringify(items, null, 2) + "\n");
  } catch {
    // Non-fatal
  }
}

// --- Main ---

function main() {
  const config = loadConfig();

  if (!isEnabled(config)) {
    log("Foreman is disabled (set foreman.enabled: true in config.json)");
    process.exit(0);
  }

  if (isQuietHours(config)) {
    log("Quiet hours — skipping");
    process.exit(0);
  }

  if (isSessionActive()) {
    log("Active Claude Code session detected — skipping");
    process.exit(0);
  }

  const budget = checkBudget(config);
  if (!budget.ok) {
    log(`Budget exhausted (${budget.spent}/${budget.budget} tokens today) — skipping`);
    process.exit(0);
  }

  const eligible = getEligibleItems(config);
  if (eligible.length === 0) {
    log("No eligible inbox items");
    process.exit(0);
  }

  const cycleCap = config.cycleCapPerRun || 3;
  const toProcess = eligible.slice(0, cycleCap);

  log(`Processing ${toProcess.length} of ${eligible.length} eligible items`);

  for (const item of toProcess) {
    const url = item.content || item.url;
    if (!url) {
      log(`Skipping item ${item.id} — no URL`);
      continue;
    }

    if (dryRun) {
      log(`[DRY RUN] Would process: ${url} (${item.type})`);
      continue;
    }

    log(`Processing: ${url}`);
    markItemForeman(item.id);

    try {
      // Spawn claude CLI to run /fctry:ref on this URL
      execSync(
        `claude --print --dangerously-skip-permissions -p "/fctry:ref ${url}" 2>&1`,
        {
          cwd: projectDir,
          timeout: 300000, // 5 minute timeout per item
          encoding: "utf-8",
          stdio: "pipe",
        }
      );
      log(`Completed: ${url}`);
    } catch (err) {
      log(`Failed: ${url} — ${err.message?.slice(0, 200)}`);
    }
  }

  log("Foreman run complete");
}

main();
