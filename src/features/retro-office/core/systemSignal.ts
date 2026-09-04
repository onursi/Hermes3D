/**
 * One derived answer to the only question the room has to answer from across
 * the floor: how is it going right now.
 *
 * The room is meant to be read, not studied. Colour, light and sound carry
 * that reading, which means they all need the same single source — otherwise
 * they drift and the room contradicts itself. This module is that source. It
 * is pure: no fetches, no React, no clock of its own, so it can be tested and
 * so every input is visible at the call site.
 *
 * Two rules shaped it.
 *
 * The first is Onur's iron rule: nothing on screen without a source behind it.
 * `ruhig` is the interesting case — an absence of errors is not evidence that
 * anything is alive. `/api/health` returns a constant and proves only that
 * Next is running. So calm requires positive proof of life, and everything
 * short of that is `unbekannt`, which the room shows as its neutral resting
 * state rather than as reassurance.
 *
 * The second: three state-like sources in this codebase are fabricated and
 * must never reach here. `/api/office/presence` derives "working|idle|meeting|
 * error" by hashing a seed into a two-second bucket — it is seat animation for
 * the demo floor, not observation. `/api/todoist/tasks` and `/api/health`
 * return constants. The input type below simply has no field they fit into.
 */

export type SystemSignal = "ruhig" | "wartet" | "stoert" | "unbekannt";

export type SystemSignalInput = {
  /** Live socket state. `disconnected` only counts once a connection existed. */
  gatewayStatus: "disconnected" | "connecting" | "connected";
  /** False during the very first connect, so a cold start is not an outage. */
  hasConnectedOnce: boolean;
  /** The agent roster finished loading; before that we know nothing. */
  agentsHydrated: boolean;
  agents: ReadonlyArray<{
    status: "idle" | "running" | "error";
    awaitingUserInput: boolean;
  }>;
  /** Store-level error, e.g. a failed roster load. */
  storeError?: string | null;
  /**
   * Cards explicitly flagged as needing a human. `null` means the board never
   * loaded — which is not the same as zero, and must not read as "nothing
   * waiting".
   */
  needsAttentionCount?: number | null;
  /** A task board or cron read that failed outright. */
  boardError?: string | null;
};

export type SystemSignalResult = {
  level: SystemSignal;
  /** Why, in one short German phrase, for tooltips and the 2D panel. */
  reason: string;
};

/**
 * Priority is strict: a room that is both broken and waiting is broken.
 * Anything else buries the urgent state under the merely pending one.
 */
export function deriveSystemSignal(input: SystemSignalInput): SystemSignalResult {
  const {
    gatewayStatus,
    hasConnectedOnce,
    agentsHydrated,
    agents,
    storeError,
    needsAttentionCount,
    boardError,
  } = input;

  // stoert — something is broken and wants a hand now.
  if (gatewayStatus === "disconnected" && hasConnectedOnce) {
    return { level: "stoert", reason: "Verbindung zum Gateway abgerissen" };
  }
  const failing = agents.filter((agent) => agent.status === "error").length;
  if (failing > 0) {
    return {
      level: "stoert",
      reason: failing === 1 ? "Ein Agent meldet einen Fehler" : `${failing} Agenten melden Fehler`,
    };
  }
  if (storeError) return { level: "stoert", reason: "Agentenliste konnte nicht geladen werden" };
  if (boardError) return { level: "stoert", reason: "Aufgabenboard konnte nicht gelesen werden" };

  // Below this line every branch needs to know the room is actually alive.
  const aliveProof =
    gatewayStatus === "connected" && agentsHydrated && agents.length > 0;
  if (!aliveProof) {
    return {
      level: "unbekannt",
      reason:
        gatewayStatus === "connecting"
          ? "Verbindung wird aufgebaut"
          : "Noch kein Lebenszeichen vom System",
    };
  }

  // wartet — the bottleneck is you.
  const awaiting = agents.filter((agent) => agent.awaitingUserInput).length;
  if (awaiting > 0) {
    return {
      level: "wartet",
      reason: awaiting === 1 ? "Ein Agent wartet auf dich" : `${awaiting} Agenten warten auf dich`,
    };
  }
  if (typeof needsAttentionCount === "number" && needsAttentionCount > 0) {
    return {
      level: "wartet",
      reason:
        needsAttentionCount === 1
          ? "Eine Aufgabe braucht deine Freigabe"
          : `${needsAttentionCount} Aufgaben brauchen deine Freigabe`,
    };
  }

  const working = agents.filter((agent) => agent.status === "running").length;
  return {
    level: "ruhig",
    reason: working > 0 ? `${working} in Arbeit, nichts blockiert` : "Alles ruhig",
  };
}

/** Palette for the room. Calm keeps today's look; the other states depart from it. */
export const SIGNAL_TINT: Record<SystemSignal, { sky: string; ground: string; intensity: number }> = {
  // Unchanged from the room's designed lighting — calm must not look "special".
  ruhig: { sky: "#475569", ground: "#090d16", intensity: 0.38 },
  // Amber reads as "your turn" without the alarm of red.
  wartet: { sky: "#7c6234", ground: "#140f06", intensity: 0.46 },
  // Deep red, and brighter, so it carries in peripheral vision.
  stoert: { sky: "#7f2231", ground: "#170509", intensity: 0.58 },
  // Deliberately dimmer and greyer than calm: absence of knowledge should
  // feel like absence, never like reassurance.
  unbekannt: { sky: "#3a4048", ground: "#080a0e", intensity: 0.3 },
};

/**
 * How long a state must hold before a calmer one may replace it.
 *
 * Escalation is immediate — a fault should show the instant it happens. Coming
 * back down waits, because a run that fails and retries twice would otherwise
 * strobe the whole room between red and calm.
 */
export const SIGNAL_MIN_HOLD_MS = 4000;

/** Ranked so the smoother can tell an escalation from a recovery. */
export const SIGNAL_RANK: Record<SystemSignal, number> = {
  ruhig: 0,
  unbekannt: 1,
  wartet: 2,
  stoert: 3,
};
