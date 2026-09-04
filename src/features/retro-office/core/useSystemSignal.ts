"use client";

import { useEffect, useRef, useState } from "react";

import {
  deriveSystemSignal,
  SIGNAL_MIN_HOLD_MS,
  SIGNAL_RANK,
  type SystemSignalInput,
  type SystemSignalResult,
} from "@/features/retro-office/core/systemSignal";

/**
 * `deriveSystemSignal` with the flicker taken out.
 *
 * The raw signal follows runtime events exactly, which is right for a number
 * and wrong for a room: a run that fails and retries twice would strobe the
 * whole floor between red and calm inside a second. Escalations still land
 * immediately — a fault has to show the moment it happens — but calming down
 * has to hold for a beat first.
 */
export function useSystemSignal(input: SystemSignalInput): SystemSignalResult {
  const raw = deriveSystemSignal(input);
  const [shown, setShown] = useState<SystemSignalResult>(raw);
  const changedAtRef = useRef(0);

  // The derived result is a fresh object every render, so the effect depends on
  // its two primitive fields instead — otherwise it would re-run forever.
  const rawLevel = raw.level;
  const rawReason = raw.reason;

  useEffect(() => {
    setShown((current) => {
      if (rawLevel === current.level) {
        // Same level, possibly a new reason — swap the text without restarting
        // the hold, so the room never sits on a stale explanation.
        return rawReason === current.reason ? current : { level: rawLevel, reason: rawReason };
      }
      if (SIGNAL_RANK[rawLevel] > SIGNAL_RANK[current.level]) {
        changedAtRef.current = Date.now();
        return { level: rawLevel, reason: rawReason };
      }
      return current;
    });

    if (SIGNAL_RANK[rawLevel] >= SIGNAL_RANK[shown.level]) return;

    const waited = Date.now() - changedAtRef.current;
    const delay = Math.max(0, SIGNAL_MIN_HOLD_MS - waited);
    const timer = window.setTimeout(() => {
      changedAtRef.current = Date.now();
      setShown({ level: rawLevel, reason: rawReason });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [rawLevel, rawReason, shown.level]);

  return shown;
}
