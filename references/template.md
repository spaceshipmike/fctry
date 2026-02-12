# {System Name} — Natural Language Specification

```yaml
---
title: {System Name}
spec-version: 0.1
date: {YYYY-MM-DD}
status: draft | review | approved | building
author: {name}
spec-format: nlspec-v2
---
```

{One-paragraph summary: what this system is, what it does, and who it's for.
State it declaratively — "X is a Y that does Z" — not aspirationally.
This paragraph is what a coding agent reads first. It should contain enough
information to understand the system's purpose, the experience it delivers,
and the scope of what it covers.}

---

## Table of Contents

{Every section and subsection appears here with both its number and alias.
Aliases are short, meaningful, kebab-case names that remain stable across
spec evolutions. Users reference sections by either number or alias in
commands like `/fctry:evolve core-flow` or `/fctry:evolve 2.2`.}

1. [Vision and Principles](#1-vision-and-principles)
   - 1.1 [Problem Statement](#11-problem-statement) `#problem-statement`
   - 1.2 [What This System Is](#12-what-this-system-is) `#what-this-is`
   - 1.3 [Design Principles](#13-design-principles) `#design-principles`
   - 1.4 [What Success Looks Like](#14-what-success-looks-like) `#success`
2. [The Experience](#2-the-experience)
   - 2.1 [First Run / Onboarding](#21-first-run--onboarding) `#first-run`
   - 2.2 [Core Flow](#22-core-flow) `#core-flow`
   - 2.3 [{Secondary Flow}](#23-secondary-flow) `#secondary-flow`
   - 2.4 [What Happens When Things Go Wrong](#24-what-happens-when-things-go-wrong) `#error-handling`
   - 2.5 [The Details That Matter](#25-the-details-that-matter) `#details`
3. [System Behavior](#3-system-behavior)
   - 3.1 [Core Capabilities](#31-core-capabilities) `#capabilities`
   - 3.2 [Things the System Keeps Track Of](#32-things-the-system-keeps-track-of) `#entities`
   - 3.3 [Rules and Logic](#33-rules-and-logic) `#rules`
   - 3.4 [External Connections](#34-external-connections) `#connections`
   - 3.5 [Performance Expectations](#35-performance-expectations) `#performance`
4. [Boundaries and Constraints](#4-boundaries-and-constraints)
   - 4.1 [Scope](#41-scope) `#scope`
   - 4.2 [Platform and Environment](#42-platform-and-environment) `#platform`
   - 4.3 [Hard Constraints](#43-hard-constraints) `#hard-constraints`
   - 4.4 [Anti-Patterns](#44-anti-patterns) `#anti-patterns`
5. [Reference and Prior Art](#5-reference-and-prior-art)
   - 5.1 [Inspirations](#51-inspirations) `#inspirations`
   - 5.2 [Experience References](#52-experience-references) `#experience-refs`
6. [Satisfaction and Convergence](#6-satisfaction-and-convergence)
   - 6.1 [Satisfaction Definition](#61-satisfaction-definition) `#satisfaction`
   - 6.2 [Convergence Strategy](#62-convergence-strategy) `#convergence`
   - 6.3 [Observability](#63-observability) `#observability`
   - 6.4 [What the Agent Decides](#64-what-the-agent-decides) `#agent-decides`

Appendices:
- [A: Decision Rationale](#appendix-a-decision-rationale)
- [B: Glossary](#appendix-b-glossary)

---

## 1. Vision and Principles

### 1.1 Problem Statement {#problem-statement}

{What is broken, painful, or missing in the world that this system
addresses? Be specific about who feels the pain and what it costs them.
This is the WHY — not the how. 2-3 paragraphs max.}

### 1.2 What This System Is {#what-this-is}

{One paragraph. Declarative. "X is a Y that does Z for audience A."
Not what it could be someday — what v1 is.}

### 1.3 Design Principles {#design-principles}

{3-7 principles that CONSTRAIN decisions. Each must rule something out.
These guide the coding agent when the spec is silent — the agent should
be able to look at a principle and know which of two options to choose.

Write these as experience principles, not technical principles.
"Fast and local" is a principle. "Uses SQLite" is an implementation
detail the agent can figure out from the principle.}

**{Principle name}.** {What this means for the experience and what it rules out.}

### 1.4 What Success Looks Like {#success}

{Describe the emotional/functional outcome when this system works.
Not features — the feeling. "The user opens the app and within
30 seconds has a clear picture of..." This is the north star
the agent optimizes toward.}

---

## 2. The Experience

{This section describes what the user sees, does, and feels — screen by
screen, interaction by interaction. It is the most important section of
the spec.

The coding agent reads this to understand WHAT to build. Everything else
(tech stack, data model, architecture) is the agent's job to figure out
from this description.

Write this as if you're walking someone through the app for the first time.
Use present tense: "The user sees..." not "The user should see..."}

### 2.1 First Run / Onboarding {#first-run}

{What happens the very first time someone uses this system? What do they
see? What do they need to do before they can get value? How long should
this take?}

### 2.2 Core Flow {#core-flow}

{The primary thing the user does with this system. Walk through it step
by step.

For each step:
- What does the user see?
- What action do they take?
- What happens in response?
- How long should it take?
- What does it feel like? (instant? contemplative? progressive?)}

### 2.3 {Secondary Flow} {#secondary-flow}

{Repeat for each distinct flow. Give each a meaningful alias.}

### 2.4 What Happens When Things Go Wrong {#error-handling}

{The user's experience of failure. Not error codes — what the user sees,
what they understand, what they can do.}

| What Went Wrong | What the User Sees | What They Can Do |
|----------------|-------------------|-----------------|
| {failure mode} | {user experience} | {recovery action} |

### 2.5 The Details That Matter {#details}

{Specific UX decisions that define the character of this system. Keyboard
shortcuts, animations, default states, empty states, loading states,
responsive behavior.

Only include details you have an opinion about. The agent fills in the
rest from the design principles.}

---

## 3. System Behavior

{What the system DOES — not how it's built, but what behavior it exhibits.
A good test: could a non-technical person read this section and understand
what the system does?}

### 3.1 Core Capabilities {#capabilities}

{What can this system do? List capabilities as behaviors, not features.}

**{Capability name}.** {What it does and how it behaves.}

### 3.2 Things the System Keeps Track Of {#entities}

{The entities in your system, described in plain language. Not a data model.}

The system keeps track of:

- **{Entity name}** — {What it is, what information matters, how it relates to other things.}

### 3.3 Rules and Logic {#rules}

{Business rules, validation rules, computed values, automatic behaviors.}

- {Rule: declarative statement of what must be true.}

### 3.4 External Connections {#connections}

| Connects To | What Flows | Direction | If Unavailable |
|-------------|-----------|-----------|---------------|
| {service} | {data} | {direction} | {fallback} |

### 3.5 Performance Expectations {#performance}

{How fast should things be? Experiential expectations, not technical metrics.}

- {Expectation in experiential terms.}

---

## 4. Boundaries and Constraints

### 4.1 Scope {#scope}

**This spec covers:** {What the system does.}

**This spec does NOT cover:** {What is explicitly out of scope and why.}

### 4.2 Platform and Environment {#platform}

| Dimension | Constraint |
|-----------|-----------|
| Platform | {e.g., "Web app, modern browsers"} |
| Devices | {e.g., "Desktop-first, responsive to tablet"} |
| Connectivity | {e.g., "Requires internet" or "Works offline"} |
| Accounts | {e.g., "Single user, no auth"} |

### 4.3 Hard Constraints {#hard-constraints}

{Things the agent cannot choose differently. State as experience
constraints, not technology mandates.}

- {Constraint and why it's non-negotiable.}

### 4.4 Anti-Patterns {#anti-patterns}

{What this system must NOT be or do.}

- {What this system must NOT be or do, and why.}

---

## 5. Reference and Prior Art

### 5.1 Inspirations {#inspirations}

{Products, apps, or designs that capture something about the experience.}

- **{Name}** ({url}) — {What to study from it.}

### 5.2 Experience References {#experience-refs}

{Visual and design references with stored images and interpretations.}

- **{Reference name}** — See [references/{filename}](references/{filename}).
  {Experience-language interpretation of the design reference.}

---

## 6. Satisfaction and Convergence

### 6.1 Satisfaction Definition {#satisfaction}

{What does "satisfied" mean for this system as a whole?}

The system is satisfactory when:

- {High-level satisfaction criterion.}

### 6.2 Convergence Strategy {#convergence}

**Start with:** {What the first working version should demonstrate.}

**Then layer in:** {What to add once the core works.}

**Finally:** {What makes it feel finished.}

### 6.3 Observability {#observability}

Key signals to watch:

- {Signal: what it tells you about the experience.}

### 6.4 What the Agent Decides {#agent-decides}

The coding agent has full authority over:
- Technology choices (language, framework, database, tooling)
- Architecture and code structure
- Data model design
- Internal APIs and interfaces
- Testing strategy and tooling
- Build and deployment configuration
- Error handling implementation
- Performance optimization approach

The agent's implementation decisions are constrained only by:
- The design principles in Section 1.3 `#design-principles`
- The hard constraints in Section 4.3 `#hard-constraints`
- The experience described in Section 2
- Satisfaction of the scenarios in scenarios.md

No human reviews the code. The code is validated solely through
scenario satisfaction and convergence.

---

## Appendix A: Decision Rationale

{For key experience decisions: why this choice and not that one.}

**Why {decision}?** {Rationale.}

## Appendix B: Glossary

| Term | Meaning |
|------|---------|
| {Term} | {What it means in this context.} |

---

## Section Addressing

{This section is a reference for how addressing works in this spec.
Every section has both a number (e.g., 2.2) and an alias (e.g., #core-flow).
Both appear in the Table of Contents. Either can be used in fctry commands:

  /fctry:evolve core-flow     — targets section 2.2 by alias
  /fctry:evolve 2.2           — targets section 2.2 by number
  /fctry:ref 2.4 https://...  — maps a reference to section 2.4

Alias naming conventions:
- Use kebab-case: `#core-flow`, not `#coreFlow` or `#Core_Flow`
- Be descriptive: `#error-handling`, not `#eh` or `#section4`
- Keep stable: aliases survive evolve operations — don't rename without reason
- Derive from content: the alias should reflect what the section describes

When adding new subsections during evolve, assign both a number and alias.
When removing a section, note the removed alias in the changelog so agents
know it no longer resolves.}
