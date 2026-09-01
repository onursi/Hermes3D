import { createElement, useEffect, useRef } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentStoreProvider, useAgentStore } from "@/features/agents/state/store";
import { MeetingRoomImmersiveScreen } from "@/features/office/screens/MeetingRoomImmersiveScreen";

/**
 * Seeds one agent into the real agent store exactly once, then renders the
 * real Meeting Room screen on top of it — used to reproduce the exact
 * Codex review scenario (P2, 2026-09-01): a "done" status that must expire
 * on its own, purely from time passing while the screen stays open with no
 * other store update in between.
 */
function Harness() {
  const { hydrateAgents, dispatch } = useAgentStore();
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    hydrateAgents([{ agentId: "default", name: "Default", sessionKey: "agent:default:main" }]);
    dispatch({
      type: "updateAgent",
      agentId: "default",
      patch: { fineStatus: "done", lastAssistantMessageAt: Date.now() - 15_000 },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createElement(MeetingRoomImmersiveScreen, { onClose: () => {} });
}

describe("MeetingRoomImmersiveScreen — live clock", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("expires a 'done' badge back to 'available' on its own while mounted, with no other store update", async () => {
    vi.useFakeTimers();

    render(createElement(AgentStoreProvider, null, createElement(Harness)));

    // Let the seeding effect run, then confirm we start inside the 20s
    // done-window.
    await act(async () => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByText("Fertig")).toBeInTheDocument();

    // Advance well past the window — nothing else touches the store here.
    // Before the P2 fix, Date.now() alone never scheduled a re-render, so
    // this assertion would still see the stale "Fertig" badge.
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.queryByText("Fertig")).not.toBeInTheDocument();
    expect(screen.getByText("Verfügbar")).toBeInTheDocument();
  });
});
