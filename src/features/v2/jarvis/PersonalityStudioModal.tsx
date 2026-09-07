"use client";

import { useState, useRef, useEffect } from "react";
import { X, Volume2, Play, Pause, Square, Check, Sparkles, UserCheck } from "lucide-react";
import { Interactive3DFace } from "./Interactive3DFace";

export interface PersonaConfig {
  id: string;
  name: string;
  title: string;
  badge: string;
  voiceLabel: string;
  agentId: string;
  description: string;
  sampleText: string;
  docPath: string;
  accentColor: string;
}

export const PERSONAS: PersonaConfig[] = [
  {
    id: "hermes",
    name: "Hermes",
    title: "Der stoische Architekt",
    badge: "LifeOS Architekt",
    voiceLabel: "Conrad Neural (Souveräner Bariton)",
    agentId: "hermes",
    description: "Fokussiert, stoisch, lösungsorientiert. Behält den Überblick über alle Systeme, Prioritäten und Altlasten.",
    sampleText: "System bereit. Keine Hektik, Onur. Wir gehen die Altlasten Schritt für Schritt durch.",
    docPath: "05 🚀 Projekte/01 Hermes Agent OS/Personas/Hermes – Der stoische Architekt.md",
    accentColor: "#38bdf8",
  },
  {
    id: "jarvis",
    name: "Jarvis",
    title: "Kybernetischer Tech-Stratege",
    badge: "Stark Tech Executive",
    voiceLabel: "Killian Neural (Präziser Tech-Ton)",
    agentId: "jarvis",
    description: "Eloquent, hocheffizient, kybernetisch. Spezialist für Code, Telemetrie und Projekt-Singularität.",
    sampleText: "Jarvis-Protokoll aktiv. Alle Telemetrie-Werte im grünen Bereich. Reifegrad bei 98 Prozent.",
    docPath: "05 🚀 Projekte/01 Hermes Agent OS/Personas/Jarvis – Der kybernetische Tech-Stratege.md",
    accentColor: "#00f0ff",
  },
  {
    id: "astra",
    name: "Astra",
    title: "Kosmische Navigatorin",
    badge: "Orbital Navigator",
    voiceLabel: "Katja Neural (Warme, motivierende Stimme)",
    agentId: "astra",
    description: "Inspirierend, empathisch, visionär. Achtet auf mentale Klarheit, Energie, Ausdauer und langfristige Ziele.",
    sampleText: "Willkommen an Bord, Onur. Der Kosmos liegt vor uns. Halte deinen Fokus klar.",
    docPath: "05 🚀 Projekte/01 Hermes Agent OS/Personas/Astra – Die kosmische Navigatorin.md",
    accentColor: "#c084fc",
  },
  {
    id: "solana",
    name: "Solana",
    title: "Sokratischer Denker & Orakel",
    badge: "Deep Philosophy",
    voiceLabel: "Amala Neural (Sanfte, reflektierte Stimme)",
    agentId: "solana",
    description: "Sokratisch, hinterfragend, deep thinking. Bringt Ruhe rein, deckt blinde Flecken auf und reflektiert Grundannahmen.",
    sampleText: "Lass uns einen Schritt zurücktreten. Welche Annahme hinter dieser Entscheidung hast du noch nicht geprüft?",
    docPath: "05 🚀 Projekte/01 Hermes Agent OS/Personas/Solana – Der sokratische Denker.md",
    accentColor: "#fbbf24",
  },
];

export interface PersonalityStudioModalProps {
  currentPersonaId: string;
  onSelectPersona: (persona: PersonaConfig) => void;
  onClose: () => void;
}

export function PersonalityStudioModal({
  currentPersonaId,
  onSelectPersona,
  onClose,
}: PersonalityStudioModalProps) {
  const [activeId, setActiveId] = useState(currentPersonaId || "hermes");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Audio stoppen bei Unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlaySample = async (persona: PersonaConfig) => {
    if (playingId === persona.id && audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
        setPlayingId(null);
      }
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setIsLoadingAudio(true);
    setPlayingId(persona.id);

    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: persona.sampleText,
          agentId: persona.agentId,
        }),
      });

      if (!res.ok) throw new Error("Audio-Generierung fehlgeschlagen");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setPlayingId(null);
      };

      audio.onerror = () => {
        setPlayingId(null);
      };

      await audio.play();
    } catch (err) {
      console.error("Audio-Fehler:", err);
      setPlayingId(null);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handleChoose = (persona: PersonaConfig) => {
    setActiveId(persona.id);
    onSelectPersona(persona);
  };

  const activePersona = PERSONAS.find((p) => p.id === activeId) || PERSONAS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="relative flex h-[min(680px,calc(100vh-2rem))] w-[min(920px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a1018]/95 shadow-[0_25px_70px_rgba(0,0,0,0.9),0_0_35px_rgba(56,189,248,0.15)] backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-b from-cyan-950/25 via-[#0a1018]/80 to-transparent px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 animate-ping rounded-full bg-cyan-400" />
            <div>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] font-semibold text-white">
                Jarvis // Persönlichkeits- & Avatar-Studio
              </h2>
              <p className="font-sans text-xs text-white/50">
                Wähle die Stimme, Haltung und Wesensart deines Begleiters
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:bg-white/5 hover:text-white"
            title="Studio schließen"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content: 2 Columns */}
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-12">
          {/* Links: Persönlichkeitsauswahl */}
          <div className="flex flex-col overflow-y-auto border-b border-white/10 p-5 md:col-span-7 md:border-r md:border-b-0">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] font-semibold text-cyan-300">
                Verfügbare Persönlichkeiten
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-white/40">
                HD Neural-Stimmen
              </span>
            </div>

            <div className="space-y-3">
              {PERSONAS.map((persona) => {
                const isSelected = activeId === persona.id;
                const isPlaying = playingId === persona.id;

                return (
                  <div
                    key={persona.id}
                    onClick={() => handleChoose(persona)}
                    className={`group relative flex flex-col rounded-xl border p-3.5 transition-all cursor-pointer ${
                      isSelected
                        ? "border-cyan-400/50 bg-cyan-950/30 shadow-[0_0_20px_rgba(56,189,248,0.15)]"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs uppercase tracking-[0.12em] font-bold text-white">
                          {persona.name}
                        </span>
                        <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-200">
                          {persona.badge}
                        </span>
                      </div>

                      {isSelected ? (
                        <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] font-semibold text-cyan-300">
                          <Check size={13} />
                          Aktiv
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 font-sans text-xs text-white/60">
                      {persona.description}
                    </p>

                    <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-2.5">
                      <span className="font-mono text-[10px] text-white/50">
                        🎙️ {persona.voiceLabel}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlaySample(persona);
                        }}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition ${
                          isPlaying
                            ? "border-cyan-400/50 bg-cyan-400/20 text-cyan-100"
                            : "border-white/15 bg-[#0c1420]/80 text-cyan-200 hover:border-cyan-400/50 hover:text-white"
                        }`}
                        title="Hörprobe der Neuralstimme abspielen"
                      >
                        {isPlaying ? (
                          <>
                            <Square size={10} className="text-cyan-300 fill-current" />
                            <span>Stopp</span>
                          </>
                        ) : (
                          <>
                            <Play size={10} className="text-cyan-300 fill-current" />
                            <span>Hörprobe</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rechts: Interaktives 3D-Modell & Live-Vorschau */}
          <div className="relative flex flex-col items-center justify-between bg-gradient-to-b from-[#060a10] via-[#0a1018] to-[#0c1420] p-5 md:col-span-5">
            <div className="w-full text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-cyan-950/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-200">
                <Sparkles size={12} className="text-cyan-400" />
                <span>Interaktive 3D-Blickverfolgung</span>
              </div>
              <p className="mt-1.5 font-sans text-xs text-white/40">
                Bewege die Maus über das Gesicht oder drehe es per Klick & Ziehen
              </p>
            </div>

            {/* 3D Hologram Face Canvas */}
            <div className="relative my-2 flex h-64 w-64 items-center justify-center rounded-2xl border border-white/10 bg-[#060a10]/90 shadow-[inset_0_0_30px_rgba(56,189,248,0.12)]">
              <Interactive3DFace
                speaking={Boolean(playingId)}
                themeColor={activePersona.accentColor}
              />
            </div>

            {/* Aktive Persona Info Card */}
            <div className="w-full rounded-xl border border-white/10 bg-[#0a1018]/90 p-3 text-center">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] font-semibold text-cyan-300">
                Gewählt: {activePersona.name} ({activePersona.title})
              </span>
              <p className="mt-1 font-sans text-[11px] text-white/50">
                Verhaltens-Leitlinie liegt in:
                <br />
                <span className="font-mono text-[10px] text-cyan-400/70">
                  {activePersona.docPath.split("/").pop()}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 bg-black/40 px-6 py-3">
          <span className="font-sans text-xs text-white/45">
            Änderungen werden sofort für alle Antworten & Vorlesefunktionen übernommen.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-cyan-400/40 bg-cyan-400/15 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] font-semibold text-cyan-100 transition hover:bg-cyan-400/25 active:scale-95"
          >
            Übernehmen & Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
