"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Activity,
  BookmarkPlus,
  CornerDownLeft,
  Loader2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ListChecks,
  Sunrise,
  X,
  Maximize2,
  Minimize2,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { JarvisHologramFace } from "./JarvisHologramFace";
import { JarvisArcReactor } from "./JarvisArcReactor";
import { JarvisNeuralBeam } from "./JarvisNeuralBeam";
import { jarvisAudio } from "./jarvisAudio";
import { useVoice } from "@/features/jarvis/useVoice";
import { cyberAudio } from "@/lib/sound/cyberAudio";

export type JarvisAvatarMode = "face" | "core";
export type JarvisPhase =
  | "idle"
  | "listening"
  | "searching"
  | "thinking"
  | "speaking"
  | "error";

export type JarvisSource = {
  id: string;
  title: string;
  folder: string;
  excerpt: string;
};

const KNOWLEDGE_PULSE_EVENT = "hermes:knowledge-pulse";

export interface JarvisCompanionProps {
  /** Wie viele Notizen der Vault enthält */
  noteCount?: number;
  /** Kameraflug zu einer Notiz im 3D-Gehirn */
  onFlyToSource?: (sourceId: string) => void;
  /** Signal an den 3D-Graph, welche Notizen zitiert wurden */
  onSourcesChange?: (sourceIds: string[]) => void;
  /** Aktuelle 3D-Welt */
  currentWorld?: string;
  /** Optionaler Callback zum Weltenwechsel */
  onNavigateWorld?: (world: "home" | "cosmos" | "projects" | "tesseract" | "saturn" | "library") => void;
}

/**
 * Jarvis Unified Global Companion
 *
 * Vereint die bisherigen getrennten Komponenten (Dock-Button + Floating-Widget)
 * zu einer einzigen, kanonischen Schnittstelle:
 * - Überall auf jedem Bildschirm verfügbar (unten rechts verankert)
 * - Minimierbar zu einem kompakten 40px HUD-Badge
 * - Umschaltbare Avatare: Hologram AI Face & Quantum Arc Reactor
 * - Volle Vault-Anbindung: Streaming-LLM (/api/jarvis/stream), Quellenzitate, Speichern in Inbox (/api/jarvis/remember)
 * - Sprachausgabe, Spracherkennung ("Hey Hermes"), Aufgaben-Extraktion
 * - Spektakulärer Mehrsektoren-Laser-Scan ins 3D-Gehirn mit prozeduralem Audio
 */
export function JarvisCompanion({
  noteCount = 0,
  onFlyToSource,
  onSourcesChange,
  currentWorld = "cosmos",
  onNavigateWorld,
}: JarvisCompanionProps) {
  // UI & Avatar Zustände
  const [mode, setMode] = useState<JarvisAvatarMode>("face");
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Jarvis Workflow Zustände
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<JarvisSource[]>([]);
  const [reason, setReason] = useState<string | null>(null);
  const [phase, setPhase] = useState<JarvisPhase>("idle");
  const [savedAs, setSavedAs] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [voiceReply, setVoiceReply] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Notiz-Vorschau & Aufgaben
  const [preview, setPreview] = useState<{ title: string; file: string; sources: string[] } | null>(null);
  const [candidates, setCandidates] = useState<string[] | null>(null);
  const [candidatesBusy, setCandidatesBusy] = useState(false);
  const [accepted, setAccepted] = useState<Record<string, "saving" | "done" | "failed">>({});

  const inputRef = useRef<HTMLInputElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<EventSource | null>(null);
  const busyRef = useRef(false);

  // Aufräumen bei Unmount
  useEffect(() => () => streamRef.current?.close(), []);

  // Quellen an übergeordneten Graphen melden
  const onSourcesChangeRef = useRef(onSourcesChange);
  useEffect(() => {
    onSourcesChangeRef.current = onSourcesChange;
  }, [onSourcesChange]);

  useEffect(() => {
    onSourcesChangeRef.current?.(sources.map((s) => s.id));
  }, [sources]);

  // Hauptabfrage an /api/jarvis/stream
  const ask = useCallback(
    (spoken?: string) => {
      const text = (spoken ?? question).trim();
      if (!text) return;
      if (phase === "searching" || phase === "thinking" || phase === "speaking") return;
      if (spoken) setQuestion(spoken);

      // Reset
      streamRef.current?.close();
      setAnswer("");
      setSources([]);
      setReason(null);
      setSavedAs(null);
      setPreview(null);
      setCandidates(null);
      setAccepted({});
      setPhase("searching");

      // Visueller & auditiver Laser-Scan ins Gehirn
      setIsScanning(true);
      jarvisAudio.playScanSweep();
      jarvisAudio.startBeamSound();

      setTimeout(() => {
        jarvisAudio.stopBeamSound();
      }, 1500);

      const source = new EventSource(`/api/jarvis/stream?q=${encodeURIComponent(text)}`);
      streamRef.current = source;

      source.addEventListener("state", (event) => {
        const p = JSON.parse((event as MessageEvent).data).phase as JarvisPhase;
        setPhase(p);
      });

      source.addEventListener("sources", (event) => {
        const found = JSON.parse((event as MessageEvent).data).sources ?? [];
        setSources(found);

        const ids = found
          .map((hit: { id?: string }) => hit.id)
          .filter((id: string | undefined): id is string => Boolean(id));

        if (ids.length > 0) {
          window.dispatchEvent(
            new CustomEvent(KNOWLEDGE_PULSE_EVENT, { detail: { ids } })
          );
        }
      });

      source.addEventListener("delta", (event) => {
        setAnswer((prev) => prev + JSON.parse((event as MessageEvent).data).text);
      });

      source.addEventListener("done", () => {
        setPhase("idle");
        setIsScanning(false);
        jarvisAudio.playChime(1.1);
        source.close();
      });

      source.addEventListener("error", (event) => {
        const raw = (event as MessageEvent).data;
        if (raw) {
          try {
            setReason(JSON.parse(raw).reason ?? "Kommunikationsfehler.");
          } catch {
            setReason("Kommunikationsfehler mit Second Brain.");
          }
          setPhase("error");
        } else {
          setPhase("idle");
        }
        setIsScanning(false);
        source.close();
      });
    },
    [question, phase]
  );

  // Spracherkennung
  const voice = useVoice({ onTranscript: (text) => ask(text) });

  const displayPhase: JarvisPhase = voice.listening
    ? "listening"
    : voice.speaking
    ? "speaking"
    : phase;

  // Antwort vorlesen (falls gewünscht)
  const spokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== "idle" || !answer || spokenRef.current === answer) return;
    spokenRef.current = answer;
    if (voice.supported && voiceReply) voice.speak(answer);
  }, [phase, answer, voice, voiceReply]);

  // Audio-Synthese Aktivitäten
  useEffect(() => {
    if (!soundOn) return;
    cyberAudio.setNeuralActivity(
      displayPhase === "listening"
        ? 0
        : displayPhase === "searching" || displayPhase === "thinking"
        ? 0.85
        : displayPhase === "speaking"
        ? 0.6
        : 0.12
    );
  }, [displayPhase, soundOn]);

  useEffect(() => {
    if (!soundOn) {
      cyberAudio.stopNeuralFiring();
      return;
    }
    cyberAudio.resume();
    cyberAudio.startNeuralFiring();
    return () => cyberAudio.stopNeuralFiring();
  }, [soundOn]);

  // Antwort nach unten scrollen während des Streamings
  useEffect(() => {
    if (!answerRef.current) return;
    if (phase === "speaking") {
      answerRef.current.scrollTop = answerRef.current.scrollHeight;
    } else if (phase === "idle" && answer) {
      answerRef.current.scrollTop = 0;
    }
  }, [answer, phase]);

  // Notiz vorschlagen
  const proposeNote = useCallback(async () => {
    if (!answer || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/jarvis/remember", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: answer, question, sources, preview: true }),
      });
      const data = await res.json();
      if (data.ok) {
        setPreview({ title: data.title, file: data.file, sources: data.sources ?? [] });
      } else {
        setReason(data.reason ?? "Vorschau fehlgeschlagen.");
      }
    } catch (error) {
      setReason(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }, [answer, question, sources, saving]);

  // Notiz in Inbox speichern
  const confirmNote = useCallback(async () => {
    if (!preview || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/jarvis/remember", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: answer, question, sources, title: preview.title }),
      });
      const data = await res.json();
      setSavedAs(data.ok ? data.file : null);
      if (data.ok) {
        setPreview(null);
        jarvisAudio.playChime(1.3);
      } else {
        setReason(data.reason ?? "Konnte nicht gespeichert werden.");
      }
    } catch (error) {
      setReason(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }, [preview, answer, question, sources, saving]);

  // Briefing abrufen ("Wie ist mein Stand?")
  const briefing = useCallback(async () => {
    if (busyRef.current) return;
    streamRef.current?.close();
    setAnswer("");
    setSources([]);
    setReason(null);
    setSavedAs(null);
    setPreview(null);
    setCandidates(null);
    setAccepted({});
    setQuestion("Wie ist mein Stand?");
    setPhase("thinking");

    setIsScanning(true);
    jarvisAudio.playScanSweep();
    jarvisAudio.startBeamSound();

    try {
      const res = await fetch("/api/briefing");
      const data = await res.json();
      if (data.ok && data.briefing) {
        setAnswer(data.briefing);
        jarvisAudio.playChime(1.15);
      } else {
        setReason(data.reason ?? "Kein Briefing erhalten.");
      }
    } catch (error) {
      setReason(error instanceof Error ? error.message : String(error));
    } finally {
      setPhase("idle");
      setIsScanning(false);
      jarvisAudio.stopBeamSound();
    }
  }, []);

  // Aufgaben aus Antwort suchen
  const findTasks = useCallback(async () => {
    if (!answer || candidatesBusy) return;
    setCandidatesBusy(true);
    setPreview(null);
    setCandidates(null);
    try {
      const res = await fetch("/api/jarvis/task-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: answer }),
      });
      const data = await res.json();
      setCandidates(data.candidates ?? []);
      if (!data.ok && data.reason) setReason(data.reason);
    } catch (error) {
      setReason(error instanceof Error ? error.message : String(error));
    } finally {
      setCandidatesBusy(false);
    }
  }, [answer, candidatesBusy]);

  const acceptCandidate = useCallback(async (line: string) => {
    setAccepted((prev) => ({ ...prev, [line]: "saving" }));
    try {
      const res = await fetch("/api/todoist/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: line }),
      });
      const data = await res.json();
      setAccepted((prev) => ({ ...prev, [line]: data.ok ? "done" : "failed" }));
    } catch {
      setAccepted((prev) => ({ ...prev, [line]: "failed" }));
    }
  }, []);

  // Modus umschalten
  const handleToggleMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    jarvisAudio.playModeSwitch();
    setMode((prev) => (prev === "face" ? "core" : "face"));
  };

  // Konsole öffnen / minimieren
  const handleToggleOpen = () => {
    jarvisAudio.playChime();
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsMinimized(false);
        setTimeout(() => inputRef.current?.focus(), 150);
      }
      return next;
    });
  };

  const handleToggleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    jarvisAudio.playBlip();
    setIsMinimized((prev) => !prev);
    if (!isMinimized) setIsOpen(false);
  };

  const busy = phase === "searching" || phase === "thinking" || phase === "speaking";
  busyRef.current = busy;

  // Avatar Phasen-Mapping
  const avatarPhase =
    phase === "searching"
      ? "scanning"
      : phase === "thinking"
      ? "thinking"
      : phase === "speaking" || phase === "listening"
      ? "speaking"
      : "idle";

  return (
    <>
      {/* Visueller Mehrsektoren-Laser- & Scanstrahl ins 3D-Gehirn */}
      <JarvisNeuralBeam
        active={isScanning}
        targetLabel={currentWorld === "cosmos" ? "INDEX: SECOND BRAIN [0, 0, 0]" : "NEURAL CORE DOCK"}
        onComplete={() => setIsScanning(false)}
      />

      {/* Haupt-Container unten rechts verankert */}
      <aside
        aria-label="Jarvis Unified Interface"
        className="pointer-events-auto fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 select-none"
      >
        {/* ============================================================ */}
        {/* VOLLUMFÄNGLICHE JARVIS KONSOLE (WENN GEÖFFNET)              */}
        {/* ============================================================ */}
        {isOpen && !isMinimized && (
          <section
            className={`relative flex flex-col overflow-hidden rounded-2xl border border-cyan-500/40 bg-[#070d14]/95 shadow-[0_16px_55px_rgba(0,0,0,0.85),0_0_35px_rgba(0,240,255,0.18)] backdrop-blur-xl transition-all duration-300 ${
              isExpanded
                ? "h-[min(780px,calc(100vh-6rem))] w-[min(760px,calc(100vw-2.5rem))]"
                : "h-[min(640px,calc(100vh-6rem))] w-[min(560px,calc(100vw-2.5rem))]"
            }`}
          >
            {/* Header: Cyber-Avatar + Telemetrie + Fenster-Steuerung */}
            <div className="relative flex flex-col border-b border-cyan-500/25 bg-gradient-to-b from-cyan-950/30 to-transparent p-3.5">
              <div className="flex items-center justify-between gap-3">
                {/* Avatar Umschalter & Mini-Vorschau */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleToggleMode}
                    className="group relative flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-950/40 px-2.5 py-1.5 transition-all hover:border-cyan-300 hover:bg-cyan-900/60 hover:shadow-[0_0_15px_rgba(0,240,255,0.3)]"
                    title="Zwischen Hologramm-KI-Gesicht und Quantum Arc Reactor wechseln"
                  >
                    <span className="font-mono text-xs font-bold text-cyan-300 group-hover:text-white">
                      {mode === "face" ? "🤖 FACE" : "⚡ CORE"}
                    </span>
                    <span className="rounded-full bg-cyan-400/20 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200">
                      Wechseln
                    </span>
                  </button>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 animate-ping rounded-full bg-cyan-400" />
                      <span className="font-mono text-xs font-extrabold tracking-wider text-cyan-300 uppercase">
                        JARVIS // HUD
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-cyan-200/60">
                      {noteCount} Notizen synchronisiert
                    </span>
                  </div>
                </div>

                {/* Zentraler Avatar */}
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/30 bg-[#03070d]/80 shadow-[inset_0_0_20px_rgba(0,240,255,0.15)]">
                  {mode === "face" ? (
                    <JarvisHologramFace size={74} active={busy || isScanning} phase={avatarPhase} />
                  ) : (
                    <JarvisArcReactor size={74} active={busy || isScanning} phase={avatarPhase} />
                  )}
                </div>

                {/* Fenster-Aktionen */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsExpanded((prev) => !prev)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-500/30 text-cyan-300/80 transition hover:bg-cyan-500/20 hover:text-white"
                    title={isExpanded ? "Standardgröße" : "Vollansicht / Erweitern"}
                  >
                    {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleMinimize}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-500/30 text-cyan-300/80 transition hover:bg-cyan-500/20 hover:text-white"
                    title="Minimieren"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-500/30 text-cyan-300/80 transition hover:bg-red-500/30 hover:text-red-200"
                    title="Schließen"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick-Scan Action Chips */}
            <div className="flex flex-wrap gap-1.5 border-b border-cyan-500/15 bg-black/30 px-3.5 py-2">
              <button
                type="button"
                onClick={() => {
                  setQuestion("Scanne Second Brain und Index nach aktuellem Wissensstand");
                  ask("Scanne Second Brain und Index nach aktuellem Wissensstand");
                }}
                className="rounded-full border border-cyan-500/30 bg-cyan-950/40 px-2.5 py-1 font-mono text-[10px] text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-900/60"
              >
                🧠 Gehirn & Index
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuestion("Projekt Singularität Reifegrade und nächste Schritte");
                  ask("Projekt Singularität Reifegrade und nächste Schritte");
                }}
                className="rounded-full border border-cyan-500/30 bg-cyan-950/40 px-2.5 py-1 font-mono text-[10px] text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-900/60"
              >
                🌌 Singularität (Erfolgsmagnet)
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuestion("Kanonische Regeln und AGENTS.md prüfen");
                  ask("Kanonische Regeln und AGENTS.md prüfen");
                }}
                className="rounded-full border border-cyan-500/30 bg-cyan-950/40 px-2.5 py-1 font-mono text-[10px] text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-900/60"
              >
                🛡️ AGENTS.md
              </button>
              <button
                type="button"
                onClick={() => void briefing()}
                className="rounded-full border border-amber-500/30 bg-amber-950/30 px-2.5 py-1 font-mono text-[10px] text-amber-200 transition hover:border-amber-400 hover:bg-amber-900/50"
              >
                🌅 Mein Stand (Briefing)
              </button>
            </div>

            {/* Eingabebereich + Audio-Toolbar */}
            <div className="border-b border-cyan-500/20 bg-black/40 p-3">
              <div className="flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-[#03070d]/90 px-3 py-2 focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-400/50">
                <input
                  ref={inputRef}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") ask();
                  }}
                  placeholder="Was möchtest du aus deinem Second Brain wissen?..."
                  className="min-w-0 flex-1 bg-transparent font-mono text-xs text-white placeholder-cyan-200/30 outline-none"
                />
                <button
                  type="button"
                  onClick={() => ask()}
                  disabled={busy || !question.trim()}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-cyan-400/60 bg-cyan-500/20 px-2.5 py-1 font-mono text-[11px] font-bold text-cyan-200 transition hover:bg-cyan-500/40 disabled:opacity-30"
                  title="Abfrage starten (Scan & Analyse)"
                >
                  {busy ? (
                    <Loader2 size={13} className="animate-spin text-cyan-300" />
                  ) : (
                    <>
                      <span>SCAN</span>
                      <CornerDownLeft size={12} />
                    </>
                  )}
                </button>
              </div>

              {/* Toolbar für Sprache & Klang */}
              <div className="mt-2.5 flex items-center gap-2">
                {voice.supported ? (
                  <button
                    type="button"
                    onClick={() => (voice.listening ? voice.stopListening() : voice.startListening())}
                    disabled={busy}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-[11px] font-medium transition disabled:opacity-30 ${
                      voice.listening
                        ? "border-green-400/50 bg-green-400/20 text-green-200"
                        : "border-cyan-500/30 bg-cyan-950/30 text-cyan-200 hover:border-cyan-400 hover:text-white"
                    }`}
                    title="Sprich deine Frage — die Erkennung läuft lokal im Browser"
                  >
                    {voice.listening ? <MicOff size={13} /> : <Mic size={13} />}
                    <span>{voice.listening ? "Hört zu…" : "Hey Hermes"}</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    if (voice.speaking) voice.stopSpeaking();
                    setVoiceReply((prev) => !prev);
                  }}
                  className={`inline-flex items-center rounded-xl border px-2.5 py-1.5 transition ${
                    voiceReply
                      ? "border-cyan-400 bg-cyan-400/20 text-cyan-200"
                      : "border-cyan-500/30 bg-cyan-950/20 text-cyan-400/60 hover:text-cyan-200"
                  }`}
                  title={voiceReply ? "Sprachausgabe aktiv" : "Sprachausgabe stumm"}
                >
                  {voiceReply ? <Volume2 size={14} /> : <VolumeX size={14} />}
                </button>

                <button
                  type="button"
                  onClick={() => setSoundOn((prev) => !prev)}
                  className={`inline-flex items-center rounded-xl border px-2.5 py-1.5 transition ${
                    soundOn
                      ? "border-violet-400 bg-violet-400/20 text-violet-200"
                      : "border-cyan-500/30 bg-cyan-950/20 text-cyan-400/60 hover:text-cyan-200"
                  }`}
                  title={soundOn ? "Klang des Gehirns aktiv" : "Klang des Gehirns stumm"}
                >
                  <Activity size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => void briefing()}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-xl border border-cyan-500/30 bg-cyan-950/20 px-2.5 py-1.5 font-mono text-[11px] text-cyan-300 transition hover:border-cyan-400 hover:text-white disabled:opacity-30"
                  title="Wie ist mein Stand? — Briefing abrufen"
                >
                  <Sunrise size={13} />
                  <span className="hidden sm:inline">Briefing</span>
                </button>
              </div>

              {voice.listening && voice.heard ? (
                <p className="mt-2 font-mono text-[11px] italic text-green-200/80">
                  „{voice.heard}“
                </p>
              ) : null}
            </div>

            {/* Antwort- & Quellen-Bereich */}
            <div ref={answerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {answer ? (
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/15 p-3.5 shadow-inner">
                  <div className="mb-2 flex items-center justify-between border-b border-cyan-500/20 pb-1.5">
                    <span className="font-mono text-[10px] font-bold text-cyan-300 uppercase">
                      JARVIS SYNTHESE // VAULT STREAM:
                    </span>
                    {phase === "speaking" ? (
                      <span className="flex items-center gap-1 font-mono text-[9px] text-cyan-400 animate-pulse">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                        STREAMING
                      </span>
                    ) : null}
                  </div>

                  <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-200">
                    {answer}
                    {phase === "speaking" ? (
                      <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse bg-cyan-400 align-middle" />
                    ) : null}
                  </p>
                </div>
              ) : null}

              {reason ? (
                <p className="mt-2 font-mono text-xs leading-relaxed text-amber-300">
                  {reason}
                </p>
              ) : null}

              {/* Aktionen nach Antwort: Merken & Aufgaben */}
              {answer && phase === "idle" ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void proposeNote()}
                    disabled={saving || Boolean(savedAs)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-950/40 px-3 py-1 font-mono text-[11px] font-medium text-cyan-200 transition hover:border-cyan-300 hover:text-white disabled:opacity-40"
                    title="Legt diese Antwort mit Frage und Quellen als Notiz in der Inbox ab"
                  >
                    <BookmarkPlus size={12} />
                    <span>{savedAs ? "✓ Im Vault abgelegt" : saving ? "Speichert…" : "In Inbox merken"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void findTasks()}
                    disabled={candidatesBusy}
                    className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-950/40 px-3 py-1 font-mono text-[11px] font-medium text-cyan-200 transition hover:border-cyan-300 hover:text-white disabled:opacity-40"
                    title="Sucht Aufgaben, die aus dieser Antwort folgen"
                  >
                    <ListChecks size={12} />
                    <span>{candidatesBusy ? "Sucht…" : "Aufgaben extrahieren"}</span>
                  </button>

                  {savedAs ? (
                    <span className="truncate font-mono text-[10px] text-cyan-400/60" title={savedAs}>
                      {savedAs}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {/* Notiz-Vorschau Dialog */}
              {preview ? (
                <div className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-3">
                  <p className="pb-1.5 font-mono text-[10px] font-semibold tracking-wider text-cyan-300 uppercase">
                    Vorschau: Speicherung in Inbox
                  </p>
                  <input
                    value={preview.title}
                    onChange={(e) =>
                      setPreview((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                    }
                    onKeyDown={(e) => e.stopPropagation()}
                    className="w-full rounded-lg border border-cyan-500/40 bg-black/60 px-2.5 py-1.5 font-mono text-xs text-white outline-none focus:border-cyan-300"
                  />
                  <p className="mt-1.5 truncate font-mono text-[10px] text-cyan-200/50" title={preview.file}>
                    {preview.file}
                  </p>
                  {preview.sources.length > 0 ? (
                    <p className="mt-1 font-mono text-[10px] text-cyan-200/50">
                      Verlinkt: {preview.sources.join(" · ")}
                    </p>
                  ) : null}
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void confirmNote()}
                      disabled={saving || !preview.title.trim()}
                      className="rounded-full border border-emerald-400/50 bg-emerald-500/20 px-3 py-1 font-mono text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40"
                    >
                      {saving ? "Speichert…" : "Bestätigen & Ablegen"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreview(null)}
                      className="font-mono text-[11px] text-cyan-400/60 hover:text-white"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Aufgaben-Vorschläge */}
              {candidates ? (
                <div className="mt-3 rounded-xl border border-cyan-500/20 bg-black/40 p-2.5">
                  {candidates.length === 0 ? (
                    <p className="font-mono text-[11px] text-cyan-200/50">
                      Keine konkreten Handlungsaufgaben aus der Antwort abgeleitet.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {candidates.map((line) => {
                        const state = accepted[line];
                        return (
                          <li key={line} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void acceptCandidate(line)}
                              disabled={Boolean(state)}
                              className="shrink-0 rounded-md border border-cyan-500/30 px-2 py-0.5 font-mono text-[10px] text-cyan-200 hover:border-emerald-400 hover:text-emerald-200 disabled:opacity-40"
                              title="In Todoist anlegen"
                            >
                              {state === "done" ? "✓" : state === "saving" ? "…" : state === "failed" ? "!" : "+ Todo"}
                            </button>
                            <span
                              className={`min-w-0 flex-1 truncate font-mono text-[11px] ${
                                state === "done" ? "text-cyan-200/40 line-through" : "text-slate-200"
                              }`}
                              title={line}
                            >
                              {line}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setCandidates((prev) => (prev ?? []).filter((entry) => entry !== line))
                              }
                              className="shrink-0 text-cyan-400/40 hover:text-white"
                              title="Verwerfen"
                            >
                              <X size={12} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}

              {/* Zitierte Quellen mit Kameraflug */}
              {sources.length > 0 ? (
                <div className="mt-4 border-t border-cyan-500/20 pt-2.5">
                  <p className="pb-1.5 font-mono text-[10px] font-bold tracking-wider text-cyan-400 uppercase">
                    Zitierte Vault-Quellen (Klicken für 3D-Kameraflug):
                  </p>
                  <ol className="space-y-1">
                    {sources.map((source, index) => (
                      <li key={source.id}>
                        <button
                          type="button"
                          onClick={() => onFlyToSource?.(source.id)}
                          className="flex w-full items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-950/30 px-2.5 py-1.5 text-left transition hover:border-cyan-400 hover:bg-cyan-900/50"
                          title={source.folder}
                        >
                          <span className="shrink-0 font-mono text-[10px] font-bold text-cyan-300">
                            [{index + 1}]
                          </span>
                          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-cyan-100">
                            {source.title}
                          </span>
                          <span className="shrink-0 font-mono text-[9px] text-cyan-300/50">
                            {source.folder}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {!busy && !answer && !reason && sources.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Sparkles size={24} className="text-cyan-400/40 mb-2 animate-pulse" />
                  <p className="max-w-[340px] font-mono text-[11px] leading-relaxed text-cyan-200/50">
                    Antworten kommen unmittelbar aus deinen {noteCount} Notizen — mit Live-Zitaten
                    und 3D-Kameraflug zu den Wissenssternen.
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        )}

        {/* ============================================================ */}
        {/* SCHWEBENDER BEGLEITER-KNOPF UNTEN RECHTS                      */}
        {/* ============================================================ */}
        <div className="flex items-center gap-2">
          {/* Minimierte Badge / Pill */}
          {isMinimized ? (
            <button
              type="button"
              onClick={handleToggleMinimize}
              className="flex items-center gap-2.5 rounded-full border border-cyan-400/60 bg-[#070d14]/95 px-3.5 py-1.5 shadow-[0_0_20px_rgba(0,240,255,0.3)] backdrop-blur-xl transition hover:scale-105 active:scale-95"
            >
              <div className="h-2 w-2 animate-ping rounded-full bg-cyan-400" />
              <span className="font-mono text-xs font-bold text-cyan-300">JARVIS HUD</span>
              <span className="font-mono text-[10px] text-cyan-200/60">{phase}</span>
            </button>
          ) : null}

          {/* Haupt-Avatar-Knopf (Hologramm Face / Quantum Arc Core) */}
          <div className="relative group">
            <button
              type="button"
              onClick={handleToggleOpen}
              className={`relative flex h-16 w-16 items-center justify-center rounded-2xl border transition-all duration-300 ${
                isOpen
                  ? "border-cyan-300 bg-[#070d14] shadow-[0_0_35px_rgba(0,240,255,0.6),inset_0_0_15px_rgba(0,240,255,0.3)] scale-105"
                  : "border-cyan-500/50 bg-[#070d14]/90 shadow-[0_0_20px_rgba(0,240,255,0.25)] hover:border-cyan-300 hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] hover:scale-105"
              }`}
              title={isOpen ? "Jarvis Konsole schließen" : "Jarvis Konsole öffnen (Klick)"}
            >
              {mode === "face" ? (
                <JarvisHologramFace size={56} active={isOpen || busy || isScanning} phase={avatarPhase} />
              ) : (
                <JarvisArcReactor size={56} active={isOpen || busy || isScanning} phase={avatarPhase} />
              )}

              {/* Status-Punkt */}
              <span
                className={`absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border border-black transition-colors ${
                  busy
                    ? "bg-amber-400 animate-ping"
                    : isOpen
                    ? "bg-cyan-300 shadow-[0_0_6px_#00f0ff]"
                    : "bg-emerald-400"
                }`}
              />
            </button>

            {/* Avatar-Modus-Wechsel-Mini-Knopf oben am Avatar */}
            <button
              type="button"
              onClick={handleToggleMode}
              className="absolute -top-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full border border-cyan-400/60 bg-[#070d14] text-[10px] text-cyan-300 shadow-md transition hover:scale-110 hover:border-cyan-200 hover:text-white"
              title={`Modus wechseln (aktuell: ${mode === "face" ? "Hologram Face" : "Quantum Arc Core"})`}
            >
              {mode === "face" ? "⚡" : "🤖"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
