# Memory Protocol

Global memory management protocol for `~/.fctry/memory.md`. Used by the
State Owner (read/write/manage) and Interviewer (read/write digests).

## Memory File Format

`~/.fctry/memory.md` contains four types of entries:

```markdown
### {ISO timestamp} | {type} | {project-name}

**Section:** #{alias} ({number})          ← optional, omitted for preferences
**Content:** {The memory content}
**Authority:** user | agent               ← user entries win conflicts
**Status:** active                        ← or: superseded | consolidated
**Supersedes:** {timestamp of older entry} ← only on decision records
```

Entry types and token ceilings:
- **conversation-digest** (~300 tokens) — Structured summary of an evolve or
  init conversation. Fields: section aliases, questions with answers, decisions
  with rationale, open threads.
- **decision-record** (~150 tokens) — A choice the user made with enough
  context to propose as a default next time.
- **cross-project-lesson** (~200 tokens) — A codebase-agnostic pattern learned
  on one project, tagged with structural context.
- **user-preference** (~50 tokens) — An observed pattern in how the user works.

## Reading and Selection (Token-Budgeted Injection)

Total injection budget: ~2000 tokens per scan. The fused ranking algorithm is
in `src/memory/ranking.js`:

```javascript
import { selectMemoryEntries, formatForBriefing } from './src/memory/ranking.js';
const result = selectMemoryEntries(markdown, {
  targetAliases: ['core-flow', 'error-handling'],
  broadScan: false,
  tokenBudget: 2000,
  currentProject: 'my-project',
  currentTechStack: 'node, express',
});
console.log(formatForBriefing(result));
```

### Scoring Algorithm

Score each active entry across three signals (weighted sum):

1. **(a) Section alias match** (weight 0.50) — entries tagged with the same
   section alias as the current command score highest.
2. **(b) Recency** (weight 0.30) — newer entries score higher, normalized to
   [0, 1].
3. **(c) Type priority** (weight 0.20) — decision records (1.0) >
   cross-project lessons (0.75) > conversation digests (0.50) > preferences
   (0.25).
4. **Authority boost** — user-authored entries receive +0.05.

Select by fused score with **diversity penalty** (0.6x per same-section entry
already selected). Continue until the ~2000 token budget is exhausted.

### Injection Format

```
### Relevant Memory
3 entries selected (1,847 tokens of ~2,000 budget):
- decision-record | project-a | 2026-02-20: User prefers "update spec" for #core-flow drift
- cross-project-lesson | project-b | 2026-02-15: Playwright MCP times out on hydration-heavy pages
- conversation-digest | project-a | 2026-02-18: Discussed sorting in #core-flow, decided urgency-first
```

## Decision Record Proposals

When a decision record matches the current context, propose the remembered
choice as the default:

```
(1) [remembered choice summary] (your previous preference)
(2) [alternative option]
```

Use `formatDecisionProposal(entry, alternative)` from `src/memory/ranking.js`.

## Decision Supersession

Use `applySupersession(entries)` from `src/memory/ranking.js`:

1. Group decision records by section alias + decision type.
2. **Authority check:** `user`-authored entries can only be superseded by other
   `user`-authored entries.
3. Mark older records `Status: superseded` with:
   - `**Superseded-By:** {timestamp of replacement}`
   - `**Superseded-At:** {ISO timestamp when detected}`
4. Superseded entries are preserved (audit trail) but excluded from selection.

## Type-Differentiated Staleness

- **Conversation digests** — Pruned when the referenced section was
  significantly rewritten since the digest's timestamp.
- **Decision records** — Pruned only when superseded.
- **Cross-project lessons** — Never auto-pruned. Removed only when the
  referenced tech stack no longer exists in any active project.
- **User preferences** — Pruned when contradicted by 3+ newer observations.

## Consolidation

When conversation digests or decision records about the same structural pattern
accumulate:

1. Detect: 5+ entries about the same section type across 3+ projects.
2. Synthesize: distill into a single cross-project lesson.
3. Mark originals: `Status: consolidated` (preserved, excluded from recall).
4. Append the new cross-project lesson.

Silent — no CLI output. Run during scan when density is detected.

## Cross-Project Structural Matching

Use `matchesCrossProject(lesson, context)` from `src/memory/ranking.js`:

1. Section type match (worth 2 points): same or similar alias.
2. Tech stack overlap (worth 1 point): overlapping tech keywords.
3. Dependency pattern match (worth 1 point): similar tag overlap.

**Conservative threshold: 2+ signals.** False negatives are better than false
positives. Same-project lessons are excluded (handled by lessons.md).

```javascript
import { matchesCrossProject } from './src/memory/ranking.js';
const applies = matchesCrossProject(lesson, {
  projectAliases: ['core-flow', 'spec-viewer'],
  techStack: 'node, express, sqlite',
  currentProject: 'my-project',
});
```

## Lessons Compaction

When `.fctry/lessons.md` exceeds 50 entries:

1. Group oldest entries by section alias.
2. Compact each group of `active` entries into a single summary. `candidate`
   entries at compaction time are pruned (not compacted).
3. Write to a temporary file, then **atomically rename** to prevent corruption.

## Memory Distillation

After milestones or when lesson density reaches threshold (10+ active across
3+ sections), synthesize higher-order cross-cutting insights:

```markdown
## Distilled Insight
{timestamp}
Source lessons: {IDs}
{Cross-cutting pattern}
```

Distilled insights:
- Rank above individual lessons in injection
- Not subject to confidence scoring
- Pruned only when all source lessons are pruned
- Source lessons carry a `Distilled-Into` reference

## Conversation Digest Format (Interviewer)

```markdown
### {ISO timestamp} | conversation-digest | {project-name}

**Section:** #{alias} ({number})
**Content:** Discussed {topic}. Questions: {key questions asked with answers}.
Decisions: {choices made with rationale}. Open threads: {unresolved items}.
**Authority:** agent
**Status:** active
```

Rules:
- ~300 token ceiling per digest
- One digest per topic shift (not per session)
- Tag with section alias for future matching
- Capture reasoning, not just outcomes
- Silent — no CLI announcement
- Create `~/.fctry/memory.md` if it doesn't exist
