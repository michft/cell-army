/** @typedef {import("../types").DayId} DayId */

/** @type {{ id: DayId, label: string, date: string }[]} */
export const DAY_OPTIONS = [
  { id: "day1", label: "Day 1", date: "13 May" },
  { id: "day2", label: "Day 2", date: "14 May" },
];

/**
 * Toggle a value's presence in a selection array, returning a new sorted array.
 *
 * @param {string[]} current - The current selection of values.
 * @param {string} value - The value to toggle in the selection.
 * @returns {string[]} The updated selection: the value is removed if it was present, otherwise it is added and the resulting array is sorted.
 */
export function toggleSelection(current, value) {
  return current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value].sort();
}

/**
 * Extracts tag labels from a session for a given tag namespace.
 * @param {{ tags: { namespace: string, label: string }[] }} session - Session object containing a `tags` array.
 * @param {string} namespace - Tag namespace to match.
 * @returns {string[]} Array of tag labels whose tag.namespace equals the provided namespace (may be empty).
 */
export function tagLabels(session, namespace) {
  return session.tags
    .filter((tag) => tag.namespace === namespace)
    .map((tag) => tag.label);
}

/**
 * Extracts the primary name segment from a speaker label.
 * @param {string} label - Speaker label, typically in "Last, First" form.
 * @returns {string} The text before the first comma, trimmed; if there is no comma, returns the original label.
 */
export function speakerName(label) {
  return label.split(",")[0]?.trim() ?? label;
}

const LEVEL_LABELS = {
  foundational: "100",
  intermediate: "200",
  advanced: "300",
  expert: "400",
  unspecified: "Other",
};

/**
 * Get the three-digit level code for a session.
 * @param {{ code?: string, level: string }} session - Session object; `code` may include a digit, `level` is the level key.
 * @returns {string} The three-digit level code (for example `"100"`, `"200"`, `"300"`, `"400"`) or `"Other"` when no code can be determined.
 */
export function sessionLevelCode(session) {
  const codeMatch = session.code?.match(/(\d)/);
  if (codeMatch) {
    return `${codeMatch[1]}00`;
  }
  return LEVEL_LABELS[/** @type {keyof typeof LEVEL_LABELS} */ (session.level)] ?? "Other";
}
