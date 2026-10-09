/** Sentence-sized speech requests run alongside the Live socket, never blocking
 * microphone input, camera frames or interruption messages. No answer is cached.
 */
export class LiveVoiceOutput {
  private text = "";
  private previous = "";
  private epoch = 0;
  private jobs = 0;
  private queue = Promise.resolve();
  private abort = new AbortController();
  constructor(private session: string, private pcm: (bytes: Uint8Array) => void, private error: (message: string) => void, private activity: (busy: boolean) => void) {}
  get busy() { return this.jobs > 0 || this.text.trim().length > 0; }
  append(fragment: string) {
    this.text += fragment;
    if (this.text.length > 4000) { this.interrupt(); this.error("Sprachantwort zu lang. Bitte kürzer fragen."); return; }
    let match: RegExpMatchArray | null;
    while ((match = this.text.match(/^([\s\S]*?[.!?](?:\s|$))/))) {
      this.enqueue(match[1]); this.text = this.text.slice(match[1].length);
    }
    while (this.text.length > 500) { let cut = this.text.lastIndexOf(" ", 500); if (cut < 100) cut = 500; this.enqueue(this.text.slice(0, cut)); this.text = this.text.slice(cut); }
  }
  flush() { this.enqueue(this.text); this.text = ""; }
  interrupt() {
    this.abort.abort(); this.abort = new AbortController(); this.epoch++; this.jobs = 0; this.text = ""; this.previous = ""; this.queue = Promise.resolve(); this.activity(false);
  }
  private enqueue(raw: string) {
    const text = raw.trim(); if (!text) return;
    if (text.length > 500) { let cut = text.lastIndexOf(" ", 500); if (cut < 100) cut = 500; this.enqueue(text.slice(0, cut)); this.enqueue(text.slice(cut)); return; }
    const epoch = this.epoch, signal = this.abort.signal; this.jobs++; this.activity(true);
    this.queue = this.queue.then(async () => {
      if (signal.aborted || epoch !== this.epoch) return;
      const response = await fetch("/api/jarvis/live/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session: this.session, consent: true, text, previousText: this.previous }), signal });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "ElevenLabs konnte nicht antworten."); }
      if (!response.body || response.headers.get("X-Audio-Sample-Rate") !== "24000") throw new Error("Ungültiges ElevenLabs-Audioformat.");
      const reader = response.body.getReader(); let carry: number | undefined;
      try {
        while (!signal.aborted && epoch === this.epoch) {
          const part = await reader.read(); if (part.done) break;
          let bytes = part.value;
          if (carry !== undefined) { const joined = new Uint8Array(bytes.length + 1); joined[0] = carry; joined.set(bytes, 1); bytes = joined; carry = undefined; }
          if (bytes.length % 2) { carry = bytes[bytes.length - 1]; bytes = bytes.subarray(0, bytes.length - 1); }
          if (bytes.length && !signal.aborted && epoch === this.epoch) this.pcm(bytes);
        }
        if (!signal.aborted && epoch === this.epoch && carry !== undefined) throw new Error("Unvollständiges Sprachaudio.");
        if (!signal.aborted && epoch === this.epoch) this.previous = text.slice(-600);
      } finally { await reader.cancel().catch(() => {}); }
    }).catch(error => {
      if (!signal.aborted && epoch === this.epoch) { this.interrupt(); this.error(error instanceof Error ? error.message : "Sprachausgabe unterbrochen."); }
    }).finally(() => { if (epoch === this.epoch) { this.jobs--; this.activity(this.busy); } });
  }
}
