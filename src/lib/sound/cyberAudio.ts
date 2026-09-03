// High-end synthesized Web Audio sound generator for cyber UI interactions
// Generates soft, pristine sci-fi sounds dynamically with zero asset download.

class CyberAudioController {
  private ctx: AudioContext | null = null;

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

  /** Speak text out loud using Studio Cloud AI or High-Definition Natural Neural voices */
  async speakAgent(agentId: string, text: string) {
    if (!this.voiceEnabled || typeof window === "undefined") return;
    if (this.isAgentMuted(agentId)) return;

    try {
      this.playBlip();
      const cleanText = text.replace(/[*#_`[\]()]/g, "").trim();
      if (!cleanText) return;

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
          audio.playbackRate = 1.0; // Audio already synthesized at 1.25x speed
          audio.onended = () => URL.revokeObjectURL(audioUrl);
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
      // 1.25x natural speech rate
      utterance.rate = 1.25;
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
        utterance.rate = 1.42;
        utterance.voice = maleVoices[0] || candidateList.find((v) => !femaleVoices.includes(v)) || candidateList[0];
      }
      // Claude: Männlich, artikuliert, klar
      else if (lower.includes("claude")) {
        utterance.voice = maleVoices[1] || maleVoices[0] || candidateList.find((v) => !femaleVoices.includes(v)) || candidateList[0];
      }

      window.speechSynthesis.speak(utterance);
    } catch {}
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

  /** Continuous binaural neural ambience (alpha-wave brain drone with gentle harmonic breath) */
  private neuralDroneNodes: { osc1: OscillatorNode; osc2: OscillatorNode; filter: BiquadFilterNode; gain: GainNode } | null = null;

  startNeuralAmbience() {
    try {
      this.init();
      if (!this.ctx || this.neuralDroneNodes) return;
      const t = this.ctx.currentTime;

      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      // Binaural alpha-wave frequency ~110 Hz (A2) and ~117 Hz (7 Hz alpha difference)
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(108, t);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(115.5, t);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(320, t);
      filter.Q.setValueAtTime(2.5, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.045, t + 1.2); // Soft, non-intrusive ambient bed

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(t);
      osc2.start(t);

      this.neuralDroneNodes = { osc1, osc2, filter, gain };
    } catch {}
  }

  stopNeuralAmbience() {
    try {
      if (!this.neuralDroneNodes || !this.ctx) return;
      const t = this.ctx.currentTime;
      const { osc1, osc2, gain } = this.neuralDroneNodes;
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      setTimeout(() => {
        try {
          osc1.stop();
          osc2.stop();
          osc1.disconnect();
          osc2.disconnect();
        } catch {}
      }, 450);
      this.neuralDroneNodes = null;
    } catch {}
  }

  /** Crystal synaptic impulse ping when hovering or focusing a neuron */
  playSynapseBlip() {
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      const notes = [1046.5, 1318.5, 1567.98, 2093]; // High crystalline brain notes (C6, E6, G6, C7)
      const freq = notes[Math.floor(Math.random() * notes.length)];
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.08);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.035, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.13);
    } catch {}
  }
}

export const cyberAudio = new CyberAudioController();
