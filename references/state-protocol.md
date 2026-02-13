# Status State Protocol

The file `.fctry/fctry-state.json` is a shared state file read by the
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
  "scenarioScore": { "satisfied": 5, "total": 8, "evaluated": true },
  "readinessSummary": { "aligned": 28, "spec-ahead": 5, "draft": 7 },
  "specVersion": "1.2",
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
| `scenarioScore` | object | State Owner, Executor, Scenario Crafter | After evaluating scenarios. Must include `evaluated: true` for the status line to display it. |
| `readinessSummary` | object | State Owner | After readiness assessment. Map of readiness value to count (e.g., `{ "aligned": 28, "spec-ahead": 5, "draft": 7 }`). |
| `specVersion` | string | State Owner, Spec Writer | After reading or updating spec frontmatter |
| `lastUpdated` | ISO 8601 string | All writers | Always set on every write |

## Workflow Enforcement

Agents validate that prerequisites have completed before proceeding. The
enforcement is conversational, not rigid — the user can always skip.

### Prerequisites by Agent

| Agent | Requires in `completedSteps` | Exception |
|-------|------------------------------|-----------|
| State Owner | (none — always runs first) | — |
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
existing = readJSON(".fctry/fctry-state.json") or {}
existing.activeSection = "#core-flow"
existing.activeSectionNumber = "2.2"
existing.lastUpdated = now()
writeJSON(".fctry/fctry-state.json", existing)
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

Always at `.fctry/fctry-state.json` relative to the project root. The
`.fctry/` directory is created by the viewer's `manage.sh ensure` or by
any agent that needs to write state. Check and create the directory before
writing.

## Consumers

- **Terminal status line** (`src/statusline/fctry-statusline.js`) — reads
  on every prompt to display current activity in the terminal
- **Spec viewer** (`src/viewer/server.js`) — watches for changes and
  broadcasts via WebSocket to highlight active sections
