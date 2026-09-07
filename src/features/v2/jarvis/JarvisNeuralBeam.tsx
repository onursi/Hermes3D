"use client";

import { useEffect, useRef, useState } from "react";

import { readBeamAnchors } from "./beamAnchors";

export interface JarvisNeuralBeamProps {
  active: boolean;
  onComplete?: () => void;
  /** Fällt zurück, solange noch keine Quelle gemeldet ist. */
  targetLabel?: string;
}

/**
 * Der Strahl von Jarvis' Kopf in die Notizen, die er tatsächlich liest.
 *
 * Vorher standen Start und Ziel fest im Code: `calc(100vw - 44px)` unten
 * rechts, `50% / 46%` in der Bildmitte, die Äste bei 35 %/36 % und 68 %/37 %.
 * Die Choreografie war gut, die Zahlen waren erfunden. Der Strahl traf die
 * Bildmitte — nicht das Gehirn, und schon gar nicht die Notiz, die gerade
 * gelesen wurde. Sobald die Kamera irgendwo anders stand, zeigte er auf nichts
 * und sah trotzdem überzeugend aus. Das ist die schlimmere Sorte Fehler.
 *
 * Jetzt kommen beide Enden aus einer Messung (siehe `beamAnchors.ts`):
 * Der Companion meldet die Bildschirmlage seines Kopfes, die Szene projiziert
 * die zitierten Notizen. Und wo nichts gemessen wurde, wird nichts gezeichnet.
 *
 * Zweite Änderung, unsichtbar aber spürbar: Es läuft **kein React-State pro
 * Bild** mehr. Die alte Fassung rief 2,6 Sekunden lang sechzigmal pro Sekunde
 * `setPulseProgress` und rechnete den ganzen SVG-Baum neu, während die 3D-Szene
 * lief. Jetzt schreibt eine Schleife direkt auf die Attribute. Der Zustand
 * (verbinden → scannen → übertragen) bleibt React — der wechselt dreimal, nicht
 * hundertsechzigmal.
 */

/** Wie viele Notizen gleichzeitig angestrahlt werden. Mehr wird Matsch. */
const MAX_ZIELE = 5;
/** Datenpakete je Strahl. */
const PAKETE = 2;

const AST_FARBEN = [
  "rgba(56, 189, 248, 0.9)",
  "rgba(232, 121, 249, 0.75)",
  "rgba(52, 211, 153, 0.75)",
  "rgba(251, 191, 36, 0.75)",
  "rgba(163, 230, 53, 0.7)",
];

export function JarvisNeuralBeam({ active, onComplete, targetLabel }: JarvisNeuralBeamProps) {
  const [stage, setStage] = useState<"idle" | "connecting" | "scanning" | "transferring">("idle");

  useEffect(() => {
    if (!active) {
      setStage("idle");
      return;
    }
    setStage("connecting");
    const t1 = setTimeout(() => setStage("scanning"), 400);
    const t2 = setTimeout(() => setStage("transferring"), 1400);
    const t3 = setTimeout(() => {
      setStage("idle");
      onComplete?.();
    }, 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [active, onComplete]);

  /**
   * Der Zustand wird gelesen, nicht abhängig gemacht.
   *
   * Die Zeichenschleife soll nicht bei jedem Zustandswechsel neu starten —
   * sonst reißt die Bewegung dreimal ab. Sie liest den aktuellen Wert aus dem
   * Ref und läuft durch.
   */
  const stageRef = useRef(stage);
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  const kopfRef = useRef<SVGGElement>(null);
  const strahlRefs = useRef<(SVGLineElement | null)[]>([]);
  const kernRefs = useRef<(SVGLineElement | null)[]>([]);
  const paketRefs = useRef<(SVGCircleElement | null)[]>([]);
  const zielRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const hinweisRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stage === "idle") return;

    let raf = 0;
    const start = performance.now();

    const zeichne = () => {
      const t = (performance.now() - start) / 1000;
      const { head, targets } = readBeamAnchors();
      const zurueck = stageRef.current === "transferring";

      /**
       * Die Ehrlichkeitsregel.
       *
       * Ohne gemessenen Kopf oder ohne ein Ziel im Bild wird kein Strahl
       * gezeichnet. Stattdessen steht da, dass gerade gesucht wird — was
       * stimmt, solange die Antwort noch keine Quelle genannt hat.
       */
      const zeichenbar = head !== null && targets.length > 0;
      if (hinweisRef.current) hinweisRef.current.hidden = zeichenbar;
      if (kopfRef.current) kopfRef.current.setAttribute("opacity", head ? "1" : "0");

      if (head && kopfRef.current) {
        kopfRef.current.setAttribute("transform", `translate(${head.x} ${head.y})`);
      }

      for (let i = 0; i < MAX_ZIELE; i++) {
        const ziel = zeichenbar ? targets[i] : undefined;
        const strahl = strahlRefs.current[i];
        const kern = kernRefs.current[i];
        const knoten = zielRefs.current[i];

        if (!ziel || !head) {
          strahl?.setAttribute("opacity", "0");
          kern?.setAttribute("opacity", "0");
          if (knoten) knoten.hidden = true;
          for (let p = 0; p < PAKETE; p++) {
            paketRefs.current[i * PAKETE + p]?.setAttribute("opacity", "0");
          }
          continue;
        }

        /** Der erste Treffer ist der Hauptstrahl, die übrigen sind Äste. */
        const stark = i === 0;

        for (const [el, breite, farbe] of [
          [strahl, stark ? 13 : 7, "rgba(0, 240, 255, 0.22)"],
          [kern, stark ? 2.6 : 1.6, AST_FARBEN[i % AST_FARBEN.length]],
        ] as const) {
          if (!el) continue;
          el.setAttribute("x1", String(head.x));
          el.setAttribute("y1", String(head.y));
          el.setAttribute("x2", String(ziel.x));
          el.setAttribute("y2", String(ziel.y));
          el.setAttribute("stroke-width", String(breite));
          el.setAttribute("stroke", farbe);
          el.setAttribute("opacity", stark ? "1" : "0.8");
          /**
           * Der Weichzeichner bleibt dem Hauptstrahl vorbehalten.
           *
           * Ein Gauss-Filter je Element ist mit Abstand der teuerste Teil der
           * Zeichnung — auf den duennen Aesten sieht man ihn kaum, kosten tut
           * er dort genauso viel.
           */
          if (stark) el.setAttribute("filter", "url(#laser-glow)");
          else el.removeAttribute("filter");
        }

        for (let p = 0; p < PAKETE; p++) {
          const paket = paketRefs.current[i * PAKETE + p];
          if (!paket) continue;
          const roh = (t * 0.85 + p / PAKETE + i * 0.13) % 1;
          const u = zurueck ? 1 - roh : roh;
          paket.setAttribute("cx", String(head.x + (ziel.x - head.x) * u));
          paket.setAttribute("cy", String(head.y + (ziel.y - head.y) * u));
          paket.setAttribute("r", String(zurueck ? 4 : 3));
          paket.setAttribute("fill", zurueck ? "#c084fc" : "#ffffff");
          paket.setAttribute("opacity", "1");
          if (stark) paket.setAttribute("filter", "url(#laser-glow)");
          else paket.removeAttribute("filter");
        }

        if (knoten) {
          knoten.hidden = false;
          knoten.style.transform = `translate(${ziel.x}px, ${ziel.y}px) translate(-50%, -50%)`;
          const label = labelRefs.current[i];
          if (label && label.textContent !== ziel.label) label.textContent = ziel.label;
        }
      }

      raf = requestAnimationFrame(zeichne);
    };

    raf = requestAnimationFrame(zeichne);
    return () => cancelAnimationFrame(raf);
  }, [stage]);

  if (stage === "idle") return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <svg className="h-full w-full">
        <defs>
          <filter id="laser-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="glow" />
            <feComposite in="SourceGraphic" in2="glow" operator="over" />
          </filter>
        </defs>

        {Array.from({ length: MAX_ZIELE }, (_, i) => (
          <line
            key={`glow-${i}`}
            ref={(el) => {
              strahlRefs.current[i] = el;
            }}
            opacity="0"
            filter="url(#laser-glow)"
          />
        ))}
        {Array.from({ length: MAX_ZIELE }, (_, i) => (
          <line
            key={`kern-${i}`}
            ref={(el) => {
              kernRefs.current[i] = el;
            }}
            opacity="0"
            filter="url(#laser-glow)"
          />
        ))}
        {Array.from({ length: MAX_ZIELE * PAKETE }, (_, i) => (
          <circle
            key={`paket-${i}`}
            ref={(el) => {
              paketRefs.current[i] = el;
            }}
            opacity="0"
            filter="url(#laser-glow)"
          />
        ))}

        {/* Der Austritt am Kopf — sitzt da, wo der Kopf gemessen wurde. */}
        <g ref={kopfRef} opacity="0">
          <circle r="16" fill="rgba(0,240,255,0.18)" filter="url(#laser-glow)" />
          <circle r="5" fill="#ffffff" filter="url(#laser-glow)" />
        </g>
      </svg>

      {/* Ein Ring je wirklich gelesener Notiz, an ihrer gemessenen Stelle. */}
      {Array.from({ length: MAX_ZIELE }, (_, i) => (
        <div
          key={`ziel-${i}`}
          ref={(el) => {
            zielRefs.current[i] = el;
          }}
          hidden
          className="absolute left-0 top-0 flex flex-col items-center"
        >
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div
              className="absolute inset-0 animate-ping rounded-full border border-cyan-400/70"
              style={{ animationDuration: i === 0 ? "1.1s" : "1.5s", animationDelay: `${i * 0.12}s` }}
            />
            <div className="absolute inset-3 animate-spin rounded-full border border-dashed border-cyan-300/50" style={{ animationDuration: "5s" }} />
            <div className="h-2.5 w-2.5 rounded-full bg-cyan-200 shadow-[0_0_10px_#00f0ff]" />
          </div>
          <span
            ref={(el) => {
              labelRefs.current[i] = el;
            }}
            className="max-w-[210px] truncate rounded border border-cyan-500/40 bg-[#0a1018]/90 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200 shadow-md backdrop-blur-md"
          />
        </div>
      ))}

      {/*
        Solange nichts gemessen ist: sagen, was gerade passiert, statt einen
        Strahl auf einen Punkt zu zeichnen, an dem nichts liegt.
      */}
      <div
        ref={hinweisRef}
        className="absolute left-1/2 top-6 -translate-x-1/2 rounded border border-cyan-500/40 bg-[#0a1018]/90 px-2 py-0.5 font-mono text-[10px] tracking-wider text-cyan-300 backdrop-blur-md"
      >
        {stage === "connecting" ? "JARVIS SUCHT IM VAULT" : targetLabel ?? "KEINE QUELLE IM BILD"}
      </div>
    </div>
  );
}
