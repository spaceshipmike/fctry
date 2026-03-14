---
description: Incorporate external references into the spec (URLs, screenshots, designs, knowledge base)
argument-hint: "[section alias or number] <URL, screenshot, design reference, or 'knowmarks'>"
---

# /fctry:ref

Bring external inspiration into the spec: URLs, repos, articles, screenshots,
design mockups, or knowledge base searches. The appropriate agent investigates,
and the Spec Writer updates the spec accordingly.

## Empty Arguments (Inbox-First Mode)

If `/fctry:ref` is called with no arguments, check `.fctry/inbox.json` for
processed reference items before prompting for a URL.

**If processed reference items exist**, present them via `AskUserQuestion`:

```
You have 3 references ready to incorporate:

(1) starbaser/ccproxy — Claude Code request/response hooks
    Note: "could we use this for model routing?"
(2) AsyncFuncAI/deepwiki-open — AI wiki generator for repos
(3) Dimon94/cc-devflow — Requirement dev flow for Claude Code

Pick one or more (e.g. "1,3"), or provide a new URL:
```

Rules:
- Show the title from `analysis.title` (shortened to repo name or page title)
- If `analysis.note` exists, show it indented below the title
- Support batch selection: the user can enter comma-separated numbers (e.g.
  "1,3") to incorporate multiple references in sequence
- Always include a "provide a new URL" escape hatch as the last option
- If the user picks one reference, run the standard ref workflow using the
  inbox item's pre-analyzed data (skip fresh fetch unless the user requests it)
- If the user picks multiple, run the ref workflow for each in sequence,
  with the Spec Writer batching all updates into one pass
- After incorporation, mark consumed inbox items with
  `status: "incorporated"` and a `consumedBy` field

**If no processed reference items exist**, fall back to a prompt:
```
No references queued. Provide a URL, screenshot, or design reference to
incorporate, optionally with a section target:

/fctry:ref https://example.com/article
/fctry:ref 2.1.3 https://example.com/design
```

## Section Targeting

Users can target a specific section, or let the system infer relevance:

```
/fctry:ref 2.1.3 https://github.com/example/repo  — targeted to section 2.1.3
/fctry:ref core-flow https://example.com/article   — targeted by alias
/fctry:ref https://example.com/design.png          — open: system infers relevance
```

### Alias Resolution Protocol

Follow the standard protocol in `references/alias-resolution.md` with
the `/fctry:ref` adaptation: the reference (URL, file path, or screenshot)
is always the **last argument**. Everything before it is a potential section
target. No section target → **open mode** (system infers relevance).

### Targeted Mode

The first argument resolves as a section alias or number. The Researcher or
Visual Translator investigates the reference specifically in the context of
that section. The State Owner scopes its briefing to that section and its
dependencies. The Spec Writer updates only that section.

### Open Mode

No section target. The domain agent explores the reference broadly,
identifies which parts of the spec it's relevant to, and presents findings
with recommended section targets as numbered options. The user confirms
before the Spec Writer updates.

## Knowledge Base Mode

If the first argument is `knowmarks`, the system searches the user's knowmarks
knowledge base instead of fetching a specific URL. Uses `mcp__knowmarks__search`
and `mcp__knowmarks__get_knowmark` MCP tools.

### Argument Patterns

```
/fctry:ref knowmarks                       — auto-generate queries from project state
/fctry:ref knowmarks "feedback loop"       — search with specific query
/fctry:ref execute-flow knowmarks "retro"  — search + target a section
```

### Auto-Query Generation (no query provided)

When `knowmarks` is invoked without a quoted query, auto-generate search
queries by examining:

1. **Weak areas** — sections with low readiness or thin spec content
2. **Convergence targets** — the next uncompleted phase in `#convergence-strategy`
3. **User focus** — current `activeSection` from state, or recent evolve targets

Generate 2-3 targeted search queries and run them in parallel. Deduplicate
results across queries before presenting.

### Presentation

Present results as numbered options with title and one-line relevance:

```
Found 6 items in your knowledge base matching "feedback loop":

(1) boshu2/agentops — DevOps layer for coding agents with compounding memory
(2) comet-ml/opik — LLM evaluation platform with LLM-as-judge
(3) sambaleuk/Vibetape-MCP — Hybrid memory MCP with semantic scoring
(4) al3rez/ooda-subagents — OODA loop framework for agent feedback cycles

Pick one or more (e.g. "1,3"), or provide a different query:
```

### Selection Processing

- Single selection: fetch URL from `mcp__knowmarks__get_knowmark`, run
  standard Researcher workflow
- Batch selection (comma-separated): research selected items in parallel,
  Spec Writer batches all updates into one pass
- "provide a different query": re-search with new query
- User can also type a URL to exit knowmarks mode and use standard ref

### Graceful Degradation

If `mcp__knowmarks__search` is not available (tool not found or MCP server
not configured), report clearly and fall back to the URL prompt:

```
Knowmarks MCP server is not available. Provide a URL instead:
```

## Discover Mode

If the first argument is `discover`, run the automated discovery loop
instead of processing a specific reference. This is the manual trigger for
the self-improvement pipeline.

```
/fctry:ref discover              — detect gaps, search for inspiration, queue to inbox
/fctry:ref discover --dry-run    — preview what would be found without queuing
```

### Workflow

1. Run `scripts/discovery-loop.js` for the current project directory
2. The script chains: detect-gaps → discover-sources → novelty filter → inbox queue
3. Report results to the user:

```
Discovery loop complete — 3 recommendations queued to inbox:

  1. electron (github, 115k★) → Desktop App (2.x)
     Build cross-platform desktop apps with JavaScript, HTML, and CSS
  2. pake (github, 32k★) → Desktop App (2.x)
     Turn any webpage into a desktop app with one command
  3. flet (github, 12k★) → Desktop App (2.x)
     Build realtime web, mobile and desktop apps in Python

Review with /fctry:ref (no args) to incorporate.
```

4. If no gaps are found or all gaps are on cooldown (researched within 24h),
   say so: "No new gaps to research — all sections are either covered or on
   cooldown. Run again tomorrow or use /fctry:ref <url> to incorporate a
   specific reference."

### No Agents Needed

Discover mode does NOT invoke the agent pipeline (no State Owner, no
Researcher, no Spec Writer). It runs a standalone Node.js script that
makes GitHub/npm API calls and writes to inbox.json. Zero LLM cost.
The user reviews discovered items via `/fctry:ref` (no args, inbox-first mode)
when they're ready to incorporate.

## Inbox Consumption

Two paths depending on how `/fctry:ref` was invoked:

### Path A: No arguments (inbox-first)

Handled by the Empty Arguments section above. The user selects from processed
inbox items. The selected item's `analysis` (title, excerpt, note) becomes
the starting context for the Researcher or Visual Translator — no fresh
fetch needed unless the user explicitly requests it.

### Path B: URL provided (URL-matching)

Before the workflow starts, check `.fctry/inbox.json` for pending or processed
**reference** items matching the provided URL (same URL or same domain). If a
match exists, surface the pre-processed analysis:

```
This URL was already queued in the inbox and pre-analyzed:
  Title: "Modern Dashboard Patterns"
  Summary: Reference fetched — ready for /fctry:ref

(1) Use the pre-analyzed context (recommended — saves a fetch)
(2) Re-fetch and analyze fresh
```

When incorporated: the Researcher or Visual Translator starts with the
pre-analyzed data rather than fetching from scratch. After the ref completes,
mark the consumed inbox item with `status: "incorporated"` and add a
`consumedBy` field with the command name and timestamp.

If no matching inbox items exist, skip this step silently.

## Workflow

0. **Status state** → Write `currentCommand: "ref"` and `completedSteps: []`
   to `.fctry/state.json` (read-modify-write per
   `references/state-protocol.md`). Clearing `completedSteps` resets the
   workflow for this command.
1. **State Owner ‖ Router** → These run in parallel:
   - **State Owner** → Briefing on current spec and codebase state, focused on
     what areas the reference might affect. When a section is targeted, scopes
     to that section and its dependencies. Appends `"state-owner-scan"` to
     `completedSteps`.
   - **Router** → Based on what was shared:
     - URL/repo/article → **Researcher** explores, produces a research briefing.
       Appends `"researcher"` to `completedSteps`.
     - Screenshot/mockup/design → **Visual Translator** interprets, stores image
       in `references/` and writes experience-language description. Appends
       `"visual-translator"` to `completedSteps`.
     - `knowmarks` → Search the user's knowledge base via
       `mcp__knowmarks__search`. Present results, get user selection, then
       fetch each selected item's URL via `mcp__knowmarks__get_knowmark`
       and hand to the **Researcher** for standard ref processing. Batch
       selections research in parallel. Appends `"researcher"` to
       `completedSteps` after all selections are processed.
   Note: The Researcher/Visual Translator skips the State Owner prerequisite
   check in this parallel mode (see `agents/researcher.md`).
2. **Spec Writer** → Validates `"state-owner-scan"` and (`"researcher"` or
   `"visual-translator"`) in `completedSteps`. Receives the State Owner
   briefing AND the research/visual findings. Updates relevant spec sections.
   Links visual references. Preserves all existing section aliases. Appends
   `"spec-writer"` to `completedSteps`.

## Output

- Updated `.fctry/spec.md` (referencing changed sections by alias)
- New entries in `.fctry/references/` (if visual)
- Summary of what was learned and what changed

### Next Steps

After the change summary, include conditional next steps based on what
happened:

- **Updated existing section** →
  `Run /fctry:evolve <section> to refine further, or /fctry:execute to build`
- **Added content to thin section** →
  `Run /fctry:review to check fit with surrounding sections`
- **Broad changes (open mode)** →
  `Run /fctry:review for overall coherence, then /fctry:execute`
