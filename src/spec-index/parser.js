/**
 * Markdown spec parser for fctry.
 *
 * Extracts sections from an NLSpec v2 markdown file, including:
 * - Document-level frontmatter (YAML between ``` fences)
 * - Section headings with numbers, aliases, and anchor IDs
 * - Section content and word counts
 * - Parent-child relationships
 */

import { readFileSync } from "fs";

/**
 * Parse document-level frontmatter from the spec.
 * Expects YAML wrapped in ```yaml ... ``` at the top of the file.
 */
function parseFrontmatter(content) {
  const match = content.match(
    /^```ya?ml\s*\n---\s*\n([\s\S]*?)\n---\s*\n```/m
  );
  if (!match) return {};

  const yaml = match[1];
  const result = {};
  let currentParent = null;

  for (const line of yaml.split("\n")) {
    // Indented key under a parent (e.g., `  short: "value"`)
    const nested = line.match(/^[ \t]+([\w][\w-]*):\s*(.+)$/);
    if (nested && currentParent) {
      if (typeof result[currentParent] !== "object" || Array.isArray(result[currentParent])) {
        result[currentParent] = {};
      }
      result[currentParent][nested[1]] = parseYamlValue(nested[2].trim());
      continue;
    }

    // Top-level key with value (e.g., `title: fctry`)
    const kv = line.match(/^(\S+):\s+(.+)$/);
    if (kv) {
      result[kv[1]] = parseYamlValue(kv[2].trim());
      currentParent = null;
      continue;
    }

    // Top-level key without value — starts a nested block (e.g., `synopsis:`)
    const parent = line.match(/^(\S+):\s*$/);
    if (parent) {
      currentParent = parent[1];
      result[currentParent] = {};
      continue;
    }
  }
  return result;
}

/**
 * Parse a simple YAML value: quoted strings, inline arrays, or plain strings.
 */
function parseYamlValue(raw) {
  // Quoted string
  if ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  // Inline array: ["a", "b", "c"]
  if (raw.startsWith("[") && raw.endsWith("]")) {
    return raw.slice(1, -1)
      .split(",")
      .map((s) => s.trim())
      .map((s) => (s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))
        ? s.slice(1, -1) : s)
      .filter(Boolean);
  }
  return raw;
}

/**
 * Extract the alias from a heading line.
 * Handles: `### 2.2 Core Flow {#core-flow}` and TOC-style `` `#core-flow` ``
 */
function extractAlias(headingLine) {
  // {#alias} at end of heading
  const braceMatch = headingLine.match(/\{#([\w-]+)\}\s*$/);
  if (braceMatch) return braceMatch[1];

  // `#alias` at end of TOC line
  const backtickMatch = headingLine.match(/`#([\w-]+)`\s*$/);
  if (backtickMatch) return backtickMatch[1];

  return null;
}

/**
 * Extract the section number from a heading line.
 * Handles: `### 2.2 Core Flow`, `## 1. Vision and Principles`
 */
function extractNumber(headingLine) {
  // Strip markdown heading prefix
  const text = headingLine.replace(/^#+\s*/, "");
  // Match leading number like "2.2" or "1.1" or "2.10"
  const match = text.match(/^(\d+(?:\.\d+)*)/);
  return match ? match[1] : null;
}

/**
 * Extract the heading text (without number, alias markers, or anchor IDs).
 */
function extractHeadingText(headingLine) {
  return headingLine
    .replace(/^#+\s*/, "") // strip #+ prefix
    .replace(/^\d+(?:\.\d+)*\.?\s*/, "") // strip leading number
    .replace(/\s*\{#[\w-]+\}\s*$/, "") // strip {#alias}
    .replace(/\s*`#[\w-]+`\s*$/, "") // strip `#alias`
    .replace(/\[([^\]]+)\]\([^)]+\)/, "$1") // strip markdown links
    .trim();
}

/**
 * Determine the heading level from the markdown prefix.
 */
function headingLevel(line) {
  const match = line.match(/^(#+)/);
  return match ? match[1].length : 0;
}

/**
 * Determine the parent section number from a section number.
 * "2.2" → "2", "3.3.1" → "3.3", "1" → null
 */
function parentNumber(sectionNumber) {
  if (!sectionNumber) return null;
  const parts = sectionNumber.split(".");
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join(".");
}

/**
 * Count words in text, ignoring markdown syntax.
 */
function countWords(text) {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, "") // remove code blocks
    .replace(/`[^`]+`/g, "") // remove inline code
    .replace(/[#*_~\[\]()>|\\-]/g, " ") // remove markdown punctuation
    .replace(/https?:\/\/\S+/g, "") // remove URLs
    .trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

/**
 * Parse a spec markdown file into structured sections.
 *
 * @param {string} filePath - Path to the spec markdown file
 * @returns {{ frontmatter: object, sections: Array<{
 *   number: string|null, alias: string|null, heading: string,
 *   content: string, parent: string|null, wordCount: number,
 *   level: number, lineStart: number
 * }> }}
 */
export function parseSpec(filePath) {
  const content = readFileSync(filePath, "utf-8");
  return parseSpecContent(content);
}

/**
 * Parse spec content string (for testing without file I/O).
 */
export function parseSpecContent(content) {
  const frontmatter = parseFrontmatter(content);
  const lines = content.split("\n");
  const sections = [];

  let currentSection = null;
  let contentLines = [];

  function flushSection() {
    if (currentSection) {
      const sectionContent = contentLines.join("\n").trim();
      currentSection.content = sectionContent;
      currentSection.wordCount = countWords(sectionContent);
      sections.push(currentSection);
    }
    contentLines = [];
  }

  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track fenced code blocks — headings inside them are not real sections
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      if (currentSection) contentLines.push(line);
      continue;
    }

    if (inCodeBlock) {
      if (currentSection) contentLines.push(line);
      continue;
    }

    // Detect headings (## or ### — skip # which is the document title)
    if (/^#{2,4}\s/.test(line)) {
      flushSection();

      const level = headingLevel(line);
      const number = extractNumber(line);
      const alias = extractAlias(line);
      const heading = extractHeadingText(line);

      currentSection = {
        number,
        alias,
        heading,
        content: "",
        parent: parentNumber(number),
        wordCount: 0,
        level,
        lineStart: i + 1, // 1-indexed
      };
    } else if (currentSection) {
      contentLines.push(line);
    }
  }

  flushSection();
  return { frontmatter, sections };
}

/**
 * Parse changelog entries from a changelog markdown file.
 *
 * @param {string} filePath - Path to the changelog file
 * @returns {Array<{ timestamp: string, command: string, changes: string[] }>}
 */
export function parseChangelog(filePath) {
  let content;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const entries = [];
  const lines = content.split("\n");
  let current = null;

  for (const line of lines) {
    // ## 2026-02-13T20:00:00Z — /fctry:evolve (description)
    const headingMatch = line.match(
      /^##\s+([\dT:.Z-]+)\s*—\s*\/fctry:(\w+)/
    );
    if (headingMatch) {
      if (current) entries.push(current);
      current = {
        timestamp: headingMatch[1],
        command: headingMatch[2],
        changes: [],
      };
    } else if (current && line.startsWith("- ")) {
      current.changes.push(line.slice(2).trim());
    }
  }

  if (current) entries.push(current);
  return entries;
}
