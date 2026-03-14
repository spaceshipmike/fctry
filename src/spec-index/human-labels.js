/**
 * Human-facing vocabulary layer for fctry.
 *
 * Maps internal readiness labels to user vocabulary and provides helpers
 * for deriving feature names from spec section titles.
 *
 * Internal labels (agents, state.json, interchange):
 *   draft, undocumented, ready-to-build, aligned, ready-to-execute, satisfied
 *
 * User vocabulary (CLI output, viewer UI, experience reports):
 *   specced, unspecced, built, partial (N/M built)
 *
 * See spec #navigate-sections (2.8) for the mapping definition.
 */

/**
 * Map an internal readiness label to user-facing status vocabulary.
 *
 * @param {string} label - Internal readiness label
 * @returns {string} User-facing status term
 */
export function readinessToStatus(label) {
  switch (label) {
    case "aligned":
    case "ready-to-execute":
    case "satisfied":
      return "built";
    case "ready-to-build":
    case "draft":
      return "specced";
    case "undocumented":
      return "unspecced";
    default:
      return label;
  }
}

/**
 * Compute an aggregate status for a parent section from its children.
 *
 * @param {number} builtCount - Number of child sections with "built" status
 * @param {number} totalCount - Total child sections
 * @returns {string} Aggregate status string
 */
export function aggregateStatus(builtCount, totalCount) {
  if (totalCount === 0) return "built";
  if (builtCount >= totalCount) return "built";
  if (builtCount === 0) return `${totalCount} sections specced`;
  return `partial (${builtCount}/${totalCount} built)`;
}

/**
 * Derive a feature name from a section alias using a feature map.
 * Falls back to the alias if no map entry exists.
 *
 * @param {string} alias - Section alias (e.g., "execute-flow")
 * @param {Object} featureMap - Map of alias → { number, title }
 * @returns {string} Human-readable feature name with number
 */
export function sectionToFeatureName(alias, featureMap) {
  if (!alias) return "";
  const entry = featureMap?.[alias];
  if (entry) return `${entry.title} (${entry.number})`;
  return alias;
}

/**
 * Translate a readiness summary (counts by internal label) to user vocabulary.
 *
 * @param {Object} summary - { aligned: N, "ready-to-build": M, draft: K, ... }
 * @returns {{ built: number, specced: number, unspecced: number, total: number }}
 */
export function translateSummary(summary) {
  const built = (summary.aligned || 0) +
                (summary["ready-to-execute"] || 0) +
                (summary.satisfied || 0);
  const specced = (summary["ready-to-build"] || 0) +
                  (summary.draft || 0);
  const unspecced = summary.undocumented || 0;
  const total = built + specced + unspecced;
  return { built, specced, unspecced, total };
}
