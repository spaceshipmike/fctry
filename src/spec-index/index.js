/**
 * SQLite-backed spec index for fctry.
 *
 * Provides structured access to spec sections without loading the full
 * markdown file. The markdown file is always the source of truth — this
 * database is a derived cache that can be deleted and rebuilt at any time.
 *
 * Usage:
 *   import { SpecIndex } from './index.js';
 *   const idx = new SpecIndex('/path/to/project');
 *   idx.rebuild('/path/to/spec.md', '/path/to/changelog.md');
 *   const section = idx.getByAlias('core-flow');
 *   idx.close();
 */

import { mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { createRequire } from "module";
import { createHash } from "crypto";
import { parseSpec, parseChangelog } from "./parser.js";

const require = createRequire(import.meta.url);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alias TEXT,
  number TEXT,
  heading TEXT NOT NULL,
  content TEXT NOT NULL,
  parent TEXT,
  word_count INTEGER DEFAULT 0,
  level INTEGER DEFAULT 2,
  line_start INTEGER DEFAULT 0,
  readiness TEXT DEFAULT 'draft',
  last_updated TEXT
);

CREATE TABLE IF NOT EXISTS changelog_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  command TEXT,
  changes TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS section_embeddings (
  alias TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  embedding BLOB,
  model_id TEXT,
  computed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sections_alias ON sections(alias) WHERE alias IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sections_number ON sections(number) WHERE number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sections_readiness ON sections(readiness);
`;

/** Cache the driver so we only attempt to load once. */
let _driver;
let _driverLoaded = false;

function loadDriver() {
  if (_driverLoaded) return _driver;
  _driverLoaded = true;
  try {
    _driver = require("better-sqlite3");
  } catch {
    _driver = null;
  }
  return _driver;
}

export class SpecIndex {
  /**
   * @param {string} projectDir - Project root directory (contains .fctry/)
   */
  constructor(projectDir) {
    this.projectDir = projectDir;
    this.fctryDir = join(projectDir, ".fctry");
    this.dbPath = join(this.fctryDir, "spec.db");
    this.db = null;
  }

  /**
   * Open the database connection. Creates .fctry/ and the DB if needed.
   * Returns false if better-sqlite3 is not available (graceful degradation).
   */
  open() {
    if (this.db) return true;

    const Database = loadDriver();
    if (!Database) return false;

    try {
      mkdirSync(this.fctryDir, { recursive: true });
      this.db = new Database(this.dbPath);
      this.db.pragma("journal_mode = WAL");
      this.db.exec(SCHEMA);
      return true;
    } catch {
      this.db = null;
      return false;
    }
  }

  /**
   * Compute a SHA-256 hash of content.
   * @param {string} content
   * @returns {string} hex digest
   */
  static contentHash(content) {
    return createHash("sha256").update(content, "utf-8").digest("hex");
  }

  /**
   * Rebuild the index from the spec and changelog files.
   *
   * @param {string} specPath - Path to the spec markdown file
   * @param {string} [changelogPath] - Path to the changelog file (optional)
   */
  rebuild(specPath, changelogPath) {
    if (!this.open()) return false;

    const { frontmatter, sections } = parseSpec(specPath);
    const timestamp = new Date().toISOString();

    this.db.exec("BEGIN TRANSACTION");
    try {
      // Snapshot existing content hashes and last_updated for change detection.
      // Uses section_embeddings for stored hashes when available, falls back
      // to computing hash from current sections table content.
      const existingHashes = {};
      const existingTimestamps = {};
      const existingReadiness = {};

      const oldSections = this.db
        .prepare("SELECT alias, content, last_updated, readiness FROM sections WHERE alias IS NOT NULL")
        .all();
      for (const row of oldSections) {
        existingTimestamps[row.alias] = row.last_updated;
        existingReadiness[row.alias] = row.readiness;
      }

      // Prefer stored content_hash from section_embeddings; compute from content as fallback
      const oldEmbeddings = this.db
        .prepare("SELECT alias, content_hash FROM section_embeddings")
        .all();
      for (const row of oldEmbeddings) {
        existingHashes[row.alias] = row.content_hash;
      }
      // For sections with no embedding row yet, compute hash from old content
      for (const row of oldSections) {
        if (!existingHashes[row.alias]) {
          existingHashes[row.alias] = SpecIndex.contentHash(row.content);
        }
      }

      // Clear existing data
      this.db.exec("DELETE FROM sections");
      this.db.exec("DELETE FROM changelog_entries");

      // Insert sections
      const insertSection = this.db.prepare(`
        INSERT INTO sections (alias, number, heading, content, parent, word_count, level, line_start, last_updated, readiness)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const upsertEmbeddingHash = this.db.prepare(`
        INSERT INTO section_embeddings (alias, content_hash)
        VALUES (?, ?)
        ON CONFLICT(alias) DO UPDATE SET content_hash = excluded.content_hash
      `);

      for (const s of sections) {
        const newHash = SpecIndex.contentHash(s.content);
        const oldHash = s.alias ? existingHashes[s.alias] : null;
        const changed = !oldHash || oldHash !== newHash;

        // Preserve last_updated if content hasn't changed
        const sectionTimestamp = changed
          ? timestamp
          : existingTimestamps[s.alias] || timestamp;

        // Preserve readiness from the previous index
        const sectionReadiness = s.alias && existingReadiness[s.alias]
          ? existingReadiness[s.alias]
          : "draft";

        insertSection.run(
          s.alias,
          s.number,
          s.heading,
          s.content,
          s.parent,
          s.wordCount,
          s.level,
          s.lineStart,
          sectionTimestamp,
          sectionReadiness
        );

        // Upsert content hash into section_embeddings
        if (s.alias) {
          upsertEmbeddingHash.run(s.alias, newHash);

          // If content changed, invalidate the stored embedding
          if (changed) {
            this.db
              .prepare(
                "UPDATE section_embeddings SET embedding = NULL, model_id = NULL, computed_at = NULL WHERE alias = ?"
              )
              .run(s.alias);
          }
        }
      }

      // Remove embedding rows for sections that no longer exist
      const currentAliases = sections
        .filter((s) => s.alias)
        .map((s) => s.alias);
      if (currentAliases.length > 0) {
        const placeholders = currentAliases.map(() => "?").join(",");
        this.db
          .prepare(
            `DELETE FROM section_embeddings WHERE alias NOT IN (${placeholders})`
          )
          .run(...currentAliases);
      } else {
        this.db.exec("DELETE FROM section_embeddings");
      }

      // Insert changelog entries
      if (changelogPath) {
        const entries = parseChangelog(changelogPath);
        const insertEntry = this.db.prepare(`
          INSERT INTO changelog_entries (timestamp, command, changes)
          VALUES (?, ?, ?)
        `);
        for (const e of entries) {
          insertEntry.run(e.timestamp, e.command, e.changes.join("\n"));
        }
      }

      // Store metadata (including staleness tracking)
      const upsertMeta = this.db.prepare(
        "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)"
      );
      upsertMeta.run("spec_version", frontmatter["spec-version"] || "");
      upsertMeta.run("spec_version_at_build", frontmatter["spec-version"] || "");
      upsertMeta.run("last_rebuild", timestamp);
      upsertMeta.run("spec_path", specPath);

      this.db.exec("COMMIT");
      return true;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  /**
   * Get a section by its alias (e.g., "core-flow").
   */
  getByAlias(alias) {
    if (!this.open()) return null;
    const clean = alias.replace(/^#/, "");
    return (
      this.db.prepare("SELECT * FROM sections WHERE alias = ?").get(clean) ||
      null
    );
  }

  /**
   * Get a section by its number (e.g., "2.2").
   */
  getByNumber(number) {
    if (!this.open()) return null;
    return (
      this.db.prepare("SELECT * FROM sections WHERE number = ?").get(number) ||
      null
    );
  }

  /**
   * Get all sections, optionally filtered by readiness.
   *
   * @param {string} [readiness] - Filter by readiness value
   * @returns {Array}
   */
  getAllSections(readiness) {
    if (!this.open()) return [];
    if (readiness) {
      return this.db
        .prepare("SELECT * FROM sections WHERE readiness = ? ORDER BY id")
        .all(readiness);
    }
    return this.db.prepare("SELECT * FROM sections ORDER BY id").all();
  }

  /**
   * Get sections that are children of a given parent number.
   */
  getChildren(parentNumber) {
    if (!this.open()) return [];
    return this.db
      .prepare("SELECT * FROM sections WHERE parent = ? ORDER BY id")
      .all(parentNumber);
  }

  /**
   * Search sections by content (case-insensitive LIKE).
   */
  search(query) {
    if (!this.open()) return [];
    return this.db
      .prepare(
        "SELECT * FROM sections WHERE content LIKE ? OR heading LIKE ? ORDER BY id"
      )
      .all(`%${query}%`, `%${query}%`);
  }

  /**
   * Update the readiness value for a section.
   *
   * @param {string} aliasOrNumber - Section alias or number
   * @param {string} readiness - One of: draft, undocumented, ready-to-build,
   *   aligned, ready-to-execute, satisfied
   */
  setReadiness(aliasOrNumber, readiness) {
    if (!this.open()) return false;
    const isNumber = /^\d/.test(aliasOrNumber);
    const field = isNumber ? "number" : "alias";
    const clean = aliasOrNumber.replace(/^#/, "");
    const result = this.db
      .prepare(`UPDATE sections SET readiness = ? WHERE ${field} = ?`)
      .run(readiness, clean);
    return result.changes > 0;
  }

  /**
   * Update readiness by section row ID (for sections without alias or number).
   */
  setReadinessById(id, readiness) {
    if (!this.open()) return false;
    const result = this.db
      .prepare("UPDATE sections SET readiness = ? WHERE id = ?")
      .run(readiness, id);
    return result.changes > 0;
  }

  /**
   * Get a summary of readiness across all sections.
   *
   * @returns {Object} - Map of readiness value → count
   */
  getReadinessSummary() {
    if (!this.open()) return {};
    const rows = this.db
      .prepare(
        "SELECT readiness, COUNT(*) as count FROM sections GROUP BY readiness"
      )
      .all();
    const summary = {};
    for (const row of rows) {
      summary[row.readiness] = row.count;
    }
    return summary;
  }

  /**
   * Get metadata value by key.
   */
  getMeta(key) {
    if (!this.open()) return null;
    const row = this.db
      .prepare("SELECT value FROM meta WHERE key = ?")
      .get(key);
    return row ? row.value : null;
  }

  /**
   * Get all changelog entries, newest first.
   */
  getChangelogEntries() {
    if (!this.open()) return [];
    return this.db
      .prepare("SELECT * FROM changelog_entries ORDER BY timestamp DESC")
      .all();
  }

  // ---------------------------------------------------------------------------
  // Embedding infrastructure
  // ---------------------------------------------------------------------------

  /**
   * Get the stored content hash for a section.
   *
   * @param {string} alias - Section alias
   * @returns {string|null} hex content hash or null
   */
  getContentHash(alias) {
    if (!this.open()) return null;
    const clean = alias.replace(/^#/, "");
    const row = this.db
      .prepare("SELECT content_hash FROM section_embeddings WHERE alias = ?")
      .get(clean);
    return row ? row.content_hash : null;
  }

  /**
   * Check whether the content for a section has changed since the last rebuild.
   *
   * @param {string} alias - Section alias
   * @param {string} newContent - New content to compare
   * @returns {boolean} true if the content differs from the stored hash
   */
  hasContentChanged(alias, newContent) {
    const storedHash = this.getContentHash(alias);
    if (!storedHash) return true;
    const newHash = SpecIndex.contentHash(newContent);
    return storedHash !== newHash;
  }

  /**
   * Store an embedding for a section.
   *
   * @param {string} alias - Section alias
   * @param {Float32Array|Buffer} embedding - The embedding vector
   * @param {string} modelId - Identifier for the model that produced the embedding
   * @returns {boolean} true if stored successfully
   */
  setEmbedding(alias, embedding, modelId) {
    if (!this.open()) return false;
    const clean = alias.replace(/^#/, "");
    const buf =
      embedding instanceof Buffer
        ? embedding
        : Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);
    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        "UPDATE section_embeddings SET embedding = ?, model_id = ?, computed_at = ? WHERE alias = ?"
      )
      .run(buf, modelId, now, clean);
    return result.changes > 0;
  }

  /**
   * Retrieve the embedding for a section.
   *
   * @param {string} alias - Section alias
   * @returns {{ embedding: Float32Array, model_id: string, computed_at: string }|null}
   */
  getEmbedding(alias) {
    if (!this.open()) return null;
    const clean = alias.replace(/^#/, "");
    const row = this.db
      .prepare(
        "SELECT embedding, model_id, computed_at FROM section_embeddings WHERE alias = ?"
      )
      .get(clean);
    if (!row || !row.embedding) return null;
    return {
      embedding: new Float32Array(
        row.embedding.buffer,
        row.embedding.byteOffset,
        row.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT
      ),
      model_id: row.model_id,
      computed_at: row.computed_at,
    };
  }

  /**
   * Retrieve all stored embeddings.
   *
   * @returns {Array<{ alias: string, embedding: Float32Array, model_id: string, computed_at: string }>}
   */
  getAllEmbeddings() {
    if (!this.open()) return [];
    const rows = this.db
      .prepare(
        "SELECT alias, embedding, model_id, computed_at FROM section_embeddings WHERE embedding IS NOT NULL"
      )
      .all();
    return rows.map((row) => ({
      alias: row.alias,
      embedding: new Float32Array(
        row.embedding.buffer,
        row.embedding.byteOffset,
        row.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT
      ),
      model_id: row.model_id,
      computed_at: row.computed_at,
    }));
  }

  /**
   * Invalidate embeddings that were computed with a different model.
   * Clears the embedding, model_id, and computed_at fields for mismatched rows.
   *
   * @param {string} modelId - The current/expected model ID
   * @returns {number} count of invalidated rows
   */
  invalidateEmbeddings(modelId) {
    if (!this.open()) return 0;
    const result = this.db
      .prepare(
        "UPDATE section_embeddings SET embedding = NULL, model_id = NULL, computed_at = NULL WHERE model_id IS NOT NULL AND model_id != ?"
      )
      .run(modelId);
    return result.changes;
  }

  /**
   * Compute cosine similarity between two Float32Array vectors.
   *
   * @param {Float32Array} a
   * @param {Float32Array} b
   * @returns {number} cosine similarity in [-1, 1], or 0 if either vector is zero-length
   */
  static cosineSimilarity(a, b) {
    if (a.length !== b.length) {
      throw new Error(
        `Vector length mismatch: ${a.length} vs ${b.length}`
      );
    }
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) return 0;
    return dot / denom;
  }

  // ---------------------------------------------------------------------------
  // Dependency graph
  // ---------------------------------------------------------------------------

  /**
   * Build a dependency graph from cross-references in spec section content
   * and scenario-to-section mappings.
   *
   * Cross-references are detected by:
   * - `{#alias}` anchor references in section content
   * - `#alias (N.N)` parenthetical references
   * - `#alias` backtick references
   *
   * Scenario overlap is detected by parsing Validates: lines from the
   * scenarios file.
   *
   * @param {string} [scenariosPath] - Path to scenarios.md (optional)
   * @returns {{ nodes: string[], edges: Array<{from: string, to: string, type: string}>, clusters: Array<string[]> }|null}
   */
  buildDependencyGraph(scenariosPath) {
    if (!this.open()) return null;

    const sections = this.db
      .prepare("SELECT alias, content FROM sections WHERE alias IS NOT NULL")
      .all();

    const aliasSet = new Set(sections.map((s) => s.alias));
    const edges = [];

    // Parse cross-references from section content
    for (const section of sections) {
      const refs = new Set();
      // Match {#alias}, `#alias`, and #alias (N.N) patterns
      const patterns = [
        /\{#([\w-]+)\}/g,
        /`#([\w-]+)`/g,
        /#([\w-]+)\s*\(\d+\.\d+\)/g,
      ];
      for (const pattern of patterns) {
        let m;
        while ((m = pattern.exec(section.content)) !== null) {
          const target = m[1];
          if (target !== section.alias && aliasSet.has(target)) {
            refs.add(target);
          }
        }
      }
      for (const target of refs) {
        edges.push({ from: section.alias, to: target, type: "cross-ref" });
      }
    }

    // Parse scenario overlap from scenarios file
    if (scenariosPath) {
      try {
        const content = readFileSync(scenariosPath, "utf-8");
        for (const line of content.split("\n")) {
          const match = line.match(/^Validates:\s*(.+)$/);
          if (!match) continue;
          const aliases = [];
          const aliasPattern = /`#([\w-]+)`/g;
          let am;
          while ((am = aliasPattern.exec(match[1])) !== null) {
            if (aliasSet.has(am[1])) aliases.push(am[1]);
          }
          // Create pairwise scenario-overlap edges
          for (let i = 0; i < aliases.length; i++) {
            for (let j = i + 1; j < aliases.length; j++) {
              edges.push({
                from: aliases[i],
                to: aliases[j],
                type: "scenario-overlap",
              });
            }
          }
        }
      } catch {
        // Scenarios file not available — graph has cross-refs only
      }
    }

    // Compute clusters via connected components
    const adjacency = new Map();
    for (const alias of aliasSet) {
      adjacency.set(alias, new Set());
    }
    for (const edge of edges) {
      if (adjacency.has(edge.from)) adjacency.get(edge.from).add(edge.to);
      if (adjacency.has(edge.to)) adjacency.get(edge.to).add(edge.from);
    }

    const visited = new Set();
    const clusters = [];
    for (const alias of aliasSet) {
      if (visited.has(alias)) continue;
      const cluster = [];
      const queue = [alias];
      while (queue.length > 0) {
        const node = queue.pop();
        if (visited.has(node)) continue;
        visited.add(node);
        cluster.push(node);
        for (const neighbor of adjacency.get(node) || []) {
          if (!visited.has(neighbor)) queue.push(neighbor);
        }
      }
      if (cluster.length > 1) clusters.push(cluster.sort());
    }

    return {
      nodes: [...aliasSet].sort(),
      edges,
      clusters,
    };
  }

  // ---------------------------------------------------------------------------
  // Staleness tracking
  // ---------------------------------------------------------------------------

  /**
   * Get staleness information for the index.
   *
   * Compares the spec version the index was built from against the current
   * spec version (from frontmatter). Returns a staleness metric and
   * prescriptive recovery hint.
   *
   * @param {string} currentSpecVersion - Current spec version from frontmatter
   * @returns {{ stale: boolean, builtFrom: string, current: string, hint: string }}
   */
  getStaleness(currentSpecVersion) {
    if (!this.open()) {
      return {
        stale: true,
        builtFrom: "unknown",
        current: currentSpecVersion,
        hint: "Index unavailable — rebuild with idx.rebuild(specPath)",
      };
    }

    const builtFrom = this.getMeta("spec_version_at_build") || "unknown";
    const lastRebuild = this.getMeta("last_rebuild") || "unknown";
    const stale = builtFrom !== currentSpecVersion;

    let hint = "";
    if (stale) {
      hint = `Index built from spec ${builtFrom}, current is ${currentSpecVersion} — rebuild with idx.rebuild(specPath, changelogPath)`;
    } else {
      const age = lastRebuild !== "unknown"
        ? Math.round((Date.now() - new Date(lastRebuild).getTime()) / 60000)
        : null;
      if (age !== null && age > 60) {
        hint = `Index is ${age} minutes old — consider rebuilding if sections changed`;
      }
    }

    return { stale, builtFrom, current: currentSpecVersion, lastRebuild, hint };
  }

  // ---------------------------------------------------------------------------
  // Self-guiding query responses
  // ---------------------------------------------------------------------------

  /**
   * Query a section by alias with self-guiding hints appended.
   *
   * Returns the section data plus a `hints` array with actionable next-step
   * suggestions derived from the section's structural properties.
   *
   * @param {string} alias - Section alias
   * @returns {{ section: object, hints: string[] }|null}
   */
  queryWithHints(alias) {
    const section = this.getByAlias(alias);
    if (!section) return null;

    const hints = [];

    // Check for unresolved cross-references
    const crossRefs = [];
    const patterns = [/\{#([\w-]+)\}/g, /`#([\w-]+)`/g];
    for (const pattern of patterns) {
      let m;
      while ((m = pattern.exec(section.content)) !== null) {
        crossRefs.push(m[1]);
      }
    }
    const uniqueRefs = [...new Set(crossRefs)].filter((r) => r !== alias);
    if (uniqueRefs.length > 0) {
      hints.push(
        `${uniqueRefs.length} cross-ref${uniqueRefs.length > 1 ? "s" : ""} — consider loading: ${uniqueRefs.slice(0, 5).map((r) => `#${r}`).join(", ")}`
      );
    }

    // Check readiness
    if (section.readiness === "draft") {
      hints.push(
        `Section is draft (${section.word_count} words) — needs /fctry:evolve before building`
      );
    } else if (section.readiness === "ready-to-build") {
      hints.push("Ready to build — include in /fctry:execute plan");
    } else if (section.readiness === "undocumented") {
      hints.push(
        "Code exists but spec doesn't cover it — run /fctry:evolve to document"
      );
    }

    // Check word count (thin sections)
    if (section.word_count < 30 && section.readiness !== "draft") {
      hints.push(
        `Only ${section.word_count} words — may need enrichment via /fctry:evolve`
      );
    }

    return { section, hints };
  }

  /**
   * Close the database connection.
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
