"use client";

import { useEffect, useRef } from "react";

import { currentBrainLink } from "@/features/v2/jarvis/brainLink";
import { activeJarvisHead } from "@/features/v2/jarvis/jarvisAnchor";

/**
 * Der Strahl von Jarvis ins Gehirn.
 *
 * Onur hat vier Anläufe gebraucht, um mir das beizubringen, und am Ende eine
 * eigene HTML gebaut. Dort steht der Strahl als schlichtes Element **über**
 * der Szene — und genau das ist die richtige Bauart, nicht die billigere.
 *
 * Meine 3D-Fassungen sind zweimal gescheitert, und beide Male am selben
 * Grund: der Strahl verbindet einen Punkt vier Einheiten vor der Kamera mit
 * einer Wolke sechzig Einheiten dahinter. Als gerade Weltlinie verlässt er
 * unterwegs das Sichtfeld; als Band spannt er einen Tiefenbereich auf, an dem
 * der Nachbearbeitungspass zerbrach — die ganze Szene wurde schwarz, ohne ein
 * Wort in der Konsole.
 *
 * Auf dem Bildschirm verbindet er zwei Dinge auf dem Bildschirm. Also wird er
 * dort gezeichnet: ein Canvas über der Szene, unter den Panels. Er kann die
 * Szene nicht mehr stören, er ist bei jedem Blickwinkel sichtbar, und seine
 * Breite ist in Bildpunkten gemeint statt in Metern.
 *
 * Beide Enden kommen aus echten Messungen: der Kopf meldet seine Lage
 * (jarvisAnchor), die Szene meldet, worauf sie gerade zugreift (brainLink).
 * Steht nichts an, wird nichts gezeichnet.
 */

/** Wie viele Lichter gleichzeitig zurücklaufen. */
const LIGHTS = 16;

export function BrainLinkBeam() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;
    /** Läuft der Deckkraft nach, damit der Strahl ein- und ausblendet. */
    let shown = 0;

    const draw = (now: number) => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w !== width || h !== height) {
        width = w;
        height = h;
        canvas.width = Math.floor(w * ratio);
        canvas.height = Math.floor(h * ratio);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      }

      const link = currentBrainLink();
      const head = activeJarvisHead();
      const wanted = head && link.onScreen ? link.strength : 0;
      // Weiches Ein- und Ausblenden: ein Strahl, der schlagartig verschwindet,
      // sieht aus wie ein Fehler.
      shown += (wanted - shown) * 0.12;

      ctx.clearRect(0, 0, width, height);
      if (shown < 0.01 || !head) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const t = now / 1000;
      const x0 = head.x;
      const y0 = head.y;
      const x1 = link.x;
      const y1 = link.y;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const span = Math.hypot(dx, dy) || 1;
      const perpX = -dy / span;
      const perpY = dx / span;

      /**
       * Die Mittellinie mit leichter Wölbung.
       *
       * Eine schnurgerade Verbindung sieht aus wie ein Diagramm — daran ist
       * die zweite Fassung gescheitert. Eine leichte Krümmung, die langsam
       * atmet, liest sich als Leitung, die etwas überträgt.
       */
      const bow = Math.sin(t * 0.9) * span * 0.035;
      const spine = (u: number, out: { x: number; y: number }) => {
        const bend = Math.sin(u * Math.PI) * bow;
        out.x = x0 + dx * u + perpX * bend;
        out.y = y0 + dy * u + perpY * bend;
      };

      const point = { x: 0, y: 0 };
      const steps = 42;

      // --- Der Körper des Strahls ------------------------------------------
      // Zwei Lagen: ein breiter, schwacher Schein und ein schmaler heller
      // Kern. Eine Lage allein ist entweder ein Balken oder ein Faden.
      for (const layer of [
        { width: 16, alpha: 0.1 },
        { width: 6, alpha: 0.22 },
        { width: 2, alpha: 0.85 },
      ]) {
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const u = i / steps;
          spine(u, point);
          if (i === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        }
        const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
        gradient.addColorStop(0, `rgba(214,244,255,${layer.alpha * shown})`);
        gradient.addColorStop(0.45, `rgba(93,196,255,${layer.alpha * shown})`);
        gradient.addColorStop(1, `rgba(70,160,255,${layer.alpha * 0.35 * shown})`);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = layer.width;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      // --- Das zurücklaufende Licht ----------------------------------------
      // Vom Gehirn zum Kopf, denn das ist die Richtung, in der etwas
      // ankommt. Beim Lesen dicht, beim Suchen dünn — so unterscheidet man
      // die beiden Zustände ohne ein einziges Wort.
      const flowing = Math.round(LIGHTS * (0.35 + shown * 0.65));
      for (let i = 0; i < flowing; i++) {
        const u = 1 - ((t * 0.55 + i / flowing) % 1);
        spine(u, point);
        const size = 1.6 + (1 - u) * 2.6;
        const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, size * 4);
        glow.addColorStop(0, `rgba(236,250,255,${0.9 * shown})`);
        glow.addColorStop(1, "rgba(120,200,255,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(point.x, point.y, size * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- Der Ansatz am Kopf ----------------------------------------------
      // Ein Schein genau dort, wo der Strahl beginnt. Er ist der Grund, warum
      // man sofort sieht, wo er herkommt — die dünnen Linien der früheren
      // Fassungen gingen in der Ecke schlicht unter.
      const mouth = ctx.createRadialGradient(x0, y0, 0, x0, y0, 46);
      mouth.addColorStop(0, `rgba(226,248,255,${0.5 * shown})`);
      mouth.addColorStop(0.4, `rgba(96,198,255,${0.22 * shown})`);
      mouth.addColorStop(1, "rgba(96,198,255,0)");
      ctx.fillStyle = mouth;
      ctx.beginPath();
      ctx.arc(x0, y0, 46, 0, Math.PI * 2);
      ctx.fill();

      // --- Der Aufschlag im Gehirn -----------------------------------------
      const hit = 26 + Math.sin(t * 5) * 5;
      const impact = ctx.createRadialGradient(x1, y1, 0, x1, y1, hit);
      impact.addColorStop(0, `rgba(226,248,255,${0.4 * shown})`);
      impact.addColorStop(1, "rgba(96,198,255,0)");
      ctx.fillStyle = impact;
      ctx.beginPath();
      ctx.arc(x1, y1, hit, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.strokeStyle = `rgba(170,228,255,${0.5 * shown})`;
      ctx.lineWidth = 1.2;
      ctx.arc(x1, y1, hit * 0.7, 0, Math.PI * 2);
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      // Über der Szene, unter den Fenstern: er soll die Verbindung zeigen und
      // nichts anklickbar machen.
      className="pointer-events-none fixed inset-0 z-20"
    />
  );
}
