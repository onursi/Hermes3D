"use client";

import { useState } from "react";

import { useV2 } from "@/features/v2/state";
import type { RosterAgent } from "@/features/v2/useRoster";
import type { VaultNode } from "@/features/v2/useVault";
import { providerTone } from "@/features/v2/world/HomeWorld";

/**
 * One inspector, opened by a selection, closed by Escape.
 *
 * The plan asks for exactly one context panel rather than the several
 * simultaneous bars V1 kept open, and for sharp 2D text rather than words in
 * 3D. This is that panel: it is the only place in V2 where prose lives.
 *
 * What it will not do is fill a gap with something plausible. A model Hermes
 * did not report reads "unbekannt", because a wrong model name is
 * indistinguishable from a right one until it matters.
 */

export function Inspector({
  agents,
  nodes,
  onOpenSource,
  onDiveToSource,
}: {
  agents: RosterAgent[];
  nodes: VaultNode[];
  /** Opens the note through the existing safe file route. */
  onOpenSource: (id: string) => void;
  /** Travels to the cosmos with this note selected. */
  onDiveToSource: (id: string) => void;
}) {
  const { selection, focus, setFocus, clearSelection, world } = useV2();

  // Escape is handled in exactly one place, in V2Screen. This panel used to
  // listen as well, and the two handlers disagreed: the capture-phase one
  // cleared the selection, and the bubble-phase one then read the *previous*
  // value from its own closure and did nothing. Escape closed the inspector
  // and then refused to go home — one key, two owners, a stale answer.

  if (selection.kind === "none") return null;

  return (
    <aside className="pointer-events-auto absolute right-4 top-16 z-30 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-[#0a1018]/95 shadow-[0_18px_60px_rgba(0,0,0,.6)] backdrop-blur-md">
      {selection.kind === "agent" ? (
        <AgentBody agent={agents.find((a) => a.id === selection.id)} />
      ) : null}

      {selection.kind === "source" ? (
        <SourceBody
          node={nodes.find((n) => n.id === selection.id)}
          id={selection.id}
          title={selection.title}
          world={world}
          onOpen={() => onOpenSource(selection.id)}
          onDive={() => onDiveToSource(selection.id)}
        />
      ) : null}

      <footer className="flex items-center justify-between border-t border-white/8 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setFocus(!focus)}
          className={`rounded-lg px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
            focus
              ? "bg-cyan-400/20 text-cyan-100"
              : "text-white/45 hover:bg-white/5 hover:text-white/75"
          }`}
        >
          {focus ? "Fokus an" : "Fokus"}
        </button>
        <button
          type="button"
          onClick={clearSelection}
          className="rounded-lg px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/45 transition-colors hover:bg-white/5 hover:text-white/75"
        >
          Esc · schließen
        </button>
      </footer>
    </aside>
  );
}

function AgentBody({ agent }: { agent?: RosterAgent }) {
  if (!agent) {
    return <Empty text="Dieser Agent ist nicht mehr im Roster." />;
  }
  const tone = providerTone(agent.provider);
  return (
    <div className="px-4 pb-3 pt-4">
      <div className="flex items-start gap-3">
        <span
          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: tone }}
        />
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold text-white">{agent.name}</h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
            {agent.isDefault ? "Standardprofil" : "Spezialprofil"}
          </p>
        </div>
      </div>

      <dl className="mt-4 space-y-2">
        <Row label="Modell" value={agent.model} />
        <Row label="Anbieter" value={agent.provider} />
        <Row label="Skills" value={agent.skillCount === null ? null : String(agent.skillCount)} />
      </dl>

      {agent.role ? (
        <p className="mt-3 border-t border-white/8 pt-3 text-[13px] leading-relaxed text-white/60">
          {agent.role}
        </p>
      ) : null}

      {/* Honest about what is not built yet. The plan says the room stays
          truthful about single agents while Hermes builds the council. */}
      <p className="mt-3 font-mono text-[10px] leading-relaxed text-white/25">
        Gespräch mit einzelnen Agenten läuft über das bestehende HQ. Council
        noch nicht verbunden.
      </p>
    </div>
  );
}

function SourceBody({
  node,
  id,
  title,
  world,
  onOpen,
  onDive,
}: {
  node?: VaultNode;
  id: string;
  title: string;
  world: string;
  onOpen: () => void;
  onDive: () => void;
}) {
  const [opening, setOpening] = useState(false);
  return (
    <div className="px-4 pb-3 pt-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/55">
        Quelle
      </p>
      <h2 className="mt-1 text-[15px] font-semibold leading-snug text-white">
        {node?.name ?? title}
      </h2>
      <p className="mt-1 truncate font-mono text-[10px] text-white/30">{id}</p>

      {node ? (
        <dl className="mt-4 space-y-2">
          <Row label="Ordner" value={node.folder || null} />
          <Row label="Verbindungen" value={String(node.degree)} />
        </dl>
      ) : null}

      {node?.excerpt ? (
        <p className="mt-3 line-clamp-6 border-t border-white/8 pt-3 text-[13px] leading-relaxed text-white/55">
          {node.excerpt}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setOpening(true);
            onOpen();
            window.setTimeout(() => setOpening(false), 1200);
          }}
          className="flex-1 rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 text-[12px] font-medium text-cyan-100 transition-colors hover:bg-cyan-400/20"
        >
          {opening ? "Wird geöffnet…" : "Notiz öffnen"}
        </button>
        {world === "home" && node ? (
          <button
            type="button"
            onClick={onDive}
            className="rounded-lg border border-white/12 px-3 py-2 text-[12px] text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            Eintauchen
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">{label}</dt>
      <dd
        className={`truncate text-right text-[13px] ${value ? "text-white/85" : "text-white/30 italic"}`}
      >
        {value ?? "unbekannt"}
      </dd>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-5 text-[13px] text-white/45">{text}</p>;
}
