"use client";
/**
 * Loudness of Onur's microphone and Hermes' spoken reply, 0..1, for the orb.
 *
 * Read-only taps: the analyser only listens. The microphone stream keeps going
 * to the recorder unchanged; a spoken reply is routed through the analyser to
 * the speakers so it still plays exactly once. Every step is best effort — if
 * the browser refuses an audio graph, the orb simply stays calm.
 */
let ctx: AudioContext | null = null;
const sources = new Map<object, { analyser: AnalyserNode; node: AudioNode }>();
let smoothed = 0;
let frame = 0;
const buffer = new Uint8Array(256);

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

function sample() {
  let peak = 0;
  for (const { analyser } of sources.values()) {
    analyser.getByteTimeDomainData(buffer);
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      const v = (buffer[i] - 128) / 128;
      sum += v * v;
    }
    peak = Math.max(peak, Math.min(1, Math.sqrt(sum / buffer.length) * 4));
  }
  // Fast attack, slow release: speech reads as breathing, not flicker.
  smoothed = peak > smoothed ? smoothed + (peak - smoothed) * 0.5 : smoothed + (peak - smoothed) * 0.08;
  frame = sources.size ? requestAnimationFrame(sample) : 0;
  if (!sources.size) smoothed = 0;
}

function track(key: object, node: AudioNode, analyser: AnalyserNode) {
  sources.set(key, { analyser, node });
  if (!frame) frame = requestAnimationFrame(sample);
}

function untrack(key: object) {
  const entry = sources.get(key);
  if (!entry) return;
  try { entry.node.disconnect(entry.analyser); } catch { /* already gone */ }
  sources.delete(key);
}

/** Microphone: tap only, the stream is not routed anywhere audible. */
export function watchMicrophone(stream: MediaStream): () => void {
  try {
    const audio = context();
    if (!audio) return () => {};
    const node = audio.createMediaStreamSource(stream);
    const analyser = audio.createAnalyser();
    analyser.fftSize = 512;
    node.connect(analyser);
    track(stream, node, analyser);
    return () => untrack(stream);
  } catch {
    return () => {};
  }
}

/** Spoken reply: element → analyser → speakers, so it is heard exactly once. */
export function watchSpeech(element: HTMLAudioElement): void {
  try {
    const audio = context();
    // A suspended context would silence the reply once it is routed through
    // it. Only tap when audio is already running; otherwise the orb stays calm
    // and the reply plays normally.
    if (!audio || audio.state !== "running") return;
    const node = audio.createMediaElementSource(element);
    const analyser = audio.createAnalyser();
    analyser.fftSize = 512;
    node.connect(analyser);
    analyser.connect(audio.destination);
    track(element, node, analyser);
    const stop = () => untrack(element);
    element.addEventListener("ended", stop, { once: true });
    element.addEventListener("error", stop, { once: true });
  } catch {
    /* The element still plays through its default output. */
  }
}

export function voiceLevel(): number {
  return smoothed;
}
