"use client";

import { useEffect, useState } from "react";

import type { V2World } from "@/features/v2/state";

/**
 * Was hier geht — sichtbar, statt in meinem Kopf.
 *
 * V2 kann eine Menge, die man nicht sieht: durch den Wissenskörper fliegen,
 * mit `/` suchen, mit Escape eine Stufe zurück, mit Enter einen Ort betreten,
 * mit H das Hyperlicht zünden. Ich hatte auf „keine Unordnung" optimiert und
 * bin bei „keine erkennbaren Angebote" gelandet — das ist derselbe Fehler wie
 * ein Raum ohne Türgriffe.
 *
 * Zwei Regeln halten die Leiste klein genug, um nicht selbst zur Unordnung zu
 * werden: **Sie zeigt nur die Handlungen dieser Welt**, nicht alle. Und sie
 * verschwindet, sobald man sie einmal weggeklickt hat — wer den Raum kennt,
 * braucht sie nicht mehr, und wer sie wieder will, holt sie über das
 * Fragezeichen zurück.
 */

type Hint = { key: string; what: string };

const HINTS: Record<V2World, Hint[]> = {
  home: [
    { key: "Klick", what: "Agent auswählen" },
    { key: "Zeigen", what: "Rolle und Geste" },
    { key: "Esc", what: "Auswahl schließen" },
  ],
  universe: [
    { key: "W A S D", what: "fliegen" },
    { key: "Ziehen", what: "umsehen" },
    { key: "Shift", what: "schneller" },
    { key: "H", what: "Hyperlicht" },
    { key: "Enter", what: "Ort betreten" },
  ],
  cosmos: [
    { key: "/", what: "suchen" },
    { key: "Klick", what: "Notiz wählen" },
    { key: "Durchfliegen", what: "hinein statt davor" },
    { key: "Esc", what: "Leser schließen" },
  ],
  projects: [
    { key: "Klick", what: "Projekt wählen" },
    { key: "Nochmal", what: "betreten" },
    { key: "Klick", what: "Notiz im Raum öffnen" },
    { key: "Esc", what: "eine Stufe zurück" },
  ],
  singularity: [
    { key: "Abstand", what: "Tage seit der letzten Änderung" },
    { key: "Größe", what: "Zahl der Notizen" },
    { key: "Reif", what: "offene Aufgaben" },
    { key: "Klick", what: "Projekt betreten" },
  ],
  library: [
    { key: "Klick", what: "Quelle wählen" },
    { key: "Esc", what: "zurück" },
  ],
};

const STORAGE_KEY = "hermes3d-v2-hints-hidden";

export function WorldHints({ world }: { world: V2World }) {
  /**
   * Beim ersten Laden sichtbar, danach so, wie er es zuletzt wollte.
   *
   * Gelesen wird nach dem Einhängen und nie beim Rendern: Der Server kennt
   * keinen Speicher, und ein Wert, den nur eine der beiden Seiten hat, bricht
   * den Baum — das ist V1 dreimal passiert.
   */
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      // Nach dem Einhängen setzen ist hier genau richtig und nicht der Fehler,
      // vor dem die Regel warnt: Der Wert kann erst existieren, wenn es ein
      // Fenster gibt, und der Server hat keins. Dasselbe Muster wie bei den
      // URL-Schaltern weiter oben in V2Screen.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // Ein Browser ohne Speicher zeigt die Hinweise. Das ist die harmlosere
      // Hälfte des Fehlers.
    }
  }, []);

  const remember = (value: boolean) => {
    setHidden(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      // Nicht speichern zu können ist kein Grund, nicht zu reagieren.
    }
  };

  const hints = HINTS[world] ?? [];
  if (hints.length === 0) return null;

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => remember(false)}
        aria-label="Steuerung einblenden"
        className="pointer-events-auto absolute bottom-5 left-5 z-30 h-7 w-7 rounded-full border border-white/15 bg-[#0a1018]/85 font-mono text-[11px] text-white/50 backdrop-blur-md transition-colors hover:text-white"
      >
        ?
      </button>
    );
  }

  return (
    <div className="pointer-events-auto absolute bottom-5 left-5 z-30 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl border border-white/10 bg-[#0a1018]/85 px-3 py-1.5 backdrop-blur-md">
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {hints.map((hint) => (
          <li key={hint.key + hint.what} className="flex items-center gap-1.5">
            <span className="rounded border border-white/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-white/70">
              {hint.key}
            </span>
            <span className="text-[11px] text-white/45">{hint.what}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => remember(true)}
        aria-label="Steuerung ausblenden"
        className="shrink-0 font-mono text-[11px] text-white/30 transition-colors hover:text-white/70"
      >
        ×
      </button>
    </div>
  );
}
