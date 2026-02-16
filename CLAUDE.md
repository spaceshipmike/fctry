# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

fctry is a Claude Code plugin — a multi-agent system for fully autonomous software development. It produces experience-first specifications (NLSpec v2 format), then drives builds from them. No human touches or reviews the code; the spec and scenarios are the entire contract.

Installed via `.claude-plugin/plugin.json`. The skill entry point is `SKILL.md`.

## Factory Context

fctry eats its own dogfood — this project has its own factory spec and scenarios:

- **Spec:** `.fctry/spec.md` — the canonical NLSpec v2 document for fctry itself
- **Scenarios:** `.fctry/scenarios.md` — holdout scenario set (42 scenarios across 3 phases)
- **Changelog:** `.fctry/changelog.md` — timestamped spec update history

The spec describes experience; the coding agent decides implementation. Scenarios are evaluated by LLM-as-judge for satisfaction, not shown to the coding agent during builds.

## `.fctry/` Directory

```
.fctry/
├── spec.md              # Canonical spec (source of truth)
├── scenarios.md         # Holdout scenario set
├── changelog.md         # Timestamped spec update log
├── .gitignore           # Excludes ephemeral files from git
├── state.json           # Workflow state (ephemeral, cleared on session start)
├── spec.db              # SQLite cache of spec index (derived, auto-rebuilds)
├── plugin-root          # Plugin root path breadcrumb (ephemeral)
└── viewer/              # Viewer ephemera (PID, port, logs)
    ├── viewer.pid
    ├── port.json
    └── viewer.log
```

Git tracks: `spec.md`, `scenarios.md`, `changelog.md`, `.gitignore`. Everything else is ephemeral.

## Repository Structure

```
fctry/
├── .claude-plugin/plugin.json   — Plugin manifest
├── SKILL.md                     — Skill entry point (description + routing + philosophy)
├── commands/                    — Per-command workflows (init, evolve, ref, review, execute, view, stop)
├── agents/                      — Agent reference files with frontmatter (7 agents)
├── hooks/hooks.json             — Plugin hooks (lifecycle, status line, migration, untracked change detection)
├── hooks/migrate.sh             — UserPromptSubmit hook: auto-migrates old layout to .fctry/
├── hooks/detect-untracked.js    — PostToolUse hook: detects file writes outside fctry commands
├── references/
│   ├── template.md              — NLSpec v2 template
│   ├── tool-dependencies.md     — Required/optional tool inventory
│   ├── shared-concepts.md       — Factory philosophy, experience language, holdout sets, etc.
│   ├── state-protocol.md        — Status state file schema and write protocol
│   ├── alias-resolution.md      — Section alias resolution protocol
│   ├── error-conventions.md     — Error handling pattern and common errors
│   └── claudemd-guide.md       — CLAUDE.md best practices (two-layer model, templates)
├── src/spec-index/              — Spec index (SQLite-backed section parser + readiness assessment)
├── src/statusline/              — Terminal status line (Node.js script + auto-config hook)
├── src/viewer/                  — Spec viewer (Node.js server + browser client + manage.sh lifecycle script)
├── CLAUDE.md                    — This file
├── README.md                    — Installation and quick-start guide
└── LICENSE                      — MIT
```

### Progressive Disclosure

- **SKILL.md** is the top-level entry point — command table, agent table, routing. Kept concise (~80 lines).
- **commands/*.md** carry detailed per-command workflows (agent ordering, output, modes). Loaded only when that command runs.
- **agents/*.md** carry full agent instructions (purpose, tools, process, output format). Loaded only when that agent is invoked.
- **references/** holds shared concepts, alias resolution, error conventions, the spec template, and tool dependency list. Loaded by reference from agent/command files to avoid duplication.

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
| `/fctry:view` | No agents — opens the spec viewer (auto-starts via hooks) |
| `/fctry:stop` | No agents — stops the spec viewer (auto-stops on session end) |

`‖` = can run in parallel.

### Viewer Lifecycle

The spec viewer auto-starts silently (no browser tab) on every prompt via
`hooks/hooks.json` (`UserPromptSubmit` → `manage.sh ensure`). It auto-stops on
session end (`SessionEnd` → `manage.sh stop`). The `ensure` subcommand is a
no-op when no spec exists or the viewer is already running. `/fctry:view` and
`/fctry:stop` delegate to the same `manage.sh` script for explicit control.

A synchronous `UserPromptSubmit` hook (`migrate.sh`) runs first on every prompt,
detecting old-convention file layouts (`{name}-spec.md` at root, `fctry-state.json`,
etc.) and silently migrating them to `.fctry/`. Uses `git mv` for tracked files.
Also ensures `.fctry/.gitignore` exists when a spec is present. Fast no-op when
no migration is needed.

The same `UserPromptSubmit` hook also runs `ensure-config.sh` to set up the
terminal status line (see Status Line section below).

A `SessionStart` hook clears `.fctry/state.json` to prevent stale data
from previous sessions. A `PostToolUse` hook (`detect-untracked.js`) fires
after Write/Edit tool calls to detect file changes outside fctry commands and
surface nudges when those files map to spec-covered sections.

### Status Line

The terminal status line auto-configures itself via a `UserPromptSubmit` hook
(`ensure-config.sh`). On every prompt, the hook checks if the project's
`.claude/settings.local.json` has the `statusLine` setting; if not, it writes
it. The status line script (`fctry-statusline.js`) reads session data from
stdin and `.fctry/state.json` to display project identity, activity,
context usage, section readiness summary (`N/M ready`), and untracked change
count. Agents write to the state file as they work; the status line is a
passive reader.

### Key Invariants

- **Experience language only.** Specs describe what users see, do, and feel. Never databases, APIs, or code patterns.
- **Agent decides implementation.** Section 6.4 of every spec grants the coding agent full authority over tech choices, architecture, and data model.
- **Scenarios are holdout sets.** Stored outside the codebase. Evaluated by LLM-as-judge. Satisfaction is probabilistic, not boolean.
- **State Owner is a peer, not a utility.** Consulted at the start of every command.
- **Workflow enforcement is active.** Agents validate prerequisites via `completedSteps` in the state file before proceeding. Skipping a step surfaces a numbered error.
- **Spec Writer evolves, never rewrites.** On updates, change what needs changing, preserve what doesn't.
- **Scenario Crafter owns scenarios.** The Spec Writer ensures alignment but does not author them.

### Tool Dependencies

See `references/tool-dependencies.md` for the full inventory. In brief:
- **Core:** File read/write, ripgrep (`rg`), ast-grep (`sg`)
- **Spec Index:** `better-sqlite3` (optional — graceful degradation if unavailable)
- **Research:** `gh` CLI, Firecrawl MCP, Context7/DeepWiki
- **Visual:** Playwright MCP, Chrome DevTools MCP
