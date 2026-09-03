// High-end synthesized Web Audio sound generator for cyber UI interactions
// Generates soft, pristine sci-fi sounds dynamically with zero asset download.

class CyberAudioController {
  private ctx: AudioContext | null = null;

  /**
   * Every clip currently being spoken.
   *
   * Agent speech plays through `new Audio(...)`, which lives entirely outside
   * the document — so it cannot be found with a DOM query, paused by the page,
   * or stopped by any control that did not keep a reference. Without this set,
   * muting only stopped the *next* line and whatever was already talking kept
   * talking, including after the tab that started it was gone.
   */
  private activeSpeech = new Set<HTMLAudioElement>();

  private init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  /** Soft, futuristic chime when Stand-up or Council begins */
  playChime() {
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, t); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.5, t + 0.35); // C6

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.95);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  /** Subtle whoosh when opening 2D HUD or diagram modal */
  playWhoosh() {
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(580, t + 0.14);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.08, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    } catch {
      // Audio policy fallback
    }
  }

  /** Crisp digital blip on card click / tab select */
  playBlip() {
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.setValueAtTime(1760, t + 0.03);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.06, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
    } catch {
      // Audio policy fallback
    }
  }

  /** Mechanical CAD snap click sound when docking panels to edges */
  playSnap() {
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1400, t);
      osc.frequency.exponentialRampToValueAtTime(320, t + 0.04);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.05);
    } catch {}
  }

  private voiceEnabled = true;

  setVoiceEnabled(enabled: boolean) {
    this.voiceEnabled = enabled;
    // Turning voices off has to silence what is already speaking, not just
    // decline the next line. Anything else reads as a broken mute button.
    if (!enabled) this.stopSpeaking();
  }

  /** Cuts off every agent voice immediately, both server clips and the browser engine. */
  stopSpeaking() {
    this.activeSpeech.forEach((audio) => {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.src = "";
      } catch {
        // A clip that already ended needs no stopping.
      }
    });
    this.activeSpeech.clear();
    this.speechBusy = false;
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // Some browsers throw when cancelling an empty queue.
    }
  }

  isVoiceEnabled(): boolean {
    return this.voiceEnabled;
  }

  private mutedAgents = new Set<string>();

  isAgentMuted(agentId: string) {
    const key = agentId.toLowerCase();
    for (const muted of this.mutedAgents) {
      if (key.includes(muted) || muted.includes(key)) return true;
    }
    return false;
  }

  toggleMuteAgent(agentId: string): boolean {
    const key = agentId.toLowerCase();
    if (this.isAgentMuted(key)) {
      for (const m of Array.from(this.mutedAgents)) {
        if (key.includes(m) || m.includes(key)) this.mutedAgents.delete(m);
      }
      return false; // unmuted
    } else {
      this.mutedAgents.add(key);
      return true; // muted
    }
  }

  getMutedAgentsList(): string[] {
    return Array.from(this.mutedAgents);
  }

  /** True while any agent line is still being spoken. */
  private isSpeaking() {
    if (this.speechBusy || this.activeSpeech.size > 0) return true;
    try {
      return (
        typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        (window.speechSynthesis.speaking || window.speechSynthesis.pending)
      );
    } catch {
      return false;
    }
  }

  /**
   * Reserved synchronously, before the voice request goes out.
   *
   * Two lines arriving in the same tick would both see an idle synthesiser and
   * both start talking, which is exactly the overlap this is meant to prevent.
   */
  private speechBusy = false;

  /** Speak text out loud using Studio Cloud AI or High-Definition Natural Neural voices */
  async speakAgent(agentId: string, text: string) {
    if (!this.voiceEnabled || typeof window === "undefined") return;
    if (this.isAgentMuted(agentId)) return;
    // One voice at a time. Overlapping agents are unintelligible, and queueing
    // them only delivers a backlog long after the moment it described.
    if (this.isSpeaking()) return;
    this.speechBusy = true;

    try {
      this.playBlip();
      const cleanText = text.replace(/[*#_`[\]()]/g, "").trim();
      if (!cleanText) {
        this.speechBusy = false;
        return;
      }

      // 1. Try server-side Studio AI voice generation (OpenAI / ElevenLabs)
      try {
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, text: cleanText }),
        });
        if (res.ok && res.headers.get("Content-Type")?.includes("audio")) {
          const blob = await res.blob();
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          audio.playbackRate = 1.0; // The clip already carries its intended pace.
          const release = () => {
            URL.revokeObjectURL(audioUrl);
            this.activeSpeech.delete(audio);
            this.speechBusy = false;
          };
          audio.onended = release;
          audio.onerror = release;
          this.activeSpeech.add(audio);
          // A mute issued while the clip was still downloading must still win.
          if (!this.voiceEnabled) {
            release();
            return;
          }
          await audio.play();
          return;
        }
      } catch {
        // Fallback to browser neural engine
      }

      // 2. High-Definition Natural Neural Browser Voice Engine
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = "de-DE";
      // Normal pace. It ran at 1.25, which is the single biggest reason the
      // voices sounded synthetic rather than spoken.
      utterance.rate = 1.0;
      // Natural pitch = 1.0 (prevents robotic metallic distortion)
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const germanVoices = voices.filter(
        (v) => v.lang.startsWith("de") || v.name.toLowerCase().includes("german")
      );

      // Prioritize High-Definition Natural & Neural voices over old robotic offline SAPI voices
      const naturalVoices = germanVoices.filter(
        (v) =>
          v.name.includes("Natural") ||
          v.name.includes("Online") ||
          v.name.includes("Google") ||
          v.name.includes("Neural") ||
          v.name.includes("Premium")
      );

      const candidateList = naturalVoices.length > 0 ? naturalVoices : germanVoices;

      // Categorize into male and female voices for natural human assignment
      const femaleVoices = candidateList.filter((v) => {
        const n = v.name.toLowerCase();
        return (
          n.includes("katja") ||
          n.includes("amala") ||
          n.includes("louisa") ||
          n.includes("vicki") ||
          n.includes("female") ||
          n.includes("weiblich") ||
          n.includes("zira") ||
          n.includes("hedda")
        );
      });

      const maleVoices = candidateList.filter((v) => {
        const n = v.name.toLowerCase();
        return (
          n.includes("conrad") ||
          n.includes("christoph") ||
          n.includes("stefan") ||
          n.includes("florian") ||
          n.includes("martin") ||
          n.includes("markus") ||
          n.includes("male") ||
          n.includes("männlich") ||
          n.includes("david")
        );
      });

      const lower = agentId.toLowerCase();

      // Gemini: Weiblich, lebendig
      if (lower.includes("gemini")) {
        utterance.voice = femaleVoices[0] || candidateList[0];
      }
      // ChatGPT: Weiblich, warm
      else if (lower.includes("chatgpt")) {
        utterance.voice = femaleVoices[1] || femaleVoices[0] || candidateList[0];
      }
      // Hermes: Maskulin, tief, souverän
      else if (lower.includes("hermes")) {
        utterance.pitch = 0.94; // slightly deeper
        utterance.voice = maleVoices[0] || candidateList.find((v) => !femaleVoices.includes(v)) || candidateList[0];
      }
      // Claude: Männlich, artikuliert, klar
      else if (lower.includes("claude")) {
        utterance.voice = maleVoices[1] || maleVoices[0] || candidateList.find((v) => !femaleVoices.includes(v)) || candidateList[0];
      }

      utterance.onend = () => {
        this.speechBusy = false;
      };
      utterance.onerror = () => {
        this.speechBusy = false;
      };
      window.speechSynthesis.speak(utterance);
    } catch {
      this.speechBusy = false;
    }
  }

  /** Dramatic sci-fi gravitational suction / elevator warp sound */
  playTractorBeam(direction: "down" | "up" = "down") {
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      if (direction === "down") {
        osc.frequency.setValueAtTime(640, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 1.1);
      } else {
        osc.frequency.setValueAtTime(80, t);
        osc.frequency.exponentialRampToValueAtTime(640, t + 1.1);
      }

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 1.2);
    } catch {}
  }

  /** Mechanical robot joint servo whir when standing up or sitting down */
  playServo() {
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.linearRampToValueAtTime(540, t + 0.08);
      osc.frequency.linearRampToValueAtTime(260, t + 0.22);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.06, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    } catch {}
  }

  /** High-tech terminal typing keystroke */
  playKeyboardTyping() {
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      const freq = 850 + Math.random() * 400;
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.025, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.035);
    } catch {}
  }

  /** Continuous binaural neural ambience (multi-harmonic breathing brain synth) */
  private neuralDroneNodes: {
    oscillators: OscillatorNode[];
    filter: BiquadFilterNode;
    lfo?: OscillatorNode;
    lfoGain?: GainNode;
    gain: GainNode;
  } | null = null;

  private currentVolume: number = 0.6;
  private currentMode: "alpha" | "cosmos" | "matrix" | "zen" = "alpha";

  setVolume(vol: number) {
    this.currentVolume = Math.max(0, Math.min(1, vol));
    if (this.neuralDroneNodes && this.ctx) {
      const targetGain = this.currentVolume * 0.18;
      this.neuralDroneNodes.gain.gain.setValueAtTime(
        Math.max(0.0001, targetGain),
        this.ctx.currentTime
      );
    }
  }

  getVolume() {
    return this.currentVolume;
  }

  setSoundMode(mode: "alpha" | "cosmos" | "matrix" | "zen") {
    this.currentMode = mode;
    if (this.neuralDroneNodes) {
      this.stopNeuralAmbience();
      setTimeout(() => {
        this.startNeuralAmbience(mode);
      }, 300);
    }
  }

  getSoundMode() {
    return this.currentMode;
  }

  startNeuralAmbience(modeOverride?: "alpha" | "cosmos" | "matrix" | "zen") {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      if (this.neuralDroneNodes) {
        this.stopNeuralAmbience();
      }

      const mode = modeOverride || this.currentMode;
      this.currentMode = mode;
      const t = this.ctx.currentTime;
      const targetGain = Math.max(0.0001, this.currentVolume * 0.18);

      const oscillators: OscillatorNode[] = [];
      const filter = this.ctx.createBiquadFilter();
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, t);
      masterGain.gain.exponentialRampToValueAtTime(targetGain, t + 0.8);

      let lfo: OscillatorNode | undefined;
      let lfoGain: GainNode | undefined;

      if (mode === "alpha") {
        // Binaural Alpha (108 Hz / 115.5 Hz) + Warm Body E3 (164.8 Hz)
        const freqs = [108.0, 115.5, 164.8, 220.0, 329.6];
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(450, t);
        filter.Q.setValueAtTime(3.0, t);

        lfo = this.ctx.createOscillator();
        lfoGain = this.ctx.createGain();
        lfo.type = "sine";
        lfo.frequency.setValueAtTime(0.18, t);
        lfoGain.gain.setValueAtTime(260, t);
        lfo.connect(filter.frequency);
        lfo.start(t);

        freqs.forEach((f, idx) => {
          const osc = this.ctx!.createOscillator();
          osc.type = idx % 2 === 0 ? "sawtooth" : "sine";
          osc.frequency.setValueAtTime(f, t);
          const oscGain = this.ctx!.createGain();
          oscGain.gain.setValueAtTime(idx % 2 === 0 ? 0.04 : 0.08, t);
          osc.connect(oscGain);
          oscGain.connect(filter);
          osc.start(t);
          oscillators.push(osc);
        });
      } else if (mode === "cosmos") {
        // Deep Cosmos: Ultra-low subterranean sub-bass (55 Hz + 73.4 Hz + 110 Hz)
        const freqs = [55.0, 73.4, 110.0, 146.8];
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(220, t);
        filter.Q.setValueAtTime(4.0, t);

        lfo = this.ctx.createOscillator();
        lfoGain = this.ctx.createGain();
        lfo.type = "sine";
        lfo.frequency.setValueAtTime(0.08, t); // Slow 12-second cosmic tide
        lfoGain.gain.setValueAtTime(120, t);
        lfo.connect(filter.frequency);
        lfo.start(t);

        freqs.forEach((f) => {
          const osc = this.ctx!.createOscillator();
          osc.type = "sine";
          osc.frequency.setValueAtTime(f, t);
          const oscGain = this.ctx!.createGain();
          oscGain.gain.setValueAtTime(0.12, t);
          osc.connect(oscGain);
          oscGain.connect(filter);
          osc.start(t);
          oscillators.push(osc);
        });
      } else if (mode === "matrix") {
        // Cyber Matrix: Pulse-width synth with bright neural sparkle
        const freqs = [110.0, 220.0, 293.66, 440.0];
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(600, t);
        filter.Q.setValueAtTime(2.0, t);

        lfo = this.ctx.createOscillator();
        lfoGain = this.ctx.createGain();
        lfo.type = "triangle";
        lfo.frequency.setValueAtTime(0.4, t); // Quick 2.5-second electrical wave
        lfoGain.gain.setValueAtTime(350, t);
        lfo.connect(filter.frequency);
        lfo.start(t);

        freqs.forEach((f) => {
          const osc = this.ctx!.createOscillator();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(f, t);
          const oscGain = this.ctx!.createGain();
          oscGain.gain.setValueAtTime(0.07, t);
          osc.connect(oscGain);
          oscGain.connect(filter);
          osc.start(t);
          oscillators.push(osc);
        });
      } else if (mode === "zen") {
        // Zen Shimmer: 528 Hz Solfeggio Love/DNA frequency + pure crystalline sine harmonics
        const freqs = [264.0, 528.0, 792.0];
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(900, t);
        filter.Q.setValueAtTime(1.5, t);

        lfo = this.ctx.createOscillator();
        lfoGain = this.ctx.createGain();
        lfo.type = "sine";
        lfo.frequency.setValueAtTime(0.12, t);
        lfoGain.gain.setValueAtTime(300, t);
        lfo.connect(filter.frequency);
        lfo.start(t);

        freqs.forEach((f) => {
          const osc = this.ctx!.createOscillator();
          osc.type = "sine";
          osc.frequency.setValueAtTime(f, t);
          const oscGain = this.ctx!.createGain();
          oscGain.gain.setValueAtTime(0.09, t);
          osc.connect(oscGain);
          oscGain.connect(filter);
          osc.start(t);
          oscillators.push(osc);
        });
      }

      filter.connect(masterGain);
      masterGain.connect(this.ctx.destination);

      this.neuralDroneNodes = { oscillators, filter, lfo, lfoGain, gain: masterGain };
    } catch {}
  }

  stopNeuralAmbience() {
    try {
      if (!this.neuralDroneNodes || !this.ctx) return;
      const t = this.ctx.currentTime;
      const { oscillators, lfo, gain } = this.neuralDroneNodes;
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      setTimeout(() => {
        try {
          oscillators.forEach((o) => {
            o.stop();
            o.disconnect();
          });
          if (lfo) {
            lfo.stop();
            lfo.disconnect();
          }
        } catch {}
      }, 400);
      this.neuralDroneNodes = null;
    } catch {}
  }

  /** Crystal synaptic impulse ping when hovering or focusing a neuron */
  playSynapseBlip() {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      const notes = [880, 1046.5, 1318.5, 1567.98, 1760]; // Crisp, sparkling brain frequencies (A5, C6, E6, G6, A6)
      const freq = notes[Math.floor(Math.random() * notes.length)];
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.35, t + 0.09);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.09, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    } catch {}
  }

  /** Real bio-electric synaptic arc / lightning discharge sound (FM electric crackle) */
  playElectricalZap() {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      const t = this.ctx.currentTime;

      // 1. FM Modulated Electric Arc Carrier & Modulator
      const carrier = this.ctx.createOscillator();
      const mod = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      const arcGain = this.ctx.createGain();

      // Sharp bio-electric chirp (2800 Hz down to 350 Hz)
      carrier.type = "sawtooth";
      carrier.frequency.setValueAtTime(2800, t);
      carrier.frequency.exponentialRampToValueAtTime(320, t + 0.11);

      // High-speed electrical buzz modulation (180 Hz)
      mod.type = "square";
      mod.frequency.setValueAtTime(180, t);
      modGain.gain.setValueAtTime(950, t);
      modGain.gain.exponentialRampToValueAtTime(50, t + 0.1);

      mod.connect(carrier.frequency);

      // 2. High-pass filter for crisp electrical snap
      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(2200, t);
      filter.Q.setValueAtTime(2.0, t);

      arcGain.gain.setValueAtTime(0.0001, t);
      arcGain.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
      arcGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);

      carrier.connect(filter);
      filter.connect(arcGain);
      arcGain.connect(this.ctx.destination);

      carrier.start(t);
      mod.start(t);
      carrier.stop(t + 0.14);
      mod.stop(t + 0.14);
    } catch {}
  }

  /** Ensure AudioContext is resumed upon any user interaction */
  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }
}

export const cyberAudio = new CyberAudioController();

// Speech outlives the page that started it: `new Audio(...)` clips and queued
// utterances keep playing while the tab tears down, so an agent can still be
// heard talking after its window is gone.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => cyberAudio.stopSpeaking());
}
