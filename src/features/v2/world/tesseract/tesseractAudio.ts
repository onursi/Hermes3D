"use client";

import { unlockAtmosphere } from "@/features/v2/atmosphereAudio";

// Shared or standalone AudioContext
let audioCtx: AudioContext | null = null;

export function getTesseractAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtor) {
      audioCtx = new AudioCtor();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * 1. CELESTIAL CRYSTAL CHIME
 * Harmonic crystalline ping with long ethereal decay.
 * Frequencies based on sacred D-minor / pentatonic cosmic scale.
 */
export function playCrystalChime(index = 0, volume = 0.35) {
  unlockAtmosphere();
  const ctx = getTesseractAudio();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Cosmic pentatonic scale (D4, F4, G4, A4, C5, D5, F5)
  const scale = [293.66, 349.23, 392.00, 440.00, 523.25, 587.33, 698.46];
  const freq = scale[Math.abs(index) % scale.length];

  // Master Gain for this chime
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(volume, now + 0.02);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
  masterGain.connect(ctx.destination);

  // Fundamental Sine with subtle vibrato
  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(freq, now);

  // Octave Overtone (shimmer)
  const osc2 = ctx.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(freq * 2.005, now); // Slight detune for shimmer

  // Fifth harmonic
  const osc3 = ctx.createOscillator();
  osc3.type = "sine";
  osc3.frequency.setValueAtTime(freq * 3.01, now);

  const gain2 = ctx.createGain();
  gain2.gain.setValueAtTime(0.4, now);
  gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

  const gain3 = ctx.createGain();
  gain3.gain.setValueAtTime(0.2, now);
  gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

  // Bandpass filter for glass-like acoustic resonance
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(freq * 1.5, now);
  filter.Q.setValueAtTime(3.5, now);

  osc1.connect(masterGain);
  osc2.connect(gain2).connect(filter).connect(masterGain);
  osc3.connect(gain3).connect(masterGain);

  osc1.start(now);
  osc2.start(now);
  osc3.start(now);

  osc1.stop(now + 2.3);
  osc2.stop(now + 2.3);
  osc3.stop(now + 2.3);

  setTimeout(() => {
    masterGain.disconnect();
    filter.disconnect();
    gain2.disconnect();
    gain3.disconnect();
  }, 2400);
}

/**
 * 2. PHOENIX QUANTUM COLLISION & SYNTHESIS EXPLOSION
 * Two-phase acoustic event:
 * - Implosion suck (reverse frequency sweep & crescendo)
 * - 20ms vacuum silence
 * - Massive crystalline shockwave (sub-bass drop + high glass dispersal)
 */
export function playPhoenixSynthesis(volume = 0.5) {
  unlockAtmosphere();
  const ctx = getTesseractAudio();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Phase 1: Reverse Implosion Vacuum (0.45s)
  const implosionOsc = ctx.createOscillator();
  const implosionGain = ctx.createGain();
  implosionOsc.type = "sawtooth";
  implosionOsc.frequency.setValueAtTime(50, now);
  implosionOsc.frequency.exponentialRampToValueAtTime(520, now + 0.42);

  implosionGain.gain.setValueAtTime(0.01, now);
  implosionGain.gain.exponentialRampToValueAtTime(volume * 0.7, now + 0.42);
  implosionGain.gain.setValueAtTime(0.0001, now + 0.44); // Sudden cut (vacuum)

  implosionOsc.connect(implosionGain).connect(ctx.destination);
  implosionOsc.start(now);
  implosionOsc.stop(now + 0.45);

  // Phase 2: Quantum Synthesis Shockwave (starts at now + 0.45)
  const impactTime = now + 0.45;

  // Sub-Bass Shockwave
  const subOsc = ctx.createOscillator();
  const subGain = ctx.createGain();
  subOsc.type = "sine";
  subOsc.frequency.setValueAtTime(110, impactTime);
  subOsc.frequency.exponentialRampToValueAtTime(24, impactTime + 0.9);

  subGain.gain.setValueAtTime(volume * 0.9, impactTime);
  subGain.gain.exponentialRampToValueAtTime(0.0001, impactTime + 1.8);

  subOsc.connect(subGain).connect(ctx.destination);
  subOsc.start(impactTime);
  subOsc.stop(impactTime + 1.9);

  // Dispersal Noise Burst (Glass / Stardust)
  const bufferSize = ctx.sampleRate * 1.5;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.35));
  }

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(3200, impactTime);
  noiseFilter.frequency.exponentialRampToValueAtTime(800, impactTime + 1.2);
  noiseFilter.Q.setValueAtTime(4.0, impactTime);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(volume * 0.6, impactTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, impactTime + 1.4);

  noiseSource.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);
  noiseSource.start(impactTime);
  noiseSource.stop(impactTime + 1.5);

  // Triumphant Synthesis Chord (D Major / F# / A)
  [587.33, 739.99, 880.00, 1174.66].forEach((chordFreq, idx) => {
    const chordOsc = ctx.createOscillator();
    const chordGain = ctx.createGain();
    chordOsc.type = "triangle";
    chordOsc.frequency.setValueAtTime(chordFreq, impactTime + 0.05);

    chordGain.gain.setValueAtTime(volume * 0.25 / (idx + 1), impactTime + 0.05);
    chordGain.gain.exponentialRampToValueAtTime(0.0001, impactTime + 2.4);

    chordOsc.connect(chordGain).connect(ctx.destination);
    chordOsc.start(impactTime + 0.05);
    chordOsc.stop(impactTime + 2.5);
  });
}

/**
 * 3. DIMENSIONAL SHIFT (Mode Switch)
 * Fast 4D phase warp swoosh with resonant harmonic filter sweep.
 */
export function playDimensionalShift(volume = 0.3) {
  unlockAtmosphere();
  const ctx = getTesseractAudio();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.exponentialRampToValueAtTime(640, now + 0.25);
  osc.frequency.exponentialRampToValueAtTime(140, now + 0.6);

  filter.type = "bandpass";
  filter.frequency.setValueAtTime(200, now);
  filter.frequency.exponentialRampToValueAtTime(2400, now + 0.25);
  filter.frequency.exponentialRampToValueAtTime(400, now + 0.6);
  filter.Q.setValueAtTime(5.0, now);

  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.7);
}

/**
 * 4. MONOLITH REVERENCE RESONANCE (AGENTS.md)
 * 2001: Space Odyssey / Interstellar black monolith deep hum & harmonic drone.
 */
export function playMonolithDrone(volume = 0.4) {
  unlockAtmosphere();
  const ctx = getTesseractAudio();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Ultra-deep 43.2Hz (A0 / cosmic tuning)
  [43.2, 86.4, 129.6, 172.8].forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = idx % 2 === 0 ? "sawtooth" : "sine";
    osc.frequency.setValueAtTime(freq, now);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(320, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * (0.35 / (idx + 1)), now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 3.1);
  });
}

/**
 * 5. ORACLE GRAVITATIONAL BALANCE TILT
 * Resonant Tibetan Singing Bowl / Gravitational Bell.
 */
export function playOracleBalance(direction = 1, volume = 0.35) {
  unlockAtmosphere();
  const ctx = getTesseractAudio();
  if (!ctx) return;
  const now = ctx.currentTime;

  const baseFreq = direction > 0 ? 216 : 192; // Subtle frequency distinction for Pro vs Contra

  [baseFreq, baseFreq * 2.01, baseFreq * 3.02].forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * (0.4 / (idx + 1)), now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 2.9);
  });
}

/**
 * 6. AGENT COGNITION PULSE
 * Dedicated tonal personality for each of the 5 agents.
 */
export function playAgentVoice(agentName: string, volume = 0.3) {
  unlockAtmosphere();
  const ctx = getTesseractAudio();
  if (!ctx) return;
  const now = ctx.currentTime;

  let baseFreq = 440;
  let type: OscillatorType = "sine";

  switch (agentName.toLowerCase()) {
    case "astra":
      baseFreq = 659.25; // E5 - ethereal cyan
      type = "sine";
      break;
    case "claude":
      baseFreq = 523.25; // C5 - warm amber
      type = "triangle";
      break;
    case "codex":
      baseFreq = 392.00; // G4 - technical violet
      type = "sawtooth";
      break;
    case "hermes":
      baseFreq = 329.63; // E4 - emerald core
      type = "triangle";
      break;
    case "antigravity":
      baseFreq = 783.99; // G5 - luminous quantum pulse
      type = "sine";
      break;
    default:
      baseFreq = 440;
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.15);
  osc.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.35);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.9);
}
