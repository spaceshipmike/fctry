# /fctry:next

Lightweight next-action recommender. Reads cached state and instantly suggests
what to do next — no codebase scan, no agent pipeline. The defining trait is
speed: the user gets an answer before they finish reading the output.

## Workflow

**No State Owner scan.** This command explicitly skips the full agent pipeline.
It reads only what's already cached on disk.

### 1. Read cached state

Read these files (all optional — missing files mean empty state):

- `.fctry/state.json` — build run status, section readiness, untracked changes,
  scenario scores, current command
- `.fctry/inbox.json` — pending async items (evolve ideas, reference URLs,
  feature requests)
- `.fctry/spec.md` — only the frontmatter (spec-version) and convergence
  strategy section, not the full spec

If no `.fctry/spec.md` exists, recommend `/fctry:init` and stop.

### 2. Evaluate priority chain

Apply candidates in this order. Recommend the **first** that applies:

| Priority | Condition | Recommendation | Rationale includes |
|----------|-----------|---------------|--------------------|
| 1 | `buildRun` in state.json has `status: "running"` with incomplete chunks | `/fctry:execute` to resume | Build run ID, completed/total chunk count, next chunk name |
| 2 | `untrackedChanges` array in state.json is non-empty | `/fctry:evolve` targeting affected sections | Change count, affected section names |
| 3 | `inbox.json` has pending items (items without `status: "incorporated"`) | `/fctry:ref` for reference URLs, `/fctry:evolve` for evolve ideas — whichever type has more pending items | Item count, breakdown by type |
| 4 | `sectionReadiness` in state.json has sections with `ready-to-build` or `ready-to-execute` status | `/fctry:execute` | Count of ready sections, name the one that's next in convergence order |
| 5 | Convergence strategy has incomplete phases | Command that advances the next phase | Phase name from `#convergence-strategy` (6.2) |
| 6 | Nothing applies | "All clear" message | Brief confirmation that everything is aligned |

### 3. Present recommendation

Format:

```
Your next move: /fctry:{command} — {one-liner rationale}.

(1) Go
(2) Show other options
(3) Cancel
```

Use `AskUserQuestion` with these three options.

### 4. Handle response

- **(1) Go** — Chain into the recommended command. The full agent pipeline for
  that command runs normally from here. Pass any relevant context (e.g., for
  evolve, pre-load the drift context so the user doesn't re-explain).
- **(2) Show other options** — Show up to 3 ranked alternatives from the
  priority chain (skipping the one already presented). Each shows the command
  and a one-liner rationale. Present via `AskUserQuestion` with the
  alternatives plus a Cancel option. On selection, chain into that command.
- **(3) Cancel** — End. No further action.

### 5. "Nothing to do" state

When priority 6 (nothing applies) is reached, output a brief, satisfying
message:

```
Everything's in good shape. All sections aligned, inbox empty, no drift detected.
```

No manufactured busywork. No "run review just in case." If future-phase
sections exist but aren't ready, don't recommend action on them.

## Notes

- **Performance target:** Under 2 seconds. Read cached files only. Never run
  `assess-readiness.js`, never scan the codebase, never invoke the State Owner.
- **Single project scope.** Operates on the current project only. No
  cross-project aggregation.
- **Stale state is OK.** If cached state is from a previous session, give a
  best-effort recommendation from what's available. Don't fall back to a slow
  scan. If the state looks very stale, the priority chain will naturally
  surface `/fctry:review` as an option through the convergence fallthrough.
- **No state file writes.** This command does not write to `state.json`. It is
  purely read-only. It does not set `currentCommand` or `completedSteps`.

## Output

- Single recommendation with rationale
- Optional ranked alternatives (on request)
- Chain into selected command (seamless handoff)

### Next Steps

Not applicable — this command chains into another command, which provides its
own next steps.
