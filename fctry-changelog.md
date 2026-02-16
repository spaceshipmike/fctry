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
