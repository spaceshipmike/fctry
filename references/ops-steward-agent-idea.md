# Release Steward for “Commit-to-Main” Workflows (No PRs)

## Outline
1. Does a CI/CD agent still add value without PRs?
2. The right shape: post-commit guardrail + release-ready reporter
3. Triggers, inputs, outputs (optimized for mainline commits)
4. Suggested policies (minimal friction)
5. Overhead vs value and how to keep it token-cheap

---

## 1) Is it still worth it?
Yes—arguably **more** worth it, because when you commit directly to `main`, you remove the natural review checkpoint where versioning/changelog mistakes usually get caught.

The value isn’t “reviewing code.” It’s:
- **Detecting release-impacting changes immediately**
- **Keeping versions/changelog consistent over time**
- **Making releases/tagging predictable**
- **Preventing drift** (especially with agentic coding)

If your repo never ships artifacts and you don’t care about tags/notes, then it’s mostly unnecessary. But if you *do* care about coherent history and reliable releases, it’s high leverage.

---

## 2) The correct agent shape (no PRs): “Post-Commit Release Steward”
Think of it as a **commit hook + CI reporter** hybrid, not a PR bot.

### Core design
- Runs **only on pushes/commits to `main`**
- Consumes **only the new commit range** (bounded diffs)
- Produces a **Release Readiness Report**
- Optionally enforces **hard gates** via CI (recommended)

This keeps overhead low and value high.

---

## 3) Triggers (commit-to-main)

### Trigger A: Push to `main` (primary)
Run on every push. If you push multiple commits at once, it evaluates the range.

### Trigger B: Tag created (release-time)
When a tag like `vX.Y.Z` is created, it validates that:
- versions match the tag
- changelog aligns
- CI is green (or was green at that commit)

### Trigger C: Scheduled “drift audit” (optional)
Daily/weekly check to detect:
- version drift across packages
- missing changelog entries since last tag
- dependency bumps without notes

(Use sparingly if you want zero noise.)

---

## 4) Inputs (bounded + deterministic)

### Always
- `git rev-parse HEAD`
- `git describe --tags --abbrev=0` (last tag) (if tags exist)
- `git log --oneline <last_tag>..HEAD` (or last N commits if no tags)
- `git diff --name-only <base>..HEAD`
- `git diff <base>..HEAD` (with truncation rules)

Where `<base>` is:
- last tag commit, OR
- previous successful CI commit, OR
- `HEAD~1` if you want “per-commit” strictness

### Deterministic reads
- version manifests (`package.json`, `pyproject.toml`, etc.)
- changelog sources (`CHANGELOG.md`, `.changeset/`, `changelog.d/`)

No full repo reads.

---

## 5) Output (what you get after every commit)

### “Release Readiness Report” (single artifact)
- **Proposed bump:** none/patch/minor/major
- **Versioning status:** ok/missing/mismatch
- **Changelog status:** ok/missing/needs edit
- **CI status:** pass/fail (with failing checks)
- **Risks detected:** breaking signals, migrations, API changes
- **Next action checklist:** exactly what to do

Keep it short unless failing.

---

## 6) Enforcement model (best for commit-to-main)

### Layer 1: Hard gates in CI (no model)
These should fail the build when violated:
- lint/typecheck/test/build
- commit message lint (optional but useful)
- “if code paths changed → require changeset or bump” (configurable)

### Layer 2: Release Steward agent (model)
Not a gate by default—acts as:
- bump-level recommender
- release note drafter
- risk flagger
- “what to do next” summarizer

### Optional: Make it a gate only for severe cases
Example: block if it detects:
- breaking change indicators + no major bump/changelog entry
- migrations without notes
- version mismatch with workspace policy

This is the sweet spot: low false positives, high protection.

---

## 7) Minimal-friction policies for mainline commits

### Option A (lowest friction): Changesets-required
- Any change under `src/**` or `packages/**` must include a `.changeset/*` file
- Release Steward assembles changelog + bump from changesets
- You tag when ready

**Pros:** consistent, scalable, low thinking burden  
**Cons:** you must remember to add a changeset

### Option B: Auto-bump on merge window (no PRs still OK)
- No per-commit bumps required
- Steward tracks changes since last tag
- When you run `release` (manual command), it chooses bump + writes versions + changelog

**Pros:** fastest daily dev  
**Cons:** drift accumulates until release; needs a solid release command

### Option C: Conventional commits drive bump
- Commit messages determine bump level:
  - `feat:` → minor
  - `fix:` → patch
  - `BREAKING CHANGE:` → major
- Steward verifies manifests/changelog reflect the implied bump

**Pros:** minimal extra files  
**Cons:** relies on disciplined commit messages

**Recommendation for your style:** **Option B** if you want speed, **Option A** if you want rigor.

---

## 8) Token-efficiency controls (so it doesn’t become overhead)

### Hard limits
- Max diff payload: 25k chars
- If exceeded: include only
  1) manifests
  2) API surface files
  3) migrations
  4) entry points
  5) a deterministic summary of the rest (file counts, LOC deltas)

### Run frequency tuning
- Default: on push to `main`
- If you commit very frequently: run on **every N commits** or **every 15 minutes** (batching)  
  *(still triggered by pushes; it evaluates a range)*

### No repo-wide embeddings
- Only use vector retrieval for docs if needed; never for code.

---

## 9) So—overhead or not?
For commit-to-main, the agent is **not unnecessary** if you care about:
- stable releases/tags
- coherent changelog
- workspace version consistency
- avoiding “release scramble” later

It becomes unnecessary overhead only if:
- you never tag/release
- version numbers/changelogs don’t matter
- CI already covers everything you care about

---

## 10) Implementation Checklist (what to add to Fctry)

1. Add `.fctry/release-steward.yml` policy config
2. Add deterministic CI checks:
   - changeset/version enforcement (or commit-driven enforcement)
   - conventional commit lint (if chosen)
3. Add Release Steward agent task:
   - Trigger: push to `main`
   - Inputs: commit range + bounded diffs + CI summary
   - Output: Release Readiness Report artifact
4. Add a `release` command (optional but recommended):
   - calculates bump
   - updates versions
   - generates changelog
   - creates tag
