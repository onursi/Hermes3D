"use client";

import { useEffect, useRef } from "react";

export interface JarvisHologramFaceProps {
  size?: number;
  active?: boolean;
  phase?: "idle" | "scanning" | "thinking" | "speaking";
}

/**
 * Jarvis Hologram Face Component
 *
 * Hochmodernes, prozedurales Cyberpunk-Hologramm-Gesicht:
 * - Vektorielle Facetten & Geometrie-Struktur (Stirn, Wangen, Kiefer)
 * - Glühende neon-zyanblaue Augen mit Blinzel- & Tracking-Animation
 * - Audio-reaktive / animierte Frequenz-Mundbänder
 * - Schwebende Quantenpartikel & vertikaler Hologramm-Scan-Sweep
 */
export function JarvisHologramFace({
  size = 80,
  active = false,
  phase = "idle",
}: JarvisHologramFaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(phase);
  const activeRef = useRef(active);

  useEffect(() => {
    phaseRef.current = phase;
    activeRef.current = active;
  }, [phase, active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let time = 0;
    let lastBlink = performance.now();
    let isBlinking = false;

    // Partikelsystem für Hologramm-Aura
    const particles: Array<{ x: number; y: number; vy: number; alpha: number; size: number }> = [];
    for (let i = 0; i < 22; i++) {
      particles.push({
        x: (Math.random() * 0.8 + 0.1) * size,
        y: Math.random() * size,
        vy: -0.4 - Math.random() * 0.6,
        alpha: Math.random() * 0.7 + 0.2,
        size: Math.random() * 1.5 + 0.8,
      });
    }

    const render = (now: number) => {
      time += 0.035;
      const curPhase = phaseRef.current;
      const isAct = activeRef.current;

      // Blinzel-Logik
      if (now - lastBlink > 3500 + Math.random() * 2000) {
        isBlinking = true;
        lastBlink = now;
      }
      if (isBlinking && now - lastBlink > 140) {
        isBlinking = false;
      }

      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2 - 2;
      const scale = size / 100;

      // 1. Hintergrund-Aura / Hologramm-Glow
      const glowRad = size * 0.48;
      const glowGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, glowRad);
      const glowAlpha = isAct || curPhase !== "idle" ? 0.25 : 0.12;
      glowGrad.addColorStop(0, `rgba(0, 240, 255, ${glowAlpha})`);
      glowGrad.addColorStop(0.6, `rgba(56, 189, 248, ${glowAlpha * 0.4})`);
      glowGrad.addColorStop(1, "rgba(0, 240, 255, 0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowRad, 0, Math.PI * 2);
      ctx.fill();

      // 2. Schwebende Partikel
      particles.forEach((p) => {
        p.y += p.vy;
        if (p.y < 0) {
          p.y = size;
          p.x = (Math.random() * 0.8 + 0.1) * size;
        }
        ctx.fillStyle = `rgba(0, 240, 255, ${p.alpha * (0.6 + Math.sin(time * 3 + p.x) * 0.3)})`;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      });

      // 3. Hologramm Kopf-Geometrie zeichnen
      ctx.save();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "rgba(0, 240, 255, 0.75)";
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = isAct || curPhase === "scanning" ? 8 : 4;

      // Stirn & Schläfen (Oberkopf-Polygon)
      ctx.beginPath();
      ctx.moveTo(cx - 24 * scale, cy - 26 * scale);
      ctx.lineTo(cx - 14 * scale, cy - 36 * scale);
      ctx.lineTo(cx + 14 * scale, cy - 36 * scale);
      ctx.lineTo(cx + 24 * scale, cy - 26 * scale);
      ctx.lineTo(cx + 28 * scale, cy - 10 * scale);
      ctx.lineTo(cx + 20 * scale, cy + 8 * scale);
      ctx.lineTo(cx + 10 * scale, cy + 28 * scale);
      ctx.lineTo(cx, cy + 33 * scale);
      ctx.lineTo(cx - 10 * scale, cy + 28 * scale);
      ctx.lineTo(cx - 20 * scale, cy + 8 * scale);
      ctx.lineTo(cx - 28 * scale, cy - 10 * scale);
      ctx.closePath();
      ctx.stroke();

      // Zentraler Stirnkristall / Node
      ctx.beginPath();
      ctx.arc(cx, cy - 24 * scale, 2.5 * scale, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.stroke();

      // Wangenknochen-Konturen
      ctx.beginPath();
      ctx.moveTo(cx - 20 * scale, cy - 8 * scale);
      ctx.lineTo(cx - 12 * scale, cy + 6 * scale);
      ctx.lineTo(cx - 6 * scale, cy + 18 * scale);
      ctx.moveTo(cx + 20 * scale, cy - 8 * scale);
      ctx.lineTo(cx + 12 * scale, cy + 6 * scale);
      ctx.lineTo(cx + 6 * scale, cy + 18 * scale);
      ctx.stroke();

      // Nasenrücken
      ctx.beginPath();
      ctx.moveTo(cx, cy - 18 * scale);
      ctx.lineTo(cx - 3 * scale, cy - 2 * scale);
      ctx.lineTo(cx, cy + 4 * scale);
      ctx.lineTo(cx + 3 * scale, cy - 2 * scale);
      ctx.stroke();

      // 4. Glühende Augen (Futuristisch, geometrisch)
      const eyeY = cy - 8 * scale;
      const eyeHeight = isBlinking ? 0.5 * scale : 4.5 * scale;
      const eyeWidth = 8.5 * scale;

      // Linkes Auge
      ctx.beginPath();
      ctx.ellipse(cx - 13 * scale, eyeY, eyeWidth, eyeHeight, -0.05, 0, Math.PI * 2);
      ctx.fillStyle = isAct ? "#ffffff" : "rgba(224, 242, 254, 0.9)";
      ctx.fill();
      ctx.stroke();

      // Rechtes Auge
      ctx.beginPath();
      ctx.ellipse(cx + 13 * scale, eyeY, eyeWidth, eyeHeight, 0.05, 0, Math.PI * 2);
      ctx.fillStyle = isAct ? "#ffffff" : "rgba(224, 242, 254, 0.9)";
      ctx.fill();
      ctx.stroke();

      // Augen-Pupillen / Iris-Glow (bewegt sich subtil)
      if (!isBlinking) {
        const pupilOffset = Math.sin(time * 0.8) * 1.5 * scale;
        ctx.fillStyle = "#00f0ff";
        ctx.beginPath();
        ctx.arc(cx - 13 * scale + pupilOffset, eyeY, 2 * scale, 0, Math.PI * 2);
        ctx.arc(cx + 13 * scale + pupilOffset, eyeY, 2 * scale, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5. Vokales Frequenz-Mundband (Equalizer-Mund)
      const mouthY = cy + 16 * scale;
      const barCount = 7;
      const barSpacing = 3 * scale;
      const mouthStartX = cx - ((barCount - 1) * barSpacing) / 2;

      for (let b = 0; b < barCount; b++) {
        const barX = mouthStartX + b * barSpacing;
        let barH = 2 * scale;
        if (curPhase === "speaking") {
          barH = (Math.abs(Math.sin(time * 6 + b * 1.2)) * 8 + 2) * scale;
        } else if (curPhase === "thinking" || curPhase === "scanning") {
          barH = (Math.abs(Math.sin(time * 4 + b * 0.8)) * 5 + 1.5) * scale;
        } else {
          barH = (Math.sin(time * 1.5 + b) * 1.2 + 2) * scale;
        }

        ctx.fillStyle = "rgba(0, 240, 255, 0.85)";
        ctx.fillRect(barX - 1 * scale, mouthY - barH / 2, 2 * scale, barH);
      }

      // 6. Vertikaler Hologramm-Scan-Sweep
      const scanY = ((time * 24) % (size * 1.2)) - size * 0.1;
      const scanGrad = ctx.createLinearGradient(0, scanY - 6, 0, scanY + 6);
      scanGrad.addColorStop(0, "rgba(0, 240, 255, 0)");
      scanGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.45)");
      scanGrad.addColorStop(1, "rgba(0, 240, 255, 0)");
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 6, size, 12);

      // Subtile Scanlines-Overlay
      ctx.fillStyle = "rgba(10, 16, 24, 0.18)";
      for (let s = 0; s < size; s += 3) {
        ctx.fillRect(0, s, size, 1);
      }

      ctx.restore();
      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{ width: size, height: size }}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
