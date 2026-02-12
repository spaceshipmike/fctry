---
description: Add features or make changes to an existing spec
argument-hint: "<section alias, number, or description of change>"
---

# /fctry:evolve

Evolve an existing spec — add features, make changes, or update based on new
requirements. The Interviewer focuses on what's new or different, guided by the
State Owner's understanding of what exists.

## Empty Arguments

If `/fctry:evolve` is called with no arguments, don't proceed blindly. Ask:
```
What would you like to change? You can:
(1) Target a specific section — e.g., `/fctry:evolve core-flow`
(2) Describe the change — e.g., `/fctry:evolve add offline mode`
(3) See available sections to pick from
```
If the user picks (3), list all spec sections with aliases and numbers.

## Section Targeting

Users can target a specific section by alias or number:

```
/fctry:evolve core-flow          — targets section by alias
/fctry:evolve 2.2                — targets section by number
/fctry:evolve #error-handling    — alias with # prefix also works
/fctry:evolve add offline mode   — no section target, natural language
```

### Alias Resolution Protocol

Follow the standard 5-step resolution protocol in
`references/alias-resolution.md`. Evolve uses the standard protocol
with no per-command adaptations.

### Targeted Mode

When a section target is resolved:
- **State Owner** scopes its briefing to that section and its dependencies
- **Interviewer** focuses the conversation on that section's experience
- **Spec Writer** updates only the targeted section (and any sections that
  must change as a consequence)
- All agents reference the target as `#alias` (N.N) in their output

### Natural Language Mode

When no section target is provided, treat the argument as a description of
the change and proceed with the full evolve workflow. The State Owner
assesses which sections are relevant and lists them in the briefing.

## Drift Handling

If the State Owner's briefing includes a drift summary (conflicts between
spec and code in the sections being evolved), resolve drift BEFORE the
Interviewer starts. Present the conflicts with numbered options per the
State Owner's drift detection protocol. The user resolves each conflict,
and the Interviewer works from the resolved state.

This prevents evolving a spec section that's already out of sync with the
code — which would compound the drift rather than fix it.

## Workflow

1. **State Owner** → Deep scan of current codebase and spec. Produces a state
   briefing: what exists, what's relevant, what would be affected. Includes
   drift detection with conflict classification. When a section is targeted,
   focuses on that section and its dependencies.
2. **Drift resolution** (if needed) → Present conflicts with numbered options.
   User resolves before proceeding.
3. **Interviewer** → Targeted conversation about the change. Uses the state
   briefing to ask smart questions: "The core flow currently works like X —
   does this change affect that?"
4. **Scenario Crafter** → Updates scenarios: new scenarios for new features,
   revised scenarios for changed behavior, removes obsolete ones.
5. **Spec Writer** → Evolves (not rewrites) the spec. Changes what needs
   changing, preserves what doesn't. Preserves all existing section aliases.
   Shows a diff summary referencing sections by alias.

## Output

- Updated `{project-name}-spec.md`
- Updated `{project-name}-scenarios.md`
- Diff summary of changes (referencing sections by alias and number)
