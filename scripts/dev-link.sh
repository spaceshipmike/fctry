#!/usr/bin/env bash
set -euo pipefail

# dev-link.sh — Point Claude Code at the local fctry checkout for development
#
# After running once, CLAUDE_PLUGIN_ROOT = ~/Code/fctry in all sessions.
# Code edits take effect on next session (or next viewer restart).
# No marketplace round-trip needed.
#
# Usage: ./scripts/dev-link.sh
# Undo:  ./scripts/dev-unlink.sh

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN_KEY="fctry@fctry-marketplace"
MARKETPLACE_KEY="fctry-marketplace"

SENTINEL="$HOME/.claude/fctry-dev-link"
PLUGINS_FILE="$HOME/.claude/plugins/installed_plugins.json"
MARKETPLACES_FILE="$HOME/.claude/plugins/known_marketplaces.json"
GLOBAL_SETTINGS="$HOME/.claude/settings.local.json"

die() { echo "Error: $1" >&2; exit 1; }

# --- Validation ---

[[ -f "$PLUGINS_FILE" ]] || die "installed_plugins.json not found. Is fctry installed from the marketplace?"
[[ -f "$MARKETPLACES_FILE" ]] || die "known_marketplaces.json not found."

# Check fctry is installed
node -e "
  const p = JSON.parse(require('fs').readFileSync('$PLUGINS_FILE', 'utf-8'));
  if (!p.plugins['$PLUGIN_KEY']) { process.exit(1); }
" || die "fctry not found in installed_plugins.json. Install it from the marketplace first."

echo "Linking fctry to dev checkout: $REPO_ROOT"
echo ""

# --- 1. Write sentinel for self-healing hook ---

echo "1/5  Writing sentinel → $SENTINEL"
echo "$REPO_ROOT" > "$SENTINEL"

# --- 2. Update installed_plugins.json ---

echo "2/5  installed_plugins.json → installPath = $REPO_ROOT"
node -e "
  const fs = require('fs');
  const p = JSON.parse(fs.readFileSync('$PLUGINS_FILE', 'utf-8'));
  const entry = p.plugins['$PLUGIN_KEY'][0];
  entry.installPath = '$REPO_ROOT';
  entry.version = 'dev';
  fs.writeFileSync('$PLUGINS_FILE', JSON.stringify(p, null, 2) + '\n');
"

# --- 3. Fix global settings statusLine ---

echo "3/5  ~/.claude/settings.local.json → statusLine"
STATUSLINE_CMD="node ${REPO_ROOT}/src/statusline/fctry-statusline.js"
if [[ -f "$GLOBAL_SETTINGS" ]]; then
  node -e "
    const fs = require('fs');
    const s = JSON.parse(fs.readFileSync('$GLOBAL_SETTINGS', 'utf-8'));
    s.statusLine = { type: 'command', command: '$STATUSLINE_CMD' };
    fs.writeFileSync('$GLOBAL_SETTINGS', JSON.stringify(s, null, 2) + '\n');
  "
else
  node -e "
    const fs = require('fs');
    const s = { statusLine: { type: 'command', command: '$STATUSLINE_CMD' } };
    fs.writeFileSync('$GLOBAL_SETTINGS', JSON.stringify(s, null, 2) + '\n');
  "
fi

# --- 4. Disable auto-update for fctry-marketplace ---

echo "4/5  known_marketplaces.json → autoUpdate = false"
node -e "
  const fs = require('fs');
  const m = JSON.parse(fs.readFileSync('$MARKETPLACES_FILE', 'utf-8'));
  if (m['$MARKETPLACE_KEY']) {
    m['$MARKETPLACE_KEY'].autoUpdate = false;
    fs.writeFileSync('$MARKETPLACES_FILE', JSON.stringify(m, null, 2) + '\n');
  }
"

# --- 5. Kill any running viewer processes ---

echo "5/5  Killing stale viewer processes"
pkill -f "fctry.*server\.js" 2>/dev/null && echo "     Killed old viewer(s)" || echo "     No viewers running"

echo ""
echo "Done. fctry is now linked to $REPO_ROOT"
echo "  - New Claude Code sessions will use the dev checkout"
echo "  - Auto-update disabled for fctry-marketplace"
echo "  - Self-healing hook will maintain the link across updates"
echo "  - Run ./scripts/dev-unlink.sh to restore marketplace mode"
