# Error Conventions

**Prescriptive error messages.** Every error tells the agent or user exactly
what to do next — not just what went wrong. The error is the recovery plan.

Every error across all commands follows this pattern:

1. **State what happened.** Plain language, no jargon.
2. **Explain why.** Brief context about the cause.
3. **Tell them what to do.** Installation commands, closest-match
   suggestions, fix commands. The error message itself is actionable.
4. **Present recovery options.** Always at least two choices. Use
   `AskUserQuestion` for structured choices with descriptions. Fall back
   to inline `(1)/(2)/(3)` only when the choice is embedded in a
   conversational flow where a structured UI would interrupt the tone.

## Common Error Patterns

| Error | Convention |
|-------|-----------|
| No spec found | Explain the situation, then present via `AskUserQuestion`: "Run /fctry:init to create one" vs. "Specify a different directory" |
| Invalid section alias | List available sections via `AskUserQuestion` with descriptions (see alias resolution in `references/alias-resolution.md`) |
| Empty arguments | Explain what's expected, then present options via `AskUserQuestion`: "Show available sections" vs. "Describe the change in natural language" |
| URL fetch failure | Try alternatives, then present options (see `agents/researcher.md`) |
| Missing tools | Show status and present install options via `AskUserQuestion` (see tool validation in `commands/init.md`) |
| Chunk failure during execute | Present via `AskUserQuestion`: "Flag for review and continue" / "Stop execution" / "Retry this chunk" |
| Workflow step skipped | Present via `AskUserQuestion`: "Run {missing step} now (recommended)" / "Skip (not recommended)" / "Abort this command" |
| File write covers spec section | Present via `AskUserQuestion`: "Run /fctry:evolve alias" / "Continue — I'll reconcile later" |
| Section not ready to execute | "Section N.N (alias) needs a spec update before building. Run /fctry:evolve alias first." |
| Ambiguous user response | Restate the options via `AskUserQuestion` and ask for clarification — never guess |
| Migration failure | Present via `AskUserQuestion`: "Retry" / "Move files manually" / "Continue with old layout" |
