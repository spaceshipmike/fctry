---
description: Build from the spec — assess state, propose a build plan, drive implementation
argument-hint: "[scenario name] or [--review]"
---

# /fctry:execute

Kick off factory mode. Read the spec and scenarios, assess current state, and
build toward satisfying unsatisfied scenarios. This is the command that closes
the loop between speccing and building.

## Modes

- **`/fctry:execute`** (no args) — Full assessment. State Owner scans, Executor
  proposes a complete build plan across all unsatisfied scenarios. Good for
  starting a new build or resuming after a break.
- **`/fctry:execute [scenario]`** — Targeted. Focus on a specific scenario or
  scenario group. Good for incremental work sessions.
- **`/fctry:execute --review`** — Assessment only. State Owner scans, Executor
  evaluates scenario satisfaction, but doesn't propose a build plan. Good for
  checking progress.

## Workflow

1. **State Owner** → Deep scan of codebase vs. spec. Produces a state briefing
   covering: what's built, what works, what's missing, which scenarios are
   currently satisfied and which aren't.
2. **Executor** → Reads the spec, the scenarios, and the State Owner's briefing.
   Proposes a build plan: which scenarios to tackle next, in what order, and why.
   Presents the plan to the user for approval or adjustment.
3. **Build loop** → Once the user approves a plan (or adjusts it), the Executor
   sets up the project's CLAUDE.md with factory rules and begins building. After
   each significant milestone, it pauses to reassess scenario satisfaction.

**The user controls the pace.** The Executor proposes, the user approves. The
user can say "just do the first two scenarios" or "skip that one for now" or
"stop after the layout work." The Executor respects boundaries.

## Output

- Build plan (presented for approval before any code is written)
- Updated project CLAUDE.md with factory contract
- Progress report after each build milestone
