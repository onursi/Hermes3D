"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Maximize, Settings2, X, PhoneOff, Mic, ArrowUpRight } from "lucide-react";
import { InteractiveHead } from "../dashboard/InteractiveHead";
import { JarvisLiveSession, type LivePhase } from "./session";
import "../dashboard/dashboard.css";
import "./live.css";

const status: Record<LivePhase, string> = { idle: "STANDBY", connecting: "VERBINDE", listening: "ICH HÖRE ZU", thinking: "ICH DENKE MIT", speaking: "JARVIS SPRICHT" };
export function JarvisLive() {
  const [phase, setPhase] = useState<LivePhase>("idle");
  const [panel, setPanel] = useState(true);
  const [consent, setConsent] = useState(false);
  const [camera, setCamera] = useState(true);
  const [coach, setCoach] = useState(true);
  const [voice, setVoice] = useState("Charon");
  const [audioDevice, setAudioDevice] = useState("");
  const [videoDevice, setVideoDevice] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const level = useRef(0);
  const call = useRef<JarvisLiveSession | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const mounted = useRef(false);
  const active = phase !== "idle";
  const stop = useCallback(() => { call.current?.stop(); call.current = null; if (mounted.current) { setPhase("idle"); setPanel(true); } }, []);
  useEffect(() => {
    mounted.current = true; const abort = new AbortController();
    fetch("/api/jarvis/live", { signal: abort.signal }).then(r => r.json()).then(data => { if (!abort.signal.aborted) setReady(data.configured === true); }).catch(() => {});
    const refresh = () => { void navigator.mediaDevices?.enumerateDevices().then(list => { if (mounted.current) setDevices(list); }).catch(() => {}); };
    refresh(); navigator.mediaDevices?.addEventListener("devicechange", refresh);
    const hidden = () => { if (document.hidden) stop(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") stop(); };
    document.addEventListener("visibilitychange", hidden); window.addEventListener("pagehide", stop); window.addEventListener("keydown", escape);
    return () => { mounted.current = false; abort.abort(); call.current?.stop(); navigator.mediaDevices?.removeEventListener("devicechange", refresh); document.removeEventListener("visibilitychange", hidden); window.removeEventListener("pagehide", stop); window.removeEventListener("keydown", escape); };
  }, [stop]);
  useEffect(() => { if (panel && !dialog.current?.open) dialog.current?.showModal(); if (!panel && dialog.current?.open) dialog.current?.close(); }, [panel]);
  function start() {
    if (!consent || active || !video.current) return;
    setNotice(""); setPhase("connecting"); setPanel(false);
    const session = new JarvisLiveSession(video.current, {
      level,
      phase: value => { if (mounted.current && call.current === session) setPhase(value); },
      error: message => { if (mounted.current && call.current === session) { call.current = null; setNotice(message); setPanel(true); } },
    });
    call.current = session;
    void session.start({ camera, coach, voice, audioDevice, videoDevice });
  }
  const inputs = devices.filter(device => device.kind === "audioinput");
  const cameras = devices.filter(device => device.kind === "videoinput");
  return <main className={`jl jl-${phase}`}>
    <div className="jl-space" aria-hidden="true"><div className="jl-orbit jl-orbit-a" /><div className="jl-orbit jl-orbit-b" /><div className="jl-grid" /></div>
    <header className="jl-top"><Link href="/v2" className="jl-wordmark">JARVIS<span>HERMES PERSONAL ASSISTANT</span></Link><div className="jl-signal" role="status"><i />{status[phase]}{active && <small>{camera ? "MIC + CAM" : "MIC"}</small>}</div><div className="jl-tools"><button aria-label="Vollbild" onClick={() => { void document.documentElement.requestFullscreen?.().catch(() => {}); }}><Maximize size={17} /></button><button aria-label="Gesprächseinstellungen" onClick={() => setPanel(true)}><Settings2 size={18} /></button>{active && <button aria-label="Gespräch beenden" onClick={stop}><PhoneOff size={18} /></button>}</div></header>
    <section className="jl-presence" aria-label="Jarvis Live-Gespräch"><div className="jl-head"><InteractiveHead level={level} label="Gesprächseinstellungen öffnen" onActivate={() => setPanel(true)} /></div><div className="jl-platform" aria-hidden="true" /><div className="jl-presence-label">{phase === "speaking" ? "ICH DENKE MIT." : phase === "listening" ? "BIN BEI DIR, CHEF." : "DEIN RAUM. DEIN JARVIS."}</div></section>
    <span className="jl-session-mark">LIVE PRESENCE / 01</span>
    <dialog ref={dialog} className="jl-dialog" aria-labelledby="jl-title" onCancel={event => { event.preventDefault(); setPanel(false); }}>
      <button className="jl-close" aria-label="Einstellungen schließen" onClick={() => setPanel(false)}><X size={20} /></button>
      <span className="jl-eyebrow">VOR DEM TAKE</span><h1 id="jl-title">Jarvis ist da.</h1><p className="jl-lead">Ein Gespräch. Ein Blick.<br />Danach gehört der Bildschirm ihm.</p>
      <div className="jl-fields"><label>Stimme<select aria-label="Live-Stimme" disabled={active} value={voice} onChange={event => setVoice(event.target.value)}><option value="Charon">Charon · ruhig und souverän</option><option value="Algenib">Algenib · rauer Klang</option><option value="Orus">Orus · bestimmt</option></select></label>
      <label>Mikrofon<select aria-label="Live-Mikrofon" disabled={active} value={audioDevice} onChange={event => setAudioDevice(event.target.value)}><option value="">Systemstandard</option>{inputs.map((device, i) => <option key={device.deviceId || i} value={device.deviceId}>{device.label || `Mikrofon ${i + 1}`}</option>)}</select></label>
      <label>Kamera<select aria-label="Live-Kamera" disabled={active || !camera} value={videoDevice} onChange={event => setVideoDevice(event.target.value)}><option value="">Systemstandard</option>{cameras.map((device, i) => <option key={device.deviceId || i} value={device.deviceId}>{device.label || `Kamera ${i + 1}`}</option>)}</select></label></div>
      <label className="jl-check"><input type="checkbox" checked={camera} disabled={active} onChange={event => setCamera(event.target.checked)} /><span>Kamera dabei<span>Jarvis sieht dich. Deine Eigenvorschau bleibt verborgen.</span></span></label>
      <label className="jl-check"><input type="checkbox" checked={coach} disabled={active} onChange={event => setCoach(event.target.checked)} /><span>Fokuscoach<span>Meldet sich einmal nach 15 Sekunden Gesprächspause.</span></span></label>
      <label className="jl-check jl-consent"><input type="checkbox" checked={consent} disabled={active} onChange={event => setConsent(event.target.checked)} /><span>Live-Übertragung freigeben<span>Während des Gesprächs gehen Mikrofonton und bei aktivierter Kamera etwa ein Bild pro Sekunde an Google Gemini. Keine Aufnahme durch Hermes. Google-Kontingent wird genutzt.</span></span></label>
      {notice && <p className="jl-error" role="alert">{notice}</p>}
      {active ? <div className="jl-actions"><button className="jl-start" onClick={() => setPanel(false)}>Zurück zum Drehmodus <ArrowUpRight size={18} /></button><button className="jl-end" onClick={stop}>Gespräch beenden</button></div> : <button className="jl-start" disabled={!consent || !ready} onClick={start}><Mic size={17} />{ready ? "Gespräch starten" : "Live-Zugang wird geprüft"}<ArrowUpRight size={18} /></button>}
      <div className="jl-foot"><span>ESC beendet das Gespräch · max. 10 Minuten</span><Link href="/jarvis/studio">Stimmstudio</Link></div>
    </dialog>
    <video ref={video} hidden muted playsInline aria-hidden="true" />
  </main>;
}
