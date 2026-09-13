"use client";

import {
  Activity,
  BookmarkPlus,
  CornerDownLeft,
  Loader2,
  Mic,
  MicOff,
  Volume2,
  ListChecks,
  Sunrise,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { JarvisCore, type JarvisPhase } from "@/features/jarvis/JarvisCore";
import { useVoice } from "@/features/jarvis/useVoice";
import { cyberAudio } from "@/lib/sound/cyberAudio";
import { KNOWLEDGE_PULSE_EVENT } from "@/features/retro-office/scene/VaultStars";

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
  /** Read inside callbacks so they do not have to depend on the phase. */
  const busyRef = useRef(false);

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
      setPreview(null);
      setCandidates(null);
      setAccepted({});
      setPhase("searching");

      const source = new EventSource(`/api/jarvis/stream?q=${encodeURIComponent(text)}`);
      streamRef.current = source;
      source.addEventListener("state", (event) => {
        setPhase(JSON.parse((event as MessageEvent).data).phase as JarvisPhase);
      });
      source.addEventListener("sources", (event) => {
        const found = JSON.parse((event as MessageEvent).data).sources ?? [];
        setSources(found);
        /**
         * Tell the room which notes were actually read.
         *
         * The office turns each one into a pulse of light travelling from that
         * note's own star down to the table, so an answer visibly comes from
         * somewhere. Fired here and nowhere else: only a real retrieval sends
         * it, so a quiet sky means nothing was read rather than that the
         * effect is between loops. An animation that runs on a timer would say
         * the same thing whether or not anything happened.
         */
        const ids = found
          .map((hit: { id?: string }) => hit.id)
          .filter((id: string | undefined): id is string => Boolean(id));
        if (ids.length > 0) {
          window.dispatchEvent(
            new CustomEvent(KNOWLEDGE_PULSE_EVENT, { detail: { ids } }),
          );
        }
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

  /**
   * Remembering, in two steps: show first, write second.
   *
   * The first version wrote straight to disk. That is fine until the derived
   * title is wrong — and it is derived from the answer's first line, so it
   * often is. A note filed under a bad name is worse than no note: it is
   * findable by nothing and still counts against you when you scan the Inbox.
   *
   * So the preview shows the filename, the folder and the sources that will
   * be linked, and the title is editable before anything touches the disk.
   */
  const [preview, setPreview] = useState<
    { id: string; title: string; file: string; sources: string[] } | null
  >(null);

  const proposeNote = useCallback(async () => {
    if (!answer || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/jarvis/remember", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "propose", answer, question, sources }),
      });
      const data = await res.json();
      if (data.ok && data.proposal) setPreview({
        id: data.proposal.id,
        title: data.proposal.title,
        file: data.proposal.inboxFile,
        sources: (data.proposal.sources ?? []).map((source: { title: string }) => source.title),
      });
      else setReason(data.reason ?? "Vorschau fehlgeschlagen.");
    } catch (error) {
      setReason(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }, [answer, question, sources, saving]);

  const confirmNote = useCallback(async () => {
    if (!preview || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/jarvis/remember", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "commit", proposalId: preview.id, action: "inbox", title: preview.title }),
      });
      const data = await res.json();
      setSavedAs(data.ok ? data.file : null);
      if (data.ok) setPreview(null);
      else setReason(data.reason ?? "Konnte nicht gespeichert werden.");
    } catch (error) {
      setReason(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }, [preview, saving]);

  /**
   * The day, as advice rather than as a list.
   *
   * Reuses the answer surface deliberately: a briefing is an answer to a
   * question you did not have to type, so it should arrive in the same place
   * and be rememberable the same way.
   */
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
    try {
      const res = await fetch("/api/briefing");
      const data = await res.json();
      if (data.ok && data.briefing) setAnswer(data.briefing);
      else setReason(data.reason ?? "Kein Briefing erhalten.");
    } catch (error) {
      setReason(error instanceof Error ? error.message : String(error));
    } finally {
      setPhase("idle");
    }
  }, []);

  /**
   * Tasks the answer implied — proposed, never created.
   *
   * Writing them straight into Todoist is how a task list fills with things
   * nobody decided to do, and a list you stop trusting costs far more than
   * the typing it saved. So each candidate is accepted or dismissed on its
   * own, and dismissing leaves no trace.
   */
  const [candidates, setCandidates] = useState<string[] | null>(null);
  const [candidatesBusy, setCandidatesBusy] = useState(false);
  const [accepted, setAccepted] = useState<Record<string, "saving" | "done" | "failed">>({});

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

  const busy = phase === "searching" || phase === "thinking" || phase === "speaking";
  busyRef.current = busy;

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
            <button
              type="button"
              onClick={() => void briefing()}
              disabled={busy}
              className="inline-flex items-center rounded-xl border border-white/[0.09] bg-white/[0.04] px-2.5 py-2 text-white/50 transition hover:text-white/80 disabled:opacity-30"
              title="Wie ist mein Stand? — Aufgaben und Freigaben, mit einer Empfehlung"
            >
              <Sunrise size={13} />
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
              onClick={() => void proposeNote()}
              disabled={saving || Boolean(savedAs)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/60 transition hover:border-white/20 hover:text-white/90 disabled:opacity-40"
              title="Legt diese Antwort mit Frage und Quellen als Notiz in der Inbox ab"
            >
              <BookmarkPlus size={11} />
              <span>{savedAs ? "gemerkt" : saving ? "speichert…" : "Merken"}</span>
            </button>
            <button
              type="button"
              onClick={() => void findTasks()}
              disabled={candidatesBusy}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/60 transition hover:border-white/20 hover:text-white/90 disabled:opacity-40"
              title="Sucht Aufgaben, die aus dieser Antwort folgen — vorschlagen, nicht anlegen"
            >
              <ListChecks size={11} />
              <span>{candidatesBusy ? "sucht…" : "Aufgaben"}</span>
            </button>
            {savedAs ? (
              <span className="truncate text-[10px] text-white/35" title={savedAs}>
                {savedAs}
              </span>
            ) : null}
          </div>
        ) : null}

        {preview ? (
          <div className="mt-3 rounded-xl border border-white/[0.09] bg-white/[0.04] p-3">
            <p className="pb-2 text-[10px] font-semibold tracking-[-0.005em] text-white/45">
              Wird so abgelegt — Titel änderbar
            </p>
            <input
              value={preview.title}
              onChange={(event) =>
                setPreview((prev) => (prev ? { ...prev, title: event.target.value } : prev))
              }
              onKeyDown={(event) => event.stopPropagation()}
              className="w-full rounded-lg border border-white/[0.09] bg-black/40 px-2 py-1.5 text-[12px] text-white/90 outline-none"
            />
            <p className="mt-2 truncate text-[10px] text-white/35" title={preview.file}>
              {preview.file}
            </p>
            {preview.sources.length > 0 ? (
              <p className="mt-1 text-[10px] leading-relaxed text-white/35">
                verlinkt: {preview.sources.join(" · ")}
              </p>
            ) : null}
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void confirmNote()}
                disabled={saving || !preview.title.trim()}
                className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium text-emerald-100 hover:border-emerald-300/60 disabled:opacity-40"
              >
                {saving ? "speichert…" : "In die Inbox"}
              </button>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="text-[11px] text-white/40 hover:text-white/70"
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : null}

        {candidates ? (
          <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2">
            {candidates.length === 0 ? (
              <p className="px-1 py-0.5 text-[11px] text-white/45">
                Keine Aufgabe erkennbar — das ist auch eine Antwort.
              </p>
            ) : (
              <ul className="space-y-1">
                {candidates.map((line) => {
                  const state = accepted[line];
                  return (
                    <li key={line} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void acceptCandidate(line)}
                        disabled={Boolean(state)}
                        className="shrink-0 rounded-md border border-white/[0.09] px-1.5 py-0.5 text-[10px] text-white/60 hover:border-emerald-300/40 hover:text-emerald-200 disabled:opacity-40"
                        title="In Todoist anlegen"
                      >
                        {state === "done" ? "✓" : state === "saving" ? "…" : state === "failed" ? "!" : "+"}
                      </button>
                      <span
                        className={`min-w-0 flex-1 truncate text-[11px] ${
                          state === "done" ? "text-white/35 line-through" : "text-white/75"
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
                        className="shrink-0 text-white/25 hover:text-white/60"
                        title="Verwerfen — hinterlässt keine Spur"
                      >
                        <X size={11} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
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
