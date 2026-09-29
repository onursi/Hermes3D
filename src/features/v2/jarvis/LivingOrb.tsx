"use client";
/**
 * R47 phone-sized living orb for the Hermes console (design A).
 *
 * A DOM element, not a second WebGL scene: on the phone the console covers the
 * 3D stage, and a CSS orb costs almost nothing. It reads the same presence
 * state and the same voice loudness as the 3D HermesOrb, so both always agree.
 */
import { useEffect, useRef } from "react";
import { COMMAND_STATES, useCommandPresence } from "../world/commandPresence";
import { voiceLevel } from "../world/voiceLevel";
import "./livingOrb.css";

export function LivingOrb({ className = "" }: { className?: string }) {
  const state = useCommandPresence(true, 0);
  const ref = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let frame = 0;
    let shown = 0;
    const tick = (time: number) => {
      let level = voiceLevel();
      const current = stateRef.current;
      // Browser voice or a request in flight has no measurable audio: pulse gently.
      if (current === "speaking" && level < 0.02) level = 0.3 + 0.2 * Math.sin(time / 140) * Math.sin(time / 430);
      if (current === "working") level = Math.max(level, 0.12 + 0.08 * Math.sin(time / 300));
      shown += (level - shown) * 0.25;
      ref.current?.style.setProperty("--level", shown.toFixed(3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const spec = COMMAND_STATES[state];
  return (
    <div ref={ref} className={`living-orb ${className}`} data-state={state} role="img"
      aria-label={`Hermes: ${spec.label}`} style={{ ["--tint" as string]: spec.color }}>
      <span className="living-orb-halo" />
      <span className="living-orb-core" />
      <span className="living-orb-flow" />
      <span className="living-orb-label">{spec.label}</span>
    </div>
  );
}
