"use client";

import { useState, useRef, useEffect } from "react";
import { JarvisHologramFace } from "./JarvisHologramFace";
import { JarvisArcReactor } from "./JarvisArcReactor";
import { JarvisNeuralBeam } from "./JarvisNeuralBeam";
import { jarvisAudio } from "./jarvisAudio";

export type JarvisAvatarMode = "face" | "core";
export type JarvisPhase = "idle" | "scanning" | "thinking" | "speaking";

export interface JarvisCompanionProps {
  /** Optionaler Callback bei Sprung zu einer Notiz / einem Areal */
  onFlyToNote?: (id: string) => void;
  /** Optionaler Callback zum Wechseln der 3D-Welt */
  onNavigateWorld?: (world: "home" | "cosmos" | "projects" | "tesseract" | "saturn" | "library") => void;
  /** Aktuelle Welt für Kontext */
  currentWorld?: string;
}

/**
 * Jarvis Global Companion (Unten Rechts)
 *
 * Überall auf jedem Bildschirm verfügbar, vollständig ausblendbar/minimierbar.
 * Bietet die beiden geforderten Modi:
 * 1. Hologramm-Roboter-KI-Gesicht
 * 2. Animierter Quantum Arc Reactor Core
 * Bei Interaktion verbindet er sich per Neural Beam mit dem Gehirn (Index)
 * und führt einen spektakulären Scan durch.
 */
export function JarvisCompanion({
  onFlyToNote,
  onNavigateWorld,
  currentWorld = "cosmos",
}: JarvisCompanionProps) {
  // Lokale Persistenz für Modus und Minimierungszustand
  const [mode, setMode] = useState<JarvisAvatarMode>("face");
  const [isMinimized, setIsMinimized] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<JarvisPhase>("idle");
  const [query, setQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [citedNotes, setCitedNotes] = useState<Array<{ id: string; title: string }>>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Sound beim Moduswechsel
  const handleToggleMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    jarvisAudio.playModeSwitch();
    setMode((prev) => (prev === "face" ? "core" : "face"));
  };

  // Minimieren / Wiederherstellen
  const handleToggleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    jarvisAudio.playBlip();
    setIsMinimized((prev) => !prev);
    if (!isMinimized) setIsOpen(false);
  };

  // Konsole öffnen / schließen
  const handleToggleOpen = () => {
    jarvisAudio.playChime();
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => inputRef.current?.focus(), 150);
      }
      return next;
    });
  };

  // Scan & Frage ausführen
  const executeQuery = (textToQuery?: string) => {
    const q = textToQuery || query;
    if (!q.trim() && !textToQuery) return;

    // Scan-Phase & Audio triggern
    setIsScanning(true);
    setPhase("scanning");
    jarvisAudio.playScanSweep();
    jarvisAudio.startBeamSound();

    setTimeout(() => {
      jarvisAudio.stopBeamSound();
      setPhase("thinking");
    }, 1200);

    setTimeout(() => {
      setPhase("speaking");
      jarvisAudio.playChime(1.15);

      // Kontextuelle synthetisierte Antwort
      if (q.toLowerCase().includes("singular") || q.toLowerCase().includes("erfolg") || q.toLowerCase().includes("projekt")) {
        setResponse(
          "Project Singularity analysiert: Das Schwarze Loch fungiert als motivierender Erfolgsmagnet. 4 Projekte sind im inneren Orbit (Reifegrad > 80%). Bei 100% erfolgt der Übergang in den 4D-Tesserakt-Erfolgsraum zur ewigen Bewahrung."
        );
        setCitedNotes([
          { id: "hermes-singularity", title: "Hermes3D – Project Singularity als motivierender Erfolgssammler" },
          { id: "hermes-umsetzungsplan", title: "Hermes 3D – Umsetzungsplan nach Priorität 2026-09-04" },
        ]);
      } else if (q.toLowerCase().includes("index") || q.toLowerCase().includes("system") || q.toLowerCase().includes("regel")) {
        setResponse(
          "Index-Architektur gescannt: Kanonische Wahrheit liegt in AGENTS.md. 01 RAW ist unveränderlich. Das Wiki umfasst 03 Identität bis 09 Ideenparkplatz. Alle Pfade konsistent."
        );
        setCitedNotes([
          { id: "agents-rule", title: "AGENTS.md – Betriebsanleitung für Onurs LifeOS" },
          { id: "index-nav", title: "Index.md – Kanonische Inhaltsnavigation" },
        ]);
      } else {
        setResponse(
          `Neuronale Matrix durchsucht nach "${q}": 184 Wissensknoten synchronisiert. Verbindung zum Second Brain steht stabil.`
        );
        setCitedNotes([
          { id: "wiki-lifeos", title: "Second Brain – LifeOS Architektur" },
          { id: "uebergabe", title: "02⚙️ System/Übergabe.md" },
        ]);
      }
      setIsScanning(false);
    }, 2400);

    setTimeout(() => {
      setPhase("idle");
    }, 5500);
  };

  return (
    <>
      {/* Visueller Laser- & Scanstrahl zum 3D-Gehirn / Index */}
      <JarvisNeuralBeam
        active={isScanning}
        targetLabel={currentWorld === "cosmos" ? "INDEX: SECOND BRAIN [0, 0, 0]" : "NEURAL CORE DOCK"}
        onComplete={() => setIsScanning(false)}
      />

      {/* Haupt-Container unten rechts */}
      <aside
        aria-label="Jarvis Companion"
        className="pointer-events-auto fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 select-none"
      >
        {/* Holographisches Dialog-Cockpit (wenn geöffnet) */}
        {isOpen && !isMinimized && (
          <section className="relative w-[min(480px,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#070d14]/95 p-4 shadow-[0_12px_45px_rgba(0,0,0,0.8),0_0_30px_rgba(0,240,255,0.15)] backdrop-blur-xl transition-all duration-300">
            {/* Hologramm-Kopfzeile */}
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="h-2 w-2 animate-ping rounded-full bg-cyan-400" />
                <div>
                  <h3 className="font-mono text-xs font-bold tracking-wider text-cyan-300 uppercase">
                    JARVIS // Second Brain Interface
                  </h3>
                  <p className="font-mono text-[10px] text-cyan-200/50">
                    Modus: {mode === "face" ? "Hologram AI Face" : "Quantum Arc Core"} · Status: {phase}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-lg border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 hover:text-white"
                title="Schließen"
              >
                ✕
              </button>
            </div>

            {/* Quick-Action Chips */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setQuery("Scanne Second Brain und Index nach aktuellem Wissensstand");
                  executeQuery("Scanne Second Brain und Index nach aktuellem Wissensstand");
                }}
                className="rounded-full border border-cyan-500/30 bg-cyan-950/40 px-2.5 py-1 font-mono text-[10px] text-cyan-200 hover:border-cyan-400 hover:bg-cyan-900/60"
              >
                🧠 Gehirn & Index scannen
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuery("Projekt Singularität Reifegrade prüfen");
                  executeQuery("Projekt Singularität Reifegrade prüfen");
                }}
                className="rounded-full border border-cyan-500/30 bg-cyan-950/40 px-2.5 py-1 font-mono text-[10px] text-cyan-200 hover:border-cyan-400 hover:bg-cyan-900/60"
              >
                🌌 Singularität (Erfolgsmagnet)
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuery("Kanonische Regeln und AGENTS.md prüfen");
                  executeQuery("Kanonische Regeln und AGENTS.md prüfen");
                }}
                className="rounded-full border border-cyan-500/30 bg-cyan-950/40 px-2.5 py-1 font-mono text-[10px] text-cyan-200 hover:border-cyan-400 hover:bg-cyan-900/60"
              >
                🛡️ AGENTS.md & Regeln
              </button>
            </div>

            {/* Eingabefeld */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                executeQuery();
              }}
              className="mt-3 flex gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Frag dein Second Brain / Jarvis..."
                className="flex-1 rounded-xl border border-cyan-500/40 bg-[#03070c]/80 px-3 py-2 font-mono text-xs text-white placeholder-cyan-200/30 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
              />
              <button
                type="submit"
                disabled={isScanning}
                className="flex items-center gap-1.5 rounded-xl border border-cyan-400 bg-cyan-500/20 px-3.5 py-2 font-mono text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/30 active:scale-95 disabled:opacity-50"
              >
                {isScanning ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <span>SCAN ⚡</span>
                )}
              </button>
            </form>

            {/* Antwort-Box */}
            {response && (
              <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 font-mono text-xs leading-relaxed text-cyan-100 shadow-inner">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-400">
                  <span>JARVIS SYNTHESE:</span>
                </div>
                <p className="mt-1 text-slate-200">{response}</p>

                {citedNotes.length > 0 && (
                  <div className="mt-2.5 border-t border-cyan-500/20 pt-2">
                    <span className="text-[10px] text-cyan-400/70">ZITIERTE QUELLEN:</span>
                    <div className="mt-1 flex flex-col gap-1">
                      {citedNotes.map((note) => (
                        <button
                          key={note.id}
                          type="button"
                          onClick={() => onFlyToNote?.(note.id)}
                          className="flex items-center gap-1.5 text-left text-[11px] text-cyan-300 hover:text-white hover:underline"
                        >
                          <span className="text-[10px]">↗</span>
                          <span>{note.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Untere Button-Leiste: Avatar Orb + Steuerung */}
        <div className="flex items-center gap-2">
          {/* Minimieren / Ausblenden Schalter */}
          <button
            type="button"
            onClick={handleToggleMinimize}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-500/30 bg-[#0a1018]/80 text-[11px] text-cyan-300 shadow-lg backdrop-blur-md transition hover:border-cyan-400 hover:bg-cyan-500/20"
            title={isMinimized ? "Jarvis ausklappen" : "Jarvis minimieren"}
          >
            {isMinimized ? "➕" : "➖"}
          </button>

          {/* Minimierter Zustand: Kompakte Glüh-Kapsel */}
          {isMinimized ? (
            <button
              type="button"
              onClick={handleToggleMinimize}
              className="flex items-center gap-2 rounded-full border border-cyan-400/50 bg-[#0a1018]/90 px-3 py-1.5 shadow-[0_0_15px_rgba(0,240,255,0.3)] backdrop-blur-md transition hover:border-cyan-300 hover:scale-105"
            >
              <span className="h-2 w-2 animate-ping rounded-full bg-cyan-400" />
              <span className="font-mono text-xs font-bold tracking-wider text-cyan-300">
                JARVIS
              </span>
            </button>
          ) : (
            /* Ausgeklappter Zustand: Avatar Orb + Modus-Umschalter */
            <div className="flex items-center gap-2">
              {/* Modus-Umschaltknopf: [🤖 Gesicht] <-> [⚛️ Core] */}
              <button
                type="button"
                onClick={handleToggleMode}
                className="group flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-[#0a1018]/80 px-2.5 py-1 font-mono text-[10px] text-cyan-300 shadow-lg backdrop-blur-md transition hover:border-cyan-400 hover:bg-cyan-500/20"
                title="Avatar-Modus umschalten (Hologramm-Gesicht vs. Arc Reactor)"
              >
                <span>{mode === "face" ? "🤖 Gesicht" : "⚛️ Core"}</span>
                <span className="text-[8px] text-cyan-400/50 group-hover:text-cyan-300">⇄</span>
              </button>

              {/* Interaktiver Avatar-Orb (Klick öffnet Cockpit) */}
              <button
                type="button"
                onClick={handleToggleOpen}
                className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-cyan-400/60 bg-[#070d14]/90 p-1 shadow-[0_0_25px_rgba(0,240,255,0.35)] backdrop-blur-xl transition hover:scale-105 hover:border-cyan-300 hover:shadow-[0_0_35px_rgba(0,240,255,0.6)] active:scale-95"
                title="Jarvis öffnen (Klick)"
              >
                {/* Äußerer subtiler Puls-Ring */}
                <div className="pointer-events-none absolute -inset-1 animate-pulse rounded-full border border-cyan-400/20" />

                {/* Gewählter Avatar */}
                {mode === "face" ? (
                  <JarvisHologramFace size={72} active={isOpen} phase={phase} />
                ) : (
                  <JarvisArcReactor size={72} active={isOpen} phase={phase} />
                )}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
