"use client";

import { useEffect, useRef } from "react";

import type { JarvisPhase } from "@/features/jarvis/JarvisCore";

/**
 * Wie Jarvis aussieht, während er etwas tut.
 *
 * Onur wollte nicht "irgendein Knöpfchen", sondern eine Gegenwart: entweder
 * die **Kugel**, die flackert, oder das **Gesicht** in Blau. Beides steckt
 * hier drin, beides an derselben Quelle.
 *
 * Diese Quelle ist der echte Lautstärkepegel der Stimme, der als ref
 * hereinkommt. Das ist der ganze Punkt: der Mund geht auf, weil gerade ein
 * Laut zu hören ist, nicht weil ein Sinus gerade oben steht. Wenn die Stimme
 * schweigt, steht der Mund still — und wenn nichts kommt, sieht man das.
 *
 * Ein Canvas und **eine** Schleife, wie überall in diesem Projekt. React
 * rendert das hier genau dann neu, wenn sich der Modus oder die Phase ändert;
 * die sechzig Bilder je Sekunde laufen darunter durch und lesen refs.
 */

export type JarvisMode = "orb" | "face";

/**
 * Eine Farbe je Zustand.
 *
 * Blau/Cyan ist die Ruhefarbe — das ist die Farbe, die Onur meinte. Bernstein
 * heißt "ich arbeite", Grün heißt "das Mikrofon ist offen", und Rot bleibt
 * für echte Störungen reserviert. Eine Farbe, die überall auftaucht, sagt
 * nichts mehr.
 */
const PHASE_COLOR: Record<JarvisPhase, string> = {
  idle: "#38bdf8",
  listening: "#4ade80",
  searching: "#fbbf24",
  thinking: "#a78bfa",
  speaking: "#22d3ee",
  error: "#f43f5e",
};

const PHASE_LABEL: Record<JarvisPhase, string> = {
  idle: "bereit",
  listening: "hört zu",
  searching: "durchsucht dein Wissen",
  thinking: "denkt nach",
  speaking: "antwortet",
  error: "gestört",
};

type Props = {
  mode: JarvisMode;
  phase: JarvisPhase;
  /** Der Pegel der Stimme, 0 bis 1, pro Bild gelesen. */
  levelRef: { current: number };
  size?: number;
};

export function JarvisPresence({ mode, phase, levelRef, size = 132 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Modus und Phase wandern per ref in die Schleife, damit ein Wechsel die
  // Schleife nicht abreißt und neu startet — sonst springt die Animation bei
  // jedem Zustandswechsel zurück auf null.
  const modeRef = useRef(mode);
  const phaseRef = useRef(phase);
  useEffect(() => {
    modeRef.current = mode;
    phaseRef.current = phase;
  }, [mode, phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    ctx.scale(ratio, ratio);

    let raf = 0;
    /** Geglätteter Pegel: der Rohwert zappelt, ein Gesicht zappelt nicht. */
    let smooth = 0;
    /** Wann das nächste Mal geblinzelt wird. Unregelmäßig, sonst wirkt es tot. */
    let nextBlink = performance.now() + 2200;
    let blinkUntil = 0;

    const draw = (now: number) => {
      const phaseNow = phaseRef.current;
      const colour = PHASE_COLOR[phaseNow];
      const target = levelRef.current;
      // Nach oben schnell, nach unten träge: so schnappt der Mund auf den
      // Laut und fällt nicht zwischen zwei Silben zu.
      smooth += (target - smooth) * (target > smooth ? 0.45 : 0.12);

      ctx.clearRect(0, 0, size, size);
      if (modeRef.current === "face") drawFace(ctx, size, now, colour, smooth, phaseNow, () => {
        if (now > nextBlink) {
          blinkUntil = now + 130;
          nextBlink = now + 1800 + Math.random() * 3600;
        }
        return now < blinkUntil;
      });
      else drawOrb(ctx, size, now, colour, smooth, phaseNow);

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [levelRef, size]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        aria-label={`Jarvis: ${PHASE_LABEL[phase]}`}
      />
      <div className="flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: PHASE_COLOR[phase] }}
        />
        <span className="text-[11px] tracking-[-0.005em] text-white/55">{PHASE_LABEL[phase]}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Die Kugel
// ============================================================================

/**
 * Der Kern im Zentrum: ein Licht, drei Ringe, und ein Kranz aus Strahlen, der
 * nach dem Pegel ausschlägt.
 *
 * Die Strahlen sind der Unterschied zwischen "es dreht sich etwas" und "es
 * spricht jemand". Bei Stille liegen sie flach am Ring an.
 */
function drawOrb(
  ctx: CanvasRenderingContext2D,
  size: number,
  now: number,
  colour: string,
  level: number,
  phase: JarvisPhase,
) {
  const c = size / 2;
  const t = now / 1000;
  const busy = phase === "searching" || phase === "thinking";
  const breath = 0.5 + 0.5 * Math.sin(t * (phase === "idle" ? 1.1 : 3.0));

  // Der Halo. Ein Verlauf, kein Schatten-Blur: Blur auf jedem Bild ist auf
  // integrierter Grafik teuer, ein Radialverlauf ist es nicht.
  const haloR = c * (0.62 + level * 0.3 + breath * 0.05);
  const halo = ctx.createRadialGradient(c, c, 0, c, c, haloR);
  halo.addColorStop(0, hexA(colour, 0.55 + level * 0.35));
  halo.addColorStop(0.45, hexA(colour, 0.16));
  halo.addColorStop(1, hexA(colour, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(c, c, haloR, 0, Math.PI * 2);
  ctx.fill();

  // Strahlenkranz.
  const spokes = 48;
  const inner = c * 0.34;
  ctx.lineCap = "round";
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2 + t * 0.25;
    // Zwei Sinus mit unrunden Frequenzen: das Muster wiederholt sich nicht
    // sichtbar, was ein einzelner Sinus sofort täte.
    const wobble = 0.5 + 0.5 * Math.sin(i * 1.7 + t * 4.1) * Math.sin(i * 0.6 - t * 2.3);
    const len = c * 0.06 + level * wobble * c * 0.3 + (busy ? wobble * c * 0.04 : 0);
    ctx.beginPath();
    ctx.strokeStyle = hexA(colour, 0.25 + level * 0.6);
    ctx.lineWidth = 1.6;
    ctx.moveTo(c + Math.cos(a) * inner, c + Math.sin(a) * inner);
    ctx.lineTo(c + Math.cos(a) * (inner + len), c + Math.sin(a) * (inner + len));
    ctx.stroke();
  }

  // Drei Ringe gegeneinander. Einer allein liest sich als Ladeanzeige.
  const rings = [
    { r: c - 6, w: 1.2, arc: 1.6, dir: 1, a: 0.85, speed: 0.55 },
    { r: c - 17, w: 2.4, arc: 2.7, dir: -1, a: 0.45, speed: 0.9 },
    { r: c - 26, w: 1, arc: 4.3, dir: 1, a: 0.25, speed: 0.35 },
  ];
  for (const ring of rings) {
    const spin = t * ring.speed * (busy ? 2.4 : 1) * ring.dir;
    ctx.beginPath();
    ctx.strokeStyle = hexA(colour, ring.a);
    ctx.lineWidth = ring.w;
    ctx.arc(c, c, ring.r, spin, spin + ring.arc);
    ctx.stroke();
  }

  // Der Kern selbst.
  const coreR = inner * (0.72 + level * 0.26 + breath * 0.05);
  const core = ctx.createRadialGradient(c, c, 0, c, c, coreR);
  core.addColorStop(0, "#ffffff");
  core.addColorStop(0.35, colour);
  core.addColorStop(1, hexA(colour, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(c, c, coreR, 0, Math.PI * 2);
  ctx.fill();
}

// ============================================================================
// Das Gesicht
// ============================================================================

/**
 * Ein Gesicht aus Abtastzeilen.
 *
 * Kein gezeichneter Kopf mit Nase und Ohren — das wäre eine Figur, und eine
 * schlecht gezeichnete Figur ist sofort unangenehm. Stattdessen das, was ein
 * Bildschirm von einem Gesicht übrig lässt: eine Kontur aus waagerechten
 * Linien, zwei Augen, ein Mund. Genug, um ein Gegenüber zu sein, und weit
 * genug vom Menschlichen weg, um nicht schief zu wirken.
 *
 * Der Mund ist an den Pegel gekoppelt, die Augen an die Phase, und beim
 * Suchen läuft eine Abtastkante durchs Bild.
 */
function drawFace(
  ctx: CanvasRenderingContext2D,
  size: number,
  now: number,
  colour: string,
  level: number,
  phase: JarvisPhase,
  blinking: () => boolean,
) {
  const c = size / 2;
  const t = now / 1000;
  const busy = phase === "searching" || phase === "thinking";

  // Grundschein hinter dem Gesicht.
  const halo = ctx.createRadialGradient(c, c, 0, c, c, c);
  halo.addColorStop(0, hexA(colour, 0.16 + level * 0.14));
  halo.addColorStop(1, hexA(colour, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  // Halbe Breite, nicht ganze: `headW` wird nach links und rechts abgetragen.
  // Mit 0.56 stand die Kontur bei 112 % der Leinwandbreite und wurde an den
  // Rändern abgeschnitten — deshalb sah der Kopf oben eckig aus statt rund.
  const headH = size * 0.78;
  const headW = size * 0.33;
  const top = c - headH / 2;

  // Die Kontur: waagerechte Zeilen, deren Breite dem Umriss eines Kopfes
  // folgt. Oben rund, unten schmaler — ein Kinn entsteht dadurch von selbst.
  const lines = 26;
  for (let i = 0; i < lines; i++) {
    const u = i / (lines - 1);
    const y = top + u * headH;
    // Eine Ellipse, deren Scheitel etwas oberhalb der Mitte liegt — ein Kopf
    // ist oben breiter als unten. Der Nenner ist so gewählt, dass die Breite
    // an beiden Enden auf null geht: sonst beginnt die Kontur oben mit einer
    // waagerechten Kante, und daraus wird ein Kasten statt eines Schädels.
    const taper = u < 0.55 ? 1 : 1 - Math.pow((u - 0.55) / 0.45, 1.7) * 0.5;
    const w = Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.44) / 0.56, 2))) * headW * taper;
    if (w <= 1) continue;
    // Ein leichtes Flackern je Zeile: der Eindruck einer Projektion, die
    // nicht ganz stabil steht.
    const flicker = 0.55 + 0.45 * Math.sin(i * 2.3 + t * (busy ? 7 : 2.2));
    ctx.beginPath();
    ctx.strokeStyle = hexA(colour, 0.1 + flicker * 0.16 + level * 0.12);
    ctx.lineWidth = 1;
    ctx.moveTo(c - w, y);
    ctx.lineTo(c + w, y);
    ctx.stroke();
  }

  // Die Augen. Zwei Balken, kein Kreis: ein Kreis mit Pupille schaut einen an
  // wie ein Comic, ein Balken wie ein Gerät.
  const eyeY = top + headH * 0.38;
  const eyeDx = headW * 0.5;
  const lid = blinking() ? 0.12 : 1;
  const eyeGlow = phase === "listening" ? 1 : phase === "idle" ? 0.7 : 0.9;
  for (const sign of [-1, 1]) {
    const x = c + sign * eyeDx;
    const w = size * 0.078;
    const h = size * 0.028 * lid * (1 + level * 0.25);
    const grad = ctx.createLinearGradient(x - w, eyeY, x + w, eyeY);
    grad.addColorStop(0, hexA(colour, 0.05));
    grad.addColorStop(0.5, hexA(colour, 0.95 * eyeGlow));
    grad.addColorStop(1, hexA(colour, 0.05));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, eyeY, w, Math.max(0.6, h), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Der Mund: eine Wellenform, deren Ausschlag der Pegel ist. Bei Stille
  // bleibt eine dünne Linie stehen — ein Mund, der ganz verschwindet, sieht
  // aus wie ein Zeichenfehler.
  const mouthY = top + headH * 0.72;
  const mouthW = headW * 0.52;
  const amp = size * 0.075 * level;
  ctx.beginPath();
  ctx.strokeStyle = hexA(colour, 0.9);
  ctx.lineWidth = 1.8;
  ctx.lineJoin = "round";
  const steps = 34;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const x = c - mouthW + u * mouthW * 2;
    // Am Rand auf null gedämpft, sonst endet die Welle in einer Kante.
    const envelope = Math.sin(u * Math.PI);
    const y =
      mouthY +
      Math.sin(u * 14 + t * 22) * amp * envelope +
      Math.sin(u * 5.5 - t * 9) * amp * 0.45 * envelope;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Beim Suchen läuft eine Kante von oben nach unten durchs Gesicht: das
  // sichtbare "ich lese gerade".
  if (busy) {
    const sweep = (t * 0.75) % 1;
    const y = top + sweep * headH;
    const band = ctx.createLinearGradient(0, y - 10, 0, y + 10);
    band.addColorStop(0, hexA(colour, 0));
    band.addColorStop(0.5, hexA(colour, 0.4));
    band.addColorStop(1, hexA(colour, 0));
    ctx.fillStyle = band;
    ctx.fillRect(c - headW, y - 10, headW * 2, 20);
  }
}

/** #rrggbb plus Alpha, ohne den Umweg über einen Color-Typ. */
function hexA(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}
