#!/usr/bin/env bash
set -euo pipefail

# dev-unlink.sh — Restore fctry to marketplace mode (undo dev-link.sh)
#
# Re-enables auto-update and triggers a marketplace plugin update.
#
# Usage: ./scripts/dev-unlink.sh

PLUGIN_KEY="fctry@fctry-marketplace"
MARKETPLACE_KEY="fctry-marketplace"

SENTINEL="$HOME/.claude/fctry-dev-link"
PLUGINS_FILE="$HOME/.claude/plugins/installed_plugins.json"
MARKETPLACES_FILE="$HOME/.claude/plugins/known_marketplaces.json"
GLOBAL_SETTINGS="$HOME/.claude/settings.local.json"

die() { echo "Error: $1" >&2; exit 1; }

[[ -f "$PLUGINS_FILE" ]] || die "installed_plugins.json not found."
[[ -f "$MARKETPLACES_FILE" ]] || die "known_marketplaces.json not found."

echo "Unlinking fctry from dev checkout..."
echo ""

# --- 1. Remove sentinel ---

echo "1/4  Removing sentinel"
rm -f "$SENTINEL"

# --- 2. Re-enable auto-update ---

echo "2/4  known_marketplaces.json → autoUpdate = true"
node -e "
  const fs = require('fs');
  const m = JSON.parse(fs.readFileSync('$MARKETPLACES_FILE', 'utf-8'));
  if (m['$MARKETPLACE_KEY']) {
    m['$MARKETPLACE_KEY'].autoUpdate = true;
    fs.writeFileSync('$MARKETPLACES_FILE', JSON.stringify(m, null, 2) + '\n');
  }
"

# --- 3. Kill any running viewer processes ---

echo "3/4  Killing viewer processes"
pkill -f "fctry.*server\.js" 2>/dev/null && echo "     Killed viewer(s)" || echo "     No viewers running"

# --- 4. Clear stale global statusLine ---

echo "4/4  Clearing global statusLine (will be re-set by hook on next session)"
if [[ -f "$GLOBAL_SETTINGS" ]]; then
  node -e "
    const fs = require('fs');
    const s = JSON.parse(fs.readFileSync('$GLOBAL_SETTINGS', 'utf-8'));
    if (s.statusLine && s.statusLine.command && s.statusLine.command.includes('fctry-statusline')) {
      delete s.statusLine;
      fs.writeFileSync('$GLOBAL_SETTINGS', JSON.stringify(s, null, 2) + '\n');
    }
  "
fi

echo ""
echo "Done. fctry is back in marketplace mode."
echo "  - Auto-update re-enabled"
echo "  - Run '/plugin marketplace update' in Claude Code to pull the latest version"
echo "  - The statusLine hook will reconfigure paths on next session"
