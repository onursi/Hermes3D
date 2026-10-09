"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Camera, Eye, Focus, Pause, Play, ShoppingBag, Volume2, X } from "lucide-react";
import "./dashboard.css";
import { InteractiveHead } from "./InteractiveHead";

const scenes = [
  { name: "Fokus", audio: "focus", icon: Focus, title: "Ein anderer Plan.", cue: "Jarvis, ich muss jetzt wirklich lernen.", reply: "Chef, du wolltest heute eigentlich lernen. Dein Daumen hat offenbar einen anderen Plan." },
  { name: "Einkauf", audio: "shopping", icon: ShoppingBag, title: "Schon auf der Liste.", cue: "Proteinjoghurt und Schlagsahne nicht vergessen.", reply: "Proteine für dich, Käsekuchen für den Hausfrieden. So würde ich die Liste ergänzen, Chef." },
  { name: "Alltag", audio: "daily", icon: ArrowUpRight, title: "Ich denke mit.", cue: "Jarvis, das Paket muss noch zur Post.", reply: "Ein guter Plan, Chef. Bis dahin ist das Paket noch kein Möbelstück." },
];

export function JarvisDashboard() {
  const [scene, setScene] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraPending, setCameraPending] = useState(false);
  const [visionBusy, setVisionBusy] = useState(false);
  const [visionReady, setVisionReady] = useState(false);
  const [visionResult, setVisionResult] = useState("");
  const [notice, setNotice] = useState("");
  const [remaining, setRemaining] = useState(15 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [voiceName, setVoiceName] = useState("dark");
  const [voiceSpeed, setVoiceSpeed] = useState(1.16);
  const voiceLevel = useRef(0);
  const voiceContext = useRef<AudioContext | null>(null);
  const voiceFrame = useRef(0);
  const player = useRef<HTMLAudioElement | null>(null);
  const voiceGeneration = useRef(0);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const deadline = useRef(0);
  const mounted = useRef(false);

  const stopVoice = useCallback(() => {
    voiceGeneration.current++;
    cancelAnimationFrame(voiceFrame.current); voiceFrame.current = 0; voiceLevel.current = 0;
    const context = voiceContext.current; voiceContext.current = null;
    if (context) void context.close().catch(() => {});
    const audio = player.current;
    player.current = null;
    if (audio) {
      audio.onplaying = audio.onended = audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    if (mounted.current) { setSpeaking(false); setVoiceLoading(false); }
  }, []);

  const stopCamera = useCallback(() => {
    generation.current++;
    request.current?.abort(); request.current = null;
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
    if (mounted.current) { setCameraOn(false); setCameraPending(false); setVisionBusy(false); setVisionResult(""); }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    fetch("/api/jarvis/vision", { signal: controller.signal }).then(r => r.json()).then(data => {
      if (!controller.signal.aborted) setVisionReady(data.configured === true);
    }).catch(() => {});
    const hidden = () => { if (document.hidden) { stopCamera(); stopVoice(); } };
    const leave = () => { stopCamera(); stopVoice(); };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", leave);
    return () => {
      mounted.current = false; controller.abort(); stopCamera(); stopVoice();
      document.removeEventListener("visibilitychange", hidden); window.removeEventListener("pagehide", leave);
    };
  }, [stopCamera, stopVoice]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(seconds); if (seconds === 0) setTimerRunning(false);
    }, 250);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  async function startCamera() {
    if (cameraOn || cameraPending) return;
    const run = ++generation.current;
    setCameraPending(true); setNotice(""); setVisionResult("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Kamera braucht localhost oder eine sichere HTTPS-Verbindung.");
      const media = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false });
      if (!mounted.current || run !== generation.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      media.getVideoTracks().forEach(track => track.addEventListener("ended", stopCamera, { once: true }));
      if (!video.current) throw new Error("Kameraansicht ist nicht mehr verfügbar.");
      video.current.srcObject = media;
      await video.current.play();
      if (!mounted.current || run !== generation.current) return;
      setCameraOn(true); setCameraPending(false);
    } catch (error) {
      if (!mounted.current || run !== generation.current) return;
      stopCamera();
      setNotice(error instanceof Error && error.name === "NotAllowedError" ? "Kamerafreigabe fehlt. Erlaube die Kamera für diese Seite im Browser." : error instanceof Error ? error.message : "Kamera konnte nicht geöffnet werden.");
    }
  }

  async function checkVision() {
    if (visionBusy || !cameraOn || !video.current) return;
    const run = generation.current;
    const source = video.current;
    if (!source.videoWidth || !source.videoHeight) { setNotice("Kamerabild wird noch vorbereitet. Einen Moment warten."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = 640; canvas.height = Math.round(source.videoHeight / source.videoWidth * 640);
    const context = canvas.getContext("2d"); if (!context) return;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL("image/jpeg", .7).split(",")[1];
    const controller = new AbortController(); request.current = controller;
    setVisionBusy(true); setNotice("");
    try {
      const response = await fetch("/api/jarvis/vision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image }), signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sichtprüfung fehlgeschlagen.");
      if (mounted.current && run === generation.current) setVisionResult(data.description);
    } catch (error) {
      if (!controller.signal.aborted && mounted.current && run === generation.current) setNotice(error instanceof Error ? error.message : "Sichtprüfung fehlgeschlagen.");
    } finally {
      if (mounted.current && run === generation.current) setVisionBusy(false);
      if (request.current === controller) request.current = null;
    }
  }

  function speak() {
    stopVoice();
    const run = voiceGeneration.current;
    const audio = new Audio(`/jarvis/voice/${scenes[scene].audio}-${voiceName}-v2.mp3`);
    audio.playbackRate = voiceSpeed;
    audio.preservesPitch = true;
    player.current = audio;
    setVoiceLoading(true); setNotice("");
    // Analyse the actual playback, never a microphone or generated random waveform.
    try {
      if (window.AudioContext) {
        const context = new AudioContext();
        const analyser = context.createAnalyser(); analyser.fftSize = 256;
        const source = context.createMediaElementSource(audio);
        source.connect(analyser); analyser.connect(context.destination);
        voiceContext.current = context;
        void context.resume().catch(() => {});
        const samples = new Uint8Array(analyser.fftSize);
        const sample = () => {
          if (run !== voiceGeneration.current) return;
          analyser.getByteTimeDomainData(samples);
          let sum = 0; for (const value of samples) sum += ((value - 128) / 128) ** 2;
          voiceLevel.current = Math.min(1, Math.sqrt(sum / samples.length) * 5);
          voiceFrame.current = requestAnimationFrame(sample);
        };
        voiceFrame.current = requestAnimationFrame(sample);
      }
    } catch { /* Playback remains available if Web Audio is unsupported. */ }
    audio.onplaying = () => {
      if (mounted.current && run === voiceGeneration.current) { setVoiceLoading(false); setSpeaking(true); }
    };
    audio.onended = () => { if (mounted.current && run === voiceGeneration.current) stopVoice(); };
    audio.onerror = () => {
      if (mounted.current && run === voiceGeneration.current) { stopVoice(); setNotice("Der Jarvis-Sprachclip konnte nicht geladen werden."); }
    };
    void audio.play().catch(() => {
      if (mounted.current && run === voiceGeneration.current) { stopVoice(); setNotice("Audio konnte nicht starten. Noch einmal auf Stimme testen tippen."); }
    });
  }

  const current = scenes[scene];
  function toggleVoice() { if (speaking || voiceLoading) stopVoice(); else speak(); }
  const clock = `${Math.floor(remaining / 60).toString().padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`;
  return <main className={`jd ${speaking ? "jd-speaking" : ""} ${visionBusy ? "jd-observing" : ""}`}>
    <header className="jd-top"><Link className="jd-brand" href="/v2"><span className="jd-emblem">J</span><span>JARVIS<small>PERSONAL ASSISTANT</small></span></Link><span className="jd-version">HOLOGRAM STUDIO <b>03</b></span><div className="jd-nav"><Link className="jd-back" href="/jarvis/brain">Wissenskonsole</Link><Link className="jd-back" href="/v2"><ArrowLeft size={15} /> Hermes</Link></div></header>
    <div className="jd-layout">
      <aside className="jd-left"><div className="jd-overline"><span className="jd-dot" /> DEIN RAUM. DEIN RHYTHMUS.</div><h1>Du machst.<br />Ich denke mit.</h1><p className="jd-intro">Ein klarer Kopf.<br />Und gelegentlich ein Kommentar.</p>
        <section className="jd-focus"><div className="jd-section-label"><Focus size={15} /> Zeit für Fokus</div><strong className="jd-clock">{clock}</strong><p>{remaining === 0 ? "Zeit für eine Pause, Chef." : timerRunning ? "Dein Timer läuft hier im Dashboard." : "Eine Sache. Fünfzehn Minuten."}</p><button onClick={() => { if (!timerRunning) { const seconds = remaining || 900; setRemaining(seconds); deadline.current = Date.now() + seconds * 1000; } setTimerRunning(value => !value); }}>{timerRunning ? <Pause size={14} /> : <Play size={14} />}{timerRunning ? "Pausieren" : "Fokus starten"}</button></section>
        <div className="jd-signature"><span>HERMES × JARVIS</span><small>Persönlich. Mit Haltung.</small></div>
      </aside>
      <section className="jd-stage" aria-label="Jarvis Hologramm"><div className="jd-stage-grid" /><div className="jd-coordinate">J / 01<span>HOLOGRAPHIC PRESENCE</span></div><div className="jd-head"><InteractiveHead level={voiceLevel} onActivate={toggleVoice} /></div><div className="jd-platform" /><span className="jd-head-hint">Maus oder Finger bewegen · Kopf antippen</span><div className="jd-face-status"><i /><span>{visionBusy ? "ICH SCHAUE GENAU HIN" : voiceLoading ? "STIMME WIRD GELADEN" : speaking ? "JARVIS SPRICHT" : "BEREIT, CHEF."}</span><i /></div><div className="jd-caption"><span className="jd-overline">{visionResult ? "SICHTPRÜFUNG · EIN KAMERABILD" : "SZENENVORSCHAU"}</span><p aria-live="polite">{visionResult || current.reply}</p></div></section>
      <aside className="jd-right"><div className="jd-section-label">Womit fangen wir an?</div><nav className="jd-scenes" aria-label="Szenentext auswählen">{scenes.map((item, i) => <button key={item.name} aria-pressed={scene === i} onClick={() => { stopVoice(); setScene(i); setVisionResult(""); }}><item.icon size={18} /><span>{item.name}<small>{item.title}</small></span><ArrowUpRight size={15} /></button>)}</nav><div className="jd-cue"><span>DU</span><p>„{current.cue}“</p></div>
        <section className="jd-camera"><div className="jd-section-label"><Camera size={15} /> Wahrnehmung <span className={cameraOn ? "jd-tag jd-active" : "jd-tag"}>{cameraOn ? "Kamera an" : "Aus"}</span></div><h2>Im Hintergrund.<br />Mit deiner Freigabe.</h2><p>Dein Kamerabild bleibt verborgen. „Sicht prüfen“ sendet ein einzelnes Bild an Google. Keine automatische Aufnahme.</p><div className="jd-camera-controls"><button disabled={cameraPending} onClick={cameraOn ? stopCamera : startCamera}>{cameraOn ? <X size={15} /> : <Camera size={15} />}{cameraPending ? "Freigabe läuft…" : cameraOn ? "Kamera stoppen" : "Kamera freigeben"}</button><button disabled={!cameraOn || visionBusy || !visionReady} onClick={checkVision}><Eye size={15} />{visionBusy ? "Wird geprüft…" : "Sicht prüfen"}</button></div><small>{visionResult ? "Ein Bild geprüft. Kein laufender Videochat." : visionReady ? "Bildanalyse verfügbar · Prüfung auf Knopfdruck" : "Bildanalyse-Zugang wird geprüft oder fehlt."}</small></section>
      </aside>
    </div>
    <footer className="jd-bottom"><div className="jd-wave" aria-hidden="true">{Array.from({ length: 31 }, (_, i) => <i key={i} style={{ "--bar": `${7 + (i * 13 % 31)}px`, animationDelay: `${i * .035}s` } as React.CSSProperties} />)}</div><div className="jd-voice"><span>Jarvis · lokal erzeugt mit Qwen3-TTS</span><select aria-label="Jarvis-Stimme" value={voiceName} onChange={e => { stopVoice(); setVoiceName(e.target.value); }}><option value="dark">Dunkel und ruhig</option><option value="synthetic">Dunkel mit Synth-Effekt</option></select></div><label className="jd-speed">Sprechtempo <output>{voiceSpeed.toFixed(2).replace(".", ",")}×</output><input aria-label="Sprechtempo" type="range" min="0.95" max="1.35" step="0.01" value={voiceSpeed} onChange={event => { const speed = Number(event.target.value); setVoiceSpeed(speed); if (player.current) player.current.playbackRate = speed; }} /></label><button className="jd-speak" onClick={toggleVoice}><Volume2 size={17} />{speaking || voiceLoading ? "Stimme stoppen" : "Stimme testen"}</button><span className="jd-footnote">Designvorschau · Handyaktionen und Live-Sprachchat folgen</span></footer>
    {notice && <div className="jd-notice" role="alert">{notice}<button aria-label="Hinweis schließen" onClick={() => setNotice("")}><X size={15} /></button></div>}
    <video ref={video} muted playsInline hidden aria-hidden="true" />
  </main>;
}
