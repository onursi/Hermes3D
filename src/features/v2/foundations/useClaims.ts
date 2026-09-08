"use client";

import { useEffect, useState } from "react";

import type { Claim, ClaimResult } from "./claims";

/**
 * Holt, was den Kern gerade beansprucht.
 *
 * Einmal beim Betreten und danach im ruhigen Takt. Nicht schneller: Ansprüche
 * ändern sich in Minuten, nicht in Sekunden, und jede Abfrage geht bis zu
 * Todoist durch.
 *
 * `sources` wird mitgeführt, weil der Kern „nicht verbunden" anders anzeigen
 * muss als „nichts liegt an". Ein leeres Ergebnis ohne diese Unterscheidung
 * wäre eine Behauptung.
 */
export function useClaims(aktivMs = 90_000): {
  claims: Claim[];
  sources: ClaimResult["sources"];
  loading: boolean;
} {
  const [state, setState] = useState<{ claims: Claim[]; sources: ClaimResult["sources"]; loading: boolean }>({
    claims: [],
    sources: {},
    loading: true,
  });

  useEffect(() => {
    let abgebrochen = false;
    const controller = new AbortController();

    const laden = () => {
      fetch("/api/claims", { signal: controller.signal, cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((payload: (ClaimResult & { ok?: boolean }) | null) => {
          if (abgebrochen || !payload?.ok) return;
          setState({ claims: payload.claims ?? [], sources: payload.sources ?? {}, loading: false });
        })
        .catch(() => {
          // Abgebrochen oder nicht erreichbar. Der letzte bekannte Stand bleibt
          // stehen — er ist ehrlicher als eine plötzliche Null.
          if (!abgebrochen) setState((vorher) => ({ ...vorher, loading: false }));
        });
    };

    laden();
    const timer = window.setInterval(laden, aktivMs);
    return () => {
      abgebrochen = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [aktivMs]);

  return state;
}
