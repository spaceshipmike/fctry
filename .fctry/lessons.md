# Build Learnings

> Cross-session build learnings for fctry. Append-only, git-tracked.
> Managed by the Executor (writes) and State Owner (maturation, pruning, compaction).
>
> Entry format:
> ### {ISO 8601 timestamp} | #{section-alias} ({section-number})
> **Status:** candidate | **Confidence:** 1
> **Trigger:** {failure-rearchitect | retry-success | tech-stack-pattern | experience-question}
> **Context:** {What was attempted}
> **Outcome:** {What failed or succeeded}
> **Lesson:** {What to do differently next time}
>
> Maturation lifecycle: candidate (confidence 1) -> active (confidence 3+)
> Only active lessons influence builds. State Owner manages transitions.

---
