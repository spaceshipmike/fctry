#!/usr/bin/env bash
set -euo pipefail

# bump-version.sh — Update version in all canonical locations
#
# Usage: ./scripts/bump-version.sh <version>
#   e.g. ./scripts/bump-version.sh 0.8.0

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN_JSON="$REPO_ROOT/.claude-plugin/plugin.json"
SPEC_MD="$REPO_ROOT/.fctry/spec.md"
MARKETPLACE_REPO="spaceshipmike/fctry-marketplace"
MARKETPLACE_PATH=".claude-plugin/marketplace.json"

# --- Helpers ---

die() { echo "Error: $1" >&2; exit 1; }

usage() {
  echo "Usage: $0 <version>"
  echo ""
  echo "Bumps the fctry version in all canonical locations:"
  echo "  1. .claude-plugin/plugin.json  (version + description)"
  echo "  2. .fctry/spec.md              (plugin-version frontmatter)"
  echo "  3. fctry-marketplace repo      (marketplace.json)"
  echo "  4. Git tag + push"
  echo ""
  echo "Example: $0 0.8.0"
  exit 1
}

# Compare semver: returns 0 if $1 > $2
semver_gt() {
  local IFS=.
  local i a=($1) b=($2)
  for ((i=0; i<3; i++)); do
    if (( ${a[i]:-0} > ${b[i]:-0} )); then return 0; fi
    if (( ${a[i]:-0} < ${b[i]:-0} )); then return 1; fi
  done
  return 1  # equal
}

# --- Validation ---

[[ $# -eq 1 ]] || usage
NEW_VERSION="$1"

# Validate semver format
[[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "Invalid semver: $NEW_VERSION (expected X.Y.Z)"

# Get current version from plugin.json
CURRENT_VERSION=$(grep -o '"version": *"[^"]*"' "$PLUGIN_JSON" | head -1 | grep -o '[0-9][0-9.]*')
[[ -n "$CURRENT_VERSION" ]] || die "Could not read current version from $PLUGIN_JSON"

# New must be greater than current
semver_gt "$NEW_VERSION" "$CURRENT_VERSION" || die "New version $NEW_VERSION must be greater than current $CURRENT_VERSION"

# Clean working tree (allow untracked files)
[[ -z "$(git -C "$REPO_ROOT" diff --name-only)" ]] || die "Working tree has unstaged changes. Commit or stash first."
[[ -z "$(git -C "$REPO_ROOT" diff --cached --name-only)" ]] || die "Working tree has staged changes. Commit or stash first."

# gh auth
gh auth status >/dev/null 2>&1 || die "Not authenticated with gh. Run 'gh auth login' first."

echo "Bumping $CURRENT_VERSION -> $NEW_VERSION"
echo ""

# --- 1. plugin.json ---

echo "1/5  .claude-plugin/plugin.json"
# Update version field
sed -i '' "s/\"version\": *\"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$PLUGIN_JSON"
# Update version in description string
sed -i '' "s/Software Factory v$CURRENT_VERSION/Software Factory v$NEW_VERSION/" "$PLUGIN_JSON"

# --- 2. spec.md frontmatter ---

if [[ -f "$SPEC_MD" ]]; then
  echo "2/5  .fctry/spec.md"
  sed -i '' "s/^plugin-version: *$CURRENT_VERSION/plugin-version: $NEW_VERSION/" "$SPEC_MD"
else
  echo "2/5  .fctry/spec.md (skipped — file not found)"
fi

# --- 3. Marketplace repo ---

echo "3/5  $MARKETPLACE_REPO"

# Fetch current file content and SHA
MARKETPLACE_RESPONSE=$(gh api "repos/$MARKETPLACE_REPO/contents/$MARKETPLACE_PATH" 2>&1) \
  || die "Failed to fetch marketplace.json: $MARKETPLACE_RESPONSE"

MARKETPLACE_SHA=$(echo "$MARKETPLACE_RESPONSE" | jq -r '.sha')
MARKETPLACE_CONTENT=$(echo "$MARKETPLACE_RESPONSE" | jq -r '.content' | base64 -d)

# Update the version in the plugins array
UPDATED_CONTENT=$(echo "$MARKETPLACE_CONTENT" | jq --arg v "$NEW_VERSION" '
  .plugins[0].version = $v
')

# Base64 encode for the API
ENCODED_CONTENT=$(echo "$UPDATED_CONTENT" | base64)

# PUT the updated file
gh api "repos/$MARKETPLACE_REPO/contents/$MARKETPLACE_PATH" \
  --method PUT \
  --field message="Bump fctry to v$NEW_VERSION" \
  --field content="$ENCODED_CONTENT" \
  --field sha="$MARKETPLACE_SHA" \
  > /dev/null \
  || die "Failed to update marketplace.json"

# --- 4. Git commit + tag + push ---

echo "4/5  Git commit + tag v$NEW_VERSION + push"

git -C "$REPO_ROOT" add "$PLUGIN_JSON"
[[ -f "$SPEC_MD" ]] && git -C "$REPO_ROOT" add "$SPEC_MD"

git -C "$REPO_ROOT" commit -m "Bump version to $NEW_VERSION" \
  --author="$(git config user.name) <$(git config user.email)>"

git -C "$REPO_ROOT" tag "v$NEW_VERSION"
git -C "$REPO_ROOT" push
git -C "$REPO_ROOT" push --tags

# --- 5. Sync local marketplace clone ---

MARKETPLACE_LOCAL="$HOME/.claude/plugins/marketplaces/fctry-marketplace"
if [[ -d "$MARKETPLACE_LOCAL/.git" ]]; then
  echo "5/5  Syncing local marketplace clone"
  git -C "$MARKETPLACE_LOCAL" pull --ff-only 2>/dev/null || echo "     Warning: could not pull marketplace clone (non-fatal)"
else
  echo "5/5  Local marketplace clone not found (skipped)"
fi

echo ""
echo "Done. v$NEW_VERSION is live everywhere."
echo "  plugin.json:    $NEW_VERSION"
[[ -f "$SPEC_MD" ]] && echo "  spec.md:        $NEW_VERSION"
echo "  marketplace:    $NEW_VERSION"
echo "  git tag:        v$NEW_VERSION"
