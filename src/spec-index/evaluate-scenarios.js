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
import { readinessToStatus, sectionToFeatureName } from "./human-labels.js";
import { assessReadiness, writeReadinessState } from "./assess-readiness.js";
import { openSync, readSync, closeSync } from "fs";
import {
  detectAvailableModels,
  distributeTrials,
  evaluateTrialsParallel,
  loadSectionContent,
  gatherCodeEvidence,
} from "./judge-adapters.js";

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
    let evolvedCount = 0;
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
      else if (status === "evolved") evolvedCount++;
      else speccedCount++;
    }

    const total = scenario.validates.length;
    const hasCode = builtCount + evolvedCount; // sections with code behind them
    let satisfaction;
    if (builtCount === total) {
      satisfaction = "satisfied";
    } else if (hasCode === total) {
      // All sections have code, but some evolved past it
      satisfaction = "partial";
    } else if (hasCode > 0) {
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
    if (summary.disagreements != null) {
      state.scenarioScore.disagreements = summary.disagreements;
    }
    writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
  } catch { /* non-fatal */ }
}

// ---------------------------------------------------------------------------
// LLM-as-judge evaluation — multi-model, multi-trial
// ---------------------------------------------------------------------------

/**
 * Load evaluation config from .fctry/config.json.
 *
 * @param {string} projectDir
 * @returns {Object} { trials, passThreshold, models }
 */
function loadEvaluationConfig(projectDir) {
  const defaults = { trials: 3, passThreshold: 2, models: {} };
  const configPath = join(projectDir, ".fctry", "config.json");
  try {
    if (!existsSync(configPath)) return defaults;
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const evalConfig = config.evaluation || {};
    return {
      trials: evalConfig.trials || defaults.trials,
      passThreshold: evalConfig.passThreshold || defaults.passThreshold,
      models: evalConfig.models || defaults.models,
    };
  } catch {
    return defaults;
  }
}

/**
 * Run LLM-as-judge evaluation on scenarios.
 *
 * Each scenario is evaluated N times across available models. Cross-model
 * disagreements are tracked as the highest-signal finding.
 *
 * @param {string} projectDir - Project root
 * @param {Object} [options]
 * @param {string[]} [options.sections] - Only evaluate scenarios validating these aliases
 * @param {number} [options.trials] - Override trial count
 * @param {string[]} [options.models] - Override model list
 * @returns {Object} Judge evaluation report
 */
export async function evaluateWithJudge(projectDir, options = {}) {
  const scenariosPath = join(projectDir, ".fctry", "scenarios.md");
  let scenarios = parseScenarios(scenariosPath);
  if (scenarios.length === 0) {
    return { summary: { total: 0, satisfied: 0, partial: 0, unsatisfied: 0, unlinked: 0, disagreements: 0 }, scenarios: [], disagreements: [] };
  }

  // Filter to target sections if specified
  if (options.sections && options.sections.length > 0) {
    const targetSet = new Set(options.sections);
    scenarios = scenarios.filter((s) =>
      s.validates.some((v) => targetSet.has(v.alias)),
    );
  }

  const config = loadEvaluationConfig(projectDir);
  const totalTrials = options.trials || config.trials;
  const passThreshold = config.passThreshold;
  const availableModels = options.models || detectAvailableModels();
  const trialPlan = distributeTrials(totalTrials, availableModels, config.models);

  const evaluated = [];
  const disagreements = [];
  const onProgress = options.onProgress || (() => {});

  for (const scenario of scenarios) {
    // Skip unlinked scenarios
    if (scenario.validates.length === 0) {
      evaluated.push({ ...scenario, satisfaction: "unlinked", trials: [] });
      continue;
    }

    // Gather context for this scenario
    const sectionContent = loadSectionContent(projectDir, scenario);
    const codeEvidence = gatherCodeEvidence(projectDir, scenario);
    const input = { scenario, sectionContent, codeEvidence };

    // Run all trials in parallel (claude + codex + gemini concurrently)
    const trials = await evaluateTrialsParallel(trialPlan, input);

    // Aggregate: majority vote (excluding errors)
    const validTrials = trials.filter((t) => !t.error);
    const passCount = validTrials.filter((t) => t.satisfied).length;
    const failCount = validTrials.filter((t) => !t.satisfied).length;
    const errorCount = trials.filter((t) => t.error).length;

    let satisfaction;
    if (validTrials.length === 0) {
      satisfaction = "unsatisfied"; // all trials errored
    } else if (passCount >= passThreshold) {
      satisfaction = "satisfied";
    } else if (passCount > 0) {
      satisfaction = "partial";
    } else {
      satisfaction = "unsatisfied";
    }

    // Detect cross-model disagreement
    const verdictsByModel = {};
    for (const t of validTrials) {
      if (!verdictsByModel[t.model]) verdictsByModel[t.model] = [];
      verdictsByModel[t.model].push(t.satisfied);
    }
    const modelVerdicts = Object.entries(verdictsByModel).map(([model, verdicts]) => ({
      model,
      satisfied: verdicts.filter(Boolean).length > verdicts.length / 2,
      passCount: verdicts.filter(Boolean).length,
      totalCount: verdicts.length,
    }));
    const hasDisagreement = modelVerdicts.length > 1 &&
      new Set(modelVerdicts.map((v) => v.satisfied)).size > 1;

    const result = {
      ...scenario,
      satisfaction,
      passCount,
      failCount,
      errorCount,
      disagreement: hasDisagreement,
      modelVerdicts,
      trials,
    };
    evaluated.push(result);
    onProgress(result, evaluated.length, scenarios.length);

    if (hasDisagreement) {
      disagreements.push(result);
    }
  }

  // Summary
  const summary = {
    total: evaluated.length,
    satisfied: evaluated.filter((s) => s.satisfaction === "satisfied").length,
    partial: evaluated.filter((s) => s.satisfaction === "partial").length,
    unsatisfied: evaluated.filter((s) => s.satisfaction === "unsatisfied").length,
    unlinked: evaluated.filter((s) => s.satisfaction === "unlinked").length,
    disagreements: disagreements.length,
  };

  return { summary, scenarios: evaluated, disagreements };
}

/**
 * Format the judge evaluation report as human-readable text.
 *
 * @param {Object} report - Judge evaluation report
 * @param {string} projectDir - Project root for feature name resolution
 * @returns {string} Formatted text report
 */
export function formatJudgeReport(report, projectDir) {
  const { summary, scenarios, disagreements } = report;
  const lines = [];

  const models = detectAvailableModels();
  lines.push(`Judge Evaluation — ${summary.total} scenarios, ${models.length} models (${models.join(", ")})`);
  lines.push(`  ${summary.satisfied} satisfied, ${summary.partial} partial, ${summary.unsatisfied} unsatisfied, ${summary.unlinked} unlinked`);
  if (summary.disagreements > 0) {
    lines.push(`  ${summary.disagreements} model disagreement(s)`);
  }
  lines.push("");

  // Disagreements first — highest signal
  if (disagreements.length > 0) {
    lines.push("Model Disagreements:");
    for (const d of disagreements) {
      const verdictParts = d.modelVerdicts.map((v) =>
        `${v.model}: ${v.satisfied ? "satisfied" : "unsatisfied"} (${v.passCount}/${v.totalCount})`,
      );
      lines.push(`  ${d.name} — ${verdictParts.join(", ")}`);
      // Show dissenting reasoning
      for (const t of d.trials) {
        if (!t.error && t.reasoning) {
          lines.push(`    ${t.model}: "${t.reasoning}"`);
        }
      }
    }
    lines.push("");
  }

  // Unsatisfied scenarios
  const unsatisfied = scenarios.filter((s) => s.satisfaction === "unsatisfied" && !s.disagreement);
  if (unsatisfied.length > 0) {
    lines.push("Unsatisfied:");
    for (const s of unsatisfied) {
      lines.push(`  ${s.name} (${s.passCount}/${s.passCount + s.failCount} pass, ${s.errorCount} errors)`);
      const reasons = s.trials.filter((t) => !t.error && !t.satisfied && t.reasoning);
      if (reasons.length > 0) {
        lines.push(`    ${reasons[0].model}: "${reasons[0].reasoning}"`);
      }
    }
    lines.push("");
  }

  // Errors
  const errored = scenarios.filter((s) => s.trials?.some((t) => t.error));
  if (errored.length > 0) {
    const totalErrors = errored.reduce((n, s) => n + (s.errorCount || 0), 0);
    lines.push(`Errors: ${totalErrors} trial errors across ${errored.length} scenarios`);
    for (const s of errored) {
      const errs = s.trials.filter((t) => t.error);
      for (const e of errs) {
        lines.push(`  ${s.name} [${e.model}]: ${e.error}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Build a feature map from the spec TOC (alias → { number, title }).
 * Reads only the first 8KB — fast enough for CLI tools and hooks.
 */
function buildFeatureMap(projectDir) {
  const map = {};
  const specPath = join(projectDir, ".fctry", "spec.md");
  try {
    if (!existsSync(specPath)) return map;
    const fd = openSync(specPath, "r");
    const buf = Buffer.alloc(8192);
    readSync(fd, buf, 0, 8192, 0);
    closeSync(fd);
    const head = buf.toString("utf-8");
    const tocPattern = /^\s+-\s+([\d.]+)\s+\[([^\]]+)\].*`#([\w-]+)`/gm;
    let m;
    while ((m = tocPattern.exec(head)) !== null) {
      map[m[3]] = { number: m[1], title: m[2] };
    }
  } catch { /* graceful degradation */ }
  return map;
}

/**
 * Format the evaluation report as human-readable text.
 * Uses feature names (section titles) and user vocabulary (built/specced).
 *
 * @param {Object} report - Full evaluation report from evaluate()
 * @param {string} projectDir - Project root for feature name resolution
 * @returns {string} Formatted text report
 */
export function formatTextReport(report, projectDir) {
  const featureMap = buildFeatureMap(projectDir);
  const { summary, features } = report;
  const lines = [];

  lines.push(`Scenario Satisfaction — ${summary.total} scenarios`);
  lines.push(`  ${summary.satisfied} built, ${summary.partial} partial, ${summary.unsatisfied} unsatisfied, ${summary.unlinked} unlinked`);
  lines.push("");

  // Group features by satisfaction tier
  const tiers = {
    "Built": [],
    "Partial": [],
    "Specced (unsatisfied)": [],
  };

  for (const [name, feat] of Object.entries(features)) {
    if (feat.satisfied === feat.total && feat.total > 0) {
      tiers["Built"].push({ name, feat });
    } else if (feat.satisfied > 0 || feat.partial > 0) {
      tiers["Partial"].push({ name, feat });
    } else {
      tiers["Specced (unsatisfied)"].push({ name, feat });
    }
  }

  for (const [tier, items] of Object.entries(tiers)) {
    if (items.length === 0) continue;
    lines.push(`${tier}:`);
    for (const { name, feat } of items) {
      const parts = [];
      if (feat.satisfied) parts.push(`${feat.satisfied} built`);
      if (feat.partial) parts.push(`${feat.partial} partial`);
      if (feat.unsatisfied) parts.push(`${feat.unsatisfied} unsatisfied`);
      if (feat.unlinked) parts.push(`${feat.unlinked} unlinked`);
      lines.push(`  ${name} (${feat.total}): ${parts.join(", ")}`);

      // Show validated section names for unsatisfied scenarios (knowledge gap detection)
      if (feat.unsatisfied > 0) {
        const aliases = new Set();
        for (const s of feat.scenarios) {
          if (s.satisfaction === "unsatisfied") {
            for (const v of s.validates) aliases.add(v.alias);
          }
        }
        if (aliases.size > 0) {
          const names = [...aliases].map((a) => sectionToFeatureName(a, featureMap)).join(", ");
          lines.push(`    validates: ${names}`);
        }
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

// CLI entry point
const isMainModule =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
  const projectDir = resolve(args[0] || process.cwd());

  const useJudge = flags.includes("--judge");

  // Parse --sections alias1,alias2
  let sections = null;
  const sectionsFlag = flags.find((f) => f.startsWith("--sections"));
  if (sectionsFlag) {
    const eqIdx = sectionsFlag.indexOf("=");
    if (eqIdx !== -1) {
      sections = sectionsFlag.slice(eqIdx + 1).split(",").map((s) => s.trim());
    } else {
      // Next positional arg might be the value
      const nextIdx = process.argv.indexOf(sectionsFlag) + 1;
      if (nextIdx < process.argv.length && !process.argv[nextIdx].startsWith("--")) {
        sections = process.argv[nextIdx].split(",").map((s) => s.trim());
      }
    }
  }

  if (useJudge) {
    // LLM-as-judge evaluation (async)
    const models = detectAvailableModels();
    console.error(`Detected models: ${models.join(", ")}`);
    if (sections) console.error(`Filtering to sections: ${sections.join(", ")}`);

    const onProgress = (result, done, total) => {
      const icon = result.satisfaction === "satisfied" ? "+" :
                   result.satisfaction === "partial" ? "~" :
                   result.satisfaction === "unlinked" ? "?" : "-";
      const disagreement = result.disagreement ? " [DISAGREEMENT]" : "";
      console.error(`  [${done}/${total}] ${icon} ${result.name}${disagreement}`);
    };

    const report = await evaluateWithJudge(projectDir, { sections, onProgress });

    if (flags.includes("--write-state")) {
      writeScenarioScore(projectDir, report.summary);
    }

    if (flags.includes("--text")) {
      console.log(formatJudgeReport(report, projectDir));
    } else {
      console.log(JSON.stringify(report, null, 2));
    }
  } else {
    // Structural evaluation (existing behavior)
    const report = evaluate(projectDir);

    if (flags.includes("--write-state")) {
      writeScenarioScore(projectDir, report.summary);
    }

    if (flags.includes("--text")) {
      console.log(formatTextReport(report, projectDir));
    } else {
      console.log(JSON.stringify(report, null, 2));
    }
  }
}
