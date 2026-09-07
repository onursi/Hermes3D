"use client";

import { useEffect, useRef } from "react";

export interface JarvisArcReactorProps {
  size?: number;
  active?: boolean;
  phase?: "idle" | "scanning" | "thinking" | "speaking";
}

/**
 * Jarvis Quantum Arc Reactor Core
 *
 * Hochdynamischer Sci-Fi-Reaktor-Kern:
 * - Mehrere konzentrische, gegenläufig rotierende HUD-Ringe mit Skalenmarkierungen
 * - Radial angeordnete magnetische Energie-Spulen (6-fach Symmetrie)
 * - Pulsierender Quanten-Plasmakern im Zentrum
 * - Orbitale Lichtpartikel & Entladungs-Flares
 * - Reaktive Beschleunigung bei Denk- und Scan-Phasen
 */
export function JarvisArcReactor({
  size = 80,
  active = false,
  phase = "idle",
}: JarvisArcReactorProps) {
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
    let angle1 = 0;
    let angle2 = 0;
    let pulse = 0;

    // Orbitale Energiepartikel
    const particles = Array.from({ length: 16 }, (_, i) => ({
      angle: (i / 16) * Math.PI * 2,
      radius: (0.32 + (i % 3) * 0.05) * size,
      speed: 0.03 + (i % 2) * 0.02,
      size: 1 + (i % 3) * 0.5,
    }));

    const render = () => {
      const curPhase = phaseRef.current;
      const isAct = activeRef.current;

      // Drehgeschwindigkeit je nach Zustand
      let speedMult = 1.0;
      if (curPhase === "scanning") speedMult = 3.8;
      else if (curPhase === "thinking") speedMult = 2.4;
      else if (curPhase === "speaking") speedMult = 1.8;
      else if (isAct) speedMult = 1.5;

      angle1 += 0.015 * speedMult;
      angle2 -= 0.022 * speedMult;
      pulse += 0.04 * speedMult;

      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;

      // 1. Hintergrund-Aura / Plasma-Glow
      const maxR = size * 0.46;
      const glowGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, maxR);
      const intensity = curPhase !== "idle" || isAct ? 0.35 : 0.18;
      glowGrad.addColorStop(0, `rgba(0, 240, 255, ${intensity * 1.5})`);
      glowGrad.addColorStop(0.4, `rgba(6, 182, 212, ${intensity * 0.8})`);
      glowGrad.addColorStop(0.8, `rgba(14, 116, 144, ${intensity * 0.3})`);
      glowGrad.addColorStop(1, "rgba(0, 240, 255, 0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
      ctx.fill();

      // 2. Äußerer Telemetrie-Ring mit Ticks & Segmenten
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle1);

      ctx.strokeStyle = "rgba(0, 240, 255, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, maxR, 0, Math.PI * 2);
      ctx.stroke();

      // Skalen-Striche (Ticks)
      const ticks = 36;
      for (let t = 0; t < ticks; t++) {
        const tickAngle = (t / ticks) * Math.PI * 2;
        const isMajor = t % 6 === 0;
        const r1 = maxR - (isMajor ? 4 : 2);
        const r2 = maxR;
        ctx.strokeStyle = isMajor ? "rgba(255, 255, 255, 0.9)" : "rgba(0, 240, 255, 0.35)";
        ctx.lineWidth = isMajor ? 1.5 : 0.8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(tickAngle) * r1, Math.sin(tickAngle) * r1);
        ctx.lineTo(Math.cos(tickAngle) * r2, Math.sin(tickAngle) * r2);
        ctx.stroke();
      }

      // Äußere Bogen-Flares (3 Segmente)
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#00f0ff";
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 6;
      for (let a = 0; a < 3; a++) {
        const arcStart = a * ((Math.PI * 2) / 3);
        ctx.beginPath();
        ctx.arc(0, 0, maxR - 1, arcStart, arcStart + Math.PI / 4);
        ctx.stroke();
      }
      ctx.restore();

      // 3. Mittlerer gegenläufiger Energie-Ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle2);

      const midR = maxR * 0.72;
      ctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, midR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 6 Energie-Spulen / Coils
      for (let c = 0; c < 6; c++) {
        const coilAngle = c * (Math.PI / 3);
        const cr = midR - 3;
        const cxp = Math.cos(coilAngle) * cr;
        const cyp = Math.sin(coilAngle) * cr;

        ctx.fillStyle = "rgba(0, 240, 255, 0.85)";
        ctx.beginPath();
        ctx.arc(cxp, cyp, 2, 0, Math.PI * 2);
        ctx.fill();

        // Spulenlinie nach innen
        ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cxp, cyp);
        ctx.lineTo(Math.cos(coilAngle) * (midR * 0.45), Math.sin(coilAngle) * (midR * 0.45));
        ctx.stroke();
      }
      ctx.restore();

      // 4. Orbitale Partikel
      particles.forEach((p) => {
        p.angle += p.speed * speedMult;
        const px = cx + Math.cos(p.angle) * p.radius;
        const py = cy + Math.sin(p.angle) * p.radius;
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // 5. Zentraler Quanten-Plasmakern
      const corePulse = (Math.sin(pulse) * 0.15 + 1.0) * (size * 0.18);
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, corePulse);
      coreGrad.addColorStop(0, "#ffffff");
      coreGrad.addColorStop(0.3, "#a5f3fc");
      coreGrad.addColorStop(0.7, "#00f0ff");
      coreGrad.addColorStop(1, "rgba(0, 240, 255, 0)");

      ctx.save();
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 10;
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, corePulse, 0, Math.PI * 2);
      ctx.fill();

      // Kern-Spitzen-Ring
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, corePulse * 0.55, 0, Math.PI * 2);
      ctx.stroke();
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
