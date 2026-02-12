---
description: Build from the spec — assess state, propose a build plan, drive implementation
argument-hint: "[scenario name or section alias] or [--review]"
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
- **`/fctry:execute [section]`** — Section-targeted. Focus on scenarios that
  relate to a specific spec section (by alias or number). Example:
  `/fctry:execute core-flow` builds toward scenarios that validate `#core-flow`.
- **`/fctry:execute --review`** — Assessment only. State Owner scans, Executor
  evaluates scenario satisfaction, but doesn't propose a build plan. Good for
  checking progress.

### Argument Resolution

Follow the standard protocol in `references/alias-resolution.md` with
the `/fctry:execute` adaptation: try section resolution first, then fall
back to scenario matching against `{project-name}-scenarios.md` (fuzzy:
substring match is fine). Also supports `--review` flag for
assessment-only mode (no build plan). If neither section nor scenario
matches, list both as numbered options.

## Pacing Options

After each build chunk completes, the Executor commits the chunk (if git
exists), auto-tags a patch version, then presents numbered pacing options:

(1) **Highest priority** — The single most impactful unsatisfied scenario
(2) **Logically grouped** — A coherent set of related scenarios
(3) **Everything** — All remaining unsatisfied scenarios

The progress report includes: commit hash, version tag, section aliases
and numbers to review. Example: "Committed `a3f2c1d` (v0.1.2) — satisfies
'Sorting by Urgency Happy Path'. Check `#onboarding` (2.1) and
`#error-handling` (2.4)."

## Versioning

Semantic versioning adapted to the factory model. Projects start at `v0.1.0`.

- **Patch** (0.1.**X**) — Auto-tagged with each chunk commit. No approval needed.
- **Minor** (0.**X**.0) — Executor suggests when the approved plan completes.
  User approves.
- **Major** (**X**.0.0) — Executor suggests at significant experience milestones
  (first working version, major new capability). User approves.

If `.git` does not exist, execute works identically minus commits and tags.

## Tool Validation

Before the first execute run (or when `.fctry/tool-check` doesn't exist),
validate tool availability. See `references/tool-dependencies.md` for the
full list. At minimum, execute requires: file read/write, rg, and web search.
If `.fctry/tool-check` exists and is recent, skip validation.

Present missing tools with numbered options (same format as init).

## Workflow

1. **State Owner** → Deep scan of codebase vs. spec. Produces a state briefing
   covering: what's built, what works, what's missing, which scenarios are
   currently satisfied and which aren't. References sections by alias.
2. **Executor** → Reads the spec, the scenarios, and the State Owner's briefing.
   Proposes a build plan: which scenarios to tackle next, in what order, and why.
   Presents the plan to the user for approval or adjustment. References spec
   sections by alias and number in the plan.
3. **Build loop** → Once the user approves a plan (or adjusts it), the Executor
   sets up the project's CLAUDE.md with factory rules and begins building. After
   each chunk: commit, patch tag, scenario assessment, progress report, numbered
   pacing options. At plan completion: suggest minor/major version tag.

**The user controls the pace.** The Executor proposes, the user approves. The
user can say "just do the first two scenarios" or "skip that one for now" or
"stop after the layout work." The Executor respects boundaries.

## Output

- Build plan (presented for approval before any code is written)
- Updated project CLAUDE.md with factory contract
- Git commits per chunk with scenario-referencing messages (when git exists)
- Patch version tags per chunk, minor/major tags at milestones
- Progress report after each build milestone (with commit hash, version, section aliases to review)

### Next Steps (at plan completion)

After version tagging, include conditional next steps based on scenario
satisfaction:

- **All scenarios satisfied** →
  `Run /fctry:review to confirm spec-code alignment, then /fctry:evolve to add new features when ready`
- **Unsatisfied scenarios remain** →
  `Run /fctry:execute for a new plan targeting remaining scenarios, or /fctry:evolve if the spec needs adjusting first`
