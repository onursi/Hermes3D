/* PCM16 / 16kHz microphone capture. No recording or persistence. */
class JarvisCapture extends AudioWorkletProcessor {
  constructor() { super(); this.phase = 0; this.sum = 0; this.count = 0; this.chunk = new Int16Array(1600); this.offset = 0; }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) for (const sample of channel) {
      this.sum += sample; this.count++; this.phase += 16000 / sampleRate;
      if (this.phase >= 1) {
        this.phase -= 1;
        const value = Math.max(-1, Math.min(1, this.sum / this.count));
        this.chunk[this.offset++] = Math.round(value * (value < 0 ? 32768 : 32767));
        this.sum = 0; this.count = 0;
        if (this.offset === this.chunk.length) { this.port.postMessage(this.chunk.buffer, [this.chunk.buffer]); this.chunk = new Int16Array(1600); this.offset = 0; }
      }
    }
    return true;
  }
}
registerProcessor("jarvis-capture", JarvisCapture);
