import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
let root = "";
beforeEach(() => {
  vi.resetModules(); root = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-knowledge-"));
  fs.writeFileSync(path.join(root, "note.md"), "## Film\nMein Rechner soll lokale KI-Bilder erstellen.\n## Privat\nPRIVATE-SECRET-123\n");
  fs.writeFileSync(path.join(root, "config.json"), JSON.stringify({ sources: [{ note: "note.md", heading: "## Film", title: "Rechner" }] }));
  vi.stubEnv("OBSIDIAN_VAULT_PATH", root); vi.stubEnv("JARVIS_KNOWLEDGE_CONFIG", path.join(root, "config.json"));
});
afterEach(() => {
  vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks();
  if (path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(root, { recursive: true, force: true });
});
describe("Jarvis scoped knowledge", () => {
  it("reads only an exact approved section and lights its true graph id", async () => {
    const k = await import("@/lib/jarvis/knowledge");
    const ticket = k.issueKnowledgeGrant(); const result = k.searchKnowledge(ticket, "Rechner Bilder");
    expect(result.sources).toHaveLength(1); expect(result.sources[0].excerpt).toContain("KI-Bilder");
    expect(JSON.stringify(result)).not.toContain("PRIVATE-SECRET"); expect(JSON.stringify(result)).not.toContain("note.md");
    expect(k.scanState()).toMatchObject({ phase: "found", ids: [k.knowledgeNodeId("note.md")], count: 1 });
    k.resetKnowledge(ticket); expect(k.scanState().phase).toBe("idle");
  });
  it("does not infer an answer or invent a source on a miss", async () => {
    const k = await import("@/lib/jarvis/knowledge"); const ticket = k.issueKnowledgeGrant();
    expect(k.searchKnowledge(ticket, "Quantenbananen").sources).toEqual([]); expect(k.scanState().phase).toBe("missing");
  });
  it("refuses traversal, an unissued ticket, expired sessions and oversized queries", async () => {
    const k = await import("@/lib/jarvis/knowledge");
    expect(() => k.searchKnowledge("unknown", "Rechner")).toThrow("Wissenssitzung");
    const ticket = k.issueKnowledgeGrant(); expect(() => k.searchKnowledge(ticket, "x".repeat(501))).toThrow("ungültig");
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 11 * 60_000); expect(() => k.searchKnowledge(ticket, "Rechner")).toThrow("abgelaufen"); vi.useRealTimers();
    fs.writeFileSync(path.join(root, "config.json"), JSON.stringify({ sources: [{ note: "../outside.md", heading: "## Film", title: "Rechner" }] }));
    expect(k.knowledgeStatus().configured).toBe(false);
  });
});
