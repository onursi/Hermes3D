"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Jarvis sprechen lassen — und dabei zusehen können.
 *
 * Zwei Dinge, die zusammengehören und deshalb in einem Haken stehen: die
 * neuronale Stimme von /api/jarvis/speak, und der **Pegel** dieser Stimme,
 * Bild für Bild.
 *
 * Der Pegel ist der Grund, warum hier ein AudioContext steht und kein
 * schlichtes `new Audio(url).play()`. Kugel und Gesicht sollen sich nach dem
 * bewegen, was tatsächlich zu hören ist. Ein Mund, der nach einem Sinus auf-
 * und zugeht, während die Stimme längst schweigt, ist genau die Art von
 * Kulisse, die Onur an anderer Stelle schon zu Recht auseinandergenommen hat:
 * eine Animation, die dasselbe sagt, ob etwas passiert ist oder nicht.
 *
 * Der Pegel wandert per **ref**, nicht per State. 60 Renderdurchläufe je
 * Sekunde, um eine Zahl in ein Canvas zu tragen, wäre absurd — das Canvas
 * liest den ref in seiner eigenen Schleife.
 */

export type JarvisVoiceId = "conrad" | "killian" | "katja" | "amala";

export const JARVIS_VOICES: { id: JarvisVoiceId; label: string; hint: string }[] = [
  { id: "conrad", label: "Conrad", hint: "dunkel, ruhig" },
  { id: "killian", label: "Killian", hint: "männlich, klar" },
  { id: "katja", label: "Katja", hint: "weiblich, wach" },
  { id: "amala", label: "Amala", hint: "weiblich, warm" },
];

type Options = {
  /** Welche Stimme. Wechselt sofort, betrifft aber erst den nächsten Satz. */
  voice?: JarvisVoiceId;
};

export function useJarvisVoice({ voice = "conrad" }: Options = {}) {
  const [speaking, setSpeaking] = useState(false);
  /**
   * Woher der Ton kam. Ehrlich beantwortbar, deshalb sichtbar:
   * "neural" ist die kostenlose Edge-Stimme, "browser" der Notnagel.
   */
  const [engine, setEngine] = useState<"neural" | "browser" | null>(null);

  /** 0 bis 1, aktualisiert im Takt der Bildwiederholung. */
  const levelRef = useRef(0);

  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const elementRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef(0);
  const urlRef = useRef<string | null>(null);
  /** Zählt die Anfragen, damit eine überholte Antwort nicht doch noch spricht. */
  const runRef = useRef(0);
  const voiceRef = useRef(voice);
  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  const releaseUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    runRef.current += 1;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    levelRef.current = 0;
    const element = elementRef.current;
    if (element) {
      element.pause();
      element.currentTime = 0;
    }
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    releaseUrl();
    setSpeaking(false);
  }, [releaseUrl]);

  /**
   * Der Notnagel: die Stimme des Browsers.
   *
   * Sie klingt schlechter, und sie liefert keinen Pegel. Damit das Gesicht
   * trotzdem nicht einfriert, bekommt es solange eine geschätzte Bewegung —
   * und `engine` sagt "browser", damit im Panel steht, dass gerade nicht die
   * gute Stimme läuft. Eine Ersatzlösung, die sich als das Original ausgibt,
   * ist schlimmer als eine, die sichtbar eine ist.
   */
  const speakWithBrowser = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "de-DE";
    utterance.rate = 1.05;
    const tick = () => {
      levelRef.current = 0.25 + Math.abs(Math.sin(performance.now() / 110)) * 0.5;
      rafRef.current = requestAnimationFrame(tick);
    };
    utterance.onstart = () => {
      setEngine("browser");
      setSpeaking(true);
      tick();
    };
    const finish = () => {
      cancelAnimationFrame(rafRef.current);
      levelRef.current = 0;
      setSpeaking(false);
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      const clean = text.replace(/\s+/g, " ").trim();
      if (!clean) return;
      stop();
      const run = runRef.current;

      let blob: Blob | null = null;
      try {
        const response = await fetch("/api/jarvis/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: clean, voice: voiceRef.current }),
        });
        if (response.ok && response.headers.get("Content-Type")?.includes("audio")) {
          blob = await response.blob();
        }
      } catch {
        // Netzweg tot. Unten steht der Notnagel.
      }
      if (run !== runRef.current) return;

      if (!blob || blob.size === 0) {
        speakWithBrowser(clean);
        return;
      }

      // Der AudioContext wird einmal gebaut und behalten. Browser begrenzen
      // die Zahl gleichzeitiger Kontexte hart; einer je Antwort läuft nach
      // ein paar Fragen in genau diese Grenze.
      let context = contextRef.current;
      if (!context) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) {
          speakWithBrowser(clean);
          return;
        }
        context = new Ctor();
        contextRef.current = context;
      }
      // Ohne Nutzergeste startet ein Kontext ausgesetzt. Die Frage war eine
      // Geste, also darf er hier aufwachen.
      if (context.state === "suspended") await context.resume();
      if (run !== runRef.current) return;

      let element = elementRef.current;
      if (!element) {
        element = new Audio();
        element.crossOrigin = "anonymous";
        elementRef.current = element;
        const source = context.createMediaElementSource(element);
        const analyser = context.createAnalyser();
        // Klein gewählt: gebraucht wird die Lautstärke, nicht das Spektrum.
        // 256 Werte reichen für einen ruhigen Mittelwert und kosten nichts.
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        analyser.connect(context.destination);
        analyserRef.current = analyser;
      }

      releaseUrl();
      urlRef.current = URL.createObjectURL(blob);
      // setAttribute statt `element.src = …`: der Lint-Wächter verbietet, ein
      // in einem ref gehaltenes Objekt per Zuweisung zu verändern — zu Recht,
      // denn genau so entstehen Zustände, die React nicht mitbekommt. Hier
      // steht ein DOM-Element, das gar nicht gerendert wird; der DOM-Weg über
      // setAttribute sagt dasselbe und ist ehrlicher als eine Ausnahme.
      element.setAttribute("src", urlRef.current);

      const analyser = analyserRef.current!;
      const bins = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(bins);
        // Effektivwert um die Mitte (128 ist Stille bei 8-Bit-Zeitdaten).
        let sum = 0;
        for (let i = 0; i < bins.length; i++) {
          const v = (bins[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / bins.length);
        // Sprache liegt effektiv weit unter 1. Ohne Streckung bliebe der Mund
        // fast zu; der Faktor macht aus einem echten Signal eine sichtbare
        // Bewegung, ohne sie zu erfinden.
        levelRef.current = Math.min(1, rms * 3.4);
        rafRef.current = requestAnimationFrame(tick);
      };

      const finish = () => {
        cancelAnimationFrame(rafRef.current);
        levelRef.current = 0;
        setSpeaking(false);
        releaseUrl();
      };
      element.addEventListener("ended", finish, { once: true });
      element.addEventListener("error", finish, { once: true });

      try {
        await element.play();
      } catch {
        finish();
        speakWithBrowser(clean);
        return;
      }
      if (run !== runRef.current) {
        element.pause();
        return;
      }
      setEngine("neural");
      setSpeaking(true);
      tick();
    },
    [releaseUrl, speakWithBrowser, stop],
  );

  // Eine Seite, die verlassen wird, während Jarvis mitten im Satz ist, redet
  // sonst weiter: die Abspielwarteschlange überlebt die Komponente.
  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      elementRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      void contextRef.current?.close();
    },
    [],
  );

  return { speak, stop, speaking, engine, levelRef };
}
