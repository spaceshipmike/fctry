# Scenarios — fctry

> These scenarios serve as the convergence harness for autonomous development. They are the holdout set — stored outside the codebase, evaluated by LLM-as-judge, measuring satisfaction not pass/fail.

---

## Phase 1: Command Loop Features

### Critical Scenarios — Phase 1

#### Scenario: First-Time Project Initialization

> **Given** A user has a new project idea but no existing codebase or spec
> **When** They run `/fctry:init` and answer the interview questions about their vision, describing what users will experience and what boundaries exist
> **Then** They receive a complete NLSpec v2 document that captures their vision in experience language, with stable section aliases they can reference later, and a set of scenarios that reflect the journeys they described

**Satisfied when:** The user can read the generated spec and recognize their vision accurately captured without any implementation details leaking in, and every major user journey they described during the interview has a corresponding scenario in the scenario file.

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

#### Scenario: Paced Build Execution with Priority Grouping

> **Given** A user has a complete spec and runs `/fctry:execute` to start building
> **When** The Executor proposes the first chunk of work and asks whether to proceed with highest priority items, logically grouped items, or everything at once
> **Then** The user picks their preference, the Executor builds that chunk, then pauses and presents the same options for the next chunk, continuing until the full build is complete

**Satisfied when:** The user can control build pacing throughout the process, see progress after each chunk, and choose different pacing options at different stages. At the end, they receive a list of specific section aliases or numbers to review for validation.

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

#### Scenario: Helpful Executor Summaries

> **Given** A user completes a full `/fctry:execute` build cycle with three paced chunks
> **When** The build finishes
> **Then** The Executor provides a clear summary of what was built, which scenarios should now be satisfied, and specific section aliases to review for validation, formatted so the user can quickly assess readiness

**Satisfied when:** The user knows exactly what to check next without reading the entire spec or guessing which scenarios to validate. The summary feels like a helpful handoff, not a data dump.

---

---

## Phase 2: Spec Viewer

### Critical Scenarios — Phase 2

#### Scenario: Auto-Starting Spec Viewer

> **Given** A user is starting work on a project with an existing spec
> **When** They run any `/fctry` command (init, evolve, ref, review, execute)
> **Then** A local web server starts automatically, a browser tab opens showing their spec rendered beautifully, and they can see the spec while the command runs

**Satisfied when:** The user never has to manually start the viewer or remember a URL. The spec is visible whenever they're working with fctry.

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

> **Given** A user makes a manual edit to their spec.md file (outside of fctry commands) to fix a typo
> **When** They save the file
> **Then** The viewer updates immediately without requiring any build step, bundler, or preprocessor to run

**Satisfied when:** The rendering feels instant and lightweight, like a live markdown preview, not like a compiled documentation site.

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
