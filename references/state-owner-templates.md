# State Owner Templates

Output formats for the State Owner agent. Loaded on demand during scans.

## Project Classification

| Classification | What It Means |
|----------------|---------------|
| **Greenfield** | No codebase exists. The spec is the sole source of truth. Clean slate. |
| **Existing — No Spec** | Codebase exists but has no factory-style spec. The code IS the current truth. The system's behavior, capabilities, and experience need to be discovered from what's built. |
| **Existing — Has Spec** | Codebase and spec both exist. Need to assess whether they match. |
| **Existing — Has Docs** | Codebase exists with some documentation (README, scattered notes, PRDs) but not a factory-style spec. Docs are a starting point but may not reflect reality. |

For **Existing — No Spec** projects, the briefing is the foundation everything
else builds on. Be thorough — describe the system's actual behavior,
architecture patterns, user-facing capabilities, and the experience it
currently delivers.

## Briefing Format

```
## State Briefing: {topic}

**Reality Index:** {high | medium | low}
{high = read relevant files, spec index fresh, git history clear.
 medium = some files skipped or spec index stale.
 low = major portions unknown or last scan many sessions ago.
 This tells downstream agents how much to trust this briefing.}

### Project Classification
{One of: Greenfield | Existing — No Spec | Existing — Has Spec | Existing — Has Docs}

### What Exists
{Current state of the relevant parts of the system.
For existing projects: describe the system's capabilities, user-facing
behavior, architecture patterns, and current experience as built.
For greenfield: "No existing code. The spec is the sole source of truth."}

### Relevant Code
{Key files, modules, and patterns that relate to this change.
For existing projects without a spec: include a high-level map of the
codebase — major directories, entry points, key modules, tech stack.}

### Impact Assessment
{What would be affected by the proposed change.
For init on existing projects: what are the fragile areas, the technical
debt, the things that work well and shouldn't be disrupted?}

### Spec Alignment
{Only report misalignment — where the spec and reality diverge.
Do NOT list aligned/accurate sections; alignment is the assumption.
Reference spec sections by alias and number (e.g., "`#core-flow` (2.2)")
so the Spec Writer and Executor can act on specific sections.
For projects without a spec: "No existing spec. This briefing serves as
the baseline for spec creation."
If everything is aligned, omit this section entirely.}

### Existing Documentation
{For projects with docs/README/notes: summarize what exists, assess its
accuracy against the code, flag anything outdated or misleading.
For greenfield or no-docs: omit this section.}

### Relevance Manifest
{Scoped list of files and spec sections that matter for the current
command. Subsequent agents and session resumption use this to load
targeted context instead of scanning broadly.
Format: file paths (relative to project root) and section aliases.
Only include what's relevant — not the entire codebase.}

### Recommendations
{What the Spec Writer should consider when updating the spec.
For init on existing projects: which behaviors should the spec codify
as-is vs. which should be flagged for the user to reconsider?}
```

## Scoped Briefing Adaptations

When a command targets a specific section (e.g., `/fctry:evolve core-flow`):

1. Read the targeted section in the spec.
2. Identify dependencies — which other sections this one references or depends
   on, and which reference it.
3. Scope the scan to files relevant to the target and its dependencies.
4. Title the briefing with the targeted section:
   `## State Briefing: #core-flow (2.2)`.
5. Always list the dependency neighborhood:
   ```
   ### Dependency Neighborhood
   - #core-flow (2.2) — the target
   - #first-run (2.1) — referenced by core-flow for onboarding
   - #error-handling (2.10) — handles core-flow failure modes
   - #capabilities (3.1) — lists core-flow as a capability
   ```

## Drift Summary Format

When multiple conflicts are found:

```
### Drift Summary

Found {N} conflicts between spec and code:

(1) `#core-flow` (2.2) — Sorting order: spec says relevance, code uses date
    Assessment: Code ahead (committed 2 days after spec update)
(2) `#error-handling` (2.10) — Missing retry logic in code
    Assessment: Spec ahead (added in last evolve, not yet built)
(3) `#entities` (3.2) — Extra "tags" field in code, not in spec
    Assessment: Diverged (no clear lineage)
```

## Working Memory Injection Format

```
### Working Memory
Build: Chunk 2/4 in progress (State Owner Session Intelligence)
Recent changes: #rules (3.3) updated 2h ago, #capabilities (3.1) updated 2h ago
Inbox: 3 pending (1 evolve idea, 2 references)
Focus: #capabilities (3.1) — last active chunk target
```

Working memory is injected within the same ~2000 token budget as lessons and
global memory. It is ephemeral — derived from existing state files each time.

## Section Readiness Values

| Readiness | Meaning |
|-----------|---------|
| `draft` | Section has fewer than 30 words of content — too thin to build from |
| `undocumented` | Code exists but spec doesn't describe it (State Owner overrides heuristic) |
| `ready-to-build` | Spec describes it but code doesn't exist yet |
| `aligned` | Spec and code match (confirmed by deeper analysis) |
| `ready-to-execute` | Aligned, no open issues (set by State Owner after manual confirmation) |
| `satisfied` | Scenarios passing (set by Executor after scenario evaluation) |

## Readiness Summary in Briefing

```
### Section Readiness
| Readiness | Count |
|-----------|-------|
| aligned | 28 |
| ready-to-build | 5 |
| draft | 7 |
```

## Untracked Changes in Briefing

```
### Untracked Changes
{N} files changed outside fctry commands:
- `src/statusline/fctry-statusline.js` → `#status-line` (2.12) — 2026-02-13T10:05:00Z
- `src/viewer/client/app.js` → `#spec-viewer` (2.9) — 2026-02-13T10:12:00Z

Recommend: Run `/fctry:evolve` for affected sections or `/fctry:review` to reconcile.
```

## State File Writes

Write per-section readiness to `.fctry/state.json` after assessment:

```json
{
  "readinessSummary": { "aligned": 28, "ready-to-build": 5, "draft": 7 },
  "sectionReadiness": {
    "core-flow": "aligned",
    "first-run": "ready-to-build",
    "evolve-flow": "aligned",
    "ref-flow": "aligned"
  }
}
```

For workflow and status state updates, follow `references/state-protocol.md`.
