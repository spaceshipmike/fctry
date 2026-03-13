# Executor Templates

Templates for build plans, experience reports, CLAUDE.md enrichment, and release
summaries. Loaded by the Executor agent on demand — not always in context.

## Build Plan Format

```
## Build Plan — {Project Name}

**Current state:** {X} of {Y} scenarios satisfied
**Spec version:** {version from spec frontmatter}
**Assessment date:** {date}

**Phase type:** {Capability | Hardening | Refactor | Integration | Polish} — {one-sentence explanation of why this characterization fits}

### Chunk 1: {Name} (estimated: {small/medium/large})
**Targets scenarios:**
- {Scenario name} (currently: unsatisfied)
- {Scenario name} (currently: partially satisfied)

**Spec sections:** `#alias` (N.N), `#alias` (N.N)

**What this involves:**
{2-3 sentence description of the work}

**Why this order:**
{Brief rationale — convergence strategy, dependency, impact}

### Chunk 2: {Name} ...
...

### Chunk N: {Name} [GATE] (estimated: {scope})
{Chunks marked [GATE] are goal gates — the build cannot declare completion
until all goal-gate chunks reach Observer satisfaction. Typical goal gates:
core user-facing flow, primary integration, user-flagged critical chunks.}

### Execution Strategy
**Priorities:** {speed > reliability > token efficiency} ({source: global | project | user prompt})

{How the priorities shaped the plan. Example: "Speed is your top priority,
so this plan uses aggressive retries and moves past stuck chunks quickly.
Chunks execute in dependency order: 1 and 2 first, then 3 and 4."}

**Failure approach:** {How the build handles chunk failures. Example: "Retry
once with a different approach, then move on and report the gap."}

### Questions / Ambiguities
- {Any spec ambiguities noticed during assessment — reference by `#alias` (N.N)}
```

### Phase Types

Characterize the plan before listing chunks:

- **Capability** — Adding net-new user-facing abilities. Inferred when most
  chunks target `ready-to-build` or `ready-to-execute` sections.
- **Hardening** — Improving reliability for existing features. Inferred when
  most chunks target `aligned` sections with unsatisfied scenarios.
- **Refactor** — Restructuring without changing behavior. Inferred when chunks
  primarily reorganize existing code.
- **Integration** — Making components work end-to-end. Inferred when chunks
  cross multiple convergence phases.
- **Polish** — Improving UX coherence. Inferred when chunks target `#details`
  (2.11), `#spec-viewer` (2.9), or experience-refinement sections.

The phase type is derived fresh each time — never stored. It shapes the release
summary headline.

### Cognitive Tier Note

When the plan contains architecture-level chunks:

```
Cognitive tier: Architecture — Chunk 3 requires cross-codebase reasoning.
This plan produces best results with Opus or equivalent.
```

Three tiers: **mechanical** (no note), **implementation** (no note, default),
**architecture** (note shown). Informational, not blocking.

## Experience Report Format

```
## Build Complete

Here's what you should now be able to do:

- {Concrete thing the user can see, touch, or try — mapped from satisfied scenarios.
  Describe the experience, not the scenario ID.}

- {Another concrete experience the user can try.}

- {Another concrete experience.}

Go try these out. If something doesn't match your vision, run /fctry:evolve
to describe what you'd like to change.

{If any chunks failed or scenarios remain unsatisfied:}

What's not yet working:
- {What the user would expect to see but can't yet, in experience terms.
  Brief explanation of what happened, not technical details.}

Section satisfaction:
  #core-flow (2.2): 5/5 satisfied
  #spec-viewer (2.9): 3/6 satisfied — dark mode, search, export unsatisfied
  #execute-flow (2.7): 8/10 satisfied — parallel execution, async inbox unsatisfied

Build economics:
  Chunk 1: ~45K tokens | Chunk 2: ~62K tokens | Chunk 3: ~38K tokens
  Total: ~145K tokens ({N} chunks, {M} retries)
```

### Consolidated Findings (append when behavioral review produced findings)

When the build-level consolidation pass resolved or merged findings:

```
Findings resolved during the build:
- {Finding from chunk N that was fixed by chunk M's work}

Remaining attention areas:
- {Consolidated finding that still applies to the final codebase}
```

Omit the "Findings resolved" section if no findings were resolved (all
still apply). Omit the entire consolidated findings block if no chunk
produced behavioral review findings.

### Context Health Summary (append to experience report)

- **No pressure:** "Context pressure: none" (single line).
- **Moderate pressure:** "Context: compaction fired N times, mostly in
  {sections}. Fidelity: {mode used between chunks}."
- **High pressure:** Full breakdown — which chunks stressed context, what
  fidelity mode was used, whether quality degraded.

### Retry Transparency

When a chunk required multiple attempts: "The sorting implementation took three
approaches before finding one that satisfied the scenario." Transparency without
technical detail. Name the escalation stage reached: "Required restructuring
(new approach after environment recovery failed)."

## Executor Attestation Format

After each chunk completes, emit a structured attestation in the build trace:

```
Attestation: {chunk name}
Built: {what was implemented — concrete deliverables}
Deferred: {what was intentionally skipped, with reason} | none
Reason: {why deferrals were made} | n/a
Escalation stage: {retry | recover | restructure | escalate | clean}
```

The `clean` escalation stage means no failures occurred. The attestation feeds
the Observer's verification pass and prevents silent omissions.

## Release Summary Format

When suggesting a minor or major version bump:

- **Headline**: One sentence describing the experience shift — what the user can
  now do, not what code changed.
- **Highlights**: Bullet list of user-visible outcomes the user can try right now.
- **Deltas**: Affected spec sections by alias and number, each with a one-line
  description of what changed.
- **Migration**: Steps if the build changed behavior. "None" if nothing breaks.

The release summary feeds the changelog entry. Minor version release notes tell
the story of the convergence phase they complete; major version notes describe
the full experience arc.

### Convergence-to-Version-Arc Framing

Each convergence phase maps to a minor version arc. Frame minor bumps as phase
completion: "This build completes the Spec Viewer phase — all viewer scenarios
satisfied. Suggesting 0.16.0 as the start of the Execute phase."

## CLAUDE.md Build Layer Template

```markdown
## Current Build Plan
{The approved plan — which chunks, which scenarios, in what order.
Include parallelization strategy and git strategy.
Mark completed chunks as they finish.}

## Architecture
{Discovered during implementation — tech stack, project structure,
test/build commands, key patterns. Written after the first chunk.}

## Convergence Order
{From spec `#convergence-order` (6.2)}

## Versioning (from `.fctry/config.json` registry)
- External version: {current external version from registry}
- Spec version: {current spec version from registry}
- Patch (0.X.Y): auto-incremented per chunk via `auto-version` hook
- Minor (0.X.0): suggested at plan completion, user approves
- Major (X.0.0): suggested at experience milestones, user approves
- Propagation targets: {list of files from registry}
```

Read the existing CLAUDE.md first. Identify where the evergreen content ends.
Preserve the evergreen layer byte-for-byte. Replace or append the build layer.
On subsequent runs, replace the entire build layer with fresh content. The
architecture section should accumulate — preserve decisions from prior runs.

## Output Tier Scaling

Derive the tier from the approved plan:

- **Patch tier** — 1-2 chunks, ≤3 files. Minimal plan (chunk list + scenarios,
  no rationale prose). Brief experience report. No release interchange.
- **Feature tier** — multi-section, new capabilities. Standard plan with
  rationale. Detailed experience report. Release interchange with headline
  and highlights.
- **Architecture tier** — restructures, full inits, convergence changes.
  Comprehensive plan with risk assessment. Detailed experience report with
  before/after comparison. Full release interchange with deltas and migration.

The tier is a read on the plan's scope — not a user setting.
