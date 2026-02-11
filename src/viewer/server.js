import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { watch } from "chokidar";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync, readdirSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import open from "open";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Configuration ---

const DEFAULT_PORT = 3850;
const MAX_PORT_ATTEMPTS = 10;

// Resolve the project directory: passed as first arg, or cwd
const projectDir = process.argv[2] ? resolve(process.argv[2]) : process.cwd();

// Find the spec file: {project-name}-spec.md in project root
function findSpecFile(dir) {
  const entries = existsSync(dir) ? readdirSync(dir) : [];
  return entries.find((f) => f.endsWith("-spec.md")) || null;
}

const specFileName = findSpecFile(projectDir);
if (!specFileName) {
  console.error(`No *-spec.md file found in ${projectDir}`);
  process.exit(1);
}

const specPath = resolve(projectDir, specFileName);
const projectName = specFileName.replace("-spec.md", "");
const changelogPath = resolve(projectDir, `${projectName}-changelog.md`);
const fctryDir = resolve(projectDir, ".fctry");
const viewerStatePath = resolve(fctryDir, "viewer-state.json");
const pidPath = resolve(fctryDir, "viewer.pid");
const portPath = resolve(fctryDir, "viewer-port.json");

// --- Express + HTTP Server ---

const app = express();
const server = createServer(app);

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

// Health check for /fctry:view detection
app.get("/health", (req, res) => {
  res.json({ status: "ok", project: projectName, spec: specFileName });
});

// Serve the main viewer page
app.get("/", (req, res) => {
  res.sendFile(resolve(__dirname, "client", "index.html"));
});

// --- WebSocket Server ---

const wss = new WebSocketServer({ server, path: "/ws" });

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

// Watch viewer-state.json for active section signals from agents
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
  // Ensure .fctry directory exists
  await mkdir(fctryDir, { recursive: true });

  const port = await tryListen(DEFAULT_PORT);
  const url = `http://localhost:${port}`;

  // Write PID and port files for lifecycle management
  await writeFile(pidPath, String(process.pid));
  await writeFile(portPath, JSON.stringify({ port, pid: process.pid, url }));

  console.log(`fctry viewer running at ${url}`);
  console.log(`Watching: ${specPath}`);

  // Auto-open browser
  await open(url);
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
