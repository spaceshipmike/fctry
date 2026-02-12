---
description: Create a new factory-style spec for a project (new or existing)
argument-hint: "<project name or directory>"
---

# /fctry:init

Create a factory-style specification for a project. Works for greenfield projects
and existing codebases alike — the State Owner classifies the project first, and
the entire flow adapts accordingly.

## How It Adapts

**Greenfield:** The Interviewer draws out the vision from scratch through the
full 8-phase interview.

**Existing project (no spec):** The State Owner provides a thorough briefing
on what's built — capabilities, architecture, current experience. The
Interviewer uses this as the foundation: "Here's what exists today. What's
intentional? What needs to change? Where should it go next?" The conversation
formalizes reality and captures intent, rather than imagining from zero.

**Existing project (has docs):** The State Owner assesses existing
documentation against the code. The Interviewer focuses on gaps and
outdated sections rather than re-covering ground.

## Tool Validation

On first run (or when `.fctry/tool-check` doesn't exist), validate tool
availability before proceeding. Check each tool category from
`references/tool-dependencies.md`:

1. **Core tools** (rg, file read/write, web search) — required for all commands
2. **Code intelligence** (sg, tree-sitter) — required for State Owner scans
3. **Research tools** (gh, Firecrawl MCP) — required for `/fctry:ref`
4. **Visual tools** (Playwright MCP, Chrome DevTools MCP) — required for
   visual references

For each missing tool, report its status and which commands are affected.
Then present numbered options:

```
Tool validation:
  ✓ rg (ripgrep) — available
  ✓ web search — available
  ✗ sg (ast-grep) — not found (needed for: State Owner code analysis)
  ✗ gh CLI — not found (needed for: /fctry:ref with GitHub repos)

(1) Proceed without missing tools (some features will be limited)
(2) Show installation instructions for missing tools
(3) Abort and install tools first
```

After validation, write `.fctry/tool-check` with the results so subsequent
runs skip the full check. Re-validate when the user runs `/fctry:init` with
`--check-tools` or when a command fails due to a missing tool.

## Resume Detection

Before starting the workflow, check for `.fctry/interview-state.md`:

- **If found with status "In progress"** → the interview was interrupted.
  Present numbered options:
  ```
  Found an incomplete interview (phases 1-3 of 8 complete, last updated 2026-02-10).
  (1) Resume where we left off (recommended)
  (2) Start fresh (discards previous progress)
  (3) Review what was captured so far before deciding
  ```
  On resume: skip the State Owner scan (classification is saved in the state
  file) and hand off to the Interviewer, which picks up from the next
  incomplete phase.

- **If found with status "Complete"** → a previous init finished. Tell the
  user a spec already exists and suggest `/fctry:evolve` instead.

- **If not found** → fresh start. Proceed with normal workflow.

## Workflow

0. **Status state** → Write `currentCommand: "init"` to `.fctry/fctry-state.json`
   (read-modify-write per `references/state-protocol.md`).
1. **State Owner** → Scans the project. Classifies it (Greenfield, Existing —
   No Spec, Existing — Has Spec, Existing — Has Docs). Produces a state
   briefing appropriate to the classification.
2. **Interviewer** → Adapts its approach based on the classification
   (see `agents/interviewer.md`). On greenfield, runs the full 8-phase
   interview. On existing projects, grounds the conversation in what's built.
   Saves state after each phase to `.fctry/interview-state.md`.
3. **Scenario Crafter** → Takes the interview output and writes scenarios.
   For existing projects, scenarios cover both current behavior worth preserving
   and intended improvements.
4. **Spec Writer** → Synthesizes everything into the spec using the template from
   `references/template.md`. Stores visual references in `references/`.

## Output

- `{project-name}-spec.md` — The complete specification
- `{project-name}-scenarios.md` — The scenario holdout set
- `references/` — Visual references and design assets (if any)

### Next Steps

After the spec summary, include:

```
Next steps:
- Review the spec — read through to confirm it captures your vision
- Run /fctry:evolve <section> to refine any section
- Run /fctry:ref <url> to incorporate external inspiration
- Run /fctry:execute to start the build
```
