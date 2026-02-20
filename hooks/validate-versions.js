#!/usr/bin/env node
// UserPromptSubmit hook: validate version consistency across files.
// Checks that config.json version registry matches spec frontmatter.
// Auto-fixes spec version in config.json (frontmatter is source of truth).
// Warns about external version mismatches (bump-version.sh owns those).

const { readFileSync, writeFileSync, existsSync } = require("fs");
const { join } = require("path");

const cwd = process.env.PWD || process.cwd();
const specPath = join(cwd, ".fctry", "spec.md");
const configPath = join(cwd, ".fctry", "config.json");

// Skip if not a fctry project
if (!existsSync(specPath) || !existsSync(configPath)) process.exit(0);

// Read spec frontmatter
let specContent;
try {
  specContent = readFileSync(specPath, "utf-8");
} catch {
  process.exit(0);
}

// Extract spec-version from code-fenced YAML frontmatter
const specVersionMatch = specContent.match(/^spec-version:\s*(.+)$/m);
if (!specVersionMatch) process.exit(0);
const specVersion = specVersionMatch[1].trim();

// Extract plugin-version from frontmatter
const pluginVersionMatch = specContent.match(/^plugin-version:\s*(.+)$/m);
const pluginVersion = pluginVersionMatch ? pluginVersionMatch[1].trim() : null;

// Read config.json
let config;
try {
  config = JSON.parse(readFileSync(configPath, "utf-8"));
} catch {
  process.exit(0);
}

let fixed = false;
const fixes = [];

// Check spec version: frontmatter is source of truth → sync to config.json
const registrySpecVersion = config.versions?.spec?.current;
if (registrySpecVersion && registrySpecVersion !== specVersion) {
  config.versions.spec.current = specVersion;
  fixes.push(`spec version: ${registrySpecVersion} → ${specVersion}`);
  fixed = true;
}

// Check external version: config.json is source of truth → warn only
// bump-version.sh owns external version propagation
const registryExternalVersion = config.versions?.external?.current;
if (pluginVersion && registryExternalVersion && registryExternalVersion !== pluginVersion) {
  process.stdout.write(
    `Version drift: config.json external (${registryExternalVersion}) ` +
    `≠ spec plugin-version (${pluginVersion}). ` +
    `Run ./scripts/bump-version.sh to sync.\n`
  );
}

// Write fixes
if (fixed) {
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
    process.stdout.write(`Auto-fixed config.json: ${fixes.join(", ")}\n`);
  } catch {
    process.stdout.write(`Warning: could not fix config.json: ${fixes.join(", ")}\n`);
  }
}
