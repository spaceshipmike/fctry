# Factory Packed Output Style (FPOS) + Phase Goals — Comprehensive Spec (Claude Code Lens)

## 0) Purpose

This spec defines two tightly-coupled concepts that make Factory feel **coherent, self-directing, and token-efficient**:

1) **Phase Goals**: a meso-layer below project goals that sets the optimization target for “what to do next,” and provides narrative coherence for versioning/releases.

2) **FPOS (Factory Packed Output Style)**: a **plugin-ingestible transmission format** that minimizes token waste while preserving actionable fidelity. FPOS is how Factory “speaks” in a compressed, deterministic way.

Together, they create a loop:
`Phase Goals (what we optimize for) → Scoring (what next) → FPOS outputs (what we emit) → Reflect/Adopt (how we improve) → Release (how we narrate progress)`

---

## 1) Design Goals

### Primary
- **Experience coherence**: work feels like a guided arc, not a pile of tasks.
- **Deterministic machine parsing**: stable schema, predictable keys, plugin-first.
- **Token economy**: reduce transmission tokens without degrading decision quality.
- **Self-improvement loop**: logs → reflect → proposals → adopt → measurable improvement.

### Secondary
- **Claude Code-native workflows**: diffs, tests, commits, tags, releases, repo conventions.
- **Narrative versioning**: minor versions map to phase arcs; release notes tell a story.

### Non-goals
- Replacing PRDs/strategy docs.
- Long-form explanations in standard output (use `/expand`).
- Re-sending raw logs (plugin owns raw data).

---

## 2) Core Concepts

### 2.1 Goals Hierarchy (Intent Stack)

Factory maintains a strict hierarchy:

```
Vision
  └── Project Goals (3–5, long horizon)
        └── Phase Goals (1 primary active, optional 1 supporting)
              └── Epics (chunks of capability/hardening/integration)
                    └── Actions/Tasks (atomic steps)
```

**Invariant:** at most **one primary Phase Goal** is active.  
Optional: one supporting phase for required parallelism (e.g., “Hardening while Shipping”).

---

## 3) Phase Goals

### 3.1 What a Phase Goal Is
A Phase Goal is a **time-bounded “experience state”** that prescribes how work should feel and what it should optimize for.

It is not a feature list. It is a constraint that shapes priorities.

Examples (experience-first):
- “Recommendations feel inevitable, not random.”
- “Sessions close into clean artifacts without manual babysitting.”
- “Context is deterministic across runs.”
- “Version numbers tell a story.”

### 3.2 Required Fields (Phase Goal Schema)

```yaml
phase_goal:
  id: "PH-001"
  name: "Determinism & Coherence"
  intent: "How working in Factory should feel in this era (1 paragraph max)."
  optimization_target:
    primary: "determinism|quality|speed|ux|stability|integration|token_economy|narrative"
    metrics:
      - key: "context_miss_rate"
        direction: "down"
      - key: "repo_scan_scope_ratio"
        direction: "up"
  in_scope:
    - "What we will prioritize"
  out_of_scope:
    - "What we will not do even if tempting"
  success_signals:
    - "Observable evidence that phase is achieved"
  constraints:
    - "Hard rules for this phase (e.g., no repo-wide scans without scope)"
  version_arc:
    start: "v0.2.0"
    end: "v0.3.0"
  adoption_policy:
    auto_apply_risk: "low"     # what reflect/adopt can do automatically
```

### 3.3 Phase Types (Intent Modes)
Phase Goals should be categorized so Factory can reason consistently:

- **Capability**: add net-new user-facing ability
- **Hardening**: improve reliability/determinism/perf
- **Refactor**: restructure for clarity/maintainability
- **Integration**: make components work together end-to-end
- **Polish**: improve UX coherence and ergonomics

**Rule of thumb:** Factory should deliberately schedule **Hardening** and **Integration** phases, not just Capability phases.

### 3.4 Phase Goals as a Scoring Modifier (What to Work on Next)

Factory uses a priority score with Phase Goals as the dominant multiplier.

```pseudo
function score_candidate(candidate, phase_goal, project_goals):
  base = 0

  base += alignment(candidate, project_goals)             # strategic alignment
  base += phase_alignment(candidate, phase_goal) * Wp     # phase filter (dominant)
  base += dependency_readiness(candidate) * Wd
  base += risk_reduction(candidate) * Wr
  base += narrative_coherence(candidate, phase_goal) * Wn
  base -= distraction_penalty(candidate, phase_goal) * Wx

  # Token economy: penalize work that increases transmission without gains
  base -= token_cost_penalty(candidate) * Wt

  return base
```

#### Phase Alignment Heuristics (examples)
```pseudo
function phase_alignment(candidate, phase_goal):
  if candidate.violates(phase_goal.out_of_scope): return 0
  if candidate.enforces_constraint(phase_goal.constraints): return 1.0
  if candidate.moves_metric(phase_goal.optimization_target.metrics): return 0.8
  if candidate.is_unrelated_but_useful: return 0.2
  return 0.4
```

### 3.5 Phase Goals and Versioning
Each primary Phase Goal maps to a **minor version arc**:
- start at `vX.Y.0`
- end at `vX.(Y+1).0` when success signals are met

A phase completion triggers:
- minor version bump
- coherent release notes tied to the experience shift
- brief “architectural delta” summary

---

## 4) FPOS (Factory Packed Output Style)

### 4.1 What FPOS Is
FPOS is a **transmission format**: compressed, deterministic, plugin-first output.

- Internal reasoning can be verbose.
- External output must be concise and structured.

FPOS outputs are the canonical interchange between:
- Claude Code session
- plugin UI
- Factory’s own self-improvement loop

### 4.2 Transmission Modes
FPOS has explicit compression levels:

- `compression: low`  
  human-first; structured; minimal prose allowed
- `compression: medium`  
  structured; concise; almost no prose
- `compression: high`  
  plugin-first; no narrative; schema-only
- `compression: extreme`  
  diff-first; patch payloads + action list; minimal metadata

**Defaults**
- `/reflect` → `high`
- `/adopt` → `extreme`
- `/plan` → `medium`
- `/release` → `medium|high` depending on channel

---

## 5) Output Format (Canonical Envelope)

FPOS outputs **one** fenced block containing a single YAML-like document.

No additional narrative outside the block unless explicitly requested.

```yaml
fpos: "v1"

meta:
  ts: "YYYY-MM-DDTHH:MM:SS-0500"
  session_id: "opaque-id"
  command: "/reflect | /plan | /act | /adopt | /release | ..."
  compression: "low|medium|high|extreme"

  repo:
    root: "."
    branch: "main"
    commit: "optional"

  phase:
    id: "PH-001"
    name: "Determinism & Coherence"
    version_arc:
      start: "v0.2.0"
      end: "v0.3.0"

  inputs:
    log_ref:
      type: "marker|time"
      from: "CMD_END:<id>|timestamp"
      to: "now|timestamp"
    artifacts: ["optional refs"]

status:
  ok: true|false
  summary: "1-line"
  errors: ["optional"]

metrics:
  phase_alignment_score: 0-100
  friction_count: integer
  token_waste_estimate: "low|med|high"
  # optional: any tracked phase metrics
  tracked:
    - key: "context_miss_rate"
      value: "optional"
    - key: "repo_scan_scope_ratio"
      value: "optional"

actions: []     # atomic next steps for this session
findings: []    # structured observations + evidence refs
proposals: []   # system self-improvement candidates
patches: []     # optional; primary in extreme mode
release: {}     # only for /release
```

### 5.1 Formatting Rules (Hard Constraints)
- No restating the user prompt.
- No filler (“here’s what I found”).
- No re-embedding large context; use refs/IDs.
- Any recommendation must map to **actions** and/or **proposals**.
- Use short strings; IDs for linkage (`FND-002 → PRO-003 → PATCH-001`).

---

## 6) Schemas

### 6.1 `actions[]` (Atomic Next Steps)
```yaml
actions:
  - id: "ACT-001"
    type: "edit|run|create|delete|decide|verify"
    target: "file|dir|command|policy|hook|prompt|scoring|template"
    path: "optional filepath"
    cmd: "optional command string"
    summary: "short"
    refs: ["FND-002", "PRO-001"]
    risk: "low|med|high"
    effort: "S|M|L"
    priority: "P0|P1|P2|P3"
    acceptance:
      - "observable condition"
```

### 6.2 `findings[]` (Friction / Drift / Signals)
```yaml
findings:
  - id: "FND-001"
    category: "friction|drift|quality|efficiency|process|phase"
    pattern: "short name"
    impact: "low|med|high"
    evidence:
      - kind: "log_ref|file_ref|cmd_ref"
        ref: "opaque"
        note: "short"
    root_cause: "short"
    phase_relevance:
      aligns: true|false
      note: "short"
    recommendation_refs: ["PRO-001", "ACT-003"]
```

### 6.3 `proposals[]` (Factory Self-Improvement)
```yaml
proposals:
  - id: "PRO-001"
    type: "prompt_patch|config_delta|hook_rule|scoring_tweak|template_add|doc_add|phase_update"
    target:
      kind: "prompt|config|hook|scoring|template|doc|phase"
      name: "foreman_system_prompt|pre_scan_guard|..."
      path: "optional"
    change:
      mode: "append|replace|diff|set"
      payload_ref: "PATCH-001|inline"
    expected:
      phase_alignment: "low|med|high"
      quality: "low|med|high"
      tokens: "low|med|high"
      time: "low|med|high"
    risk: "low|med|high"
    priority: "P0|P1|P2|P3"
    rollback: "short"
    validation:
      - "run tests"
      - "simulate reflect on last 3 sessions"
```

### 6.4 `patches[]` (Diff Payloads)
```yaml
patches:
  - id: "PATCH-001"
    format: "unified-diff"
    apply: "git-apply|manual"
    files: ["pathA", "pathB"]
    diff: |
      --- a/pathA
      +++ b/pathA
      @@ ...
```

### 6.5 `release` (Phase-Coherent Release Notes)
```yaml
release:
  version: "v0.3.0"
  phase_id: "PH-001"
  headline: "experience shift in one line"
  highlights:
    - "user-visible outcome"
  deltas:
    - area: "orchestration"
      change: "short"
  migration:
    required: false
    steps: []
  validation:
    - "test suite green"
```

---

## 7) Boundary Markers (Since Last Command)

### 7.1 Marker Contract
Every Factory command should emit fenceposts into the session log:

```pseudo
function emit_marker(kind, payload):
  # kind: CMD_START | CMD_END | REFLECT_END | ADOPT_END
  # payload includes id, ts, command, status
  log.write({kind, payload})
```

### 7.2 “Since last command” Resolution
```pseudo
function resolve_log_window(now):
  if exists(last_marker("CMD_END")):
    return window(from=last_marker("CMD_END").ts, to=now)
  else if exists(last_marker("REFLECT_END")):
    return window(from=last_marker("REFLECT_END").ts, to=now)
  else:
    return window(from=now - DEFAULT_WINDOW, to=now)
```

---

## 8) Reflect / Adopt Loop (Self-Improvement)

### 8.1 `/reflect` (Generate Proposals)
Inputs:
- resolved log window
- current phase goal
- current factory config snapshot refs

Process:
```pseudo
function reflect(logs, phase_goal, config):
  events = parse_events(logs)
  frictions = detect_frictions(events)
  drifts = detect_phase_drift(events, phase_goal)
  patterns = generalize(frictions + drifts)

  proposals = []
  for pattern in patterns:
    proposals += map_to_factory_changes(pattern, config, phase_goal)

  rank(proposals, by = expected.phase_alignment + expected.quality + expected.tokens - risk)
  return fpos_document(findings, proposals, metrics)
```

Outputs (FPOS `high`):
- ranked findings
- ranked proposals
- top actions (optional)

### 8.2 `/adopt` (Apply Selected Proposals)
```pseudo
function adopt(selected_proposals, repo):
  patches = []
  actions = []
  for pro in selected_proposals:
    patch = materialize_patch(pro, repo)
    patches += patch
    actions += plan_apply_steps(patch)

  actions += validation_steps()
  return fpos_document(patches, actions)
```

Outputs (FPOS `extreme`):
- diffs + apply steps + validations

**Policy:** only auto-apply low-risk changes unless phase’s `adoption_policy` allows more.

---

## 9) Token Economy Enforcement (Output Style Rules)

### 9.1 Prose Budget
- `high/extreme`: prose only in `status.summary` and short `note` fields.
- Anything longer requires `/expand <id>`.

### 9.2 Reference-First Evidence
- never paste long logs; include `evidence.ref`.
- plugin can hydrate refs for UI display.

### 9.3 Delta-First Outputs
- prefer `patches[]` over reprinting files.
- prefer `config_delta` over full config dumps.

### 9.4 No Duplicate Context
- phase described once in `meta.phase`.
- repo described once in `meta.repo`.
- do not repeat constraints elsewhere—reference `PH-001.constraints`.

---

## 10) Plugin Integration Contract

### 10.1 Parsing
Plugin must:
- extract the single FPOS block
- parse YAML-like structure
- index objects by `id`
- render views:
  - Actions (checkbox list)
  - Findings (with evidence hydration)
  - Proposals (selectable for adopt)
  - Patches (diff viewer)

### 10.2 Hydration of Refs
```pseudo
function hydrate_evidence(ref):
  # plugin-owned: map opaque log/file refs to displayed excerpts
  return excerpt
```

### 10.3 Commands as UI Flows
- `/reflect` → show findings + proposals; allow multi-select proposals; CTA “Adopt Selected”
- `/adopt` → show patches + actions; CTA “Apply” (user controls actual apply)
- `/release` → show release artifact; CTA “Tag & Publish” steps

---

## 11) Comprehensive Output Style (The “Experience-Prescribing” Layer)

FPOS is the syntax. The **output style** is the policy of how content is shaped.

### 11.1 Output Style Principles
- **Compiled artifact tone**: outputs read like build outputs, not conversation.
- **Atomicity**: every item is individually actionable.
- **Traceability**: any item links to evidence or a parent cause.
- **Phase-first prioritization**: items are ranked by phase alignment.
- **Minimalism**: default to the smallest correct expression.

### 11.2 Output Style Controls
Factory supports explicit controls:

```pseudo
output_style:
  transmission: "fpos"
  compression: "high"
  include:
    findings: true
    proposals: true
    patches: false
  limits:
    max_actions: 10
    max_findings: 8
    max_proposals: 8
```

And adaptive behavior:
```pseudo
if estimated_tokens(output) > TOKEN_BUDGET:
  compression = "high"
  trim_to_limits()
  move_detail_to_expandables()
```

---

## 12) `/expand` (Detail on Demand)

To prevent verbose default outputs, FPOS supports expandable detail.

```pseudo
function expand(id):
  obj = lookup_by_id(id)
  return detailed_view(obj)  # may include hydrated evidence or richer rationale
```

Plugin should provide expand affordances for:
- findings
- proposals
- patches
- actions

---

## 13) Example: `/reflect` Output (FPOS High)

```yaml
fpos: "v1"
meta:
  ts: "2026-02-19T10:33:12-0500"
  session_id: "S-9f2a"
  command: "/reflect"
  compression: "high"
  repo: { root: ".", branch: "main" }
  phase:
    id: "PH-001"
    name: "Determinism & Coherence"
    version_arc: { start: "v0.2.0", end: "v0.3.0" }
  inputs:
    log_ref: { type: "marker", from: "CMD_END:041", to: "now" }

status:
  ok: true
  summary: "4 frictions → 3 low-risk proposals, phase alignment 84"

metrics:
  phase_alignment_score: 84
  friction_count: 4
  token_waste_estimate: "med"

findings:
  - id: "FND-001"
    category: "phase"
    pattern: "Repo-wide scan without scope"
    impact: "high"
    evidence: [{ kind: "log_ref", ref: "LOG:aa12", note: "scan initiated before path scope" }]
    root_cause: "No pre-scan guard"
    phase_relevance: { aligns: false, note: "violates constraints: scoped-first" }
    recommendation_refs: ["PRO-001"]

proposals:
  - id: "PRO-001"
    type: "hook_rule"
    target: { kind: "hook", name: "pre_scan_guard" }
    change: { mode: "set", payload_ref: "inline" }
    expected: { phase_alignment: "high", quality: "med", tokens: "high", time: "med" }
    risk: "low"
    priority: "P0"
    rollback: "disable hook"
    validation: ["simulate 3 sessions", "ensure scans require scope"]

actions:
  - id: "ACT-001"
    type: "decide"
    target: "policy"
    summary: "Adopt PRO-001 pre_scan_guard"
    refs: ["PRO-001"]
    risk: "low"
    effort: "S"
    priority: "P0"
    acceptance: ["hook enabled in config"]
```

---

## 14) Implementation Notes (Claude Code Lens)

### 14.1 Where this lives in repo
Suggested locations (adapt to your structure):
- `factory/phases/*.yaml` — phase goal definitions
- `factory/output/fpos_schema.md` — schema docs
- `factory/commands/reflect.md` — command contract
- `factory/config/output_style.yaml` — defaults, limits, budgets
- `factory/hooks/pre_scan_guard.*` — enforcement hooks
- `factory/scoring/*.md|*.yaml` — scoring weights and rules

### 14.2 Minimal Viable Rollout
1) Add Phase Goal files + loader
2) Add FPOS envelope generation
3) Implement `/reflect` output in FPOS high
4) Add `/adopt` diff-first output (extreme)
5) Add pre-scan guard + constraints enforcement
6) Add `/release` phase coherent release artifact

---

## 15) Acceptance Criteria (Spec Complete When)

- Phase Goal definitions exist and can be activated (primary + optional supporting).
- Factory prioritization uses phase alignment as dominant modifier.
- `/reflect` emits valid FPOS `high` payload with findings + proposals.
- `/adopt` emits valid FPOS `extreme` payload with diffs + apply steps.
- Releases can be generated as phase-coherent artifacts linked to version arcs.
- Plugin can parse, render, select proposals, and hydrate evidence refs.
- Default outputs are measurably smaller (token economy improves) without loss of actionability.