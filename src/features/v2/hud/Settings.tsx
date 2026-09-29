"use client";

import {PanelWindow} from "./PanelWindow";
import { unlockAtmosphere } from "@/features/v2/atmosphereAudio";
import { useV2 } from "@/features/v2/state";
import { QUALITY_LABELS, detectQuality } from "@/features/v2/world/quality";

/**
 * Four sliders, and each one changes something you can see.
 *
 * The plan is explicit that only presentation preferences belong here — light,
 * motion, flight speed, and the one effect worth a switch. Device pixel ratio,
 * shadow maps and level of detail stay out: they are the system's job, and a
 * setting nobody can evaluate is a setting nobody should be shown.
 *
 * Stored locally, and nowhere else. These are display preferences, not state.
 */

export function Settings({ onClose }: { onClose: () => void }) {
  const { prefs, setPref } = useV2();

  return (
    <PanelWindow title="Darstellung" slot="settings" onClose={onClose}><div
      className="settings-window pointer-events-auto absolute inset-0 z-40 flex items-start justify-end bg-black/30 p-4 pt-16 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-[#0a1018]/96 p-5 shadow-[0_18px_60px_rgba(0,0,0,.6)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-300/70">
            Darstellung
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 hover:bg-white/5 hover:text-white/80"
          >
            Fertig
          </button>
        </div>

        <Slider
          label="Kernlicht"
          value={prefs.coreIntensity}
          min={0.3}
          max={1.6}
          step={0.05}
          format={(v) => `${Math.round(v * 100)} %`}
          onChange={(value) => setPref("coreIntensity", value)}
        />

        <Slider
          label="Fluggeschwindigkeit"
          value={prefs.flightSpeed}
          min={0.5}
          max={100}
          step={0.1}
          format={(v) => `${v.toFixed(1)}×`}
          onChange={(value) => setPref("flightSpeed", value)}
        />

        <label className="block text-[12px] text-white/70">
          Grafikqualität
          <select
            className="mt-1.5 block w-full rounded-lg border border-white/10 bg-[#0b1018] px-3 py-2 text-[13px] text-white/85"
            value={prefs.quality}
            onChange={(event) => setPref("quality", event.target.value as typeof prefs.quality)}
          >
            {(Object.keys(QUALITY_LABELS) as (keyof typeof QUALITY_LABELS)[]).map((key) => (
              <option key={key} value={key}>
                {QUALITY_LABELS[key]}{key === "auto" ? ` · erkannt: ${QUALITY_LABELS[detectQuality()].split(" (")[0]}` : ""}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-white/45">Kino: Schatten, Tiefe und Filmlook für starke Grafikkarten. Leicht schont Handy-Akku.</span>
        </label>

        <Toggle
          label="Leuchten"
          hint="Bloom auf leuchtenden Kanten. Aus ist der schnelle Rückfall."
          value={prefs.bloom}
          onChange={(value) => setPref("bloom", value)}
        />

        {/* Off until he switches it on, and the slider only appears once he
            has. A volume control on a muted app is an invitation to wonder
            whether it is really muted. */}
        <Toggle
          label="Ton"
          hint="Atmosphäre, Neuronenknistern und Flugtriebwerk. Jederzeit stumm schaltbar."
          value={prefs.sound > 0}
          onChange={(value) => { if (value) unlockAtmosphere(); setPref("sound", value ? 0.45 : 0); }}
        />

        {prefs.sound > 0 ? (
          <Slider
            label="Lautstärke"
            value={prefs.sound}
            min={0.1}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)} %`}
            onChange={(value) => setPref("sound", value)}
          />
        ) : null}

        <Toggle
          label="Bewegung reduzieren"
          hint="Kein Warp, direkter Wechsel. Folgt zunächst der Systemeinstellung."
          value={prefs.reducedMotion}
          onChange={(value) => setPref("reducedMotion", value)}
        />

        <p className="mt-4 border-t border-white/8 pt-3 font-mono text-[10px] leading-relaxed text-white/25">
          Nur Darstellung. Auflösung, Schatten und Detailstufen regelt das
          System selbst.
        </p>
      </div>
    </div></PanelWindow>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mt-5 block">
      <span className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">
          {label}
        </span>
        <span className="font-mono text-[11px] text-cyan-200/80">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 h-1 w-full accent-cyan-400"
      />
    </label>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">
          {label}
        </span>
        <span
          className={`relative h-5 w-9 rounded-full transition-colors ${
            value ? "bg-cyan-400/70" : "bg-white/12"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              value ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </span>
      </button>
      <p className="mt-1.5 text-[11px] leading-relaxed text-white/30">{hint}</p>
    </div>
  );
}
