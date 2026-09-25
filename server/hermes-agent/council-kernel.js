/**
 * Council Kernel — Ereignismodell und Gesprächsregie für den 2D-Office.
 *
 * Der Council erweitert den Frontdoor-Router: statt EINEM Turn (ein Prompt → eine Antwort)
 * orchestriert er MEHRERE Teilnehmer in einer Runde. Jeder Teilnehmer ist ein Hermes3D-Agent
 * (also ein hermes-agent Profil), der seine eigene Bridge-Session hat.
 *
 * Architekturlage: SITZT NEBEN bridge.js, frontdoor-router.js, jsonrpc-client.js.
 * Teilt sich deren Maps: sessions, sessionKeyByRuntimeId, activeRuns, runBySessionKey.
 * Nutzt dieselbe JSON-RPC-Schnittstelle (prompt.submit, session.create/resume, session.interrupt).
 *
 * Leitplanken (aus Briefing §4):
 * - Routing & History NICHT anfassen (bestehende Maps/Events bleiben unberührt)
 * - Keine zweite Wahrheit (nur lesend auf Bridge-Maps, Schreibrechte nur für Council-eigene Runs)
 * - Keine Endlosdebatte: feste Rundenzahl, User-Interrupt bricht ab
 * - Kosten VORHER sichtbar: Token-Schätzung pro Teilnehmer vor Rundenstart
 * - Erst 2D, keine Raumkosmetik
 */

"use strict";

const { EventEmitter } = require("node:events");
const { randomUUID } = require("node:crypto");
const { classifyMessage, ROUTING_CATEGORIES } = require("./frontdoor-router");
const { estimateTokens } = require("./token-estimator"); // wird erstellt, siehe unten

// ============================================================================
// TYPEN & KONSTANTEN
// ============================================================================

/**
 * @typedef {Object} CouncilParticipant
 * @property {string} agentId          // z.B. "router-opencode", "router-claude-review"
 * @property {string} profile          // Bridge-Profilname (leer für default)
 * @property {string} model            // z.B. "nemotron-3-ultra-free", "claude-4-sonnet"
 * @property {string} label            // Anzeigename im Office
 * @property {number} estimatedTokens  // grobe Vorhersage für Kostenanzeige
 */

/**
 * @typedef {Object} CouncilRun
 * @property {string} runId
 * @property {string} sessionKey       // Caller-SessionKey (z.B. "agent:default:main")
 * @property {CouncilParticipant[]} participants
 * @property {number} currentRound     // 0-basiert
 * @property {number} maxRounds
 * @property {string} topic            // Was wird besprochen?
 * @property {Map<string, string>} participantRuntimeIds  // agentId → runtimeId
 * @property {Map<string, string>} participantStoredIds   // agentId → storedId
 * @property {boolean} aborted
 * @property {number} startedAtMs
 * @property {Object} costAccumulator  // { promptTokens, completionTokens, totalEstimated }
 */

/**
 * @typedef {Object} CouncilEvents
 * @property {string} COUNCIL_STARTED   "council.started"
 * @property {string} ROUND_STARTED     "council.round.started"
 * @property {string} TURN_STARTED      "council.turn.started"
 * @property {string} TURN_DELTA        "council.turn.delta"
 * @property {string} TURN_COMPLETE     "council.turn.complete"
 * @property {string} ROUND_COMPLETE    "council.round.complete"
 * @property {string} COUNCIL_COMPLETE  "council.complete"
 * @property {string} COUNCIL_ABORTED   "council.aborted"
 * @property {string} COST_UPDATE       "council.cost.update"
 */

const COUNCIL_EVENTS = {
  COUNCIL_STARTED: "council.started",
  ROUND_STARTED: "council.round.started",
  TURN_STARTED: "council.turn.started",
  TURN_DELTA: "council.turn.delta",
  TURN_COMPLETE: "council.turn.complete",
  ROUND_COMPLETE: "council.round.complete",
  COUNCIL_COMPLETE: "council.complete",
  COUNCIL_ABORTED: "council.aborted",
  COST_UPDATE: "council.cost.update",
};

const DEFAULT_MAX_ROUNDS = 3;
const TURN_TIMEOUT_MS = 120_000; // pro Teilnehmer-Turn
const ROUND_GAP_MS = 500; // kleine Pause zwischen Teilnehmern

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

const asString = (v, fb = "") => (typeof v === "string" && v.trim() ? v.trim() : fb);

const emit = (upstream, event, payload) => {
  if (!upstream || upstream.readyState !== 1) return; // OPEN = 1
  upstream.emit("message", JSON.stringify({ type: "event", event, payload }));
};

/**
 * Schätzt Token für einen Prompt + erwartete Antwort.
 * Nutzt dieselbe Heuristik wie der Bridge-Token-Estimator (falls vorhanden),
 * sonst grob: 1 Token ≈ 4 chars (DE/EN gemischt).
 */
function estimateTurnCost(promptText, expectedResponseChars = 800) {
  const promptTokens = estimateTokens(promptText);
  const responseTokens = Math.ceil(expectedResponseChars / 4);
  return { promptTokens, responseTokens, total: promptTokens + responseTokens };
}

/**
 * Baut den Council-Prompt für einen Teilnehmer.
 * Enthält: Thema, bisherige Runde (falls >0), eigene Rolle.
 */
function buildParticipantPrompt(participant, topic, roundHistory, roundIndex) {
  const roleLine = `Du bist ${participant.label} (${participant.model}).`;
  const contextLine = roundIndex === 0
    ? "Erste Runde — eröffne das Thema."
    : `Runde ${roundIndex + 1}. Bisherige Beiträge:\n${roundHistory.map((h) => `- ${h.agentId}: ${h.summary}`).join("\n")}`;

  return `${roleLine}\n\nThema: ${topic}\n\n${contextLine}\n\nAntworte präzise, konkret, ohne Floskeln.`;
}

/**
 * Extrahiert eine Kurz-Zusammenfassung aus einer Antwort (für Runden-History).
 * Erste 160 Zeichen, kein Mid-Sentence-Cut.
 */
function summarizeResponse(text) {
  if (!text) return "(leer)";
  const clipped = text.slice(0, 180);
  const lastDot = clipped.lastIndexOf(".");
  return lastDot > 60 ? clipped.slice(0, lastDot + 1) : clipped + "…";
}

// ============================================================================
// COUNCIL KERNEL KLASSE
// ============================================================================

class CouncilKernel extends EventEmitter {
  /**
   * @param {Object} deps - Abhängigkeiten aus der Bridge (keine Kopien, Referenzen)
   * @param {Map} deps.sessions                    // sessionKey → { runtimeId, storedId, title }
   * @param {Map} deps.sessionKeyByRuntimeId       // runtimeId → sessionKey
   * @param {Map} deps.activeRuns                  // runId → { sessionKey, runtimeId, storedId, ... }
   * @property {Map} deps.runBySessionKey          // sessionKey → runId
   * @property {Object} deps.agentRoster           // Agenten-Array aus Bridge (id, name, profile, model, isDefault)
   * @property {string} deps.defaultAgentId
   * @property {Function} deps.client.request      // JSON-RPC Client (prompt.submit, session.create, session.interrupt)
   * @property {Function} deps.log
   * @property {Function} deps.logError
   * @property {Object} deps.upstream              // virtual WS (emitFrame)
   */
  constructor(deps) {
    super();
    this.sessions = deps.sessions;
    this.sessionKeyByRuntimeId = deps.sessionKeyByRuntimeId;
    this.activeRuns = deps.activeRuns;
    this.runBySessionKey = deps.runBySessionKey;
    this.agentRoster = deps.agentRoster;
    this.defaultAgentId = deps.defaultAgentId;
    this.client = deps.client;
    this.log = deps.log;
    this.logError = deps.logError;
    this.upstream = deps.upstream;

    // Laufende Council-Runs: runId → CouncilRun
    this.councilRuns = new Map();
  }

  /**
   * Startet einen Council-Run.
   * @param {Object} params
   * @param {string} params.sessionKey     // Caller-Session (meist "agent:default:main")
   * @param {string} params.topic          // Diskussionsthema
   * @param {string[]} [params.participantAgentIds]  // Explizite Liste, sonst Auto-Auswahl
   * @param {number} [params.maxRounds=3]
   * @returns {Promise<{ runId: string, participants: CouncilParticipant[], costEstimate: Object }>}
   */
  async start(params) {
    const sessionKey = asString(params.sessionKey, `agent:${this.defaultAgentId}:main`);
    const topic = asString(params.topic);
    const maxRounds = typeof params.maxRounds === "number" && params.maxRounds > 0
      ? Math.min(params.maxRounds, 10)
      : DEFAULT_MAX_ROUNDS;

    if (!topic) throw new Error("Council braucht ein Thema (topic).");

    // 1) Teilnehmer bestimmen
    const participants = this.selectParticipants(params.participantAgentIds);
    if (participants.length < 2) {
      throw new Error("Council braucht mindestens 2 Teilnehmer.");
    }

    // 2) Kosten VORHER schätzen & sichtbar machen
    const costEstimate = this.estimateTotalCost(participants, topic, maxRounds);
    emit(this.upstream, COUNCIL_EVENTS.COST_UPDATE, {
      runId: null, // noch keine runId
      phase: "estimate",
      participants: participants.map((p) => ({
        agentId: p.agentId,
        label: p.label,
        estimatedTokens: p.estimatedTokens,
      })),
      totalEstimatedTokens: costEstimate.totalTokens,
      approxCostUsd: costEstimate.approxCostUsd,
    });

    // 3) Run anlegen
    const runId = randomUUID();
    const run = {
      runId,
      sessionKey,
      participants,
      currentRound: 0,
      maxRounds,
      topic,
      participantRuntimeIds: new Map(),
      participantStoredIds: new Map(),
      aborted: false,
      startedAtMs: Date.now(),
      costAccumulator: { promptTokens: 0, completionTokens: 0, totalEstimated: costEstimate.totalTokens },
    };
    this.councilRuns.set(runId, run);

    // 4) Sessions für alle Teilnehmer sicherstellen (lazy create/resume)
    await this.ensureParticipantSessions(run);

    // 5) Bridge-Maps verknüpfen: participant runtimeIds → caller sessionKey
    //    Damit alle Deltas/Events in DIESEN Chat-Stream fließen (wie bei routed runs)
    for (const p of participants) {
      const rtId = run.participantRuntimeIds.get(p.agentId);
      if (rtId) this.sessionKeyByRuntimeId.set(rtId, sessionKey);
    }

    // 6) Active-Runs Buchhaltung (wie bei chat.send)
    this.activeRuns.set(runId, {
      sessionKey,
      runtimeId: run.participantRuntimeIds.get(participants[0].agentId), // erster als "Haupt"-runtime
      storedId: run.participantStoredIds.get(participants[0].agentId),
      buffer: "",
      aborted: false,
    });
    this.runBySessionKey.set(sessionKey, runId);

    // 7) Event: Council gestartet
    emit(this.upstream, COUNCIL_EVENTS.COUNCIL_STARTED, {
      runId,
      sessionKey,
      topic,
      maxRounds,
      participants: participants.map((p) => ({
        agentId: p.agentId,
        label: p.label,
        model: p.model,
      })),
      costEstimate,
    });

    // 8) Runden asynchron laufen lassen (nicht blockieren)
    this.runRounds(runId).catch((err) => {
      this.logError(`[council] Run ${runId} failed`, err);
      this.abortRun(runId, err.message);
    });

    return { runId, participants, costEstimate };
  }

  /**
   * Wählt Teilnehmer basierend auf Agent-IDs oder Auto-Heuristik.
   * Auto: default + 2-3 Spezialisten (Code, Review, Gemini), je nach Thema.
   */
  selectParticipants(requestedAgentIds) {
    const available = this.agentRoster.filter((a) => a.id !== this.defaultAgentId);

    if (Array.isArray(requestedAgentIds) && requestedAgentIds.length > 0) {
      return requestedAgentIds
        .map((id) => this.agentRoster.find((a) => a.id === id))
        .filter(Boolean)
        .map((a) => this.toParticipant(a));
    }

    // Auto-Auswahl: Frontdoor-Klassifizierung als Signal nutzen
    // (Thema wird kurz klassifiziert, um passende Spezialisten zu finden)
    const classification = classifyMessage(this.topic || "");
    const specialists = available.filter((a) => {
      // Einfache Heuristik: Modell/Profil-Name enthält Keywords
      const name = (a.id + " " + (a.model || "")).toLowerCase();
      return (
        name.includes("code") ||
        name.includes("review") ||
        name.includes("claude") ||
        name.includes("gemini") ||
        name.includes("deepseek")
      );
    });

    const picked = specialists.slice(0, 3); // max 3 Spezialisten + default = 4
    if (picked.length === 0) picked.push(available[0]); // Fallback

    // Default immer dabei (als Moderator/Eröffner)
    const defaultAgent = this.agentRoster.find((a) => a.id === this.defaultAgentId);
    const all = defaultAgent ? [defaultAgent, ...picked] : picked;

    return all.map((a) => this.toParticipant(a));
  }

  toParticipant(agent) {
    return {
      agentId: agent.id,
      profile: asString(agent.profile),
      model: asString(agent.model),
      label: agent.name,
      estimatedTokens: 0, // wird in estimateTotalCost gesetzt
    };
  }

  estimateTotalCost(participants, topic, maxRounds) {
    // Grobe Schätzung: Prompt ~300 tokens, Response ~400 tokens pro Turn
    const promptTokensPerTurn = 300;
    const responseTokensPerTurn = 400;
    const turns = participants.length * maxRounds;
    const totalTokens = turns * (promptTokensPerTurn + responseTokensPerTurn);

    // Sehr grobe USD-Schätzung (Input/Output gemischt ~$3/1M tokens für teure Modelle)
    // Nur als Größenordnung, NICHT als Abrechnung
    const approxCostUsd = (totalTokens / 1_000_000) * 3;

    // Pro Teilnehmer setzen
    for (const p of participants) {
      p.estimatedTokens = maxRounds * (promptTokensPerTurn + responseTokensPerTurn);
    }

    return { totalTokens, approxCostUsd: Math.round(approxCostUsd * 100) / 100 };
  }

  /**
   * Stellt sicher, dass alle Teilnehmer eine Bridge-Session haben (create oder resume).
   * Nutzt dieselbe Logik wie Bridge.ensureSession().
   */
  async ensureParticipantSessions(run) {
    for (const p of run.participants) {
      const sessionKey = `agent:${p.agentId}:council-${run.runId}`;
      try {
        const profile = p.profile;
        const scope = profile ? { profile } : {};
        const created = await this.client.request("session.create", scope, 60_000);
        const entry = {
          runtimeId: asString(created?.session_id),
          storedId: asString(created?.stored_session_id) || asString(created?.session_key),
          title: `Council ${run.runId.slice(0, 8)} / ${p.label}`,
        };
        this.sessions.set(sessionKey, entry);
        this.sessionKeyByRuntimeId.set(entry.runtimeId, sessionKey);
        run.participantRuntimeIds.set(p.agentId, entry.runtimeId);
        run.participantStoredIds.set(p.agentId, entry.storedId);
        this.log(`[council] ${p.label} session: ${entry.runtimeId} (stored: ${entry.storedId})`);
      } catch (err) {
        this.logError(`[council] session create failed for ${p.agentId}`, err);
        throw new Error(`Session für ${p.label} konnte nicht erstellt werden: ${err.message}`);
      }
    }
  }

  /**
   * Hauptschleife: Runden nacheinander, Teilnehmer nacheinander.
   */
  async runRounds(runId) {
    const run = this.councilRuns.get(runId);
    if (!run) return;

    try {
      for (let round = 0; round < run.maxRounds; round++) {
        if (run.aborted) break;
        run.currentRound = round;

        emit(this.upstream, COUNCIL_EVENTS.ROUND_STARTED, {
          runId,
          round: round + 1,
          maxRounds: run.maxRounds,
        });

        // Runden-History für Prompt-Kontext bauen
        const roundHistory = this.buildRoundHistory(run);

        // Teilnehmer nacheinander (sequenziell, NICHT parallel — "echte Nebenläufigkeit" ist §3-Frage)
        for (const p of run.participants) {
          if (run.aborted) break;
          await this.runParticipantTurn(run, p, round, roundHistory);
          if (!run.aborted) await this.sleep(ROUND_GAP_MS);
        }

        emit(this.upstream, COUNCIL_EVENTS.ROUND_COMPLETE, {
          runId,
          round: round + 1,
        });
      }

      if (!run.aborted) {
        emit(this.upstream, COUNCIL_EVENTS.COUNCIL_COMPLETE, {
          runId,
          rounds: run.maxRounds,
          durationMs: Date.now() - run.startedAtMs,
          finalCost: run.costAccumulator,
        });
      }
    } finally {
      // Cleanup: Bridge-Maps bereinigen
      this.cleanupRun(runId);
    }
  }

  buildRoundHistory(run) {
    // TODO: Aus Council-eigenem Speicher (nicht Bridge-History!) die Zusammenfassungen ziehen
    // Für MVP: leeres Array, wird nach Turn 1 gefüllt
    return [];
  }

  async runParticipantTurn(run, participant, roundIndex, roundHistory) {
    const runtimeId = run.participantRuntimeIds.get(participant.agentId);
    if (!runtimeId) throw new Error(`Keine Runtime-ID für ${participant.agentId}`);

    const prompt = buildParticipantPrompt(participant, run.topic, roundHistory, roundIndex);
    const costEst = estimateTurnCost(prompt);

    emit(this.upstream, COUNCIL_EVENTS.TURN_STARTED, {
      runId,
      round: roundIndex + 1,
      agentId: participant.agentId,
      label: participant.label,
      model: participant.model,
      promptPreview: prompt.slice(0, 200),
      estimatedTokens: costEst.total,
    });

    // Kosten-Akku aktualisieren (VORHER)
    run.costAccumulator.promptTokens += costEst.promptTokens;
    run.costAccumulator.completionTokens += costEst.responseTokens;
    emit(this.upstream, COUNCIL_EVENTS.COST_UPDATE, {
      runId,
      phase: "turn-start",
      agentId: participant.agentId,
      promptTokens: costEst.promptTokens,
      estimatedCompletionTokens: costEst.responseTokens,
      accumulated: { ...run.costAccumulator },
    });

    // Turn ausführen mit Delta-Streaming
    let fullResponse = "";
    const turnPromise = this.client.request("prompt.submit", {
      session_id: runtimeId,
      text: prompt,
    }, TURN_TIMEOUT_MS);

    // Delta-Events abfangen (wie Bridge: message.delta → council.turn.delta)
    // Wir nutzen einen temporären Listener auf dem Client
    const deltaHandler = (type, rtId, payload) => {
      if (rtId !== runtimeId) return;
      if (type === "message.delta") {
        const piece = asString(payload?.text ?? payload?.delta ?? payload?.token);
        if (piece) {
          fullResponse += piece;
          emit(this.upstream, COUNCIL_EVENTS.TURN_DELTA, {
            runId,
            agentId: participant.agentId,
            delta: piece,
            accumulated: fullResponse,
          });
        }
      }
    };
    this.client.on("event", deltaHandler);

    try {
      const result = await turnPromise;
      // message.complete kommt auch als Event, aber wir warten auf Promise
      const finalText = asString(result?.text ?? fullResponse);
      const summary = summarizeResponse(finalText);

      emit(this.upstream, COUNCIL_EVENTS.TURN_COMPLETE, {
        runId,
        round: roundIndex + 1,
        agentId: participant.agentId,
        label: participant.label,
        model: participant.model,
        response: finalText,
        summary,
        tokensUsed: { prompt: costEst.promptTokens, completion: costEst.responseTokens }, // geschätzt
      });

      // History für nächste Runde merken (einfach im Run-Objekt)
      if (!run.roundHistory) run.roundHistory = [];
      run.roundHistory.push({ agentId: participant.agentId, summary, round: roundIndex });
    } catch (err) {
      this.logError(`[council] turn failed for ${participant.agentId}`, err);
      emit(this.upstream, COUNCIL_EVENTS.TURN_COMPLETE, {
        runId,
        round: roundIndex + 1,
        agentId: participant.agentId,
        label: participant.label,
        error: err.message,
      });
    } finally {
      this.client.off("event", deltaHandler);
    }
  }

  /**
   * User-Interrupt: bricht den laufenden Council-Run ab.
   */
  abortRun(runId, reason = "user aborted") {
    const run = this.councilRuns.get(runId);
    if (!run || run.aborted) return;

    run.aborted = true;

    // Alle laufenden Teilnehmer-Sessions interrupten
    for (const [agentId, runtimeId] of run.participantRuntimeIds.entries()) {
      this.client.request("session.interrupt", { session_id: runtimeId }).catch(() => {});
    }

    emit(this.upstream, COUNCIL_EVENTS.COUNCIL_ABORTED, {
      runId,
      reason,
      completedRounds: run.currentRound,
      durationMs: Date.now() - run.startedAtMs,
      costSoFar: run.costAccumulator,
    });

    this.cleanupRun(runId);
  }

  cleanupRun(runId) {
    const run = this.councilRuns.get(runId);
    if (!run) return;

    // Bridge-Maps bereinigen (wie bei chat.send message.complete)
    for (const [agentId, runtimeId] of run.participantRuntimeIds.entries()) {
      this.sessionKeyByRuntimeId.delete(runtimeId);
    }
    this.activeRuns.delete(runId);
    this.runBySessionKey.delete(run.sessionKey);
    this.councilRuns.delete(runId);
  }

  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

module.exports = {
  CouncilKernel,
  COUNCIL_EVENTS,
  DEFAULT_MAX_ROUNDS,
  estimateTurnCost,
  buildParticipantPrompt,
  summarizeResponse,
};