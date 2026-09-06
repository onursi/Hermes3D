"use client";
import { useEffect, useState } from "react";
import { useV2 } from "@/features/v2/state";
import { runAtmosphere, unlockAtmosphere } from "@/features/v2/atmosphereAudio";

export function AtmosphereAudio() {
  const { world, prefs, setPref } = useV2();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const ready = () => setArmed(true);
    window.addEventListener("hermes:audio-ready", ready);
    return () => window.removeEventListener("hermes:audio-ready", ready);
  }, []);
  useEffect(() => {
    if (!armed) return;
    return runAtmosphere(world, prefs.sound) ?? undefined;
  }, [armed, world, prefs.sound]);
  const enabled = armed && prefs.sound > 0;
  return <button type="button" aria-pressed={enabled} onClick={() => {
    if (enabled) setPref("sound", 0);
    else { unlockAtmosphere(); setPref("sound", prefs.sound || 0.45); }
  }} className="absolute left-4 top-16 z-30 rounded-full border border-white/10 bg-[#091018]/90 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.16em] text-white/60 hover:text-white" style={{ top: world === "cosmos" ? 48 : 64 }}>
    {enabled ? "♫ Ton aus" : "♫ Ton aktivieren"}
  </button>;
}
