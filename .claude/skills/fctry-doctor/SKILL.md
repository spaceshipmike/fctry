---
name: fctry:doctor
description: >
  Validate fctry plugin structural integrity. Use when the user says "validate plugin",
  "check plugin", "plugin health", "doctor", "run doctor", or invokes /fctry:doctor.
  Also use proactively after making structural changes to agents, commands, or references.
---

# Plugin Doctor

Quick structural validation of the fctry plugin. Reports ONLY problems found — silence means passing.

## Checks

Run all checks below. Collect all problems, then report them together at the end. If no problems found, say "All checks passed."

### 1. Required Files Exist

Verify these files exist relative to the plugin root (`$CLAUDE_PLUGIN_ROOT` or the repo root):

**Infrastructure:**
- `.claude-plugin/plugin.json`
- `SKILL.md`
- `CLAUDE.md`
- `hooks/hooks.json`

**Agents** (listed in `SKILL.md` agent table):
- `agents/state-owner.md`
- `agents/interviewer.md`
- `agents/researcher.md`
- `agents/visual-translator.md`
- `agents/spec-writer.md`
- `agents/scenario-crafter.md`
- `agents/executor.md`
- `agents/observer.md`

**Commands** (listed in `SKILL.md` command table):
- `commands/init.md`
- `commands/evolve.md`
- `commands/ref.md`
- `commands/review.md`
- `commands/execute.md`
- `commands/view.md`
- `commands/stop.md`

**Key References:**
- `references/template.md`
- `references/tool-dependencies.md`
- `references/shared-concepts.md`
- `references/state-protocol.md`
- `references/alias-resolution.md`
- `references/error-conventions.md`
- `references/claudemd-guide.md`

### 2. Version Consistency

Read the version from these three locations and confirm they match:
- `.claude-plugin/plugin.json` → `version` field
- `.fctry/spec.md` → `plugin-version` in YAML frontmatter (if the file exists)
- `.fctry/config.json` → `versions.external.current` (if the file exists)

Report any mismatches.

### 3. Agent Frontmatter

For each agent file in `agents/*.md`, verify the YAML frontmatter contains:
- `name` — must match the filename (without `.md`)
- `description` — must be present and non-empty
- `model` — must be one of: `opus`, `sonnet`, `haiku`

Report any agents with missing or invalid frontmatter fields.

### 4. hooks.json Structure

Read `hooks/hooks.json` and verify:
- Valid JSON
- Has `hooks` top-level key
- Contains `SessionStart`, `UserPromptSubmit`, and `PostToolUse` arrays
- Every hook entry has `type: "command"` and a non-empty `command` string
- Every command that references a file path (not inline `node -e`) points to a file that exists

### 5. SKILL.md Routing Tables

Read `SKILL.md` and verify:
- Every agent listed in the Agents table has a corresponding file in `agents/`
- Every command listed in the Commands table has a corresponding file in `commands/`
- The `Reference` column paths resolve to actual files

### 6. Cross-Reference Spot Check

Pick 3 agent files at random. For each, check that any `backtick` file references in the body (e.g., `references/shared-concepts.md`, `commands/execute.md`) resolve to existing files.

## Output

Report ONLY problems. Format:

```
**Problems found:**

1. [CHECK NAME] — description of problem
2. [CHECK NAME] — description of problem
```

If no problems: "All checks passed."
