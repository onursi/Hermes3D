"use client";

import { useEffect, useState } from "react";

/**
 * Die Suche, die auch in die Notizen schaut.
 *
 * Bisher verglich der Wissenskörper nur **Titel und Ordner**, und ich hatte
 * das im Code sogar begründet: „nicht den Auszug — Text zu durchsuchen, den er
 * nicht sieht, liefert Notizen, die er nicht erklären kann."
 *
 * Diese Begründung war für Onurs Nutzung falsch, und er hat es an einem Namen
 * gemerkt: „Pedro" steht im **Text** von zehn Notizen und im Titel von keiner.
 * Die Suche fand nichts und wirkte kaputt — zu Recht. Man sucht nach Menschen,
 * Begriffen und Entscheidungen, nicht nach Dateinamen.
 *
 * Gesucht wird deshalb über denselben Weg, den Jarvis längst benutzt: eine
 * Volltextsuche über den Vault, die auch sagt, *warum* etwas ein Treffer ist.
 * Eine Suche für beide — zwei Suchen über dieselben Notizen wären zwei
 * Gelegenheiten, unterschiedliche Antworten zu geben.
 *
 * Der Titelvergleich bleibt als sofortige Schicht darüber: Er antwortet ohne
 * Netzweg, während die Volltextsuche noch läuft. Wer tippt, will sehen, dass
 * etwas passiert.
 */

export type ContentHit = {
  id: string;
  title: string;
  folder: string;
  score: number;
  excerpt: string;
  matchedTerms: string[];
};

export type ContentSearchState = {
  hits: ContentHit[];
  /** Die Kennungen als Menge — der Raum fragt „ist das ein Treffer?". */
  ids: Set<string>;
  loading: boolean;
  /** Wie viele Notizen tatsächlich durchsucht wurden. Belegt, nicht behauptet. */
  searched: number;
};

const EMPTY: ContentSearchState = { hits: [], ids: new Set(), loading: false, searched: 0 };

/** Wie lange nach dem letzten Tastendruck gewartet wird. */
const SETTLE_MS = 220;

export function useContentSearch(query: string, limit = 20): ContentSearchState {
  /**
   * Das Ergebnis merkt sich, **zu welcher Frage** es gehört.
   *
   * Naheliegend wäre gewesen, den Zustand im Effekt zurückzusetzen, sobald das
   * Feld leer ist. Der Lint-Wächter verbietet das zu Recht: Ein Zustand, der im
   * Effekt synchron gesetzt wird, löst einen zweiten Renderdurchlauf aus — nur
   * um etwas zu vergessen. Beim Rendern abzuleiten kostet nichts und kann nicht
   * veralten: Ein Ergebnis zur vorigen Frage wird nie gezeigt.
   */
  const [state, setState] = useState<ContentSearchState & { forQuery: string }>({
    ...EMPTY,
    forQuery: "",
  });

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2) return;

    // Erst warten, dann fragen: Wer „Pedro" tippt, löst sonst fünf Anfragen
    // aus, von denen vier verworfen werden.
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setState({ ...EMPTY, loading: true, forQuery: needle });
      fetch(`/api/jarvis/search?q=${encodeURIComponent(needle)}&limit=${limit}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (cancelled) return;
          if(!payload?.ok) throw new Error("Search unavailable");
          const hits: ContentHit[] = payload.results ?? [];
          setState({
            hits,
            ids: new Set(hits.map((hit) => hit.id)),
            loading: false,
            searched: payload.searched ?? 0,
            forQuery: needle,
          });
        })
        .catch(() => {
          // Abgebrochen oder fehlgeschlagen. Ein leeres Ergebnis ist hier die
          // ehrliche Antwort — die Titelschicht darüber zeigt weiterhin, was
          // sie kennt.
          if (!cancelled) setState((previous) => ({ ...previous, loading: false }));
        });
    }, SETTLE_MS);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, limit]);

  return query.trim().length<2 || state.forQuery!==query.trim() ? EMPTY : state;
}
