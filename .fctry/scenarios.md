# Scenarios — fctry

> These scenarios serve as the convergence harness for autonomous development. They are the holdout set — stored outside the codebase, evaluated by LLM-as-judge, measuring satisfaction not pass/fail.

---

## Phase 1: Command Loop Features

### Critical Scenarios — Phase 1

#### Scenario: First-Time Project Initialization

> **Given** A user has a new project idea but no existing codebase or spec
> **When** They run `/fctry:init` and answer the interview questions about their vision, describing what users will experience and what boundaries exist
> **Then** They receive a complete NLSpec v2 document in `.fctry/spec.md` that captures their vision in experience language, with stable section aliases they can reference later, a `.fctry/scenarios.md` file that reflects the journeys they described, and a `CLAUDE.md` file at the project root containing evergreen project instructions — the factory contract (where the spec and scenarios live, the rule that the spec describes experience and the coding agent decides implementation), a command quick-reference for the fctry commands, a guide to the `.fctry/` directory and what each file is for, workflow guidance on how the factory process works, and an explanation of what scenarios are and how they drive validation

**Satisfied when:** The user can read the generated spec and recognize their vision accurately captured without any implementation details leaking in, every major user journey they described during the interview has a corresponding scenario in the scenario file, all generated files are organized in the `.fctry/` directory (except `CLAUDE.md` at root), and the `CLAUDE.md` is immediately useful to a coding agent encountering the project for the first time — it orients them on where things live, how the factory process works, and what rules to follow, without containing any build-specific content like architecture notes or convergence order (those come later at execute time).

---

#### Scenario: Multi-Session Interview Resume

> **Given** A user started `/fctry:init` for a complex project, answered questions about the core experience, but needs to stop before finishing the full interview
> **When** They return in a later session and run `/fctry:init` again in the same project
> **Then** The system picks up where they left off, shows them what was already covered, and continues with the remaining interview questions without making them repeat themselves

**Satisfied when:** The user can complete a project initialization across 3+ sessions over several days, and the final spec reflects inputs from all sessions coherently with no repeated questions or lost context.

---

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

#### Scenario: CLAUDE.md Audit During Review

> **Given** A user has a project with a CLAUDE.md at the root (created during init, possibly enriched during execute), and they have since evolved the spec several times — changing the convergence order, adding new sections, or restructuring code
> **When** They run `/fctry:review` and settle the spec-vs-code drift items
> **Then** The system audits both layers of CLAUDE.md: the evergreen layer (factory contract, command quick-reference, directory guide, workflow guidance, scenario explanation) for accuracy against the current `.fctry/` contents, and the build-specific layer (convergence order, architecture notes, build plan) for accuracy against the current spec and codebase — identifying stale paths, outdated convergence order, missing architecture notes, incorrect command references, and any other drift, presenting numbered recommendations for each item

**Satisfied when:** The user sees specific, actionable CLAUDE.md drift items (not vague "might be outdated" warnings), can approve or reject each one individually, and after approving, CLAUDE.md accurately reflects both the evergreen factory contract and the current build-specific state. The audit catches drift in both layers — an outdated command reference in the evergreen section is flagged just as readily as a stale convergence order in the build section. If CLAUDE.md is already current, the user sees "CLAUDE.md is current — no updates needed."

---

#### Scenario: CLAUDE.md Enrichment at Execute with Parallel Strategy

> **Given** A user has run `/fctry:init`, which created a CLAUDE.md at the project root with evergreen content (factory contract, command quick-reference, directory guide, workflow guidance, scenario explanation), and they now have a complete spec ready to build
> **When** They run `/fctry:execute`, approve the build plan, and the Executor begins setting up the project for building
> **Then** The Executor enriches the existing CLAUDE.md with build-specific content — the approved build plan including the parallelization strategy (which chunks run concurrently, which depend on others), the git strategy (branching, merge order), architecture notes derived from the spec, and the convergence order from section 6.2 — layered on top of the evergreen content so that both layers are clearly present and the evergreen content remains intact

**Satisfied when:** The user can open CLAUDE.md after execute begins and see both layers clearly: the evergreen instructions they got at init (factory contract, commands, directory guide) are still there and unchanged, and the new build-specific content (plan with parallelization strategy, git approach, architecture, convergence order) is added in a way that a coding agent can read the whole file and understand both the factory process and the specific build context. If CLAUDE.md already has build-specific content from a previous execute, the Executor updates that content to reflect the new plan without duplicating the evergreen layer.

Validates: `#execute-flow` (2.7), `#agent-decides` (6.4)

---

#### Scenario: Autonomous Build Execution

> **Given** A user has a complete spec and runs `/fctry:execute` to start building
> **When** The Executor presents a build plan showing which chunks are independent, which depend on others, what will run concurrently, and the git strategy for branching and merging — and the user approves the plan
> **Then** The build runs autonomously without further approval gates between chunks, the agent handles code failures, retries, and rearchitecting on its own, and the user can walk away and return later to find the build either complete or paused at an experience-level question

**Satisfied when:** The user approves the plan exactly once and does not need to approve individual chunks, choose pacing options, or respond to code-level failures. The agent proceeds through the entire plan autonomously. The only reason the build pauses for user input is when the spec is ambiguous or contradictory at the experience level — never for implementation decisions, code errors, or retry strategies. A user who approves the plan and returns 30 minutes later finds either a completed build with an experience report, or a clear experience-level question waiting for them.

Validates: `#execute-flow` (2.7), `#design-principles` (1.3), `#hard-constraints` (4.4)

---

#### Scenario: Build Plan Shows Parallelization and Git Strategy

> **Given** A user has a spec with 8 sections ready to build and runs `/fctry:execute`
> **When** The Executor proposes the build plan
> **Then** The plan shows not just the work chunks but the parallelization strategy — which chunks are independent and will run concurrently, which chunks depend on others and must wait — along with the git strategy: how branches will be used, in what order they merge, and how the history will be kept clean

**Satisfied when:** The user understands the scope and shape of the build before approving: they can see that chunks A, B, and C will run in parallel while chunk D waits for A to finish, and that the agent will use feature branches that merge cleanly into the main branch. The plan gives enough information to set expectations about duration and approach without requiring the user to understand git internals. A user who approves has a clear mental model of what will happen while they're away.

Validates: `#execute-flow` (2.7), `#agent-decides` (6.4)

---

#### Scenario: Post-Build Experience Report

> **Given** A user approved a build plan and the Executor has completed all chunks autonomously
> **When** The build finishes and the user returns to see the results
> **Then** The Executor presents an experience report that tells the user what they can now do — concrete, experience-mapped guidance like "You can now open the app and see your items sorted by urgency" and "Try adding a new item and watch it appear in the right position" — rather than a satisfaction score like "34/42 scenarios satisfied"

**Satisfied when:** The experience report reads like a guide to trying out the built system, not a test results dashboard. The user knows exactly what to go try, in what order, and what the expected experience should be. Scenario satisfaction data may be available somewhere, but the primary presentation is "here is what you can now do." A non-technical user reading the report feels oriented and excited to try the system, not confused by metrics.

Validates: `#execute-flow` (2.7), `#success-looks-like` (1.4)

---

#### Scenario: Agent Resurfaces Only for Experience Questions

> **Given** A build is running autonomously and the agent encounters a situation that requires a decision
> **When** The decision is about implementation (a library doesn't work, a test fails, the architecture needs restructuring) versus when the decision is about the experience (the spec says two contradictory things about what the user sees, or a described interaction doesn't make sense)
> **Then** For implementation decisions, the agent resolves them autonomously without asking the user. For experience decisions, the agent pauses the build and presents the question in experience language, asking the user to clarify their intent

**Satisfied when:** During a full build, the user is never asked about code failures, dependency issues, performance tradeoffs, or architectural decisions. If the agent surfaces a question, it is always about what the user sees, does, or feels — never about how to build it. A user who is not a programmer can answer every question the agent asks, because the questions are in their language, about their vision.

Validates: `#execute-flow` (2.7), `#design-principles` (1.3)

---

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

#### Scenario: Clean Git History from Autonomous Build

> **Given** A user has a project in a git repository, approves a build plan with concurrent chunks, and the agent executes autonomously
> **When** The build completes and the user reviews the git log
> **Then** The history reads as a clean, linear narrative of feature development — each commit clearly describes what was built and which scenarios were satisfied, without merge noise, broken intermediate states, or implementation artifacts from the parallel execution

**Satisfied when:** A developer (or the user themselves) can read the git history and understand the project's evolution as a coherent story. The parallel execution strategy is invisible in the final history — it reads as if the features were built sequentially in a logical order. Each commit message provides enough context to understand what milestone was achieved. The user never has to "git rebase" or clean up after the agent.

Validates: `#execute-flow` (2.7), `#agent-decides` (6.4), `#details` (2.11)

---

#### Scenario: Semantic Versioning with Patch Auto-Tags

> **Given** A user's project starts at version 0.1.0 after their first execute run completes in a git repository
> **When** The Executor completes subsequent build chunks during autonomous execution
> **Then** Each successful chunk commit is automatically tagged with an incremented patch version (0.1.1, 0.1.2, etc.), and the user sees the version progression in the post-build experience report

**Satisfied when:** The user can see the project version history after a build completes, understand that patch versions represent incremental progress, and rely on the version history to track which features were added when. The versioning happens automatically during the autonomous build without user intervention. Projects without git continue building without version tags.

Validates: `#details` (2.11), `#rules` (3.3)

---

#### Scenario: Minor Version Suggestion at Plan Completion

> **Given** A user has completed a full autonomous build, and all planned chunks finished successfully
> **When** The Executor presents the post-build experience report
> **Then** The system suggests incrementing the minor version (e.g., from 0.1.8 to 0.2.0) and asks the user to approve with a numbered choice: "(1) Tag as 0.2.0 now, (2) Skip tagging, (3) Suggest different version"

**Satisfied when:** The user understands that the full plan completion is a natural milestone for a minor version bump, can approve or decline by number, and the tag is created only if they approve. Non-git projects show a version notation in the completion summary but don't attempt tagging.

Validates: `#details` (2.11), `#rules` (3.3)

---

#### Scenario: Major Version Suggestion at Experience Milestone

> **Given** A user has completed multiple execute cycles and the system detects a significant experience milestone (e.g., all critical scenarios satisfied, or a major section like "spec-viewer" fully implemented)
> **When** The Executor presents the post-build experience report for that cycle
> **Then** The system suggests incrementing the major version (e.g., from 0.9.3 to 1.0.0) with a rationale explaining why this is a major milestone, and asks the user to approve with numbered options: "(1) Tag as 1.0.0 with rationale: <reason>, (2) Skip tagging, (3) Suggest different version"

**Satisfied when:** The user sees a clear explanation of why this is a major milestone, can approve or decline by number, understands that major versions represent significant experience changes, and the tag is created only with approval and includes the rationale in the tag message.

Validates: `#details` (2.11), `#rules` (3.3)

---

#### Scenario: Answering Interview Questions by Number

> **Given** A user is in an interview session (init or evolve) and the Interviewer presents multiple-choice options
> **When** The Interviewer asks "Which part of your spec does this relate to? (1) The main navigation (section 2.2), (2) The settings panel (section 2.5), (3) Something not yet in the spec"
> **Then** The user can respond with just "1" or "2" or "3" and the system understands their choice without requiring them to type the full option text

**Satisfied when:** The user can quickly answer multiple-choice questions by typing single digits, the system correctly interprets their numeric response, and the conversation flow feels natural and efficient.

---

### Edge Case Scenarios — Phase 1

#### Scenario: Missing Required Tools at Startup

> **Given** A user runs any `/fctry` command but their environment is missing required tools like `rg` or `sg`
> **When** The command starts and performs tool validation
> **Then** The system immediately shows which tools are missing, explains why each is needed, and provides clear installation instructions before attempting any work

**Satisfied when:** The user sees a friendly error message listing missing tools with one-line install commands they can copy-paste, and the system refuses to proceed until dependencies are met rather than failing partway through.

---

#### Scenario: Resume After Interview Interruption

> **Given** A user is midway through a multi-session interview when Claude Code crashes or the user force-quits
> **When** They restart Claude Code and run `/fctry:init` again
> **Then** The system detects the incomplete interview state, shows what was already captured, and offers to resume from the last completed section

**Satisfied when:** The user loses no progress from earlier interview sessions, and the resume experience feels intentional rather than like recovering from an error.

---

#### Scenario: Evolving a Section That No Longer Exists

> **Given** A user has an old reference to section alias `#beta-feature` that was removed in a previous spec update
> **When** They try to run `/fctry:evolve beta-feature`
> **Then** The system explains that section no longer exists, shows when it was removed and why (from changelog), and suggests related sections that might be what they meant

**Satisfied when:** The user understands why their reference failed and can quickly find the correct section to evolve without guessing or reading the entire spec.

---

#### Scenario: Reference URL That Fails to Load

> **Given** A user runs `/fctry:ref 2.3 https://broken-url` with a URL that returns 404 or times out
> **When** The system attempts to fetch the reference
> **Then** The system reports the fetch failure clearly, asks if the user has an alternate URL or can paste the content directly, and doesn't leave the spec in a half-updated state

**Satisfied when:** The user sees a helpful error, has a clear path forward, and the spec remains unchanged when a reference fails to load.

---

#### Scenario: Conflicting Changes Across Multiple Sessions

> **Given** A user starts `/fctry:evolve core-flow` in one Claude Code session and separately starts `/fctry:evolve 2.1` (which overlaps with core-flow) in another session
> **When** Both sessions attempt to write changes to the spec
> **Then** The second write detects the conflict, shows what the other session changed, and asks the user how to reconcile the two sets of changes

**Satisfied when:** The user never loses work from either session, understands what conflicted, and can merge the changes intentionally rather than having one session silently overwrite the other.

---

#### Scenario: Empty or Vague Evolve Request

> **Given** A user has a complete spec but runs `/fctry:evolve core-flow` and then gives very vague or contradictory answers during the interview
> **When** The Interviewer tries to synthesize changes
> **Then** The system acknowledges the ambiguity, asks clarifying questions, and refuses to make changes until it has clear direction rather than guessing or making minimal changes

**Satisfied when:** The user is guided to provide clear intent, and the system never produces a weakened or confused spec because the input was unclear.

---

#### Scenario: Execute in Non-Git Project

> **Given** A user has a project directory with a spec but no git repository initialized
> **When** They run `/fctry:execute` and the Executor completes the autonomous build
> **Then** The build proceeds normally, scenarios are satisfied, and the post-build experience report shows what the user can now do without attempting any git commits or version tags

**Satisfied when:** The user can build from a spec in any directory structure, git integration is a helpful addition when available but never a requirement, and non-git projects receive the same quality of experience report without git-specific references.

Validates: `#execute-flow` (2.7), `#error-handling` (2.10)

---

#### Scenario: Autonomous Build Handles Code Failures Silently

> **Given** A user approved a build plan and the agent is executing autonomously, and a chunk fails — code does not compile, tests fail, or a dependency is missing
> **When** The agent encounters the failure
> **Then** The agent retries with an adjusted approach, rearchitects if needed, and continues the build without surfacing the failure to the user. The user never sees the error or is asked to make an implementation decision

**Satisfied when:** The build recovers from at least two different types of code-level failures (compilation errors, test failures, dependency issues) without interrupting the user. The post-build report mentions no implementation-level failures. If the agent truly cannot recover after exhausting its strategies, it presents the situation as an experience-level question: "I wasn't able to build [feature description]. The spec says [X] but I'm not sure if you meant [Y] or [Z]. Which is closer to your intent?"

Validates: `#execute-flow` (2.7), `#error-handling` (2.10), `#design-principles` (1.3)

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

#### Scenario: User Provides Natural Language Response to Numbered Options

> **Given** A user is presented with numbered options in any fctry context (interview questions, version decisions, error recovery)
> **When** They respond with natural language like "Let's go with the first one" instead of a number
> **Then** The system interprets the natural language response correctly, acknowledges "I'll proceed with option 1", and continues without requiring them to restate as a number

**Satisfied when:** The user can respond either with numbers or natural language, the system understands both, and the numbered format is a convenience rather than a strict requirement.

---

### Experience Quality Scenarios — Phase 1

#### Scenario: Fast Iteration on Small Changes

> **Given** A user wants to tweak a single interaction detail in section 2.1.3
> **When** They run `/fctry:evolve 2.1.3`, answer one or two questions, and receive the updated spec
> **Then** The entire flow from command to updated spec takes under 60 seconds for a minor change, and the changelog clearly shows the small delta

**Satisfied when:** Small evolutions feel lightweight and fast, not like re-running a full spec generation process. The user feels encouraged to iterate frequently rather than batching changes.

---

#### Scenario: Clear Progress Indication During Long Operations

> **Given** A user runs `/fctry:init` on a complex project with a long interview or `/fctry:execute` on a large build
> **When** The operation takes several minutes
> **Then** The user sees clear progress indicators, understands what phase is running, and has confidence the system hasn't frozen

**Satisfied when:** The user never wonders "is this stuck or still working?" during any fctry command. Progress feels transparent.

---

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

#### Scenario: Post-Build Experience Report Feels Like a Guide

> **Given** A user completes a full `/fctry:execute` autonomous build
> **When** The build finishes
> **Then** The Executor provides an experience report that tells the user what they can now do — starting with the most impactful new capabilities, walking through how to try each one, noting the starting and final versions, and suggesting what to explore first. It includes git commit references when available but leads with the experience, not the implementation details

**Satisfied when:** The user reads the report and feels oriented and excited to try the built system. The report is a guide, not a data dump. It answers "what can I do now?" before "what was built?" A non-technical user understands every sentence without needing to know git, commits, or version numbers.

Validates: `#execute-flow` (2.7), `#success-looks-like` (1.4)

---

#### Scenario: Numbered Options Presented Consistently

> **Given** A user interacts with multiple fctry commands throughout a session (init, evolve, execute)
> **When** Any agent presents choices or questions with multiple options
> **Then** All options are numbered consistently, with the format "(1) First option, (2) Second option, (3) Third option" appearing in interviews, version decisions, and error recovery scenarios

**Satisfied when:** The user develops a mental model that "when I see numbered options, I can respond with a number" across all fctry commands, creating a consistent interaction pattern throughout the system.

---

#### Scenario: Git Commit Messages That Tell a Story

> **Given** A user completes a full autonomous execute cycle in a git repository
> **When** They review the git log after completion
> **Then** Each commit message clearly describes what was built and which scenarios were satisfied, creating a narrative of the build's progression that reads like a coherent story of feature development — regardless of whether the build ran chunks in parallel

**Satisfied when:** A developer (or the user themselves) can read the git history and understand the project's evolution without opening the spec, and each commit message provides enough context to understand what milestone was achieved. Parallel execution is invisible in the commit history.

Validates: `#execute-flow` (2.7), `#details` (2.11)

---

---

## Phase 2: Spec Viewer and Live Mission Control

### Critical Scenarios — Phase 2

#### Scenario: Auto-Starting Spec Viewer

> **Given** A user is starting work on a project with an existing spec
> **When** They type any prompt in Claude Code
> **Then** A local web server starts silently in the background — no browser tab opens, no output interrupts the flow — and the viewer is ready at a local URL whenever the user wants to see their spec

**Satisfied when:** The viewer is always running when a spec exists, starts without the user noticing, and the user can open it anytime with `/fctry:view`. If no spec exists, nothing happens. If the viewer is already running, the hook is a no-op. When the session ends, the viewer stops automatically.

---

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
> **When** They open the spec viewer and navigate to the change history sidebar
> **Then** They see a timeline of changes (Log4brains style) with clear dates, descriptions, and the ability to click any change to see what sections were affected

**Satisfied when:** The user can explore the spec's evolution over time, understand the trajectory of decisions, and quickly jump to any historical change they want to review.

---

#### Scenario: Inline Change Annotations

> **Given** A user is viewing their spec after running `/fctry:evolve 2.2`
> **When** They look at section 2.2 in the viewer
> **Then** The section shows inline annotations (Spec Markdown style) indicating what was added, modified, or removed in the most recent change, with a subtle visual treatment that doesn't overwhelm the content

**Satisfied when:** The user can see what changed without opening a separate diff view, and the annotations enhance understanding rather than cluttering the reading experience.

---

#### Scenario: Zero-Build Spec Rendering

> **Given** A user makes a manual edit to their `.fctry/spec.md` file (outside of fctry commands) to fix a typo
> **When** They save the file
> **Then** The viewer updates immediately without requiring any build step, bundler, or preprocessor to run

**Satisfied when:** The rendering feels instant and lightweight, like a live markdown preview, not like a compiled documentation site.

---

#### Scenario: Viewer as Live Mission Control During Builds

> **Given** A user has the spec viewer open and approves a build plan with multiple concurrent chunks
> **When** The autonomous build is running
> **Then** The viewer shows a real-time view of concurrent agent work — which chunks are actively being built, which are completed, which are waiting on dependencies. Sections in the spec light up or change visual state as they are being built and then as they complete

**Satisfied when:** The user can glance at the viewer during a build and immediately see the overall progress — how many chunks are running in parallel, which are done, which are queued. It feels like a mission control dashboard, not a log viewer. The viewer updates in real-time via WebSocket as chunks progress through their lifecycle.

Validates: `#spec-viewer` (2.9), `#execute-flow` (2.7)

---

#### Scenario: Viewer as Async Inbox for Evolve Ideas

> **Given** A user has the spec viewer open and a build is running autonomously
> **When** They think of a new idea — "make onboarding faster" — and submit it through the viewer's input interface
> **Then** The idea is queued as an "evolve idea" and the system prepares the affected sections in the background, so when the user is ready to run `/fctry:evolve`, the context is already gathered

**Satisfied when:** The user can capture ideas without interrupting the build, the viewer shows their queued items with a clear indication of type (evolve idea), and when they later act on the idea in Claude Code, the system already has context prepared. The queue feels like a notepad that the factory actually reads, not a dead-end form.

Validates: `#spec-viewer` (2.9), `#evolve-flow` (2.4)

---

#### Scenario: Viewer as Async Inbox for References

> **Given** A user has the spec viewer open and spots an inspiring design while browsing the web
> **When** They paste a URL into the viewer's input interface
> **Then** The system immediately begins fetching and analyzing the reference in experience language, and by the time the user is ready to incorporate it, the analysis is already complete and waiting

**Satisfied when:** The user sees the reference queued, then processed (with a status indicator), and the analysis results are available in the viewer without the user needing to run `/fctry:ref`. When they do run `/fctry:ref` later, the pre-analyzed content is used, making the incorporation faster. References submitted during a build are processed concurrently with the build — the factory never idles.

Validates: `#spec-viewer` (2.9), `#ref-flow` (2.5)

---

#### Scenario: Viewer as Async Inbox for New Feature Ideas

> **Given** A user has the spec viewer open and thinks of a new feature — "add dark mode"
> **When** They submit it through the viewer's input interface as a new feature
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

### Edge Case Scenarios — Phase 2

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

#### Scenario: Change History for Rapid Iterations

> **Given** A user runs `/fctry:evolve` five times in 30 minutes, refining a single section iteratively
> **When** They view the change timeline
> **Then** All five changes appear as distinct entries, allowing them to trace the evolution step-by-step, even though the changes were rapid and overlapping

**Satisfied when:** The changelog captures even rapid-fire iterations clearly, and the user can review the progression of their thinking.

---

#### Scenario: Async Inbox Items Persist Across Sessions

> **Given** A user submitted two evolve ideas and a reference URL through the viewer's async inbox during a build
> **When** The session ends and they start a new Claude Code session the next day
> **Then** Their queued items are still visible in the viewer, with the reference already analyzed and ready to incorporate

**Satisfied when:** The async inbox is durable — items are not lost when sessions end. Pre-processed content (like reference analyses) is cached and available immediately in the next session. The user trusts the inbox as a reliable capture point for ideas.

Validates: `#spec-viewer` (2.9)

---

### Experience Quality Scenarios — Phase 2

#### Scenario: Beautiful and Readable Rendering

> **Given** A user opens their spec in the viewer for the first time
> **When** They scroll through sections
> **Then** The typography is comfortable to read, the hierarchy is clear, code blocks and lists are well-formatted, and the design feels polished, not like a default markdown renderer

**Satisfied when:** The user enjoys reading their spec in the viewer and prefers it to reading the raw markdown file. The design feels intentional and professional.

---

#### Scenario: Smooth Section Navigation

> **Given** A user has a spec with 30+ sections and wants to jump to section 4.3
> **When** They use the section navigation (sidebar or search)
> **Then** Jumping to 4.3 is instant, the viewport scrolls smoothly to the section, and the section briefly highlights so they know they arrived at the right place

**Satisfied when:** Navigation feels effortless and precise, and the user never loses their place or wonders if they jumped to the right section.

---

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

#### Scenario: Mobile-Friendly Viewing

> **Given** A user wants to review their spec on a tablet or phone while away from their desk
> **When** They open the viewer on a mobile device
> **Then** The layout adapts to the smaller screen, navigation remains accessible, and reading remains comfortable

**Satisfied when:** The viewer is fully usable on mobile devices, and the user can review their spec anywhere without frustration.

---

#### Scenario: Mission Control Feels Calm, Not Noisy

> **Given** A user has the viewer open during a build with 5 concurrent chunks
> **When** Chunks start, complete, and new ones begin
> **Then** The viewer updates feel calm and informative — status changes appear smoothly, without flickering, without overwhelming detail, and without creating anxiety about the parallel work happening

**Satisfied when:** The user feels a sense of "things are progressing" rather than "too many things are happening at once." The viewer shows enough to be transparent without being noisy. A user who glances at the viewer every few minutes gets a clear picture; a user who watches continuously doesn't feel overwhelmed.

Validates: `#spec-viewer` (2.9), `#execute-flow` (2.7)

---

---

## Phase 3: Process Guardrails, Spec Index, and Section Readiness

### Critical Scenarios — Phase 3

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

#### Scenario: Spec Index Enables Section-Level Loading

> **Given** A user has a large spec (50+ sections, 100KB+) and runs `/fctry:evolve core-flow`
> **When** The State Owner and Interviewer need to understand the current state of `#core-flow` and its dependencies
> **Then** The agents query the spec index to load only the target section and its dependencies, rather than reading the full 100KB spec into context

**Satisfied when:** The agents produce the same quality of briefing and interview as if they'd read the full spec, but with significantly less context consumed. The user notices faster response times on large specs. If the database is missing, agents fall back to reading the full spec file with no visible error.

---

#### Scenario: Automatic Section Readiness Assessment

> **Given** A user has a spec with 12 experience sections, some with corresponding code, some without, and some where code and spec disagree
> **When** The State Owner scans the project at the start of any command
> **Then** Each section receives an automatic readiness assessment: `draft`, `needs-spec-update`, `spec-ahead`, `aligned`, `ready-to-execute`, or `satisfied` — and the readiness is visible in the status line and viewer

**Satisfied when:** The user can see at a glance which sections are ready to build, which need spec work, and which are complete. The readiness assessment matches reality — sections the user knows are ready show as ready, sections they know need work show as needing work.

---

#### Scenario: Executor Filters Build Plan by Readiness

> **Given** A user has a spec with 8 sections, 5 of which are `ready-to-execute` and 3 of which are `needs-spec-update`
> **When** They run `/fctry:execute` and the Executor proposes a build plan
> **Then** The plan includes only the 5 ready sections and notes: "3 sections excluded (needs spec update): #multi-session (2.3), #ref-flow (2.5), #details (2.11). Run /fctry:evolve for these sections first."

**Satisfied when:** The user sees a focused build plan that won't waste time on sections that aren't ready, understands why some sections were excluded, and has a clear path to make them buildable.

---

#### Scenario: SQLite Cache Auto-Rebuilds After Spec Edit

> **Given** A user has a spec with an existing SQLite cache, and the Spec Writer updates three sections during an evolve command
> **When** The spec markdown file is written to disk
> **Then** The SQLite cache detects the change and rebuilds its section index, updating content, metadata, and readiness for the affected sections

**Satisfied when:** The cache is always current with the spec. Agents querying the cache immediately after a spec update get the new content. The rebuild is fast enough that it doesn't add perceptible latency to spec operations.

---

### Edge Case Scenarios — Phase 3

#### Scenario: Missing or Corrupt SQLite Cache

> **Given** A user's `.fctry/spec.db` file is deleted, corrupted, or from a different version
> **When** An agent attempts to query the spec index
> **Then** The system detects the issue, silently rebuilds the database from `.fctry/spec.md`, and proceeds normally without surfacing an error to the user

**Satisfied when:** The user never sees database errors. The system treats the SQLite cache as fully disposable — any problem is solved by rebuilding from the source-of-truth markdown in `.fctry/spec.md`.

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

### Experience Quality Scenarios — Phase 3

#### Scenario: Status Line Shows Readiness Summary

> **Given** A user has a project where the State Owner has assessed section readiness: 35 aligned out of 42 total sections
> **When** They look at the terminal status line
> **Then** They see a compact symbol-prefixed readiness fraction like `◆ 35/42` that tells them the project state at a glance, color-coded green (most ready), yellow (half), or red (few ready)

**Satisfied when:** The readiness fraction is immediately scannable, uses the ◆ symbol to distinguish it from other fractions on the line, and the user can understand overall project health without running a command or reading labels.

---

#### Scenario: Status Line Derives Next Step When Idle

> **Given** A user has a project with a spec, some unsatisfied scenarios, and no fctry command currently running
> **When** They look at the terminal status line between commands
> **Then** The status line shows a contextual next step recommendation (e.g., `→ /fctry:execute to satisfy remaining scenarios`) derived from the current state — prioritizing untracked changes first, then all-satisfied celebration, then spec-ahead sections, then unsatisfied scenarios, then draft sections

**Satisfied when:** The user always sees a relevant suggestion for what to do next, even when no agent has explicitly set a next step. The recommendation adapts as the project state changes. When an agent has set an explicit next step, that takes priority over the derived one.

---

#### Scenario: Viewer Shows Section Readiness Colors

> **Given** A user has the spec viewer open and the State Owner has assessed section readiness
> **When** They look at the table of contents sidebar
> **Then** Each section has a subtle color indicator showing its readiness: green for aligned/ready/satisfied, yellow for spec-ahead/draft, red for needs-spec-update

**Satisfied when:** The user can visually scan the TOC and immediately understand which sections are in good shape and which need attention, without reading any text or running a command.

---

#### Scenario: Process Boundary Is Always Clear

> **Given** A user has been working with fctry commands for 20 minutes and then asks Claude to "just fix this bug real quick" without using a fctry command
> **When** Claude modifies a file that's covered by the spec
> **Then** The status line updates to show `△ 1` (untracked change indicator) and the next time a fctry command runs, the State Owner mentions the untracked change in its briefing

**Satisfied when:** The user always knows whether they're inside or outside the factory process. The boundary is visible via the △ symbol and the system gently reminds them when they've stepped outside, without being annoying or blocking their work.

---
