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

0. **Status state** → Write `currentCommand: "evolve"` and `completedSteps: []`
   to `.fctry/state.json` (read-modify-write per
   `references/state-protocol.md`). Clearing `completedSteps` resets the
   workflow for this command.
1. **State Owner** → Deep scan of current codebase and spec. Produces a state
   briefing: what exists, what's relevant, what would be affected. Includes
   drift detection with conflict classification. When a section is targeted,
   focuses on that section and its dependencies. Appends `"state-owner-scan"`
   to `completedSteps` on completion.
2. **Drift resolution** (if needed) → Present conflicts with numbered options.
   User resolves before proceeding.
3. **Interviewer** → Validates `"state-owner-scan"` in `completedSteps`.
   Targeted conversation about the change. Uses the state briefing to ask
   smart questions: "The core flow currently works like X — does this change
   affect that?" Appends `"interviewer"` to `completedSteps` on completion.
4. **Scenario Crafter** → Validates `"interviewer"` in `completedSteps`.
   Updates scenarios: new scenarios for new features, revised scenarios for
   changed behavior, removes obsolete ones. Appends `"scenario-crafter"` to
   `completedSteps`.
5. **Spec Writer** → Validates `"interviewer"` and `"scenario-crafter"` in
   `completedSteps`. Evolves (not rewrites) the spec. Changes what needs
   changing, preserves what doesn't. Preserves all existing section aliases.
   Shows a diff summary referencing sections by alias. Appends `"spec-writer"`
   to `completedSteps`.
6. **Version registry update** → After the Spec Writer completes, auto-increment
   the spec version in `.fctry/config.json`:
   - Read-modify-write `config.json` to increment `versions.spec.current`
   - Update all propagation targets declared for the spec version (e.g., spec
     frontmatter `spec-version` field)
   - Check relationship rules: if the spec version crossed a major boundary
     (e.g., 1.9 → 2.0), note it so the next `/fctry:execute` can suggest an
     external version bump
   - If the evolve didn't actually change the spec (user cancelled, or the
     Spec Writer determined no changes were needed), skip the version increment

## Untracked Change Cleanup

After the spec is updated, clear any `untrackedChanges` entries in
`.fctry/state.json` that match the evolved section(s). This
reflects that the spec now accounts for those changes. Use
read-modify-write to filter the array, keeping only entries for other
sections.

## Output

- Updated `.fctry/spec.md`
- Updated `.fctry/scenarios.md`
- Updated `.fctry/config.json` (spec version incremented, propagation targets updated)
- Diff summary of changes (referencing sections by alias and number, showing spec version transition)

### Next Steps

After the diff summary, include conditional next steps based on the State
Owner briefing:

- **Code exists, spec now ahead** →
  `Run /fctry:execute to build the new behavior, then /fctry:review to confirm`
- **No code yet** →
  `Run /fctry:evolve <section> to keep refining, /fctry:ref <url> for inspiration, or /fctry:execute to start the build`
- **Drift was resolved** →
  `Run /fctry:review to verify alignment, then /fctry:execute`
- **Multiple sections changed** →
  `Run /fctry:review to check overall coherence before building`
