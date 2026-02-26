import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { watch } from "chokidar";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync, readdirSync, readFileSync, unlinkSync, realpathSync } from "fs";
import { resolve, dirname, basename, join } from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { homedir } from "os";
import open from "open";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use realpathSync.native for case-insensitive filesystem normalization (macOS).
// Regular realpathSync preserves input casing; native returns on-disk casing.
function canonicalize(p) {
  try { return realpathSync.native(p); } catch { return resolve(p); }
}

const pluginRoot = canonicalize(resolve(__dirname, "../.."));

// Plugin version — used for upgrade status detection on project cards
let pluginVersion = null;
try {
  const pj = JSON.parse(readFileSync(resolve(pluginRoot, ".claude-plugin", "plugin.json"), "utf-8"));
  pluginVersion = pj.version || null;
} catch {}

// --- Configuration ---

const DEFAULT_PORT = 3850;
const MAX_PORT_ATTEMPTS = 10;
const EVENT_BUFFER_MAX = 500;
const noOpen = process.argv.includes("--no-open");

// Global paths — shared across all projects
const FCTRY_HOME = resolve(homedir(), ".fctry");
const globalPidPath = resolve(FCTRY_HOME, "viewer.pid");
const globalPortPath = resolve(FCTRY_HOME, "viewer.port.json");
const projectsRegistryPath = resolve(FCTRY_HOME, "projects.json");
const globalPriorityPath = resolve(FCTRY_HOME, "priority.json");
const globalMemoryPath = resolve(FCTRY_HOME, "memory.md");
let globalMemoryWatcher = null;

// --- Utility ---

function findSpecFile(dir) {
  const fctrySpec = resolve(dir, ".fctry", "spec.md");
  if (existsSync(fctrySpec)) return { path: fctrySpec, legacy: false };
  const entries = existsSync(dir) ? readdirSync(dir) : [];
  const legacy = entries.find((f) => f.endsWith("-spec.md"));
  if (legacy) return { path: resolve(dir, legacy), legacy: true };
  return null;
}

function extractFrontmatter(specContent) {
  // Code-fenced YAML (NLSpec v2): ```yaml\n---\n...\n---\n``` (tolerates content after ---)
  const cfMatch = specContent.match(/```ya?ml\s*\n---\s*\n([\s\S]*?)\n---\s*\n[\s\S]*?```/);
  if (cfMatch) return cfMatch[1];
  // Raw YAML: ---\n...\n---
  const rawMatch = specContent.match(/^---\s*\n([\s\S]*?)\n---/);
  if (rawMatch) return rawMatch[1];
  return null;
}

function extractProjectName(specContent, fallbackDir) {
  const fm = extractFrontmatter(specContent);
  if (fm) {
    const titleMatch = fm.match(/^title:\s*(.+)$/m);
    if (titleMatch) return titleMatch[1].trim();
  }
  const h1Match = specContent.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  return basename(fallbackDir);
}

function extractSpecStatus(specContent) {
  const fm = extractFrontmatter(specContent);
  if (fm) {
    const statusMatch = fm.match(/^status:\s*(\w+)/m);
    if (statusMatch) return statusMatch[1].trim();
  }
  return null;
}

function readProjectColor(projectDir) {
  try {
    const configPath = resolve(projectDir, ".fctry", "config.json");
    const raw = readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw);
    return config.color || null;
  } catch {
    return null;
  }
}

function extractSynopsisShort(specContent) {
  const fm = extractFrontmatter(specContent);
  if (fm) {
    const match = fm.match(/^\s+short:\s*"([^"]+)"/m);
    if (match) return match[1];
    const matchSingle = fm.match(/^\s+short:\s*'([^']+)'/m);
    if (matchSingle) return matchSingle[1];
  }
  return null;
}

// --- Project Registry ---

const projects = new Map();
let activeProjectPath = null;

async function loadProjectsRegistry() {
  try {
    const raw = await readFile(projectsRegistryPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveProjectsRegistry() {
  const entries = [];
  for (const [path, proj] of projects) {
    entries.push({ path, name: proj.name, lastActivity: proj.lastActivity });
  }
  await mkdir(FCTRY_HOME, { recursive: true });
  await writeFile(projectsRegistryPath, JSON.stringify(entries, null, 2));
}

async function registerProject(projectDir) {
  let resolvedDir = canonicalize(resolve(projectDir));

  // Already registered — update activity timestamp and spec status
  if (projects.has(resolvedDir)) {
    const proj = projects.get(resolvedDir);
    proj.lastActivity = new Date().toISOString();
    try {
      const specContent = await readFile(proj.specPath, "utf-8");
      proj.specStatus = extractSpecStatus(specContent);
    } catch {}
    activeProjectPath = resolvedDir;
    await saveProjectsRegistry();
    return proj;
  }

  const specResult = findSpecFile(resolvedDir);
  if (!specResult) return null;

  // Extract project name and status from spec frontmatter
  let name = basename(resolvedDir);
  let specStatus = null;
  try {
    const specContent = await readFile(specResult.path, "utf-8");
    name = extractProjectName(specContent, resolvedDir);
    specStatus = extractSpecStatus(specContent);
  } catch {}

  const accentColor = readProjectColor(resolvedDir);
  const fctryDir = resolve(resolvedDir, ".fctry");
  const proj = {
    path: resolvedDir,
    name,
    specStatus,
    accentColor,
    fctryDir,
    specPath: specResult.path,
    changelogPath: specResult.legacy
      ? resolve(resolvedDir, readdirSync(resolvedDir).find((f) => f.endsWith("-changelog.md")) || "changelog.md")
      : resolve(fctryDir, "changelog.md"),
    statePath: resolve(fctryDir, "state.json"),
    inboxPath: resolve(fctryDir, "inbox.json"),
    lessonsPath: resolve(fctryDir, "lessons.md"),
    lastActivity: new Date().toISOString(),
    watchers: {},
    eventBuffer: [],
    eventSeq: 0,
    clients: new Set(),
  };

  projects.set(resolvedDir, proj);
  activeProjectPath = resolvedDir;
  setupWatchers(proj);
  await saveProjectsRegistry();
  broadcastGlobal({ type: "projects-update", projects: getProjectList() });

  console.log(`Registered project: ${name} (${resolvedDir})`);
  return proj;
}

function unregisterProject(projectDir) {
  const resolvedDir = canonicalize(resolve(projectDir));
  const proj = projects.get(resolvedDir);
  if (!proj) return false;

  for (const w of Object.values(proj.watchers)) {
    w.close().catch(() => {});
  }
  projects.delete(resolvedDir);

  if (activeProjectPath === resolvedDir) {
    const remaining = [...projects.keys()];
    activeProjectPath = remaining.length > 0 ? remaining[remaining.length - 1] : null;
  }

  broadcastGlobal({ type: "projects-update", projects: getProjectList() });
  saveProjectsRegistry().catch(() => {});
  return true;
}

function getProjectList() {
  return [...projects.values()].map((p) => ({
    path: p.path,
    name: p.name,
    specStatus: p.specStatus || null,
    accentColor: p.accentColor || null,
    lastActivity: p.lastActivity,
    active: p.path === activeProjectPath,
  }));
}

function resolveProject(projectRef) {
  if (!projectRef) return projects.get(activeProjectPath) || null;
  if (projects.has(projectRef)) return projects.get(projectRef);
  let resolved = canonicalize(resolve(projectRef));
  if (projects.has(resolved)) return projects.get(resolved);
  for (const proj of projects.values()) {
    if (proj.name === projectRef) return proj;
  }
  return null;
}

// --- File Watchers (per-project) ---

function setupWatchers(proj) {
  // Spec file
  let specDebounce = null;
  proj.watchers.spec = watch(proj.specPath, { ignoreInitial: true });
  proj.watchers.spec.on("change", () => {
    clearTimeout(specDebounce);
    specDebounce = setTimeout(async () => {
      try {
        const content = await readFile(proj.specPath, "utf-8");
        broadcastToProject(proj, { type: "spec-update", content, timestamp: Date.now() });
      } catch {}
    }, 300);
  });

  // Changelog
  let changelogDebounce = null;
  proj.watchers.changelog = watch(proj.changelogPath, { ignoreInitial: true });
  proj.watchers.changelog.on("change", () => {
    clearTimeout(changelogDebounce);
    changelogDebounce = setTimeout(async () => {
      try {
        const content = await readFile(proj.changelogPath, "utf-8");
        broadcastToProject(proj, { type: "changelog-update", content, timestamp: Date.now() });
      } catch {}
    }, 300);
  });
  proj.watchers.changelog.on("add", async () => {
    try {
      const content = await readFile(proj.changelogPath, "utf-8");
      broadcastToProject(proj, { type: "changelog-update", content, timestamp: Date.now() });
    } catch {}
  });

  // State file
  if (existsSync(proj.fctryDir)) {
    proj.watchers.state = watch(proj.statePath, { ignoreInitial: true, disableGlobbing: true });
    proj.watchers.state.on("change", async () => {
      try {
        const raw = await readFile(proj.statePath, "utf-8");
        const state = JSON.parse(raw);
        broadcastToProject(proj, { type: "viewer-state", ...state });
      } catch {}
    });

    // Inbox file
    proj.watchers.inbox = watch(proj.inboxPath, { ignoreInitial: true, disableGlobbing: true });
    const broadcastInbox = async () => {
      try {
        const items = await readProjectInbox(proj);
        broadcastToProject(proj, { type: "inbox-update", items });
      } catch {}
    };
    proj.watchers.inbox.on("change", broadcastInbox);
    proj.watchers.inbox.on("add", broadcastInbox);

    // Lessons file
    proj.watchers.lessons = watch(proj.lessonsPath, { ignoreInitial: true, disableGlobbing: true });
    const broadcastLessons = async () => {
      try {
        const content = await readFile(proj.lessonsPath, "utf-8");
        broadcastToProject(proj, { type: "lessons-update", content, timestamp: Date.now() });
      } catch {}
    };
    proj.watchers.lessons.on("change", broadcastLessons);
    proj.watchers.lessons.on("add", broadcastLessons);
  }
}

// --- Express + HTTP Server ---

const app = express();
const server = createServer(app);

app.use(express.json());
app.use("/viewer", express.static(resolve(__dirname, "client"), { etag: false, maxAge: 0, lastModified: false }));

// --- Project API ---

app.get("/api/projects", (req, res) => {
  res.json(getProjectList());
});

app.post("/api/projects", async (req, res) => {
  const { path: projectPath } = req.body || {};
  if (!projectPath) {
    return res.status(400).json({ error: "path is required" });
  }
  const proj = await registerProject(projectPath);
  if (!proj) {
    return res.status(400).json({ error: `No spec found in ${projectPath}` });
  }
  res.status(201).json({ path: proj.path, name: proj.name, lastActivity: proj.lastActivity, active: true });
});

app.post("/api/projects/active", (req, res) => {
  const { path: projectPath } = req.body || {};
  const proj = resolveProject(projectPath);
  if (!proj) {
    return res.status(404).json({ error: "Project not found" });
  }
  activeProjectPath = proj.path;
  proj.lastActivity = new Date().toISOString();
  saveProjectsRegistry().catch(() => {});
  broadcastGlobal({ type: "projects-update", projects: getProjectList() });
  res.json({ ok: true, active: proj.path });
});

// --- Content Routes (all accept ?project= param) ---

app.get("/spec.md", async (req, res) => {
  const proj = resolveProject(req.query.project);
  if (!proj) return res.status(404).send("No active project");
  try {
    const content = await readFile(proj.specPath, "utf-8");
    res.type("text/markdown").send(content);
  } catch {
    res.status(404).send("Spec file not found");
  }
});

app.get("/changelog.md", async (req, res) => {
  const proj = resolveProject(req.query.project);
  if (!proj) return res.status(404).send("No active project");
  try {
    const content = await readFile(proj.changelogPath, "utf-8");
    res.type("text/markdown").send(content);
  } catch {
    res.type("text/markdown").send("_No changelog yet._");
  }
});

app.get("/lessons.md", async (req, res) => {
  const proj = resolveProject(req.query.project);
  if (!proj) return res.status(404).send("No active project");
  try {
    const content = await readFile(proj.lessonsPath, "utf-8");
    res.type("text/markdown").send(content);
  } catch {
    res.type("text/markdown").send("");
  }
});

// --- Global Memory API ---

app.get("/api/memory", async (req, res) => {
  try {
    const content = await readFile(globalMemoryPath, "utf-8");
    res.type("text/markdown").send(content);
  } catch {
    res.type("text/markdown").send("");
  }
});

app.put("/api/memory", async (req, res) => {
  const { content } = req.body || {};
  if (typeof content !== "string") return res.status(400).json({ error: "content is required" });
  try {
    await mkdir(FCTRY_HOME, { recursive: true });
    await writeFile(globalMemoryPath, content, "utf-8");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/memory/entry", async (req, res) => {
  const { timestamp, type } = req.body || {};
  if (!timestamp || !type) return res.status(400).json({ error: "timestamp and type are required" });
  try {
    let content = "";
    try { content = await readFile(globalMemoryPath, "utf-8"); } catch { return res.json({ ok: true }); }
    // Split on entry headers and remove the matching entry
    const entryRegex = /^### .+/gm;
    const positions = [];
    let match;
    while ((match = entryRegex.exec(content)) !== null) {
      positions.push(match.index);
    }
    if (positions.length === 0) return res.json({ ok: true });
    let removed = false;
    const entries = [];
    for (let i = 0; i < positions.length; i++) {
      const start = positions[i];
      const end = i + 1 < positions.length ? positions[i + 1] : content.length;
      const entry = content.slice(start, end);
      // Match by timestamp and type in the header line
      if (!removed && entry.includes(timestamp) && entry.includes(type)) {
        removed = true; // skip this entry
      } else {
        entries.push(entry);
      }
    }
    const preamble = positions.length > 0 ? content.slice(0, positions[0]) : "";
    const newContent = preamble + entries.join("");
    await writeFile(globalMemoryPath, newContent, "utf-8");
    res.json({ ok: true, removed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const assessScript = resolve(__dirname, "../spec-index/assess-readiness.js");

/**
 * Read readiness from state.json (agent-authoritative source).
 * Returns { summary, sections } if sectionReadiness exists, null otherwise.
 */
async function readReadinessFromState(proj) {
  try {
    const raw = await readFile(proj.statePath, "utf-8");
    const state = JSON.parse(raw);
    if (state.sectionReadiness && Object.keys(state.sectionReadiness).length > 0) {
      // Build sections array from the per-section map
      const sections = Object.entries(state.sectionReadiness).map(([alias, readiness]) => ({
        alias,
        readiness,
      }));
      // Use readinessSummary if present, otherwise compute from sectionReadiness
      let summary = state.readinessSummary;
      if (!summary) {
        summary = {};
        for (const r of Object.values(state.sectionReadiness)) {
          summary[r] = (summary[r] || 0) + 1;
        }
      }
      return { summary, sections };
    }
  } catch { /* state.json missing or unparseable */ }
  return null;
}

/**
 * Fall back to the bootstrap heuristic (assess-readiness.js).
 * Used only when no agent assessment exists in state.json.
 */
function readReadinessFromHeuristic(proj) {
  return new Promise((ok) => {
    execFile("node", [assessScript, proj.path], { timeout: 10000 }, (err, stdout) => {
      if (err) return ok({ summary: {}, sections: [] });
      try { ok(JSON.parse(stdout)); } catch { ok({ summary: {}, sections: [] }); }
    });
  });
}

app.get("/readiness.json", async (req, res) => {
  const proj = resolveProject(req.query.project);
  if (!proj) return res.json({ summary: {}, sections: [] });
  // Agent-authoritative: read from state.json first
  const fromState = await readReadinessFromState(proj);
  if (fromState) return res.json(fromState);
  // Bootstrap fallback: run heuristic
  const fromHeuristic = await readReadinessFromHeuristic(proj);
  res.json(fromHeuristic);
});

app.get("/api/build-status", async (req, res) => {
  const proj = resolveProject(req.query.project);
  if (!proj) return res.json({ workflowStep: null });
  try {
    const raw = await readFile(proj.statePath, "utf-8");
    const state = JSON.parse(raw);
    res.json({
      workflowStep: state.workflowStep || null,
      chunkProgress: state.chunkProgress || null,
      activeSection: state.activeSection || null,
      activeSectionNumber: state.activeSectionNumber || null,
      completedSteps: state.completedSteps || [],
      scenarioScore: state.scenarioScore || null,
      nextStep: state.nextStep || null,
      lastUpdated: state.lastUpdated || null,
      buildEvents: state.buildEvents || [],
      buildRun: state.buildRun || null,
      contextState: state.contextState || null,
    });
  } catch {
    res.json({
      workflowStep: null, chunkProgress: null, activeSection: null,
      activeSectionNumber: null, completedSteps: [], scenarioScore: null,
      nextStep: null, lastUpdated: null, buildEvents: [],
    });
  }
});

// --- Sections API (for kanban level 2/3) ---

app.get("/api/sections", async (req, res) => {
  const proj = resolveProject(req.query.project);
  if (!proj) return res.json({ sections: [] });
  try {
    const specContent = await readFile(proj.specPath, "utf-8");
    const stateRaw = await readFile(proj.statePath, "utf-8").catch(() => "{}");
    const state = JSON.parse(stateRaw);
    const sectionReadiness = state.sectionReadiness || {};

    // Parse sections from spec
    const sectionRegex = /^(#{2,4})\s+([\d.]+)\s+(.+?)(?:\s*\{#([\w-]+)\})?$/gm;
    const sections = [];
    let match;
    while ((match = sectionRegex.exec(specContent)) !== null) {
      const [, hashes, number, heading, alias] = match;
      const level = hashes.length;
      if (level === 2) continue; // Skip top-level groups (1., 2., etc.)
      sections.push({
        number,
        heading: heading.trim(),
        alias: alias || null,
        readiness: (alias && sectionReadiness[alias]) || "unknown",
        level,
      });
    }

    // Extract claims for each section (bold paragraphs as sub-features)
    const claimRegex = /^### \d+\.\d+\s+.+$/gm;
    const sectionBodies = {};
    let lastSection = null;
    for (const line of specContent.split("\n")) {
      const sectionMatch = line.match(/^#{2,4}\s+([\d.]+)\s+.+?(?:\s*\{#([\w-]+)\})?$/);
      if (sectionMatch) {
        lastSection = sectionMatch[2] || sectionMatch[1];
        sectionBodies[lastSection] = "";
      } else if (lastSection) {
        sectionBodies[lastSection] += line + "\n";
      }
    }

    // Parse bold-started paragraphs as claims
    for (const sec of sections) {
      const key = sec.alias || sec.number;
      const body = sectionBodies[key] || "";
      const claims = [];
      const boldRegex = /\*\*([^*]+)\*\*/g;
      let bm;
      while ((bm = boldRegex.exec(body)) !== null) {
        const claim = bm[1].replace(/\.$/, "").trim();
        if (claim.length > 3 && claim.length < 80) {
          claims.push(claim);
        }
      }
      sec.claims = [...new Set(claims)]; // deduplicate
    }

    res.json({ sections });
  } catch (err) {
    res.json({ sections: [], error: err.message });
  }
});

// --- Scenarios API ---

app.get("/api/scenarios", async (req, res) => {
  const proj = resolveProject(req.query.project);
  if (!proj) return res.json({ scenarios: [] });
  try {
    const scenPath = join(dirname(proj.specPath), "scenarios.md");
    const content = await readFile(scenPath, "utf-8").catch(() => null);
    if (!content) return res.json({ scenarios: [] });

    const scenarios = [];
    const lines = content.split("\n");
    let currentFeature = null;
    let currentCategory = null;
    let currentTier = null;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Category headers: # Core Workflow, # Build, # Viewer, # System Quality
      const catMatch = line.match(/^# (.+)/);
      if (catMatch && !catMatch[1].match(/^Scenarios/)) {
        currentCategory = catMatch[1].trim();
        i++;
        continue;
      }

      // Feature headers: ## Feature: {name}
      const featureMatch = line.match(/^## Feature:\s*(.+)/);
      if (featureMatch) {
        const name = featureMatch[1].trim();
        let description = "";
        let dependsOn = "";
        let category = currentCategory || "";

        // Look ahead for I-statement and metadata
        let j = i + 1;
        while (j < lines.length && !lines[j].match(/^#{2,4}\s/)) {
          const peek = lines[j];
          // I-statement: > I describe my vision...
          if (peek.startsWith("> ")) {
            description = peek.replace(/^>\s*/, "").trim();
          }
          // Metadata: Category: Core | Depends on: Project Initialization
          const metaMatch = peek.match(/^Category:\s*(.+?)\s*\|\s*Depends on:\s*(.+)/);
          if (metaMatch) {
            category = metaMatch[1].trim();
            dependsOn = metaMatch[2].trim();
          }
          j++;
        }

        currentFeature = { name, description, category, dependsOn };
        i++;
        continue;
      }

      // Tier headers: ### Critical, ### Edge Cases, ### Polish
      const tierMatch = line.match(/^### (Critical|Edge Cases|Polish)/);
      if (tierMatch) {
        currentTier = tierMatch[1].trim();
        i++;
        continue;
      }

      // Legacy subgroup headers (### anything else) — skip
      const subMatch = line.match(/^### (.+)/);
      if (subMatch && !subMatch[1].match(/^\d/)) {
        currentTier = subMatch[1].trim();
        i++;
        continue;
      }

      // Scenario start: #### Scenario: ...
      const scenMatch = line.match(/^#### Scenario:\s*(.+)/);
      if (scenMatch) {
        const title = scenMatch[1].trim();
        let given = "", when = "", then_ = "";
        let satisfiedWhen = "";
        let validates = [];
        i++;

        // Collect scenario body until next scenario or section
        while (i < lines.length && !lines[i].match(/^#{2,4}\s/)) {
          const l = lines[i];

          // GWT block (quoted lines)
          const givenM = l.match(/>\s*\*\*Given\*\*\s*(.*)/);
          const whenM = l.match(/>\s*\*\*When\*\*\s*(.*)/);
          const thenM = l.match(/>\s*\*\*Then\*\*\s*(.*)/);

          if (givenM) given = givenM[1].trim();
          else if (whenM) when = whenM[1].trim();
          else if (thenM) then_ = thenM[1].trim();

          // Satisfied when
          const satM = l.match(/\*\*Satisfied when:\*\*\s*(.*)/);
          if (satM) satisfiedWhen = satM[1].trim();

          // Validates
          const valM = l.match(/Validates:\s*(.*)/);
          if (valM) {
            validates = valM[1].split(",").map(v => {
              const m = v.match(/`?#([\w-]+)`?\s*\(([\d.]+)\)/);
              return m ? { alias: m[1], number: m[2] } : null;
            }).filter(Boolean);
          }

          i++;
        }

        scenarios.push({
          title,
          feature: currentFeature,
          tier: currentTier,
          given,
          when,
          then: then_,
          satisfiedWhen: satisfiedWhen.substring(0, 200),
          validates,
        });
        continue;
      }

      i++;
    }

    res.json({ scenarios });
  } catch (err) {
    res.json({ scenarios: [], error: err.message });
  }
});

// --- Diagrams API (auto-generated Mermaid definitions) ---

app.get("/api/diagrams", async (req, res) => {
  const proj = resolveProject(req.query.project);
  if (!proj) return res.json({ diagrams: {} });
  try {
    const specContent = await readFile(proj.specPath, "utf-8");
    const diagrams = {};

    // --- 1. Section dependency neighborhoods ---
    // Parse cross-references: {#alias} anchors and "see section N.N" / "#alias" mentions
    const sectionRegex = /^(#{2,4})\s+([\d.]+)\s+(.+?)(?:\s*\{#([\w-]+)\})?$/gm;
    const sectionMap = {}; // alias -> { number, heading, body }
    const sectionBodies = {};
    let lastAlias = null;
    const lines = specContent.split("\n");
    const sectionsByLine = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(#{2,4})\s+([\d.]+)\s+(.+?)(?:\s*\{#([\w-]+)\})?$/);
      if (m) {
        const [, hashes, number, heading, alias] = m;
        if (alias) {
          sectionMap[alias] = { number, heading: heading.trim(), alias };
          sectionsByLine.push({ line: i, alias });
        }
        lastAlias = alias || null;
        if (lastAlias) sectionBodies[lastAlias] = "";
      } else if (lastAlias) {
        sectionBodies[lastAlias] = (sectionBodies[lastAlias] || "") + lines[i] + "\n";
      }
    }

    const allAliases = Object.keys(sectionMap);
    const refs = {}; // alias -> Set of referenced aliases
    for (const alias of allAliases) {
      refs[alias] = new Set();
      const body = sectionBodies[alias] || "";
      // Match {#alias} anchors and `#alias` references
      const refPattern = /(?:\{#|`#)([\w-]+)(?:\}|`)/g;
      let rm;
      while ((rm = refPattern.exec(body)) !== null) {
        if (rm[1] !== alias && sectionMap[rm[1]]) {
          refs[alias].add(rm[1]);
        }
      }
      // Match "section N.N" mentions
      const secNumPattern = /section\s+(\d+\.\d+)/gi;
      while ((rm = secNumPattern.exec(body)) !== null) {
        const target = allAliases.find(a => sectionMap[a].number === rm[1]);
        if (target && target !== alias) refs[alias].add(target);
      }
    }

    // Generate neighborhood diagram for each section
    for (const alias of allAliases) {
      const outgoing = [...refs[alias]];
      const incoming = allAliases.filter(a => refs[a]?.has(alias));
      if (outgoing.length === 0 && incoming.length === 0) continue;

      let mermaid = "graph LR\n";
      const nodeId = (a) => a.replace(/-/g, "_");
      mermaid += `  ${nodeId(alias)}["#${alias}"]:::center\n`;
      for (const out of outgoing) {
        mermaid += `  ${nodeId(alias)} --> ${nodeId(out)}["#${out}"]\n`;
      }
      for (const inc of incoming) {
        if (!outgoing.includes(inc)) {
          mermaid += `  ${nodeId(inc)}["#${inc}"] --> ${nodeId(alias)}\n`;
        }
      }
      mermaid += "  classDef center fill:#4a6cf7,color:#fff,stroke:#3b5de8\n";

      if (!diagrams[alias]) diagrams[alias] = {};
      diagrams[alias].dependencies = { type: "dependencies", source: mermaid };
    }

    // --- 2. Convergence phase diagram ---
    // Parse convergence-strategy section for phase markers
    const convBody = sectionBodies["convergence-strategy"] || "";
    if (convBody) {
      const phaseRegex = /\*\*(?:Phase\s+\d+|First|Then|Finally)[^*]*?\*\*\s*(.+)/gi;
      const phases = [];
      let pm;
      while ((pm = phaseRegex.exec(convBody)) !== null) {
        const label = pm[0].replace(/\*\*/g, "").trim();
        if (label.length < 100) phases.push(label);
      }
      if (phases.length >= 2) {
        let mermaid = "graph LR\n";
        for (let i = 0; i < phases.length; i++) {
          const id = `phase_${i}`;
          const label = phases[i].replace(/"/g, "'");
          mermaid += `  ${id}["${label}"]\n`;
          if (i > 0) mermaid += `  phase_${i - 1} --> ${id}\n`;
        }
        if (!diagrams["convergence-strategy"]) diagrams["convergence-strategy"] = {};
        diagrams["convergence-strategy"].convergence = { type: "convergence", source: mermaid };
      }
    }

    // --- 3. Entity relationship diagram ---
    // Parse entities section for bold entity names and relationships
    const entBody = sectionBodies["entities"] || "";
    if (entBody) {
      const entityNames = [];
      const boldRegex = /\*\*([A-Z][A-Za-z ]+)\*\*/g;
      let em;
      while ((em = boldRegex.exec(entBody)) !== null) {
        const name = em[1].trim();
        if (name.length > 2 && name.length < 40 && !entityNames.includes(name)) {
          entityNames.push(name);
        }
      }

      if (entityNames.length >= 2) {
        // Extract relationships from sentences containing entity names
        const sentences = entBody.split(/(?<=[.!?])\s+/);
        const relationships = [];
        const relVerbs = ["contains", "references", "produces", "tracks", "consumes", "maps to", "drives", "owns", "creates", "validates", "updates"];

        for (const sent of sentences) {
          for (const from of entityNames) {
            if (!sent.includes(from)) continue;
            for (const to of entityNames) {
              if (from === to || !sent.includes(to)) continue;
              const verb = relVerbs.find(v => sent.toLowerCase().includes(v));
              if (verb) {
                relationships.push({ from, to, verb });
              }
            }
          }
        }

        let mermaid = "erDiagram\n";
        const seen = new Set();
        for (const rel of relationships) {
          const key = `${rel.from}|${rel.to}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const fromId = rel.from.replace(/ /g, "_");
          const toId = rel.to.replace(/ /g, "_");
          mermaid += `  ${fromId} ||--o{ ${toId} : "${rel.verb}"\n`;
        }
        // Add standalone entities not in relationships
        for (const name of entityNames) {
          if (!relationships.some(r => r.from === name || r.to === name)) {
            mermaid += `  ${name.replace(/ /g, "_")} {\n  }\n`;
          }
        }

        if (!diagrams["entities"]) diagrams["entities"] = {};
        diagrams["entities"].entities = { type: "entities", source: mermaid };
      }
    }

    // --- 4. User flow diagrams ---
    // Parse experience flow sections for step-by-step narratives
    const flowSections = ["core-flow", "evolve-flow", "ref-flow", "review-flow", "execute-flow"];
    for (const flowAlias of flowSections) {
      const body = sectionBodies[flowAlias] || "";
      if (!body) continue;

      // Extract bold-started steps as flow nodes
      const steps = [];
      const stepRegex = /\*\*([^*]+)\*\*\.?\s*([^*\n]*)/g;
      let sm;
      while ((sm = stepRegex.exec(body)) !== null) {
        const label = sm[1].replace(/\.$/, "").trim();
        if (label.length > 3 && label.length < 60) {
          steps.push(label);
        }
      }

      if (steps.length >= 2) {
        let mermaid = "graph TD\n";
        for (let i = 0; i < Math.min(steps.length, 12); i++) {
          const id = `step_${i}`;
          const label = steps[i].replace(/"/g, "'");
          mermaid += `  ${id}["${label}"]\n`;
          if (i > 0) mermaid += `  step_${i - 1} --> ${id}\n`;
        }

        if (!diagrams[flowAlias]) diagrams[flowAlias] = {};
        diagrams[flowAlias].flow = { type: "flow", source: mermaid };
      }
    }

    // --- 5. Agent pipeline diagram ---
    // Parse CLAUDE.md for command-agent mapping table
    try {
      const claudeMdPath = join(proj.path, "CLAUDE.md");
      const claudeContent = await readFile(claudeMdPath, "utf-8");

      // Find table rows matching: | `/fctry:cmd` | Agent → Agent → Agent |
      const tableLines = claudeContent.split("\n").filter(
        (l) => /\|\s*`?\/fctry:\w+`?\s*\|/.test(l)
      );
      const commands = {};
      for (const line of tableLines) {
        const m = line.match(
          /\|\s*`?\/fctry:(\w+)`?\s*\|\s*([^|]+)\|/
        );
        if (!m) continue;
        const cmd = m[1].trim();
        const agentStr = m[2].trim();
        if (/no agents/i.test(agentStr)) continue;
        if (/^-+$/.test(agentStr.replace(/\s/g, ""))) continue;

        // Split on → and ‖, strip parenthetical notes
        // Handle "or" alternatives by keeping both
        const raw = agentStr
          .split(/\s*[→‖]\s*/)
          .map((s) => s.replace(/\s*\([^)]*\)/g, "").trim())
          .filter((s) => s.length > 0);

        // Expand "X or Y" into separate entries
        const agents = [];
        for (const tok of raw) {
          if (/\bor\b/i.test(tok)) {
            const parts = tok.split(/\s+or\s+/i).map((s) => s.trim());
            agents.push(...parts);
          } else {
            agents.push(tok);
          }
        }

        if (agents.length >= 2) {
          commands[cmd] = agents;
        }
      }

      if (Object.keys(commands).length >= 2) {
        // Collect unique agents
        const agentSet = new Set();
        for (const agents of Object.values(commands)) {
          for (const a of agents) agentSet.add(a);
        }

        const agentId = (name) => name.replace(/\s+/g, "_");
        let pipelineMermaid = "graph LR\n";
        for (const agent of agentSet) {
          pipelineMermaid += `  ${agentId(agent)}["${agent}"]\n`;
        }

        // Aggregate edges: "from|to" -> [cmd1, cmd2]
        const edgeMap = {};
        for (const [cmd, agents] of Object.entries(commands)) {
          // Handle parallel branches: if the original line had ‖,
          // all agents after ‖ connect from the same source
          for (let i = 0; i < agents.length - 1; i++) {
            const key = `${agents[i]}|${agents[i + 1]}`;
            if (!edgeMap[key]) edgeMap[key] = [];
            edgeMap[key].push(cmd);
          }
        }

        for (const [key, cmds] of Object.entries(edgeMap)) {
          const [from, to] = key.split("|");
          const label = cmds.join(", ");
          pipelineMermaid += `  ${agentId(from)} -->|"${label}"| ${agentId(to)}\n`;
        }

        // Attach to the spec section with the most agent name mentions
        let bestAlias = null;
        let bestCount = 0;
        const agentNames = [...agentSet];
        for (const alias of allAliases) {
          const body = sectionBodies[alias] || "";
          let count = 0;
          for (const name of agentNames) {
            const re = new RegExp(name.replace(/\s+/g, "\\s+"), "gi");
            count += (body.match(re) || []).length;
          }
          if (count > bestCount) {
            bestCount = count;
            bestAlias = alias;
          }
        }

        if (bestAlias && bestCount >= 3) {
          if (!diagrams[bestAlias]) diagrams[bestAlias] = {};
          diagrams[bestAlias].pipeline = {
            type: "pipeline",
            source: pipelineMermaid,
          };
        }
      }
    } catch {
      // CLAUDE.md not found or unparseable — skip pipeline diagram
    }

    res.json({ diagrams });
  } catch (err) {
    res.json({ diagrams: {}, error: err.message });
  }
});

// --- Inbox API ---

async function readProjectInbox(proj) {
  try {
    const raw = await readFile(proj.inboxPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeProjectInbox(proj, items) {
  await mkdir(proj.fctryDir, { recursive: true });
  await writeFile(proj.inboxPath, JSON.stringify(items, null, 2));
}

app.get("/api/inbox", async (req, res) => {
  const proj = resolveProject(req.query.project);
  if (!proj) return res.json([]);
  res.json(await readProjectInbox(proj));
});

app.post("/api/inbox", async (req, res) => {
  const proj = resolveProject(req.query.project);
  if (!proj) return res.status(404).json({ error: "No active project" });

  const { type, content } = req.body || {};
  const validTypes = ["evolve", "reference", "feature"];
  if (!type || !validTypes.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
  }
  if (!content || typeof content !== "string" || !content.trim()) {
    return res.status(400).json({ error: "content is required" });
  }

  const item = {
    id: `inbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    content: content.trim(),
    timestamp: new Date().toISOString(),
    status: "pending",
  };

  const items = await readProjectInbox(proj);
  items.unshift(item);
  await writeProjectInbox(proj, items);
  broadcastToProject(proj, { type: "inbox-update", items });
  res.status(201).json(item);

  processInboxItem(proj, item).catch((err) => {
    console.error(`Background processing failed for ${item.id}:`, err.message);
  });
});

app.delete("/api/inbox/:id", async (req, res) => {
  const proj = resolveProject(req.query.project);
  if (!proj) return res.status(404).json({ error: "No active project" });

  const items = await readProjectInbox(proj);
  const index = items.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Item not found" });

  items.splice(index, 1);
  await writeProjectInbox(proj, items);
  broadcastToProject(proj, { type: "inbox-update", items });
  res.status(200).json({ ok: true });
});

// --- Priority API ---
// Project-level priority (which project goes in which column) is stored globally
// in ~/.fctry/priority.json. Section/scenario/claim priority is per-project in
// each project's .fctry/config.json. The ?project param determines which to use.

app.get("/api/priority", async (req, res) => {
  if (!req.query.project) {
    // Global project-level priority
    try {
      const raw = await readFile(globalPriorityPath, "utf-8").catch(() => "{}");
      res.json({ priority: JSON.parse(raw) });
    } catch {
      res.json({ priority: {} });
    }
    return;
  }
  const proj = resolveProject(req.query.project);
  if (!proj) return res.json({ priority: {} });
  try {
    const configPath = join(proj.path, ".fctry", "config.json");
    const raw = await readFile(configPath, "utf-8").catch(() => "{}");
    const config = JSON.parse(raw);
    res.json({ priority: config.priority || {} });
  } catch {
    res.json({ priority: {} });
  }
});

app.post("/api/priority", async (req, res) => {
  if (!req.query.project) {
    // Global project-level priority
    try {
      await writeFile(globalPriorityPath, JSON.stringify(req.body.priority || {}, null, 2) + "\n");
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }
  const proj = resolveProject(req.query.project);
  if (!proj) return res.status(404).json({ error: "Project not found" });
  try {
    const configPath = join(proj.path, ".fctry", "config.json");
    const raw = await readFile(configPath, "utf-8").catch(() => "{}");
    const config = JSON.parse(raw);
    config.priority = req.body.priority || {};
    await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
    broadcastToProject(proj, { type: "priority-update", priority: config.priority });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Inbox Processing ---

async function matchSpecSections(proj, query) {
  try {
    const specContent = await readFile(proj.specPath, "utf-8");
    const sectionRegex = /^#{1,4}\s+([\d.]+)\s+(.+?)(?:\s*\{#([\w-]+)\})?$/gm;
    const matches = [];
    const queryLower = query.toLowerCase();
    let match;
    while ((match = sectionRegex.exec(specContent)) !== null) {
      const [, number, heading, alias] = match;
      const headingLower = heading.toLowerCase();
      if (headingLower.includes(queryLower) || queryLower.split(/\s+/).some((word) => headingLower.includes(word))) {
        matches.push({ number, heading, alias: alias || null });
      }
    }
    return matches;
  } catch {
    return [];
  }
}

async function fetchReference(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "fctry-viewer/1.0" },
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;
    const bodyText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return { title, excerpt: bodyText.slice(0, 2000), summary: "Reference fetched — ready for /fctry:ref" };
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error(err.name === "AbortError" ? "Request timeout" : err.message);
  }
}

async function processInboxItem(proj, item) {
  let items = await readProjectInbox(proj);
  let itemIndex = items.findIndex((i) => i.id === item.id);
  if (itemIndex === -1) return;

  items[itemIndex].status = "processing";
  await writeProjectInbox(proj, items);
  broadcastToProject(proj, { type: "inbox-update", items });

  try {
    let analysis;
    if (item.type === "reference") {
      // Extract URL from content — user may include a note after the URL
      const urlMatch = item.content.match(/https?:\/\/[^\s]+/);
      const url = urlMatch ? urlMatch[0] : item.content.trim();
      const note = urlMatch ? item.content.replace(urlMatch[0], "").replace(/^\s*[-—–:]\s*/, "").trim() : "";
      analysis = await fetchReference(url);
      if (note) analysis.note = note;
    } else if (item.type === "evolve") {
      const affectedSections = await matchSpecSections(proj, item.content);
      analysis = {
        affectedSections,
        summary: `Affects ${affectedSections.length} section${affectedSections.length !== 1 ? "s" : ""} — ready for /fctry:evolve`,
      };
    } else if (item.type === "feature") {
      const affectedSections = await matchSpecSections(proj, item.content);
      analysis = {
        affectedSections,
        summary: `New feature — affects ${affectedSections.length} existing section${affectedSections.length !== 1 ? "s" : ""}`,
      };
    }

    items = await readProjectInbox(proj);
    itemIndex = items.findIndex((i) => i.id === item.id);
    if (itemIndex === -1) return;
    items[itemIndex].analysis = analysis;
    items[itemIndex].status = "processed";
    await writeProjectInbox(proj, items);
    broadcastToProject(proj, { type: "inbox-update", items });
  } catch (err) {
    console.error(`Error processing inbox item ${item.id}:`, err.message);
    items = await readProjectInbox(proj);
    itemIndex = items.findIndex((i) => i.id === item.id);
    if (itemIndex !== -1) {
      items[itemIndex].status = "error";
      items[itemIndex].analysis = { error: err.message };
      await writeProjectInbox(proj, items);
      broadcastToProject(proj, { type: "inbox-update", items });
    }
  }
}

// --- Dashboard API ---

async function getProjectDashboard(proj) {
  // State (build status, workflow, untracked changes)
  let state = {};
  try {
    const raw = await readFile(proj.statePath, "utf-8");
    state = JSON.parse(raw);
  } catch {}

  // Readiness: agent-authoritative (state.json) first, bootstrap heuristic fallback
  const fromState = await readReadinessFromState(proj);
  const readiness = fromState || await readReadinessFromHeuristic(proj);

  // Inbox
  const inboxItems = await readProjectInbox(proj);
  const pendingInbox = inboxItems.filter((i) => i.status === "pending" || i.status === "processed").length;

  // Config (version registry)
  let config = {};
  try {
    const raw = await readFile(resolve(proj.path, ".fctry", "config.json"), "utf-8");
    config = JSON.parse(raw);
  } catch {}

  // Spec status + synopsis
  let specStatus = proj.specStatus;
  let synopsisShort = null;
  try {
    const specContent = await readFile(proj.specPath, "utf-8");
    if (!specStatus) specStatus = extractSpecStatus(specContent);
    synopsisShort = extractSynopsisShort(specContent);
  } catch {}

  // Compute readiness counts
  const summary = readiness.summary || {};
  const totalSections = Object.values(summary).reduce((a, b) => a + b, 0);
  const readySections = (summary.aligned || 0) + (summary["ready-to-execute"] || 0) + (summary.satisfied || 0) + (summary.deferred || 0);

  // Build status
  const buildRun = state.buildRun || null;
  const chunkProgress = state.chunkProgress || null;
  const isBuildActive = state.workflowStep === "executor-build" || state.workflowStep === "executor-plan";

  // Untracked changes
  const untrackedChanges = (state.untrackedChanges || []).length;

  // Recommended next command
  const recommendation = computeRecommendation({
    summary, specStatus, isBuildActive, pendingInbox, untrackedChanges,
    readySections, totalSections, chunkProgress,
  });

  // External version
  const externalVersion = config.versions?.external?.current || null;

  // Upgrade status — "upgraded" (just upgraded), "update-available", or "current"
  let upgradeStatus = "current";
  if (state.upgradeApplied) {
    upgradeStatus = "upgraded";
  } else if (pluginVersion && config.formatVersion) {
    const fv = config.formatVersion.split(".").map(Number);
    const pv = pluginVersion.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pv[i] || 0) > (fv[i] || 0)) { upgradeStatus = "update-available"; break; }
      if ((pv[i] || 0) < (fv[i] || 0)) break;
    }
  } else if (pluginVersion && !config.formatVersion) {
    upgradeStatus = "update-available";
  }

  return {
    path: proj.path,
    name: proj.name,
    synopsisShort,
    specStatus: specStatus || "draft",
    externalVersion,
    accentColor: proj.accentColor || null,
    readiness: { ready: readySections, total: totalSections, summary },
    build: isBuildActive ? { progress: chunkProgress, step: state.workflowStep } : null,
    inbox: { pending: pendingInbox, total: inboxItems.length },
    untrackedChanges,
    upgradeStatus,
    recommendation,
    lastActivity: proj.lastActivity,
  };
}

function computeRecommendation({ summary, specStatus, isBuildActive, pendingInbox, untrackedChanges, readySections, totalSections }) {
  if (isBuildActive) {
    return { command: null, reason: "Build in progress" };
  }

  // Has undocumented code (needs a decision)?
  if ((summary["undocumented"] || 0) > 0) {
    return { command: "/fctry:review", reason: "Undocumented code — review alignment" };
  }

  // Untracked changes?
  if (untrackedChanges > 0) {
    return { command: "/fctry:evolve", reason: `${untrackedChanges} untracked change${untrackedChanges !== 1 ? "s" : ""} — update spec` };
  }

  // Ready-to-build sections exist?
  if ((summary["ready-to-build"] || 0) > 0) {
    return { command: "/fctry:execute", reason: "Ready-to-build sections — run /fctry:execute" };
  }

  // Inbox items waiting?
  if (pendingInbox > 0) {
    return { command: "/fctry:evolve", reason: `${pendingInbox} inbox item${pendingInbox !== 1 ? "s" : ""} to incorporate` };
  }

  // All satisfied?
  if (totalSections > 0 && readySections === totalSections) {
    if (specStatus === "stable") {
      return { command: null, reason: "All sections aligned — project is stable" };
    }
    return { command: "/fctry:review", reason: "All sections aligned — confirm stability" };
  }

  // Draft sections?
  if ((summary.draft || 0) > 0) {
    return { command: "/fctry:evolve", reason: "Draft sections need fleshing out" };
  }

  return { command: "/fctry:execute", reason: "Build to satisfy remaining scenarios" };
}

app.get("/api/dashboard", async (req, res) => {
  const dashboards = [];
  for (const proj of projects.values()) {
    try {
      dashboards.push(await getProjectDashboard(proj));
    } catch (err) {
      dashboards.push({
        path: proj.path, name: proj.name, synopsisShort: null,
        specStatus: proj.specStatus || "draft",
        externalVersion: null, readiness: { ready: 0, total: 0, summary: {} },
        build: null, inbox: { pending: 0, total: 0 }, untrackedChanges: 0,
        upgradeStatus: "current",
        recommendation: { command: null, reason: "Error loading state" },
        lastActivity: proj.lastActivity,
      });
    }
  }
  res.json({ projects: dashboards, activeProject: activeProjectPath });
});

// --- Build Log + Health ---

app.get("/api/build-log", (req, res) => {
  const proj = resolveProject(req.query.project);
  if (!proj) return res.json({ events: [] });
  const buildEvents = proj.eventBuffer.filter((e) => e.type === "build-event" || e.type === "viewer-state");
  const log = {
    project: proj.name,
    exportedAt: new Date().toISOString(),
    eventCount: buildEvents.length,
    events: buildEvents,
  };
  const safeName = proj.name.replace(/[^\w\s.-]/g, "").replace(/\s+/g, "-") || "build-log";
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}-build-log.json"`);
  res.json(log);
});

app.get("/health", (req, res) => {
  const proj = resolveProject(req.query.project);
  res.json({
    status: "ok",
    projects: getProjectList(),
    activeProject: proj ? { name: proj.name, path: proj.path, spec: proj.specPath } : null,
  });
});

app.get("/", (req, res) => {
  res.redirect("/viewer/");
});

// --- WebSocket Server ---

const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("error", () => {});

function broadcastToProject(proj, data) {
  proj.eventSeq++;
  const envelope = { ...data, _seq: proj.eventSeq, _project: proj.path };
  const message = JSON.stringify(envelope);

  proj.eventBuffer.push(envelope);
  if (proj.eventBuffer.length > EVENT_BUFFER_MAX) {
    proj.eventBuffer = proj.eventBuffer.slice(-EVENT_BUFFER_MAX);
  }

  for (const client of proj.clients) {
    if (client.readyState === 1) client.send(message);
  }
}

function broadcastGlobal(data) {
  const message = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(message);
  }
}

wss.on("connection", (client) => {
  // Default subscription: active project
  let subscribedProject = projects.get(activeProjectPath) || null;
  if (subscribedProject) subscribedProject.clients.add(client);

  // Send project list to every new client
  client.send(JSON.stringify({ type: "projects-update", projects: getProjectList() }));

  // Send event history for subscribed project
  if (subscribedProject && subscribedProject.eventBuffer.length > 0) {
    client.send(JSON.stringify({
      type: "event-history",
      events: subscribedProject.eventBuffer,
      latestSeq: subscribedProject.eventSeq,
    }));
  }

  client.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw);

      if (msg.type === "switch-project") {
        if (subscribedProject) subscribedProject.clients.delete(client);
        const newProj = resolveProject(msg.project);
        subscribedProject = newProj;
        if (newProj) {
          newProj.clients.add(client);
          if (newProj.eventBuffer.length > 0) {
            client.send(JSON.stringify({
              type: "event-history",
              events: newProj.eventBuffer,
              latestSeq: newProj.eventSeq,
            }));
          }
          client.send(JSON.stringify({ type: "project-switched", project: newProj.path, name: newProj.name }));
        }
      }

      if (msg.type === "backfill" && typeof msg.afterSeq === "number" && subscribedProject) {
        const missed = subscribedProject.eventBuffer.filter((e) => e._seq > msg.afterSeq);
        client.send(JSON.stringify({
          type: "event-history",
          events: missed,
          latestSeq: subscribedProject.eventSeq,
        }));
      }
    } catch {}
  });

  client.on("close", () => {
    if (subscribedProject) subscribedProject.clients.delete(client);
  });
});

// --- Port Discovery + Startup ---

function tryListen(port, attempts = 0) {
  return new Promise((ok, fail) => {
    server.once("error", (err) => {
      if (err.code === "EADDRINUSE" && attempts < MAX_PORT_ATTEMPTS) {
        console.log(`Port ${port} in use. Trying ${port + 1}...`);
        ok(tryListen(port + 1, attempts + 1));
      } else {
        fail(err);
      }
    });
    server.listen(port, () => ok(port));
  });
}

// Check if an existing viewer is running and healthy. Returns { port } or null.
async function findExistingViewer() {
  try {
    const portData = JSON.parse(await readFile(globalPortPath, "utf-8"));
    const res = await fetch(`http://localhost:${portData.port}/api/dashboard`);
    if (res.ok) return { port: portData.port };
  } catch {}
  // Port file missing or stale — probe default port range
  for (let p = DEFAULT_PORT; p < DEFAULT_PORT + MAX_PORT_ATTEMPTS; p++) {
    try {
      const res = await fetch(`http://localhost:${p}/api/dashboard`);
      if (res.ok) return { port: p };
    } catch {}
  }
  return null;
}

async function start() {
  await mkdir(FCTRY_HOME, { recursive: true });

  const projectDirs = process.argv.slice(2).filter((a) => !a.startsWith("--"));

  // Check if a viewer is already running — if so, register project(s) with it and exit
  const existing = await findExistingViewer();
  if (existing) {
    for (const dir of projectDirs) {
      const resolvedDir = canonicalize(resolve(dir));
      try {
        await fetch(`http://localhost:${existing.port}/api/projects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: resolvedDir }),
        });
        console.log(`Registered project with existing viewer on port ${existing.port}: ${resolvedDir}`);
      } catch {}
    }
    // Write port file if it was missing (self-heal)
    try {
      await writeFile(globalPortPath, JSON.stringify({ port: existing.port, url: `http://localhost:${existing.port}`, pluginRoot }));
    } catch {}
    process.exit(0);
  }

  // Load previously registered projects from global registry FIRST
  // (before registering CLI args, which triggers saveProjectsRegistry and would clobber it)
  const registry = await loadProjectsRegistry();

  // No existing viewer — start as the primary server
  for (const dir of projectDirs) {
    await registerProject(dir);
  }

  // Register remaining projects from the registry
  for (const entry of registry) {
    if (!projects.has(entry.path) && existsSync(resolve(entry.path, ".fctry", "spec.md"))) {
      await registerProject(entry.path);
    }
  }

  // Re-set active to the CLI arg project (it should be the one the user is working in)
  if (projectDirs.length > 0) {
    activeProjectPath = canonicalize(resolve(projectDirs[0]));
  }

  const port = await tryListen(DEFAULT_PORT);
  const url = `http://localhost:${port}`;

  // Write global PID and port files
  await writeFile(globalPidPath, String(process.pid));
  await writeFile(globalPortPath, JSON.stringify({ port, pid: process.pid, url, pluginRoot }));

  // Global memory file watcher (not per-project — memory is global)
  globalMemoryWatcher = watch(globalMemoryPath, { ignoreInitial: true, disableGlobbing: true });
  const broadcastMemory = async () => {
    try {
      const content = await readFile(globalMemoryPath, "utf-8");
      broadcastGlobal({ type: "memory-update", content, timestamp: Date.now() });
    } catch {}
  };
  memoryWatcher.on("change", broadcastMemory);
  memoryWatcher.on("add", broadcastMemory);

  console.log(`fctry viewer running at ${url}`);
  if (projects.size > 0) {
    console.log(`Serving ${projects.size} project(s): ${[...projects.values()].map((p) => p.name).join(", ")}`);
  }

  if (!noOpen) await open(`${url}/viewer/`);
}

function cleanup() {
  if (globalMemoryWatcher) globalMemoryWatcher.close().catch(() => {});
  for (const proj of projects.values()) {
    for (const w of Object.values(proj.watchers)) {
      w.close().catch(() => {});
    }
  }
  // Only remove PID/port files if they belong to this process
  try {
    const filePid = parseInt(readFileSync(globalPidPath, "utf-8").trim(), 10);
    if (filePid === process.pid) {
      unlinkSync(globalPidPath);
      unlinkSync(globalPortPath);
    }
  } catch {}
}

process.on("SIGTERM", () => { cleanup(); process.exit(0); });
process.on("SIGINT", () => { cleanup(); process.exit(0); });

start().catch((err) => {
  console.error("Failed to start viewer:", err.message);
  process.exit(1);
});
