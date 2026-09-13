"use client";

import { useHermesOpenMic } from "../v2/jarvis/useHermesOpenMic";

export function useCouncilVoice(onSpeech: (text: string) => void, onInterrupt: () => void) {
  const voice = useHermesOpenMic(onSpeech, onInterrupt);
  return {
    listening: voice.listening,
    status: voice.status,
    start: voice.startListening,
    stop: voice.stopListening,
  };
}
