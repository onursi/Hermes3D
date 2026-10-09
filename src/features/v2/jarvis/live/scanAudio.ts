import type { ScanState } from "@/lib/jarvis/knowledge";
export type ScanCue = "search" | "found" | "missing";
/** Fresh events only: another window must not replay an old scan. */
export function freshScan(state: ScanState, now = Date.now()) {
  return state.at > 0 && now >= state.at && now - state.at < 2500 && ["searching", "found", "missing"].includes(state.phase);
}
/** Local, short effects. No microphone, network, looping or voice credits. */
export class ScanAudio {
  private context: AudioContext | null = null;
  private sources = new Set<AudioScheduledSourceNode>();
  async enable() {
    if (!this.context || this.context.state === "closed") this.context = new AudioContext({ latencyHint: "interactive" });
    await this.context.resume();
    if (this.context.state !== "running") throw new Error("Scan-Sound konnte nicht aktiviert werden.");
  }
  private tone(startHz: number, endHz: number, duration: number, gain: number, delay: number, type: OscillatorType = "sine") {
    const ctx = this.context; if (!ctx || ctx.state !== "running") return;
    const osc = ctx.createOscillator(), envelope = ctx.createGain(), at = ctx.currentTime + delay;
    osc.type = type; osc.frequency.setValueAtTime(startHz, at); osc.frequency.exponentialRampToValueAtTime(endHz, at + duration);
    envelope.gain.setValueAtTime(.0001, at); envelope.gain.exponentialRampToValueAtTime(gain, at + .025); envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    osc.connect(envelope).connect(ctx.destination); this.sources.add(osc);
    osc.onended = () => { this.sources.delete(osc); osc.disconnect(); envelope.disconnect(); };
    osc.start(at); osc.stop(at + duration + .025);
  }
  play(cue: ScanCue, delay = 0) {
    if (cue === "search") {
      this.tone(95, 170, .8, .028, delay);
      this.tone(420, 1800, .65, .016, delay + .08, "triangle");
      [0, .22, .44].forEach((offset, i) => this.tone(740 + i * 160, 600 + i * 160, .075, .017, delay + offset));
    } else if (cue === "found") {
      this.tone(660, 660, .22, .024, delay);
      this.tone(990, 1320, .3, .019, delay + .09);
    } else this.tone(290, 170, .25, .018, delay);
  }
  stop() { for (const source of this.sources) { try { source.stop(); } catch {} } this.sources.clear(); }
  close() { this.stop(); const ctx = this.context; this.context = null; if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {}); }
}
