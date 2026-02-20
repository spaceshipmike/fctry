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

## Required (Spec Index)

| Tool | Used by | Check command | Install |
|------|---------|---------------|---------|
| better-sqlite3 | Spec index cache (`.fctry/spec.db`) | Auto-installed with spec-index module | `npm install` in `src/spec-index/` |

The spec index is auto-installed on first use. If `better-sqlite3` is not
available (native build fails), agents fall back to reading the full spec
file directly — no functionality is lost, only performance.

## Optional

| Tool | Used by | Check command | Install |
|------|---------|---------------|---------|
| GitHub MCP Server | Richer GitHub integration | Check MCP config | See provider docs |

## Optional (Observer)

| Tool | Used by | Check command | Install |
|------|---------|---------------|---------|
| Peekaboo (macOS screen capture) | Observer system-wide verification | `which peekaboo` | See [Peekaboo docs](https://github.com/steipete/Peekaboo) |
| Rodney (headless Chrome) | Observer browser verification | `which rodney` | `brew install simonw/tools/rodney` |
| Surf (computed styles) | Observer style/network inspection | `which surf` | `npm install -g @nicobailon/surf-cli` |
| Showboat (verification docs) | Observer audit trails | `which showboat` | `brew install simonw/tools/showboat` |

Observer tools enable four degradation levels:
- **System-wide** (Peekaboo + browser tools + viewer API) — native app windows, terminal UIs, system dialogs, browser screenshots, element checks, style inspection, API queries, audit trails
- **Full** (browser tools + viewer API) — browser screenshots, element checks, style inspection, API queries, audit trails
- **Reduced** (viewer API + file reads) — API status checks, state file verification, no visual checks
- **Minimal** (file reads only) — file existence checks, configuration validation

Missing Observer tools degrade verification fidelity but never block builds.

## Validation Behavior

**Which commands need which tools:**
- `/fctry:init` — Core + Code Intelligence (all others optional)
- `/fctry:evolve` — Core + Code Intelligence
- `/fctry:ref` — Core + Research (for URLs) or Visual (for screenshots)
- `/fctry:review` — Core + Code Intelligence
- `/fctry:execute` — Core + Code Intelligence + Observer (optional, degrades gracefully)
- `/fctry:view` — Core (Node.js)

Missing tools degrade capability but don't block commands (except where a
tool is the sole way to perform a task). Always tell the user what's limited.
