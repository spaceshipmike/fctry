---
description: Add features or make changes to an existing spec
argument-hint: "<what to add or change>"
---

# /fctry:evolve

Evolve an existing spec — add features, make changes, or update based on new
requirements. The Interviewer focuses on what's new or different, guided by the
State Owner's understanding of what exists.

## Workflow

1. **State Owner** → Deep scan of current codebase and spec. Produces a state
   briefing: what exists, what's relevant, what would be affected.
2. **Interviewer** → Targeted conversation about the change. Uses the state
   briefing to ask smart questions: "The core flow currently works like X —
   does this change affect that?"
3. **Scenario Crafter** → Updates scenarios: new scenarios for new features,
   revised scenarios for changed behavior, removes obsolete ones.
4. **Spec Writer** → Evolves (not rewrites) the spec. Changes what needs
   changing, preserves what doesn't. Shows a diff summary.

## Output

- Updated `{project-name}-spec.md`
- Updated `{project-name}-scenarios.md`
- Diff summary of changes
