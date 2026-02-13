# Shared Concepts

Canonical definitions used across agents and commands. Individual files
reference this document instead of restating these concepts.

## Factory Philosophy

This skill operates under the Software Factory model:

- **Code is not written by humans.** The coding agent writes all code.
- **Code is not reviewed by humans.** The spec and scenarios are the contract.
- **Tests become scenarios.** End-to-end user stories, evaluated by LLMs,
  stored outside the codebase like holdout sets in ML.
- **Pass/fail becomes satisfaction.** Of all trajectories through all
  scenarios, what fraction satisfy the user? Probabilistic, not boolean.
- **The spec describes experience, not implementation.** The spec captures
  WHAT the system does and HOW it feels. The agent figures out the rest.

## Experience Language

The spec describes what users see, do, and feel. Never databases, APIs, or
code patterns. The coding agent translates experience into implementation.

**Good:** "The list loads instantly with items sorted by urgency, overdue
ones highlighted."
**Bad:** "SELECT * FROM items ORDER BY urgency DESC; render with red badges."

If you catch yourself writing a database schema, API endpoint, or CSS class
name — stop. Describe the need, not the solution.

## Holdout Set Concept

Scenarios are to autonomous development what holdout sets are to machine
learning. They're kept separate from the codebase. The coding agent builds
toward satisfying them, but can't "teach to the test" because they describe
experience, not implementation.

- Stored in `{project-name}-scenarios.md`, separate from the spec
- Evaluated by LLM-as-judge
- Satisfaction is probabilistic, not boolean

## Numbered Options Pattern

All questions, options, and choices presented to the user are numbered:

```
(1) First option
(2) Second option
(3) Third option
```

The user can respond by number ("2"), by range ("1, 3"), or by natural
language ("the second one"). Numbering is a convenience, not a constraint.
This applies across all agents and commands.

## State Owner First Rule (Enforced)

Every command consults the State Owner before any other agent acts. The
State Owner's briefing grounds all subsequent agents in reality — what
code exists, what the spec says, where they diverge, what changed recently.

Without this grounding, agents operate on assumptions instead of facts.

**This rule is enforced, not just documented.** Each agent checks
`completedSteps` in `.fctry/fctry-state.json` before proceeding. If the
State Owner hasn't run, the agent surfaces a numbered error with options
to run it, skip it, or abort. See `references/state-protocol.md` for the
full prerequisite table and enforcement protocol.

## Status State Protocol

Agents write status updates to `.fctry/fctry-state.json` as they work,
enabling the terminal status line and spec viewer to show real-time
activity. See `references/state-protocol.md` for the full schema,
write semantics, and per-agent field ownership.

## Agent Authority

Section 6.4 of every spec explicitly grants the coding agent full authority
over technology choices, architecture, data model, and all other
implementation decisions. The spec constrains experience, not code.

If you catch yourself specifying a database, framework, or code pattern —
stop. Describe the need, not the solution.
