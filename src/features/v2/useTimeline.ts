"use client";

import { useEffect, useState } from "react";

/** Spiegelt /api/vault/timeline — was im Vault steht, sonst nichts. */
export type TimelineStation = {
  id: string;
  title: string;
  year: number;
  until: number | null;
  text: string;
  source: string;
  weight: number;
};

export type TimelineState = {
  stations: TimelineStation[];
  from: number | null;
  to: number | null;
  /** False heißt: der Ordner war nicht lesbar — nicht "kein Zeitstrahl". */
  reachable: boolean;
  loading: boolean;
};

/**
 * Onurs Zeitstrahl, gelesen.
 *
 * Bewusst so dünn wie useProjects: dieser Haken fügt nichts hinzu, was die
 * Route nicht berichtet hat. Es gibt hier keine Lebensphasen, keine
 * "Kindheit" und keine "Jugend" — die stünden in keiner Notiz, und eine
 * Einteilung, die ich mir ausdenke, wäre eine Aussage über sein Leben, die
 * er nie getroffen hat. Der Orbit ordnet nach Jahr, weil das Jahr dasteht.
 */
export function useTimeline(): TimelineState {
  const [state, setState] = useState<TimelineState>({
    stations: [],
    from: null,
    to: null,
    reachable: true,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/vault/timeline")
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        setState({
          stations: data.stations ?? [],
          from: data.from ?? null,
          to: data.to ?? null,
          reachable: data.reachable !== false,
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ stations: [], from: null, to: null, reachable: false, loading: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
