"use client";
import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import type { FaceMesh } from "./useFaceTracking";
import { EYE_A, EYE_B, FACE_OVAL, IRIS_A, IRIS_B, LIPS, bounds, distanceCm, eyeOpenness, hasIris } from "./vision";

export type HudMode = "off" | "mesh" | "camera";
const CYAN = "120,211,255";

/** Local operator view: shows what Jarvis locks onto. Nothing drawn here leaves the browser. */
export function VisionHud({ video, mesh, mode }: { video: RefObject<HTMLVideoElement | null>; mesh: MutableRefObject<FaceMesh>; mode: HudMode }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current; if (!element || mode === "off") return;
    const ctx = element.getContext("2d"); if (!ctx) return;
    let frame = 0, acquired = 0, blinks = 0, closed = false, smoothCm = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (document.hidden) return;
      const source = video.current, ratio = Math.min(window.devicePixelRatio || 1, 2);
      const w = element.clientWidth, h = element.clientHeight; if (!w || !h) return;
      if (element.width !== Math.round(w * ratio)) { element.width = Math.round(w * ratio); element.height = Math.round(h * ratio); }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#02070b"; ctx.fillRect(0, 0, w, h);
      const aspect = source?.videoWidth ? source.videoWidth / source.videoHeight : 4 / 3;
      // Selfie view: mirrored like a mirror, so left on screen is the operator's left.
      const px = (x: number) => (1 - x) * w, py = (y: number) => y * h;
      if (mode === "camera" && source?.videoWidth) {
        ctx.save(); ctx.translate(w, 0); ctx.scale(-1, 1); ctx.filter = "grayscale(1) contrast(1.2) brightness(.62)";
        ctx.drawImage(source, 0, 0, w, h); ctx.restore();
        ctx.fillStyle = "rgba(8,60,95,.38)"; ctx.fillRect(0, 0, w, h);
      }
      ctx.fillStyle = "rgba(2,7,11,.22)"; for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
      const data = mesh.current, points = now - data.seen < 700 ? data.points : null;
      ctx.font = "600 9px Arial"; ctx.textBaseline = "top";
      if (!points) {
        acquired = 0; closed = false;
        const sweep = (now / 1600 % 1) * h;
        const gradient = ctx.createLinearGradient(0, sweep - 30, 0, sweep); gradient.addColorStop(0, `rgba(${CYAN},0)`); gradient.addColorStop(1, `rgba(${CYAN},.5)`);
        ctx.fillStyle = gradient; ctx.fillRect(0, sweep - 30, w, 30);
        ctx.fillStyle = `rgba(${CYAN},.85)`; ctx.fillText("SUCHE SUBJEKT", 12, 12);
        return;
      }
      if (!acquired) acquired = now;
      const lock = Math.min(1, (now - acquired) / 900), ease = 1 - (1 - lock) ** 3;
      const count = Math.min(468, points.length / 2), box = bounds(points);
      const top = py(box.t), bottom = py(box.b), band = top + ((now / 1900) % 1) * (bottom - top);
      // Surface net: every tracked point, lit as the scan band passes.
      for (let i = 0; i < count; i++) {
        const x = px(points[i * 2]), y = py(points[i * 2 + 1]), near = Math.max(0, 1 - Math.abs(y - band) / 14);
        ctx.fillStyle = `rgba(${CYAN},${(.2 + near * .8) * ease})`; const size = 1 + near * 1.3; ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
      const path = (indices: number[]) => { ctx.beginPath(); indices.forEach((i, n) => { const x = px(points[i * 2]), y = py(points[i * 2 + 1]); if (n) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke(); };
      ctx.lineWidth = 1; ctx.strokeStyle = `rgba(${CYAN},${.75 * ease})`; ctx.shadowColor = `rgb(${CYAN})`; ctx.shadowBlur = 6;
      path(FACE_OVAL); ctx.strokeStyle = `rgba(${CYAN},${.45 * ease})`; path(LIPS);
      ctx.strokeStyle = `rgba(255,255,255,${.9 * ease})`; path(EYE_A); path(EYE_B);
      const open = eyeOpenness(points, aspect);
      if (open < .13 && !closed) { closed = true; blinks++; } else if (open > .18) closed = false;
      if (hasIris(points)) for (const centre of [IRIS_A, IRIS_B]) {
        const x = px(points[centre * 2]), y = py(points[centre * 2 + 1]);
        const radius = Math.max(3, Math.abs(points[(centre + 1) * 2] - points[(centre + 3) * 2]) * w / 2);
        const ring = radius + 5 + (1 - ease) * 26, spin = now / 700;
        ctx.strokeStyle = `rgba(${CYAN},${ease})`; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke();
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x, y, ring, spin + k * 2.094, spin + k * 2.094 + 1.2); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(x - ring - 7, y); ctx.lineTo(x - ring - 1, y); ctx.moveTo(x + ring + 1, y); ctx.lineTo(x + ring + 7, y); ctx.moveTo(x, y - ring - 7); ctx.lineTo(x, y - ring - 1); ctx.moveTo(x, y + ring + 1); ctx.lineTo(x, y + ring + 7); ctx.stroke();
      }
      ctx.shadowBlur = 0;
      const pad = 10 + (1 - ease) * 34, l = px(box.r) - pad, r = px(box.l) + pad, t = top - pad, b = bottom + pad, arm = 14;
      ctx.strokeStyle = `rgba(${CYAN},.95)`; ctx.lineWidth = 1.5; ctx.beginPath();
      for (const [x, y, dx, dy] of [[l, t, 1, 1], [r, t, -1, 1], [l, b, 1, -1], [r, b, -1, -1]]) { ctx.moveTo(x + dx * arm, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * arm); }
      ctx.stroke();
      const cm = distanceCm(points); if (cm) smoothCm = smoothCm ? smoothCm + (cm - smoothCm) * .12 : cm;
      ctx.fillStyle = `rgba(${CYAN},.95)`; ctx.fillText(lock < 1 ? "ERFASSE SUBJEKT" : "SUBJEKT ERFASST", 12, 12);
      ctx.fillStyle = "rgba(228,243,252,.8)"; ctx.font = "8px Arial";
      const lines = [`AUGEN ${hasIris(points) ? (closed ? "GESCHLOSSEN" : "ERFASST") : "–"}`, `LIDSCHLAG ${blinks}`, cm ? `ABSTAND CA. ${Math.round(smoothCm / 5) * 5} CM` : "ABSTAND –", `PUNKTE ${count}`];
      lines.forEach((line, i) => ctx.fillText(line, 12, h - 14 - (lines.length - 1 - i) * 12));
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [video, mesh, mode]);
  if (mode === "off") return null;
  return <aside className="jl-hud" aria-label="Lokale Erfassungsansicht"><canvas ref={canvas} /><span>JARVIS SIEHT · LOKAL</span></aside>;
}
