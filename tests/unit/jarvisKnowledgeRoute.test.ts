import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/api/obsidian-graph/route", () => ({ GET: vi.fn(async () => new Response(JSON.stringify({ vaultPath: "PRIVATE-PATH", nodes: [{ id: "Private/Secret.md", name: "SECRET-NAME", excerpt: "SECRET-TEXT", folder: "PRIVATE-FOLDER", x: 1, y: 2, z: 3, color: "#fff", group: "profile", val: 1 }], links: [{ source: "Private/Secret.md", target: "Private/Secret.md" }] }))) }));
vi.mock("@/lib/jarvis/knowledge", () => ({ knowledgeNodeId: () => "opaque-node", knowledgeStatus: () => ({ configured: true, count: 3 }), scanState: () => ({ phase: "found", ids: ["opaque-node"], count: 1 }), resetKnowledge: vi.fn(), searchKnowledge: vi.fn(() => ({ ok: true, sources: [] })) }));
import { GET, POST } from "@/app/api/jarvis/knowledge/route";
import { searchKnowledge } from "@/lib/jarvis/knowledge";
describe("Jarvis filming boundary", () => {
  it("reports the real number of matching excerpts rather than configured sources", async () => {
    const response = await GET(new Request("http://localhost/api/jarvis/knowledge"));
    expect((await response.json()).count).toBe(1);
  });
  it("does not ship filenames, note titles, excerpts or vault location", async () => {
    const response = await GET(new Request("http://localhost/api/jarvis/knowledge?view=graph"));
    const text = await response.text(); expect(text).not.toMatch(/SECRET|PRIVATE|Secret\.md/);
    expect(JSON.parse(text).nodes[0].id).toBe("opaque-node");
  });
  it("rejects cross-origin searches and missing consent before reading notes", async () => {
    const r = await POST(new Request("http://localhost/api/jarvis/knowledge", { method: "POST", headers: { origin: "https://other.invalid" }, body: JSON.stringify({ consent: true }) }));
    expect(r.status).toBe(403);
    const missing = await POST(new Request("http://localhost/api/jarvis/knowledge", { method: "POST", headers: { origin: "http://localhost" }, body: JSON.stringify({ consent: false }) }));
    expect(missing.status).toBe(400); expect(searchKnowledge).not.toHaveBeenCalled();
  });
});
