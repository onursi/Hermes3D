/**
 * Token Estimator — grobe Token-Schätzung für Kostenanzeige VOR dem Run.
 *
 * Nutzt keine externe Bibliothek, keine API-Calls. Heuristik:
 * - 1 Token ≈ 4 Zeichen (DE/EN gemischt, Code etwas dichter)
 * - Prompt-Template Overhead ~100 Tokens
 * - Antwort-Erwartung: 200-800 Tokens je nach Aufgabe
 *
 * Genau genug für "Kosten vorher sichtbar machen" (Leitplanke §4),
 * nicht für Abrechnung.
 */

"use strict";

/**
 * Schätzt Token für einen Text.
 * @param {string} text
 * @returns {number} geschätzte Token-Anzahl
 */
function estimateTokens(text) {
  if (!text || typeof text !== "string") return 0;
  // 1 Token ≈ 4 chars (konservativ, lieber etwas hoch schätzen)
  return Math.ceil(text.length / 4);
}

/**
 * Schätzt Token für einen kompletten Turn (Prompt + erwartete Response).
 * @param {string} promptText
 * @param {number} [expectedResponseChars=800] - erwartete Antwortlänge in Zeichen
 * @returns {{ promptTokens: number, responseTokens: number, total: number }}
 */
function estimateTurnCost(promptText, expectedResponseChars = 800) {
  const promptTokens = estimateTokens(promptText) + 100; // Template-Overhead
  const responseTokens = Math.ceil(expectedResponseChars / 4);
  return { promptTokens, responseTokens, total: promptTokens + responseTokens };
}

/**
 * Schätzt Kosten in USD (sehr grob, nur Größenordnung).
 * @param {number} totalTokens
 * @param {string} [modelTier="standard"] - "cheap" | "standard" | "premium"
 * @returns {number} approx cost in USD
 */
function estimateCostUsd(totalTokens, modelTier = "standard") {
  const rates = {
    cheap: 0.50,      // $0.50 / 1M tokens (free tier models, nemotron)
    standard: 3.00,   // $3.00 / 1M tokens (gpt-5.6-sol, deepseek-v4-pro)
    premium: 15.00,   // $15.00 / 1M tokens (claude-4-sonnet, gpt-4o)
  };
  const rate = rates[modelTier] || rates.standard;
  return (totalTokens / 1_000_000) * rate;
}

/**
 * Bestimmt Modell-Tier aus Modell-Name.
 * @param {string} modelName
 * @returns {"cheap"|"standard"|"premium"}
 */
function modelTier(modelName) {
  const name = (modelName || "").toLowerCase();
  if (name.includes("nemotron") || name.includes("free") || name.includes("gemini-3.8-flash")) {
    return "cheap";
  }
  if (name.includes("claude-4") || name.includes("gpt-4o") || name.includes("opus")) {
    return "premium";
  }
  return "standard";
}

module.exports = {
  estimateTokens,
  estimateTurnCost,
  estimateCostUsd,
  modelTier,
};