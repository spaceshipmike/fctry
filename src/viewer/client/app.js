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
let changelogEntries = []; // parsed changelog entries for change annotations

// --- Dashboard / Kanban State ---

const dashboardView = document.getElementById("dashboard-view");
const kanbanBoard = document.getElementById("kanban-board");
const kanbanBreadcrumb = document.getElementById("kanban-breadcrumb");
const dashboardSubtitle = document.getElementById("dashboard-subtitle");
const dashboardStatusDot = document.getElementById("dashboard-connection-status");
const appView = document.getElementById("app");
const backToDashboard = document.getElementById("topbar-back");
const topbarProjectName = document.getElementById("topbar-project-name");
const topbarVersion = document.getElementById("topbar-version");
const topbarSpecVersion = document.getElementById("topbar-spec-version");
const topbarBuildLabel = document.getElementById("topbar-build-label");
const topbarCtxFill = document.getElementById("topbar-ctx-fill");
const topbarCtxPct = document.getElementById("topbar-ctx-pct");
const topbarSearch = document.getElementById("topbar-search");
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

let mcManualToggle = false; // true when user manually toggled MC via shortcut/button
let mcEventBuffer = []; // buffered build events when MC is not visible
const MC_EVENT_BUFFER_LIMIT = 200;

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

  // Wire depth-tier toggle buttons (section detail panels)
  if (cardType === "section") {
    wireDetailTierButtons();
  }
}

function wireDetailTierButtons() {
  const toggleContainer = detailPanelBody.querySelector(".detail-tier-toggle");
  if (!toggleContainer || !currentDetailTiers) return;
  const tiers = currentDetailTiers;

  for (const btn of toggleContainer.querySelectorAll(".detail-tier-btn")) {
    btn.addEventListener("click", () => {
      const tier = btn.dataset.tier;
      currentDetailTier = tier;
      localStorage.setItem("fctry-detail-tier", tier);
      // Update active state
      for (const b of toggleContainer.querySelectorAll(".detail-tier-btn")) {
        b.classList.toggle("active", b.dataset.tier === tier);
      }
      // Re-render content for the selected tier
      const contentEl = detailPanelBody.querySelector(".detail-tier-content");
      if (contentEl) {
        contentEl.innerHTML = renderTieredContent(tiers, tier);
        highlightDetailCodeBlocks();
      }
    });
  }

  // Syntax-highlight code blocks in the initial render
  highlightDetailCodeBlocks();
}

function highlightDetailCodeBlocks() {
  const blocks = detailPanelBody.querySelectorAll("pre code");
  for (const block of blocks) {
    if (block.dataset.highlighted) continue;
    block.dataset.highlighted = "true";
    if (typeof highlightSyntax === "function") {
      block.innerHTML = highlightSyntax(block.textContent);
    }
  }
}

function closeDetailPanel() {
  detailPanel.classList.remove("open");
  detailPanelBackdrop.classList.remove("visible");
  detailPanelOpen = false;
}

// --- Depth-Tiered Section Content ---

const DETAIL_TIERS = ["overview", "detail", "deep-dive"];
let currentDetailTier = localStorage.getItem("fctry-detail-tier") || "overview";
let currentDetailTiers = null; // parsed tiers for the currently open section

function parseSectionTiers(body) {
  if (!body) return { overview: "", detail: "", deepDive: "" };
  const lines = body.split("\n");

  // Overview: first paragraph + subsection heading list
  const overviewLines = [];
  const subsectionHeadings = [];
  let inFirstParagraph = true;
  let foundFirstContent = false;

  for (const line of lines) {
    // Collect subsection headings (#### or deeper)
    const subMatch = line.match(/^(#{3,6})\s+(.+)/);
    if (subMatch) {
      subsectionHeadings.push(subMatch[2].replace(/\s*\{#[\w-]+\}/, "").trim());
      inFirstParagraph = false;
      continue;
    }
    if (inFirstParagraph) {
      if (line.trim() === "" && foundFirstContent) {
        inFirstParagraph = false;
      } else if (line.trim() !== "") {
        foundFirstContent = true;
        overviewLines.push(line);
      }
    }
  }

  const overviewText = overviewLines.join("\n");
  const subsectionList = subsectionHeadings.length > 0
    ? "\n\n**Subsections:** " + subsectionHeadings.join(" | ")
    : "";

  // Detail: full content without code blocks
  const detailLines = [];
  let inCodeBlock = false;
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (!inCodeBlock) {
      detailLines.push(line);
    }
  }

  return {
    overview: overviewText + subsectionList,
    detail: detailLines.join("\n").trim(),
    deepDive: body,
  };
}

function renderTieredContent(tiers, currentTier) {
  const content = currentTier === "overview" ? tiers.overview
    : currentTier === "detail" ? tiers.detail
    : tiers.deepDive;
  if (!content || !content.trim()) return '<div class="detail-empty">No content available</div>';
  const rawHtml = marked.parse(content);
  return DOMPurify.sanitize(rawHtml, { ADD_TAGS: ["ins", "del"] });
}

function renderDetailContent(cardType, data) {
  if (cardType === "section") {
    const alias = data.alias ? `#${escapeHtml(data.alias)}` : escapeHtml(data.number || "");
    const readiness = data.readiness || "unknown";
    const claims = data.claims || [];
    const body = data.body || "";
    const tiers = parseSectionTiers(body);
    let html = `<div class="detail-heading">${escapeHtml(data.heading || "")}</div>`;
    html += `<div class="detail-meta">`;
    if (alias) html += `<span class="detail-badge detail-badge-alias">${alias}</span>`;
    html += `<span class="detail-badge detail-badge-readiness" data-readiness="${escapeHtml(readiness)}">${escapeHtml(readiness)}</span>`;
    if (data.number) html += `<span class="detail-badge detail-badge-type">${escapeHtml(data.number)}</span>`;
    html += `</div>`;

    // Depth-tier toggle controls
    if (body) {
      currentDetailTiers = tiers;
      html += `<div class="detail-tier-toggle">`;
      for (const tier of DETAIL_TIERS) {
        const label = tier === "deep-dive" ? "Deep Dive" : tier.charAt(0).toUpperCase() + tier.slice(1);
        const active = tier === currentDetailTier ? " active" : "";
        html += `<button class="detail-tier-btn${active}" data-tier="${tier}">${label}</button>`;
      }
      html += `</div>`;
      html += `<div class="detail-tier-content">${renderTieredContent(tiers, currentDetailTier)}</div>`;
    }

    if (claims.length > 0) {
      html += `<div class="detail-section-label">Claims (${claims.length})</div>`;
      html += `<ul class="detail-claims-list">`;
      for (const claim of claims) {
        html += `<li class="detail-claim-item">${escapeHtml(claim)}</li>`;
      }
      html += `</ul>`;
    } else if (!body) {
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
    const statusM = body.match(/\*\*Status:\*\*\s*(\w+)/);
    const confidenceM = body.match(/\*\*Confidence:\*\*\s*(\d+)/);
    const triggerM = body.match(/\*\*Trigger:\*\*\s*(.+)/);
    const componentM = body.match(/\*\*Component:\*\*\s*(.+)/);
    const severityM = body.match(/\*\*Severity:\*\*\s*(\w+)/);
    const tagsM = body.match(/\*\*Tags:\*\*\s*(.+)/);
    const contextM = body.match(/\*\*Context:\*\*\s*(.+)/);
    const outcomeM = body.match(/\*\*Outcome:\*\*\s*(.+)/);
    const lessonM = body.match(/\*\*Lesson:\*\*\s*(.+)/);
    lessons.push({
      timestamp: positions[i].timestamp,
      alias: positions[i].alias,
      number: positions[i].number,
      status: statusM ? statusM[1].trim() : "active",
      confidence: confidenceM ? parseInt(confidenceM[1], 10) : 3,
      trigger: triggerM ? triggerM[1].trim() : "",
      component: componentM ? componentM[1].trim() : "",
      severity: severityM ? severityM[1].trim() : "",
      tags: tagsM ? tagsM[1].trim() : "",
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
      const isCandidate = item.status === "candidate";
      const statusClass = isCandidate ? " lessons-candidate" : "";
      const statusLabel = isCandidate
        ? `<span class="lessons-status candidate">candidate (${item.confidence}/3)</span>`
        : `<span class="lessons-status active">active</span>`;
      html += `<div class="lessons-entry${statusClass}">`;
      html += `<div class="lessons-meta"><span class="lessons-date">${escapeHtml(date)}</span> ${statusLabel} <span class="lessons-trigger">${escapeHtml(triggerLabel)}</span></div>`;
      html += `<div class="lessons-text">${escapeHtml(item.lesson)}</div>`;
      if (item.component || item.severity || item.tags) {
        html += `<div class="lessons-metadata">`;
        if (item.component) html += `<span class="memory-component">${escapeHtml(item.component)}</span>`;
        if (item.severity) html += `<span class="memory-severity memory-severity-${escapeHtml(item.severity)}">${escapeHtml(item.severity)}</span>`;
        if (item.tags) html += `<span class="memory-tags">${escapeHtml(item.tags)}</span>`;
        html += `</div>`;
      }
      if (item.context) {
        html += `<div class="lessons-detail">${escapeHtml(item.context)}</div>`;
      }
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
    const contentM = body.match(/\*\*Content:\*\*\s*([\s\S]*?)(?=\n\*\*(?:Status|Authority|Component|Severity|Tags|Superseded):|\n###|$)/);
    const statusM = body.match(/\*\*Status:\*\*\s*(\w+)/);
    const authorityM = body.match(/\*\*Authority:\*\*\s*(\w+)/);
    // Structured metadata fields (optional)
    const componentM = body.match(/\*\*Component:\*\*\s*(.+)/);
    const severityM = body.match(/\*\*Severity:\*\*\s*(\w+)/);
    const tagsM = body.match(/\*\*Tags:\*\*\s*(.+)/);
    // Supersession fields (optional)
    const supersededByM = body.match(/\*\*Superseded-By:\*\*\s*(.+)/);
    const supersededAtM = body.match(/\*\*Superseded-At:\*\*\s*(.+)/);
    entries.push({
      timestamp: positions[i].timestamp,
      type: positions[i].type,
      project: positions[i].project,
      section: sectionM ? sectionM[1].trim() : "",
      content: contentM ? contentM[1].trim() : "",
      status: statusM ? statusM[1].trim() : "active",
      authority: authorityM ? authorityM[1].trim() : "agent",
      component: componentM ? componentM[1].trim() : "",
      severity: severityM ? severityM[1].trim() : "",
      tags: tagsM ? tagsM[1].trim() : "",
      supersededBy: supersededByM ? supersededByM[1].trim() : "",
      supersededAt: supersededAtM ? supersededAtM[1].trim() : "",
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
      const authClass = item.authority === "user" ? "memory-authority-user" : "memory-authority-agent";
      html += `<div class="memory-entry ${authClass}" data-timestamp="${escapeHtml(item.timestamp)}" data-type="${escapeHtml(item.type)}">`;
      html += `<div class="memory-meta">`;
      html += `<span class="memory-date">${escapeHtml(date)}</span>`;
      html += `<span class="memory-project">${escapeHtml(item.project)}</span>`;
      if (item.section) html += `<span class="memory-section">${escapeHtml(item.section)}</span>`;
      html += `<span class="memory-authority-badge ${authClass}">${item.authority === "user" ? "user" : "agent"}</span>`;
      html += `</div>`;
      html += `<div class="memory-content">${escapeHtml(item.content)}</div>`;
      // Show structured metadata when present (component, severity, tags)
      if (item.component || item.severity || item.tags) {
        html += `<div class="memory-metadata">`;
        if (item.component) html += `<span class="memory-component">${escapeHtml(item.component)}</span>`;
        if (item.severity) html += `<span class="memory-severity memory-severity-${escapeHtml(item.severity)}">${escapeHtml(item.severity)}</span>`;
        if (item.tags) html += `<span class="memory-tags">${escapeHtml(item.tags)}</span>`;
        html += `</div>`;
      }
      // Show supersession info when present
      if (item.supersededBy) {
        html += `<div class="memory-supersession">Superseded by: ${escapeHtml(item.supersededBy)}</div>`;
      }
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

  // Re-render story map if it's currently visible
  const storyMapOverlay = document.getElementById("story-map-overlay");
  if (storyMapOverlay && !storyMapOverlay.classList.contains("hidden")) {
    renderStoryMap();
  }
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
  // Metadata now displayed in top bar — just update the topbar
  updateTopbar();
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

  // Update top bar with spec metadata
  updateTopbar();

  // Build fuzzy search index
  buildSearchIndex();

  // Syntax-highlight code blocks
  highlightCodeBlocks();

  // Inject diagram toggle icons (if diagrams loaded)
  if (Object.keys(diagramDefinitions).length > 0) {
    injectDiagramToggles();
  }

  // Inject change annotations from changelog data
  injectChangeAnnotations();

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
      const cleanText = heading.textContent.replace(/\s*\{#[\w-]+\}/, "");
      heading.textContent = "";

      // Extract section number from text (e.g., "2.2 Core Flow" → "2.2")
      const numMatch = cleanText.match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
      if (numMatch) {
        // Add section number badge + alias tag + title
        const tagLine = document.createElement("div");
        tagLine.className = "spec-section-tag";
        tagLine.innerHTML = `<span class="spec-section-num">${escapeHtml(numMatch[1])}</span><span class="spec-section-alias">#${escapeHtml(aliasMatch[1])}</span>`;
        heading.before(tagLine);
        heading.textContent = numMatch[2];
      } else {
        heading.textContent = cleanText;
      }
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

/**
 * Inject change annotation badges on section headings.
 * Reads changelogEntries to find the most recent change for each section alias,
 * then adds a subtle "changed N days ago via /fctry:evolve" badge.
 */
function injectChangeAnnotations() {
  // Remove existing annotations
  for (const badge of specContent.querySelectorAll(".change-annotation")) {
    badge.remove();
  }
  if (!annotationsVisible || changelogEntries.length === 0) return;

  // Build map: section alias → { timestamp, command, summary }
  const lastChanged = {};
  for (const entry of changelogEntries) {
    for (const sa of entry.sectionAliases) {
      if (!lastChanged[sa.alias]) {
        lastChanged[sa.alias] = {
          timestamp: entry.timestamp,
          command: entry.command,
          summary: entry.summary,
        };
      }
      // changelogEntries are newest-first, so first match is most recent
    }
  }

  // Inject badges on section tag lines
  for (const tagLine of specContent.querySelectorAll(".spec-section-tag")) {
    const aliasEl = tagLine.querySelector(".spec-section-alias");
    if (!aliasEl) continue;
    const alias = aliasEl.textContent.replace("#", "");
    const change = lastChanged[alias];
    if (!change) continue;

    const badge = document.createElement("span");
    badge.className = "change-annotation";
    const ago = formatRelativeTime(change.timestamp);
    const via = change.command ? ` via ${change.command}` : "";
    badge.textContent = `changed ${ago}${via}`;
    badge.title = change.summary || `Last changed: ${change.timestamp}`;
    tagLine.appendChild(badge);
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
      `<a href="#${id}" class="toc-${level}${readinessClass}" data-section="${id}"><span class="toc-readiness-bar"></span><span class="toc-text">${text}${lessonBadge}</span></a>`
    );
  }

  // Skip DOM update if TOC hasn't changed (performance for large specs)
  const signature = links.join("");
  if (signature === lastTocSignature) return;
  lastTocSignature = signature;

  tocNav.innerHTML = links.join("");

  // Add click handlers for smooth scroll + hash update
  for (const link of tocNav.querySelectorAll("a")) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const sectionId = link.dataset.section;
      const target = document.getElementById(sectionId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        setActiveSection(sectionId);
        flashSection(target);
        updateHash({ section: sectionId });
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

function isMCVisible() {
  return !missionControl.classList.contains("hidden");
}

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
  const showMC = isActive || mcManualToggle;

  // Show/hide mission control (hides left rail, content, right rail when active)
  missionControl.classList.toggle("hidden", !showMC);
  const leftRail = document.getElementById("left-rail");
  const rightRail = document.getElementById("right-rail");
  const content = document.getElementById("content");
  if (leftRail) leftRail.style.display = showMC ? "none" : "";
  if (rightRail) rightRail.style.display = showMC ? "none" : "";
  if (content) content.style.display = showMC ? "none" : "";

  // Flush buffered events when MC becomes visible
  if (showMC) flushMCEventBuffer();

  if (!isActive) {
    // If build just ended, clear state
    if (wasBuildActive) {
      buildState.completedSections.clear();
      buildState.buildEvents = [];
    }
    // If MC is manually toggled on with no active build, show empty state
    if (mcManualToggle) {
      renderMissionControlEmptyState();
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

  // Update top bar build label and context
  if (topbarBuildLabel) topbarBuildLabel.classList.toggle("hidden", !isActive);
  if (state.contextUsage !== undefined) {
    buildState.contextUsage = state.contextUsage;
    updateTopbarContext();
  }
}

function renderMissionControlEmptyState() {
  // Left panel: no active build message
  if (mcChunks) mcChunks.innerHTML = `<div class="mc-empty-state">No active build</div>`;
  const planCount = document.getElementById("mc-plan-count");
  if (planCount) planCount.textContent = "0/0";

  // Center: empty DAG
  if (mcDagContainer) mcDagContainer.innerHTML = "";
  if (mcScore) mcScore.innerHTML = "";
  if (mcContextHealth) mcContextHealth.innerHTML = "";
  if (mcSection) mcSection.innerHTML = "";
  if (mcQuestion) mcQuestion.innerHTML = "";

  // Right: activity feed (shows past events if any) + inbox (always functional)
  renderActivityFeed();
}

function toggleMissionControl() {
  if (currentView !== "spec") return; // only toggle in spec view

  mcManualToggle = !mcManualToggle;

  if (mcManualToggle) {
    // Show MC panels, hide spec panels
    missionControl.classList.remove("hidden");
    const leftRail = document.getElementById("left-rail");
    const rightRail = document.getElementById("right-rail");
    const content = document.getElementById("content");
    if (leftRail) leftRail.style.display = "none";
    if (rightRail) rightRail.style.display = "none";
    if (content) content.style.display = "none";

    // Flush any buffered events now that MC is visible
    flushMCEventBuffer();
    // If no active build, show empty state; otherwise re-render current state
    if (!isBuildActive(buildState.workflowStep)) {
      renderMissionControlEmptyState();
    } else {
      updateMissionControl(buildState);
    }
  } else {
    // Hide MC, restore spec panels
    if (!isBuildActive(buildState.workflowStep)) {
      missionControl.classList.add("hidden");
    }
    const leftRail = document.getElementById("left-rail");
    const rightRail = document.getElementById("right-rail");
    const content = document.getElementById("content");
    if (leftRail) leftRail.style.display = "";
    if (rightRail) rightRail.style.display = "";
    if (content) content.style.display = "";
  }
}

function renderChunkPills() {
  const progress = buildState.chunkProgress;
  if (!progress || !progress.total) {
    mcChunks.innerHTML = "";
    return;
  }

  // Update plan count in header
  const planCount = document.getElementById("mc-plan-count");
  if (planCount) planCount.textContent = `${progress.current || 0}/${progress.total}`;

  const cards = [];

  if (progress.chunks && Array.isArray(progress.chunks)) {
    // Extended format: per-chunk lifecycle data — render as cards
    for (const chunk of progress.chunks) {
      const status = chunk.status || "planned";
      const name = chunk.name || `Chunk ${chunk.id}`;
      let meta = [];
      if (chunk.scenarios && chunk.scenarios.length) meta.push(chunk.scenarios.join(", "));
      if (status === "completed" && chunk.completedAt) meta.push(formatRelativeTime(chunk.completedAt));
      if (status === "retrying" && chunk.attempt) meta.push(`attempt ${chunk.attempt}`);

      cards.push(`<div class="mc-chunk-card ${escapeHtml(status)} status-${escapeHtml(status)}" data-chunk-id="${chunk.id}">
        <span class="mc-chunk-dot"></span>
        <div class="mc-chunk-info">
          <span class="mc-chunk-name">${escapeHtml(name)}</span>
          ${meta.length ? `<span class="mc-chunk-meta">${escapeHtml(meta.join(" · "))}</span>` : ""}
        </div>
      </div>`);
    }
  } else {
    // Legacy format: simple current/total — render as simple cards
    const { current, total } = progress;
    for (let i = 1; i <= total; i++) {
      const status = i < current ? "completed" : i === current ? "active" : "planned";
      cards.push(`<div class="mc-chunk-card ${status} status-${status}">
        <span class="mc-chunk-dot"></span>
        <div class="mc-chunk-info">
          <span class="mc-chunk-name">Chunk ${i}</span>
        </div>
      </div>`);
    }
  }

  mcChunks.innerHTML = cards.join("");
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

    nodes += `<g transform="translate(${pos.x},${pos.y})" style="cursor:pointer" data-chunk-id="${chunk.id}">
      <rect ${pulseAttr} width="${nodeWidth}" height="${nodeHeight}" rx="6" ry="6"
        fill="${color}15" stroke="${color}" stroke-width="2"/>
      <text x="${nodeWidth / 2}" y="${nodeHeight / 2 + 1}" text-anchor="middle"
        dominant-baseline="middle" fill="${chunk.status === 'planned' ? '#94a3b8' : color}"
        font-size="11" font-weight="${isActive ? '600' : '400'}"
        font-family="Inter, system-ui, sans-serif">${escapeHtml(label)}</text>
      ${chunk.status === "retrying" && chunk.attempt
        ? `<text x="${nodeWidth - 6}" y="12" text-anchor="end" fill="${color}"
            font-size="9" font-family="var(--font-mono, monospace)">r${chunk.attempt}</text>`
        : ""}
    </g>`;
  }

  // Stats row: completed / active / planned counts
  const completed = chunks.filter((c) => c.status === "completed").length;
  const active = chunks.filter((c) => c.status === "active" || c.status === "retrying").length;
  const planned = chunks.filter((c) => c.status === "planned" || !c.status).length;
  const statsHtml = `<div class="mc-dag-stats">
    <span class="mc-dag-stat"><span class="mc-dag-stat-dot" style="background:#4ade80"></span>${completed} completed</span>
    <span class="mc-dag-stat"><span class="mc-dag-stat-dot" style="background:#6d8eff"></span>${active} active</span>
    <span class="mc-dag-stat"><span class="mc-dag-stat-dot" style="background:#666"></span>${planned} planned</span>
  </div>`;

  mcDagContainer.innerHTML = `<svg class="mc-dag-svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
    <style>
      @keyframes dagPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
      .dag-node-pulse { animation: dagPulse 1.5s ease-in-out infinite; }
    </style>
    ${edges}${nodes}
  </svg>${statsHtml}`;

  // B2: Per-chunk context panel — click a DAG node to expand details
  const chunkMap = {};
  for (const c of chunks) chunkMap[c.id] = c;

  mcDagContainer.querySelectorAll("g[data-chunk-id]").forEach((g) => {
    g.addEventListener("click", () => {
      const chunkId = g.dataset.chunkId;
      const chunk = chunkMap[chunkId];
      if (!chunk) return;
      toggleChunkContextPanel(chunk, chunks);
    });
  });
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

// B2: Per-chunk context panel — shows file scope, scenarios, dependencies
function toggleChunkContextPanel(chunk, allChunks) {
  const existing = mcDagContainer.parentElement.querySelector(".mc-chunk-context");
  if (existing && existing.dataset.chunkId === String(chunk.id)) {
    existing.remove();
    return;
  }
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.className = "mc-chunk-context";
  panel.dataset.chunkId = String(chunk.id);

  const lines = [];
  lines.push(`<strong>${escapeHtml(chunk.name || `Chunk ${chunk.id}`)}</strong>`);
  lines.push(`<span class="mc-ctx-status">${escapeHtml(chunk.status || "planned")}</span>`);

  if (chunk.sections && chunk.sections.length) {
    lines.push(`<div class="mc-ctx-label">Sections</div>`);
    lines.push(chunk.sections.map((s) => `<span class="mc-ctx-tag">${escapeHtml(s)}</span>`).join(" "));
  }
  if (chunk.scenarios && chunk.scenarios.length) {
    lines.push(`<div class="mc-ctx-label">Scenarios</div>`);
    lines.push(chunk.scenarios.map((s) => `<span class="mc-ctx-tag">${escapeHtml(s)}</span>`).join(" "));
  }
  if (chunk.creates && chunk.creates.length) {
    lines.push(`<div class="mc-ctx-label">Creates</div>`);
    lines.push(chunk.creates.map((f) => `<code>${escapeHtml(f)}</code>`).join(", "));
  }
  if (chunk.modifies && chunk.modifies.length) {
    lines.push(`<div class="mc-ctx-label">Modifies</div>`);
    lines.push(chunk.modifies.map((f) => `<code>${escapeHtml(f)}</code>`).join(", "));
  }
  if (chunk.dependsOn && chunk.dependsOn.length) {
    const depNames = chunk.dependsOn.map((id) => {
      const dep = allChunks.find((c) => c.id === id);
      return dep ? (dep.name || `Chunk ${dep.id}`) : `Chunk ${id}`;
    });
    lines.push(`<div class="mc-ctx-label">Depends on</div>`);
    lines.push(depNames.map((n) => escapeHtml(n)).join(", "));
  }
  if (chunk.uncertainty) {
    lines.push(`<div class="mc-ctx-label">Uncertainty</div>`);
    lines.push(`<pre class="mc-ctx-pre">${escapeHtml(chunk.uncertainty)}</pre>`);
  }

  panel.innerHTML = lines.join("\n");
  mcDagContainer.parentElement.insertBefore(panel, mcDagContainer.nextSibling);
}

function renderScenarioScore() {
  const score = buildState.scenarioScore;
  if (!score || !mcScore) {
    if (mcScore) mcScore.textContent = "";
    return;
  }
  const parts = [];
  if (score.satisfied > 0) parts.push(`${score.satisfied} built`);
  if (score.partial > 0) parts.push(`${score.partial} partial`);
  parts.push(`${score.total} total`);
  mcScore.textContent = parts.join(" · ");
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
  } else if (state.escalation) {
    // Render structured escalation card (from guard evaluation)
    mcQuestion.classList.remove("hidden");
    const esc = state.escalation;
    const severityClass = esc.severity === "high" ? "mc-escalation-high"
      : esc.severity === "medium" ? "mc-escalation-medium" : "mc-escalation-low";
    mcQuestion.innerHTML =
      `<div class="mc-escalation-card ${severityClass}">` +
        `<div class="mc-escalation-header">` +
          `<span class="mc-escalation-severity">${escapeHtml(esc.severity || "info").toUpperCase()}</span>` +
          `<span class="mc-escalation-cause">${escapeHtml(esc.cause || "Guard evaluation escalation")}</span>` +
          `<button class="mc-escalation-dismiss" onclick="this.closest('.mc-escalation-card').remove();document.getElementById('mc-question').classList.add('hidden');" title="Dismiss">&times;</button>` +
        `</div>` +
        (esc.evidence ? `<div class="mc-escalation-evidence">${escapeHtml(esc.evidence)}</div>` : "") +
        (esc.action ? `<div class="mc-escalation-action">${escapeHtml(esc.action)}</div>` : "") +
      `</div>`;
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
  "section-started": "chunks",
  "section-completed": "chunks",
  "agent-started-section": "chunks",
  "agent-completed-section": "chunks",
  "tool-call": "tools",
  "external-tool": "tools",
  "chunk-verified": "verification",
  "verification-failed": "verification",
  "context-compacted": "context",
  "context-checkpointed": "context",
  "context-boundary": "context",
  "context-new": "context",
  "interview-started": "chunks",
  "interview-completed": "chunks",
  "checkpoint-saved": "context",
  "escalation-emitted": "verification",
  "ratchet-regressed": "verification",
  "ratchet-passed": "verification",
};

const eventIcons = {
  "chunk-started": "\u25B6",     // ▶
  "chunk-completed": "\u2713",   // ✓
  "chunk-retrying": "\u21BB",    // ↻
  "chunk-failed": "\u2717",      // ✗
  "scenario-evaluated": "\u25CE",// ◎
  "section-started": "\u26A1",        // ⚡ (lightning — section work begins)
  "section-completed": "\u2713",      // ✓ (section work done)
  "agent-started-section": "\u26A1",  // ⚡
  "agent-completed-section": "\u2713", // ✓
  "chunk-verified": "\u2714",          // ✔ (heavy check mark — distinct from ✓)
  "verification-failed": "\u26A0",     // ⚠ (warning sign)
  "context-compacted": "\u29C9",       // ⧉ (two joined squares — compaction)
  "context-checkpointed": "\u2691",    // ⚑ (flag — checkpoint)
  "context-boundary": "\u2502",        // │ (vertical line — boundary)
  "context-new": "\u2726",             // ✦ (star — new context)
  "interview-started": "\uD83C\uDFA4", // 🎤 (microphone — interview begins)
  "interview-completed": "\uD83C\uDFC1", // 🏁 (checkered flag — interview done)
  "checkpoint-saved": "\uD83D\uDCBE",  // 💾 (floppy disk — state saved)
  "escalation-emitted": "\u26A0",     // ⚠ (warning — escalation)
  "ratchet-regressed": "\u2B07",      // ⬇ (down arrow — regression)
  "ratchet-passed": "\u2705",         // ✅ (check — ratchet ok)
};

// Event dot colors (matching mockup)
const eventDotColors = {
  "chunk-started": "#6d8eff",
  "chunk-completed": "#4ade80",
  "chunk-retrying": "#eab308",
  "chunk-failed": "#ef4444",
  "scenario-evaluated": "#4ade80",
  "section-started": "#6d8eff",
  "section-completed": "#4ade80",
  "agent-started-section": "#6d8eff",
  "agent-completed-section": "#4ade80",
  "chunk-verified": "#4ade80",
  "verification-failed": "#ef4444",
  "context-compacted": "#666666",
  "context-checkpointed": "#eab308",
  "context-boundary": "#666666",
  "context-new": "#6d8eff",
  "interview-started": "#6d8eff",
  "interview-completed": "#4ade80",
  "checkpoint-saved": "#eab308",
  "escalation-emitted": "#ef4444",
  "ratchet-regressed": "#ef4444",
  "ratchet-passed": "#4ade80",
};

// Human-readable kind labels for event titles
const eventKindLabels = {
  "chunk-started": "Chunk Started",
  "chunk-completed": "Chunk Completed",
  "chunk-retrying": "Chunk Retrying",
  "chunk-failed": "Chunk Failed",
  "scenario-evaluated": "Scenario Evaluated",
  "section-started": "Section Started",
  "section-completed": "Section Completed",
  "agent-started-section": "Section Started",
  "agent-completed-section": "Section Completed",
  "chunk-verified": "Chunk Verified",
  "verification-failed": "Verification Failed",
  "context-compacted": "Context Compacted",
  "context-checkpointed": "Checkpointed",
  "context-boundary": "Context Boundary",
  "context-new": "New Context",
  "interview-started": "Interview Started",
  "interview-completed": "Interview Completed",
  "checkpoint-saved": "Checkpoint Saved",
  "escalation-emitted": "Escalation",
  "ratchet-regressed": "Ratchet Regression",
  "ratchet-passed": "Ratchet Passed",
};

// Built-in alert rules — events matching these are pinned with visual accent
function isAlertEvent(event) {
  const kind = event.kind || "";
  if (kind === "verification-failed") return true;
  if (kind === "context-compacted") return true;
  if (kind === "chunk-retrying" && (event.attempt || 0) >= 3) return true;
  if (kind === "escalation-emitted") return true;
  if (kind === "ratchet-regressed") return true;
  return false;
}

// B5: Client-side event enrichment — enrich minimal WebSocket payloads
// with contextual detail from spec data already loaded in the browser
function enrichEvent(event) {
  // Enrich section references with their heading from sectionReadiness/specMeta
  if (event.section && sectionReadiness[event.section]) {
    event.sectionReadiness = sectionReadiness[event.section];
  }
  // Enrich chunk events with scenario count from build state
  if (event.kind === "chunk-completed" && event.chunk && buildState.chunkProgress) {
    const chunks = buildState.chunkProgress.chunks;
    if (chunks && Array.isArray(chunks)) {
      const match = chunks.find((c) => c.name === event.chunk || c.id === event.chunk);
      if (match && match.scenarios) {
        event.scenarios = event.scenarios || match.scenarios;
      }
    }
  }
  // Enrich verification events with section context
  if ((event.kind === "chunk-verified" || event.kind === "verification-failed") && event.chunk) {
    const chunks = buildState.chunkProgress?.chunks;
    if (chunks && Array.isArray(chunks)) {
      const match = chunks.find((c) => c.name === event.chunk || c.id === event.chunk);
      if (match && match.sections) {
        event.sections = event.sections || match.sections;
      }
    }
  }
  return event;
}

function addBuildEvent(event) {
  if (!event.timestamp) event.timestamp = new Date().toISOString();
  // Deduplicate — skip if we already have an event with same timestamp + kind
  const isDupe = buildState.buildEvents.some(
    (existing) => existing.timestamp === event.timestamp && existing.kind === event.kind
  );
  if (isDupe) return;
  event = enrichEvent(event);
  if (isAlertEvent(event)) event.alert = true;
  buildState.buildEvents.push(event);
  if (buildState.buildEvents.length > BUILD_EVENT_LIMIT) {
    buildState.buildEvents.shift();
  }
  // Conditional enrichment: buffer DOM rendering when MC is not visible
  if (isMCVisible()) {
    renderActivityFeed();
  } else {
    mcEventBuffer.push(event);
    if (mcEventBuffer.length > MC_EVENT_BUFFER_LIMIT) {
      mcEventBuffer.shift();
    }
  }
}

function flushMCEventBuffer() {
  if (mcEventBuffer.length === 0) return;
  // Events are already in buildState.buildEvents — just render once
  mcEventBuffer.length = 0;
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
    case "chunk-completed": return `${chunk} completed` + (event.scenarios && event.scenarios.length ? ` \u2014 ${event.scenarios.length} scenario${event.scenarios.length !== 1 ? "s" : ""} satisfied` : "");
    case "chunk-retrying": return `${chunk} retrying` + (event.attempt ? ` (attempt ${event.attempt})` : "") + (event.reason ? ` \u2014 ${event.reason}` : "");
    case "chunk-failed": return `${chunk} failed` + (event.reason ? ` \u2014 ${event.reason}` : "");
    case "scenario-evaluated": return `${event.scenario || "Scenario"}: ${event.result || "evaluated"}`;
    case "section-started": return `Started ${section}`;
    case "section-completed": return `Completed ${section}`;
    case "agent-started-section": return `Agent started ${section}`;
    case "agent-completed-section": return `Agent completed ${section}`;
    case "chunk-verified": return `${chunk} verified` + (event.summary ? `: ${event.summary}` : "");
    case "verification-failed": return `${chunk} verification failed` + (event.summary ? `: ${event.summary}` : "");
    case "context-compacted": return `Context compacted` + (event.summary ? ` \u2014 ${event.summary}` : " \u2014 build state preserved");
    case "context-checkpointed": return `Checkpointed` + (chunk ? ` before ${chunk}` : "") + (event.summary ? ` \u2014 ${event.summary}` : "");
    case "context-boundary": return `Context boundary` + (chunk ? ` for ${chunk}` : "") + (event.isolationMode ? ` (${event.isolationMode})` : "");
    case "context-new": return `New context` + (chunk ? ` for ${chunk}` : "");
    case "interview-started": return `Interview started` + (event.phase ? ` \u2014 ${event.phase}` : "");
    case "interview-completed": return `Interview completed` + (event.phases ? ` (${event.phases} phases)` : "") + (event.duration ? ` in ${event.duration}` : "");
    case "checkpoint-saved": return `Build state saved` + (chunk ? ` after ${chunk}` : "") + (event.summary ? ` \u2014 ${event.summary}` : "");
    case "escalation-emitted": return `Escalation: ${event.severity || "info"} \u2014 ${event.cause || chunk || "guard evaluation"}`;
    case "ratchet-regressed": return `Ratchet: ${chunk} regressed` + (event.metric ? ` (${event.metric})` : "") + (event.action ? ` \u2014 ${event.action}` : "");
    case "ratchet-passed": return `Ratchet: ${chunk} passed`;
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
    const dotColor = eventDotColors[ev.kind] || "#666666";
    const desc = eventDescription(ev);
    const kindLabel = eventKindLabels[ev.kind] || ev.kind;
    const time = formatRelativeTime(ev.timestamp);
    const category = eventFilterCategories[ev.kind] || "";
    const classes = ["mc-event"];
    if (category === "context") classes.push("mc-event-context");
    if (category === "verification") classes.push("mc-event-verification");
    if (ev.alert) classes.push("mc-event-alert");

    // B3: Expandable reasoning traces — events with detail/reasoning are expandable
    const hasDetail = ev.reasoning || ev.detail || ev.failed;
    const detailContent = ev.reasoning || ev.detail
      || (ev.failed && Array.isArray(ev.failed) ? ev.failed.map((f) => `\u2022 ${f}`).join("\n") : "");

    if (hasDetail) {
      classes.push("mc-event-expandable");
      return `<div class="${classes.join(" ")}" onclick="this.classList.toggle('expanded')">` +
        `<span class="mc-event-time">${escapeHtml(time)}</span>` +
        `<span class="mc-event-dot" style="background:${dotColor}"></span>` +
        `<div class="mc-event-info">` +
          `<span class="mc-event-title" style="color:${dotColor}">${escapeHtml(kindLabel)}</span>` +
          `<span class="mc-event-desc">${escapeHtml(desc)} <span class="mc-expand-hint">\u25B8</span></span>` +
        `</div>` +
        `<div class="mc-event-detail">${escapeHtml(detailContent)}</div>` +
        `</div>`;
    }

    return `<div class="${classes.join(" ")}">` +
      `<span class="mc-event-time">${escapeHtml(time)}</span>` +
      `<span class="mc-event-dot" style="background:${dotColor}"></span>` +
      `<div class="mc-event-info">` +
        `<span class="mc-event-title" style="color:${dotColor}">${escapeHtml(kindLabel)}</span>` +
        `<span class="mc-event-desc">${escapeHtml(desc)}</span>` +
      `</div>` +
      `</div>`;
  }

  // Update event count
  const eventCountEl = document.getElementById("mc-event-count");
  if (eventCountEl) eventCountEl.textContent = `${events.length} events`;

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
    // Request current state on every connect (eliminates blank-screen-on-connect race)
    ws.send(JSON.stringify({ type: "request-state" }));
    // If reconnecting with a known sequence, also request backfill for missed events
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
        changelogEntries = parseChangelog(data.content);
        renderTimeline(changelogEntries);
        injectChangeAnnotations();
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
    changelogEntries = parseChangelog(text);
    renderTimeline(changelogEntries);
    injectChangeAnnotations();
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
      container.innerHTML = `<div class="fctry-mermaid">${svg}</div>`;
      initDiagramZoom(container);
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
      container.innerHTML = `<div class="fctry-mermaid">${svg}</div>`;
      initDiagramZoom(container);
    } catch {
      // Keep existing render
    }

    container.classList.remove("diagram-fade-out");
  }
}

// --- Diagram Zoom Controls ---

function initDiagramZoom(container) {
  const mermaidWrapper = container.querySelector(".fctry-mermaid");
  if (!mermaidWrapper) return;

  // Check if SVG is small enough to not need zoom
  const svgEl = mermaidWrapper.querySelector("svg");
  if (!svgEl) return;

  // State for this diagram's zoom
  let scale = 1;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let startX = 0;
  let startY = 0;

  // Create zoom control bar
  const controls = document.createElement("div");
  controls.className = "diagram-zoom-controls";
  controls.innerHTML = `
    <button class="diagram-zoom-btn" data-action="zoom-in" title="Zoom in">+</button>
    <button class="diagram-zoom-btn" data-action="zoom-out" title="Zoom out">&minus;</button>
    <button class="diagram-zoom-btn" data-action="reset" title="Reset view">&#x21BA;</button>
  `;
  container.style.position = "relative";
  container.appendChild(controls);

  // Hide controls if SVG fits within container (check after layout)
  requestAnimationFrame(() => {
    const containerRect = container.getBoundingClientRect();
    const svgRect = svgEl.getBoundingClientRect();
    if (svgRect.width <= containerRect.width && svgRect.height <= containerRect.height * 0.9) {
      controls.classList.add("diagram-zoom-hidden");
    }
  });

  function applyTransform() {
    mermaidWrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  }

  function clampScale(s) {
    return Math.max(0.25, Math.min(4, s));
  }

  // Button clicks
  controls.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    e.stopPropagation();
    if (action === "zoom-in") {
      scale = clampScale(scale * 1.25);
    } else if (action === "zoom-out") {
      scale = clampScale(scale / 1.25);
    } else if (action === "reset") {
      scale = 1;
      panX = 0;
      panY = 0;
    }
    applyTransform();
    controls.classList.remove("diagram-zoom-hidden");
  });

  // Mouse wheel zoom
  container.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    scale = clampScale(scale * delta);
    applyTransform();
    controls.classList.remove("diagram-zoom-hidden");
  }, { passive: false });

  // Pan with mouse drag
  container.addEventListener("mousedown", (e) => {
    if (scale <= 1) return; // Only pan when zoomed in
    isPanning = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    container.style.cursor = "grabbing";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    applyTransform();
  });

  document.addEventListener("mouseup", () => {
    if (isPanning) {
      isPanning = false;
      container.style.cursor = "";
    }
  });
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
    // Story map is z-index 60 — close before detail panel
    const storyMapOverlay = document.getElementById("story-map-overlay");
    if (storyMapOverlay && !storyMapOverlay.classList.contains("hidden")) {
      toggleStoryMap(false);
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

  // m — toggle Mission Control
  if (e.key === "m") {
    e.preventDefault();
    toggleMissionControl();
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

  // s — toggle story map
  if (e.key === "s") {
    e.preventDefault();
    toggleStoryMap();
    return;
  }

  // a — toggle annotations
  if (e.key === "a") {
    e.preventDefault();
    toggleAnnotations();
    return;
  }

  // t — toggle theme
  if (e.key === "t") {
    e.preventDefault();
    toggleTheme();
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

// --- Story Map ---

function toggleStoryMap(forceOpen) {
  const overlay = document.getElementById("story-map-overlay");
  if (!overlay) return;

  const isOpen = !overlay.classList.contains("hidden");
  const shouldOpen = forceOpen !== undefined ? forceOpen : !isOpen;

  if (shouldOpen && !isOpen) {
    overlay.classList.remove("hidden");
    renderStoryMap();
  } else if (!shouldOpen && isOpen) {
    overlay.classList.add("hidden");
  }
}

// Close button wiring
const storyMapCloseBtn = document.getElementById("story-map-close");
if (storyMapCloseBtn) {
  storyMapCloseBtn.addEventListener("click", () => toggleStoryMap(false));
}

async function renderStoryMap() {
  const body = document.getElementById("story-map-body");
  if (!body) return;
  body.innerHTML = '<div class="story-map-empty"><span>Loading story map\u2026</span></div>';

  const query = currentProjectPath ? `?project=${encodeURIComponent(currentProjectPath)}` : "";
  try {
    const [mapRes, simRes] = await Promise.all([
      fetch(`/api/story-map${query}`),
      fetch(`/api/section-similarity${query}`),
    ]);
    if (!mapRes.ok) throw new Error(`HTTP ${mapRes.status}`);
    const data = await mapRes.json();
    const simData = simRes.ok ? await simRes.json() : { pairs: [] };
    const semanticPairs = simData.pairs || [];

    if (!data.sections || data.sections.length === 0) {
      body.innerHTML = '<div class="story-map-empty"><span>No spec sections found</span><span class="story-map-empty-hint">Run /fctry:init to create a spec</span></div>';
      return;
    }

    // Organize sections by top-level group
    const groups = {};
    for (const sec of data.sections) {
      if (!groups[sec.topSection]) groups[sec.topSection] = [];
      groups[sec.topSection].push(sec);
    }

    // Section 2 items form the horizontal spine (experiences)
    const spineItems = (groups["2"] || []).filter((s) => s.level === 3);

    // Sections 3, 4, 5 hang below spine items they cross-reference
    const hangingSections = [];
    for (const topSec of ["3", "4", "5"]) {
      for (const sec of (groups[topSec] || [])) {
        if (sec.level === 3) hangingSections.push(sec);
      }
    }

    // Build a map: spine alias → list of hanging sections that reference it (or are referenced by it)
    const edgeIndex = {};
    for (const edge of (data.edges || [])) {
      if (!edgeIndex[edge.from]) edgeIndex[edge.from] = [];
      if (!edgeIndex[edge.to]) edgeIndex[edge.to] = [];
      edgeIndex[edge.from].push({ target: edge.to, type: edge.type });
      edgeIndex[edge.to].push({ target: edge.from, type: edge.type });
    }

    const spineAliases = new Set(spineItems.filter((s) => s.alias).map((s) => s.alias));
    const allAliases = new Set(data.sections.filter((s) => s.alias).map((s) => s.alias));

    // Map hanging sections to their spine column
    const columns = {}; // spineAlias → [hangingSections]
    const connected = new Set();

    for (const sec of hangingSections) {
      if (!sec.alias) continue;
      const neighbors = edgeIndex[sec.alias] || [];
      for (const n of neighbors) {
        if (spineAliases.has(n.target)) {
          if (!columns[n.target]) columns[n.target] = [];
          columns[n.target].push({ ...sec, edgeType: n.type });
          connected.add(sec.alias);
        }
      }
    }

    // Collect unconnected sections (not in spine, not hanging under any spine item)
    const unconnected = data.sections.filter((s) =>
      s.alias && s.level === 3 && !spineAliases.has(s.alias) && !connected.has(s.alias)
    );

    // Layout constants
    const nodeW = 140;
    const nodeH = 40;
    const spineGapX = 20;
    const colGapY = 12;
    const spineY = 60;
    const hangStartY = spineY + nodeH + 40;
    const sectionLabelH = 24;

    // Compute column widths and max column depth
    const maxColDepth = Math.max(1, ...spineItems.map((s) => (columns[s.alias] || []).length));
    const svgWidth = Math.max(800, spineItems.length * (nodeW + spineGapX) + spineGapX);
    const svgHeight = spineY + nodeH + 50 + maxColDepth * (nodeH + colGapY) + 60;

    const readinessColors = {
      aligned: "#4ade80",
      satisfied: "#4ade80",
      "ready-to-build": "#6d8eff",
      "ready-to-execute": "#6d8eff",
      "spec-ahead": "#eab308",
      undocumented: "#eab308",
      draft: "#666",
      unknown: "#555",
    };

    const sectionLabels = {
      "1": "Overview",
      "2": "Experiences",
      "3": "Behavior",
      "4": "Constraints",
      "5": "References",
      "6": "Meta",
    };

    // Build SVG elements
    let svgEdges = "";
    let svgNodes = "";

    // Section 2 label
    svgNodes += `<text x="${spineGapX}" y="${spineY - 16}" class="story-map-section-label" fill="var(--text-muted)">
      \u00A7 2 \u2014 ${escapeHtml(sectionLabels["2"] || "Experiences")}</text>`;

    // Spine nodes (section 2)
    const spinePositions = {};
    const totalSpineWidth = spineItems.length * nodeW + (spineItems.length - 1) * spineGapX;
    const spineStartX = Math.max(spineGapX, (svgWidth - totalSpineWidth) / 2);

    for (let i = 0; i < spineItems.length; i++) {
      const sec = spineItems[i];
      const x = spineStartX + i * (nodeW + spineGapX);
      const y = spineY;
      if (sec.alias) spinePositions[sec.alias] = { x, y };

      const color = readinessColors[sec.readiness] || readinessColors.unknown;
      const label = sec.heading.length > 16 ? sec.heading.slice(0, 15) + "\u2026" : sec.heading;

      svgNodes += `<g class="story-map-node" transform="translate(${x},${y})" data-alias="${escapeHtml(sec.alias || "")}" data-number="${escapeHtml(sec.number)}">
        <rect width="${nodeW}" height="${nodeH}" rx="6" ry="6" fill="var(--bg-element)" stroke="${color}" stroke-width="2"/>
        <circle cx="12" cy="${nodeH / 2}" r="4" fill="${color}"/>
        <text x="22" y="${nodeH / 2 - 5}" fill="var(--text-muted)" font-size="9" font-family="var(--font-mono)">${escapeHtml(sec.number)}</text>
        <text x="22" y="${nodeH / 2 + 8}" fill="var(--text-primary)" font-size="11" font-family="var(--font-body)">${escapeHtml(label)}</text>
      </g>`;
    }

    // Hanging sections (3/4/5) in columns below spine
    const hangPositions = {};
    for (const spineAlias of Object.keys(columns)) {
      const spinePos = spinePositions[spineAlias];
      if (!spinePos) continue;
      const colItems = columns[spineAlias];
      for (let j = 0; j < colItems.length; j++) {
        const sec = colItems[j];
        const x = spinePos.x;
        const y = hangStartY + j * (nodeH + colGapY);
        if (sec.alias) hangPositions[sec.alias] = { x, y, parentSpine: spineAlias, edgeType: sec.edgeType };

        const color = readinessColors[sec.readiness] || readinessColors.unknown;
        const label = sec.heading.length > 16 ? sec.heading.slice(0, 15) + "\u2026" : sec.heading;
        const topLabel = sectionLabels[sec.topSection] || "";
        const badgeColor = sec.topSection === "3" ? "#6d8eff" : sec.topSection === "4" ? "#eab308" : "#888";

        svgNodes += `<g class="story-map-node" transform="translate(${x},${y})" data-alias="${escapeHtml(sec.alias || "")}" data-number="${escapeHtml(sec.number)}">
          <rect width="${nodeW}" height="${nodeH}" rx="6" ry="6" fill="var(--bg-element)" stroke="${color}" stroke-width="1.5"/>
          <circle cx="12" cy="${nodeH / 2}" r="3.5" fill="${color}"/>
          <text x="22" y="${nodeH / 2 - 5}" fill="${badgeColor}" font-size="8" font-family="var(--font-mono)">${escapeHtml(sec.number)}</text>
          <text x="22" y="${nodeH / 2 + 8}" fill="var(--text-secondary)" font-size="10" font-family="var(--font-body)">${escapeHtml(label)}</text>
        </g>`;
      }
    }

    // Draw edges: spine → hanging
    for (const [alias, pos] of Object.entries(hangPositions)) {
      const spinePos = spinePositions[pos.parentSpine];
      if (!spinePos) continue;

      const x1 = spinePos.x + nodeW / 2;
      const y1 = spinePos.y + nodeH;
      const x2 = pos.x + nodeW / 2;
      const y2 = pos.y;
      const midY = (y1 + y2) / 2;

      const isDashed = pos.edgeType === "scenario-overlap";
      const dashAttr = isDashed ? 'stroke-dasharray="4,3"' : "";
      const strokeColor = isDashed ? "var(--text-muted)" : "var(--accent)";

      svgEdges += `<path d="M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}"
        fill="none" stroke="${strokeColor}" stroke-width="1.5" opacity="0.4" ${dashAttr}/>`;
    }

    // Draw cross-reference edges between hanging sections
    for (const edge of (data.edges || [])) {
      const fromPos = hangPositions[edge.from] || spinePositions[edge.from];
      const toPos = hangPositions[edge.to] || spinePositions[edge.to];
      if (!fromPos || !toPos) continue;
      // Skip spine-to-hanging edges (already drawn above)
      if (spinePositions[edge.from] && hangPositions[edge.to]) continue;
      if (spinePositions[edge.to] && hangPositions[edge.from]) continue;
      // Skip self-column edges
      if (fromPos.x === toPos.x && Math.abs(fromPos.y - toPos.y) < nodeH + colGapY + 5) continue;

      const x1 = fromPos.x + nodeW;
      const y1 = fromPos.y + nodeH / 2;
      const x2 = toPos.x;
      const y2 = toPos.y + nodeH / 2;

      const isDashed = edge.type === "scenario-overlap";
      const dashAttr = isDashed ? 'stroke-dasharray="4,3"' : "";
      const strokeColor = isDashed ? "var(--text-muted)" : "var(--accent)";

      // Horizontal bezier curve for cross-refs between columns
      const cpOffset = Math.abs(x2 - x1) * 0.3;
      svgEdges += `<path d="M${x1},${y1} C${x1 + cpOffset},${y1} ${x2 - cpOffset},${y2} ${x2},${y2}"
        fill="none" stroke="${strokeColor}" stroke-width="1" opacity="0.25" ${dashAttr}/>`;
    }

    // Draw semantic similarity edges (dashed, muted — distinct from structural edges)
    const allPositions = { ...spinePositions, ...hangPositions };
    // Build set of existing structural edges to avoid duplicates
    const structuralEdgeSet = new Set();
    for (const edge of (data.edges || [])) {
      structuralEdgeSet.add(`${edge.from}|${edge.to}`);
      structuralEdgeSet.add(`${edge.to}|${edge.from}`);
    }
    for (const pair of semanticPairs) {
      if (structuralEdgeSet.has(`${pair.from}|${pair.to}`)) continue;
      const fromPos = allPositions[pair.from];
      const toPos = allPositions[pair.to];
      if (!fromPos || !toPos) continue;

      const x1 = fromPos.x + nodeW / 2;
      const y1 = fromPos.y + nodeH / 2;
      const x2 = toPos.x + nodeW / 2;
      const y2 = toPos.y + nodeH / 2;
      const cpOffset = Math.abs(x2 - x1) * 0.4;
      const yOff = Math.min(Math.abs(y2 - y1) * 0.3, 30);

      svgEdges += `<path d="M${x1},${y1} C${x1 + cpOffset},${y1 - yOff} ${x2 - cpOffset},${y2 - yOff} ${x2},${y2}"
        fill="none" stroke="#6d8eff" stroke-width="1" opacity="0.25" stroke-dasharray="4,4" class="semantic-edge">
        <title>${escapeHtml(pair.from)} \u2194 ${escapeHtml(pair.to)} (similarity: ${pair.similarity})</title>
      </path>`;
    }

    // Assemble SVG
    const svgHtml = `<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}"
      xmlns="http://www.w3.org/2000/svg" style="font-family: var(--font-body);">
      ${svgEdges}${svgNodes}
    </svg>`;

    // Legend
    const legendHtml = `<div class="story-map-legend">
      <div class="story-map-legend-item"><span class="story-map-legend-dot" style="background:#4ade80"></span>Aligned</div>
      <div class="story-map-legend-item"><span class="story-map-legend-dot" style="background:#6d8eff"></span>Ready to build</div>
      <div class="story-map-legend-item"><span class="story-map-legend-dot" style="background:#eab308"></span>Spec ahead</div>
      <div class="story-map-legend-item"><span class="story-map-legend-dot" style="background:#666"></span>Draft</div>
      <div class="story-map-legend-item"><span class="story-map-legend-line" style="background:var(--accent)"></span>Cross-ref</div>
      <div class="story-map-legend-item"><span class="story-map-legend-line" style="background:var(--text-muted);background-image:repeating-linear-gradient(90deg,var(--text-muted) 0,var(--text-muted) 4px,transparent 4px,transparent 7px);background-color:transparent;"></span>Scenario overlap</div>
      <div class="story-map-legend-item"><span class="story-map-legend-line story-map-legend-semantic"></span>Semantic similarity</div>
    </div>`;

    // Unconnected sections
    let unconnectedHtml = "";
    if (unconnected.length > 0) {
      const pills = unconnected.map((sec) => {
        const color = readinessColors[sec.readiness] || readinessColors.unknown;
        const label = sec.heading.length > 20 ? sec.heading.slice(0, 19) + "\u2026" : sec.heading;
        return `<span class="story-map-node" data-alias="${escapeHtml(sec.alias || "")}" data-number="${escapeHtml(sec.number)}"
          style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;margin:3px;border-radius:6px;
          background:var(--bg-element);border:1px solid var(--border-default);cursor:pointer;font-size:11px;">
          <span style="width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0;"></span>
          <span style="color:var(--text-muted);font-family:var(--font-mono);font-size:9px;">${escapeHtml(sec.number)}</span>
          <span style="color:var(--text-secondary);">${escapeHtml(label)}</span>
        </span>`;
      }).join("");
      unconnectedHtml = `<div class="story-map-unconnected">
        <div class="story-map-unconnected-title">UNCONNECTED SECTIONS</div>
        <div style="display:flex;flex-wrap:wrap;">${pills}</div>
      </div>`;
    }

    body.innerHTML = svgHtml + legendHtml + unconnectedHtml;

    // Wire click handlers — nodes navigate to section in spec view
    body.querySelectorAll(".story-map-node").forEach((node) => {
      node.addEventListener("click", () => {
        const alias = node.dataset.alias;
        const number = node.dataset.number;
        toggleStoryMap(false);

        // Scroll to section in spec view
        if (alias) {
          const target = document.getElementById(alias);
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
        }
        // Fallback: try number-based heading
        if (number) {
          const headings = document.querySelectorAll("#spec-content h2, #spec-content h3, #spec-content h4");
          for (const h of headings) {
            if (h.textContent.trim().startsWith(number)) {
              h.scrollIntoView({ behavior: "smooth", block: "start" });
              return;
            }
          }
        }
      });
    });

  } catch (err) {
    body.innerHTML = `<div class="story-map-empty"><span>Could not load story map</span><span class="story-map-empty-hint">${escapeHtml(err.message)}</span></div>`;
  }
}

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
        <dt>s</dt><dd>Toggle story map</dd>
        <dt>m</dt><dd>Toggle Mission Control</dd>
        <dt>d</dt><dd>Toggle diagram for current section</dd>
        <dt>D</dt><dd>Toggle all diagrams globally</dd>
        <dt>]</dt><dd>Toggle inbox panel</dd>
        <dt>a</dt><dd>Toggle change annotations</dd>
        <dt>t</dt><dd>Toggle dark/light theme</dd>
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
      applyReadinessFilter(activeFilterCategories.length > 0 ? activeFilterCategories : [activeReadinessFilter]);
    }
    // Restore filter from URL hash on initial load (only if no filter active yet)
    if (!activeReadinessFilter && Object.keys(readinessCounts).length > 0) {
      restoreFromHash();
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
  "partial",
  "deferred",
  "ready-to-build",
  "undocumented",
  "draft",
];

const readinessLabels = {
  "satisfied": "built",
  "ready-to-execute": "built",
  "aligned": "built",
  "spec-ahead": "evolved",
  "partial": "partial",
  "deferred": "deferred",
  "ready-to-build": "specced",
  "undocumented": "unspecced",
  "draft": "specced",
};

function renderReadinessStats() {
  if (!readinessStatsContainer) return;

  const total = Object.values(readinessCounts).reduce((a, b) => a + b, 0);

  // Update TOC header readiness summary using user vocabulary
  const tocSummary = document.getElementById("toc-readiness-summary");
  if (tocSummary) {
    const builtCount = (readinessCounts["ready-to-execute"] || 0) + (readinessCounts["satisfied"] || 0) + (readinessCounts["aligned"] || 0);
    tocSummary.textContent = total > 0 ? `${builtCount}/${total} built` : "";
  }

  if (total === 0) {
    readinessStatsContainer.innerHTML = "";
    return;
  }

  // Aggregate internal labels into user-facing groups
  // Maps user label → { count, internalCategories[] }
  const userGroups = new Map();
  const userDisplayOrder = ["built", "partial", "deferred", "specced", "unspecced"];
  for (const category of readinessDisplayOrder) {
    const count = readinessCounts[category];
    if (!count) continue;
    const label = readinessLabels[category] || category;
    if (!userGroups.has(label)) {
      userGroups.set(label, { count: 0, categories: [] });
    }
    const group = userGroups.get(label);
    group.count += count;
    group.categories.push(category);
  }

  const pills = [];
  for (const label of userDisplayOrder) {
    const group = userGroups.get(label);
    if (!group || group.count === 0) continue;
    // A pill is active if ANY of its internal categories match the active filter
    const isActive = group.categories.includes(activeReadinessFilter);
    // Store all internal categories as data attribute for filtering
    const dataCategories = group.categories.join(",");
    pills.push(
      `<span class="readiness-pill${isActive ? " active-filter" : ""}" data-readiness="${escapeHtml(dataCategories)}" title="${group.count} section${group.count !== 1 ? "s" : ""} ${escapeHtml(label)}">` +
      `<span class="pill-label">${escapeHtml(label)}</span>` +
      `<span class="pill-count">${group.count}</span>` +
      `</span>`
    );
  }

  readinessStatsContainer.innerHTML = pills.join("");

  // Click handlers — pills may represent multiple internal categories
  for (const pill of readinessStatsContainer.querySelectorAll(".readiness-pill")) {
    pill.addEventListener("click", () => {
      const categories = pill.dataset.readiness;
      // If any category in this pill is the active filter, clear it
      if (categories.split(",").includes(activeReadinessFilter)) {
        clearReadinessFilter();
      } else {
        // Set filter to first category (setReadinessFilter handles the rest)
        setReadinessFilter(categories.split(",")[0], categories.split(","));
      }
    });
  }
}

// activeFilterCategories tracks all internal categories in the active filter group
let activeFilterCategories = [];

function setReadinessFilter(category, categories) {
  // Save scroll position before filtering
  if (!activeReadinessFilter) {
    preFilterScrollTop = document.documentElement.scrollTop;
  }
  activeReadinessFilter = category;
  activeFilterCategories = categories || [category];
  applyReadinessFilter(activeFilterCategories);
  renderReadinessStats(); // re-render pills to show active state
  // Hide sidebar synopsis during filter
  const synopsis = document.querySelector(".sidebar-synopsis");
  if (synopsis) synopsis.style.display = "none";
  // Persist filter in URL hash
  const label = readinessLabels[category] || category;
  updateHash({ filter: label });
}

function clearReadinessFilter() {
  activeReadinessFilter = null;
  activeFilterCategories = [];
  removeReadinessFilter();
  renderReadinessStats(); // re-render pills to clear active state
  // Restore sidebar synopsis
  const synopsis = document.querySelector(".sidebar-synopsis");
  if (synopsis) synopsis.style.display = "";
  // Restore scroll position
  requestAnimationFrame(() => {
    document.documentElement.scrollTop = preFilterScrollTop;
  });
  // Remove filter from URL hash
  updateHash({ filter: null });
}

// --- URL Hash Management ---
// Supports: #section-alias (navigation) and #filter=built (readiness filter)

function updateHash(params) {
  const current = parseHash();
  for (const [key, val] of Object.entries(params)) {
    if (val === null) delete current[key];
    else current[key] = val;
  }
  const parts = [];
  if (current.section) parts.push(current.section);
  if (current.filter) parts.push(`filter=${current.filter}`);
  const newHash = parts.join("&");
  history.replaceState(null, "", newHash ? `#${newHash}` : location.pathname + location.search);
}

function parseHash() {
  const hash = location.hash.replace("#", "");
  if (!hash) return {};
  const result = {};
  for (const part of hash.split("&")) {
    if (part.startsWith("filter=")) {
      result.filter = part.slice(7);
    } else if (part && !part.includes("=")) {
      result.section = part;
    }
  }
  return result;
}

function restoreFromHash() {
  const params = parseHash();
  // Restore readiness filter
  if (params.filter) {
    // Find the internal categories for this user-facing label
    const label = params.filter;
    const categories = [];
    for (const [internal, userLabel] of Object.entries(readinessLabels)) {
      if (userLabel === label) categories.push(internal);
    }
    if (categories.length > 0) {
      setReadinessFilter(categories[0], categories);
    }
  }
  // Restore section navigation
  if (params.section) {
    requestAnimationFrame(() => {
      const target = document.getElementById(params.section);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function applyReadinessFilter(categories) {
  // categories is an array of internal readiness labels to match
  const categorySet = new Set(Array.isArray(categories) ? categories : [categories]);

  // Filter TOC entries — dim non-matching, keep matching visible
  for (const link of tocNav.querySelectorAll("a")) {
    const sectionId = link.dataset.section;
    const readiness = sectionReadiness[sectionId];
    const directMatch = categorySet.has(readiness);
    link.classList.toggle("readiness-filtered-out", !directMatch && readiness !== undefined);
  }

  // Build a set of matching section IDs (aliases with any target readiness)
  const matchingIds = new Set();
  for (const [alias, readiness] of Object.entries(sectionReadiness)) {
    if (categorySet.has(readiness)) matchingIds.add(alias);
  }

  const allElements = Array.from(specContent.children);
  let currentSectionMatches = false;

  for (const el of allElements) {
    const isHeading = /^H[1-6]$/.test(el.tagName);

    if (isHeading) {
      const sectionId = el.id;
      const readiness = sectionReadiness[sectionId];
      const level = parseInt(el.tagName[1], 10);

      if (level === 1) {
        el.classList.add("section-filtered-out");
        currentSectionMatches = false;
      } else if (readiness !== undefined) {
        currentSectionMatches = categorySet.has(readiness);
        el.classList.toggle("section-filtered-out", !currentSectionMatches);
      } else {
        const hasMatchingChild = hasMatchingChildSection(el, level, matchingIds);
        el.classList.toggle("section-filtered-out", !hasMatchingChild);
        currentSectionMatches = hasMatchingChild;
      }
    } else {
      el.classList.toggle("section-filtered-out", !currentSectionMatches);
    }
  }

  // Show filter indicator with user-facing label
  const label = readinessLabels[categories[0]] || categories[0];
  showFilterIndicator(label);
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

function showFilterIndicator(label) {
  let indicator = document.querySelector(".readiness-filter-indicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.className = "readiness-filter-indicator";
    const tabBar = document.getElementById("left-rail-tabs");
    if (tabBar) tabBar.before(indicator);
  }
  // Count matching sections across all active filter categories
  const count = activeFilterCategories.reduce((sum, cat) => sum + (readinessCounts[cat] || 0), 0);
  const total = Object.values(readinessCounts).reduce((a, b) => a + b, 0);
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
  // Update inbox count badges (right rail + MC)
  const countBadge = document.getElementById("inbox-count-badge");
  if (countBadge) countBadge.textContent = items.length > 0 ? items.length : "";
  const mcInboxCount = document.getElementById("mc-inbox-count");
  if (mcInboxCount) mcInboxCount.textContent = items.length > 0 ? items.length : "";

  // Mirror items into MC inbox panel
  const mcInboxItems = document.getElementById("mc-inbox-items");
  if (mcInboxItems) {
    mcInboxItems.innerHTML = items.map((item) => `
      <div class="inbox-item status-${escapeHtml(item.status || "pending")}" data-id="${escapeHtml(item.id)}">
        <div class="inbox-item-body">
          <div class="inbox-item-top">
            <span class="inbox-type-badge type-${escapeHtml(item.type)}">${escapeHtml(item.type)}</span>
            <span class="inbox-item-time">${formatTimestamp(item.timestamp)}</span>
          </div>
          <div class="inbox-item-content">${escapeHtml(item.content)}</div>
        </div>
      </div>`).join("");
  }

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
  updateTopbar();
}

function updateTopbar() {
  const proj = projectList.find((p) => p.path === currentProjectPath);
  if (topbarProjectName) {
    topbarProjectName.textContent = proj ? proj.name : currentProjectPath ? currentProjectPath.split("/").pop() : "";
  }
  if (topbarVersion) {
    topbarVersion.textContent = proj && proj.externalVersion ? `v${proj.externalVersion}` : (specMeta["plugin-version"] ? `v${specMeta["plugin-version"]}` : "");
  }
  if (topbarSpecVersion) {
    topbarSpecVersion.textContent = specMeta["spec-version"] ? `spec ${specMeta["spec-version"]}` : "";
  }
  // Build label
  if (topbarBuildLabel) {
    const isActive = isBuildActive(buildState.workflowStep);
    topbarBuildLabel.classList.toggle("hidden", !isActive);
  }
  // Context bar
  updateTopbarContext();
}

function updateTopbarContext() {
  if (!topbarCtxFill || !topbarCtxPct) return;
  const ctx = buildState.contextUsage || 0;
  topbarCtxFill.style.width = `${ctx}%`;
  topbarCtxPct.textContent = ctx > 0 ? `${ctx}%` : "";
  // Color based on level
  if (ctx >= 75) {
    topbarCtxFill.style.background = "var(--error)";
  } else if (ctx >= 50) {
    topbarCtxFill.style.background = "var(--warning)";
  } else {
    topbarCtxFill.style.background = "var(--accent)";
  }
}

backToDashboard.addEventListener("click", (e) => {
  e.preventDefault();
  showDashboard();
});

// BUILD label click — toggle Mission Control
if (topbarBuildLabel) {
  topbarBuildLabel.style.cursor = "pointer";
  topbarBuildLabel.addEventListener("click", () => {
    toggleMissionControl();
  });
}

if (topbarSearch) {
  topbarSearch.addEventListener("click", () => openSearch());
}

// MC inbox input — click to expand into a real input
const mcInboxInputEl = document.getElementById("mc-inbox-input");
if (mcInboxInputEl) {
  mcInboxInputEl.addEventListener("click", () => {
    // Replace the placeholder with an actual textarea
    if (mcInboxInputEl.querySelector("textarea")) return;
    mcInboxInputEl.innerHTML = `<textarea class="mc-inbox-textarea" placeholder="Add idea, URL, or feature…" rows="2"></textarea>
      <button class="mc-inbox-submit" title="Submit">&#x2192;</button>`;
    const ta = mcInboxInputEl.querySelector("textarea");
    const btn = mcInboxInputEl.querySelector(".mc-inbox-submit");
    ta.focus();
    const submit = async () => {
      const content = ta.value.trim();
      if (!content) return;
      btn.disabled = true;
      ta.disabled = true;
      try {
        const q = currentProjectPath ? `?project=${encodeURIComponent(currentProjectPath)}` : "";
        await fetch(`/api/inbox${q}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "evolve", content }),
        });
        ta.value = "";
      } catch { /* retry manually */ }
      btn.disabled = false;
      ta.disabled = false;
      ta.focus();
    };
    btn.addEventListener("click", submit);
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
    });
  });
}

// Dashboard view toggle (Spec / Board / Map)
const dashViewToggle = document.getElementById("dashboard-view-toggle");
if (dashViewToggle) {
  dashViewToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".topbar-view-btn");
    if (!btn) return;
    const view = btn.dataset.view;
    dashViewToggle.querySelectorAll(".topbar-view-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    if (view === "spec" && dashboardData && dashboardData.projects && dashboardData.projects.length > 0) {
      // Drill into the first (or active) project
      const proj = dashboardData.projects.find((p) => p.path === currentProjectPath) || dashboardData.projects[0];
      showSpecView(proj.path);
    } else if (view === "board") {
      showDashboard();
    } else if (view === "map") {
      // Show spec view first (if not already), then open story map
      if (currentView === "dashboard" && dashboardData && dashboardData.projects && dashboardData.projects.length > 0) {
        const proj = dashboardData.projects.find((p) => p.path === currentProjectPath) || dashboardData.projects[0];
        showSpecView(proj.path);
      }
      toggleStoryMap(true);
    }
  });
}

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
  // Check explicit priority assignment first (user drag overrides auto-computation)
  const prio = priority.projects || {};
  for (const col of ["satisfied", "now", "next", "later", "inbox"]) {
    if ((prio[col] || []).includes(proj.path)) return col;
  }

  // Auto-compute satisfied from readiness if not explicitly assigned
  if (proj.readiness.total > 0 && proj.readiness.ready === proj.readiness.total) return "satisfied";

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

  // Scenario score bar (compact: "N built / M total")
  let scenarioHtml = "";
  if (proj.scenarioScore && proj.scenarioScore.total > 0) {
    const sc = proj.scenarioScore;
    const satPct = Math.round((sc.satisfied / sc.total) * 100);
    const satColor = satPct >= 80 ? "#4ade80" : satPct >= 50 ? "#eab308" : "var(--text-muted)";
    scenarioHtml = `<div class="card-scenario-score" style="font-size:0.7rem;color:${satColor};margin-top:0.25rem">${sc.satisfied} built / ${sc.total} scenarios</div>`;
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
  const specVersion = proj.specVersion ? `<span class="project-card-version">spec ${escapeHtml(proj.specVersion)}</span>` : "";
  const statusBadge = `<span class="card-badge ${statusClass}">${escapeHtml(statusLabel)}</span>`;
  return `<div class="project-card" draggable="true" data-path="${escapeHtml(proj.path)}" style="--card-accent: ${cardAccent}">
    <div class="project-card-header">
      <span class="project-card-name">${escapeHtml(proj.name)}</span>
    </div>
    ${proj.synopsis ? `<div class="project-card-synopsis">${escapeHtml(proj.synopsis)}</div>` : ""}
    <div class="project-card-meta">
      ${proj.externalVersion ? `<span class="project-card-version">${escapeHtml(proj.externalVersion)}</span>` : ""}
      ${specVersion}
      <span class="project-card-meta-spacer"></span>
      ${statusBadge}
    </div>
    ${buildHtml}
    ${scenarioHtml}
    <div class="project-card-actions">
      <button class="card-action-btn discover-btn" data-path="${escapeHtml(proj.path)}" title="Run discovery loop">&#x1F50D; Discover</button>
    </div>
  </div>`;
}

function renderInboxTriageCard(item) {
  const sections = (item.analysis && item.analysis.affectedSections) || [];
  const sectionsHtml = sections.length > 0
    ? `<div class="inbox-triage-sections">${sections.map(s =>
        `<span class="section-badge">#${escapeHtml(s.alias || s.number)}</span>`
      ).join("")}</div>`
    : "";
  return `<div class="project-card inbox-triage-card" draggable="true" data-inbox-id="${escapeHtml(item.id)}" data-project="${escapeHtml(item.project || "")}">
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

  // Sort projects by actionability: building > pending inbox > recent activity > dormant
  const sortedProjects = [...projects].sort((a, b) => {
    const aBuilding = a.build ? 1 : 0;
    const bBuilding = b.build ? 1 : 0;
    if (aBuilding !== bBuilding) return bBuilding - aBuilding;
    const aPending = a.inbox?.pending || 0;
    const bPending = b.inbox?.pending || 0;
    if (aPending !== bPending) return bPending - aPending;
    const aTime = new Date(a.lastActivity || 0).getTime();
    const bTime = new Date(b.lastActivity || 0).getTime();
    return bTime - aTime;
  });

  // Separate active vs dormant (no spec, no inbox, no activity in 30d)
  const DORMANT_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const activeProjects = [];
  const dormantProjects = [];
  for (const proj of sortedProjects) {
    const lastMs = new Date(proj.lastActivity || 0).getTime();
    const isDormant = (now - lastMs > DORMANT_MS) && !proj.inbox?.pending && !proj.build;
    (isDormant ? dormantProjects : activeProjects).push(proj);
  }

  // Update header
  const dormantLabel = dormantProjects.length > 0 ? ` (${activeProjects.length} active, ${dormantProjects.length} dormant)` : "";
  if (dashboardSubtitle) dashboardSubtitle.textContent = `All Projects${dormantLabel}`;
  kanbanBreadcrumb.innerHTML = '<span class="bc-current">Projects</span>';

  // Render project columns
  kanbanBoard.innerHTML = activeProjects.map(proj => renderProjectColumn(proj)).join("")
    + (dormantProjects.length > 0
      ? dormantProjects.map(proj =>
          `<div class="project-column dormant" data-path="${escapeHtml(proj.path)}">
            <div class="project-column-header">
              <span class="project-column-name">${escapeHtml(proj.name)}</span>
              <button class="dormant-show-btn">Show</button>
            </div>
          </div>`
        ).join("")
      : "");

  // Wire interactions
  wireProjectColumnInteractions();
}

function renderProjectColumn(proj) {
  const pct = proj.readiness.total > 0 ? Math.round((proj.readiness.ready / proj.readiness.total) * 100) : 0;
  const barColor = pct >= 80 ? "#4ade80" : pct >= 50 ? "#eab308" : pct > 0 ? "#ef4444" : "#52525b";
  const statusClass = proj.build ? "badge-building" : `badge-${proj.specStatus}`;
  const statusLabel = proj.build ? "building" : proj.specStatus;
  const lastAgo = proj.lastActivity ? formatRelativeTime(proj.lastActivity) : "never";
  const cardAccent = projectAccentColor(proj.name, proj.accentColor || null);

  // Build progress bar (replaces readiness bar when building)
  let progressHtml;
  if (proj.build && proj.build.progress) {
    const bp = proj.build.progress;
    const buildPct = bp.total > 0 ? Math.round((bp.current / bp.total) * 100) : 0;
    progressHtml = `<div class="project-progress">
      <div class="progress-track building"><div class="progress-fill" style="width:${buildPct}%;background:#6d8eff"></div></div>
      <span class="progress-label" style="color:#6d8eff">Building ${bp.current}/${bp.total}</span>
    </div>`;
  } else {
    progressHtml = `<div class="project-progress">
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${barColor}"></div></div>
      <span class="progress-label">${proj.readiness.ready}/${proj.readiness.total} built</span>
    </div>`;
  }

  // Inbox items
  const inboxItems = (proj.inbox?.items || []).filter(i => i.status === "pending" || i.status === "processed");
  let inboxHtml = "";
  if (inboxItems.length > 0) {
    const itemCards = inboxItems.map(item => {
      const isForeman = item.source === "foreman";
      const provenance = isForeman ? `<span class="inbox-provenance">\u2699 foreman</span>` : "";
      const typeBadgeColor = item.type === "evolve" ? "#1a3a2a" : item.type === "feature" ? "#3a1a3a" : "#1a3a5c";
      const typeBadgeTextColor = item.type === "evolve" ? "#4ade80" : item.type === "feature" ? "#c084fc" : "#6d8eff";
      const typeLabel = (item.type || "reference").toUpperCase();
      const actionLabel = item.type === "evolve" ? "Start Evolve" : item.type === "feature" ? "Discuss" : "Incorporate";
      const title = item.title || item.content || "";
      const displayTitle = title.length > 60 ? title.slice(0, 57) + "\u2026" : title;
      const time = item.timestamp ? formatRelativeTime(item.timestamp) : "";

      return `<div class="inbox-item-card" data-item-id="${escapeHtml(item.id)}" data-project="${escapeHtml(proj.path)}">
        <div class="inbox-item-meta">
          <span class="inbox-type-badge" style="background:${typeBadgeColor};color:${typeBadgeTextColor}">${typeLabel}</span>
          ${provenance}
          <span class="inbox-item-time">${escapeHtml(time)}</span>
        </div>
        <div class="inbox-item-title">${escapeHtml(displayTitle)}</div>
        <div class="inbox-item-actions">
          <button class="inbox-action-btn incorporate-btn">${actionLabel}</button>
          <button class="inbox-action-btn dismiss-btn">Dismiss</button>
        </div>
      </div>`;
    }).join("");

    inboxHtml = `<div class="project-column-divider"></div>
      <div class="project-inbox">
        <div class="project-inbox-header">
          <span>\uD83D\uDCEC ${inboxItems.length} pending</span>
          <span class="inbox-batch-spacer"></span>
          <button class="inbox-batch-btn batch-incorporate" data-project="${escapeHtml(proj.path)}">All</button>
          <button class="inbox-batch-btn batch-dismiss" data-project="${escapeHtml(proj.path)}">\u2715 All</button>
        </div>
        ${itemCards}
        <div class="project-quick-add">
          <input class="quick-add-field" placeholder="Add idea or URL\u2026" data-project="${escapeHtml(proj.path)}" />
          <button class="quick-add-submit" data-project="${escapeHtml(proj.path)}">\u2192</button>
        </div>
      </div>`;
  } else {
    inboxHtml = `<div class="project-column-divider"></div>
      <div class="project-inbox empty-inbox">
        <span class="empty-inbox-text">No pending items</span>
        <div class="project-quick-add">
          <input class="quick-add-field" placeholder="Add idea or URL\u2026" data-project="${escapeHtml(proj.path)}" />
          <button class="quick-add-submit" data-project="${escapeHtml(proj.path)}">\u2192</button>
        </div>
      </div>`;
  }

  return `<div class="project-column" data-path="${escapeHtml(proj.path)}" style="--card-accent:${cardAccent}">
    <div class="project-column-header">
      <div class="project-column-name-row">
        <span class="project-column-name">${escapeHtml(proj.name)}</span>
        <span class="card-badge ${statusClass}">${escapeHtml(statusLabel)}</span>
      </div>
      <div class="project-column-meta">${escapeHtml(proj.externalVersion || "")} \u00B7 active ${escapeHtml(lastAgo)}</div>
      ${progressHtml}
      <div class="project-column-actions">
        <button class="card-action-btn discover-btn" data-path="${escapeHtml(proj.path)}">\uD83D\uDD0D Discover</button>
        <button class="card-action-btn spec-btn" data-path="${escapeHtml(proj.path)}">Open Spec \u2192</button>
      </div>
    </div>
    ${inboxHtml}
  </div>`;
}

function wireProjectColumnInteractions() {
  // Discover buttons
  for (const btn of kanbanBoard.querySelectorAll(".discover-btn")) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      runDiscovery(btn.dataset.path, btn);
    });
  }

  // Open Spec buttons
  for (const btn of kanbanBoard.querySelectorAll(".spec-btn")) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      showSpecView(btn.dataset.path);
    });
  }

  // Project name click → drill to sections
  for (const name of kanbanBoard.querySelectorAll(".project-column-name")) {
    name.addEventListener("click", (e) => {
      e.stopPropagation();
      const col = name.closest(".project-column");
      if (col) drillToSections(col.dataset.path, name.textContent);
    });
    name.style.cursor = "pointer";
  }

  // Inbox item actions
  for (const btn of kanbanBoard.querySelectorAll(".incorporate-btn")) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const card = btn.closest(".inbox-item-card");
      updateInboxItem(card.dataset.itemId, card.dataset.project, "incorporated", card);
    });
  }
  for (const btn of kanbanBoard.querySelectorAll(".dismiss-btn")) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const card = btn.closest(".inbox-item-card");
      updateInboxItem(card.dataset.itemId, card.dataset.project, "dismissed", card);
    });
  }

  // Batch actions
  for (const btn of kanbanBoard.querySelectorAll(".batch-incorporate")) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      batchUpdateInbox(btn.dataset.project, "incorporated", btn);
    });
  }
  for (const btn of kanbanBoard.querySelectorAll(".batch-dismiss")) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      batchUpdateInbox(btn.dataset.project, "dismissed", btn);
    });
  }

  // Quick-add inputs
  for (const btn of kanbanBoard.querySelectorAll(".quick-add-submit")) {
    const input = btn.previousElementSibling;
    const submit = () => {
      const content = input.value.trim();
      if (!content) return;
      const type = content.startsWith("http") ? "reference" : "evolve";
      fetch(`/api/inbox?project=${encodeURIComponent(btn.dataset.project)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, content }),
      }).then(() => { input.value = ""; setTimeout(() => loadDashboard(), 1000); });
    };
    btn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  }

  // Dormant project show buttons
  for (const btn of kanbanBoard.querySelectorAll(".dormant-show-btn")) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const col = btn.closest(".project-column");
      if (col) col.classList.remove("dormant");
    });
  }
}

async function updateInboxItem(itemId, projectPath, status, cardEl) {
  try {
    await fetch(`/api/inbox/${itemId}?project=${encodeURIComponent(projectPath)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (cardEl) {
      cardEl.style.opacity = "0.3";
      setTimeout(() => cardEl.remove(), 300);
    }
  } catch {}
}

async function batchUpdateInbox(projectPath, status, btn) {
  if (btn) { btn.disabled = true; btn.textContent = "\u23F3"; }
  try {
    await fetch(`/api/inbox-batch?project=${encodeURIComponent(projectPath)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setTimeout(() => loadDashboard(), 500);
  } catch {}
}

// --- Discovery Loop Trigger ---

async function runDiscovery(projectPath, btn) {
  if (btn) {
    btn.disabled = true;
    btn.textContent = "\u23F3 Running\u2026";
  }
  try {
    const q = projectPath ? `?project=${encodeURIComponent(projectPath)}` : "";
    const res = await fetch(`/api/discover${q}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Discovery failed");
    if (btn) {
      btn.textContent = data.queued > 0
        ? `\u2713 ${data.queued} found`
        : "\u2713 No new gaps";
      setTimeout(() => {
        btn.textContent = "\uD83D\uDD0D Discover";
        btn.disabled = false;
      }, 3000);
    }
    // Refresh dashboard to show new inbox items
    if (data.queued > 0) {
      setTimeout(() => loadDashboard(), 1000);
    }
  } catch (err) {
    if (btn) {
      btn.textContent = "\u2717 " + (err.message || "Error").slice(0, 20);
      setTimeout(() => {
        btn.textContent = "\uD83D\uDD0D Discover";
        btn.disabled = false;
      }, 3000);
    }
  }
}

async function runDiscoveryAll(btn) {
  if (btn) {
    btn.disabled = true;
    btn.textContent = "\u23F3 Discovering\u2026";
  }
  try {
    const res = await fetch("/api/discover?all=true", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Discovery failed");
    if (btn) {
      btn.textContent = data.totalQueued > 0
        ? `\u2713 ${data.totalQueued} found across ${data.results.length} projects`
        : "\u2713 No new gaps";
      setTimeout(() => {
        btn.textContent = "\uD83D\uDD0D Discover All";
        btn.disabled = false;
      }, 4000);
    }
    if (data.totalQueued > 0) {
      setTimeout(() => loadDashboard(), 1000);
    }
  } catch (err) {
    if (btn) {
      btn.textContent = "\u2717 " + (err.message || "Error").slice(0, 30);
      setTimeout(() => {
        btn.textContent = "\uD83D\uDD0D Discover All";
        btn.disabled = false;
      }, 3000);
    }
  }
}

// Wire "Discover All" button
const discoverAllBtn = document.getElementById("discover-all-btn");
if (discoverAllBtn) {
  discoverAllBtn.addEventListener("click", () => runDiscoveryAll(discoverAllBtn));
}

// --- Kanban Drag & Drop ---

let draggedCard = null;

/**
 * Wire dragover/drop on the entire .kanban-column element (header + empty space)
 * so drops work anywhere in the column, not just on the body where cards exist.
 */
function wireColumnDropTargets(columns, bodies, onDrop) {
  for (const col of columns) {
    const body = col.querySelector(".kanban-column-body");
    if (!body) continue;

    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      body.classList.add("drag-over");
    });

    col.addEventListener("dragleave", (e) => {
      if (!col.contains(e.relatedTarget)) {
        body.classList.remove("drag-over");
      }
    });

    col.addEventListener("drop", (e) => {
      e.preventDefault();
      body.classList.remove("drag-over");
      if (!draggedCard) return;

      // If the body's own drop handler already moved the card, skip
      if (draggedCard.closest(".kanban-column-body") === body) return;

      body.appendChild(draggedCard);
      if (onDrop) onDrop();
    });
  }
}

function setupKanbanDragDrop() {
  const cards = kanbanBoard.querySelectorAll(".project-card");
  const bodies = kanbanBoard.querySelectorAll(".kanban-column-body");
  const columns = kanbanBoard.querySelectorAll(".kanban-column");

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

  // Also listen on the column itself (header + empty space) so the entire
  // column area is a drop target, not just the body where cards already exist.
  wireColumnDropTargets(columns, bodies, () => savePriorityFromDOM());
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
  const prio = { projects: {}, inboxItems: {} };
  for (const col of KANBAN_COLUMNS) {
    const body = kanbanBoard.querySelector(`.kanban-column-body[data-column="${col}"]`);
    if (!body) continue;
    const paths = [...body.querySelectorAll(".project-card:not(.inbox-triage-card)")].map(c => c.dataset.path).filter(Boolean);
    const inboxIds = [...body.querySelectorAll(".inbox-triage-card")].map(c => c.dataset.inboxId).filter(Boolean);
    if (paths.length) prio.projects[col] = paths;
    if (inboxIds.length) {
      if (!prio.inboxItems[col]) prio.inboxItems[col] = [];
      prio.inboxItems[col].push(...inboxIds);
    }
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
  // Explicit assignment overrides auto-computation
  const key = section.alias || section.number;
  const prio = priority.sections || {};
  for (const col of ["satisfied", "now", "next", "later", "inbox"]) {
    if ((prio[col] || []).includes(key)) return col;
  }
  // Auto-compute satisfied from readiness
  if (section.readiness === "aligned" || section.readiness === "satisfied") return "satisfied";
  return "next";
}

function getClaimColumn(claim, priority) {
  const prio = priority.claims || {};
  for (const col of ["satisfied", "now", "next", "later", "inbox"]) {
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

  // Update header
  if (dashboardSubtitle) dashboardSubtitle.textContent = kanbanProjectName || "Project";
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
  // Explicit assignment overrides auto-computation
  const key = scenario.title;
  const prio = priority.scenarios || {};
  for (const col of ["satisfied", "now", "next", "later", "inbox"]) {
    if ((prio[col] || []).includes(key)) return col;
  }
  // Auto-place satisfied scenarios
  if (scenario.satisfaction === "satisfied") return "satisfied";
  return "next";
}

function renderScenarioCard(scenario) {
  const sectionTags = scenario.validates.map(v =>
    `<span class="card-badge" style="font-size:0.6rem">#${escapeHtml(v.alias)}</span>`
  ).join("");
  const feature = scenario.feature;
  const categoryShort = feature ? { "Core Workflow": "Core", "Build": "Build", "Viewer": "Viewer", "System Quality": "SQ" }[feature.category] || feature.category : "";
  const featureLabel = feature ? feature.name : "";

  // Satisfaction badge — colored dot + label
  const satColors = { satisfied: "#4ade80", partial: "#eab308", unsatisfied: "#ef4444", unlinked: "#666" };
  const satLabels = { satisfied: "built", partial: "partial", unsatisfied: "specced", unlinked: "—" };
  const sat = scenario.satisfaction || "unlinked";
  const satBadge = `<span class="card-badge" style="font-size:0.6rem;color:${satColors[sat]}">\u25CF ${satLabels[sat]}</span>`;

  // Border color reflects satisfaction
  const borderColor = satColors[sat] || "var(--card-accent, var(--accent))";

  return `<div class="project-card scenario-card" draggable="true" data-key="${escapeHtml(scenario.title)}" style="border-left-color: ${borderColor}">
    <div class="project-card-header">
      <span class="project-card-name" style="font-size:0.85rem">${escapeHtml(scenario.title)}</span>
    </div>
    <div class="project-card-badges">
      ${satBadge}
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

  // Satisfaction summary from API response
  const satSummary = scenariosData?.summary;
  const satBar = satSummary && satSummary.total > 0
    ? `<span class="scenario-sat-summary" style="margin-left:auto;font-size:0.75rem;opacity:0.8">` +
      (satSummary.satisfied > 0 ? `<span style="color:#4ade80">${satSummary.satisfied} built</span>` : "") +
      (satSummary.partial > 0 ? `${satSummary.satisfied > 0 ? " \u00b7 " : ""}<span style="color:#eab308">${satSummary.partial} partial</span>` : "") +
      ` \u00b7 ${satSummary.total} total</span>`
    : "";

  // Toggle control — insert before kanban-board, not inside it
  let toggleEl = kanbanBoard.previousElementSibling;
  if (toggleEl && toggleEl.classList.contains("kanban-view-toggle")) {
    toggleEl.remove();
  }
  kanbanBoard.insertAdjacentHTML("beforebegin", `<div class="kanban-view-toggle">
    <button class="kanban-toggle-btn ${sectionsGroupMode === 'sections' ? 'active' : ''}" data-mode="sections">Sections</button>
    <button class="kanban-toggle-btn ${sectionsGroupMode === 'scenarios' ? 'active' : ''}" data-mode="scenarios">Scenarios</button>
    ${satBar}
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

  // Update header
  if (dashboardSubtitle) dashboardSubtitle.textContent = kanbanProjectName || "Project";
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
      // satisfied column accepts drops
      const afterEl = getDragAfterElement(body, e.clientY);
      if (afterEl) body.insertBefore(draggedCard, afterEl);
      else body.appendChild(draggedCard);
      saveScenariosPriorityFromDOM();
    });
  }

  wireColumnDropTargets(kanbanBoard.querySelectorAll(".kanban-column"), bodies, () => saveScenariosPriorityFromDOM());
}

async function saveScenariosPriorityFromDOM() {
  if (!kanbanPriority.scenarios) kanbanPriority.scenarios = {};
  for (const col of KANBAN_COLUMNS) {
    // include satisfied — user can manually drag items there
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
      // satisfied column accepts drops
      const afterEl = getDragAfterElement(body, e.clientY);
      if (afterEl) body.insertBefore(draggedCard, afterEl);
      else body.appendChild(draggedCard);
      saveSectionsPriorityFromDOM();
    });
  }

  wireColumnDropTargets(kanbanBoard.querySelectorAll(".kanban-column"), bodies, () => saveSectionsPriorityFromDOM());
}

async function saveSectionsPriorityFromDOM() {
  if (!kanbanPriority.sections) kanbanPriority.sections = {};
  for (const col of KANBAN_COLUMNS) {
    // include satisfied — user can manually drag items there
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

  // Update header
  if (dashboardSubtitle) dashboardSubtitle.textContent = kanbanProjectName || "Project";
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
      // satisfied column accepts drops
      const afterEl = getDragAfterElement(body, e.clientY);
      if (afterEl) body.insertBefore(draggedCard, afterEl);
      else body.appendChild(draggedCard);
      saveClaimsPriorityFromDOM();
    });
  }

  wireColumnDropTargets(kanbanBoard.querySelectorAll(".kanban-column"), bodies, () => saveClaimsPriorityFromDOM());
}

async function saveClaimsPriorityFromDOM() {
  if (!kanbanPriority.claims) kanbanPriority.claims = {};
  for (const col of KANBAN_COLUMNS) {
    // include satisfied — user can manually drag items there
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
