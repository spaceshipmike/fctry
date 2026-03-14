# Package Registry Map

Maps tech stack entries (from spec frontmatter `tech-stack` array) to their
package registries for stack-aware source discovery. Used by the automated
reference discovery pipeline when searching for packages solving project gaps.

| Tech / Language | Registry / Search |
|----------------|-------------------|
| JavaScript/TypeScript | npmjs.com (npm CLI, Yarn/PNPM surface same registry) |
| Python | PyPI via pypi.org and `pip` |
| Rust | crates.io (backed by index.crates.io) |
| Ruby | RubyGems.org |
| PHP | Packagist.org (Composer) |
| Java / JVM | Maven Central, plus JCenter / JitPack mirrors |
| .NET | NuGet.org |
| Go | pkg.go.dev + `go list` against public modules |
| Haskell | Hackage |
| R | CRAN (and Bioconductor for bio) |
| Elixir/Erlang | Hex.pm |
| Dart/Flutter | pub.dev |
| Swift | Swift Package Index (swiftpackageindex.com) |
| C/C++ | vcpkg, Conan Center, Buckaroo; also language-agnostic vcpkg ports |

## Search Patterns

Each registry has different search APIs/CLIs:

- **npm:** `npm search <query>` or `https://registry.npmjs.org/-/v1/search?text=<query>`
- **PyPI:** `https://pypi.org/search/?q=<query>` or `pip search` (deprecated, use web)
- **crates.io:** `https://crates.io/api/v1/crates?q=<query>`
- **Go:** `https://pkg.go.dev/search?q=<query>`
- **RubyGems:** `gem search <query>` or `https://rubygems.org/api/v1/search.json?query=<query>`
- **Swift:** `https://swiftpackageindex.com/api/search?query=<query>`

For registries without CLI search, use web fetch via MCP or `curl`.

## Usage

The Researcher reads `tech-stack` from spec frontmatter, maps to registries
above, and constructs search queries combining the registry with the gap
description. Example: tech-stack includes "Node.js", gap is "drag-and-drop
kanban" → search npm for "kanban drag drop."
