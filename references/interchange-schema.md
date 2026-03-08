# Interchange Schemas

Structured interchange documents emitted by agents alongside conversational
output. The viewer renders interchange as interactive UI. The CLI ignores it.

## State Owner Interchange

Emitted when the briefing completes.

```json
{
  "agent": "state-owner",
  "command": "{current command}",
  "tier": "patch | feature | architecture",
  "findings": [
    {
      "id": "FND-001",
      "type": "drift | readiness | untracked | coherence",
      "section": "#alias (N.N)",
      "summary": "One-line description",
      "detail": "Expanded evidence and context",
      "severity": "low | medium | high"
    }
  ],
  "actions": [
    {
      "id": "ACT-001",
      "summary": "Recommended next step",
      "command": "/fctry:evolve core-flow",
      "priority": "now | next | later",
      "resolves": ["FND-001"]
    }
  ]
}
```

## Spec Writer Interchange

**Gap analysis (review):**
```json
{
  "agent": "spec-writer",
  "command": "review",
  "tier": "patch | feature | architecture",
  "findings": [
    {
      "id": "FND-001",
      "type": "code-ahead | spec-ahead | diverged | unknown",
      "section": "#alias (N.N)",
      "summary": "One-line description of drift",
      "detail": "Spec says X, code does Y, evidence...",
      "recommendation": "Update spec | Run execute | Discuss"
    }
  ],
  "actions": [
    {
      "id": "ACT-001",
      "summary": "Update spec to match code",
      "resolves": ["FND-001"],
      "approved": false
    }
  ]
}
```

**Diff summary (evolve, ref, init):**
```json
{
  "agent": "spec-writer",
  "command": "evolve | ref | init",
  "tier": "patch | feature | architecture",
  "actions": [
    {
      "id": "CHG-001",
      "type": "changed | added | removed",
      "section": "#alias (N.N)",
      "summary": "One-line description of change"
    }
  ]
}
```

## Build Plan Interchange

Emitted at plan approval.

```json
{
  "agent": "executor",
  "command": "execute",
  "phase": "plan",
  "tier": "patch | feature | architecture",
  "actions": [
    {
      "id": "CHK-001",
      "type": "chunk",
      "name": "Chunk name",
      "sections": ["#alias (N.N)"],
      "scenarios": ["Scenario name"],
      "status": "planned | active | completed | failed",
      "dependsOn": ["CHK-002"],
      "scope": "small | medium | large"
    }
  ]
}
```

## Experience Report Interchange

Emitted at plan completion.

```json
{
  "agent": "executor",
  "command": "execute",
  "phase": "release",
  "release": {
    "headline": "One-sentence experience shift",
    "highlights": ["Concrete thing the user can try"],
    "deltas": [
      { "section": "#alias (N.N)", "summary": "What changed" }
    ],
    "migration": "None | migration steps",
    "version": { "current": "X.Y.Z", "suggested": "X.Y+1.0" }
  }
}
```

## Tier Scaling

- **Patch tier**: `actions[]` with chunk status only. No release interchange.
- **Feature tier**: full `actions[]` with scenarios and dependencies. Release
  interchange with headline and highlights.
- **Architecture tier**: comprehensive `actions[]` with risk annotations.
  Release interchange with full deltas and migration.

## Lifecycle Events as Interchange

The lifecycle events emitted during builds (`chunk-started`, `chunk-completed`,
etc.) serve as real-time interchange for mission control. The plan and release
interchanges bookend the build.

## Structure-Only Rule

Interchange documents emit schema (field names, types, relationships) without
payload bodies. The viewer hydrates from source files on demand.
