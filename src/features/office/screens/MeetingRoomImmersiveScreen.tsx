"use client";

import { Crown, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { AgentState, RoutingLogEntry } from "@/features/agents/state/store";
import { useAgentStore } from "@/features/agents/state/store";
import {
  deriveMeetingParticipantStatus,
  isModeratorAgent,
  MEETING_STATUS_LABEL,
  type MeetingParticipantStatus,
} from "@/features/office/meeting-room/deriveParticipantStatus";

/** How many recent routing-log entries the discussion panel keeps on screen. */
const DISCUSSION_LOG_LIMIT = 12;

const STATUS_BADGE_CLASS: Record<MeetingParticipantStatus, string> = {
  available: "ui-badge-status-idle",
  working: "ui-badge-status-connecting",
  speaking: "ui-badge-status-speaking",
  waiting_approval: "ui-badge-status-waiting_approval",
  done: "ui-badge-status-done",
  error: "ui-badge-status-error",
};

const getInitials = (name: string | null | undefined): string => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
};

const formatRelativeTime = (atMs: number, nowMs: number): string => {
  const deltaS = Math.max(0, Math.round((nowMs - atMs) / 1000));
  if (deltaS < 5) return "gerade eben";
  if (deltaS < 60) return `vor ${deltaS}s`;
  const deltaM = Math.round(deltaS / 60);
  if (deltaM < 60) return `vor ${deltaM}min`;
  const deltaH = Math.round(deltaM / 60);
  return `vor ${deltaH}h`;
};

const ROUTING_EVENT_LABEL: Record<RoutingLogEntry["event"], string> = {
  received: "Anfrage eingegangen",
  classified: "Eingeordnet",
  selected: "Ziel gewählt",
  started: "Läuft",
  completed: "Abgeschlossen",
  failed: "Fehlgeschlagen",
};

function ParticipantSeat({ agent, nowMs }: { agent: AgentState; nowMs: number }) {
  const status = deriveMeetingParticipantStatus(agent, nowMs);
  const moderator = isModeratorAgent(agent);

  return (
    <div
      className={`ui-card relative flex min-w-0 flex-col gap-3 p-4 transition-colors ${
        moderator ? "ring-1 ring-inset" : ""
      }`}
      style={moderator ? { boxShadow: "inset 0 0 0 1px color-mix(in oklch, var(--primary) 34%, transparent)" } : undefined}
      data-participant-status={status}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            style={{
              background: "var(--surface-2)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            }}
          >
            {getInitials(agent.name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="type-agent-name truncate">{agent.name}</div>
              {moderator ? (
                <Crown
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: "var(--primary)" }}
                  aria-label="Moderator"
                />
              ) : null}
            </div>
            <div className="type-meta truncate text-muted-foreground">
              {agent.role?.trim() || (moderator ? "Moderator" : "Teammitglied")}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`ui-badge ${STATUS_BADGE_CLASS[status]}`}>
          {status === "speaking" ? (
            <span
              className="meeting-speaking-dot mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "currentColor" }}
            />
          ) : null}
          {MEETING_STATUS_LABEL[status]}
        </span>
        {agent.model ? (
          <span className="type-meta truncate rounded-sm border px-1.5 py-0.5" style={{ borderColor: "var(--border)" }}>
            {agent.model}
          </span>
        ) : null}
      </div>

      {status === "speaking" || status === "working" ? (
        <div className="type-meta truncate text-muted-foreground" title={agent.streamText ?? undefined}>
          {agent.streamText?.trim()
            ? agent.streamText.trim().slice(-140)
            : agent.routingReason?.trim() || "…"}
        </div>
      ) : null}
    </div>
  );
}

export function MeetingRoomImmersiveScreen({ onClose }: { onClose: () => void }) {
  // Reads straight from the shared agent store — the same real agents,
  // status, and routing activity every other panel (FleetSidebar,
  // AgentChatPanel, Live-Activity) already renders from. No prop plumbing
  // through RetroOffice3D's already-large props surface.
  const { state } = useAgentStore();
  const agents = state.agents;

  // Merely calling Date.now() at render time does not, by itself, schedule
  // another render — without this, relative "vor Xs" timestamps and the
  // done-status expiry window would freeze at whatever moment this screen
  // happened to last re-render for some other reason (Codex review finding,
  // P2, 2026-09-01). The clock lives in state, set only from effects, never
  // read directly in the render body — a bare `Date.now()` call reachable
  // during render trips the repo's react-hooks/purity lint rule (Codex
  // review finding, P2, 2026-09-01), matching AgentChatPanel.tsx's nowMs
  // pattern. Starts null for the one frame before the first effect commit;
  // every downstream use already tolerates that (see nowMs ?? fallback
  // below and formatRelativeTime/deriveMeetingParticipantStatus callers).
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    // Deferred via setTimeout(0), not called synchronously in the effect
    // body — react-hooks/set-state-in-effect flags a direct setState() call
    // there as a cascading-render risk, matching AgentChatPanel.tsx's same
    // nowMs bootstrap.
    const timeoutId = window.setTimeout(() => setNowMs(Date.now()), 0);
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);
  const effectiveNowMs = nowMs ?? 0;

  const orderedAgents = useMemo(() => {
    const moderator = agents.filter((agent) => isModeratorAgent(agent));
    const rest = agents.filter((agent) => !isModeratorAgent(agent));
    return [...moderator, ...rest];
  }, [agents]);

  // awaitingUserInput is the field execApprovalRuntimeCoordinator actually
  // populates from real pending exec approvals — fineStatus never carries
  // "waiting_approval" in practice (Codex review finding, P2, 2026-09-01).
  const waitingForApproval = useMemo(
    () => agents.filter((agent) => agent.awaitingUserInput),
    [agents]
  );

  const moderatorAgent = orderedAgents.find((agent) => isModeratorAgent(agent)) ?? null;
  const topic = moderatorAgent?.lastUserMessage?.trim() || null;

  const discussionLog = useMemo(
    () => state.routingLog.slice(-DISCUSSION_LOG_LIMIT).reverse(),
    [state.routingLog]
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--background)" }}>
      <div className="ui-topbar flex items-center justify-between px-6 py-4">
        <div>
          <div className="type-page-title" style={{ fontFamily: "var(--font-serif)" }}>
            Meeting Room
          </div>
          <div className="type-meta mt-1 text-muted-foreground">
            {orderedAgents.length} Teilnehmer · Hermes moderiert
          </div>
        </div>
        <button type="button" onClick={onClose} className="ui-btn-icon" aria-label="Meeting Room schließen">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto ui-scroll px-6 py-6"
        style={{ background: "var(--plane-workspace-bg)" }}
      >
        <div className="mx-auto flex min-w-0 max-w-6xl flex-col gap-6">
          {/* Human approval — always visible, even when nothing is pending. */}
          <section
            className={`min-w-0 ${
              waitingForApproval.length > 0 ? "ui-alert-caution rounded-md px-4 py-3" : "ui-card px-4 py-3"
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <div className="type-secondary-heading">Freigabe durch Mensch</div>
            </div>
            {waitingForApproval.length > 0 ? (
              <div className="type-body mt-1.5">
                {waitingForApproval.map((agent) => agent.name).join(", ")}{" "}
                {waitingForApproval.length === 1 ? "wartet" : "warten"} auf deine Freigabe im bestehenden
                Chat-Panel des jeweiligen Agenten.
              </div>
            ) : (
              <div className="type-meta mt-1 text-muted-foreground">Aktuell keine ausstehenden Freigaben.</div>
            )}
          </section>

          <div className="grid min-w-0 gap-6 lg:grid-cols-[1.3fr_1fr]">
            {/* Seats */}
            <section aria-label="Teilnehmer" className="grid min-w-0 gap-3 sm:grid-cols-2">
              {orderedAgents.length === 0 ? (
                <div className="ui-card col-span-full px-4 py-6 text-center type-meta text-muted-foreground">
                  Keine Agenten geladen.
                </div>
              ) : (
                orderedAgents.map((agent) => (
                  <ParticipantSeat key={agent.agentId} agent={agent} nowMs={effectiveNowMs} />
                ))
              )}
            </section>

            {/* Topic / discussion / outcome */}
            <section className="flex min-w-0 flex-col gap-4">
              <div className="ui-card min-w-0 px-4 py-3">
                <div className="type-secondary-heading">Thema</div>
                <div className="type-body mt-1.5 break-words">
                  {topic || "Kein aktives Thema."}
                </div>
              </div>

              <div className="ui-card flex min-h-0 min-w-0 flex-1 flex-col px-4 py-3">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <div className="type-secondary-heading">Verlauf</div>
                  <span className="type-meta shrink-0 text-muted-foreground">Routing-Aktivität</span>
                </div>
                <div className="mt-2 flex-1 space-y-2 overflow-y-auto ui-scroll" style={{ maxHeight: "22rem" }}>
                  {discussionLog.length === 0 ? (
                    <div className="type-meta text-muted-foreground">
                      Noch keine Aktivität in dieser Sitzung.
                    </div>
                  ) : (
                    discussionLog.map((entry) => (
                      <div key={entry.id} className="ui-settings-row min-w-0 px-3 py-2">
                        <div className="flex min-w-0 items-center justify-between gap-2">
                          <span className="type-meta min-w-0 truncate font-medium">
                            {ROUTING_EVENT_LABEL[entry.event]}
                            {entry.targetAgentId ? ` · ${entry.targetAgentId}` : ""}
                          </span>
                          <span className="type-meta shrink-0 text-muted-foreground">
                            {formatRelativeTime(entry.at, effectiveNowMs)}
                          </span>
                        </div>
                        {entry.reason ? (
                          <div className="type-meta mt-0.5 truncate text-muted-foreground" title={entry.reason}>
                            {entry.reason}
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="ui-card px-4 py-3">
                <div className="type-secondary-heading">Ergebnis</div>
                <div className="type-meta mt-1.5 text-muted-foreground">
                  Wird erzeugt, sobald Meeting-Workflows und Bot-Mode verbunden sind.
                </div>
              </div>

              <div
                className="rounded-md border px-4 py-3"
                style={{
                  borderColor: "var(--border)",
                  background: "color-mix(in oklch, var(--surface-2) 60%, transparent)",
                }}
              >
                <div className="type-meta text-muted-foreground">
                  Bot-Mode-Verbindung folgt — ein echter Gruppenchat zwischen mehreren Agenten ist
                  in dieser Version noch nicht angebunden. Diese Ansicht zeigt die tatsächlich
                  geladenen Agenten und ihren echten Live-Status.
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
