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
dependency neighborhood. Uses the same alias resolution protocol as evolve
(see `commands/evolve.md`).

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

## Output

- Gap analysis with drift classifications and numbered recommendations
- Spec updates applied only after user approves specific items
- Summary of what was updated (referencing sections by alias and number)
