import { describe, expect, it } from "vitest";

import type { AgentState } from "@/features/agents/state/store";
import {
  deriveMeetingParticipantStatus,
  isModeratorAgent,
  MEETING_STATUS_LABEL,
} from "@/features/office/meeting-room/deriveParticipantStatus";

const baseAgent: AgentState = {
  agentId: "router-claude-review",
  name: "Claude",
  sessionKey: "agent:router-claude-review:main",
  status: "idle",
  sessionCreated: true,
  awaitingUserInput: false,
  hasUnseenActivity: false,
  outputLines: [],
  lastResult: null,
  lastDiff: null,
  runId: null,
  runStartedAt: null,
  streamText: null,
  thinkingTrace: null,
  latestOverride: null,
  latestOverrideKind: null,
  lastAssistantMessageAt: null,
  lastActivityAt: null,
  latestPreview: null,
  lastUserMessage: null,
  draft: "",
  sessionSettingsSynced: true,
  historyLoadedAt: null,
  historyFetchLimit: null,
  historyFetchedCount: null,
  historyMaybeTruncated: false,
  toolCallingEnabled: true,
  showThinkingTraces: false,
};

describe("deriveMeetingParticipantStatus", () => {
  const now = 1_000_000;

  it("reports error whenever status or fineStatus says so, above anything else", () => {
    expect(deriveMeetingParticipantStatus({ ...baseAgent, status: "error" }, now)).toBe("error");
    expect(
      deriveMeetingParticipantStatus({ ...baseAgent, status: "running", fineStatus: "error" }, now)
    ).toBe("error");
  });

  it("reports waiting_approval from awaitingUserInput even while a run is active", () => {
    // fineStatus is declared to support "waiting_approval" but no runtime
    // code ever assigns it — real pending approvals are recorded on
    // awaitingUserInput by execApprovalRuntimeCoordinator.ts (Codex review
    // finding, P2, 2026-09-01).
    expect(
      deriveMeetingParticipantStatus({ ...baseAgent, status: "running", awaitingUserInput: true }, now)
    ).toBe("waiting_approval");
  });

  it("does not report waiting_approval from a fineStatus value that runtime code never actually assigns", () => {
    expect(
      deriveMeetingParticipantStatus(
        { ...baseAgent, status: "idle", fineStatus: "waiting_approval", awaitingUserInput: false },
        now
      )
    ).toBe("available");
  });

  it("reports speaking only while running with non-empty streamText", () => {
    expect(
      deriveMeetingParticipantStatus({ ...baseAgent, status: "running", streamText: "Hello there" }, now)
    ).toBe("speaking");
    expect(
      deriveMeetingParticipantStatus({ ...baseAgent, status: "running", streamText: "   " }, now)
    ).toBe("working");
    expect(deriveMeetingParticipantStatus({ ...baseAgent, status: "running", streamText: null }, now)).toBe(
      "working"
    );
  });

  it("reports done for a reply that just finished, then falls back to available", () => {
    expect(
      deriveMeetingParticipantStatus(
        { ...baseAgent, status: "idle", lastAssistantMessageAt: now - 5_000 },
        now
      )
    ).toBe("done");
    expect(
      deriveMeetingParticipantStatus(
        { ...baseAgent, status: "idle", lastAssistantMessageAt: now - 60_000 },
        now
      )
    ).toBe("available");
  });

  it("does not stay 'done' forever just because fineStatus says so — it still expires with lastAssistantMessageAt", () => {
    // fineStatus stays "done" until the NEXT routing event touches this
    // agent, which can be minutes or never for an idle participant — it
    // must not keep the badge on "Fertig" indefinitely on its own (Codex
    // review finding, P2, 2026-09-01).
    expect(
      deriveMeetingParticipantStatus({ ...baseAgent, status: "idle", fineStatus: "done" }, now)
    ).toBe("available");
    expect(
      deriveMeetingParticipantStatus(
        { ...baseAgent, status: "idle", fineStatus: "done", lastAssistantMessageAt: now - 5_000 },
        now
      )
    ).toBe("done");
    expect(
      deriveMeetingParticipantStatus(
        { ...baseAgent, status: "idle", fineStatus: "done", lastAssistantMessageAt: now - 60_000 },
        now
      )
    ).toBe("available");
  });

  it("reports working while fineStatus is routing/working/tool_call even though status is still idle", () => {
    // routing.received/classified/selected/started patch ONLY fineStatus —
    // status stays whatever it already was (often still "idle") until the
    // target's own chat.* events flip it to "running". Missing this left
    // mid-routing / just-dispatched agents reading as "available" (Codex
    // review finding, P2, 2026-09-01).
    expect(deriveMeetingParticipantStatus({ ...baseAgent, status: "idle", fineStatus: "routing" }, now)).toBe(
      "working"
    );
    expect(deriveMeetingParticipantStatus({ ...baseAgent, status: "idle", fineStatus: "working" }, now)).toBe(
      "working"
    );
    expect(
      deriveMeetingParticipantStatus({ ...baseAgent, status: "idle", fineStatus: "tool_call" }, now)
    ).toBe("working");
  });

  it("reports speaking when fineStatus is active and streamText is already flowing", () => {
    expect(
      deriveMeetingParticipantStatus(
        { ...baseAgent, status: "idle", fineStatus: "working", streamText: "Hello there" },
        now
      )
    ).toBe("speaking");
  });

  it("falls back to available for a plain idle agent with no recent activity", () => {
    expect(deriveMeetingParticipantStatus({ ...baseAgent, status: "idle" }, now)).toBe("available");
  });

  it("has a label for every possible status", () => {
    const statuses = ["available", "working", "speaking", "waiting_approval", "done", "error"] as const;
    for (const status of statuses) {
      expect(MEETING_STATUS_LABEL[status]).toBeTruthy();
    }
  });
});

describe("isModeratorAgent", () => {
  it("is true only for the agent literally named 'default'", () => {
    expect(isModeratorAgent({ agentId: "default" })).toBe(true);
    expect(isModeratorAgent({ agentId: "router-claude-review" })).toBe(false);
  });
});
