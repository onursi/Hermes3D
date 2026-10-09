import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PerspectivesPanel } from "@/features/perspectives/PerspectivesPanel";
import { DRAFT_KEY, readDraft } from "@/features/perspectives/draft";

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("council draft recovery", () => {
  it("handles corrupt, invalid and blocked storage", () => {
    for (const value of ["{", "null", "[]", '{"mission":3,"context":""}']) expect(readDraft({ getItem: () => value })).toBeNull();
    expect(readDraft({ getItem: () => { throw new Error("blocked"); } })).toBeNull();
  });
  it("honors form limits when restoring stored input", () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ mission: "a".repeat(4000), context: "b".repeat(13000) }));
    expect(readDraft(sessionStorage)?.mission).toHaveLength(3000);
    expect(readDraft(sessionStorage)?.context).toHaveLength(12000);
  });
  it("restores question and context on close/reopen without starting a council", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ providers: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const first = render(createElement(PerspectivesPanel));
    fireEvent.change(screen.getByLabelText("Welche Entscheidung möchtest du prüfen?"), { target: { value: "Soll ich einen kurzen Prototyp bauen?" } });
    fireEvent.change(screen.getByLabelText("Zusätzlicher Kontext"), { target: { value: "Nur zwei Stunden Zeit." } });
    await waitFor(() => expect(readDraft(sessionStorage)?.mission).toContain("Prototyp"));
    first.unmount(); render(createElement(PerspectivesPanel));
    await waitFor(() => expect(screen.getByLabelText("Welche Entscheidung möchtest du prüfen?")).toHaveValue("Soll ich einen kurzen Prototyp bauen?"));
    expect(screen.getByLabelText("Zusätzlicher Kontext")).toHaveValue("Nur zwei Stunden Zeit.");
    expect(fetchMock.mock.calls.every((call) => !call[1]?.method || call[1].method === "GET")).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/perspectives/models", { cache: "no-store" });
  });
  it("does not overwrite a new draft with a previous completed run", async () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ mission: "Neue Frage", context: "Neuer Kontext" }));
    localStorage.setItem("hermes-perspectives-run-v1", "old-run");
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("/runs/") ? {
      run: { id: "old-run", mission: "Alte Frage", state: "done", opinions: [], reviews: [], moderation: { role: "moderator", name: "Hermes", model: "test", state: "done" } },
    } : { providers: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock); render(createElement(PerspectivesPanel));
    await screen.findByText("Ergebnis deines Rats");
    expect(screen.getByLabelText("Welche Entscheidung möchtest du prüfen?")).toHaveValue("Neue Frage");
    expect(readDraft(sessionStorage)?.context).toBe("Neuer Kontext");
  });
});
