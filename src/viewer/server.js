import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { watch } from "chokidar";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync, readdirSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import open from "open";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Configuration ---

const DEFAULT_PORT = 3850;
const MAX_PORT_ATTEMPTS = 10;
const noOpen = process.argv.includes("--no-open");

// Resolve the project directory: first non-flag arg, or cwd
const projectDir = process.argv.slice(2).find((a) => !a.startsWith("--"));
const resolvedProjectDir = projectDir ? resolve(projectDir) : process.cwd();

// Find the spec file: .fctry/spec.md (new convention) or *-spec.md at root (legacy)
function findSpecFile(dir) {
  const fctrySpec = resolve(dir, ".fctry", "spec.md");
  if (existsSync(fctrySpec)) return { path: fctrySpec, legacy: false };
  const entries = existsSync(dir) ? readdirSync(dir) : [];
  const legacy = entries.find((f) => f.endsWith("-spec.md"));
  if (legacy) return { path: resolve(dir, legacy), legacy: true };
  return null;
}

const specResult = findSpecFile(resolvedProjectDir);
if (!specResult) {
  console.error(`No spec found in ${resolvedProjectDir} (checked .fctry/spec.md and *-spec.md)`);
  process.exit(1);
}

const specPath = specResult.path;
const fctryDir = resolve(resolvedProjectDir, ".fctry");
const viewerDir = resolve(fctryDir, "viewer");
const changelogPath = specResult.legacy
  ? resolve(resolvedProjectDir, readdirSync(resolvedProjectDir).find((f) => f.endsWith("-changelog.md")) || "")
  : resolve(fctryDir, "changelog.md");
const projectName = specResult.legacy
  ? readdirSync(resolvedProjectDir).find((f) => f.endsWith("-spec.md")).replace("-spec.md", "")
  : resolve(resolvedProjectDir).split("/").pop();
const viewerStatePath = resolve(fctryDir, "state.json");
const inboxPath = resolve(fctryDir, "inbox.json");
const pidPath = resolve(viewerDir, "viewer.pid");
const portPath = resolve(viewerDir, "port.json");

// --- Express + HTTP Server ---

const app = express();
const server = createServer(app);

app.use(express.json());

// Serve the viewer client files
app.use("/viewer", express.static(resolve(__dirname, "client")));

// Serve the spec markdown file at /spec.md
app.get("/spec.md", async (req, res) => {
  try {
    const content = await readFile(specPath, "utf-8");
    res.type("text/markdown").send(content);
  } catch {
    res.status(404).send("Spec file not found");
  }
});

// Serve the changelog at /changelog.md
app.get("/changelog.md", async (req, res) => {
  try {
    const content = await readFile(changelogPath, "utf-8");
    res.type("text/markdown").send(content);
  } catch {
    res.type("text/markdown").send("_No changelog yet._");
  }
});

// Section readiness assessment
const assessScript = resolve(__dirname, "../spec-index/assess-readiness.js");
app.get("/readiness.json", (req, res) => {
  execFile("node", [assessScript, resolvedProjectDir], { timeout: 10000 }, (err, stdout) => {
    if (err) {
      res.json({ summary: {}, sections: [] });
      return;
    }
    try {
      res.json(JSON.parse(stdout));
    } catch {
      res.json({ summary: {}, sections: [] });
    }
  });
});

// Build status for mission control
app.get("/api/build-status", async (req, res) => {
  try {
    const raw = await readFile(viewerStatePath, "utf-8");
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
    });
  } catch {
    res.json({
      workflowStep: null,
      chunkProgress: null,
      activeSection: null,
      activeSectionNumber: null,
      completedSteps: [],
      scenarioScore: null,
      nextStep: null,
      lastUpdated: null,
      buildEvents: [],
    });
  }
});

// --- Inbox API ---

// Helper: read inbox from file
async function readInbox() {
  try {
    const raw = await readFile(inboxPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Helper: write inbox to file
async function writeInbox(items) {
  await mkdir(fctryDir, { recursive: true });
  await writeFile(inboxPath, JSON.stringify(items, null, 2));
}

// Get all inbox items (most recent first)
app.get("/api/inbox", async (req, res) => {
  const items = await readInbox();
  res.json(items);
});

// Add a new inbox item
app.post("/api/inbox", async (req, res) => {
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

  const items = await readInbox();
  items.unshift(item);
  await writeInbox(items);

  // Broadcast to all connected clients
  broadcast({ type: "inbox-update", items });

  res.status(201).json(item);

  // Process asynchronously (fire and forget)
  processInboxItem(item).catch(err => {
    console.error(`Background processing failed for ${item.id}:`, err.message);
  });
});

// Delete an inbox item
app.delete("/api/inbox/:id", async (req, res) => {
  const items = await readInbox();
  const index = items.findIndex((item) => item.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Item not found" });
  }

  items.splice(index, 1);
  await writeInbox(items);

  // Broadcast to all connected clients
  broadcast({ type: "inbox-update", items });

  res.status(200).json({ ok: true });
});

// --- Inbox Processing ---

// Helper: match spec sections by keyword search
async function matchSpecSections(query) {
  try {
    const specContent = await readFile(specPath, "utf-8");
    const sectionRegex = /^#{1,4}\s+([\d.]+)\s+(.+?)(?:\s*\{#([\w-]+)\})?$/gm;
    const matches = [];
    const queryLower = query.toLowerCase();

    let match;
    while ((match = sectionRegex.exec(specContent)) !== null) {
      const [, number, heading, alias] = match;
      const headingLower = heading.toLowerCase();

      // Simple keyword matching
      if (headingLower.includes(queryLower) || queryLower.split(/\s+/).some(word => headingLower.includes(word))) {
        matches.push({ number, heading, alias: alias || null });
      }
    }

    return matches;
  } catch (err) {
    console.error("Error matching spec sections:", err.message);
    return [];
  }
}

// Helper: fetch and extract content from URL
async function fetchReference(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "fctry-viewer/1.0" },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;

    // Simple body text extraction (strip HTML tags)
    const bodyText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const excerpt = bodyText.slice(0, 2000);

    return {
      title,
      excerpt,
      summary: "Reference fetched — ready for /fctry:ref",
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error(err.name === "AbortError" ? "Request timeout" : err.message);
  }
}

// Process a single inbox item based on its type
async function processInboxItem(item) {
  // Read current inbox state
  let items = await readInbox();
  let itemIndex = items.findIndex(i => i.id === item.id);

  if (itemIndex === -1) return; // Item was deleted

  // Update status to processing
  items[itemIndex].status = "processing";
  await writeInbox(items);
  broadcast({ type: "inbox-update", items });

  try {
    let analysis;

    if (item.type === "reference") {
      // Fetch and extract URL content
      analysis = await fetchReference(item.content);
    } else if (item.type === "evolve") {
      // Match against spec sections
      const affectedSections = await matchSpecSections(item.content);
      analysis = {
        affectedSections,
        summary: `Affects ${affectedSections.length} section${affectedSections.length !== 1 ? "s" : ""} — ready for /fctry:evolve`,
      };
    } else if (item.type === "feature") {
      // Same as evolve, different summary
      const affectedSections = await matchSpecSections(item.content);
      analysis = {
        affectedSections,
        summary: `New feature — affects ${affectedSections.length} existing section${affectedSections.length !== 1 ? "s" : ""}`,
      };
    }

    // Re-read inbox (might have changed during processing)
    items = await readInbox();
    itemIndex = items.findIndex(i => i.id === item.id);

    if (itemIndex === -1) return; // Item was deleted during processing

    // Update with analysis and mark processed
    items[itemIndex].analysis = analysis;
    items[itemIndex].status = "processed";
    await writeInbox(items);
    broadcast({ type: "inbox-update", items });

  } catch (err) {
    console.error(`Error processing inbox item ${item.id}:`, err.message);

    // Re-read and update with error
    items = await readInbox();
    itemIndex = items.findIndex(i => i.id === item.id);

    if (itemIndex !== -1) {
      items[itemIndex].status = "error";
      items[itemIndex].analysis = { error: err.message };
      await writeInbox(items);
      broadcast({ type: "inbox-update", items });
    }
  }
}

// Health check for /fctry:view detection
app.get("/health", (req, res) => {
  res.json({ status: "ok", project: projectName, spec: specPath });
});

// Redirect root to viewer
app.get("/", (req, res) => {
  res.redirect("/viewer/");
});

// --- WebSocket Server ---

const wss = new WebSocketServer({ server, path: "/ws" });

// Prevent unhandled WSS errors from crashing the process during port retry
wss.on("error", () => {});

function broadcast(data) {
  const message = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

// --- File Watching ---

// Watch the spec file for changes (debounced to handle rapid saves)
let specDebounce = null;
const specWatcher = watch(specPath, { ignoreInitial: true });
specWatcher.on("change", () => {
  clearTimeout(specDebounce);
  specDebounce = setTimeout(async () => {
    try {
      const content = await readFile(specPath, "utf-8");
      broadcast({ type: "spec-update", content, timestamp: Date.now() });
    } catch {
      // File may be mid-write, ignore transient errors
    }
  }, 300);
});

// Watch the changelog for updates
let changelogDebounce = null;
const changelogWatcher = watch(changelogPath, { ignoreInitial: true });
changelogWatcher.on("change", () => {
  clearTimeout(changelogDebounce);
  changelogDebounce = setTimeout(async () => {
    try {
      const content = await readFile(changelogPath, "utf-8");
      broadcast({ type: "changelog-update", content, timestamp: Date.now() });
    } catch {
      // Changelog may not exist yet
    }
  }, 300);
});
changelogWatcher.on("add", async () => {
  try {
    const content = await readFile(changelogPath, "utf-8");
    broadcast({ type: "changelog-update", content, timestamp: Date.now() });
  } catch {}
});

// Watch state.json for active section signals from agents
if (existsSync(fctryDir)) {
  const stateWatcher = watch(viewerStatePath, {
    ignoreInitial: true,
    disableGlobbing: true,
  });
  stateWatcher.on("change", async () => {
    try {
      const raw = await readFile(viewerStatePath, "utf-8");
      const state = JSON.parse(raw);
      broadcast({ type: "viewer-state", ...state });
    } catch {
      // Ignore parse errors from partial writes
    }
  });
}

// Watch inbox.json for external changes (e.g., from fctry commands)
if (existsSync(fctryDir)) {
  const inboxWatcher = watch(inboxPath, {
    ignoreInitial: true,
    disableGlobbing: true,
  });
  const broadcastInbox = async () => {
    try {
      const items = await readInbox();
      broadcast({ type: "inbox-update", items });
    } catch {
      // Ignore parse errors from partial writes
    }
  };
  inboxWatcher.on("change", broadcastInbox);
  inboxWatcher.on("add", broadcastInbox);
}

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
  // Ensure .fctry/viewer directory exists
  await mkdir(viewerDir, { recursive: true });

  const port = await tryListen(DEFAULT_PORT);
  const url = `http://localhost:${port}`;

  // Write PID and port files for lifecycle management
  await writeFile(pidPath, String(process.pid));
  await writeFile(portPath, JSON.stringify({ port, pid: process.pid, url }));

  console.log(`fctry viewer running at ${url}`);
  console.log(`Watching: ${specPath}`);

  // Auto-open browser unless --no-open was passed
  if (!noOpen) await open(`${url}/viewer/`);
}

// Cleanup PID file on exit
function cleanup() {
  try { unlinkSync(pidPath); } catch {}
  try { unlinkSync(portPath); } catch {}
}

process.on("SIGTERM", () => { cleanup(); process.exit(0); });
process.on("SIGINT", () => { cleanup(); process.exit(0); });

start().catch((err) => {
  console.error("Failed to start viewer:", err.message);
  process.exit(1);
});
