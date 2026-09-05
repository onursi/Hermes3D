"use client";

import { useEffect, useState } from "react";

/** Mirrors /api/v2/roster. */
export type RosterAgent = {
  id: string;
  name: string;
  model: string | null;
  provider: string | null;
  role: string | null;
  isDefault: boolean;
  skillCount: number | null;
};

export type RosterState = {
  agents: RosterAgent[];
  /** False means Hermes could not be asked — not "there are no agents". */
  reachable: boolean;
  loading: boolean;
  error: string | null;
};

/**
 * The roster, fetched once.
 *
 * Profiles change when the operator creates or deletes one, which is not
 * something to poll for. V1 polled several endpoints on timers and spent a
 * measurable part of its frame budget on answers that had not changed.
 *
 * Reachability is carried separately from emptiness on purpose. "No agents"
 * and "could not ask" look identical in an empty array and mean opposite
 * things — the room has to be able to say which one it is.
 */
export function useRoster(): RosterState {
  const [state, setState] = useState<RosterState>({
    agents: [],
    reachable: true,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v2/roster")
      .then((response) => response.json())
      .then((data: { agents?: RosterAgent[]; reachable?: boolean; error?: string }) => {
        if (cancelled) return;
        setState({
          agents: data.agents ?? [],
          reachable: data.reachable !== false,
          loading: false,
          error: data.error ?? null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          agents: [],
          reachable: false,
          loading: false,
          error: error instanceof Error ? error.message : "Roster nicht abrufbar",
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
