"use client";

import { CornerDownLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { JarvisPhase } from "@/features/jarvis/JarvisCore";
import { JarvisPresence, type JarvisMode } from "@/features/v2/jarvis/JarvisPresence";
import { jarvisLevel } from "@/features/v2/jarvis/useJarvisVoice";
import { JARVIS_SCAN_EVENT } from "@/features/v2/knowledge/BrainAccess";

/**
 * Jarvis, immer da, und trotzdem fast nicht da.
 *
 * Der große Kasten in der Mitte war die falsche Antwort auf eine richtige
 * Frage. Onur will Jarvis überall erreichen können — aber er will vor allem
 * seinen Raum sehen. Also steht hier unten rechts nur ein flimmerndes Licht:
 * ein Zustand, kein Fenster. Es sagt im Vorbeigehen, ob gerade gesucht,
 * gedacht oder gesprochen wird, und kostet dafür 44 Bildpunkte.
 *
 * Ein Klick klappt genau so viel auf, wie zum Fragen nötig ist: ein Feld,
 * eine Zeile, der Umschalter zwischen Kugel und Gesicht. Die **Antwort**
 * erscheint nicht hier, sondern im verschiebbaren Panel — deshalb bleibt
 * dieses Ding klein, egal wie lang die Antwort wird.
 *
 * Nicht zuhause: dort ist der Kern in der Mitte des Decks schon Hermes, und
 * ein zweites Licht in der Ecke wäre derselbe Agent an zwei Stellen.
 */

type Props = {
  phase: JarvisPhase;
  mode: JarvisMode;
  onModeChange: (mode: JarvisMode) => void;
  /** Fragen. Öffnet zugleich das Antwortfenster. */
  onAsk: (question: string) => void;
  /** Das große Fenster zeigen, ohne zu fragen. */
  onOpenPanel: () => void;
  busy: boolean;
};

export function JarvisOrb({ phase, mode, onModeChange, onAsk, onOpenPanel, busy }: Props) {
  const [open, setOpen] = useState(false);
  /**
   * Ob der Raum gerade sucht.
   *
   * Die Kugel hört auf **dasselbe Ereignis** wie der Effekt im Kosmos. Vorher
   * hing ihr Zustand allein am Fenster — und wenn das geschlossen war, stand
   * bereit an der Kugel, während der Raum in vollem Gange abtastete. Zwei
   * Anzeigen für einen Vorgang, die sich widersprechen können, sind schlimmer
   * als eine.
   */
  const [scanning, setScanning] = useState(false);
  useEffect(() => {
    const onScan = (event: Event) =>
      setScanning(Boolean((event as CustomEvent).detail?.active));
    window.addEventListener(JARVIS_SCAN_EVENT, onScan);
    return () => window.removeEventListener(JARVIS_SCAN_EVENT, onScan);
  }, []);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = useCallback(() => {
    const question = text.trim();
    if (!question || busy) return;
    onAsk(question);
    setText("");
    setOpen(false);
  }, [busy, onAsk, text]);

  return (
    <div className="pointer-events-auto absolute bottom-24 right-6 z-30 flex flex-col items-end gap-2">
      {open ? (
        <div className="w-[300px] rounded-2xl border border-white/10 bg-[#0a1018]/60 p-2 shadow-[0_14px_40px_rgba(0,0,0,.55)] backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.09] bg-black/40 px-2.5 py-1.5">
            <input
              ref={inputRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                // Angehalten, damit die Tastenkürzel des Raums nicht mitlesen —
                // die Leertaste gehört hier ins Feld und nicht an die Kamera.
                event.stopPropagation();
                if (event.key === "Enter") submit();
                if (event.key === "Escape") setOpen(false);
              }}
              placeholder="Frag mich etwas…"
              className="min-w-0 flex-1 bg-transparent text-[12px] text-white/90 outline-none placeholder:text-white/25"
            />
            <button
              type="button"
              onClick={submit}
              disabled={busy || !text.trim()}
              className="shrink-0 text-white/45 transition hover:text-white disabled:opacity-25"
              title="Fragen"
            >
              <CornerDownLeft size={13} />
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-1">
            {(["orb", "face"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onModeChange(option)}
                className={`rounded-full px-2 py-0.5 text-[10px] transition ${
                  mode === option
                    ? "bg-cyan-400/15 text-cyan-100"
                    : "text-white/35 hover:text-white/70"
                }`}
              >
                {option === "orb" ? "Kugel" : "Gesicht"}
              </button>
            ))}
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => {
                onOpenPanel();
                setOpen(false);
              }}
              className="rounded-full px-2 py-0.5 text-[10px] text-white/35 transition hover:text-white/80"
              title="Das große Fenster mit Quellen, Merken und Aufgaben"
            >
              alles anzeigen
            </button>
          </div>
        </div>
      ) : null}

      {/**
       * Der Empfang.
       *
       * Onur hat dreimal gesagt, der Blitz müsse aus dem Kopf kommen — und
       * beim dritten Mal war er das rechnerisch längst: der Ansatzpunkt trifft
       * die Kopfmitte auf den Bildpunkt genau, nachgemessen. Trotzdem sah man
       * es nicht, und das ist kein Streit über Zahlen, sondern mein Fehler.
       * Der Punkt, an dem alles zusammenläuft, liegt in der 3D-Szene — also
       * **hinter** dieser Kugel, denn die ist ein DOM-Element und liegt oben
       * drauf. Was ankam, verschwand genau dort, wo man es sehen sollte.
       *
       * Deshalb leuchtet der Kopf jetzt selbst. Zwei Ringe, die nach außen
       * laufen, solange gesucht oder gesprochen wird — im DOM, über allem, und
       * damit unübersehbar. Sie hängen an derselben Phase wie der Effekt im
       * Raum; wenn nichts läuft, ist hier auch nichts.
       */}
      {busy || scanning || phase === "speaking" ? (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 right-0 h-14 w-14 animate-ping rounded-full bg-cyan-300/25"
            style={{ animationDuration: "1.1s" }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 right-0 h-14 w-14 rounded-full ring-2 ring-cyan-200/60"
          />
        </>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        className="relative rounded-full transition hover:scale-105"
        title={open ? "Zuklappen" : "Jarvis fragen"}
      >
        {/* Dieselbe Darstellung wie im großen Fenster, nur klein — und am
            selben Pegel. Zwei getrennte Zeichnungen desselben Zustands wären
            zwei Gelegenheiten, Verschiedenes zu behaupten. */}
        <JarvisPresence mode={mode} phase={phase} levelRef={jarvisLevel} size={56} compact />
      </button>
    </div>
  );
}
