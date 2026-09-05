"use client";

/**
 * Two short sounds, and only after he asks for them.
 *
 * U1.5 allows a brief selection and arrival tone, muted by default, activated
 * deliberately. Everything about this file follows from that one sentence:
 *
 * - There is no audio file. Both sounds are two oscillators and an envelope,
 *   generated here — nothing to download, nothing to cache, nothing that can
 *   turn into a soundtrack.
 * - There is no loop, no ambience and no autoplay. Each call makes one sound
 *   of a fifth of a second and then there is silence again.
 * - The AudioContext is not created until the first sound plays. Browsers
 *   refuse to start one before a gesture anyway, and an app that opens an
 *   audio device on load while claiming to be muted is not muted.
 * - Every visible thing it accompanies is also visible without it. The sound
 *   is confirmation, never information.
 */

let context: AudioContext | null = null;

/** Created lazily, on the first sound only. Never on load. */
function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (context) return context;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
    return context;
  } catch {
    // A browser that refuses an audio context is not an error worth a dialog.
    return null;
  }
}

function tone(frequency: number, seconds: number, gain: number, type: OscillatorType) {
  const audio = ensureContext();
  if (!audio) return;
  // Some browsers park the context when the tab has been in the background.
  if (audio.state === "suspended") void audio.resume().catch(() => {});

  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  const now = audio.currentTime;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);

  // A ramp rather than a switch: an instant start and stop is a click, and a
  // click is the sound of a bug even when nothing is wrong.
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(gain, now + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + seconds);

  oscillator.connect(envelope).connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + seconds + 0.02);
}

/** Something was chosen. Short, high, quiet. */
export function playSelect(volume: number) {
  if (volume <= 0) return;
  tone(880, 0.12, 0.05 * volume, "sine");
}

/** Somewhere was entered. A step down, so arriving does not sound like picking. */
export function playArrive(volume: number) {
  if (volume <= 0) return;
  tone(392, 0.2, 0.06 * volume, "triangle");
  window.setTimeout(() => tone(587, 0.18, 0.045 * volume, "sine"), 90);
}
