"use client";
import { useEffect, useState } from "react";
import type { ScanState } from "@/lib/jarvis/knowledge";
export function useKnowledgeScan() {
  const [state, setState] = useState<ScanState>({ version: 0, at: 0, phase: "idle", ids: [], count: 0 });
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const abort = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch("/api/jarvis/knowledge", { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(5000)]), cache: "no-store" });
        if (!response.ok) throw new Error();
        const data: ScanState = await response.json();
        if (!abort.signal.aborted) { setConnected(true); setState(previous => previous.version === data.version && previous.phase === data.phase ? previous : data); }
      } catch { if (!abort.signal.aborted) setConnected(false); }
      if (!abort.signal.aborted) timer = setTimeout(poll, 400);
    };
    void poll(); return () => { abort.abort(); clearTimeout(timer); };
  }, []);
  return { state, connected };
}
