"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Maximize, Settings2, X, PhoneOff, Mic, ArrowUpRight, Brain } from "lucide-react";
import { TrackedHead } from "./TrackedHead";
import { neutralGaze } from "./tracking";
import { useFaceTracking, type FaceMesh, type TrackingState } from "./useFaceTracking";
import { VisionHud, type HudMode } from "./VisionHud";
import { DataRain } from "./DataRain";
import { JarvisLiveSession, type LivePhase, type PendingTask } from "./session";
import type { SpeechStatus } from "@/lib/jarvis/elevenVoice";
import { PERSONAS, type PersonaId } from "@/lib/jarvis/personas";
import { useKnowledgeScan } from "./useKnowledgeScan";
import "../dashboard/dashboard.css";
import "./live.css";

const status: Record<LivePhase, string> = { idle: "STANDBY", connecting: "VERBINDE", listening: "ICH HÖRE ZU", thinking: "ICH DENKE MIT", speaking: "JARVIS SPRICHT" };
export function JarvisLive() {
  const [phase, setPhase] = useState<LivePhase>("idle");
  const [panel, setPanel] = useState(true);
  const [consent, setConsent] = useState(false);
  const [camera, setCamera] = useState(true);
  const [coach, setCoach] = useState(true);
  const [snap, setSnap] = useState(true);
  const [assist, setAssist] = useState(true);
  const [laughAlways, setLaughAlways] = useState(true);
  const [browser, setBrowser] = useState(true);
  const [place, setPlace] = useState("");
  const [brainOpen, setBrainOpen] = useState(true);
  const [torso, setTorso] = useState(true);
  const [browserUrl, setBrowserUrl] = useState<string | null>(null);
  const [todoist, setTodoist] = useState(true);
  const [todoistConnected, setTodoistConnected] = useState(false);
  const [knowledge, setKnowledge] = useState(true);
  const [knowledgeReady, setKnowledgeReady] = useState(false);
  const [brainSide, setBrainSide] = useState(1);
  const { state: scan } = useKnowledgeScan();
  const attention = useRef(0);
  const [pendingTask, setPendingTask] = useState<PendingTask | null>(null);
  const [taskBusy, setTaskBusy] = useState(false);
  const [taskError, setTaskError] = useState("");
  const [voice, setVoice] = useState("ElevenLabs");
  const [persona, setPersona] = useState<PersonaId>("kumpel");
  const [eleven, setEleven] = useState<SpeechStatus | null>(null);
  const [checkingVoice, setCheckingVoice] = useState(false);
  const [audioDevice, setAudioDevice] = useState("");
  const [videoDevice, setVideoDevice] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState(false);
  const [inspect, setInspect] = useState(0);
  const [mirror, setMirror] = useState(true);
  const [tracking, setTracking] = useState<TrackingState>("off");
  const gaze = useRef(neutralGaze());
  const mesh = useRef<FaceMesh>({ points: null, seen: 0 });
  const [hud, setHud] = useState<HudMode>("camera");
  const [hudTop, setHudTop] = useState(true);
  const previewStream = useRef<MediaStream | null>(null);
  const previewGeneration = useRef(0);
  const video = useRef<HTMLVideoElement>(null);
  const level = useRef(0);
  const call = useRef<JarvisLiveSession | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const mounted = useRef(false);
  const active = phase !== "idle" || preview;
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("jarvis_live_settings") || "null");
      if (saved && typeof saved === "object") {
        const bool = (key: string, set: (value: boolean) => void) => { if (typeof saved[key] === "boolean") set(saved[key]); };
        bool("camera", setCamera); bool("coach", setCoach); bool("snap", setSnap); bool("assist", setAssist); bool("browser", setBrowser); bool("brainOpen", setBrainOpen); bool("torso", setTorso);
        bool("todoist", setTodoist); bool("knowledge", setKnowledge); bool("mirror", setMirror); bool("consent", setConsent); bool("hudTop", setHudTop); bool("laughAlways", setLaughAlways);
        if (["off", "mesh", "camera"].includes(saved.hud)) setHud(saved.hud);
        if (saved.persona === "kumpel" || saved.persona === "stratege") setPersona(saved.persona);
        if (saved.brainSide === 1 || saved.brainSide === -1) setBrainSide(saved.brainSide);
        if (typeof saved.voice === "string" && saved.voice.length < 40) setVoice(saved.voice);
        if (typeof saved.place === "string") setPlace(saved.place.slice(0, 60));
      }
    } catch { /* unreadable settings fall back to the defaults */ }
    setRestored(true);
  }, []);
  useEffect(() => {
    // Waits for the render that carries the restored values, so defaults never overwrite them.
    if (!restored) return;
    try { localStorage.setItem("jarvis_live_settings", JSON.stringify({ laughAlways, camera, coach, snap, assist, browser, brainOpen, torso, todoist, knowledge, mirror, consent, hudTop, hud, persona, brainSide, voice, place })); } catch { /* storage may be blocked */ }
  }, [camera, coach, snap, assist, browser, brainOpen, torso, todoist, knowledge, mirror, consent, hudTop, hud, persona, brainSide, voice, place, restored, laughAlways]);
  const stop = useCallback(() => { previewGeneration.current++; previewStream.current?.getTracks().forEach(track => { track.onended = null; track.stop(); }); previewStream.current = null; if (video.current) { video.current.pause(); video.current.srcObject = null; } if (mounted.current) setPreview(false); call.current?.stop(); call.current = null; if (mounted.current) { setPhase("idle"); setPanel(true); } }, []);
  useFaceTracking(video, camera && active, mirror, gaze, setTracking, mesh);
  useEffect(() => {
    mounted.current = true; const abort = new AbortController();
    fetch("/api/jarvis/live", { signal: abort.signal }).then(r => r.json()).then(data => { if (!abort.signal.aborted) { setReady(data.configured === true); setKnowledgeReady(data.knowledge?.configured === true); setEleven(data.elevenlabs || null); if (!data.elevenlabs?.configured) setVoice("Charon"); } }).catch(() => {});
    fetch("/api/jarvis/todoist", { signal: abort.signal }).then(r => r.json()).then(data => { if (!abort.signal.aborted) setTodoistConnected(data.connected === true || Boolean(localStorage.getItem("hermes_todoist_token"))); }).catch(() => {});
    const refresh = () => { void navigator.mediaDevices?.enumerateDevices().then(list => { if (mounted.current) setDevices(list); }).catch(() => {}); };
    refresh(); navigator.mediaDevices?.addEventListener("devicechange", refresh);
    const hidden = () => { if (document.hidden) stop(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") stop(); else if ((event.key === "g" || event.key === "G") && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) && !dialog.current?.open) setBrainOpen(value => !value); };
    document.addEventListener("visibilitychange", hidden); window.addEventListener("pagehide", stop); window.addEventListener("keydown", escape);
    return () => { mounted.current = false; abort.abort(); previewGeneration.current++; previewStream.current?.getTracks().forEach(track => track.stop()); previewStream.current = null; call.current?.stop(); navigator.mediaDevices?.removeEventListener("devicechange", refresh); document.removeEventListener("visibilitychange", hidden); window.removeEventListener("pagehide", stop); window.removeEventListener("keydown", escape); };
  }, [stop]);
  useEffect(() => {
    attention.current = knowledge && active && scan.phase !== "idle" && scan.phase !== "error" ? brainSide : 0;
    const timer = setTimeout(() => { attention.current = 0; }, Math.max(0, scan.at + 2600 - Date.now()));
    return () => { clearTimeout(timer); attention.current = 0; };
  }, [scan, brainSide, active, knowledge]);
  useEffect(() => { if (panel && !dialog.current?.open) dialog.current?.showModal(); if (!panel) { dialog.current?.querySelectorAll("audio").forEach(audio => audio.pause()); if (dialog.current?.open) dialog.current.close(); } }, [panel]);
  function start() {
    if (!consent || active || !video.current || (voice === "ElevenLabs" && !eleven?.ready)) return;
    setNotice(""); setInspect(0); setPhase("connecting"); setPanel(false);
    const session = new JarvisLiveSession(video.current, {
      level,
      browser: url => { if (mounted.current && call.current === session) setBrowserUrl(url); },
      pendingTask: value => { if (mounted.current && call.current === session) { setPendingTask(value); setTaskError(""); } },
      phase: value => { if (mounted.current && call.current === session) setPhase(value); },
      error: message => { if (mounted.current && call.current === session) { call.current = null; setNotice(message); setPanel(true); } },
    });
    call.current = session;
    void session.start({ camera, coach, snap, assist, laughAlways: laughAlways && persona === "kumpel", voice, persona, browser, place, todoist: todoist && todoistConnected, knowledge: knowledge && knowledgeReady, audioDevice, videoDevice });
  }
  async function confirmTask() {
    const session = call.current, task = pendingTask;
    if (!session || !task || taskBusy) return;
    setTaskBusy(true); setTaskError("");
    try { await session.confirmTask(task); }
    catch (error) { if (mounted.current && call.current === session) setTaskError(error instanceof Error ? error.message : "Aufgabe konnte nicht erledigt werden."); }
    finally { if (mounted.current) setTaskBusy(false); }
  }
  async function testGaze() {
    if (active || !video.current) return;
    const generation = ++previewGeneration.current;
    setNotice(""); setInspect(0); setPreview(true); setPanel(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 1280 }, height: { ideal: 720 }, ...(videoDevice ? { deviceId: { exact: videoDevice } } : { facingMode: "user" }) } });
      if (!mounted.current || generation !== previewGeneration.current) { stream.getTracks().forEach(track => track.stop()); return; }
      previewStream.current = stream;
      stream.getTracks().forEach(track => { track.onended = stop; });
      video.current!.srcObject = stream;
      await video.current!.play();
    } catch { if (mounted.current && generation === previewGeneration.current) { stop(); setNotice("Die Kamera konnte nicht gestartet werden. Prüfe die Browserfreigabe und ob eine andere App sie verwendet."); } }
  }
  const inputs = devices.filter(device => device.kind === "audioinput");
  const cameras = devices.filter(device => device.kind === "videoinput");
  async function refreshVoice() { setCheckingVoice(true); try { const response = await fetch("/api/jarvis/live?refresh=1"); const data = await response.json(); if (mounted.current) setEleven(data.elevenlabs || null); } catch { if (mounted.current) setNotice("Stimmzugang konnte nicht geprüft werden."); } finally { if (mounted.current) setCheckingVoice(false); } }
  return <main className={`jl jl-${phase}`} data-brain={brainOpen || browserUrl ? (brainSide === 1 ? "right" : "left") : undefined} data-torso={torso ? "" : undefined}>
    {torso && <DataRain />}
    <div className="jl-space" aria-hidden="true"><div className="jl-orbit jl-orbit-a" /><div className="jl-orbit jl-orbit-b" /><div className="jl-grid" /></div>
    <header className="jl-top"><Link href="/v2" className="jl-wordmark">JARVIS<span>HERMES PERSONAL ASSISTANT</span></Link><div className="jl-signal" role="status"><i />{preview ? "BLICKTEST" : status[phase]}{active && <small>{preview ? "CAM · LOKAL" : camera ? "MIC + CAM" : "MIC"}</small>}</div><div className="jl-tools"><button aria-label="Gehirn ein- oder ausblenden" aria-pressed={brainOpen} onClick={() => setBrainOpen(value => !value)}><Brain size={18} /></button><button aria-label="Vollbild" onClick={() => { void document.documentElement.requestFullscreen?.().catch(() => {}); }}><Maximize size={17} /></button><button aria-label="Gesprächseinstellungen" onClick={() => setPanel(true)}><Settings2 size={18} /></button>{active && <button aria-label="Gespräch beenden" onClick={stop}><PhoneOff size={18} /></button>}</div></header>
    <section className="jl-presence" aria-label="Jarvis Live-Gespräch"><div className="jl-head"><TrackedHead level={level} gaze={gaze} attention={attention} inspect={inspect} active={active} torso={torso} onActivate={() => setPanel(true)} /></div><div className="jl-platform" aria-hidden="true" /><div className="jl-presence-label">{active && knowledge && scan.phase === "found" ? "IN DEINEN NOTIZEN GEFUNDEN." : phase === "speaking" ? "ICH DENKE MIT." : phase === "listening" ? "BIN BEI DIR, BOSS." : "DEIN RAUM. DEIN JARVIS."}</div></section>
    <span className="jl-session-mark">LIVE PRESENCE / 02{tracking !== "off" && <span className="jl-tracking" data-state={tracking}>{({ loading: "BLICK WIRD GELADEN", searching: "SUCHE DEINEN BLICK", following: "BLICK FOLGT DIR", unavailable: "BLICKVERFOLGUNG NICHT VERFÜGBAR" } as Record<string, string>)[tracking]}</span>}</span>
    {brainOpen && <iframe className="jl-brain" src="/jarvis/scan" title="Wissensnetz" />}
    {browserUrl && <div className="jl-brain jl-browser"><iframe src={browserUrl} title="Jarvis zeigt" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" /><button aria-label="Anzeige schließen" onClick={() => setBrowserUrl(null)}><X size={18} /></button><span>JARVIS ZEIGT</span></div>}
    {camera && active && <VisionHud video={video} mesh={mesh} mode={hud} top={hudTop} />}
    {pendingTask && <aside className="jl-task-confirm" aria-label="Bestätigung"><small>{pendingTask.kind === "note" ? "NOTIZ IN DEN EINGANG SPEICHERN" : pendingTask.kind === "task" ? "NEUE AUFGABE IN TODOIST" : "IN TODOIST ERLEDIGEN"}</small><p>{pendingTask.title}</p>{pendingTask.detail && <p className="jl-task-detail">{pendingTask.detail}</p>}{taskError && <p role="alert">{taskError}</p>}<div><button disabled={taskBusy} onClick={() => { void confirmTask(); }}>{taskBusy ? "Moment" : pendingTask.kind === "note" ? "Speichern" : pendingTask.kind === "task" ? "Anlegen" : "Erledigen"}</button><button disabled={taskBusy} onClick={() => call.current?.dismissTask()}>Nicht jetzt</button></div></aside>}
    <dialog ref={dialog} className="jl-dialog" aria-labelledby="jl-title" onCancel={event => { event.preventDefault(); setPanel(false); }}>
      <button className="jl-close" aria-label="Einstellungen schließen" onClick={() => setPanel(false)}><X size={20} /></button>
      <span className="jl-eyebrow">VOR DEM TAKE</span><h1 id="jl-title">Jarvis ist da.</h1><p className="jl-lead">Ein Gespräch. Ein Blick.<br />Danach gehört der Bildschirm ihm.</p>
      <div className="jl-fields"><label>Stimme<select aria-label="Live-Stimme" disabled={active} value={voice} onChange={event => setVoice(event.target.value)}>{eleven?.configured && <option value="ElevenLabs">{eleven.voiceName} · ElevenLabs</option>}<option value="Charon">Charon · ruhig und souverän</option><option value="Algenib">Algenib · rauer Klang</option><option value="Orus">Orus · bestimmt</option></select></label>
      <label>Persönlichkeit<select aria-label="Persönlichkeit" disabled={active} value={persona} onChange={event => setPersona(event.target.value as PersonaId)}>{(Object.keys(PERSONAS) as PersonaId[]).map(id => <option key={id} value={id}>{PERSONAS[id].label}</option>)}</select></label>
      <label>Mikrofon<select aria-label="Live-Mikrofon" disabled={active} value={audioDevice} onChange={event => setAudioDevice(event.target.value)}><option value="">Systemstandard</option>{inputs.map((device, i) => <option key={device.deviceId || i} value={device.deviceId}>{device.label || `Mikrofon ${i + 1}`}</option>)}</select></label>
      <label>Kamera<select aria-label="Live-Kamera" disabled={active || !camera} value={videoDevice} onChange={event => setVideoDevice(event.target.value)}><option value="">Systemstandard</option>{cameras.map((device, i) => <option key={device.deviceId || i} value={device.deviceId}>{device.label || `Kamera ${i + 1}`}</option>)}</select></label></div>
      {voice === "ElevenLabs" && eleven && <div className="jl-voice-info">{eleven.previewUrl && <audio controls preload="none" src={eleven.previewUrl} aria-label={`Hörprobe ${eleven.voiceName}`} />}{!eleven.ready && <p className="jl-error" role="status">{eleven.error}</p>}{!active && <button className="jl-end" disabled={checkingVoice} onClick={()=>{void refreshVoice();}}>{checkingVoice ? "Wird geprüft" : "Kontingent erneut prüfen"}</button>}</div>}
      {voice === "ElevenLabs" && <label className="jl-check"><input type="checkbox" checked={laughAlways} disabled={active} onChange={event => setLaughAlways(event.target.checked)} /><span>Jeder Satz beginnt mit dem dreckigen Lachen<span>Nur mit der ElevenLabs-Stimme und der Persönlichkeit Kumpel. Ohne Haken lacht er nach Gefühl.</span></span></label>}
      <label className="jl-check"><input type="checkbox" checked={camera} disabled={active} onChange={event => setCamera(event.target.checked)} /><span>Kamera dabei<span>Jarvis sieht dich. Die Erfassungsansicht wird nur lokal gezeichnet.</span></span></label>
      <label className="jl-brain-side">Erfassungsansicht im Bild<select aria-label="Erfassungsansicht" disabled={!camera} value={hud} onChange={event => setHud(event.target.value as HudMode)}><option value="mesh">Nur Körperumriss, Gesichtsnetz und Augen, kein Kamerabild</option><option value="camera">Kamerabild mit Körperscan (Raum ist sichtbar)</option><option value="off">Aus</option></select></label>
      <label className="jl-check"><input type="checkbox" checked={hudTop} disabled={!camera || hud === "off"} onChange={event => setHudTop(event.target.checked)} /><span>Erfassungsansicht groß oben in der Mitte<span>Gut sichtbar für Hochkant-Videos. Ohne Haken klein unten links.</span></span></label>
      <label className="jl-check"><input type="checkbox" checked={coach} disabled={active} onChange={event => setCoach(event.target.checked)} /><span>Fokuscoach<span>Meldet sich einmal nach 15 Sekunden Gesprächspause.</span></span></label>
      <label className="jl-check"><input type="checkbox" checked={snap} disabled={active} onChange={event => setSnap(event.target.checked)} /><span>Schnipsen als Zeichen<span>Ein Schnipsen oder Klatschen in einer Sprechpause, und Jarvis meldet sich von selbst. Wird lokal erkannt.</span></span></label>
      <label className="jl-check"><input type="checkbox" checked={assist} disabled={active} onChange={event => setAssist(event.target.checked)} /><span>Lesen, Notizen, neue Aufgaben<span>Jarvis liest ein Schriftstück, das du in die Kamera hältst, notiert auf Zuruf in deinen Notizeingang und legt mit Todoist neue Aufgaben an. Speichern und Anlegen bestätigst du am Bildschirm.</span></span></label>
      <label className="jl-check"><input type="checkbox" checked={browser} disabled={active} onChange={event => setBrowser(event.target.checked)} /><span>Browser auf Zuruf<span>Jarvis zeigt Karten- und Google-Suchen groß neben sich im selben Bild. Er liest die Treffer nicht und bestellt oder kauft nichts.</span></span></label>
      {browser && <label className="jl-brain-side">Ort für Suchen in der Nähe (freiwillig, wird im Gespräch genannt)<input className="jl-place" aria-label="Ort für Suchen" disabled={active} maxLength={60} value={place} onChange={event => setPlace(event.target.value)} placeholder="z. B. Stadtname" /></label>}
      <label className="jl-brain-side">Darstellung<select aria-label="Darstellung" value={torso ? "show" : "classic"} onChange={event => setTorso(event.target.value === "show")}><option value="show">Show · Schultern und Datenregen</option><option value="classic">Klassisch · nur der Kopf auf der Plattform</option></select></label>
      <label className="jl-check"><input type="checkbox" checked={brainOpen} onChange={event => setBrainOpen(event.target.checked)} /><span>Gehirn im selben Bild<span>Jarvis rückt zur Seite, das Wissensnetz füllt die andere Hälfte. Taste G schaltet um.</span></span></label>
      <label className="jl-check"><input type="checkbox" checked={todoist} disabled={active || !todoistConnected} onChange={event => setTodoist(event.target.checked)} /><span>Todoist {todoistConnected ? "verbunden" : "nicht verbunden"}<span>Frag nach heute, morgen oder dieser Woche. Erledigungen bestätigst du an der konkreten Aufgabe.</span></span></label>
      <label className="jl-check"><input type="checkbox" checked={knowledge} disabled={active || !knowledgeReady} onChange={event => setKnowledge(event.target.checked)} /><span>Mein Wissen {knowledgeReady ? "verbunden" : "nicht eingerichtet"}<span>Durchsucht dein Notizarchiv, ohne als sensibel markierte Seiten. Treffer leuchten im Gehirn.</span></span></label>
      <button className="jl-preview" onClick={() => { window.open("/jarvis/scan", "jarvis-wissen", "popup,width=1280,height=900"); }}>Gehirn auf Monitor 2 öffnen<span>Das neue Fenster auf deinen zweiten Bildschirm ziehen.</span></button>
      {knowledge && <label className="jl-brain-side">Gehirn steht<select aria-label="Position des zweiten Monitors" value={brainSide} onChange={event => setBrainSide(Number(event.target.value))}><option value={1}>Rechts von Jarvis</option><option value={-1}>Links von Jarvis</option></select></label>}
      <label className="jl-check"><input type="checkbox" checked={mirror} disabled={active} onChange={event => setMirror(event.target.checked)} /><span>Blickrichtung spiegeln<span>Falls der Kopf bei deiner Kameraposition in die falsche Richtung folgt.</span></span></label>
      <label className="jl-check jl-consent"><input type="checkbox" checked={consent} disabled={active} onChange={event => setConsent(event.target.checked)} /><span>Live-Übertragung freigeben<span>Während des Gesprächs gehen Mikrofonton und bei aktivierter Kamera etwa ein Bild pro Sekunde an Google Gemini. Bei einer Todoist-Abfrage auch Aufgabentitel und Fälligkeiten. {assist && "Beim Lesen geht eine scharfe Einzelaufnahme des gezeigten Schriftstücks an Gemini, bei Notizen und neuen Aufgaben dein diktierter Text. "}{browser && "Mit Browser kennt Gemini den angegebenen Ort; geöffnete Suchen laufen in deinem Browser bei Google. "}{knowledge && "Bei Wissensfragen gehen passende Auszüge aus deinem Notizarchiv an Gemini und werden vorgelesen. "}{voice === "ElevenLabs" && "Die Antworttexte gehen zur Sprachausgabe an ElevenLabs und verbrauchen dessen Kontingent. "}Keine Aufnahme durch Hermes. Google-Kontingent wird genutzt.</span></span></label>
      {notice && <p className="jl-error" role="alert">{notice}</p>}
      {active ? <div className="jl-actions"><button className="jl-start" onClick={() => setPanel(false)}>Zurück zum Drehmodus <ArrowUpRight size={18} /></button><button className="jl-end" onClick={stop}>Gespräch beenden</button></div> : <button className="jl-start" disabled={!consent || !ready || (voice === "ElevenLabs" && !eleven?.ready)} onClick={start}><Mic size={17} />{ready ? "Gespräch starten" : "Live-Zugang wird geprüft"}<ArrowUpRight size={18} /></button>}
      {!active && <button className="jl-preview" disabled={!camera} onClick={() => { void testGaze(); }}>Nur Blick testen<span>Nur deine Kamera · lokal · ohne Mikrofon oder Google-Verbindung</span></button>}
      {!active && <button className="jl-preview" onClick={()=>{setInspect(value=>value+1);setPanel(false);}}>Kopf 360° ansehen<span>Ohne Kamera · danach frei mit Maus oder Finger drehen</span></button>}
      <div className="jl-foot"><span>ESC beendet das Gespräch · max. 10 Minuten</span><Link href="/jarvis/stimmen.html">Stimmvergleich</Link><Link href="/jarvis/studio">Stimmstudio</Link></div>
    </dialog>
    <video ref={video} hidden muted playsInline aria-hidden="true" />
  </main>;
}
