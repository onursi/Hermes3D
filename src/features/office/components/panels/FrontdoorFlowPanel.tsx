"use client";

import { useMemo } from "react";

import type { AgentState, RoutingLogEntry } from "@/features/agents/state/store";

// Renders the Frontdoor Router's decision flow for the most recent job —
// "Empfängt → Klassifiziert → Wählt Agent → Startet Job" — plus a short
// strip of the last few routing decisions. Pure display: all data already
// lives in AgentStoreState.routingLog (see runtimeRoutingEventWorkflow.ts).

type FlowStageId = "received" | "classified" | "selected" | "started";

const FLOW_STAGES: { id: FlowStageId; label: string }[] = [
  { id: "received", label: "Empfängt Auftrag" },
  { id: "classified", label: "Klassifiziert" },
  { id: "selected", label: "Wählt Agent" },
  { id: "started", label: "Startet Job" },
];

const groupByRunId = (entries: RoutingLogEntry[]): Map<string, RoutingLogEntry[]> => {
  const map = new Map<string, RoutingLogEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.runId);
    if (list) {
      list.push(entry);
    } else {
      map.set(entry.runId, [entry]);
    }
  }
  return map;
};

const hasStage = (run: RoutingLogEntry[], stage: FlowStageId) =>
  run.some((entry) => entry.event === stage);

const findLatest = (run: RoutingLogEntry[], event: RoutingLogEntry["event"]) =>
  [...run].reverse().find((entry) => entry.event === event) ?? null;

const formatSeconds = (durationMs: number | null | undefined) =>
  typeof durationMs === "number" ? `${(durationMs / 1000).toFixed(1)}s` : null;

const agentDisplayName = (agents: AgentState[], agentId: string | null | undefined): string => {
  if (!agentId) return "—";
  const agent = agents.find((entry) => entry.agentId === agentId);
  return agent?.name?.trim() || agentId;
};

export function FrontdoorFlowPanel({
  routingLog,
  agents,
}: {
  routingLog: RoutingLogEntry[];
  agents: AgentState[];
}) {
  const runsInOrder = useMemo(() => {
    const grouped = groupByRunId(routingLog);
    return Array.from(grouped.entries());
  }, [routingLog]);

  const latest = runsInOrder[runsInOrder.length - 1] ?? null;
  const latestRun = latest ? latest[1] : [];
  const isFailed = latestRun.some((entry) => entry.event === "failed");
  const isCompleted = latestRun.some((entry) => entry.event === "completed");

  const selected = findLatest(latestRun, "selected");
  const classified = findLatest(latestRun, "classified");
  const completedOrFailed = findLatest(latestRun, isFailed ? "failed" : "completed");

  const recentRuns = runsInOrder.slice(-6).reverse();

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="border-b border-cyan-500/10 px-4 py-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/70">
          Frontdoor Router
        </div>
        <div className="mt-1 font-mono text-[11px] text-white/40">
          Wie „Default" Aufgaben klassifiziert und an Spezial-Agenten verteilt.
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!latest ? (
          <div className="px-1 py-6 font-mono text-[11px] text-white/35">
            Noch keine Routing-Entscheidung in dieser Sitzung.
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {FLOW_STAGES.map((stage, index) => {
                const active = hasStage(latestRun, stage.id);
                const isLastStage = index === FLOW_STAGES.length - 1;
                const isTerminal = isLastStage && (isCompleted || isFailed);
                return (
                  <div key={stage.id} className="flex items-center gap-3">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] ${
                        isTerminal
                          ? isFailed
                            ? "border-rose-400/60 bg-rose-500/15 text-rose-200"
                            : "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                          : active
                            ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200"
                            : "border-white/10 bg-white/[0.02] text-white/30"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span
                      className={`font-mono text-[11px] uppercase tracking-[0.16em] ${
                        active ? "text-white/85" : "text-white/30"
                      }`}
                    >
                      {stage.label}
                    </span>
                    {stage.id === "classified" && classified?.category ? (
                      <span className="rounded border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] text-cyan-200">
                        {classified.category}
                      </span>
                    ) : null}
                    {stage.id === "selected" && selected?.targetAgentId ? (
                      <span className="rounded border border-fuchsia-500/20 bg-fuchsia-500/10 px-1.5 py-0.5 font-mono text-[10px] text-fuchsia-200">
                        {agentDisplayName(agents, selected.targetAgentId)}
                      </span>
                    ) : null}
                    {!isLastStage ? null : (
                      <span className="ml-auto" />
                    )}
                  </div>
                );
              })}
              {!FLOW_STAGES.some((stage) => hasStage(latestRun, stage.id)) ? null : (
                <div className="ml-9 mt-1 flex items-center gap-3">
                  <span
                    className={`h-6 w-6 shrink-0 rounded-full border font-mono text-[10px] flex items-center justify-center ${
                      isCompleted
                        ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                        : isFailed
                          ? "border-rose-400/60 bg-rose-500/15 text-rose-200"
                          : "border-amber-400/50 bg-amber-500/10 text-amber-200"
                    }`}
                  >
                    {isCompleted ? "✓" : isFailed ? "✕" : "…"}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/85">
                    {isCompleted ? "Fertig" : isFailed ? "Fehlgeschlagen" : "Läuft…"}
                  </span>
                  {completedOrFailed ? (
                    <span className="font-mono text-[10px] text-white/40">
                      {formatSeconds(completedOrFailed.durationMs)}
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            {selected?.reason ? (
              <div className="mt-4 rounded border border-white/8 bg-white/[0.03] px-3 py-2.5 font-mono text-[11px] leading-relaxed text-white/60">
                {selected.reason}
              </div>
            ) : null}
          </>
        )}

        {recentRuns.length > 0 ? (
          <div className="mt-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
              Letzte Entscheidungen
            </div>
            <div className="mt-2 flex flex-col gap-1.5">
              {recentRuns.map(([runId, entries]) => {
                const sel = findLatest(entries, "selected");
                const failed = entries.some((entry) => entry.event === "failed");
                const done = entries.some((entry) => entry.event === "completed");
                return (
                  <div
                    key={runId}
                    className="flex items-center gap-2 rounded border border-white/8 bg-white/[0.02] px-2.5 py-2 font-mono text-[10px]"
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        failed ? "bg-rose-400" : done ? "bg-emerald-400" : "bg-amber-400"
                      }`}
                    />
                    <span className="text-white/50">{sel?.category ?? "…"}</span>
                    <span className="text-white/25">→</span>
                    <span className="min-w-0 flex-1 truncate text-white/75">
                      {agentDisplayName(agents, sel?.targetAgentId)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
