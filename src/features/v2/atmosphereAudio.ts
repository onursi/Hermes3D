"use client";

// Local synthesis only. Animation/engine sounds do not represent agent work.
export const flightAudio = { speed: 0 };
let context: AudioContext | null = null;

/** Call from a click. Persisted preferences alone never open an audio device. */
export function unlockAtmosphere() {
  if (!context) context = new AudioContext();
  void context.resume().catch(() => {});
  window.dispatchEvent(new Event("hermes:audio-ready"));
}

export function runAtmosphere(world: string, volume: number): (() => void) | null {
  const audio = context;
  if (!audio || volume <= 0) return null;
  const master = audio.createGain();
  const compressor = audio.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.ratio.value = 8;
  master.gain.value = 0;
  master.connect(compressor).connect(audio.destination);
  const sources: (OscillatorNode | AudioBufferSourceNode)[] = [];
  const nodes: AudioNode[] = [master, compressor];
  const brain = world === "cosmos";
  const travelling = world === "universe";
  function voice(hz: number, level: number, type: OscillatorType = "sine") {
    const oscillator = audio!.createOscillator();
    const gain = audio!.createGain();
    oscillator.type = type;
    oscillator.frequency.value = hz;
    gain.gain.value = level;
    oscillator.connect(gain).connect(master);
    oscillator.start();
    sources.push(oscillator); nodes.push(oscillator, gain);
    return { oscillator, gain };
  }
  // Quiet, slightly detuned open fifths under an airy upper harmonic.
  const drone = voice(brain ? 196 : 65.4, brain ? 0.025 : 0.1);
  voice(brain ? 294.3 : 98.2, brain ? 0.015 : 0.065);
  const shimmer = voice(brain ? 1568 : 392.4, 0.008);
  const engine = voice(48, 0, "triangle");
  const spark = voice(2300, 0);
  const buffer = audio.createBuffer(1, audio.sampleRate * 3, audio.sampleRate);
  const samples = buffer.getChannelData(0);
  let seed = 73;
  for (let i = 0; i < samples.length; i++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    samples[i] = seed / 2147483648 - 1;
  }
  const noise = audio.createBufferSource();
  noise.buffer = buffer; noise.loop = true;
  const filter = audio.createBiquadFilter();
  filter.type = brain ? "bandpass" : "lowpass";
  filter.frequency.value = brain ? 3900 : 420;
  filter.Q.value = brain ? 1.2 : 0.45;
  const air = audio.createGain(); air.gain.value = 0.015;
  noise.connect(filter).connect(air).connect(master); noise.start();
  sources.push(noise); nodes.push(noise, filter, air);
  let tick = 0;
  const update = () => {
    const now = audio.currentTime;
    const audible = document.visibilityState === "visible" && document.hasFocus();
    master.gain.setTargetAtTime(audible ? volume * 0.6 : 0, now, 0.12);
    const power = travelling ? Math.min(1, Math.log1p(flightAudio.speed / 26) / Math.log(101)) : 0;
    engine.oscillator.frequency.setTargetAtTime(48 + power * 180, now, 0.12);
    engine.gain.gain.setTargetAtTime(power * 0.19, now, 0.1);
    filter.frequency.setTargetAtTime(brain ? 3900 : 420 + power * 4200, now, 0.15);
    air.gain.setTargetAtTime(brain ? 0.018 + Math.max(0, Math.sin(tick * 1.73)) ** 14 * 0.16 : 0.025 + power * 0.28, now, 0.025);
    shimmer.gain.gain.setTargetAtTime(0.008 + (1 + Math.sin(tick * 0.075)) * 0.005, now, 0.3);
    drone.oscillator.detune.setTargetAtTime(Math.sin(tick * 0.035) * 4, now, 0.3);
    if (brain && tick % 7 === 0) {
      spark.oscillator.frequency.setValueAtTime(1700 + (tick * 137 % 2100), now);
      spark.gain.gain.setTargetAtTime(0.018, now, 0.004);
      spark.gain.gain.setTargetAtTime(0, now + 0.022, 0.017);
    }
    tick++;
  };
  update();
  const timer = window.setInterval(update, 100);
  const hush = () => master.gain.setTargetAtTime(0, audio.currentTime, 0.025);
  window.addEventListener("blur", hush);
  document.addEventListener("visibilitychange", update);
  return () => {
    clearInterval(timer);
    window.removeEventListener("blur", hush);
    document.removeEventListener("visibilitychange", update);
    master.gain.cancelScheduledValues(audio.currentTime);
    master.gain.setTargetAtTime(0, audio.currentTime, 0.018);
    sources.forEach(source => source.stop(audio.currentTime + 0.12));
    window.setTimeout(() => nodes.forEach(node => node.disconnect()), 160);
  };
}

/**
 * Der Schlag beim Zünden der Hyperlichtgeschwindigkeit.
 *
 * Ein kurzer Rauschstoß, dessen Filter nach oben zieht, über einem tiefen
 * Ton, der gleichzeitig absackt — zusammen ergibt das den Ruck, den man von
 * einem Antrieb erwartet, der anspringt. Alles lokal erzeugt: es ist die
 * Vertonung einer Animation und stellt keine Arbeit eines Agenten dar.
 *
 * Ohne freigegebene Tonausgabe passiert nichts. Eine Geste hat den Ton
 * geöffnet oder eben nicht; hier wird keine nachgeholt.
 */
export function playHyperJump(volume: number) {
  const audio = context;
  if (!audio || volume <= 0) return;
  const now = audio.currentTime;

  const master = audio.createGain();
  master.gain.value = Math.min(1, volume) * 0.5;
  master.connect(audio.destination);

  // Rauschen: zwei Sekunden weißes Rauschen, durch ein aufziehendes Bandfilter.
  const frames = Math.floor(audio.sampleRate * 2.2);
  const buffer = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;

  const noise = audio.createBufferSource();
  noise.buffer = buffer;
  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 1.4;
  band.frequency.setValueAtTime(180, now);
  band.frequency.exponentialRampToValueAtTime(4200, now + 0.9);
  band.frequency.exponentialRampToValueAtTime(600, now + 2.1);

  const noiseGain = audio.createGain();
  noiseGain.gain.setValueAtTime(0, now);
  noiseGain.gain.linearRampToValueAtTime(0.5, now + 0.16);
  noiseGain.gain.setTargetAtTime(0, now + 0.5, 0.55);
  noise.connect(band).connect(noiseGain).connect(master);

  // Der tiefe Ton darunter: er faellt, waehrend das Rauschen steigt.
  const drop = audio.createOscillator();
  drop.type = "sawtooth";
  drop.frequency.setValueAtTime(140, now);
  drop.frequency.exponentialRampToValueAtTime(38, now + 1.4);
  const dropGain = audio.createGain();
  dropGain.gain.setValueAtTime(0, now);
  dropGain.gain.linearRampToValueAtTime(0.22, now + 0.07);
  dropGain.gain.setTargetAtTime(0, now + 0.35, 0.5);
  drop.connect(dropGain).connect(master);

  noise.start(now);
  drop.start(now);
  noise.stop(now + 2.3);
  drop.stop(now + 2.3);

  // Aufraeumen, wie im Rest des Moduls: nichts bleibt am Ausgang haengen.
  window.setTimeout(() => {
    [master, band, noiseGain, dropGain].forEach((node) => node.disconnect());
  }, 2600);
}
