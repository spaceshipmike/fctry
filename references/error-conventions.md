# Error Conventions

Every error across all commands follows this pattern:

1. **State what happened.** Plain language, no jargon.
2. **Explain why.** Brief context about the cause.
3. **Present numbered options.** Always at least two choices for recovery.

## Common Error Patterns

| Error | Convention |
|-------|-----------|
| No spec found | "No spec found in this project. (1) Run `/fctry:init` to create one (2) Specify a different directory" |
| Invalid section alias | List available sections with numbers (see alias resolution in `references/alias-resolution.md`) |
| Empty arguments | Explain what's expected: "Usage: `/fctry:evolve <section or description>`. (1) Show available sections (2) Describe the change in natural language" |
| URL fetch failure | Try alternatives, then present options (see `agents/researcher.md`) |
| Missing tools | Show status and options (see tool validation in `commands/init.md`) |
| Chunk failure during execute | "(1) Flag for review and continue (2) Stop execution (3) Retry this chunk" |
| Ambiguous user response | Restate the options and ask for clarification — never guess |
