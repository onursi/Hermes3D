/**
 * Council Participants — Adapter je Teilnehmer (Profil → Bridge-Session).
 *
 * Kapselt: "Wie bekommt ein Council-Teilnehmer seine Session?"
 * - Nutzt dieselbe Logik wie Bridge.ensureSession()
 * - Profile werden auf hermes-agent-Sessions gemappt (lazy create/resume)
 * - Stored IDs sind dauerhaft, Runtime-IDs verbindungsgebunden
 * - Keine eigene State-Hoheit — schreibt in Bridge-Maps (sessions, sessionKeyByRuntimeId)
 *
 * Leitplanken: keine zweite Wahrheit, Routing/History nicht anfassen.
 */

"use strict";

const { randomUUID } = require("node:crypto");

const asString = (v, fb = "") => (typeof v === "string" && v.trim() ? v.trim() : fb);

/**
 * Erstellt oder resumed eine Session für einen Council-Teilnehmer.
 * @param {Object} deps - Bridge-Abhängigkeiten (Referenzen, keine Kopien)
 * @param {Map} deps.sessions                  // sessionKey → { runtimeId, storedId, title }
 * @param {Map} deps.sessionKeyByRuntimeId     // runtimeId → sessionKey
 * @param {Object} deps.client                 // JSON-RPC Client mit .request()
 * @param {Function} deps.log
 * @param {Function} deps.logError
 * @param {Object} participant                 // { agentId, profile, model, label }
 * @param {string} councilRunId                // für Session-Key Eindeutigkeit
 * @returns {Promise<{ sessionKey, runtimeId, storedId }>}
 */
async function ensureParticipantSession(deps, participant, councilRunId) {
  const { sessions, sessionKeyByRuntimeId, client, log, logError } = deps;
  const { agentId, profile, label } = participant;

  // Council-spezifischer Session-Key: agent:<agentId>:council-<runId>
  // Damit parallele Councils nicht kollidieren und nach Run-Ende aufräumbar sind
  const sessionKey = `agent:${agentId}:council-${councilRunId}`;

  // Schon vorhanden in DIESER Bridge-Instanz?
  const existing = sessions.get(sessionKey);
  if (existing?.runtimeId) {
    log(`[council-participants] ${label}: reuse existing session ${existing.runtimeId}`);
    return { sessionKey, runtimeId: existing.runtimeId, storedId: existing.storedId };
  }

  const scope = profile ? { profile } : {};
  const SESSION_RPC_TIMEOUT_MS = 60_000;

  try {
    const created = await client.request("session.create", scope, SESSION_RPC_TIMEOUT_MS);
    const runtimeId = asString(created?.session_id);
    const storedId = asString(created?.stored_session_id) || asString(created?.session_key);

    if (!runtimeId) {
      throw new Error("hermes-agent returned no session_id on create");
    }

    const entry = {
      runtimeId,
      storedId,
      title: `Council ${councilRunId.slice(0, 8)} / ${label}`,
    };

    sessions.set(sessionKey, entry);
    sessionKeyByRuntimeId.set(runtimeId, sessionKey);

    log(`[council-participants] ${label} session created: ${runtimeId} (stored: ${storedId})`);
    return { sessionKey, runtimeId, storedId };
  } catch (err) {
    logError(`[council-participants] session create failed for ${label}`, err);
    throw new Error(`Session für ${label} konnte nicht erstellt werden: ${err.message}`);
  }
}

/**
 * Resumed eine gespeicherte Session (für Chat-History-Nachlese nach Council-Ende).
 * Nutzt denselben Pfad wie Bridge: session.resume mit omit_messages: false.
 * @param {Object} deps - Bridge-Abhängigkeiten
 * @param {Object} participant
 * @param {string} storedId
 * @returns {Promise<{ runtimeId, messages }>}
 */
async function resumeParticipantSession(deps, participant, storedId) {
  const { client, log, logError } = deps;
  const { agentId, profile, label } = participant;

  const scope = profile ? { profile } : {};

  try {
    const resumed = await client.request(
      "session.resume",
      { session_id: storedId, omit_messages: false, ...scope },
      60_000
    );

    const runtimeId = asString(resumed?.session_id);
    const messages = resumed?.messages || [];

    if (!runtimeId) {
      throw new Error("hermes-agent returned no session_id on resume");
    }

    log(`[council-participants] ${label} session resumed: ${runtimeId} (${messages.length} messages)`);
    return { runtimeId, messages };
  } catch (err) {
    logError(`[council-participants] resume failed for ${label} (storedId: ${storedId})`, err);
    throw err;
  }
}

/**
 * Interruptet eine laufende Teilnehmer-Session (bei User-Abort).
 * @param {Object} deps
 * @param {string} runtimeId
 */
async function interruptParticipantSession(deps, runtimeId) {
  const { client, log } = deps;
  try {
    await client.request("session.interrupt", { session_id: runtimeId });
    log(`[council-participants] interrupted runtime ${runtimeId}`);
  } catch (err) {
    // Best-effort, nicht werfen
    log(`[council-participants] interrupt failed for ${runtimeId}: ${err.message}`);
  }
}

/**
 * Räumt die Bridge-Maps für einen Council-Run auf.
 * Wird am Ende von CouncilKernel.cleanupRun() aufgerufen.
 * @param {Object} deps
 * @param {string} councilRunId
 * @param {string[]} participantAgentIds
 */
function cleanupParticipantSessions(deps, councilRunId, participantAgentIds) {
  const { sessions, sessionKeyByRuntimeId, log } = deps;

  for (const agentId of participantAgentIds) {
    const sessionKey = `agent:${agentId}:council-${councilRunId}`;
    const entry = sessions.get(sessionKey);
    if (entry?.runtimeId) {
      sessionKeyByRuntimeId.delete(entry.runtimeId);
    }
    sessions.delete(sessionKey);
  }

  log(`[council-participants] cleaned up ${participantAgentIds.length} sessions for run ${councilRunId}`);
}

/**
 * Baut ein Teilnehmer-Objekt aus dem Agent-Roster der Bridge.
 * @param {Object} agent - Aus Bridge agentRoster: { id, name, profile, model, isDefault }
 * @returns {Object} { agentId, profile, model, label }
 */
function participantFromAgent(agent) {
  return {
    agentId: agent.id,
    profile: asString(agent.profile),
    model: asString(agent.model),
    label: agent.name,
  };
}

/**
 * Filtert den Agent-Roster auf gültige Council-Teilnehmer.
 * Schließt den Default-Agenten NICHT automatisch ein (Caller entscheidet).
 * @param {Object[]} agentRoster
 * @param {string} defaultAgentId
 * @param {string[]} [requestedAgentIds] - explizite Wunschliste
 * @returns {Object[]} Teilnehmer-Array
 */
function selectParticipants(agentRoster, defaultAgentId, requestedAgentIds) {
  const available = agentRoster.filter((a) => a.id !== defaultAgentId);

  if (Array.isArray(requestedAgentIds) && requestedAgentIds.length > 0) {
    return requestedAgentIds
      .map((id) => agentRoster.find((a) => a.id === id))
      .filter(Boolean)
      .map(participantFromAgent);
  }

  // Auto-Heuristik: Spezialisten bevorzugen (Code, Review, Gemini, DeepSeek)
  const specialistKeywords = ["code", "review", "claude", "gemini", "deepseek", "opencode"];
  const specialists = available.filter((a) => {
    const name = (a.id + " " + (a.model || "")).toLowerCase();
    return specialistKeywords.some((kw) => name.includes(kw));
  });

  const picked = specialists.slice(0, 3); // max 3 Spezialisten
  if (picked.length === 0 && available.length > 0) {
    picked.push(available[0]); // Fallback: erster verfügbarer
  }

  return picked.map(participantFromAgent);
}

module.exports = {
  ensureParticipantSession,
  resumeParticipantSession,
  interruptParticipantSession,
  cleanupParticipantSessions,
  participantFromAgent,
  selectParticipants,
};