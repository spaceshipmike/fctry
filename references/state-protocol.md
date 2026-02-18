# Status State Protocol

The file `.fctry/state.json` is a shared state file read by the
terminal status line and the spec viewer. Agents write to it as they work
so the user has at-a-glance visibility into what's happening.

## Schema

```json
{
  "activeSection": "#core-flow",
  "activeSectionNumber": "2.2",
  "currentCommand": "evolve",
  "workflowStep": "interviewer",
  "completedSteps": ["state-owner-scan"],
  "nextStep": "Run /fctry:execute to build the new behavior",
  "scenarioScore": { "satisfied": 5, "total": 8 },
  "chunkProgress": { "current": 2, "total": 4 },
  "readinessSummary": { "aligned": 28, "spec-ahead": 5, "draft": 7 },
  "untrackedChanges": [
    { "file": "src/statusline/fctry-statusline.js", "section": "status-line", "sectionNumber": "2.12", "timestamp": "2026-02-13T10:05:00Z" }
  ],
  "specVersion": "1.2",
  "agentOutputs": {
    "state-owner": { "summary": "Project has spec v1.2, 3 sections spec-ahead...", "relevanceManifest": ["src/viewer/server.js", ".fctry/spec.md#core-flow"] },
    "interviewer": { "summary": "Captured 5 decisions, 2 ASSUMED, 1 MISSING..." },
    "researcher": { "summary": "Found 3 patterns relevant to #async-inbox..." }
  },
  "lastUpdated": "2026-02-12T15:23:45Z"
}
```

**All fields are optional.** Consumers must handle any field being absent.

| Field | Type | Written by | When |
|-------|------|-----------|------|
| `activeSection` | string (alias) | Spec Writer, Executor | Set when starting work on a section, cleared when done |
| `activeSectionNumber` | string | Spec Writer, Executor | Always paired with `activeSection` |
| `currentCommand` | string | Commands (step 0) | At workflow start (`init`, `evolve`, `ref`, `review`, `execute`) |
| `workflowStep` | string | All agents | Set when an agent starts working. Values: `state-owner-scan`, `interviewer`, `researcher`, `visual-translator`, `scenario-crafter`, `spec-writer`, `executor-plan`, `executor-build` |
| `completedSteps` | array of strings | All agents | Each agent appends its step name when done. Cleared at command start (step 0). Used by downstream agents to validate prerequisites. |
| `nextStep` | string | Spec Writer, Executor, Interviewer | After producing output, to guide the user |
| `scenarioScore` | object | State Owner, Executor, Scenario Crafter | After evaluating scenarios. Fields: `satisfied` (number), `total` (number). |
| `chunkProgress` | object | Executor | During execute builds. Fields: `current` (number), `total` (number). Cleared when the build completes or a new plan is approved. |
| `readinessSummary` | object | State Owner | After readiness assessment. Map of readiness value to count (e.g., `{ "aligned": 28, "spec-ahead": 5, "draft": 7 }`). |
| `untrackedChanges` | array | PostToolUse hook | File writes outside fctry commands that map to spec sections. Each entry: `{ file, section, sectionNumber, timestamp }`. Cleared by `/fctry:review` or `/fctry:evolve` for affected sections. |
| `specVersion` | string | State Owner, Spec Writer | After reading or updating spec frontmatter. Also updated in the version registry at `.fctry/config.json` → `versions.spec.current`. The state file caches the value for fast access by consumers (status line, viewer); the registry is the source of truth. |
| `agentOutputs` | object | All agents | Intermediate outputs persisted by each agent on completion. Keyed by agent step name. Each value is an object with at minimum a `summary` field (one-paragraph digest of the agent's output). The State Owner also writes a `relevanceManifest` (array of file paths and section aliases scoped to the current command). Subsequent agents read these on startup to recover context if conversation history was compacted. Cleared at command start (step 0) along with `completedSteps`. |
| `lastUpdated` | ISO 8601 string | All writers | Always set on every write |
| `buildRun` | object | Executor | Persistent build state for checkpoint/resume (see Build Run Schema below) |

### Build Run Schema (`buildRun`)

The `buildRun` field persists the state of an autonomous build so it
survives session death, context exhaustion, or user interruption. Written
by the Executor after plan approval and updated after each chunk completes.
Cleared when the build completes or the user starts a fresh plan.

```json
{
  "buildRun": {
    "runId": "run-1708012345678",
    "status": "running",
    "startedAt": "2026-02-17T04:00:00Z",
    "plan": {
      "totalChunks": 7,
      "priorities": ["speed", "reliability", "token-efficiency"],
      "prioritySource": "global",
      "specVersion": "2.4"
    },
    "chunks": [
      {
        "id": 1,
        "name": "Glossary Fix + State Protocol Schema",
        "status": "completed",
        "sections": ["#entities", "#rules"],
        "scenarios": ["Build Resume After Session Death"],
        "dependsOn": [],
        "specVersionAtBuild": "2.4",
        "completedAt": "2026-02-17T04:12:00Z"
      },
      {
        "id": 2,
        "name": "Event History on Reconnect",
        "status": "active",
        "sections": ["#spec-viewer"],
        "scenarios": ["Viewer as Live Mission Control During Builds"],
        "dependsOn": [],
        "attempt": 1,
        "startedAt": "2026-02-17T04:13:00Z"
      },
      {
        "id": 3,
        "name": "Activity Feed Filtering",
        "status": "planned",
        "sections": ["#spec-viewer"],
        "scenarios": ["Mission Control Feels Calm, Not Noisy"],
        "dependsOn": []
      }
    ],
    "convergencePhase": "viewer-mission-control",
    "lastCheckpoint": "2026-02-17T04:12:00Z"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `runId` | string | Unique identifier (`run-{timestamp}`) |
| `status` | string | `"running"`, `"completed"`, or `"partial"` |
| `startedAt` | ISO 8601 | When the build started |
| `plan.totalChunks` | number | Total chunks in the approved plan |
| `plan.priorities` | array | Resolved execution priorities |
| `plan.prioritySource` | string | `"global"`, `"project"`, or `"user-prompt"` |
| `plan.specVersion` | string | Spec version at plan approval |
| `chunks` | array | Ordered list of chunks with lifecycle state |
| `chunks[].id` | number | 1-indexed chunk number |
| `chunks[].name` | string | Human-readable chunk name |
| `chunks[].status` | string | `"planned"`, `"active"`, `"retrying"`, `"completed"`, `"failed"` |
| `chunks[].sections` | array | Spec section aliases this chunk covers |
| `chunks[].scenarios` | array | Scenario names this chunk targets |
| `chunks[].dependsOn` | array | Chunk IDs that must complete first |
| `chunks[].specVersionAtBuild` | string | Spec version when this chunk was built (for change detection on resume) |
| `chunks[].attempt` | number | Current attempt number (present when `status` is `"active"` or `"retrying"`) |
| `chunks[].completedAt` | ISO 8601 | When the chunk finished (present when `status` is `"completed"`) |
| `chunks[].failedAt` | ISO 8601 | When the chunk was abandoned (present when `status` is `"failed"`) |
| `convergencePhase` | string | Current convergence phase name (from spec section 6.2) |
| `lastCheckpoint` | ISO 8601 | Timestamp of last chunk completion |

**Written by:** Executor (after plan approval, after each chunk)

**Consumed by:**
- Executor (on `/fctry:execute` re-entry — detects incomplete build, offers resume)
- Viewer server (mission control — reads chunk tree for DAG rendering and progress)
- Status line (reads `chunkProgress` derived from chunk statuses)

**Resume protocol:** When the Executor starts and finds a `buildRun` with
`status: "running"` and at least one `"completed"` chunk:
1. Show the user what completed and what remains
2. Offer: (1) Resume from next pending chunk, (2) Start fresh, (3) Cancel
3. If resuming: check `specVersionAtBuild` for each completed chunk against
   the current spec version. If the spec changed for a covered section,
   flag it and ask whether to rebuild or keep the old result.

**Clearing:** Set `buildRun` to `null` when the build completes successfully
or the user chooses "Start fresh." A `"partial"` status indicates the build
ended with some chunks failed — the user should `/fctry:evolve` the
affected sections before retrying.

### Inbox Queue (`.fctry/inbox.json`)

The async inbox is stored in a separate file, `.fctry/inbox.json`, not in
`state.json`. This keeps the inbox independent of session-scoped state
(which is cleared on session start).

```json
[
  {
    "id": "inbox-1708012345678-a1b2c3",
    "type": "evolve",
    "content": "Make onboarding faster",
    "timestamp": "2026-02-16T10:00:00Z",
    "status": "pending"
  }
]
```

| Field | Type | Values |
|-------|------|--------|
| `id` | string | Unique identifier (`inbox-{timestamp}-{random}`) |
| `type` | string | `"evolve"`, `"reference"`, or `"feature"` |
| `content` | string | The idea, URL, or feature description |
| `timestamp` | ISO 8601 string | When the item was submitted |
| `status` | string | `"pending"`, `"processing"`, `"processed"`, or `"error"` |

**Written by:** Viewer server (inbox API: `POST /api/inbox`, `DELETE /api/inbox/:id`)

**Consumed by:** Viewer client (inbox panel), fctry commands (`/fctry:evolve`, `/fctry:ref`) when processing queued items.

**Persistence:** Survives across sessions. Not cleared on session start. Items are removed explicitly via the dismiss button or after processing by fctry commands.

### Verification Events Schema

Verification events are emitted by the Observer after post-chunk verification.
They use the same event format as lifecycle events in the activity feed.

```json
{
  "kind": "chunk-verified",
  "chunk": "Chunk 3: DAG Visualization",
  "timestamp": "2026-02-17T14:32:05Z",
  "summary": "4/4 checks passed",
  "checks": [
    { "name": "DAG container exists", "result": "pass" },
    { "name": "6 nodes visible", "result": "pass" },
    { "name": "Completed nodes show green", "result": "pass", "retried": true },
    { "name": "Edge connections present", "result": "pass" }
  ],
  "mode": "full",
  "screenshot": ".fctry/verification/chunk-3-dag.png"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `kind` | string | `"chunk-verified"` or `"verification-failed"` |
| `chunk` | string | Chunk name from the build plan |
| `timestamp` | ISO 8601 | When verification completed |
| `summary` | string | One-line summary for the activity feed |
| `checks` | array | Individual check results (optional in feed, available on demand) |
| `checks[].name` | string | What was checked |
| `checks[].result` | string | `"pass"` or `"fail"` |
| `checks[].retried` | boolean | Whether this check passed on retry (absent if false) |
| `mode` | string | `"full"`, `"reduced"`, or `"minimal"` |
| `screenshot` | string | Path to screenshot evidence (optional) |

### Context Lifecycle Events Schema

Context lifecycle events are emitted by the Executor during builds when
context boundaries are managed. They use the same event format as lifecycle
and verification events in the activity feed.

```json
{
  "kind": "context-checkpointed",
  "chunk": "Chunk 3: Spec Viewer Layout",
  "timestamp": "2026-02-17T14:30:00Z",
  "summary": "Build state checkpointed before context boundary"
}
```

| Kind | When | Summary Content |
|------|------|-----------------|
| `context-checkpointed` | After persisting chunk state before a context boundary | What was checkpointed (chunk name, state fields) |
| `context-boundary` | When starting a chunk in fresh/isolated context | Chunk name, isolation mode (subagent, fresh session, etc.) |
| `context-compacted` | When auto-compaction occurs mid-build | What was preserved, what was summarized |

Context events are emitted by the Executor's resource management. They
appear in the activity feed alongside lifecycle events (from the Executor)
and verification events (from the Observer). Together, all three event
types form the complete build narrative.

**Context health indicator fields.** The viewer's context health indicator
reads from the current chunk's state and recent context events:
- **Isolation mode** — derived from the most recent `context-boundary` event
  (or "standard" if no boundary events have been emitted)
- **Approximate usage** — from the status line's context percentage
- **Last checkpoint** — timestamp from the most recent `context-checkpointed`
  event or `buildRun.lastCheckpoint`

## Workflow Enforcement

Agents validate that prerequisites have completed before proceeding. The
enforcement is conversational, not rigid — the user can always skip.

### Prerequisites by Agent

| Agent | Requires in `completedSteps` | Exception |
|-------|------------------------------|-----------|
| State Owner | (none — always runs first) | — |
| Observer | (none — infrastructure agent, invocable by any agent at any time) | — |
| Interviewer | `state-owner-scan` | — |
| Researcher | `state-owner-scan` | On `/fctry:ref`, runs in parallel with State Owner |
| Visual Translator | `state-owner-scan` | On `/fctry:ref`, runs in parallel with State Owner |
| Scenario Crafter | `interviewer` | — |
| Spec Writer | Varies by command (see below) | — |
| Executor | `state-owner-scan` | — |

**Spec Writer prerequisites by command:**
- `/fctry:init`: `interviewer` and `scenario-crafter`
- `/fctry:evolve`: `interviewer` and `scenario-crafter`
- `/fctry:ref`: `state-owner-scan` and (`researcher` or `visual-translator`)
- `/fctry:review`: `state-owner-scan`

### On Prerequisite Failure

When an agent finds its prerequisites missing from `completedSteps`, it
surfaces a numbered error per `references/error-conventions.md`:

```
Workflow error: State Owner must run before {agent} can proceed.
(1) Run State Owner scan now (recommended)
(2) Skip (not recommended — may produce inaccurate results)
(3) Abort this command
```

The user chooses. If they choose (1), the missing step runs. If (2), the
agent proceeds without the prerequisite. If (3), the command stops.

### Writing Workflow State

Each agent follows this protocol:

1. **On start:** Read-modify-write the state file to set `workflowStep`
   to your step name.
2. **On completion:** Read-modify-write to append your step name to
   `completedSteps` and clear `workflowStep`.

## Write Semantics: Read-Modify-Write

**Never clobber the whole file.** Always:

1. Read the current contents (if the file exists)
2. Parse as JSON (default to `{}` if missing or unparseable)
3. Merge your fields into the existing object
4. Set `lastUpdated` to the current ISO 8601 timestamp
5. Write the merged result back

This ensures agents don't erase each other's state. Example in
pseudocode:

```
existing = readJSON(".fctry/state.json") or {}
existing.activeSection = "#core-flow"
existing.activeSectionNumber = "2.2"
existing.lastUpdated = now()
writeJSON(".fctry/state.json", existing)
```

## Clearing Fields

To clear a field (e.g., `activeSection` when done working on a section),
set it to `null`. Consumers treat `null` and absent the same way.

```json
{
  "activeSection": null,
  "activeSectionNumber": null,
  "lastUpdated": "2026-02-12T15:30:00Z"
}
```

## File Location

Always at `.fctry/state.json` relative to the project root. The
`.fctry/` directory is created by the viewer's `manage.sh ensure` or by
any agent that needs to write state. Check and create the directory before
writing.

## Consumers

- **Terminal status line** (`src/statusline/fctry-statusline.js`) — reads
  on every prompt to display current activity in the terminal
- **Spec viewer** (`src/viewer/server.js`) — watches for changes and
  broadcasts via WebSocket to highlight active sections
