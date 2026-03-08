# Interview Templates

Phase question lists, state file template, and output formats for the
Interviewer agent. Loaded on demand during interviews.

## Interview State Template

Written to `.fctry/interview-state.md` after each phase:

```markdown
# Interview State — {Project Name}

**Status:** In progress
**Last updated:** {timestamp}
**Current phase:** {N} of 8
**Classification:** {from State Owner}

## Completed Phases

### Phase 1: What Are We Building?
**Completed:** {timestamp}
**Key decisions:**
- {One-sentence summary of each major decision} [CONFIRMED]
- {Inference the Interviewer made from context} [ASSUMED]

**Draft output:**
{The draft Section 1 text shared with the user}

### Phase 2: Walk Me Through It
**Completed:** {timestamp}
**Key decisions:**
- {Summary of flows captured} [CONFIRMED]

**Draft output:**
{The draft Section 2 text}

... (one section per completed phase)

## Pending Phases
- Phase {N}: {Phase name} — not started

## Uncertainty Markers
### OPEN — questions not yet answered
- {Question the user hasn't addressed yet}

### ASSUMED — inferences from context (need validation on resume)
- {Assumption the Interviewer made} — based on {evidence}

### MISSING — referenced but not provided
- {Information the user mentioned but didn't supply}

## References Shared
- {URLs or assets the user shared during the interview}
```

## Phase Question Lists

### Phase 1: What Are We Building? (5 min)

- What is this thing, in one sentence?
- Who is it for? Paint me a picture of the person using it.
- What problem does it solve? What's painful or broken today?
- When this works perfectly, what does the user feel?
- What's the scale? (weekend hack, serious tool, ongoing product)
- Any non-negotiable experience constraints? (must work on phones, must work
  without internet, must be usable by non-tech-savvy people, etc.)
- "When did this go from 'interesting idea' to 'something you actually need'?"
- "If you had to describe this project to someone else in one sentence, what
  would you say?"

### Phase 2: Walk Me Through It (15 min)

- "I just opened this for the first time. What do I see?"
- "OK, I see that. What do I do next?"
- "I tapped that. What happened?"
- "Now I want to [core task]. Walk me through it."
- "That loaded. How long did it take? Did I wait, or was it instant?"
- "What if I had 500 of those instead of 5? Does the experience change?"

Then: "What else can I do?", "What does configuration look like?"

### Phase 3: What Could Go Wrong? (5 min)

- "I'm using this and my internet drops. What happens?"
- "I entered something wrong. What do I see?"
- "The thing I'm looking for isn't there. What does that look like?"
- "I accidentally deleted something. Can I get it back?"

### Phase 4: What Does the User Expect? (10 min)

- "When you come back tomorrow, what does the system remember?"
- "You mentioned items — if I'm looking at one, what information matters?
  What do I need to see at a glance vs. drill into?"
- "Are there things that happen automatically?"
- "Does the user ever interact with something outside this system?"
- "When I tap that button, does it feel instant? Or is there a moment where
  I'm waiting?"

### Phase 5: Tell Me the Stories (15 min)

Coverage: Core value (2-3), Edge cases (2-3), Experience quality (1-2).
Nail down Given/When/Then and satisfaction criteria for each.

### Phase 6: Boundaries and References (5 min)

- "What does this spec NOT cover?"
- "What must this absolutely NOT be?" (anti-patterns)
- "What existing products inspired this?"

### Phase 7: How Do We Know It's Done? (5 min)

- "If you handed this to 10 people, what would make 8 say 'this works'?"
- "What should the first working version demonstrate?"
- "What gets layered in after the core works?"

### Phase 8: Readiness Review

Check before handoff:
- **Experience clarity:** Could someone read Section 2 and build the right
  thing? Are flows step-by-step, not just named?
- **Scenario strength:** Do scenarios cover core value? Each has specific,
  LLM-evaluable satisfaction criteria?
- **Boundaries:** Clear what the agent decides vs. what's constrained?
  Design decisions in the rationale appendix?

## Experience Language Translation

Bad/good question pairs — every question should be answerable by a non-coder:

| Bad (technical) | Good (experience) |
|----------------|-------------------|
| "What data does the system store?" | "When you come back tomorrow, what does the system remember?" |
| "Does it need real-time sync?" | "If two people are looking at this and one makes a change, does the other see it right away?" |
| "What's the data model?" | "You mentioned projects and tasks — when I'm looking at a project, what do I see about its tasks?" |
| "Does it integrate with any APIs?" | "Does the user ever interact with something outside this app?" |
| "What's the tech stack?" | "Does this need to work on phones, in a browser, or on the desktop? Can I use it on an airplane?" |

## Interchange Schema

```json
{
  "agent": "interviewer",
  "command": "init | evolve",
  "tier": "feature | architecture",
  "actions": [
    {
      "id": "PHS-001",
      "type": "phase-complete",
      "phase": "Phase 2: Walk Me Through It",
      "decisions": ["Core flow: urgency-sorted list with bulk import"],
      "openQuestions": ["Offline behavior not yet discussed"]
    }
  ]
}
```

Emit after each completed phase and on interview completion. The viewer renders
phase transitions as a progress timeline with expandable decision cards.
