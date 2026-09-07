"use client";

import { useEffect, useRef } from "react";

import { readBeamAnchors } from "./beamAnchors";

export interface JarvisNeuralBeamProps {
  active: boolean;
  /** Der Nutzer trennt die Verbindung. */
  onDismiss?: () => void;
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
 * Der Strahl **läuft nicht mehr ab.** Nach dem Aufbau bleibt die Verbindung
 * stehen, bis sie getrennt wird — vorher verschwand sie nach 2,6 Sekunden,
 * und wer in der Zeit nicht hingesehen hatte, sah das Ergebnis nie. Solange
 * sie steht, tastet ein Scanband den Wissenskörper ab.
 *
 * Zum Scan eine Regel, die leicht zu übersehen ist: Er streicht über **echte
 * Notizen an ihren echten Stellen**, nicht über gewürfelte Punkte. Ein Scan
 * über erfundene Orte wäre wieder ein Bild, das überzeugt, bevor es stimmt —
 * nur eben in Bewegung, wo es noch schwerer auffällt.
 *
 * Und es läuft **kein React-State pro Bild**. Die alte Fassung rief 2,6
 * Sekunden lang sechzigmal pro Sekunde `setPulseProgress` und rechnete den
 * ganzen SVG-Baum neu, während die 3D-Szene lief. Jetzt schreibt eine Schleife
 * direkt auf die Attribute.
 */

/** Wie viele zitierte Notizen gleichzeitig angestrahlt werden. Mehr wird Matsch. */
const MAX_ZIELE = 5;
/** Datenpakete je Strahl. */
const PAKETE = 2;
/** Wie viele Tastfühler der Scan gleichzeitig zeigt. */
const MAX_FUEHLER = 9;
/** Ein Durchlauf des Scanbands, in Sekunden. */
const SCAN_DAUER = 3.2;
/** Wie nah eine Notiz am Band liegen muss, um anzusprechen. */
const TREFFER_ABSTAND = 34;

const AST_FARBEN = [
  "rgba(56, 189, 248, 0.9)",
  "rgba(232, 121, 249, 0.75)",
  "rgba(52, 211, 153, 0.75)",
  "rgba(251, 191, 36, 0.75)",
  "rgba(163, 230, 53, 0.7)",
];

/** Wie lange der Aufbau dauert, bevor die Verbindung einfach steht. */
const AUFBAU_S = 1.5;

export function JarvisNeuralBeam({ active, onDismiss, targetLabel }: JarvisNeuralBeamProps) {
  /**
   * Kein Zustand fuer die Phase.
   *
   * Ob gerade aufgebaut wird oder die Verbindung steht, haengt allein an der
   * Laufzeit der Zeichenschleife — und die kennt sie ohnehin. Ein React-State
   * dafuer waere ein zweiter Halter derselben Wahrheit, und er hat den Linter
   * zu Recht gestoert: setState im Effektkoerper loest Folgerenderings aus.
   *
   * Uebrig bleibt genau eine Frage, die React beantworten muss: zeichnen oder
   * nicht. Die steht im Prop.
   */

  /**
   * Die Beschriftung wandert ueber ein Ref in die Schleife.
   *
   * In die Abhaengigkeiten geschrieben wuerde jeder Weltwechsel die
   * Zeichenschleife neu starten — und damit die Laufzeit, an der die
   * Aufbauphase haengt. Der Hinweis spraenge dann zurueck auf „sucht".
   */
  const labelText = useRef(targetLabel);
  useEffect(() => {
    labelText.current = targetLabel;
  }, [targetLabel]);

  const kopfRef = useRef<SVGGElement>(null);
  const strahlRefs = useRef<(SVGLineElement | null)[]>([]);
  const kernRefs = useRef<(SVGLineElement | null)[]>([]);
  const paketRefs = useRef<(SVGCircleElement | null)[]>([]);
  const fuehlerRefs = useRef<(SVGLineElement | null)[]>([]);
  const funkeRefs = useRef<(SVGCircleElement | null)[]>([]);
  const bandRef = useRef<SVGLineElement>(null);
  const zielRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const hinweisRef = useRef<HTMLDivElement>(null);
  const leisteRef = useRef<HTMLDivElement>(null);
  const zaehlerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!active) return;

    let raf = 0;
    const start = performance.now();

    const zeichne = () => {
      const t = (performance.now() - start) / 1000;
      const { head, targets, sweep } = readBeamAnchors();
      const steht = t > AUFBAU_S;

      /**
       * Die Ehrlichkeitsregel.
       *
       * Ohne gemessenen Kopf oder ohne ein Ziel im Bild wird kein Strahl
       * gezeichnet. Stattdessen steht da, dass gerade gesucht wird — was
       * stimmt, solange die Antwort noch keine Quelle genannt hat.
       */
      const zeichenbar = head !== null && targets.length > 0;
      if (hinweisRef.current) {
        hinweisRef.current.hidden = zeichenbar;
        const text = steht ? (labelText.current ?? "KEINE QUELLE IM BILD") : "JARVIS SUCHT IM VAULT";
        if (hinweisRef.current.textContent !== text) hinweisRef.current.textContent = text;
      }
      if (leisteRef.current) leisteRef.current.hidden = !zeichenbar;
      if (kopfRef.current) kopfRef.current.setAttribute("opacity", head ? "1" : "0");

      if (head && kopfRef.current) {
        kopfRef.current.setAttribute("transform", `translate(${head.x} ${head.y})`);
      }

      // ---- Die Verbindungen zu den zitierten Notizen -----------------------

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

        /** Steht die Verbindung, fließt es ruhiger — sonst hetzt das Bild. */
        const tempo = steht ? 0.42 : 0.9;
        for (let p = 0; p < PAKETE; p++) {
          const paket = paketRefs.current[i * PAKETE + p];
          if (!paket) continue;
          const u = (t * tempo + p / PAKETE + i * 0.13) % 1;
          paket.setAttribute("cx", String(head.x + (ziel.x - head.x) * u));
          paket.setAttribute("cy", String(head.y + (ziel.y - head.y) * u));
          paket.setAttribute("r", String(stark ? 3.4 : 2.4));
          paket.setAttribute("fill", "#ffffff");
          paket.setAttribute("opacity", "0.95");
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

      // ---- Der Scandurchlauf ------------------------------------------------

      /**
       * Ein Band wandert durch den Bereich, in dem tatsächlich Notizen liegen —
       * nicht durch das ganze Fenster. Wo nichts ist, hat ein Scan nichts zu
       * suchen.
       */
      const band = bandRef.current;
      if (!zeichenbar || sweep.length === 0 || !head) {
        band?.setAttribute("opacity", "0");
        for (let i = 0; i < MAX_FUEHLER; i++) {
          fuehlerRefs.current[i]?.setAttribute("opacity", "0");
          funkeRefs.current[i]?.setAttribute("opacity", "0");
        }
        if (zaehlerRef.current && zaehlerRef.current.textContent !== "") {
          zaehlerRef.current.textContent = "";
        }
      } else {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const p of sweep) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }

        /** Hin und zurück statt Sprung zurück — ein Sprung sieht nach Fehler aus. */
        const phase = (t % SCAN_DAUER) / SCAN_DAUER;
        const hin = phase < 0.5 ? phase * 2 : 2 - phase * 2;
        const bandY = minY + (maxY - minY) * hin;

        if (band) {
          band.setAttribute("x1", String(minX - 30));
          band.setAttribute("x2", String(maxX + 30));
          band.setAttribute("y1", String(bandY));
          band.setAttribute("y2", String(bandY));
          band.setAttribute("opacity", "0.5");
        }

        /**
         * Was das Band gerade berührt, meldet sich kurz zurück.
         *
         * Die Fühler sind absichtlich dünn und namenlos: Sie zeigen, dass
         * getastet wird, und behaupten nicht, dass gelesen wurde. Beschriftet
         * werden nur die Notizen, die in der Antwort auch als Quelle stehen.
         */
        let benutzt = 0;
        let beruehrt = 0;
        for (const p of sweep) {
          const abstand = Math.abs(p.y - bandY);
          if (abstand > TREFFER_ABSTAND) continue;
          beruehrt++;
          if (benutzt >= MAX_FUEHLER) continue;
          const staerke = 1 - abstand / TREFFER_ABSTAND;
          const fuehler = fuehlerRefs.current[benutzt];
          const funke = funkeRefs.current[benutzt];
          if (fuehler) {
            fuehler.setAttribute("x1", String(head.x));
            fuehler.setAttribute("y1", String(head.y));
            fuehler.setAttribute("x2", String(p.x));
            fuehler.setAttribute("y2", String(p.y));
            fuehler.setAttribute("opacity", String(0.34 * staerke));
          }
          if (funke) {
            funke.setAttribute("cx", String(p.x));
            funke.setAttribute("cy", String(p.y));
            funke.setAttribute("r", String(1.6 + 3.4 * staerke));
            funke.setAttribute("opacity", String(0.85 * staerke));
          }
          benutzt++;
        }
        for (let i = benutzt; i < MAX_FUEHLER; i++) {
          fuehlerRefs.current[i]?.setAttribute("opacity", "0");
          funkeRefs.current[i]?.setAttribute("opacity", "0");
        }

        if (zaehlerRef.current) {
          const text = `${beruehrt} im Tastfeld · ${sweep.length} im Bild`;
          if (zaehlerRef.current.textContent !== text) zaehlerRef.current.textContent = text;
        }
      }

      raf = requestAnimationFrame(zeichne);
    };

    raf = requestAnimationFrame(zeichne);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <svg className="h-full w-full">
        <defs>
          <filter id="laser-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="glow" />
            <feComposite in="SourceGraphic" in2="glow" operator="over" />
          </filter>
          <linearGradient id="scan-band" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="50%" stopColor="#7dd3fc" stopOpacity="1" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Die Tastfühler liegen unter den Hauptstrahlen. */}
        {Array.from({ length: MAX_FUEHLER }, (_, i) => (
          <line
            key={`fuehler-${i}`}
            ref={(el) => {
              fuehlerRefs.current[i] = el;
            }}
            stroke="rgba(125, 211, 252, 0.85)"
            strokeWidth="0.9"
            opacity="0"
          />
        ))}
        {Array.from({ length: MAX_FUEHLER }, (_, i) => (
          <circle
            key={`funke-${i}`}
            ref={(el) => {
              funkeRefs.current[i] = el;
            }}
            fill="#bae6fd"
            opacity="0"
          />
        ))}

        <line ref={bandRef} stroke="url(#scan-band)" strokeWidth="1.6" opacity="0" />

        {Array.from({ length: MAX_ZIELE }, (_, i) => (
          <line
            key={`glow-${i}`}
            ref={(el) => {
              strahlRefs.current[i] = el;
            }}
            opacity="0"
          />
        ))}
        {Array.from({ length: MAX_ZIELE }, (_, i) => (
          <line
            key={`kern-${i}`}
            ref={(el) => {
              kernRefs.current[i] = el;
            }}
            opacity="0"
          />
        ))}
        {Array.from({ length: MAX_ZIELE * PAKETE }, (_, i) => (
          <circle
            key={`paket-${i}`}
            ref={(el) => {
              paketRefs.current[i] = el;
            }}
            opacity="0"
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
              style={{ animationDuration: i === 0 ? "1.6s" : "2.1s", animationDelay: `${i * 0.14}s` }}
            />
            <div
              className="absolute inset-3 animate-spin rounded-full border border-dashed border-cyan-300/50"
              style={{ animationDuration: "5s" }}
            />
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
        Die Leiste bleibt, solange die Verbindung steht. Sie ist der einzige
        Teil dieser Ebene, der Klicks annimmt — der Rest muss durchlassen,
        sonst ist der Raum darunter nicht mehr bedienbar.
      */}
      <div
        ref={leisteRef}
        hidden
        className="pointer-events-auto absolute left-1/2 top-5 flex -translate-x-1/2 items-center gap-3 rounded-full border border-cyan-500/40 bg-[#0a1018]/90 py-1 pl-3 pr-1 shadow-[0_0_18px_rgba(0,240,255,0.18)] backdrop-blur-md"
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_6px_#00f0ff]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-200">
          Verbunden
        </span>
        <span ref={zaehlerRef} className="font-mono text-[10px] text-cyan-200/50" />
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-200/70 transition hover:bg-white/10 hover:text-white"
          title="Verbindung trennen"
        >
          Trennen ✕
        </button>
      </div>

      {/*
        Solange nichts gemessen ist: sagen, was gerade passiert, statt einen
        Strahl auf einen Punkt zu zeichnen, an dem nichts liegt.
      */}
      <div
        ref={hinweisRef}
        className="absolute left-1/2 top-6 -translate-x-1/2 rounded border border-cyan-500/40 bg-[#0a1018]/90 px-2 py-0.5 font-mono text-[10px] tracking-wider text-cyan-300 backdrop-blur-md"
      />
    </div>
  );
}
