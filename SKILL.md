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

## The Factory Philosophy

This skill operates under the Software Factory model:

- **Code is not written by humans.** The coding agent writes all code.
- **Code is not reviewed by humans.** The spec and scenarios are the contract.
- **Tests become scenarios.** End-to-end user stories, evaluated by LLMs, stored
  outside the codebase like holdout sets in ML.
- **Pass/fail becomes satisfaction.** Of all trajectories through all scenarios,
  what fraction satisfy the user? Probabilistic, not boolean.
- **The spec describes experience, not implementation.** The spec captures WHAT
  the system does and HOW it feels. The agent figures out the rest.

## Commands

| Command | What It Does | Reference |
|---------|-------------|-----------|
| `/fctry:init` | Create a new spec (greenfield or existing project) | `commands/init.md` |
| `/fctry:evolve` | Add features or make changes to an existing spec | `commands/evolve.md` |
| `/fctry:ref` | Incorporate external references (URLs, screenshots, designs) | `commands/ref.md` |
| `/fctry:review` | Audit spec vs. current codebase — find drift and gaps | `commands/review.md` |
| `/fctry:execute` | Build from the spec — assess, plan, implement | `commands/execute.md` |
| `/fctry:view` | Open the spec viewer in the browser | `commands/view.md` |
| `/fctry:stop` | Stop the spec viewer server | `commands/stop.md` |

Read the command file for detailed workflow and agent orchestration.

## Agents

Seven specialized agents, each with a focused role. See `agents/` for full details.

| Agent | Role | Reference |
|-------|------|-----------|
| **State Owner** | Institutional memory — scans codebase, classifies project, produces state briefings | `agents/state-owner.md` |
| **Interviewer** | Draws out the experience vision through conversation | `agents/interviewer.md` |
| **Researcher** | Explores external references (URLs, repos, articles) | `agents/researcher.md` |
| **Visual Translator** | Interprets screenshots and designs into experience language | `agents/visual-translator.md` |
| **Spec Writer** | Orchestrator — maintains the spec document | `agents/spec-writer.md` |
| **Scenario Crafter** | Writes the scenario holdout set | `agents/scenario-crafter.md` |
| **Executor** | Build planner — proposes and drives build plans from the spec | `agents/executor.md` |

### Agent Handoff Protocol

Every command follows the same pattern:

1. **State Owner first.** Always. Even on greenfield. The State Owner's briefing
   grounds every subsequent agent in reality.
2. **Domain agent(s) next.** The Interviewer, Researcher, or Visual Translator
   does their work, informed by the State Owner's briefing.
3. **Scenario Crafter** (when applicable). Takes the domain agent output and
   writes/updates scenarios.
4. **Spec Writer last.** Synthesizes all inputs into the spec. Shows what changed.

### Spawning Agents

When subagents are available, spawn independent agents in parallel where possible:

- On `/fctry:init`: State Owner runs first, then Interviewer is interactive (sequential),
  then Scenario Crafter and Spec Writer can work in parallel once the interview is done.
- On `/fctry:ref`: State Owner and the domain agent (Researcher or Visual Translator)
  can run in parallel since the domain agent is exploring the reference while State
  Owner is scanning the project.
- On `/fctry:review`: Only State Owner and Spec Writer are needed, sequential.
- On `/fctry:execute`: State Owner runs first, then Executor reads the briefing and
  proposes a build plan (sequential — the plan needs the briefing). Once approved,
  the Executor drives the build.

When subagents are not available, run agents inline sequentially. Read the relevant
agent reference file (e.g., `agents/state-owner.md`) and follow its procedures
directly in the main loop.

## Output Files

Commands produce files in the target project directory:

- `{project-name}-spec.md` — Complete NLSpec following `references/template.md`
- `{project-name}-scenarios.md` — Holdout scenario set (separate from spec, intentionally)
- `references/` — Visual references and design assets

By default, outputs are written to the current project directory. If no project
directory is apparent, ask the user where to save.

## Tool Dependencies

See `references/tool-dependencies.md` for the full list of required and optional tools.

## Important Behaviors

**Experience language, always.** The spec describes what users see, do, and feel.
Never databases, APIs, or code patterns. The coding agent translates experience
into implementation.

**The agent decides implementation.** Section 6.4 of every spec explicitly grants
the coding agent full authority over technology choices, architecture, data model,
and all other implementation decisions. The spec constrains experience, not code.

**Scenarios are the holdout set.** They live in a separate file. They describe
experience, not implementation. They're evaluated by LLM-as-judge. They prevent
the coding agent from "teaching to the test."

**Satisfaction, not pass/fail.** Success is probabilistic: of all observed
trajectories through all scenarios, what fraction satisfy the user? This is the
metric, not boolean pass/fail.

**State Owner first.** Every command consults the State Owner before any other
agent acts. This grounds all spec updates in the reality of what's actually built.

**Number every choice.** All questions, options, and choices presented to the
user are numbered. The user can respond by number ("2"), by range ("1, 3"),
or by natural language. This applies across all agents and commands.

**Fail gracefully.** When something goes wrong (missing spec, invalid alias,
URL failure, tool unavailable), always: (1) explain what happened in plain
language, (2) present numbered recovery options, (3) never silently fail or
proceed with wrong assumptions. See the error conventions below.

## Error Conventions

Every error across all commands follows this pattern:

1. **State what happened.** Plain language, no jargon.
2. **Explain why.** Brief context about the cause.
3. **Present numbered options.** Always at least two choices for recovery.

Common error patterns:

| Error | Convention |
|-------|-----------|
| No spec found | "No spec found in this project. (1) Run `/fctry:init` to create one (2) Specify a different directory" |
| Invalid section alias | List available sections with numbers (see alias resolution in `commands/evolve.md`) |
| Empty arguments | Explain what's expected: "Usage: `/fctry:evolve <section or description>`. (1) Show available sections (2) Describe the change in natural language" |
| URL fetch failure | Try alternatives, then present options (see `agents/researcher.md`) |
| Missing tools | Show status and options (see tool validation in `commands/init.md`) |
| Chunk failure during execute | "(1) Flag for review and continue (2) Stop execution (3) Retry this chunk" |
| Ambiguous user response | Restate the options and ask for clarification — never guess |
