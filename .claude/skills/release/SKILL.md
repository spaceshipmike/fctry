---
name: release
description: >
  Release a new version of fctry. Use when the user says "release", "cut a release",
  "bump version", "tag a release", "publish version", or invokes /release <version>.
disable-model-invocation: true
---

# Release

Cut a new fctry version release with detailed release notes.

## Usage

```
/release <version>
```

Where `<version>` is a semver string like `0.23.0`. The version must be greater than the current version.

## Current State

```
!git describe --tags --always 2>/dev/null || echo "no tags"
```

```
!git log --oneline "$(git describe --tags --abbrev=0 2>/dev/null)..HEAD" 2>/dev/null || git log --oneline -10
```

```
!git branch --show-current
```

```
!git status --short
```

## Workflow

Given `$ARGUMENTS` as the version:

1. **Validate** — Parse the version from `$ARGUMENTS`. If missing or invalid semver, ask for it. Check that the working tree is clean (no staged or unstaged changes — untracked files are OK). Verify `gh auth status` succeeds.

2. **Draft release notes** — Review all commits since the last tag. Write detailed release notes covering:
   - What changed (features, fixes, improvements)
   - Which spec sections were affected (by alias and number)
   - Which scenarios are targeted by the changes
   - What the user can now do differently (experience delta)
   - Present the draft to the user for approval. Number the options: (1) Approve, (2) Edit, (3) Abort.

3. **Execute release** — Run `./scripts/bump-version.sh <version>` which handles all 6 propagation steps:
   1. `.claude-plugin/plugin.json` — version + description
   2. `.fctry/spec.md` — plugin-version frontmatter
   3. `.fctry/config.json` — version registry
   4. `fctry-marketplace` repo — marketplace.json
   5. Git commit + tag + push
   6. Local marketplace sync

4. **Create GitHub release** — Run `gh release create v<version> --title "v<version>" --notes "<release-notes>"` using the approved release notes.

5. **Confirm** — Show the final state: version number, tag, GitHub release URL.

## Important

- Never run `bump-version.sh` without user approval of the release notes first.
- The script requires a clean working tree and `gh` auth.
- If the script fails, show the error and suggest recovery steps.
