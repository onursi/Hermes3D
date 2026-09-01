"use client";

import { useMemo } from "react";

import type { AgentState, RoutingLogEntry } from "@/features/agents/state/store";

// Central chronological timeline of routing.* events across all agents —
// "00:00 Auftrag empfangen / 00:01 Agent gestartet / ...". Grouped by run so
// each job reads as its own short story instead of one flat interleaved feed.

const agentDisplayName = (agents: AgentState[], agentId: string | null | undefined): string => {
  if (!agentId) return "";
  const agent = agents.find((entry) => entry.agentId === agentId);
  return agent?.name?.trim() || agentId;
};

const describeEntry = (entry: RoutingLogEntry, agents: AgentState[]): string => {
  switch (entry.event) {
    case "received":
      return "Auftrag empfangen";
    case "classified":
      return `Klassifiziert: ${entry.category ?? "?"}`;
    case "selected":
      return `Ziel: ${agentDisplayName(agents, entry.targetAgentId) || entry.targetAgentId || "?"}${
        entry.targetModel ? ` (${entry.targetModel})` : ""
      }`;
    case "started":
      return `Agent gestartet: ${agentDisplayName(agents, entry.targetAgentId) || entry.targetAgentId || "?"}`;
    case "completed":
      return `Fertig${typeof entry.durationMs === "number" ? ` (${(entry.durationMs / 1000).toFixed(1)}s)` : ""}`;
    case "failed":
      return `Fehler${entry.reason ? `: ${entry.reason}` : ""}`;
    default:
      return entry.event;
  }
};

const DOT_COLOR_BY_EVENT: Record<RoutingLogEntry["event"], string> = {
  received: "bg-cyan-400",
  classified: "bg-cyan-400",
  selected: "bg-fuchsia-400",
  started: "bg-amber-400",
  completed: "bg-emerald-400",
  failed: "bg-rose-400",
};

const groupByRunPreservingOrder = (
  entries: RoutingLogEntry[]
): { runId: string; entries: RoutingLogEntry[] }[] => {
  const order: string[] = [];
  const map = new Map<string, RoutingLogEntry[]>();
  for (const entry of entries) {
    if (!map.has(entry.runId)) {
      map.set(entry.runId, []);
      order.push(entry.runId);
    }
    map.get(entry.runId)!.push(entry);
  }
  return order.map((runId) => ({ runId, entries: map.get(runId)! }));
};

export function LiveActivityPanel({
  routingLog,
  agents,
}: {
  routingLog: RoutingLogEntry[];
  agents: AgentState[];
}) {
  const runs = useMemo(
    () => groupByRunPreservingOrder(routingLog).reverse(),
    [routingLog]
  );

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="border-b border-cyan-500/10 px-4 py-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/70">
          Live Activity
        </div>
        <div className="mt-1 font-mono text-[11px] text-white/40">
          Zeitleiste aller Routing-Entscheidungen in dieser Sitzung.
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {runs.length === 0 ? (
          <div className="px-1 py-6 font-mono text-[11px] text-white/35">
            Noch keine Aktivität. Schick „Default" einen Auftrag, um den Router zu sehen.
          </div>
        ) : (
          runs.map(({ runId, entries }) => {
            const t0 = entries[0]?.at ?? 0;
            return (
              <div
                key={runId}
                className="mb-4 rounded border border-white/8 bg-white/[0.02] px-3 py-3 last:mb-0"
              >
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/30">
                  {new Date(t0).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </div>
                <ol className="flex flex-col gap-1.5">
                  {entries.map((entry) => {
                    const elapsedS = Math.max(0, (entry.at - t0) / 1000);
                    return (
                      <li key={entry.id} className="flex items-start gap-2 font-mono text-[11px]">
                        <span
                          className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${DOT_COLOR_BY_EVENT[entry.event]}`}
                        />
                        <span className="w-12 shrink-0 tabular-nums text-white/35">
                          {elapsedS.toFixed(0).padStart(2, "0")}s
                        </span>
                        <span className="min-w-0 flex-1 text-white/75">
                          {describeEntry(entry, agents)}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
