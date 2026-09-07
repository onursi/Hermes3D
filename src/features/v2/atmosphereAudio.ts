"use client";

// Local synthesis only. Animation/engine sounds do not represent agent work.
export const flightAudio = { speed: 0, hyperdrive: false };
let context: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  return context;
}

/** Call from a click or keypress. Persisted preferences alone never open an audio device. */
export function unlockAtmosphere() {
  if (!context) context = new AudioContext();
  if (context.state === "suspended") {
    void context.resume().catch(() => {});
  }
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
  const isTesseract = world === "tesseract";

  function voice(hz: number, level: number, type: OscillatorType = "sine") {
    const oscillator = audio!.createOscillator();
    const gain = audio!.createGain();
    oscillator.type = type;
    oscillator.frequency.value = hz;
    gain.gain.value = level;
    oscillator.connect(gain).connect(master);
    oscillator.start();
    sources.push(oscillator);
    nodes.push(oscillator, gain);
    return { oscillator, gain };
  }

  // --- Codex Original Normal-Modus Stimmen (gedimmt im Tesserakt für pure 4D-Akkorde) ---
  const drone = voice(brain ? 196 : (isTesseract ? 0 : 65.4), brain ? 0.025 : (isTesseract ? 0 : 0.1));
  voice(brain ? 294.3 : (isTesseract ? 0 : 98.2), brain ? 0.015 : (isTesseract ? 0 : 0.065));
  const shimmer = voice(brain ? 1568 : 392.4, isTesseract ? 0 : 0.008);
  const engine = voice(48, 0, "triangle");
  const spark = voice(2300, 0);

  // --- 4D Interstellar Tesseract Soundscape (Hans Zimmer Deep C-Minor 9th Space Chords & Sub-Bass) ---
  const tessSub = voice(isTesseract ? 32.7 : 0, isTesseract ? 0.28 : 0, "triangle");
  const tessBinaural = voice(isTesseract ? 33.15 : 0, isTesseract ? 0.22 : 0, "sine");
  const tessChord1 = voice(isTesseract ? 130.8 : 0, isTesseract ? 0.11 : 0, "triangle"); // C3
  const tessChord2 = voice(isTesseract ? 155.6 : 0, isTesseract ? 0.09 : 0, "sine");     // Eb3
  const tessChord3 = voice(isTesseract ? 196.0 : 0, isTesseract ? 0.08 : 0, "sine");     // G3
  const tessChord4 = voice(isTesseract ? 293.7 : 0, isTesseract ? 0.07 : 0, "sine");     // D4 (Minor 9th)
  const tessShimmer = voice(isTesseract ? 1046.5 : 0, isTesseract ? 0.03 : 0, "sine");   // C6

  // Gravitational Time Dilation Pulse (Hans Zimmer Black Hole Pendulum)
  const pulseOsc = audio.createOscillator();
  const pulseGain = audio.createGain();
  pulseOsc.type = "triangle";
  pulseOsc.frequency.value = 55;
  pulseGain.gain.value = 0;
  pulseOsc.connect(pulseGain).connect(master);
  pulseOsc.start();
  sources.push(pulseOsc);
  nodes.push(pulseOsc, pulseGain);

  // Codex Noise Buffer (LCG Algorithmus)
  const buffer = audio.createBuffer(1, audio.sampleRate * 3, audio.sampleRate);
  const samples = buffer.getChannelData(0);
  let seed = 73;
  for (let i = 0; i < samples.length; i++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    samples[i] = seed / 2147483648 - 1;
  }
  const noise = audio.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  const filter = audio.createBiquadFilter();
  filter.type = brain ? "bandpass" : "lowpass";
  filter.frequency.value = brain ? 3900 : 420;
  filter.Q.value = brain ? 1.2 : 0.45;
  const air = audio.createGain();
  air.gain.value = 0.015;
  noise.connect(filter).connect(air).connect(master);
  noise.start();
  sources.push(noise);
  nodes.push(noise, filter, air);

  // --- Antigravity Hyperlichtantrieb (Lichtgeschwindigkeits-Sound) ---
  const hyperSub = voice(28, 0, "sawtooth");
  const hyperSubSub = voice(14, 0, "triangle");
  const hyperTurbine = voice(220, 0, "sawtooth");
  const hyperTurbine2 = voice(440, 0, "triangle");

  // Sonic Boom / Warp-Impact Transient beim Zünden & Abschalten
  const boomOsc = audio.createOscillator();
  const boomGain = audio.createGain();
  boomOsc.type = "triangle";
  boomOsc.frequency.value = 90;
  boomGain.gain.value = 0;
  boomOsc.connect(boomGain).connect(master);
  boomOsc.start();
  sources.push(boomOsc);
  nodes.push(boomOsc, boomGain);

  // Aggressiver Hyperraum-Filter für Fahrtwind-Tosung bei Warp
  const hyperFilter = audio.createBiquadFilter();
  hyperFilter.type = "bandpass";
  hyperFilter.frequency.value = 1600;
  hyperFilter.Q.value = 4.0;
  const hyperAir = audio.createGain();
  hyperAir.gain.value = 0;
  noise.connect(hyperFilter).connect(hyperAir).connect(master);
  nodes.push(hyperFilter, hyperAir);

  let tick = 0;
  let wasHyperdrive = false;
  let turbineSweep = 220;

  const update = () => {
    const now = audio.currentTime;
    const audible = document.visibilityState === "visible" && document.hasFocus();
    const isHyper = Boolean(flightAudio.hyperdrive);

    // Master Volume: Codex 0.6 im Normalmodus, Antigravity 0.92 bei Hyperantrieb
    master.gain.setTargetAtTime(audible ? volume * (isHyper ? 0.92 : 0.6) : 0, now, 0.12);

    // Einschlag-Effekt bei Aktivierung / Deaktivierung
    if (isHyper && !wasHyperdrive) {
      // Sonic Boom / Warpsprung: Frequenz zieht rasant von 160Hz auf 24Hz runter
      boomOsc.frequency.setValueAtTime(160, now);
      boomOsc.frequency.exponentialRampToValueAtTime(24, now + 0.42);
      boomGain.gain.setValueAtTime(0.55, now);
      boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
      turbineSweep = 220;
    } else if (!isHyper && wasHyperdrive) {
      // Warp-Kollaps
      boomOsc.frequency.setValueAtTime(85, now);
      boomOsc.frequency.exponentialRampToValueAtTime(20, now + 0.3);
      boomGain.gain.setValueAtTime(0.35, now);
      boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    }
    wasHyperdrive = isHyper;

    if (isHyper) {
      // Hyperlichtgeschwindigkeit: Heftiges Motorendröhnen & pfeifende Turbine
      turbineSweep = Math.min(2700, turbineSweep + 175);
      hyperSub.gain.gain.setTargetAtTime(0.28, now, 0.08);
      hyperSubSub.gain.gain.setTargetAtTime(0.22, now, 0.08);
      hyperTurbine.gain.gain.setTargetAtTime(0.12, now, 0.08);
      hyperTurbine2.gain.gain.setTargetAtTime(0.07, now, 0.08);

      hyperTurbine.oscillator.frequency.setTargetAtTime(turbineSweep + Math.sin(tick * 0.45) * 55, now, 0.05);
      hyperTurbine2.oscillator.frequency.setTargetAtTime(turbineSweep * 1.5, now, 0.05);

      hyperFilter.frequency.setTargetAtTime(2400 + Math.sin(tick * 0.35) * 800, now, 0.1);
      hyperAir.gain.setTargetAtTime(0.26, now, 0.08);
    } else {
      hyperSub.gain.gain.setTargetAtTime(0, now, 0.12);
      hyperSubSub.gain.gain.setTargetAtTime(0, now, 0.12);
      hyperTurbine.gain.gain.setTargetAtTime(0, now, 0.14);
      hyperTurbine2.gain.gain.setTargetAtTime(0, now, 0.14);
      hyperAir.gain.setTargetAtTime(0, now, 0.14);
    }

    // --- Codex Original Normal-Modus Klangmodulation ---
    const power = travelling ? Math.min(1, Math.log1p(flightAudio.speed / 26) / Math.log(101)) : 0;
    engine.oscillator.frequency.setTargetAtTime(48 + power * 180, now, 0.12);
    engine.gain.gain.setTargetAtTime(power * 0.19, now, 0.1);
    filter.frequency.setTargetAtTime(brain ? 3900 : 420 + power * 4200, now, 0.15);
    air.gain.setTargetAtTime(
      brain
        ? 0.018 + Math.max(0, Math.sin(tick * 1.73)) ** 14 * 0.16
        : 0.025 + power * 0.28,
      now,
      0.025,
    );
    shimmer.gain.gain.setTargetAtTime(0.008 + (1 + Math.sin(tick * 0.075)) * 0.005, now, 0.3);
    drone.oscillator.detune.setTargetAtTime(Math.sin(tick * 0.035) * 4, now, 0.3);

    if (brain && tick % 7 === 0) {
      spark.oscillator.frequency.setValueAtTime(1700 + (tick * 137 % 2100), now);
      spark.gain.gain.setTargetAtTime(0.018, now, 0.004);
      spark.gain.gain.setTargetAtTime(0, now + 0.022, 0.017);
    }

    // --- 4D Tesserakt Modulation & Hans Zimmer Gravitations-Puls ---
    if (isTesseract) {
      const lfo = 0.5 + 0.5 * Math.sin(tick * 0.05);
      filter.frequency.setTargetAtTime(140 + lfo * 600, now, 0.1);
      filter.Q.setTargetAtTime(2.2, now, 0.1);
      air.gain.setTargetAtTime(0.015 + lfo * 0.02, now, 0.1);

      tessChord4.oscillator.detune.setTargetAtTime(Math.sin(tick * 0.08) * 8, now, 0.2);
      tessShimmer.oscillator.detune.setTargetAtTime(Math.cos(tick * 0.06) * 12, now, 0.2);

      // Gravitations-Zeittakt (Heartbeat of the Singularity) alle 2.4 Sekunden
      if (tick % 24 === 0) {
        pulseOsc.frequency.setValueAtTime(65, now);
        pulseOsc.frequency.exponentialRampToValueAtTime(22, now + 0.24);
        pulseGain.gain.setValueAtTime(0.38, now);
        pulseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);
      }
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
    sources.forEach((source) => source.stop(audio.currentTime + 0.12));
    window.setTimeout(() => nodes.forEach((node) => node.disconnect()), 160);
  };
}

/**
 * Der Schlag beim Zünden der Hyperlichtgeschwindigkeit (Sonic Boom).
 */
export function playHyperJump(volume: number) {
  unlockAtmosphere();
  const audio = context;
  if (!audio) return;
  const now = audio.currentTime;
  const vol = (volume > 0 ? volume : 0.5);

  const master = audio.createGain();
  master.gain.value = Math.min(1, vol) * 0.7;
  master.connect(audio.destination);

  const frames = Math.floor(audio.sampleRate * 2.2);
  const buffer = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;

  const noise = audio.createBufferSource();
  noise.buffer = buffer;
  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 1.6;
  band.frequency.setValueAtTime(180, now);
  band.frequency.exponentialRampToValueAtTime(4600, now + 0.85);
  band.frequency.exponentialRampToValueAtTime(500, now + 2.0);

  const noiseGain = audio.createGain();
  noiseGain.gain.setValueAtTime(0, now);
  noiseGain.gain.linearRampToValueAtTime(0.65, now + 0.14);
  noiseGain.gain.setTargetAtTime(0, now + 0.45, 0.5);
  noise.connect(band).connect(noiseGain).connect(master);

  const drop = audio.createOscillator();
  drop.type = "sawtooth";
  drop.frequency.setValueAtTime(160, now);
  drop.frequency.exponentialRampToValueAtTime(26, now + 1.2);
  const dropGain = audio.createGain();
  dropGain.gain.setValueAtTime(0, now);
  dropGain.gain.linearRampToValueAtTime(0.35, now + 0.06);
  dropGain.gain.setTargetAtTime(0, now + 0.3, 0.45);
  drop.connect(dropGain).connect(master);

  noise.start(now);
  drop.start(now);
  noise.stop(now + 2.3);
  drop.stop(now + 2.3);

  window.setTimeout(() => {
    [master, band, noiseGain, dropGain].forEach((node) => node.disconnect());
  }, 2500);
}
