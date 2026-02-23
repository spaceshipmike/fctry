# Project Data Glossary

Every data point the factory tracks per project, where it lives, and what
it looks like.

---

## Session State (`.fctry/state.json`)

Cleared on session start. Written by agents as they work. Read by the
status line and viewer for at-a-glance visibility.

### `currentCommand`

Which fctry command is currently running.

- **Type:** string
- **Written by:** Command entry (step 0)
- **Values:** `"init"`, `"evolve"`, `"ref"`, `"review"`, `"execute"`
- **Example:** `"evolve"`

### `workflowStep`

Which agent is currently active within the command pipeline.

- **Type:** string
- **Written by:** Each agent on start, cleared on completion
- **Values:** `"state-owner-scan"`, `"interviewer"`, `"researcher"`,
  `"visual-translator"`, `"scenario-crafter"`, `"spec-writer"`,
  `"executor-plan"`, `"executor-build"`
- **Example:** `"interviewer"`

### `completedSteps`

Ordered list of workflow steps that have finished for the current command.
Used by agents to validate prerequisites before proceeding.

- **Type:** array of strings
- **Written by:** Each agent on completion (append)
- **Cleared:** At command start (step 0)
- **Example:** `["state-owner-scan", "interviewer", "scenario-crafter"]`

### `activeSection`

The spec section an agent is currently working on. Drives the ToC
highlight in the viewer.

- **Type:** string (alias with `#` prefix)
- **Written by:** Spec Writer, Executor
- **Cleared:** When the agent finishes the section
- **Example:** `"#core-flow"`

### `activeSectionNumber`

Always paired with `activeSection`. The numeric section reference.

- **Type:** string
- **Example:** `"2.2"`

### `nextStep`

Guidance string shown to the user after a command completes.

- **Type:** string
- **Written by:** Spec Writer, Executor, Interviewer
- **Example:** `"Run /fctry:execute to build the new behavior"`

### `scenarioScore`

How many scenarios are currently satisfied vs. total.

- **Type:** object `{ satisfied: number, total: number }`
- **Written by:** State Owner, Executor, Scenario Crafter
- **Example:** `{ "satisfied": 18, "total": 24 }`

### `chunkProgress`

Build progress during `/fctry:execute`. Which chunk the Executor is on.

- **Type:** object `{ current: number, total: number }`
- **Written by:** Executor
- **Cleared:** When the build completes or a new plan is approved
- **Example:** `{ "current": 3, "total": 7 }`

### `readinessSummary`

Aggregate count of sections in each readiness state. Used by the status
line for the `N/M ready` display.

- **Type:** object (readiness value -> count)
- **Written by:** State Owner (every scan), Executor (after chunks)
- **Example:** `{ "aligned": 28, "ready-to-build": 5, "draft": 7 }`

### `sectionReadiness`

Per-section readiness map. The authoritative source for all display
surfaces (viewer, status line, dashboard).

- **Type:** object (section alias -> readiness value)
- **Written by:** State Owner (every scan), Executor (after chunks)
- **Readiness values:** `draft`, `undocumented`, `ready-to-build`,
  `aligned`, `ready-to-execute`, `satisfied`, `deferred`
- **Example:**
  ```json
  {
    "core-flow": "aligned",
    "first-run": "ready-to-build",
    "evolve-flow": "satisfied",
    "deferred-futures": "deferred"
  }
  ```

### `untrackedChanges`

File writes that happened outside fctry commands and map to spec-covered
sections. Detected by the PostToolUse hook.

- **Type:** array of objects
- **Written by:** PostToolUse hook (`detect-untracked.js`)
- **Cleared:** By `/fctry:review` or `/fctry:evolve` for affected sections
- **Example:**
  ```json
  [
    {
      "file": "src/statusline/fctry-statusline.js",
      "section": "status-line",
      "sectionNumber": "2.12",
      "timestamp": "2026-02-13T10:05:00Z"
    }
  ]
  ```

### `specVersion`

Cached copy of the spec's `spec-version` frontmatter field. Fast access
for status line and viewer without parsing the full spec.

- **Type:** string
- **Written by:** State Owner (after reading spec), Spec Writer (after
  updating spec)
- **Example:** `"3.12"`

### `agentOutputs`

Digests from each agent, keyed by step name. Enables context recovery
after conversation compaction.

- **Type:** object (step name -> digest object)
- **Written by:** Each agent on completion
- **Cleared:** At command start (step 0)
- **Example:**
  ```json
  {
    "state-owner": {
      "summary": "Project has spec v1.2, 3 sections ready-to-build, no drift.",
      "relevanceManifest": ["src/viewer/server.js", "#core-flow"]
    },
    "interviewer": {
      "summary": "Captured 5 decisions, 2 ASSUMED, 1 MISSING."
    }
  }
  ```

### `buildRun`

Full state of an autonomous build. Persists through session death for
checkpoint/resume.

- **Type:** object (see Build Run below)
- **Written by:** Executor (after plan approval, after each chunk)
- **Cleared:** When the build completes or user starts fresh
- **Example:**
  ```json
  {
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
        "name": "Core data model",
        "status": "completed",
        "sections": ["#entities", "#rules"],
        "scenarios": ["Registration stores project data"],
        "dependsOn": [],
        "specVersionAtBuild": "2.4",
        "completedAt": "2026-02-17T04:12:00Z"
      },
      {
        "id": 2,
        "name": "Query API",
        "status": "active",
        "sections": ["#querying"],
        "scenarios": ["Progressive disclosure in search"],
        "dependsOn": [1],
        "attempt": 1,
        "startedAt": "2026-02-17T04:13:00Z"
      }
    ],
    "convergencePhase": "core-data",
    "lastCheckpoint": "2026-02-17T04:12:00Z"
  }
  ```

### `lastUpdated`

Timestamp of the most recent write to state.json.

- **Type:** ISO 8601 string
- **Written by:** Every writer
- **Example:** `"2026-02-19T06:45:00Z"`

---

## Async Inbox (`.fctry/inbox.json`)

Persists across sessions. Not cleared on session start. Items submitted
through the viewer's async inbox or queued programmatically.

### Inbox Item

- **Type:** array of objects
- **Written by:** Viewer server (`POST /api/inbox`)
- **Consumed by:** `/fctry:evolve`, `/fctry:ref`

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (`inbox-{timestamp}-{random}`) |
| `type` | string | `"evolve"`, `"reference"`, or `"feature"` |
| `content` | string | The idea, URL, or feature description |
| `note` | string | Optional user note attached to the item |
| `timestamp` | ISO 8601 | When the item was submitted |
| `status` | string | `"pending"`, `"processing"`, `"processed"`, `"error"`, `"incorporated"` |
| `analysis` | object | System's analysis after processing (affected sections, interpretation) |
| `consumedBy` | object | Command and timestamp that incorporated this item |

**Example:**
```json
[
  {
    "id": "inbox-1708012345678-a1b2c3",
    "type": "evolve",
    "content": "Make onboarding faster",
    "timestamp": "2026-02-16T10:00:00Z",
    "status": "processed",
    "analysis": {
      "affectedSections": ["first-run", "core-flow"],
      "summary": "Reduce initial setup steps — affects #first-run and #core-flow"
    }
  },
  {
    "id": "inbox-1708099999999-d4e5f6",
    "type": "reference",
    "content": "https://example.com/cool-design",
    "note": "love the sidebar layout here",
    "timestamp": "2026-02-17T14:30:00Z",
    "status": "incorporated",
    "consumedBy": { "command": "ref", "timestamp": "2026-02-18T09:00:00Z" }
  }
]
```

---

## Version Registry (`.fctry/config.json`)

Git-tracked. Declarative model of what versions a project tracks, where
they appear, and how they change.

### `versions.external`

The project's public-facing semver. What users, consumers, and release
notes reference.

- **Example:**
  ```json
  {
    "type": "external",
    "current": "0.13.0",
    "propagationTargets": [
      { "file": ".claude-plugin/plugin.json", "field": "version" },
      { "file": ".fctry/spec.md", "field": "plugin-version" }
    ],
    "incrementRules": {
      "patch": "auto-per-chunk",
      "minor": "suggest-at-plan-completion",
      "major": "suggest-at-experience-milestone"
    }
  }
  ```

### `versions.spec`

The spec document version. Increments automatically on every evolve.

- **Example:**
  ```json
  {
    "type": "internal",
    "current": "3.12",
    "propagationTargets": [
      { "file": ".fctry/spec.md", "field": "spec-version" }
    ],
    "incrementRules": {
      "minor": "auto-on-evolve"
    }
  }
  ```

### `relationshipRules`

How internal version changes ripple to external version.

- **Example:**
  ```json
  [
    {
      "when": { "type": "spec", "change": "major" },
      "action": "suggest-external-minor-bump"
    }
  ]
  ```

### `executionPriorities`

Per-project override for the Executor's priority ranking. Optional —
falls back to global `~/.fctry/config.json`.

- **Type:** array of 3 strings
- **Values:** `"speed"`, `"reliability"`, `"token-efficiency"`
- **Example:** `["reliability", "speed", "token-efficiency"]`

---

## Spec Index (`.fctry/spec.db`)

Derived SQLite cache. Auto-rebuilds from the markdown spec whenever the
file changes. Can be deleted and rebuilt at any time.

### `sections` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Auto-incrementing primary key |
| `alias` | TEXT | Section alias (e.g., `core-flow`) |
| `number` | TEXT | Section number (e.g., `2.2`) |
| `heading` | TEXT | Section heading text |
| `content` | TEXT | Full section content (markdown) |
| `parent_id` | INTEGER | Parent section ID |
| `word_count` | INTEGER | Word count of content |
| `readiness` | TEXT | Readiness value (secondary to state.json) |
| `last_updated` | TEXT | Timestamp of last change |

### `changelog_entries` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Auto-incrementing primary key |
| `timestamp` | TEXT | ISO 8601 timestamp |
| `sections` | TEXT | Comma-separated affected section aliases |
| `summary` | TEXT | One-line change summary |

---

## Global Registry (`~/.fctry/projects.json`)

Global list of all fctry projects. Auto-populated on init and on every
prompt via the UserPromptSubmit hook.

### Project Entry

| Field | Type | Description |
|-------|------|-------------|
| `path` | string | Canonicalized project path |
| `name` | string | Project name (from spec frontmatter) |
| `lastActivity` | ISO 8601 | When fctry last ran in this project |

**Example:**
```json
[
  {
    "path": "/Users/mike/Code/fctry",
    "name": "fctry",
    "lastActivity": "2026-02-19T06:45:00Z"
  },
  {
    "path": "/Users/mike/Code/project-registry-service",
    "name": "Project Registry",
    "lastActivity": "2026-02-19T03:30:00Z"
  }
]
```

---

## Global Viewer State (`~/.fctry/`)

Shared across all projects. One viewer process serves all projects.

| File | Content |
|------|---------|
| `viewer.pid` | Process ID of the running viewer server |
| `viewer.port.json` | `{ "port": 3850 }` — viewer's HTTP/WS address |
| `projects.json` | Global project registry (see above) |
| `config.json` | Global execution priorities (fallback when per-project not set) |

---

## Spec Frontmatter

YAML frontmatter in `.fctry/spec.md`. Source of truth for spec identity.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `title` | string | Project name | `"fctry"` |
| `spec-version` | string | Spec document version | `"3.12"` |
| `plugin-version` | string | External project version | `"0.13.0"` |
| `date` | string | Last update date | `"2026-02-19"` |
| `status` | string | Spec lifecycle status | `"active"` |
| `author` | string | Spec author | `"Mike"` |
| `spec-format` | string | Always `nlspec-v2` | `"nlspec-v2"` |
| `synopsis.short` | string | One-line description | `"Claude Code plugin for..."` |
| `synopsis.medium` | string | Paragraph description | |
| `synopsis.readme` | string | README-length description | |
| `synopsis.tech-stack` | array | Technologies used | `["Node.js", "SQLite"]` |
| `synopsis.patterns` | array | Architecture patterns | `["multi-agent pipeline"]` |
| `synopsis.goals` | array | Project goals | |

---

## Derived / Computed (viewer dashboard)

Not stored — computed on demand from the above sources.

| Data Point | Source | Example |
|------------|--------|---------|
| Readiness bar | `sectionReadiness` or heuristic fallback | `26/26` |
| Readiness pills | Per-category counts from readiness | `aligned 25`, `deferred 1` |
| Spec status badge | Spec frontmatter `status` | `STABLE` |
| External version | `config.json` `versions.external.current` | `0.1.7` |
| Synopsis | Spec frontmatter `synopsis.short` | `"Project registry..."` |
| Build progress | `state.json` `chunkProgress` | `3/7` |
| Inbox depth | `inbox.json` pending/processed count | `2` |
| Untracked changes | `state.json` `untrackedChanges` length | `1` |
| Recommended command | Computed from all above | `/fctry:execute` |

---

## Readiness Values Reference

| Value | Meaning | Set by | Counts as "ready" |
|-------|---------|--------|-------------------|
| `draft` | Section has <30 words — too thin to build | Heuristic, State Owner | No |
| `undocumented` | Code exists, spec doesn't describe it | State Owner | No |
| `ready-to-build` | Spec describes it, code doesn't exist | Heuristic, State Owner | No |
| `aligned` | Spec and code match | Heuristic, State Owner, Executor | Yes |
| `ready-to-execute` | Aligned + no open issues | State Owner | Yes |
| `satisfied` | Scenarios passing | Executor | Yes |
| `deferred` | Intentionally excluded from builds | State Owner | Yes |
