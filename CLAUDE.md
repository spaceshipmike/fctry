# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

fctry is a Claude Code plugin — a multi-agent system for fully autonomous software development. It produces experience-first specifications (NLSpec v2 format), then drives builds from them. No human touches or reviews the code; the spec and scenarios are the entire contract.

Installed via `.claude-plugin/plugin.json`. The skill entry point is `SKILL.md`.

## Repository Structure

```
fctry/
├── .claude-plugin/plugin.json   — Plugin manifest
├── SKILL.md                     — Skill entry point (description + routing + philosophy)
├── commands/                    — Per-command workflows (init, evolve, ref, review, execute)
├── agents/                      — Agent reference files with frontmatter (7 agents)
├── references/
│   ├── template.md              — NLSpec v2 template
│   └── tool-dependencies.md     — Required/optional tool inventory
├── CLAUDE.md                    — This file
├── README.md                    — Installation and quick-start guide
└── LICENSE                      — MIT
```

### Progressive Disclosure

- **SKILL.md** is the top-level entry point — philosophy, command summary table, agent table, handoff protocol, spawning strategy. Kept concise.
- **commands/*.md** carry detailed per-command workflows (agent ordering, output, modes). Loaded only when that command runs.
- **agents/*.md** carry full agent instructions (purpose, tools, process, output format). Loaded only when that agent is invoked.
- **references/** holds the spec template and tool dependency list.

## Architecture

### Agent Pipeline

Every command follows the same handoff protocol:

1. **State Owner** (`agents/state-owner.md`) — Always runs first. Classifies the project and produces a state briefing.
2. **Domain agents** — Interviewer, Researcher, or Visual Translator do their work informed by the briefing.
3. **Scenario Crafter** (`agents/scenario-crafter.md`) — Writes/updates the holdout scenario set. Owns scenario authoring.
4. **Spec Writer** (`agents/spec-writer.md`) — Synthesizes all inputs into the spec. Always runs last. Ensures scenario alignment but does not author scenarios.

The **Executor** (`agents/executor.md`) bridges spec to code during `/fctry:execute`.

### Commands → Agent Mapping

| Command | Agents (in order) |
|---------|------------------|
| `/fctry:init` | State Owner → Interviewer (interactive) → Scenario Crafter + Spec Writer |
| `/fctry:evolve` | State Owner → Interviewer (targeted) → Scenario Crafter → Spec Writer |
| `/fctry:ref` | State Owner ‖ Researcher or Visual Translator → Spec Writer |
| `/fctry:review` | State Owner → Spec Writer (gap analysis only) |
| `/fctry:execute` | State Owner → Executor (proposes plan, user approves, then builds) |

`‖` = can run in parallel.

### Key Invariants

- **Experience language only.** Specs describe what users see, do, and feel. Never databases, APIs, or code patterns.
- **Agent decides implementation.** Section 6.4 of every spec grants the coding agent full authority over tech choices, architecture, and data model.
- **Scenarios are holdout sets.** Stored outside the codebase. Evaluated by LLM-as-judge. Satisfaction is probabilistic, not boolean.
- **State Owner is a peer, not a utility.** Consulted at the start of every command.
- **Spec Writer evolves, never rewrites.** On updates, change what needs changing, preserve what doesn't.
- **Scenario Crafter owns scenarios.** The Spec Writer ensures alignment but does not author them.

### Tool Dependencies

See `references/tool-dependencies.md` for the full inventory. In brief:
- **Core:** File read/write, ripgrep (`rg`), ast-grep (`sg`)
- **Research:** `gh` CLI, Firecrawl MCP, Context7/DeepWiki
- **Visual:** Playwright MCP, Chrome DevTools MCP
