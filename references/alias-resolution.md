# Alias Resolution Protocol

Standard protocol for resolving section arguments across commands.

## Standard Resolution (5 Steps)

When arguments are provided, resolve them in this order:

1. **Find the spec.** Look for `.fctry/spec.md` (or legacy `{project-name}-spec.md` at root).
   If no spec exists, tell the user: "No spec found. Run `/fctry:init` first."
2. **Read the Table of Contents.** The TOC lists every section with its number
   and alias, e.g., `- 2.2 [Core Flow](#22-core-flow) \`#core-flow\``
3. **Try to match the argument** against known aliases and numbers:
   - Strip leading `#` if present (`#core-flow` → `core-flow`)
   - Match against aliases (exact, case-insensitive): `core-flow`
   - Match against section numbers (exact): `2.2`
   - If a match is found → **targeted mode**. Pass the resolved section
     (alias, number, and heading text) to downstream agents.
   - If no match is found → **natural language mode**. Treat the entire
     argument string as a description of the change.
4. **On ambiguous match** (e.g., argument matches multiple aliases), list
   the matches with numbers and ask the user to clarify.
5. **On failed resolution** (argument looks like an alias or number but
   doesn't match anything), list available sections:
   ```
   Section "core-flows" not found. Available sections:
   (1) 2.1 #first-run — First Run Experience
   (2) 2.2 #core-flow — Core Flow
   (3) 2.3 #multi-session — Multi-Session Interviews
   ...
   ```

## Targeted Mode

When a section target is resolved:
- **State Owner** scopes its briefing to that section and its dependencies
- **Domain agents** focus on that section's experience
- **Spec Writer** updates only the targeted section (and any sections that
  must change as a consequence)
- All agents reference the target as `#alias` (N.N) in their output

## Natural Language Mode

When no section target is provided, treat the argument as a description of
the change and proceed with the full workflow. The State Owner assesses
which sections are relevant and lists them in the briefing.

## Per-Command Adaptations

### `/fctry:ref`

Parse arguments left to right. The reference (URL, file path, or screenshot)
is always the **last argument**. Everything before it is a potential section
target. If no section target precedes the reference → open mode (system
infers relevance).

### `/fctry:execute`

Try section resolution first (steps 1-5 above). If no section match is
found, fall back to **scenario matching**: match the argument against
scenario names in `.fctry/scenarios.md` (fuzzy: substring match
is fine). If neither matches, list available sections and scenarios as
numbered options.

Also supports `--review` flag for assessment-only mode (no build plan).

### `/fctry:review`

Uses the standard 5-step protocol. When targeted, the State Owner scopes
its scan to the target section and its dependency neighborhood.
