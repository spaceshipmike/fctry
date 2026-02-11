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

// --- Markdown Rendering ---

function renderSpec(markdown) {
  // Save scroll position before re-render
  currentScrollPosition = document.documentElement.scrollTop;

  // Parse and sanitize markdown
  const html = DOMPurify.sanitize(marked.parse(markdown));
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

    links.push(
      `<a href="#${id}" class="toc-${level}" data-section="${id}">${text}</a>`
    );
  }

  tocNav.innerHTML = links.join("");

  // Add click handlers for smooth scroll
  for (const link of tocNav.querySelectorAll("a")) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.getElementById(link.dataset.section);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        setActiveSection(link.dataset.section);
      }
    });
  }
}

function setActiveSection(sectionId) {
  for (const link of tocNav.querySelectorAll("a")) {
    link.classList.toggle("active", link.dataset.section === sectionId);
  }
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
    statusDot.title = "Live updates disconnected — refresh to reconnect";

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

// --- Initial Load ---

async function init() {
  try {
    const response = await fetch("/spec.md");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const markdown = await response.text();
    renderSpec(markdown);
    setupScrollSpy();
  } catch (err) {
    specContent.innerHTML = `<p class="loading">Failed to load spec: ${err.message}</p>`;
  }

  // Connect WebSocket for live updates
  connectWebSocket();
}

init();
