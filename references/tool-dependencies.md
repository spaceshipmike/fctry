# Tool Dependencies

These tools must be available for the skill to work at full capability.
Used by the tool validation step in `/fctry:init` and `/fctry:execute`.

## Required (Core)

| Tool | Used by | Check command | Install |
|------|---------|---------------|---------|
| File read/write | Every agent | Built into Claude Code | — |
| ripgrep (rg) | State Owner search | `which rg` | `brew install ripgrep` |
| Web search | Researcher | Built into Claude Code | — |
| Node.js | Spec viewer server | `which node` | `brew install node` |

## Required (Code Intelligence)

| Tool | Used by | Check command | Install |
|------|---------|---------------|---------|
| ast-grep (sg) | State Owner structural search | `which sg` | `brew install ast-grep` |

## Required (Research)

| Tool | Used by | Check command | Install |
|------|---------|---------------|---------|
| gh CLI | Researcher (GitHub repos) | `which gh` | `brew install gh` |
| Firecrawl MCP | Researcher (web extraction) | Check MCP config | See Firecrawl docs |
| Context7 / DeepWiki | Researcher (library docs) | Check MCP config | See provider docs |

## Required (Visual)

| Tool | Used by | Check command | Install |
|------|---------|---------------|---------|
| Playwright MCP | Visual Translator (live sites) | Check MCP config | See Playwright docs |
| Chrome DevTools MCP | Visual Translator (CSS) | Check MCP config | See provider docs |

## Optional

| Tool | Used by | Check command | Install |
|------|---------|---------------|---------|
| GitHub MCP Server | Richer GitHub integration | Check MCP config | See provider docs |

## Validation Behavior

**Which commands need which tools:**
- `/fctry:init` — Core + Code Intelligence (all others optional)
- `/fctry:evolve` — Core + Code Intelligence
- `/fctry:ref` — Core + Research (for URLs) or Visual (for screenshots)
- `/fctry:review` — Core + Code Intelligence
- `/fctry:execute` — Core + Code Intelligence
- `/fctry:view` — Core (Node.js)

Missing tools degrade capability but don't block commands (except where a
tool is the sole way to perform a task). Always tell the user what's limited.
