#!/usr/bin/env bash
# dev-link-ensure.sh — Self-healing hook for dev-linked fctry installs
#
# If ~/.claude/fctry-dev-link exists (written by dev-link.sh), ensures
# installed_plugins.json still points to the dev checkout. Fixes it silently
# if a marketplace auto-update clobbered it.
#
# Called on every UserPromptSubmit. Fast no-op when no sentinel exists.

set -euo pipefail

SENTINEL="$HOME/.claude/fctry-dev-link"

# No sentinel → normal user, nothing to do
[[ -f "$SENTINEL" ]] || exit 0

DEV_ROOT=$(cat "$SENTINEL")

# Sentinel exists but path is gone → stale, remove it
if [[ ! -d "$DEV_ROOT" ]]; then
  rm -f "$SENTINEL"
  exit 0
fi

PLUGIN_KEY="fctry@fctry-marketplace"
MARKETPLACE_KEY="fctry-marketplace"
PLUGINS_FILE="$HOME/.claude/plugins/installed_plugins.json"
MARKETPLACES_FILE="$HOME/.claude/plugins/known_marketplaces.json"

# Fix installed_plugins.json if installPath doesn't match dev root
if [[ -f "$PLUGINS_FILE" ]]; then
  node -e "
    const fs = require('fs');
    const p = JSON.parse(fs.readFileSync('$PLUGINS_FILE', 'utf-8'));
    const entries = p.plugins['$PLUGIN_KEY'];
    if (!entries || !entries[0]) process.exit(0);
    if (entries[0].installPath === '$DEV_ROOT') process.exit(0);
    // Clobbered — fix it
    entries[0].installPath = '$DEV_ROOT';
    entries[0].version = 'dev';
    fs.writeFileSync('$PLUGINS_FILE', JSON.stringify(p, null, 2) + '\n');
  " 2>/dev/null || true
fi

# Ensure autoUpdate stays false
if [[ -f "$MARKETPLACES_FILE" ]]; then
  node -e "
    const fs = require('fs');
    const m = JSON.parse(fs.readFileSync('$MARKETPLACES_FILE', 'utf-8'));
    if (!m['$MARKETPLACE_KEY']) process.exit(0);
    if (m['$MARKETPLACE_KEY'].autoUpdate === false) process.exit(0);
    m['$MARKETPLACE_KEY'].autoUpdate = false;
    fs.writeFileSync('$MARKETPLACES_FILE', JSON.stringify(m, null, 2) + '\n');
  " 2>/dev/null || true
fi
