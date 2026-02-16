#!/usr/bin/env bash
# Ensure the project's .claude/settings.local.json has statusLine config
# Usage: ensure-config.sh <project-dir> <plugin-root>
# Called by UserPromptSubmit hook — must be fast and idempotent

set -euo pipefail

PROJECT_DIR="${1:?project dir required}"
PLUGIN_ROOT="${2:?plugin root required}"

# Dev-link override: if sentinel exists, use dev path for this session
SENTINEL="$HOME/.claude/fctry-dev-link"
if [[ -f "$SENTINEL" ]]; then
  DEV_ROOT=$(cat "$SENTINEL")
  [[ -d "$DEV_ROOT" ]] && PLUGIN_ROOT="$DEV_ROOT"
fi

SCRIPT_PATH="${PLUGIN_ROOT}/src/statusline/fctry-statusline.js"
SETTINGS_DIR="${PROJECT_DIR}/.claude"
SETTINGS_FILE="${SETTINGS_DIR}/settings.local.json"
STATUS_LINE_CMD="node ${SCRIPT_PATH}"

# If the status line script doesn't exist, bail
[ -f "$SCRIPT_PATH" ] || exit 0

# Fix a settings file if its statusLine points to a stale fctry path
# Returns 0 if the file was already correct (no write needed)
fix_settings_file() {
  local file="$1"
  [[ -f "$file" ]] || return 1

  node -e "
    const fs = require('fs');
    const s = JSON.parse(fs.readFileSync('$file', 'utf-8'));
    const cmd = (s.statusLine && s.statusLine.command) || '';
    const target = '${STATUS_LINE_CMD}';

    // Already correct
    if (cmd === target) process.exit(0);

    // Not a fctry statusLine at all — needs writing
    if (!cmd.includes('fctry-statusline')) process.exit(1);

    // Stale fctry path — update in place
    s.statusLine.command = target;
    fs.writeFileSync('$file', JSON.stringify(s, null, 2) + '\n');
    process.exit(0);
  " 2>/dev/null
}

# Check project-level settings — if already correct, also fix global and exit
if fix_settings_file "$SETTINGS_FILE"; then
  # Also fix global settings if stale
  fix_settings_file "$HOME/.claude/settings.local.json" 2>/dev/null || true
  exit 0
fi

# Project settings need the statusLine added (not just updated)
mkdir -p "$SETTINGS_DIR"

if [ -f "$SETTINGS_FILE" ]; then
  # Merge statusLine into existing settings
  node -e "
    const fs = require('fs');
    const settings = JSON.parse(fs.readFileSync('$SETTINGS_FILE', 'utf-8'));
    settings.statusLine = { type: 'command', command: '${STATUS_LINE_CMD}' };
    fs.writeFileSync('$SETTINGS_FILE', JSON.stringify(settings, null, 2) + '\n');
  "
else
  # Create new settings file with statusLine
  node -e "
    const fs = require('fs');
    const settings = { statusLine: { type: 'command', command: '${STATUS_LINE_CMD}' } };
    fs.writeFileSync('$SETTINGS_FILE', JSON.stringify(settings, null, 2) + '\n');
  "
fi

# Also fix global settings if stale
fix_settings_file "$HOME/.claude/settings.local.json" 2>/dev/null || true
