#!/usr/bin/env node
/**
 * Multi-model judge adapters for scenario evaluation.
 *
 * Each adapter takes an evaluation context (scenario + spec section + code evidence)
 * and returns a structured verdict. Adapters shell out to CLI tools (codex, gemini,
 * claude) — the models are judges, not tool providers.
 *
 * Follows the same pluggable adapter pattern as reference source discovery:
 * detect what's available, use it, degrade gracefully when it's not.
 */

import { execSync, spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Detection — which models are available on this machine?
// ---------------------------------------------------------------------------

let _cachedModels = null;

/**
 * Detect available judge models. Result is cached per process.
 * Always includes "claude". Adds "codex" and "gemini" if their CLIs
 * are installed and authenticated.
 *
 * @returns {string[]} Available model identifiers
 */
export function detectAvailableModels() {
  if (_cachedModels) return _cachedModels;

  const models = ["claude"];

  // Codex: check PATH + quick auth probe
  try {
    execSync("which codex", { stdio: "pipe", timeout: 3000 });
    models.push("codex");
  } catch { /* not installed */ }

  // Gemini: check PATH + quick auth probe
  try {
    execSync("which gemini", { stdio: "pipe", timeout: 3000 });
    models.push("gemini");
  } catch { /* not installed */ }

  _cachedModels = models;
  return models;
}

/**
 * Reset the cached model detection (for testing).
 */
export function resetModelCache() {
  _cachedModels = null;
}

// ---------------------------------------------------------------------------
// Prompt construction — shared across all adapters
// ---------------------------------------------------------------------------

/**
 * Build the evaluation prompt for a scenario.
 *
 * @param {Object} input
 * @param {Object} input.scenario - Parsed scenario object
 * @param {string} input.sectionContent - Spec section text
 * @param {string} input.codeEvidence - Relevant code snippets or file listings
 * @returns {string} The evaluation prompt
 */
export function buildEvaluationPrompt(input) {
  const { scenario, sectionContent, codeEvidence } = input;

  return `You are evaluating whether a software scenario is satisfied by the current implementation.

## Scenario
Name: ${scenario.name}
Feature: ${scenario.feature || "Unknown"}
Tier: ${scenario.tier || "critical"}

**Satisfied when:** ${scenario.satisfiedWhen}

## Spec Section(s)
${sectionContent || "(no spec content available)"}

## Code Evidence
${codeEvidence || "(no code evidence available)"}

## Your Task
Evaluate whether the scenario's "satisfied when" criteria are met by the code evidence, considering the spec section as the reference for intended behavior.

- If the code evidence demonstrates the described behavior, the scenario is satisfied.
- If the code evidence is missing key behaviors, the scenario is not satisfied.
- If the evidence is ambiguous or incomplete, use your best judgment and reflect that in your confidence score.

Respond with ONLY a JSON object (no markdown fences, no explanation outside the JSON):
{"satisfied": true, "confidence": 0.85, "reasoning": "One sentence explaining your judgment"}`;
}

// ---------------------------------------------------------------------------
// Response parsing — extract structured verdict from model output
// ---------------------------------------------------------------------------

/**
 * Parse a judge's text response into a structured verdict.
 * Handles JSON wrapped in markdown fences, leading/trailing text, etc.
 *
 * @param {string} text - Raw model output
 * @param {string} model - Model identifier (for the verdict)
 * @returns {Object} Verdict: { satisfied, confidence, reasoning, model, error }
 */
export function parseJudgeResponse(text, model) {
  if (!text || typeof text !== "string") {
    return { satisfied: false, confidence: 0, reasoning: "", model, error: "Empty response" };
  }

  // Try to extract JSON from the response
  // Strategy 1: the whole thing is JSON
  try {
    const parsed = JSON.parse(text.trim());
    if (typeof parsed.satisfied === "boolean") {
      return {
        satisfied: parsed.satisfied,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
        reasoning: parsed.reasoning || "",
        model,
        error: null,
      };
    }
  } catch { /* not pure JSON */ }

  // Strategy 2: JSON inside markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (typeof parsed.satisfied === "boolean") {
        return {
          satisfied: parsed.satisfied,
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
          reasoning: parsed.reasoning || "",
          model,
          error: null,
        };
      }
    } catch { /* fence content wasn't valid JSON */ }
  }

  // Strategy 3: find first { ... } in the text
  const braceMatch = text.match(/\{[^{}]*"satisfied"\s*:\s*(true|false)[^{}]*\}/);
  if (braceMatch) {
    try {
      const parsed = JSON.parse(braceMatch[0]);
      return {
        satisfied: parsed.satisfied,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
        reasoning: parsed.reasoning || "",
        model,
        error: null,
      };
    } catch { /* brace content wasn't valid JSON */ }
  }

  return { satisfied: false, confidence: 0, reasoning: "", model, error: "Could not parse response" };
}

// ---------------------------------------------------------------------------
// Async CLI helper — runs a command with stdin, returns stdout
// ---------------------------------------------------------------------------

function execAsync(cmd, args, input, timeoutMs = 90000) {
  return new Promise((resolve) => {
    const chunks = [];
    const proc = spawn(cmd, args, {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: timeoutMs,
    });
    proc.stdout.on("data", (d) => chunks.push(d));
    proc.on("error", (err) => resolve({ error: err.message?.slice(0, 200) }));
    proc.on("close", () => resolve({ stdout: Buffer.concat(chunks).toString("utf-8") }));
    proc.stdin.write(input);
    proc.stdin.end();
  });
}

// ---------------------------------------------------------------------------
// Adapters — one per model (all async)
// ---------------------------------------------------------------------------

/**
 * Evaluate a scenario using the Claude CLI.
 * @returns {Promise<Object>} Verdict
 */
export async function evaluateWithClaude(input) {
  const prompt = buildEvaluationPrompt(input);
  const res = await execAsync("claude", ["-p", "--output-format", "json", "--model", "claude-sonnet-4-6"], prompt);
  if (res.error) return { satisfied: false, confidence: 0, reasoning: "", model: "claude", error: res.error };
  try {
    const envelope = JSON.parse(res.stdout.trim());
    return parseJudgeResponse(envelope.result || "", "claude");
  } catch (err) {
    return { satisfied: false, confidence: 0, reasoning: "", model: "claude", error: "JSON parse: " + err.message?.slice(0, 150) };
  }
}

/**
 * Evaluate a scenario using the Codex CLI.
 * @returns {Promise<Object>} Verdict
 */
export async function evaluateWithCodex(input) {
  const prompt = buildEvaluationPrompt(input);
  const res = await execAsync("codex", ["exec", "-", "--json", "--ephemeral"], prompt);
  if (res.error) return { satisfied: false, confidence: 0, reasoning: "", model: "codex", error: res.error };
  // Codex JSONL: find the LAST agent_message item.completed event.
  const lines = (res.stdout || "").trim().split("\n");
  let lastAgentText = null;
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      if (event.type === "item.completed" && event.item?.type === "agent_message" && event.item?.text) {
        lastAgentText = event.item.text;
      }
    } catch { /* skip */ }
  }
  if (lastAgentText) return parseJudgeResponse(lastAgentText, "codex");
  return { satisfied: false, confidence: 0, reasoning: "", model: "codex", error: "No agent_message in output" };
}

/**
 * Evaluate a scenario using the Gemini CLI.
 * @returns {Promise<Object>} Verdict
 */
export async function evaluateWithGemini(input) {
  const prompt = buildEvaluationPrompt(input);
  const res = await execAsync("gemini", ["-p", "", "-o", "json"], prompt);
  if (res.error) return { satisfied: false, confidence: 0, reasoning: "", model: "gemini", error: res.error };
  try {
    const envelope = JSON.parse(res.stdout.trim());
    return parseJudgeResponse(envelope.response || "", "gemini");
  } catch (err) {
    return { satisfied: false, confidence: 0, reasoning: "", model: "gemini", error: "JSON parse: " + err.message?.slice(0, 150) };
  }
}

// ---------------------------------------------------------------------------
// Adapter dispatch
// ---------------------------------------------------------------------------

const ADAPTERS = {
  claude: evaluateWithClaude,
  codex: evaluateWithCodex,
  gemini: evaluateWithGemini,
};

/**
 * Evaluate a scenario with a specific model (async).
 *
 * @param {string} model - Model identifier ("claude", "codex", "gemini")
 * @param {Object} input - Evaluation input
 * @returns {Promise<Object>} Verdict
 */
export async function evaluateWith(model, input) {
  const adapter = ADAPTERS[model];
  if (!adapter) {
    return { satisfied: false, confidence: 0, reasoning: "", model, error: `Unknown model: ${model}` };
  }
  return adapter(input);
}

/**
 * Evaluate a scenario across multiple models in parallel.
 * All trials for a single scenario run concurrently.
 *
 * @param {string[]} trialPlan - Array of model identifiers, one per trial
 * @param {Object} input - Evaluation input
 * @returns {Promise<Object[]>} Array of verdicts
 */
export function evaluateTrialsParallel(trialPlan, input) {
  return Promise.all(trialPlan.map((model) => evaluateWith(model, input)));
}

// ---------------------------------------------------------------------------
// Trial distribution — how to spread N trials across available models
// ---------------------------------------------------------------------------

/**
 * Distribute trials across available models.
 *
 * @param {number} totalTrials - Total number of trials (default 3)
 * @param {string[]} models - Available model identifiers
 * @param {Object} [overrides] - Per-model trial count overrides from config
 * @returns {string[]} Array of model identifiers, one per trial
 */
export function distributeTrials(totalTrials, models, overrides = {}) {
  if (models.length === 0) return [];
  if (models.length === 1) return Array(totalTrials).fill(models[0]);

  const distribution = [];

  // Assign overridden counts first
  let remaining = totalTrials;
  const nonClaude = models.filter((m) => m !== "claude");

  for (const model of nonClaude) {
    const count = overrides[model]?.trialsPerEvaluation ?? 1;
    const actual = Math.min(count, remaining);
    for (let i = 0; i < actual; i++) distribution.push(model);
    remaining -= actual;
  }

  // Claude gets the rest
  for (let i = 0; i < remaining; i++) distribution.push("claude");

  return distribution;
}

// ---------------------------------------------------------------------------
// Code evidence gathering — lightweight file listing for evaluation context
// ---------------------------------------------------------------------------

/**
 * Gather code evidence for a scenario's validated sections.
 * Reads file listings from the project to give the judge context.
 *
 * @param {string} projectDir - Project root
 * @param {Object} scenario - Parsed scenario with validates array
 * @returns {string} Code evidence text
 */
export function gatherCodeEvidence(projectDir, scenario) {
  const evidence = [];

  // Use git ls-files for a fast file listing
  try {
    const files = execSync("git ls-files --cached --others --exclude-standard", {
      cwd: projectDir,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    if (files) {
      // Filter to likely-relevant files based on scenario name/feature
      const allFiles = files.split("\n");
      const keywords = [
        ...(scenario.feature || "").toLowerCase().split(/\s+/),
        ...(scenario.name || "").toLowerCase().split(/\s+/),
      ].filter((w) => w.length > 3);

      const relevant = allFiles.filter((f) => {
        const lower = f.toLowerCase();
        return keywords.some((k) => lower.includes(k));
      });

      if (relevant.length > 0) {
        evidence.push(`Relevant files (${relevant.length} of ${allFiles.length} total):`);
        for (const f of relevant.slice(0, 20)) {
          evidence.push(`  ${f}`);
        }
        if (relevant.length > 20) {
          evidence.push(`  ... and ${relevant.length - 20} more`);
        }
      } else {
        evidence.push(`Project has ${allFiles.length} tracked files.`);
        // Show top-level structure
        const dirs = new Set(allFiles.map((f) => f.split("/")[0]).filter(Boolean));
        evidence.push(`Top-level: ${[...dirs].sort().join(", ")}`);
      }
    }
  } catch {
    evidence.push("(could not list project files)");
  }

  return evidence.join("\n");
}

// ---------------------------------------------------------------------------
// Section content loading — get spec text for the judge
// ---------------------------------------------------------------------------

/**
 * Load spec section content for a scenario's validated sections.
 *
 * @param {string} projectDir - Project root
 * @param {Object} scenario - Parsed scenario with validates array
 * @returns {string} Combined section content
 */
export function loadSectionContent(projectDir, scenario) {
  const specPath = join(projectDir, ".fctry", "spec.md");
  if (!existsSync(specPath)) return "(no spec found)";

  try {
    const spec = readFileSync(specPath, "utf-8");
    const sections = [];

    for (const v of scenario.validates) {
      // Find section by alias pattern: {#alias}
      const pattern = new RegExp(
        `(^#{1,4}\\s+[^\\n]*\\{#${v.alias}\\}[^\\n]*$)([\\s\\S]*?)(?=^#{1,4}\\s|\\z)`,
        "m",
      );
      const match = spec.match(pattern);
      if (match) {
        // Truncate to first 2000 chars to keep prompt manageable
        const content = (match[1] + match[2]).slice(0, 2000);
        sections.push(content.trim());
      }
    }

    if (sections.length > 0) return sections.join("\n\n---\n\n");
    return "(validated sections not found in spec)";
  } catch {
    return "(error reading spec)";
  }
}
