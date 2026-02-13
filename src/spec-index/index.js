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
      // Clear existing data
      this.db.exec("DELETE FROM sections");
      this.db.exec("DELETE FROM changelog_entries");

      // Insert sections
      const insertSection = this.db.prepare(`
        INSERT INTO sections (alias, number, heading, content, parent, word_count, level, line_start, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const s of sections) {
        insertSection.run(
          s.alias,
          s.number,
          s.heading,
          s.content,
          s.parent,
          s.wordCount,
          s.level,
          s.lineStart,
          timestamp
        );
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
   * @param {string} readiness - One of: draft, needs-spec-update, spec-ahead,
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
