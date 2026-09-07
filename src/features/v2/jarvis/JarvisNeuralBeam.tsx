"use client";

import { useEffect, useState } from "react";

export interface JarvisNeuralBeamProps {
  active: boolean;
  onComplete?: () => void;
  targetLabel?: string;
}

/**
 * Jarvis Neural Beam & Brain Scan Effect
 *
 * Visuelle Verbindung zwischen dem Jarvis-Knopf unten rechts und dem Gehirn/Index:
 * - Leuchtender Laser-/Synapsenstrahl mit vorwärts- und rückwärts fließenden Datenpaketen
 * - Zielerfassung am Index-Knoten im Gehirn mit drehender HUD-Zielmarkierung
 * - 3D-inspirierte sphärische Scan-Welle, die das neuronale Wissensnetz durchleuchtet
 */
export function JarvisNeuralBeam({
  active,
  onComplete,
  targetLabel = "INDEX: 02⚙️ SYSTEM",
}: JarvisNeuralBeamProps) {
  const [stage, setStage] = useState<"idle" | "connecting" | "scanning" | "transferring">("idle");
  const [pulseProgress, setPulseProgress] = useState(0);

  useEffect(() => {
    if (!active) {
      setStage("idle");
      return;
    }

    setStage("connecting");
    const t1 = setTimeout(() => setStage("scanning"), 400);
    const t2 = setTimeout(() => setStage("transferring"), 1400);
    const t3 = setTimeout(() => {
      setStage("idle");
      onComplete?.();
    }, 2600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [active, onComplete]);

  useEffect(() => {
    if (stage === "idle") return;
    let raf = 0;
    const loop = () => {
      setPulseProgress((p) => (p + 0.025) % 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [stage]);

  if (stage === "idle") return null;

  // Koordinaten: Start unten rechts (beim Jarvis-Knopf) -> Ziel Bildschirmmitte / Gehirn-Index
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <svg className="h-full w-full">
        <defs>
          {/* Laser-Glow-Filter */}
          <filter id="laser-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="glow" />
            <feComposite in="SourceGraphic" in2="glow" operator="over" />
          </filter>

          {/* Farbverlauf des Strahls */}
          <linearGradient id="beam-grad" x1="100%" y1="100%" x2="50%" y2="50%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
          </linearGradient>

          {/* Rückfluss-Gradient */}
          <linearGradient id="return-grad" x1="50%" y1="50%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* 1. Haupt-Energiestrahl */}
        <line
          x1="calc(100vw - 44px)"
          y1="calc(100vh - 44px)"
          x2="50%"
          y2="46%"
          stroke="rgba(0, 240, 255, 0.25)"
          strokeWidth="14"
          filter="url(#laser-glow)"
        />
        <line
          x1="calc(100vw - 44px)"
          y1="calc(100vh - 44px)"
          x2="50%"
          y2="46%"
          stroke={stage === "transferring" ? "url(#return-grad)" : "url(#beam-grad)"}
          strokeWidth="3"
          filter="url(#laser-glow)"
        />
        <line
          x1="calc(100vw - 44px)"
          y1="calc(100vh - 44px)"
          x2="50%"
          y2="46%"
          stroke="#ffffff"
          strokeWidth="1.2"
        />

        {/* 2. Fließende Daten-Energiepakete entlang des Hauptstrahls */}
        {[0, 0.25, 0.5, 0.75].map((offset, idx) => {
          const t = (pulseProgress + offset) % 1;
          const isReturning = stage === "transferring";
          const prog = isReturning ? 1 - t : t;

          return (
            <circle
              key={idx}
              cx={`calc((100vw - 44px) + (50vw - (100vw - 44px)) * ${prog})`}
              cy={`calc((100vh - 44px) + (46vh - (100vh - 44px)) * ${prog})`}
              r={isReturning ? 4.5 : 3.5}
              fill={isReturning ? "#c084fc" : "#ffffff"}
              filter="url(#laser-glow)"
            />
          );
        })}

        {/* 3. Verzweigte Synapsen-Strahlen in die spezifischen Gehirn-Areale */}
        {(stage === "scanning" || stage === "transferring") && (
          <>
            {/* Areal 03/04: Identität & Lebensprofil (Links oben) */}
            <line
              x1="50%"
              y1="46%"
              x2="35%"
              y2="36%"
              stroke="rgba(232, 121, 249, 0.7)"
              strokeWidth="2"
              strokeDasharray="4 4"
              filter="url(#laser-glow)"
            />
            {/* Areal 05: Projekte (Rechts oben) */}
            <line
              x1="50%"
              y1="46%"
              x2="68%"
              y2="37%"
              stroke="rgba(52, 211, 153, 0.7)"
              strokeWidth="2"
              strokeDasharray="4 4"
              filter="url(#laser-glow)"
            />
            {/* Areal 07: Wissen (Zentrum oben) */}
            <line
              x1="50%"
              y1="46%"
              x2="50%"
              y2="28%"
              stroke="rgba(56, 189, 248, 0.85)"
              strokeWidth="2.5"
              filter="url(#laser-glow)"
            />
            {/* Areal 08/01: Quellen & RAW (Unten) */}
            <line
              x1="50%"
              y1="46%"
              x2="45%"
              y2="64%"
              stroke="rgba(251, 191, 36, 0.7)"
              strokeWidth="2"
              strokeDasharray="4 4"
              filter="url(#laser-glow)"
            />
            {/* Areal 06/09: Interessen & Parkplatz (Ganz rechts oben) */}
            <line
              x1="50%"
              y1="46%"
              x2="63%"
              y2="25%"
              stroke="rgba(163, 230, 53, 0.65)"
              strokeWidth="1.8"
              strokeDasharray="4 4"
              filter="url(#laser-glow)"
            />
          </>
        )}
      </svg>

      {/* 4. Areal-Scan-Knoten & Sektor-Markierungen im Gehirn */}
      {(stage === "scanning" || stage === "transferring") && (
        <>
          {/* Sektor 03: Identität */}
          <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: "35%", top: "36%" }}>
            <div className="relative flex h-14 w-14 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full border border-fuchsia-400/60" style={{ animationDuration: "1.4s" }} />
              <div className="h-2.5 w-2.5 rounded-full bg-fuchsia-300 shadow-[0_0_10px_#e879f9]" />
            </div>
            <div className="rounded border border-fuchsia-500/40 bg-[#0a1018]/90 px-1.5 py-0.5 font-mono text-[9px] text-fuchsia-300 shadow-md backdrop-blur-md">
              03🪪 IDENTITÄT (19)
            </div>
          </div>

          {/* Sektor 05: Projekte */}
          <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: "68%", top: "37%" }}>
            <div className="relative flex h-14 w-14 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full border border-emerald-400/60" style={{ animationDuration: "1.6s", animationDelay: "0.2s" }} />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_10px_#34d399]" />
            </div>
            <div className="rounded border border-emerald-500/40 bg-[#0a1018]/90 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300 shadow-md backdrop-blur-md">
              05🚀 PROJEKTE (58)
            </div>
          </div>

          {/* Sektor 07: Wissen */}
          <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: "50%", top: "28%" }}>
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full border border-cyan-400/80 shadow-[0_0_15px_rgba(0,240,255,0.6)]" style={{ animationDuration: "1.1s" }} />
              <div className="h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_12px_#00f0ff]" />
            </div>
            <div className="rounded border border-cyan-500/40 bg-[#0a1018]/90 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200 shadow-md backdrop-blur-md">
              07🧠 WISSEN (7)
            </div>
          </div>

          {/* Sektor 08: Quellen & RAW */}
          <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: "45%", top: "64%" }}>
            <div className="relative flex h-14 w-14 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full border border-amber-400/60" style={{ animationDuration: "1.5s", animationDelay: "0.4s" }} />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_10px_#fbbf24]" />
            </div>
            <div className="rounded border border-amber-500/40 bg-[#0a1018]/90 px-1.5 py-0.5 font-mono text-[9px] text-amber-300 shadow-md backdrop-blur-md">
              08📚 QUELLEN (69)
            </div>
          </div>
        </>
      )}

      {/* 5. Zentrales Index-Docking (Zentrum) */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: "50%", top: "46%" }}
      >
        {/* Drehende Ziel-Klammern */}
        <div className="relative flex h-24 w-24 items-center justify-center">
          <div
            className="absolute inset-0 animate-spin rounded-full border border-dashed border-cyan-400/60"
            style={{ animationDuration: "6s" }}
          />
          <div
            className="absolute inset-2 animate-spin rounded-full border-2 border-t-transparent border-r-cyan-300 border-b-transparent border-l-cyan-300"
            style={{ animationDuration: "2.5s", animationDirection: "reverse" }}
          />

          {/* Zentraler Docking-Point */}
          <div className="h-3 w-3 animate-ping rounded-full bg-cyan-300" />
          <div className="absolute h-2 w-2 rounded-full bg-white shadow-[0_0_12px_#00f0ff]" />

          {/* Sphärische Scan-Wellen (wenn im Scan-Stadium) */}
          {stage === "scanning" || stage === "transferring" ? (
            <>
              <div
                className="absolute -inset-20 animate-ping rounded-full border border-cyan-400/80 shadow-[0_0_25px_rgba(0,240,255,0.6)]"
                style={{ animationDuration: "1.2s" }}
              />
              <div
                className="absolute -inset-36 animate-ping rounded-full border border-cyan-300/40"
                style={{ animationDuration: "1.8s", animationDelay: "0.3s" }}
              />
            </>
          ) : null}
        </div>

        {/* HUD-Ziel-Label */}
        <div className="mt-2 flex flex-col items-center">
          <div className="rounded border border-cyan-500/40 bg-[#0a1018]/90 px-2 py-0.5 font-mono text-[10px] tracking-wider text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.3)] backdrop-blur-md">
            {stage === "connecting"
              ? "⚡ NEURAL DOCK ESTABLISHED"
              : stage === "scanning"
              ? "🧠 CORTICAL MULTI-SECTOR SCAN ACTIVE"
              : "📥 EXTRACTING KNOWLEDGE FROM 5 SECTORS"}
          </div>
          <div className="mt-0.5 font-mono text-[9px] text-cyan-200/60">{targetLabel}</div>
        </div>
      </div>
    </div>
  );
}
