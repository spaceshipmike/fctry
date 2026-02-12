#!/usr/bin/env bash
# Ensure the project's .claude/settings.local.json has statusLine config
# Usage: ensure-config.sh <project-dir> <plugin-root>
# Called by UserPromptSubmit hook — must be fast and idempotent

set -euo pipefail

PROJECT_DIR="${1:?project dir required}"
PLUGIN_ROOT="${2:?plugin root required}"

SCRIPT_PATH="${PLUGIN_ROOT}/src/statusline/fctry-statusline.js"
SETTINGS_DIR="${PROJECT_DIR}/.claude"
SETTINGS_FILE="${SETTINGS_DIR}/settings.local.json"

# If the status line script doesn't exist, bail
[ -f "$SCRIPT_PATH" ] || exit 0

# If settings file exists and already has statusLine configured, no-op
if [ -f "$SETTINGS_FILE" ]; then
  if node -e "
    const s = JSON.parse(require('fs').readFileSync('$SETTINGS_FILE', 'utf-8'));
    process.exit(s.statusLine ? 0 : 1);
  " 2>/dev/null; then
    exit 0
  fi
fi

# Ensure .claude directory exists
mkdir -p "$SETTINGS_DIR"

STATUS_LINE_CMD="node ${SCRIPT_PATH}"

if [ -f "$SETTINGS_FILE" ]; then
  # Merge statusLine into existing settings
  node -e "
    const fs = require('fs');
    const settings = JSON.parse(fs.readFileSync('$SETTINGS_FILE', 'utf-8'));
    settings.statusLine = '${STATUS_LINE_CMD}';
    fs.writeFileSync('$SETTINGS_FILE', JSON.stringify(settings, null, 2) + '\n');
  "
else
  # Create new settings file with statusLine
  node -e "
    const fs = require('fs');
    const settings = { statusLine: '${STATUS_LINE_CMD}' };
    fs.writeFileSync('$SETTINGS_FILE', JSON.stringify(settings, null, 2) + '\n');
  "
fi
