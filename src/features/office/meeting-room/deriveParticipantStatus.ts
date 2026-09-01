import type { AgentState } from "@/features/agents/state/store";

/**
 * The Meeting Room's own participant status vocabulary — a calmer, coarser
 * read on the same real per-agent state already tracked in AgentState
 * (status/fineStatus/streamText/lastAssistantMessageAt). Not a new source of
 * truth: every value here is derived from fields the runtime event handlers
 * already populate from real gateway events, never fabricated for display.
 */
export type MeetingParticipantStatus =
  | "available"
  | "working"
  | "speaking"
  | "waiting_approval"
  | "done"
  | "error";

/** How long a completed reply keeps showing as "done" before fading back to "available". */
const DONE_WINDOW_MS = 20_000;

/**
 * Derive a participant's Meeting Room status from their real AgentState.
 *
 * - error / waiting_approval take priority over anything else — the human
 *   needs to see those regardless of what else is happening. Approval is
 *   read from `awaitingUserInput`, the field execApprovalRuntimeCoordinator
 *   actually populates from real pending exec approvals — fineStatus is
 *   declared to support a "waiting_approval" value but no runtime code ever
 *   assigns it, so checking fineStatus here left the badge (and the Meeting
 *   Room's Human-Approval banner) unable to ever show a real pending
 *   approval (Codex review finding, P2, 2026-09-01).
 * - while a run is active, "speaking" means the assistant reply is actively
 *   streaming out right now (non-empty streamText); anything else active
 *   (routing, a tool call, thinking) reads as "working".
 * - routing.received/classified/selected/started events (see
 *   runtimeRoutingEventWorkflow.ts) update ONLY fineStatus ("routing" /
 *   "working"), never `status` itself — the caller being classified, or the
 *   target having just been dispatched to, can sit with status still "idle"
 *   until its own chat.* events flip status to "running". Treating `status`
 *   as the sole active-work signal left those agents reading as "available"
 *   while they were, in fact, mid-routing or actively delegated work
 *   (Codex review finding, P2, 2026-09-01) — fineStatus is checked the same
 *   way here regardless of `status`.
 * - once idle, a reply that finished in the last DONE_WINDOW_MS still shows
 *   as "done" so the room doesn't snap straight back to "available" the
 *   instant a turn completes — bounded strictly by lastAssistantMessageAt,
 *   not by the persisted fineStatus flag alone. fineStatus stays "done"
 *   until the NEXT routing event touches this agent, which can be minutes
 *   or never for an idle participant — treating it as sufficient on its own
 *   left the badge stuck on "Fertig" indefinitely instead of expiring back
 *   to "available" (Codex review finding, P2, 2026-09-01).
 */
export const deriveMeetingParticipantStatus = (
  agent: AgentState,
  nowMs: number = Date.now()
): MeetingParticipantStatus => {
  if (agent.status === "error" || agent.fineStatus === "error") return "error";
  if (agent.awaitingUserInput) return "waiting_approval";

  const activeFineStatus =
    agent.fineStatus === "routing" || agent.fineStatus === "working" || agent.fineStatus === "tool_call";

  if (agent.status === "running" || activeFineStatus) {
    const isStreaming = typeof agent.streamText === "string" && agent.streamText.trim().length > 0;
    return isStreaming ? "speaking" : "working";
  }

  const finishedRecently =
    typeof agent.lastAssistantMessageAt === "number" &&
    nowMs - agent.lastAssistantMessageAt >= 0 &&
    nowMs - agent.lastAssistantMessageAt < DONE_WINDOW_MS;
  if (finishedRecently) return "done";

  return "available";
};

export const MEETING_STATUS_LABEL: Record<MeetingParticipantStatus, string> = {
  available: "Verfügbar",
  working: "Arbeitet",
  speaking: "Spricht",
  waiting_approval: "Wartet auf Freigabe",
  done: "Fertig",
  error: "Fehler",
};

/** True for the Hermes3D default/orchestrator agent — the Meeting Room's moderator. */
export const isModeratorAgent = (agent: Pick<AgentState, "agentId">): boolean =>
  agent.agentId === "default";
