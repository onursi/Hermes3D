import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assistInstruction, createTask, noteFileName, prepareNote, prepareTask, readDocument, saveNote } from "@/lib/jarvis/assist";

afterEach(() => vi.unstubAllGlobals());
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-assist-"));

describe("Jarvis everyday helpers", () => {
  it("builds a safe note file name", () => {
    expect(noteFileName("Video: lokale KI / Hook?", new Date(2026, 9, 10, 9, 5))).toBe("Jarvis-Notiz 2026-10-10 0905 – Video lokale KI Hook.md");
    expect(noteFileName("../..", new Date(2026, 0, 2, 13, 40))).toBe("Jarvis-Notiz 2026-01-02 1340 – Notiz.md");
  });
  it("saves a confirmed note once, into the given inbox, without overwriting", () => {
    const inbox = temp(), now = new Date(2026, 9, 10, 9, 5);
    const first = prepareNote("Idee", "Hook mit der Stromrechnung");
    const saved = saveNote(first.pending.proof, inbox, now);
    expect(fs.readFileSync(path.join(inbox, saved.saved.file), "utf8")).toContain("Hook mit der Stromrechnung");
    expect(fs.readFileSync(path.join(inbox, saved.saved.file), "utf8").startsWith("---\nstatus: ungeprüft")).toBe(true);
    expect(() => saveNote(first.pending.proof, inbox, now)).toThrow("abgelaufen");
    const second = saveNote(prepareNote("Idee", "Zweite Fassung").pending.proof, inbox, now);
    expect(second.saved.file).not.toBe(saved.saved.file);
    expect(fs.readdirSync(inbox)).toHaveLength(2);
  });
  it("refuses empty notes, unknown proofs and a missing inbox", () => {
    expect(() => prepareNote("", "x")).toThrow("leer");
    expect(() => saveNote("nope", temp())).toThrow("abgelaufen");
    expect(() => saveNote(prepareNote("Titel", "Text").pending.proof, path.join(temp(), "fehlt"))).toThrow("nicht gefunden");
  });
  it("creates a task only with the proof and the same account", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "1", due: { string: "morgen 15 Uhr" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const prepared = prepareTask("token-a", "Zahnarzt anrufen", "morgen 15 Uhr");
    expect(prepared.pending.detail).toBe("Fällig: morgen 15 Uhr");
    await expect(createTask("token-b", prepared.pending.proof)).rejects.toThrow("abgelaufen");
    expect(fetchMock).not.toHaveBeenCalled();
    const created = await createTask("token-a", prepared.pending.proof);
    expect(created.created).toEqual({ title: "Zahnarzt anrufen", due: "morgen 15 Uhr" });
    expect(JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ content: "Zahnarzt anrufen", due_string: "morgen 15 Uhr", due_lang: "de" });
    await expect(createTask("token-a", prepared.pending.proof)).rejects.toThrow("abgelaufen");
  });
  it("rejects anything that is not a JPEG before calling Google", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GEMINI_API_KEY", "test");
    await expect(readDocument("not-an-image", "Was steht da?")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
  it("only mentions what is switched on", () => {
    expect(assistInstruction(false, false, false)).toBe("");
    expect(assistInstruction(true, false, false)).toContain("read_document");
    expect(assistInstruction(false, true, false)).not.toContain("read_document");
    expect(assistInstruction(false, false, true)).toContain("weder seinen Kalender noch seine E-Mails");
  });
});
