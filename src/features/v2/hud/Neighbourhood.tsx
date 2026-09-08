"use client";

import {PanelWindow} from "./PanelWindow";
import { useMemo, useState } from "react";

import { linksAmong, neighboursOf } from "@/features/v2/graph";
import { AREA_COLORS, AREA_FALLBACK, SELECTION_COLOR } from "@/features/v2/palette";
import type { VaultLink, VaultNode } from "@/features/v2/useVault";

/**
 * The neighbourhood, flat — because in space it cannot be read.
 *
 * This is not a smaller copy of the knowledge world. It answers a question the
 * 3D view is structurally unable to answer, and the reason is geometry rather
 * than craft: with 1,132 edges in a volume, two points either overlap or hide
 * behind one another, and a line between them looks exactly like a line
 * passing behind them. No amount of dimming fixes that. On a plane, "these
 * three neighbours also reference each other" is simply visible.
 *
 * So the division of labour is real work on both sides. The room answers
 * *where am I and what is there*: areas, size, distance, the journey. This
 * answers *what hangs on what*, and it is the half he actually works in.
 *
 * Everything drawn here is a link the vault records. Nothing is inferred from
 * similarity, folders or timing — V6-05 forbids exactly that, and an invented
 * edge in a view this legible would be believed.
 */

/** Beyond this the ring gets crowded and the names collide. */
const MAX_NEIGHBOURS = 16;

/** SVG units. The viewBox is square and scales to whatever width it gets. */
const VIEW = 200;
const RING = 66;

export function Neighbourhood({
  node,
  links,
  byId,
  onSelect,
  onRead,
  onClose,
}: {
  /** The note at the centre. Null closes the panel. */
  node: VaultNode | null;
  links: VaultLink[];
  byId: Map<string, VaultNode>;
  /** Re-centres the view on a neighbour. */
  onSelect: (id: string) => void;
  /** Opens the reader for a note. */
  onRead: (id: string) => void;
  onClose: () => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const view = useMemo(() => {
    if (!node) return null;

    const all = neighboursOf(node.id, links, byId);
    const shown = all.slice(0, MAX_NEIGHBOURS);

    /**
     * Grouped by area before being placed on the ring.
     *
     * Sorting by folder means neighbours from the same area end up adjacent,
     * which does two things at once: the arc of one colour is itself a fact
     * ("most of what this note touches is in Projekte"), and links between
     * those neighbours become short chords instead of lines across the middle.
     */
     const ordered = [...shown].sort((a, b) => {
      const byFolder = a.folder.localeCompare(b.folder, "de");
      return byFolder !== 0 ? byFolder : b.degree - a.degree;
    });

    const placed = ordered.map((neighbour, index) => {
      // Start at the top and go clockwise. -90° so the first one is at 12
      // o'clock rather than at 3, which is where the eye starts reading.
      const angle = (index / Math.max(1, ordered.length)) * Math.PI * 2 - Math.PI / 2;
      return {
        node: neighbour,
        x: VIEW / 2 + Math.cos(angle) * RING,
        y: VIEW / 2 + Math.sin(angle) * RING,
        angle,
      };
    });

    const positions = new Map(placed.map((entry) => [entry.node.id, entry]));
    const ids = new Set(placed.map((entry) => entry.node.id));
    // Links among the neighbours themselves — the part worth drawing flat.
    const chords = linksAmong(ids, links).filter(
      ([a, b]) => positions.has(a) && positions.has(b),
    );

    return { placed, positions, chords, total: all.length, hidden: all.length - shown.length };
  }, [node, links, byId]);

  if (!node || !view) return null;

  const centre = VIEW / 2;

  return (
    <PanelWindow key={node.id} title="Vernetzung" slot="graph" onClose={onClose}><section
      className="pointer-events-auto absolute bottom-20 left-4 z-30 w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-[#0a1018]/95 shadow-[0_18px_60px_rgba(0,0,0,.6)] backdrop-blur-md"
      aria-label={`Nachbarschaft von ${node.name}`}
    >
      <header className="flex items-start justify-between gap-3 border-b border-white/8 px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">
            Nachbarschaft
          </p>
          <p className="mt-0.5 truncate text-[13px] text-white/85">{node.name}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 transition-colors hover:bg-white/6 hover:text-white/80"
        >
          Schließen
        </button>
      </header>

      {view.total === 0 ? (
        <p className="px-4 py-6 text-[12px] leading-relaxed text-white/45">
          Diese Notiz ist mit keiner anderen verlinkt. Das heißt nicht, dass sie
          allein steht — nur, dass der Vault keine Verbindung verzeichnet.
        </p>
      ) : (
        <>
          {/* Fest begrenzt statt volle Panelbreite: als Quadrat mit 380px
              schob das Netz den Rest des Panels aus dem Bild. */}
          <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="mx-auto w-[248px]" role="img">
            {/* Links between neighbours. Drawn first, so nodes sit on top. */}
            {view.chords.map(([a, b]) => {
              const from = view.positions.get(a);
              const to = view.positions.get(b);
              if (!from || !to) return null;
              return (
                <line
                  key={`${a}|${b}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#bca7ef"
                  strokeWidth={0.6}
                  opacity={0.45}
                />
              );
            })}

            {/* Spokes from the centre. Every one of these is a real link. */}
            {view.placed.map((entry) => (
              <line
                key={`spoke-${entry.node.id}`}
                x1={centre}
                y1={centre}
                x2={entry.x}
                y2={entry.y}
                stroke={hovered === entry.node.id ? "#f1e8ff" : "#cbb5ff"}
                strokeWidth={hovered === entry.node.id ? 1.4 : 0.8}
                opacity={hovered === entry.node.id ? 1 : 0.65}
              />
            ))}

            {view.placed.map((entry) => {
              const colour = AREA_COLORS[entry.node.folder] ?? AREA_FALLBACK;
              const active = hovered === entry.node.id;
              return (
                <g
                  key={entry.node.id}
                  onMouseEnter={() => setHovered(entry.node.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onSelect(entry.node.id)}
                  onDoubleClick={() => onRead(entry.node.id)}
                  className="cursor-pointer"
                >
                  {/* A generous invisible target. The dot is 3 units across;
                      asking anyone to hit that with a mouse is a design that
                      only works for the person who wrote it. */}
                  <circle cx={entry.x} cy={entry.y} r={9} fill="transparent" />
                  <circle
                    cx={entry.x}
                    cy={entry.y}
                    r={active ? 4.4 : 3.2}
                    fill={colour}
                    stroke={active ? SELECTION_COLOR : "transparent"}
                    strokeWidth={1.1}
                  />
                </g>
              );
            })}

            {/* The centre, last and largest. */}
            <circle cx={centre} cy={centre} r={9} fill="#0a1018" />
            <circle
              cx={centre}
              cy={centre}
              r={6.5}
              fill={AREA_COLORS[node.folder] ?? AREA_FALLBACK}
              stroke={SELECTION_COLOR}
              strokeWidth={1.4}
            />
          </svg>

          {/* The name of whatever the pointer is on. One line, always in the
              same place — labels on every dot would need a font size nobody
              can read at this size. */}
          <p className="min-h-[2.4rem] border-t border-white/8 px-4 py-2 text-[12px] leading-snug text-white/70">
            {hovered ? (
              <>
                {byId.get(hovered)?.name}
                <span className="ml-2 font-mono text-[10px] text-white/30">
                  Klick wählt · Doppelklick liest
                </span>
              </>
            ) : (
              <span className="text-white/35">
                {view.total} belegte {view.total === 1 ? "Verbindung" : "Verbindungen"}
                {view.hidden > 0 ? ` · ${view.hidden} nicht gezeigt` : ""}
                {view.chords.length > 0
                  ? ` · ${view.chords.length} untereinander`
                  : " · keine untereinander"}
              </span>
            )}
          </p>
        </>
      )}

      <footer className="border-t border-white/8 px-4 py-2">
        <p className="font-mono text-[9px] leading-relaxed text-white/25">
          Jede Linie ist ein Link aus dem Vault. Reihenfolge auf dem Ring: nach
          Ordner. Größe sagt nichts über Wichtigkeit.
        </p>
      </footer>
    </section></PanelWindow>
  );
}
