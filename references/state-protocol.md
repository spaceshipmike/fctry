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
  "nextStep": "Run /fctry:execute to build the new behavior",
  "scenarioScore": { "satisfied": 5, "total": 8, "evaluated": true },
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
| `nextStep` | string | Spec Writer, Executor, Interviewer | After producing output, to guide the user |
| `scenarioScore` | object | State Owner, Executor, Scenario Crafter | After evaluating scenarios. Must include `evaluated: true` for the status line to display it. |
| `specVersion` | string | State Owner, Spec Writer | After reading or updating spec frontmatter |
| `lastUpdated` | ISO 8601 string | All writers | Always set on every write |

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
