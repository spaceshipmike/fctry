---
name: fctry:next
description: >
  Instant next-action recommendation from cached state. Use when the user says
  "what's next", "what should I do next", "next action", "what now", or invokes
  /fctry:next. Reads cached state files — no codebase scan, no agent pipeline.
---

# /fctry:next

Lightweight next-action recommender. Read the full command workflow at
`commands/next.md` relative to the plugin root.

## Quick Reference

The command reads `.fctry/state.json` and `.fctry/inbox.json`, applies a
priority chain, and recommends a single next action:

1. Incomplete build → resume `/fctry:execute`
2. Untracked changes → `/fctry:evolve` for affected sections
3. Inbox items → `/fctry:ref` or `/fctry:evolve` by item type
4. Ready-to-build sections → `/fctry:execute`
5. Convergence fallthrough → next phase command
6. Nothing to do → brief "all clear"

**Performance target:** Under 2 seconds. No State Owner scan. No agent pipeline.
Read cached files only.

**Feature names in output.** Use feature names (section titles from the spec TOC)
and status vocabulary (`built`/`specced`/`unspecced`/`partial`) in all
recommendations — never aliases or readiness labels. See `commands/next.md`.

## Execution

Read and follow the full workflow in `commands/next.md`.
