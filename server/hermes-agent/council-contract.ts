/**
 * Council API-Vertrag — Typdefinitionen für die Council-Schnittstelle.
 *
 * Quelle: `server/hermes-agent/council-kernel.js`, `council-participants.js`, `bridge.js`.
 * Stabil ab Council-Pilot v1. Änderungen nur versioniert.
 *
 * Verwendungszweck: Claude (Bauabschnitt D) bindet diese Events in die 3D-Oberfläche ein.
 * Keine zweite Wahrheit — dies ist die *einzige* Spezifikation der Council-Events.
 */

// ============================================================================
// Basis-Typen
// ============================================================================

export type CouncilModus = "direkt" | "council" | "debatte" | "build";

export type CouncilPhase =
  | "idle"
  | "starting"
  | "estimating"
  | "running"
  | "round_started"
  | "turn_started"
  | "turn_streaming"
  | "turn_complete"
  | "round_complete"
  | "complete"
  | "aborted"
  | "error";

export type CouncilEventName =
  | "council.started"
  | "council.round.started"
  | "council.turn.started"
  | "council.turn.delta"
  | "council.turn.complete"
  | "council.round.complete"
  | "council.complete"
  | "council.aborted"
  | "council.cost.update"
  | "council.error";

export interface CouncilParticipant {
  agentId: string;           // z. B. "default", "router-claude-review", "router-opencode"
  label: string;             // Anzeigename: "Hermes", "Claude", "Codex"
  model: string;             // z. B. "gpt-5.6-sol", "claude-sonnet-4-6"
  provider: string;          // z. B. "openai-codex", "anthropic", "opencode-free"
  profileKey: string;        // Interner Profil-Key in Hermes
}

export interface CouncilCostEstimate {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
  approxCostUsd: number;     // Grobschätzung, kein verbindlicher Preis
  breakdown: Record<string, { input: number; output: number; cost: number }>;
}

export interface CouncilTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  approxCostUsd: number;
}

export interface CouncilSourceRef {
  type: "vault" | "raw" | "web" | "memory";
  path?: string;             // Vault-Pfad oder RAW-Pfad
  url?: string;              // Bei web
  title: string;
  excerpt?: string;          // Kurzer Auszug
  relevance?: number;        // 0–1, falls bewertet
}

export interface CouncilTurnSummary {
  agentId: string;
  label: string;
  round: number;
  stance?: "agree" | "disagree" | "neutral" | "unclear"; // Hermes-Einordnung
  keyPoints: string[];       // 1–3 Kernaussagen
  sources: CouncilSourceRef[];
  tokens: CouncilTokenUsage;
  durationMs: number;
}

// ============================================================================
// RPC: council.start
// ============================================================================

export interface CouncilStartParams {
  /** Eindeutiger Schlüssel für die Council-Sitzung (wird vom Client erzeugt) */
  sessionKey: string;
  /** Das Thema / die Frage, die diskutiert wird */
  topic: string;
  /** Modus bestimmt Ablauf und Rundenzahl */
  modus?: CouncilModus;                  // Default: "council"
  /** Explizite Teilnehmerliste (agentIds). Fehlt → Default-Paarung aus Modus */
  participantAgentIds?: string[];
  /** Maximale Runden (Hardcap 10). Default: 3 (Council), 1 (Direkt), 5 (Debatte), 4 (Build) */
  maxRounds?: number;
  /** Ob sensible LifeOS-Quellen nur an Hermes, nicht an externe Anbieter gehen */
  respectSensitivity?: boolean;          // Default: true
  /** Zusätzlicher Kontext, der allen Teilnehmern mitgegeben wird */
  sharedContext?: string;
}

export interface CouncilStartResult {
  runId: string;
  sessionKey: string;
  topic: string;
  modus: CouncilModus;
  participants: CouncilParticipant[];
  maxRounds: number;
  costEstimate: CouncilCostEstimate;
  startedAt: string;         // ISO 8601
  status: "started";
}

// ============================================================================
// RPC: council.abort
// ============================================================================

export interface CouncilAbortParams {
  runId: string;
  reason?: string;           // Default: "user aborted"
}

export interface CouncilAbortResult {
  ok: true;
  runId: string;
  abortedAt: string;
  completedRounds: number;
  costSoFar: CouncilTokenUsage;
}

// ============================================================================
// Events (Server → Client via WebSocket /office-speech oder Bridge-Events)
// ============================================================================

/** Basis-Event, das alle Council-Events teilen */
export interface CouncilBaseEvent {
  type: CouncilEventName;
  runId: string;
  timestamp: string;         // ISO 8601
  phase: CouncilPhase;
}

/** 1. Council gestartet — nach Kosten-Schätzung, vor Runde 1 */
export interface CouncilStartedEvent extends CouncilBaseEvent {
  type: "council.started";
  phase: "started";
  topic: string;
  modus: CouncilModus;
  participants: CouncilParticipant[];
  maxRounds: number;
  costEstimate: CouncilCostEstimate;
}

/** 2. Runde beginnt */
export interface CouncilRoundStartedEvent extends CouncilBaseEvent {
  type: "council.round.started";
  phase: "round_started";
  round: number;
  maxRounds: number;
}

/** 3. Turn eines Teilnehmers beginnt */
export interface CouncilTurnStartedEvent extends CouncilBaseEvent {
  type: "council.turn.started";
  phase: "turn_started";
  round: number;
  agentId: string;
  label: string;
  model: string;
  provider: string;
  promptPreview: string;     // Erste ~120 Zeichen des Prompts
  estimatedTokens: number;   // Für Kosten-HUD
}

/** 4. Streaming-Delta (wiederholt, 0–n mal pro Turn) */
export interface CouncilTurnDeltaEvent extends CouncilBaseEvent {
  type: "council.turn.delta";
  phase: "turn_streaming";
  round: number;
  agentId: string;
  delta: string;             // Text-Delta seit letztem Event
  accumulated: string;       // Kompletter Text bis hierhin
  tokenCountSoFar: number;   // Geschätzt aus Zeichenlänge
}

/** 5. Turn abgeschlossen */
export interface CouncilTurnCompleteEvent extends CouncilBaseEvent {
  type: "council.turn.complete";
  phase: "turn_complete";
  round: number;
  agentId: string;
  label: string;
  response: string;          // Vollständige Antwort
  summary: CouncilTurnSummary;
}

/** 6. Runde abgeschlossen (alle Teilnehmer dieser Runde fertig) */
export interface CouncilRoundCompleteEvent extends CouncilBaseEvent {
  type: "council.round.complete";
  phase: "round_complete";
  round: number;
  completedTurns: number;
  /** Hermes-Einordnung der Runde (optional) */
  roundSummary?: {
    agreements: string[];
    disagreements: string[];
    openQuestions: string[];
  };
}

/** 7. Council vollständig abgeschlossen (alle Runden) */
export interface CouncilCompleteEvent extends CouncilBaseEvent {
  type: "council.complete";
  phase: "complete";
  rounds: number;
  durationMs: number;
  finalCost: CouncilTokenUsage;
  /** Endgültige Entscheidungsvorlage von Hermes (nur bei Modus Debatte/Build) */
  decisionDraft?: {
    recommendation: string;
    rationale: string;
    dissentingViews: string[];
    requiredApprovals: string[];
  };
}

/** 8. Council abgebrochen */
export interface CouncilAbortedEvent extends CouncilBaseEvent {
  type: "council.aborted";
  phase: "aborted";
  reason: string;
  completedRounds: number;
  costSoFar: CouncilTokenUsage;
  /** Teilergebnisse der bis dahin fertigen Turns */
  partialResults: CouncilTurnSummary[];
}

/** 9. Kosten-Update (läuft parallel: estimate → turn-start → turn-complete) */
export interface CouncilCostUpdateEvent extends CouncilBaseEvent {
  type: "council.cost.update";
  phase: "estimating" | "turn_started" | "turn_complete" | "complete";
  /** Kumulierte Tokens/Kosten bis zu diesem Zeitpunkt */
  accumulated: CouncilTokenUsage;
  /** Bei phase="estimating": die Vorab-Schätzung */
  estimate?: CouncilCostEstimate;
  /** Bei phase="turn_started": geschätzt für diesen Turn */
  turnEstimate?: { agentId: string; estimatedTokens: number; approxCostUsd: number };
}

/** 10. Fehler */
export interface CouncilErrorEvent extends CouncilBaseEvent {
  type: "council.error";
  phase: "error";
  code: string;              // Siehe Error-Codes unten
  message: string;
  recoverable: boolean;
  context?: Record<string, unknown>;
}

// Union aller Event-Typen für Type-Guards
export type CouncilEvent =
  | CouncilStartedEvent
  | CouncilRoundStartedEvent
  | CouncilTurnStartedEvent
  | CouncilTurnDeltaEvent
  | CouncilTurnCompleteEvent
  | CouncilRoundCompleteEvent
  | CouncilCompleteEvent
  | CouncilAbortedEvent
  | CouncilCostUpdateEvent
  | CouncilErrorEvent;

// ============================================================================
// Fehler-Codes (stabil, für Client-Handling)
// ============================================================================

export const CouncilErrorCode = {
  COUNCIL_NOT_READY: "council_not_ready",
  INVALID_PARAMS: "council_invalid_params",
  SESSION_NOT_FOUND: "council_session_not_found",
  RUN_NOT_FOUND: "council_run_not_found",
  START_FAILED: "council_start_failed",
  ABORT_MISSING_RUNID: "council_abort_missing_runid",
  ABORT_FAILED: "council_abort_failed",
  PARTICIPANT_UNAVAILABLE: "council_participant_unavailable",
  BACKEND_ERROR: "council_backend_error",
  COST_LIMIT_EXCEEDED: "council_cost_limit_exceeded",
  SENSITIVITY_VIOLATION: "council_sensitivity_violation",
} as const;

export type CouncilErrorCode = typeof CouncilErrorCode[keyof typeof CouncilErrorCode];

// ============================================================================
// Type-Guards für Client-Seite (Claude/V2)
// ============================================================================

export function isCouncilEvent(obj: unknown): obj is CouncilEvent {
  if (!obj || typeof obj !== "object") return false;
  const e = obj as Record<string, unknown>;
  return typeof e.type === "string" && e.type.startsWith("council.");
}

export function getCouncilEventType(event: CouncilEvent): CouncilEventName {
  return event.type;
}

// ============================================================================
// Konstanten / Defaults (für Dokumentation, nicht zur Laufzeit erzwungen)
// ============================================================================

export const COUNCIL_DEFAULTS = {
  MAX_ROUNDS_HARDCAP: 10,
  DEFAULT_MAX_ROUNDS: {
    direkt: 1,
    council: 3,
    debatte: 5,
    build: 4,
  },
  COST_WARNING_THRESHOLD_USD: 0.50,   // Ab hier Warnung im UI
  COST_HARD_LIMIT_USD: 5.00,          // Ab hier Auto-Abort (falls konfiguriert)
  ESTIMATE_CHARS_PER_TOKEN: 4,        // Heuristik
  PROMPT_PREVIEW_LENGTH: 120,
} as const;

// ============================================================================
// Beispiel-Event-Sequenz (für Integrationstests / Mocking)
// ============================================================================

/*
// 1. Client → Server: council.start({ sessionKey, topic, modus: "council", participantAgentIds: ["default", "router-claude-review"] })
// 2. Server → Client: council.started { runId, costEstimate: { approxCostUsd: 0.12, ... } }
// 3. Server → Client: council.cost.update { phase: "estimating", estimate: {...}, accumulated: { totalTokens: 0, ... } }
// 4. Server → Client: council.round.started { round: 1, maxRounds: 3 }
// 5. Server → Client: council.turn.started { round: 1, agentId: "default", label: "Hermes", estimatedTokens: 450, promptPreview: "Du bist Hermes..." }
// 6. Server → Client: council.cost.update { phase: "turn_started", turnEstimate: { agentId: "default", estimatedTokens: 450, approxCostUsd: 0.02 }, accumulated: {...} }
// 7. Server → Client: council.turn.delta { round: 1, agentId: "default", delta: "Ich verstehe", accumulated: "Ich verstehe", tokenCountSoFar: 5 }
// 8. Server → Client: council.turn.delta { round: 1, agentId: "default", delta: " die Frage.", accumulated: "Ich verstehe die Frage.", tokenCountSoFar: 12 }
// 9. Server → Client: council.turn.complete { round: 1, agentId: "default", response: "...", summary: { stance: "neutral", keyPoints: [...], tokens: {...}, durationMs: 1200 } }
// 10. Server → Client: council.turn.started { round: 1, agentId: "router-claude-review", label: "Claude", ... }
// 11. ... (delta, complete für Claude)
// 12. Server → Client: council.round.complete { round: 1, roundSummary: { agreements: [...], disagreements: [...] } }
// 13. (Runden 2–3 analog)
// 14. Server → Client: council.complete { rounds: 3, durationMs: 8500, finalCost: {...}, decisionDraft: {...} }
// ODER bei Abort:
// 14. Server → Client: council.aborted { reason: "user aborted", completedRounds: 1, costSoFar: {...}, partialResults: [...] }
*/

// ============================================================================
// Integrationshinweise für Claude (Bauabschnitt D)
// ============================================================================

/*
VERBINDUNG ZUM OFFICE-FRONTEND:
- Events kommen über `office-speech` (WebSocket `/api/ws` → Bridge → office-speech Subscriber)
- In `V2Scene.tsx` / Council-Panel: `officeSpeech.on("council.*", handler)`
- Jedes Event trägt `runId` → mehrere parallele Councils unterscheidbar
- `phase` erlaubt einfache Zustandsmaschine im UI (Loading → Streaming → Complete)

AVATAR-ZUORDNUNG:
- `CouncilParticipant.agentId` matcht auf `agentRoster` im Office (Name, Modell, Status)
- Speech-Bubble: `council.turn.delta` → Text anhängen, `council.turn.complete` → finalisieren
- Kosten-HUD: `council.cost.update` → `accumulated.approxCostUsd` anzeigen, bei `estimate` Warnung vor Start

QUELLEN-ANZEIGE:
- `CouncilTurnSummary.sources` → anklickbare Chips im Panel
- `type: "vault"` → `obsidian://open?vault=LifeOS&file=...` Link
- `type: "raw"` → Hinweis „Originalquelle in RAW“, kein direkter Link (Schutz)

MODUS-VISUALISIERUNG:
- "direkt": 1 Teilnehmer, 1 Runde, kein Hermes-Summary
- "council": 2+ Teilnehmer, 3 Runden, Hermes fasst Unterschiede zusammen (roundSummary)
- "debatte": 2+ Teilnehmer, 5 Runden, decisionDraft am Ende
- "build": 3+ Teilnehmer (Planer/Umsetzer/Prüfer), 4 Runden, decisionDraft + Artefakt-Ref

FEHLERBEHANDLUNG:
- `council.error` mit `recoverable: true` → UI zeigt "Wiederholen"-Button
- `council_not_ready` → Council-Kernel noch nicht initialisiert (Bridge-Connect abwarten)
- `cost_limit_exceeded` → Auto-Abort, `council.aborted` folgt
*/