---
description: Audit spec vs. current codebase — find drift and gaps
argument-hint: "[section alias or number]"
---

# /fctry:review

Check whether the spec still matches what's actually built. Catch drift before
it becomes a problem.

## Section Targeting

Users can target a specific section or review the entire spec:

```
/fctry:review                    — full spec review
/fctry:review core-flow          — review only #core-flow and dependencies
/fctry:review 2.2                — same, by number
```

When targeted, the State Owner scopes its scan to the target section and its
dependency neighborhood. Uses the standard alias resolution protocol
(see `references/alias-resolution.md`).

## Workflow

0. **Status state** → Write `currentCommand: "review"` and `completedSteps: []`
   to `.fctry/state.json` (read-modify-write per
   `references/state-protocol.md`). Clearing `completedSteps` resets the
   workflow for this command.
1. **State Owner** → Comprehensive scan of codebase vs. spec. Uses the drift
   detection protocol (see `agents/state-owner.md`) to identify conflicts.
   Produces a state briefing with a drift summary: each conflict classified
   as Code Ahead, Spec Ahead, Diverged, or Unknown, with recency evidence.
   Appends `"state-owner-scan"` to `completedSteps` on completion.
2. **Spec Writer** → Validates `"state-owner-scan"` in `completedSteps`.
   Receives the briefing and produces a gap analysis:
   - Which sections have drifted (with the State Owner's classification)
   - Recommended updates for each drift item
   - Numbered options for the user to approve/reject each recommendation

   **Do NOT list aligned/accurate sections.** Alignment is the assumption.
   Only report drift, gaps, and problems. Listing what's working wastes
   tokens and provides no actionable information.

The Spec Writer does NOT apply changes automatically. Each recommendation
is presented for approval:

```
## Gap Analysis — {Project Name}

### Drifted Sections

(1) `#core-flow` (2.2) — Code ahead
    Spec says: "Items sorted by relevance"
    Code does: "Items sorted by date"
    Recommendation: Update spec to match code

(2) `#error-handling` (2.10) — Spec ahead
    Spec describes retry logic not yet implemented
    Recommendation: Keep spec as-is (implementation pending)

Approve all? Or select by number to discuss individual items.
```

3. **Spec Writer** (continued) → **CLAUDE.md audit.** After spec drift is settled,
   the Spec Writer audits CLAUDE.md against the current spec and codebase.
   CLAUDE.md is created at init (evergreen + compact instructions layers), so
   it always exists by the time review runs. The audit covers three layers
   independently (see `references/claudemd-guide.md` for layer definitions):

   **Evergreen layer** (always audited):
   - Spec and scenario file paths
   - Factory contract (agent authority, scenario validation)
   - Command quick-reference table (completeness, accuracy)
   - `.fctry/` directory guide (accuracy)
   - Workflow guidance (currency)
   - Scenario explanation (accuracy)

   **Compact instructions layer** (always audited):
   - Presence of `# Compact Instructions` section
   - Correct spec and scenario file paths in preservation rules
   - Inclusion of build checkpoint state (`.fctry/state.json`)
   - Inclusion of scenario satisfaction, active section, workflow step
   - If the Executor appended phase-specific instructions, verify they're
     still relevant (remove stale ones)

   **Build layer** (audited only if `/fctry:execute` has been run):
   - Current build plan (does it match what was last approved?)
   - Convergence order (does it match spec section 6.2?)
   - Versioning rules and current version
   - Repo structure description
   - Architecture notes and commands tables

   Drifted items are presented as numbered recommendations:

   ```
   ### Project Instructions Drift (CLAUDE.md)

   (3) Spec path — points to "old-spec.md", actual spec is ".fctry/spec.md"
       Recommendation: Update path

   (4) Convergence order — lists viewer as pending, but viewer is shipped
       Recommendation: Update to match spec section 6.2

   No issues? "CLAUDE.md is current — no updates needed."
   ```

   Approved CLAUDE.md changes are applied directly (no separate approval step
   beyond the numbered recommendations).

## Untracked Change Reconciliation

If `.fctry/state.json` has `untrackedChanges` entries, include them
in the gap analysis:

```
### Untracked Changes (outside fctry)
2 files changed outside fctry commands since last review:

(5) `src/statusline/fctry-statusline.js` → `#status-line` (2.12)
    Changed: 2026-02-13T10:05:00Z
    Recommendation: Run /fctry:evolve status-line to update spec

(6) `src/viewer/client/app.js` → `#spec-viewer` (2.9)
    Changed: 2026-02-13T10:12:00Z
    Recommendation: Run /fctry:evolve spec-viewer to update spec
```

After the user reviews (and optionally resolves via `/fctry:evolve`),
clear the reconciled entries from `untrackedChanges` in the state file.
Clear all entries if the user acknowledges them, even if they choose not
to evolve the spec immediately.

## Output

- Gap analysis with drift classifications and numbered recommendations
- Untracked changes section (when any exist)
- CLAUDE.md audit with numbered recommendations (when CLAUDE.md exists)
- Spec updates applied only after user approves specific items
- CLAUDE.md updates applied after user approves specific items
- Summary of what was updated (referencing sections by alias and number)

### Next Steps

After the gap analysis and any approved updates, include conditional next
steps based on findings:

- **Drift found** →
  `Run /fctry:evolve <section> for each drifted section to resolve`
- **Spec ahead (unbuilt sections)** →
  `Run /fctry:execute to build the pending sections`
- **Code ahead (undocumented behavior)** →
  `Run /fctry:evolve <section> to document the undocumented behavior`
- **No drift found** →
  No output needed. Silence means alignment.
