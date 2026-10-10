"use client";
import { useEffect, useRef } from "react";

/** Quiet falling light streaks behind the head. Decorative only. */
export function DataRain() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext("2d"); if (!element || !ctx) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0, last = 0, drops: { x: number; y: number; speed: number; length: number; glow: number }[] = [];
    const seed = () => {
      const w = element.clientWidth, h = element.clientHeight; element.width = w; element.height = h;
      drops = Array.from({ length: Math.round(w / 26) }, (_, i) => ({ x: i * 26 + 8 + Math.random() * 10, y: Math.random() * h, speed: 40 + Math.random() * 110, length: 30 + Math.random() * 90, glow: .08 + Math.random() * .22 }));
    };
    const observer = new ResizeObserver(seed); observer.observe(element); seed();
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (document.hidden) { last = 0; return; }
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now;
      const w = element.width, h = element.height; ctx.clearRect(0, 0, w, h);
      for (const drop of drops) {
        drop.y += drop.speed * dt; if (drop.y - drop.length > h) { drop.y = -Math.random() * 120; drop.speed = 40 + Math.random() * 110; }
        const gradient = ctx.createLinearGradient(0, drop.y - drop.length, 0, drop.y);
        gradient.addColorStop(0, "rgba(120,211,255,0)"); gradient.addColorStop(1, `rgba(120,211,255,${drop.glow})`);
        ctx.fillStyle = gradient; ctx.fillRect(drop.x, drop.y - drop.length, 1, drop.length);
        ctx.fillStyle = `rgba(210,240,255,${drop.glow * 2.2})`; ctx.fillRect(drop.x - .5, drop.y - 2, 2, 2);
      }
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);
  return <canvas ref={canvas} className="jl-rain" aria-hidden="true" />;
}
