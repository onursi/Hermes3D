/**
 * Frontdoor Router — deterministic task classification for the "Default"
 * agent in Hermes3D.
 *
 * Native Hermes has no mechanism that routes an incoming message to a named
 * CLI profile (`delegate_task` spawns fresh generic children on the SAME
 * model, not a chosen profile; the `frontdoor-router` plugin declared in
 * config.yaml has no code behind it — see the diagnosis this module follows
 * up on). This module fills exactly that gap, and only that gap: given a
 * message text, decide which of the operator's four profiles should handle
 * it, and why.
 *
 * Deliberately NOT an LLM call: the routing rules below are rule-based
 * (keyword/shape heuristics), so classification is instant, free, and
 * 100% reproducible — "deterministisch" per the spec this was built from.
 * If the rules ever need to get smarter than keyword matching, that is a
 * deliberate, separate upgrade — not something this module should grow into
 * silently.
 *
 * Never modifies config.yaml, never touches the existing profiles, never
 * calls delegate_task. Multi-agent/MoA intent is detected but NEVER
 * auto-routed — the caller must confirm explicitly (see ROUTING_CATEGORIES.moa).
 */

"use strict";

/** The four routing outcomes this module can produce. */
const ROUTING_CATEGORIES = {
  SMALL_CODING: "small_coding",
  STANDARD: "standard_processing",
  CRITICAL_REVIEW: "critical_review",
  COMPLEX_OR_UNCLEAR: "complex_or_unclear",
  MOA_REQUESTED: "moa_requested",
};

/**
 * category -> { agentId, label } describing which Hermes3D agent (== which
 * hermes-agent profile) handles that category. `agentId` matches the `id`
 * field bridge.js's `toHermes3dAgents()` assigns from the profile name.
 *
 * `moa_requested` intentionally has no dedicated target: it always stays on
 * `default` (never auto-switches profile), per "Multi-Agent/MoA → niemals
 * automatisch, immer vorher fragen".
 */
const CATEGORY_TARGETS = {
  [ROUTING_CATEGORIES.SMALL_CODING]: { targetAgentId: "router-opencode", targetLabel: "OpenCode" },
  [ROUTING_CATEGORIES.STANDARD]: { targetAgentId: "router-deepseek-pro", targetLabel: "DeepSeek" },
  [ROUTING_CATEGORIES.CRITICAL_REVIEW]: { targetAgentId: "router-claude-review", targetLabel: "Claude Review" },
  [ROUTING_CATEGORIES.COMPLEX_OR_UNCLEAR]: { targetAgentId: "default", targetLabel: "Default (gpt-5.6-sol)" },
  [ROUTING_CATEGORIES.MOA_REQUESTED]: { targetAgentId: "default", targetLabel: "Default (gpt-5.6-sol)" },
};

// Keyword lists are intentionally short and literal — easy to read, easy to
// extend, no fuzzy matching. German + English, since both occur in this
// operator's traffic. Case-insensitive matching is applied by the caller.

const MOA_KEYWORDS = [
  "moa", "mixture of agents", "mehrere modelle", "alle modelle",
  "vergleiche die modelle", "compare models", "multi-agent", "multi agent",
];

const CRITICAL_REVIEW_KEYWORDS = [
  "review", "code review", "audit", "sicherheitsrelevant", "security review",
  "vulnerability", "sicherheitslücke", "pull request", "kritisches review",
  "sicherheitsaudit", "penetration", "security-check",
];

const COMPLEX_SYSTEM_KEYWORDS = [
  "systemarchitektur", "system architecture", "produktionsmigration",
  "production migration", "kritische infrastruktur", "critical infrastructure",
  "rollback-strategie", "breaking change", "gesamtarchitektur",
  "disaster recovery", "incident response", "systemkritisch", "mission critical",
];

const SMALL_CODING_KEYWORDS = [
  "funktion", "function", "bugfix", "bug fix", "kleines skript", "small script",
  "snippet", "refactor", "code-schnipsel", "einzeiler", "one-liner",
  "schreibe eine", "write a function", "fix diesen fehler", "fix this error",
  "parse", "regex", "unit test", "unittest",
];

/** Small-coding also fires on an inline code fence — a strong, cheap signal. */
const CODE_FENCE_RE = /```|`[^`\n]{2,80}`/;

/** Above this length a message is treated as "too big to be small coding". */
const SMALL_CODING_MAX_CHARS = 600;

const containsAny = (haystackLower, needles) =>
  needles.some((needle) => haystackLower.includes(needle));

/**
 * Classify a message deterministically.
 *
 * @param {string} text - the raw user message.
 * @returns {{
 *   category: string,
 *   targetAgentId: string,
 *   targetLabel: string,
 *   reason: string,
 * }}
 */
function classifyMessage(text) {
  const raw = typeof text === "string" ? text : "";
  const lower = raw.toLowerCase();

  // Priority order matters — most specific / highest-stakes signal wins.
  // 1) Multi-agent / MoA intent — flagged, never auto-routed.
  if (containsAny(lower, MOA_KEYWORDS)) {
    return {
      category: ROUTING_CATEGORIES.MOA_REQUESTED,
      ...CATEGORY_TARGETS[ROUTING_CATEGORIES.MOA_REQUESTED],
      reason:
        "Multi-agent/MoA intent detected — never auto-routed. Staying on " +
        "Default; ask the user to explicitly confirm before using MoA.",
    };
  }

  // 2) Critical review — deliberately checked before "complex/system" so a
  //    security review of a critical system still goes to Claude, not Default.
  if (containsAny(lower, CRITICAL_REVIEW_KEYWORDS)) {
    return {
      category: ROUTING_CATEGORIES.CRITICAL_REVIEW,
      ...CATEGORY_TARGETS[ROUTING_CATEGORIES.CRITICAL_REVIEW],
      reason: "Matched a critical-review keyword (review/audit/security/…).",
    };
  }

  // 3) Complex / system-critical — explicit escalation keywords keep this on
  //    Default regardless of length, since these need the strongest judgment.
  if (containsAny(lower, COMPLEX_SYSTEM_KEYWORDS)) {
    return {
      category: ROUTING_CATEGORIES.COMPLEX_OR_UNCLEAR,
      ...CATEGORY_TARGETS[ROUTING_CATEGORIES.COMPLEX_OR_UNCLEAR],
      reason: "Matched a complex/system-critical keyword — staying on Default.",
    };
  }

  // 4) Small coding — keyword AND short enough to plausibly be "small".
  const looksLikeCode = CODE_FENCE_RE.test(raw) || containsAny(lower, SMALL_CODING_KEYWORDS);
  if (looksLikeCode && raw.length <= SMALL_CODING_MAX_CHARS) {
    return {
      category: ROUTING_CATEGORIES.SMALL_CODING,
      ...CATEGORY_TARGETS[ROUTING_CATEGORIES.SMALL_CODING],
      reason: `Looks like a small coding task (code marker/keyword, ${raw.length} chars <= ${SMALL_CODING_MAX_CHARS}).`,
    };
  }
  if (looksLikeCode) {
    // Coding-shaped but long — treat as complex rather than "small".
    return {
      category: ROUTING_CATEGORIES.COMPLEX_OR_UNCLEAR,
      ...CATEGORY_TARGETS[ROUTING_CATEGORIES.COMPLEX_OR_UNCLEAR],
      reason: `Coding-shaped but too long to be "small" (${raw.length} chars > ${SMALL_CODING_MAX_CHARS}) — staying on Default.`,
    };
  }

  // 5) Empty/unclear input — fail safe to Default rather than guessing.
  if (!raw.trim()) {
    return {
      category: ROUTING_CATEGORIES.COMPLEX_OR_UNCLEAR,
      ...CATEGORY_TARGETS[ROUTING_CATEGORIES.COMPLEX_OR_UNCLEAR],
      reason: "Empty or unrecognizable input — staying on Default.",
    };
  }

  // 6) Everything else is "standard processing".
  return {
    category: ROUTING_CATEGORIES.STANDARD,
    ...CATEGORY_TARGETS[ROUTING_CATEGORIES.STANDARD],
    reason: "No special-case keyword matched — default bucket for general requests.",
  };
}

/** True when the classifier's target differs from the caller's own agent (i.e. an actual reroute). */
const isReroute = (classification, callerAgentId) =>
  classification.targetAgentId !== callerAgentId;

module.exports = {
  ROUTING_CATEGORIES,
  CATEGORY_TARGETS,
  classifyMessage,
  isReroute,
};
