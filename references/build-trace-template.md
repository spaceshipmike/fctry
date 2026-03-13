# Build Trace Template

Written by the Executor at build completion (or abandonment). Every build
produces a trace file at `.fctry/build-trace-{runId}.md`. The trace is
ephemeral (excluded from git) but persists across sessions. The State Owner
reads the most recent trace on its next scan.

## Template

```markdown
# Build Trace: {runId}

**Started:** {ISO 8601}
**Completed:** {ISO 8601}
**Spec version:** {version at start} → {version at end}
**Phase type:** {Capability | Hardening | Refactor | Integration | Polish}
**Result:** {completed | partial | abandoned}
**Chunks:** {completed}/{total} ({failed} failed, {blocked} blocked)

## Chunks

### Chunk {N}: {name} — {status}
- **Sections:** {#alias1 (N.N), #alias2 (N.N)}
- **File manifest:** Creates: {list} | Modifies: {list}
- **Scope compliance:** {compliant | N violations} — {details if violations}
- **Uncertainty register:** KNOWN: {count} | ASSUMED: {count} | UNKNOWN: {count, note if any were blocking}
- **Attempts:** {count}/{maxRetries}
- **Duration:** {human-readable}
- **Scenarios targeted:** {list}
- **Verification:** {passed | failed | skipped} — {one-line summary}
{if retried:}
- **Retry history:** Attempt 1: {reason for failure}. Attempt 2: {different approach}. {etc.}
{if failed:}
- **Failure reason:** {brief description}
- **Independent chunks continued:** {yes/no, which ones}

## Verification Summary

| Chunk | Observer Verdict | Details |
|-------|-----------------|---------|
| {name} | {passed/failed/skipped} | {one-line} |

## Experience Questions

{if any:}
- **Q:** {question text} → **A:** {user's answer} (blocked chunks: {list})
{if none:}
No experience questions were needed.

## Context Decisions

- {e.g., "Chunk 3 used fresh context (isolated mode) — no dependency on prior chunks"}
- {e.g., "Context budget gate triggered at chunk 5 — checkpointed and continued in fresh session"}

## Experience Report

{The same experience report presented to the user — what they can now do}

## Resumption Context

{if any chunks failed or were interrupted:}
### Chunk {N}: {name}
- **Approaches tried:** {what was attempted, in order}
- **Why it failed:** {root cause or best understanding}
- **Alternatives considered:** {other strategies that were discussed or partially explored}
- **Architectural insight:** {what was learned about the codebase or problem space}
{if none:}
All chunks completed successfully. No resumption context needed.

## Deferred Insights

{if any agent-discovered opportunities emerged during implementation:}
- {section context}: {what was discovered and why it matters}
- {section context}: {what was discovered and why it matters}
{if none:}
No deferred insights recorded.

## Proof Blocks

{if any verifiable checks were performed:}
### Proof: {check name}
\`\`\`bash
{command}
\`\`\`
Expected: `{expected output}`
Actual: `{actual output}` {✓ or ✗}
{repeat for each proof block}

{if none:}
No proof blocks recorded (verification was observational only).

## Lessons Recorded

{if any:}
- {timestamp} | #{section-alias}: {one-line lesson summary}
{if none:}
No lessons were recorded during this build.
```

## Relationship Rule Check

After generating the trace, check `relationshipRules` in `.fctry/config.json`:
if the spec version changed significantly since the build started (compare
`plan.specVersion` to current) and a rule matches, include it in the version
rationale: "Spec version jumped from 1.9 to 2.0 — per version relationship
rules, recommending external minor bump."
