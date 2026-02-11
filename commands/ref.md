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

**Targeted mode:** The first argument resolves as a section alias or number.
The Researcher or Visual Translator investigates the reference specifically
in the context of that section. The Spec Writer updates only that section.

**Open mode:** No section target. The domain agent explores the reference
broadly, identifies which parts of the spec it's relevant to, and presents
findings with recommended section targets. The user confirms before the
Spec Writer updates.

If a section target doesn't resolve, tell the user and list available sections.

## Workflow

1. **State Owner** → Briefing on current spec and codebase state, focused on
   what areas the reference might affect. When a section is targeted, scopes
   to that section and its dependencies.
2. **Router** → Based on what was shared:
   - URL/repo/article → **Researcher** explores, produces a research briefing
   - Screenshot/mockup/design → **Visual Translator** interprets, stores image
     in `references/` and writes experience-language description
3. **Spec Writer** → Receives the State Owner briefing AND the research/visual
   findings. Updates relevant spec sections. Links visual references.
   Preserves all existing section aliases.

State Owner and the domain agent (Researcher or Visual Translator) can run in
parallel since they are independent.

## Output

- Updated `{project-name}-spec.md` (referencing changed sections by alias)
- New entries in `references/` (if visual)
- Summary of what was learned and what changed
