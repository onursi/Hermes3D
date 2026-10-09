"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CameraOff, Check, Loader2, Play, RotateCcw, Square, Volume2 } from "lucide-react";
import { DEFAULT_VIDEO_TASKS, VIDEO_SCENE_STORAGE_KEY, makeVideoScene, readVideoTasks } from "./videoScene";

type Props = {
  voiceKey: string;
  onPrepare: (replies: string[]) => Promise<void>;
  onPlay: (cue: string, reply: string) => Promise<boolean>;
  onStop: () => void;
};

export function JarvisVideoScene({ voiceKey, onPrepare, onPlay, onStop }: Props) {
  const [tasks, setTasks] = useState<string[]>([...DEFAULT_VIDEO_TASKS]);
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState(false);
  const [delay, setDelay] = useState(3);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [preparedKey, setPreparedKey] = useState("");
  const [notice, setNotice] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const generation = useRef(0);
  const preparation = useRef(0);
  const mounted = useRef(true);
  const video = useRef<HTMLVideoElement>(null);
  const media = useRef<MediaStream | null>(null);
  const stopRef = useRef(onStop);
  const cameraRequest = useRef(0);
  useEffect(() => { stopRef.current = onStop; }, [onStop]);
  useEffect(() => {
    const playbackVersion = generation;
    const preparationVersion = preparation;
    const cameraVersion = cameraRequest;
    mounted.current = true;
    try {
      const saved = localStorage.getItem(VIDEO_SCENE_STORAGE_KEY);
      if (saved) setTasks(readVideoTasks(JSON.parse(saved)));
    } catch { /* An unavailable browser store does not prevent rehearsal. */ }
    return () => {
      mounted.current = false;
      playbackVersion.current++;
      preparationVersion.current++;
      cameraVersion.current++;
      media.current?.getTracks().forEach(track => track.stop());
      stopRef.current();
    };
  }, []);
  useEffect(() => {
    if (cameraOn && video.current && media.current) {
      video.current.srcObject = media.current;
      void video.current.play().catch(() => {
        if (mounted.current) setNotice("Webcam-Wiedergabe blockiert. Bitte die Vorschau erneut öffnen.");
      });
    }
  }, [cameraOn]);

  const turns = useMemo(() => makeVideoScene(tasks), [tasks]);
  const scriptKey = JSON.stringify([voiceKey, turns]);
  const ready = preparedKey === scriptKey;
  const locked = playing || preparing;
  const turn = turns[step];

  const stop = useCallback(() => {
    generation.current++;
    setCountdown(null);
    setPlaying(false);
    onStop();
  }, [onStop]);

  const play = useCallback(async () => {
    if (playing || preparing) return;
    const run = ++generation.current;
    setPlaying(true);
    setNotice("");
    try {
      for (let seconds = delay; seconds > 0; seconds--) {
        if (!mounted.current || run !== generation.current) return;
        setCountdown(seconds);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (!mounted.current || run !== generation.current) return;
      setCountdown(null);
      const ok = await onPlay(turn.cue, turn.reply);
      if (!mounted.current || run !== generation.current) return;
      if (!ok) setNotice("Die Antwort wurde nicht vollständig abgespielt. Stimme vorbereiten oder erneut versuchen.");
    } catch (error) {
      if (mounted.current && run === generation.current) setNotice(error instanceof Error ? error.message : "Wiedergabe nicht möglich.");
    } finally {
      if (mounted.current && run === generation.current) setPlaying(false);
    }
  }, [playing, preparing, delay, onPlay, turn]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (event.altKey && event.code === "KeyJ" && !event.repeat) {
        event.preventDefault();
        event.stopPropagation();
        void play();
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [play]);

  const prepare = async () => {
    const run = ++preparation.current;
    setPreparing(true);
    setNotice("");
    try {
      await onPrepare(turns.map(item => item.reply));
      if (mounted.current && run === preparation.current) {
        setPreparedKey(scriptKey);
        setNotice("Alle drei Antworten sind geladen. Du kannst jeden Take wiederholen.");
      }
    } catch (error) {
      if (mounted.current && run === preparation.current) setNotice(error instanceof Error ? error.message : "Stimme konnte nicht vorbereitet werden.");
    } finally {
      if (mounted.current && run === preparation.current) setPreparing(false);
    }
  };

  const toggleCamera = async () => {
    const run = ++cameraRequest.current;
    if (cameraOn) {
      media.current?.getTracks().forEach(track => track.stop());
      media.current = null;
      setCameraOn(false);
      return;
    }
    setCameraBusy(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Webcam benötigt localhost oder HTTPS und einen unterstützten Browser.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (!mounted.current || run !== cameraRequest.current) { stream.getTracks().forEach(track => track.stop()); return; }
      media.current = stream;
      setCameraOn(true);
    } catch (error) {
      if (mounted.current) setNotice(error instanceof Error ? error.message : "Webcam nicht verfügbar.");
    } finally {
      if (mounted.current) setCameraBusy(false);
    }
  };

  const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10 disabled:opacity-40";
  return (
    <div className="jarvis-video-scene order-3 space-y-4 p-4 text-white" aria-label="Jarvis Video-Szene">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-amber-200">Video-Szene · Beispieldaten</p><h3 className="mt-1 text-lg font-semibold">Käffchen mit Jarvis</h3></div>
        <button className={button} disabled={locked} onClick={() => setEditing(value => !value)}>{editing ? "Fertig" : "Aufgaben ändern"}</button>
      </div>
      <p className="text-xs leading-relaxed text-white/55">Vorbereiteter Dialog für deine Aufnahme. Die Aufgaben werden nur in diesem Browser gespeichert. Kamera-Vorschau ohne Bilderkennung.</p>
      {editing ? <div className="space-y-3">{tasks.map((task, index) => <label className="block text-xs text-white/65" key={index}>Aufgabe {index + 1}<textarea aria-label={`Video-Aufgabe ${index + 1}`} className="mt-1 w-full rounded-xl border border-white/15 bg-black/25 p-3 text-base text-white outline-none focus:border-cyan-300" maxLength={220} value={task} onChange={event => { const next = tasks.map((item, i) => i === index ? event.target.value : item); setTasks(next); try { localStorage.setItem(VIDEO_SCENE_STORAGE_KEY, JSON.stringify(next)); } catch { /* optional */ } }} /></label>)}</div> : <ol className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">{tasks.map((task, index) => <li key={index} className="flex gap-3 text-sm leading-relaxed"><span className="text-cyan-200">{index + 1}</span><span>{task}</span></li>)}</ol>}
      <div className="grid grid-cols-3 gap-2">{turns.map((item, index) => <button key={item.id} aria-pressed={step === index} disabled={locked} className={`${button} ${step === index ? "border-cyan-300/50 bg-cyan-300/10" : ""}`} onClick={() => { setStep(index); setNotice(""); }}>{["Tagesplan", "Käffchen", "Zur Post"][index]}</button>)}</div>
      <div className="rounded-2xl border border-cyan-200/20 bg-cyan-200/5 p-4">
        <p className="text-xs text-white/50">Du sagst</p><p className="mt-1 text-base font-medium">{turn.cue}</p>
        <p className="mt-4 text-xs text-cyan-200/70">Jarvis antwortet</p><p className="mt-1 text-base leading-relaxed" data-scene-reply>{turn.reply}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className={button} disabled={locked || ready} onClick={() => void prepare()}>{preparing ? <Loader2 size={16} className="animate-spin" /> : ready ? <Check size={16} /> : <Volume2 size={16} />}{preparing ? "Stimme wird vorbereitet …" : ready ? "Stimme bereit" : "Stimme vorbereiten"}</button>
        <label className="ml-auto text-xs text-white/60">Vorlauf <select aria-label="Vorlauf für Video-Antwort" disabled={locked} value={delay} onChange={event => setDelay(Number(event.target.value))} className="ml-1 rounded-lg bg-[#152333] p-2 text-base text-white"><option value={0}>0 s</option><option value={3}>3 s</option><option value={5}>5 s</option></select></label>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button className={`${button} border-cyan-200/35 bg-cyan-200/10 font-semibold`} disabled={locked} onClick={() => void play()}><Play size={16} />{countdown !== null ? `Start in ${countdown}` : playing ? "Jarvis spricht …" : "Antwort abspielen"}</button>
        <button aria-label="Video-Antwort stoppen" className={button} onClick={stop}><Square size={16} /></button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/50"><span>Alt + J spielt die ausgewählte Antwort. Kein Mikrofon nötig.</span><button className={button} disabled={locked} onClick={() => { stop(); setStep(0); }}><RotateCcw size={14} />Von vorne</button></div>
      <button className={button} disabled={cameraBusy} onClick={() => void toggleCamera()}>{cameraBusy ? <Loader2 size={16} className="animate-spin" /> : cameraOn ? <CameraOff size={16} /> : <Camera size={16} />}{cameraOn ? "Webcam ausschalten" : "Webcam-Vorschau"}</button>
      {cameraOn ? <div><video ref={video} muted autoPlay playsInline className="aspect-video w-full rounded-xl bg-black object-cover" /><p className="mt-1 text-xs text-white/50">Nur lokale Vorschau. Kein Upload und keine Analyse.</p></div> : null}
      <p role="status" aria-live="polite" className="text-sm leading-relaxed text-amber-100">{countdown !== null ? `Bereit machen. Jarvis startet in ${countdown} Sekunden.` : notice}</p>
    </div>
  );
}
