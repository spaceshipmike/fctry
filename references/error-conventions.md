# Error Conventions

**Prescriptive error messages.** Every error tells the agent or user exactly
what to do next — not just what went wrong. The error is the recovery plan.

Every error across all commands follows this pattern:

1. **State what happened.** Plain language, no jargon.
2. **Explain why.** Brief context about the cause.
3. **Tell them what to do.** Installation commands, closest-match
   suggestions, fix commands. The error message itself is actionable.
4. **Present numbered options.** Always at least two choices for recovery.

## Common Error Patterns

| Error | Convention |
|-------|-----------|
| No spec found | "No spec found in this project. (1) Run `/fctry:init` to create one (2) Specify a different directory" |
| Invalid section alias | List available sections with numbers (see alias resolution in `references/alias-resolution.md`) |
| Empty arguments | Explain what's expected: "Usage: `/fctry:evolve <section or description>`. (1) Show available sections (2) Describe the change in natural language" |
| URL fetch failure | Try alternatives, then present options (see `agents/researcher.md`) |
| Missing tools | Show status and options (see tool validation in `commands/init.md`) |
| Chunk failure during execute | "(1) Flag for review and continue (2) Stop execution (3) Retry this chunk" |
| Workflow step skipped | "Workflow error: {missing step} must run before {current agent} can proceed. (1) Run {missing step} now (recommended) (2) Skip (not recommended) (3) Abort this command" |
| File write covers spec section | "This file is covered by `#alias` (N.N). Want to update the spec first? (1) Run /fctry:evolve alias (2) Continue — I'll reconcile later" |
| Section not ready to execute | "Section N.N (alias) needs a spec update before building. Run /fctry:evolve alias first." |
| Ambiguous user response | Restate the options and ask for clarification — never guess |
| Migration failure | "Migration couldn't complete: {error}. Your files are safe at their original locations. (1) Retry (2) Move files manually (3) Continue with old layout" |
