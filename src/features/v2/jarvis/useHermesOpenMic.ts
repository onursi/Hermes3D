"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createOpenMicSession, type Recognition } from "./openMicSession";
import { watchMicrophone } from "../world/voiceLevel";

function recognitionConstructor() {
  const browser = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}

function preferredMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
    MediaRecorder.isTypeSupported(type),
  ) ?? "";
}

export function useHermesOpenMic(onText: (text: string) => void, onInterrupt: () => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("Mikrofon aus");
  const [heard, setHeard] = useState("");
  const [engine, setEngine] = useState<"scribe" | "browser" | null>(null);
  const session = useRef<ReturnType<typeof createOpenMicSession> | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const unwatchMic = useRef<() => void>(() => {});
  const chunks = useRef<Blob[]>([]);
  const mounted = useRef(true);
  const callbacks = useRef({ onText, onInterrupt });

  useEffect(() => {
    callbacks.current = { onText, onInterrupt };
  }, [onText, onInterrupt]);

  useEffect(() => {
    mounted.current = true;
    setSupported(
      Boolean(navigator.mediaDevices && typeof MediaRecorder !== "undefined") ||
        Boolean(recognitionConstructor()),
    );
    return () => {
      mounted.current = false;
    };
  }, []);

  const stopTracks = useCallback(() => {
    unwatchMic.current();
    unwatchMic.current = () => {};
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  const transcribe = useCallback(async (blob: Blob) => {
    if (!mounted.current) return;
    setListening(false);
    setStatus("Hermes transkribiert präzise mit ElevenLabs Scribe …");
    const data = new FormData();
    const extension = blob.type.includes("mp4") ? "m4a" : "webm";
    data.set("audio", blob, `hermes-diktat.${extension}`);
    try {
      const response = await fetch("/api/office/voice/transcribe", { method: "POST", body: data });
      const result = (await response.json()) as { text?: string; error?: string; provider?: string };
      if (!response.ok || !result.text?.trim()) {
        throw new Error(result.error || "Das Diktat blieb leer.");
      }
      const text = result.text.trim();
      setHeard(text);
      callbacks.current.onText(text);
      setStatus(`${result.provider || "Scribe"} · Text bereit, bitte prüfen`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Diktat konnte nicht transkribiert werden.");
    }
  }, []);

  const startBrowserRecognition = useCallback(() => {
    const Constructor = recognitionConstructor();
    if (!Constructor) {
      setStatus("Spracherkennung ist in diesem Browser nicht verfügbar.");
      return;
    }
    setEngine("browser");
    setStatus("Browser-Diktat wird gestartet …");
    session.current = createOpenMicSession(new Constructor(), {
      text: (text) => {
        setHeard(text);
        callbacks.current.onText(text);
      },
      interrupt: () => callbacks.current.onInterrupt(),
      status: (active, message) => {
        setListening(active);
        setStatus(message);
        if (!active) session.current = null;
      },
    });
  }, []);

  const startListening = useCallback(() => {
    if (recorder.current?.state === "recording" || session.current?.active) return;
    callbacks.current.onInterrupt();
    setHeard("");

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      startBrowserRecognition();
      return;
    }

    void navigator.mediaDevices
      .getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      .then((mediaStream) => {
        const mimeType = preferredMimeType();
        const activeRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
        stream.current = mediaStream;
        unwatchMic.current = watchMicrophone(mediaStream);
        recorder.current = activeRecorder;
        chunks.current = [];
        setEngine("scribe");
        activeRecorder.ondataavailable = (event) => {
          if (event.data.size) chunks.current.push(event.data);
        };
        activeRecorder.onstart = () => {
          setListening(true);
          setStatus("ElevenLabs Scribe · Aufnahme läuft");
        };
        activeRecorder.onerror = () => {
          setListening(false);
          setStatus("Mikrofonaufnahme fehlgeschlagen.");
          stopTracks();
        };
        activeRecorder.onstop = () => {
          const blob = new Blob(chunks.current, {
            type: activeRecorder.mimeType || "audio/webm",
          });
          chunks.current = [];
          recorder.current = null;
          stopTracks();
          if (blob.size > 0) void transcribe(blob);
          else {
            setListening(false);
            setStatus("Keine Aufnahme erkannt.");
          }
        };
        activeRecorder.start(250);
      })
      .catch(() => {
        setListening(false);
        setStatus("Mikrofonzugriff wurde nicht freigegeben.");
      });
  }, [startBrowserRecognition, stopTracks, transcribe]);

  const stopListening = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    session.current?.stop();
    session.current = null;
  }, []);

  useEffect(() => {
    const hidden = () => {
      if (document.hidden) stopListening();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      if (recorder.current?.state === "recording") recorder.current.stop();
      session.current?.stop();
      stopTracks();
    };
  }, [stopListening, stopTracks]);

  return { supported, listening, status, heard, engine, startListening, stopListening };
}
