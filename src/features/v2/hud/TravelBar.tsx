"use client";

import * as THREE from "three";
import { SELECTION_COLOR } from "@/features/v2/palette";
import { playHyperJump } from "@/features/v2/atmosphereAudio";
import { useV2 } from "@/features/v2/state";
import type { Place } from "@/features/v2/universe/places";

/**
 * The cockpit, and deliberately not much of one.
 *
 * The plan allows "optionales leichtes Cockpit, kein Physikspiel", and the
 * order in that sentence is the design: the flight had to work before anything
 * was drawn around it. So this is four things — how to steer, how fast, how to
 * get home, and what is within reach — as flat DOM above the canvas, where
 * text is sharp and a button is a button.
 *
 * The entry offer is the important one. It appears when he is close enough and
 * it never fires by itself: the plan forbids arriving somewhere he did not
 * choose, and a proximity trigger is exactly that with a friendly face.
 */

export function TravelBar({
  reachable,
  onEnter,
}: {
  reachable: Place | null;
  onEnter: (place: Place) => void;
}) {
  const { prefs, setPref, goTo, rememberCamera } = useV2();

  return (
    <>
      {reachable ? (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 flex justify-center">
          <button
            type="button"
            onClick={() => onEnter(reachable)}
            className="pointer-events-auto flex flex-col items-center gap-1 rounded-2xl border px-5 py-3 text-center backdrop-blur-md transition-colors hover:brightness-125"
            style={{
              borderColor: `${SELECTION_COLOR}66`,
              backgroundColor: "rgba(10,16,24,.86)",
              color: SELECTION_COLOR,
            }}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-70">
              In Reichweite · Enter
            </span>
            <span className="text-sm font-medium">{reachable.name} betreten</span>
            <span className="text-[11px] text-white/55">{reachable.hint}</span>
          </button>
        </div>
      ) : null}

      <div className="pointer-events-auto absolute bottom-20 left-1/2 z-30 flex -translate-x-1/2 w-[min(94vw,900px)] flex-wrap justify-center items-center gap-3 rounded-2xl border border-white/10 bg-[#0a1018]/90 px-4 py-2 backdrop-blur-md">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
          W A S D · Q E hoch/runter · Ziehen zum Umsehen · Shift schneller
        </span>

        <label className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
            Tempo
          </span>
          <input
            type="range"
            min={0.5}
            max={100}
            step={0.1}
            value={prefs.flightSpeed}
            onChange={(event) => setPref("flightSpeed", Number(event.target.value))}
            className="h-1 w-28 cursor-pointer appearance-none rounded-full bg-white/15 accent-cyan-300"
            aria-label="Fluggeschwindigkeit"
          />
          <span className="w-8 font-mono text-[10px] text-white/55">
            {prefs.flightSpeed.toFixed(1)}×
          </span>
        </label>

        <button type="button" onClick={() => setPref("flightSpeed", prefs.flightSpeed > 3 ? 1.4 : 12)} className="rounded-xl border border-cyan-200/25 px-3 py-1.5 text-xs text-cyan-100">{prefs.flightSpeed > 3 ? "Präzision" : "Hyperflug"}</button>
        <button type="button" onClick={() => {
          rememberCamera("universe", new THREE.Vector3(0, 300, 650), new THREE.Vector3(0, 0, 0));
          goTo("universe", "direct");
        }} className="rounded-xl border border-white/15 px-3 py-1.5 text-xs text-white/70">Weitblick</button>
        {[50, 100].map(rate => <button key={rate} type="button" aria-pressed={prefs.flightSpeed === rate} onClick={() => setPref("flightSpeed", rate)} className="rounded-xl border border-violet-200/25 px-3 py-1.5 text-xs text-violet-100 aria-pressed:bg-violet-300/20">{rate}×</button>)}

        {/* Der Ritt. Er steht bewusst neben den Tempoknöpfen und trägt seine
            Ehrlichkeit im Untertitel: hier bewegt sich nichts ausser dem Bild.
            Ohne den Zusatz wäre es die einzige Stelle in V2, an der eine
            Anzeige etwas behauptet, das nicht passiert. */}
        <button
          type="button"
          aria-pressed={prefs.hyperRide}
          onClick={() => {
            const next = !prefs.hyperRide;
            setPref("hyperRide", next);
            if (next) playHyperJump(prefs.sound);
          }}
          className="flex flex-col items-center rounded-xl border border-white/20 px-3 py-1 text-white/75 transition-colors aria-pressed:bg-white/12 aria-pressed:text-white"
        >
          <span className="text-xs">{prefs.hyperRide ? "⚡ Hyperlicht aktiv" : "⚡ Hyperlicht"}</span>
          <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/40">
            Taste H · Warp
          </span>
        </button>
        {/* Always here, always the same button. The way back is the one thing
            in this world that must never depend on where he has got to. */}
        <button
          type="button"
          onClick={() => goTo("home")}
          className="rounded-xl border border-white/12 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/70 transition-colors hover:bg-white/8 hover:text-white"
        >
          Heimkehr
        </button>
      </div>
    </>
  );
}
