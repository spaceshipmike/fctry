---
description: Audit spec vs. current codebase — find drift and gaps
---

# /fctry:review

Check whether the spec still matches what's actually built. Catch drift before
it becomes a problem.

## Workflow

1. **State Owner** → Comprehensive scan of codebase vs. spec. Deep comparison
   of what the spec says vs. what the code does.
2. **Spec Writer** → Produces a gap analysis with recommendations.

Both agents run sequentially — the Spec Writer needs the State Owner's briefing.

## Output

- Gap analysis document
- Recommended spec updates (not applied until approved)
