# Tool Dependencies

These tools must be available for the skill to work at full capability.

## Required (Core)
- **File read/write** — Every agent needs this
- **ripgrep (rg)** — State Owner's primary search tool
- **Web search** — Researcher needs this for external exploration

## Required (Code Intelligence)
- **ast-grep (sg)** — State Owner's structural code search
- **tree-sitter-cli** — State Owner's AST parsing (bundled with ast-grep)

## Required (Research)
- **gh CLI** — Researcher uses this for GitHub repo exploration
- **Firecrawl MCP** — Researcher uses this for web content extraction
- **Context7 / DeepWiki** — Researcher uses this for library documentation

## Required (Visual)
- **Playwright MCP** — Visual Translator uses this for live site inspection
- **Chrome DevTools MCP** — Visual Translator uses this for CSS inspection

## Optional
- **GitHub MCP Server** — Alternative to gh CLI for richer GitHub integration
- **Deep Graph MCP** — Enhanced impact analysis for State Owner
