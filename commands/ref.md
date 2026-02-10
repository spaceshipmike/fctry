---
description: Incorporate external references into the spec (URLs, screenshots, designs)
argument-hint: "<URL, screenshot, or design reference>"
---

# /fctry:ref

Bring external inspiration into the spec: URLs, repos, articles, screenshots,
design mockups. The appropriate agent investigates, and the Spec Writer updates
the spec accordingly.

## Workflow

1. **State Owner** → Briefing on current spec and codebase state, focused on
   what areas the reference might affect.
2. **Router** → Based on what was shared:
   - URL/repo/article → **Researcher** explores, produces a research briefing
   - Screenshot/mockup/design → **Visual Translator** interprets, stores image
     in `references/` and writes experience-language description
3. **Spec Writer** → Receives the State Owner briefing AND the research/visual
   findings. Updates relevant spec sections. Links visual references.

State Owner and the domain agent (Researcher or Visual Translator) can run in
parallel since they are independent.

## Output

- Updated `{project-name}-spec.md`
- New entries in `references/` (if visual)
- Summary of what was learned and what changed
