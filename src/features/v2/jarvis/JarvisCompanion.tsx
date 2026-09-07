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
  Play,
  Pause,
  Square,
  Settings2,
  Check,
} from "lucide-react";
import { JarvisHologramFace } from "./JarvisHologramFace";
import { JarvisArcReactor } from "./JarvisArcReactor";
import { JarvisNeuralBeam } from "./JarvisNeuralBeam";
import { reportJarvisHead, setBeamActive } from "./beamAnchors";
import { jarvisAudio } from "./jarvisAudio";
import { useVoice } from "@/features/jarvis/useVoice";
import { cyberAudio } from "@/lib/sound/cyberAudio";
import { PersonalityStudioModal, PERSONAS, type PersonaConfig } from "./PersonalityStudioModal";

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
 * - Klick auf Avatar öffnet das 3D-Hologramm- & Persönlichkeits-Studio
 * - Echte Neural-Voice-Sprachsynthese (Azure / msedge-tts) mit Play/Pause/Stop
 * - Vollständige Typografie-Harmonie (font-sans) passend zum restlichen V2-UI
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

  // Persönlichkeit & Studio
  const [currentPersona, setCurrentPersona] = useState<PersonaConfig>(PERSONAS[0]);
  const [studioOpen, setStudioOpen] = useState(false);

  // Jarvis Workflow Zustände
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<JarvisSource[]>([]);

  /**
   * Wo Jarvis' Kopf gerade wirklich steht.
   *
   * Es gibt zwei: den grossen im geoeffneten Fenster und die Kugel unten
   * rechts, wenn zugeklappt ist. Welcher sichtbar ist, haengt vom Zustand ab —
   * und genau deshalb darf der Strahl nicht auf die Fensterecke rechnen. Beide
   * melden ihre gemessene Mitte; der groessere sichtbare gewinnt.
   */
  const kopfOffenRef = useRef<HTMLButtonElement>(null);
  const kopfKugelRef = useRef<HTMLButtonElement>(null);

  /**
   * Die stehende Verbindung — getrennt vom kurzen Scan.
   *
   * `isScanning` beschreibt den Vorgang und endet mit ihm: Ton aus, Status
   * zurueck auf bereit. Der Strahl soll aber bleiben, bis Onur ihn wegklickt.
   * Zwei Sachen, zwei Zustaende — vorher haette das Ausschalten des Tons auch
   * das Bild geloescht.
   */
  const [beamLive, setBeamLive] = useState(false);
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

  // Neural Voice Play/Pause/Stop Steuerung
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<EventSource | null>(null);
  const busyRef = useRef(false);

  // Aufräumen bei Unmount
  useEffect(() => {
    return () => {
      streamRef.current?.close();
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }
    };
  }, []);

  // Neural Voice Vorlesefunktion
  const speakText = useCallback(async (textToSpeak: string) => {
    const clean = textToSpeak.replace(/[*#_`[\]()]/g, "").trim();
    if (!clean) return;

    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }

    setAudioLoading(true);
    setIsPlayingAudio(true);
    setIsAudioPaused(false);

    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: clean,
          agentId: currentPersona.agentId,
        }),
      });

      if (!res.ok) throw new Error("Audio synthesis failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      ttsAudioRef.current = audio;

      audio.onended = () => {
        setIsPlayingAudio(false);
        setIsAudioPaused(false);
      };

      audio.onerror = () => {
        setIsPlayingAudio(false);
        setIsAudioPaused(false);
      };

      await audio.play();
    } catch (err) {
      console.warn("Neural TTS Error:", err);
      setIsPlayingAudio(false);
      setIsAudioPaused(false);
    } finally {
      setAudioLoading(false);
    }
  }, [currentPersona]);

  const pauseAudio = () => {
    if (ttsAudioRef.current && !ttsAudioRef.current.paused) {
      ttsAudioRef.current.pause();
      setIsAudioPaused(true);
    }
  };

  const resumeAudio = () => {
    if (ttsAudioRef.current && ttsAudioRef.current.paused) {
      ttsAudioRef.current.play();
      setIsAudioPaused(false);
    }
  };

  const stopAudio = () => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
    setIsPlayingAudio(false);
    setIsAudioPaused(false);
  };

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
      stopAudio();
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
      setBeamLive(true);
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

      let fullAnswerText = "";
      source.addEventListener("delta", (event) => {
        const chunk = JSON.parse((event as MessageEvent).data).text;
        fullAnswerText += chunk;
        setAnswer((prev) => prev + chunk);
      });

      source.addEventListener("done", () => {
        setPhase("idle");
        setIsScanning(false);
        jarvisAudio.playChime(1.1);
        source.close();

        // Wenn Vorlesen aktiviert ist, starte die hochauflösende Neural Voice
        if (voiceReply && fullAnswerText) {
          void speakText(fullAnswerText);
        }
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
    [question, phase, voiceReply, speakText]
  );

  // Spracherkennung ("Hey Hermes")
  const voice = useVoice({ onTranscript: (text) => ask(text) });

  const displayPhase: JarvisPhase = voice.listening
    ? "listening"
    : isPlayingAudio
    ? "speaking"
    : phase;

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
    stopAudio();
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
        if (voiceReply) {
          void speakText(data.briefing);
        }
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
  }, [voiceReply, speakText]);

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
      : phase === "speaking" || phase === "listening" || isPlayingAudio
      ? "speaking"
      : "idle";

  const statusLabel =
    busy ? "Denkt nach"
    : isScanning ? "Scannt Vault"
    : isPlayingAudio ? "Liest vor"
    : voice.listening ? "Hört zu"
    : "Bereit";

  /**
   * Die Messung des Kopfes, solange der Strahl laeuft.
   *
   * Pro Bild ein `getBoundingClientRect` auf zwei Knoepfen — das liest das
   * Layout, schreibt aber nichts, und laeuft nur waehrend der 2,6 Sekunden des
   * Strahls. Ausserhalb davon meldet der Companion `null`, und der Strahl
   * zeichnet dann nichts, statt auf einen alten Punkt zu zeigen.
   */
  /**
   * Eine Flagge statt zweier Abhaengigkeiten.
   *
   * `isScanning` kippt mitten in der Abfrage zurueck auf false, waehrend
   * `beamLive` stehen bleibt. Stuenden beide in den Abhaengigkeiten, liefe der
   * Effekt genau dann neu — mit Aufraeumen — und der Strahl waere fuer ein Bild
   * geloescht. Zusammengefasst aendert sich der Wert in dem Moment gar nicht.
   */
  const messen = isScanning || beamLive;

  useEffect(() => {
    if (!messen) {
      setBeamActive(false);
      reportJarvisHead(null);
      return;
    }
    setBeamActive(true);

    /**
     * Gemessen wird gedrosselt, nicht in jedem Bild.
     *
     * `getBoundingClientRect` erzwingt eine Layoutberechnung. Waehrend der
     * Strahl nur 2,6 Sekunden lief, war das gleichgueltig. Seit die Verbindung
     * stehen bleibt, liefe es unbegrenzt weiter — und ein Kopf, der sich nur
     * bewegt, wenn das Fenster sich bewegt, braucht keine sechzig Messungen
     * pro Sekunde. Zwoelf reichen; dazwischen gilt der letzte Wert.
     */
    const ABSTAND_MS = 80;
    let zuletzt = 0;
    let raf = 0;
    const miss = () => {
      raf = requestAnimationFrame(miss);
      const jetzt = performance.now();
      if (jetzt - zuletzt < ABSTAND_MS) return;
      zuletzt = jetzt;

      let beste: { x: number; y: number; flaeche: number } | null = null;
      for (const ref of [kopfOffenRef, kopfKugelRef]) {
        const el = ref.current;
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const flaeche = r.width * r.height;
        if (flaeche <= 0) continue;
        if (!beste || flaeche > beste.flaeche) {
          beste = { x: r.left + r.width / 2, y: r.top + r.height / 2, flaeche };
        }
      }
      reportJarvisHead(beste ? { x: beste.x, y: beste.y } : null);
    };
    raf = requestAnimationFrame(miss);
    return () => {
      cancelAnimationFrame(raf);
      setBeamActive(false);
      reportJarvisHead(null);
    };
  }, [messen]);

  return (
    <>
      {/* Visueller Mehrsektoren-Laser- & Scanstrahl ins 3D-Gehirn */}
      <JarvisNeuralBeam
        active={beamLive}
        targetLabel={currentWorld === "cosmos" ? "KEINE QUELLE IM BILD" : "KEINE QUELLE IN DIESER WELT"}
        onDismiss={() => setBeamLive(false)}
      />

      {/* 3D Hologram & Personality Studio Modal */}
      {studioOpen ? (
        <PersonalityStudioModal
          currentPersonaId={currentPersona.id}
          onSelectPersona={(p) => {
            setCurrentPersona(p);
            jarvisAudio.playChime(1.2);
          }}
          onClose={() => setStudioOpen(false)}
        />
      ) : null}

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
            className={`relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a1018]/95 shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_35px_rgba(56,189,248,0.14)] backdrop-blur-xl transition-all duration-300 ${
              isExpanded
                ? "h-[min(780px,calc(100vh-6rem))] w-[min(760px,calc(100vw-2.5rem))]"
                : "h-[min(640px,calc(100vh-6rem))] w-[min(560px,calc(100vw-2.5rem))]"
            }`}
          >
            {/* Header: Cyber-Avatar + Telemetrie + Persönlichkeits-Studio + Fenster-Steuerung */}
            <div className="relative flex flex-col border-b border-white/10 bg-gradient-to-b from-cyan-950/25 via-[#0a1018]/80 to-transparent p-3.5">
              <div className="flex items-center justify-between gap-3">
                {/* Links: Modus & Persönlichkeit */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleMode}
                    className="group relative flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#0c1420]/80 px-2.5 py-1.5 transition-all hover:border-cyan-400/40 hover:bg-cyan-950/30"
                    title="Zwischen Hologramm-KI-Gesicht und Quantum Arc Reactor wechseln"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] font-semibold text-cyan-200 group-hover:text-white">
                      {mode === "face" ? "FACE" : "CORE"}
                    </span>
                    <span className="rounded-full bg-cyan-400/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-cyan-200">
                      {mode === "face" ? "🤖" : "⚡"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStudioOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#0c1420]/80 px-2.5 py-1.5 transition hover:border-cyan-400/40 hover:bg-cyan-950/30"
                    title="3D Hologramm & Persönlichkeits-Studio öffnen"
                  >
                    <Settings2 size={13} className="text-cyan-400" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/90">
                      {currentPersona.name}
                    </span>
                  </button>
                </div>

                {/* Zentraler Avatar (Klickbar für 3D-Studio) */}
                <button
                  ref={kopfOffenRef}
                  type="button"
                  onClick={() => setStudioOpen(true)}
                  className="group relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#060a10]/80 shadow-[inset_0_0_20px_rgba(56,189,248,0.15)] transition hover:border-cyan-400/40 hover:scale-105"
                  title="Klick: 3D Hologramm-Modell & Persönlichkeit anpassen"
                >
                  {mode === "face" ? (
                    <JarvisHologramFace size={74} active={busy || isScanning || isPlayingAudio} phase={avatarPhase} />
                  ) : (
                    <JarvisArcReactor size={74} active={busy || isScanning || isPlayingAudio} phase={avatarPhase} />
                  )}
                  <span className="absolute -bottom-1.5 rounded-full border border-white/10 bg-[#0a1018] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-200 group-hover:text-white opacity-95">
                    3D STUDIO
                  </span>
                </button>

                {/* Fenster-Aktionen */}
                <div className="flex items-center gap-1">
                  <span className="mr-2 hidden sm:inline font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300/70">
                    {noteCount} NOTIZEN
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsExpanded((prev) => !prev)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/50 transition hover:bg-white/5 hover:text-white"
                    title={isExpanded ? "Standardgröße" : "Vollansicht / Erweitern"}
                  >
                    {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleMinimize}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/50 transition hover:bg-white/5 hover:text-white"
                    title="Minimieren"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/50 transition hover:bg-red-500/20 hover:text-red-200"
                    title="Schließen"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick-Scan Action Chips (V2 Grundton, V2 Blau & V2 Typografie) */}
            <div className="flex flex-wrap gap-1.5 border-b border-white/10 bg-black/25 px-3.5 py-2">
              <button
                type="button"
                onClick={() => {
                  setQuestion("Scanne Second Brain und Index nach aktuellem Wissensstand");
                  ask("Scanne Second Brain und Index nach aktuellem Wissensstand");
                }}
                className="rounded-xl border border-white/10 bg-[#0c1420]/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/80 transition hover:border-cyan-400/40 hover:bg-cyan-400/15 hover:text-cyan-100"
              >
                🧠 GEHIRN & INDEX
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuestion("Projekt Singularität Reifegrade und nächste Schritte");
                  ask("Projekt Singularität Reifegrade und nächste Schritte");
                }}
                className="rounded-xl border border-white/10 bg-[#0c1420]/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/80 transition hover:border-cyan-400/40 hover:bg-cyan-400/15 hover:text-cyan-100"
              >
                🌌 SINGULARITÄT
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuestion("Kanonische Regeln und AGENTS.md prüfen");
                  ask("Kanonische Regeln und AGENTS.md prüfen");
                }}
                className="rounded-xl border border-white/10 bg-[#0c1420]/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/80 transition hover:border-cyan-400/40 hover:bg-cyan-400/15 hover:text-cyan-100"
              >
                🛡️ AGENTS.MD
              </button>
              <button
                type="button"
                onClick={() => void briefing()}
                className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-200 transition hover:border-amber-400/50 hover:bg-amber-400/20"
              >
                🌅 MEIN STAND
              </button>
            </div>

            {/* Eingabebereich + Audio-Toolbar */}
            <div className="border-b border-white/10 bg-black/30 p-3">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#060a10]/85 px-3 py-2 focus-within:border-cyan-400/50 focus-within:ring-1 focus-within:ring-cyan-400/30">
                <input
                  ref={inputRef}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") ask();
                  }}
                  placeholder="Was möchtest du aus deinem Second Brain wissen?..."
                  className="min-w-0 flex-1 bg-transparent font-sans text-xs text-white placeholder:text-white/30 outline-none"
                />
                <button
                  type="button"
                  onClick={() => ask()}
                  disabled={busy || !question.trim()}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-400/15 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] font-semibold text-cyan-100 transition hover:bg-cyan-400/25 disabled:opacity-30"
                  title="Abfrage starten (Scan & Analyse)"
                >
                  {busy ? (
                    <Loader2 size={12} className="animate-spin text-cyan-300" />
                  ) : (
                    <>
                      <span>SCAN</span>
                      <CornerDownLeft size={11} />
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
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition disabled:opacity-30 ${
                      voice.listening
                        ? "border-green-400/50 bg-green-400/20 text-green-200"
                        : "border-white/10 bg-[#0c1420]/80 text-white/70 hover:border-cyan-400/40 hover:text-cyan-100"
                    }`}
                    title="Sprich deine Frage — lokale Spracherkennung"
                  >
                    {voice.listening ? <MicOff size={12} /> : <Mic size={12} />}
                    <span>{voice.listening ? "Hört zu…" : "Hey Hermes"}</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    if (isPlayingAudio) stopAudio();
                    setVoiceReply((prev) => !prev);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition ${
                    voiceReply
                      ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-100"
                      : "border-white/10 bg-[#0c1420]/80 text-white/60 hover:text-white"
                  }`}
                  title={voiceReply ? "Automatisches Vorlesen aktiv" : "Automatisches Vorlesen aus"}
                >
                  {voiceReply ? <Volume2 size={13} /> : <VolumeX size={13} />}
                  <span className="hidden sm:inline">{voiceReply ? "Vorlesen an" : "Stumm"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSoundOn((prev) => !prev)}
                  className={`inline-flex items-center rounded-xl border px-2.5 py-1.5 transition ${
                    soundOn
                      ? "border-violet-400/50 bg-violet-400/20 text-violet-200"
                      : "border-white/10 bg-[#0c1420]/80 text-white/60 hover:text-white"
                  }`}
                  title={soundOn ? "Klang des Gehirns aktiv" : "Klang des Gehirns stumm"}
                >
                  <Activity size={13} />
                </button>

                <button
                  type="button"
                  onClick={() => void briefing()}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-[#0c1420]/80 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/70 transition hover:border-cyan-400/40 hover:text-cyan-100 disabled:opacity-30"
                  title="Wie ist mein Stand? — Briefing abrufen"
                >
                  <Sunrise size={12} />
                  <span className="hidden sm:inline">Briefing</span>
                </button>
              </div>

              {voice.listening && voice.heard ? (
                <p className="mt-2 font-sans text-xs italic text-cyan-200/90">
                  „{voice.heard}“
                </p>
              ) : null}

              {/* Neural Voice Audio Player Bar (Play / Pause / Stop) */}
              {isPlayingAudio ? (
                <div className="mt-2.5 flex items-center justify-between rounded-xl border border-cyan-400/30 bg-[#0c1624]/90 px-3 py-2 shadow-[0_0_20px_rgba(56,189,248,0.15)] backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      <span className="h-3 w-1 bg-cyan-400 animate-pulse rounded-full" />
                      <span className="h-4 w-1 bg-cyan-300 animate-pulse delay-75 rounded-full" />
                      <span className="h-2 w-1 bg-cyan-400 animate-pulse delay-150 rounded-full" />
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-100">
                      {isAudioPaused ? "Pausiert" : "Liest vor"}: {currentPersona.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isAudioPaused ? (
                      <button
                        type="button"
                        onClick={resumeAudio}
                        className="flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-400/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-100 hover:bg-cyan-400/30"
                        title="Wiedergabe fortsetzen"
                      >
                        <Play size={10} className="fill-current" />
                        <span>Fortsetzen</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={pauseAudio}
                        className="flex items-center gap-1 rounded-lg border border-amber-400/40 bg-amber-400/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-100 hover:bg-amber-400/30"
                        title="Wiedergabe pausieren"
                      >
                        <Pause size={10} className="fill-current" />
                        <span>Pausieren</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={stopAudio}
                      className="flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-red-200 hover:bg-red-500/30"
                      title="Vorlesen stoppen"
                    >
                      <Square size={9} className="fill-current" />
                      <span>Stopp</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Antwort- & Quellen-Bereich */}
            <div ref={answerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {answer ? (
                <div className="rounded-xl border border-white/10 bg-[#0c1624]/60 p-3.5 shadow-inner">
                  <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-1.5">
                    <span className="font-mono text-[10px] font-semibold text-cyan-300 uppercase tracking-[0.14em]">
                      {currentPersona.name} Synthese // Vault Stream:
                    </span>
                    <div className="flex items-center gap-2">
                      {!isPlayingAudio && !audioLoading ? (
                        <button
                          type="button"
                          onClick={() => void speakText(answer)}
                          className="flex items-center gap-1 rounded-md border border-white/10 bg-[#0a1018]/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-cyan-200 hover:border-cyan-400/40 hover:text-white"
                          title="Diese Antwort vorlesen lassen"
                        >
                          <Volume2 size={11} />
                          <span>Vorlesen</span>
                        </button>
                      ) : null}

                      {phase === "speaking" ? (
                        <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-400 animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                          STREAMING
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <p className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-slate-100">
                    {answer}
                    {phase === "speaking" ? (
                      <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse bg-cyan-400 align-middle" />
                    ) : null}
                  </p>
                </div>
              ) : null}

              {reason ? (
                <p className="mt-2 font-sans text-xs leading-relaxed text-amber-300">
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
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#0c1420]/80 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/85 transition hover:border-cyan-400/40 hover:bg-cyan-400/15 hover:text-cyan-100 disabled:opacity-40"
                    title="Legt diese Antwort mit Frage und Quellen als Notiz in der Inbox ab"
                  >
                    <BookmarkPlus size={12} />
                    <span>{savedAs ? "✓ Im Vault abgelegt" : saving ? "Speichert…" : "In Inbox merken"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void findTasks()}
                    disabled={candidatesBusy}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#0c1420]/80 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/85 transition hover:border-cyan-400/40 hover:bg-cyan-400/15 hover:text-cyan-100 disabled:opacity-40"
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
                <div className="mt-3 rounded-xl border border-white/10 bg-[#0a1018]/90 p-3">
                  <p className="pb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] font-semibold text-cyan-300">
                    Vorschau: Speicherung in Inbox
                  </p>
                  <input
                    value={preview.title}
                    onChange={(e) =>
                      setPreview((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                    }
                    onKeyDown={(e) => e.stopPropagation()}
                    className="w-full rounded-lg border border-white/10 bg-black/60 px-2.5 py-1.5 font-sans text-xs text-white outline-none focus:border-cyan-400/50"
                  />
                  <p className="mt-1.5 truncate font-mono text-[10px] text-cyan-200/50" title={preview.file}>
                    {preview.file}
                  </p>
                  {preview.sources.length > 0 ? (
                    <p className="mt-1 font-sans text-[11px] text-white/50">
                      Verlinkt: {preview.sources.join(" · ")}
                    </p>
                  ) : null}
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void confirmNote()}
                      disabled={saving || !preview.title.trim()}
                      className="rounded-xl border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] font-bold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40"
                    >
                      {saving ? "Speichert…" : "Bestätigen & Ablegen"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreview(null)}
                      className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/50 hover:text-white"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Aufgaben-Vorschläge */}
              {candidates ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/40 p-2.5">
                  {candidates.length === 0 ? (
                    <p className="font-sans text-xs text-white/50">
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
                              disabled={state === "saving" || state === "done"}
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                                state === "done"
                                  ? "border-emerald-400 bg-emerald-500/30 text-emerald-200"
                                  : state === "saving"
                                  ? "border-amber-400 bg-amber-500/30 text-amber-200"
                                  : "border-white/20 hover:border-cyan-400"
                              }`}
                              title={state === "done" ? "In Todoist gespeichert" : "Als Aufgabe übernehmen"}
                            >
                              {state === "done" ? <Check size={11} /> : state === "saving" ? "…" : null}
                            </button>
                            <span
                              className={`min-w-0 flex-1 truncate font-sans text-xs ${
                                state === "done" ? "line-through text-white/40" : "text-white/85"
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
                              className="shrink-0 text-white/40 hover:text-white"
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
                <div className="mt-4 border-t border-white/10 pt-2.5">
                  <p className="pb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] font-semibold text-cyan-300">
                    Zitierte Vault-Quellen (Klicken für 3D-Kameraflug):
                  </p>
                  <ol className="space-y-1">
                    {sources.map((source, index) => (
                      <li key={source.id}>
                        <button
                          type="button"
                          onClick={() => onFlyToSource?.(source.id)}
                          className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-[#0c1420]/80 px-2.5 py-1.5 text-left transition hover:border-cyan-400/50 hover:bg-cyan-950/40"
                          title={source.folder}
                        >
                          <span className="shrink-0 font-mono text-[10px] font-bold text-cyan-200">
                            [{index + 1}]
                          </span>
                          <span className="min-w-0 flex-1 truncate font-sans text-xs text-white/90">
                            {source.title}
                          </span>
                          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-cyan-300/50">
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
                  <Sparkles size={24} className="text-cyan-400/50 mb-2 animate-pulse" />
                  <p className="max-w-[340px] font-sans text-xs leading-relaxed text-white/55">
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
          {/* Minimierte Badge / Pill im V2-Design */}
          {isMinimized ? (
            <button
              type="button"
              onClick={handleToggleMinimize}
              className="flex items-center gap-2.5 rounded-full border border-white/10 bg-[#0a1018]/90 px-3.5 py-1.5 shadow-[0_8px_25px_rgba(0,0,0,0.6),0_0_15px_rgba(56,189,248,0.2)] backdrop-blur-md transition hover:border-cyan-400/40 hover:bg-[#0c1420]/95 hover:scale-105 active:scale-95"
            >
              <div className={`h-2 w-2 rounded-full transition-all ${
                busy ? "bg-amber-400 animate-ping shadow-[0_0_8px_#fbbf24]"
                : isPlayingAudio ? "bg-cyan-300 animate-pulse shadow-[0_0_8px_#38bdf8]"
                : isScanning ? "bg-cyan-400 animate-ping shadow-[0_0_8px_#00f0ff]"
                : "bg-cyan-400 shadow-[0_0_8px_#38bdf8]"
              }`} />
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-200 font-semibold">
                {currentPersona.name}
              </span>
              <span className="text-white/20">•</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/60">
                {statusLabel}
              </span>
            </button>
          ) : null}

          {/* Haupt-Avatar-Knopf (V2 Grundton & Cyan Aura) */}
          <div className="relative group">
            <button
              ref={kopfKugelRef}
              type="button"
              onClick={handleToggleOpen}
              className={`relative flex h-16 w-16 items-center justify-center rounded-2xl border backdrop-blur-md transition-all duration-300 ${
                isOpen
                  ? "border-cyan-400/50 bg-[#0a1018] shadow-[0_0_30px_rgba(56,189,248,0.4),inset_0_0_15px_rgba(56,189,248,0.2)] scale-105"
                  : "border-white/10 bg-[#0a1018]/90 shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_18px_rgba(56,189,248,0.2)] hover:border-cyan-400/50 hover:shadow-[0_8px_32px_rgba(0,0,0,0.7),0_0_28px_rgba(56,189,248,0.35)] hover:scale-105"
              }`}
              title={isOpen ? "Jarvis Konsole schließen" : `${currentPersona.name} Konsole öffnen (Klick)`}
            >
              {mode === "face" ? (
                <JarvisHologramFace size={56} active={isOpen || busy || isScanning || isPlayingAudio} phase={avatarPhase} />
              ) : (
                <JarvisArcReactor size={56} active={isOpen || busy || isScanning || isPlayingAudio} phase={avatarPhase} />
              )}

              {/* Status-Punkt */}
              <span
                className={`absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border border-black/80 transition-colors ${
                  busy
                    ? "bg-amber-400 animate-ping shadow-[0_0_6px_#fbbf24]"
                    : isPlayingAudio
                    ? "bg-cyan-300 shadow-[0_0_8px_#38bdf8] animate-pulse"
                    : isOpen
                    ? "bg-cyan-300 shadow-[0_0_6px_#38bdf8]"
                    : "bg-cyan-400 shadow-[0_0_6px_#38bdf8]"
                }`}
              />
            </button>

            {/* Avatar-Modus-Wechsel-Mini-Knopf oben am Avatar */}
            <button
              type="button"
              onClick={handleToggleMode}
              className="absolute -top-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-[#0a1018] text-[10px] text-cyan-200 shadow-md backdrop-blur-md transition hover:scale-110 hover:border-cyan-400 hover:text-white"
              title={`Avatar-Modus wechseln (${mode === "face" ? "Zu Arc Reactor" : "Zu Hologram Face"})`}
            >
              {mode === "face" ? "⚡" : "🤖"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
