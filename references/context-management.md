# Context Management

The context window is a finite resource. This reference covers fidelity modes,
degradation patterns, budget gate protocol, and lifecycle events. The Executor
loads this when context pressure is relevant.

## Core Principle

Each build chunk must operate with sufficient context to do its work well,
regardless of how many chunks preceded it. Context pressure must never
degrade build quality — the last chunk should be as sharp as the first.

## Persist State Through Files

Build state lives in `.fctry/state.json` (checkpoints, chunk progress, workflow
state), git commits (artifacts), and CLAUDE.md (compact instructions, build plan,
architecture notes). If the context window compacts or clears, the build recovers
from these files — not from memory.

## Chunk Context Labels

Label each chunk in the build plan as either:
- **Isolated** — clean context, no dependency on prior chunk outputs. Can run
  independently.
- **Context-carrying** — requires injected results from completed predecessor
  chunks. The `dependsOn` field identifies which chunks feed context forward.

## Fidelity Modes

When a context-carrying chunk depends on a completed chunk, choose how much
context carries forward:

- **Full transcript** — entire conversation history (reliability-first)
- **Trimmed transcript** — full conversation with tool result bodies stubbed
  out, preserving reasoning chain while reclaiming ~50% of token budget
  (reliability-first with token pressure)
- **Structured summary** — key decisions and artifacts only (speed-first)
- **Fresh start** — only file artifacts, re-read spec (token-efficiency-first)

### Cognitive Tier Anchoring

- **Mechanical chunks** (git ops, renames, formatting): fresh start is
  sufficient.
- **Implementation chunks** (new features, bug fixes): structured summary or
  trimmed transcript.
- **Architecture chunks** (cross-codebase restructuring): full or trimmed
  transcript — maximal fidelity.

Execution priorities act as the override layer: speed-first may override full
transcript even for architecture chunks.

## Context Degradation Awareness

When diagnosing unexpected build behavior, consider these four degradation modes
before attributing the problem to spec ambiguity or code bugs:

- **Lost-in-the-middle:** Tokens in the middle of long contexts receive less
  attention than those at start or end. Mitigation: reference-first evidence,
  delta-first output.
- **Context poisoning:** Outdated information from earlier in the session
  polluting current reasoning. Mitigation: fresh context isolation between
  chunks.
- **Context distraction:** Irrelevant content diluting attention from what
  matters. Mitigation: minimal code context injection.
- **Context clash:** Contradictory information causing inconsistent behavior.
  Mitigation: no duplicate context rule, single canonical location per entity.

When a retry fails with a different error than the original, or a chunk
contradicts its own earlier reasoning, context degradation is the likely cause.
The appropriate response is context isolation rather than more retries within
the same degraded context.

## Context Budget Gate

When context usage exceeds ~75%, complete the current chunk cleanly rather than
starting a new one. The 75% threshold leaves room for Observer verification
and the commit cycle without triggering compaction.

### Protocol

1. **Before each chunk**, assess context pressure. If you are aware that context
   is high, treat this as a gate check.
2. **At the gate (>=75%)**, do NOT start a new chunk. Instead:
   - Commit the current chunk's work (if any)
   - Write a full checkpoint to `.fctry/state.json` including:
     - Current chunk status and progress
     - Key decisions made so far in this session
     - Approach rationale for any in-flight work
     - Unresolved considerations for the next session
   - Emit a `context-checkpointed` lifecycle event
   - Set `buildRun.status` to `"paused"` with reason `"context-budget"`
   - State: "Build paused at a clean boundary — context budget reached.
     Run `/fctry:execute` to resume from chunk N."
3. **Never start a chunk you cannot finish.** Pause early rather than producing
   degraded output in later chunks.

### Monitoring

The status line reads `context_window.used_percentage` from session data. When
the status line shows context at 75% or higher, you are at the budget gate.

## Context Health Emission

Write context health data to `.fctry/state.json` as `contextState`:

```json
{
  "contextState": {
    "usage": 42,
    "isolationMode": "isolated",
    "lastCheckpoint": "2026-02-28T19:30:00Z",
    "attribution": {
      "spec": 15,
      "code": 35,
      "toolOutput": 30,
      "agentState": 10,
      "conversation": 10
    }
  }
}
```

Update at: before each chunk, after each chunk, at the budget gate. All fields
are best-effort estimates.

## Lifecycle Events

| Event | When | Payload |
|-------|------|---------|
| `context-checkpointed` | After persisting chunk state before a context boundary | chunk name, what was checkpointed |
| `context-boundary` | Starting chunk in fresh/isolated context | chunk name, isolation mode |
| `context-compacted` | When auto-compaction occurs mid-build | what was preserved, what was summarized |

These appear in mission control's context health indicator and activity feed.

## When to Surface Context Strategy

**Visible only when interesting.** If every chunk gets natural context
boundaries, don't mention context in the build plan. Only surface when:

- A chunk is too large to fit in one context window
- A dependency chain would accumulate excessive state
- The build requires a non-default isolation approach

In these cases, add a brief note to the execution strategy: "Chunk 4 exceeds
typical context size — will split into sub-chunks with checkpoint between them."

## Compact Instructions

CLAUDE.md includes a `# Compact Instructions` section guiding what Claude
preserves during auto-compaction. In unusual builds, you may append
phase-specific compact instructions and call this out in the build plan.

## Compaction Survival for Non-Build Workflows

The context budget gate (75%) prevents most compaction during builds. But
compaction can still happen during long non-build workflows — extended
evolve sessions, deep research dives, multi-phase interviews.

**PostCompact hook.** The `hooks/post-compact.js` hook fires after
compaction, writing `contextHealth.compactionCount` and
`lastCompactedAt` to state.json and emitting a `context-compacted` event
to the viewer.

**Critical invariant reinforcement.** After compaction in a non-build
workflow, the compact instructions in CLAUDE.md guide what survives. To
strengthen this, the system's critical invariants — experience language
only, agent decides implementation, scenarios are holdout sets, spec
writer evolves never rewrites, workflow enforcement via completedSteps —
should be present in CLAUDE.md's compact instructions section so they
survive compaction structurally rather than depending on agent file
content being preserved.
