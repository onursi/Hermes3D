"use client";

import { useState } from "react";

import { AREA_COLORS, AREA_FALLBACK, SELECTION_COLOR } from "@/features/v2/palette";

/**
 * Die Areale, aufgelistet — einklappbar, wie im alten Gehirn.
 *
 * Der Wissenskörper zeigt zehn Bereiche, und im Raum kann man sie sehen, aber
 * nicht *überblicken*: Namen überlagern sich, Zahlen stehen klein, und was
 * hinten liegt, ist verdeckt. Eine Liste beantwortet in einem Blick, was der
 * Raum nur nacheinander beantwortet — wie viel wo liegt.
 *
 * Ein Klick fliegt hin. Das ist der eigentliche Zweck: die Liste ist kein
 * Beipackzettel, sondern die zweite Art, sich im Körper zu bewegen.
 *
 * Die Legende steht darunter und ist nicht optional. V6-05 verlangt, dass die
 * Kennzahl benannt wird: Größe heißt Notizanzahl und sonst nichts. Ohne den
 * Satz liest jeder etwas anderes hinein — Wichtigkeit, Fortschritt, Qualität.
 */

export type AreaEntry = {
  id: string;
  label: string;
  count: number;
  center: [number, number, number];
  radius: number;
};

export function AreaPanel({
  areas,
  activeId,
  flying,
  onToggleFlight,
  onFocus,
}: {
  areas: AreaEntry[];
  /** Das Areal der aktuellen Auswahl, falls es eine gibt. */
  activeId: string | null;
  /** Ob gerade durch den Koerper geflogen wird statt ihn zu umkreisen. */
  flying: boolean;
  onToggleFlight: () => void;
  onFocus: (area: AreaEntry) => void;
}) {
  const [open, setOpen] = useState(true);

  const total = areas.reduce((sum, area) => sum + area.count, 0);

  return (
    <section className="pointer-events-auto absolute right-4 bottom-20 z-30 w-[260px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#0a1018]/95 backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-white/5"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
          Areale · {areas.length}
        </span>
        <span className="font-mono text-[10px] text-white/35">{open ? "▾" : "▸"}</span>
      </button>

      {open ? (
        <>
          <ul className="max-h-[46vh] overflow-y-auto border-t border-white/8">
            {areas.map((area) => {
              const active = area.id === activeId;
              const colour = AREA_COLORS[area.id] ?? AREA_FALLBACK;
              // Anteil am Ganzen als Balken. Dieselbe Zahl wie rechts, nur so,
              // dass man sie nicht lesen muss, um sie zu vergleichen.
              const share = total > 0 ? area.count / total : 0;
              return (
                <li key={area.id}>
                  <button
                    type="button"
                    onClick={() => onFocus(area)}
                    className={`flex w-full items-center gap-2.5 px-4 py-1.5 text-left transition-colors hover:bg-white/6 ${
                      active ? "bg-white/8" : ""
                    }`}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: active ? SELECTION_COLOR : colour }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-white/75">{area.label}</span>
                      <span className="mt-0.5 block h-[2px] w-full rounded-full bg-white/8">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.max(2, share * 100)}%`,
                            backgroundColor: active ? SELECTION_COLOR : colour,
                            opacity: 0.7,
                          }}
                        />
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-white/40">
                      {area.count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Zwei Arten, sich im Koerper zu bewegen. Umkreisen ist der
              Ueberblick von aussen; Durchfliegen laesst ihn hineingehen —
              zwischen den Arealen hindurch, statt davor stehenzubleiben. */}
          <button
            type="button"
            onClick={onToggleFlight}
            className={`flex w-full items-center justify-between border-t border-white/8 px-4 py-2.5 text-left transition-colors hover:bg-white/6 ${
              flying ? "bg-cyan-400/10" : ""
            }`}
          >
            <span
              className="font-mono text-[10px] uppercase tracking-[0.16em]"
              style={{ color: flying ? SELECTION_COLOR : "rgba(255,255,255,0.5)" }}
            >
              {flying ? "Durchfliegen an" : "Durchfliegen"}
            </span>
            <span className="font-mono text-[9px] text-white/30">
              {flying ? "W A S D · Ziehen" : "hinein statt davor"}
            </span>
          </button>

          <p className="border-t border-white/8 px-4 py-2 font-mono text-[9px] leading-relaxed text-white/25">
            Klick fliegt hin. Größe und Balken zeigen die Notizanzahl — nicht
            Wichtigkeit, nicht Fortschritt.
          </p>
        </>
      ) : null}
    </section>
  );
}
