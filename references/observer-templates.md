# Observer Templates

Output formats, event schemas, and audit trail templates for the Observer agent.
Loaded on demand during verification.

## Verification Verdict Format

```
Verification verdict: {chunk or check name}
Result: pass | fail
Confidence: high | medium | low
Checks: {N} of {M} passed
Evidence:
  - {check description}: {pass|fail} {detail}
  - {check description}: {pass|fail} {detail}
Structured evidence:
  Actions: {what the chunk did — files created, modified, deleted}
  Affected files: {list of files touched}
  Spec citations: {section aliases and numbers verified against}
Screenshot: {path or inline reference, if applicable}
Retried: {yes — passed on retry | no}
```

**Confidence indicator.** Based on verification depth achieved:
- **high** — Structural checks passed (file existence, scope compliance,
  fact-sheet verification). Evidence is deterministic.
- **medium** — Behavioral review passed (LLM judgment of experience-level
  quality). Evidence includes interpretation.
- **low** — Minimal verification only (files exist, no deeper checks possible
  due to missing tools or no observable surface).

The confidence indicator helps the Executor calibrate its response — a
low-confidence pass may warrant a re-check later, while a high-confidence
fail is a strong signal to retry.

## Observation Report Format

```
Observation report: {what was observed}
Surface: {browser | API | file system | terminal}
Findings:
  - {what was checked}: {what was seen}
  - {what was checked}: {what was seen}
Evidence: {screenshots, API responses, file contents}
```

## Behavioral Review Verdict Format

```
Behavioral review: {chunk name}
Tier: behavioral
Findings:
  - [{severity}] {finding description}
    Spec: {quoted or paraphrased spec text that this violates}
    Suggested fix: {concrete suggestion for how to address it}
  - [{severity}] {finding description}
    Spec: {spec reference}
    Suggested fix: {suggestion}
Re-review: {pending | passed | findings-remain}
Round: {1 | 2} of 2
```

Severity levels: `critical` (breaks the described experience), `high`
(noticeably diverges from spec), `medium` (subtle mismatch), `low`
(improvement opportunity, not a violation).

When re-reviewing after the Executor fixes findings:
- Findings that are resolved: omit them (silence means fixed)
- New findings discovered during re-review: include with `[new]` prefix
- Cap at 2 review rounds — after round 2, report remaining findings
  and let the Executor decide whether to continue

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
  "mode": "reduced",
  "confidence": "high"
}
```

Event kinds:
- `chunk-verified` — Post-chunk verification passed. Fields: `chunk`,
  `summary`, `passed`, `total`, `mode`, `confidence`
- `verification-failed` — Post-chunk verification found issues. Fields:
  `chunk`, `summary`, `failed` (array of check descriptions), `mode`,
  `confidence`

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
    "confidence": "high | medium | low",
    "verdict": "pass | fail"
  }
}
```

### Tier Scaling

- **Patch tier**: `summary` only. Individual `findings[]` omitted unless failed.
- **Feature tier**: full `findings[]` with evidence. Summary with mode/verdict.
- **Architecture tier**: comprehensive `findings[]` with screenshot paths.
  Summary with comparison to previous chunk's verification.

## Verification Guidelines Config Schema

Project-scoped verification guidelines live in `.fctry/config.json`:

```json
{
  "verification": {
    "guidelines": [
      "Inline styles are intentional — do not flag as a quality issue",
      "Console.log statements in hooks/ are debug output, not errors"
    ]
  }
}
```

Each entry is a plain-text declaration of an acceptable pattern. The
Observer reads these before each verification pass and suppresses findings
that match a declared guideline. Guidelines are user-authored — the
Observer never auto-generates them.
