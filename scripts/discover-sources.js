#!/usr/bin/env node
/**
 * Source discovery for the automated research loop.
 *
 * Takes gap queries from detect-gaps.js, searches available sources,
 * filters for novelty, and outputs inbox-ready candidates.
 *
 * Source adapters:
 *   - GitHub: `gh search repos` (requires gh CLI)
 *   - npm: registry search API (for Node.js projects)
 *   - knowmarks: MCP tool search (when viewer is running)
 *
 * Usage:
 *   node scripts/detect-gaps.js --json | node scripts/discover-sources.js [project-dir]
 *   node scripts/discover-sources.js [project-dir] --query "kanban drag drop"
 *   node scripts/discover-sources.js [project-dir] --dry-run
 */

const { readFileSync, writeFileSync, existsSync, openSync, readSync, closeSync } = require("fs");
const { join, resolve } = require("path");
const { execSync } = require("child_process");

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
const projectDir = resolve(args[0] || process.cwd());
const dryRun = flags.includes("--dry-run");
const manualQuery = flags.find((f) => f.startsWith("--query="))?.slice(8) ||
  (flags.includes("--query") ? args[1] : null);

const fctryDir = join(projectDir, ".fctry");
const specPath = join(fctryDir, "spec.md");
const inboxPath = join(fctryDir, "inbox.json");

// --- Existing references (novelty filter baseline) ---

function loadExistingReferences() {
  const refs = new Set();
  try {
    const content = readFileSync(specPath, "utf-8");
    // Extract reference names from section 5.2 and inspirations 5.1
    const namePattern = /\*\*([^*]+)\*\*/g;
    const refSections = content.match(/### 5\.[12].*?\n([\s\S]*?)(?=\n### |\n## |$)/g);
    if (refSections) {
      for (const section of refSections) {
        let m;
        while ((m = namePattern.exec(section)) !== null) {
          refs.add(m[1].toLowerCase().trim());
        }
      }
    }
    // Also extract from inbox (already queued items)
    if (existsSync(inboxPath)) {
      const inbox = JSON.parse(readFileSync(inboxPath, "utf-8"));
      for (const item of inbox) {
        if (item.content) refs.add(item.content.toLowerCase().trim());
        if (item.title) refs.add(item.title.toLowerCase().trim());
      }
    }
  } catch {}
  return refs;
}

// --- Source Adapters ---

// Map tech-stack entries to GitHub language filters
const STACK_TO_LANGUAGE = {
  "node.js": "javascript", "javascript": "javascript", "typescript": "typescript",
  "python": "python", "rust": "rust", "go": "go", "ruby": "ruby",
  "java": "java", "kotlin": "kotlin", "swift": "swift", "c#": "c#",
  "php": "php", "elixir": "elixir", "dart": "dart", "c++": "c++",
};

/**
 * Detect primary language from tech-stack for GitHub filtering.
 */
function detectLanguage() {
  try {
    const content = readFileSync(specPath, "utf-8").slice(0, 4000);
    const match = content.match(/tech-stack:\s*\[([^\]]+)\]/);
    if (match) {
      const stack = match[1].split(",").map((s) => s.trim().replace(/['"]/g, "").toLowerCase());
      for (const s of stack) {
        if (STACK_TO_LANGUAGE[s]) return STACK_TO_LANGUAGE[s];
      }
    }
  } catch {}
  return null;
}

const ghLanguage = detectLanguage();

/**
 * Search GitHub repos via `gh search repos`.
 * Returns up to `limit` results with title, URL, description.
 * Filters by language (from tech-stack) and minimum star count.
 */
function searchGitHub(query, limit = 5) {
  try {
    const langFilter = ghLanguage ? ` --language ${ghLanguage}` : "";
    const result = execSync(
      `gh search repos "${query.replace(/"/g, '\\"')}" --limit ${limit * 2}${langFilter} --json name,url,description,stargazersCount --sort stars`,
      { encoding: "utf-8", timeout: 15000, stdio: ["pipe", "pipe", "pipe"] }
    );
    const repos = JSON.parse(result);
    // Filter to repos with at least 5 stars to reduce noise
    return repos
      .filter((r) => (r.stargazersCount || 0) >= 5)
      .slice(0, limit)
      .map((r) => ({
        source: "github",
        title: r.name,
        url: r.url,
        summary: (r.description || "").slice(0, 200),
        stars: r.stargazersCount,
      }));
  } catch {
    return []; // gh not available or search failed
  }
}

/**
 * Search npm registry via the public API.
 */
function searchNpm(query, limit = 5) {
  try {
    const encoded = encodeURIComponent(query);
    const result = execSync(
      `curl -s "https://registry.npmjs.org/-/v1/search?text=${encoded}&size=${limit}"`,
      { encoding: "utf-8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] }
    );
    const data = JSON.parse(result);
    return (data.objects || []).map((o) => ({
      source: "npm",
      title: o.package.name,
      url: `https://www.npmjs.com/package/${o.package.name}`,
      summary: (o.package.description || "").slice(0, 200),
      score: Math.round((o.score?.final || 0) * 100),
    }));
  } catch {
    return []; // curl not available or API failed
  }
}

/**
 * Search knowmarks via the viewer's MCP proxy (if running).
 * The viewer proxies knowmarks MCP calls when the server is available.
 */
function searchKnowmarks(query, limit = 5) {
  try {
    // Check if viewer is running by reading port file
    const portPath = join(require("os").homedir(), ".fctry", "viewer.port.json");
    if (!existsSync(portPath)) return [];
    const { port } = JSON.parse(readFileSync(portPath, "utf-8"));

    // The viewer doesn't proxy MCP calls directly, so we skip this for now.
    // Knowmarks search works via the MCP tool in Claude Code sessions,
    // not via HTTP. This adapter is a placeholder for future MCP-over-HTTP.
    return [];
  } catch {
    return [];
  }
}


/**
 * Search Reddit for relevant discussions via the public JSON API.
 * Targets programming/design subreddits for higher signal.
 */
function searchReddit(query, limit = 5) {
  try {
    const encoded = encodeURIComponent(query);
    const result = execSync(
      `curl -s -A "Mozilla/5.0 (compatible; fctry-discovery/1.0)" "https://www.reddit.com/search.json?q=${encoded}&sort=relevance&t=year&limit=${limit * 2}"`,
      { encoding: "utf-8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] }
    );
    const data = JSON.parse(result);
    const posts = (data?.data?.children || [])
      .filter((c) => c.data && c.data.score > 5) // filter low-quality
      .slice(0, limit)
      .map((c) => ({
        source: "reddit",
        title: c.data.title,
        url: `https://reddit.com${c.data.permalink}`,
        summary: (c.data.selftext || "").slice(0, 200),
        score: c.data.score,
        subreddit: c.data.subreddit,
      }));
    return posts;
  } catch {
    return [];
  }
}

/**
 * Web search via Firecrawl API.
 * Returns articles, blog posts, design case studies, documentation.
 * API key read from 1Password: op://Dev/Firecrawl API Key/credential
 */
function searchWeb(query, limit = 5) {
  try {
    // Read API key from 1Password
    let apiKey;
    try {
      apiKey = execSync('op read "op://Dev/Firecrawl API Key/credential"', {
        encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    } catch {
      // 1Password not available — try environment variable fallback
      apiKey = process.env.FIRECRAWL_API_KEY;
    }
    if (!apiKey || apiKey.startsWith("FILL")) return [];

    const payload = JSON.stringify({
      query,
      limit: limit * 2,
      scrapeOptions: { formats: ["markdown"] },
    });

    const result = execSync(
      `curl -s -X POST "https://api.firecrawl.dev/v1/search" ` +
      `-H "Content-Type: application/json" ` +
      `-H "Authorization: Bearer ${apiKey}" ` +
      `-d '${payload.replace(/'/g, "'\\''")}'`,
      { encoding: "utf-8", timeout: 15000, stdio: ["pipe", "pipe", "pipe"] }
    );

    const data = JSON.parse(result);
    if (!data.success || !Array.isArray(data.data)) return [];

    return data.data
      .filter((r) => r.url && !r.url.includes("github.com") && !r.url.includes("npmjs.com"))
      .slice(0, limit)
      .map((r) => ({
        source: "web",
        title: r.title || r.url,
        url: r.url,
        summary: (r.description || r.markdown || "").slice(0, 200),
      }));
  } catch {
    return [];
  }
}

// --- Novelty Filter ---

function filterNovelty(candidates, existingRefs) {
  return candidates.filter((c) => {
    const titleLower = c.title.toLowerCase();
    // Skip if the title matches an existing reference
    for (const ref of existingRefs) {
      if (ref.includes(titleLower) || titleLower.includes(ref)) return false;
    }
    return true;
  });
}

// --- Queue to Inbox ---

/**
 * Try to POST an inbox item to the viewer API for immediate processing.
 * Returns true if successful, false if viewer isn't running.
 */
function postToViewer(item) {
  try {
    const portPath = join(require("os").homedir(), ".fctry", "viewer.port.json");
    if (!existsSync(portPath)) return false;
    const { port } = JSON.parse(readFileSync(portPath, "utf-8"));
    const projectParam = encodeURIComponent(projectDir);
    execSync(
      `curl -s -X POST "http://localhost:${port}/api/inbox?project=${projectParam}" ` +
      `-H "Content-Type: application/json" ` +
      `-d '${JSON.stringify({ type: item.type, content: item.content }).replace(/'/g, "'\\''")}'`,
      { timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }
    );
    return true;
  } catch {
    return false;
  }
}

function queueToInbox(candidates, gapContext) {
  let inbox = [];
  try {
    if (existsSync(inboxPath)) {
      inbox = JSON.parse(readFileSync(inboxPath, "utf-8"));
    }
  } catch {
    inbox = [];
  }

  let added = 0;
  for (const candidate of candidates) {
    // Deduplicate by URL
    if (inbox.some((item) => item.content === candidate.url || item.url === candidate.url)) {
      continue;
    }

    const item = {
      id: `discover-${Date.now()}-${added}`,
      type: "reference",
      content: candidate.url,
      title: candidate.title,
      note: `${candidate.summary} [${candidate.source}${candidate.stars ? `, ${candidate.stars} stars` : ""}]`,
      source: "foreman",
      status: "pending",
      timestamp: new Date().toISOString(),
      discoveryContext: gapContext || null,
    };

    if (!dryRun) {
      // Try viewer API first (triggers immediate background processing)
      const posted = postToViewer(item);
      if (!posted) {
        // Viewer not running — write directly to inbox.json
        inbox.push(item);
      }
      // If posted, the viewer handles persistence + processing
    }
    added++;
  }

  // Write any items that didn't go through the viewer API
  if (added > 0 && !dryRun && inbox.length > 0) {
    // Re-read to avoid clobbering viewer writes
    let current = [];
    try {
      if (existsSync(inboxPath)) current = JSON.parse(readFileSync(inboxPath, "utf-8"));
    } catch {}
    // Merge: add items not already present
    for (const item of inbox) {
      if (!current.some((c) => c.id === item.id)) {
        current.push(item);
      }
    }
    writeFileSync(inboxPath, JSON.stringify(current, null, 2) + "\n");
  }
  return added;
}

// --- Discovery Cooldown ---
// Prevents re-researching the same gaps within COOLDOWN_HOURS

const COOLDOWN_HOURS = 24;
const discoveryLogPath = join(require("os").homedir(), ".fctry", "discovery-log.json");

function loadDiscoveryLog() {
  try {
    if (!existsSync(discoveryLogPath)) return {};
    return JSON.parse(readFileSync(discoveryLogPath, "utf-8"));
  } catch {
    return {};
  }
}

function saveDiscoveryLog(log) {
  try {
    const { mkdirSync } = require("fs");
    mkdirSync(join(require("os").homedir(), ".fctry"), { recursive: true });
    writeFileSync(discoveryLogPath, JSON.stringify(log, null, 2) + "\n");
  } catch {}
}

function isOnCooldown(alias, log) {
  const entry = log[alias];
  if (!entry) return false;
  const elapsed = (Date.now() - new Date(entry.timestamp).getTime()) / (1000 * 60 * 60);
  return elapsed < COOLDOWN_HOURS;
}

function recordDiscovery(alias, log, queued) {
  log[alias] = {
    timestamp: new Date().toISOString(),
    queued,
    project: projectDir,
  };
}

// --- Main ---

async function main() {
  const existingRefs = loadExistingReferences();
  const discoveryLog = loadDiscoveryLog();

  let gaps;
  if (manualQuery) {
    // Manual query mode: single query, no gap detection, no cooldown
    gaps = [{ title: "Manual search", queries: [manualQuery], alias: "manual" }];
  } else {
    // Read gap data from stdin (piped from detect-gaps.js --json)
    try {
      const input = readFileSync(0, "utf-8");
      const gapData = JSON.parse(input);
      gaps = gapData.gaps || [];
    } catch {
      // No stdin — run detect-gaps inline
      try {
        const result = execSync(`node "${join(__dirname, "detect-gaps.js")}" "${projectDir}" --json`, {
          encoding: "utf-8",
          timeout: 10000,
        });
        const gapData = JSON.parse(result);
        gaps = gapData.gaps || [];
      } catch (err) {
        console.error("Failed to detect gaps:", err.message);
        process.exit(1);
      }
    }

    // Apply cooldown filter (skip gaps researched within COOLDOWN_HOURS)
    const beforeCount = gaps.length;
    gaps = gaps.filter((g) => !isOnCooldown(g.alias, discoveryLog));
    if (beforeCount > gaps.length) {
      console.log(`${beforeCount - gaps.length} gap(s) on cooldown (researched within ${COOLDOWN_HOURS}h)`);
    }
  }

  if (gaps.length === 0) {
    console.log("No gaps to search for.");
    process.exit(0);
  }

  // Take top 3 gaps to avoid excessive API calls
  const topGaps = gaps.slice(0, 3);
  let totalCandidates = 0;
  let totalQueued = 0;

  for (const gap of topGaps) {
    const query = gap.queries[0]; // Use primary query
    if (!query) continue;

    console.log(`Searching: "${query}" (for ${gap.title || gap.alias})`);

    // Search all available sources (sequential for simplicity in Node CJS)
    const ghResults = searchGitHub(query);
    const npmResults = searchNpm(query);
    const webResults = searchWeb(query);
    const redditResults = searchReddit(query);
    const kmResults = searchKnowmarks(query);

    const allResults = [...ghResults, ...npmResults, ...webResults, ...redditResults, ...kmResults];
    totalCandidates += allResults.length;

    // Apply novelty filter
    const novel = filterNovelty(allResults, existingRefs);

    if (novel.length === 0) {
      console.log(`  ${allResults.length} found, 0 novel (all already in spec or inbox)`);
      continue;
    }

    // Take top 3 novel results per gap
    const top = novel.slice(0, 3);

    if (dryRun) {
      console.log(`  ${allResults.length} found, ${novel.length} novel (dry run — not queuing)`);
      for (const c of top) {
        console.log(`    ${c.source}: ${c.title} — ${c.url}`);
        if (c.summary) console.log(`      ${c.summary}`);
      }
    } else {
      const queued = queueToInbox(top, `Gap: ${gap.title} (${gap.alias})`);
      totalQueued += queued;
      console.log(`  ${allResults.length} found, ${novel.length} novel, ${queued} queued to inbox`);
    }

    // Add newly queued items to existing refs to avoid cross-gap duplicates
    for (const c of top) {
      existingRefs.add(c.title.toLowerCase());
    }

    // Record this gap as researched (cooldown starts now)
    if (!dryRun && gap.alias !== "manual") {
      recordDiscovery(gap.alias, discoveryLog, top.length);
    }
  }

  // Save cooldown log
  if (!dryRun) {
    saveDiscoveryLog(discoveryLog);
  }

  console.log(`\nTotal: ${totalCandidates} candidates, ${totalQueued} queued to inbox`);
}

main();
