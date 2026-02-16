---
description: Incorporate external references into the spec (URLs, screenshots, designs)
argument-hint: "[section alias or number] <URL, screenshot, or design reference>"
---

# /fctry:ref

Bring external inspiration into the spec: URLs, repos, articles, screenshots,
design mockups. The appropriate agent investigates, and the Spec Writer updates
the spec accordingly.

## Section Targeting

Users can target a specific section, or let the system infer relevance:

```
/fctry:ref 2.1.3 https://github.com/example/repo  — targeted to section 2.1.3
/fctry:ref core-flow https://example.com/article   — targeted by alias
/fctry:ref https://example.com/design.png          — open: system infers relevance
```

### Alias Resolution Protocol

Follow the standard protocol in `references/alias-resolution.md` with
the `/fctry:ref` adaptation: the reference (URL, file path, or screenshot)
is always the **last argument**. Everything before it is a potential section
target. No section target → **open mode** (system infers relevance).

### Targeted Mode

The first argument resolves as a section alias or number. The Researcher or
Visual Translator investigates the reference specifically in the context of
that section. The State Owner scopes its briefing to that section and its
dependencies. The Spec Writer updates only that section.

### Open Mode

No section target. The domain agent explores the reference broadly,
identifies which parts of the spec it's relevant to, and presents findings
with recommended section targets as numbered options. The user confirms
before the Spec Writer updates.

## Workflow

0. **Status state** → Write `currentCommand: "ref"` and `completedSteps: []`
   to `.fctry/state.json` (read-modify-write per
   `references/state-protocol.md`). Clearing `completedSteps` resets the
   workflow for this command.
1. **State Owner ‖ Router** → These run in parallel:
   - **State Owner** → Briefing on current spec and codebase state, focused on
     what areas the reference might affect. When a section is targeted, scopes
     to that section and its dependencies. Appends `"state-owner-scan"` to
     `completedSteps`.
   - **Router** → Based on what was shared:
     - URL/repo/article → **Researcher** explores, produces a research briefing.
       Appends `"researcher"` to `completedSteps`.
     - Screenshot/mockup/design → **Visual Translator** interprets, stores image
       in `references/` and writes experience-language description. Appends
       `"visual-translator"` to `completedSteps`.
   Note: The Researcher/Visual Translator skips the State Owner prerequisite
   check in this parallel mode (see `agents/researcher.md`).
2. **Spec Writer** → Validates `"state-owner-scan"` and (`"researcher"` or
   `"visual-translator"`) in `completedSteps`. Receives the State Owner
   briefing AND the research/visual findings. Updates relevant spec sections.
   Links visual references. Preserves all existing section aliases. Appends
   `"spec-writer"` to `completedSteps`.

## Output

- Updated `.fctry/spec.md` (referencing changed sections by alias)
- New entries in `.fctry/references/` (if visual)
- Summary of what was learned and what changed

### Next Steps

After the change summary, include conditional next steps based on what
happened:

- **Updated existing section** →
  `Run /fctry:evolve <section> to refine further, or /fctry:execute to build`
- **Added content to thin section** →
  `Run /fctry:review to check fit with surrounding sections`
- **Broad changes (open mode)** →
  `Run /fctry:review for overall coherence, then /fctry:execute`
