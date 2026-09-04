"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * The council, as it actually happened.
 *
 * What sat here before was a screenplay: four agents exchanging fixed
 * paragraphs on `setTimeout` chains, complete with invented latencies and
 * token rates, playing whether or not anything had been asked. It looked like
 * a group chat and contained no information.
 *
 * This renders the real transcript instead — every agent's messages merged
 * into one chronological feed, which is what a group conversation is. When
 * nothing has been said, it says so, because an empty room is a fact worth
 * showing and a fabricated one is not.
 */

export type CouncilMessage = {
  id: string;
  agentId: string;
  agentName: string;
  color: string;
  role: "user" | "assistant";
  text: string;
  timestampMs: number;
  /**
   * False while a reply is still streaming in. Shown with a pulse rather than
   * hidden, so a long answer looks like thinking instead of like nothing.
   */
  confirmed: boolean;
};

const timeOf = (ms: number) =>
  new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

export function CouncilChat({
  messages,
  agentNames,
  onSend,
  onClose,
}: {
  messages: CouncilMessage[];
  /** Who the prompt will reach, shown so the target is never a guess. */
  agentNames: string[];
  onSend?: (prompt: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  const ordered = useMemo(
    () => [...messages].sort((a, b) => a.timestampMs - b.timestampMs),
    [messages],
  );

  useEffect(() => {
    // Follow the conversation, but only when it grew — otherwise every render
    // yanks the view back down while you are reading further up.
    if (ordered.length === lastCountRef.current) return;
    lastCountRef.current = ordered.length;
    const feed = feedRef.current;
    if (feed) feed.scrollTop = feed.scrollHeight;
  }, [ordered.length]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onSend?.(text);
    setDraft("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex h-[76vh] w-[min(880px,92vw)] flex-col overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#050b16]/97 shadow-2xl">
        <header className="flex items-center justify-between border-b border-cyan-500/20 px-5 py-3">
          <div>
            <h2 className="font-mono text-sm font-bold tracking-wide text-white">
              COUNCIL // VERLAUF
            </h2>
            <p className="mt-0.5 font-mono text-[10px] text-slate-400">
              {agentNames.length > 0
                ? `Empfänger: ${agentNames.join(", ")}`
                : "Keine Agenten verbunden"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-2.5 py-1 font-mono text-[11px] text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Schließen
          </button>
        </header>

        <div ref={feedRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {ordered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <p className="font-mono text-sm text-slate-300">Noch nichts gesprochen.</p>
              <p className="max-w-md font-mono text-[11px] leading-relaxed text-slate-500">
                Hier steht der echte Verlauf deiner Agenten. Schick unten einen Auftrag
                los, dann erscheinen die Antworten, sobald sie eintreffen.
              </p>
            </div>
          ) : (
            ordered.map((message) => {
              const mine = message.role === "user";
              return (
                <div
                  key={message.id}
                  className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: mine ? "#64748b" : message.color }}
                    />
                    <span className="font-semibold" style={{ color: mine ? "#94a3b8" : message.color }}>
                      {mine ? "Du" : message.agentName}
                    </span>
                    <span className="text-slate-600">{timeOf(message.timestampMs)}</span>
                    {!message.confirmed ? (
                      <span className="animate-pulse text-cyan-400/70">schreibt…</span>
                    ) : null}
                  </div>
                  <div
                    className={`max-w-[80%] whitespace-pre-wrap rounded-xl px-3.5 py-2 text-xs leading-relaxed ${
                      mine
                        ? "bg-slate-800/70 text-slate-200"
                        : "border border-slate-700/60 bg-[#0a1424] text-slate-100"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <footer className="border-t border-cyan-500/20 p-3">
          <div className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-[#070e1c] px-3 py-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder={
                agentNames.length > 0
                  ? "Auftrag an das Council…"
                  : "Kein Agent verbunden — Gateway prüfen"
              }
              disabled={agentNames.length === 0}
              className="w-full bg-transparent font-mono text-xs text-white placeholder:text-slate-500 focus:outline-none disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim() || agentNames.length === 0}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1 font-mono text-[11px] font-semibold text-cyan-200 transition enabled:hover:border-cyan-400 enabled:hover:text-white disabled:opacity-40"
            >
              Senden
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
