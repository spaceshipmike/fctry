# fctry — Natural Language Specification

```yaml
---
title: fctry
spec-version: 1.3
plugin-version: 0.5.1
date: 2026-02-13
status: draft
author: Mike
spec-format: nlspec-v2
---
```

fctry is a Claude Code plugin that enables autonomous software development from experience-first specifications. It provides seven commands (/fctry:init, evolve, ref, review, execute, view, stop) that orchestrate seven specialized agents to produce complete specifications in NLSpec v2 format, then drive builds toward satisfaction across user scenarios. No human touches or reviews the code — the spec and scenarios are the entire contract. Designed for a non-coder with many projects and a clear vision for each.

---

## Table of Contents

1. [Vision and Principles](#1-vision-and-principles)
   - 1.1 [Problem Statement](#11-problem-statement) `#problem-statement`
   - 1.2 [What This System Is](#12-what-this-system-is) `#what-this-is`
   - 1.3 [Design Principles](#13-design-principles) `#design-principles`
   - 1.4 [What Success Looks Like](#14-what-success-looks-like) `#success-looks-like`
2. [The Experience](#2-the-experience)
   - 2.1 [First Run / Onboarding](#21-first-run--onboarding) `#first-run`
   - 2.2 [Core Flow: From Idea to Spec](#22-core-flow-from-idea-to-spec) `#core-flow`
   - 2.3 [Multi-Session Interviews](#23-multi-session-interviews) `#multi-session`
   - 2.4 [Evolving an Existing Spec](#24-evolving-an-existing-spec) `#evolve-flow`
   - 2.5 [Incorporating References](#25-incorporating-references) `#ref-flow`
   - 2.6 [Reviewing Alignment](#26-reviewing-alignment) `#review-flow`
   - 2.7 [Executing the Build](#27-executing-the-build) `#execute-flow`
   - 2.8 [Navigating by Section](#28-navigating-by-section) `#navigate-sections`
   - 2.9 [Live Spec Viewer](#29-live-spec-viewer) `#spec-viewer`
   - 2.10 [What Happens When Things Go Wrong](#210-what-happens-when-things-go-wrong) `#error-handling`
   - 2.11 [The Details That Matter](#211-the-details-that-matter) `#details`
   - 2.12 [Terminal Status Line](#212-terminal-status-line) `#status-line`
3. [System Behavior](#3-system-behavior)
   - 3.1 [Core Capabilities](#31-core-capabilities) `#capabilities`
   - 3.2 [Things the System Keeps Track Of](#32-things-the-system-keeps-track-of) `#entities`
   - 3.3 [Rules and Logic](#33-rules-and-logic) `#rules`
   - 3.4 [External Connections](#34-external-connections) `#external-connections`
   - 3.5 [Performance Expectations](#35-performance-expectations) `#performance`
4. [Boundaries and Constraints](#4-boundaries-and-constraints)
   - 4.1 [Scope](#41-scope) `#scope`
   - 4.2 [Platform and Environment](#42-platform-and-environment) `#platform`
   - 4.3 [Hard Constraints](#43-hard-constraints) `#hard-constraints`
   - 4.4 [Anti-Patterns](#44-anti-patterns) `#anti-patterns`
5. [Reference and Prior Art](#5-reference-and-prior-art)
   - 5.1 [Inspirations](#51-inspirations) `#inspirations`
   - 5.2 [Experience References](#52-experience-references) `#experience-references`
6. [Satisfaction and Convergence](#6-satisfaction-and-convergence)
   - 6.1 [Satisfaction Definition](#61-satisfaction-definition) `#satisfaction-definition`
   - 6.2 [Convergence Strategy](#62-convergence-strategy) `#convergence-strategy`
   - 6.3 [Observability](#63-observability) `#observability`
   - 6.4 [What the Agent Decides](#64-what-the-agent-decides) `#agent-decides`

Appendices:
- [A: Decision Rationale](#appendix-a-decision-rationale)
- [B: Glossary](#appendix-b-glossary)

---

## 1. Vision and Principles

### 1.1 Problem Statement {#problem-statement}

A non-coder with a clear vision for a software project faces a painful choice: learn to code (hundreds of hours), hire developers (expensive, slow, communication overhead), or settle for no-code tools that constrain the vision. Even with AI coding assistants, the non-coder must translate their experience-oriented vision into implementation language — databases, APIs, architectural decisions — which they don't have mental models for.

Meanwhile, the StrongDM Software Factory model has demonstrated that code written entirely by machines, validated entirely through scenario satisfaction rather than human code review, can reach production quality. The missing piece is a system that bridges the gap: takes an experience-centric vision from a non-technical user and produces a complete, self-contained specification that a coding agent can build from without asking follow-up questions.

This spec solves that problem. It enables a single person with many project ideas to articulate their vision conversationally, refine it over multiple sessions, incorporate inspiration from the web, and launch autonomous builds — all without touching code or learning implementation concepts.

### 1.2 What This System Is {#what-this-is}

fctry is a Claude Code plugin that orchestrates seven specialized agents across seven commands to produce experience-first specifications and drive autonomous builds from them. It converts conversational descriptions of "what the user sees, does, and feels" into complete NLSpec v2 documents, generates scenario holdout sets, and manages the build-measure-learn loop until scenario satisfaction is achieved. The system delivers the core command loop (init, evolve, ref, review, execute) with multi-session interviews, addressable spec sections, conflict resolution, execute pacing, context-aware reference incorporation, tool validation, and changelog-aware drift detection — plus a live spec viewer (view, stop) with WebSocket updates, section highlighting, and visual change history. The system enforces its own workflow (preventing agents from skipping steps), maintains a structured spec index for efficient section-level access, and tracks per-section readiness so both the user and agents know what's ready to build at a glance.

### 1.3 Design Principles {#design-principles}

**Experience language, always.** The system accepts and produces descriptions of what users see, do, and feel — never databases, APIs, or code patterns. When the user says "I want a list of my recent items, sorted by urgency, with overdue ones highlighted," that exact phrasing appears in the spec. This rules out any UI that asks the user to describe data models, API endpoints, or technical architecture.

**The agent decides implementation.** Every spec explicitly grants the coding agent full authority over technology choices, architecture, and data model. The user describes the experience; the agent figures out how to build it. This rules out any UI that lets the user specify frameworks, libraries, or implementation details unless they're genuinely experience constraints (e.g., "must work offline" is an experience constraint; "must use SQLite" is an implementation detail the agent infers).

**Grounded in reality.** Every command starts with the State Owner scanning the current codebase and producing a briefing. Spec updates are always informed by what actually exists. This rules out speculative updates that ignore the current state — the system never updates a spec without first understanding whether code exists, what state it's in, and how it relates to the spec.

**Approval-gated execution.** The Executor proposes build plans; the user approves them. The user controls the pace and can pause at any time. This rules out autonomous builds that run without user oversight or consume unbounded resources.

**Conversational, not form-filling.** The Interviewer draws out the vision through dialogue, asking follow-up questions based on what the user says. This rules out wizards, forms, or templates the user fills in. The experience feels like talking to a co-founder who's helping you think through your vision.

**Progressive, not all-at-once.** Commands are discrete steps. The user can run init to create a spec, stop for a week, run evolve to add a feature, run ref to incorporate inspiration, run execute to build. Each command stands alone. This rules out workflows that require completing all steps in one session or remembering complex state between sessions.

**Process-aware, not just process-documented.** The system enforces its own workflow — agents cannot skip steps, and the user always knows whether they're working within the factory process or outside it. When code changes happen outside fctry commands, the system notices and surfaces them. This rules out silent process drift where the user thinks they're following the factory model but Claude has reverted to ad-hoc development.

**Addressable and navigable.** Every section of the spec has both a stable alias (e.g., `#core-flow`) and a number (e.g., `2.2`). Users can reference sections in commands: `/fctry:evolve core-flow` or `/fctry:evolve 2.2`. The spec viewer highlights the section being worked on. This rules out opaque specs where users can't point to specific parts or understand what's changing.

### 1.4 What Success Looks Like {#success-looks-like}

The user opens Claude Code, types `/fctry:init`, and within minutes is having a conversation about their vision. The Interviewer asks thoughtful questions. The conversation feels natural. When it's done, the user sees a complete spec that captures exactly what they described — clear enough that they can read it and say "yes, that's it," specific enough that a coding agent can build from it.

Days later, they think of a feature. They type `/fctry:evolve core-flow` and describe the change. The system updates just that section, shows exactly what changed, and the spec remains coherent.

They see a design they love on the web. They type `/fctry:ref 2.3 https://example.com` and the system interprets the reference in experience language, updates section 2.3, and stores the visual for later.

When they're ready to build, they type `/fctry:execute`. The Executor proposes a plan. They approve. The build runs. When it's done, the Executor shows which scenarios are satisfied and which aren't, and offers three pacing options: tackle the highest-priority gap, work on a logical group, or do everything remaining. They choose. The cycle repeats until satisfaction.

Throughout, they feel like they have a co-founder who remembers everything, never forgets context, and translates their vision into reality without them needing to learn to code.

---

## 2. The Experience

### 2.1 First Run / Onboarding {#first-run}

The user installs the fctry plugin via Claude Code's plugin installer. On first run of any `/fctry` command, the system checks for required tools (ripgrep, ast-grep, gh CLI, MCP servers). If any are missing, the system shows a clear message listing what's missing and how to install it, then stops. This takes under 5 seconds.

Once tools are present, the system is ready. There's no account setup, no configuration file to edit, no initialization step beyond installing the plugin. The user can immediately run `/fctry:init` to start their first spec.

### 2.2 Core Flow: From Idea to Spec {#core-flow}

The user has an idea for a software project. They open Claude Code in the project directory (or an empty directory if it's greenfield) and type `/fctry:init`.

**Step 1: State assessment (5-15 seconds).** The State Owner agent scans the directory. If code exists, it identifies the tech stack, reads any existing spec or README, and classifies the project (greenfield, has code, has docs, has spec). It produces a briefing that grounds the interview. The user sees: "Classified as greenfield" or "Found existing React app with README but no spec" or "Found spec.md last updated 3 days ago, code last updated yesterday — spec may be ahead."

**Step 2: The interview (5-20 minutes).** The Interviewer agent starts the conversation. It asks: "What is this system? What does it do? Who is it for?" The user describes their vision in plain language. The Interviewer follows up with clarifying questions based on the user's answers:

- "You mentioned a list of items — what information does each item show?"
- "When you say 'sorted by urgency,' how does the system know what's urgent?"
- "What happens when someone opens this for the first time?"

The conversation is natural. The user can answer in paragraphs or fragments. The Interviewer adapts. At any point, the user can type `save and pause` and the interview state is saved. They can resume later by typing `/fctry:init --resume`.

When the interview feels complete, the Interviewer asks: "Anything else you want to cover?" If the user says no, the interview ends.

**Step 3: Spec and scenario generation (30-90 seconds).** The Scenario Crafter and Spec Writer agents work in parallel. The Scenario Crafter writes 5-10 scenarios covering the core flows described in the interview. The Spec Writer synthesizes the interview transcript and State Owner briefing into a complete NLSpec v2 document. Both agents write to files in the project directory: `{project-name}-spec.md` and `{project-name}-scenarios.md`.

**Step 4: Review.** The user sees a summary:

```
Spec created: fctry-spec.md (7 sections, 2,400 words)
Scenarios created: fctry-scenarios.md (8 scenarios)

Next steps:
- Review the spec
- Run /fctry:evolve <section> to refine
- Run /fctry:execute to start the build
```

The user opens the spec. It reads like a clear, coherent document — not a form, not a template with blanks filled in. Every section has a number and an alias. The user can point to any section and reference it in future commands.

### 2.3 Multi-Session Interviews {#multi-session}

During an interview (either init or evolve), the user can type `save and pause` at any point. The system immediately saves the interview state (transcript so far, questions asked, topics covered, next intended question) and responds:

```
Interview state saved. Resume anytime with /fctry:init --resume.
```

When the user returns (hours, days, or weeks later) and types `/fctry:init --resume`, the Interviewer reads the saved state and picks up exactly where they left off:

```
Resuming interview from earlier...
Last we talked, you described the core list view. You mentioned items are sorted by urgency. I was about to ask: how does the system determine urgency?
```

The user continues the conversation. The Interviewer never asks questions already answered. The experience feels like talking to someone with perfect memory.

If the user types `/fctry:init` without `--resume` when a saved state exists, the system asks: "I found a saved interview in progress. Resume or start fresh?"

### 2.4 Evolving an Existing Spec {#evolve-flow}

The user has a spec. They want to add a feature or change something. They type `/fctry:evolve <section>` where `<section>` is either a number (e.g., `2.2`) or an alias (e.g., `core-flow`).

**Step 1: State assessment (5-15 seconds).** The State Owner scans the current codebase and reads the spec. It produces a briefing: "Spec last updated 2 days ago. Code last updated 1 hour ago. Section 2.2 (core-flow) describes a list view sorted by urgency. Code implements sorting by date. Drift detected."

**Step 2: Targeted interview (2-10 minutes).** The Interviewer focuses the conversation on the specified section. It shows the user the current text of that section and asks: "What would you like to change about the core flow?"

The user describes the change. The Interviewer asks follow-up questions specific to the change. The conversation is shorter and more focused than a full init interview.

**Step 3: Update synthesis (15-45 seconds).** The Scenario Crafter updates or adds scenarios relevant to the change. The Spec Writer updates the specified section and any related sections. It does NOT rewrite the entire spec — only the parts affected by the change.

**Step 4: Diff and review.** The user sees:

```
Spec updated: fctry-spec.md

Changes:
- Section 2.2 (core-flow): Updated sorting logic from date to urgency
- Section 3.3 (rules): Added urgency calculation rule
- Scenarios: Added "Sorting by Urgency Happy Path"

Unchanged:
- All other sections remain as-is

Next steps:
- Run /fctry:execute to build the new behavior
- Run /fctry:review to confirm alignment
```

The user can see exactly what changed and what to do next. The spec remains coherent. Sections that weren't affected are untouched.

If the State Owner detected drift (code and spec disagree), the system surfaces the conflict before the interview:

```
Drift detected: Section 2.2 says items are sorted by urgency, but the code sorts by date. Which is more current?
- The spec (update the code to match)
- The code (update the spec to match)
- Neither (I'll describe what I want)
```

The user chooses. The system proceeds accordingly.

### 2.5 Incorporating References {#ref-flow}

The user sees a design, article, or product that inspires part of their vision. They type `/fctry:ref <section> <url>` (targeted mode) or `/fctry:ref <url>` (open mode).

**Targeted mode (`/fctry:ref 2.3 https://example.com`):**

The State Owner scans the project (5-15 seconds). In parallel, the Researcher or Visual Translator agent fetches and interprets the URL. If it's a web page, the Researcher extracts the relevant experience patterns. If it's a screenshot or design file, the Visual Translator describes what it sees in experience language.

The Spec Writer updates the specified section to incorporate the reference. It adds an entry to section 5.2 (Experience References) linking to the stored asset and describing the interpretation. The user sees:

```
Reference incorporated into section 2.3 (secondary-flow).

Added to spec:
- Section 2.3: Bulk import flow inspired by Notion's CSV import UX
- Section 5.2: Reference to references/notion-import.png

Changes:
- Section 2.3 now describes drag-and-drop upload, progress indicator, and preview-before-commit pattern

Next steps:
- Run /fctry:evolve 2.3 to refine the new content
- Run /fctry:execute to build
```

**Open mode (`/fctry:ref https://example.com`):**

The system interprets the reference, then asks clarifying questions to understand where it applies:

```
I see this design uses a sidebar navigation pattern with collapsible sections.
Which part of your spec does this relate to?
- The main navigation (section 2.2)
- The settings panel (section 2.5)
- Something not yet in the spec
```

The user chooses. The system updates accordingly.

### 2.6 Reviewing Alignment {#review-flow}

The user wants to check whether the spec and codebase are aligned. They type `/fctry:review`.

**Step 1: Deep state assessment (10-30 seconds).** The State Owner scans the codebase, reads the spec, reads the changelog, and identifies:
- Sections of the spec that have no corresponding code
- Code that implements things not in the spec
- Sections where the spec and code describe different behavior (drift)
- How recently each section was updated (both in the spec and in the code)

**Step 2: Gap analysis.** The Spec Writer produces a report:

```
Gap Analysis: fctry-spec.md vs. codebase

Section readiness:
- 5 sections aligned (ready to execute)
- 3 sections spec-ahead (no code yet)
- 1 section needs-spec-update (code exists, spec doesn't describe it)
- 1 section has drift (spec and code disagree)

Spec ahead of code:
- Section 2.5 (ref-flow): Describes open mode and targeted mode. Code only implements targeted mode.
- Section 2.9 (spec-viewer): Entire section (Phase 2 feature) has no implementation yet.

Code ahead of spec:
- src/utils/validation.ts: Tool validation logic exists but not described in spec section 3.3 (rules).

Drift (spec and code disagree):
- Section 2.2 (core-flow): Spec says sorted by urgency, code sorts by date.

Untracked changes (made outside fctry):
- src/viewer/server.js: Modified since last /fctry command (covers #spec-viewer 2.9)
- src/statusline/fctry-statusline.js: Modified since last /fctry command (covers #status-line 2.12)

Recommendations:
- Update spec section 3.3 to document tool validation
- Decide on section 2.2 drift (run /fctry:evolve 2.2 to resolve)
- Reconcile untracked changes via /fctry:evolve for affected sections
- Section 2.5 and 2.9 are work-in-progress (run /fctry:execute to build)
```

The user sees exactly where the spec and reality diverge and what to do about it.

**Step 3: Project instructions audit.** If `/fctry:execute` has been run at least once (the State Owner can tell from the presence of CLAUDE.md in the project root), the Spec Writer performs a full audit of CLAUDE.md against the current spec and codebase. It checks everything: spec and scenario file paths, the factory contract, the current build plan, convergence order, versioning rules, repo structure, commands table, architecture notes — anything in CLAUDE.md that may have drifted from reality. The user sees:

```
Project Instructions Drift (CLAUDE.md):

(1) Spec path — CLAUDE.md says "project-spec.md" but spec is at "my-app-spec.md"
    Recommendation: Update path in CLAUDE.md

(2) Convergence order — CLAUDE.md lists Phase 2 viewer as pending, but viewer is shipped
    Recommendation: Update convergence order to match spec section 6.2

(3) Repo structure — CLAUDE.md describes src/api/ directory that no longer exists
    Recommendation: Update structure section to reflect current codebase

No issues? "CLAUDE.md is current — no updates needed."
```

CLAUDE.md updates are presented as numbered recommendations alongside the spec drift items. The user approves or rejects each one. Approved changes are applied directly to CLAUDE.md.

### 2.7 Executing the Build {#execute-flow}

The user has a spec and wants to build from it. They type `/fctry:execute`.

**Step 1: State assessment and scenario evaluation (10-30 seconds).** The State Owner scans the codebase and evaluates scenario satisfaction. For each scenario in the scenarios file, it determines: fully satisfied, partially satisfied, or not satisfied. It produces a briefing showing the current state and satisfaction score (e.g., "5 of 8 scenarios fully satisfied, 2 partially, 1 not satisfied").

**Step 2: Build plan proposal (15-60 seconds).** The Executor reads the briefing and the spec, identifies the gaps, and proposes a build plan. The Executor filters to sections marked as `ready-to-execute` or `spec-ahead` in the readiness index — sections flagged as `needs-spec-update` or `draft` are excluded from the plan and surfaced as "not ready to build yet" with a recommendation to run `/fctry:evolve` first. The plan is chunked into discrete work units, each focused on satisfying one or more scenarios. The user sees:

```
Build plan:

Chunk 1: Implement urgency-based sorting (satisfies scenario "Sorting by Urgency Happy Path")
  - Affects: Section 2.2 (core-flow), Section 3.3 (rules)
  - Estimated time: 5-10 minutes

Chunk 2: Add bulk import flow (satisfies scenarios "Bulk Import Happy Path", "Bulk Import with Errors")
  - Affects: Section 2.5 (ref-flow)
  - Estimated time: 10-20 minutes

Chunk 3: Build spec viewer UI (satisfies scenario "User views spec in browser")
  - Affects: Section 2.9 (spec-viewer)
  - Estimated time: 20-40 minutes

Approve this plan? (yes / revise / cancel)
```

The user can approve the plan as-is, ask for revisions, or cancel.

**Step 3: Execution (time varies).** If approved, the Executor builds chunk 1. It writes code, runs tests, evaluates scenario satisfaction. When the chunk is complete and scenarios are satisfied, the system creates a git commit (if a repository exists) with a message referencing the satisfied scenarios and tags it with an incremented patch version. The user sees results:

```
Chunk 1 complete.

Scenario satisfaction:
- "Sorting by Urgency Happy Path": ✓ Fully satisfied
- Overall: 6 of 8 scenarios fully satisfied (was 5)

Git: Committed as abc123f "Implement urgency-based sorting (satisfies scenario 'Sorting by Urgency Happy Path')"
Version: Tagged as 0.1.1 (patch increment)

Next: Choose pacing
1. Highest priority (Chunk 2: Bulk import — highest impact unsatisfied scenario)
2. Logically grouped (Chunks 2-3: All remaining UI work)
3. Everything (All remaining chunks)

Or type 'stop' to pause.
```

The user chooses by number (or natural language). The Executor proceeds accordingly. After every chunk, the user sees updated satisfaction metrics, commit/version information (when git is available), and can choose the next step.

**Step 4: Completion.** When all scenarios are satisfied (or the user stops), the Executor summarizes and suggests a minor version bump if appropriate:

```
Build complete. 8 of 8 scenarios fully satisfied.

Version: Current is 0.1.5. This completes the full plan — recommend minor version bump.

Suggested version: 0.2.0
Choose:
1. Tag as 0.2.0 now
2. Skip tagging
3. Suggest different version

Recommended next steps:
- Review section 2.2 (core-flow) — implementation differs slightly from spec wording
- Review section 3.3 (rules) — urgency calculation uses a heuristic not explicitly in the spec
- Run /fctry:review to confirm alignment
```

At significant experience milestones, the Executor may suggest a major version bump with rationale (e.g., "All critical scenarios satisfied — first production-ready version"). The user approves or declines by number. The Executor flags specific sections by alias and number so the user knows where to look.

### 2.8 Navigating by Section {#navigate-sections}

Every section of the spec has two identifiers:
- A number (e.g., `2.2`, `3.3.1`)
- A stable alias (e.g., `#core-flow`, `#rules`)

Both appear in the table of contents. Both work in commands:
- `/fctry:evolve core-flow` and `/fctry:evolve 2.2` do the same thing
- `/fctry:ref 2.5 https://example.com` and `/fctry:ref ref-flow https://example.com` do the same thing

Aliases are human-readable slugs derived from section titles. Numbers follow standard outline numbering. Both are stable across spec updates — if a section is renamed, its number stays the same and its alias is updated in a way that preserves recognizability (e.g., `#core-flow` might become `#core-list-flow` if the section title changes, but never `#section-2-2`).

The user never has to remember whether something is "section 2.2" or "the core flow" — either works.

### 2.9 Live Spec Viewer {#spec-viewer}

The spec viewer auto-starts silently whenever the user works with a project that has a spec. On every prompt, a plugin hook checks for a `*-spec.md` file and starts the viewer in the background if it isn't already running. The server launches on a free port (starting at 3850), writes its PID and port to `.fctry/`, and runs quietly — no browser tab opens, no output interrupts the user's work. If no spec exists, the hook is a no-op.

The user types `/fctry:view` to open the viewer in their browser. If the viewer is already running (which it usually is, thanks to auto-start), the command opens the browser to the existing URL. If it's not running, it starts the server and opens the browser. Either way, the user sees the spec rendered as a clean, readable document with a sidebar showing the table of contents.

**Live updates.** As agents work, the spec updates in real-time via WebSocket. The user sees sections change as they're written. No need to refresh.

**Section highlighting.** When an agent is working on a specific section (e.g., Spec Writer updating section 2.2 during an evolve), that section is highlighted in the sidebar and the document scrolls to it. The user can watch the work happen.

**Change history.** A timeline sidebar (inspired by Log4brains ADR viewer) shows recent changes. Each entry shows the timestamp, which sections changed, and a one-line summary (e.g., "Updated core-flow to add urgency sorting"). Clicking an entry shows a diff using Spec Markdown-style annotations: `{++added text++}` and `{--removed text--}`. The change history reads from the changelog file; if no changelog exists yet (e.g., before the first `/fctry:evolve`), the panel shows "No changelog yet."

**Zero-build rendering.** The viewer uses a Docsify-style approach: markdown renders directly in the browser, no build step needed. The server just serves the markdown and a lightweight JS client that handles rendering and WebSocket updates.

**Read-only.** The viewer is for reading and observing. All changes happen through `/fctry` commands, never through browser editing. There's no "edit" button.

**Cross-project portability.** The viewer works in any project where fctry is installed as a plugin — not just inside the fctry repository itself. It requires Node.js on the host machine. npm dependencies (express, ws, chokidar) are installed automatically the first time the viewer starts, so there's no manual setup step after plugin installation.

The viewer runs in the background throughout the session. The user can close the browser tab and reopen `/fctry:view` anytime to get back to it. The server auto-stops when the Claude Code session ends (via a `SessionEnd` plugin hook), or the user can stop it manually with `/fctry:stop`.

### 2.10 What Happens When Things Go Wrong {#error-handling}

| What Went Wrong | What the User Sees | What They Can Do |
|----------------|-------------------|-----------------|
| Required tool missing (rg, sg, gh, MCP server) | Clear message: "Missing required tool: ripgrep (rg). Install with: brew install ripgrep" | Install the tool and re-run the command |
| Interview resumption fails (state file corrupted) | "Saved interview state is unreadable. Start fresh?" | Approve to start a new interview |
| Reference URL unreachable | "Could not fetch https://example.com — check the URL or try again later." | Fix the URL or skip the reference |
| Spec-code conflict detected during evolve | "Drift detected: spec says X, code does Y. Which is current? (1) Spec is current, (2) Code is current, (3) Neither — I'll describe what I want" | Choose by number or natural language |
| Execute chunk fails (code doesn't compile, tests fail) | "Chunk 1 failed: [error summary]. Retrying with adjusted approach..." If retry fails: "Unable to satisfy scenario 'X'. Choose: (1) Flag for review, (2) Stop execution, (3) Retry with different approach" | Choose by number or natural language |
| User references nonexistent section | "/fctry:evolve 9.9 — section 9.9 not found. Did you mean 2.9 (spec-viewer)?" | Use the suggested section or check the table of contents |
| Spec viewer port conflict | "Port 3850 in use. Trying 3851..." (auto-increment until a free port is found) | Nothing — the system handles it |
| User runs execute before init | "No spec found. Run /fctry:init first to create a spec." | Run init |
| Git repository not found during execute | Progress reports show completion and satisfaction without git-specific information (no commits, no version tags) | Nothing — build proceeds normally |
| Agent attempts to skip workflow step | "Workflow error: State Owner must run before Interviewer can proceed. (1) Run State Owner scan now (recommended), (2) Skip (not recommended), (3) Abort" | Choose by number |
| File write touches spec-covered code | "This file is covered by `#status-line` (2.12). Want to update the spec first? (1) Run /fctry:evolve status-line, (2) Continue — I'll reconcile later" | Choose by number; choosing (2) increments the untracked changes counter |
| Execute targets section with `needs-spec-update` readiness | "Section 2.3 (multi-session) needs a spec update before building — code exists but the spec doesn't describe it. Run /fctry:evolve 2.3 first." | Run evolve for that section |

Errors are conversational, specific, and actionable. The system never shows stack traces or internal agent errors to the user.

### 2.11 The Details That Matter {#details}

**Interview pacing.** The Interviewer asks one question at a time. It waits for the user's full answer before asking the next question. It never bombards the user with multiple questions at once.

**Numbered questions and choices.** When any agent presents multiple options to the user (interview questions, pacing choices, version decisions, error recovery), all options are numbered in the format "(1) First option, (2) Second option, (3) Third option." The user can respond with just the number (e.g., "1") or with natural language (e.g., "the first one" or "let's do the grouped work"). The system understands both formats.

**Spec readability.** The generated spec reads like a human wrote it. Sentences flow naturally. There are no template placeholders like "{insert details here}" or "{TODO}". If a section can't be filled in from the interview, the Spec Writer either asks a clarifying question or leaves the section appropriately scoped (e.g., "The details of X are left to the coding agent" in section 6.4).

**Change summaries.** After every spec update, the user sees a summary of what changed, what was added, and what stayed the same. The summary is concise (5-10 lines max) and uses section aliases, not just numbers.

**Progress feedback during execution.** While a chunk is building, the user sees periodic updates: "Writing core sorting logic..." "Running tests..." "Evaluating scenario satisfaction...". Updates appear every 10-20 seconds so the user knows the system is working.

**Commit and version format.** Each chunk commit message follows the format: "Implement [feature description] (satisfies scenario '[scenario name]')". Patch versions are auto-tagged with each successful chunk (0.1.1, 0.1.2, etc.). Minor and major version tags include the version number and, for major versions, a rationale (e.g., "1.0.0 — First production-ready version: all critical scenarios satisfied").

**Changelog format.** The changelog (read by State Owner and displayed in the spec viewer) uses a simple markdown format:

```
## 2026-02-10 14:32
- Updated section 2.2 (core-flow): Added urgency-based sorting
- Updated section 3.3 (rules): Added urgency calculation rule

## 2026-02-08 09:15
- Initial spec created
```

Entries are timestamped. Sections are identified by both number and alias. The changelog appends; it never overwrites.

**Tool validation on startup.** The first time any command runs in a session, the system checks for required tools. If all are present, the check is silent. If any are missing, the check fails loudly with installation instructions. Subsequent commands in the same session skip the check.

**Keyboard-friendly viewer.** In the spec viewer, the user can press `?` to see keyboard shortcuts, `Ctrl+K` to open section search, arrow keys to navigate the change history timeline.

### 2.12 Terminal Status Line {#status-line}

While working in the terminal, the user sees a two-line status display at the bottom of Claude Code that shows where they are and what to do next — at a glance, without switching to the browser viewer.

**Row 1 — Project identity.** The project name (derived from the working directory), the current git branch, the spec version, and scenario satisfaction (e.g., "5/8 scenarios"). This row answers: "What project am I in and how far along is it?"

**Row 2 — Current activity.** The active spec section being worked on (e.g., `#core-flow (2.2)`), the current fctry command (e.g., `evolve`), the recommended next step (e.g., "Next: /fctry:execute"), and context window usage. This row answers: "What's happening right now and what should I do next?"

**Graceful degradation.** Every field hides when its data source is unavailable. If no spec exists, no `.fctry/` directory, or no git repository — the status line still appears with whatever is available. At minimum, the user always sees the project name and context window percentage. A fresh project with no spec shows just those two fields. As the user works with fctry, more fields appear naturally.

**Color coding.** Context window percentage turns green below 70%, yellow at 70-89%, and red at 90%+. Scenario satisfaction uses the same color pattern: green when most scenarios are satisfied, yellow at half, red when few are. The active section name appears in a distinct color so it stands out from the surrounding information.

**Auto-activation.** The status line configures itself automatically via a plugin hook — the user never runs a setup command or edits configuration files. The first time any fctry command runs in a project, the hook ensures the project's Claude Code settings include the status line. Subsequent runs are a no-op. The user simply starts working and the status line appears.

**Fresh every session.** The state file is cleared on session start via a plugin hook, so the status line never shows stale data from a previous session. As agents work during the current session, they write their progress to the shared state file and the status line reflects it. When the Spec Writer starts working on a section, the status line shows it. When the Executor completes a build chunk and updates scenario satisfaction, the numbers change. The status line is a passive observer — it reads state but never writes it.

**Scenarios appear only after evaluation.** The scenario count is hidden until scenarios have actually been evaluated (not merely counted). This prevents a misleading "0/54 scenarios" display in projects where scenarios exist but haven't been run through LLM-as-judge yet. Once an agent evaluates satisfaction and marks the score as evaluated, the count appears with color-coded feedback.

**Section readiness at a glance.** When the State Owner has assessed section readiness, the status line shows a compact summary: "5 ready, 3 spec-ahead, 1 needs update." This tells the user how much of the spec is actionable without opening the viewer or running a review.

**Untracked changes awareness.** When files are modified outside of fctry commands and those files cover spec sections, the status line shows "2 files changed outside fctry." This gentle indicator reminds the user to reconcile changes via `/fctry:evolve` or `/fctry:review` — without interrupting their flow.

---

## 3. System Behavior

### 3.1 Core Capabilities {#capabilities}

**Progressive disclosure via shared references.** The plugin loads only the files needed for each command. Shared concepts (factory philosophy, experience language, holdout sets, numbered options, alias resolution, error conventions) are defined once in `references/` and referenced by agent and command files, keeping per-invocation token usage low while maintaining consistency.

**Conversational spec creation.** The system conducts an interview, asks follow-up questions based on user responses, and synthesizes answers into a complete NLSpec v2 document. It adapts to the user's communication style (paragraphs, fragments, bullet points) and never requires form-filling.

**Multi-session continuity.** The system saves interview state when the user types `save and pause` and resumes exactly where it left off when the user types `--resume`. It remembers all prior context (questions asked, topics covered, user's answers) and never asks the same question twice.

**Targeted spec evolution.** The system updates specific sections of the spec in response to user requests, leaving unaffected sections unchanged. It shows precise diffs after every update so the user can see exactly what changed.

**Conflict-aware updates.** When the system detects drift (spec and code describe different behavior), it surfaces the conflict before updating and asks the user to resolve it. It uses signals like commit recency, changelog entries, and code-spec alignment to determine which is more current.

**Reference interpretation.** The system fetches external URLs, interprets them in experience language (not technical language), and incorporates them into the spec as experience references. For web pages, it extracts interaction patterns and design principles. For screenshots and designs, it describes what the user sees and does.

**Gap analysis.** The system compares the spec to the codebase and identifies where they diverge: sections with no code, code with no spec coverage, and sections where they disagree. It produces a report with specific recommendations (which sections to update, which to review, which to build).

**Scenario-driven build planning.** The system reads the scenario holdout set, evaluates current satisfaction, identifies gaps, and proposes a build plan chunked by scenario impact. It presents the plan to the user for approval before executing.

**Paced execution.** After each build chunk, the system evaluates scenario satisfaction and offers three numbered pacing options: highest priority (single most impactful unsatisfied scenario), logically grouped (coherent set of related scenarios), or everything (all remaining work). The user controls the pace by responding with a number or natural language.

**Version tracking and git integration.** When a git repository exists, the system creates one commit per completed chunk with a message referencing satisfied scenarios, auto-tags each chunk with an incremented patch version, and suggests minor/major version bumps at appropriate milestones. Projects without git receive the same build experience minus version control operations.

**Addressable sections.** Every section of the spec has both a number (e.g., `2.2`) and a stable alias (e.g., `#core-flow`). Both work in commands. The system resolves aliases to sections and suggests corrections if the user references a nonexistent section.

**Change tracking.** The system maintains a changelog of every spec update, recording the timestamp, affected sections, and a one-line summary. The changelog is append-only and machine-readable so agents can read the history of spec evolution.

**Tool validation.** The system checks for required tools (ripgrep, ast-grep, gh CLI, MCP servers) on first command invocation. If any are missing, it fails early with clear installation instructions. It never runs a command that will fail later due to missing dependencies.

**Live spec viewer.** The system serves the spec as a local web UI, updates it in real-time via WebSocket as agents work, highlights the section currently being edited, and displays change history with diffs. The viewer is read-only and requires no build step.

**Workflow enforcement.** The system tracks which workflow step is active and which steps have completed for the current command. Agents validate that prerequisites have run before proceeding — the Interviewer won't start without a State Owner briefing, the Spec Writer won't run before the domain agents complete. If a step is skipped, the system surfaces a numbered error with options to run the missing step, skip it, or abort.

**Structured spec index.** The system maintains a structured index of the spec backed by YAML frontmatter per section and an SQLite cache. Agents can query the index to load only the sections they need (instead of reading the full spec), resolve cross-references, and find sections by content. The markdown file remains the source of truth; the SQLite database auto-rebuilds from the markdown whenever the spec changes.

**Automatic section readiness tracking.** The State Owner automatically assesses the readiness of each spec section during every scan. Readiness values range from `draft` (incomplete) through `aligned` (spec and code match) to `satisfied` (scenarios passing). The readiness index is stored in the SQLite cache and consumed by the Executor (to filter build plans), the status line (to show a readiness summary), and the viewer (to color-code sections in the table of contents).

**Untracked change detection.** When file writes happen outside of fctry commands and those files map to spec-covered sections, a PostToolUse hook detects the change and surfaces a nudge asking the user if they want to update the spec first. The nudge is non-blocking — the user can dismiss it and reconcile later via `/fctry:review`.

### 3.2 Things the System Keeps Track Of {#entities}

The system keeps track of:

- **Spec document** — The canonical NLSpec v2 file. Contains seven sections (vision, experience, behavior, boundaries, references, satisfaction). Each section has a number and an alias. Updated by the Spec Writer agent. The spec's frontmatter includes a version number (e.g., 1.0) that represents the spec document version, distinct from the project's semantic version.

- **Scenarios** — The holdout set of user stories stored in a separate file. Each scenario describes a user journey from start to finish in experience language. Scenarios are never shown to the coding agent during development (holdout property). Evaluated by LLM-as-judge for satisfaction. Updated by the Scenario Crafter agent.

- **Interview state** — When the user pauses an interview, the system saves the transcript so far, questions asked, topics covered, and the next intended question. Stored in a hidden file (`.fctry-interview-state.json`) in the project directory. Deleted when the interview completes.

- **Changelog** — A timestamped log of every spec update. Each entry records the date, time, affected sections (by number and alias), and a one-line summary. Append-only. Machine-readable (markdown format). Read by the State Owner to understand spec evolution trajectory.

- **State briefing** — Produced by the State Owner at the start of every command. Describes project classification (greenfield, has code, has docs, has spec), current scenario satisfaction, detected drift, recent changes (from changelog and git log), and recommended next steps. Consumed by all other agents to ground their work in reality.

- **Visual references** — Screenshots, design files, or images stored in the `references/` directory. Each has a corresponding entry in section 5.2 of the spec with an experience-language interpretation. Linked from the spec so the coding agent can see both the image and the description.

- **Build plan** — Produced by the Executor during `/fctry:execute`. Describes the proposed work as discrete chunks, each tied to one or more scenarios. Includes estimated time per chunk and a dependency graph (some chunks must happen before others). Approved by the user before execution begins.

- **Version history** — Tracked through git tags when a repository exists. Patch versions (0.1.X) are auto-incremented with each successful chunk. Minor versions (0.X.0) are suggested at full plan completion. Major versions (X.0.0) are suggested at significant experience milestones. Each tag includes a descriptive message referencing satisfied scenarios (patches and minors) or a milestone rationale (majors).

- **Tool availability** — The set of required tools (ripgrep, ast-grep, gh CLI, MCP servers) and their presence on the system. Checked on first command invocation. Cached for the session so subsequent commands don't re-check.

- **Section addressing map** — The mapping from section aliases (e.g., `#core-flow`) to section numbers (e.g., `2.2`). Updated whenever the spec structure changes. Used to resolve user references like `/fctry:evolve core-flow` to the actual section.

- **Project instructions (CLAUDE.md)** — Created by the Executor during `/fctry:execute`. Contains the factory contract (spec/scenario paths, agent authority, scenario validation), the approved build plan, convergence order, versioning rules, and project-specific architecture notes. Audited by the State Owner during `/fctry:review` (only after execute has been run at least once). Updated when spec paths, convergence strategy, or project structure change.

- **Spec viewer state** — The currently highlighted section (if an agent is working on it), the active change history entry (if the user is viewing a diff), and the WebSocket connection status. Ephemeral — lost when the viewer is closed.

- **Workflow state** — Tracked in `.fctry/fctry-state.json`. Records the current command, the active workflow step (e.g., `state-owner-briefing`, `interviewer`, `spec-writer`), completed steps for the current command, and the last agent that ran. Used by agents to validate prerequisites before proceeding. Cleared on session start.

- **Spec index (SQLite)** — A structured cache of the spec stored in `.fctry/spec.db`. Contains a `sections` table (alias, number, heading, content, parent section, word count, last updated) and a `changelog_entries` table (timestamp, affected sections, summary). Auto-rebuilds from the markdown spec whenever the file changes. Enables agents to query individual sections without loading the full spec, resolve cross-references, and search by content. The markdown file is always the source of truth — the database is a derived cache that can be deleted and rebuilt at any time.

- **Section readiness index** — Per-section readiness metadata stored in the SQLite cache. Each section has a readiness value: `draft` (content incomplete), `needs-spec-update` (code exists but spec doesn't describe it), `spec-ahead` (spec describes it but code doesn't exist), `aligned` (spec and code match), `ready-to-execute` (aligned and dependencies satisfied), or `satisfied` (scenarios passing). Written by the State Owner during every scan. Consumed by the Executor (filters build plans), the status line (readiness summary), and the viewer (section color-coding).

- **Untracked changes** — A count of files modified outside of fctry commands that map to spec-covered sections. Tracked in `.fctry/fctry-state.json` as `untrackedChanges` (an array of `{file, section, timestamp}` entries). Written by the PostToolUse hook when it detects a relevant file write. Cleared when the user runs `/fctry:review` or `/fctry:evolve` for the affected section.

### 3.3 Rules and Logic {#rules}

**Agent sequencing enforcement.** The State Owner always runs first, before any other agent acts. This is not merely documented — it's enforced. Each agent checks `workflowStep` and `completedSteps` in the state file before proceeding. If the State Owner hasn't produced a briefing, the agent surfaces a numbered error: "(1) Run State Owner scan now (recommended), (2) Skip (not recommended), (3) Abort." The system tracks workflow state across all agents for the duration of the command.

**Section readiness gating.** The Executor only includes sections with readiness of `ready-to-execute` or `spec-ahead` in build plans. Sections marked `draft` or `needs-spec-update` are excluded and surfaced to the user with a recommendation to run `/fctry:evolve` before building. This prevents building from incomplete or stale spec sections.

**Evolve preservation rule.** When updating a spec, the Spec Writer changes only the sections affected by the update. Unaffected sections remain byte-for-byte identical. This prevents accumulation of unintended drift over multiple updates.

**Scenario holdout rule.** Scenarios are stored in a separate file from the spec. The coding agent (invoked during execute) never sees the scenarios during development. Scenarios are used only for post-hoc satisfaction evaluation. This prevents the agent from "teaching to the test."

**Approval gate rule.** The Executor never begins a build without user approval of the build plan. If the plan changes mid-execution (e.g., a chunk fails and requires replanning), the Executor re-proposes and waits for approval.

**Section stability rule.** Section numbers are stable across spec updates. If a section is added, it gets the next available number in its parent section. If a section is removed, its number is retired (never reused). Aliases can change if section titles change, but changes preserve recognizability (e.g., `#core-flow` → `#core-list-flow`, never `#section-2-2`).

**Changelog append-only rule.** The changelog is never edited or rewritten. Entries are always appended. This ensures the full history of spec evolution is preserved for agent analysis.

**Project instructions currency rule.** During `/fctry:review`, if CLAUDE.md exists in the project root (indicating execute has been run), the State Owner audits it against the current spec and codebase. It checks spec/scenario file paths, factory contract, build plan, convergence order, versioning rules, repo structure, and any architecture notes. Drifted items are presented as numbered recommendations alongside spec drift. CLAUDE.md is not audited during other commands — only review.

**Drift detection signals.** The State Owner determines drift by comparing: (1) the spec's description of behavior, (2) the code's actual behavior (inferred via static analysis and recent commits), (3) the changelog (which sections changed recently), and (4) git log (when available — commit messages and timestamps provide additional evidence of code evolution). If the spec says X, the code does Y, and the changelog shows section X was updated more recently than the code, the spec is ahead. If the code was updated more recently (via git commits or file modification times), the code is ahead. If they diverged at similar times, it's a conflict requiring user resolution with numbered options.

**Reference interpretation rule.** When incorporating a reference, the Researcher or Visual Translator describes it in experience language (what the user sees, does, feels), never in technical language (which framework it uses, how it's built). The Spec Writer incorporates the experience description, not the technical details.

**Tool validation fail-fast rule.** If a required tool is missing, the system stops immediately with a clear error message and installation instructions. It never attempts to run a command that will fail later due to missing dependencies.

**Scenario satisfaction scoring.** For each scenario, the State Owner evaluates satisfaction on a three-point scale: fully satisfied (the scenario plays out exactly as described), partially satisfied (the scenario mostly works but has gaps or rough edges), not satisfied (the scenario doesn't work or is missing implementation). The overall satisfaction score is the fraction of scenarios that are fully satisfied.

**Chunk failure retry logic.** If a build chunk fails (code doesn't compile, tests fail, scenario satisfaction doesn't improve), the Executor retries once with an adjusted approach. If the retry fails, the Executor presents numbered options: (1) flag the scenario for manual review and continue, (2) stop execution, (3) retry with a different approach. Version tags are only created for successful chunks.

**Version increment rules.** Patch versions auto-increment with each successful chunk commit (0.1.1, 0.1.2, etc.). Minor versions are suggested when a full execute plan completes successfully. Major versions are suggested at significant experience milestones (e.g., all critical scenarios satisfied, a major capability section fully implemented). User approval is required for minor and major version bumps. Projects start at 0.1.0 on the first successful execute chunk.

**Commit timing rule.** One commit is created per completed chunk, immediately after scenario satisfaction is confirmed. The commit message format is: "Implement [feature description] (satisfies scenario '[scenario name]')". If multiple scenarios are satisfied by one chunk, all are listed in the commit message.

### 3.4 External Connections {#external-connections}

| Connects To | What Flows | Direction | If Unavailable |
|-------------|-----------|-----------|---------------|
| GitHub (via gh CLI) | Repository metadata, issues, PRs, code search results | Inbound | Researcher agent can't fetch GitHub references; user sees error |
| Firecrawl MCP | Web page content (crawled and structured) | Inbound | Researcher falls back to basic HTTP fetch (less structured) |
| Context7 / DeepWiki MCP | Documentation and API reference content | Inbound | Researcher falls back to basic HTTP fetch |
| Playwright MCP | Live browser screenshots for interactive references | Inbound | Visual Translator can't capture live screenshots; user must provide static images |
| Chrome DevTools MCP | DOM inspection and interaction pattern analysis | Inbound | Visual Translator can't analyze interactive behavior; limited to static visual interpretation |
| Local filesystem | Spec, scenarios, changelog, references, interview state, codebase | Bidirectional | N/A — system cannot operate without filesystem access |
| SQLite (spec index) | Section content, metadata, readiness, changelog entries | Bidirectional | Auto-rebuilds from markdown spec. If database is missing or corrupt, agents fall back to reading the full spec file directly. |
| WebSocket (spec viewer) | Real-time spec updates, section highlights, change events | Outbound | Spec viewer doesn't update live; user must refresh manually |

### 3.5 Performance Expectations {#performance}

**Startup.** Any `/fctry` command should respond within 5 seconds of invocation (tool validation + State Owner briefing).

**Interview flow.** The Interviewer should respond to each user answer within 2-5 seconds with the next question. No pauses longer than 5 seconds except when the user is typing.

**Spec generation.** After the interview completes, the Scenario Crafter and Spec Writer should produce the spec and scenarios within 90 seconds. The user sees a progress indicator ("Generating spec...") so they know the system is working.

**Spec updates (evolve, ref).** Updates to specific sections should complete within 45 seconds. The user sees the diff summary immediately after.

**Gap analysis (review).** The State Owner's deep state assessment should complete within 30 seconds. The gap analysis report appears immediately after.

**Build plan generation (execute).** The Executor should propose a build plan within 60 seconds of starting. The user sees the plan as soon as it's ready.

**Chunk execution.** Build chunks vary in duration (5-40 minutes depending on complexity). The user sees progress updates every 10-20 seconds so the system feels active, not stalled.

**Spec viewer rendering.** The spec should render in the browser within 1 second of opening the URL. Updates via WebSocket should appear within 500ms of the change happening on disk.

**Section navigation.** Clicking a section in the table of contents should scroll to that section within 200ms. Searching for a section (Ctrl+K) should show results within 500ms.

**Overall feel.** The system should feel responsive and conversational. The user should never wait more than 5 seconds without feedback (progress indicator, partial result, or status message).

---

## 4. Boundaries and Constraints

### 4.1 Scope {#scope}

**This spec covers:**

- The seven fctry commands (init, evolve, ref, review, execute, view, stop) and the user's experience of each
- The interview process (questions, answers, multi-session support, state persistence)
- Spec generation, evolution, and navigation (sections, aliases, diffs, changelog)
- Reference incorporation (URLs, screenshots, designs) and interpretation in experience language
- Gap analysis (spec vs. code, drift detection, conflict resolution)
- Build planning and execution (scenario-driven chunking, approval gates, pacing options)
- The live spec viewer (real-time updates, section highlighting, change history, keyboard navigation)
- Tool validation and error handling
- Agent orchestration (handoff protocol, sequencing, parallel execution where applicable)

**This spec does NOT cover:**

- The internal implementation of agents (their code, prompts, or LLM interactions) — those are left to the coding agent
- The NLSpec v2 template structure itself (that's a reference document, not part of fctry's user experience)
- Collaboration features (multiple users editing the same spec, permissions, access control) — v1 is single-user
- Deployment, hosting, or cloud sync (fctry runs locally as a Claude Code plugin)
- Integration with external project management tools (Jira, Linear, etc.) — out of scope for v1
- Git repository initialization or management (fctry integrates with git during execute when a repository exists, creating commits and version tags, but doesn't require git or initialize repositories — works identically without git, minus version control operations)

### 4.2 Platform and Environment {#platform}

| Dimension | Constraint |
|-----------|-----------|
| Platform | macOS or Linux (where Claude Code runs) |
| Runtime | Claude Code plugin (installed via `.claude-plugin/plugin.json`) |
| Devices | Desktop/laptop — command-line interface + browser for spec viewer |
| Connectivity | Requires internet for LLM API calls and external reference fetching (Researcher, Visual Translator). Spec generation and viewing work offline if references aren't needed. |
| Accounts | Single-user, local-first. No authentication, no cloud accounts. |
| Storage | Local filesystem in the project directory. SQLite database (`.fctry/spec.db`) as a derived cache for structured spec access — the markdown file is always the source of truth and the database can be deleted and rebuilt at any time. |

### 4.3 Hard Constraints {#hard-constraints}

**Claude Code plugin model.** fctry must operate as a Claude Code plugin invoked via slash commands. It cannot be a standalone CLI tool or web service. This is non-negotiable because the target user is already using Claude Code and expects plugins to integrate seamlessly.

**Experience language only.** The spec must describe what users see, do, and feel — never databases, APIs, or implementation details. This is the foundation of the Software Factory model and cannot be compromised. If the spec describes implementation, the coding agent has no creative freedom and the model breaks down.

**Scenario holdout separation.** Scenarios must live in a separate file from the spec and must not be visible to the coding agent during development. This is the core of the convergence model. If scenarios are in the spec, the agent can "teach to the test" and satisfaction becomes meaningless.

**Approval-gated execution.** The Executor must never begin a build or continue to the next chunk without explicit user approval. This is non-negotiable because unsupervised execution could consume unbounded time, resources, or cost (LLM API calls). The user must control the pace.

**State Owner first.** Every command must consult the State Owner before any other agent acts. This grounds all decisions in reality and prevents spec updates that ignore the current state of the codebase. Without this, the system becomes speculative and disconnected from reality.

**No code review by humans.** The spec and scenarios are the contract. No human reviews the code. The coding agent's implementation is validated solely through scenario satisfaction. This is the Software Factory model's defining constraint. If humans review code, the model collapses into traditional development.

### 4.4 Anti-Patterns {#anti-patterns}

**Must not become an IDE.** fctry is not a code editor, debugger, or integrated development environment. It operates at the spec level, not the code level. It must never offer features like "edit this function" or "set a breakpoint."

**Must not become a project management tool.** fctry is not Jira, Linear, or Asana. It tracks scenarios and spec sections, but it doesn't track tasks, sprints, or team velocity. It's a single-user spec authoring and build orchestration tool, not a collaboration platform.

**Must not silently overwrite.** Every spec update must be recorded in the changelog. Every change must be shown to the user. The system must never silently rewrite sections without the user knowing.

**Must not assume on conflicts.** When spec and code disagree, the system must surface the conflict and ask the user to resolve it. It must never assume the spec is right or the code is right without evidence (recency signals, changelog).

**Spec viewer must remain read-only.** The viewer is for observing, not editing. All changes must happen through `/fctry` commands. If the viewer allowed editing, it would bypass the agent orchestration and lose the conversational, approval-gated nature of the system.

**Must not skip tool validation.** If a required tool is missing, the system must fail immediately with installation instructions. It must never attempt to run a command that will fail later due to missing dependencies, leaving the user confused about what went wrong.

---

## 5. Reference and Prior Art

### 5.1 Inspirations {#inspirations}

- **StrongDM Software Factory** (https://factory.strongdm.ai/) — The philosophical foundation. Introduced the model of code not written by humans, code not reviewed by humans, tests as scenarios, and satisfaction over pass/fail. fctry translates this model into a practical system for non-coders.

- **Spec Markdown** (https://spec-md.com/) — Edit annotation syntax (`{++add++}`, `{--remove--}`) for showing changes inline. Stable section IDs that survive renames. fctry borrows both patterns for the spec viewer's change history.

- **Log4brains** (https://github.com/thomvaill/log4brains) — Timeline-based ADR (Architecture Decision Record) viewer with a sidebar showing chronological history and diffs on click. fctry's spec viewer uses this pattern for the change history timeline.

- **Docsify** (https://docsify.js.org/) — Zero-build documentation site generator. Markdown renders directly in the browser with no build step. fctry's spec viewer uses this approach for simplicity and instant updates.

- **Notion's Import UX** — Drag-and-drop file upload, progress indicator, preview-before-commit pattern. Referenced in section 2.5 as inspiration for the bulk import flow (example reference incorporation).

### 5.2 Experience References {#experience-references}

(This section will be populated as the user incorporates references via `/fctry:ref`. Each entry will include a stored image/asset and an experience-language interpretation.)

---

## 6. Satisfaction and Convergence

### 6.1 Satisfaction Definition {#satisfaction-definition}

The fctry system is satisfactory when:

- A non-coder with a project idea can run `/fctry:init`, describe their vision conversationally, and receive a complete, coherent spec within 20 minutes — without needing to understand databases, APIs, or architecture.

- The user can pause an interview, return days later, and resume exactly where they left off with no loss of context or repeated questions.

- The user can point to any part of the spec (by number or alias) and update it in isolation, seeing exactly what changed and confident that unrelated sections remain untouched.

- When the spec and code diverge, the system surfaces the conflict with specific evidence (recency, changelog, code behavior) and asks the user to resolve it, never guessing or assuming.

- The user can incorporate external inspiration (a URL, a screenshot, a design) and see it interpreted in experience language and integrated into the spec within 60 seconds.

- The user can run `/fctry:execute`, approve a build plan, and watch the system build toward scenario satisfaction — with clear progress updates, pacing control, and visibility into which scenarios are satisfied and which aren't.

- The user can open the spec viewer and see the spec rendered cleanly, watch it update in real-time as agents work, navigate the change history, and understand exactly what's changing and why.

- The user feels like they have a co-founder with perfect memory, deep context, and the ability to translate their vision into a buildable spec without them needing to learn to code.

### 6.2 Convergence Strategy {#convergence-strategy}

**Start with:** Core command loop and multi-session interviews.

The first working version demonstrates `/fctry:init` with conversational interviewing, state persistence (save and pause, resume), State Owner briefing, Scenario Crafter and Spec Writer producing the spec and scenarios, and addressable sections (aliases and numbers). The user can create a complete spec, stop partway, and resume later.

**Then layer in:** Evolve, ref, and review commands.

Once init works, add `/fctry:evolve <section>` with targeted interviews, diff summaries, and conflict resolution (spec vs. code drift detection). Add `/fctry:ref <url>` with Researcher and Visual Translator, experience-language interpretation, and both targeted and open modes. Add `/fctry:review` with gap analysis and recommendations.

**Next:** Execute with pacing and scenario-driven planning.

Add `/fctry:execute` with the Executor agent, scenario satisfaction evaluation, build plan proposal and approval, chunked execution, and three pacing options (highest priority, logically grouped, everything). The user can build from the spec with full control over pace.

**Then:** Tool validation and changelog integration.

Add startup tool validation (check for rg, sg, gh, MCP servers) with fail-fast errors and installation instructions. Add changelog maintenance (append-only, timestamped, machine-readable). Wire the State Owner to read the changelog for sharper drift detection and trajectory analysis.

**Finally:** Live spec viewer.

Add the local web UI (started via `/fctry:view`, stopped via `/fctry:stop`) with zero-build markdown rendering, WebSocket-based real-time updates, section highlighting when agents are working, change history timeline with diffs, and keyboard navigation. The user can watch the spec evolve in real-time.

### 6.3 Observability {#observability}

Key signals to watch:

- **Interview completion rate.** What fraction of users who start `/fctry:init` complete the interview vs. abandon partway? High abandonment suggests the interview is too long, too tedious, or not drawing out the vision effectively.

- **Multi-session usage.** How often do users pause and resume interviews? If rarely, multi-session support may not be needed. If frequently, it's critical — and we should watch how long between pause and resume (hours? days? weeks?).

- **Section update frequency.** Which sections get updated most often via `/fctry:evolve`? High churn in a section suggests it's under-specified or the user's vision is still forming. Low churn suggests the spec is stable.

- **Drift detection accuracy.** When the State Owner flags drift, how often does the user confirm it's real vs. dismiss it as a false positive? High false positive rate suggests the drift detection logic needs refinement.

- **Execute chunk success rate.** What fraction of build chunks succeed on first attempt vs. require retry or manual intervention? High retry rate suggests the spec is ambiguous or the coding agent is misinterpreting it.

- **Scenario satisfaction trajectory.** How quickly does satisfaction improve during `/fctry:execute`? Steady improvement suggests the build is converging. Flat or declining satisfaction suggests the spec and scenarios are misaligned or the coding agent is stuck.

- **Pacing choice distribution.** Do users mostly choose "highest priority," "logically grouped," or "everything"? This reveals user preference for control vs. speed.

- **Spec viewer usage.** Do users keep the viewer open while running commands? Do they interact with the change history? If the viewer is rarely used, it may not be delivering enough value to justify the complexity.

- **Tool validation failure rate.** How often do users hit missing tool errors? If frequently, the installation instructions need to be clearer or the tool dependency list needs to shrink.

- **Time to first spec.** How long does it take from `/fctry:init` to a complete, satisfactory spec? Target: under 20 minutes for a simple project. If consistently over 30 minutes, the interview is too long or the Spec Writer is too slow.

- **Workflow enforcement trigger rate.** How often do agents hit the "State Owner must run first" error? High rates suggest the enforcement is catching real process drift. If it never fires, the enforcement may be unnecessary overhead — or the process is being followed naturally.

- **Untracked change frequency.** How often does the PostToolUse hook detect file writes outside fctry commands that cover spec sections? High frequency suggests users are doing ad-hoc development between fctry commands — the nudge may need to be less intrusive, or `/fctry:review` needs to better reconcile untracked changes.

- **Section readiness distribution.** What fraction of sections are in each readiness state (draft, needs-spec-update, spec-ahead, aligned, ready-to-execute, satisfied)? A project with many `needs-spec-update` sections has code outpacing the spec. A project with many `spec-ahead` sections has a detailed spec but little implementation.

- **Spec index rebuild frequency.** How often does the SQLite cache rebuild from the markdown? Frequent rebuilds (every few seconds) during active evolve sessions are expected. Rebuilds outside of fctry commands suggest the user is editing the spec manually — which should be rare.

### 6.4 What the Agent Decides {#agent-decides}

The coding agent has full authority over:

- Technology choices (language, framework, database, tooling) — The spec describes experience; the agent picks the stack that best delivers it.
- Architecture and code structure — Monolith, microservices, layered, hexagonal — all agent decisions.
- Data model design — Tables, schemas, indexes, relations — inferred from the entities described in section 3.2, but the agent designs the actual data model.
- Internal APIs and interfaces — How components talk to each other, what data they exchange, what contracts they expose — all agent decisions.
- Testing strategy and tooling — Unit tests, integration tests, E2E tests (beyond the scenarios) — agent's choice.
- Build and deployment configuration — How the code is built, bundled, and run — agent's choice.
- Error handling implementation — How errors are caught, logged, and recovered from — agent's choice, constrained only by the user experience in section 2.10.
- Performance optimization approach — Caching, indexing, lazy loading, batching — agent's choice, constrained only by the performance expectations in section 3.5.
- Agent implementation (prompts, orchestration logic, file I/O, state management) — The coding agent that builds fctry itself decides how the agents are implemented, how they communicate, and how state is persisted.
- MCP server implementation (WebSocket protocol, markdown rendering, change history storage) — The coding agent decides how the spec viewer is built and served.

The agent's implementation decisions are constrained only by:

- The design principles in section 1.3 (experience language, agent decides, grounded in reality, approval-gated, conversational, progressive, addressable)
- The hard constraints in section 4.3 (Claude Code plugin model, experience language only, scenario holdout separation, approval-gated execution, State Owner first, no code review)
- The experience described in section 2 (what the user sees, does, and feels at every step)
- Satisfaction of the scenarios in fctry-scenarios.md (the holdout set)

No human reviews the code. The code is validated solely through scenario satisfaction and convergence.

---

## Appendix A: Decision Rationale

**Why experience language only, never implementation language?**

The target user is a non-coder with a clear vision but no mental model of databases, APIs, or architecture. If the spec uses technical language, the user can't meaningfully review or refine it. Experience language ("the user sees a list sorted by urgency") is accessible, reviewable, and precise enough for a coding agent to infer implementation. This decision rules out any UI that asks the user about technical details.

**Why are scenarios in a separate file from the spec?**

In machine learning, holdout sets are kept separate from training data to prevent overfitting. The same principle applies here: if scenarios are visible to the coding agent during development, the agent can "teach to the test" by implementing exactly what the scenarios check and nothing more. Separation ensures the agent builds from the spec (the experience) and scenarios validate the result, not guide it.

**Why must the State Owner always run first?**

Without grounding in reality, spec updates become speculative. The State Owner provides the current state: what code exists, what the spec says, where they diverge, what changed recently. Every other agent operates on this briefing. If the State Owner runs later (or not at all), agents work from assumptions, leading to specs that describe things that don't exist or ignore things that do.

**Why addressable sections with both aliases and numbers?**

Humans remember concepts, not numbers. "The core flow" is easier to recall than "section 2.2." But numbers provide stable, unambiguous references that survive renames. Supporting both gives users the flexibility to reference sections however they think about them, without the system needing to guess or resolve ambiguity.

**Why approval gates on execution?**

Autonomous builds without human oversight can consume unbounded time, cost (LLM API calls), and resources. The user must control when builds run, how much work happens per session, and when to stop. Approval gates ensure the user is always in the loop, never surprised by a runaway build.

**Why multi-session interviews?**

Real projects are complex. Users need time to think, gather information, or consult others before answering some questions. Forcing completion in one session leads to shallow specs or abandoned interviews. Multi-session support respects the user's time and thinking process, making spec authoring a progressive activity rather than a marathon session.

**Why enforce the workflow instead of just documenting it?**

Documentation describes intent; enforcement ensures adherence. When the process is only documented, Claude can (and does) skip steps — going straight to code when a quick fix seems obvious, bypassing the State Owner scan, updating code without updating the spec. For a non-coder, this is invisible: they think they're working within the factory model, but they're actually in ad-hoc mode. Enforcement makes the boundary explicit. The numbered-options error ("Run State Owner now / Skip / Abort") keeps it conversational rather than rigid — the user can always skip, but they do so consciously.

**Why SQLite as a cache instead of as the primary store?**

The markdown spec must remain portable and human-readable. A non-coder should be able to open the spec in any text editor or viewer. Making SQLite the primary store would lock the spec behind a database that requires tooling to read. By keeping markdown as source of truth and SQLite as a derived cache, the system gets structured queries (section-level access, cross-references, readiness filtering) without sacrificing portability. If the database file is deleted, corrupted, or missing, agents fall back to reading the full markdown file — the system degrades gracefully rather than failing.

**Why detect untracked changes via a hook instead of only during review?**

Non-coders may not realize that fixing a bug directly in code creates drift between the spec and the implementation. By the time they run `/fctry:review`, the drift may have compounded across multiple files. Real-time detection surfaces the issue immediately with a gentle nudge — not a blocking error. The user can dismiss it and reconcile later, but they're aware. This is designed to be dialed back: if the nudge proves too intrusive, it can be moved to `/fctry:review`-only detection without changing the spec.

**Why does the spec viewer auto-start silently instead of requiring `/fctry:view`?**

Observability should be always available, not opt-in. The viewer runs on a plugin hook that fires on every prompt, but the `ensure` logic makes it a no-op (<5ms) when no spec exists or the viewer is already running — so it never slows anything down. Auto-start uses `--no-open` to avoid surprise browser tabs; the user runs `/fctry:view` when they want to actually look at the viewer. Auto-stop on session end (via `SessionEnd` hook) means no orphaned processes. The result: the viewer is always ready when the user wants it, never in the way when they don't.

---

## Appendix B: Glossary

| Term | Meaning |
|------|---------|
| **Experience language** | Descriptions of what users see, do, and feel — never databases, APIs, or code. Example: "The user sees a list of items sorted by urgency, with overdue items highlighted." |
| **NLSpec v2** | Natural Language Specification format, version 2. A structured template for describing software systems in experience language. See `references/template.md`. |
| **Scenario** | A user story that describes a complete journey through the system, written in experience language. Scenarios form the holdout set used to evaluate satisfaction. |
| **Holdout set** | In machine learning, a dataset kept separate from training to prevent overfitting. Here: scenarios kept separate from the spec to prevent the coding agent from "teaching to the test." |
| **Satisfaction** | Probabilistic measure of success: of all observed trajectories through all scenarios, what fraction satisfy the user? Replaces binary pass/fail. |
| **State Owner** | The first agent in every command. Scans the codebase, reads the spec and changelog, detects drift, and produces a briefing that grounds all other agents in reality. |
| **Briefing** | A document produced by the State Owner summarizing the current state: project classification, scenario satisfaction, drift, recent changes, and recommendations. |
| **Drift** | When the spec and code describe different behavior. Detected by comparing spec text, code behavior, and recency signals (commits, changelog). |
| **Chunk** | A discrete unit of work in a build plan, focused on satisfying one or more scenarios. Executed sequentially with approval gates between chunks. |
| **Addressable section** | A section of the spec with both a number (e.g., `2.2`) and a stable alias (e.g., `#core-flow`). Both can be used in commands to reference the section. |
| **Changelog** | An append-only log of spec updates, timestamped and machine-readable. Read by the State Owner to understand the trajectory of spec evolution. |
| **Pacing options** | After each build chunk, the user chooses: highest priority (single most impactful scenario), logically grouped (coherent set), or everything (all remaining work). |
| **Workflow enforcement** | The system's mechanism for ensuring agents follow the prescribed workflow (State Owner first → domain agents → Scenario Crafter → Spec Writer). Agents validate prerequisites before proceeding; violations surface as numbered errors. |
| **Spec index** | A structured SQLite cache (`.fctry/spec.db`) derived from the markdown spec. Contains section content, metadata, readiness, and changelog entries. Enables agents to query individual sections without loading the full spec. |
| **Section readiness** | Per-section metadata indicating the section's current state: `draft`, `needs-spec-update`, `spec-ahead`, `aligned`, `ready-to-execute`, or `satisfied`. Assessed automatically by the State Owner. |
| **Untracked changes** | File modifications made outside fctry commands that affect code covered by spec sections. Detected by a PostToolUse hook and surfaced to the user for reconciliation. |
| **Software Factory model** | A development model where code is written entirely by machines, validated entirely through scenarios (not human code review), and success is measured by satisfaction (not pass/fail). See StrongDM's article: https://factory.strongdm.ai/ |
