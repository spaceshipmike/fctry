---
description: Add features or make changes to an existing spec
argument-hint: "<section alias, number, or description of change>"
---

# /fctry:evolve

Evolve an existing spec — add features, make changes, or update based on new
requirements. The Interviewer focuses on what's new or different, guided by the
State Owner's understanding of what exists.

## Section Targeting

Users can target a specific section by alias or number:

```
/fctry:evolve core-flow          — targets section by alias
/fctry:evolve 2.2                — targets section by number
/fctry:evolve #error-handling    — alias with # prefix also works
/fctry:evolve add offline mode   — no section target, natural language
```

When a section target is provided, resolve it against the spec's Table of
Contents. The State Owner scopes its briefing to that section and its
dependencies. The Interviewer focuses the conversation on that section.
The Spec Writer updates only the targeted section (and any sections that
must change as a consequence).

When no section target is provided, treat the argument as a natural language
description of the change and proceed with the full evolve workflow.

If the target doesn't resolve (unknown alias or number), tell the user and
list the available sections with their aliases.

## Workflow

1. **State Owner** → Deep scan of current codebase and spec. Produces a state
   briefing: what exists, what's relevant, what would be affected. When a
   section is targeted, focuses on that section and its dependencies.
2. **Interviewer** → Targeted conversation about the change. Uses the state
   briefing to ask smart questions: "The core flow currently works like X —
   does this change affect that?"
3. **Scenario Crafter** → Updates scenarios: new scenarios for new features,
   revised scenarios for changed behavior, removes obsolete ones.
4. **Spec Writer** → Evolves (not rewrites) the spec. Changes what needs
   changing, preserves what doesn't. Preserves all existing section aliases.
   Shows a diff summary referencing sections by alias.

## Output

- Updated `{project-name}-spec.md`
- Updated `{project-name}-scenarios.md`
- Diff summary of changes (referencing sections by alias and number)
