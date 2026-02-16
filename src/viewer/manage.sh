#!/usr/bin/env bash
# manage.sh — viewer lifecycle management for fctry
# Usage: manage.sh <start|stop|status|ensure> <project-dir> [plugin-root]

set -euo pipefail

cmd="${1:-}"
project_dir="${2:-}"
plugin_root="${3:-}"

if [[ -z "$cmd" || -z "$project_dir" ]]; then
  echo "Usage: manage.sh <start|stop|status|ensure> <project-dir> [plugin-root]" >&2
  exit 1
fi

# Resolve paths
project_dir="$(cd "$project_dir" && pwd)"
fctry_dir="$project_dir/.fctry"
viewer_dir="$fctry_dir/viewer"
pid_file="$viewer_dir/viewer.pid"
port_file="$viewer_dir/port.json"

# --- Helpers ---

find_spec() {
  # New convention: .fctry/spec.md; legacy fallback: *-spec.md at root
  if [[ -f "$fctry_dir/spec.md" ]]; then
    echo "$fctry_dir/spec.md"
    return
  fi
  # shellcheck disable=SC2310
  local spec
  spec=$(ls "$project_dir"/*-spec.md 2>/dev/null | head -1) || true
  echo "$spec"
}

is_alive() {
  kill -0 "$1" 2>/dev/null
}

read_pid() {
  [[ -f "$pid_file" ]] && cat "$pid_file" || echo ""
}

read_port() {
  if [[ -f "$port_file" ]]; then
    # Extract port from JSON — portable, no jq dependency
    sed -n 's/.*"port":\s*\([0-9]*\).*/\1/p' "$port_file"
  fi
}

cleanup_stale() {
  rm -f "$pid_file" "$port_file"
}

start_server() {
  local flags="$1"
  local server_js="$plugin_root/src/viewer/server.js"

  if [[ ! -f "$server_js" ]]; then
    echo "Error: server.js not found at $server_js" >&2
    exit 1
  fi

  # Auto-install dependencies if missing
  local viewer_dir="$plugin_root/src/viewer"
  if [[ ! -d "$viewer_dir/node_modules" ]]; then
    echo "Installing viewer dependencies..."
    if ! npm install --production --prefix "$viewer_dir" 2>&1; then
      echo "Error: Failed to install viewer dependencies. Check that npm is available." >&2
      exit 1
    fi
  fi

  mkdir -p "$viewer_dir"
  # shellcheck disable=SC2086
  nohup node "$server_js" "$project_dir" $flags > "$viewer_dir/viewer.log" 2>&1 &
  disown
}

wait_for_port() {
  local attempts=0
  while [[ $attempts -lt 20 ]]; do
    if [[ -f "$port_file" ]]; then
      return 0
    fi
    sleep 0.1
    attempts=$((attempts + 1))
  done
  return 1
}

# --- Commands ---

cmd_start() {
  if [[ -z "$plugin_root" ]]; then
    echo "Usage: manage.sh start <project-dir> <plugin-root>" >&2
    exit 1
  fi

  local spec
  spec=$(find_spec)
  if [[ -z "$spec" ]]; then
    echo "No spec found in $project_dir (checked .fctry/spec.md and *-spec.md)" >&2
    exit 1
  fi

  # Write plugin-root breadcrumb so agents can discover manage.sh later
  mkdir -p "$fctry_dir"
  echo "$plugin_root" > "$fctry_dir/plugin-root"

  local pid
  pid=$(read_pid)
  if [[ -n "$pid" ]] && is_alive "$pid"; then
    local port
    port=$(read_port)
    local url="http://localhost:${port}"
    echo "Viewer already running at $url"
    open "$url" 2>/dev/null || true
    exit 0
  fi

  # Stale PID — clean up
  [[ -n "$pid" ]] && cleanup_stale

  start_server ""

  if wait_for_port; then
    local port
    port=$(read_port)
    echo "Spec viewer running at http://localhost:${port}"
    echo "Watching: $spec"
  else
    echo "Viewer started but port file not yet available. Check $viewer_dir/viewer.log" >&2
  fi
}

cmd_stop() {
  local pid
  pid=$(read_pid)

  if [[ -z "$pid" ]]; then
    echo "No viewer is running for this project."
    exit 0
  fi

  if is_alive "$pid"; then
    kill "$pid" 2>/dev/null || true
    echo "Spec viewer stopped."
  else
    cleanup_stale
    echo "Viewer was not running (stale PID file cleaned up)."
  fi
}

cmd_status() {
  local pid
  pid=$(read_pid)

  if [[ -z "$pid" ]]; then
    echo "stopped"
    exit 0
  fi

  if is_alive "$pid"; then
    local port
    port=$(read_port)
    echo "running on port ${port:-unknown} (pid $pid)"
  else
    cleanup_stale
    echo "stopped (stale PID cleaned up)"
  fi
}

cmd_ensure() {
  if [[ -z "$plugin_root" ]]; then
    exit 0
  fi

  # No spec → nothing to do
  local spec
  spec=$(find_spec)
  [[ -z "$spec" ]] && exit 0

  # Write plugin-root breadcrumb so agents can discover manage.sh later
  mkdir -p "$fctry_dir"
  echo "$plugin_root" > "$fctry_dir/plugin-root"

  # Already running → nothing to do
  local pid
  pid=$(read_pid)
  if [[ -n "$pid" ]] && is_alive "$pid"; then
    exit 0
  fi

  # Stale PID → clean up
  [[ -n "$pid" ]] && cleanup_stale

  # Start silently without opening browser
  start_server "--no-open"
}

# --- Dispatch ---

case "$cmd" in
  start)  cmd_start ;;
  stop)   cmd_stop ;;
  status) cmd_status ;;
  ensure) cmd_ensure ;;
  *)
    echo "Unknown command: $cmd" >&2
    echo "Usage: manage.sh <start|stop|status|ensure> <project-dir> [plugin-root]" >&2
    exit 1
    ;;
esac
