// fctry Spec Viewer — client-side application

const specContent = document.getElementById("spec-content");
const tocNav = document.getElementById("toc");
const statusDot = document.getElementById("connection-status");
const highlightIndicator = document.getElementById("highlight-indicator");
const highlightSection = document.getElementById("highlight-section");

let currentScrollPosition = 0;
let ws = null;
let reconnectTimer = null;

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
  const observer = new IntersectionObserver(
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
    if (heading.id) observer.observe(heading);
  }
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

// --- Keyboard Shortcuts ---

document.addEventListener("keydown", (e) => {
  // Ctrl+K or Cmd+K — section search (focus TOC)
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    // Simple: focus first TOC link, user can arrow-key navigate
    const firstLink = tocNav.querySelector("a");
    if (firstLink) firstLink.focus();
  }

  // ? — show shortcuts help (when not in input)
  if (e.key === "?" && !e.target.closest("input, textarea")) {
    alert(
      "Keyboard Shortcuts:\n\n" +
        "Ctrl+K / Cmd+K — Jump to section\n" +
        "↑/↓ — Navigate TOC (when focused)\n" +
        "? — Show this help"
    );
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
