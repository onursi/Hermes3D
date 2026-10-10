/** Hears a finger snap or clap in the 16 kHz microphone stream: one short, loud burst with quiet before and after.
 * Speech fails the test because it stays loud for longer than a few hundredths of a second. */
export class SnapDetector {
  private peaks: number[] = [];
  private quietUntil = 0;
  private elapsed = 0;
  constructor(private threshold = .2, private cooldownMs = 2500) {}
  /** Returns true once per detected snap. */
  push(samples: Int16Array) {
    let heard = false;
    for (let start = 0; start + 160 <= samples.length; start += 160) {
      let peak = 0;
      for (let i = start; i < start + 160; i++) peak = Math.max(peak, Math.abs(samples[i]) / 32768);
      this.peaks.push(peak); if (this.peaks.length > 12) this.peaks.shift();
      this.elapsed += 10;
      if (this.peaks.length < 12 || this.elapsed < this.quietUntil) continue;
      // Judge the window 60 ms ago, once what followed it is known.
      const burst = this.peaks[5], before = Math.max(...this.peaks.slice(0, 4)), after = Math.max(...this.peaks.slice(9));
      if (burst >= this.threshold && burst >= this.peaks[4] && burst >= this.peaks[6] && before < burst * .25 && after < burst * .3) { heard = true; this.quietUntil = this.elapsed + this.cooldownMs; }
    }
    return heard;
  }
}
