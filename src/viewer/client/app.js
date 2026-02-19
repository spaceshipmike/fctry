// fctry Spec Viewer — client-side application

const specContent = document.getElementById("spec-content");
const tocNav = document.getElementById("toc");
const statusDot = document.getElementById("connection-status");
const highlightIndicator = document.getElementById("highlight-indicator");
const highlightSection = document.getElementById("highlight-section");

let currentScrollPosition = 0;
let ws = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let lastSeq = 0; // track last received sequence number for backfill
let scrollSpyObserver = null;
let lastTocSignature = "";
let sectionReadiness = {}; // alias → readiness value
let readinessCounts = {}; // readiness category → count
let activeReadinessFilter = null; // currently active readiness filter (or null)
let preFilterScrollTop = 0; // scroll position before filter was applied
let specMeta = {}; // parsed frontmatter metadata
let annotationsVisible = true;

// --- Dashboard State ---

const dashboardView = document.getElementById("dashboard-view");
const dashboardGrid = document.getElementById("dashboard-grid");
const dashboardStatusDot = document.getElementById("dashboard-connection-status");
const appView = document.getElementById("app");
const backToDashboard = document.getElementById("back-to-dashboard");
let currentView = "dashboard"; // "dashboard" or "spec"
let dashboardData = null;
let dashboardRefreshTimer = null;

// --- Multi-Project State ---

const projectSwitcher = document.getElementById("project-switcher");
let projectList = [];
let currentProjectPath = null;

// --- Mission Control State ---

const missionControl = document.getElementById("mission-control");
const mcChunks = document.getElementById("mc-chunks");
const mcDagContainer = document.getElementById("mc-dag-container");
const mcScore = document.getElementById("mc-score");
const mcSection = document.getElementById("mc-section");
const mcQuestion = document.getElementById("mc-question");
const mcActivityFeed = document.getElementById("mc-activity-feed");

let buildState = {
  workflowStep: null,
  chunkProgress: null,
  activeSection: null,
  activeSectionNumber: null,
  completedSteps: [],
  scenarioScore: null,
  nextStep: null,
  completedSections: new Set(), // track sections that finished for flash animation
  buildEvents: [], // bounded activity feed (max 50 items)
};

// --- Left Rail Tabs ---

const historyTimeline = document.getElementById("history-timeline");
const historyBadge = document.getElementById("history-badge");
const railTabs = document.querySelectorAll(".rail-tab");
let activeTab = "toc";

function switchTab(tabName) {
  activeTab = tabName;
  for (const tab of railTabs) {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  }
  document.getElementById("toc-pane").classList.toggle("active", tabName === "toc");
  document.getElementById("history-pane").classList.toggle("active", tabName === "history");
  // Clear history badge when switching to history
  if (tabName === "history") {
    historyBadge.classList.remove("visible");
  }
}

function showHistoryBadge() {
  if (activeTab !== "history") {
    historyBadge.classList.add("visible");
  }
}

for (const tab of railTabs) {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
}

// --- Right Rail (Inbox) ---

const rightRail = document.getElementById("right-rail");
const inboxQueue = document.getElementById("inbox-queue");
const inboxCollapseBtn = document.getElementById("inbox-collapse");
const inboxCollapsedLabel = document.getElementById("inbox-collapsed-label");
const inboxInput = document.getElementById("inbox-input");
const inboxSubmit = document.getElementById("inbox-submit");
const inboxTypePills = document.querySelectorAll(".inbox-type-pill");

let selectedInboxType = "evolve";

function toggleRightRail(force) {
  const isCollapsed = rightRail.classList.contains("collapsed");
  const shouldCollapse = force !== undefined ? !force : !isCollapsed;

  rightRail.classList.toggle("collapsed", shouldCollapse);
  document.body.classList.toggle("right-rail-collapsed", shouldCollapse);

  if (!shouldCollapse) {
    inboxInput.focus();
  }
}

inboxCollapseBtn.addEventListener("click", () => toggleRightRail(false));
inboxCollapsedLabel.addEventListener("click", () => toggleRightRail(true));

// --- Mobile ---

const hamburger = document.getElementById("hamburger");
const mobileInboxBtn = document.getElementById("mobile-inbox");
const overlayBackdrop = document.getElementById("overlay-backdrop");
const leftRail = document.getElementById("left-rail");

function closeMobilePanels() {
  leftRail.classList.remove("mobile-open");
  rightRail.classList.remove("mobile-open");
  overlayBackdrop.classList.remove("visible");
}

hamburger.addEventListener("click", () => {
  closeMobilePanels();
  leftRail.classList.add("mobile-open");
  overlayBackdrop.classList.add("visible");
});

mobileInboxBtn.addEventListener("click", () => {
  closeMobilePanels();
  rightRail.classList.add("mobile-open");
  overlayBackdrop.classList.add("visible");
});

overlayBackdrop.addEventListener("click", closeMobilePanels);

// --- Project Switcher ---

function renderProjectSwitcher() {
  if (!projectList.length || projectList.length < 2) {
    // Single project or none — hide switcher
    projectSwitcher.innerHTML = "";
    return;
  }

  projectSwitcher.innerHTML = projectList
    .map((proj) => {
      const isActive = proj.active || proj.path === currentProjectPath;
      const name = proj.name || proj.path.split("/").pop();
      const status = proj.specStatus || "draft";
      const statusClass = `status-${status}`;
      return `<div class="project-item${isActive ? " active" : ""}" data-path="${escapeHtml(proj.path)}" title="${escapeHtml(proj.path)}">
        <span class="project-name">${escapeHtml(name)}</span>
        <span class="project-status-badge ${statusClass}">${escapeHtml(status)}</span>
      </div>`;
    })
    .join("");

  // Attach click handlers
  for (const item of projectSwitcher.querySelectorAll(".project-item")) {
    item.addEventListener("click", () => {
      const path = item.dataset.path;
      if (path !== currentProjectPath) {
        switchProject(path);
      }
    });
  }
}

async function switchProject(path) {
  currentProjectPath = path;

  // Tell server to switch our WebSocket subscription
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "switch-project", project: path }));
  }

  // Reset event tracking (new project = fresh event stream)
  lastSeq = 0;
  buildState.buildEvents = [];
  buildState.completedSections.clear();

  // Clear readiness filter for new project
  if (activeReadinessFilter) {
    activeReadinessFilter = null;
    removeReadinessFilter();
  }
  readinessCounts = {};
  renderReadinessStats();

  // Update sidebar highlight immediately
  for (const item of projectSwitcher.querySelectorAll(".project-item")) {
    item.classList.toggle("active", item.dataset.path === path);
  }

  // Reload all data for the new project
  const q = `?project=${encodeURIComponent(path)}`;

  try {
    const res = await fetch(`/spec.md${q}`);
    if (res.ok) {
      const markdown = await res.text();
      renderSpec(markdown);
      setupScrollSpy();
    }
  } catch {}

  // Load remaining data in parallel
  loadChangelog(q);
  loadReadiness(q);
  loadBuildStatus(q);
  loadInbox(q);
}

// --- Frontmatter Extraction ---

function extractFrontmatter(markdown) {
  let meta = {};
  let content = markdown;

  // Case 1: Code-fenced YAML frontmatter (NLSpec v2 template style)
  // # Title\n```yaml\n---\n...\n---\n```
  const codeFenceRe = /^(#[^\n]+\n+)?```ya?ml\n---\n([\s\S]*?)\n---\n```\n*/;
  const codeFenceMatch = markdown.match(codeFenceRe);
  if (codeFenceMatch) {
    meta = parseYamlSimple(codeFenceMatch[2]);
    content = markdown.slice(codeFenceMatch[0].length);
    // Preserve the title heading if it preceded the fence
    if (codeFenceMatch[1]) {
      content = codeFenceMatch[1].trimEnd() + "\n\n" + content;
    }
  }
  // Case 2: Raw YAML frontmatter (standard ---...--- at start of file)
  else if (markdown.startsWith("---\n")) {
    const endIndex = markdown.indexOf("\n---\n", 4);
    if (endIndex !== -1) {
      meta = parseYamlSimple(markdown.slice(4, endIndex));
      content = markdown.slice(endIndex + 5);
    }
  }

  return { meta, content };
}

function parseYamlSimple(yaml) {
  const meta = {};
  let currentParent = null;

  for (const line of yaml.split("\n")) {
    // Indented key under a parent
    const nested = line.match(/^[ \t]+([\w][\w-]*):\s*(.+)$/);
    if (nested && currentParent) {
      if (typeof meta[currentParent] !== "object" || Array.isArray(meta[currentParent])) {
        meta[currentParent] = {};
      }
      meta[currentParent][nested[1]] = parseYamlValueSimple(nested[2].trim());
      continue;
    }

    // Top-level key with value
    const kv = line.match(/^([\w][\w-]*):\s+(.+)$/);
    if (kv) {
      meta[kv[1]] = parseYamlValueSimple(kv[2].trim());
      currentParent = null;
      continue;
    }

    // Top-level key without value — nested block
    const parent = line.match(/^([\w][\w-]*):\s*$/);
    if (parent) {
      currentParent = parent[1];
      meta[currentParent] = {};
      continue;
    }
  }
  return meta;
}

function parseYamlValueSimple(raw) {
  if ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  if (raw.startsWith("[") && raw.endsWith("]")) {
    return raw.slice(1, -1).split(",")
      .map((s) => s.trim())
      .map((s) => (s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))
        ? s.slice(1, -1) : s)
      .filter(Boolean);
  }
  return raw;
}

function updateSidebarMeta(meta) {
  const header = document.getElementById("rail-header");
  const titleRow = header.querySelector(".sidebar-title-row");
  const logo = titleRow.querySelector(".logo");

  // Set title from frontmatter, or current project name, or default
  const activeProject = projectList.find((p) => p.path === currentProjectPath);
  const projectName = activeProject ? activeProject.name.split(/\s*[—–-]\s*/)[0].trim() : null;
  logo.textContent = meta.title || projectName || "fctry";

  // Add or update meta line below title row
  let metaLine = header.querySelector(".sidebar-meta");
  const parts = [];
  if (meta["spec-version"]) parts.push(`v${meta["spec-version"]}`);
  if (meta.status) parts.push(meta.status);

  if (parts.length > 0) {
    if (!metaLine) {
      metaLine = document.createElement("span");
      metaLine.className = "sidebar-meta";
      titleRow.after(metaLine);
    }
    metaLine.textContent = parts.join(" · ");
  }

  // Show synopsis.short below meta line
  let synopsisLine = header.querySelector(".sidebar-synopsis");
  const synopsisShort = meta.synopsis && meta.synopsis.short;
  if (synopsisShort) {
    if (!synopsisLine) {
      synopsisLine = document.createElement("span");
      synopsisLine.className = "sidebar-synopsis";
      const anchor = metaLine || titleRow;
      anchor.after(synopsisLine);
    }
    synopsisLine.textContent = synopsisShort;
  } else if (synopsisLine) {
    synopsisLine.remove();
  }
}

// --- Markdown Rendering ---

function renderSpec(markdown) {
  // Save scroll position before re-render
  currentScrollPosition = document.documentElement.scrollTop;

  // Extract and strip frontmatter before rendering
  const { meta, content } = extractFrontmatter(markdown);
  specMeta = meta;
  updateSidebarMeta(meta);

  // Parse, process annotations, and sanitize markdown
  const rawHtml = marked.parse(content);
  const annotatedHtml = processAnnotations(rawHtml);
  const html = DOMPurify.sanitize(annotatedHtml, { ADD_TAGS: ["ins", "del"] });
  specContent.innerHTML = html;

  // Add IDs to headings for anchor navigation
  addHeadingIds();

  // Build TOC from rendered headings
  buildToc();

  // Restore scroll position
  requestAnimationFrame(() => {
    document.documentElement.scrollTop = currentScrollPosition;
  });
}

function addHeadingIds() {
  const headings = specContent.querySelectorAll("h1, h2, h3, h4, h5, h6");
  for (const heading of headings) {
    // Extract alias from {#alias} pattern if present
    const aliasMatch = heading.textContent.match(/\{#([\w-]+)\}/);
    if (aliasMatch) {
      heading.id = aliasMatch[1];
      // Clean the display text
      heading.textContent = heading.textContent.replace(/\s*\{#[\w-]+\}/, "");
    } else {
      // Generate ID from text
      heading.id = heading.textContent
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();
    }
  }
}

function buildToc() {
  const headings = specContent.querySelectorAll("h1, h2, h3, h4");
  const links = [];

  for (const heading of headings) {
    const level = heading.tagName.toLowerCase();
    const text = heading.textContent.trim();
    const id = heading.id;
    if (!id || !text) continue;

    const readiness = sectionReadiness[id] || "";
    const readinessClass = readiness ? ` readiness-${readiness}` : "";
    links.push(
      `<a href="#${id}" class="toc-${level}${readinessClass}" data-section="${id}">${text}</a>`
    );
  }

  // Skip DOM update if TOC hasn't changed (performance for large specs)
  const signature = links.join("");
  if (signature === lastTocSignature) return;
  lastTocSignature = signature;

  tocNav.innerHTML = links.join("");

  // Add click handlers for smooth scroll
  for (const link of tocNav.querySelectorAll("a")) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.getElementById(link.dataset.section);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        setActiveSection(link.dataset.section);
        flashSection(target);
      }
    });
  }
}

function setActiveSection(sectionId) {
  for (const link of tocNav.querySelectorAll("a")) {
    link.classList.toggle("active", link.dataset.section === sectionId);
  }
}

// --- Section Flash (brief highlight on navigation) ---

function flashSection(el) {
  el.classList.add("section-flash");
  setTimeout(() => el.classList.remove("section-flash"), 1200);
}

// --- Scroll Spy ---

function setupScrollSpy() {
  // Clean up previous observer
  if (scrollSpyObserver) scrollSpyObserver.disconnect();

  scrollSpyObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      }
    },
    { rootMargin: "-20% 0px -80% 0px" }
  );

  const headings = specContent.querySelectorAll("h1, h2, h3");
  for (const heading of headings) {
    if (heading.id) scrollSpyObserver.observe(heading);
  }
}

// --- Update Notification ---

function showUpdateNotification() {
  const existing = document.getElementById("update-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "update-toast";
  toast.textContent = "Spec updated";
  toast.style.cssText =
    "position:fixed;top:1rem;right:1rem;background:#28a745;color:#fff;" +
    "padding:0.4rem 1rem;border-radius:4px;font-size:0.85rem;z-index:30;" +
    "opacity:1;transition:opacity 0.5s;pointer-events:none;";
  document.body.appendChild(toast);

  setTimeout(() => { toast.style.opacity = "0"; }, 1500);
  setTimeout(() => { toast.remove(); }, 2000);
}

// --- Section Highlighting (from agent signals) ---

let currentHighlight = null;

function highlightAgentSection(sectionId) {
  // Remove previous highlight
  if (currentHighlight) {
    currentHighlight.classList.remove("section-highlight");
    for (const link of tocNav.querySelectorAll("a.highlighted")) {
      link.classList.remove("highlighted");
    }
  }

  // Find and highlight the section
  const heading = document.getElementById(sectionId);
  if (heading) {
    heading.classList.add("section-highlight");
    currentHighlight = heading;

    // Highlight in TOC
    const tocLink = tocNav.querySelector(`a[data-section="${sectionId}"]`);
    if (tocLink) tocLink.classList.add("highlighted");

    // Scroll to it
    heading.scrollIntoView({ behavior: "smooth", block: "center" });

    // Show indicator
    highlightSection.textContent = `Agent working on: ${heading.textContent}`;
    highlightIndicator.classList.remove("hidden");
  }
}

function clearHighlight() {
  if (currentHighlight) {
    currentHighlight.classList.remove("section-highlight");
    currentHighlight = null;
  }
  for (const link of tocNav.querySelectorAll("a.highlighted")) {
    link.classList.remove("highlighted");
  }
  highlightIndicator.classList.add("hidden");
}

// --- Mission Control ---

function isBuildActive(step) {
  return step === "executor-build" || step === "executor-plan";
}

function updateMissionControl(state) {
  const prevSection = buildState.activeSection;
  const wasBuildActive = isBuildActive(buildState.workflowStep);

  // Update build state
  buildState.workflowStep = state.workflowStep || null;
  buildState.chunkProgress = state.chunkProgress || null;
  buildState.activeSection = state.activeSection || null;
  buildState.activeSectionNumber = state.activeSectionNumber || null;
  buildState.completedSteps = state.completedSteps || [];
  buildState.scenarioScore = state.scenarioScore || null;
  buildState.nextStep = state.nextStep || null;

  const isActive = isBuildActive(buildState.workflowStep);

  // Show/hide mission control
  missionControl.classList.toggle("hidden", !isActive);

  if (!isActive) {
    // If build just ended, clear state
    if (wasBuildActive) {
      buildState.completedSections.clear();
      buildState.buildEvents = [];
    }
    return;
  }

  // Seed buildEvents from state if present (initial load or reconnect)
  if (state.buildEvents && Array.isArray(state.buildEvents) && buildState.buildEvents.length === 0) {
    buildState.buildEvents = state.buildEvents.slice(-BUILD_EVENT_LIMIT);
  }

  // Track completed sections for flash animation
  if (prevSection && prevSection !== buildState.activeSection) {
    buildState.completedSections.add(prevSection);
    flashTocSectionComplete(prevSection);
  }

  // Render chunk progress pills
  renderChunkPills();

  // Render dependency graph (from buildRun data)
  renderDependencyGraph(state.buildRun || null);

  // Render scenario score
  renderScenarioScore();

  // Render active section
  renderActiveSection();

  // Render experience question if present
  renderExperienceQuestion(state);

  // Render activity feed
  renderActivityFeed();
}

function renderChunkPills() {
  const progress = buildState.chunkProgress;
  if (!progress || !progress.total) {
    mcChunks.innerHTML = "";
    return;
  }

  const pills = [];

  if (progress.chunks && Array.isArray(progress.chunks)) {
    // Extended format: per-chunk lifecycle data
    let retryingCount = 0;
    let failedCount = 0;

    for (const chunk of progress.chunks) {
      const status = chunk.status || "planned";
      let title = `Chunk ${chunk.id}`;
      if (chunk.name) title += ` \u2014 ${chunk.name}`;
      if (status === "retrying" && chunk.attempt) {
        title += ` \u2014 attempt ${chunk.attempt}`;
        if (chunk.maxAttempts) title += ` of ${chunk.maxAttempts}`;
        retryingCount++;
      }
      if (status === "failed") failedCount++;

      pills.push(`<span class="mc-chunk ${escapeHtml(status)}" title="${escapeHtml(title)}"></span>`);
    }

    // Build richer label
    const { current, total } = progress;
    const extras = [];
    if (retryingCount > 0) extras.push(`${retryingCount} retrying`);
    if (failedCount > 0) extras.push(`${failedCount} failed`);
    const label = extras.length > 0
      ? `${current} of ${total} (${extras.join(", ")})`
      : `${current} of ${total}`;
    pills.push(`<span class="mc-chunk-label">${label}</span>`);

    mcChunks.innerHTML = pills.join("");
  } else {
    // Legacy format: simple current/total
    const { current, total } = progress;

    for (let i = 1; i <= total; i++) {
      let status = "waiting";
      if (i < current) status = "complete";
      else if (i === current) status = "active";

      pills.push(`<span class="mc-chunk ${status}" title="Chunk ${i}"></span>`);
    }

    pills.push(
      `<span class="mc-chunk-label">${current} of ${total}</span>`
    );

    mcChunks.innerHTML = pills.join("");
  }
}

// --- Dependency Graph (DAG) Rendering ---

function renderDependencyGraph(buildRun) {
  if (!mcDagContainer) return;

  // Only render when we have chunk data with dependency info
  const chunks = buildRun?.chunks;
  if (!chunks || !Array.isArray(chunks) || chunks.length < 2) {
    mcDagContainer.innerHTML = "";
    return;
  }

  // Check if any chunk has dependsOn — if none do, skip the graph
  const hasDeps = chunks.some((c) => c.dependsOn && c.dependsOn.length > 0);
  if (!hasDeps && chunks.length <= 3) {
    mcDagContainer.innerHTML = "";
    return;
  }

  // Layout: topological layers (chunks at same depth share a row)
  const layers = topoLayers(chunks);
  const nodeWidth = 120;
  const nodeHeight = 36;
  const layerGap = 60;
  const nodeGap = 16;

  const maxNodesInLayer = Math.max(...layers.map((l) => l.length));
  const svgWidth = Math.max(300, maxNodesInLayer * (nodeWidth + nodeGap) + nodeGap);
  const svgHeight = layers.length * (nodeHeight + layerGap) + layerGap;

  // Compute node positions
  const nodePositions = {};
  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    const totalWidth = layer.length * nodeWidth + (layer.length - 1) * nodeGap;
    const startX = (svgWidth - totalWidth) / 2;
    const y = layerGap / 2 + li * (nodeHeight + layerGap);

    for (let ni = 0; ni < layer.length; ni++) {
      const chunk = layer[ni];
      const x = startX + ni * (nodeWidth + nodeGap);
      nodePositions[chunk.id] = { x, y, chunk };
    }
  }

  // Status colors and classes
  const statusColors = {
    planned: "#94a3b8",    // slate
    active: "#3b82f6",     // blue
    retrying: "#f59e0b",   // amber
    completed: "#22c55e",  // green
    failed: "#ef4444",     // red
  };

  // Build SVG
  let edges = "";
  let nodes = "";

  // Draw dependency edges first (behind nodes)
  for (const chunk of chunks) {
    if (!chunk.dependsOn) continue;
    const to = nodePositions[chunk.id];
    if (!to) continue;

    for (const depId of chunk.dependsOn) {
      const from = nodePositions[depId];
      if (!from) continue;

      const x1 = from.x + nodeWidth / 2;
      const y1 = from.y + nodeHeight;
      const x2 = to.x + nodeWidth / 2;
      const y2 = to.y;
      const midY = (y1 + y2) / 2;

      // Curved path
      edges += `<path d="M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}"
        fill="none" stroke="${from.chunk.status === 'completed' ? '#22c55e55' : '#94a3b855'}"
        stroke-width="2" stroke-dasharray="${from.chunk.status === 'completed' ? 'none' : '4,4'}"/>`;
    }
  }

  // Draw nodes
  for (const chunk of chunks) {
    const pos = nodePositions[chunk.id];
    if (!pos) continue;

    const color = statusColors[chunk.status] || statusColors.planned;
    const isActive = chunk.status === "active" || chunk.status === "retrying";
    const label = chunk.name
      ? (chunk.name.length > 14 ? chunk.name.slice(0, 13) + "\u2026" : chunk.name)
      : `Chunk ${chunk.id}`;

    // Pulse animation for active chunks
    const pulseAttr = isActive ? `class="dag-node-pulse"` : "";

    nodes += `<g transform="translate(${pos.x},${pos.y})">
      <rect ${pulseAttr} width="${nodeWidth}" height="${nodeHeight}" rx="6" ry="6"
        fill="${color}15" stroke="${color}" stroke-width="2"/>
      <text x="${nodeWidth / 2}" y="${nodeHeight / 2 + 1}" text-anchor="middle"
        dominant-baseline="middle" fill="${chunk.status === 'planned' ? '#94a3b8' : color}"
        font-size="11" font-weight="${isActive ? '600' : '400'}"
        font-family="var(--font-sans, system-ui)">${escapeHtml(label)}</text>
      ${chunk.status === "retrying" && chunk.attempt
        ? `<text x="${nodeWidth - 6}" y="12" text-anchor="end" fill="${color}"
            font-size="9" font-family="var(--font-mono, monospace)">r${chunk.attempt}</text>`
        : ""}
    </g>`;
  }

  mcDagContainer.innerHTML = `<svg class="mc-dag-svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
    <style>
      @keyframes dagPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
      .dag-node-pulse { animation: dagPulse 1.5s ease-in-out infinite; }
    </style>
    ${edges}${nodes}
  </svg>`;
}

// Topological sort into layers (Kahn's algorithm variant)
function topoLayers(chunks) {
  const chunkMap = {};
  for (const c of chunks) chunkMap[c.id] = c;

  // Compute in-degree
  const inDeg = {};
  for (const c of chunks) {
    inDeg[c.id] = (c.dependsOn || []).length;
  }

  const layers = [];
  const remaining = new Set(chunks.map((c) => c.id));

  while (remaining.size > 0) {
    // Find all nodes with in-degree 0 among remaining
    const layer = [];
    for (const id of remaining) {
      if (inDeg[id] === 0) layer.push(id);
    }

    if (layer.length === 0) {
      // Cycle detected — dump remaining into one layer
      layers.push([...remaining].map((id) => chunkMap[id]));
      break;
    }

    layers.push(layer.map((id) => chunkMap[id]));

    // Remove these nodes and decrease in-degrees
    for (const id of layer) {
      remaining.delete(id);
      for (const c of chunks) {
        if (c.dependsOn && c.dependsOn.includes(id)) {
          inDeg[c.id]--;
        }
      }
    }
  }

  return layers;
}

function renderScenarioScore() {
  const score = buildState.scenarioScore;
  if (!score) {
    mcScore.textContent = "";
    return;
  }
  mcScore.textContent = `${score.satisfied}/${score.total} scenarios`;
}

function renderActiveSection() {
  if (!buildState.activeSection) {
    mcSection.innerHTML = "";
    return;
  }

  const alias = buildState.activeSection;
  const number = buildState.activeSectionNumber || "";
  const numberDisplay = number ? ` (${number})` : "";

  mcSection.innerHTML =
    `Working on <span class="mc-section-alias">#${escapeHtml(alias)}</span>${escapeHtml(numberDisplay)}`;
}

function renderExperienceQuestion(state) {
  // Check for experience questions surfaced via state
  if (state.experienceQuestion) {
    mcQuestion.classList.remove("hidden");
    mcQuestion.innerHTML =
      `<span class="mc-question-label">Question:</span>${escapeHtml(state.experienceQuestion)}`;
  } else {
    mcQuestion.classList.add("hidden");
    mcQuestion.innerHTML = "";
  }
}

function flashTocSectionComplete(sectionId) {
  const tocLink = tocNav.querySelector(`a[data-section="${sectionId}"]`);
  if (tocLink) {
    tocLink.classList.add("section-just-completed");
    setTimeout(() => tocLink.classList.remove("section-just-completed"), 2000);
  }
}

// --- Activity Feed ---

const BUILD_EVENT_LIMIT = 50;
let activityFilter = "all"; // "all", "chunks", "scenarios", "tools", "verification"

const eventFilterCategories = {
  "chunk-started": "chunks",
  "chunk-completed": "chunks",
  "chunk-retrying": "chunks",
  "chunk-failed": "chunks",
  "scenario-evaluated": "scenarios",
  "agent-started-section": "chunks",
  "agent-completed-section": "chunks",
  "tool-call": "tools",
  "external-tool": "tools",
  "chunk-verified": "verification",
  "verification-failed": "verification",
};

const eventIcons = {
  "chunk-started": "\u25B6",     // ▶
  "chunk-completed": "\u2713",   // ✓
  "chunk-retrying": "\u21BB",    // ↻
  "chunk-failed": "\u2717",      // ✗
  "scenario-evaluated": "\u25CE",// ◎
  "agent-started-section": "\u26A1",  // ⚡
  "agent-completed-section": "\u2713", // ✓
  "chunk-verified": "\u2714",          // ✔ (heavy check mark — distinct from ✓)
  "verification-failed": "\u26A0",     // ⚠ (warning sign)
};

function addBuildEvent(event) {
  if (!event.timestamp) event.timestamp = new Date().toISOString();
  buildState.buildEvents.push(event);
  if (buildState.buildEvents.length > BUILD_EVENT_LIMIT) {
    buildState.buildEvents.shift();
  }
  renderActivityFeed();
}

function formatRelativeTime(timestamp) {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  if (isNaN(then)) return "";
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

function eventDescription(event) {
  const kind = event.kind || "";
  const chunk = event.chunk || "";
  const section = event.section || "";
  switch (kind) {
    case "chunk-started": return `${chunk} started` + (section ? ` (${section})` : "");
    case "chunk-completed": return `${chunk} completed`;
    case "chunk-retrying": return `${chunk} retrying` + (event.attempt ? ` (attempt ${event.attempt})` : "");
    case "chunk-failed": return `${chunk} failed`;
    case "scenario-evaluated": return `Scenario evaluated` + (event.result ? `: ${event.result}` : "");
    case "agent-started-section": return `Agent started ${section}`;
    case "agent-completed-section": return `Agent completed ${section}`;
    case "chunk-verified": return `${chunk} verified` + (event.summary ? `: ${event.summary}` : "");
    case "verification-failed": return `${chunk} verification failed` + (event.summary ? `: ${event.summary}` : "");
    default: return kind;
  }
}

function renderActivityFeed() {
  if (!mcActivityFeed) return;
  const events = buildState.buildEvents;

  // Render filter pills (above the event list)
  const filterBar = mcActivityFeed.parentElement.querySelector(".mc-filter-bar")
    || (() => {
      const bar = document.createElement("div");
      bar.className = "mc-filter-bar";
      mcActivityFeed.parentElement.insertBefore(bar, mcActivityFeed);
      return bar;
    })();

  const filters = [
    { id: "all", label: "All" },
    { id: "chunks", label: "Chunks" },
    { id: "scenarios", label: "Scenarios" },
    { id: "tools", label: "Tools" },
    { id: "verification", label: "Verification" },
  ];

  filterBar.innerHTML = filters
    .map((f) =>
      `<button class="mc-filter-pill${activityFilter === f.id ? " active" : ""}" data-filter="${f.id}">${f.label}</button>`
    )
    .join("") +
    `<button class="mc-export-btn" title="Download build log">⬇ Log</button>`;

  // Attach filter click handlers (delegated)
  filterBar.onclick = (e) => {
    const pill = e.target.closest(".mc-filter-pill");
    if (pill) {
      activityFilter = pill.dataset.filter;
      renderActivityFeed();
      return;
    }
    const exportBtn = e.target.closest(".mc-export-btn");
    if (exportBtn) {
      const q = currentProjectPath ? `?project=${encodeURIComponent(currentProjectPath)}` : "";
      window.open(`/api/build-log${q}`, "_blank");
    }
  };

  // Apply filter
  const filtered = activityFilter === "all"
    ? events
    : events.filter((ev) => (eventFilterCategories[ev.kind] || "chunks") === activityFilter);

  if (!filtered.length) {
    mcActivityFeed.innerHTML = activityFilter === "all"
      ? ""
      : `<div class="mc-event mc-event-empty">No ${activityFilter} events yet</div>`;
    return;
  }

  mcActivityFeed.innerHTML = filtered
    .map((ev) => {
      const icon = eventIcons[ev.kind] || "\u2022";
      const text = eventDescription(ev);
      const time = formatRelativeTime(ev.timestamp);
      return `<div class="mc-event">` +
        `<span class="mc-event-icon">${icon}</span>` +
        `<span class="mc-event-text">${escapeHtml(text)}</span>` +
        `<span class="mc-event-time">${escapeHtml(time)}</span>` +
        `</div>`;
    })
    .join("");

  // Auto-scroll to bottom
  mcActivityFeed.scrollTop = mcActivityFeed.scrollHeight;
}

async function loadBuildStatus(query) {
  try {
    const res = await fetch(`/api/build-status${query || ""}`);
    const data = await res.json();
    updateMissionControl(data);
  } catch {
    // Build status unavailable — mission control stays hidden
  }
}

// --- WebSocket Connection ---

function connectWebSocket() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.addEventListener("open", () => {
    statusDot.className = "status connected";
    statusDot.title = "Live updates active";
    if (dashboardStatusDot) dashboardStatusDot.className = "status connected";
    reconnectAttempts = 0;
    if (reconnectTimer) {
      clearInterval(reconnectTimer);
      reconnectTimer = null;
    }
    // If reconnecting with a known sequence, request backfill for missed events
    if (lastSeq > 0) {
      ws.send(JSON.stringify({ type: "backfill", afterSeq: lastSeq }));
    }
  });

  ws.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);

      // Handle event history batch (on connect or backfill response)
      if (data.type === "event-history") {
        processEventHistory(data.events || [], data.latestSeq || 0);
        return;
      }

      // Handle project list updates
      if (data.type === "projects-update") {
        projectList = data.projects || [];
        // Set current project from server's active if we haven't chosen one
        if (!currentProjectPath) {
          const active = projectList.find((p) => p.active);
          if (active) currentProjectPath = active.path;
        }
        renderProjectSwitcher();
        // Refresh dashboard on project list changes
        if (currentView === "dashboard") {
          clearTimeout(dashboardRefreshTimer);
          dashboardRefreshTimer = setTimeout(loadDashboard, 500);
        }
        return;
      }

      // Handle project switch confirmation
      if (data.type === "project-switched") {
        currentProjectPath = data.project;
        return;
      }

      // Track sequence numbers for all events
      if (data._seq) {
        lastSeq = data._seq;
      }

      if (data.type === "spec-update") {
        renderSpec(data.content);
        setupScrollSpy();
        showUpdateNotification();
        // Readiness may have changed with the spec update
        loadReadiness();
      }

      if (data.type === "changelog-update") {
        const entries = parseChangelog(data.content);
        renderTimeline(entries);
        showHistoryBadge();
      }

      if (data.type === "viewer-state") {
        // Update mission control with all build-relevant fields
        updateMissionControl(data);

        // Existing section highlighting (for non-build agent activity too)
        if (data.activeSection) {
          highlightAgentSection(data.activeSection);
        } else {
          clearHighlight();
        }

        // Debounced dashboard refresh when state changes
        if (currentView === "dashboard") {
          clearTimeout(dashboardRefreshTimer);
          dashboardRefreshTimer = setTimeout(loadDashboard, 2000);
        }
      }

      if (data.type === "build-event" && data.event) {
        addBuildEvent(data.event);
      }

      if (data.type === "inbox-update") {
        renderInboxQueue(data.items || []);
        // Refresh dashboard if inbox changed
        if (currentView === "dashboard") {
          clearTimeout(dashboardRefreshTimer);
          dashboardRefreshTimer = setTimeout(loadDashboard, 1000);
        }
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.addEventListener("close", () => {
    statusDot.className = "status reconnecting";
    statusDot.title = "Reconnecting\u2026";
    if (dashboardStatusDot) dashboardStatusDot.className = "status reconnecting";

    // Auto-reconnect every 3 seconds, up to MAX_RECONNECT_ATTEMPTS
    if (!reconnectTimer) {
      reconnectTimer = setInterval(() => {
        reconnectAttempts++;
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          clearInterval(reconnectTimer);
          reconnectTimer = null;
          statusDot.className = "status disconnected";
          statusDot.title = "Connection lost \u2014 click to retry";
          if (dashboardStatusDot) dashboardStatusDot.className = "status disconnected";
          return;
        }
        if (!ws || ws.readyState === WebSocket.CLOSED) {
          connectWebSocket();
        }
      }, 3000);
    }
  });

  ws.addEventListener("error", () => {
    // Close handler will deal with reconnection
  });
}

// --- Event History Processing (reconnect backfill) ---

function processEventHistory(events, latestSeq) {
  if (latestSeq) lastSeq = latestSeq;

  for (const ev of events) {
    if (ev._seq) lastSeq = Math.max(lastSeq, ev._seq);

    // Replay events into the appropriate handlers
    if (ev.type === "viewer-state") {
      updateMissionControl(ev);
      if (ev.activeSection) {
        highlightAgentSection(ev.activeSection);
      }
    }

    if (ev.type === "build-event" && ev.event) {
      // Avoid duplicates — check if we already have this event by timestamp + kind
      const isDupe = buildState.buildEvents.some(
        (existing) => existing.timestamp === ev.event.timestamp && existing.kind === ev.event.kind
      );
      if (!isDupe) {
        addBuildEvent(ev.event);
      }
    }

    if (ev.type === "spec-update") {
      renderSpec(ev.content);
      setupScrollSpy();
    }

    if (ev.type === "changelog-update") {
      const entries = parseChangelog(ev.content);
      renderTimeline(entries);
    }

    if (ev.type === "inbox-update") {
      renderInboxQueue(ev.items || []);
    }
  }
}

// --- Click-to-retry on disconnected status dot ---

statusDot.addEventListener("click", () => {
  if (statusDot.classList.contains("disconnected")) {
    reconnectAttempts = 0;
    connectWebSocket();
  }
});

// --- Change History ---

function parseChangelog(markdown) {
  // Parse changelog entries: "## TIMESTAMP — /fctry:command (description)\n- changes..."
  const entries = [];
  const sections = markdown.split(/^## /m).filter(Boolean);

  for (const section of sections) {
    const lines = section.trim().split("\n");
    const headerLine = lines[0] || "";

    // Parse "2026-02-13T20:00:00Z — /fctry:evolve (description)"
    const headerMatch = headerLine.match(/^(.+?)\s*[—–]\s*(.+)$/);
    const timestamp = headerMatch ? headerMatch[1].trim() : headerLine.trim();
    const commandRaw = headerMatch ? headerMatch[2].trim() : "";

    // Split command from description: "/fctry:evolve (process guardrails)"
    const cmdMatch = commandRaw.match(/^(\/fctry:\w+)\s*(?:\((.+?)\))?(.*)$/);
    const command = cmdMatch ? cmdMatch[1] : commandRaw;
    const summary = cmdMatch
      ? (cmdMatch[2] || cmdMatch[3] || "").trim()
      : "";

    const changes = lines
      .slice(1)
      .filter((l) => l.startsWith("- "))
      .map((l) => l.slice(2).trim());

    // Extract section aliases from change lines
    const sectionAliases = [];
    for (const change of changes) {
      const aliasMatch = change.match(/`#([\w-]+)`\s*\(([^)]+)\)/);
      if (aliasMatch) {
        sectionAliases.push({ alias: aliasMatch[1], number: aliasMatch[2] });
      }
    }

    entries.push({ timestamp, command, summary, changes, sectionAliases });
  }

  return entries;
}

function renderTimeline(entries) {
  if (!entries.length) {
    historyTimeline.innerHTML =
      '<div class="timeline-empty">No changelog yet.</div>';
    return;
  }

  historyTimeline.innerHTML = entries
    .map(
      (entry, i) => `
      <div class="timeline-entry" data-index="${i}">
        <div class="timeline-node"></div>
        <div class="timeline-content">
          <div class="timeline-date">${formatTimestamp(entry.timestamp)}</div>
          <div class="timeline-command">${escapeHtml(entry.command)}</div>
          ${entry.summary ? `<div class="timeline-summary">${escapeHtml(entry.summary)}</div>` : ""}
          ${entry.sectionAliases.length > 0 ? `
            <div class="timeline-sections">
              ${entry.sectionAliases.map((s) =>
                `<span class="section-badge" data-alias="${s.alias}" title="${s.number}">#${s.alias}</span>`
              ).join("")}
            </div>` : ""}
          <div class="timeline-changes hidden">
            ${entry.changes.map((c) => {
              // Render inline code in change descriptions
              const rendered = escapeHtml(c).replace(/`([^`]+)`/g, '<code>$1</code>');
              return `<div class="timeline-change">${rendered}</div>`;
            }).join("")}
          </div>
        </div>
      </div>`
    )
    .join("");

  // Click entry to expand/collapse changes
  for (const el of historyTimeline.querySelectorAll(".timeline-entry")) {
    const content = el.querySelector(".timeline-content");
    const changes = el.querySelector(".timeline-changes");

    content.addEventListener("click", (e) => {
      // Don't toggle if clicking a section badge
      if (e.target.closest(".section-badge")) return;

      const wasExpanded = !changes.classList.contains("hidden");
      // Collapse all others
      for (const other of historyTimeline.querySelectorAll(".timeline-changes")) {
        other.classList.add("hidden");
        other.closest(".timeline-entry").classList.remove("expanded");
      }
      if (!wasExpanded) {
        changes.classList.remove("hidden");
        el.classList.add("expanded");
      }
    });
  }

  // Click section badges to navigate to that section
  for (const badge of historyTimeline.querySelectorAll(".section-badge")) {
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      const alias = badge.dataset.alias;
      const target = document.getElementById(alias);
      if (target) {
        // Switch to ToC tab to show navigation context
        switchTab("toc");
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        setActiveSection(alias);
        flashSection(target);
      }
    });
  }
}

function formatTimestamp(ts) {
  try {
    const d = new Date(ts);
    if (isNaN(d)) return ts;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function loadChangelog(query) {
  try {
    const res = await fetch(`/changelog.md${query || ""}`);
    const text = await res.text();
    const entries = parseChangelog(text);
    renderTimeline(entries);
  } catch {
    // Changelog may not exist yet
  }
}

// --- Spec Markdown Annotations ---

function processAnnotations(html) {
  // Convert {++added text++} to <ins>added text</ins>
  // Convert {--removed text--} to <del>removed text</del>
  return html
    .replace(/\{\+\+(.+?)\+\+\}/g, '<ins class="added">$1</ins>')
    .replace(/\{--(.+?)--\}/g, '<del class="removed">$1</del>');
}

// --- Section Search (Ctrl+K) ---

function createSearchOverlay() {
  const overlay = document.createElement("div");
  overlay.id = "search-overlay";
  overlay.innerHTML = `
    <div class="search-modal">
      <input type="text" id="search-input" placeholder="Jump to section\u2026" autocomplete="off">
      <ul id="search-results"></ul>
      <div class="search-hint">\u2191\u2193 navigate \u00B7 Enter select \u00B7 Esc close</div>
    </div>
  `;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeSearch();
  });
  document.body.appendChild(overlay);
  return overlay;
}

let searchOverlay = null;
let searchSelectedIndex = -1;

function openSearch() {
  if (!searchOverlay) searchOverlay = createSearchOverlay();
  searchOverlay.classList.add("visible");
  const input = document.getElementById("search-input");
  input.value = "";
  input.focus();
  updateSearchResults("");
  searchSelectedIndex = -1;
}

function closeSearch() {
  if (searchOverlay) searchOverlay.classList.remove("visible");
}

function updateSearchResults(query) {
  const results = document.getElementById("search-results");
  const links = Array.from(tocNav.querySelectorAll("a"));
  const q = query.toLowerCase();

  const matches = q
    ? links.filter((l) => l.textContent.toLowerCase().includes(q) ||
        l.dataset.section.toLowerCase().includes(q))
    : links.slice(0, 15);

  results.innerHTML = matches
    .map((link, i) =>
      `<li class="search-item${i === searchSelectedIndex ? " selected" : ""}"
           data-section="${link.dataset.section}">${link.textContent}
           <span class="search-alias">#${link.dataset.section}</span></li>`
    )
    .join("");

  for (const item of results.querySelectorAll(".search-item")) {
    item.addEventListener("click", () => {
      const target = document.getElementById(item.dataset.section);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        setActiveSection(item.dataset.section);
        flashSection(target);
      }
      closeSearch();
    });
  }
}

function navigateSearchResults(direction) {
  const items = document.querySelectorAll("#search-results .search-item");
  if (!items.length) return;
  searchSelectedIndex = Math.max(0, Math.min(searchSelectedIndex + direction, items.length - 1));
  for (const [i, item] of items.entries()) {
    item.classList.toggle("selected", i === searchSelectedIndex);
  }
  items[searchSelectedIndex]?.scrollIntoView({ block: "nearest" });
}

function selectSearchResult() {
  const items = document.querySelectorAll("#search-results .search-item");
  if (searchSelectedIndex >= 0 && items[searchSelectedIndex]) {
    items[searchSelectedIndex].click();
  }
}

// --- Annotation Toggle ---

function toggleAnnotations() {
  annotationsVisible = !annotationsVisible;
  document.body.classList.toggle("hide-annotations", !annotationsVisible);
}

// --- Keyboard Shortcuts ---

document.addEventListener("keydown", (e) => {
  // Ctrl+K or Cmd+K — section search
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    openSearch();
    return;
  }

  // Escape — clear readiness filter, close search, or close mobile panels
  if (e.key === "Escape") {
    if (activeReadinessFilter) {
      clearReadinessFilter();
      return;
    }
    closeSearch();
    closeMobilePanels();
    return;
  }

  // Skip shortcuts when in input or textarea
  if (e.target.closest("input, textarea")) return;

  // 1 — switch to ToC tab
  if (e.key === "1") {
    e.preventDefault();
    switchTab("toc");
    return;
  }

  // 2 — switch to History tab
  if (e.key === "2") {
    e.preventDefault();
    switchTab("history");
    return;
  }

  // ] — toggle right rail (inbox)
  if (e.key === "]") {
    e.preventDefault();
    toggleRightRail();
    return;
  }

  // a — toggle annotations
  if (e.key === "a") {
    e.preventDefault();
    toggleAnnotations();
    return;
  }

  // ? — show shortcuts help
  if (e.key === "?") {
    e.preventDefault();
    openShortcutsHelp();
    return;
  }
});

// Search input handlers
document.addEventListener("input", (e) => {
  if (e.target.id === "search-input") {
    searchSelectedIndex = -1;
    updateSearchResults(e.target.value);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.target.id === "search-input") {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      navigateSearchResults(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      navigateSearchResults(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectSearchResult();
    }
  }
});

// Arrow key navigation in TOC
tocNav.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const links = Array.from(tocNav.querySelectorAll("a"));
    const current = document.activeElement;
    const index = links.indexOf(current);
    const next =
      e.key === "ArrowDown"
        ? links[Math.min(index + 1, links.length - 1)]
        : links[Math.max(index - 1, 0)];
    if (next) {
      next.focus();
      next.click();
    }
  }
});

// --- Shortcuts Help ---

function openShortcutsHelp() {
  const existing = document.getElementById("shortcuts-overlay");
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement("div");
  overlay.id = "shortcuts-overlay";
  overlay.innerHTML = `
    <div class="shortcuts-modal">
      <h3>Keyboard Shortcuts</h3>
      <dl>
        <dt>Ctrl+K / Cmd+K</dt><dd>Jump to section</dd>
        <dt>\u2191 / \u2193</dt><dd>Navigate sections (in TOC or search)</dd>
        <dt>Enter</dt><dd>Select section</dd>
        <dt>1</dt><dd>Show table of contents</dd>
        <dt>2</dt><dd>Show change history</dd>
        <dt>]</dt><dd>Toggle inbox panel</dd>
        <dt>a</dt><dd>Toggle change annotations</dd>
        <dt>Escape</dt><dd>Close overlay</dd>
        <dt>?</dt><dd>Toggle this help</dd>
      </dl>
      <p class="shortcuts-dismiss">Press Escape or ? to close</p>
    </div>
  `;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  document.addEventListener("keydown", function dismiss(e) {
    if (e.key === "Escape" || e.key === "?") {
      overlay.remove();
      document.removeEventListener("keydown", dismiss);
    }
  });
}

// --- Section Readiness ---

async function loadReadiness(query) {
  try {
    const res = await fetch(`/readiness.json${query || ""}`);
    const data = await res.json();
    sectionReadiness = {};
    readinessCounts = {};
    for (const s of data.sections || []) {
      if (s.alias) {
        sectionReadiness[s.alias] = s.readiness;
      } else if (s.heading) {
        // Parent headings without aliases — key by slugified heading to match DOM IDs
        const slug = (s.number ? s.number + "-" : "") + s.heading
          .toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
        sectionReadiness[slug] = s.readiness;
      }
      if (s.readiness) {
        readinessCounts[s.readiness] = (readinessCounts[s.readiness] || 0) + 1;
      }
    }
    // Force TOC rebuild with readiness classes
    lastTocSignature = "";
    buildToc();
    renderReadinessStats();
    // Re-apply active filter if readiness data changed
    if (activeReadinessFilter) {
      applyReadinessFilter(activeReadinessFilter);
    }
  } catch {
    // Readiness data unavailable — TOC works without it
  }
}

// --- Readiness Stats Pills ---

const readinessStatsContainer = document.getElementById("readiness-stats");

// Display order and labels for readiness categories
const readinessDisplayOrder = [
  "satisfied",
  "ready-to-execute",
  "aligned",
  "spec-ahead",
  "needs-spec-update",
  "draft",
];

const readinessLabels = {
  "satisfied": "satisfied",
  "ready-to-execute": "ready",
  "aligned": "aligned",
  "spec-ahead": "spec-ahead",
  "needs-spec-update": "needs update",
  "draft": "draft",
};

function renderReadinessStats() {
  if (!readinessStatsContainer) return;

  const total = Object.values(readinessCounts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    readinessStatsContainer.innerHTML = "";
    return;
  }

  const pills = [];
  for (const category of readinessDisplayOrder) {
    const count = readinessCounts[category];
    if (!count) continue;
    const label = readinessLabels[category] || category;
    const isActive = activeReadinessFilter === category;
    pills.push(
      `<span class="readiness-pill${isActive ? " active-filter" : ""}" data-readiness="${escapeHtml(category)}" title="${count} section${count !== 1 ? "s" : ""} ${escapeHtml(category)}">` +
      `<span class="pill-label">${escapeHtml(label)}</span>` +
      `<span class="pill-count">${count}</span>` +
      `</span>`
    );
  }

  readinessStatsContainer.innerHTML = pills.join("");

  // Click handlers
  for (const pill of readinessStatsContainer.querySelectorAll(".readiness-pill")) {
    pill.addEventListener("click", () => {
      const category = pill.dataset.readiness;
      if (activeReadinessFilter === category) {
        clearReadinessFilter();
      } else {
        setReadinessFilter(category);
      }
    });
  }
}

function setReadinessFilter(category) {
  // Save scroll position before filtering
  if (!activeReadinessFilter) {
    preFilterScrollTop = document.documentElement.scrollTop;
  }
  activeReadinessFilter = category;
  applyReadinessFilter(category);
  renderReadinessStats(); // re-render pills to show active state
  // Hide sidebar synopsis during filter
  const synopsis = document.querySelector(".sidebar-synopsis");
  if (synopsis) synopsis.style.display = "none";
}

function clearReadinessFilter() {
  activeReadinessFilter = null;
  removeReadinessFilter();
  renderReadinessStats(); // re-render pills to clear active state
  // Restore sidebar synopsis
  const synopsis = document.querySelector(".sidebar-synopsis");
  if (synopsis) synopsis.style.display = "";
  // Restore scroll position
  requestAnimationFrame(() => {
    document.documentElement.scrollTop = preFilterScrollTop;
  });
}

function applyReadinessFilter(category) {
  // Filter TOC entries — dim non-matching, keep matching visible
  for (const link of tocNav.querySelectorAll("a")) {
    const sectionId = link.dataset.section;
    const readiness = sectionReadiness[sectionId];
    // Show if matches, or if this is a parent heading (no readiness data)
    // that contains matching children
    const directMatch = readiness === category;
    link.classList.toggle("readiness-filtered-out", !directMatch && readiness !== undefined);
  }

  // Build a set of matching section IDs (aliases with the target readiness)
  const matchingIds = new Set();
  for (const [alias, readiness] of Object.entries(sectionReadiness)) {
    if (readiness === category) matchingIds.add(alias);
  }

  // Walk all elements in spec-content and build visibility map
  // Strategy: process heading-content groups. A heading with its readiness
  // matching the filter shows with its content. Parent headings (those not
  // in sectionReadiness) show if any child section matches.
  const allElements = Array.from(specContent.children);
  let currentSectionMatches = false; // hide intro content before first matching heading
  let parentHeadingStack = []; // track parent headings to show/hide

  for (const el of allElements) {
    const isHeading = /^H[1-6]$/.test(el.tagName);

    if (isHeading) {
      const sectionId = el.id;
      const readiness = sectionReadiness[sectionId];
      const level = parseInt(el.tagName[1], 10);

      // H1 is the document title, not a section — always hide when filtering
      if (level === 1) {
        el.classList.add("section-filtered-out");
        currentSectionMatches = false;
      } else if (readiness !== undefined) {
        // Leaf section with readiness — show or hide based on match
        currentSectionMatches = readiness === category;
        el.classList.toggle("section-filtered-out", !currentSectionMatches);
      } else {
        // Parent heading (no readiness data) — check if any child matches
        // Look ahead for child sections under this heading
        const hasMatchingChild = hasMatchingChildSection(el, level, matchingIds);
        el.classList.toggle("section-filtered-out", !hasMatchingChild);
        currentSectionMatches = hasMatchingChild;
      }
    } else {
      // Non-heading element — follows current section visibility
      el.classList.toggle("section-filtered-out", !currentSectionMatches);
    }
  }

  // Show filter indicator
  showFilterIndicator(category);
}

function hasMatchingChildSection(parentHeading, parentLevel, matchingIds) {
  let el = parentHeading.nextElementSibling;
  while (el) {
    if (/^H[1-6]$/.test(el.tagName)) {
      const level = parseInt(el.tagName[1], 10);
      if (level <= parentLevel) break; // reached a sibling or higher heading
      if (el.id && matchingIds.has(el.id)) return true;
    }
    el = el.nextElementSibling;
  }
  return false;
}

function removeReadinessFilter() {
  // Clear TOC filter
  for (const link of tocNav.querySelectorAll("a.readiness-filtered-out")) {
    link.classList.remove("readiness-filtered-out");
  }
  // Clear spec content filter
  for (const el of specContent.querySelectorAll(".section-filtered-out")) {
    el.classList.remove("section-filtered-out");
  }
  // Hide filter indicator
  hideFilterIndicator();
}

function showFilterIndicator(category) {
  let indicator = document.querySelector(".readiness-filter-indicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.className = "readiness-filter-indicator";
    // Insert before the tab bar
    const tabBar = document.getElementById("left-rail-tabs");
    if (tabBar) tabBar.before(indicator);
  }
  const count = readinessCounts[category] || 0;
  const total = Object.values(readinessCounts).reduce((a, b) => a + b, 0);
  const label = readinessLabels[category] || category;
  indicator.textContent = `Showing ${count} of ${total} sections (${label})`;
  indicator.classList.add("visible");
}

function hideFilterIndicator() {
  const indicator = document.querySelector(".readiness-filter-indicator");
  if (indicator) indicator.classList.remove("visible");
}

// --- Inbox Form ---

// Type selector pills
for (const pill of inboxTypePills) {
  pill.addEventListener("click", () => {
    for (const p of inboxTypePills) p.classList.remove("active");
    pill.classList.add("active");
    selectedInboxType = pill.dataset.type;
    inboxInput.focus();
  });
}

// Auto-resize textarea
inboxInput.addEventListener("input", () => {
  inboxInput.style.height = "auto";
  inboxInput.style.height = Math.min(inboxInput.scrollHeight, 128) + "px";
});

// Submit on Enter (Shift+Enter for newline)
inboxInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submitInboxItem();
  }
});

inboxSubmit.addEventListener("click", () => submitInboxItem());

async function submitInboxItem() {
  const content = inboxInput.value.trim();
  if (!content) return;

  // Disable while submitting
  inboxSubmit.disabled = true;
  inboxInput.disabled = true;

  try {
    const q = currentProjectPath ? `?project=${encodeURIComponent(currentProjectPath)}` : "";
    const res = await fetch(`/api/inbox${q}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: selectedInboxType, content }),
    });

    if (res.ok) {
      inboxInput.value = "";
      inboxInput.style.height = "auto";
      // Queue will update via WebSocket broadcast
    }
  } catch {
    // Silently fail — user can retry
  } finally {
    inboxSubmit.disabled = false;
    inboxInput.disabled = false;
    inboxInput.focus();
  }
}

async function dismissInboxItem(id) {
  try {
    const q = currentProjectPath ? `?project=${encodeURIComponent(currentProjectPath)}` : "";
    await fetch(`/api/inbox/${id}${q}`, { method: "DELETE" });
    // Queue will update via WebSocket broadcast
  } catch {
    // Silently fail
  }
}

function renderAnalysis(item) {
  const a = item.analysis;
  if (a.error) {
    return `<div class="inbox-analysis error">${escapeHtml(a.error)}</div>`;
  }
  let html = `<div class="inbox-analysis">`;
  if (a.summary) {
    html += `<div class="inbox-analysis-summary">${escapeHtml(a.summary)}</div>`;
  }
  if (a.affectedSections && a.affectedSections.length > 0) {
    html += `<div class="inbox-analysis-sections">${a.affectedSections.map(
      (s) => `<span class="section-badge" title="${escapeHtml(s.number)}">#${escapeHtml(s.alias || s.number)}</span>`
    ).join("")}</div>`;
  }
  if (a.title && item.type === "reference") {
    html += `<div class="inbox-analysis-title">${escapeHtml(a.title)}</div>`;
  }
  html += `</div>`;
  return html;
}

function renderInboxQueue(items) {
  if (!items.length) {
    inboxQueue.innerHTML =
      '<div class="inbox-empty">No items yet. Drop evolve ideas, reference URLs, or feature requests here.</div>';
    return;
  }

  inboxQueue.innerHTML = items
    .map(
      (item) => `
      <div class="inbox-item status-${escapeHtml(item.status || "pending")}" data-id="${escapeHtml(item.id)}">
        <div class="inbox-item-body">
          <div class="inbox-item-top">
            <span class="inbox-type-badge type-${escapeHtml(item.type)}">${escapeHtml(item.type)}</span>
            <span class="inbox-status-badge status-${escapeHtml(item.status || "pending")}">${escapeHtml(item.status || "pending")}</span>
            <span class="inbox-item-time">${formatTimestamp(item.timestamp)}</span>
          </div>
          <div class="inbox-item-content">${escapeHtml(item.content)}</div>
          ${item.analysis ? renderAnalysis(item) : ""}
        </div>
        <button class="inbox-item-dismiss" title="Dismiss">&times;</button>
      </div>`
    )
    .join("");

  // Attach dismiss handlers
  for (const btn of inboxQueue.querySelectorAll(".inbox-item-dismiss")) {
    btn.addEventListener("click", () => {
      const id = btn.closest(".inbox-item").dataset.id;
      dismissInboxItem(id);
    });
  }
}

async function loadInbox(query) {
  try {
    const res = await fetch(`/api/inbox${query || ""}`);
    const items = await res.json();
    renderInboxQueue(items);
  } catch {
    // Inbox unavailable — panel shows empty state
    renderInboxQueue([]);
  }
}

// --- Dashboard ---

function showDashboard() {
  currentView = "dashboard";
  dashboardView.classList.remove("hidden");
  appView.classList.add("hidden");
  loadDashboard();
}

function showSpecView(projectPath) {
  const wasOnDashboard = currentView === "dashboard";
  currentView = "spec";
  dashboardView.classList.add("hidden");
  appView.classList.remove("hidden");
  if (projectPath && projectPath !== currentProjectPath) {
    switchProject(projectPath);
  } else if (wasOnDashboard) {
    // First time entering spec view — load content
    initSpecView();
  }
}

backToDashboard.addEventListener("click", (e) => {
  e.preventDefault();
  showDashboard();
});

async function loadDashboard() {
  try {
    const res = await fetch("/api/dashboard");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    dashboardData = await res.json();
    renderDashboard(dashboardData);
  } catch (err) {
    dashboardGrid.innerHTML =
      `<div class="error-state"><p>Could not load dashboard: ${escapeHtml(err.message)}</p></div>`;
  }
}

function renderDashboard(data) {
  const projects = data.projects || [];

  if (!projects.length) {
    dashboardGrid.innerHTML =
      '<p style="color:var(--text-muted);font-style:italic;grid-column:1/-1;">No fctry projects found. Run <code>/fctry:init</code> in a project to get started.</p>';
    return;
  }

  // If only one project and no query param requesting dashboard, go straight to spec
  const urlParams = new URLSearchParams(window.location.search);
  if (projects.length === 1 && !urlParams.has("dashboard")) {
    showSpecView(projects[0].path);
    return;
  }

  dashboardGrid.innerHTML = projects.map((proj) => {
    const pct = proj.readiness.total > 0 ? Math.round((proj.readiness.ready / proj.readiness.total) * 100) : 0;
    const pctClass = pct >= 80 ? "high" : pct >= 50 ? "medium" : "low";

    // Status badge
    const statusClass = proj.build ? "badge-building" : `badge-${proj.specStatus}`;
    const statusLabel = proj.build ? "building" : proj.specStatus;

    // Build progress pills
    let buildHtml = "";
    if (proj.build && proj.build.progress) {
      const { current, total } = proj.build.progress;
      let pills = "";
      for (let i = 1; i <= Math.min(total, 12); i++) {
        const cls = i < current ? "complete" : i === current ? "active" : "";
        pills += `<span class="card-build-pill ${cls}"></span>`;
      }
      buildHtml = `<div class="card-build-progress">
        <div class="card-build-pills">${pills}</div>
        <span>${current} of ${total}</span>
      </div>`;
    }

    // Stats
    const stats = [];
    if (proj.inbox.pending > 0) {
      stats.push(`<span class="card-stat has-items"><span class="card-stat-icon">\u2709</span>${proj.inbox.pending} inbox</span>`);
    }
    if (proj.untrackedChanges > 0) {
      stats.push(`<span class="card-stat has-items"><span class="card-stat-icon">\u25B3</span>${proj.untrackedChanges} untracked</span>`);
    }

    // Recommendation
    let recHtml = "";
    if (proj.recommendation.command) {
      recHtml = `<div class="card-recommendation">
        <span class="recommendation-chip" data-command="${escapeHtml(proj.recommendation.command)}" title="Click to copy">
          ${escapeHtml(proj.recommendation.command)}
          <span class="copy-icon">\u2398</span>
        </span>
        <span class="recommendation-reason">${escapeHtml(proj.recommendation.reason)}</span>
      </div>`;
    } else {
      recHtml = `<div class="card-recommendation">
        <span class="card-recommendation-idle">${escapeHtml(proj.recommendation.reason)}</span>
      </div>`;
    }

    return `<div class="project-card" data-path="${escapeHtml(proj.path)}">
      <div class="project-card-header">
        <span class="project-card-name">${escapeHtml(proj.name)}</span>
        ${proj.externalVersion ? `<span class="project-card-version">${escapeHtml(proj.externalVersion)}</span>` : ""}
      </div>
      ${proj.synopsisShort ? `<div class="project-card-synopsis">${escapeHtml(proj.synopsisShort)}</div>` : ""}
      <div class="project-card-badges">
        <span class="card-badge ${statusClass}">${escapeHtml(statusLabel)}</span>
      </div>
      <div class="card-readiness">
        <div class="readiness-bar"><div class="readiness-bar-fill ${pctClass}" style="width:${pct}%"></div></div>
        <span class="readiness-label">${proj.readiness.ready}/${proj.readiness.total}</span>
      </div>
      <div class="readiness-stats card-readiness-pills">${readinessDisplayOrder
        .filter(cat => (proj.readiness.summary[cat] || 0) > 0)
        .map(cat => `<span class="readiness-pill" data-readiness="${cat}">${readinessLabels[cat]} ${proj.readiness.summary[cat]}</span>`)
        .join("")}</div>
      ${buildHtml}
      ${stats.length ? `<div class="card-stats">${stats.join("")}</div>` : ""}
      ${recHtml}
    </div>`;
  }).join("");

  // Click handlers: card → spec view, chip → copy command
  for (const card of dashboardGrid.querySelectorAll(".project-card")) {
    card.addEventListener("click", (e) => {
      // If clicking a recommendation chip, copy instead of navigating
      if (e.target.closest(".recommendation-chip")) return;
      showSpecView(card.dataset.path);
    });
  }

  for (const chip of dashboardGrid.querySelectorAll(".recommendation-chip")) {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      const cmd = chip.dataset.command;
      navigator.clipboard.writeText(cmd).then(() => {
        chip.classList.add("copied");
        const origText = chip.innerHTML;
        chip.innerHTML = `Copied!`;
        setTimeout(() => {
          chip.classList.remove("copied");
          chip.innerHTML = origText;
        }, 1500);
      }).catch(() => {
        // Fallback: select text
        const range = document.createRange();
        range.selectNodeContents(chip);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      });
    });
  }
}

// --- Initial Load ---

async function initSpecView() {
  try {
    const response = await fetch("/spec.md");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const markdown = await response.text();
    renderSpec(markdown);
    setupScrollSpy();
  } catch (err) {
    specContent.innerHTML =
      `<div class="error-state">` +
      `<h2>Could not load spec</h2>` +
      `<p>${err.message}</p>` +
      `<p>Make sure a spec exists at <code>.fctry/spec.md</code> in the project directory and the viewer server is running.</p>` +
      `</div>`;
  }

  // Load changelog for history tab
  loadChangelog();

  // Load section readiness
  loadReadiness();

  // Load initial build status for mission control
  loadBuildStatus();

  // Load inbox items
  loadInbox();
}

async function init() {
  // Connect WebSocket first (needed for both views)
  connectWebSocket();

  // Check URL for direct project link
  const urlParams = new URLSearchParams(window.location.search);
  const projectParam = urlParams.get("project");

  if (projectParam) {
    // Direct link to a specific project — go to spec view
    currentProjectPath = projectParam;
    showSpecView(projectParam);
    initSpecView();
  } else {
    // Start with dashboard
    showDashboard();
  }
}

init();
