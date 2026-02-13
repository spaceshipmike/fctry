// fctry Spec Viewer — client-side application

const specContent = document.getElementById("spec-content");
const tocNav = document.getElementById("toc");
const statusDot = document.getElementById("connection-status");
const highlightIndicator = document.getElementById("highlight-indicator");
const highlightSection = document.getElementById("highlight-section");

let currentScrollPosition = 0;
let ws = null;
let reconnectTimer = null;
let scrollSpyObserver = null;
let lastTocSignature = "";
let sectionReadiness = {}; // alias → readiness value

// --- Markdown Rendering ---

function renderSpec(markdown) {
  // Save scroll position before re-render
  currentScrollPosition = document.documentElement.scrollTop;

  // Parse, process annotations, and sanitize markdown
  const rawHtml = marked.parse(markdown);
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

// --- WebSocket Connection ---

function connectWebSocket() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.addEventListener("open", () => {
    statusDot.className = "status connected";
    statusDot.title = "Live updates active";
    if (reconnectTimer) {
      clearInterval(reconnectTimer);
      reconnectTimer = null;
    }
  });

  ws.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);

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
      }

      if (data.type === "viewer-state") {
        if (data.activeSection) {
          highlightAgentSection(data.activeSection);
        } else {
          clearHighlight();
        }
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.addEventListener("close", () => {
    statusDot.className = "status disconnected";
    statusDot.title = "Reconnecting…";

    // Auto-reconnect after 3 seconds
    if (!reconnectTimer) {
      reconnectTimer = setInterval(() => {
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

// --- Change History ---

const historyPanel = document.getElementById("history-panel");
const historyTimeline = document.getElementById("history-timeline");
const historyToggle = document.getElementById("history-toggle");
const historyClose = document.getElementById("history-close");

historyToggle.addEventListener("click", () => toggleHistory());
historyClose.addEventListener("click", () => toggleHistory(false));

function toggleHistory(force) {
  const show = force !== undefined ? force : historyPanel.classList.contains("hidden");
  historyPanel.classList.toggle("visible", show);
  historyPanel.classList.toggle("hidden", !show);
}

function parseChangelog(markdown) {
  // Parse changelog entries: "## TIMESTAMP — /fctry:command\n- changes..."
  const entries = [];
  const sections = markdown.split(/^## /m).filter(Boolean);

  for (const section of sections) {
    const lines = section.trim().split("\n");
    const headerLine = lines[0] || "";

    // Parse "2026-02-11T15:23:45Z — /fctry:evolve core-flow"
    const headerMatch = headerLine.match(/^(.+?)\s*[—–-]\s*(.+)$/);
    const timestamp = headerMatch ? headerMatch[1].trim() : headerLine.trim();
    const command = headerMatch ? headerMatch[2].trim() : "";

    const changes = lines
      .slice(1)
      .filter((l) => l.startsWith("- "))
      .map((l) => l.slice(2).trim());

    entries.push({ timestamp, command, changes });
  }

  return entries;
}

function renderTimeline(entries) {
  if (!entries.length) {
    historyTimeline.innerHTML =
      '<p style="padding:1rem;color:var(--text-muted);font-size:0.85rem;">No changelog yet.</p>';
    return;
  }

  historyTimeline.innerHTML = entries
    .map(
      (entry, i) => `
      <div class="history-entry" data-index="${i}">
        <div class="history-date">${formatTimestamp(entry.timestamp)}</div>
        <div class="history-command">${escapeHtml(entry.command)}</div>
        <div class="history-changes">
          ${entry.changes.map((c) => escapeHtml(c)).join("<br>")}
        </div>
      </div>`
    )
    .join("");

  // Click to highlight affected sections
  for (const el of historyTimeline.querySelectorAll(".history-entry")) {
    el.addEventListener("click", () => {
      // Toggle selected state
      const wasSelected = el.classList.contains("selected");
      for (const other of historyTimeline.querySelectorAll(".history-entry")) {
        other.classList.remove("selected");
      }
      if (!wasSelected) {
        el.classList.add("selected");
        // Extract section aliases from changes and highlight first one
        const entry = entries[Number(el.dataset.index)];
        const aliasMatch = entry.changes.join(" ").match(/#([\w-]+)/);
        if (aliasMatch) highlightAgentSection(aliasMatch[1]);
      } else {
        clearHighlight();
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

async function loadChangelog() {
  try {
    const res = await fetch("/changelog.md");
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
      <input type="text" id="search-input" placeholder="Jump to section…" autocomplete="off">
      <ul id="search-results"></ul>
      <div class="search-hint">↑↓ navigate · Enter select · Esc close</div>
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

// --- Keyboard Shortcuts ---

document.addEventListener("keydown", (e) => {
  // Ctrl+K or Cmd+K — section search
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    openSearch();
    return;
  }

  // Escape — close search
  if (e.key === "Escape") {
    closeSearch();
    return;
  }

  // h — toggle history panel (when not in input)
  if (e.key === "h" && !e.target.closest("input, textarea")) {
    e.preventDefault();
    toggleHistory();
    return;
  }

  // ? — show shortcuts help (when not in input)
  if (e.key === "?" && !e.target.closest("input, textarea")) {
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
        <dt>↑ / ↓</dt><dd>Navigate sections (in TOC or search)</dd>
        <dt>Enter</dt><dd>Select section</dd>
        <dt>h</dt><dd>Toggle change history</dd>
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

async function loadReadiness() {
  try {
    const res = await fetch("/readiness.json");
    const data = await res.json();
    sectionReadiness = {};
    for (const s of data.sections || []) {
      if (s.alias) sectionReadiness[s.alias] = s.readiness;
    }
    // Force TOC rebuild with readiness classes
    lastTocSignature = "";
    buildToc();
  } catch {
    // Readiness data unavailable — TOC works without it
  }
}

// --- Initial Load ---

async function init() {
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
      `<p>Make sure a <code>*-spec.md</code> file exists in the project directory and the viewer server is running.</p>` +
      `</div>`;
  }

  // Load changelog for history panel
  loadChangelog();

  // Load section readiness
  loadReadiness();

  // Connect WebSocket for live updates
  connectWebSocket();
}

init();
