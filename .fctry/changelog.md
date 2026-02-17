## 2026-02-17T23:00:00Z — /fctry:evolve (version registry — declarative versioning with propagation targets, relationship rules, auto-discovery)
- Spec version: 2.8 → 2.9
- `#core-flow` (2.2): Init Step 3 now seeds version registry in `.fctry/config.json` (external 0.1.0, spec 0.1). Init summary shows registry creation
- `#evolve-flow` (2.4): Spec version auto-increments via registry on every evolve, propagation targets updated
- `#execute-flow` (2.7): Added Step 1.75 — version target auto-discovery on first execute. Version tagging subsection rewritten to reference registry, propagation targets shown in version suggestions
- `#details` (2.11): Commit and version format now references registry as source of truth, propagation is atomic
- `#status-line` (2.12): Version display now reads from version registry
- `#capabilities` (3.1): "Version tracking and git integration" → "Version registry and propagation"
- `#entities` (3.2): Replaced "Version history" with "Version registry" — declarative model with version types, propagation targets, increment rules, relationship rules
- `#rules` (3.3): Replaced "Version increment rules" with five paragraphs: registry rules, external increment rules, internal increment rules, relationship rules, propagation targets
- Appendix A: Added "Why a version registry" rationale
- Appendix B: Added 5 glossary entries (Version registry, External version, Internal version, Propagation target, Version relationship rule)
- Scenarios: Updated 3 existing versioning scenarios to reference registry. Added 5 new scenarios: Version Registry Seeded at Init, Version Target Auto-Discovery at First Execute, Version Propagation Updates All Declared Targets Atomically, Spec Version Auto-Increments on Evolve via Registry, Internal Version Change Triggers External Version Suggestion via Relationship Rules

## 2026-02-17T21:00:00Z — /fctry:evolve (pull back parallelism — match spec to reality, let parallel execution emerge later)
- Spec version: 2.7 → 2.8
- `#what-this-is` (1.2): "autonomous parallel builds" → "autonomous builds"
- `#success-looks-like` (1.4): Removed concurrent/git-strategy specifics from execute example
- `#execute-flow` (2.7): Rewrote build plan example — removed worktrees, feature branches, token tradeoff. Execution strategy now shows dependency order, failure approach, and per-chunk commits. Priority descriptions updated (speed = aggressive retries, not more parallelism). Autonomous execution step now says "in dependency order" instead of "concurrent/sequential". Chunk execution performance expectation now says "sequentially in dependency order" instead of "bounded by longest dependency chain"
- `#status-line` (2.12): Removed parallel execution display (concurrent chunk indicators, multiple active sections). Simplified to single active chunk with retry indicator
- `#capabilities` (3.1): "Autonomous parallel execution" → "Autonomous execution". Build mission control and progress feedback descriptions simplified to single-chunk active state
- `#entities` (3.2): Execution priorities entity updated — removed parallelization/git-branching references, now guides failure behavior, retry strategy, verification depth, context management. Build plan entity updated similarly
- `#agent-decides` (6.4): Collapsed parallelization mechanism, git branching, and token efficiency entries into single "Execution strategy" entry. Acknowledges current sequential reality, notes parallelism may emerge as tooling matures
- `#convergence-strategy` (6.2): "Autonomous parallel execution" → "Autonomous execution" in convergence phase
- Appendix A: "parallelization strategy" → "execution strategy" in plan-level approval rationale
- Appendix B: Replaced "Parallelization strategy" and "Git strategy" glossary entries with single "Execution strategy" entry. Updated Chunk and Mission control definitions to remove concurrency language
- Scenarios: Updated 8 scenarios — CLAUDE.md Enrichment (removed parallelization/git strategy), Autonomous Build (removed concurrent chunk references), Build Plan Shows Execution Order (renamed from parallelization), Build Plan Shaped by Priorities (worktree examples → retry/verification examples), First-Time Priority Prompt (parallel-running-at-once → aggressive retries), Clean Git History (removed parallel execution references), Mission Control (concurrent → sequential active chunk), Mission Control Calm (concurrent → sequential chunks)

## 2026-02-17T18:00:00Z — /fctry:evolve (context lifecycle management — context-aware execution, compact instructions, context health observability)
- Spec version: 2.6 → 2.7
- `#core-flow` (2.2): Init Step 3 now creates `# Compact Instructions` section in CLAUDE.md — evergreen preservation rules for spec paths, build checkpoint state, scenario satisfaction, active section and workflow step
- `#execute-flow` (2.7): Added context-aware execution — Executor treats context as a finite resource, structures work for natural context boundaries, calls out unusual context strategy in build plan (visible only when interesting)
- `#spec-viewer` (2.9): Added context health indicator to mission control (isolation mode, usage, last checkpoint). Added context lifecycle events to activity feed (checkpointed, new context, compacted)
- `#capabilities` (3.1): Added context lifecycle management capability
- `#entities` (3.2): CLAUDE.md evolved from two-layer to three-layer document — added compact instructions layer between evergreen and build layers
- `#rules` (3.3): Added context-as-managed-resource rule and compact instructions stability rule. Context fidelity rule preserved
- `#agent-decides` (6.4): Added context isolation between chunks as an implementation decision guided by execution priorities
- `#observability` (6.3): Added context compaction frequency and build quality consistency signals
- Scenarios: Added 3 new scenarios — Context Never Degrades Build Quality Across Chunks, Context Health Visible in Mission Control, Compact Instructions Preserve Build State Through Compaction

## 2026-02-17T13:30:00Z — /fctry:evolve spec-viewer (multi-project viewer — single server, project registry, project sidebar)
- Spec version: 2.5 → 2.6
- `#spec-viewer` (2.9): Evolved from per-project servers to single multi-project-aware server. Added global project registry (`~/.fctry/projects.json`), auto-registration on init and prompt, project sidebar with quick status, full context switching between projects. Server persists across sessions, self-heals on crash. Viewer state (PID, port) moved from per-project `.fctry/viewer/` to global `~/.fctry/`
- `#capabilities` (3.1): Updated viewer capability for multi-project awareness
- `#entities` (3.2): Added project registry entity. Updated spec viewer state entity for global PID/port
- `#error-handling` (2.10): Added viewer server crash self-healing row
- `#convergence-strategy` (6.2): Added multi-project viewer as convergence phase. Added viewer-as-control-plane (embedded terminal) as long-term vision
- Appendix A: Updated auto-start rationale for persistent multi-project server. Added rationale for single server vs per-project
- Appendix B: Added project registry, project sidebar glossary entries
- Scenarios: Updated "Auto-Starting Spec Viewer" for multi-project model. Added 4 new scenarios — Switching Between Projects, Auto-Registration, Server Self-Heals After Crash, Project Sidebar Shows Quick Status

## 2026-02-17T08:00:00Z — /fctry:evolve (Observer agent — build self-verification, lifecycle events, verification events)
- Spec version: 2.4 → 2.5
- Preamble and `#what-this-is` (1.2): Updated agent count from seven to eight, added Observer description
- `#execute-flow` (2.7): Added Observer post-chunk verification to build loop, Executor lifecycle event emission (chunk-started, chunk-completed, chunk-failed, chunk-retrying, section-started, section-completed, scenario-evaluated)
- `#spec-viewer` (2.9): Viewer is now bidirectional — humans observe through browser, agents observe through API and browser automation. Activity feed receives both lifecycle and verification events
- `#capabilities` (3.1): Added build self-verification capability — agents observe their own outputs through the Observer
- `#entities` (3.2): Added verification verdict, observation report, verification audit trail entities. Updated viewer state entity for agent discovery via port.json
- `#rules` (3.3): Added Observer non-blocking verification rule — verification failure is information, not a stop signal. Transient failures trigger single retry
- `#external-connections` (3.4): Added Rodney (headless Chrome), Surf (computed style inspection), Showboat (executable markdown verification) as Observer connections
- `#observability` (6.3): Added agent self-observability signals — verification pass rate, degradation frequency, average checks per chunk, screenshot capture success rate
- `#agent-decides` (6.4): Added Observer verification depth to agent authority — checks per chunk, browser vs API inspection, thoroughness guided by execution priorities
- Glossary: Added Observer, verification verdict, observation report, verification audit trail, build event, lifecycle event, verification event

## 2026-02-17T03:00:00Z — /fctry:evolve (attractor reference — build checkpoint/resume, visual dependency graph, convergence milestones, build coordination, context fidelity, priority-driven failure behavior)
- Spec version: 2.3 → 2.4
- `#execute-flow` (2.7): Added build checkpointing and resume (auto-detect incomplete builds, skip completed chunks, detect spec changes for completed sections), convergence milestones (non-blocking phase boundary reports), build coordination (Executor monitors stuck chunks, rebalances work), context fidelity between chunks (autonomous decision guided by priorities), execution-priority-driven failure behavior (speed-first = best-effort, reliability-first = fail-fast)
- `#spec-viewer` (2.9): Visual dependency graph in mission control — build plan rendered as interactive DAG with lifecycle-state animations on chunk nodes and dependency edges
- `#entities` (3.2): Build run entity changed from ephemeral to persistent (survives sessions via state.json). Added build checkpoint entity (completed chunks, outcomes, dependency graph position, spec version tracking)
- `#rules` (3.3): Added build checkpoint persistence rule, convergence milestone rule, context fidelity rule, updated chunk failure handling with priority-driven behavior
- `#capabilities` (3.1): Added build checkpoint and resume, build coordination, convergence milestones, visual dependency graph capabilities
- `#error-handling` (2.10): Added incomplete build and spec-changed-for-completed-chunk error rows
- `#agent-decides` (6.4): Added context fidelity and build coordination strategy to agent authority
- `#observability` (6.3): Added build resume frequency, convergence milestone interaction, build coordination effectiveness signals. Removed stale pacing choice distribution signal
- `#scope` (4.1), `#satisfaction-definition` (6.1), `#convergence-strategy` (6.2), `#details` (2.11): Fixed stale pacing references from old per-chunk approval model
- `#inspirations` (5.1): Added Attractor as inspiration (DOT-based pipelines, checkpoint/resume, context fidelity, manager loop, goal gates, join/error policies)
- `#experience-references` (5.2): Added Attractor reference with six adopted patterns
- Glossary: Added build checkpoint, build resume, context fidelity, build coordination, convergence milestone, visual dependency graph
- Scenarios: Added "Build Resume After Session Death", "Convergence Milestones During Build", "Visual Dependency Graph in Mission Control". Updated "Autonomous Build Execution" (checkpoint mention) and "Build Plan Shows Parallelization" (DAG visualization in viewer)

## 2026-02-17T02:00:00Z — /fctry:ref leash (event streaming, drift severity, spec suggestions, build log export)
- Spec version: 2.2 → 2.3
- `#spec-viewer` (2.9): Event history on reconnect (ring buffer + bulk-send), activity feed filtering by event type, external tool call visibility (MCP invocations as typed events), build log export
- `#review-flow` (2.6): Drift severity assessment — proportional response to divergence magnitude, related drifts grouped by section, observe-evolve-build progression made explicit
- `#rules` (3.3): Drift severity rule — scope/magnitude-based assessment, proportional nudging (low-severity in review only, high-severity surfaces proactively)
- `#capabilities` (3.1): Spec update suggestions from observed changes — concrete proposals instead of generic drift flags, grouped by section
- `#observability` (6.3): External tool call frequency and build log export usage signals
- `#inspirations` (5.1): Added Leash as inspiration (event streaming, policy suggestion engine, observe-suggest-enforce model)
- `#experience-references` (5.2): Added Leash reference with seven adopted patterns

## 2026-02-17T01:00:00Z — /fctry:ref cxdb (mission control enrichments — chunk lifecycle, retry visibility, typed events, build run)
- Spec version: 2.1 → 2.2
- `#spec-viewer` (2.9): Enriched mission control — explicit chunk lifecycle states (planned/active/retrying/completed/failed), retry attempt visibility, connection status indicator, typed activity events replacing generic file-change notifications
- `#execute-flow` (2.7): Added retry transparency to experience report — significant retries surfaced in experience language
- `#status-line` (2.12): Added retry indicator `(rN)` to chunk progress format and symbol legend
- `#capabilities` (3.1): Updated build mission control capability for chunk lifecycle states, typed events, connection status, retry visibility
- `#entities` (3.2): Added build run entity (run ID, chunk tree with lifecycle states and retry counts, overall status, duration)
- `#observability` (6.3): Added chunk retry rate and build run duration signals
- `#inspirations` (5.1): Added CXDB as inspiration (Turn DAG model, agentic context store patterns)
- `#experience-references` (5.2): Added first entry — CXDB reference with four adopted patterns
- Appendix B: Added "Build run" and "Chunk lifecycle" glossary terms

## 2026-02-17T00:00:00Z — /fctry:evolve execute-flow (execution priorities — speed, token efficiency, reliability)
- Spec version: 2.0 → 2.1
- `#execute-flow` (2.7): Added Step 1.5 — execution priority check. User ranks speed, token efficiency, and reliability before first build plan. Stored in `~/.fctry/config.json` (global) with per-project overrides in `.fctry/config.json`. Build plan example updated to show priorities shaping the execution strategy.
- `#entities` (3.2): Added execution priorities entity (ranked ordering, global/per-project storage, resolution order). Updated build plan entity to reference priority-shaped execution strategy.
- `#rules` (3.3): Added execution priority resolution rule (per-project → global → prompt user, complete replacement not merge).
- `#agent-decides` (6.4): Updated parallelization, git branching, and token efficiency items to reference priorities as a guiding constraint. Added priorities to the agent constraint list.
- `#observability` (6.3): Added execution priority distribution metric.
- `#directory-structure` (4.3): Added `config.json` to `.fctry/` directory layout.
- `agents/executor.md`: Added step 3 (priority resolution) to workflow, updated build plan format with Execution Strategy section showing priorities, source, and token tradeoff.
- `scenarios.md`: Added 3 new scenarios — First-Time Execution Priority Prompt, Build Plan Shaped by Execution Priorities, Per-Project Priority Override.

## 2026-02-16T23:30:00Z — /fctry:evolve spec-viewer (three-column layout — tabbed left rail, persistent inbox right rail)
- Spec version: 1.9 → 2.0
- `#spec-viewer` (2.9): Replaced mutually-exclusive toggle panels with three-column layout — left rail with ToC/History tabs (dot badge on unseen changes), persistent collapsible inbox right rail, mobile hamburger + slide-in overlays at < 768px
- `#details` (2.11): Updated keyboard shortcuts — `1`/`2` for left-rail tabs, `]` for inbox toggle (replaces old `h`/`i` panel toggles)

## 2026-02-16T22:05:00Z — /fctry:review (alignment audit — plugin version, inbox storage, directory listings)
- Spec version: 1.9 (no bump — corrections only)
- Frontmatter: Updated `plugin-version` from 0.6.1 to 0.7.0 to match plugin.json and git tag
- `#entities` (3.2): Fixed inbox queue storage location — was `.fctry/state.json` as `inboxQueue`, now `.fctry/inbox.json`
- `#directory-structure` (4.3): Added `inbox.json` to directory layout diagram and `.gitignore` template
- CLAUDE.md: Added `inbox.json` to `.fctry/` directory guide

## 2026-02-16T20:30:00Z — /fctry:evolve execute-flow (autonomous parallel execution, viewer mission control, async inbox)
- Spec version: 1.8 → 1.9
- `#what-this-is` (1.2): Updated system description for autonomous parallel builds, mission control, and async inbox
- `#design-principles` (1.3): Evolved "Approval-gated execution" to "Plan-gated, autonomous execution"
- `#success-looks-like` (1.4): Updated execute scenario — autonomous build, mission control, experience report
- `#evolve-flow` (2.4): Added async evolve via viewer inbox
- `#ref-flow` (2.5): Added async references via viewer inbox
- `#execute-flow` (2.7): Major rewrite — plan approval is the only gate, autonomous parallel execution, experience report replaces satisfaction scorecard, agent resurfaces only for experience questions
- `#spec-viewer` (2.9): Added mission control during builds and async inbox (evolve ideas, references, new features)
- `#error-handling` (2.10): Updated execute error rows for autonomous model, added spec ambiguity row
- `#details` (2.11): Updated progress feedback for ambient (not interruptive) updates, added post-build experience report format, updated commit format for autonomous git ops
- `#status-line` (2.12): Added parallel execution display (concurrent chunk progress, multiple active sections)
- `#capabilities` (3.1): Evolved paced execution to autonomous parallel execution, added async viewer inbox and build mission control
- `#entities` (3.2): Updated build plan for parallelization and git strategy, added viewer inbox queue entity
- `#rules` (3.3): Evolved approval gate to plan approval rule, updated chunk failure handling for autonomous model, updated commit timing for autonomous git ops
- `#performance` (3.5): Added parallel execution throughput and async inbox processing expectations
- `#hard-constraints` (4.4): Reframed approval-gated to plan-gated execution
- `#convergence-strategy` (6.2): Added autonomous parallel execution and viewer mission control/async inbox as convergence layers
- `#agent-decides` (6.4): Added parallelization mechanism, git branching/merge strategy, token efficiency, async inbox processing
- Appendix A: Added rationale for autonomous execution, experience-only resurfacing, and async viewer inbox; updated approval gates rationale
- Appendix B: Added autonomous execution, experience report, experience question, mission control, async inbox, parallelization strategy, git strategy; updated chunk and pacing options definitions

## 2026-02-16T14:10:00Z — /fctry:review (alignment audit)
- Spec version: 1.7 → 1.8
- `#details` (2.11): Updated changelog format example to match actual ISO 8601 format with command context and spec version transitions
- CLAUDE.md: Fixed scenario count (42 → 63), updated SKILL.md line count (~80 → ~100)

## 2026-02-16T12:25:00Z — /fctry:evolve status-line (symbol-based layout, derived next step, context calibration)
- Spec version: 1.6 → 1.7
- `#status-line` (2.12): Rewrote section — symbol prefixes (⎇ ◐ ✓ ◆ △ ▸ →), app version next to project name, symbol legend table, derived next step priority chain, context % calibration explanation, readiness-as-fraction rationale, unevaluated scenario display
- Scenarios: Updated "Status Line Shows Readiness Summary" for symbol format (◆ 35/42), added "Status Line Derives Next Step When Idle", updated "Process Boundary Is Always Clear" for △ symbol

## 2026-02-16T12:10:00Z — /fctry:review (alignment audit)
- `#status-line` (2.12): Updated Row 1/Row 2 descriptions to match actual implementation (context % in Row 1, scenarios/readiness/untracked/derived-next-step in Row 2)
- CLAUDE.md: Added Factory Context section (spec/scenario/changelog paths) and `.fctry/` directory guide
- Fixed manage.sh variable shadowing bug in start_server() (log went to plugin source dir instead of .fctry/viewer/)
- Fixed server.js health endpoint (undefined specFileName → specPath)
- Migrated spec files from root to .fctry/ (fctry-spec.md → .fctry/spec.md, etc.)
- Cleaned up stale legacy files (.fctry/fctry-state.json, .fctry/viewer.pid, .fctry/viewer-port.json)

## 2026-02-15T20:00:00Z — /fctry:evolve (CLAUDE.md best practices and evergreen instructions)
- Spec version: 1.5 → 1.6
- `#core-flow` (2.2): Init Step 3 now creates CLAUDE.md with evergreen factory context (factory contract, command quick-ref, .fctry/ guide, workflow guidance, scenario explanation)
- `#review-flow` (2.6): CLAUDE.md audit now covers two layers independently — evergreen (always) and build (after execute)
- `#execute-flow` (2.7): Executor enriches existing CLAUDE.md with build layer rather than creating from scratch
- `#entities` (3.2): Expanded CLAUDE.md entity to describe two-layer model (evergreen at init, build at execute)
- `#rules` (3.3): Expanded project instructions currency rule for two-layer audit

## 2026-02-15T18:50:00Z — /fctry:evolve (directory structure quality pass)
- Spec version: 1.4 → 1.5
- `#agent-decides` (6.4): Fixed stale cross-reference — "section 4.3" → "section 4.4" for hard constraints (renumbered when 4.3 was inserted)
- `#agent-decides` (6.4): Fixed stale path — `fctry-scenarios.md` → `.fctry/scenarios.md`
- `#directory-structure` (4.3): Expanded migration to describe `git mv` for history preservation, partial `.fctry/` edge case handling, and migration failure behavior
- `#directory-structure` (4.3): Clarified git tracking paragraph — explicitly lists `.gitignore` as tracked
- `#error-handling` (2.10): Added migration failure row to error table

## 2026-02-15T00:00:00Z — /fctry:evolve (directory structure convention)
- Spec version: 1.3 → 1.4
- `#core-flow` (2.2): Updated file paths to `.fctry/spec.md` and `.fctry/scenarios.md`
- `#evolve-flow` (2.4): Updated example output to show `.fctry/spec.md`
- `#ref-flow` (2.5): Updated reference storage path to `.fctry/references/`
- `#review-flow` (2.6): Updated gap analysis example to show `.fctry/spec.md` and CLAUDE.md drift example
- `#spec-viewer` (2.9): Updated to check for `.fctry/spec.md` and store state in `.fctry/viewer/`
- `#details` (2.11): Updated changelog path to `.fctry/changelog.md`
- `#entities` (3.2): Updated all entity storage locations to `.fctry/` paths; fixed interview state path inconsistency (was `.fctry-interview-state.json`, now `.fctry/interview-state.md`)
- `#platform` (4.2): Updated storage description to reflect `.fctry/` directory convention
- `#directory-structure` (4.3): **New section** — describes `.fctry/` layout, git tracking via `.gitignore`, and automatic migration from old layout
- `#hard-constraints` (4.4): Renumbered from 4.3
- `#anti-patterns` (4.5): Renumbered from 4.4

## 2026-02-13T20:00:00Z — /fctry:evolve (process guardrails, spec index, section readiness)
- Spec version: 1.2 → 1.3
- `#what-this-is` (1.2): Added workflow enforcement, structured spec index, and section readiness to system description
- `#design-principles` (1.3): Added "Process-aware, not just process-documented" principle
- `#review-flow` (2.6): Added section readiness summary and untracked changes section to gap analysis
- `#execute-flow` (2.7): Added readiness filtering — Executor only builds ready sections
- `#error-handling` (2.10): Added workflow enforcement errors, untracked change nudge, and readiness gating errors
- `#status-line` (2.12): Added section readiness summary and untracked changes counter
- `#capabilities` (3.1): Added workflow enforcement, structured spec index, automatic section readiness, and untracked change detection
- `#entities` (3.2): Added workflow state, spec index (SQLite), section readiness index, and untracked changes
- `#rules` (3.3): Upgraded agent sequencing from documentation to enforcement; added section readiness gating rule
- `#external-connections` (3.4): Added SQLite spec index as external connection
- `#platform` (4.2): Updated storage row to include SQLite cache
- `#observability` (6.3): Added workflow enforcement, untracked change, readiness distribution, and index rebuild signals
- `#decision-rationale` (Appendix A): Added rationale for workflow enforcement, SQLite as cache, and untracked change detection
- `#glossary` (Appendix B): Added workflow enforcement, spec index, section readiness, untracked changes
- Scenarios: Added Phase 3 with 12 scenarios (6 critical, 3 edge case, 3 experience quality)

## 2026-02-12T00:00:00Z — /fctry:execute (spec alignment for v0.4.0)
- Frontmatter: Updated `plugin-version` from 0.3.1 to 0.4.0
- `#spec-viewer` (2.9): Rewrote to describe auto-start via plugin hooks, `/fctry:view` as browser-open command, auto-stop on session end
- `#decision-rationale` (Appendix A): Replaced explicit-start rationale with auto-start rationale
- Scenario updated: "Auto-Starting Spec Viewer" — silent auto-start, no browser pop-up

## 2026-02-11T23:15:00Z — /fctry:evolve review-flow
- `#review-flow` (2.6): Added Step 3 — CLAUDE.md audit after spec drift is settled
- `#entities` (3.2): Added project instructions (CLAUDE.md) as tracked entity
- `#rules` (3.3): Added project instructions currency rule
- Scenario added: "CLAUDE.md Audit During Review"

## 2026-02-11T22:30:00Z — /fctry:review
- `#what-this-is` (1.2): Updated command count from five to seven, added view/stop
- `#spec-viewer` (2.9): Replaced auto-start with explicit /fctry:view, clarified changelog fallback behavior
- `#scope` (4.1): Updated command list to include view and stop
- `#convergence-strategy` (6.2): Removed Phase 2 label from viewer, updated to reflect shipped state
- `#decision-rationale` (Appendix A): Replaced Phase 2 rationale with explicit-start rationale

## 2026-02-11T09:00:00Z — /fctry:init
- Initial spec created (all sections)
