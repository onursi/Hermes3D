/**
 * Procedural Web Audio Engine for the Ideenatelier (Hermes 3D)
 *
 * Designed to provide tactile, high-feedback auditory cues:
 * - Warm creative forge ambient resonance
 * - Morphing crystal pitch corresponding to reife (0.0 - 1.0)
 * - Distinct acoustic responses for each of the 6 exits (especially the "Erkenntnis-Gong")
 * - Tactile acoustic steps for the 3 ground planes of the Quellenboden
 */

class AtelierAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private isDronePlaying = false;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  public startForgeDrone() {
    this.initContext();
    if (!this.ctx || !this.masterGain || this.isDronePlaying) return;

    try {
      const now = this.ctx.currentTime;
      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(0.001, now);
      this.droneGain.gain.exponentialRampToValueAtTime(0.12, now + 1.8);

      // Low warm fundamental (A2 = 110Hz) and harmonic fifth (E3 = 164.8Hz)
      this.droneOsc1 = this.ctx.createOscillator();
      this.droneOsc1.type = "triangle";
      this.droneOsc1.frequency.setValueAtTime(110, now);

      this.droneOsc2 = this.ctx.createOscillator();
      this.droneOsc2.type = "sine";
      this.droneOsc2.frequency.setValueAtTime(164.81, now);

      // Warm low-pass filter
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(450, now);

      // Slow LFO for gentle breathing
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.12, now);
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(80, now);
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      this.droneOsc1.connect(filter);
      this.droneOsc2.connect(filter);
      filter.connect(this.droneGain);
      this.droneGain.connect(this.masterGain);

      this.droneOsc1.start();
      this.droneOsc2.start();
      this.isDronePlaying = true;
    } catch (e) {
      console.warn("Could not start forge drone", e);
    }
  }

  public stopForgeDrone() {
    if (!this.ctx || !this.droneGain || !this.isDronePlaying) return;
    try {
      const now = this.ctx.currentTime;
      this.droneGain.gain.setValueAtTime(this.droneGain.gain.value, now);
      this.droneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
      setTimeout(() => {
        try {
          this.droneOsc1?.stop();
          this.droneOsc2?.stop();
        } catch (_) {}
        this.isDronePlaying = false;
      }, 850);
    } catch (_) {
      this.isDronePlaying = false;
    }
  }

  /**
   * Sound emitted when selecting or scrubbing reife (0.0 to 1.0)
   */
  public playReifeChime(reife: number) {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      // Map reife (0 to 1) to Pentatonic scale frequencies
      const baseFreq = 220 + Math.pow(reife, 1.2) * 580; // 220Hz up to 800Hz

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = reife < 0.4 ? "sine" : reife < 0.75 ? "triangle" : "sawtooth";
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.08, now + 0.18);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.38);
    } catch (_) {}
  }

  /**
   * Distinct sonic signature for the 6 Exits
   */
  public playExitSound(exitId: string) {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;

      if (exitId === "singularity") {
        // Deep sub-bass launch sweep
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.4);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.75);
      } else if (exitId === "discard") {
        // "Erkenntnis-Gong" - Resonant Tibetan bell tone (Amber reliquary)
        const freqs = [349.23, 698.46, 1046.5]; // F4, F5, C6
        freqs.forEach((f, idx) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(f, now);
          const vol = 0.2 / (idx + 1);
          gain.gain.setValueAtTime(vol, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now);
          osc.stop(now + 1.85);
        });
      } else if (exitId === "moon") {
        // Orbital double-click chirp
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.32);
      } else {
        // General confirmation click/shimmer
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, now); // C5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.28);
      }
    } catch (_) {}
  }

  /**
   * Tactile ground resonance for the 3 ground planes
   */
  public playGroundStep(ground: "quran" | "hadith" | "interpretation") {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      if (ground === "quran") {
        // Solid granite thud + warm golden overtone
        osc.type = "sine";
        osc.frequency.setValueAtTime(90, now);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      } else if (ground === "hadith") {
        // Structured mineral resonance
        osc.type = "triangle";
        osc.frequency.setValueAtTime(180, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      } else {
        // Translucent glass harmonic
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.3);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      }

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch (_) {}
  }
}

export const atelierAudio = new AtelierAudioEngine();
