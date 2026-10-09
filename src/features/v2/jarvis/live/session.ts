export type LivePhase = "idle" | "connecting" | "listening" | "thinking" | "speaking";
type CallOptions = { camera: boolean; coach: boolean; voice: string; audioDevice?: string; videoDevice?: string };
type CallEvents = { phase: (value: LivePhase) => void; error: (value: string) => void; level: { current: number } };

export function bytesToBase64(bytes: Uint8Array) {
  let result = ""; for (const value of bytes) result += String.fromCharCode(value);
  return btoa(result);
}
export function pcmFromBase64(data: string) {
  const binary = atob(data); if (!binary.length || binary.length % 2) throw new Error("Ungültiges Sprachaudio.");
  const bytes = new Uint8Array(binary.length); for (let i = 0; i < bytes.length; i++) bytes[i] = binary.charCodeAt(i);
  const view = new DataView(bytes.buffer); const samples = new Float32Array(bytes.length / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
  return samples;
}

export class LivePcmPlayer {
  private sources = new Set<AudioBufferSourceNode>();
  private next = 0;
  constructor(private context: AudioContext, private output: AudioNode, private state: (playing: boolean) => void) {}
  play(data: string, rate = 24000) {
    const samples = pcmFromBase64(data);
    if (samples.length > rate * 15) throw new Error("Sprachpaket zu groß.");
    if (this.next - this.context.currentTime > 12) throw new Error("Audioverbindung ist zu langsam. Gespräch neu starten.");
    const buffer = this.context.createBuffer(1, samples.length, rate); buffer.copyToChannel(samples, 0);
    const source = this.context.createBufferSource(); source.buffer = buffer; source.connect(this.output);
    this.sources.add(source); this.state(true);
    source.onended = () => { source.disconnect(); this.sources.delete(source); if (!this.sources.size) this.state(false); };
    const start = Math.max(this.context.currentTime + .035, this.next); this.next = start + buffer.duration;
    source.start(start);
  }
  get playing() { return this.sources.size > 0; }
  stop() {
    for (const source of this.sources) { source.onended = null; try { source.stop(); } catch {} source.disconnect(); }
    this.sources.clear(); this.next = 0; this.state(false);
  }
}

export class JarvisLiveSession {
  private stopped = false;
  private ready = false;
  private abort = new AbortController();
  private socket: WebSocket | null = null;
  private media: MediaStream | null = null;
  private context: AudioContext | null = null;
  private capture: AudioWorkletNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private mute: GainNode | null = null;
  private player: LivePcmPlayer | null = null;
  private frame = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private lastActivity = Date.now();
  private lastFrame = 0;
  private coachSpoke = false;
  private messages = Promise.resolve();
  constructor(private video: HTMLVideoElement, private events: CallEvents) {}

  private fail(message: string) { if (this.stopped) return; this.stop(); this.events.error(message); }
  private send(message: object) {
    if (!this.stopped && this.ready && this.socket?.readyState === WebSocket.OPEN) {
      if (this.socket.bufferedAmount > 2_000_000) { this.fail("Verbindung zu langsam. Das Gespräch wurde beendet."); return; }
      this.socket.send(JSON.stringify(message));
    }
  }
  async start(options: CallOptions) {
    this.events.phase("connecting");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) throw new Error("Mikrofon und Kamera brauchen localhost oder HTTPS und einen aktuellen Browser.");
      const context = new AudioContext({ latencyHint: "interactive" }); this.context = context;
      await context.resume(); if (this.stopped) return;
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(options.audioDevice ? { deviceId: { exact: options.audioDevice } } : {}) }, video: options.camera ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user", ...(options.videoDevice ? { deviceId: { exact: options.videoDevice } } : {}) } : false });
      if (this.stopped) { media.getTracks().forEach(track => track.stop()); return; }
      this.media = media;
      media.getTracks().forEach(track => { track.onended = () => this.fail("Mikrofon oder Kamera wurde getrennt. Gespräch beendet."); });
      if (options.camera) { this.video.srcObject = media; await this.video.play(); }
      if (this.stopped) return;
      await context.audioWorklet.addModule("/jarvis/live-capture.js");
      if (this.stopped) return;
      const response = await fetch("/api/jarvis/live", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent: true, voice: options.voice }), signal: this.abort.signal });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Live-Zugang konnte nicht vorbereitet werden.");
      if (this.stopped) return;
      if (data.endpoint !== "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained" || !data.token?.startsWith("auth_tokens/")) throw new Error("Ungültige Live-Verbindung.");
      const analyser = context.createAnalyser(); analyser.fftSize = 256; analyser.connect(context.destination);
      this.player = new LivePcmPlayer(context, analyser, playing => { if (!this.stopped) { this.events.phase(playing ? "speaking" : "listening"); this.lastActivity = Date.now(); } });
      const samples = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (this.stopped) return;
        analyser.getByteTimeDomainData(samples); let sum = 0;
        for (const value of samples) sum += ((value - 128) / 128) ** 2;
        this.events.level.current = Math.min(1, Math.sqrt(sum / samples.length) * 5);
        this.frame = requestAnimationFrame(tick);
      };
      this.frame = requestAnimationFrame(tick);
      const socket = new WebSocket(`${data.endpoint}?access_token=${encodeURIComponent(data.token)}`); this.socket = socket;
      const deadline = setTimeout(() => this.fail("Live-Verbindung braucht zu lange. Bitte erneut starten."), 15000); this.timers.push(deadline);
      socket.onopen = () => { if (!this.stopped) socket.send(JSON.stringify({ setup: data.setup })); };
      socket.onerror = () => this.fail("Google-Live-Verbindung unterbrochen. Bitte erneut starten.");
      socket.onclose = event => { if (!this.stopped) this.fail(event.code === 1000 ? "Gespräch beendet. Du kannst neu starten." : "Live-Verbindung geschlossen. Kontingent oder Netzwerk prüfen und neu starten."); };
      socket.onmessage = event => {
        this.messages = this.messages.then(async () => {
          if (this.stopped) return;
          const raw = typeof event.data === "string" ? event.data : await event.data.text();
          if (this.stopped) return;
          const message = JSON.parse(raw);
          if (message.error) { this.fail("Google konnte das Live-Gespräch nicht fortsetzen."); return; }
          if (message.setupComplete) {
            clearTimeout(deadline); this.ready = true; this.lastActivity = Date.now();
            this.microphone = context.createMediaStreamSource(media);
            this.capture = new AudioWorkletNode(context, "jarvis-capture");
            this.mute = context.createGain(); this.mute.gain.value = 0;
            this.microphone.connect(this.capture); this.capture.connect(this.mute); this.mute.connect(context.destination);
            this.capture.port.onmessage = packet => this.send({ realtimeInput: { audio: { mimeType: "audio/pcm;rate=16000", data: bytesToBase64(new Uint8Array(packet.data)) } } });
            this.events.phase("listening");
            const camera = document.createElement("canvas"); camera.width = 640;
            const capture = () => {
              if (!options.camera || this.stopped || !this.video.videoWidth) return;
              camera.height = Math.round(this.video.videoHeight / this.video.videoWidth * 640);
              const ctx = camera.getContext("2d"); if (!ctx) return;
              ctx.drawImage(this.video, 0, 0, camera.width, camera.height);
              this.send({ realtimeInput: { video: { mimeType: "image/jpeg", data: camera.toDataURL("image/jpeg", .65).split(",")[1] } } });
              this.lastFrame = Date.now();
            };
            capture();
            this.timers.push(setInterval(capture, 1000));
            this.timers.push(setInterval(() => {
              if (options.coach && !this.coachSpoke && !this.player?.playing && Date.now() - this.lastActivity >= 15000 && (!options.camera || Date.now() - this.lastFrame < 3000)) {
                this.coachSpoke = true; this.events.phase("thinking");
                this.send({ clientContent: { turns: [{ role: "user", parts: [{ text: options.camera ? "Fokuscoach-Impuls: Schau auf das aktuelle Kamerabild. Melde dich jetzt einmal mit einem kurzen trockenen Boss-Kommentar und einem konkreten Anstoß, an den Projekten weiterzuarbeiten. Beschreibe nur wirklich Sichtbares. Keine Begrüßung." : "Fokuscoach-Impuls: Gib mir jetzt einmal einen kurzen trockenen Boss-Kommentar zum Weiterarbeiten an meinen Projekten. Du hast kein Kamerabild, also erfinde keine Beobachtung." }] }], turnComplete: true } });
              }
            }, 1000));
            this.timers.push(setTimeout(() => this.fail("Die zehnminütige Sitzung ist beendet. Für den nächsten Take neu starten."), 10 * 60_000));
          }
          const content = message.serverContent;
          if (content?.interrupted) this.player?.stop();
          if (content?.inputTranscription?.text) { this.lastActivity = Date.now(); if (!this.player?.playing) this.events.phase("thinking"); }
          for (const part of content?.modelTurn?.parts || []) {
            if (part.inlineData?.mimeType?.startsWith("audio/pcm")) {
              this.lastActivity = Date.now(); const rate = Number(part.inlineData.mimeType.match(/rate=(\d+)/)?.[1] || 24000);
              if (rate < 8000 || rate > 48000) throw new Error("Unbekanntes Audioformat.");
              this.player?.play(part.inlineData.data, rate);
            }
          }
          if (content?.turnComplete && !this.player?.playing) this.events.phase("listening");
          if (message.goAway) this.fail("Die Live-Sitzung läuft aus. Für den nächsten Take neu starten.");
        }).catch(() => this.fail("Audio oder Live-Nachricht konnte nicht verarbeitet werden. Gespräch beendet."));
      };
    } catch (error) {
      if (this.stopped) return;
      const message = error instanceof Error ? error.message : "Gespräch konnte nicht starten.";
      this.fail(error instanceof Error && error.name === "NotAllowedError" ? "Mikrofon-/Kamerafreigabe fehlt. Erlaube sie für diese Seite." : message);
    }
  }
  stop() {
    if (this.stopped) return; this.stopped = true; this.ready = false; this.abort.abort();
    this.timers.forEach(timer => { clearTimeout(timer); clearInterval(timer); }); this.timers = [];
    cancelAnimationFrame(this.frame); this.events.level.current = 0;
    if (this.capture) { this.capture.port.onmessage = null; this.capture.disconnect(); this.capture.port.close(); }
    this.microphone?.disconnect(); this.mute?.disconnect();
    this.player?.stop();
    if (this.socket) { this.socket.onmessage = this.socket.onopen = this.socket.onclose = this.socket.onerror = null; this.socket.close(); }
    this.media?.getTracks().forEach(track => { track.onended = null; track.stop(); }); this.media = null;
    this.video.pause(); this.video.srcObject = null;
    if (this.context) void this.context.close().catch(() => {});
    this.events.phase("idle");
  }
}
