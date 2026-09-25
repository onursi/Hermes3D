"use client";

import { useState, useEffect } from "react";
import { useV2 } from "../state";

export type SpeechEntry = {
  id: string;
  agentId: "astra" | "codex" | "claude" | "deep" | "onur";
  agentName: string;
  color: string;
  badge: string;
  text: string;
  time: string;
};

const INITIAL_TRANSCRIPT: SpeechEntry[] = [
  {
    id: "1",
    agentId: "astra",
    agentName: "ASTRA",
    color: "#38bdf8",
    badge: "Lead Architekt",
    text: "Das Konsil V1 etabliert die direkte Mehr-Agenten-Arena. Jedes Argument wird über den zentralen KERN geroutet.",
    time: "20:14",
  },
  {
    id: "2",
    agentId: "codex",
    agentName: "CODEX",
    color: "#f59e0b",
    badge: "System Engineer",
    text: "Three.js Performance-Garantie: 60 FPS, Draw-Calls minimiert, VAD-Audio-Interrupt schaltet alle Laser in unter 12ms stumm.",
    time: "20:15",
  },
  {
    id: "3",
    agentId: "claude",
    agentName: "CLAUDE",
    color: "#a855f7",
    badge: "Diskurs & Reflexion",
    text: "Die 3D-Welten für Bukhari 79 (Drei Böden) müssen architektonisch erhaben sein: Fruchtbare Oase, Zisterne und Sanddüne.",
    time: "20:16",
  },
  {
    id: "4",
    agentId: "deep",
    agentName: "DEEP",
    color: "#10b981",
    badge: "Synthese & Konsens",
    text: "Konsensstand erreicht bei 84%. Wir warten auf Onurs finale Freigabe über das offene Mikrofon.",
    time: "20:17",
  },
];

export function CouncilHud() {
  const { goTo } = useV2();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<"astra" | "codex" | "claude" | "deep">("astra");
  const [transcript, setTranscript] = useState<SpeechEntry[]>(INITIAL_TRANSCRIPT);
  const [consensus, setConsensus] = useState(84);
  const [round, setRound] = useState(3);

  // Toggle Onur VAD speaking state
  const handleToggleMic = () => {
    const next = !isSpeaking;
    setIsSpeaking(next);
    window.dispatchEvent(new CustomEvent("hermes:vad-speech", { detail: { active: next } }));

    if (next) {
      // Add Onur speech entry
      setTranscript((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          agentId: "onur",
          agentName: "ONUR",
          color: "#fbbf24",
          badge: "Executive / Chef",
          text: "Konsil angehalten: Ich übernehme das Wort. Priorität hat die saubere Integration ohne Astras Pfad zu berühren.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  };

  const handleNextSpeaker = (id: "astra" | "codex" | "claude" | "deep") => {
    setActiveSpeaker(id);
    window.dispatchEvent(new CustomEvent("hermes:council-speaker", { detail: { speaker: id } }));
  };

  const handleNextRound = () => {
    setRound((r) => r + 1);
    setConsensus((c) => Math.min(100, c + 5));
    const speakers: ("astra" | "codex" | "claude" | "deep")[] = ["astra", "codex", "claude", "deep"];
    const next = speakers[(speakers.indexOf(activeSpeaker) + 1) % speakers.length];
    handleNextSpeaker(next);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4 select-none">
      {/* Top Bar */}
      <header className="pointer-events-auto flex items-center justify-between rounded-2xl border border-white/10 bg-[#060b13]/85 px-5 py-3 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-widest text-sky-400 uppercase">HERMES KONSIL V1</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-mono text-emerald-400/90 tracking-wide">LIVE ARENA</span>
            </div>
            <div className="text-sm font-medium text-slate-200">
              Thema: Persistenz, Vault-Architektur & Hadith-Welten (Bukhari 79)
            </div>
          </div>
        </div>

        {/* Center Progress & Consensus */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Konsens</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">{consensus}%</span>
          </div>
          <div className="h-2 w-32 rounded-full bg-slate-800 overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${consensus}%` }}
            />
          </div>
          <div className="text-xs text-slate-400 font-mono border-l border-white/10 pl-3">
            Runde <span className="text-amber-400 font-bold">{round}</span>/5
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => goTo("home")}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 transition-colors"
          >
            ← Zurück zum Deck
          </button>
        </div>
      </header>

      {/* Middle Grid: Transcript & Speaker Selector */}
      <div className="pointer-events-none my-auto flex justify-between gap-4 max-w-full">
        {/* Left: Steno Transcript Widget */}
        <div className="pointer-events-auto w-88 md:w-96 rounded-2xl border border-white/10 bg-[#060b13]/85 p-4 shadow-2xl backdrop-blur-xl flex flex-col max-h-[50vh]">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <span className="text-xs font-bold tracking-wider text-slate-300 uppercase flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-400"></span>
              Live-Protokoll der Arena
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Auto-Scroll</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1 text-xs">
            {transcript.map((item) => (
              <div
                key={item.id}
                className={`p-2.5 rounded-xl border transition-all ${
                  item.agentId === "onur"
                    ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
                    : "bg-white/[0.03] border-white/5 text-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[11px]" style={{ color: item.color }}>
                      {item.agentName}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                      {item.badge}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono">{item.time}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300/90">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Quick Speaker Trigger */}
        <div className="pointer-events-auto flex flex-col gap-2 self-center">
          <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase text-right pr-1">
            Redner wählen
          </span>
          {(["astra", "codex", "claude", "deep"] as const).map((agent) => (
            <button
              key={agent}
              onClick={() => handleNextSpeaker(agent)}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs font-medium backdrop-blur-md transition-all ${
                activeSpeaker === agent && !isSpeaking
                  ? "border-sky-400 bg-sky-500/20 text-white shadow-lg shadow-sky-500/20 scale-105"
                  : "border-white/10 bg-[#060b13]/80 text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor:
                    agent === "astra"
                      ? "#38bdf8"
                      : agent === "codex"
                      ? "#f59e0b"
                      : agent === "claude"
                      ? "#a855f7"
                      : "#10b981",
                }}
              />
              <span className="uppercase font-semibold tracking-wider">{agent}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Bar: Onur's Executive VAD OpenMic */}
      <footer className="pointer-events-auto flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#060b13]/90 p-3 shadow-2xl backdrop-blur-xl">
        {/* VAD OpenMic Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleMic}
            className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-bold tracking-wide transition-all shadow-lg ${
              isSpeaking
                ? "bg-amber-500 text-slate-950 shadow-amber-500/30 scale-105 ring-2 ring-amber-400 animate-pulse"
                : "bg-gradient-to-r from-sky-500/20 to-emerald-500/20 border border-sky-500/40 text-sky-300 hover:bg-sky-500/30"
            }`}
          >
            <span className="text-base">{isSpeaking ? "🎙️" : "🎤"}</span>
            <span>{isSpeaking ? "ONUR SPRICHT (VAD AKTIV)" : "OFFENES MIKROFON STARTEN"}</span>
          </button>

          {/* Audio Wave Visualizer Bars */}
          <div className="flex items-center gap-1 h-5 px-2">
            {[0.4, 0.8, 0.5, 0.9, 0.3, 0.7, 0.4].map((h, i) => (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-150 ${
                  isSpeaking ? "bg-amber-400 animate-pulse" : "bg-slate-700"
                }`}
                style={{
                  height: isSpeaking ? `${Math.max(4, h * 20)}px` : "4px",
                }}
              />
            ))}
          </div>

          <span className="text-[11px] text-slate-400 hidden lg:inline">
            {isSpeaking ? "Alle 4 Agenten halten inne und hören zu." : "Klick aktiviert Live-Intervention."}
          </span>
        </div>

        {/* Arena Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleNextRound}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 transition-colors"
          >
            <span>▶</span> Nächste Rede-Runde
          </button>
          <button
            onClick={() => {
              setConsensus(100);
              alert("Konsens zu 100% beschlossen! Synthese wurde im Protokoll gespeichert.");
            }}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors shadow-sm"
          >
            <span>✓</span> Synthese beschließen
          </button>
        </div>
      </footer>
    </div>
  );
}
