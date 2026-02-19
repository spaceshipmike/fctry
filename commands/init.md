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

0. **Status state** → Write `currentCommand: "init"` and `completedSteps: []`
   to `.fctry/state.json` (read-modify-write per
   `references/state-protocol.md`). Clearing `completedSteps` resets the
   workflow for this command.
1. **State Owner** → Scans the project. Classifies it (Greenfield, Existing —
   No Spec, Existing — Has Spec, Existing — Has Docs). Produces a state
   briefing appropriate to the classification. Writes
   `workflowStep: "state-owner-scan"` on start, appends `"state-owner-scan"`
   to `completedSteps` on completion.
2. **Interviewer** → Validates `"state-owner-scan"` in `completedSteps` before
   starting. Adapts its approach based on the classification
   (see `agents/interviewer.md`). On greenfield, runs the full 8-phase
   interview. On existing projects, grounds the conversation in what's built.
   Saves state after each phase to `.fctry/interview-state.md`. Appends
   `"interviewer"` to `completedSteps` on completion.
3. **Scenario Crafter** → Validates `"interviewer"` in `completedSteps`.
   Takes the interview output and writes scenarios. For existing projects,
   scenarios cover both current behavior worth preserving and intended
   improvements. Appends `"scenario-crafter"` to `completedSteps`.
4. **Spec Writer** → Validates `"interviewer"` and `"scenario-crafter"` in
   `completedSteps`. Synthesizes everything into the spec using the template
   from `references/template.md`. Stores visual references in `.fctry/references/`.
   Creates `CLAUDE.md` at the project root with evergreen project instructions
   and compact instructions (see `references/claudemd-guide.md`). The compact
   instructions section tells Claude what to preserve during auto-compaction:
   spec/scenario file paths, build checkpoint state, scenario satisfaction,
   active section and workflow step. Appends `"spec-writer"` to
   `completedSteps`.
5. **Version registry seeding** → After the Spec Writer completes, seed the
   version registry in `.fctry/config.json`. If the file already exists
   (e.g., with execution priorities), read-modify-write to add the `versions`
   key alongside existing content. If it doesn't exist, create it.

   Default registry:
   ```json
   {
     "versions": {
       "external": {
         "type": "external",
         "current": "0.1.0",
         "propagationTargets": [],
         "incrementRules": {
           "patch": "auto-per-chunk",
           "minor": "suggest-at-plan-completion",
           "major": "suggest-at-experience-milestone"
         }
       },
       "spec": {
         "type": "internal",
         "current": "0.1",
         "propagationTargets": [
           { "file": ".fctry/spec.md", "field": "spec-version" }
         ],
         "incrementRules": {
           "minor": "auto-on-evolve"
         }
       }
     },
     "relationshipRules": [
       {
         "when": { "type": "spec", "change": "major" },
         "action": "suggest-external-minor-bump"
       }
     ]
   }
   ```

   The spec version's `current` value is set to match the spec frontmatter
   `spec-version` field. The external version starts at `0.1.0` for all new
   projects. Propagation targets for the external version start empty — they
   are auto-discovered at first `/fctry:execute` (see `commands/execute.md`
   Step 1.75).

## Output

- `.fctry/spec.md` — The complete specification, with `synopsis` block in frontmatter
- `.fctry/scenarios.md` — The scenario holdout set
- `.fctry/config.json` — Version registry (external 0.1.0, spec version matching frontmatter)
- `.fctry/references/` — Visual references and design assets (if any)
- `.fctry/.gitignore` — Created automatically by the migration hook on the next prompt
- `CLAUDE.md` — Evergreen project instructions (factory contract, command quick-ref,
  `.fctry/` directory guide, workflow guidance, scenario explanation) and compact
  instructions (what to preserve during auto-compaction). See
  `references/claudemd-guide.md` for the template and best practices.

### Project Synopsis

The init output includes the project synopsis — structured descriptions
generated from the interview and stored in the spec's YAML frontmatter as
the `synopsis` block. Display all six fields in the output summary so the
user can copy them into package.json, README.md, marketplace listings, etc.

### Next Steps

After the spec summary, include:

```
Spec created: .fctry/spec.md (N sections, N words)
Scenarios created: .fctry/scenarios.md (N scenarios)
Version registry seeded: .fctry/config.json (external 0.1.0, spec 0.1)
Project instructions created: CLAUDE.md (evergreen factory context)

Project Synopsis:
  Short:  [one-liner, <80 chars]
  Medium: [2-3 sentences — purpose, audience, approach]
  README: [one paragraph — full pitch]
  Stack:  [tech stack array]
  Patterns: [architectural patterns array]
  Goals:  [project goals array]

Next steps:
- Review the spec — read through to confirm it captures your vision
- Run /fctry:evolve <section> to refine any section
- Run /fctry:ref <url> to incorporate external inspiration
- Run /fctry:execute to start the build
```
