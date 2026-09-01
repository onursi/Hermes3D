import type { AgentState, RoutingLogEntry } from "@/features/agents/state/store";
import type { RoutingEventPayload } from "@/features/agents/state/runtimeEventBridge";

// Maps one incoming routing.* gateway event (see frontdoor-router.js +
// bridge.js) into: (1) a flat log entry for the Live-Activity panel, and
// (2) zero or more per-agent state patches for the Frontdoor-Flow panel and
// the agent cards. Deliberately simple/stateless compared to
// runtimeChatEventWorkflow.ts — routing events are one-shot structured
// facts, not a delta stream, so there is no race condition to reconcile.

export type RoutingShortEvent = RoutingLogEntry["event"];

const SHORT_EVENT_BY_SUFFIX: Record<string, RoutingShortEvent> = {
  received: "received",
  classified: "classified",
  selected: "selected",
  started: "started",
  completed: "completed",
  failed: "failed",
};

export const parseRoutingShortEvent = (eventName: string): RoutingShortEvent | null => {
  const suffix = eventName.startsWith("routing.") ? eventName.slice("routing.".length) : "";
  return SHORT_EVENT_BY_SUFFIX[suffix] ?? null;
};

export type RuntimeRoutingWorkflowInput = {
  eventName: string;
  payload: RoutingEventPayload;
  callerAgentId: string | null;
  nowMs: number;
};

export type RuntimeRoutingAgentPatch = {
  agentId: string;
  patch: Partial<AgentState>;
};

export type RuntimeRoutingWorkflowResult = {
  logEntry: RoutingLogEntry | null;
  agentPatches: RuntimeRoutingAgentPatch[];
};

export const planRuntimeRoutingEvent = (
  input: RuntimeRoutingWorkflowInput
): RuntimeRoutingWorkflowResult => {
  const { payload, callerAgentId, nowMs } = input;
  const shortEvent = parseRoutingShortEvent(input.eventName);
  const runId = payload.runId?.trim() ?? "";
  if (!shortEvent || !runId) {
    return { logEntry: null, agentPatches: [] };
  }

  const logEntry: RoutingLogEntry = {
    id: `${runId}:${shortEvent}`,
    runId,
    event: shortEvent,
    at: nowMs,
    sessionKey: payload.sessionKey ?? "",
    category: payload.category ?? null,
    targetAgentId: payload.targetAgentId ?? null,
    targetProfile: payload.targetProfile ?? null,
    targetModel: payload.targetModel ?? null,
    reason: payload.reason ?? null,
    status: payload.status ?? null,
    durationMs: typeof payload.durationMs === "number" ? payload.durationMs : null,
    textPreview: payload.textPreview ?? null,
  };

  const targetAgentId = payload.targetAgentId?.trim() || null;
  const agentPatches: RuntimeRoutingAgentPatch[] = [];

  switch (shortEvent) {
    case "received": {
      if (callerAgentId) {
        agentPatches.push({
          agentId: callerAgentId,
          patch: {
            fineStatus: "routing",
            routingCategory: null,
            routingReason: null,
            routingReceivedAt: nowMs,
          },
        });
      }
      break;
    }
    case "classified":
    case "selected": {
      if (callerAgentId) {
        const patch: Partial<AgentState> = { fineStatus: "routing" };
        if (payload.category) patch.routingCategory = payload.category;
        if (payload.reason) patch.routingReason = payload.reason;
        agentPatches.push({ agentId: callerAgentId, patch });
      }
      break;
    }
    case "started": {
      if (targetAgentId) {
        const patch: Partial<AgentState> = { fineStatus: "working" };
        if (payload.category) patch.routingCategory = payload.category;
        if (payload.reason) patch.routingReason = payload.reason;
        if (payload.targetModel) patch.model = payload.targetModel;
        agentPatches.push({ agentId: targetAgentId, patch });
      }
      // The frontdoor/caller agent has done its job once dispatch succeeds —
      // only reset it back to idle when it actually handed off to a
      // *different* agent. When caller === target (e.g. complex/unclear
      // stays on Default) the agent's own "working" state below is what
      // should stick, so don't stomp it back to idle here.
      if (callerAgentId && callerAgentId !== targetAgentId) {
        agentPatches.push({ agentId: callerAgentId, patch: { fineStatus: "idle" } });
      }
      break;
    }
    case "completed": {
      if (targetAgentId) {
        agentPatches.push({ agentId: targetAgentId, patch: { fineStatus: "done" } });
      }
      break;
    }
    case "failed": {
      if (targetAgentId) {
        agentPatches.push({ agentId: targetAgentId, patch: { fineStatus: "error" } });
      }
      break;
    }
    default: {
      const _exhaustive: never = shortEvent;
      void _exhaustive;
    }
  }

  return { logEntry, agentPatches };
};
