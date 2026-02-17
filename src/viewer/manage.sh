#!/usr/bin/env bash
# manage.sh — viewer lifecycle management for fctry
# Usage: manage.sh <start|stop|status|ensure> <project-dir> [plugin-root]
#
# The viewer is a single multi-project server. PID and port are stored globally
# at ~/.fctry/viewer.pid and ~/.fctry/viewer.port.json. Projects are registered
# with the running server via HTTP.

set -euo pipefail

cmd="${1:-}"
project_dir="${2:-}"
plugin_root="${3:-}"

# Dev-link override: if sentinel exists, use dev path for this session
SENTINEL="$HOME/.claude/fctry-dev-link"
if [[ -f "$SENTINEL" ]]; then
  DEV_ROOT=$(cat "$SENTINEL")
  [[ -n "$plugin_root" && -d "$DEV_ROOT" ]] && plugin_root="$DEV_ROOT"
fi

if [[ -z "$cmd" || -z "$project_dir" ]]; then
  echo "Usage: manage.sh <start|stop|status|ensure> <project-dir> [plugin-root]" >&2
  exit 1
fi

# Resolve paths (use pwd -P for canonical paths on case-insensitive macOS)
project_dir="$(cd "$project_dir" && pwd -P)"
[[ -n "$plugin_root" && -d "$plugin_root" ]] && plugin_root="$(cd "$plugin_root" && pwd -P)"
fctry_dir="$project_dir/.fctry"

# Global paths — single server, shared across all projects
fctry_home="$HOME/.fctry"
global_pid_file="$fctry_home/viewer.pid"
global_port_file="$fctry_home/viewer.port.json"

# --- Helpers ---

find_spec() {
  if [[ -f "$fctry_dir/spec.md" ]]; then
    echo "$fctry_dir/spec.md"
    return
  fi
  local spec
  spec=$(ls "$project_dir"/*-spec.md 2>/dev/null | head -1) || true
  echo "$spec"
}

is_alive() {
  kill -0 "$1" 2>/dev/null
}

read_pid() {
  [[ -f "$global_pid_file" ]] && cat "$global_pid_file" || echo ""
}

read_port() {
  if [[ -f "$global_port_file" ]]; then
    sed -n 's/.*"port":\s*\([0-9]*\).*/\1/p' "$global_port_file"
  fi
}

read_plugin_root() {
  if [[ -f "$global_port_file" ]]; then
    sed -n 's/.*"pluginRoot":\s*"\([^"]*\)".*/\1/p' "$global_port_file"
  fi
}

cleanup_stale() {
  rm -f "$global_pid_file" "$global_port_file"
}

# Clean up old per-project PID files from pre-multi-project era
cleanup_old_per_project() {
  local old_pid_file="$fctry_dir/viewer/viewer.pid"
  local old_port_file="$fctry_dir/viewer/port.json"
  if [[ -f "$old_pid_file" ]]; then
    local old_pid
    old_pid=$(cat "$old_pid_file")
    if [[ -n "$old_pid" ]] && is_alive "$old_pid"; then
      kill "$old_pid" 2>/dev/null || true
    fi
    rm -f "$old_pid_file" "$old_port_file"
  fi
}

start_server() {
  local flags="$1"
  local server_js="$plugin_root/src/viewer/server.js"

  if [[ ! -f "$server_js" ]]; then
    echo "Error: server.js not found at $server_js" >&2
    exit 1
  fi

  # Auto-install dependencies if missing
  local src_viewer_dir="$plugin_root/src/viewer"
  if [[ ! -d "$src_viewer_dir/node_modules" ]]; then
    echo "Installing viewer dependencies..."
    if ! npm install --production --prefix "$src_viewer_dir" 2>&1; then
      echo "Error: Failed to install viewer dependencies. Check that npm is available." >&2
      exit 1
    fi
  fi

  mkdir -p "$fctry_home"
  nohup node "$server_js" "$project_dir" $flags > "$fctry_home/viewer.log" 2>&1 &
  disown
}

wait_for_port() {
  local attempts=0
  while [[ $attempts -lt 20 ]]; do
    if [[ -f "$global_port_file" ]]; then
      return 0
    fi
    sleep 0.1
    attempts=$((attempts + 1))
  done
  return 1
}

register_project() {
  local port="$1"
  curl -s -X POST "http://localhost:${port}/api/projects" \
    -H "Content-Type: application/json" \
    -d "{\"path\":\"$project_dir\"}" > /dev/null 2>&1 || true
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

  # Clean up old per-project PID files
  cleanup_old_per_project

  # Write plugin-root breadcrumb so agents can discover manage.sh later
  mkdir -p "$fctry_dir"
  echo "$plugin_root" > "$fctry_dir/plugin-root"

  local pid
  pid=$(read_pid)
  if [[ -n "$pid" ]] && is_alive "$pid"; then
    local port
    port=$(read_port)
    local url="http://localhost:${port}"
    # Server already running — register this project and open browser
    register_project "$port"
    echo "Viewer already running at $url"
    open "$url/viewer/" 2>/dev/null || true
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
    echo "Viewer started but port file not yet available. Check $fctry_home/viewer.log" >&2
  fi
}

cmd_stop() {
  local pid
  pid=$(read_pid)

  if [[ -z "$pid" ]]; then
    # Check for old per-project PID as fallback
    cleanup_old_per_project
    echo "No viewer is running."
    exit 0
  fi

  if is_alive "$pid"; then
    kill "$pid" 2>/dev/null || true
    cleanup_stale
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

  # Clean up old per-project PID files from pre-multi-project era
  cleanup_old_per_project

  local pid
  pid=$(read_pid)

  if [[ -n "$pid" ]] && is_alive "$pid"; then
    # Server is running — check if it was started from the same plugin root
    local prev_root
    prev_root=$(read_plugin_root)
    if [[ "$prev_root" == "$plugin_root" ]]; then
      # Same root, server alive — just register this project
      local port
      port=$(read_port)
      [[ -n "$port" ]] && register_project "$port"
      # Update plugin-root breadcrumb for this project
      mkdir -p "$fctry_dir"
      echo "$plugin_root" > "$fctry_dir/plugin-root"
      exit 0
    fi
    # Different root — kill the old viewer so we restart with current code
    kill "$pid" 2>/dev/null || true
    cleanup_stale
    pid=""
  fi

  # Stale PID → clean up
  [[ -n "$pid" ]] && cleanup_stale

  # Write plugin-root breadcrumb so agents can discover manage.sh later
  mkdir -p "$fctry_dir"
  echo "$plugin_root" > "$fctry_dir/plugin-root"

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
