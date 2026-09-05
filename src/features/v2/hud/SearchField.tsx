"use client";

import { useEffect, useMemo, useRef } from "react";

import type { VaultNode } from "@/features/v2/useVault";
import { matchesQuery } from "@/features/v2/world/CosmosWorld";

/**
 * Finding one note among 273.
 *
 * The cosmos was beautiful and unusable: a map with no way to ask it a
 * question. This is the question. It dims the misses rather than hiding them,
 * so the shape of the map survives the search and the hits are located *in*
 * it — which is the whole reason for having a map instead of a list.
 *
 * The list underneath is the fallback for the case the 3D view cannot serve:
 * a hit behind the camera. Clicking one selects it, and the ring in the
 * cosmos then says where it is.
 */

const MAX_RESULTS = 8;

export function SearchField({
  nodes,
  query,
  onQuery,
  onPick,
  selectedId,
}: {
  nodes: VaultNode[];
  query: string;
  onQuery: (value: string) => void;
  onPick: (node: VaultNode) => void;
  selectedId: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Slash focuses the field, the way every search field he already uses does.
   *
   * Never while he is typing somewhere else, and never as a second owner of
   * Escape — that key belongs to exactly one chain, in V2Screen, and this
   * component deliberately does not listen for it.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const needle = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!needle) return [];
    return nodes
      .filter((node) => matchesQuery(node, needle))
      // The best connected first: in a knowledge graph, degree is the closest
      // thing to relevance that is actually measured rather than guessed.
      .sort((a, b) => b.degree - a.degree);
  }, [nodes, needle]);

  return (
    <div className="pointer-events-auto absolute left-4 top-16 z-30 w-[300px] max-w-[calc(100vw-2rem)]">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0a1018]/92 px-3 py-2 backdrop-blur-md">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-white/30" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            // Escape inside the field clears and leaves the field. The global
            // chain deliberately ignores text inputs, so without this the one
            // place Escape is most expected would be the one place it did
            // nothing. It stops here rather than also running the chain.
            if (event.key !== "Escape") return;
            event.stopPropagation();
            if (query) onQuery("");
            else event.currentTarget.blur();
          }}
          placeholder="Notiz oder Ordner suchen  ·  /"
          className="w-full bg-transparent text-[13px] text-white/85 outline-none placeholder:text-white/25"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQuery("")}
            aria-label="Suche leeren"
            className="shrink-0 rounded-md px-1.5 font-mono text-[11px] text-white/35 hover:text-white/80"
          >
            ×
          </button>
        ) : null}
      </div>

      {needle ? (
        <div className="mt-1.5 overflow-hidden rounded-xl border border-white/10 bg-[#0a1018]/92 backdrop-blur-md">
          <p className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">
            {results.length === 0
              ? "kein Treffer"
              : `${results.length} ${results.length === 1 ? "Treffer" : "Treffer"}`}
          </p>
          {results.slice(0, MAX_RESULTS).map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => onPick(node)}
              className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left transition-colors hover:bg-white/6 ${
                node.id === selectedId ? "bg-cyan-400/10" : ""
              }`}
            >
              <span className="truncate text-[12.5px] text-white/80">{node.name}</span>
              <span className="shrink-0 font-mono text-[10px] text-white/25">{node.degree}</span>
            </button>
          ))}
          {results.length > MAX_RESULTS ? (
            <p className="px-3 py-1.5 font-mono text-[10px] text-white/25">
              … {results.length - MAX_RESULTS} weitere leuchten im Raum
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
