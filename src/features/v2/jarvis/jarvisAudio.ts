/**
 * Jarvis Companion Procedural Web Audio Engine
 *
 * 100% self-contained Web Audio API synthesizer.
 * Zero external audio assets, zero latency, works on all modern browsers and mobile devices.
 */

class JarvisAudioEngine {
  private ctx: AudioContext | null = null;
  private beamOsc: OscillatorNode | null = null;
  private beamGain: GainNode | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Harmonischer Bestätigungs-Chime beim Öffnen oder Antworten (D-Dur9 Cyber Chord)
   */
  public playChime(freqMultiplier = 1.0) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [587.33, 739.99, 880.0, 1174.66].map((f) => f * freqMultiplier);

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = i % 2 === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freq, now + i * 0.04);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.04 / (i + 1), now + i * 0.04 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.04 + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.65);
    });
  }

  /**
   * High-Tech Scan Sweep: Frequenz gleitet aufwärts mit resonanter Bandpass-Filterung
   */
  public playScanSweep() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 1.4;

    // Rauschquelle für Cyber-Scanning-Texture
    const bufferSize = ctx.sampleRate * duration;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.setValueAtTime(8.0, now);
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(4800, now + duration * 0.8);
    filter.frequency.linearRampToValueAtTime(1200, now + duration);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(0.05, now + 0.1);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    whiteNoise.start(now);
    whiteNoise.stop(now + duration);

    // Tonaler Laser-Impuls dazu
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(2400, now + duration * 0.85);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(1200, now);

    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.linearRampToValueAtTime(0.03, now + 0.08);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(lowpass);
    lowpass.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  /**
   * Energetischer Strahl-Sound (Neural Beam)
   */
  public startBeamSound() {
    const ctx = this.getContext();
    if (!ctx || this.beamOsc) return;

    const now = ctx.currentTime;
    this.beamOsc = ctx.createOscillator();
    this.beamGain = ctx.createGain();

    this.beamOsc.type = "triangle";
    this.beamOsc.frequency.setValueAtTime(220, now);

    // LFO für Pulsieren
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(8, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(40, now);
    lfo.connect(lfoGain);
    lfoGain.connect(this.beamOsc.frequency);
    lfo.start(now);

    this.beamGain.gain.setValueAtTime(0.001, now);
    this.beamGain.gain.linearRampToValueAtTime(0.035, now + 0.15);

    this.beamOsc.connect(this.beamGain);
    this.beamGain.connect(ctx.destination);
    this.beamOsc.start(now);
  }

  public stopBeamSound() {
    if (!this.ctx || !this.beamGain || !this.beamOsc) return;
    const now = this.ctx.currentTime;
    this.beamGain.gain.linearRampToValueAtTime(0.0001, now + 0.2);
    setTimeout(() => {
      try {
        this.beamOsc?.stop();
        this.beamOsc?.disconnect();
        this.beamGain?.disconnect();
      } catch {
        // ignore
      }
      this.beamOsc = null;
      this.beamGain = null;
    }, 250);
  }

  /**
   * Snappy Mode Switch Click
   */
  public playModeSwitch() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  /**
   * Data Blip
   */
  public playBlip() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1400 + Math.random() * 400, now);

    gain.gain.setValueAtTime(0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }
}

export const jarvisAudio = new JarvisAudioEngine();
