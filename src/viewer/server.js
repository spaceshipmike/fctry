import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { watch } from "chokidar";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync, readdirSync, unlinkSync } from "fs";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { homedir } from "os";
import open from "open";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "../..");

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

// --- Utility ---

function findSpecFile(dir) {
  const fctrySpec = resolve(dir, ".fctry", "spec.md");
  if (existsSync(fctrySpec)) return { path: fctrySpec, legacy: false };
  const entries = existsSync(dir) ? readdirSync(dir) : [];
  const legacy = entries.find((f) => f.endsWith("-spec.md"));
  if (legacy) return { path: resolve(dir, legacy), legacy: true };
  return null;
}

function extractProjectName(specContent, fallbackDir) {
  const fmMatch = specContent.match(/^---\s*\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const titleMatch = fmMatch[1].match(/^title:\s*(.+)$/m);
    if (titleMatch) return titleMatch[1].trim();
  }
  const h1Match = specContent.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  return basename(fallbackDir);
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
  const resolvedDir = resolve(projectDir);

  // Already registered — update activity timestamp
  if (projects.has(resolvedDir)) {
    const proj = projects.get(resolvedDir);
    proj.lastActivity = new Date().toISOString();
    activeProjectPath = resolvedDir;
    await saveProjectsRegistry();
    return proj;
  }

  const specResult = findSpecFile(resolvedDir);
  if (!specResult) return null;

  // Extract project name from spec frontmatter
  let name = basename(resolvedDir);
  try {
    const specContent = await readFile(specResult.path, "utf-8");
    name = extractProjectName(specContent, resolvedDir);
  } catch {}

  const fctryDir = resolve(resolvedDir, ".fctry");
  const proj = {
    path: resolvedDir,
    name,
    fctryDir,
    specPath: specResult.path,
    changelogPath: specResult.legacy
      ? resolve(resolvedDir, readdirSync(resolvedDir).find((f) => f.endsWith("-changelog.md")) || "changelog.md")
      : resolve(fctryDir, "changelog.md"),
    statePath: resolve(fctryDir, "state.json"),
    inboxPath: resolve(fctryDir, "inbox.json"),
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
  const resolvedDir = resolve(projectDir);
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
    lastActivity: p.lastActivity,
    active: p.path === activeProjectPath,
  }));
}

function resolveProject(projectRef) {
  if (!projectRef) return projects.get(activeProjectPath) || null;
  if (projects.has(projectRef)) return projects.get(projectRef);
  const resolved = resolve(projectRef);
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
  }
}

// --- Express + HTTP Server ---

const app = express();
const server = createServer(app);

app.use(express.json());
app.use("/viewer", express.static(resolve(__dirname, "client")));

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

const assessScript = resolve(__dirname, "../spec-index/assess-readiness.js");
app.get("/readiness.json", (req, res) => {
  const proj = resolveProject(req.query.project);
  if (!proj) return res.json({ summary: {}, sections: [] });
  execFile("node", [assessScript, proj.path], { timeout: 10000 }, (err, stdout) => {
    if (err) return res.json({ summary: {}, sections: [] });
    try { res.json(JSON.parse(stdout)); } catch { res.json({ summary: {}, sections: [] }); }
  });
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
    });
  } catch {
    res.json({
      workflowStep: null, chunkProgress: null, activeSection: null,
      activeSectionNumber: null, completedSteps: [], scenarioScore: null,
      nextStep: null, lastUpdated: null, buildEvents: [],
    });
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
      analysis = await fetchReference(item.content);
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
  res.setHeader("Content-Disposition", `attachment; filename="${proj.name}-build-log.json"`);
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

async function start() {
  await mkdir(FCTRY_HOME, { recursive: true });

  // Register initial project(s) from command-line args
  const projectDirs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  for (const dir of projectDirs) {
    await registerProject(dir);
  }

  // Load previously registered projects from global registry
  const registry = await loadProjectsRegistry();
  for (const entry of registry) {
    if (!projects.has(entry.path) && existsSync(resolve(entry.path, ".fctry", "spec.md"))) {
      await registerProject(entry.path);
    }
  }

  // Re-set active to the CLI arg project (it should be the one the user is working in)
  if (projectDirs.length > 0) {
    activeProjectPath = resolve(projectDirs[0]);
  }

  const port = await tryListen(DEFAULT_PORT);
  const url = `http://localhost:${port}`;

  // Write global PID and port files
  await writeFile(globalPidPath, String(process.pid));
  await writeFile(globalPortPath, JSON.stringify({ port, pid: process.pid, url, pluginRoot }));

  console.log(`fctry viewer running at ${url}`);
  if (projects.size > 0) {
    console.log(`Serving ${projects.size} project(s): ${[...projects.values()].map((p) => p.name).join(", ")}`);
  }

  if (!noOpen) await open(`${url}/viewer/`);
}

function cleanup() {
  for (const proj of projects.values()) {
    for (const w of Object.values(proj.watchers)) {
      w.close().catch(() => {});
    }
  }
  try { unlinkSync(globalPidPath); } catch {}
  try { unlinkSync(globalPortPath); } catch {}
}

process.on("SIGTERM", () => { cleanup(); process.exit(0); });
process.on("SIGINT", () => { cleanup(); process.exit(0); });

start().catch((err) => {
  console.error("Failed to start viewer:", err.message);
  process.exit(1);
});
