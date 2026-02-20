# fctry — Software Factory

A Claude Code plugin for fully autonomous software development. Produces experience-first specifications ([NLSpec v2](references/template.md)), then drives builds from them.

No human touches or reviews the code. The spec and scenarios are the entire contract.

Inspired by [StrongDM's Attractor](https://github.com/strongdm/attractor) and the NLSpec approach to spec-driven autonomous development.

## Install

In Claude Code, add the marketplace and install the plugin:

```
/plugin marketplace add spaceshipmike/fctry
```

Then select the `fctry` plugin from the marketplace to install it, and restart Claude Code.

### Auto-Update

By default, third-party marketplace plugins don't auto-update. To enable:

1. Open `/plugin` → **Marketplaces** tab
2. Find `fctry` and enable auto-update

Once enabled, updates pull automatically on session start when new commits are pushed. To force an immediate update:

```
/plugin marketplace update fctry
```

## Commands

| Command | What It Does |
|---------|-------------|
| `/fctry:init` | Create a new spec (greenfield or existing project) |
| `/fctry:evolve` | Add features or make changes to an existing spec |
| `/fctry:ref` | Incorporate external references (URLs, screenshots, designs) |
| `/fctry:review` | Audit spec vs. current codebase — find drift and gaps |
| `/fctry:execute` | Build from the spec — assess, plan, implement |
| `/fctry:view` | Open the spec viewer (live browser dashboard) |
| `/fctry:stop` | Stop the spec viewer server |

## Quick Start

```
> /fctry:init
```

The system will:
1. Scan and classify your project (greenfield or existing)
2. Interview you about the experience you want to create
3. Generate `.fctry/spec.md` (the specification)
4. Generate `.fctry/scenarios.md` (the holdout validation set)

When ready to build:

```
> /fctry:execute
```

The Executor proposes a build plan. You approve once. It builds autonomously.

## How It Works

Eight specialized agents orchestrate through a handoff protocol:

| Agent | Role |
|-------|------|
| **State Owner** | Institutional memory — scans the codebase, classifies the project, produces state briefings that ground all other agents in reality. Always runs first. |
| **Interviewer** | Draws out the experience vision through structured conversation. Runs the 8-phase interview on greenfield projects or adapts to formalize existing projects. |
| **Researcher** | Explores external references — URLs, repos, articles, documentation — and extracts actionable insights for the spec. |
| **Visual Translator** | Interprets screenshots, mockups, and design references into experience language for the spec. |
| **Scenario Crafter** | Writes the holdout scenario set — end-to-end user stories with LLM-evaluable satisfaction criteria. |
| **Spec Writer** | Orchestrator — synthesizes all agent inputs into a coherent NLSpec v2 document. Always runs last. |
| **Executor** | Bridges spec to code — proposes build plans, drives autonomous implementation, handles failures silently. |
| **Observer** | Infrastructure peer — observes any surface (browser, terminal, APIs, file system) and reports verification verdicts. Automatic post-chunk verification during builds. |

Every command follows the pipeline: **State Owner** first → **domain agent(s)** → **Scenario Crafter** → **Spec Writer** last. The Observer sits alongside this pipeline as an infrastructure agent available to any other agent on demand.

### The Build Loop

`/fctry:execute` is where specs become software:

1. The State Owner scans the project against the spec
2. The Executor proposes a build plan — chunked, ordered by convergence strategy, with dependency tracking
3. You approve the plan (the only gate)
4. The Executor builds autonomously — handling code failures, retries, and rearchitecting decisions silently
5. Each successful chunk gets a commit and auto-tagged patch version
6. The Observer verifies each chunk's output
7. At completion, you get an experience report describing what you can now do

The user is never interrupted for technical problems. Only experience-level questions (spec ambiguity about what the user sees or does) resurface for input.

## Key Features

### Spec Viewer

A live browser dashboard that serves as the decision surface for all your fctry projects. Auto-starts silently on every `/fctry:` command.

- **Project dashboard** — all registered projects as cards with readiness summary, build status, inbox count, and recommended next command
- **Live spec rendering** — markdown rendered directly in the browser (zero build step), updates in real-time via WebSocket as agents work
- **Mission control** — during builds, transforms into a live view with dependency DAG visualization, chunk lifecycle states, activity feed with typed events, and context health indicator
- **Change history** — vertical timeline of spec changes with inline diffs
- **Async inbox** — queue evolve ideas, reference URLs, and feature requests at any time, even during builds. The system processes them in the background so groundwork is done when you sit down to discuss.

### Terminal Status Line

Auto-configures itself on first run. Shows project identity, current activity, context usage, section readiness summary, and untracked change count — all derived from agent state, never manually configured.

### Token Economy

Agents are constrained to produce lean, efficient output:

- **Reference-first evidence** — agents cite evidence by reference (file path + line range, section alias), never paste raw content. The viewer hydrates references into full detail on demand.
- **Delta-first output** — changes described as diffs, not full reprints. A spec update shows what changed, not the full section.
- **No duplicate context** — each entity (project identity, spec version, repo state) described once in its canonical location. Subsequent references use IDs or shorthand.
- **Output depth tiering** — agent outputs scale with task scope. Patch-tier operations get minimal output; architecture-tier operations get comprehensive analysis with expandable detail.

### Structured Interchange

Every agent emits a structured interchange document alongside its conversational CLI output. The terminal stays conversational (what the user reads); the viewer renders the interchange as interactive UI (finding cards, action checklists, expandable evidence). Two audiences, one analysis pass.

### Multi-Project Support

The viewer is a single multi-project-aware server. A project registry tracks all known fctry projects. Switch between projects from the sidebar without opening separate browser tabs.

### Drift Detection

The State Owner continuously monitors spec-code alignment. When file writes happen outside fctry commands, a PostToolUse hook detects the change and surfaces a nudge. `/fctry:review` produces a full gap analysis with drift classified as Code Ahead, Spec Ahead, or Diverged — with evidence and numbered recommendations.

## Philosophy

- **Experience language only.** Specs describe what users see, do, and feel. Never databases, APIs, or code patterns.
- **The agent decides implementation.** The coding agent has full authority over tech choices, architecture, and data model. Section 6.4 of every spec explicitly grants this.
- **Scenarios are holdout sets.** Stored separately from the spec, evaluated by LLM-as-judge, measuring satisfaction not pass/fail. The coding agent never sees scenarios during development.
- **Plan approval is the only gate.** Human collaborates on vision (init, evolve, ref, review). Build is machine-only. Once the plan is approved, the system executes autonomously.
- **The factory never idles.** During builds, the viewer accepts async input that the system processes in the background.

## Tool Dependencies

Core tools (file read/write, ripgrep, ast-grep) are required. Research tools (gh CLI, Firecrawl MCP, Context7/DeepWiki) and visual tools (Playwright MCP, Chrome DevTools MCP) are needed for full capability. See [references/tool-dependencies.md](references/tool-dependencies.md).

## License

MIT
