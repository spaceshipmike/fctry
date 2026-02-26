## 2026-02-27T05:00:00Z — /fctry:ref Zep (temporal supersession, fused ranking with diversity, per-topic digests)
- Spec version: 3.38 → 3.39
- `#capabilities` (3.1): Refined conversation digest scope from per-session to per-topic-shift — long sessions covering multiple sections now produce one digest per topic boundary, enabling targeted recall without all-or-nothing session inclusion
- `#entities` (3.2): Added temporal metadata to decision supersession — `superseded_by` reference + `superseded_at` timestamp for navigable decision chains. Replaced greedy sequential injection algorithm with fused multi-signal ranked selection (weighted sum across alias match, recency, type priority) with diversity penalty preventing single-section dominance
- `#rules` (3.3): Updated rule 1 (digest writing at topic boundaries, not command completion), rule 3 (supersession with temporal metadata), rule 7 (fused ranking with diversity replaces greedy sequential)
- `#inspirations` (5.1): Added Zep — temporal knowledge graph memory service, bi-temporal facts, RRF ranking, MMR diversity, sliding window ingestion, LLM-judged deduplication
- `#experience-references` (5.2): Added Zep reference entry — 3 patterns adopted (temporal supersession metadata, fused multi-signal ranking with diversity, per-topic digest scope), 5 patterns noted/skipped
- Source: https://github.com/getzep/zep (Graphiti temporal knowledge graph engine)

## 2026-02-26T04:20:00Z — /fctry:ref ATM (visual agent team management, deployment primer, pipeline chaining)
- Spec version: 3.38 (no increment — confirmatory ref, no behavior changes)
- `#inspirations` (5.1): Added ATM — visual org-chart canvas for Claude Code agent teams, deployment primer compilation, pipeline chaining, file ownership coordination, sibling team awareness
- `#experience-references` (5.2): Added ATM reference entry — 0 patterns adopted, 5 patterns noted (all confirmatory of existing fctry approaches), 3 patterns skipped. Two-way viewer editing insight queued as evolve idea for #spec-viewer
- Inbox: Added evolve idea for two-way spec editing viewer (inspired by ATM canvas-as-configuration pattern reframed as canvas-as-spec-editor)

## 2026-02-26T03:15:00Z — /fctry:evolve (knowmarks memory comparison — token budgets, supersession, consolidation)
- Spec version: 3.37 → 3.38
- `#entities` (3.2): Updated memory store entity with token ceilings per type (conversation digests ~300, decision records ~150, cross-project lessons ~200, user preferences ~50), supersession tracking for decision records, total injection budget (~2000 tokens), greedy selection algorithm (alias match → recency → type priority)
- `#rules` (3.3): Expanded memory lifecycle from 5 rules to 8 rules — added: (3) decision supersession (new decisions covering same pattern mark older ones superseded, preserved for audit but excluded from recall), (6) type-differentiated staleness (cross-project lessons never auto-pruned, conversation digests pruned on section rewrite, decision records pruned on supersession, preferences pruned on MEMORY.md sync), (7) token-budgeted injection (~2000 token ceiling per State Owner scan, greedy selection by alias match + recency + type), (8) consolidation pass (5+ entries about same section type across 3+ projects → distilled into one cross-project lesson)
- Source: Knowmarks research — 7 external memory systems analyzed (macrodata, MARM-Systems, beads, claude-mem-lite, Vibetape, sharedcontext, aurora), 5 improvements adopted

## 2026-02-26T02:30:00Z — /fctry:evolve (cross-session memory system)
- Spec version: 3.36 → 3.37
- `#capabilities` (3.1): Added cross-session memory system — four types of knowledge (conversation digests, decision records, cross-project lessons, user preferences) in a global store at ~/.fctry/memory.md, integrated with Claude Code's MEMORY.md, viewable and editable in viewer
- `#entities` (3.2): Added memory store entity — global file with typed entries (conversation digests, decision records, cross-project lessons, user preference signals), each with timestamp and source context
- `#rules` (3.3): Added memory lifecycle rules — digest-on-completion, decision-on-choice, structural-match-required for cross-project, preference-sync to MEMORY.md after 3+ consistent observations, pruning follows lessons model
- `#evolve-flow` (2.4): Interviewer now reads conversation digests before starting targeted interviews — references past discussions and decisions
- `#multi-session` (2.3): Extended memory beyond single paused interviews — system remembers past completed conversations across sessions
- `#success-looks-like` (1.4): Made "co-founder with perfect memory" concrete — backed by actual conversation, decision, and cross-project memory
- `#details` (2.11): Added memory visibility paragraph — viewer memory panel with browsing, editing, and deletion of memory entries
- `#directory-structure` (4.3): Added global directory description (~/.fctry/) with memory.md listed alongside existing global files
- `#capabilities` (3.1): Updated self-improvement loop to reference memory system as its foundation
- Scenarios: Added Cross-Session Memory feature (6 scenarios) to System Quality category

## 2026-02-25T21:30:00Z — /fctry:ref GitNexus (staleness tracking, self-guiding responses, dependency graph, fail-open)
- Spec version: 3.35 → 3.36
- `#capabilities` (3.1): Enriched structured spec index with quantified staleness tracking — index records which spec version it was built from, query responses include prescriptive recovery hints when stale
- `#entities` (3.2): Updated spec index entity with staleness awareness — records source spec version, exposes staleness metric, prescriptive hints in query responses
- `#execute-flow` (2.7): Added Step 1.9 — precomputed section dependency graph (cross-references + scenario overlap computed at index time, cached in SQLite, consumed by Executor for chunk boundaries and dependency edges). Added self-guiding tool responses — spec-index queries and Observer verdicts append next-step hints to results
- `#rules` (3.3): Added fail-open principle for infrastructure subsystems — spec index, status line, viewer, Observer, hooks all degrade gracefully rather than blocking the core workflow
- `#inspirations` (5.1): Added GitNexus — knowledge-graph code intelligence, staleness tracking, self-guiding responses, precomputed structural intelligence, fail-open principle
- `#experience-references` (5.2): Added GitNexus reference entry — 4 patterns adopted (staleness tracking, self-guiding responses, precomputed dependency graph, fail-open infrastructure), 4 patterns noted (validates existing patterns)

## 2026-02-25T20:10:00Z — /fctry:ref dispatch (background-worker execution, context dump, cognitive load)
- Spec version: 3.34 → 3.35
- `#inspirations` (5.1): Added Dispatch — background-worker execution model (fresh context windows per chunk), checklist-as-state pattern, filesystem IPC with atomic writes and timeout fallback (context dump before exit), multi-model routing per task, "cognitive load transfer" framing
- `#experience-references` (5.2): Added Dispatch reference entry — 3 patterns adopted (reasoning context dump on interruption, background-worker execution as future direction, cognitive load framing), 2 patterns noted (checklist-as-state, multi-model routing)
- `#execute-flow` (2.7): Enriched build checkpointing with reasoning context dump on interruption (decisions, rationale, unresolved considerations — not just structural state). Added "Background-worker execution" future direction paragraph — spawning fresh context windows per chunk as alternative to single-session context management
- `#error-handling` (2.10): Updated "Incomplete build found" row — checkpoint now includes reasoning context dump so resumed chunks start with prior attempt's decisions and rationale

## 2026-02-23T00:20:00Z — /fctry:evolve (action-oriented review vocabulary)
- Spec version: 3.33 → 3.34
- `#review-flow` (2.6): Replaced Drift/Unbuilt headings with action-oriented "Decisions Needed" and "Ready to Build" — gap analysis organized by what the user should do, not by classification. Ready-to-build items collapsed to count + alias list instead of individual entries.
- `#entities` (3.2): Renamed readiness values — `spec-ahead` → `ready-to-build`, `needs-spec-update` → `undocumented`. Vocabulary now matches gap analysis headings across all surfaces (viewer pills, review output, status line).
- `#rules` (3.3): Updated readiness gating, phase type inference, and stats-extraction to use new vocabulary. Internal State Owner classification (Code Ahead / Spec Ahead / Diverged / Unknown) kept as-is — gap analysis is the translation layer.
- `#execute-flow` (2.7): Updated build plan filtering to use `ready-to-build` and `undocumented`.
- `#spec-viewer` (2.9): Updated readiness pill examples and filtering descriptions.
- `#details` (2.11): Updated error table for `undocumented` readiness.
- `#status-line` (2.12): Updated next-step derivation to reference `ready-to-build`.
- `#observability` (6.3): Updated readiness distribution description.
- `#glossary`: Updated section readiness definition with new values and cross-surface consistency note.
- **Scenarios:** Rewrote 2 Spec Review scenarios (action-oriented headings, collapsed ready-to-build format). Updated 8 Section Readiness scenarios to use new vocabulary throughout.

## 2026-02-22T23:15:00Z — /fctry:evolve capabilities (build learnings mechanism)
- Spec version: 3.32 → 3.33
- `#capabilities` (3.1): Refined cross-session build learnings — 4 write triggers (failure-recovery, experience question answers, rearchitecting decisions, workaround discoveries), section alias tagging for deterministic matching, 50-entry compaction threshold, git-tracked at `.fctry/lessons.md`
- `#entities` (3.2): Added "Build lesson" entity — structured entry with section alias tag, trigger type, lesson text, timestamp, and optional chunk reference
- `#rules` (3.3): Added lesson management rules — side-effect writes (no dedicated step), mandatory alias tagging, changelog-derived staleness pruning, context-based dedup
- `#execute-flow` (2.7): Integrated lesson recording into autonomous build loop — Executor writes lessons as side effects during chunk execution
- `#directory-structure` (4.3): Added `lessons.md` to `.fctry/` directory tree (git-tracked)
- `#details` (2.11): Added build learnings visibility — silent in CLI, viewer shows lessons panel with per-section lesson count indicators, filterable by section
- **Scenarios:** Added "Build Learnings" feature (6 scenarios) under System Quality: lesson recording after failure-recovery, State Owner injection into briefings, cross-session persistence, stale lesson pruning, experience question capture, viewer lessons panel

## 2026-02-22T22:35:00Z — /fctry:ref (complexity navigation and agent selection)
- Spec version: 3.31 → 3.32
- `#rules` (3.3): Added complexity-aware chunk verification — Executor varies Observer verification depth per chunk based on structural signals (section count, dependency depth, line-count delta)
- `#rules` (3.3): Added anti-pattern: keyword-based complexity heuristics — fctry prefers structural signals over fragile keyword matching for all complexity assessment
- `#capabilities` (3.1): Added cross-session build learnings — Executor records codebase-specific lessons in `.fctry/lessons.md`, State Owner consults them at scan time for institutional learning across sessions
- `#inspirations` (5.1): Added "My actual real Claude Code setup that 2x my results" Reddit post — hooks-over-CLAUDE.md persistence, cross-session reflections, earned autonomy framing, keyword scoring rejected as anti-pattern

## 2026-02-22T21:20:00Z — /fctry:evolve (plugin upgrade experience)
- Spec version: 3.30 → 3.31
- `#first-run` (2.1): Added plugin version upgrade experience — silent cumulative upgrades on first command after plugin update, compact inline summary, format version tracking
- `#entities` (3.2): Added "Project format version" entity — `formatVersion` in config.json anchoring all upgrade logic
- `#rules` (3.3): Added upgrade safety invariants — additive only, cumulative single pass, never lose data
- `#directory-structure` (4.3): Added .gitignore evolution — new entries appended on upgrade without disturbing existing entries
- `#details` (2.11): Added upgrade communication — compact CLI summary, viewer badge, status line indicator across all three surfaces
- `#status-line` (2.12): Added `↑` symbol for upgrade indicator
- **Scenarios:** Added "Plugin Upgrades" feature (8 scenarios) under System Quality: silent upgrade, cumulative skip-version handling, format version tracking, .gitignore evolution, frontmatter additions, config schema evolution, viewer indicators, data safety

## 2026-02-22T20:15:00Z — /fctry:ref openbrowser-ai (token-efficient browser verification)
- Spec version: 3.29 → 3.30
- `#inspirations` (5.1): Added OpenBrowser — single `execute_code` MCP tool with persistent namespace, benchmarked at 3-6x fewer tokens than Playwright/Chrome DevTools MCP for browser tasks. Code-execution architecture returns only extracted data vs. full page snapshots.
- `#experience-references` (5.2): Added OpenBrowser adoption summary — two patterns adopted: token-efficient browser verification for Observer, persistent namespace for multi-step verification workflows. One pattern noted: bundled MCP server as potential approach for shipping browser tools within fctry plugin.
- `#external-connections` (3.4): Added OpenBrowser MCP as an alternative browser tool for Observer verification, with graceful degradation to Rodney/Surf or API-only.
- `#capabilities` (3.1): Added "Token-efficient browser verification" capability describing the code-execution architecture and persistent namespace pattern.

## 2026-02-22T19:30:00Z — /fctry:evolve scenarios (feature-based reorganization)
- Spec version: 3.28 → 3.29
- **Scenarios restructured:** Replaced phase-based organization (Phase 1-4 with per-phase tiers) with feature-based organization. 151 scenarios now grouped into 19 named features across 4 categories (Core Workflow, Build, Viewer, System Quality). Each feature has an I-statement describing the experience ("I describe my vision and get a complete spec"), declared dependencies on other features, and scenarios grouped by tier (Critical, Edge Cases, Polish) within the feature. A feature index table at the top provides a scannable overview with scenario counts and dependency chains.
- `#entities` (3.2): Updated Scenarios entity description to reflect feature-based organization with categories, I-statements, and dependency declarations.
- `agents/scenario-crafter.md`: Updated scenario file structure template, process steps, and "show what changed" format to reference features instead of flat category lists.
- `CLAUDE.md`: Updated scenario count and organization description.
- `.fctry/architecture.md`: Updated scenario count and organization description.
- **Rationale:** Phase-based organization (Phase 1-4) grouped scenarios by build wave, which was too coarse for prioritization. A single phase like "Spec Viewer" contained 8+ distinct experiences (kanban, diagrams, dark mode, search, etc.) that couldn't be individually prioritized or tracked. Features are the natural unit of "what do I care about" — each feature is a coherent experience the user wants to have, and review/execute can report and target at the feature level.

## 2026-02-22T09:10:00Z — /fctry:ref skillserver + Agent Skills specification (open mode)
- Spec version: 3.27 → 3.28
- `#inspirations` (5.1): Added skillserver and the Agent Skills specification — centralized skills database implementing the open standard (Dec 2025) adopted by Claude Code, Codex, Copilot, Cursor, and 20+ platforms. Notes structural alignment with fctry's existing plugin layout and dual-interface validation.
- `#experience-references` (5.2): Added Agent Skills specification as experience reference documenting fctry's conformance to the SKILL.md-based directory standard. Maps progressive disclosure tiers to fctry's file structure.
- `#external-connections` (3.4): Added ecosystem positioning note — fctry is distributed as an Agent Skill conforming to the Agent Skills specification, with skill management infrastructure (skillserver) as the emerging discovery layer.

## 2026-02-21T18:15:00Z — /fctry:evolve spec-viewer (card detail panel, inbox card consistency)
- Spec version: 3.26 → 3.27
- `#spec-viewer` (2.9): Inbox cards maintain uniform compact height via line clamping regardless of content length. Inbox cards persist across Sections/Scenarios toggle — they are project-level, not view-mode-specific. Added card detail panel: clicking a card's body opens a slide-out panel from the right edge showing full content (section details, untruncated inbox text, scenario info, claim text). Header click retains drill-down behavior. Both interactions coexist on every card at every level.

## 2026-02-21T17:40:00Z — /fctry:evolve (rename Triage column to Inbox)
- Spec version: 3.25 → 3.26
- `#spec-viewer` (2.9): Renamed the "Triage" kanban column to "Inbox" across spec, scenarios, and code. The column serves as the unsorted intake funnel — "Inbox" better communicates that purpose than "Triage" (which implies critical/urgent assessment).
- Scenarios: Renamed "Inbox Items Become Triage Cards" → "Inbox Items Become Inbox Cards". Updated all column references.

## 2026-02-21T17:10:00Z — /fctry:evolve (kanban layout: inbox at top, free scroll)
- Spec version: 3.24 → 3.25
- `#spec-viewer` (2.9): Quick-add input now sits above the kanban board (not below) so it's visible on landing without scrolling. Kanban columns grow to their natural height with the page scrolling freely — no fixed viewport confinement or internal column scroll.
- Scenarios: Updated "Kanban as Project Landing Page" to include quick-add position and free-scroll behavior as satisfaction criteria.

## 2026-02-21T00:30:00Z — /fctry:evolve spec-viewer (kanban interface, auto-diagramming, dark mode, visual polish)
- Spec version: 3.23 → 3.24
- `#spec-viewer` (2.9): Replaced static project dashboard with recursive kanban board (projects → sections/scenarios → claims). Five priority columns (Triage/Now/Next/Later/Satisfied). Section vs. scenario toggle at level 2. Inbox items become triage cards. Added automatic spec diagramming (5 types: entity relationships, user flows, agent pipeline, convergence phases, section dependency neighborhoods) via Mermaid.js with per-section toggle, `d` shortcut, and global toggle. Added dark mode (Radix Slate Dark tokens, system detection + manual toggle, Mermaid re-render on theme switch). Added visual polish (skeleton loading, syntax highlighting, fuzzy search, styled toasts, uncapped activity feed). Right rail evolves to slim quick-add input.
- `#capabilities` (3.1): Replaced "Live spec viewer with project dashboard" with "Recursive kanban interface" and "Automatic spec diagramming" capabilities. Updated "Live spec viewer" to include dark mode and syntax highlighting.
- `#entities` (3.2): Added "Section priority" entity (kanban positions in config.json). Added "Diagram definition" entity (cached Mermaid sources in spec-index DB). Updated "Section readiness index" to include `partial` readiness value with claim count.
- `#rules` (3.3): Added "Priority-driven assessment depth" rule (Now=claim-level, Next=standard, Later=coarse). Added "Partial readiness value" rule. Updated readiness gating to include `partial`.
- `#details` (2.11): Added viewer keyboard shortcuts paragraph including `d` for diagram toggle.
- `#error-handling` (2.10): Added Mermaid render failure and dark mode flash error rows.
- `#convergence-strategy` (6.2): Replaced "Viewer as decision surface" phase with "Kanban as primary interface" and "Automatic diagramming and visual polish" phases.
- Synopsis: Updated medium, readme, tech-stack (added Mermaid.js), patterns (added recursive kanban), goals.
- Scenarios: Revised "Dashboard Cards Show Readiness Breakdown" → "Kanban as Project Landing Page". Revised "Beautiful and Readable Rendering" to include dark mode, syntax highlighting, skeleton loading. Added 14 new scenarios: Recursive Kanban Drill-Down, Section vs. Scenario Toggle, Drag-and-Drop Prioritization Drives Build Order, Priority-Driven Assessment Depth, Inbox Items Become Triage Cards, Automatic Diagram for Entity Relationships, Automatic Diagram for User Flows, Global Diagram Toggle, Section Dependency Neighborhood Diagram, Dark Mode Follows System Preference, Dark Mode Toggle Re-renders Diagrams, Fuzzy Search Across Spec Content, Kanban Cards Show Visual Progress, Spec Status Visual Consistency.
- Hook fix: Made ensure-config.sh synchronous (removed `async: true` from hooks.json) — reduces UserPromptSubmit notifications from 2 to 1.

## 2026-02-20T20:00:00Z — /fctry:evolve (remove copy icons from viewer)
- Spec version: 3.21 → 3.22
- `#spec-viewer` (2.9): Removed section-level clipboard copy button from main content area. Removed "copyable chip" language from dashboard recommendation commands. Copy icons didn't work reliably and cluttered the interface.
- `#capabilities` (3.1): Removed "copyable chip" from dashboard description.
- `#convergence-strategy` (6.2): Removed "copyable chip" from decision surface description.
- `#inspirations` (5.1): Removed clipboard copy pattern credit from codebase-digest entry.
- `#experience-references` (5.2): Removed clipboard copy from batch ref adoption list (6 patterns → 5).
- Code: Removed `addSectionCopyButtons()`, `extractSectionMarkdown()`, `rawSpecMarkdown` from app.js. Removed dashboard chip copy handler and copy icon. Removed `.section-copy-btn` and `.copy-icon` CSS.

## 2026-02-20T19:30:00Z — /fctry:review (internal consistency fix)
- Spec version: 3.21 (no increment — consistency fix within existing version)
- `#rules` (3.3): Context fidelity between chunks paragraph synced with `#agent-decides` (6.4) vocabulary — now uses the four named fidelity modes (full transcript, trimmed transcript, structured summary, fresh start) and maps execution priorities to them consistently.

## 2026-02-20T19:00:00Z — /fctry:ref claude-code-cmv + rtk (context fidelity, token economy taxonomy, retrospective efficiency)
- Spec version: 3.20 → 3.21
- Sources: https://github.com/CosmoNaught/claude-code-cmv (session versioning + selective trimming), https://github.com/rtk-ai/rtk (CLI token proxy + filtering taxonomy)
- `#agent-decides` (6.4): Added "trimmed transcript" as fourth context fidelity option — full conversation with tool result bodies stubbed, preserving reasoning chain while reclaiming ~50% of token budget. Positioned between full transcript and structured summary.
- `#entities` (3.2): Context fidelity entity updated to include trimmed transcript option.
- `#rules` (3.3): Token economy output rules expanded with explicit strategy taxonomy — stats-extraction for briefings, structure-only for interchange, failure-focus for verdicts. Makes existing three rules more actionable with per-context examples.
- `#observability` (6.3): Added retrospective context efficiency in experience reports — after builds, the report includes context health summary (compaction count, sections driving pressure, fidelity adequacy). Retrospective, not real-time.
- `#inspirations` (5.1): Added claude-code-cmv and rtk entries.
- `#experience-references` (5.2): Added claude-code-cmv entry (3 adopted, 2 noted) and rtk entry (2 adopted, 3 noted).

## 2026-02-20T18:00:00Z — /fctry:review (spec alignment corrections)
- Spec version: 3.19 → 3.20
- `#spec-viewer` (2.9): Arrow key navigation description corrected from "change history timeline" to "sections in the ToC" (code only implements TOC navigation). Change history click behavior corrected from "shows a diff using Spec Markdown-style annotations" to "expands to show the changelog description" (annotation infrastructure exists but isn't wired to history). Section search shortcut updated from `Ctrl+K` to `Cmd/Ctrl+K` (code already handles both).
- `#directory-structure` (4.3): `.fctry/.gitignore` updated to exclude `build-trace-*.md` and `architecture.md` (spec describes both as ephemeral but gitignore was missing the patterns).

## 2026-02-20T16:00:00Z — /fctry:ref claude-devtools (semantic steps, compaction events, context attribution, event alerting, tool cards)
- Spec version: 3.18 → 3.19
- Source: https://github.com/matt1398/claude-devtools — retrospective session analysis tool for Claude Code
- `#spec-viewer` (2.9): Semantic step taxonomy for interchange card tool calls (file_read, code_edit, command_exec, search, agent_spawn, external_tool with type-appropriate rendering). Compaction boundary as typed activity feed event. Named event alerting (retry threshold, verification failure, compaction pinned with accent). Per-chunk context attribution breakdown in context health indicator (categorized split on hover). Tool-specific card rendering in interchange.
- `#entities` (3.2): Interchange document enriched with semantic step types and waterfall-style shape for DAG visualization
- `#convergence-strategy` (6.2): Future direction noted — incremental append-only build trace parsing for live streaming
- `#inspirations` (5.1): Added claude-devtools entry
- `#experience-references` (5.2): Added claude-devtools entry with 5 adopted + 2 noted patterns

## 2026-02-20T01:20:00Z — /fctry:execute (executor alignment, CLAUDE.md, interchange rendering)
- Spec version: 3.18 (no increment — agent instruction files and viewer code)
- Phase type: Capability — three chunks adding net-new behaviors
- `agents/executor.md`: Added phase type inference (Capability/Hardening/Refactor/Integration/Polish), release summary 4-part format (headline/highlights/deltas/migration), convergence-to-version-arc framing, aligned prose budget with spec output depth tiering
- `CLAUDE.md`: Added structured interchange emission, prescriptive error messages, token economy as key invariants. Added build-trace and architecture.md to directory guide. Added validate-versions.js to repo structure.
- `src/viewer/client/app.js`: Added structured interchange rendering — WebSocket handler for `currentInterchange` in viewer-state, findings as severity-tagged expandable cards (drift/error/info/ok/muted), actions as checklist in right rail with priority indicators, release summary panel, expand/collapse on all items
- `src/viewer/client/index.html`: Added interchange-findings panel (above spec content) and interchange-actions panel (in right rail above inbox)
- `src/viewer/client/style.css`: Full interchange visual system — findings cards with severity-coded left borders, action checklist with priority highlights, release summary with accent border, expand/collapse transitions

## 2026-02-20T00:30:00Z — /fctry:ref cord (chunk context, experience questions, build traces, behavioral testing)
- Spec version: 3.17 → 3.18
- Source: https://github.com/kimjune01/cord — coordination protocol for trees of Claude Code agents
- `#execute-flow` (2.7): Added chunk context model (isolated vs context-carrying) and experience questions as named paused build state
- `#error-handling` (2.10): Updated spec ambiguity row — paused state with pulsing indicator, blocked chunk identification
- `#entities` (3.2): Added build trace entity (per-build structured artifact) and experience question entity (formal paused state)
- `#rules` (3.3): Added prescriptive error messages rule — errors tell the agent exactly what to do next
- `#observability` (6.3): Added agent behavioral compliance signal — tracking constraint adherence under pressure
- `#inspirations` (5.1): Added cord entry with spawn/fork, experience questions, build trace, prescriptive errors, behavioral testing
- `#experience-references` (5.2): Added cord entry with 5 adopted patterns and section mappings

## 2026-02-19T22:15:00Z — /fctry:execute (token economy + interchange emission into agent files)
- Spec version: 3.17 (no increment — agent instruction files only)
- `agents/state-owner.md`: Added token economy rules (reference-first, delta-first, no duplicate context) and interchange emission schema (findings + actions)
- `agents/executor.md`: Added token economy rules and interchange emission schemas (build plan + experience report)
- `agents/spec-writer.md`: Added token economy rules and interchange emission schemas (gap analysis + diff summary)
- `agents/observer.md`: Added token economy rules and interchange emission schema (verification findings + summary)
- `agents/interviewer.md`: Added delta-first + no-duplicate-context rules and lightweight interchange emission (phase transitions only)
- `agents/researcher.md`: Added token economy rules and interchange emission schema (findings + actions with applicability)

## 2026-02-19T21:45:00Z — /fctry:review (coherence fixes — interchange scope, prose budget dedup)
- Spec version: 3.17 (no increment — fixes only)
- `#capabilities` (3.1): Softened interchange scope — viewer renders interchange for command output, continues rendering markdown for spec content itself
- `#rules` (3.3): Folded prose budget into output depth tiering rule, removed duplicate sub-rule from token economy block

## 2026-02-19T21:15:00Z — /fctry:evolve (token economy output rules, dual-output structured interchange)
- Spec version: 3.16 → 3.17
- `#capabilities` (3.1): Added structured agent interchange capability entry
- `#entities` (3.2): Added agent interchange document entity
- `#rules` (3.3): Added token economy output rules block (reference-first evidence, delta-first output, no duplicate context, prose budget by tier)
- `#rules` (3.3): Added structured interchange emission rule
- `#spec-viewer` (2.9): Added structured interchange rendering paragraph
- `#details` (2.11): Added structured interchange principles paragraph (typed sections, cross-referenced IDs, expandable by default)

## 2026-02-19T20:30:00Z — /fctry:ref (release intelligence, phase types, self-improvement loop)
- Spec version: 3.15 → 3.16
- `#execute-flow` (2.7): Release summary at plan completion — Executor generates headline, highlights, deltas, migration before version decision
- `#execute-flow` (2.7): Phase type shown in build plan (Capability/Hardening/Refactor/Integration/Polish)
- `#details` (2.11): Release summary format defined — headline, highlights, deltas, migration notes
- `#capabilities` (3.1): Self-improvement loop capability (future direction — `/fctry:reflect`)
- `#entities` (3.2): Phase type entity — inferred per build plan, not stored
- `#rules` (3.3): Phase type inference rule with heuristics by readiness distribution
- `#inspirations` (5.1): Release Steward concept and Phase Goals / FPOS concept added
- `#experience-references` (5.2): Release Steward + Phase Goals / FPOS incorporation entry (5 adopted patterns)
- `#convergence-strategy` (6.2): Convergence phases as version arcs paragraph
- `#convergence-strategy` (6.2): Future direction — `/fctry:reflect` self-improvement loop
- Sources: references/ops-steward-agent-idea.md, references/phase-goals-fpos-spec.md

## 2026-02-19T19:30:00Z — /fctry:evolve (token efficiency: 6 strategies from efficiency notes)
- Spec version: 3.14 → 3.15
- `#rules` (3.3): Command complexity scaling — pipeline depth adapts to operation scope (targeted = lighter, broad = full depth)
- `#rules` (3.3): Output depth tiering — agent outputs scale with task tier (patch/feature/architecture)
- `#rules` (3.3): Concise agent output — decisions, findings, diffs, risks only; no process narration
- `#entities` (3.2): Architecture snapshot — persistent codebase structure brief (.fctry/architecture.md), maintained by State Owner, versioned against git
- `#capabilities` (3.1): Minimal code context injection — AST-sliced extraction (function/class nodes, not full files) + hybrid retrieval policy (vector for docs, deterministic for code)
- Source: references/token-efficiency-notes.md (12 strategies evaluated, 5 already covered, 1 combined into another)

## 2026-02-19T18:30:00Z — /fctry:evolve (review token efficiency)
- Spec version: 3.13 → 3.14
- `#review-flow` (2.6): Selective scanning — freshness skip (changelog vs. git timestamps) and semantic stability skip (local embeddings, cosine similarity). Eliminates redundant deep comparisons for recently-written or meaning-stable sections
- `#entities` (3.2): Section embeddings entity (384-dim BAAI/bge-small-en-v1.5, local ONNX, stored in SQLite). Per-section content hashes. Updated last_updated to per-section modification timestamp
- `#capabilities` (3.1): Semantic section fingerprinting capability
- `#performance` (3.5): Updated review timing — proportional to sections requiring deep comparison, embedding computation under 100ms/section
- `#status-line` (2.8): Scan progress display during review (scanning N/M)

## 2026-02-19T17:30:00Z — /fctry:ref Peekaboo (system-wide Observer verification)
- `#observability` (6.3): System-wide verification tier, application-level verification coverage signal, screenshot surface distribution signal
- `#external-connections` (3.4): Peekaboo added as external connection (macOS screen capture + GUI automation via MCP)
- `#execute-flow` (2.7): System dialog handling during autonomous builds
- `#inspirations` (5.1): Peekaboo added — "see the whole screen" paradigm for Observer
- `#experience-references` (5.2): Peekaboo reference entry with 4 adopted patterns
- Source: https://github.com/steipete/Peekaboo

## 2026-02-19T16:00:00Z — /fctry:review (deferred readiness value)
- `#entities` (3.2): Added `deferred` as seventh readiness value — intentionally-postponed sections counted as "ready" in aggregation
- `#capabilities` (3.1): Updated readiness fraction to include `deferred`
- `#observability` (6.3): Updated readiness distribution to include `deferred`
- Glossary: Updated section readiness definition to include `deferred` with description
- Code was ahead: viewer, statusline, and CSS already handled `deferred` across three surfaces

## 2026-02-19T14:30:00Z — /fctry:ref gitin (repo-to-LLM context category)
- `#inspirations` (5.1): Added gitin and Repomix as representatives of the repo-to-LLM-context tool category

## 2026-02-19T13:00:00Z — /fctry:ref (progressive visualization, resilient execution, structured analysis — 6 GitHub repos)
- Spec version: 3.12 → 3.13
- `#rules` (3.3): Added hook error isolation rule — each plugin hook runs independently, one failure never blocks others or the user's prompt
- `#spec-viewer` (2.9): Progressive section fill in mission control — sections transition visually from spec-ahead to aligned/satisfied as chunks complete. Section-level clipboard copy — subtle copy button on each section header for sharing Markdown. Per-project visual identity — distinct accent color per project card, carried through to spec view
- `#execute-flow` (2.7): Token-aware project sizing — State Owner briefing includes codebase size estimate so Executor calibrates chunk granularity
- `#entities` (3.2): Added codebase size estimate entity
- `#review-flow` (2.6): Experience-level review analysis — State Owner reconstructs experience stories from code and compares to spec, catching capability drift that structural comparison misses
- `#inspirations` (5.1): Added ccproxy, DeepWiki, cc-devflow, CodeBoarding, AntV Infographic, codebase-digest
- `#experience-references` (5.2): Added batch reference entry covering all 6 repos with 3 themes and 6 adopted patterns
- Sources: starbaser/ccproxy, AsyncFuncAI/deepwiki-open, Dimon94/cc-devflow, CodeBoarding/CodeBoarding, antvis/Infographic, kamilstanuch/codebase-digest

## 2026-02-19T06:30:00Z — /fctry:evolve (agent-authoritative readiness)
- Spec version: 3.11 → 3.12
- `#details` (2.11): Readiness tracking rewritten — State Owner writes per-section readiness to `state.json` as `sectionReadiness` map (alias → readiness value), not just aggregate `readinessSummary`. All downstream consumers (status line, viewer, Executor) read from `state.json`. Bootstrap heuristic exists for initial load before any agent scan, but contains no project-specific hints. Executor updates per-section readiness after each chunk completes. Fixes: viewer showing stale/wrong readiness for non-fctry projects because it recomputed from hardcoded heuristics instead of reading agent-assessed data.
- `#spec-viewer` (2.9): New "Agent-authoritative readiness" paragraph — viewer reads readiness from `state.json`, never recomputes independently. Falls back to bootstrap heuristic only when no agent assessment exists. Ensures viewer and status line always agree.
- `#entities` (3.2): Section readiness index entity updated — `state.json` is the authoritative source with `sectionReadiness` map and `readinessSummary`. SQLite cache stores readiness for agent queries but is not the source of truth for display surfaces.
- Glossary: "Section readiness" updated — now mentions Executor updates after chunks, `state.json` as single source, all display surfaces reading from same source.
- Scenarios: Updated scenario 1029 (Automatic Section Readiness Assessment) — emphasizes state.json as single source, status line and viewer agreement. Added 2 new scenarios: "Readiness Is Accurate for Non-fctry Projects" (viewer matches State Owner for any codebase), "Executor Updates Readiness After Each Chunk Completes" (real-time readiness progress during builds). Updated scenario 1251 (Documentation Sections) — removed hardcoded list mention, added cross-project accuracy.
- Root cause: viewer's `/readiness.json` and `/api/dashboard` endpoints called `assess-readiness.js` on every request, which rebuilt the index from scratch (wiping State Owner's setReadiness calls) and used a hardcoded `codeHints` map with 13 fctry-specific entries. Non-fctry projects always showed wrong readiness.

## 2026-02-19T05:00:00Z — /fctry:evolve (inbox-to-ref handoff, bare /fctry:ref invocation)
- Spec version: 3.10 → 3.11
- `#ref-flow` (2.5): New "Bare invocation with inbox" paragraph — when `/fctry:ref` is run with no arguments and processed reference items exist in the inbox, the system presents them as numbered options (title + note), supports batch selection (comma-separated), and falls back to URL prompt if no items exist. Closes the broken promise where inbox shows "ready for /fctry:ref" but bare ref didn't check the inbox.
- `commands/ref.md`: New "Empty Arguments (Inbox-First Mode)" section with AskUserQuestion presentation, batch selection, note display, and incorporation marking. Expanded "Inbox Consumption" into two explicit paths: Path A (no arguments, inbox-first) and Path B (URL provided, URL-matching).
- `.fctry/scenarios.md`: Added 1 scenario — "Bare /fctry:ref Picks Up Inbox References" (processed inbox items presented as options, batch selection, pre-analyzed data used without re-fetch, consumed items marked incorporated).
- Bug fix (code): `src/viewer/server.js` `processInboxItem()` now extracts URL from content string before passing to `fetchReference()` — previously the entire content string (URL + note) was used as the fetch URL, causing HTTP 404 when a note was included.

## 2026-02-19T03:20:00Z — /fctry:evolve (structural readiness classification, cross-project correctness)
- Spec version: 3.9 → 3.10
- `#rules` (3.3): Readiness tracking rewritten — all numbered leaf sections assessed regardless of alias presence. Meta-section detection by NLSpec v2 category number (1/4/5/6 = meta, 2/3 = buildable) instead of hardcoded alias list. Structural heading exclusion by parent-child relationship and numbering, not alias presence. Fixes projects with sparse aliases showing incorrect section counts.
- Assessor: CLI entry point guarded to prevent double output when imported as module. Slug generation in viewer client fixed to match DOM ID generation (dots in section numbers stripped correctly).

## 2026-02-19T03:10:00Z — /fctry:evolve (readiness auto-detection, viewer singleton robustness)
- Spec version: 3.8 → 3.9
- `#rules` (3.3): Readiness tracking paragraph now specifies that only aliased sections are assessed (structural headings excluded), and meta-concept classification is derived from spec structure rather than a hardcoded list.
- `#spec-viewer` (2.9): New "Singleton enforcement" paragraph — health-check before start, PID-aware cleanup, load-before-save registry ordering.
- `.fctry/scenarios.md`: Added 2 scenarios — "Readiness Assessor Classifies New Documentation Sections Without Code Changes", "Viewer Server Never Spawns Duplicate Processes"

## 2026-02-18T12:25:00Z — /fctry:evolve spec-viewer (dashboard readiness pills, duplicate project fix)
- Spec version: 3.7 → 3.8
- `#spec-viewer` (2.9): Dashboard project cards now show colored readiness pills (per-category section breakdown), matching the sidebar pill design. Bug fix: path canonicalization now uses `realpathSync.native` to normalize filesystem casing on macOS — prevents duplicate project entries when the same directory is referenced with different letter casing (e.g., `/Code/` vs `/code/`).
- `.fctry/scenarios.md`: Added 2 scenarios — "Dashboard Cards Show Readiness Breakdown" (per-project pills on dashboard cards), "Case-Insensitive Path Deduplication" (same project never registered twice regardless of path casing)

## 2026-02-18T12:00:00Z — /fctry:evolve spec-viewer (readiness stats and filter in viewer sidebar)
- Spec version: 3.6 → 3.7
- `#spec-viewer` (2.9): Added readiness stat pills in left rail above ToC tabs — compact colored pills showing per-category section counts (aligned, spec-ahead, draft, needs-spec-update, etc.). Pills auto-refresh on spec changes via WebSocket. Each pill is a clickable filter: clicking collapses non-matching sections in the content area, highlights only matching TOC entries, shows full rendered content for matching sections. Click active pill again to clear filter. Preserves scroll position on clear.
- `.fctry/scenarios.md`: Added 3 scenarios — "Readiness Stats in Sidebar Show Project Health at a Glance" (stats always visible, readable in 2 seconds), "Clicking a Readiness Pill Filters the Spec View" (click to filter, click again to clear, full content of matching sections), "Readiness Stats Auto-Refresh After Spec Changes" (counts update when spec changes via WebSocket)

## 2026-02-18T08:00:00Z — /fctry:evolve (Interviewer: experience-only questions, no technical leakage)
- Spec version: 3.5 → 3.6
- `agents/interviewer.md`: Phase 4 renamed from "What Does the System Know?" to "What Does the User Expect?" — all questions reframed as experience questions answerable by a non-coder. Added explicit rephrase guidance: if an answer sounds like a database schema, redirect to what the user sees. Phase 1 constraints question reworded to "experience constraints" with non-technical examples. "Important Behaviors" section expanded with bad→good question pairs showing how to convert technical questions to experience questions. "The agent decides implementation" guidance now handles technically-savvy users who volunteer implementation preferences — redirect to experience motivation.
- `.fctry/scenarios.md`: Added 2 scenarios — "Interview Questions Are Experience-Only" (non-coder completes full interview without confusion) and "Technical User Preferences Redirected to Experience" (tech preferences filtered through experience lens)
- Purpose: The Interviewer was still asking questions that pushed users toward thinking about data models, integrations, and system internals. Now every question is framed so a non-coder can answer from their experience vision, and the coding agent infers all technical decisions from those answers.

## 2026-02-18T07:00:00Z — /fctry:evolve (project synopsis in spec frontmatter)
- Spec version: 3.4 → 3.5
- `references/template.md`: Added `synopsis` block to YAML frontmatter template with six structured fields: `short` (<80 char one-liner), `medium` (2-3 sentences), `readme` (one paragraph), `tech-stack` (array), `patterns` (array), `goals` (array)
- `#core-flow` (2.2): Step 3 now generates project synopsis from interview; Step 4 output displays full synopsis block for user to copy-paste
- `#evolve-flow` (2.4): Step 3 regenerates synopsis on every evolve; Step 4 output displays updated synopsis alongside diff summary
- `agents/interviewer.md`: Phase 1 now drafts synopsis descriptions and shares with user for validation
- `agents/spec-writer.md`: Init produces synopsis in frontmatter from interview; evolve regenerates all six fields from current spec content
- `commands/init.md`: Output section includes synopsis; Next Steps template shows synopsis block
- `commands/evolve.md`: Output list includes regenerated synopsis
- `references/claudemd-guide.md`: Project identity line now derives from `synopsis.short` in frontmatter
- `.fctry/scenarios.md`: Added 4 scenarios — synopsis on init, synopsis on evolve, external cataloging consumption, synopsis field validation
- Purpose: Structured project metadata for automated cataloging by external systems (e.g., Knowmarks bookmark reference finder). Tech stack, patterns, and goals alongside multi-length descriptions.

## 2026-02-18T06:00:00Z — /fctry:evolve (viewer dashboard as decision surface, inbox consumption, command recommendations)
- Spec version: 3.3 → 3.4
- `#spec-viewer` (2.9): Added project dashboard as landing page with aggregated state cards, readiness bars, inbox counts, build progress, and recommended next commands as copyable chips. Added inbox consumption — evolve and ref commands check inbox for relevant queued items before starting. Added back-to-dashboard navigation.
- `#execute-flow` (2.7): Dashboard reflects build-in-progress with live progress indicator
- `#capabilities` (3.1): Updated live spec viewer capability to include dashboard and inbox consumption
- `#convergence-strategy` (6.2): Added "viewer as decision surface" convergence phase between multi-project viewer and viewer as control plane
- `commands/evolve.md`: Added Inbox Consumption section — checks inbox.json for relevant items before interview, offers incorporation as context
- `commands/ref.md`: Added Inbox Consumption section — checks for matching reference URLs in inbox, offers pre-analyzed context
- `agents/interviewer.md`: Added Inbox Context section — guidance on weaving inbox items into conversation naturally
- `src/viewer/server.js`: Added /api/dashboard endpoint with per-project state aggregation and computeRecommendation engine
- `src/viewer/client/`: Dashboard view with project cards, readiness bars, stats, copyable command chips. Navigation between dashboard and spec view.

## 2026-02-18T05:00:00Z — /fctry:evolve (version registry migration for pre-existing projects, review Drift/Unbuilt grouping)
- Spec version: 3.2 → 3.3
- `#first-run` (2.1): Added migration hook auto-seeding of version registry for pre-existing projects
- `#evolve-flow` (2.4): Version registry update step creates config.json with defaults if missing
- `#review-flow` (2.6): Replaced flat gap analysis with Drift/Unbuilt grouping — drift items first (need decision), unbuilt items second (need build), aggregate unbuilt count, sequential numbering across groups
- `#details` (2.11): Version registry rules mention migration seeding and agent-level config.json creation
- `#rules` (3.3): Added version registry migration rule and gap analysis grouping rule
- `agents/spec-writer.md`: Auto-increment handles missing config.json by creating with defaults
- `commands/evolve.md`: Version registry update step creates config.json if missing
- `commands/review.md`: Gap analysis example updated for Drift/Unbuilt structure with aggregate count
- `agents/state-owner.md`: Spec Ahead classification uses actionable language ("run /fctry:execute to build")

## 2026-02-18T04:00:00Z — /fctry:evolve (spec status lifecycle — draft/active/stable, automatic transitions, stale detection)
- Spec version: 3.1 → 3.2
- Frontmatter: `status` updated from `draft` to `active` (this spec has scenarios and is actively iterated)
- `references/template.md`: Updated frontmatter status values from `draft | review | approved | building` to `draft | active | stable` with explanatory comments
- `#core-flow` (2.2): Init Step 3 now transitions spec status from `draft` to `active` on successful completion
- `#evolve-flow` (2.4): Evolving a `stable` spec transitions it to `active`
- `#review-flow` (2.6): Review detects stale statuses (draft with complete spec, stable with drift) and offers corrections as numbered recommendations
- `#execute-flow` (2.7): Clarified that `building` is not a status value — build-in-progress is tracked in the build run, spec stays `active` during builds
- `#details` (2.11): Added spec status transitions description — all three transitions, ownership, and automatic behavior
- `#entities` (3.2): Expanded spec document entity with status lifecycle (draft/active/stable), transition ownership, and the absence of a `building` status
- `#rules` (3.3): Added spec status lifecycle rule — three values, three transitions, ownership by Spec Writer and State Owner, stale detection in review
- Appendix B: Added "Spec status" glossary entry
- `agents/spec-writer.md`: Added status transition responsibility (draft→active at init, stable→active on evolve)
- `agents/executor.md`: Clarified that the Executor does not touch the status field; building is transient state in the build run
- `agents/state-owner.md`: Added responsibility for active→stable transition (full satisfaction + no drift)
- `commands/review.md`: Added stale status detection to the review checklist with numbered recommendation format

## 2026-02-18T03:00:00Z — /fctry:ref Claude Context OS (uncertainty markers, agent output persistence, relevance manifests)
- Spec version: 3.0 → 3.1
- Reference: https://github.com/Arkya-AI/claude-context-os — CLAUDE.md-based system for preventing context loss across sessions
- `#multi-session` (2.3): Added OPEN/ASSUMED/MISSING uncertainty markers to interview state persistence. Each captured answer now carries a confidence tag so the resumed interviewer knows what needs re-confirmation vs what's settled
- `#capabilities` (3.1): Added intermediate agent output persistence to context lifecycle management. Agents write outputs to the state file mid-workflow so subsequent agents can recover context after compaction without re-running predecessors
- `#entities` (3.2): Updated Interview state entity with uncertainty markers description. Updated State briefing entity with relevance manifest — a scoped file list so subsequent agents load targeted context instead of scanning broadly
- `#inspirations` (5.1): Added Claude Context OS entry
- `#experience-references` (5.2): Added Claude Context OS experience reference with three actionable patterns extracted

## 2026-02-18T02:00:00Z — /fctry:evolve spec-viewer (path canonicalization, frontmatter enforcement)
- Spec version: 2.9 → 3.0
- `#spec-viewer` (2.9): Added path canonicalization requirement — all path comparisons (plugin root, project directories) resolve symlinks and filesystem case to prevent duplicate registrations and false restarts on case-insensitive filesystems. Project registry stores canonicalized paths
- `agents/spec-writer.md`: Added mandatory frontmatter requirement — every spec must use NLSpec v2 code-fenced YAML with `title`, `spec-version`, `date`, `status`, `author`, `spec-format: nlspec-v2`. Spec Writer normalizes non-conformant frontmatter on evolve/review
- `commands/review.md`: Added frontmatter conformance check as first Spec Writer step during review

## 2026-02-18T01:00:00Z — /fctry:review (version registry stale value, stop.md multi-project language, bump-version.sh config.json step)
- Spec version: 2.9 (no bump — code/tooling fixes only)
- `.fctry/config.json`: Fixed stale `versions.external.current` from `0.9.0` to `0.10.0`
- `commands/stop.md`: Replaced per-project viewer language with global server description (matches multi-project viewer reality)
- `scripts/bump-version.sh`: Added step 3 — updates `config.json` `versions.external.current` on every bump. Script now 6 steps (was 5)
- CLAUDE.md: Updated version propagation section to list 6 steps (added config.json). Fixed scenario count (~120 → ~110)

## 2026-02-18T00:00:00Z — /fctry:review (alignment audit — init sequencing, viewer session persistence, CLAUDE.md lifecycle)
- Spec version: 2.9 (no bump — corrections only)
- `#core-flow` (2.2): Fixed stale "work in parallel" language — Scenario Crafter and Spec Writer run sequentially (Scenario Crafter first, then Spec Writer), matching workflow enforcement in `commands/init.md`
- `#spec-viewer` (2.9): No spec change needed — spec already describes persistent server. Fixed code: removed `SessionEnd` viewer stop hook from `hooks/hooks.json` to match spec's multi-project persistent server model
- CLAUDE.md: Updated viewer lifecycle description — removed "auto-stops on session end", now describes persistent server matching spec section 2.9

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
