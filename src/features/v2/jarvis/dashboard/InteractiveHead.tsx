"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

export function InteractiveHead({ level, onActivate, label = "Jarvis ansprechen oder Stimme stoppen" }: { level: MutableRefObject<number>; onActivate: () => void; label?: string }) {
  const head = useRef<HTMLButtonElement>(null);
  const target = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const element = head.current;
    if (!element) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let x = 0, y = 0, energy = 0;
    const tick = () => {
      if (document.hidden) { frame = 0; return; }
      x += (target.current.x - x) * .09;
      y += (target.current.y - y) * .09;
      energy += (level.current - energy) * .35;
      element.style.setProperty("--turn-x", `${reduced ? 0 : -y * 7}deg`);
      element.style.setProperty("--turn-y", `${reduced ? 0 : x * 10}deg`);
      element.style.setProperty("--voice-energy", energy.toFixed(3));
      element.style.setProperty("--jaw-open", `${reduced ? 0 : energy * 7}px`);
      frame = requestAnimationFrame(tick);
    };
    const visibility = () => { if (!document.hidden && !frame) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", visibility);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", visibility); };
  }, [level]);
  return <button ref={head} type="button" className="jd-avatar" aria-label={label} onClick={onActivate}
    onPointerMove={event => {
      const rect = event.currentTarget.getBoundingClientRect();
      target.current = { x: Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1)), y: Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1)) };
    }} onPointerLeave={() => { target.current = { x: 0, y: 0 }; }} onPointerCancel={() => { target.current = { x: 0, y: 0 }; }}>
    <span className="jd-avatar-body"><img src="/jarvis/hologram-android-v3.png" alt="Breiter mechanischer Androidkopf mit schwerem Kiefer und leuchtenden blauen Augen" /><img className="jd-avatar-jaw" src="/jarvis/hologram-android-v3.png" alt="" aria-hidden="true" /><span className="jd-avatar-energy" /><span className="jd-scan" /></span>
  </button>;
}
