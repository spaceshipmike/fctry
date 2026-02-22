# Scenarios — fctry

> These scenarios serve as the convergence harness for autonomous development. They are the holdout set — stored outside the codebase, evaluated by LLM-as-judge, measuring satisfaction not pass/fail. Scenarios are organized by feature — each feature is a named experience with its own scenarios, dependencies, and priority tiers.

---

## Feature Index

| Category | Feature | Scenarios | Depends on |
|----------|---------|-----------|------------|
| Core | Project Initialization | 9 | — |
| Core | Spec Evolution | 10 | Project Initialization |
| Core | Reference Integration | 4 | Project Initialization |
| Core | Spec Review | 4 | Project Initialization |
| Build | Autonomous Build | 12 | Spec Evolution |
| Build | Build Prioritization | 6 | Autonomous Build |
| Build | Version Management | 7 | Project Initialization |
| Build | Build Verification | 17 | Autonomous Build |
| Build | Context Resilience | 2 | Autonomous Build |
| Viewer | Spec Viewer | 14 | Project Initialization |
| Viewer | Live Spec Updates | 8 | Spec Viewer |
| Viewer | Build Mission Control | 4 | Spec Viewer, Autonomous Build |
| Viewer | Async Inbox | 7 | Spec Viewer |
| Viewer | Multi-Project Viewer | 5 | Spec Viewer |
| Viewer | Kanban Board | 5 | Multi-Project Viewer |
| Viewer | Auto-Generated Diagrams | 4 | Spec Viewer |
| System Quality | Workflow Enforcement | 9 | — |
| System Quality | Section Readiness | 18 | Spec Review |
| System Quality | Interaction Quality | 6 | — |

---

# Core Workflow

## Feature: Project Initialization
> I describe my vision and get a complete spec

Category: Core | Depends on: —

### Critical

#### Scenario: First-Time Project Initialization

> **Given** A user has a new project idea but no existing codebase or spec
> **When** They run `/fctry:init` and answer the interview questions about their vision, describing what users will experience and what boundaries exist
> **Then** They receive a complete NLSpec v2 document in `.fctry/spec.md` that captures their vision in experience language, with stable section aliases they can reference later, a `.fctry/scenarios.md` file that reflects the journeys they described, and a `CLAUDE.md` file at the project root containing evergreen project instructions — the factory contract (where the spec and scenarios live, the rule that the spec describes experience and the coding agent decides implementation), a command quick-reference for the fctry commands, a guide to the `.fctry/` directory and what each file is for, workflow guidance on how the factory process works, and an explanation of what scenarios are and how they drive validation

**Satisfied when:** The user can read the generated spec and recognize their vision accurately captured without any implementation details leaking in, every major user journey they described during the interview has a corresponding scenario in the scenario file, all generated files are organized in the `.fctry/` directory (except `CLAUDE.md` at root), and the `CLAUDE.md` is immediately useful to a coding agent encountering the project for the first time — it orients them on where things live, how the factory process works, and what rules to follow, without containing any build-specific content like architecture notes or convergence order (those come later at execute time).


---

#### Scenario: Project Synopsis Generated on Init

> **Given** A user completes `/fctry:init` for a new project, describing a task management app for small teams using Node.js and WebSocket
> **When** The Spec Writer produces the spec
> **Then** The spec's YAML frontmatter contains a `synopsis` block with six fields: `short` (one line under 80 characters capturing the project's identity), `medium` (2-3 sentences covering purpose, audience, and approach), `readme` (one paragraph suitable for a README.md intro), `tech-stack` (array of technologies mentioned or inferred), `patterns` (array of architectural patterns), and `goals` (array of project goals). All six fields are displayed in the init output summary so the user can copy them into package.json, README.md, or marketplace listings.

**Satisfied when:** The frontmatter is valid YAML with all six synopsis fields populated, the short description is under 80 characters and identifies the project, the medium and readme descriptions are progressively longer and more detailed, tech-stack and patterns reflect what was discussed in the interview, goals capture the user's stated objectives, and the output summary displays the full synopsis in a clearly labeled block.


---

#### Scenario: Interview Questions Are Experience-Only

> **Given** A non-technical user is going through `/fctry:init` for a new project — they have a clear vision of what they want users to experience but no knowledge of databases, APIs, or software architecture
> **When** The Interviewer asks questions across all 8 phases of the interview
> **Then** Every question is answerable without technical knowledge. The Interviewer never asks about data models, tech stack choices, API integrations, sync mechanisms, or storage. Instead, it asks what the user sees, what the system remembers, how fast things feel, and what happens when things go wrong — all from the user's perspective.

**Satisfied when:** A non-coder could complete the entire interview without ever feeling confused by a question or needing to say "I don't know, that's a technical decision." The resulting spec contains enough experiential detail that a coding agent can infer the data model, tech stack, and architecture without follow-up questions — but none of those technical concepts were ever surfaced to the user during the interview.


---

#### Scenario: Technical User Preferences Redirected to Experience

> **Given** A technically-savvy user is going through `/fctry:init` and volunteers implementation preferences like "I want it to use PostgreSQL" or "it should be a React app"
> **When** The Interviewer hears these preferences
> **Then** It redirects to the experience motivation: "What about the experience makes that important?" If the answer reveals an experience constraint (e.g., "must work offline" leading to SQLite), it captures the constraint in experience terms. If it's a pure implementation preference with no experience impact, it acknowledges it but doesn't include it in the spec — the agent decides implementation.

**Satisfied when:** Technical preferences that are actually experience constraints (offline, real-time, mobile-first) get captured as experience requirements. Pure implementation preferences (specific databases, frameworks, languages) are acknowledged but left to the coding agent, with the user understanding why.


---

#### Scenario: Multi-Session Interview Resume

> **Given** A user started `/fctry:init` for a complex project, answered questions about the core experience, but needs to stop before finishing the full interview
> **When** They return in a later session and run `/fctry:init` again in the same project
> **Then** The system picks up where they left off, shows them what was already covered, and continues with the remaining interview questions without making them repeat themselves

**Satisfied when:** The user can complete a project initialization across 3+ sessions over several days, and the final spec reflects inputs from all sessions coherently with no repeated questions or lost context.


---

#### Scenario: Init Produces a Draft Spec That Becomes Active on Completion

> **Given** A user runs `/fctry:init` for a new project and begins answering interview questions
> **When** The Spec Writer finishes generating the spec and the init command completes successfully
> **Then** The spec starts with `status: draft` in its frontmatter during the interview, and the Spec Writer transitions it to `status: active` as the final step of a successful init — the user sees the completed spec marked as `active`, signaling it is ready for evolution and building

**Satisfied when:** The user who opens their freshly generated spec sees `status: active` in the frontmatter. The transition from `draft` to `active` happened automatically as part of init completion — the user was never asked to confirm it. If init was interrupted before the Spec Writer finished (user quit, session died), the spec remains `draft` and the next `/fctry:init` picks up with a draft spec. The status transition is logged in the changelog.

Validates: `#core-flow` (2.2), `#rules` (3.3)


---

#### Scenario: Version Registry Seeded at Init

> **Given** A user runs `/fctry:init` and completes the interview for a new project
> **When** The system generates the spec, scenarios, and project instructions
> **Then** The system also seeds a version registry in `.fctry/config.json` with two default version types: an external project version (starting at 0.1.0) and an internal spec version (starting at 0.1), and the init summary shows the registry was created

**Satisfied when:** The user sees the version registry mentioned in the init summary alongside the spec and scenarios. The registry exists in `.fctry/config.json` with sensible defaults. The user doesn't need to configure anything — versioning is ready to go for the first execute. If config.json already existed (e.g., with execution priorities), the version registry is added alongside existing content without overwriting.

Validates: `#core-flow` (2.2), `#rules` (3.3)


---

### Edge Cases

#### Scenario: Resume After Interview Interruption

> **Given** A user is midway through a multi-session interview when Claude Code crashes or the user force-quits
> **When** They restart Claude Code and run `/fctry:init` again
> **Then** The system detects the incomplete interview state, shows what was already captured, and offers to resume from the last completed section

**Satisfied when:** The user loses no progress from earlier interview sessions, and the resume experience feels intentional rather than like recovering from an error.


---

### Polish

#### Scenario: Answering Interview Questions by Number

> **Given** A user is in an interview session (init or evolve) and the Interviewer presents multiple-choice options
> **When** The Interviewer asks "Which part of your spec does this relate to? (1) The main navigation (section 2.2), (2) The settings panel (section 2.5), (3) Something not yet in the spec"
> **Then** The user can respond with just "1" or "2" or "3" and the system understands their choice without requiring them to type the full option text

**Satisfied when:** The user can quickly answer multiple-choice questions by typing single digits, the system correctly interprets their numeric response, and the conversation flow feels natural and efficient.


---

## Feature: Spec Evolution
> I refine my spec by describing what I want to change

Category: Core | Depends on: Project Initialization

### Critical

#### Scenario: Evolving a Specific Spec Section by Alias

> **Given** A user has an existing spec with section aliases like `#core-flow` and `#error-handling`
> **When** They realize the core flow needs refinement and run `/fctry:evolve core-flow`, answering targeted questions about what should change
> **Then** Only the relevant section updates to reflect the new direction, while unrelated sections remain unchanged, and the spec's change history shows what evolved and why

**Satisfied when:** The user can point to a single concept in their spec, request changes to just that concept, and see only that part of the spec evolve while everything else stays stable. A reviewer reading the changelog can understand what changed and the reasoning behind it.


---

#### Scenario: Evolving a Specific Spec Section by Number

> **Given** A user has an existing spec where section 2.2 covers the primary user flow
> **When** They want to refine just that flow and run `/fctry:evolve 2.2`, describing how the flow should work differently
> **Then** Section 2.2 updates to match their new description, its alias remains stable, and other numbered sections stay untouched

**Satisfied when:** The user can reference any section by its number, make changes to just that section, and the rest of the spec remains intact. The section's alias continues to work for future reference.


---

#### Scenario: Resolving Spec-Code Conflict After Manual Changes

> **Given** A user has a spec and working code, then manually edits code files and commits changes that diverge from the spec
> **When** They run `/fctry:init` or `/fctry:review` to check alignment
> **Then** The system identifies specific conflicts between what the spec describes and what the code now does, shows both versions side-by-side, and asks the user which direction is correct for each conflict instead of assuming

**Satisfied when:** The user sees a clear list of discrepancies with enough context to decide whether the spec should change to match the code or the code should change to match the spec, and they can resolve each conflict individually rather than choosing a blanket "spec wins" or "code wins" mode.


---

#### Scenario: Spec Version Auto-Increments on Evolve via Registry

> **Given** A user has a version registry with a spec version at 1.7 and runs `/fctry:evolve core-flow`
> **When** The Spec Writer updates the spec
> **Then** The spec version in the registry auto-increments to 1.8, all propagation targets for the spec version (e.g., spec frontmatter) are updated, and the changelog shows the version transition

**Satisfied when:** The user sees the spec version transition in the changelog ("Spec version: 1.7 → 1.8") and the spec frontmatter reflects the new version. The user never manually bumps the spec version. If the evolve didn't change the spec (e.g., the user cancelled), the spec version doesn't increment.

Validates: `#evolve-flow` (2.4), `#rules` (3.3)


---

#### Scenario: Project Synopsis Regenerated on Every Evolve

> **Given** A user has a spec with a synopsis block in frontmatter and runs `/fctry:evolve` to add a new feature (e.g., adding real-time collaboration to a task manager)
> **When** The Spec Writer completes the evolve
> **Then** The synopsis block in the spec frontmatter is regenerated to reflect the spec's current content — the short, medium, and readme descriptions incorporate the new feature, tech-stack may gain new entries (e.g., WebSocket if not already present), patterns may update, and goals may expand. The updated synopsis is displayed in the evolve output alongside the diff summary.

**Satisfied when:** The synopsis reflects the post-evolve state of the spec (not just the pre-evolve state), descriptions mention the newly added feature where relevant, tech-stack and patterns are updated if the change introduced new technologies or architectural approaches, and the evolve output shows the updated synopsis so the user can see how the project's identity evolved.


---

### Edge Cases

#### Scenario: Empty or Vague Evolve Request

> **Given** A user has a complete spec but runs `/fctry:evolve core-flow` and then gives very vague or contradictory answers during the interview
> **When** The Interviewer tries to synthesize changes
> **Then** The system acknowledges the ambiguity, asks clarifying questions, and refuses to make changes until it has clear direction rather than guessing or making minimal changes

**Satisfied when:** The user is guided to provide clear intent, and the system never produces a weakened or confused spec because the input was unclear.


---

#### Scenario: Evolve Creates Version Registry When Config Missing

> **Given** A user has a project with `.fctry/spec.md` but no `.fctry/config.json`, and they run `/fctry:evolve` to update a section of their spec
> **When** The Spec Writer finishes updating the spec and needs to auto-increment the spec version in the version registry
> **Then** The Spec Writer creates `.fctry/config.json` with a fresh version registry (same defaults as the migration: spec version from frontmatter, external version from git tags or `0.1.0`), then increments the spec version as part of the evolve. The user sees the version transition in the changelog just as they would if the config had always existed

**Satisfied when:** The user's evolve flow works identically whether or not `config.json` existed before the command. The version registry is created transparently — the user does not see an error, a prompt, or a separate migration step. The spec version increment that would normally happen during evolve still happens. If `config.json` already existed with a version registry, the normal increment path runs. If `config.json` existed with execution priorities but no version registry, the version registry is added alongside existing content without overwriting.

Validates: `#evolve-flow` (2.4), `#rules` (3.3)


---

#### Scenario: Evolve Reactivates a Stable Spec

> **Given** A user has a project with `status: stable` — all scenarios were satisfied and no drift existed — and they have a new idea for the product
> **When** They run `/fctry:evolve` and the Spec Writer updates any section of the spec
> **Then** The Spec Writer automatically transitions the status from `stable` back to `active` as part of writing the spec changes — the user sees this noted in the evolve summary: "Spec status: stable -> active (spec evolved)." The project is now back in active development

**Satisfied when:** The user understands that evolving a stable spec naturally returns it to active status — stability is a state that is earned through satisfaction, not locked in permanently. The transition is automatic and requires no confirmation. If the user starts an evolve but cancels before any spec changes are written, the status remains `stable`. The changelog records the transition alongside the content changes.

Validates: `#evolve-flow` (2.4), `#rules` (3.3)


---

#### Scenario: Evolving a Section That No Longer Exists

> **Given** A user has an old reference to section alias `#beta-feature` that was removed in a previous spec update
> **When** They try to run `/fctry:evolve beta-feature`
> **Then** The system explains that section no longer exists, shows when it was removed and why (from changelog), and suggests related sections that might be what they meant

**Satisfied when:** The user understands why their reference failed and can quickly find the correct section to evolve without guessing or reading the entire spec.


---

### Polish

#### Scenario: Fast Iteration on Small Changes

> **Given** A user wants to tweak a single interaction detail in section 2.1.3
> **When** They run `/fctry:evolve 2.1.3`, answer one or two questions, and receive the updated spec
> **Then** The entire flow from command to updated spec takes under 60 seconds for a minor change, and the changelog clearly shows the small delta

**Satisfied when:** Small evolutions feel lightweight and fast, not like re-running a full spec generation process. The user feels encouraged to iterate frequently rather than batching changes.


---

## Feature: Reference Integration
> I bring in outside inspiration from URLs and designs

Category: Core | Depends on: Project Initialization

### Critical

#### Scenario: Targeted Reference Integration

> **Given** A user has a spec with section 2.1.3 describing a search interaction, and they find an article with a better pattern
> **When** They run `/fctry:ref 2.1.3 https://article-url`
> **Then** The system reads the article, asks clarifying questions about how it applies to the search interaction specifically, and updates section 2.1.3 to incorporate the pattern while leaving other sections unchanged

**Satisfied when:** The user can attach a reference directly to any section, and the system integrates insights from that reference only where relevant. The updated section clearly reflects the new pattern without disrupting unrelated content.


---

#### Scenario: Open-Ended Reference Discovery

> **Given** A user finds an interesting design pattern or tool but isn't sure where it fits in their spec
> **When** They run `/fctry:ref https://resource-url` without specifying a section
> **Then** The system reads the resource, identifies which parts of the spec could benefit, asks the user questions about intent and relevance, and proposes specific sections to update

**Satisfied when:** The user can share a reference without knowing exactly how to apply it, and the system helps them discover connections to their existing spec, then makes targeted updates only where the user confirms relevance.


---

#### Scenario: Bare /fctry:ref Picks Up Inbox References

> **Given** A user has submitted several reference URLs through the viewer's async inbox, and the system has processed them (titles extracted, excerpts cached, notes preserved)
> **When** They run `/fctry:ref` with no arguments
> **Then** The system presents all processed references as numbered options — each showing the page title and any note the user added when submitting — and lets the user pick one or more to incorporate, or enter a new URL instead

**Satisfied when:** The user never needs to re-type a URL that's already in the inbox. The list shows enough context (title + note) to jog their memory about why they queued each reference. Batch selection (comma-separated numbers) lets them incorporate related references together. Selecting an inbox item uses the pre-analyzed data without re-fetching. After incorporation, consumed items are marked as incorporated. If no processed references exist, the system falls back to prompting for a URL — it doesn't show an empty list.

Validates: `#ref-flow` (2.5), `#spec-viewer` (2.9)


---

### Edge Cases

#### Scenario: Reference URL That Fails to Load

> **Given** A user runs `/fctry:ref 2.3 https://broken-url` with a URL that returns 404 or times out
> **When** The system attempts to fetch the reference
> **Then** The system reports the fetch failure clearly, asks if the user has an alternate URL or can paste the content directly, and doesn't leave the spec in a half-updated state

**Satisfied when:** The user sees a helpful error, has a clear path forward, and the spec remains unchanged when a reference fails to load.


---

## Feature: Spec Review
> I understand where my spec and code stand

Category: Core | Depends on: Project Initialization

### Critical

#### Scenario: Review Surfaces Unbuilt Sections Separately from Drift

> **Given** A user has a spec with 10 experience sections, 6 of which have corresponding code (some drifted), and 4 of which are described in the spec but have no implementation yet (spec-ahead)
> **When** They run `/fctry:review` and the gap analysis runs
> **Then** The review output groups spec-ahead items under a distinct "Unbuilt" heading, separate from drift items. Each unbuilt item shows the section alias, number, and a brief description of what it describes. The recommendation for each is "Run /fctry:execute to build" rather than "Keep spec as-is (implementation pending)." Drift items appear under their own heading with the existing format and recommendations. At the bottom, an aggregate line reads: "N sections unbuilt. Run /fctry:execute to build."

**Satisfied when:** The user can immediately distinguish between sections that have drifted (spec and code disagree) and sections that are simply unbuilt (spec exists, code does not). Unbuilt sections feel like forward progress waiting to happen, not like problems to fix. The aggregate count at the end gives the user a quick summary of how much building remains. The recommendation for unbuilt sections always points toward execute, not evolve. Drift items retain their existing format and per-item recommendations (update spec, update code, etc.). No effort estimates appear in the review output -- that is the Executor's domain at plan time.

Validates: `#review-flow` (2.6)


---

#### Scenario: CLAUDE.md Audit During Review

> **Given** A user has a project with a CLAUDE.md at the root (created during init, possibly enriched during execute), and they have since evolved the spec several times — changing the convergence order, adding new sections, or restructuring code
> **When** They run `/fctry:review` and settle the spec-vs-code drift items
> **Then** The system audits both layers of CLAUDE.md: the evergreen layer (factory contract, command quick-reference, directory guide, workflow guidance, scenario explanation) for accuracy against the current `.fctry/` contents, and the build-specific layer (convergence order, architecture notes, build plan) for accuracy against the current spec and codebase — identifying stale paths, outdated convergence order, missing architecture notes, incorrect command references, and any other drift, presenting numbered recommendations for each item

**Satisfied when:** The user sees specific, actionable CLAUDE.md drift items (not vague "might be outdated" warnings), can approve or reject each one individually, and after approving, CLAUDE.md accurately reflects both the evergreen factory contract and the current build-specific state. The audit catches drift in both layers — an outdated command reference in the evergreen section is flagged just as readily as a stale convergence order in the build section. If CLAUDE.md is already current, the user sees "CLAUDE.md is current — no updates needed."


---

#### Scenario: Review Detects and Corrects a Stale Status

> **Given** A user has a project where the spec frontmatter says `status: stable`, but since the last status assessment, new scenarios were added that are unsatisfied or manual code changes introduced drift
> **When** They run `/fctry:review`
> **Then** The review detects the mismatch between the declared status and reality, and offers a correction: "Spec status is `stable` but 3 scenarios are unsatisfied and 1 section has drift. Recommend: (1) Correct to `active` (recommended), (2) Keep as `stable` (not recommended — status will be misleading)"

**Satisfied when:** The user understands why the current status is stale and can approve the correction with a single numbered choice. The correction updates the frontmatter and logs the change in the changelog with the rationale. If the user keeps the stale status, the system notes the override but does not block further work. The review catches all forms of staleness: a `stable` spec with unsatisfied scenarios, a `draft` spec that was actually completed, or an `active` spec that has achieved full satisfaction.

Validates: `#review-flow` (2.6), `#rules` (3.3)


---

### Polish

#### Scenario: Review Output Guides the User's Next Action

> **Given** A user runs `/fctry:review` on a project where 3 sections have drifted between spec and code, 4 sections are unbuilt (spec-ahead), and 2 untracked changes exist
> **When** They read the review output
> **Then** They see three distinct groups: drift items with per-item recommendations (update spec or update code), unbuilt items with a consistent recommendation to run `/fctry:execute`, and untracked changes with section mappings. At the bottom, an aggregate line summarizes the unbuilt count: "4 sections unbuilt. Run /fctry:execute to build." The grouping makes clear which items need spec work (drift), which need building (unbuilt), and which need reconciliation (untracked)

**Satisfied when:** The user finishes reading the review output and knows exactly what to do next without re-reading or mentally sorting the items. Drift, unbuilt, and untracked items each have a distinct heading and a distinct recommended action. The aggregate unbuilt count at the end provides a quick summary without effort estimates (those come from the Executor at plan time). A user who sees "4 sections unbuilt" feels oriented -- they know how much building remains and where to start.

Validates: `#review-flow` (2.6)

---


---

# Build

## Feature: Autonomous Build
> The machine builds my project from the spec

Category: Build | Depends on: Spec Evolution

### Critical

#### Scenario: Autonomous Build Execution

> **Given** A user has a complete spec and runs `/fctry:execute` to start building
> **When** The Executor presents a build plan showing the work chunks, their dependencies, and the execution order — and the user approves the plan
> **Then** The build runs autonomously without further approval gates between chunks, the agent handles code failures, retries, and rearchitecting on its own, and the build state is checkpointed after each chunk so the user can walk away and return later to find the build either complete, paused at an experience-level question, or resumable from where it was interrupted

**Satisfied when:** The user approves the plan exactly once and does not need to approve individual chunks or respond to code-level failures. The agent proceeds through the entire plan autonomously, checkpointing after each completed chunk. The only reason the build pauses for user input is when the spec is ambiguous or contradictory at the experience level — never for implementation decisions, code errors, or retry strategies. A user who approves the plan and returns 30 minutes later finds either a completed build with an experience report, a clear experience-level question waiting for them, or (if the session died) a resumable build that picks up where it left off.

Validates: `#execute-flow` (2.7), `#design-principles` (1.3), `#hard-constraints` (4.4)


---

#### Scenario: Build Plan Shows Execution Order and Dependencies

> **Given** A user has a spec with 8 sections ready to build and runs `/fctry:execute`
> **When** The Executor proposes the build plan
> **Then** The plan shows the work chunks with their dependencies and execution order — which chunks must complete before others can start, what each chunk targets, and how the priorities influenced the strategy

**Satisfied when:** The user understands the scope and shape of the build before approving: they can see that chunk A must finish before chunk D starts, which scenarios each chunk targets, and roughly how long the build will take. Once the build starts, the spec viewer's mission control renders this plan as an interactive dependency graph — nodes lighting up as chunks progress through their lifecycle. The plan gives enough information to set expectations about duration and approach. A user who approves has a clear mental model of what will happen while they're away.

Validates: `#execute-flow` (2.7), `#agent-decides` (6.4), `#spec-viewer` (2.9)


---

#### Scenario: CLAUDE.md Enrichment at Execute

> **Given** A user has run `/fctry:init`, which created a CLAUDE.md at the project root with evergreen content (factory contract, command quick-reference, directory guide, workflow guidance, scenario explanation), and they now have a complete spec ready to build
> **When** They run `/fctry:execute`, approve the build plan, and the Executor begins setting up the project for building
> **Then** The Executor enriches the existing CLAUDE.md with build-specific content — the approved build plan (chunks, dependencies, execution order), architecture notes derived from the spec, and the convergence order from section 6.2 — layered on top of the evergreen content so that both layers are clearly present and the evergreen content remains intact

**Satisfied when:** The user can open CLAUDE.md after execute begins and see both layers clearly: the evergreen instructions they got at init (factory contract, commands, directory guide) are still there and unchanged, and the new build-specific content (plan with execution order, architecture, convergence order) is added in a way that a coding agent can read the whole file and understand both the factory process and the specific build context. If CLAUDE.md already has build-specific content from a previous execute, the Executor updates that content to reflect the new plan without duplicating the evergreen layer.

Validates: `#execute-flow` (2.7), `#agent-decides` (6.4)


---

#### Scenario: Agent Resurfaces Only for Experience Questions

> **Given** A build is running autonomously and the agent encounters a situation that requires a decision
> **When** The decision is about implementation (a library doesn't work, a test fails, the architecture needs restructuring) versus when the decision is about the experience (the spec says two contradictory things about what the user sees, or a described interaction doesn't make sense)
> **Then** For implementation decisions, the agent resolves them autonomously without asking the user. For experience decisions, the agent pauses the build and presents the question in experience language, asking the user to clarify their intent

**Satisfied when:** During a full build, the user is never asked about code failures, dependency issues, performance tradeoffs, or architectural decisions. If the agent surfaces a question, it is always about what the user sees, does, or feels — never about how to build it. A user who is not a programmer can answer every question the agent asks, because the questions are in their language, about their vision.

Validates: `#execute-flow` (2.7), `#design-principles` (1.3)


---

#### Scenario: Post-Build Experience Report

> **Given** A user approved a build plan and the Executor has completed all chunks autonomously
> **When** The build finishes and the user returns to see the results
> **Then** The Executor presents an experience report that tells the user what they can now do — concrete, experience-mapped guidance like "You can now open the app and see your items sorted by urgency" and "Try adding a new item and watch it appear in the right position" — rather than a satisfaction score like "34/42 scenarios satisfied"

**Satisfied when:** The experience report reads like a guide to trying out the built system, not a test results dashboard. The user knows exactly what to go try, in what order, and what the expected experience should be. Scenario satisfaction data may be available somewhere, but the primary presentation is "here is what you can now do." A non-technical user reading the report feels oriented and excited to try the system, not confused by metrics.

Validates: `#execute-flow` (2.7), `#success-looks-like` (1.4)


---

#### Scenario: Clean Git History from Autonomous Build

> **Given** A user has a project in a git repository, approves a build plan, and the agent executes autonomously
> **When** The build completes and the user reviews the git log
> **Then** The history reads as a clean, linear narrative of feature development — each commit clearly describes what was built and which scenarios were satisfied, without broken intermediate states or implementation artifacts

**Satisfied when:** A developer (or the user themselves) can read the git history and understand the project's evolution as a coherent story. Each commit message provides enough context to understand what milestone was achieved. The user never has to "git rebase" or clean up after the agent.

Validates: `#execute-flow` (2.7), `#agent-decides` (6.4), `#details` (2.11)


---

### Edge Cases

#### Scenario: Autonomous Build Handles Code Failures Silently

> **Given** A user approved a build plan and the agent is executing autonomously, and a chunk fails — code does not compile, tests fail, or a dependency is missing
> **When** The agent encounters the failure
> **Then** The agent retries with an adjusted approach, rearchitects if needed, and continues the build without surfacing the failure to the user. The user never sees the error or is asked to make an implementation decision

**Satisfied when:** The build recovers from at least two different types of code-level failures (compilation errors, test failures, dependency issues) without interrupting the user. The post-build report mentions no implementation-level failures. If the agent truly cannot recover after exhausting its strategies, it presents the situation as an experience-level question: "I wasn't able to build [feature description]. The spec says [X] but I'm not sure if you meant [Y] or [Z]. Which is closer to your intent?"

Validates: `#execute-flow` (2.7), `#error-handling` (2.10), `#design-principles` (1.3)


---

#### Scenario: Build Resume After Session Death

> **Given** A user approved a build plan with 7 chunks and the build completed 3 chunks before the Claude Code session died (context exhaustion, crash, or user closed laptop)
> **When** They return and run `/fctry:execute` again
> **Then** The system detects the incomplete build, shows which chunks completed and which remain, and offers to resume from the next pending chunk — or start fresh with a new plan

**Satisfied when:** The user sees a clear summary of what was already built and what's left, can resume with a single numbered choice, and the resumed build skips completed chunks entirely (no re-execution, no re-evaluation). If the spec changed for a section covered by a completed chunk, the system flags the change and asks whether to rebuild that chunk or keep the old result. A user who closed their laptop at chunk 3 resumes at chunk 4 without repeating any work.

Validates: `#execute-flow` (2.7), `#rules` (3.3)


---

#### Scenario: Execute in Non-Git Project

> **Given** A user has a project directory with a spec but no git repository initialized
> **When** They run `/fctry:execute` and the Executor completes the autonomous build
> **Then** The build proceeds normally, scenarios are satisfied, and the post-build experience report shows what the user can now do without attempting any git commits or version tags

**Satisfied when:** The user can build from a spec in any directory structure, git integration is a helpful addition when available but never a requirement, and non-git projects receive the same quality of experience report without git-specific references.

Validates: `#execute-flow` (2.7), `#error-handling` (2.10)


---

#### Scenario: Convergence Milestones During Build

> **Given** A user approved a build plan that spans two convergence phases (e.g., core command loop in chunks 1-4, then viewer in chunks 5-7)
> **When** The Executor completes the last chunk of the first phase
> **Then** The Executor presents a non-blocking milestone report: "Core commands are working. You should now be able to run /fctry:init and complete an interview. The viewer is building next." The build continues automatically — the user can try the system at this point, or ignore the milestone and let the build proceed

**Satisfied when:** The milestone report is in experience language (what the user can now try), not technical language (which files were created). The build does not pause or wait for approval — the milestone is informational, not a gate. If the user tries the system at the milestone and finds a problem, they can stop the build and evolve the spec before the next phase builds on a flawed foundation. If they ignore the milestone, the build completes as normal.

Validates: `#execute-flow` (2.7), `#convergence-strategy` (6.2)


---

### Polish

#### Scenario: Post-Build Experience Report Feels Like a Guide

> **Given** A user completes a full `/fctry:execute` autonomous build
> **When** The build finishes
> **Then** The Executor provides an experience report that tells the user what they can now do — starting with the most impactful new capabilities, walking through how to try each one, noting the starting and final versions, and suggesting what to explore first. It includes git commit references when available but leads with the experience, not the implementation details

**Satisfied when:** The user reads the report and feels oriented and excited to try the built system. The report is a guide, not a data dump. It answers "what can I do now?" before "what was built?" A non-technical user understands every sentence without needing to know git, commits, or version numbers.

Validates: `#execute-flow` (2.7), `#success-looks-like` (1.4)


---

#### Scenario: Git Commit Messages That Tell a Story

> **Given** A user completes a full autonomous execute cycle in a git repository
> **When** They review the git log after completion
> **Then** Each commit message clearly describes what was built and which scenarios were satisfied, creating a narrative of the build's progression that reads like a coherent story of feature development — regardless of whether the build ran chunks in parallel

**Satisfied when:** A developer (or the user themselves) can read the git history and understand the project's evolution without opening the spec, and each commit message provides enough context to understand what milestone was achieved. Parallel execution is invisible in the commit history.

Validates: `#execute-flow` (2.7), `#details` (2.11)


---

## Feature: Build Prioritization
> I control what gets built in what order

Category: Build | Depends on: Autonomous Build

### Critical

#### Scenario: First-Time Execution Priority Prompt

> **Given** A user runs `/fctry:execute` for the first time and no execution priorities have been set (neither globally in `~/.fctry/config.json` nor per-project in `.fctry/config.json`)
> **When** The Executor finishes the state assessment and is about to propose a build plan
> **Then** The Executor asks the user to rank three execution priorities — speed, token efficiency, and reliability (conflict avoidance) — explaining what each means in plain terms, and stores the ranking so future builds use it automatically

**Satisfied when:** The user understands the tradeoffs without needing technical knowledge: speed means aggressive retries and moving past stuck chunks (faster but uses more tokens), token efficiency means careful context management and conservative retries (slower but cheaper), reliability means thorough verification between steps and conservative chunking (safest but slowest). The user ranks them, the ranking is stored in `~/.fctry/config.json`, and subsequent `/fctry:execute` runs use it without re-asking. The user never feels forced to understand implementation mechanisms — they express *what they care about*, not *how to achieve it*.

Validates: `#execute-flow` (2.7), `#agent-decides` (6.4)


---

#### Scenario: Build Plan Shaped by Execution Priorities

> **Given** A user has set execution priorities (e.g., speed > reliability > token efficiency) and runs `/fctry:execute`
> **When** The Executor proposes a build plan
> **Then** The plan's execution strategy section explicitly references the user's priorities and explains how they shaped the approach — e.g., "Based on your priorities (speed first), this plan uses aggressive retries and moves past stuck chunks quickly" or "Based on your priorities (reliability first), this plan uses conservative chunking with thorough verification between steps"

**Satisfied when:** The user can see the direct connection between the priorities they set and the strategy the Executor chose. The explanation is in plain language — the user understands *why* the plan looks the way it does. If the user changes their priorities, the next build plan visibly changes its strategy to match. A user who prioritizes speed sees a more aggressive plan than one who prioritizes reliability.

Validates: `#execute-flow` (2.7), `#agent-decides` (6.4)


---

#### Scenario: Executor Filters Build Plan by Readiness

> **Given** A user has a spec with 8 sections, 5 of which are `ready-to-execute` and 3 of which are `needs-spec-update`
> **When** They run `/fctry:execute` and the Executor proposes a build plan
> **Then** The plan includes only the 5 ready sections and notes: "3 sections excluded (needs spec update): #multi-session (2.3), #ref-flow (2.5), #details (2.11). Run /fctry:evolve for these sections first."

**Satisfied when:** The user sees a focused build plan that won't waste time on sections that aren't ready, understands why some sections were excluded, and has a clear path to make them buildable.


---

#### Scenario: Drag-and-Drop Prioritization Drives Build Order

> **Given** A user has dragged three sections into the Now column in order: `#core-flow`, `#spec-viewer`, `#execute-flow`
> **When** They run `/fctry:execute` and the Executor proposes a build plan
> **Then** The Executor reads the kanban priority from `config.json` and orders chunks so that Now sections are built first, in the user's specified drag order, followed by Next sections, with Later sections excluded from the plan

**Satisfied when:** The build plan reflects the user's visual prioritization. The user sees their kanban ordering reflected in the chunk sequence. The Executor explains in the plan: "Ordered by your project priorities: Now (3 sections), Next (4 sections), Later (2 sections excluded)." Later sections are noted as excluded with a recommendation to promote them when ready.

Validates: `#spec-viewer` (2.9), `#execute-flow` (2.7), `#rules` (3.3)


---

### Edge Cases

#### Scenario: Per-Project Priority Override

> **Given** A user has global execution priorities set to speed > reliability > token efficiency, but has a small personal project where token cost matters more
> **When** They create a `.fctry/config.json` in that project with different priorities (token efficiency > reliability > speed) and run `/fctry:execute`
> **Then** The Executor uses the per-project priorities for that build, and the build plan shows "Project priorities: token efficiency > reliability > speed (overrides global)" so the user knows which priorities are active

**Satisfied when:** The user can set different priorities for different projects. Per-project priorities in `.fctry/config.json` override the global defaults in `~/.fctry/config.json`. The build plan clearly indicates which priority source is active. Other projects without a per-project config continue using the global priorities.


---

### Polish

#### Scenario: Priority-Driven Assessment Depth

> **Given** A user has prioritized sections into Now/Next/Later columns and runs `/fctry:review`
> **When** The State Owner assesses readiness for each section
> **Then** Now sections are assessed at claim-level depth — each specific behavior described in the spec is checked against the code. Next sections get standard assessment. Later sections get coarse assessment (category-level, "code exists for this area")

**Satisfied when:** The user gets precise, claim-level readiness information for the sections they care about most. A Now section that has 30 of 40 behaviors implemented shows as `partial` with a specific count, not falsely as `aligned`. The assessment depth is proportional to priority without the user configuring anything — the kanban position is the only input.

Validates: `#spec-viewer` (2.9), `#review-flow` (2.6), `#rules` (3.3)


---

## Feature: Version Management
> Version numbers manage themselves

Category: Build | Depends on: Project Initialization

### Critical

#### Scenario: Version Target Auto-Discovery at First Execute

> **Given** A user has a project with a version registry (seeded at init) and runs `/fctry:execute` for the first time in a project that has version-bearing files (e.g., `package.json`, `Cargo.toml`, README badges)
> **When** The Executor starts the build planning process
> **Then** The Executor scans for files containing the current version string, proposes them as propagation targets, and asks the user to approve: "(1) Add all (recommended), (2) Select which to add, (3) Skip"

**Satisfied when:** The user sees which files contain their project version and can approve adding them to the registry with a single numbered choice. After approval, every future version change automatically updates those files. If no version-bearing files are found, the step is silently skipped. On subsequent execute runs, the Executor checks for newly created files containing the version string and suggests additions if found.

Validates: `#execute-flow` (2.7), `#rules` (3.3)


---

#### Scenario: Semantic Versioning with Patch Auto-Tags via Registry

> **Given** A user's project has a version registry with an external version at 0.1.0 and declared propagation targets (e.g., `package.json`, spec frontmatter)
> **When** The Executor completes build chunks during autonomous execution in a git repository
> **Then** Each successful chunk commit is automatically tagged with an incremented patch version (0.1.1, 0.1.2, etc.) from the registry, and every propagation target is updated atomically with the new version — the user sees consistent version numbers everywhere

**Satisfied when:** The user can see the project version history after a build completes, the version number is identical in every declared propagation target, and no file contains a stale version. The versioning happens automatically during the autonomous build without user intervention. Projects without git continue building without version tags but still update propagation targets.

Validates: `#details` (2.11), `#rules` (3.3)


---

#### Scenario: Version Propagation Updates All Declared Targets Atomically

> **Given** A user's version registry declares the external version appears in three files: `package.json` (version field), `.claude-plugin/plugin.json` (version field), and `README.md` (badge URL)
> **When** The Executor increments the external version from 0.2.0 to 0.2.1 after a successful chunk
> **Then** All three files are updated to reflect 0.2.1, and the user can verify that the version is consistent everywhere without manually checking individual files

**Satisfied when:** Every declared propagation target shows the same version after any version change — patch, minor, or major. If any target fails to update (e.g., file was deleted), the system reports which targets failed and which succeeded, rather than silently leaving some stale. The user never needs to know which files contain the version or manually update any of them.

Validates: `#rules` (3.3), `#details` (2.11)


---

### Edge Cases

#### Scenario: Version Registry Auto-Seeded for Pre-Existing Projects

> **Given** A user has a pre-existing fctry project with `.fctry/spec.md` but no `.fctry/config.json` — they started the project before the version registry was introduced, or they never ran a fresh `/fctry:init`
> **When** They run any `/fctry` command and the migration hook fires
> **Then** The system silently creates `.fctry/config.json` with a version registry seeded from available context: the spec version is read from the spec frontmatter (handling both `version:` and `spec-version:` field names), and the external version defaults to `0.1.0` or is read from git tags if available. The command they originally ran continues normally after the migration

**Satisfied when:** The user of a pre-existing project gets a version registry without running `/fctry:init` again. The seeded versions are reasonable — spec version matches what the frontmatter already says, external version picks up from git tags when they exist. The migration is silent (no summary, no user action required) and consistent with the other silent migrations in the system. If `config.json` already exists (with or without a version registry), the migration is a no-op. If the spec has no version in its frontmatter, sensible defaults are used.

Validates: `#directory-structure` (4.3), `#rules` (3.3)


---

#### Scenario: Internal Version Change Triggers External Version Suggestion via Relationship Rules

> **Given** A user has a version registry with relationship rules (default: major spec change → suggest external minor bump), and the spec version has had a major increment (e.g., from 1.9 to 2.0 after a significant restructure via evolve)
> **When** The user next runs `/fctry:execute`
> **Then** The Executor notes the spec version jump, references the relationship rule, and suggests an external minor version bump in the build plan: "Spec version jumped from 1.9 to 2.0 — per version relationship rules, recommending external version bump from 0.3.2 to 0.4.0"

**Satisfied when:** The user understands why an external version bump is being suggested (because of the internal spec change), can approve or decline, and the relationship between internal and external versions is transparent. The system doesn't force the bump — it suggests based on the declared relationship rule. If no relationship rules match, no suggestion is made.

Validates: `#rules` (3.3), `#execute-flow` (2.7)


---

### Polish

#### Scenario: Minor Version Suggestion at Plan Completion

> **Given** A user has completed a full autonomous build, all planned chunks finished successfully, and the version registry shows the current external version
> **When** The Executor presents the post-build experience report
> **Then** The system suggests incrementing the minor version (e.g., from 0.1.8 to 0.2.0) per the registry's rules, shows how many propagation targets will be updated, and asks the user to approve with a numbered choice: "(1) Tag as 0.2.0 now (updates all 3 propagation targets), (2) Skip tagging, (3) Suggest different version"

**Satisfied when:** The user understands that the full plan completion is a natural milestone for a minor version bump, can approve or decline by number, and when approved, the tag is created AND every propagation target is updated atomically. Non-git projects update propagation targets without creating tags.

Validates: `#details` (2.11), `#rules` (3.3)


---

#### Scenario: Major Version Suggestion at Experience Milestone

> **Given** A user has completed multiple execute cycles, the version registry tracks the external version, and the system detects a significant experience milestone (e.g., all critical scenarios satisfied, or a major section fully implemented)
> **When** The Executor presents the post-build experience report for that cycle
> **Then** The system suggests incrementing the major version (e.g., from 0.9.3 to 1.0.0) with a rationale, shows propagation targets that will be updated, and asks the user to approve with numbered options: "(1) Tag as 1.0.0 with rationale: <reason> (updates all propagation targets), (2) Skip tagging, (3) Suggest different version"

**Satisfied when:** The user sees a clear explanation of why this is a major milestone, can approve or decline by number, and when approved, the tag and every propagation target are updated atomically. The rationale is included in the tag message.

Validates: `#details` (2.11), `#rules` (3.3)


---

## Feature: Build Verification
> The build verifies its own work automatically

Category: Build | Depends on: Autonomous Build

### Critical

#### Scenario: Post-Chunk Visual Verification During a Build

> **Given** A user approved a build plan with 5 chunks and the Executor is running autonomously, with a spec viewer and browser-accessible application being built
> **When** The Executor completes chunk 3 (which builds a visible UI component described in the spec)
> **Then** The Observer automatically launches after the chunk completes, opens the built application in a headless browser, takes screenshots, checks that expected elements exist and are visible, and produces a verification verdict — "chunk 3 verified: urgency list renders correctly, 4 of 4 checks passed" — that feeds into the activity feed as a verification event the user can see in mission control

**Satisfied when:** Every completed chunk that produces visible output is automatically verified by the Observer without the Executor or user requesting it. The verification verdict is tight and evidence-based — screenshots and element checks, not vague assertions. The user watching mission control sees verification events appear shortly after chunk completion events, creating a natural "built, then verified" rhythm. If the Observer finds a problem (element missing, layout broken), the verdict says what failed and the Executor can decide whether to retry the chunk or continue.

Validates: `#execute-flow` (2.7), `#spec-viewer` (2.9)


---

#### Scenario: Observer Called by State Owner to Check Viewer Health

> **Given** A user runs any `/fctry` command and the State Owner begins its scan, and the spec viewer is supposed to be running in the background
> **When** The State Owner needs to confirm the viewer is healthy before including viewer status in its briefing
> **Then** The State Owner calls the Observer to check the viewer — the Observer hits the viewer's health endpoint, confirms the WebSocket connection is accepting clients, and optionally loads the viewer in a headless browser to confirm it renders the spec. The State Owner includes the result in its briefing: "Viewer running on port 3850, rendering current spec, WebSocket healthy" or "Viewer unhealthy: health endpoint returned 503, recommend restarting with /fctry:view"

**Satisfied when:** The State Owner's briefing includes concrete viewer health information gathered by the Observer, not just "viewer process exists." The Observer checks actual functionality (can the viewer serve content and accept WebSocket connections), not just whether a process ID file exists. If the viewer is unhealthy, the briefing includes actionable guidance.

Validates: `#spec-viewer` (2.9), `#review-flow` (2.6)


---

#### Scenario: Observer Called by Spec Writer to Verify Live Update Rendered

> **Given** A user is running `/fctry:evolve core-flow` with the spec viewer open, and the Spec Writer has just written an update to section 2.2
> **When** The Spec Writer wants to confirm the live update actually rendered in the viewer
> **Then** The Spec Writer calls the Observer, which opens the viewer in a headless browser, navigates to section 2.2, takes a screenshot, and confirms the updated content is visible — producing an observation report: "Section 2.2 updated in viewer, new content visible, change annotation present." The Spec Writer proceeds with confidence that the user is seeing current content

**Satisfied when:** The Spec Writer can verify that its file write actually propagated through the WebSocket to the browser rendering, catching cases where the file watcher missed the change, the WebSocket disconnected, or the browser rendering failed. The verification is fast enough (under 5 seconds) that it does not noticeably delay the evolve flow. If the update did not render, the Observer report says what it expected to see and what it actually saw.

Validates: `#spec-viewer` (2.9), `#evolve-flow` (2.4)


---

#### Scenario: Observer Verifying the DAG Renders Correctly

> **Given** A user approved a build plan with 6 chunks that have dependency relationships, and the spec viewer is showing mission control with the visual dependency graph
> **When** The Executor calls the Observer after the first chunk completes and the DAG should show one node in completed state
> **Then** The Observer opens the viewer, captures a screenshot of the dependency graph, uses Claude vision to interpret what it sees, and produces a verification verdict: "DAG renders correctly — 6 nodes visible, chunk 1 shows completed state, chunks 2 and 3 show active state, dependency edges visible between chunk 1 and chunk 4." The verdict includes the screenshot as evidence

**Satisfied when:** The Observer can verify that the visual dependency graph — which is a rendered interactive visualization, not just text — actually displays the correct topology and state. The screenshot serves as evidence that a human reviewer (or the user glancing at mission control) would see what the Observer claims. The Observer catches real visual problems: nodes overlapping, edges missing, states not updating, or the graph failing to render entirely. This is fctry eating its own dogfood — the Observer verifying fctry's own viewer output.

Validates: `#spec-viewer` (2.9), `#execute-flow` (2.7)


---

#### Scenario: Observer Checking API Responses Against Expected State

> **Given** A build is running and the Executor has completed chunk 2, which should have updated the build status tracked by the viewer's API
> **When** The Observer runs its post-chunk verification
> **Then** The Observer queries the viewer's API endpoints (health, build status, build log) using direct HTTP requests, compares the responses against the expected state (chunk 2 completed, chunks 3 and 4 active), and includes the API check results in its verification verdict alongside any browser-based checks

**Satisfied when:** The Observer does not rely solely on visual checks — it also verifies the data layer by querying API endpoints directly. The API responses are compared against expected state derived from the build plan and chunk lifecycle. Mismatches between what the API reports and what the browser renders are flagged as separate findings. The user sees a verification that covers both "does it look right" and "does the data say it's right."

Validates: `#execute-flow` (2.7), `#capabilities` (3.1)


---

#### Scenario: Observer Emitting Verification Events to the Activity Feed

> **Given** A build is running and the user has the spec viewer's mission control open, watching the activity feed
> **When** The Observer completes a post-chunk verification for chunk 3
> **Then** The Observer emits a typed verification event — "chunk 3 verified: DAG renders correctly, 4/4 checks passed" — that appears in the activity feed alongside the Executor's lifecycle events. The user can filter the activity feed to show only verification events, only lifecycle events, or both

**Satisfied when:** Verification events are first-class citizens in the activity feed, with their own event type that the user can filter on. The events carry enough detail to be useful at a glance ("4/4 checks passed") without overwhelming the feed with individual check results. The user watching mission control sees a clear interleaving of "chunk started," "chunk completed," "chunk verified" events that tells the story of the build's progress and quality. Verification events that include findings (failures or warnings) are visually distinct from clean passes.

Validates: `#spec-viewer` (2.9), `#execute-flow` (2.7)


---

#### Scenario: Executor Emitting Lifecycle Events to the Activity Feed

> **Given** A build is running with 4 chunks and the user has the spec viewer's mission control open
> **When** Chunks progress through their lifecycle — planned to active, active to retrying, retrying to active, active to completed
> **Then** The Executor emits typed lifecycle events for each transition: "chunk 1 started," "chunk 2 started," "chunk 1 completed," "chunk 3 started (depends on chunk 1)," "chunk 2 retrying (attempt 2 of 3)." These events appear in the activity feed with semantic meaning and are the primary way the user tracks build progress in real-time

**Satisfied when:** Every chunk lifecycle transition produces a typed event that appears in the activity feed. The events have enough context to be useful standalone — "chunk 3 started" includes which sections it affects, "chunk 2 retrying" includes which attempt number and a brief reason. The activity feed becomes the authoritative narrative of the build: a user who reads the feed from top to bottom understands exactly what happened, in what order, and why. These lifecycle events are distinct from the Observer's verification events — the Executor owns "what happened" and the Observer owns "what we confirmed."

Validates: `#execute-flow` (2.7), `#spec-viewer` (2.9)


---

#### Scenario: Verification Audit Trail Generation

> **Given** A build has completed with 6 chunks, each verified by the Observer after completion
> **When** The user wants to review what was verified and how
> **Then** The Observer has produced a structured audit trail document — an executable verification report that lists every check performed, the command or query used, the result, and any screenshots captured. The report can be re-run to repeat the verification checks against the current state of the application

**Satisfied when:** The audit trail is a concrete artifact, not just ephemeral log entries. Each verification is traceable: the user can see that "chunk 3 verification checked for .urgency-list selector, found it, took screenshot at 14:32:05." The report is re-executable — running it again repeats the same checks and shows whether the results still hold. The user or a future agent can use the audit trail to understand exactly what the Observer verified and reproduce those checks. Screenshots are embedded or referenced in the report as visual evidence.

Validates: `#execute-flow` (2.7), `#observability` (6.3)


---

### Edge Cases

#### Scenario: Graceful Degradation When Browser Tools Unavailable

> **Given** A user is running `/fctry:execute` on a machine where the headless browser tools (Rodney, Surf) are not installed or not responding
> **When** The Executor calls the Observer for post-chunk verification
> **Then** The Observer detects that browser tools are unavailable, falls back to API queries (hitting the viewer's health and status endpoints with direct HTTP requests) and file reads (checking state files, build artifacts, and generated output), and produces a reduced-fidelity observation report: "Browser tools unavailable — verification limited to API and file checks. Viewer API reports chunk 3 completed. Build state file confirms expected sections. Visual verification skipped."

**Satisfied when:** The Observer never fails entirely just because browser tools are missing. The reduced-fidelity report is honest about what it could and could not verify — the user knows that visual checks were skipped, not that everything was verified. If only file reads are available (no browser tools, no API because the viewer is not running), the Observer falls back further to file-only checks and says so. The three degradation levels (full, reduced, minimal) are transparent to the user. The experience report at the end of the build notes which verification level was used.

Validates: `#error-handling` (2.10), `#execute-flow` (2.7)


---

#### Scenario: Observer Detects Visual Regression via Screenshot Comparison

> **Given** A build is running and chunk 4 modifies a UI component that was already working after chunk 2 — the dependency graph renders in the viewer and chunk 4 changes how nodes display their state
> **When** The Observer runs post-chunk verification for chunk 4 and takes a screenshot of the dependency graph
> **Then** The Observer uses Claude vision to interpret the screenshot and compare it against its understanding of the expected state, detecting if the change introduced a visual regression — nodes no longer showing state colors, edges disappearing, layout breaking. The verdict notes: "Visual regression detected: dependency graph nodes no longer show lifecycle state colors after chunk 4 changes. Screenshot evidence attached."

**Satisfied when:** The Observer catches visual regressions that would be invisible to API-only checks — the data might be correct but the rendering is broken. The Observer does not require a pixel-perfect baseline image; it uses Claude vision to interpret screenshots semantically ("I expected to see colored nodes showing lifecycle states, but the nodes appear unstyled"). The finding is specific enough for the Executor to understand what regressed and decide whether to fix it in the current chunk or flag it for later. The screenshot is attached as evidence.

Validates: `#execute-flow` (2.7), `#spec-viewer` (2.9)


---

#### Scenario: Observer Verification When Application Is Not Yet Running

> **Given** A build is in its early chunks — chunk 1 sets up project scaffolding and chunk 2 creates initial data models — and there is no running application to observe yet
> **When** The Executor calls the Observer for post-chunk verification after chunk 1
> **Then** The Observer recognizes that there is no observable application surface yet, falls back to file-system checks (verifying expected files were created, configuration is valid, directory structure matches the plan), and produces an appropriate verdict: "No running application to observe. File checks: project scaffolding created, 12 files in expected locations. Visual verification will begin when the application is runnable."

**Satisfied when:** The Observer does not fail or produce misleading results when there is nothing visual to observe. It adapts its verification strategy to what is actually available at that point in the build. The verdict is honest about the limitation and sets expectations for when richer verification will begin. The user watching the activity feed understands that early chunks get lighter verification — this is expected, not a problem.

Validates: `#execute-flow` (2.7), `#error-handling` (2.10)


---

#### Scenario: Observer Called by Non-Executor Agent During Normal Workflow

> **Given** A user is running `/fctry:review` and the State Owner has completed its scan, identifying that the viewer's section highlighting feature may not be working correctly based on code drift
> **When** The State Owner asks the Observer to check whether section highlighting actually works in the live viewer
> **Then** The Observer opens the viewer, triggers a section highlight (by simulating the WebSocket event that agents send when focusing on a section), takes a screenshot, and confirms whether the highlight appeared. The finding is included in the State Owner's briefing: "Section highlighting verified working" or "Section highlighting appears broken — no visual change when highlight event sent"

**Satisfied when:** The Observer is usable by any agent, not just the Executor during builds. The State Owner, Spec Writer, or any other agent can call the Observer when they need to verify something observable. The invocation is natural — the calling agent describes what it wants verified, and the Observer figures out how to check it. The Observer's report is consumed by the calling agent, not presented directly to the user (unless the calling agent decides to include it in their output).

Validates: `#review-flow` (2.6), `#spec-viewer` (2.9)


---

#### Scenario: Observer Handles Flaky Checks Without False Alarms

> **Given** A build is running and the Observer performs post-chunk verification, but one check intermittently fails — a WebSocket connection that takes a moment to establish, or a UI element that renders after a brief animation delay
> **When** The Observer runs its checks and encounters a transient failure
> **Then** The Observer retries the failing check after a brief pause (not the entire verification, just the specific check), and only reports a failure if the check fails consistently. The verdict distinguishes between "failed after retry" (likely a real problem) and "passed on retry" (transient, noted but not alarming)

**Satisfied when:** The Observer does not produce false alarms for timing-sensitive checks. A single check failure triggers a retry before being reported as a finding. The activity feed does not fill up with noise from transient failures that resolved on retry. If a check passes on retry, the verdict notes it as "passed on retry" so the user knows there was initial instability, but the overall verdict is still positive. Persistent failures after retry are reported with confidence.

Validates: `#execute-flow` (2.7), `#error-handling` (2.10)


---

### Polish

#### Scenario: Verification Events Create a Build Confidence Narrative

> **Given** A user is watching mission control during a 7-chunk build and both lifecycle events (from the Executor) and verification events (from the Observer) are flowing into the activity feed
> **When** They scan the feed over the course of the build
> **Then** The interleaving of "started," "completed," and "verified" events tells a confidence-building story — not just "things are happening" but "things are happening and we're confirming they work." The rhythm of build-then-verify creates a sense that the system is thorough, not just fast

**Satisfied when:** A user watching the activity feed feels increasing confidence as the build progresses. Each verification event after a completion event reinforces that the build is producing real, working output — not just generating code into the void. The feed reads as a narrative of progress and quality, not as a noisy log. If the user steps away and reads the feed on return, they can quickly assess both what was built and what was confirmed.

Validates: `#spec-viewer` (2.9), `#execute-flow` (2.7), `#success-looks-like` (1.4)


---

#### Scenario: Observer Reports Are Concise in the Feed, Detailed on Demand

> **Given** A user is watching the activity feed during a build and the Observer emits verification events
> **When** They see a verification event in the feed
> **Then** The event shows a concise summary — "chunk 3 verified: 4/4 checks passed" — and the user can expand or click through to see the full verification details: which checks were run, what was found, and any screenshots captured. The feed stays scannable; the detail is available when they want it

**Satisfied when:** The activity feed does not become cluttered with verbose verification details. The one-line summary is enough for a user who is monitoring casually. A user who wants to see the screenshot evidence or individual check results can drill into the detail without leaving mission control. The balance between summary and detail respects the user's attention.

Validates: `#spec-viewer` (2.9), `#details` (2.11)


---

#### Scenario: Audit Trail Feels Like a Build Receipt

> **Given** A build has completed and the user opens the verification audit trail
> **When** They read through the document
> **Then** It reads like a receipt of what was built and verified — organized by chunk, showing what was checked, what passed, and what evidence was collected. Screenshots are embedded inline next to the checks they support. The document tells the story: "We built this, and here's how we know it works"

**Satisfied when:** The audit trail is something the user would actually want to read, not a raw dump of check results. It is organized by the build narrative (chunk by chunk), includes visual evidence (screenshots), and is clear enough that someone who was not present during the build can understand what was verified and how. The user feels that the build was accountable — there is a record of what the system checked, not just what it claimed.

Validates: `#observability` (6.3), `#success-looks-like` (1.4)


---

#### Scenario: Degraded Verification Is Transparent, Not Hidden

> **Given** A build ran with browser tools unavailable, so the Observer produced reduced-fidelity observations for all chunks
> **When** The user reads the post-build experience report
> **Then** The report includes a clear note: "Build verification ran at reduced fidelity — browser tools were unavailable, so visual checks were skipped. API and file checks were performed. For full verification including visual checks, ensure [browser tool] is available and re-run verification." The user understands exactly what was and was not verified

**Satisfied when:** The user is never given false confidence. If verification was limited, they know about it in plain terms — not buried in a footnote, but stated clearly in the experience report. The note includes what to do if they want full verification. The system treats reduced-fidelity verification as a valid mode (the build still completes) but an informed one (the user knows the coverage was narrower).

Validates: `#error-handling` (2.10), `#details` (2.11)


---

## Feature: Context Resilience
> Builds work correctly even when context compresses

Category: Build | Depends on: Autonomous Build

### Critical

#### Scenario: Context Never Degrades Build Quality Across Chunks

> **Given** A user approved a build plan with 7 chunks spanning multiple convergence phases, and the build is progressing through chunks sequentially and in parallel
> **When** The Executor reaches chunk 6 after completing chunks 1-5 over an extended session
> **Then** Chunk 6 executes with the same quality and comprehension as chunk 1 — the system has not accumulated stale context, lost track of the build plan, or degraded its understanding of the spec. The Executor's awareness of what was built, what remains, and what the spec requires is as sharp for the last chunk as the first

**Satisfied when:** A user who inspects the build output for later chunks finds no quality degradation compared to earlier chunks — no repeated work, no contradictions with earlier chunk output, no signs of confusion about the spec. The system's context management is invisible to the user; they simply observe that the build maintains consistent quality throughout. If the system needed to create context boundaries between chunks, no user intervention was required.

Validates: `#execute-flow` (2.7), `#rules` (3.3), `#agent-decides` (6.4)


---

#### Scenario: Compact Instructions Preserve Build State Through Compaction

> **Given** A user's project has a CLAUDE.md with a `# Compact Instructions` section (created during init) that tells Claude to preserve spec paths, build checkpoint state, scenario satisfaction, and active section context
> **When** Claude Code auto-compacts during a long evolve or execute session
> **Then** The critical factory state survives compaction — the system still knows which command is active, which workflow steps completed, where the spec and scenarios live, and what the current build state is. The compacted context retains enough information for the next agent to continue without re-scanning or re-reading files unnecessarily

**Satisfied when:** A user who triggers a long evolve session that causes auto-compaction sees no disruption — the Spec Writer still knows what the Interviewer discussed, the workflow state is intact, and the output is coherent. The compact instructions acted as a preservation guide during compaction. Combined with the state file (which provides ground truth on disk), the system recovers gracefully from compaction without the user noticing anything happened.

Validates: `#execute-flow` (2.7), `#core-flow` (2.2), `#rules` (3.3)


---

# Viewer

## Feature: Spec Viewer
> I read and navigate my spec in a beautiful browser view

Category: Viewer | Depends on: Project Initialization

### Critical

#### Scenario: Auto-Starting Spec Viewer

> **Given** A user is starting work on a project with an existing spec
> **When** They type any prompt in Claude Code
> **Then** The multi-project viewer server starts silently in the background (if not already running) and the current project is registered with it — no browser tab opens, no output interrupts the flow — and the viewer is ready at a local URL whenever the user wants to see their spec

**Satisfied when:** The viewer is always running when a spec exists, starts without the user noticing, and the user can open it anytime with `/fctry:view`. If no spec exists, nothing happens. If the viewer is already running, the hook registers the current project and exits. The server persists across sessions (it serves all projects) and self-heals if it crashes.


---

#### Scenario: Zero-Build Spec Rendering

> **Given** A user makes a manual edit to their `.fctry/spec.md` file (outside of fctry commands) to fix a typo
> **When** They save the file
> **Then** The viewer updates immediately without requiring any build step, bundler, or preprocessor to run

**Satisfied when:** The rendering feels instant and lightweight, like a live markdown preview, not like a compiled documentation site.


---

#### Scenario: Beautiful and Readable Rendering

> **Given** A user opens their spec in the viewer for the first time
> **When** They scroll through sections
> **Then** The typography is comfortable to read, the hierarchy is clear, code blocks show syntax highlighting (keywords, strings, comments in distinct colors), and the design feels polished — not like a default markdown renderer. If their system is in dark mode, the viewer renders in dark mode automatically with comfortable contrast and desaturated accents

**Satisfied when:** The user enjoys reading their spec in the viewer and prefers it to reading the raw markdown file. The design feels intentional and professional. Code blocks are syntax-highlighted (not plain monospace). Dark mode follows the system preference and can be toggled manually. Loading states show skeleton shimmer rather than "Loading..." text.


---

#### Scenario: Smooth Section Navigation

> **Given** A user has a spec with 30+ sections and wants to jump to section 4.3
> **When** They use the section navigation (sidebar or search)
> **Then** Jumping to 4.3 is instant, the viewport scrolls smoothly to the section, and the section briefly highlights so they know they arrived at the right place

**Satisfied when:** Navigation feels effortless and precise, and the user never loses their place or wonders if they jumped to the right section.


---

#### Scenario: Dark Mode Follows System Preference

> **Given** A user's operating system is set to dark mode
> **When** They open the spec viewer for the first time
> **Then** The viewer renders in dark mode automatically — near-black backgrounds, off-white text, desaturated accent colors, and comfortable contrast. Mermaid diagrams render with dark-appropriate colors. Code blocks use a dark syntax highlighting theme

**Satisfied when:** The viewer respects `prefers-color-scheme: dark` without any manual configuration. The dark mode is comprehensive — every surface (kanban cards, spec content, modals, toasts, inbox input, mission control DAG, activity feed) uses dark tokens. There is no flash of light theme on load. A manual toggle in the header allows overriding the system preference, and the choice persists in localStorage.

Validates: `#spec-viewer` (2.9)


---

#### Scenario: Fuzzy Search Across Spec Content

> **Given** A user has a large spec and presses Cmd+K to open the search modal
> **When** They type "priori" (partial, fuzzy match)
> **Then** The search results show matching sections ranked by relevance — "Priority-Driven Assessment" ranks higher than a section that merely mentions "priority" once. Results update as they type. Selecting a result navigates to that section

**Satisfied when:** The search is fuzzy — typos and partial matches work. Results are ranked by relevance, not just string matching. The modal has a dark-mode-appropriate design with backdrop blur. Keyboard navigation (arrow keys, Enter to select, Escape to dismiss) works. The search covers section headings, content, and aliases.

Validates: `#spec-viewer` (2.9), `#details` (2.11)


---

### Edge Cases

#### Scenario: Viewer Startup Failure

> **Given** A user runs `/fctry:init` but port 3000 (or whatever the viewer uses) is already occupied by another service
> **When** The system attempts to start the viewer
> **Then** The system detects the port conflict, tries the next available port, successfully starts the viewer there, and tells the user which port is being used

**Satisfied when:** The viewer starts reliably even in busy development environments, and the user is never blocked by port conflicts or forced to manually configure ports.


---

#### Scenario: Viewing Spec Without Active Command

> **Given** A user finished a `/fctry:evolve` session yesterday and closed the viewer
> **When** They want to read their spec today without running a new fctry command
> **Then** They can manually start the viewer (via a simple command like `/fctry:view`) and browse their spec with full change history

**Satisfied when:** The viewer is accessible on demand, not only when a command is running, and the user can treat it as a persistent spec reader.


---

#### Scenario: Very Large Spec Performance

> **Given** A user has a complex spec that grew to 50+ sections and 200+ pages
> **When** They open the viewer or navigate between sections
> **Then** Rendering and navigation remain fast, with no perceptible lag when scrolling or jumping to sections

**Satisfied when:** The viewer handles large specs gracefully, and the user never experiences slowdown or jank even as the spec grows.


---

#### Scenario: Concurrent Viewer Sessions

> **Given** A user has the spec viewer open in two browser windows (perhaps on different monitors)
> **When** The spec updates during a `/fctry:evolve` command
> **Then** Both browser windows receive the update and show the same content, maintaining sync without conflicts

**Satisfied when:** The user can view their spec in multiple places simultaneously and trust that all views show current content.


---

#### Scenario: Dark Mode Toggle Re-renders Diagrams

> **Given** A user has a section displayed as a Mermaid diagram in light mode
> **When** They toggle dark mode
> **Then** The diagram re-renders with dark-appropriate colors (dark node fills, light text, muted edges) without a jarring flash — a brief fade transition masks the re-render

**Satisfied when:** Diagrams look correct in both themes. The re-render is fast enough that the fade transition (not a loading state) is sufficient. Diagram source is preserved so re-rendering doesn't lose any content. All 5 diagram types render correctly in both modes.

Validates: `#spec-viewer` (2.9)


---

#### Scenario: Viewer Server Never Spawns Duplicate Processes

> **Given** The viewer server is already running on port 3850 serving three projects, and the user opens a new Claude Code session in a fourth project
> **When** The `UserPromptSubmit` hook fires `manage.sh ensure`
> **Then** The hook detects the existing server (by health-checking ports, not just the PID file), registers the fourth project with it via HTTP, and exits — no second server process is spawned, no existing PID/port files are disrupted, and the project registry is not clobbered

**Satisfied when:** There is never more than one viewer process running regardless of how many sessions start, how many times the hook fires, or whether PID files go stale. The user sees a single consistent dashboard with all their projects.

---


---

### Polish

#### Scenario: Mobile-Friendly Viewing

> **Given** A user wants to review their spec on a tablet or phone while away from their desk
> **When** They open the viewer on a mobile device (screen width under 768px)
> **Then** The layout collapses to content only, with a hamburger menu that slides in the left rail (ToC and History tabs) as an overlay, and the async inbox accessible as a separate slide-in overlay — both dismiss on tap-outside so the spec content remains the primary focus

**Satisfied when:** The user can navigate sections via the hamburger menu, submit inbox items via the inbox overlay, and read the spec comfortably on a phone-sized screen. The overlays feel native and responsive, not like a shrunken desktop layout.


---

#### Scenario: Viewer Layout Adapts to Screen Size

> **Given** A user opens the spec viewer on a desktop-width browser
> **When** The viewer renders
> **Then** They see a three-column layout: a left rail with tabbed navigation (ToC tab selected by default, History tab with a dot badge when unseen changes exist), the main spec content in the center, and the async inbox as a persistent right rail that is open by default but collapsible to a thin strip or icon so the user can reclaim horizontal space when they want a wider reading area

**Satisfied when:** The three-column layout feels natural on wide screens — the left rail provides quick navigation and history access via tabs, the center column is the primary reading surface, and the right rail keeps the inbox always one glance away without requiring a panel toggle. Collapsing the right rail is smooth and the collapsed state clearly indicates the inbox is still there. When the screen is under 768px, the layout degrades gracefully to the mobile pattern (content only, hamburger menu, slide-in overlays) rather than cramping three columns into a narrow viewport.

Validates: `#spec-viewer` (2.9)


---

## Feature: Live Spec Updates
> I see changes happen in real time as agents work

Category: Viewer | Depends on: Spec Viewer

### Critical

#### Scenario: Live Updates During Spec Evolution

> **Given** A user has the spec viewer open in their browser and runs `/fctry:evolve core-flow`
> **When** The Spec Writer updates the spec file
> **Then** The browser view updates within 2 seconds to show the new content without the user refreshing, and the changed section is visually distinct so they can see what evolved

**Satisfied when:** The user watches their spec change in real-time as the system works, and they can immediately see the impact of their evolution request without any manual refresh or file switching.


---

#### Scenario: Section Highlighting During Agent Work

> **Given** A user has the spec viewer open and the Spec Writer is analyzing section 2.3 for gaps
> **When** The agent focuses on that section
> **Then** Section 2.3 becomes highlighted in the viewer, giving the user a visual indication of what the agent is currently reviewing

**Satisfied when:** The user can glance at the viewer and immediately understand which part of the spec the agent is working on, creating a sense of transparency and collaboration.


---

#### Scenario: Viewing Change History Timeline

> **Given** A user has evolved their spec multiple times over several weeks
> **When** They open the spec viewer and switch to the History tab in the left rail
> **Then** They see a timeline of changes (Log4brains style) with clear dates, descriptions, and the ability to click any change to see what sections were affected — a dot badge on the History tab indicates when unseen changes have arrived since they last viewed it

**Satisfied when:** The user can explore the spec's evolution over time, understand the trajectory of decisions, and quickly jump to any historical change they want to review.


---

#### Scenario: Inline Change Annotations

> **Given** A user is viewing their spec after running `/fctry:evolve 2.2`
> **When** They look at section 2.2 in the viewer
> **Then** The section shows inline annotations (Spec Markdown style) indicating what was added, modified, or removed in the most recent change, with a subtle visual treatment that doesn't overwhelm the content

**Satisfied when:** The user can see what changed without opening a separate diff view, and the annotations enhance understanding rather than cluttering the reading experience.


---

### Edge Cases

#### Scenario: Change History for Rapid Iterations

> **Given** A user runs `/fctry:evolve` five times in 30 minutes, refining a single section iteratively
> **When** They view the change timeline
> **Then** All five changes appear as distinct entries, allowing them to trace the evolution step-by-step, even though the changes were rapid and overlapping

**Satisfied when:** The changelog captures even rapid-fire iterations clearly, and the user can review the progression of their thinking.


---

### Polish

#### Scenario: Unobtrusive Live Updates

> **Given** A user is reading section 3 of their spec while an agent updates section 5
> **When** The update arrives
> **Then** The new content appears in section 5 without disrupting the user's reading position in section 3, and a subtle notification indicates something changed

**Satisfied when:** Live updates feel helpful rather than jarring. The user stays focused on what they're reading and can explore updates when they choose.


---

#### Scenario: Change Annotations That Enhance Clarity

> **Given** A user views a section with recent inline change annotations
> **When** They read the section
> **Then** The annotations make it easier to understand what evolved, using subtle color and spacing, and they can toggle annotations off if they want to read the "clean" version

**Satisfied when:** Annotations add clarity without clutter, and the user feels in control of their reading experience.


---

#### Scenario: Accessible History Exploration

> **Given** A user wants to understand why section 2.1 changed three weeks ago
> **When** They open the change timeline and click that change
> **Then** They see the before/after diff for section 2.1, the rationale for the change, and can quickly navigate to other changes from the same period

**Satisfied when:** Exploring history feels intuitive and informative, like browsing commits in a well-maintained repository, not like parsing raw log files.


---

## Feature: Build Mission Control
> I watch the build happen in a calm dashboard

Category: Viewer | Depends on: Spec Viewer, Autonomous Build

### Critical

#### Scenario: Viewer as Live Mission Control During Builds

> **Given** A user has the spec viewer open and approves a build plan
> **When** The autonomous build is running
> **Then** The viewer shows a real-time view of the build — which chunk is actively being built, which are completed, which are waiting. Sections in the spec light up or change visual state as they are being built and then as they complete

**Satisfied when:** The user can glance at the viewer during a build and immediately see the overall progress — which chunk is active, which are done, which are queued. It feels like a mission control dashboard, not a log viewer. The viewer updates in real-time via WebSocket as chunks progress through their lifecycle.

Validates: `#spec-viewer` (2.9), `#execute-flow` (2.7)


---

#### Scenario: Visual Dependency Graph in Mission Control

> **Given** A user approved a build plan with 6 chunks and opens the spec viewer during the build
> **When** They look at the mission control view
> **Then** They see the build plan rendered as a visual dependency graph — chunks as nodes connected by edges showing dependencies. Active chunks pulse, completed chunks show a settled state, and pending chunks are dimmed. The graph updates in real-time as the build progresses

**Satisfied when:** The user can glance at the graph and immediately understand the build topology: which chunks are running now, which are done, which are waiting and what they're waiting for. The visual is more informative than a text list — dependencies that would be confusing in text ("Chunk 4 depends on Chunks 1 and 3") are obvious in the graph. The graph feels alive during the build, not static.

Validates: `#spec-viewer` (2.9), `#execute-flow` (2.7)


---

### Polish

#### Scenario: Mission Control Feels Calm, Not Noisy

> **Given** A user has the viewer open during a build with 5 chunks
> **When** Chunks start, complete, and new ones begin
> **Then** The viewer updates feel calm and informative — status changes appear smoothly, without flickering, without overwhelming detail, and without creating anxiety about the parallel work happening

**Satisfied when:** The user feels a sense of "things are progressing" rather than "too many things are happening at once." The viewer shows enough to be transparent without being noisy. A user who glances at the viewer every few minutes gets a clear picture; a user who watches continuously doesn't feel overwhelmed.

Validates: `#spec-viewer` (2.9), `#execute-flow` (2.7)


---

#### Scenario: Context Health Visible in Mission Control During Builds

> **Given** A user is watching mission control during a multi-chunk build and wants to understand whether the system is managing its resources well
> **When** They look at the mission control view
> **Then** They see a persistent context health indicator showing the current chunk's context state (isolation mode, approximate usage, last checkpoint timestamp) alongside the existing dependency graph and activity feed. Context lifecycle transitions — "checkpointed before chunk 4", "new context for chunk 5", "compacted — build state preserved" — appear as typed events in the activity feed alongside chunk lifecycle and verification events

**Satisfied when:** The user can glance at mission control and understand that the system is actively managing its own resources. The context health indicator is small and unobtrusive — it doesn't compete with the dependency graph or activity feed for attention. Context events in the feed build trust: the user sees the system checkpointing and managing boundaries, which reinforces confidence that the autonomous build is being handled competently. If no context management events occur (e.g., a short build that fits in one context window), the indicator shows a simple healthy state and no events appear — silence means no action was needed.

Validates: `#spec-viewer` (2.9), `#execute-flow` (2.7), `#status-line` (2.12)


---

## Feature: Async Inbox
> I queue ideas and references while the build runs

Category: Viewer | Depends on: Spec Viewer

### Critical

#### Scenario: Viewer as Async Inbox for Evolve Ideas

> **Given** A user has the spec viewer open and a build is running autonomously
> **When** They think of a new idea — "make onboarding faster" — and submit it through the async inbox in the persistent right rail, which is always accessible without toggling or navigating away from the spec
> **Then** The idea is queued as an "evolve idea" and the system prepares the affected sections in the background, so when the user is ready to run `/fctry:evolve`, the context is already gathered

**Satisfied when:** The user can capture ideas without interrupting the build, the viewer shows their queued items with a clear indication of type (evolve idea), and when they later act on the idea in Claude Code, the system already has context prepared. The queue feels like a notepad that the factory actually reads, not a dead-end form.

Validates: `#spec-viewer` (2.9), `#evolve-flow` (2.4)


---

#### Scenario: Viewer as Async Inbox for References

> **Given** A user has the spec viewer open and spots an inspiring design while browsing the web
> **When** They paste a URL into the async inbox in the persistent right rail, which is always visible alongside the spec without toggling or navigating away
> **Then** The system immediately begins fetching and analyzing the reference in experience language, and by the time the user is ready to incorporate it, the analysis is already complete and waiting

**Satisfied when:** The user sees the reference queued, then processed (with a status indicator), and the analysis results are available in the viewer without the user needing to run `/fctry:ref`. When they do run `/fctry:ref` later, the pre-analyzed content is used, making the incorporation faster. References submitted during a build are processed concurrently with the build — the factory never idles.

Validates: `#spec-viewer` (2.9), `#ref-flow` (2.5)


---

#### Scenario: Viewer as Async Inbox for New Feature Ideas

> **Given** A user has the spec viewer open and thinks of a new feature — "add dark mode"
> **When** They submit it through the async inbox in the persistent right rail as a new feature, without leaving the spec view or toggling panels
> **Then** The system scopes the feature against the existing spec — identifying which sections it would affect, whether it conflicts with existing behavior, and how large the change would be — and presents the scoping analysis in the viewer

**Satisfied when:** The user sees their feature idea scoped against the existing spec, understands the impact before committing to it, and can decide whether to evolve the spec to include it or set it aside. The scoping happens asynchronously while the user does other work. The analysis is in experience language ("this would change how the settings panel works and add a new section for theme preferences") not technical language ("this requires a CSS variables system and a theme provider component").

Validates: `#spec-viewer` (2.9), `#evolve-flow` (2.4)


---

#### Scenario: Async Reference Processing While Build Runs

> **Given** A build is running autonomously and the user submits a reference URL through the viewer
> **When** The system processes the reference
> **Then** The reference is fetched, analyzed, and presented in the viewer concurrently with the build — neither operation blocks the other

**Satisfied when:** The factory is doing two things at once: building code and analyzing a reference. Both complete on their own timelines. The user sees both progressing independently in the viewer. The factory never idles when there is work to do.

Validates: `#spec-viewer` (2.9), `#ref-flow` (2.5), `#capabilities` (3.1)


---

#### Scenario: Inbox Items Become Inbox Cards

> **Given** A user submits "add offline mode" as an evolve idea and pastes a long reference URL through the viewer's quick-add input
> **When** The system processes the submissions (identifies affected sections, scopes impact)
> **Then** New cards appear in the Inbox column of the appropriate kanban level — at the section level if the idea maps to existing sections, or at the project level if it's a new capability. Each card shows a compact summary: truncated idea text or URL, type badge (evolve/reference/feature), and affected sections. The cards appear in the Inbox column regardless of whether the user is in Sections or Scenarios view

**Satisfied when:** The user sees their inbox items appear as kanban cards they can drag into Now/Next/Later to prioritize. The Inbox column is the intake funnel — everything new lands there. The right rail input surface is always accessible for quick submission. Inbox cards are visible in both Sections and Scenarios views — they are project-level, not tied to a view mode. Card content (text, URLs) is truncated to maintain compact, uniform card height; the full content is accessible by clicking the card body to open the detail panel. When the user runs `/fctry:evolve`, inbox cards relevant to the target section are surfaced as conversation context. After incorporation, the card moves to Satisfied.

Validates: `#spec-viewer` (2.9), `#evolve-flow` (2.4)


---

### Edge Cases

#### Scenario: Async Inbox Items Persist Across Sessions

> **Given** A user submitted two evolve ideas and a reference URL through the viewer's async inbox during a build
> **When** The session ends and they start a new Claude Code session the next day
> **Then** Their queued items are still visible in the viewer, with the reference already analyzed and ready to incorporate

**Satisfied when:** The async inbox is durable — items are not lost when sessions end. Pre-processed content (like reference analyses) is cached and available immediately in the next session. The user trusts the inbox as a reliable capture point for ideas.

Validates: `#spec-viewer` (2.9)


---

### Polish

#### Scenario: Inbox Card Layout Consistency

> **Given** A user has submitted several inbox items: a short evolve idea ("add offline mode"), a long reference URL (80+ characters), and a multi-sentence feature description
> **When** They view the Inbox column alongside Now/Next/Later columns containing section cards
> **Then** All inbox cards maintain a compact, uniform height that visually matches the density of section cards. Long URLs are truncated with an ellipsis rather than flowing freely and stretching the card tall. Multi-sentence descriptions show only the first line or a truncated summary. The type badge and affected-sections indicator remain consistently positioned across all card heights

**Satisfied when:** Inbox cards never grow significantly taller than section cards regardless of content length. Long URLs, multi-paragraph descriptions, and short ideas all produce cards of similar compact height. Truncated content does not lose meaning — enough is shown to identify the item at a glance. The full untruncated content is accessible by clicking the card body to open the detail panel. The visual rhythm of the Inbox column is consistent — a user scanning the column never encounters a card that disrupts the grid with unexpected height.

Validates: `#spec-viewer` (2.9)


---

## Feature: Multi-Project Viewer
> I manage all my projects in a single viewer

Category: Viewer | Depends on: Spec Viewer

### Critical

#### Scenario: Switching Between Projects in the Viewer

> **Given** A user has three fctry projects (a personal app, a work tool, and an experimental prototype) all registered in the viewer, and the viewer is showing the personal app's spec
> **When** They click the work tool in the project sidebar
> **Then** The entire viewer context switches — the spec content, ToC, history timeline, async inbox, and mission control (if a build is running) all swap to the work tool's data. The switch happens in under 1 second and the project sidebar highlights the newly selected project

**Satisfied when:** The user can move between projects as fluidly as switching tabs. The previous project's state is preserved — when they switch back, they see the same scroll position and selected tab they left. Each project's inbox, history, and build state are independent. The user never needs to open a separate browser tab or remember different port numbers.

Validates: `#spec-viewer` (2.9)


---

#### Scenario: Auto-Registration of New Projects

> **Given** A user has three projects already visible in the viewer sidebar
> **When** They open a new directory and run `/fctry:init` to create a fourth project's spec
> **Then** The new project appears in the viewer's project sidebar automatically — without the user running any registration command or restarting the viewer. If the viewer is open in the browser, the sidebar updates live

**Satisfied when:** Creating a new fctry project in any directory automatically makes it visible in the viewer. The user never manually configures the project list. The registration happens as part of the init flow. Projects that existed before multi-project support are picked up the first time the user works in them (the hook registers on every prompt).

Validates: `#spec-viewer` (2.9), `#core-flow` (2.2)


---

#### Scenario: Project Sidebar Shows Quick Status

> **Given** A user has four projects in the viewer: one with an active build running (3/7 chunks done), one that is `stable` (all scenarios satisfied, no drift), one that is `draft` (just initialized, never built), and one that is `active` but idle between sessions
> **When** They look at the project sidebar
> **Then** Each project shows its name and its spec status (`draft`, `active`, or `stable`) as a compact badge, plus contextual detail — the building project shows its `active` status alongside "building 3/7", the `stable` project shows a settled green indicator, the `draft` project shows a neutral indicator, and the idle `active` project shows its last activity timestamp

**Satisfied when:** The user can scan the project sidebar and immediately understand both the maturity and activity of each project without switching to it. The spec status badge (`draft`, `active`, `stable`) answers "where is this project in its lifecycle?" while the contextual detail answers "what's happening right now?" The indicators are compact enough to fit in a narrow sidebar but informative enough to answer both questions at a glance. The `building` state is visible as an activity overlay on the `active` status, not as a separate lifecycle stage.

Validates: `#spec-viewer` (2.9)


---

### Edge Cases

#### Scenario: Viewer Server Self-Heals After Crash

> **Given** The multi-project viewer server is running and serving three projects, and the server process is killed (crash, OOM, or manual kill)
> **When** The user types their next prompt in any Claude Code session that has a fctry project
> **Then** The `UserPromptSubmit` hook detects the missing process, restarts the server automatically, re-registers the current project, and the viewer is available again — all within the hook's timeout, with no user-facing error message

**Satisfied when:** The user who had the viewer open in a browser sees the connection status indicator change to "reconnecting" and then recover when the server comes back. The user who didn't have the viewer open never notices the crash happened. The project registry survives the crash (it's a file on disk, not in-memory state). No manual intervention is needed.

Validates: `#spec-viewer` (2.9), `#error-handling` (2.10)


---

#### Scenario: Case-Insensitive Path Deduplication

> **Given** The viewer server is running and a project is registered at `/Users/mike/Code/myapp`, and a hook fires with the working directory `/Users/mike/code/myapp` (lowercase 'c' — same directory on a case-insensitive filesystem)
> **When** The hook calls `POST /api/projects` with the lowercase path
> **Then** The server recognizes this as the same project and updates its activity timestamp rather than creating a duplicate entry. The dashboard shows one card for the project, not two.

**Satisfied when:** On case-insensitive filesystems (macOS default), the same project is never registered twice regardless of path casing differences. The deduplication happens at registration time using filesystem-native path resolution that normalizes casing.

Validates: `#spec-viewer` (2.9)


---

## Feature: Kanban Board
> I see project health visually and prioritize by dragging

Category: Viewer | Depends on: Multi-Project Viewer

### Critical

#### Scenario: Kanban as Project Landing Page

> **Given** A user has three projects registered in the viewer
> **When** They open the viewer
> **Then** They see a kanban board with their projects as cards in columns (Active / Paused / Stable). Each card shows the project name, readiness bar, readiness pills, and accent color. They can drag a project card between columns to change its status. Clicking a project card drills into that project's section kanban.

**Satisfied when:** The kanban is the first thing the user sees — not a static dashboard. Projects are draggable between columns. The visual state of each card (readiness pills, accent color, build progress if running) gives an instant fingerprint. The user understands their portfolio at a glance and can prioritize which project to work on by dragging. Clicking a card navigates into the project's section-level kanban view. The quick-add input sits above the board — visible immediately on landing without scrolling. Kanban columns grow to their natural height and the page scrolls freely rather than confining columns to a fixed viewport region.

Validates: `#spec-viewer` (2.9)


---

#### Scenario: Recursive Kanban Drill-Down

> **Given** A user is viewing a project's section-level kanban and sees 8 section cards across Now/Next/Later columns
> **When** They click the header of the `#spec-viewer` (2.9) card
> **Then** The board transitions to show the sub-features of that section as individual cards — "dark mode," "fuzzy search," "skeleton loading," "syntax highlighting," etc. — each in its own priority column. A breadcrumb trail shows "Projects > MyApp > #spec-viewer" so the user can navigate back up

**Satisfied when:** Clicking a card's header drills down into that card's children — this is the navigation action. Clicking a card's body (the area below the header) opens a slide-out detail panel instead, showing the card's full content without navigating away. Both interactions coexist on every card at every kanban level. The drill-down feels like zooming in, not navigating away. The breadcrumb trail is always visible. Each level uses the same kanban interaction (drag between columns, drag within columns to reorder). The user can drill from project → section → claim in two clicks. Clicking a breadcrumb segment navigates back to that level.

Validates: `#spec-viewer` (2.9)


---

#### Scenario: Section vs. Scenario Toggle at Kanban Level 2

> **Given** A user is viewing a project's kanban at level 2 (inside a project, seeing cards) with two evolve ideas sitting in the Inbox column
> **When** They toggle between "Sections" and "Scenarios" views
> **Then** In Sections mode, cards represent spec sections (`#core-flow`, `#spec-viewer`, etc.). In Scenarios mode, cards represent user stories ("I create a spec from scratch," "I watch a build happen"). The same Inbox/Now/Next/Later/Satisfied columns apply to both views. Switching preserves the column assignments for each view independently. The two inbox cards remain visible in the Inbox column in both views — they do not disappear when toggling

**Satisfied when:** The user can organize their project by either structure (sections) or intent (scenarios). Both groupings are persistent — prioritizing in one view doesn't disturb the other. The toggle is fast and obvious in the UI. Cards in Scenarios view that span multiple sections show which sections they touch. Inbox items are project-level, not view-mode-specific — they remain visible in the Inbox column regardless of whether the user is viewing Sections or Scenarios. Toggling never causes inbox cards to vanish or reappear.

Validates: `#spec-viewer` (2.9)


---

### Polish

#### Scenario: Kanban Cards Show Visual Progress

> **Given** A user is viewing the section-level kanban for a project where some sections have claim-level data (Now sections assessed at claim depth)
> **When** They look at the kanban cards
> **Then** Now section cards show a tiny progress indicator (e.g., "12/15 claims") alongside their readiness color. Cards in the Satisfied column show a green completed state. Cards in Inbox show an inbox-style type badge (evolve/reference/feature). Cards being actively built pulse subtly

**Satisfied when:** Each card's visual state tells the user what's happening without clicking into it. The progress indicator is only shown for sections with claim-level assessment data. The pulsing animation for active build chunks is calm, not anxious. Drag handles are discoverable but don't clutter the card.

Validates: `#spec-viewer` (2.9)


---

#### Scenario: Card Detail Slide-Out Panel

> **Given** A user is viewing the section-level kanban for a project and sees cards for `#core-flow`, `#spec-viewer`, and an inbox card for a recently submitted URL reference
> **When** They click the body of the `#spec-viewer` card (below the header text)
> **Then** A panel slides in from the right edge of the screen, showing the full detail for that section card: the complete heading, alias (`#spec-viewer`), current readiness status, and every claim listed under that section. The kanban board remains visible behind the panel, slightly dimmed. Clicking outside the panel or pressing Escape closes it smoothly

**Satisfied when:** The slide-out panel is a reusable interaction pattern that works at every kanban level and for every card type. For section cards, it shows heading, alias, readiness, and all claims. For inbox cards, it shows the full untruncated content text, type, affected sections, and submission timestamp. For scenario cards, it shows the full title, validates list, and satisfaction status. For claim cards, it shows the full claim text. Clicking the card header still drills down into children (the two interactions coexist without conflict). The panel can accommodate rich content and does not interfere with the kanban layout. The panel closes on outside click or Escape. Opening a different card's detail replaces the current panel content rather than stacking panels.

Validates: `#spec-viewer` (2.9)


---

## Feature: Auto-Generated Diagrams
> I see relationships and flows as visual diagrams

Category: Viewer | Depends on: Spec Viewer

### Critical

#### Scenario: Automatic Diagram for Entity Relationships

> **Given** A user is viewing their spec in the viewer and scrolls to the `#entities` (3.2) section
> **When** They click the diagram toggle icon in the section heading (or press `d`)
> **Then** The section text swaps to a Mermaid entity-relationship diagram showing all tracked entities and their relationships — auto-generated from the bold terms and relationship verbs in the section text. Clicking the toggle again (or pressing `d`) returns to the text view

**Satisfied when:** The diagram accurately reflects the entities described in the section. Relationships (contains, references, produces, consumes) are correctly identified. The toggle is instant (no loading delay). The diagram renders appropriately in both light and dark mode. The diagram icon is only visible on sections that have a diagram available.

Validates: `#spec-viewer` (2.9)


---

#### Scenario: Automatic Diagram for User Flows

> **Given** A user is viewing the `#core-flow` (2.2) section and toggles to diagram mode
> **When** The diagram renders
> **Then** They see a flowchart showing the init journey: state assessment → interview → spec generation → review, with decision points (project classification, save and pause) and branches clearly visible

**Satisfied when:** The flow diagram maps to the step-by-step narrative in the section. Decision points, branches, and outcomes are all represented. The diagram is generated at spec write time (not on demand) so rendering is instant. Different section 2 flows (`#evolve-flow`, `#ref-flow`, `#review-flow`, `#execute-flow`) each have their own flow diagram.

Validates: `#spec-viewer` (2.9)


---

#### Scenario: Section Dependency Neighborhood Diagram

> **Given** A user is viewing `#spec-viewer` (2.9) and toggles to diagram mode
> **When** The diagram renders
> **Then** They see a dependency neighborhood graph centered on `#spec-viewer` — showing which sections it references (`#entities`, `#convergence-strategy`, `#execute-flow`) and which sections reference it (`#observability`, `#capabilities`), with the current section visually distinguished at center

**Satisfied when:** The diagram helps the user understand how the current section connects to the rest of the spec. It shows both outgoing references (sections this one mentions) and incoming references (sections that mention this one). The diagram is focused — not the full dependency graph, just the immediate neighborhood.

Validates: `#spec-viewer` (2.9)


---

### Polish

#### Scenario: Global Diagram Toggle

> **Given** A user wants to see all available diagrams at once instead of toggling section by section
> **When** They activate the global "show all as diagrams" toggle
> **Then** Every section that has a diagram available switches to diagram mode simultaneously. Sections without diagrams remain as text. Toggling off restores all sections to text mode

**Satisfied when:** The global toggle provides a "diagram overview" of the entire spec. The user can scan entity relationships, user flows, agent pipelines, convergence phases, and section dependencies in one scrollable view. The toggle is accessible from the toolbar and has a keyboard shortcut.

Validates: `#spec-viewer` (2.9)


---

# System Quality

## Feature: Workflow Enforcement
> The system keeps me and agents on the right path

Category: System Quality | Depends on: —

### Critical

#### Scenario: Workflow Enforcement Catches Skipped State Owner

> **Given** A command workflow requires the State Owner to run first, but the agent attempts to invoke the Interviewer directly
> **When** The Interviewer checks the workflow state before proceeding
> **Then** The system surfaces a numbered error: "(1) Run State Owner scan now (recommended), (2) Skip State Owner (not recommended), (3) Abort this command" and waits for the user's choice

**Satisfied when:** The user sees a clear, conversational error explaining what was skipped and why it matters, can choose to run the missing step or consciously skip it, and the workflow proceeds correctly after their choice. The system never silently skips a workflow step.


---

#### Scenario: Untracked Change Detection on File Write

> **Given** A user has a spec in `.fctry/spec.md` with section `#status-line` (2.12) that covers `src/statusline/fctry-statusline.js`, and they ask Claude to fix a bug directly in that file without using a fctry command
> **When** The file is written
> **Then** The PostToolUse hook detects the change, maps it to the spec section via the spec index, and surfaces: "This file is covered by `#status-line` (2.12). Want to update the spec first? (1) Run /fctry:evolve status-line, (2) Continue — I'll reconcile later"

**Satisfied when:** The user is made aware that they're making changes outside the factory process, can choose to stay outside the process or jump back in, and the untracked change count in the status line increments if they choose to continue. The nudge is non-blocking and dismissable.


---

#### Scenario: Missing Required Tools at Startup

> **Given** A user runs any `/fctry` command but their environment is missing required tools like `rg` or `sg`
> **When** The command starts and performs tool validation
> **Then** The system immediately shows which tools are missing, explains why each is needed, and provides clear installation instructions before attempting any work

**Satisfied when:** The user sees a friendly error message listing missing tools with one-line install commands they can copy-paste, and the system refuses to proceed until dependencies are met rather than failing partway through.


---

#### Scenario: Silent Auto-Migration from Old Directory Layout

> **Given** A user has an existing fctry project using the old layout: `project-name-spec.md`, `project-name-scenarios.md`, `project-name-changelog.md`, and `references/` at the project root, along with `fctry-state.json` and `.fctry-interview-state.json` as loose files
> **When** They run any `/fctry` command for the first time after the directory structure update
> **Then** The system detects the old layout, moves all files into `.fctry/` with simplified names (dropping the project-name prefix), creates `.fctry/.gitignore`, and shows a brief summary listing each file that moved and where it went

**Satisfied when:** The user sees a clear, non-alarming migration summary, can verify that every file's content is preserved exactly (only paths and names changed), and the command they originally ran continues normally after the summary. If the project already uses the new `.fctry/` structure, no migration runs and no message appears. Old files at the root no longer exist after migration.

Validates: `#directory-structure` (4.3)


---

#### Scenario: Git Tracking Separates Source-of-Truth from Ephemera

> **Given** A user initializes a new fctry project inside a git repository
> **When** They complete `/fctry:init` and then run `git status` to see what was created
> **Then** They see `.fctry/spec.md`, `.fctry/scenarios.md`, `.fctry/changelog.md`, `.fctry/references/`, and `CLAUDE.md` (at the project root) as new untracked files ready to commit, but state files (`state.json`, `spec.db`, `tool-check`, `plugin-root`, `interview-state.md`) and the `viewer/` directory do not appear because `.fctry/.gitignore` excludes them

**Satisfied when:** The user can commit the spec, scenarios, changelog, references, and CLAUDE.md to version control without accidentally committing ephemeral state or cache files. The `.fctry/.gitignore` is created automatically during both init and migration. Source-of-truth documents are always tracked; derived and session-scoped data is always ignored.

Validates: `#directory-structure` (4.3)


---

### Edge Cases

#### Scenario: Conflicting Changes Across Multiple Sessions

> **Given** A user starts `/fctry:evolve core-flow` in one Claude Code session and separately starts `/fctry:evolve 2.1` (which overlaps with core-flow) in another session
> **When** Both sessions attempt to write changes to the spec
> **Then** The second write detects the conflict, shows what the other session changed, and asks the user how to reconcile the two sets of changes

**Satisfied when:** The user never loses work from either session, understands what conflicted, and can merge the changes intentionally rather than having one session silently overwrite the other.


---

#### Scenario: Untracked Change Nudge Dismissed, Then Review

> **Given** A user dismissed two untracked change nudges during a session ("Continue — I'll reconcile later") for files covering `#status-line` (2.12) and `#spec-viewer` (2.9)
> **When** They run `/fctry:review`
> **Then** The gap analysis includes an "Untracked changes" section listing both files, the sections they affect, and when the changes were made — so the user can reconcile them all at once

**Satisfied when:** No untracked changes are lost or forgotten. The review command surfaces all accumulated untracked changes with enough context to reconcile them. After reconciliation (via evolve or manual spec update), the untracked changes counter resets.


---

#### Scenario: Workflow State Survives Context Compression

> **Given** A user is mid-way through a long `/fctry:evolve` session and Claude Code compresses prior context
> **When** The next agent in the workflow needs to validate that previous steps completed
> **Then** The workflow state in `.fctry/state.json` provides ground truth — even if the conversation history was compressed, the state file records which steps ran

**Satisfied when:** Context compression never causes the system to re-run workflow steps or lose track of where it is in the process. The state file (`.fctry/state.json`) is the persistent record, not the conversation history.


---

### Polish

#### Scenario: Process Boundary Is Always Clear

> **Given** A user has been working with fctry commands for 20 minutes and then asks Claude to "just fix this bug real quick" without using a fctry command
> **When** Claude modifies a file that's covered by the spec
> **Then** The status line updates to show `△ 1` (untracked change indicator) and the next time a fctry command runs, the State Owner mentions the untracked change in its briefing

**Satisfied when:** The user always knows whether they're inside or outside the factory process. The boundary is visible via the △ symbol and the system gently reminds them when they've stepped outside, without being annoying or blocking their work.

---

## Feature: Section Readiness
> I know what's ready to build and what needs work

Category: System Quality | Depends on: Spec Review

### Critical

#### Scenario: Automatic Section Readiness Assessment

> **Given** A user has a spec with 12 experience sections, some with corresponding code, some without, and some where code and spec disagree
> **When** The State Owner scans the project at the start of any command
> **Then** Each section receives an automatic readiness assessment: `draft`, `needs-spec-update`, `spec-ahead`, `aligned`, `ready-to-execute`, or `satisfied`. The State Owner writes per-section readiness to `state.json` as the authoritative source, and both the status line and viewer read from it — showing identical, consistent data.

**Satisfied when:** The user can see at a glance which sections are ready to build, which need spec work, and which are complete. The readiness assessment matches reality — sections the user knows are ready show as ready, sections they know need work show as needing work. The status line and viewer always agree because they read from the same source (state.json), not independent heuristics.


---

#### Scenario: Spec Index Enables Section-Level Loading

> **Given** A user has a large spec (50+ sections, 100KB+) and runs `/fctry:evolve core-flow`
> **When** The State Owner and Interviewer need to understand the current state of `#core-flow` and its dependencies
> **Then** The agents query the spec index to load only the target section and its dependencies, rather than reading the full 100KB spec into context

**Satisfied when:** The agents produce the same quality of briefing and interview as if they'd read the full spec, but with significantly less context consumed. The user notices faster response times on large specs. If the database is missing, agents fall back to reading the full spec file with no visible error.


---

#### Scenario: Executor Updates Readiness After Each Chunk Completes

> **Given** A user approved a build plan with 5 chunks covering sections #first-run, #core-flow, #evolve-flow, #ref-flow, and #review-flow — all currently `spec-ahead`
> **When** The Executor completes chunk 2 (covering #core-flow)
> **Then** The Executor updates `state.json` to mark #core-flow as `aligned`, and the viewer's readiness pills update in real-time — the user sees `spec-ahead` count decrease and `aligned` count increase as chunks complete

**Satisfied when:** The user watching the viewer during a build sees readiness progress in real-time. Each completed chunk visibly moves sections from `spec-ahead` to `aligned`. The readiness pills and ToC color indicators update without the user refreshing the page. By the time all chunks complete, the readiness display matches the build's actual output.

---

#### Scenario: Stable Status When All Scenarios Satisfied and No Drift

> **Given** A user has been building and evolving a project through multiple execute and evolve cycles, and the most recent build satisfied all scenarios with no spec-code drift detected
> **When** The State Owner scans the project at the start of the next command
> **Then** The State Owner detects that every scenario is satisfied and there is no drift between the spec and the code, and automatically transitions the spec status from `active` to `stable` — the user sees the transition noted in the State Owner's briefing: "All scenarios satisfied, no drift detected. Spec status: active -> stable."

**Satisfied when:** The user learns that their project has reached a stable state through the State Owner's briefing, not through a separate ceremony or approval step. The transition happens because reality warrants it — all scenarios are satisfied and the spec matches the code. The status change is reflected in the spec frontmatter and the changelog. If even one scenario is unsatisfied or any drift exists, the status remains `active`. The user never needs to declare stability themselves.

Validates: `#review-flow` (2.6), `#rules` (3.3)


---

#### Scenario: Status Lifecycle Transitions Are Fully Automatic

> **Given** A user works with fctry across the full project lifecycle: initializing a spec, evolving it multiple times, building it, reaching satisfaction, evolving again after a period of stability
> **When** They review the spec's status history in the changelog
> **Then** They see a clear trail of status transitions — `draft` at creation, `active` when init completed, still `active` through evolves and builds, `stable` when all scenarios were satisfied, back to `active` when they evolved it again — and none of these transitions required the user to approve, confirm, or even be aware of them in advance

**Satisfied when:** The user never makes a decision about spec status. Every transition is driven by what actually happened: init completed (draft -> active), full satisfaction achieved (active -> stable), spec evolved (stable -> active). The status is a reflection of reality, not a user-managed label. A user who never reads the frontmatter still benefits because the status drives display in the viewer sidebar, the status line, and the State Owner's briefing.

Validates: `#rules` (3.3), `#details` (2.11)


---

#### Scenario: Status Line Shows Readiness Summary

> **Given** A user has a project where the State Owner has assessed section readiness: 35 aligned out of 42 total sections
> **When** They look at the terminal status line
> **Then** They see a compact symbol-prefixed readiness fraction like `◆ 35/42` that tells them the project state at a glance, color-coded green (most ready), yellow (half), or red (few ready)

**Satisfied when:** The readiness fraction is immediately scannable, uses the ◆ symbol to distinguish it from other fractions on the line, and the user can understand overall project health without running a command or reading labels.


---

#### Scenario: Viewer Shows Section Readiness Colors

> **Given** A user has the spec viewer open and the State Owner has assessed section readiness
> **When** They look at the table of contents sidebar
> **Then** Each section has a subtle color indicator showing its readiness: green for aligned/ready/satisfied, yellow for spec-ahead/draft, red for needs-spec-update

**Satisfied when:** The user can visually scan the TOC and immediately understand which sections are in good shape and which need attention, without reading any text or running a command.


---

#### Scenario: Readiness Stats in Sidebar Show Project Health at a Glance

> **Given** A user has the spec viewer open for a project with 42 spec sections at various readiness levels — 25 aligned, 8 spec-ahead, 5 draft, and 4 needs-spec-update
> **When** They look at the left rail above the TOC
> **Then** They see a compact row of colored readiness pills: each pill shows a readiness category label and its count (e.g., "aligned 25", "spec-ahead 8", "draft 5", "needs-spec-update 4"). The pills use the same color coding as the TOC readiness indicators. Categories with zero sections are hidden. The total adds up to the full section count.

**Satisfied when:** The user can read the readiness breakdown in under 2 seconds without scrolling, hovering, or clicking anything. The stats are always visible in the left rail — they don't scroll away with the spec content. A glance at the pills tells the user "how much of my project is built, how much is spec'd but unbuilt, how much needs attention."

Validates: `#spec-viewer` (2.9)


---

### Edge Cases

#### Scenario: SQLite Cache Auto-Rebuilds After Spec Edit

> **Given** A user has a spec with an existing SQLite cache, and the Spec Writer updates three sections during an evolve command
> **When** The spec markdown file is written to disk
> **Then** The SQLite cache detects the change and rebuilds its section index, updating content, metadata, and readiness for the affected sections

**Satisfied when:** The cache is always current with the spec. Agents querying the cache immediately after a spec update get the new content. The rebuild is fast enough that it doesn't add perceptible latency to spec operations.


---

#### Scenario: Missing or Corrupt SQLite Cache

> **Given** A user's `.fctry/spec.db` file is deleted, corrupted, or from a different version
> **When** An agent attempts to query the spec index
> **Then** The system detects the issue, silently rebuilds the database from `.fctry/spec.md`, and proceeds normally without surfacing an error to the user

**Satisfied when:** The user never sees database errors. The system treats the SQLite cache as fully disposable — any problem is solved by rebuilding from the source-of-truth markdown in `.fctry/spec.md`.


---

#### Scenario: Readiness Assessor Classifies New Documentation Sections Without Code Changes

> **Given** A user runs `/fctry:evolve` and adds a new spec section that describes conventions, constraints, or project structure (not a buildable feature)
> **When** The State Owner assesses readiness during its scan
> **Then** The new section is classified as `aligned` (not `spec-ahead` or `draft`) because the assessor automatically detects that meta-concept sections (categories 1, 4, 5, 6) and structural headings don't require matching code — classification is derived from the spec's own structure (section number prefix), not from any project-specific hints or hardcoded lists

**Satisfied when:** Adding a new documentation-only section to the spec never produces a false `spec-ahead` or `draft` readiness. The assessor handles it structurally and works identically for any project — fctry itself, a Python API, a React app, or any other codebase.


---

#### Scenario: Readiness Is Accurate for Non-fctry Projects

> **Given** A user has a Python project with a complete spec and passing tests — the State Owner has assessed all 12 experience sections as `aligned` — and they open the spec viewer
> **When** The viewer loads readiness data for the project
> **Then** The viewer shows the same readiness the State Owner assessed: 12 aligned sections. It does not independently recompute readiness using heuristics that might not understand the project's code structure (e.g., Python function names that don't match spec aliases).

**Satisfied when:** The viewer's readiness display matches the State Owner's assessment for any project, regardless of language, framework, or code structure. A project the State Owner says is fully aligned never shows `spec-ahead` or `draft` in the viewer. The viewer is a faithful display of agent-assessed readiness, not an independent assessor.


---

#### Scenario: Building Does Not Change Spec Status

> **Given** A user has a project with `status: active` and runs `/fctry:execute` to start a build
> **When** The build is running — chunks are executing, code is being written, scenarios are being satisfied one by one
> **Then** The spec status remains `active` throughout the entire build. The building state is visible in the viewer's mission control and the status line as transient activity information, but the spec frontmatter does not change to `building` or any intermediate value

**Satisfied when:** The user who checks the spec frontmatter during a build sees `status: active` — not `building`, not `in-progress`, not any other transient state. Build progress is tracked separately in mission control and the activity feed. The spec status reflects lifecycle maturity (how far along is this project?), not momentary activity (what is happening right now?). The two concerns are visually distinct wherever they appear: the sidebar shows both the status badge and the build progress, but they are separate indicators.

Validates: `#execute-flow` (2.7), `#rules` (3.3)


---

### Polish

#### Scenario: Spec Status Visible Wherever Project State Appears

> **Given** A user has three projects at different lifecycle stages: one `draft` (just initialized), one `active` (mid-development), and one `stable` (all scenarios satisfied)
> **When** They look at any surface that shows project state — the terminal status line, the viewer's project sidebar, or the State Owner's briefing at the start of a command
> **Then** The spec status is consistently shown using the same vocabulary (`draft`, `active`, `stable`) across all surfaces. The status line includes it alongside the project name. The viewer sidebar shows it as a badge. The State Owner mentions it in the opening line of its briefing

**Satisfied when:** The user encounters the same status label everywhere and builds a mental model of what each means: `draft` means the spec exists but init has not completed, `active` means the project is being worked on, `stable` means everything is satisfied and nothing has drifted. The vocabulary is never translated into synonyms ("complete" instead of "stable", "new" instead of "draft") — consistency across surfaces builds trust that the status means the same thing everywhere.

Validates: `#status-line` (2.12), `#spec-viewer` (2.9), `#rules` (3.3)


---

#### Scenario: Status Line Derives Next Step When Idle

> **Given** A user has a project with a spec, some unsatisfied scenarios, and no fctry command currently running
> **When** They look at the terminal status line between commands
> **Then** The status line shows a contextual next step recommendation (e.g., `→ /fctry:execute to satisfy remaining scenarios`) derived from the current state — prioritizing untracked changes first, then all-satisfied celebration, then spec-ahead sections, then unsatisfied scenarios, then draft sections

**Satisfied when:** The user always sees a relevant suggestion for what to do next, even when no agent has explicitly set a next step. The recommendation adapts as the project state changes. When an agent has set an explicit next step, that takes priority over the derived one.


---

#### Scenario: Clicking a Readiness Pill Filters the Spec View

> **Given** A user is viewing a spec with 42 sections and sees the readiness pills showing "spec-ahead 8"
> **When** They click the "spec-ahead" pill
> **Then** The spec content area collapses all non-matching sections — only the 8 spec-ahead sections remain visible with their full rendered content (headings, text, lists, tables). The TOC highlights only matching sections and dims the rest. The clicked pill shows an "active filter" visual state. A subtle indicator (e.g., "Showing 8 of 42 sections") confirms the filter is applied.

**Satisfied when:** The filtered view reads like a focused subset of the spec — the user can scroll through just the sections that match without distraction from other sections. The transition is instant (no loading spinner). Clicking the same pill again clears the filter and restores the full spec. The user's scroll position within the full spec is preserved when the filter is cleared.

Validates: `#spec-viewer` (2.9)


---

#### Scenario: Readiness Stats Auto-Refresh After Spec Changes

> **Given** A user has the spec viewer open showing readiness stats "aligned 25, spec-ahead 8" and an agent updates the spec (adding a new section via `/fctry:evolve`)
> **When** The spec update arrives via WebSocket
> **Then** The readiness stats re-fetch and update — the user sees the counts change to reflect the new section (e.g., "spec-ahead 9" if the new section has no code yet). The update happens automatically without the user clicking a refresh button.

**Satisfied when:** The readiness stats stay current as the spec evolves. The user never sees stale counts. The re-fetch happens after the spec update (triggered by the WebSocket event), with minimal latency. If the readiness assessment takes a moment, the pills show the previous values until the new data arrives (no flicker to zero).

Validates: `#spec-viewer` (2.9)


---

#### Scenario: Spec Status Visual Consistency

> **Given** A user has the spec viewer open and the status line visible in the terminal
> **When** They compare what the viewer shows (kanban cards, readiness, build progress) with what the status line shows
> **Then** Both surfaces show identical readiness data, build progress, and section counts because both read from the same `state.json` source

**Satisfied when:** There is never a discrepancy between the viewer and the status line. Both update when state.json changes. The viewer's kanban cards, readiness pills, and the status line's `N/M ready` count always agree. This consistency builds trust that the system is coherent.

Validates: `#spec-viewer` (2.9), `#status-line` (2.12)

---


---

## Feature: Interaction Quality
> Every interaction feels polished and consistent

Category: System Quality | Depends on: —

### Critical

#### Scenario: Numbered Options Presented Consistently

> **Given** A user interacts with multiple fctry commands throughout a session (init, evolve, execute)
> **When** Any agent presents choices or questions with multiple options
> **Then** All options are numbered consistently, with the format "(1) First option, (2) Second option, (3) Third option" appearing in interviews, version decisions, and error recovery scenarios

**Satisfied when:** The user develops a mental model that "when I see numbered options, I can respond with a number" across all fctry commands, creating a consistent interaction pattern throughout the system.


---

#### Scenario: Clear Progress Indication During Long Operations

> **Given** A user runs `/fctry:init` on a complex project with a long interview or `/fctry:execute` on a large build
> **When** The operation takes several minutes
> **Then** The user sees clear progress indicators, understands what phase is running, and has confidence the system hasn't frozen

**Satisfied when:** The user never wonders "is this stuck or still working?" during any fctry command. Progress feels transparent.


---

### Edge Cases

#### Scenario: User Provides Natural Language Response to Numbered Options

> **Given** A user is presented with numbered options in any fctry context (interview questions, version decisions, error recovery)
> **When** They respond with natural language like "Let's go with the first one" instead of a number
> **Then** The system interprets the natural language response correctly, acknowledges "I'll proceed with option 1", and continues without requiring them to restate as a number

**Satisfied when:** The user can respond either with numbers or natural language, the system understands both, and the numbered format is a convenience rather than a strict requirement.


---

#### Scenario: Synopsis Consumed by External Cataloging System

> **Given** An external system (like a bookmark cataloger) reads the spec's YAML frontmatter to categorize and index the project
> **When** It parses the `synopsis` block
> **Then** It can extract structured project metadata — a one-liner for search results, a paragraph for detail views, technology tags for filtering, pattern tags for architectural classification, and goal statements for relevance matching — all without parsing the spec's prose body

**Satisfied when:** The synopsis block is valid YAML that can be parsed independently of the rest of the spec, all fields use simple types (strings for descriptions, arrays of strings for tech-stack/patterns/goals), field names are predictable and consistent across all fctry-managed projects, and the content is human-readable (not encoded or abbreviated).


---

### Polish

#### Scenario: Readable and Useful Changelogs

> **Given** A user has evolved their spec three times over two weeks
> **When** They open the spec's changelog or the State Owner reads the change history
> **Then** Each entry clearly states what changed, why it changed, and when, in plain language that a human or agent can understand without comparing diffs

**Satisfied when:** A user returning to a project after a month can read the changelog and quickly understand the spec's evolution. An agent reading the changelog can detect drift accurately.


---

#### Scenario: Intuitive Section Addressing

> **Given** A user has a spec and wants to evolve the "error handling" concept
> **When** They see that section 3.2 is titled "Error Handling" with alias `#error-states`
> **Then** They can successfully run `/fctry:evolve 3.2`, `/fctry:evolve error-states`, or `/fctry:evolve #error-states` and all three work identically

**Satisfied when:** The user can reference sections however feels natural to them without memorizing syntax, and all reasonable variations work.


---
