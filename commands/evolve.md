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

### Alias Resolution Protocol

When arguments are provided, resolve them in this order:

1. **Find the spec.** Look for `{project-name}-spec.md` in the project root.
   If no spec exists, tell the user: "No spec found. Run `/fctry:init` first."
2. **Read the Table of Contents.** The TOC lists every section with its number
   and alias, e.g., `- 2.2 [Core Flow](#22-core-flow) \`#core-flow\``
3. **Try to match the first argument** against known aliases and numbers:
   - Strip leading `#` if present (`#core-flow` → `core-flow`)
   - Match against aliases (exact, case-insensitive): `core-flow`
   - Match against section numbers (exact): `2.2`
   - If a match is found → **targeted mode**. Pass the resolved section
     (alias, number, and heading text) to the State Owner and Interviewer.
   - If no match is found → **natural language mode**. Treat the entire
     argument string as a description of the change.
4. **On ambiguous match** (e.g., argument matches multiple aliases), list
   the matches with numbers and ask the user to clarify.
5. **On failed resolution** (argument looks like an alias or number but
   doesn't match anything), list available sections:
   ```
   Section "core-flows" not found. Available sections:
   (1) 2.1 #first-run — First Run Experience
   (2) 2.2 #core-flow — Core Flow
   (3) 2.3 #multi-session — Multi-Session Interviews
   ...
   ```

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
