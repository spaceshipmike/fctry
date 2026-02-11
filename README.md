# fctry — Software Factory

A Claude Code plugin for fully autonomous software development. Produces experience-first specifications ([NLSpec v2](references/template.md)), then drives builds from them.

No human touches or reviews the code. The spec and scenarios are the entire contract.

## Install

In Claude Code, add the marketplace and install the plugin:

```
/plugin marketplace add spaceshipmike/fctry
```

Then select the `fctry` plugin from the marketplace to install it, and restart Claude Code.

### Auto-Update

By default, third-party marketplace plugins don't auto-update. To enable:

1. Open `/plugin` → **Marketplaces** tab
2. Find `fctry` and enable auto-update

Once enabled, updates pull automatically on session start when new commits are pushed. To force an immediate update:

```
/plugin marketplace update fctry
```

## Commands

| Command | What It Does |
|---------|-------------|
| `/fctry:init` | Create a new spec (greenfield or existing project) |
| `/fctry:evolve` | Add features or make changes to an existing spec |
| `/fctry:ref` | Incorporate external references (URLs, screenshots, designs) |
| `/fctry:review` | Audit spec vs. current codebase — find drift and gaps |
| `/fctry:execute` | Build from the spec — assess, plan, implement |
| `/fctry:view` | Start the spec viewer (live browser preview) |
| `/fctry:stop` | Stop the spec viewer server |

## Quick Start

```
> /fctry:init my-project
```

The system will:
1. Scan and classify your project (greenfield or existing)
2. Interview you about the experience you want to create
3. Generate `my-project-spec.md` (the specification)
4. Generate `my-project-scenarios.md` (the holdout validation set)

When ready to build:

```
> /fctry:execute
```

The Executor proposes a build plan. You approve. It builds.

## How It Works

Seven specialized agents orchestrate through a handoff protocol:

1. **State Owner** scans the project first (always)
2. **Domain agent** does the work (Interviewer, Researcher, or Visual Translator)
3. **Scenario Crafter** writes/updates the holdout scenario set
4. **Spec Writer** synthesizes everything into the spec (always last)

The **Executor** bridges spec to code during `/fctry:execute`.

## Philosophy

- **Experience language only.** Specs describe what users see, do, and feel. Never databases, APIs, or code patterns.
- **The agent decides implementation.** The coding agent has full authority over tech choices, architecture, and data model.
- **Scenarios are holdout sets.** Stored separately, evaluated by LLM-as-judge, measuring satisfaction not pass/fail.

## Tool Dependencies

Core tools (file read/write, ripgrep, ast-grep) are required. Research tools (gh CLI, Firecrawl MCP, Context7/DeepWiki) and visual tools (Playwright MCP, Chrome DevTools MCP) are needed for full capability. See [references/tool-dependencies.md](references/tool-dependencies.md).

## License

MIT
