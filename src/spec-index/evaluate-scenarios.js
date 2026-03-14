#!/usr/bin/env node
/**
 * Scenario satisfaction evaluator for fctry.
 *
 * Parses scenarios.md, cross-references each scenario's validated sections
 * against section readiness, and produces a satisfaction report. This is the
 * structural harness — readiness-based satisfaction estimation. Actual
 * LLM-as-judge evaluation plugs into this structure as a future enhancement.
 *
 * Satisfaction tiers:
 *   satisfied  — all validated sections are built (aligned/ready-to-execute/satisfied)
 *   partial    — some validated sections are built, others are specced
 *   unsatisfied — no validated sections are built, or scenario has no validates links
 *
 * Usage:
 *   node evaluate-scenarios.js [project-dir]
 *
 * Output: JSON with per-feature and per-scenario satisfaction data.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { readinessToStatus } from "./human-labels.js";
import { assessReadiness, writeReadinessState } from "./assess-readiness.js";

/**
 * Parse scenarios.md into structured scenario objects.
 *
 * @param {string} scenariosPath - Path to scenarios.md
 * @returns {Object[]} Array of scenario objects
 */
export function parseScenarios(scenariosPath) {
  if (!existsSync(scenariosPath)) return [];

  const content = readFileSync(scenariosPath, "utf-8");
  const lines = content.split("\n");
  const scenarios = [];

  let currentCategory = null;
  let currentFeature = null;
  let currentTier = null;
  let currentScenario = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Category headers: "# Core Workflow", "# Build", "# Viewer", "# System Quality"
    const categoryMatch = line.match(/^# (.+)$/);
    if (categoryMatch) {
      currentCategory = categoryMatch[1].trim();
      continue;
    }

    // Feature headers: "## Feature: Project Initialization"
    const featureMatch = line.match(/^## Feature:\s*(.+)$/);
    if (featureMatch) {
      currentFeature = featureMatch[1].trim();
      continue;
    }

    // Tier headers: "### Critical", "### Edge Cases", "### Polish"
    const tierMatch = line.match(/^### (Critical|Edge Cases?|Polish)/);
    if (tierMatch) {
      const raw = tierMatch[1].toLowerCase();
      currentTier = raw.startsWith("edge") ? "edge" : raw;
      continue;
    }

    // Scenario headers: "#### Scenario: Name Here"
    const scenarioMatch = line.match(/^#### Scenario:\s*(.+)$/);
    if (scenarioMatch) {
      // Save previous scenario
      if (currentScenario) scenarios.push(currentScenario);
      currentScenario = {
        name: scenarioMatch[1].trim(),
        feature: currentFeature,
        category: currentCategory,
        tier: currentTier || "critical",
        validates: [],
        satisfiedWhen: "",
      };
      continue;
    }

    // Validates lines: "Validates: `#alias` (N.M), `#alias` (N.M)"
    if (currentScenario && line.startsWith("Validates:")) {
      const aliasPattern = /`#([\w-]+)`\s*\(([\d.]+)\)/g;
      let match;
      while ((match = aliasPattern.exec(line)) !== null) {
        currentScenario.validates.push({
          alias: match[1],
          number: match[2],
        });
      }
      continue;
    }

    // Satisfied when: "**Satisfied when:** ..."
    if (currentScenario && line.startsWith("**Satisfied when:**")) {
      currentScenario.satisfiedWhen = line.replace("**Satisfied when:**", "").trim();
      // Read continuation lines
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j];
        if (next.startsWith("####") || next.startsWith("###") || next.startsWith("##") ||
            next.startsWith("Validates:") || next.trim() === "---") break;
        if (next.trim()) {
          currentScenario.satisfiedWhen += " " + next.trim();
        }
        i = j;
      }
      continue;
    }
  }

  // Save last scenario
  if (currentScenario) scenarios.push(currentScenario);

  return scenarios;
}

/**
 * Evaluate scenario satisfaction against section readiness.
 *
 * @param {Object[]} scenarios - Parsed scenario objects
 * @param {Object} sectionReadiness - Map of alias → readiness label
 * @returns {Object} Satisfaction report
 */
export function evaluateSatisfaction(scenarios, sectionReadiness) {
  const evaluated = scenarios.map((scenario) => {
    if (scenario.validates.length === 0) {
      // Scenarios without validates links can't be structurally assessed
      return { ...scenario, satisfaction: "unlinked" };
    }

    let builtCount = 0;
    let speccedCount = 0;
    let unknownCount = 0;

    for (const v of scenario.validates) {
      const readiness = sectionReadiness[v.alias];
      if (!readiness) {
        unknownCount++;
        continue;
      }
      const status = readinessToStatus(readiness);
      if (status === "built") builtCount++;
      else speccedCount++;
    }

    const total = scenario.validates.length;
    let satisfaction;
    if (builtCount === total) {
      satisfaction = "satisfied";
    } else if (builtCount > 0) {
      satisfaction = "partial";
    } else {
      satisfaction = "unsatisfied";
    }

    return {
      ...scenario,
      satisfaction,
      validatesBuilt: builtCount,
      validatesTotal: total,
    };
  });

  // Aggregate by feature
  const features = {};
  for (const s of evaluated) {
    const key = s.feature || "Uncategorized";
    if (!features[key]) {
      features[key] = {
        feature: key,
        category: s.category,
        total: 0,
        satisfied: 0,
        partial: 0,
        unsatisfied: 0,
        unlinked: 0,
        scenarios: [],
      };
    }
    features[key].total++;
    features[key][s.satisfaction]++;
    features[key].scenarios.push(s);
  }

  // Overall summary
  const summary = {
    total: evaluated.length,
    satisfied: evaluated.filter((s) => s.satisfaction === "satisfied").length,
    partial: evaluated.filter((s) => s.satisfaction === "partial").length,
    unsatisfied: evaluated.filter((s) => s.satisfaction === "unsatisfied").length,
    unlinked: evaluated.filter((s) => s.satisfaction === "unlinked").length,
  };

  return { summary, features, scenarios: evaluated };
}

/**
 * Run full evaluation: parse scenarios, load readiness, produce report.
 *
 * @param {string} projectDir - Project root directory
 * @returns {Object} Full evaluation report
 */
export function evaluate(projectDir) {
  const scenariosPath = join(projectDir, ".fctry", "scenarios.md");
  const statePath = join(projectDir, ".fctry", "state.json");

  const scenarios = parseScenarios(scenariosPath);
  if (scenarios.length === 0) {
    return {
      summary: { total: 0, satisfied: 0, partial: 0, unsatisfied: 0, unlinked: 0 },
      features: {},
      scenarios: [],
    };
  }

  // Load section readiness from state.json (authoritative source)
  let sectionReadiness = {};
  if (existsSync(statePath)) {
    try {
      const state = JSON.parse(readFileSync(statePath, "utf-8"));
      sectionReadiness = state.sectionReadiness || {};
    } catch { /* fallback to empty */ }
  }

  // Fallback: if state.json has no sectionReadiness, run the readiness
  // assessment on demand so the evaluator always has data to work with
  if (Object.keys(sectionReadiness).length === 0) {
    try {
      const { summary, sections } = assessReadiness(projectDir);
      writeReadinessState(projectDir, summary, sections);
      for (const s of sections) {
        const key = s.alias || s.number;
        if (key) sectionReadiness[key] = s.readiness;
      }
    } catch { /* graceful degradation — evaluate with empty readiness */ }
  }

  return evaluateSatisfaction(scenarios, sectionReadiness);
}

/**
 * Write scenario score to state.json for the status line and viewer.
 *
 * @param {string} projectDir - Project root directory
 * @param {Object} summary - Satisfaction summary
 */
export function writeScenarioScore(projectDir, summary) {
  const statePath = join(projectDir, ".fctry", "state.json");
  try {
    let state = {};
    if (existsSync(statePath)) {
      state = JSON.parse(readFileSync(statePath, "utf-8"));
    }
    state.scenarioScore = {
      total: summary.total,
      satisfied: summary.satisfied,
      partial: summary.partial,
      unsatisfied: summary.unsatisfied,
      unlinked: summary.unlinked,
    };
    writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
  } catch { /* non-fatal */ }
}

// CLI entry point
const isMainModule =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
  const projectDir = resolve(args[0] || process.cwd());
  const report = evaluate(projectDir);

  if (flags.includes("--write-state")) {
    writeScenarioScore(projectDir, report.summary);
  }

  console.log(JSON.stringify(report, null, 2));
}
