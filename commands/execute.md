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
back to scenario matching against `.fctry/scenarios.md` (fuzzy:
substring match is fine). Also supports `--review` flag for
assessment-only mode (no build plan). If neither section nor scenario
matches, list both as numbered options.

## Autonomous Execution

Plan approval is the only gate. The user approves the build plan once —
adjusting scope, reordering chunks, or asking questions as needed. Once
approved, the Executor executes the entire plan autonomously.

During the build, the Executor:
- Runs independent chunks concurrently and sequences dependent ones
  automatically
- Handles code failures, test failures, and rearchitecting decisions
  silently — the user is never interrupted for technical problems
- Resurfaces only for **experience-level questions** — when the spec is
  ambiguous or contradictory in a way that affects what the user sees or
  does (e.g., "Should items without a due date appear at the top or bottom
  of the urgency sort?")
- Commits each successful chunk with a message referencing satisfied
  scenarios, and auto-tags patch versions

When the build completes, the Executor presents an experience report
describing what the user can now do — not satisfaction percentages or
scenario IDs.

## Versioning

Semantic versioning adapted to the factory model. Projects start at `v0.1.0`.
Version tagging happens autonomously during the build.

- **Patch** (0.1.**X**) — Auto-tagged with each successful chunk commit. No
  approval needed. Tags are only created for chunks that succeed.
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

0. **Status state** → Write `currentCommand: "execute"` and `completedSteps: []`
   to `.fctry/state.json` (read-modify-write per
   `references/state-protocol.md`). Clearing `completedSteps` resets the
   workflow for this command.
1. **State Owner** → Deep scan of codebase vs. spec. Runs section readiness
   assessment (`node src/spec-index/assess-readiness.js`). Produces a state
   briefing covering: what's built, what works, what's missing, which scenarios
   are currently satisfied and which aren't, and section readiness summary.
   References sections by alias. Writes `readinessSummary` to state file.
   Appends `"state-owner-scan"` to `completedSteps` on completion.
2. **Executor** → Validates `"state-owner-scan"` in `completedSteps`. Reads
   the spec, the scenarios, and the State Owner's briefing. **Filters by
   readiness** — only includes sections with readiness `aligned`, `spec-ahead`,
   or `ready-to-execute` in the build plan. Notes sections blocked by `draft`
   status. Proposes a build plan: which scenarios to tackle next, in what order,
   and why. Presents the plan to the user for approval or adjustment. References
   spec sections by alias and number in the plan. Appends `"executor-plan"` to
   `completedSteps` after plan approval.
3. **Autonomous build** → Once the user approves a plan (or adjusts it), the
   Executor sets `workflowStep: "executor-build"` and executes the entire plan
   autonomously. Independent chunks run concurrently; dependent chunks are
   sequenced automatically. The Executor handles failures silently — retrying,
   rearchitecting, or moving on as needed. Each successful chunk gets a commit
   and patch tag. The user is interrupted only for experience-level questions
   (spec ambiguity about what the user sees or does). At plan completion:
   experience report and version tag suggestion. Appends `"executor-build"` to
   `completedSteps`.

**Plan approval grants autonomous authority.** The user controls scope and
direction through the plan itself — adjusting chunks, reordering, or
excluding scenarios before approval. Once approved, the Executor owns the
build. The factory line is clear: human collaborates on vision, machine builds.

## Output

- Build plan with parallelization and git strategy (presented for approval before any code is written)
- Enriched project CLAUDE.md with build-specific layer (preserving evergreen content from init)
- Git commits per chunk with scenario-referencing messages (when git exists)
- Patch version tags per successful chunk, minor/major tags at milestones
- Experience report at build completion (what the user can now do, in concrete terms)

### Next Steps (at plan completion)

After the experience report and version tagging, include conditional next
steps based on scenario satisfaction:

- **All scenarios satisfied** →
  `Run /fctry:review to confirm spec-code alignment, then /fctry:evolve to add new features when ready`
- **Unsatisfied scenarios remain** →
  `Run /fctry:execute for a new plan targeting remaining scenarios, or /fctry:evolve if the spec needs adjusting first`
