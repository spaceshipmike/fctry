---
name: fctry
description: >
  Software Factory — multi-agent system for autonomous development from
  experience-first specifications. Use when the user invokes /fctry:init,
  /fctry:evolve, /fctry:ref, /fctry:review, /fctry:execute, /fctry:view,
  or /fctry:stop, or says "create a spec", "spec this out", "write a
  specification", "help me plan a build", "kick off the build", "start
  factory mode", "build from the spec", "open the viewer", "show my spec",
  or "generate scenarios".
---

# fctry — Software Factory

A multi-agent system that produces experience-first specifications, then drives
autonomous builds from them. No human touches or reviews the code. The spec and
scenarios are the entire contract.

## Routing

When the user wants to build something and a spec already exists, suggest
`/fctry:execute`. When no spec exists, suggest `/fctry:init` first.

### Workflow Transitions

Every command's output includes a "Next steps" block reflecting these transitions:

| Just Finished | Condition | Suggest |
|---|---|---|
| init | Spec created | evolve, ref, or execute |
| evolve | Code exists, spec now ahead | execute |
| evolve | No code yet / spec-only | review or another evolve |
| ref | Section updated | evolve to refine, or execute |
| ref | Broad changes (open mode) | review |
| review | Drift found | evolve the drifted section |
| review | Spec ahead | execute |
| review | Aligned | "No action needed" |
| execute | Plan complete | review |
| execute | Stopped mid-plan | execute to resume, or review |

## Factory Philosophy

See `references/shared-concepts.md` for canonical definitions of the factory
model, experience language, holdout sets, numbered options, and agent authority.

## Commands

| Command | What It Does | Reference |
|---------|-------------|-----------|
| `/fctry:init` | Create a new spec (greenfield or existing project) | `commands/init.md` |
| `/fctry:evolve` | Add features or make changes to an existing spec | `commands/evolve.md` |
| `/fctry:ref` | Incorporate external references (URLs, screenshots, designs) | `commands/ref.md` |
| `/fctry:review` | Audit spec vs. current codebase — find drift and gaps | `commands/review.md` |
| `/fctry:execute` | Build from the spec — assess, plan, implement | `commands/execute.md` |
| `/fctry:view` | Open the spec viewer (auto-starts on any `/fctry:` command) | `commands/view.md` |
| `/fctry:stop` | Stop the spec viewer | `commands/stop.md` |

Read the command file for detailed workflow and agent orchestration.

## Agents

Eight specialized agents, each with a focused role. See `agents/` for full details.

| Agent | Role | Reference |
|-------|------|-----------|
| **State Owner** | Institutional memory — scans codebase, classifies project, produces state briefings | `agents/state-owner.md` |
| **Interviewer** | Draws out the experience vision through conversation | `agents/interviewer.md` |
| **Researcher** | Explores external references (URLs, repos, articles) | `agents/researcher.md` |
| **Visual Translator** | Interprets screenshots and designs into experience language | `agents/visual-translator.md` |
| **Spec Writer** | Orchestrator — maintains the spec document | `agents/spec-writer.md` |
| **Scenario Crafter** | Writes the scenario holdout set | `agents/scenario-crafter.md` |
| **Executor** | Build planner — proposes and drives build plans from the spec | `agents/executor.md` |
| **Observer** | Infrastructure peer — observes any surface (browser, API, files), reports verification verdicts | `agents/observer.md` |

Every command follows: State Owner first → domain agent(s) → Scenario Crafter
(when applicable) → Spec Writer last. The Observer is an infrastructure agent
available to any agent on demand — automatic post-chunk during builds, ad-hoc
for any other agent. See each command file for spawning details.

## Output Files

All output goes to `.fctry/` in the target project directory:
`spec.md`, `scenarios.md`, `changelog.md`, and `references/`.
Only `CLAUDE.md` is placed at the project root (created by `/fctry:init`, enriched by `/fctry:execute`).

## Tool Dependencies

See `references/tool-dependencies.md` for the full list of required and optional tools.

## Important Behaviors

**Number every choice.** All questions, options, and choices presented to the
user are numbered. The user can respond by number ("2"), by range ("1, 3"),
or by natural language. This applies across all agents and commands.

**Fail gracefully.** When something goes wrong, always: (1) explain what
happened in plain language, (2) present numbered recovery options, (3) never
silently fail or proceed with wrong assumptions. See
`references/error-conventions.md` for the full error pattern and common errors.

For experience language, holdout sets, agent authority, and State Owner first
rule, see `references/shared-concepts.md`.
