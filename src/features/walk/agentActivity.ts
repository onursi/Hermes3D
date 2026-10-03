"use client";

import { useEffect, useState } from "react";

import type { HermesLive } from "@/features/v2/useHermesLive";

export type AgentPhase = "bereit" | "denkt" | "arbeitet" | "fertig" | "fehler";

/** What the live window above an agent shows. Derived only from gateway events. */
export type AgentActivity = {
  phase: AgentPhase;
  /** Current step in plain words, e.g. "Werkzeug: web_search". */
  step: string | null;
  /** The reply as it is being written (tail only). */
  text: string;
  /** When the current run started (ms), for the running timer. */
  since: number | null;
};

const IDLE: AgentActivity = { phase: "bereit", step: null, text: "", since: null };

function agentIdFrom(sessionKey: unknown): string | null {
  if (typeof sessionKey !== "string" || !sessionKey.startsWith("agent:")) return null;
  return sessionKey.split(":")[1] || null;
}

function textFrom(message: unknown): string {
  const content = (message as { content?: unknown } | undefined)?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === "string" ? part : (part as { text?: string })?.text ?? "")).join("");
  }
  return "";
}

/**
 * Live activity per agent id, from `chat` and `agent` events.
 * Nothing is polled: an agent that does nothing simply stays "bereit".
 */
export function useAgentActivity(live: Pick<HermesLive, "subscribe">): Record<string, AgentActivity> {
  const { subscribe } = live;
  const [activity, setActivity] = useState<Record<string, AgentActivity>>({});

  useEffect(() => {
    const update = (id: string, patch: (prev: AgentActivity) => AgentActivity) =>
      setActivity((all) => ({ ...all, [id]: patch(all[id] ?? IDLE) }));

    const unsubscribe = subscribe(({ event, payload }) => {
      const p = (payload ?? {}) as Record<string, unknown>;
      const id = agentIdFrom(p.sessionKey);
      if (!id) return;

      if (event === "chat") {
        const state = String(p.state ?? "");
        if (state === "delta") {
          const text = textFrom(p.message);
          update(id, (prev) => ({
            phase: text && text !== "…" ? "arbeitet" : "denkt",
            step: prev.step,
            text: text === "…" ? prev.text : text.slice(-600),
            since: prev.since ?? Date.now(),
          }));
        } else if (state === "final") {
          const text = textFrom(p.message);
          update(id, (prev) => ({ phase: "fertig", step: null, text: (text || prev.text).slice(-600), since: prev.since }));
        } else if (state === "error" || state === "aborted") {
          update(id, (prev) => ({ ...prev, phase: "fehler", step: String(p.errorMessage ?? "abgebrochen") }));
        }
      } else if (event === "agent") {
        const data = (p.data ?? {}) as Record<string, unknown>;
        if (p.stream === "tool") {
          const name = String(data.name ?? data.tool ?? "Werkzeug");
          update(id, (prev) => ({ ...prev, phase: "arbeitet", step: `Werkzeug: ${name}`, since: prev.since ?? Date.now() }));
        } else if (p.stream === "lifecycle" && data.phase === "start") {
          update(id, () => ({ phase: "denkt", step: null, text: "", since: Date.now() }));
        }
      }
    });

    // A finished agent drifts back to "bereit" after a minute, so the room calms down.
    const calm = window.setInterval(() => {
      setActivity((all) => {
        let changed = false;
        const next = { ...all };
        for (const [id, a] of Object.entries(all)) {
          if ((a.phase === "fertig" || a.phase === "fehler") && a.since && Date.now() - a.since > 90_000) {
            next[id] = { ...a, phase: "bereit", step: null, since: null };
            changed = true;
          }
        }
        return changed ? next : all;
      });
    }, 10_000);

    return () => {
      unsubscribe();
      window.clearInterval(calm);
    };
  }, [subscribe]);

  return activity;
}
