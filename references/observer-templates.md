# Observer Templates

Output formats, event schemas, and audit trail templates for the Observer agent.
Loaded on demand during verification.

## Verification Verdict Format

```
Verification verdict: {chunk or check name}
Result: pass | fail
Checks: {N} of {M} passed
Evidence:
  - {check description}: {pass|fail} {detail}
  - {check description}: {pass|fail} {detail}
Screenshot: {path or inline reference, if applicable}
Retried: {yes — passed on retry | no}
```

## Observation Report Format

```
Observation report: {what was observed}
Surface: {browser | API | file system | terminal}
Findings:
  - {what was checked}: {what was seen}
  - {what was checked}: {what was seen}
Evidence: {screenshots, API responses, file contents}
```

## Viewer Discovery

Read `~/.fctry/viewer.port.json` (global):

```json
{ "port": 3850, "pid": 12345 }
```

API endpoints:
- `/health` — server health check
- `/api/build-status` — current build state
- `/api/build-log` — build log for export
- `/readiness.json` — section readiness data

## Verification Event Schema

```json
{
  "kind": "chunk-verified",
  "timestamp": "2026-02-27T14:06:00Z",
  "chunk": "Build Learnings Foundation",
  "summary": "4/4 checks passed",
  "passed": 4,
  "total": 4,
  "mode": "reduced"
}
```

Event kinds:
- `chunk-verified` — Post-chunk verification passed. Fields: `chunk`,
  `summary`, `passed`, `total`, `mode`
- `verification-failed` — Post-chunk verification found issues. Fields:
  `chunk`, `summary`, `failed` (array of check descriptions), `mode`

## Audit Trail Format (Showboat Fallback)

When Showboat is unavailable, write markdown to
`.fctry/build-trace-{runId}-verification.md`:

```markdown
# Verification Audit Trail — {project name}

Run: {runId} | Date: {ISO date} | Mode: {system-wide|full|reduced|minimal}

## Chunk 1: {name}
- [{pass|fail}] {check description} — {evidence reference}
- [{pass|fail}] {check description} — {evidence reference}
Screenshot: {path, if captured}
Verdict: {pass|fail} ({N}/{M} checks passed)

## Chunk 2: {name}
...
```

Append-only during the build. Not re-executable like Showboat documents.

## Proof Block Format

```markdown
## Proof: {check name}
```bash
{command}
```
Expected: `{expected output}`
Actual: `{actual output}` {✓ or ✗}
```

**Qualifies as proof block:** API health checks, file existence checks,
configuration validation, build output verification.

**Does NOT qualify:** Screenshot interpretations, browser DOM checks,
timing-sensitive assertions (these remain as narrative evidence).

## Interchange Schema

```json
{
  "agent": "observer",
  "command": "{current command}",
  "tier": "patch | feature | architecture",
  "findings": [
    {
      "id": "VER-001",
      "type": "check",
      "check": "Description of what was checked",
      "result": "pass | fail",
      "evidence": "Screenshot path or API response summary",
      "retried": false
    }
  ],
  "summary": {
    "chunk": "Chunk name",
    "passed": 4,
    "total": 4,
    "mode": "system-wide | full | reduced | minimal",
    "verdict": "pass | fail"
  }
}
```

### Tier Scaling

- **Patch tier**: `summary` only. Individual `findings[]` omitted unless failed.
- **Feature tier**: full `findings[]` with evidence. Summary with mode/verdict.
- **Architecture tier**: comprehensive `findings[]` with screenshot paths.
  Summary with comparison to previous chunk's verification.
