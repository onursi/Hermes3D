"use client";

import { useEffect, useRef } from "react";

/**
 * The reactor: what Jarvis is doing, as a shape rather than a sentence.
 *
 * Every assistant interface has to answer "is it working, or is it stuck?"
 * A spinner answers neither — it spins identically while searching, while
 * waiting on a model, and while a request quietly died. This ring is driven
 * by the real events on the wire, so its states are claims that can be
 * wrong rather than decoration that cannot: idle, searching, thinking,
 * speaking. If the answer stops arriving, the ring stops moving.
 *
 * Drawn on a canvas because the pulse is continuous and per-frame; sixty
 * React re-renders a second to animate a circle would be absurd.
 */

export type JarvisPhase =
  | "idle"
  | "listening"
  | "searching"
  | "thinking"
  | "speaking"
  | "error";

const PHASE_LABEL: Record<JarvisPhase, string> = {
  idle: "bereit",
  listening: "hört zu",
  searching: "durchsucht den Vault",
  thinking: "denkt nach",
  speaking: "antwortet",
  error: "gestört",
};

/**
 * One colour per state, and only where it means something.
 *
 * Amber for searching and thinking because the system is busy; cyan for
 * speaking because something is arriving; red only for a genuine fault.
 */
const PHASE_COLOR: Record<JarvisPhase, string> = {
  idle: "#64748b",
  // Green while listening: the one state where the microphone is live, and
  // that deserves a colour nothing else uses.
  listening: "#4ade80",
  searching: "#fbbf24",
  thinking: "#fbbf24",
  speaking: "#22d3ee",
  error: "#f43f5e",
};

/** How fast each state turns. Idle barely moves; speaking is alive. */
const PHASE_SPEED: Record<JarvisPhase, number> = {
  idle: 0.08,
  listening: 2.2,
  searching: 0.9,
  thinking: 0.5,
  speaking: 1.6,
  error: 0,
};

export function JarvisCore({ phase, size = 168 }: { phase: JarvisPhase; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /**
   * The phase, held by ref.
   *
   * The frame loop must not be torn down and rebuilt every time the state
   * changes — the ring would jump. Reading the current phase out of a ref
   * lets one continuous loop follow the state instead of restarting with it.
   */
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    // Drawn at device resolution so the ring is not a soft smudge on a
    // high-density screen, then scaled back down in CSS pixels.
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    context.scale(ratio, ratio);

    let raf = 0;
    let angle = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;
      const current = phaseRef.current;
      angle += delta * PHASE_SPEED[current] * Math.PI;

      const centre = size / 2;
      const colour = PHASE_COLOR[current];
      context.clearRect(0, 0, size, size);

      // Three rings at different radii and speeds. One ring reads as a
      // loading spinner; three reading against each other read as a machine.
      const rings = [
        { radius: centre - 8, width: 1.5, arc: 1.7, direction: 1, alpha: 0.9 },
        { radius: centre - 22, width: 3, arc: 2.6, direction: -1, alpha: 0.55 },
        { radius: centre - 34, width: 1, arc: 4.4, direction: 1, alpha: 0.3 },
      ];
      for (const ring of rings) {
        context.beginPath();
        context.strokeStyle = colour;
        context.globalAlpha = ring.alpha;
        context.lineWidth = ring.width;
        context.lineCap = "round";
        context.arc(centre, centre, ring.radius, angle * ring.direction, angle * ring.direction + ring.arc);
        context.stroke();
      }

      // The core breathes even at rest, so "idle" still looks alive rather
      // than crashed — the one thing a status light must never get wrong.
      const breath = 0.5 + 0.5 * Math.sin(now / (current === "idle" ? 1400 : 380));
      const coreRadius = centre - 46 + breath * 3;
      const glow = context.createRadialGradient(centre, centre, 0, centre, centre, coreRadius);
      glow.addColorStop(0, colour);
      glow.addColorStop(0.55, colour + "55");
      glow.addColorStop(1, "transparent");
      context.globalAlpha = 0.35 + breath * 0.35;
      context.fillStyle = glow;
      context.beginPath();
      context.arc(centre, centre, coreRadius, 0, Math.PI * 2);
      context.fill();

      context.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <div className="flex flex-col items-center gap-2">
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
        <span className="text-[11px] font-medium tracking-[-0.005em] text-white/55">
          {PHASE_LABEL[phase]}
        </span>
      </div>
    </div>
  );
}
