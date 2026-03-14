#!/usr/bin/env bash
# Build event emission utility.
# Called by the Executor to emit lifecycle events to the viewer and state file.
# Also updates chunkProgress in state.json when chunk-started events are emitted.
#
# Usage:
#   bash emit-event.sh <kind> '<json-payload>'
#
# Examples:
#   bash emit-event.sh chunk-started '{"chunk":"Auth Flow","section":"#core-flow (2.2)","attempt":1}'
#   bash emit-event.sh chunk-completed '{"chunk":"Auth Flow","scenarios":["Login works"]}'
#   bash emit-event.sh chunk-failed '{"chunk":"Auth Flow","reason":"exhausted retries"}'
#   bash emit-event.sh chunk-verified '{"chunk":"Auth Flow","summary":"4/4 checks passed","detail":"files present, viewer renders, API healthy"}'
#   bash emit-event.sh verification-failed '{"chunk":"Auth Flow","summary":"2/4 checks failed","detail":"missing login form, API 503","failed":["login form not found","API health returned 503"]}'
#   bash emit-event.sh interview-started '{"phase":"Phase 1: What Are We Building?"}'
#   bash emit-event.sh interview-completed '{"phases":8,"duration":"25m"}'
#   bash emit-event.sh checkpoint-saved '{"chunk":"Auth Flow","summary":"build state persisted"}'
#
# For chunk-started events, include chunkNumber and totalChunks in the payload
# to update chunkProgress:
#   bash emit-event.sh chunk-started '{"chunk":"Auth Flow","section":"#core-flow (2.2)","attempt":1,"chunkNumber":2,"totalChunks":5}'

set -euo pipefail

KIND="${1:-}"
PAYLOAD="${2:-\{\}}"

if [ -z "$KIND" ]; then
  echo "Usage: emit-event.sh <kind> '<json-payload>'" >&2
  exit 1
fi

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
FCTRY_DIR="${PWD}/.fctry"
STATE_FILE="${FCTRY_DIR}/state.json"

# Build the full event object — merge kind and timestamp into payload
EVENT=$(node -e "
  const p = JSON.parse(process.argv[1]);
  p.kind = process.argv[2];
  p.timestamp = process.argv[3];
  console.log(JSON.stringify(p));
" "$PAYLOAD" "$KIND" "$TIMESTAMP" 2>/dev/null) || {
  echo "emit-event: failed to build event JSON" >&2
  exit 0
}

# Path 1: POST to viewer API (preferred — instant broadcast)
PORT=$(node -e "
  try {
    const p = require('os').homedir() + '/.fctry/viewer.port.json';
    console.log(JSON.parse(require('fs').readFileSync(p, 'utf-8')).port);
  } catch { }
" 2>/dev/null || true)

POSTED=false
if [ -n "$PORT" ]; then
  if curl -s -X POST "http://localhost:${PORT}/api/build-events" \
    -H "Content-Type: application/json" \
    -d "$EVENT" > /dev/null 2>&1; then
    POSTED=true
  fi
fi

# Path 2: state.json read-modify-write (fallback or supplement)
if [ -f "$STATE_FILE" ]; then
  node -e "
    const fs = require('fs');
    const path = process.argv[1];
    const event = JSON.parse(process.argv[2]);
    const kind = process.argv[3];

    let state = {};
    try { state = JSON.parse(fs.readFileSync(path, 'utf-8')); } catch {}

    // Append to buildEvents (cap at 100)
    if (!Array.isArray(state.buildEvents)) state.buildEvents = [];
    state.buildEvents.push(event);
    if (state.buildEvents.length > 100) {
      state.buildEvents = state.buildEvents.slice(-100);
    }

    // Update chunkProgress on chunk-started events
    if (kind === 'chunk-started' && event.chunkNumber && event.totalChunks) {
      state.chunkProgress = {
        current: event.chunkNumber,
        total: event.totalChunks
      };
    }

    // Track verification results
    if (kind === 'chunk-verified' || kind === 'verification-failed') {
      if (!state.verificationSummary) {
        state.verificationSummary = { verified: 0, failed: 0 };
      }
      if (kind === 'chunk-verified') state.verificationSummary.verified++;
      else state.verificationSummary.failed++;
    }

    // Clear chunkProgress and verificationSummary when build completes
    if (kind === 'build-completed' || kind === 'build-paused') {
      state.chunkProgress = null;
      state.verificationSummary = null;
    }

    fs.writeFileSync(path, JSON.stringify(state, null, 2));
  " "$STATE_FILE" "$EVENT" "$KIND" 2>/dev/null || {
    echo "emit-event: state.json write failed (non-fatal)" >&2
  }
fi
