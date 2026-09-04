"use client";

import {
  Activity,
  BookmarkPlus,
  CornerDownLeft,
  Loader2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { JarvisCore, type JarvisPhase } from "@/features/jarvis/JarvisCore";
import { useVoice } from "@/features/jarvis/useVoice";
import { cyberAudio } from "@/lib/sound/cyberAudio";

/**
 * Jarvis, in one place.
 *
 * This existed twice: a full version on /jarvis with the reactor, voice,
 * streaming and "remember", and an older, lesser one inside the brain window
 * with none of it. Onur opened the brain and immediately noticed his Jarvis
 * looked wrong — because the one reachable from the office was the worse of
 * the two.
 *
 * That is the drift I warned about out loud when the retrieval scoring was
 * pulled into a shared module: two copies of the same thing come apart. There
 * it would have taken a week. Here it took hours, because I built the page and
 * left the panel behind.
 *
 * So there is one console now, mounted twice.
 */

export type JarvisSource = {
  id: string;
  title: string;
  folder: string;
  excerpt: string;
};

type Props = {
  /** Fly the graph to a note by its vault id. */
  onFlyToSource: (sourceId: string) => void;
  /** The ids of the notes an answer cites, so the graph can light them. */
  onSourcesChange?: (sourceIds: string[]) => void;
  /** How many notes the vault holds, for the standing line. */
  noteCount?: number;
  /** Smaller reactor and tighter spacing, for the panel inside the graph. */
  compact?: boolean;
};

export function JarvisConsole({
  onFlyToSource,
  onSourcesChange,
  noteCount = 0,
  compact = false,
}: Props) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<JarvisSource[]>([]);
  const [reason, setReason] = useState<string | null>(null);
  const [phase, setPhase] = useState<JarvisPhase>("idle");
  const [savedAs, setSavedAs] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Reading answers aloud, off until asked for. */
  const [voiceReply, setVoiceReply] = useState(false);
  /** Ambient firing, likewise. */
  const [soundOn, setSoundOn] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<EventSource | null>(null);

  useEffect(() => () => streamRef.current?.close(), []);

  const onSourcesChangeRef = useRef(onSourcesChange);
  useEffect(() => {
    onSourcesChangeRef.current = onSourcesChange;
  }, [onSourcesChange]);
  useEffect(() => {
    onSourcesChangeRef.current?.(sources.map((source) => source.id));
  }, [sources]);

  const ask = useCallback(
    (spoken?: string) => {
      const text = (spoken ?? question).trim();
      if (!text) return;
      if (phase === "searching" || phase === "thinking" || phase === "speaking") return;
      if (spoken) setQuestion(spoken);
      streamRef.current?.close();
      setAnswer("");
      setSources([]);
      setReason(null);
      setSavedAs(null);
      setPhase("searching");

      const source = new EventSource(`/api/jarvis/stream?q=${encodeURIComponent(text)}`);
      streamRef.current = source;
      source.addEventListener("state", (event) => {
        setPhase(JSON.parse((event as MessageEvent).data).phase as JarvisPhase);
      });
      source.addEventListener("sources", (event) => {
        setSources(JSON.parse((event as MessageEvent).data).sources ?? []);
      });
      source.addEventListener("delta", (event) => {
        setAnswer((prev) => prev + JSON.parse((event as MessageEvent).data).text);
      });
      source.addEventListener("done", () => {
        setPhase("idle");
        source.close();
      });
      source.addEventListener("error", (event) => {
        // Two errors share this name: ours, which carries a reason, and the
        // browser's when the connection drops. Only the first says anything.
        const raw = (event as MessageEvent).data;
        if (raw) {
          try {
            setReason(JSON.parse(raw).reason ?? "Unbekannter Fehler.");
          } catch {
            setReason("Unbekannter Fehler.");
          }
          setPhase("error");
        } else {
          setPhase("idle");
        }
        source.close();
      });
    },
    [question, phase],
  );

  const voice = useVoice({ onTranscript: (text) => ask(text) });

  /** The microphone outranks the server: while it listens, that is the state. */
  const displayPhase: JarvisPhase = voice.listening
    ? "listening"
    : voice.speaking
      ? "speaking"
      : phase;

  // Spoken once complete, not while streaming: a synthesiser fed word by word
  // reads with the rhythm of a telegram.
  const spokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== "idle" || !answer || spokenRef.current === answer) return;
    spokenRef.current = answer;
    if (voice.supported && voiceReply) voice.speak(answer);
  }, [phase, answer, voice, voiceReply]);

  useEffect(() => {
    if (!soundOn) return;
    cyberAudio.setNeuralActivity(
      displayPhase === "listening"
        ? 0
        : displayPhase === "searching" || displayPhase === "thinking"
          ? 0.85
          : displayPhase === "speaking"
            ? 0.6
            : 0.12,
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

  // Follow the answer while it is written, then return to the top of it.
  useEffect(() => {
    if (!answerRef.current) return;
    if (phase === "speaking") {
      answerRef.current.scrollTop = answerRef.current.scrollHeight;
    } else if (phase === "idle" && answer) {
      answerRef.current.scrollTop = 0;
    }
  }, [answer, phase]);

  const remember = useCallback(async () => {
    if (!answer || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/jarvis/remember", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: answer, question, sources }),
      });
      const data = await res.json();
      setSavedAs(data.ok ? data.file : null);
      if (!data.ok) setReason(data.reason ?? "Konnte nicht gespeichert werden.");
    } catch (error) {
      setReason(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }, [answer, question, sources, saving]);

  const busy = phase === "searching" || phase === "thinking" || phase === "speaking";

  return (
    <>
      <div
        className={`flex flex-col items-center border-b border-white/[0.07] ${
          compact ? "px-4 py-3" : "px-6 py-6"
        }`}
      >
        <JarvisCore phase={displayPhase} size={compact ? 104 : 168} />
        <p
          className={`mt-3 text-center leading-relaxed text-white/35 ${
            compact ? "text-[10px]" : "text-[11px]"
          }`}
        >
          Antworten kommen ausschließlich aus deinen {noteCount} Notizen — mit Quellen,
          oder gar nicht.
        </p>
      </div>

      <div className={`border-b border-white/[0.07] ${compact ? "p-3" : "p-4"}`}>
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.09] bg-black/40 px-3 py-2.5">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              // Stopped here so the room's shortcuts do not read what is being
              // typed — Space above all belongs to this field.
              event.stopPropagation();
              if (event.key === "Enter") ask();
            }}
            placeholder="Was denke ich über…?"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-white/90 outline-none placeholder:text-white/25"
          />
          <button
            type="button"
            onClick={() => ask()}
            disabled={busy || !question.trim()}
            className="shrink-0 text-white/50 hover:text-white disabled:opacity-25"
            title="Fragen"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <CornerDownLeft size={15} />}
          </button>
        </div>

        {voice.supported ? (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => (voice.listening ? voice.stopListening() : voice.startListening())}
              disabled={busy}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-medium transition disabled:opacity-30 ${
                voice.listening
                  ? "border-green-400/40 bg-green-400/15 text-green-200"
                  : "border-white/[0.09] bg-white/[0.04] text-white/70 hover:border-white/20 hover:text-white"
              }`}
              title="Sprich deine Frage — die Erkennung läuft im Browser, es geht kein Ton nach draußen"
            >
              {voice.listening ? <MicOff size={13} /> : <Mic size={13} />}
              <span>{voice.listening ? "Ich höre…" : "Hey Hermes"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (voice.speaking) voice.stopSpeaking();
                setVoiceReply((prev) => !prev);
              }}
              className={`inline-flex items-center rounded-xl border px-2.5 py-2 transition ${
                voiceReply
                  ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-100"
                  : "border-white/[0.09] bg-white/[0.04] text-white/50 hover:text-white/80"
              }`}
              title={voiceReply ? "Antworten werden vorgelesen" : "Antworten still anzeigen"}
            >
              {voiceReply ? <Volume2 size={13} /> : <VolumeX size={13} />}
            </button>
            <button
              type="button"
              onClick={() => setSoundOn((prev) => !prev)}
              className={`inline-flex items-center rounded-xl border px-2.5 py-2 transition ${
                soundOn
                  ? "border-violet-300/40 bg-violet-400/15 text-violet-100"
                  : "border-white/[0.09] bg-white/[0.04] text-white/50 hover:text-white/80"
              }`}
              title={soundOn ? "Der Raum feuert hörbar mit" : "Klang des Gehirns einschalten"}
            >
              <Activity size={13} />
            </button>
          </div>
        ) : null}

        {voice.listening && voice.heard ? (
          <p className="mt-2 text-[12px] italic leading-relaxed text-green-200/70">
            „{voice.heard}“
          </p>
        ) : null}
      </div>

      <div ref={answerRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {answer ? (
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/95">
            {answer}
            {phase === "speaking" ? (
              <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-cyan-300/70 align-middle" />
            ) : null}
          </p>
        ) : null}

        {reason ? <p className="text-[12px] leading-relaxed text-amber-200/80">{reason}</p> : null}

        {answer && phase === "idle" ? (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void remember()}
              disabled={saving || Boolean(savedAs)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/60 transition hover:border-white/20 hover:text-white/90 disabled:opacity-40"
              title="Legt diese Antwort mit Frage und Quellen als Notiz in der Inbox ab"
            >
              <BookmarkPlus size={11} />
              <span>{savedAs ? "gemerkt" : saving ? "speichert…" : "Merken"}</span>
            </button>
            {savedAs ? (
              <span className="truncate text-[10px] text-white/35" title={savedAs}>
                {savedAs}
              </span>
            ) : null}
          </div>
        ) : null}

        {sources.length > 0 ? (
          <div className="mt-5 border-t border-white/[0.07] pt-3">
            <p className="pb-2 text-[10px] font-semibold tracking-[-0.005em] text-white/40">
              Quellen — anklicken, um hinzufliegen
            </p>
            <ol className="space-y-0.5">
              {sources.map((source, index) => (
                <li key={source.id}>
                  <button
                    type="button"
                    onClick={() => onFlyToSource(source.id)}
                    className="flex w-full gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.06]"
                    title={source.folder}
                  >
                    <span className="shrink-0 font-mono text-[11px] text-white/35">
                      [{index + 1}]
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-white/80">
                      {source.title}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {!busy && !answer && !reason && sources.length === 0 ? (
          <p className="text-[12px] leading-relaxed text-white/35">
            Die Antwort kommt ausschließlich aus deinen eigenen Notizen, mit Quellenangabe.
            Findet die Suche nichts, sagt Jarvis das — statt zu raten.
          </p>
        ) : null}
      </div>
    </>
  );
}
