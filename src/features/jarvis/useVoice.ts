"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Speaking to Jarvis, and being answered out loud.
 *
 * Both halves are in the browser already — SpeechRecognition for listening,
 * speechSynthesis for talking — so this needs no server, no API key and no
 * audio leaving the machine. That matters more than convenience here: a
 * vault full of personal notes should not be read aloud by way of a cloud
 * transcription service.
 *
 * Chrome ships this behind the webkit prefix and Firefox does not ship it at
 * all, so `supported` is reported honestly rather than assumed. A button for
 * a feature the browser cannot do is worse than no button.
 */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function recognitionConstructor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoice({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  /**
   * Detected after mount, and deliberately not during render.
   *
   * A lazy initialiser looks cleaner and breaks the page: the server has no
   * window, so it renders "no voice", the client renders "voice", and React
   * aborts hydration on the mismatch — after which nothing on the page
   * updates at all. An effect runs only on the client, so both passes agree
   * and the buttons appear a frame later. That is the correct trade for a
   * capability that only the browser can know about.
   */
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(Boolean(recognitionConstructor()) && "speechSynthesis" in window);
  }, []);
  const [heard, setHeard] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  /**
   * The callback, held by ref.
   *
   * Recognition handlers are attached once when listening starts. Without
   * this they would close over the callback as it was at that moment, and a
   * transcript arriving seconds later would be handed to a stale one.
   */
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);


  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    const Constructor = recognitionConstructor();
    if (!Constructor) return;
    // Talking over the answer is how you get a recogniser transcribing the
    // machine's own voice back into the question box.
    window.speechSynthesis?.cancel();
    setSpeaking(false);

    const recognition = new Constructor();
    recognition.lang = "de-DE";
    recognition.continuous = false;
    // Interim results, so the words appear while they are being said. Waiting
    // in silence for a final transcript feels broken even when it is working.
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0]?.transcript ?? "";
      }
      setHeard(text);
    };
    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      // Read out of state at the end rather than on every interim result, so
      // the question is submitted once, when the sentence is finished.
      setHeard((finalText) => {
        const trimmed = finalText.trim();
        if (trimmed) onTranscriptRef.current(trimmed);
        return trimmed;
      });
    };

    recognitionRef.current = recognition;
    setHeard("");
    setListening(true);
    recognition.start();
  }, []);

  /**
   * Say the answer out loud.
   *
   * Citation markers are stripped before speaking: "[2]" read aloud as
   * "Klammer auf zwei" is noise in the middle of a sentence, and the sources
   * are on screen anyway.
   */
  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const spoken = text
      .replace(/\[\d+\]/g, "")
      .replace(/\*\*/g, "")
      .replace(/^[-*]\s+/gm, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!spoken) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.lang = "de-DE";
    utterance.rate = 1.05;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  // A page left while Jarvis is mid-sentence keeps talking otherwise: the
  // synthesis queue outlives the component.
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.abort();
    },
    [],
  );

  return { listening, speaking, supported, heard, startListening, stopListening, speak, stopSpeaking };
}
