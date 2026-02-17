# CLAUDE.md Best Practices

Guide for agents that create or update CLAUDE.md in target projects. Referenced
by the Spec Writer (at init) and the Executor (at execute).

## Principles

**Concise and actionable.** CLAUDE.md is instructions for a coding agent, not
documentation. Every line should change how the agent behaves. If a line doesn't
change behavior, cut it.

**Three layers, one file.** CLAUDE.md has an evergreen layer (stable across the
project lifecycle), a compact instructions layer (guides what Claude preserves
during auto-compaction), and a build layer (refreshed each execute run). All
live in the same file, separated by clear headings.

**fctry owns the file.** The entire CLAUDE.md is managed by fctry. The evergreen
and compact instructions layers are created at init; the build layer is added at
execute. Review audits all three layers. Users who want additional project
instructions should add them via `/fctry:evolve` so the spec captures them.

## Evergreen Layer (Created at Init)

Written by the Spec Writer after the interview completes. Contains content that
remains valid across the entire project lifecycle. Rarely changes — only when
the spec structure, factory contract, or fctry itself evolves.

### Required Sections

**Project identity.** One line: what this project is. Derived from the spec's
section 1.1 (core purpose).

**Factory contract.** The three essential facts:
- Spec path (`.fctry/spec.md`) and what it contains
- Scenario path (`.fctry/scenarios.md`) and the holdout rule
- Agent authority: the spec describes experience, the agent decides implementation

**Command quick-reference.** A table of fctry commands the agent should know:

```markdown
| Command | When to Use |
|---------|-------------|
| `/fctry:evolve <section>` | Requirements changed — update the spec first |
| `/fctry:review` | Check if spec and code are aligned |
| `/fctry:execute` | Build from the spec |
```

Keep it to the commands relevant to a coding agent. Skip `/fctry:init` (already
happened) and `/fctry:view`/`/fctry:stop` (viewer management).

**`.fctry/` directory guide.** Explain what the agent will find:

```markdown
## .fctry/ Directory

- `spec.md` — The specification (source of truth)
- `scenarios.md` — Holdout scenario set (do not read during builds)
- `changelog.md` — Spec change history
- `state.json` — Workflow state (ephemeral, ignored by git)
- `references/` — Visual references and design assets
```

**Workflow guidance.** How to work within the factory model:
- Read the relevant spec section before writing code
- If requirements seem wrong or incomplete, run `/fctry:evolve` — don't improvise
- The spec describes experience, not implementation — translate intent into code
- Don't read `.fctry/scenarios.md` during builds (holdout rule)

**Scenario explanation.** One paragraph explaining what scenarios are, that
they're evaluated by LLM-as-judge after builds, and that satisfaction is
probabilistic. The agent needs to understand why scenarios exist without
seeing their content.

## Compact Instructions Layer (Created at Init)

Written by the Spec Writer alongside the evergreen layer. Contains a static,
evergreen set of preservation rules that tell Claude what to prioritize during
auto-compaction. This section rarely changes — what matters for a factory
project is stable across the lifecycle.

### Required Content

**Section heading:** `# Compact Instructions`

**Preservation rules:** Tell Claude to always preserve:
- Spec path (`.fctry/spec.md`) and scenario path (`.fctry/scenarios.md`)
- Build checkpoint state in `.fctry/state.json` (the `buildRun` object,
  `completedSteps`, `chunkProgress`)
- Scenario satisfaction scores (satisfied/total)
- Active section and workflow step (what agent is working, on which section)
- The current build plan (if one exists in the build layer below)

### Example

```markdown
# Compact Instructions

When compacting, always preserve:
- File paths: `.fctry/spec.md` (spec), `.fctry/scenarios.md` (scenarios)
- Build state: `.fctry/state.json` contains build checkpoints, workflow
  progress, and scenario scores — reference this file, don't try to
  reconstruct from memory
- Active context: which command is running, which workflow step is active,
  which spec section is being worked on
- The current build plan (if one exists below)
- Key decisions made during this session
```

### Stability Rule

The compact instructions are static and evergreen. They don't change per
phase, per command, or per build. In unusual builds (oversized chunks,
non-default isolation strategies), the Executor may append phase-specific
instructions and call this out in the build plan — but this is rare.

## Build Layer (Added at Execute)

Written by the Executor after the user approves a build plan. Contains content
specific to the current build cycle. Refreshed on each execute run — the
Executor replaces the build layer while preserving the evergreen layer.

### Required Sections

**Current build plan.** The approved plan: which chunks, which scenarios, in
what order. Updated after each chunk completes (mark completed chunks).

**Architecture notes.** Discovered during implementation — key decisions the
agent made about tech stack, data model, project structure. Written after the
first chunk so the agent remembers its own decisions across sessions.

**Convergence order.** From the spec's section 6.2. The order in which sections
should be built. Helps the agent prioritize when multiple sections are ready.

**Versioning rules.** Version registry location (`.fctry/config.json`), current
external and spec versions, propagation targets, and increment rules. The
registry is the single source of truth — never hardcode version numbers in
CLAUDE.md.

### Architecture Discovery

The Executor should examine the project after the first build chunk to capture:
- **Tech stack** — frameworks, languages, key dependencies
- **Project structure** — directory layout, entry points, config files
- **Test approach** — how to run tests, what framework is used
- **Build/run commands** — how to start, build, deploy
- **Key patterns** — naming conventions, module organization, state management

Write these as concise bullet points. The agent needs enough context to maintain
consistency across sessions, not a comprehensive architecture document.

## Layer Separation

The three layers are separated by headings. The order is always: evergreen →
compact instructions → build. The Executor identifies the build layer by
looking for `## Current Build Plan` or a similar heading that marks where
build-specific content begins. Everything above is evergreen + compact
instructions; everything from that heading down is the build layer.

When enriching, the Executor:
1. Reads the existing CLAUDE.md
2. Identifies where the evergreen and compact instructions layers end
3. Replaces everything from the build layer heading onward
4. Preserves the evergreen and compact instructions layers byte-for-byte

If no build layer exists yet (first execute), the Executor appends it after
the compact instructions section.

## What NOT to Include

- **Implementation details from the spec.** The spec describes experience; the
  agent discovers implementation. Don't copy spec content into CLAUDE.md.
- **Scenario content.** Never include scenario text — holdout rule.
- **Exhaustive API documentation.** CLAUDE.md is not a README.
- **Instructions that duplicate the spec.** If the spec already says it,
  don't repeat it in CLAUDE.md. Point to the spec section instead.
