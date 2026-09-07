"use client";

import { useEffect, useState } from "react";

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
  ids: Set<string>;
  loading: boolean;
  searched: number;
};

const EMPTY: ContentSearchState = { hits: [], ids: new Set(), loading: false, searched: 0 };
const SETTLE_MS = 220;

export function useContentSearch(query: string, limit = 20): ContentSearchState {
  const [state, setState] = useState<ContentSearchState & { forQuery: string }>({
    ...EMPTY,
    forQuery: "",
  });

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2) return;

    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setState((prev) => ({ ...prev, loading: true, forQuery: needle }));
      fetch(`/api/jarvis/search?q=${encodeURIComponent(needle)}&limit=${limit}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((payload) => {
          if (cancelled || !payload?.ok) return;
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
          if (!cancelled) setState((prev) => ({ ...prev, loading: false }));
        });
    }, SETTLE_MS);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, limit]);

  return state;
}
