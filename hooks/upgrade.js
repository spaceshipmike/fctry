#!/usr/bin/env node
// upgrade.js — format version upgrade for fctry projects
// Called by migrate.sh after layout migration completes.
// Usage: upgrade.js <project-dir> <plugin-json-path>
//
// Compares the project's formatVersion in config.json against the current
// plugin version. If behind, applies all needed changes in a single
// cumulative pass: .gitignore evolution, spec frontmatter additions,
// config.json schema evolution. Outputs a compact inline summary.

const fs = require("fs");
const path = require("path");

const projectDir = process.argv[2];
const pluginJsonPath = process.argv[3];
if (!projectDir || !pluginJsonPath) process.exit(0);

const fctryDir = path.join(projectDir, ".fctry");

// --- Read plugin version ---

let pluginVersion;
try {
  pluginVersion = JSON.parse(fs.readFileSync(pluginJsonPath, "utf-8")).version;
} catch {
  process.exit(0);
}
if (!pluginVersion) process.exit(0);

// --- Read config ---

const configPath = path.join(fctryDir, "config.json");
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
} catch {
  process.exit(0);
}

const formatVersion = config.formatVersion || "0.0.0";

// --- Semver comparison ---

function semverCompare(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

if (semverCompare(formatVersion, pluginVersion) >= 0) {
  process.exit(0); // Already current
}

const changes = [];

// --- 1. Gitignore evolution ---
// Append missing canonical entries without disturbing existing ones.

const gitignorePath = path.join(fctryDir, ".gitignore");
const canonicalEntries = [
  "state.json",
  "spec.db",
  "tool-check",
  "plugin-root",
  "interview-state.md",
  "inbox.json",
  "viewer/",
  "build-trace-*.md",
  "architecture.md",
];

if (fs.existsSync(gitignorePath)) {
  const existing = fs
    .readFileSync(gitignorePath, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const missing = canonicalEntries.filter((e) => !existing.includes(e));
  if (missing.length > 0) {
    let content = fs.readFileSync(gitignorePath, "utf-8");
    if (!content.endsWith("\n")) content += "\n";
    content += missing.join("\n") + "\n";
    fs.writeFileSync(gitignorePath, content);
    changes.push(
      `${missing.length} .gitignore entr${missing.length === 1 ? "y" : "ies"}`
    );
  }
}

// --- 2. Spec frontmatter additions ---
// Add missing fields (plugin-version, synopsis) without touching existing ones.

const specPath = path.join(fctryDir, "spec.md");
if (fs.existsSync(specPath)) {
  let spec = fs.readFileSync(specPath, "utf-8");

  // NLSpec v2 uses code-fenced YAML (```yaml ... ```), legacy uses --- ... ---
  const fenceMatch = spec.match(/^(```yaml\n)([\s\S]*?)(\n```)/m);
  const dashMatch = !fenceMatch
    ? spec.match(/^(---\n)([\s\S]*?)(\n---)/m)
    : null;
  const match = fenceMatch || dashMatch;

  if (match) {
    let fm = match[2];
    const added = [];

    // plugin-version field
    if (!/^plugin-version:/m.test(fm)) {
      fm += `\nplugin-version: ${pluginVersion}`;
      added.push("plugin-version");
    }

    // synopsis block — derive from title if possible
    if (!/^synopsis:/m.test(fm)) {
      const titleMatch = fm.match(/^title:\s*["']?(.+?)["']?\s*$/m);
      const title = titleMatch ? titleMatch[1] : "Project";
      fm += `\nsynopsis:\n  short: "${title}"\n  medium: "${title}"`;
      added.push("synopsis block");
    }

    if (added.length > 0) {
      spec = spec.replace(match[0], match[1] + fm + match[3]);
      fs.writeFileSync(specPath, spec);
      changes.push(`${added.join(", ")} added to spec`);
    }
  }
}

// --- 3. Config.json schema evolution ---
// Deep-merge missing keys with defaults. Never overwrite existing values.

let configChanged = false;

if (!config.relationshipRules) {
  config.relationshipRules = [
    {
      when: { type: "spec", change: "major" },
      action: "suggest-external-minor-bump",
    },
  ];
  configChanged = true;
  changes.push("relationshipRules added to config");
}

if (config.versions) {
  if (config.versions.external && !config.versions.external.incrementRules) {
    config.versions.external.incrementRules = {
      patch: "auto-per-chunk",
      minor: "suggest-at-plan-completion",
      major: "suggest-at-experience-milestone",
    };
    configChanged = true;
  }

  if (config.versions.spec && !config.versions.spec.incrementRules) {
    config.versions.spec.incrementRules = { minor: "auto-on-evolve" };
    configChanged = true;
  }
}

// --- 4. Update formatVersion ---

config.formatVersion = pluginVersion;
configChanged = true;

if (configChanged) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}

// --- 5. Write upgradeApplied flag to state.json ---

const statePath = path.join(fctryDir, "state.json");
try {
  let state = {};
  if (fs.existsSync(statePath)) {
    const raw = fs.readFileSync(statePath, "utf-8").trim();
    if (raw) state = JSON.parse(raw);
  }
  state.upgradeApplied = { from: formatVersion, to: pluginVersion };
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
} catch {
  // State file write failed — non-fatal, status line just won't show ↑
}

// --- 6. Output compact summary ---

if (changes.length > 0) {
  const fromDisplay =
    formatVersion === "0.0.0" ? "pre-registry" : `v${formatVersion}`;
  console.log(
    `\u2191 Upgraded ${fromDisplay} \u2192 v${pluginVersion}: ${changes.join(", ")}.`
  );
} else {
  console.log(`\u2191 Format version updated to v${pluginVersion}.`);
}
