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

Interviews can span multiple sessions — type `save and pause` at any point and resume later with `/fctry:init --resume`. The system saves your progress with explicit uncertainty markers so nothing is silently resolved while you're away.

When ready to build:

```
> /fctry:execute
```

The Executor proposes a build plan. You approve once. It builds autonomously.

## How It Works

### Agents

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
2. The Executor classifies the plan's **phase type** (capability, hardening, refactor, integration, or polish) based on the readiness distribution, then proposes a build plan — chunked, ordered by convergence strategy, with dependency tracking
3. You approve the plan (the only gate)
4. The Executor builds autonomously — handling code failures, retries, and rearchitecting decisions silently
5. Each successful chunk gets a commit (format: `Implement [feature] (satisfies scenario '[name]')`) and auto-tagged patch version
6. The Observer verifies each chunk's output against the spec
7. Build lifecycle events stream to the viewer's mission control in real time
8. At completion, you get an experience report describing what you can now do — not a satisfaction scorecard

The user is never interrupted for technical problems. Only experience-level questions (spec ambiguity about what the user sees or does) resurface for input.

A structured **build trace** is generated after every build — a complete record of what happened, which chunks succeeded or failed, context decisions, proof blocks (re-runnable verification commands), and lessons recorded. When the Executor suggests a minor or major version bump at plan completion, it generates a **release summary** with a headline (experience shift, not code change), highlights (concrete things to try), deltas (affected spec sections), and migration steps — feeding the changelog so version history tells a story of experience shifts. The **changelog** is append-only, with ISO 8601 timestamps, the command that triggered the change, and affected sections by alias and number.

## Spec Lifecycle

### Section Readiness

Every spec section has a readiness value that tracks its state relative to the codebase. Readiness is assessed automatically by the State Owner with priority-driven depth — "Now" sections get granular claim-level analysis, "Next" sections get standard comparison, "Later" sections get coarse assessment.

| Value | Meaning |
|-------|---------|
| `draft` | Section has fewer than 30 words — too thin to build from |
| `undocumented` | Code exists but the spec doesn't describe it |
| `ready-to-build` | Spec describes it but no code exists yet |
| `aligned` | Spec and code match |
| `ready-to-execute` | Aligned with no open issues |
| `satisfied` | Scenarios passing |

Two skip filters accelerate reviews: a **freshness skip** (changelog newer than last code commit means definitely `ready-to-build`) and a **semantic stability skip** (embedding similarity above threshold carries forward prior readiness). Sections that `undocumented` block `/fctry:execute` — you must run `/fctry:evolve` first to capture the existing behavior.

### CLAUDE.md Integration

`/fctry:init` creates a `CLAUDE.md` at your project root with a three-layer system that gives Claude Code the context it needs to respect the factory model in any future session:

- **Evergreen layer** — project identity, factory contract (spec and scenario paths, agent authority, holdout rule), command quick-reference, `.fctry/` directory guide, workflow guidance, scenario explanation. Created at init, rarely changes.
- **Compact instructions layer** — tells Claude what to preserve during auto-compaction: spec path, scenario path, build checkpoint state, scenario scores, active section and workflow step, current build plan. Static and stable.
- **Build layer** — current build plan with chunk completion tracking, architecture notes discovered during implementation, convergence order, versioning rules. Added at each `/fctry:execute`, replaced with updated state as the build progresses.

The CLAUDE.md is audited during `/fctry:review` — drifted items from any layer are presented as numbered recommendations.

### Section Targeting

Every spec section has both a stable alias (e.g., `#core-flow`) and a number (e.g., `2.2`). You can target specific sections in commands:

```
/fctry:evolve core-flow
/fctry:evolve 2.2
/fctry:ref 2.3 https://example.com
/fctry:execute #status-line
```

When a section is targeted, the State Owner scopes its briefing to that section's dependency neighborhood, domain agents focus their analysis, and the Spec Writer updates only the targeted section plus any consequential sections.

If the argument doesn't match any section alias or number, it's treated as a natural language change description — no special syntax required.

## Build System

### Execution Priorities

The first time you run `/fctry:execute`, the system asks you to rank three priorities. The ranking shapes how every build behaves:

| Priority | Effect |
|----------|--------|
| **Speed** | Aggressive retries, structured summaries between chunks, quick Observer checks |
| **Token efficiency** | Conservative retries (once then move on), fresh context starts, balanced verification |
| **Reliability** | Full transcript between chunks, thorough Observer verification with screenshots and vision |

Four preset rankings are offered, or you can set a custom order. Your choice is stored globally and reused for all projects without re-asking. The ranking also shapes context fidelity (how much context flows between chunks) and failure behavior (best-effort vs. fail-fast vs. conservative retry).

### Build Resume

Builds survive session death. After each chunk completes, the full build state checkpoints to disk — which chunks completed, their outcomes, the approved plan, and position in the dependency graph. If Claude Code closes mid-build:

```
> /fctry:execute
Found incomplete build (3/7 chunks done, started 2 hours ago).
(1) Resume from Chunk 4
(2) Start fresh
(3) Cancel
```

Resuming skips completed chunks entirely. If the spec changed for a section covered by a completed chunk, the system flags it and asks whether to rebuild or keep.

A **context budget gate** prevents quality degradation: when context usage exceeds ~75%, the Executor completes the current chunk cleanly, writes a full checkpoint, and pauses — leaving room for Observer verification. Run `/fctry:execute` again to resume from the next chunk with fresh context.

### Build Verification

The Observer automatically verifies each chunk's output after completion. Verification uses whatever tools are available — from full browser automation with screenshots and vision analysis down to file-only inspection — and degrades gracefully when tools are missing.

Verification failure is information, not a stop signal. The Observer reports; the Executor decides whether to retry, continue, or flag. Transient failures (network timeout, browser not ready) get a single automatic retry.

**Build traces** are generated after every build with a complete record: chunk summary table with statuses and Observer verdicts, context decisions, experience report, and **proof blocks** — re-runnable command + expected output pairs that confirm reproducibility.

**Diagram verification** follows a closed feedback loop: Render → Observe → Compare → Feedback → Re-render → Verify, capped at 2 rounds per diagram.

### Build Learnings

The system learns from every build. Lessons are recorded when a chunk fails and requires rearchitecting, a retry with a modified approach succeeds, a tech-stack pattern is discovered, or a user answers an experience question.

Lessons follow a **maturation lifecycle**: new entries start as `candidate` (confidence 1). The State Owner confirms or contradicts them over subsequent sessions — at confidence 3 they're promoted to `active`, at confidence 0 they're pruned. Only active lessons influence builds.

**Error-triggered recall** makes lessons reactive: before each retry, the Executor searches lessons by section alias and error keyword, surfacing relevant guidance at the moment of need rather than loading everything at session start.

When 10+ active lessons accumulate across 3+ sections, the State Owner **distills** them into cross-cutting insights that rank above individual lessons. Lessons with codebase-agnostic value (e.g., "Playwright MCP times out on hydration-heavy pages") are written to global memory and shared across projects.

## Cross-Session Memory

The system maintains a global memory store across all projects with four entry types:

| Type | What It Captures | Token Budget |
|------|-----------------|-------------|
| **Conversation digest** | Summary of a completed init or evolve conversation | ~300 tokens |
| **Decision record** | A specific choice made during a session (framework, approach, preference) | ~150 tokens |
| **Cross-project lesson** | Codebase-agnostic pattern learned during a build | ~200 tokens |
| **User preference** | Observed behavioral preference (naming style, communication preference) | ~50 tokens |

Entries are ranked by a **fused multi-signal algorithm**: section alias match (50%), recency (30%), type priority (20%), with a diversity penalty to ensure cross-section representation. ~2000 tokens are injected into State Owner briefings per scan.

**Decision record proposals**: when a matching decision record exists, agents propose the remembered choice as the default rather than asking open-endedly — `"(1) React (your previous preference), (2) Vue, (3) Svelte"`.

**Working memory injection**: at session start, the State Owner assembles a "what you were doing" snapshot from build progress, recent changelog entries, pending inbox items, and active section focus — injected into the briefing without persisting to the memory store.

Cross-project lessons require 2 of 3 structural match signals (section alias match, tech stack overlap, dependency pattern) before surfacing on another project.

## Spec Viewer

A live browser dashboard that serves as the decision surface for all your fctry projects. Auto-starts silently on every `/fctry:` command.

- **Project dashboard** — all registered projects as cards with readiness summary, build status, inbox count, and recommended next command
- **Live spec rendering** — markdown rendered directly in the browser (zero build step), updates in real-time via WebSocket as agents work
- **Change history** — vertical timeline of spec changes with inline diffs
- **Keyboard shortcuts** — `?` for help, `Cmd+K` for fuzzy search, `1`/`2`/`3`/`4` to switch tabs, `d` to toggle diagram view, `]` to toggle the right rail
- **Dark mode** — respects system preference, toggleable, flash-free on load
- **Auto-generated diagrams** — entity relationships, user flows, agent pipelines, state machines, and dependency DAGs rendered via Mermaid.js

### Mission Control

During builds, the viewer transforms into a live mission control:

- **Dependency DAG** — chunks visualized as a graph with color-coded states (pending, active with pulse animation, completed, failed, blocked)
- **Activity feed** — typed lifecycle events stream in real time (chunk started, Observer verdict, retry, context checkpoint, experience question)
- **Context health indicator** — shows current context window usage so you know when a budget-gate pause is coming

### Async Inbox

The viewer accepts input at any time, even during builds. Three item types:

| Type | What Happens |
|------|-------------|
| **Evolve idea** | Scoped against the current spec, prepped for your next `/fctry:evolve` |
| **Reference URL** | Fetched and analyzed in the background within 60 seconds |
| **New feature request** | Assessed for spec impact, ready to discuss |

Items show processing status (pending → processing → processed → error). When you sit down to discuss, the groundwork is already done.

## Terminal Status Line

Auto-configures itself on first run. Requires a [Nerd Font](https://www.nerdfonts.com/) for icons (Material Design Icons from the Supplementary PUA-A range).

**Row 1 — Project identity:**
```
fctry 0.28.0 │ 󰘬 main │ 󰈙 3.46 │ 󱎖 42%
```
Project name + version, git branch, spec version, context usage (green < 70%, yellow 70-89%, red 90%+).

**Row 2 — Activity and progress** (segments appear only when they have data):
```
execute │ 󰐊 3+1/8 │ #core-flow (2.2) │ 󰄬 12/20 │ 󰕥 5/9 │ 󰀦 2
```
Active command, chunk progress (completed+active/total, retry count), active section, scenario score, section readiness, untracked change count. When idle, a derived next-step suggestion appears based on project state (no spec → init, untracked changes → evolve, ready-to-build → execute).

## Token Economy

Agents are constrained to produce lean, efficient output:

- **Reference-first evidence** — agents cite evidence by reference (file path + line range, section alias), never paste raw content. The viewer hydrates references into full detail on demand.
- **Delta-first output** — changes described as diffs, not full reprints. A spec update shows what changed, not the full section.
- **No duplicate context** — each entity (project identity, spec version, repo state) described once in its canonical location. Subsequent references use IDs or shorthand.
- **Output depth tiering** — agent outputs scale with task scope. Patch-tier operations get minimal output; architecture-tier operations get comprehensive analysis with expandable detail.

## Structured Interchange

Every agent emits a structured interchange document alongside its conversational CLI output. The terminal stays conversational (what the user reads); the viewer renders the interchange as interactive UI (finding cards, action checklists, expandable evidence). Two audiences, one analysis pass.

<details>
<summary>Interchange schema and principles</summary>

Three structural principles govern all interchange documents:

1. **Typed sections** — findings, actions, and release summaries use consistent schemas across all commands. The viewer renders them with a single set of UI components regardless of which command produced them.
2. **Cross-referenced IDs** — every finding (`FND-001`), action (`ACT-003`), and proposal has a stable ID. Items reference each other so the viewer can draw connections (this finding motivates that action).
3. **Expandable by default** — interchange includes both a summary (always visible) and detail (visible on expand). The terminal shows the summary; the viewer shows the summary with expand affordances for the detail.

The interchange emits schema (field names, types, relationships) without payload bodies. The viewer hydrates from source files on demand, keeping interchange lightweight for WebSocket transmission.

</details>

<details>
<summary>Hooks and automation</summary>

## Hooks and Automation

Eight hooks fire automatically to maintain the factory model:

| Event | Hook | What It Does |
|-------|------|-------------|
| Session start | State clear | Clears stale workflow state from previous sessions |
| Every prompt | Dev-link ensure | Self-heals the development symlink if a marketplace update clobbered it |
| Every prompt | Migration | Detects old file layouts and silently migrates to `.fctry/` directory structure |
| Every prompt | Viewer ensure | Auto-starts the viewer server or registers the current project with it |
| Every prompt | Status line config | Writes the terminal status line setting if missing |
| Every prompt | Version validation | Validates version consistency across plugin manifest, spec, and config |
| File write (outside fctry) | Drift detection | Maps changed files to spec sections, surfaces a nudge asking if you want to update the spec first |
| Build stop | Anti-rationalization | Detects premature completion signals during autonomous builds and forces continuation |

All hooks are fast no-ops when no action is needed. The viewer hook is the only async one — it doesn't block the prompt.

The **anti-rationalization hook** is a structural enforcement layer during `/fctry:execute`. When the Executor signals completion, the hook evaluates whether the stop is genuine (plan complete, context budget reached) or premature (rationalized early exit). Premature stops are blocked with a continuation directive.

The **drift detection hook** fires on every Write/Edit tool call. It checks whether the changed file maps to a spec-covered section and, if so, surfaces: `"This file is covered by #status-line (2.12). Want to update the spec first? (1) Run /fctry:evolve status-line, (2) Continue — I'll reconcile later"`. Choosing (2) increments the untracked changes counter visible in the status line.

</details>

<details>
<summary>Configuration</summary>

## Configuration

### Version Registry

All version management flows through the registry in `.fctry/config.json`. Two default version tracks are seeded at init:

| Track | Starts At | Auto-Increment | Manual Increment |
|-------|-----------|----------------|-----------------|
| **External** (project version) | 0.1.0 | Patch per successful chunk | Minor suggested at plan completion, major at experience milestones |
| **Spec** (document version) | 0.1 | Minor on every evolve | — |

Each version type declares propagation targets — specific files and fields that update atomically when the version changes. The Executor auto-discovers additional targets during the first build by scanning for version strings.

Version relationships govern how changes ripple: a major spec version change suggests an external minor bump. Projects can add custom relationships during evolve or execute.

### Execution Priority Config

Execution priorities are stored globally at `~/.fctry/config.json` and can be overridden per-project in `.fctry/config.json`. The ranking is set once on first `/fctry:execute` and reused without re-asking.

### Credential Safety

On first run, fctry recommends deny rules for sensitive paths (`~/.ssh/**`, `~/.aws/**`, `~/.gnupg/**`, `~/.config/gh/**`, `~/.git-credentials`, `~/.docker/config.json`, `~/Library/Keychains/**`). This is especially important because fctry targets non-coders who may not understand credential exposure risks. You can accept all, select which to add, or skip.

</details>

## Philosophy

- **Experience language only.** Specs describe what users see, do, and feel. Never databases, APIs, or code patterns.
- **The agent decides implementation.** The coding agent has full authority over tech choices, architecture, and data model. Section 6.4 of every spec explicitly grants this.
- **Scenarios are holdout sets.** Stored separately from the spec, evaluated by LLM-as-judge, measuring satisfaction not pass/fail. The coding agent never sees scenarios during development.
- **Plan approval is the only gate.** Human collaborates on vision (init, evolve, ref, review). Build is machine-only. Once the plan is approved, the system executes autonomously.
- **The factory never idles.** During builds, the viewer accepts async input that the system processes in the background.
- **Prescriptive errors.** Every error tells the agent or user exactly what to do next — installation commands, closest-match suggestions, numbered recovery options. The error is the recovery plan.

## Tool Dependencies

Core tools (file read/write, ripgrep, ast-grep) are required. Research tools (gh CLI, Firecrawl MCP, Context7/DeepWiki) and visual tools (Playwright MCP, Chrome DevTools MCP) are needed for full capability. See [references/tool-dependencies.md](references/tool-dependencies.md).

<details>
<summary>Observer verification stack</summary>

The Observer uses whatever tools are available and degrades gracefully through four tiers:

| Tier | Tools | Capability |
|------|-------|-----------|
| **System-wide** | Peekaboo (macOS screen capture + GUI automation), Rodney (headless Chrome), Surf (computed styles), Showboat (executable verification docs), curl, Claude vision | Full verification of any surface — browser, native apps, terminal, system dialogs |
| **Full** | Rodney, Surf, Showboat, curl, Claude vision | Browser + API + file verification |
| **Reduced** | curl, file reads | API + file verification only |
| **Minimal** | File reads | File verification only |

Tool discovery runs on each invocation and the operating mode is reported at the start of every verdict.

Three observation depths: **summary** (~100 tokens, quick health check), **structural** (~500 tokens, DOM hierarchy and accessibility tree), **full** (~2000+ tokens, complete DOM, computed styles, screenshot with vision interpretation).

</details>

<details>
<summary>Codebase indexing tools</summary>

The Executor is aware of codebase indexing tools (srclight, grepai) when available. These provide semantic code search and structural understanding beyond what ripgrep and ast-grep offer, enabling more accurate impact analysis before each chunk.

</details>

<details>
<summary>For plugin authors</summary>

## For Plugin Authors

### Development Mode

For local development, bypass the marketplace cache entirely:

```bash
./scripts/dev-link.sh    # Point Claude Code at your local checkout
./scripts/dev-unlink.sh  # Restore marketplace mode
```

Dev-link writes a sentinel at `~/.claude/fctry-dev-link`. A self-healing hook checks it on every prompt — if a marketplace auto-update clobbers the plugin path, the hook silently restores it.

### Version Bumping

All version changes go through the bump script:

```bash
./scripts/bump-version.sh 0.29.0
```

This updates all canonical locations in one pass: `.claude-plugin/plugin.json` (version + description), `.fctry/spec.md` (plugin-version frontmatter), `.fctry/config.json` (version registry), marketplace repo, git tag, and local marketplace sync. Requires a clean working tree and `gh` auth.

### Repository Structure

```
fctry/
├── .claude-plugin/plugin.json   — Plugin manifest
├── SKILL.md                     — Skill entry point (routing + philosophy)
├── commands/                    — Per-command workflows (loaded on demand)
├── agents/                      — Agent reference files (loaded on demand)
├── hooks/                       — Lifecycle hooks (hooks.json + scripts)
├── references/                  — Shared concepts, templates, error conventions
├── scripts/                     — Dev-link, version bump, unlink
├── src/memory/                  — Cross-session memory (fused ranking)
├── src/spec-index/              — Spec index (SQLite-backed section parser)
├── src/statusline/              — Terminal status line (Node.js)
├── src/viewer/                  — Spec viewer (Node.js server + browser client)
├── .claude/                     — Project-level Claude Code settings + skills
├── CLAUDE.md                    — Project instructions for Claude Code
└── README.md                    — This file
```

Progressive disclosure: SKILL.md is the concise entry point (~100 lines). Command and agent files carry detailed workflows and are loaded only when that command or agent runs. References hold shared concepts loaded by reference to avoid duplication.

</details>

## License

MIT
