#!/usr/bin/env bash
# migrate.sh — detect old fctry layout and migrate to .fctry/ convention
# Also ensures .fctry/.gitignore exists when .fctry/spec.md is present.
# Usage: migrate.sh <project-dir>
# Runs as a synchronous UserPromptSubmit hook. Fast no-op when no migration needed.

set -euo pipefail

project_dir="${1:-$PWD}"
[[ -d "$project_dir" ]] || exit 0
project_dir="$(cd "$project_dir" && pwd)"
fctry_dir="$project_dir/.fctry"

# --- Helpers ---

is_git_repo() {
  git -C "$project_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1
}

is_tracked() {
  local rel="${1#$project_dir/}"
  git -C "$project_dir" ls-files --error-unmatch "$rel" >/dev/null 2>&1
}

move_file() {
  local src="$1" dest="$2"
  mkdir -p "$(dirname "$dest")"
  if is_git_repo && is_tracked "$src"; then
    local rel_src="${src#$project_dir/}"
    local rel_dest="${dest#$project_dir/}"
    git -C "$project_dir" mv "$rel_src" "$rel_dest"
  else
    mv "$src" "$dest"
  fi
}

create_gitignore() {
  mkdir -p "$fctry_dir"
  cat > "$fctry_dir/.gitignore" << 'GITIGNORE'
state.json
spec.db
tool-check
plugin-root
interview-state.md
inbox.json
viewer/
GITIGNORE
}

# --- Migration ---

moved=()

# Name-prefixed spec files at root → .fctry/spec.md
for f in "$project_dir"/*-spec.md; do
  [[ -f "$f" ]] || continue
  [[ -f "$fctry_dir/spec.md" ]] && continue
  moved+=("$(basename "$f") → .fctry/spec.md")
  move_file "$f" "$fctry_dir/spec.md"
done

# Name-prefixed scenario files at root → .fctry/scenarios.md
for f in "$project_dir"/*-scenarios.md; do
  [[ -f "$f" ]] || continue
  [[ -f "$fctry_dir/scenarios.md" ]] && continue
  moved+=("$(basename "$f") → .fctry/scenarios.md")
  move_file "$f" "$fctry_dir/scenarios.md"
done

# Name-prefixed changelog files at root → .fctry/changelog.md
for f in "$project_dir"/*-changelog.md; do
  [[ -f "$f" ]] || continue
  [[ -f "$fctry_dir/changelog.md" ]] && continue
  moved+=("$(basename "$f") → .fctry/changelog.md")
  move_file "$f" "$fctry_dir/changelog.md"
done

# fctry-state.json at root → .fctry/state.json
if [[ -f "$project_dir/fctry-state.json" ]]; then
  if [[ ! -f "$fctry_dir/state.json" ]]; then
    moved+=("fctry-state.json → .fctry/state.json")
    move_file "$project_dir/fctry-state.json" "$fctry_dir/state.json"
  else
    rm -f "$project_dir/fctry-state.json"
  fi
fi

# fctry-state.json inside .fctry (pre-rename) → state.json
if [[ -f "$fctry_dir/fctry-state.json" ]]; then
  if [[ ! -f "$fctry_dir/state.json" ]]; then
    mv "$fctry_dir/fctry-state.json" "$fctry_dir/state.json"
    moved+=(".fctry/fctry-state.json → .fctry/state.json")
  else
    rm -f "$fctry_dir/fctry-state.json"
  fi
fi

# .fctry-interview-state.json → .fctry/interview-state.md
if [[ -f "$project_dir/.fctry-interview-state.json" ]]; then
  if [[ ! -f "$fctry_dir/interview-state.md" ]]; then
    moved+=(".fctry-interview-state.json → .fctry/interview-state.md")
    move_file "$project_dir/.fctry-interview-state.json" "$fctry_dir/interview-state.md"
  else
    rm -f "$project_dir/.fctry-interview-state.json"
  fi
fi

# Note: references/ at root is NOT auto-migrated — too many projects have their
# own references/ directory. The Visual Translator will use .fctry/references/
# for new content; old content at references/ is left in place.

# --- .gitignore ---

gitignore_created=false
if [[ -f "$fctry_dir/spec.md" ]] && [[ ! -f "$fctry_dir/.gitignore" ]]; then
  create_gitignore
  gitignore_created=true
  if [[ ${#moved[@]} -gt 0 ]]; then
    moved+=("Created .fctry/.gitignore")
  fi
fi

# --- Version registry (config.json) ---

config_created=false
if [[ -f "$fctry_dir/spec.md" ]] && [[ ! -f "$fctry_dir/config.json" ]]; then
  # Read spec version from frontmatter (handles both spec-version and version fields)
  spec_ver="0.1"
  # Try spec-version first (NLSpec v2), then version (legacy). Uses sed for macOS compat.
  sv=$(sed -n 's/^spec-version:[[:space:]]*\([0-9][0-9.]*\).*/\1/p' "$fctry_dir/spec.md" 2>/dev/null | head -1)
  if [[ -z "$sv" ]]; then
    sv=$(sed -n 's/^version:[[:space:]]*\([0-9][0-9.]*\).*/\1/p' "$fctry_dir/spec.md" 2>/dev/null | head -1)
  fi
  [[ -n "$sv" ]] && spec_ver="$sv"

  # Read external version from git tags or default
  ext_ver="0.1.0"
  if is_git_repo; then
    tv=$(git -C "$project_dir" describe --tags --abbrev=0 --match 'v*' 2>/dev/null || true)
    if [[ -n "$tv" ]]; then
      ext_ver="${tv#v}"
    fi
  fi

  cat > "$fctry_dir/config.json" << CONFIGJSON
{
  "versions": {
    "external": {
      "type": "external",
      "current": "$ext_ver",
      "propagationTargets": [],
      "incrementRules": {
        "patch": "auto-per-chunk",
        "minor": "suggest-at-plan-completion",
        "major": "suggest-at-experience-milestone"
      }
    },
    "spec": {
      "type": "internal",
      "current": "$spec_ver",
      "propagationTargets": [
        { "file": ".fctry/spec.md", "field": "spec-version" }
      ],
      "incrementRules": {
        "minor": "auto-on-evolve"
      }
    }
  },
  "relationshipRules": [
    {
      "when": { "type": "spec", "change": "major" },
      "action": "suggest-external-minor-bump"
    }
  ]
}
CONFIGJSON

  config_created=true
  moved+=("Created .fctry/config.json (version registry: spec $spec_ver, external $ext_ver)")
fi

# --- Output ---

if [[ ${#moved[@]} -gt 0 ]]; then
  echo "Migrated to .fctry/ directory structure:"
  for item in "${moved[@]}"; do
    echo "- $item"
  done
  echo ""
  echo "Migration complete. Continuing with your command..."
elif $gitignore_created; then
  echo "Created .fctry/.gitignore"
fi
