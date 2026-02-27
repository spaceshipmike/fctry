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

// --- Dashboard / Kanban State ---

const dashboardView = document.getElementById("dashboard-view");
const kanbanBoard = document.getElementById("kanban-board");
const kanbanBreadcrumb = document.getElementById("kanban-breadcrumb");
const dashboardStatusDot = document.getElementById("dashboard-connection-status");
const appView = document.getElementById("app");
const backToDashboard = document.getElementById("back-to-dashboard");
let currentView = "dashboard"; // "dashboard" or "spec"
let dashboardData = null;
let dashboardRefreshTimer = null;
let kanbanPriority = {}; // { projects: { now: [...paths], next: [...], later: [...], inbox: [...] } }
const KANBAN_COLUMNS = ["inbox", "now", "next", "later", "satisfied"];

// --- Multi-Project State ---

const projectSwitcher = document.getElementById("project-switcher");
let projectList = [];
let currentProjectPath = null;

// --- Mission Control State ---

const missionControl = document.getElementById("mission-control");
const mcChunks = document.getElementById("mc-chunks");
const mcDagContainer = document.getElementById("mc-dag-container");
const mcScore = document.getElementById("mc-score");
const mcContextHealth = document.getElementById("mc-context-health");
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

// --- Interchange State ---

const interchangeFindings = document.getElementById("interchange-findings");
const interchangeActions = document.getElementById("interchange-actions");
let currentInterchange = null; // latest interchange document from agent output

// --- Theme Toggle ---

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("fctry-theme", next);
  // Re-render Mermaid diagrams with new theme (chunk 6 integration point)
  if (mermaidReady) reRenderDiagrams();
}

// Listen for system preference changes (only when no manual override stored)
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  if (!localStorage.getItem("fctry-theme")) {
    document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
    if (mermaidReady) reRenderDiagrams();
  }
});

// Wire up toggle buttons (dashboard + spec view)
document.getElementById("theme-toggle-dashboard")?.addEventListener("click", toggleTheme);
document.getElementById("theme-toggle")?.addEventListener("click", toggleTheme);

// --- Toast Notifications ---

const toastContainer = document.createElement("div");
toastContainer.className = "toast-container";
document.body.appendChild(toastContainer);

function showToast(message, severity = "info", duration = 4000) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${severity}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span><div class="toast-progress" style="animation-duration:${duration}ms"></div>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "opacity 0.2s, transform 0.2s";
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// --- Detail Panel (card body click → slide-out) ---

const detailPanel = document.getElementById("detail-panel");
const detailPanelBackdrop = document.getElementById("detail-panel-backdrop");
const detailPanelTitle = document.getElementById("detail-panel-title");
const detailPanelBody = document.getElementById("detail-panel-body");
const detailPanelClose = document.getElementById("detail-panel-close");
let detailPanelOpen = false;

function openDetailPanel(cardType, data) {
  detailPanelTitle.textContent = cardType === "section" ? "Section"
    : cardType === "scenario" ? "Scenario"
    : cardType === "claim" ? "Claim"
    : cardType === "inbox" ? "Inbox Item"
    : cardType === "project" ? "Project"
    : "Detail";
  detailPanelBody.innerHTML = renderDetailContent(cardType, data);
  detailPanel.classList.add("open");
  detailPanelBackdrop.classList.add("visible");
  detailPanelOpen = true;
}

function closeDetailPanel() {
  detailPanel.classList.remove("open");
  detailPanelBackdrop.classList.remove("visible");
  detailPanelOpen = false;
}

function renderDetailContent(cardType, data) {
  if (cardType === "section") {
    const alias = data.alias ? `#${escapeHtml(data.alias)}` : escapeHtml(data.number || "");
    const readiness = data.readiness || "unknown";
    const claims = data.claims || [];
    let html = `<div class="detail-heading">${escapeHtml(data.heading || "")}</div>`;
    html += `<div class="detail-meta">`;
    if (alias) html += `<span class="detail-badge detail-badge-alias">${alias}</span>`;
    html += `<span class="detail-badge detail-badge-readiness" data-readiness="${escapeHtml(readiness)}">${escapeHtml(readiness)}</span>`;
    if (data.number) html += `<span class="detail-badge detail-badge-type">${escapeHtml(data.number)}</span>`;
    html += `</div>`;
    if (claims.length > 0) {
      html += `<div class="detail-section-label">Claims (${claims.length})</div>`;
      html += `<ul class="detail-claims-list">`;
      for (const claim of claims) {
        html += `<li class="detail-claim-item">${escapeHtml(claim)}</li>`;
      }
      html += `</ul>`;
    } else {
      html += `<div class="detail-section-label">Claims</div>`;
      html += `<div class="detail-empty">No claims for this section</div>`;
    }
    return html;
  }

  if (cardType === "inbox") {
    const typeBadge = data.type || "evolve";
    const sections = (data.analysis && data.analysis.affectedSections) || [];
    let html = `<div class="detail-meta">`;
    html += `<span class="detail-badge detail-badge-type">${escapeHtml(typeBadge)}</span>`;
    if (data.status) html += `<span class="detail-badge detail-badge-status">${escapeHtml(data.status)}</span>`;
    html += `</div>`;
    html += `<div class="detail-section-label">Content</div>`;
    html += `<div class="detail-content-text">${escapeHtml(data.content || "")}</div>`;
    if (sections.length > 0) {
      html += `<div class="detail-section-label">Affected Sections</div>`;
      html += `<div class="detail-sections-row">`;
      for (const s of sections) {
        html += `<span class="section-badge">#${escapeHtml(s.alias || s.number)}</span>`;
      }
      html += `</div>`;
    }
    if (data.timestamp) {
      html += `<div class="detail-timestamp">${formatTimestamp(data.timestamp)}</div>`;
    }
    return html;
  }

  if (cardType === "scenario") {
    const validates = data.validates || [];
    const feature = data.feature;
    let html = `<div class="detail-heading">${escapeHtml(data.title || "")}</div>`;
    html += `<div class="detail-meta">`;
    if (feature) {
      html += `<span class="detail-badge detail-badge-phase">${escapeHtml(feature.category || "")}</span>`;
      html += `<span class="detail-badge">${escapeHtml(feature.name || "")}</span>`;
    }
    if (data.tier) html += `<span class="detail-badge">${escapeHtml(data.tier)}</span>`;
    html += `</div>`;
    if (feature && feature.description) {
      html += `<div class="detail-section-label" style="margin-top:0.5rem;font-style:italic;opacity:0.8">${escapeHtml(feature.description)}</div>`;
    }
    if (validates.length > 0) {
      html += `<div class="detail-section-label">Validates</div>`;
      html += `<ul class="detail-validates-list">`;
      for (const v of validates) {
        html += `<li class="detail-validates-item"><span class="section-badge">#${escapeHtml(v.alias || "")}</span> ${escapeHtml(v.section || v.alias || "")}</li>`;
      }
      html += `</ul>`;
    }
    return html;
  }

  if (cardType === "claim") {
    let html = `<div class="detail-section-label">Claim</div>`;
    html += `<div class="detail-content-text">${escapeHtml(data.text || "")}</div>`;
    return html;
  }

  if (cardType === "project") {
    const pct = data.readiness && data.readiness.total > 0
      ? Math.round((data.readiness.ready / data.readiness.total) * 100) : 0;
    let html = `<div class="detail-heading">${escapeHtml(data.name || "")}</div>`;
    html += `<div class="detail-meta">`;
    if (data.externalVersion) html += `<span class="detail-badge detail-badge-type">${escapeHtml(data.externalVersion)}</span>`;
    if (data.specStatus) html += `<span class="detail-badge detail-badge-status">${escapeHtml(data.specStatus)}</span>`;
    html += `</div>`;
    html += `<div class="detail-section-label">Readiness</div>`;
    html += `<div class="detail-content-text">${data.readiness ? `${data.readiness.ready} of ${data.readiness.total} sections ready (${pct}%)` : "Unknown"}</div>`;
    return html;
  }

  return `<div class="detail-empty">No details available</div>`;
}

// Wire close button and backdrop
detailPanelClose.addEventListener("click", closeDetailPanel);
detailPanelBackdrop.addEventListener("click", closeDetailPanel);

// --- Syntax Highlighting (minimal 4-color) ---

function highlightCodeBlocks() {
  const blocks = specContent.querySelectorAll("pre code");
  for (const block of blocks) {
    if (block.dataset.highlighted) continue;
    block.dataset.highlighted = "true";
    block.innerHTML = highlightSyntax(block.textContent);
  }
}

function highlightSyntax(code) {
  // Simple token-based approach: scan left to right, classify each token
  const tokens = [];
  const keywords = new Set(["const","let","var","function","async","await","return","if","else","for","while","import","export","from","class","extends","new","try","catch","throw","switch","case","break","default","typeof","instanceof","in","of","true","false","null","undefined","this","super"]);
  let i = 0;

  while (i < code.length) {
    // Comments
    if (code[i] === "/" && code[i + 1] === "/") {
      const end = code.indexOf("\n", i);
      const slice = end === -1 ? code.slice(i) : code.slice(i, end);
      tokens.push(`<span class="hl-comment">${escapeHtml(slice)}</span>`);
      i += slice.length;
      continue;
    }
    if (code[i] === "/" && code[i + 1] === "*") {
      const end = code.indexOf("*/", i + 2);
      const slice = end === -1 ? code.slice(i) : code.slice(i, end + 2);
      tokens.push(`<span class="hl-comment">${escapeHtml(slice)}</span>`);
      i += slice.length;
      continue;
    }
    // Strings
    if (code[i] === '"' || code[i] === "'" || code[i] === "`") {
      const q = code[i];
      let j = i + 1;
      while (j < code.length && code[j] !== q) {
        if (code[j] === "\\") j++;
        j++;
      }
      const slice = code.slice(i, j + 1);
      tokens.push(`<span class="hl-string">${escapeHtml(slice)}</span>`);
      i = j + 1;
      continue;
    }
    // Words (potential keywords)
    if (/[a-zA-Z_$]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[a-zA-Z0-9_$]/.test(code[j])) j++;
      const word = code.slice(i, j);
      if (keywords.has(word)) {
        tokens.push(`<span class="hl-keyword">${escapeHtml(word)}</span>`);
      } else {
        tokens.push(escapeHtml(word));
      }
      i = j;
      continue;
    }
    // Default: single character
    tokens.push(escapeHtml(code[i]));
    i++;
  }
  return tokens.join("");
}

// --- Left Rail Tabs ---

const historyTimeline = document.getElementById("history-timeline");
const historyBadge = document.getElementById("history-badge");
const lessonsContainer = document.getElementById("lessons-container");
const lessonsBadge = document.getElementById("lessons-badge");
const memoryContainer = document.getElementById("memory-container");
const memoryBadge = document.getElementById("memory-badge");
const railTabs = document.querySelectorAll(".rail-tab");
let activeTab = "toc";
let currentLessons = []; // parsed lesson entries
let currentMemory = []; // parsed memory entries
let rawMemoryMarkdown = ""; // raw memory markdown for editing

function switchTab(tabName) {
  activeTab = tabName;
  for (const tab of railTabs) {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  }
  document.getElementById("toc-pane").classList.toggle("active", tabName === "toc");
  document.getElementById("history-pane").classList.toggle("active", tabName === "history");
  document.getElementById("lessons-pane").classList.toggle("active", tabName === "lessons");
  const memoryPane = document.getElementById("memory-pane");
  if (memoryPane) memoryPane.classList.toggle("active", tabName === "memory");
  // Clear history badge when switching to history
  if (tabName === "history") {
    historyBadge.classList.remove("visible");
  }
  // Clear lessons badge when switching to lessons
  if (tabName === "lessons") {
    lessonsBadge.classList.remove("visible");
  }
  // Clear memory badge when switching to memory
  if (tabName === "memory" && memoryBadge) {
    memoryBadge.classList.remove("visible");
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

// --- Lessons Panel ---

function parseLessons(markdown) {
  if (!markdown || !markdown.trim()) return [];
  const lessons = [];
  // Split on lesson entry headers: ### {timestamp} | #{alias} ({number})
  const entryRegex = /^### (.+?)\s*\|\s*#([\w-]+)\s*\((\d+\.\d+)\)/gm;
  let match;
  const positions = [];
  while ((match = entryRegex.exec(markdown)) !== null) {
    positions.push({ index: match.index, timestamp: match[1].trim(), alias: match[2], number: match[3] });
  }
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index;
    const end = i + 1 < positions.length ? positions[i + 1].index : markdown.length;
    const body = markdown.slice(start, end);
    const triggerM = body.match(/\*\*Trigger:\*\*\s*(.+)/);
    const contextM = body.match(/\*\*Context:\*\*\s*(.+)/);
    const outcomeM = body.match(/\*\*Outcome:\*\*\s*(.+)/);
    const lessonM = body.match(/\*\*Lesson:\*\*\s*(.+)/);
    lessons.push({
      timestamp: positions[i].timestamp,
      alias: positions[i].alias,
      number: positions[i].number,
      trigger: triggerM ? triggerM[1].trim() : "",
      context: contextM ? contextM[1].trim() : "",
      outcome: outcomeM ? outcomeM[1].trim() : "",
      lesson: lessonM ? lessonM[1].trim() : "",
    });
  }
  return lessons;
}

function renderLessonsPanel() {
  if (!lessonsContainer) return;
  if (currentLessons.length === 0) {
    lessonsContainer.innerHTML = '<div class="lessons-empty">No build lessons yet.</div>';
    return;
  }
  // Group by section alias
  const groups = {};
  for (const l of currentLessons) {
    const key = `#${l.alias} (${l.number})`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(l);
  }
  let html = "";
  for (const [section, items] of Object.entries(groups)) {
    html += `<div class="lessons-group">`;
    html += `<div class="lessons-group-header">${escapeHtml(section)} <span class="lessons-count">${items.length}</span></div>`;
    for (const item of items) {
      const date = item.timestamp.split("T")[0] || item.timestamp;
      const triggerLabel = item.trigger.replace(/-/g, " ");
      html += `<div class="lessons-entry">`;
      html += `<div class="lessons-meta"><span class="lessons-date">${escapeHtml(date)}</span> <span class="lessons-trigger">${escapeHtml(triggerLabel)}</span></div>`;
      html += `<div class="lessons-text">${escapeHtml(item.lesson)}</div>`;
      html += `</div>`;
    }
    html += `</div>`;
  }
  lessonsContainer.innerHTML = html;
}

function getLessonCountForAlias(alias) {
  return currentLessons.filter(l => l.alias === alias).length;
}

// --- Memory Panel (Global) ---

function parseMemory(markdown) {
  if (!markdown || !markdown.trim()) return [];
  const entries = [];
  // Memory entry headers: ### {timestamp} | {type} | {project-name}
  const entryRegex = /^### (.+?)\s*\|\s*([\w-]+)\s*\|\s*(.+)/gm;
  let match;
  const positions = [];
  while ((match = entryRegex.exec(markdown)) !== null) {
    positions.push({ index: match.index, timestamp: match[1].trim(), type: match[2].trim(), project: match[3].trim() });
  }
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index;
    const end = i + 1 < positions.length ? positions[i + 1].index : markdown.length;
    const body = markdown.slice(start, end);
    const sectionM = body.match(/\*\*Section:\*\*\s*(.+)/);
    const contentM = body.match(/\*\*Content:\*\*\s*([\s\S]*?)(?=\n\*\*Status:|\n###|$)/);
    const statusM = body.match(/\*\*Status:\*\*\s*(\w+)/);
    entries.push({
      timestamp: positions[i].timestamp,
      type: positions[i].type,
      project: positions[i].project,
      section: sectionM ? sectionM[1].trim() : "",
      content: contentM ? contentM[1].trim() : "",
      status: statusM ? statusM[1].trim() : "active",
      raw: body,
    });
  }
  return entries;
}

function renderMemoryPanel() {
  if (!memoryContainer) return;
  const active = currentMemory.filter(e => e.status === "active");
  if (active.length === 0) {
    memoryContainer.innerHTML = '<div class="memory-empty">No memory entries yet.</div>';
    return;
  }
  // Group by type
  const typeOrder = ["decision-record", "cross-project-lesson", "conversation-digest", "user-preference"];
  const typeLabels = {
    "conversation-digest": "Conversations",
    "decision-record": "Decisions",
    "cross-project-lesson": "Cross-Project Lessons",
    "user-preference": "Preferences",
  };
  const groups = {};
  for (const e of active) {
    if (!groups[e.type]) groups[e.type] = [];
    groups[e.type].push(e);
  }
  let html = "";
  for (const type of typeOrder) {
    const items = groups[type];
    if (!items || items.length === 0) continue;
    const label = typeLabels[type] || type;
    html += `<div class="memory-group">`;
    html += `<div class="memory-group-header">${escapeHtml(label)} <span class="memory-count">${items.length}</span></div>`;
    for (const item of items) {
      const date = item.timestamp.split("T")[0] || item.timestamp;
      html += `<div class="memory-entry" data-timestamp="${escapeHtml(item.timestamp)}" data-type="${escapeHtml(item.type)}">`;
      html += `<div class="memory-meta">`;
      html += `<span class="memory-date">${escapeHtml(date)}</span>`;
      html += `<span class="memory-project">${escapeHtml(item.project)}</span>`;
      if (item.section) html += `<span class="memory-section">${escapeHtml(item.section)}</span>`;
      html += `</div>`;
      html += `<div class="memory-content">${escapeHtml(item.content)}</div>`;
      html += `<div class="memory-actions">`;
      html += `<button class="memory-edit-btn" title="Edit">&#x270E;</button>`;
      html += `<button class="memory-delete-btn" title="Delete">&times;</button>`;
      html += `</div>`;
      html += `</div>`;
    }
    html += `</div>`;
  }
  memoryContainer.innerHTML = html;

  // Attach edit and delete handlers
  memoryContainer.querySelectorAll(".memory-edit-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const entry = e.target.closest(".memory-entry");
      const contentEl = entry.querySelector(".memory-content");
      if (contentEl.contentEditable === "true") {
        // Save
        contentEl.contentEditable = "false";
        contentEl.classList.remove("editing");
        btn.innerHTML = "&#x270E;";
        saveMemoryEdit(entry.dataset.timestamp, entry.dataset.type, contentEl.textContent);
      } else {
        // Start editing
        contentEl.contentEditable = "true";
        contentEl.classList.add("editing");
        contentEl.focus();
        btn.innerHTML = "&#x2713;";
      }
    });
  });

  memoryContainer.querySelectorAll(".memory-delete-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const entry = e.target.closest(".memory-entry");
      const { timestamp, type } = entry.dataset;
      entry.classList.add("deleting");
      try {
        await fetch("/api/memory/entry", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timestamp, type }),
        });
      } catch {}
    });
  });
}

async function saveMemoryEdit(timestamp, type, newContent) {
  // Replace the content field in the raw markdown and PUT it back
  if (!rawMemoryMarkdown) return;
  // Find the entry in raw markdown and update its Content field
  const entryRegex = new RegExp(
    `(### ${timestamp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\|\\s*${type}[\\s\\S]*?\\*\\*Content:\\*\\*\\s*)[\\s\\S]*?(\\n\\*\\*Status:|\\n###|$)`,
  );
  const updated = rawMemoryMarkdown.replace(entryRegex, `$1${newContent}$2`);
  if (updated !== rawMemoryMarkdown) {
    rawMemoryMarkdown = updated;
    try {
      await fetch("/api/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: updated }),
      });
    } catch {}
  }
}

async function loadMemory() {
  try {
    const res = await fetch("/api/memory");
    if (res.ok) {
      const md = await res.text();
      rawMemoryMarkdown = md;
      currentMemory = parseMemory(md);
      renderMemoryPanel();
    }
  } catch {}
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

// --- Per-Project Accent Colors ---

function projectHue(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % 360;
  }
  return h;
}

function projectAccentColor(name, userColor) {
  if (userColor) return userColor;
  const hue = projectHue(name);
  const isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return isDark ? `hsl(${hue}, 50%, 65%)` : `hsl(${hue}, 65%, 55%)`;
}

function applyProjectAccent(name, userColor) {
  const color = projectAccentColor(name, userColor);
  document.documentElement.style.setProperty("--project-accent", color);
}

function clearProjectAccent() {
  document.documentElement.style.removeProperty("--project-accent");
}

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

  // Apply per-project accent color
  const proj = projectList.find((p) => p.path === path);
  if (proj) {
    applyProjectAccent(proj.name, proj.accentColor || null);
  }

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
  loadLessons(q);
  loadMemory(); // Global — not project-scoped
}

async function loadLessons(query) {
  try {
    const res = await fetch(`/lessons.md${query || ""}`);
    if (res.ok) {
      const md = await res.text();
      currentLessons = parseLessons(md);
      renderLessonsPanel();
    }
  } catch {}
}

// --- Frontmatter Extraction ---

function extractFrontmatter(markdown) {
  let meta = {};
  let content = markdown;

  // Case 1: Code-fenced YAML frontmatter (NLSpec v2 template style)
  // # Title\n```yaml\n---\n...\n---\n```
  const codeFenceRe = /^(#[^\n]+\n+)?```ya?ml\n---\n([\s\S]*?)\n---\n[\s\S]*?```\n*/;
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

  // Build fuzzy search index
  buildSearchIndex();

  // Syntax-highlight code blocks
  highlightCodeBlocks();

  // Inject diagram toggle icons (if diagrams loaded)
  if (Object.keys(diagramDefinitions).length > 0) {
    injectDiagramToggles();
  }

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
    const lessonCount = getLessonCountForAlias(id);
    const lessonBadge = lessonCount > 0 ? ` <span class="toc-lesson-count" title="${lessonCount} lesson${lessonCount !== 1 ? "s" : ""}">${lessonCount}</span>` : "";
    links.push(
      `<a href="#${id}" class="toc-${level}${readinessClass}" data-section="${id}">${text}${lessonBadge}</a>`
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

  // Render context health indicator
  renderContextHealth(state);

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

function renderContextHealth(state) {
  if (!mcContextHealth) return;

  const buildRun = state.buildRun || null;
  const contextState = state.contextState || null;

  if (!buildRun && !contextState) {
    mcContextHealth.innerHTML = "";
    mcContextHealth.classList.add("hidden");
    return;
  }

  const parts = [];

  // Context usage — clickable to expand attribution breakdown
  if (contextState && contextState.usage !== undefined) {
    const pct = Math.round(contextState.usage);
    const level = pct >= 90 ? "critical" : pct >= 70 ? "warning" : "healthy";
    const hasAttribution = contextState.attribution && typeof contextState.attribution === "object";
    parts.push(`<span class="context-usage ${level}${hasAttribution ? " has-attribution" : ""}" title="Click to ${hasAttribution ? "expand" : "view"} context details">
      <span class="context-bar"><span class="context-bar-fill" style="width:${pct}%"></span></span>
      <span class="context-pct">${pct}%</span>
    </span>`);
  }

  // Isolation mode
  if (contextState && contextState.isolationMode) {
    parts.push(`<span class="context-mode" title="Context isolation mode">${escapeHtml(contextState.isolationMode)}</span>`);
  }

  // Last checkpoint
  const lastCheckpoint = (buildRun && buildRun.lastCheckpoint) || (contextState && contextState.lastCheckpoint);
  if (lastCheckpoint) {
    parts.push(`<span class="context-checkpoint" title="Last checkpoint">${formatRelativeTime(lastCheckpoint)}</span>`);
  }

  if (parts.length === 0) {
    mcContextHealth.innerHTML = "";
    mcContextHealth.classList.add("hidden");
    return;
  }

  // Attribution breakdown panel (hidden by default, shown on click)
  let attributionHtml = "";
  if (contextState && contextState.attribution && typeof contextState.attribution === "object") {
    const attr = contextState.attribution;
    const categories = [
      { key: "spec", label: "Spec content", color: "#6366f1" },
      { key: "code", label: "Code", color: "#22c55e" },
      { key: "toolOutput", label: "Tool output", color: "#f59e0b" },
      { key: "agentState", label: "Agent state", color: "#ec4899" },
      { key: "conversation", label: "Conversation", color: "#8b5cf6" },
    ];
    const total = categories.reduce((sum, c) => sum + (attr[c.key] || 0), 0);
    attributionHtml = `<div class="context-attribution" style="display:none;">
      <div class="context-attribution-title">Context Breakdown</div>
      ${categories.map((c) => {
        const val = attr[c.key] || 0;
        const widthPct = total > 0 ? Math.round((val / total) * 100) : 0;
        return `<div class="context-attr-row">
          <span class="context-attr-label">${c.label}</span>
          <span class="context-attr-bar"><span class="context-attr-fill" style="width:${widthPct}%;background:${c.color}"></span></span>
          <span class="context-attr-pct">${widthPct}%</span>
        </div>`;
      }).join("")}
    </div>`;
  }

  mcContextHealth.innerHTML = parts.join("") + attributionHtml;
  mcContextHealth.classList.remove("hidden");

  // Attach click handler for attribution expand/collapse
  const usageEl = mcContextHealth.querySelector(".context-usage.has-attribution");
  const attrPanel = mcContextHealth.querySelector(".context-attribution");
  if (usageEl && attrPanel) {
    usageEl.style.cursor = "pointer";
    usageEl.addEventListener("click", () => {
      const visible = attrPanel.style.display !== "none";
      attrPanel.style.display = visible ? "none" : "flex";
    });
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
  "context-compacted": "context",
  "context-checkpointed": "context",
  "context-new": "context",
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
  "context-compacted": "\u29C9",       // ⧉ (two joined squares — compaction)
  "context-checkpointed": "\u2691",    // ⚑ (flag — checkpoint)
  "context-new": "\u2726",             // ✦ (star — new context)
};

// Built-in alert rules — events matching these are pinned with visual accent
function isAlertEvent(event) {
  const kind = event.kind || "";
  if (kind === "verification-failed") return true;
  if (kind === "context-compacted") return true;
  if (kind === "chunk-retrying" && (event.attempt || 0) >= 3) return true;
  return false;
}

function addBuildEvent(event) {
  if (!event.timestamp) event.timestamp = new Date().toISOString();
  if (isAlertEvent(event)) event.alert = true;
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
    case "context-compacted": return `Context compacted` + (event.summary ? ` \u2014 ${event.summary}` : " \u2014 build state preserved");
    case "context-checkpointed": return `Checkpointed` + (chunk ? ` before ${chunk}` : "");
    case "context-new": return `New context` + (chunk ? ` for ${chunk}` : "");
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
    { id: "context", label: "Context" },
  ];

  const alertCount = events.filter((ev) => ev.alert).length;
  filterBar.innerHTML = filters
    .map((f) =>
      `<button class="mc-filter-pill${activityFilter === f.id ? " active" : ""}" data-filter="${f.id}">${f.label}</button>`
    )
    .join("") +
    (alertCount > 0 ? `<span class="mc-alert-badge" title="${alertCount} alert${alertCount !== 1 ? "s" : ""}">${alertCount}</span>` : "") +
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

  // Separate pinned alerts from regular events
  const alertEvents = filtered.filter((ev) => ev.alert);
  const regularEvents = filtered.filter((ev) => !ev.alert);

  function renderEvent(ev) {
    const icon = eventIcons[ev.kind] || "\u2022";
    const text = eventDescription(ev);
    const time = formatRelativeTime(ev.timestamp);
    const category = eventFilterCategories[ev.kind] || "";
    const classes = ["mc-event"];
    if (category === "context") classes.push("mc-event-context");
    if (ev.alert) classes.push("mc-event-alert");
    return `<div class="${classes.join(" ")}">` +
      `<span class="mc-event-icon">${icon}</span>` +
      `<span class="mc-event-text">${escapeHtml(text)}</span>` +
      `<span class="mc-event-time">${escapeHtml(time)}</span>` +
      `</div>`;
  }

  // Pinned alerts at top, then regular events in chronological order
  const pinnedHtml = alertEvents.length > 0
    ? `<div class="mc-alert-section">${alertEvents.map(renderEvent).join("")}</div>`
    : "";
  const regularHtml = regularEvents.map(renderEvent).join("");

  mcActivityFeed.innerHTML = pinnedHtml + regularHtml;

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

        // Refresh readiness when sectionReadiness changes in state.json
        // (e.g., after State Owner scan or Executor chunk completion)
        if (data.sectionReadiness) {
          loadReadiness();
        }

        // Render interchange if present
        if (data.currentInterchange) {
          renderInterchange(data.currentInterchange);
        } else if (currentInterchange && !data.currentInterchange) {
          clearInterchange();
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

      if (data.type === "lessons-update") {
        currentLessons = parseLessons(data.content || "");
        renderLessonsPanel();
        if (activeTab !== "lessons" && currentLessons.length > 0) {
          lessonsBadge.classList.add("visible");
        }
      }

      if (data.type === "memory-update") {
        rawMemoryMarkdown = data.content || "";
        currentMemory = parseMemory(rawMemoryMarkdown);
        renderMemoryPanel();
        if (activeTab !== "memory" && currentMemory.filter(e => e.status === "active").length > 0 && memoryBadge) {
          memoryBadge.classList.add("visible");
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

// --- Structured Interchange Rendering ---

function renderInterchange(interchange) {
  currentInterchange = interchange;
  const agent = interchange.agent || "unknown";
  const command = interchange.command || "";
  const findings = interchange.findings || [];
  const actions = interchange.actions || [];
  const release = interchange.release || null;

  // Render findings in the main content area
  if (findings.length > 0) {
    interchangeFindings.classList.remove("hidden");
    interchangeFindings.innerHTML = `
      <div class="ix-header">
        <span class="ix-agent-badge">${escapeHtml(agent)}</span>
        <span class="ix-command">${escapeHtml(command)}</span>
        <span class="ix-count">${findings.length} finding${findings.length !== 1 ? "s" : ""}</span>
        <button class="ix-dismiss" title="Dismiss">&times;</button>
      </div>
      <div class="ix-findings-list">
        ${findings.map((f, i) => renderFindingCard(f, i)).join("")}
      </div>
      ${release ? renderReleaseSummary(release) : ""}
    `;
    interchangeFindings.querySelector(".ix-dismiss").addEventListener("click", clearInterchange);
    // Attach expand/collapse handlers
    for (const card of interchangeFindings.querySelectorAll(".ix-finding-card")) {
      card.querySelector(".ix-finding-header").addEventListener("click", () => {
        card.classList.toggle("expanded");
      });
    }
  } else {
    interchangeFindings.classList.add("hidden");
    interchangeFindings.innerHTML = "";
  }

  // Render actions in the right rail
  if (actions.length > 0) {
    interchangeActions.classList.remove("hidden");
    interchangeActions.innerHTML = `
      <div class="ix-actions-header">
        <span>Actions</span>
        <span class="ix-actions-count">${actions.length}</span>
      </div>
      <div class="ix-actions-list">
        ${actions.map((a, i) => renderActionItem(a, i)).join("")}
      </div>
    `;
    // Attach expand/collapse handlers
    for (const item of interchangeActions.querySelectorAll(".ix-action-item")) {
      const header = item.querySelector(".ix-action-header");
      if (header) {
        header.addEventListener("click", () => {
          item.classList.toggle("expanded");
        });
      }
    }
  } else {
    interchangeActions.classList.add("hidden");
    interchangeActions.innerHTML = "";
  }
}

function renderFindingCard(finding, index) {
  const id = finding.id || `FND-${String(index + 1).padStart(3, "0")}`;
  const type = finding.type || "info";
  const summary = finding.summary || finding.description || "";
  const evidence = finding.evidence || finding.detail || "";
  const section = finding.section || "";
  const impact = finding.impact || "";

  // Severity class based on type
  const severityClass = {
    "drift": "severity-warning",
    "code-ahead": "severity-warning",
    "ready-to-build": "severity-info",
    "diverged": "severity-error",
    "readiness": "severity-info",
    "untracked": "severity-muted",
    "coherence": "severity-warning",
    "pattern": "severity-info",
    "insight": "severity-info",
    "conflict": "severity-error",
    "pass": "severity-ok",
    "fail": "severity-error",
  }[type] || "severity-info";

  const steps = finding.steps || [];
  const stepsHtml = steps.length > 0 ? renderSemanticSteps(steps) : "";

  return `
    <div class="ix-finding-card ${severityClass}" data-id="${escapeHtml(id)}">
      <div class="ix-finding-header">
        <span class="ix-finding-id">${escapeHtml(id)}</span>
        <span class="ix-finding-type">${escapeHtml(type)}</span>
        <span class="ix-finding-summary">${escapeHtml(summary)}</span>
        ${section ? `<span class="ix-finding-section">${escapeHtml(section)}</span>` : ""}
        <span class="ix-expand-icon">&#x25B6;</span>
      </div>
      ${(evidence || impact || stepsHtml) ? `
        <div class="ix-finding-detail">
          ${impact ? `<div class="ix-finding-impact">${escapeHtml(impact)}</div>` : ""}
          ${evidence ? `<div class="ix-finding-evidence">${escapeHtml(evidence)}</div>` : ""}
          ${stepsHtml}
        </div>
      ` : ""}
    </div>
  `;
}

// --- Semantic Step Rendering ---
// Tool calls within interchange findings are classified by type and rendered
// with type-appropriate visual treatment.

const stepTypeConfig = {
  file_read:     { icon: "\uD83D\uDCC4", label: "Read",    cssClass: "step-file-read" },
  code_edit:     { icon: "\u270F\uFE0F",  label: "Edit",    cssClass: "step-code-edit" },
  command_exec:  { icon: "\u25B8",        label: "Command", cssClass: "step-command" },
  search:        { icon: "\uD83D\uDD0D",  label: "Search",  cssClass: "step-search" },
  agent_spawn:   { icon: "\u2693",        label: "Agent",   cssClass: "step-agent" },
  external_tool: { icon: "\u26A1",        label: "Tool",    cssClass: "step-external" },
};

function renderSemanticSteps(steps) {
  if (!steps || steps.length === 0) return "";
  return `<div class="ix-steps">${steps.map(renderStep).join("")}</div>`;
}

function renderStep(step) {
  const type = step.type || "external_tool";
  const config = stepTypeConfig[type] || stepTypeConfig.external_tool;
  const file = step.file || "";
  const content = step.content || "";
  const result = step.result || step.summary || "";

  let bodyHtml = "";
  switch (type) {
    case "code_edit":
      bodyHtml = renderEditStep(step);
      break;
    case "file_read":
      bodyHtml = renderReadStep(step);
      break;
    case "command_exec":
      bodyHtml = renderCommandStep(step);
      break;
    case "search":
      bodyHtml = renderSearchStep(step);
      break;
    case "agent_spawn":
      bodyHtml = renderAgentStep(step);
      break;
    default:
      bodyHtml = content || result
        ? `<pre class="ix-step-content">${escapeHtml(content || result)}</pre>`
        : "";
  }

  return `
    <div class="ix-step ${config.cssClass}">
      <div class="ix-step-header">
        <span class="ix-step-icon">${config.icon}</span>
        <span class="ix-step-label">${config.label}</span>
        ${file ? `<span class="ix-step-file">${escapeHtml(file)}</span>` : ""}
      </div>
      ${bodyHtml ? `<div class="ix-step-body">${bodyHtml}</div>` : ""}
    </div>
  `;
}

function renderEditStep(step) {
  const added = step.added || [];
  const removed = step.removed || [];
  const content = step.content || "";
  if (added.length === 0 && removed.length === 0 && !content) return "";
  if (content) {
    // Render as a unified diff
    return `<pre class="ix-step-diff">${escapeHtml(content).replace(
      /^(\+.*)$/gm, '<span class="diff-added">$1</span>'
    ).replace(
      /^(-.*)$/gm, '<span class="diff-removed">$1</span>'
    )}</pre>`;
  }
  // Render as added/removed lines
  const lines = [];
  for (const r of removed) lines.push(`<span class="diff-removed">- ${escapeHtml(r)}</span>`);
  for (const a of added) lines.push(`<span class="diff-added">+ ${escapeHtml(a)}</span>`);
  return `<pre class="ix-step-diff">${lines.join("\n")}</pre>`;
}

function renderReadStep(step) {
  const content = step.content || step.excerpt || "";
  if (!content) return "";
  return `<pre class="ix-step-code">${escapeHtml(content)}</pre>`;
}

function renderCommandStep(step) {
  const command = step.command || step.content || "";
  const output = step.output || step.result || "";
  let html = "";
  if (command) html += `<div class="ix-step-cmd"><span class="ix-step-prompt">$</span> ${escapeHtml(command)}</div>`;
  if (output) html += `<pre class="ix-step-output">${escapeHtml(output)}</pre>`;
  return html;
}

function renderSearchStep(step) {
  const pattern = step.pattern || step.query || "";
  const results = step.results || [];
  const content = step.content || "";
  let html = "";
  if (pattern) html += `<div class="ix-step-pattern">${escapeHtml(pattern)}</div>`;
  if (results.length > 0) {
    html += `<ul class="ix-step-results">${results.map((r) => `<li>${escapeHtml(typeof r === "string" ? r : r.file || r.match || JSON.stringify(r))}</li>`).join("")}</ul>`;
  } else if (content) {
    html += `<pre class="ix-step-content">${escapeHtml(content)}</pre>`;
  }
  return html;
}

function renderAgentStep(step) {
  const purpose = step.purpose || step.description || "";
  const result = step.result || step.summary || "";
  let html = "";
  if (purpose) html += `<div class="ix-step-purpose">${escapeHtml(purpose)}</div>`;
  if (result) html += `<div class="ix-step-result">${escapeHtml(result)}</div>`;
  return html;
}

function renderActionItem(action, index) {
  const id = action.id || `ACT-${String(index + 1).padStart(3, "0")}`;
  const type = action.type || "recommendation";
  const summary = action.summary || action.name || "";
  const target = action.target || action.command || "";
  const priority = action.priority || "";
  const detail = action.detail || action.criteria || action.acceptance || "";

  const priorityClass = {
    "high": "priority-high",
    "medium": "priority-medium",
    "low": "priority-low",
  }[priority] || "";

  return `
    <div class="ix-action-item ${priorityClass}" data-id="${escapeHtml(id)}">
      <div class="ix-action-header">
        <span class="ix-action-check">&#x25CB;</span>
        <span class="ix-action-summary">${escapeHtml(summary)}</span>
        ${priority ? `<span class="ix-action-priority">${escapeHtml(priority)}</span>` : ""}
      </div>
      ${(target || detail) ? `
        <div class="ix-action-detail">
          ${target ? `<div class="ix-action-target">${escapeHtml(target)}</div>` : ""}
          ${detail ? `<div class="ix-action-criteria">${escapeHtml(detail)}</div>` : ""}
        </div>
      ` : ""}
    </div>
  `;
}

function renderReleaseSummary(release) {
  const headline = release.headline || "";
  const highlights = release.highlights || [];
  const deltas = release.deltas || [];
  const migration = release.migration || "None";

  return `
    <div class="ix-release">
      <div class="ix-release-header">Release Summary</div>
      ${headline ? `<div class="ix-release-headline">${escapeHtml(headline)}</div>` : ""}
      ${highlights.length > 0 ? `
        <ul class="ix-release-highlights">
          ${highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join("")}
        </ul>
      ` : ""}
      ${deltas.length > 0 ? `
        <div class="ix-release-deltas">
          ${deltas.map((d) => `<div class="ix-delta"><span class="ix-delta-section">${escapeHtml(d.section || "")}</span> ${escapeHtml(d.summary || "")}</div>`).join("")}
        </div>
      ` : ""}
      ${migration !== "None" ? `<div class="ix-release-migration"><strong>Migration:</strong> ${escapeHtml(migration)}</div>` : ""}
    </div>
  `;
}

function clearInterchange() {
  currentInterchange = null;
  interchangeFindings.classList.add("hidden");
  interchangeFindings.innerHTML = "";
  interchangeActions.classList.add("hidden");
  interchangeActions.innerHTML = "";
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

let searchFuse = null;

function buildSearchIndex() {
  const links = Array.from(tocNav.querySelectorAll("a"));
  const items = links.map(link => ({
    text: link.textContent.trim(),
    alias: link.dataset.section,
  }));
  if (typeof Fuse !== "undefined") {
    searchFuse = new Fuse(items, {
      keys: [{ name: "text", weight: 2 }, { name: "alias", weight: 1 }],
      threshold: 0.4,
      includeScore: true,
    });
  }
  return items;
}

function updateSearchResults(query) {
  const results = document.getElementById("search-results");
  const links = Array.from(tocNav.querySelectorAll("a"));

  let matches;
  if (!query) {
    matches = links.slice(0, 15).map(l => ({ text: l.textContent.trim(), alias: l.dataset.section }));
  } else if (searchFuse) {
    const fuseResults = searchFuse.search(query);
    matches = fuseResults.slice(0, 20).map(r => r.item);
  } else {
    // Fallback to substring matching if fuse.js didn't load
    const q = query.toLowerCase();
    matches = links
      .filter(l => l.textContent.toLowerCase().includes(q) || l.dataset.section.toLowerCase().includes(q))
      .slice(0, 20)
      .map(l => ({ text: l.textContent.trim(), alias: l.dataset.section }));
  }

  results.innerHTML = matches
    .map((item, i) =>
      `<li class="search-item${i === searchSelectedIndex ? " selected" : ""}"
           data-section="${escapeHtml(item.alias)}">${escapeHtml(item.text)}
           <span class="search-alias">#${escapeHtml(item.alias)}</span></li>`
    )
    .join("");

  for (const el of results.querySelectorAll(".search-item")) {
    el.addEventListener("click", () => {
      const target = document.getElementById(el.dataset.section);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        setActiveSection(el.dataset.section);
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

// --- Automatic Spec Diagramming ---

let diagramDefinitions = {}; // alias -> { type: { type, source } }
let diagramStates = {}; // alias -> boolean (true = showing diagram)
let globalDiagramMode = false;
let mermaidReady = false;

function initMermaid() {
  if (typeof mermaid === "undefined") return;
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? "dark" : "default",
    themeVariables: isDark ? {
      primaryColor: "#2b2b2f",
      primaryTextColor: "#ededef",
      primaryBorderColor: "#52525b",
      lineColor: "#71717a",
      secondaryColor: "#232326",
      tertiaryColor: "#313136",
      nodeTextColor: "#ededef",
    } : {},
    flowchart: { curve: "basis" },
    er: { useMaxWidth: true },
  });
  mermaidReady = true;
}

async function loadDiagrams() {
  const q = currentProjectPath ? `?project=${encodeURIComponent(currentProjectPath)}` : "";
  try {
    const res = await fetch(`/api/diagrams${q}`);
    if (!res.ok) return;
    const data = await res.json();
    diagramDefinitions = data.diagrams || {};
    injectDiagramToggles();
  } catch {
    // Diagrams unavailable
  }
}

function injectDiagramToggles() {
  const headings = specContent.querySelectorAll("h1, h2, h3, h4");
  for (const heading of headings) {
    const alias = heading.id;
    if (!alias || !diagramDefinitions[alias]) continue;

    // Don't add duplicate toggles
    if (heading.querySelector(".diagram-toggle")) continue;

    const btn = document.createElement("button");
    btn.className = "diagram-toggle";
    btn.title = "Toggle diagram (d)";
    btn.textContent = "\u25E8"; // box with right half black — diagram icon
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSectionDiagram(alias);
    });
    heading.style.position = "relative";
    heading.appendChild(btn);
  }
}

async function toggleSectionDiagram(alias) {
  if (!diagramDefinitions[alias]) return;
  if (!mermaidReady) initMermaid();

  const heading = document.getElementById(alias);
  if (!heading) return;

  const isShowing = diagramStates[alias] || false;

  if (isShowing) {
    // Restore text content
    const diagramContainer = heading.parentElement?.querySelector(`.diagram-container[data-alias="${alias}"]`);
    if (diagramContainer) {
      diagramContainer.classList.add("diagram-fade-out");
      setTimeout(() => diagramContainer.remove(), 200);
    }
    // Show text siblings
    showSectionContent(heading, true);
    diagramStates[alias] = false;
  } else {
    // Generate and show diagram
    const defs = diagramDefinitions[alias];
    // Pick the first available diagram type for this section
    const def = Object.values(defs)[0];
    if (!def || !def.source) return;

    // Hide text siblings
    showSectionContent(heading, false);

    const container = document.createElement("div");
    container.className = "diagram-container";
    container.dataset.alias = alias;
    container.dataset.source = def.source;

    try {
      const id = `diagram-${alias}-${Date.now()}`;
      const { svg } = await mermaid.render(id, def.source);
      container.innerHTML = svg;
    } catch (err) {
      container.innerHTML = `<div class="diagram-error">Could not render diagram: ${escapeHtml(err.message)}</div>`;
    }

    // Insert after heading
    heading.after(container);
    diagramStates[alias] = true;
  }

  // Update toggle icon state
  const toggleBtn = heading.querySelector(".diagram-toggle");
  if (toggleBtn) {
    toggleBtn.classList.toggle("active", diagramStates[alias] || false);
  }
}

function showSectionContent(heading, show) {
  // Show/hide content elements between this heading and the next heading
  let el = heading.nextElementSibling;
  while (el) {
    if (el.matches("h1, h2, h3, h4")) break;
    if (el.classList?.contains("diagram-container")) {
      el = el.nextElementSibling;
      continue;
    }
    el.style.display = show ? "" : "none";
    el = el.nextElementSibling;
  }
}

function toggleGlobalDiagrams() {
  globalDiagramMode = !globalDiagramMode;
  const aliases = Object.keys(diagramDefinitions);
  for (const alias of aliases) {
    // When readiness filter is active, only toggle visible sections
    const heading = document.getElementById(alias);
    if (heading && heading.offsetParent === null) continue;

    const isShowing = diagramStates[alias] || false;
    if (globalDiagramMode && !isShowing) {
      toggleSectionDiagram(alias);
    } else if (!globalDiagramMode && isShowing) {
      toggleSectionDiagram(alias);
    }
  }
}

function getCurrentSectionAlias() {
  // Find the heading currently in the scroll viewport (skip hidden/filtered sections)
  const headings = specContent.querySelectorAll("h2, h3, h4");
  let closest = null;
  let closestDist = Infinity;
  for (const h of headings) {
    if (h.offsetParent === null) continue; // Skip hidden headings
    const rect = h.getBoundingClientRect();
    const dist = Math.abs(rect.top - 80);
    if (dist < closestDist) {
      closestDist = dist;
      closest = h;
    }
  }
  return closest?.id || null;
}

async function reRenderDiagrams() {
  // Re-initialize mermaid with current theme
  initMermaid();

  // Re-render all visible diagrams
  const containers = document.querySelectorAll(".diagram-container");
  for (const container of containers) {
    const source = container.dataset.source;
    if (!source) continue;
    const alias = container.dataset.alias;

    container.classList.add("diagram-fade-out");
    await new Promise(r => setTimeout(r, 150));

    try {
      const id = `diagram-${alias}-${Date.now()}`;
      const { svg } = await mermaid.render(id, source);
      container.innerHTML = svg;
    } catch {
      // Keep existing render
    }

    container.classList.remove("diagram-fade-out");
  }
}

// --- Keyboard Shortcuts ---

document.addEventListener("keydown", (e) => {
  // Ctrl+K or Cmd+K — section search
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    openSearch();
    return;
  }

  // Escape — close topmost overlay first, then fall through
  if (e.key === "Escape") {
    // Search overlay is z-index 100 — close it first if visible
    if (searchOverlay && searchOverlay.classList.contains("visible")) {
      closeSearch();
      return;
    }
    // Detail panel is z-index 55 — close next
    if (detailPanelOpen) {
      closeDetailPanel();
      return;
    }
    if (activeReadinessFilter) {
      clearReadinessFilter();
      return;
    }
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

  // 3 — switch to Lessons tab
  if (e.key === "3") {
    e.preventDefault();
    switchTab("lessons");
    return;
  }

  // 4 — switch to Memory tab
  if (e.key === "4") {
    e.preventDefault();
    switchTab("memory");
    return;
  }

  // ] — toggle right rail (inbox)
  if (e.key === "]") {
    e.preventDefault();
    toggleRightRail();
    return;
  }

  // d — toggle diagram for current section
  if (e.key === "d") {
    e.preventDefault();
    const alias = getCurrentSectionAlias();
    if (alias && diagramDefinitions[alias]) {
      toggleSectionDiagram(alias);
    }
    return;
  }

  // D (shift+d) — toggle all diagrams globally
  if (e.key === "D") {
    e.preventDefault();
    toggleGlobalDiagrams();
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
        <dt>3</dt><dd>Show build lessons</dd>
        <dt>4</dt><dd>Show memory</dd>
        <dt>d</dt><dd>Toggle diagram for current section</dd>
        <dt>D</dt><dd>Toggle all diagrams globally</dd>
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
      // Normalize readiness: "partial 30/40" -> category "partial"
      const rawReadiness = s.readiness || "";
      const baseReadiness = rawReadiness.startsWith("partial") ? "partial" : rawReadiness;
      if (s.alias) {
        sectionReadiness[s.alias] = baseReadiness;
      }
      if (s.heading) {
        // Also key by slugified heading to match DOM IDs for sections with or without aliases.
        // DOM renderer slugifies the full heading text (e.g., "2.1 First Run" → "21-first-run")
        // using the same chain: lowercase → strip non-[word/space/dash] → collapse spaces → collapse dashes.
        // We reconstruct the full text (number + heading) and apply the same transform.
        const fullText = (s.number ? s.number + " " : "") + s.heading;
        const slug = fullText
          .toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
        sectionReadiness[slug] = baseReadiness;
      }
      if (baseReadiness) {
        readinessCounts[baseReadiness] = (readinessCounts[baseReadiness] || 0) + 1;
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
  "partial",
  "deferred",
  "ready-to-build",
  "undocumented",
  "draft",
];

const readinessLabels = {
  "satisfied": "satisfied",
  "ready-to-execute": "ready",
  "aligned": "aligned",
  "partial": "partial",
  "deferred": "deferred",
  "ready-to-build": "ready to build",
  "undocumented": "undocumented",
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
  if (a.note && item.type === "reference") {
    html += `<div class="inbox-analysis-note">${escapeHtml(a.note)}</div>`;
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

// --- Kanban Quick-Add Input ---

const quickAddInput = document.getElementById("kanban-quick-input");
const quickAddSubmit = document.getElementById("kanban-quick-submit");
const quickAddPills = document.querySelectorAll(".quick-add-pill");
let selectedQuickAddType = "evolve";

if (quickAddPills.length) {
  for (const pill of quickAddPills) {
    pill.addEventListener("click", () => {
      for (const p of quickAddPills) p.classList.remove("active");
      pill.classList.add("active");
      selectedQuickAddType = pill.dataset.type;
      quickAddInput.focus();
    });
  }
}

if (quickAddInput) {
  quickAddInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitQuickAdd();
    }
  });
}

if (quickAddSubmit) {
  quickAddSubmit.addEventListener("click", () => submitQuickAdd());
}

async function submitQuickAdd() {
  if (!quickAddInput) return;
  const content = quickAddInput.value.trim();
  if (!content) return;

  quickAddSubmit.disabled = true;
  quickAddInput.disabled = true;

  try {
    // Determine which project to target
    let targetProject = currentProjectPath;
    if (kanbanLevel === "sections" && kanbanProjectPath) {
      targetProject = kanbanProjectPath;
    } else if (dashboardData && dashboardData.projects && dashboardData.projects.length === 1) {
      targetProject = dashboardData.projects[0].path;
    }

    const q = targetProject ? `?project=${encodeURIComponent(targetProject)}` : "";
    const res = await fetch(`/api/inbox${q}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: selectedQuickAddType, content }),
    });

    if (res.ok) {
      quickAddInput.value = "";
      // Reload inbox items and re-render current kanban level to show new card
      await loadKanbanInbox();
      if (kanbanLevel === "projects" && dashboardData) renderKanban(dashboardData);
      else if (kanbanLevel === "sections") renderLevel2Kanban();
    }
  } catch {
    // Silently fail
  } finally {
    quickAddSubmit.disabled = false;
    quickAddInput.disabled = false;
    quickAddInput.focus();
  }
}

// --- Dashboard ---

async function showDashboard() {
  currentView = "dashboard";
  dashboardView.classList.remove("hidden");
  appView.classList.add("hidden");
  clearProjectAccent();
  await loadPriority();
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
    // Apply accent for current project
    const proj = projectList.find((p) => p.path === currentProjectPath);
    if (proj) applyProjectAccent(proj.name, proj.accentColor || null);
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
    await loadKanbanInbox();
    // Only render project-level kanban if user hasn't drilled into a project
    if (kanbanLevel === "projects") {
      renderKanban(dashboardData);
    }
  } catch (err) {
    if (kanbanLevel === "projects") {
      kanbanBoard.innerHTML =
        `<div class="error-state"><p>Could not load projects: ${escapeHtml(err.message)}</p></div>`;
    }
  }
}

function getProjectColumn(proj, priority) {
  // Satisfied: auto-computed from readiness
  if (proj.readiness.total > 0 && proj.readiness.ready === proj.readiness.total) return "satisfied";

  // Check explicit priority assignment
  const prio = priority.projects || {};
  for (const col of ["now", "next", "later", "inbox"]) {
    if ((prio[col] || []).includes(proj.path)) return col;
  }
  return "next"; // default column
}

function renderProjectCard(proj) {
  const pct = proj.readiness.total > 0 ? Math.round((proj.readiness.ready / proj.readiness.total) * 100) : 0;
  const pctClass = pct >= 80 ? "high" : pct >= 50 ? "medium" : "low";
  const statusClass = proj.build ? "badge-building" : `badge-${proj.specStatus}`;
  const statusLabel = proj.build ? "building" : proj.specStatus;

  let buildHtml = "";
  if (proj.build && proj.build.progress) {
    const { current, total } = proj.build.progress;
    let pills = "";
    for (let i = 1; i <= Math.min(total, 12); i++) {
      const cls = i < current ? "complete" : i === current ? "active" : "";
      pills += `<span class="card-build-pill ${cls}"></span>`;
    }
    buildHtml = `<div class="card-build-progress"><div class="card-build-pills">${pills}</div><span>${current} of ${total}</span></div>`;
  }

  const stats = [];
  if (proj.inbox.pending > 0) stats.push(`<span class="card-stat has-items"><span class="card-stat-icon">\u2709</span>${proj.inbox.pending}</span>`);
  if (proj.untrackedChanges > 0) stats.push(`<span class="card-stat has-items"><span class="card-stat-icon">\u25B3</span>${proj.untrackedChanges}</span>`);

  const upgradeBadge = proj.upgradeStatus === "upgraded"
    ? `<span class="card-badge badge-upgraded">\u2191 upgraded</span>`
    : proj.upgradeStatus === "update-available"
    ? `<span class="card-badge badge-update-available">update available</span>`
    : "";

  const cardAccent = projectAccentColor(proj.name, proj.accentColor || null);
  return `<div class="project-card" draggable="true" data-path="${escapeHtml(proj.path)}" style="--card-accent: ${cardAccent}">
    <div class="project-card-header">
      <span class="project-card-name">${escapeHtml(proj.name)}</span>
      ${proj.externalVersion ? `<span class="project-card-version">${escapeHtml(proj.externalVersion)}</span>` : ""}
    </div>
    <div class="project-card-badges">
      <span class="card-badge ${statusClass}">${escapeHtml(statusLabel)}</span>
      ${upgradeBadge}
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
  </div>`;
}

function renderInboxTriageCard(item) {
  const sections = (item.analysis && item.analysis.affectedSections) || [];
  const sectionsHtml = sections.length > 0
    ? `<div class="inbox-triage-sections">${sections.map(s =>
        `<span class="section-badge">#${escapeHtml(s.alias || s.number)}</span>`
      ).join("")}</div>`
    : "";
  return `<div class="project-card inbox-triage-card" data-inbox-id="${escapeHtml(item.id)}" data-project="${escapeHtml(item.project || "")}">
    <div class="project-card-header">
      <span class="inbox-triage-type type-${escapeHtml(item.type)}">${escapeHtml(item.type)}</span>
      <span class="inbox-item-time" style="font-size:0.65rem;color:var(--text-muted)">${formatTimestamp(item.timestamp)}</span>
    </div>
    <div class="inbox-triage-content">${escapeHtml(item.content)}</div>
    ${sectionsHtml}
  </div>`;
}

let kanbanInboxItems = [];

async function loadKanbanInbox() {
  try {
    // Fetch inbox for each project
    const allItems = [];
    for (const proj of (dashboardData && dashboardData.projects) || []) {
      const res = await fetch(`/api/inbox?project=${encodeURIComponent(proj.path)}`);
      if (res.ok) {
        const items = await res.json();
        for (const item of items) {
          if (item.status !== "incorporated") {
            item.project = proj.path;
            allItems.push(item);
          }
        }
      }
    }
    kanbanInboxItems = allItems;
  } catch {
    kanbanInboxItems = [];
  }
}

function renderKanban(data) {
  // Clean up any toggle left behind from L2 (sections/scenarios)
  const staleToggle = kanbanBoard.previousElementSibling;
  if (staleToggle && staleToggle.classList.contains("kanban-view-toggle")) {
    staleToggle.remove();
  }

  const projects = data.projects || [];

  if (!projects.length) {
    kanbanBoard.innerHTML =
      '<p style="color:var(--text-muted);font-style:italic;">No fctry projects found. Run <code>/fctry:init</code> in a project to get started.</p>';
    return;
  }

  // If only one project and no query param requesting dashboard, go straight to spec
  const urlParams = new URLSearchParams(window.location.search);
  if (projects.length === 1 && !urlParams.has("dashboard")) {
    showSpecView(projects[0].path);
    return;
  }

  // Group projects by column
  const columns = {};
  for (const col of KANBAN_COLUMNS) columns[col] = [];
  for (const proj of projects) {
    const col = getProjectColumn(proj, kanbanPriority);
    columns[col].push(proj);
  }

  // Sort within columns by priority order
  for (const col of KANBAN_COLUMNS) {
    const order = (kanbanPriority.projects || {})[col] || [];
    columns[col].sort((a, b) => {
      const ai = order.indexOf(a.path);
      const bi = order.indexOf(b.path);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }

  // Inject inbox items into Triage column
  const inboxTriageHtml = kanbanInboxItems.map(item => renderInboxTriageCard(item)).join("");

  const columnLabels = { inbox: "Inbox", now: "Now", next: "Next", later: "Later", satisfied: "Satisfied" };

  kanbanBoard.innerHTML = KANBAN_COLUMNS.map(col => {
    const projCards = columns[col].map(proj => renderProjectCard(proj)).join("");
    const triageCards = col === "inbox" ? inboxTriageHtml : "";
    const totalCount = columns[col].length + (col === "inbox" ? kanbanInboxItems.length : 0);
    return `
    <div class="kanban-column" data-column="${col}">
      <div class="kanban-column-header">
        <span>${columnLabels[col]}</span>
        <span class="kanban-column-count">${totalCount}</span>
      </div>
      <div class="kanban-column-body" data-column="${col}">
        ${triageCards}${projCards}
      </div>
    </div>`;
  }).join("");

  // Update breadcrumb
  kanbanBreadcrumb.innerHTML = '<span class="bc-current">Projects</span>';

  // Wire drag-and-drop
  setupKanbanDragDrop();

  // Wire click-to-drill (click card header → sections kanban)
  for (const card of kanbanBoard.querySelectorAll(".project-card:not(.inbox-triage-card)")) {
    card.querySelector(".project-card-header").addEventListener("click", (e) => {
      e.stopPropagation();
      const path = card.dataset.path;
      const name = card.querySelector(".project-card-name")?.textContent || "Project";
      drillToSections(path, name);
    });
    // Double-click bypasses kanban drill-down and opens spec view directly
    card.querySelector(".project-card-header").addEventListener("dblclick", (e) => {
      e.stopPropagation();
      showSpecView(card.dataset.path);
    });
    // Body click (outside header) → open detail panel
    card.addEventListener("click", (e) => {
      if (e.target.closest(".project-card-header")) return;
      const path = card.dataset.path;
      const proj = (dashboardData && dashboardData.projects || []).find(p => p.path === path);
      if (proj) openDetailPanel("project", proj);
    });
  }

  // Wire inbox triage cards: header-click → spec view, body-click → detail panel
  for (const card of kanbanBoard.querySelectorAll(".inbox-triage-card")) {
    card.querySelector(".project-card-header").addEventListener("click", (e) => {
      e.stopPropagation();
      const projPath = card.dataset.project;
      if (projPath) showSpecView(projPath);
    });
    card.addEventListener("click", (e) => {
      if (e.target.closest(".project-card-header")) return;
      const itemId = card.dataset.inboxId;
      const item = kanbanInboxItems.find(i => i.id === itemId);
      if (item) openDetailPanel("inbox", item);
    });
  }
}

// --- Kanban Drag & Drop ---

let draggedCard = null;

function setupKanbanDragDrop() {
  const cards = kanbanBoard.querySelectorAll(".project-card");
  const bodies = kanbanBoard.querySelectorAll(".kanban-column-body");

  for (const card of cards) {
    card.addEventListener("dragstart", (e) => {
      draggedCard = card;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", card.dataset.path);
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      draggedCard = null;
      for (const body of bodies) body.classList.remove("drag-over");
    });
  }

  for (const body of bodies) {
    body.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      body.classList.add("drag-over");

      // Reorder within column: find insertion point
      if (draggedCard && draggedCard.closest(".kanban-column-body") === body) {
        const afterEl = getDragAfterElement(body, e.clientY);
        if (afterEl) {
          body.insertBefore(draggedCard, afterEl);
        } else {
          body.appendChild(draggedCard);
        }
      }
    });

    body.addEventListener("dragleave", (e) => {
      if (!body.contains(e.relatedTarget)) {
        body.classList.remove("drag-over");
      }
    });

    body.addEventListener("drop", (e) => {
      e.preventDefault();
      body.classList.remove("drag-over");
      if (!draggedCard) return;

      const col = body.dataset.column;
      if (col === "satisfied") return; // can't manually drag to satisfied

      // Move card to this column
      const afterEl = getDragAfterElement(body, e.clientY);
      if (afterEl) {
        body.insertBefore(draggedCard, afterEl);
      } else {
        body.appendChild(draggedCard);
      }

      // Persist priority
      savePriorityFromDOM();
    });
  }
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(".project-card:not(.dragging)")];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    }
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element || null;
}

async function savePriorityFromDOM() {
  const prio = { projects: {} };
  for (const col of KANBAN_COLUMNS) {
    if (col === "satisfied") continue; // computed, not stored
    const body = kanbanBoard.querySelector(`.kanban-column-body[data-column="${col}"]`);
    if (!body) continue;
    const paths = [...body.querySelectorAll(".project-card")].map(c => c.dataset.path);
    if (paths.length) prio.projects[col] = paths;
  }
  kanbanPriority = prio;

  // Update column counts
  for (const col of KANBAN_COLUMNS) {
    const body = kanbanBoard.querySelector(`.kanban-column-body[data-column="${col}"]`);
    const header = kanbanBoard.querySelector(`.kanban-column[data-column="${col}"] .kanban-column-count`);
    if (body && header) header.textContent = body.querySelectorAll(".project-card").length;
  }

  // Save to server
  try {
    await fetch("/api/priority", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: prio }),
    });
  } catch (err) {
    console.warn("Failed to save priority:", err);
  }
}

async function loadPriority(projectPath) {
  try {
    const url = projectPath
      ? `/api/priority?project=${encodeURIComponent(projectPath)}`
      : "/api/priority";
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      kanbanPriority = data.priority || {};
    }
  } catch {
    kanbanPriority = {};
  }
}

// --- Kanban Level 2: Sections / Scenarios ---

let kanbanLevel = "projects"; // "projects" | "sections" | "claims"
let kanbanProjectPath = null; // current project path at level 2+
let kanbanProjectName = null;
let kanbanSectionAlias = null; // current section alias at level 3
let kanbanSectionHeading = null;
let sectionsGroupMode = "sections"; // "sections" or "scenarios"
let sectionsData = null;
let scenariosData = null;

function getSectionColumn(section, priority) {
  // Satisfied: auto-computed from readiness
  if (section.readiness === "aligned" || section.readiness === "satisfied") return "satisfied";
  const key = section.alias || section.number;
  const prio = priority.sections || {};
  for (const col of ["now", "next", "later", "inbox"]) {
    if ((prio[col] || []).includes(key)) return col;
  }
  return "next";
}

function getClaimColumn(claim, priority) {
  const prio = priority.claims || {};
  for (const col of ["now", "next", "later", "inbox"]) {
    if ((prio[col] || []).includes(claim)) return col;
  }
  return "next";
}

function renderSectionCard(section) {
  const readinessClass = `readiness-${section.readiness}`;
  const claimCount = section.claims ? section.claims.length : 0;
  return `<div class="project-card section-card" draggable="true" data-key="${escapeHtml(section.alias || section.number)}" style="border-left-color: var(--card-accent, var(--accent))">
    <div class="project-card-header">
      <span class="project-card-name" style="font-size:0.9rem">${escapeHtml(section.heading)}</span>
    </div>
    <div class="project-card-badges">
      <span class="card-badge" style="font-size:0.6rem">${escapeHtml(section.alias ? '#' + section.alias : section.number)}</span>
      <span class="card-badge badge-${section.readiness === 'aligned' ? 'stable' : section.readiness === 'ready-to-build' ? 'draft' : 'active'}">${escapeHtml(section.readiness)}</span>
    </div>
    ${claimCount > 0 ? `<div class="card-stats"><span class="card-stat"><span class="card-stat-icon">\u25A3</span>${claimCount} claims</span></div>` : ""}
  </div>`;
}

function renderClaimCard(claim) {
  return `<div class="project-card claim-card" draggable="true" data-key="${escapeHtml(claim)}" style="border-left-color: var(--card-accent, var(--accent))">
    <div class="project-card-header">
      <span class="project-card-name" style="font-size:0.85rem">${escapeHtml(claim)}</span>
    </div>
  </div>`;
}

async function drillToSections(projectPath, projectName) {
  kanbanLevel = "sections";
  kanbanProjectPath = projectPath;
  kanbanProjectName = projectName;

  kanbanBoard.innerHTML = '<p class="loading">Loading\u2026</p>';

  try {
    const [secRes, scenRes] = await Promise.all([
      fetch(`/api/sections?project=${encodeURIComponent(projectPath)}`),
      fetch(`/api/scenarios?project=${encodeURIComponent(projectPath)}`),
    ]);
    if (!secRes.ok) throw new Error(`HTTP ${secRes.status}`);
    sectionsData = await secRes.json();
    scenariosData = scenRes.ok ? await scenRes.json() : { scenarios: [] };
    await loadPriority(projectPath);
  } catch (err) {
    kanbanBoard.innerHTML = `<div class="error-state"><p>Could not load data: ${escapeHtml(err.message)}</p></div>`;
    return;
  }

  renderLevel2Kanban();
}

function renderLevel2Kanban() {
  if (sectionsGroupMode === "scenarios") {
    renderScenariosKanban();
  } else {
    renderSectionsKanban();
  }
}

function renderSectionsKanban() {
  const sections = (sectionsData && sectionsData.sections) || [];

  // Group by column
  const columns = {};
  for (const col of KANBAN_COLUMNS) columns[col] = [];
  for (const sec of sections) {
    const col = getSectionColumn(sec, kanbanPriority);
    columns[col].push(sec);
  }

  // Sort within columns
  for (const col of KANBAN_COLUMNS) {
    const order = (kanbanPriority.sections || {})[col] || [];
    columns[col].sort((a, b) => {
      const aKey = a.alias || a.number;
      const bKey = b.alias || b.number;
      const ai = order.indexOf(aKey);
      const bi = order.indexOf(bKey);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }

  const columnLabels = { inbox: "Inbox", now: "Now", next: "Next", later: "Later", satisfied: "Satisfied" };

  // Toggle control — insert before kanban-board, not inside it
  let toggleEl = kanbanBoard.previousElementSibling;
  if (toggleEl && toggleEl.classList.contains("kanban-view-toggle")) {
    toggleEl.remove();
  }
  kanbanBoard.insertAdjacentHTML("beforebegin", `<div class="kanban-view-toggle">
    <button class="kanban-toggle-btn ${sectionsGroupMode === 'sections' ? 'active' : ''}" data-mode="sections">Sections</button>
    <button class="kanban-toggle-btn ${sectionsGroupMode === 'scenarios' ? 'active' : ''}" data-mode="scenarios">Scenarios</button>
  </div>`);

  // Filter inbox items for this project
  const projectInbox = kanbanInboxItems.filter(item => item.project === kanbanProjectPath);
  const inboxTriageHtml = projectInbox.map(item => renderInboxTriageCard(item)).join("");

  kanbanBoard.innerHTML = KANBAN_COLUMNS.map(col => {
    const secCards = columns[col].map(sec => renderSectionCard(sec)).join("");
    const triageCards = col === "inbox" ? inboxTriageHtml : "";
    const totalCount = columns[col].length + (col === "inbox" ? projectInbox.length : 0);
    return `
    <div class="kanban-column" data-column="${col}">
      <div class="kanban-column-header">
        <span>${columnLabels[col]}</span>
        <span class="kanban-column-count">${totalCount}</span>
      </div>
      <div class="kanban-column-body" data-column="${col}">
        ${triageCards}${secCards}
      </div>
    </div>`;
  }).join("");

  // Update breadcrumb
  kanbanBreadcrumb.innerHTML = `<span class="bc-link" data-action="projects">Projects</span>
    <span class="bc-sep">\u203A</span>
    <span class="bc-current">${escapeHtml(kanbanProjectName)}</span>
    <span class="bc-sep">\u00B7</span>
    <span class="bc-link" data-action="spec">View Spec</span>`;

  // Wire breadcrumb clicks
  kanbanBreadcrumb.querySelector('[data-action="projects"]').addEventListener("click", () => {
    kanbanLevel = "projects";
    renderKanban(dashboardData);
  });
  kanbanBreadcrumb.querySelector('[data-action="spec"]').addEventListener("click", () => {
    showSpecView(kanbanProjectPath);
  });

  // Wire toggle buttons (toggle is a sibling before kanbanBoard)
  const toggleContainer = kanbanBoard.previousElementSibling;
  if (toggleContainer && toggleContainer.classList.contains("kanban-view-toggle")) {
    for (const btn of toggleContainer.querySelectorAll(".kanban-toggle-btn")) {
      btn.addEventListener("click", () => {
        sectionsGroupMode = btn.dataset.mode;
        renderLevel2Kanban();
      });
    }
  }

  // Wire drag-and-drop (reuse same pattern)
  setupSectionsDragDrop();

  // Wire click-to-drill (section → claims level 3) and body-click → detail panel
  for (const card of kanbanBoard.querySelectorAll(".section-card")) {
    card.querySelector(".project-card-header").addEventListener("click", (e) => {
      e.stopPropagation();
      const key = card.dataset.key;
      const sec = sections.find(s => (s.alias || s.number) === key);
      if (sec && sec.claims && sec.claims.length > 0) {
        drillToClaims(key, sec.heading, sec.claims);
      }
    });
    // Body click (outside header) → open detail panel for section
    card.addEventListener("click", (e) => {
      if (e.target.closest(".project-card-header")) return;
      const key = card.dataset.key;
      const sec = sections.find(s => (s.alias || s.number) === key);
      if (sec) openDetailPanel("section", sec);
    });
  }

  // Wire inbox triage cards at level 2: header-click → spec view, body-click → detail panel
  for (const card of kanbanBoard.querySelectorAll(".inbox-triage-card")) {
    card.querySelector(".project-card-header").addEventListener("click", (e) => {
      e.stopPropagation();
      const projPath = card.dataset.project;
      if (projPath) showSpecView(projPath);
    });
    card.addEventListener("click", (e) => {
      if (e.target.closest(".project-card-header")) return;
      const itemId = card.dataset.inboxId;
      const item = kanbanInboxItems.find(i => i.id === itemId);
      if (item) openDetailPanel("inbox", item);
    });
  }
}

// --- Scenarios kanban rendering ---

function getScenarioColumn(scenario, priority) {
  const key = scenario.title;
  const prio = priority.scenarios || {};
  for (const col of ["now", "next", "later", "inbox"]) {
    if ((prio[col] || []).includes(key)) return col;
  }
  return "next";
}

function renderScenarioCard(scenario) {
  const sectionTags = scenario.validates.map(v =>
    `<span class="card-badge" style="font-size:0.6rem">#${escapeHtml(v.alias)}</span>`
  ).join("");
  const feature = scenario.feature;
  const categoryShort = feature ? { "Core Workflow": "Core", "Build": "Build", "Viewer": "Viewer", "System Quality": "SQ" }[feature.category] || feature.category : "";
  const featureLabel = feature ? feature.name : "";
  const tierClass = scenario.tier === "Critical" ? "badge-critical" : scenario.tier === "Edge Cases" ? "badge-edge" : "badge-polish";
  return `<div class="project-card scenario-card" draggable="true" data-key="${escapeHtml(scenario.title)}" style="border-left-color: var(--card-accent, var(--accent))">
    <div class="project-card-header">
      <span class="project-card-name" style="font-size:0.85rem">${escapeHtml(scenario.title)}</span>
    </div>
    <div class="project-card-badges">
      ${categoryShort ? `<span class="card-badge badge-active" style="font-size:0.6rem">${escapeHtml(categoryShort)}</span>` : ""}
      ${featureLabel ? `<span class="card-badge" style="font-size:0.6rem">${escapeHtml(featureLabel)}</span>` : ""}
      ${sectionTags}
    </div>
  </div>`;
}

function renderScenariosKanban() {
  const scenarios = (scenariosData && scenariosData.scenarios) || [];

  const columns = {};
  for (const col of KANBAN_COLUMNS) columns[col] = [];
  for (const scen of scenarios) {
    const col = getScenarioColumn(scen, kanbanPriority);
    columns[col].push(scen);
  }

  // Sort within columns by priority order
  for (const col of KANBAN_COLUMNS) {
    const order = (kanbanPriority.scenarios || {})[col] || [];
    columns[col].sort((a, b) => {
      const ai = order.indexOf(a.title);
      const bi = order.indexOf(b.title);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }

  const columnLabels = { inbox: "Inbox", now: "Now", next: "Next", later: "Later", satisfied: "Satisfied" };

  // Toggle control — insert before kanban-board, not inside it
  let toggleEl = kanbanBoard.previousElementSibling;
  if (toggleEl && toggleEl.classList.contains("kanban-view-toggle")) {
    toggleEl.remove();
  }
  kanbanBoard.insertAdjacentHTML("beforebegin", `<div class="kanban-view-toggle">
    <button class="kanban-toggle-btn ${sectionsGroupMode === 'sections' ? 'active' : ''}" data-mode="sections">Sections</button>
    <button class="kanban-toggle-btn ${sectionsGroupMode === 'scenarios' ? 'active' : ''}" data-mode="scenarios">Scenarios</button>
  </div>`);

  // Filter inbox items for this project (same pattern as renderSectionsKanban)
  const projectInbox = kanbanInboxItems.filter(item => item.project === kanbanProjectPath);
  const inboxTriageHtml = projectInbox.map(item => renderInboxTriageCard(item)).join("");

  kanbanBoard.innerHTML = KANBAN_COLUMNS.map(col => {
    const cards = columns[col].map(scen => renderScenarioCard(scen)).join("");
    const triageCards = col === "inbox" ? inboxTriageHtml : "";
    const totalCount = columns[col].length + (col === "inbox" ? projectInbox.length : 0);
    return `
    <div class="kanban-column" data-column="${col}">
      <div class="kanban-column-header">
        <span>${columnLabels[col]}</span>
        <span class="kanban-column-count">${totalCount}</span>
      </div>
      <div class="kanban-column-body" data-column="${col}">
        ${triageCards}${cards}
      </div>
    </div>`;
  }).join("");

  // Update breadcrumb
  kanbanBreadcrumb.innerHTML = `<span class="bc-link" data-action="projects">Projects</span>
    <span class="bc-sep">\u203A</span>
    <span class="bc-current">${escapeHtml(kanbanProjectName)}</span>
    <span class="bc-sep">\u00B7</span>
    <span class="bc-link" data-action="spec">View Spec</span>`;

  kanbanBreadcrumb.querySelector('[data-action="projects"]').addEventListener("click", () => {
    kanbanLevel = "projects";
    renderKanban(dashboardData);
  });
  kanbanBreadcrumb.querySelector('[data-action="spec"]').addEventListener("click", () => {
    showSpecView(kanbanProjectPath);
  });

  // Wire toggle buttons
  const toggleContainer = kanbanBoard.previousElementSibling;
  if (toggleContainer && toggleContainer.classList.contains("kanban-view-toggle")) {
    for (const btn of toggleContainer.querySelectorAll(".kanban-toggle-btn")) {
      btn.addEventListener("click", () => {
        sectionsGroupMode = btn.dataset.mode;
        renderLevel2Kanban();
      });
    }
  }

  // Wire drag-and-drop for scenario cards
  setupScenariosDragDrop();

  // Wire scenario card body-click → detail panel
  const scenarioList = (scenariosData && scenariosData.scenarios) || [];
  for (const card of kanbanBoard.querySelectorAll(".scenario-card")) {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".project-card-header")) return;
      const key = card.dataset.key;
      const scen = scenarioList.find(s => s.title === key);
      if (scen) openDetailPanel("scenario", scen);
    });
  }

  // Wire inbox triage cards at scenarios level: header-click → spec view, body-click → detail panel
  for (const card of kanbanBoard.querySelectorAll(".inbox-triage-card")) {
    card.querySelector(".project-card-header").addEventListener("click", (e) => {
      e.stopPropagation();
      const projPath = card.dataset.project;
      if (projPath) showSpecView(projPath);
    });
    card.addEventListener("click", (e) => {
      if (e.target.closest(".project-card-header")) return;
      const itemId = card.dataset.inboxId;
      const item = kanbanInboxItems.find(i => i.id === itemId);
      if (item) openDetailPanel("inbox", item);
    });
  }
}

function setupScenariosDragDrop() {
  const cards = kanbanBoard.querySelectorAll(".scenario-card");
  const bodies = kanbanBoard.querySelectorAll(".kanban-column-body");

  for (const card of cards) {
    card.addEventListener("dragstart", (e) => {
      draggedCard = card;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", card.dataset.key);
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      draggedCard = null;
      for (const body of bodies) body.classList.remove("drag-over");
    });
  }

  for (const body of bodies) {
    body.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      body.classList.add("drag-over");
      if (draggedCard && draggedCard.closest(".kanban-column-body") === body) {
        const afterEl = getDragAfterElement(body, e.clientY);
        if (afterEl) body.insertBefore(draggedCard, afterEl);
        else body.appendChild(draggedCard);
      }
    });
    body.addEventListener("dragleave", (e) => {
      if (!body.contains(e.relatedTarget)) body.classList.remove("drag-over");
    });
    body.addEventListener("drop", (e) => {
      e.preventDefault();
      body.classList.remove("drag-over");
      if (!draggedCard) return;
      const col = body.dataset.column;
      if (col === "satisfied") return;
      const afterEl = getDragAfterElement(body, e.clientY);
      if (afterEl) body.insertBefore(draggedCard, afterEl);
      else body.appendChild(draggedCard);
      saveScenariosPriorityFromDOM();
    });
  }
}

async function saveScenariosPriorityFromDOM() {
  if (!kanbanPriority.scenarios) kanbanPriority.scenarios = {};
  for (const col of KANBAN_COLUMNS) {
    if (col === "satisfied") continue;
    const body = kanbanBoard.querySelector(`.kanban-column-body[data-column="${col}"]`);
    if (!body) continue;
    const keys = [...body.querySelectorAll(".scenario-card")].map(c => c.dataset.key);
    if (keys.length) kanbanPriority.scenarios[col] = keys;
    else delete kanbanPriority.scenarios[col];
  }

  for (const col of KANBAN_COLUMNS) {
    const body = kanbanBoard.querySelector(`.kanban-column-body[data-column="${col}"]`);
    const header = kanbanBoard.querySelector(`.kanban-column[data-column="${col}"] .kanban-column-count`);
    if (body && header) header.textContent = body.querySelectorAll(".scenario-card").length;
  }

  try {
    await fetch(`/api/priority?project=${encodeURIComponent(kanbanProjectPath)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: kanbanPriority }),
    });
  } catch (err) {
    console.warn("Failed to save scenario priority:", err);
  }
}

function setupSectionsDragDrop() {
  const cards = kanbanBoard.querySelectorAll(".section-card");
  const bodies = kanbanBoard.querySelectorAll(".kanban-column-body");

  for (const card of cards) {
    card.addEventListener("dragstart", (e) => {
      draggedCard = card;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", card.dataset.key);
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      draggedCard = null;
      for (const body of bodies) body.classList.remove("drag-over");
    });
  }

  for (const body of bodies) {
    body.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      body.classList.add("drag-over");
      if (draggedCard && draggedCard.closest(".kanban-column-body") === body) {
        const afterEl = getDragAfterElement(body, e.clientY);
        if (afterEl) body.insertBefore(draggedCard, afterEl);
        else body.appendChild(draggedCard);
      }
    });
    body.addEventListener("dragleave", (e) => {
      if (!body.contains(e.relatedTarget)) body.classList.remove("drag-over");
    });
    body.addEventListener("drop", (e) => {
      e.preventDefault();
      body.classList.remove("drag-over");
      if (!draggedCard) return;
      const col = body.dataset.column;
      if (col === "satisfied") return;
      const afterEl = getDragAfterElement(body, e.clientY);
      if (afterEl) body.insertBefore(draggedCard, afterEl);
      else body.appendChild(draggedCard);
      saveSectionsPriorityFromDOM();
    });
  }
}

async function saveSectionsPriorityFromDOM() {
  if (!kanbanPriority.sections) kanbanPriority.sections = {};
  for (const col of KANBAN_COLUMNS) {
    if (col === "satisfied") continue;
    const body = kanbanBoard.querySelector(`.kanban-column-body[data-column="${col}"]`);
    if (!body) continue;
    const keys = [...body.querySelectorAll(".section-card")].map(c => c.dataset.key);
    if (keys.length) kanbanPriority.sections[col] = keys;
    else delete kanbanPriority.sections[col];
  }

  // Update counts
  for (const col of KANBAN_COLUMNS) {
    const body = kanbanBoard.querySelector(`.kanban-column-body[data-column="${col}"]`);
    const header = kanbanBoard.querySelector(`.kanban-column[data-column="${col}"] .kanban-column-count`);
    if (body && header) header.textContent = body.querySelectorAll(".section-card, .claim-card").length;
  }

  try {
    await fetch(`/api/priority?project=${encodeURIComponent(kanbanProjectPath)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: kanbanPriority }),
    });
  } catch (err) {
    console.warn("Failed to save section priority:", err);
  }
}

// --- Kanban Level 3: Claims ---

function drillToClaims(sectionKey, sectionHeading, claims) {
  kanbanLevel = "claims";
  kanbanSectionAlias = sectionKey;
  kanbanSectionHeading = sectionHeading;

  const columns = {};
  for (const col of KANBAN_COLUMNS) columns[col] = [];
  for (const claim of claims) {
    const col = getClaimColumn(claim, kanbanPriority);
    columns[col].push(claim);
  }

  const columnLabels = { inbox: "Inbox", now: "Now", next: "Next", later: "Later", satisfied: "Satisfied" };

  kanbanBoard.innerHTML = KANBAN_COLUMNS.map(col => `
    <div class="kanban-column" data-column="${col}">
      <div class="kanban-column-header">
        <span>${columnLabels[col]}</span>
        <span class="kanban-column-count">${columns[col].length}</span>
      </div>
      <div class="kanban-column-body" data-column="${col}">
        ${columns[col].map(claim => renderClaimCard(claim)).join("")}
      </div>
    </div>
  `).join("");

  // Update breadcrumb
  kanbanBreadcrumb.innerHTML = `<span class="bc-link" data-action="projects">Projects</span>
    <span class="bc-sep">\u203A</span>
    <span class="bc-link" data-action="sections">${escapeHtml(kanbanProjectName)}</span>
    <span class="bc-sep">\u203A</span>
    <span class="bc-current">#${escapeHtml(sectionKey)}</span>`;

  kanbanBreadcrumb.querySelector('[data-action="projects"]').addEventListener("click", () => {
    kanbanLevel = "projects";
    renderKanban(dashboardData);
  });
  kanbanBreadcrumb.querySelector('[data-action="sections"]').addEventListener("click", () => {
    drillToSections(kanbanProjectPath, kanbanProjectName);
  });

  // Wire drag-and-drop for claims
  setupClaimsDragDrop();

  // Wire claim card body-click → detail panel
  for (const card of kanbanBoard.querySelectorAll(".claim-card")) {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".project-card-header")) return;
      const text = card.dataset.key;
      openDetailPanel("claim", { text });
    });
  }
}

function setupClaimsDragDrop() {
  const cards = kanbanBoard.querySelectorAll(".claim-card");
  const bodies = kanbanBoard.querySelectorAll(".kanban-column-body");

  for (const card of cards) {
    card.addEventListener("dragstart", (e) => {
      draggedCard = card;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", card.dataset.key);
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      draggedCard = null;
      for (const body of bodies) body.classList.remove("drag-over");
    });
  }

  for (const body of bodies) {
    body.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      body.classList.add("drag-over");
      if (draggedCard && draggedCard.closest(".kanban-column-body") === body) {
        const afterEl = getDragAfterElement(body, e.clientY);
        if (afterEl) body.insertBefore(draggedCard, afterEl);
        else body.appendChild(draggedCard);
      }
    });
    body.addEventListener("dragleave", (e) => {
      if (!body.contains(e.relatedTarget)) body.classList.remove("drag-over");
    });
    body.addEventListener("drop", (e) => {
      e.preventDefault();
      body.classList.remove("drag-over");
      if (!draggedCard) return;
      if (body.dataset.column === "satisfied") return;
      const afterEl = getDragAfterElement(body, e.clientY);
      if (afterEl) body.insertBefore(draggedCard, afterEl);
      else body.appendChild(draggedCard);
      saveClaimsPriorityFromDOM();
    });
  }
}

async function saveClaimsPriorityFromDOM() {
  if (!kanbanPriority.claims) kanbanPriority.claims = {};
  for (const col of KANBAN_COLUMNS) {
    if (col === "satisfied") continue;
    const body = kanbanBoard.querySelector(`.kanban-column-body[data-column="${col}"]`);
    if (!body) continue;
    const keys = [...body.querySelectorAll(".claim-card")].map(c => c.dataset.key);
    if (keys.length) kanbanPriority.claims[col] = keys;
    else delete kanbanPriority.claims[col];
  }

  for (const col of KANBAN_COLUMNS) {
    const body = kanbanBoard.querySelector(`.kanban-column-body[data-column="${col}"]`);
    const header = kanbanBoard.querySelector(`.kanban-column[data-column="${col}"] .kanban-column-count`);
    if (body && header) header.textContent = body.querySelectorAll(".claim-card").length;
  }

  try {
    await fetch(`/api/priority?project=${encodeURIComponent(kanbanProjectPath)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: kanbanPriority }),
    });
  } catch (err) {
    console.warn("Failed to save claims priority:", err);
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

  // Initialize mermaid and load diagrams
  initMermaid();
  loadDiagrams();
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
