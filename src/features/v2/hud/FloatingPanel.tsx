"use client";

import { Minus, Square, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Ein Fenster, das aus dem Weg geht.
 *
 * Onurs Einwand war kurz und richtig: "ich hatte nicht die Möglichkeit, das
 * zu schließen, zu bewegen oder zu minimieren." Das Jarvis-Panel klebte in
 * der Mitte und verdeckte genau die Animation, die es erklären sollte.
 *
 * Das Panel darf großflächig sein — es trägt eine Antwort mit Quellen. Es
 * darf nur nicht **festgenagelt** sein. Drei Dinge reichen dafür: an der
 * Kopfleiste ziehen, auf eine Zeile einklappen, ganz schließen.
 *
 * Position und Zustand bleiben je Fenster gespeichert. Ein Fenster, das man
 * nach jedem Öffnen wieder an dieselbe Stelle schiebt, ist nur halb
 * verschiebbar.
 *
 * Bewegt wird per **transform auf dem Element**, nicht über React-State pro
 * Mausbewegung: sechzig Renderdurchläufe je Sekunde, um ein Fenster zu
 * ziehen, würden die Szene dahinter ausbremsen — und die soll man ja gerade
 * sehen können. Der State bekommt am Ende des Ziehens einmal Bescheid.
 */

type Props = {
  /** Zum Merken der Lage. Muss je Fenster eindeutig sein. */
  id: string;
  title: string;
  /** Kurzer Zusatz in der Kopfleiste, etwa der Zustand. */
  hint?: string;
  /** Startlage in Bildpunkten von links oben, falls nichts gespeichert ist. */
  initial: { x: number; y: number };
  width: number;
  onClose: () => void;
  children: React.ReactNode;
};

type Placement = { x: number; y: number; minimised: boolean };

function load(id: string, fallback: Placement): Placement {
  try {
    const raw = localStorage.getItem(`hermes.panel.${id}`);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as Partial<Placement>;
    return {
      x: typeof saved.x === "number" ? saved.x : fallback.x,
      y: typeof saved.y === "number" ? saved.y : fallback.y,
      minimised: Boolean(saved.minimised),
    };
  } catch {
    return fallback;
  }
}

export function FloatingPanel({ id, title, hint, initial, width, onClose, children }: Props) {
  const [place, setPlace] = useState<Placement>({ ...initial, minimised: false });
  const frameRef = useRef<HTMLDivElement>(null);
  /** Was beim Loslassen gespeichert wird. Während des Ziehens lebt es hier. */
  const dragRef = useRef<{ dx: number; dy: number; x: number; y: number } | null>(null);

  // Erst nach dem Einhängen gelesen: der Server kennt keinen localStorage, und
  // eine Lage, die beim Rendern gelesen wird, lässt Server und Browser
  // unterschiedliche Seiten erzeugen — danach aktualisiert die Seite nichts
  // mehr. Ein Bild später an der richtigen Stelle ist der bessere Handel.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlace(load(id, { ...initial, minimised: false }));
  }, [id, initial]);

  const save = useCallback(
    (next: Placement) => {
      setPlace(next);
      try {
        localStorage.setItem(`hermes.panel.${id}`, JSON.stringify(next));
      } catch {}
    },
    [id],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      // Nur die Kopfleiste zieht, und Knöpfe darin ziehen nicht.
      if ((event.target as HTMLElement).closest("button")) return;
      const frame = frameRef.current;
      if (!frame) return;
      event.preventDefault();
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      dragRef.current = {
        dx: event.clientX - place.x,
        dy: event.clientY - place.y,
        x: place.x,
        y: place.y,
      };
    },
    [place.x, place.y],
  );

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    const drag = dragRef.current;
    const frame = frameRef.current;
    if (!drag || !frame) return;
    // In den Sichtbereich gezwungen: ein Fenster, das man hinter den Rand
    // schiebt, ist verloren — es gibt keine Fensterleiste, die es zurückholt.
    const x = Math.min(Math.max(event.clientX - drag.dx, 8), window.innerWidth - 80);
    const y = Math.min(Math.max(event.clientY - drag.dy, 8), window.innerHeight - 44);
    drag.x = x;
    drag.y = y;
    frame.style.transform = `translate(${x}px, ${y}px)`;
  }, []);

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
      if (drag) save({ x: drag.x, y: drag.y, minimised: place.minimised });
    },
    [place.minimised, save],
  );

  return (
    <div
      ref={frameRef}
      className="pointer-events-auto fixed left-0 top-0 z-40 rounded-2xl border border-white/10 bg-[#0a1018]/55 shadow-[0_18px_60px_rgba(0,0,0,.5)] backdrop-blur-sm"
      style={{
        transform: `translate(${place.x}px, ${place.y}px)`,
        width: place.minimised ? 280 : width,
      }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="flex cursor-grab items-center gap-2 rounded-t-2xl border-b border-white/[0.07] px-3 py-2 active:cursor-grabbing"
      >
        <span className="text-[11px] font-semibold tracking-[-0.005em] text-white/70">{title}</span>
        {hint ? <span className="truncate text-[10px] text-white/30">{hint}</span> : null}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => save({ ...place, minimised: !place.minimised })}
          className="rounded-md p-1 text-white/40 transition hover:bg-white/10 hover:text-white/90"
          title={place.minimised ? "Wieder aufklappen" : "Auf eine Zeile einklappen"}
        >
          {place.minimised ? <Square size={11} /> : <Minus size={11} />}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-white/40 transition hover:bg-white/10 hover:text-white/90"
          title="Schließen"
        >
          <X size={12} />
        </button>
      </div>

      {/* Eingeklappt bleibt das Fenster im DOM, nur unsichtbar: so gehen weder
          die Antwort noch die Bildlaufposition verloren, wenn er kurz die
          Animation sehen will. */}
      <div hidden={place.minimised} className="flex max-h-[70vh] flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
