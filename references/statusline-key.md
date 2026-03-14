# Status Line Key

The fctry status line displays two rows of information below the Claude Code prompt.
Icons are Material Design Icons (Supplementary PUA-A range) — requires a Nerd Font in your terminal.

## Layout

```
project-name 0.43.1 │ 󰘬 main │ 󰈙 3.63 │ 󱎖 42%
execute │ 󰐊 ●●●○○○○○ 3+1/8 │ Core Flow (2.2) │ 󰄬 ●●●●●●○○○○ 12/20 │ 󰕥 ●●●●●○○○○ 5/9 │ 󰀦 2 │ 󰅂 next step
```

## Row 1 — Project Identity

| Icon | Name | Meaning |
|------|------|---------|
| | | Project directory name and app version (from config.json or git tags) |
| 󰘬 | source-branch | Git branch (or short commit hash if detached HEAD) |
| 󰈙 | file-document | Spec version (from config.json version registry) |
| | | Spec status — `draft` or `stable` (only shown when not "active") |
| 󱎖 | circle-half-full | Context window usage (percentage of auto-compact threshold) |

### Context colors

| Color | Meaning |
|-------|---------|
| Green | Under 70% — plenty of room |
| Yellow | 70–89% — getting full |
| Red | 90%+ — near auto-compact |

## Row 2 — Activity and Progress

| Icon | Name | Meaning |
|------|------|---------|
| | | Active fctry command (cyan text — init, evolve, ref, review, execute) |
| 󰐊 | play | Build chunk progress: dot-bar + `completed+active/total` |
| | | Retry attempt number `(r2)` shown when a chunk is retrying |
| 󰅖 | close | Failed chunks (red, appended to chunk progress) |
| | | Active section shown as feature name and number (magenta text) |
| 󰄬 | check | Scenario score: dot-bar + `satisfied/total` |
| 󰕥 | shield-check | Section readiness: dot-bar + `ready/total` (aligned + ready-to-execute + satisfied + deferred) |
| 󰀦 | alert | Untracked changes — code edits outside fctry commands that touch spec-covered files |
| 󰜷 | arrow-up-bold | Plugin upgrade was applied this session |
| 󰅂 | chevron-right | Suggested next step (auto-derived when idle, agent-set during commands) |

### Visual dot-bar progress

Ratios (scenarios, readiness, chunks) show filled/empty dot bars alongside numeric fractions:
`●●●●●○○○` — each `●` is a completed/ready item, each `○` is remaining. The visual weight
communicates the ratio at a glance. When totals exceed 10, dots are grouped (each dot
represents multiple items) to keep bar width consistent.

### Score and readiness colors

| Color | Meaning |
|-------|---------|
| Green | 80%+ satisfied or ready |
| Yellow | 50–79% |
| Red | Under 50% |
| Dim | No data yet |

## Separators

`│` (dim) separates each segment. Segments only appear when they have data — the line stays clean when idle.

## Examples

**Idle project, no active command:**
```
myapp 1.2.0 │ 󰘬 main │ 󰈙 2.1 │ 󱎖 15%
󰅂 /fctry:execute to build 3 specced sections
```

**Mid-build with chunk progress:**
```
myapp 1.2.0 │ 󰘬 feature │ 󰈙 2.1 │ 󱎖 67%
execute │ 󰐊 ●●●●○○○○ 4+1/8 │ Auth Flow (2.3) │ 󰄬 ●●●●○○○○○○ 8/20 │ 󰕥 ●●●○○○○○○ 3/9
```

**Review scan in progress:**
```
myapp 1.2.0 │ 󰘬 main │ 󰈙 2.1 │ 󱎖 45%
review | scanning 5/12
```

**Untracked changes detected:**
```
myapp 1.2.0 │ 󰘬 main │ 󰈙 2.1 │ 󱎖 22%
󰀦 3 │ 󰅂 /fctry:evolve to update spec with recent changes
```
