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

1. **State Owner** → Comprehensive scan of codebase vs. spec. Uses the drift
   detection protocol (see `agents/state-owner.md`) to identify conflicts.
   Produces a state briefing with a drift summary: each conflict classified
   as Code Ahead, Spec Ahead, Diverged, or Unknown, with recency evidence.
2. **Spec Writer** → Receives the briefing and produces a gap analysis:
   - Which spec sections are accurate
   - Which have drifted (with the State Owner's classification)
   - Recommended updates for each drift item
   - Numbered options for the user to approve/reject each recommendation

The Spec Writer does NOT apply changes automatically. Each recommendation
is presented for approval:

```
## Gap Analysis — {Project Name}

### Accurate Sections
`#first-run` (2.1), `#multi-session` (2.3), `#boundaries` (4.1) — match code

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
   if CLAUDE.md exists in the project root (indicating `/fctry:execute` has been
   run at least once), the Spec Writer performs a full audit of CLAUDE.md against
   the current spec and codebase. Checks everything:
   - Spec and scenario file paths
   - Factory contract (agent authority, scenario validation)
   - Current build plan (does it match what was last approved?)
   - Convergence order (does it match spec section 6.2?)
   - Versioning rules
   - Repo structure description
   - Architecture notes and commands tables
   - Any other project-specific content

   Drifted items are presented as numbered recommendations:

   ```
   ### Project Instructions Drift (CLAUDE.md)

   (3) Spec path — points to "old-spec.md", actual spec is "my-app-spec.md"
       Recommendation: Update path

   (4) Convergence order — lists viewer as pending, but viewer is shipped
       Recommendation: Update to match spec section 6.2

   No issues? "CLAUDE.md is current — no updates needed."
   ```

   Approved CLAUDE.md changes are applied directly (no separate approval step
   beyond the numbered recommendations). If CLAUDE.md doesn't exist, this step
   is silently skipped.

## Output

- Gap analysis with drift classifications and numbered recommendations
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
- **Aligned** →
  `Spec and code are aligned — no action needed.`
