# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

fctry is a Claude Code plugin — a multi-agent system for fully autonomous software development. It produces experience-first specifications (NLSpec v2 format), then drives builds from them. No human touches or reviews the code; the spec and scenarios are the entire contract.

Installed via `.claude-plugin/plugin.json`. The skill entry point is `SKILL.md`.

## Factory Context

fctry eats its own dogfood — this project has its own factory spec and scenarios:

- **Spec:** `.fctry/spec.md` — the canonical NLSpec v2 document for fctry itself
- **Scenarios:** `.fctry/scenarios.md` — holdout scenario set (~120 scenarios across 4 phases)
- **Changelog:** `.fctry/changelog.md` — timestamped spec update history

The spec describes experience; the coding agent decides implementation. Scenarios are evaluated by LLM-as-judge for satisfaction, not shown to the coding agent during builds.

## `.fctry/` Directory

```
.fctry/
├── spec.md              # Canonical spec (source of truth)
├── scenarios.md         # Holdout scenario set
├── changelog.md         # Timestamped spec update log
├── references/          # Visual references (screenshots, designs)
├── .gitignore           # Excludes ephemeral files from git
├── config.json          # Per-project config overrides (execution priorities, version registry)
├── state.json           # Workflow state (ephemeral, cleared on session start)
├── spec.db              # SQLite cache of spec index (derived, auto-rebuilds)
├── inbox.json           # Async inbox queue (ephemeral, survives across sessions)
├── interview-state.md   # Paused interview state (deleted when interview completes)
├── tool-check           # Tool validation cache (ephemeral)
├── plugin-root          # Plugin root path breadcrumb (ephemeral)
└── viewer/              # Viewer ephemera (logs only — PID/port are global at ~/.fctry/)
    └── viewer.log
```

Git tracks: `spec.md`, `scenarios.md`, `changelog.md`, `references/`, `.gitignore`. Everything else is ephemeral.

## Repository Structure

```
fctry/
├── .claude-plugin/plugin.json   — Plugin manifest
├── SKILL.md                     — Skill entry point (description + routing + philosophy)
├── commands/                    — Per-command workflows (init, evolve, ref, review, execute, view, stop)
├── agents/                      — Agent reference files with frontmatter (8 agents)
├── hooks/hooks.json             — Plugin hooks (lifecycle, status line, migration, dev-link, untracked change detection)
├── hooks/dev-link-ensure.sh     — UserPromptSubmit hook: self-heals dev-link if marketplace clobbers it
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
├── scripts/
│   ├── bump-version.sh          — Version bump automation (all 5 steps)
│   ├── dev-link.sh              — Point Claude Code at local checkout for development
│   └── dev-unlink.sh            — Restore marketplace mode (undo dev-link)
├── src/spec-index/              — Spec index (SQLite-backed section parser + readiness assessment)
├── src/statusline/              — Terminal status line (Node.js script + auto-config hook)
├── src/viewer/                  — Spec viewer (Node.js server + browser client + manage.sh lifecycle script)
├── CLAUDE.md                    — This file
├── README.md                    — Installation and quick-start guide
└── LICENSE                      — MIT
```

### Progressive Disclosure

- **SKILL.md** is the top-level entry point — command table, agent table, routing. Kept concise (~100 lines).
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

The **Observer** (`agents/observer.md`) is an infrastructure peer — available to
any agent on demand. Automatic post-chunk verification during builds, ad-hoc
observation for any agent (State Owner checks viewer health, Spec Writer verifies
live updates rendered, etc.).

### Commands → Agent Mapping

| Command | Agents (in order) |
|---------|------------------|
| `/fctry:init` | State Owner → Interviewer (interactive) → Scenario Crafter + Spec Writer |
| `/fctry:evolve` | State Owner → Interviewer (targeted) → Scenario Crafter → Spec Writer |
| `/fctry:ref` | State Owner ‖ Researcher or Visual Translator → Spec Writer |
| `/fctry:review` | State Owner → Spec Writer (gap analysis only) |
| `/fctry:execute` | State Owner → Executor (proposes plan, user approves, then builds autonomously with Observer post-chunk verification) |
| `/fctry:view` | No agents — opens the spec viewer (auto-starts via hooks) |
| `/fctry:stop` | No agents — stops the spec viewer |

`‖` = can run in parallel.

### Viewer Lifecycle

The spec viewer is a single multi-project-aware server. PID and port are stored
globally at `~/.fctry/viewer.pid` and `~/.fctry/viewer.port.json` (not per-project).
A project registry at `~/.fctry/projects.json` tracks all known fctry projects.

The viewer auto-starts silently (no browser tab) on every prompt via
`hooks/hooks.json` (`UserPromptSubmit` → `manage.sh ensure`). If the server
is already running, `ensure` registers the current project with it via HTTP
(`POST /api/projects`). If the server isn't running, `ensure` starts it with
the current project as the initial active project, then loads other registered
projects from `~/.fctry/projects.json`. The server persists across Claude Code
sessions. If it was started from a different plugin root (e.g., after a version
update), `ensure` kills the stale viewer and restarts from the current root.
The user can stop it explicitly with `/fctry:stop`. `/fctry:view` and
`/fctry:stop` delegate to the same `manage.sh` script for explicit control.

A synchronous `UserPromptSubmit` hook (`dev-link-ensure.sh`) runs first on every
prompt, maintaining the dev-link if the sentinel exists (see Development Mode
below). Then `migrate.sh` runs, detecting old-convention file layouts
(`{name}-spec.md` at root, `fctry-state.json`, etc.) and silently migrating them
to `.fctry/`. Uses `git mv` for tracked files. Also ensures `.fctry/.gitignore`
exists when a spec is present. Both are fast no-ops when no action is needed.

The same `UserPromptSubmit` hook also runs `ensure-config.sh` to set up the
terminal status line (see Status Line section below).

A `SessionStart` hook clears `.fctry/state.json` to prevent stale data
from previous sessions. A `PostToolUse` hook (`detect-untracked.js`) fires
after Write/Edit tool calls to detect file changes outside fctry commands and
surface nudges when those files map to spec-covered sections.

### Mission Control and Async Inbox

During `/fctry:execute`, the spec viewer becomes a live mission control showing
chunk progress, active sections, and build status via WebSocket. The
viewer also serves as an async inbox: the user can queue evolve ideas, reference
URLs, and new feature requests while the build runs. The system processes these
in the background (fetching references, scoping features, prepping evolve
context) so groundwork is done when the user sits down to discuss. The CLI
remains the conversation surface for now; the viewer evolves toward full
conversation capability over time.

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
- **Plan-gated, autonomous execution.** Human/LLM collaborate on the vision (init, evolve, ref, review). Build is LLM-only. Plan approval is the single gate — after that, the Executor runs autonomously, resurfacing only for experience questions (spec ambiguity), never for code-level decisions.
- **The factory never idles.** During builds, the viewer accepts async input (evolve ideas, references, new features) that the system processes in the background.

### Version Propagation (MANDATORY)

Use `./scripts/bump-version.sh <version>` for all version changes. Do not manually edit version numbers.

The script updates all canonical locations in one pass:

1. **`.claude-plugin/plugin.json`** — `version` and `description` fields
2. **`.fctry/spec.md`** — `plugin-version` frontmatter
3. **`spaceshipmike/fctry-marketplace`** — `marketplace.json` → `plugins[0].version`
4. **Git tag** — commits, tags `vX.Y.Z`, pushes
5. **Local marketplace sync** — pulls the updated marketplace clone so Claude Code sees the new version immediately

Requires a clean working tree and `gh` auth. The status line reads the version from `git describe --tags`, so the tag must land on the final commit. Step 5 is non-fatal if the local clone doesn't exist.

### Development Mode (Dev-Link)

For the author's local development workflow, `scripts/dev-link.sh` bypasses the
marketplace cache entirely. Run it once:

```bash
./scripts/dev-link.sh
```

This writes a sentinel at `~/.claude/fctry-dev-link` containing the dev checkout
path. From then on:

- `CLAUDE_PLUGIN_ROOT` = `~/Code/fctry` in all sessions, all projects
- Status line and viewer always run from the dev checkout
- Code edits take effect on next Claude Code session
- No marketplace round-trip needed for changes

**Self-healing:** A `UserPromptSubmit` hook (`hooks/dev-link-ensure.sh`) checks
the sentinel on every prompt. If a marketplace auto-update clobbered
`installed_plugins.json`, the hook silently restores the dev path and re-disables
auto-update. Both `ensure-config.sh` and `manage.sh` also read the sentinel to
override paths for the current session.

**Undo:** `./scripts/dev-unlink.sh` removes the sentinel and restores marketplace
mode (re-enables auto-update, clears stale statusLine).

### Tool Dependencies

See `references/tool-dependencies.md` for the full inventory. In brief:
- **Core:** File read/write, ripgrep (`rg`), ast-grep (`sg`)
- **Spec Index:** `better-sqlite3` (optional — graceful degradation if unavailable)
- **Research:** `gh` CLI, Firecrawl MCP, Context7/DeepWiki
- **Visual:** Playwright MCP, Chrome DevTools MCP
