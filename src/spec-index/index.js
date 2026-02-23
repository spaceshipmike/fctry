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

import { mkdirSync } from "fs";
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

      // Store metadata
      const upsertMeta = this.db.prepare(
        "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)"
      );
      upsertMeta.run("spec_version", frontmatter["spec-version"] || "");
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
