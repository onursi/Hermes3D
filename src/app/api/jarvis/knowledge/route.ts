import { NextResponse } from "next/server";
import { GET as graph } from "@/app/api/obsidian-graph/route";
import { knowledgeNodeId, resetKnowledge, scanState, searchKnowledge } from "@/lib/jarvis/knowledge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("view") === "graph") {
    const response = await graph(req); const data = await response.json();
    if (!response.ok || !Array.isArray(data.nodes) || !Array.isArray(data.links)) return NextResponse.json({ error: "Wissensnetz nicht verfügbar." }, { status: 503, headers });
    // This filming surface never ships note names, paths or excerpts to the client.
    const nodes = data.nodes.map((n: { id: string; x: number; y: number; z: number; color: string; group: string; val: number }) => ({ id: knowledgeNodeId(n.id), name: "", folder: "", excerpt: "", wordCount: 0, group: n.group, color: n.color, x: n.x, y: n.y, z: n.z, val: n.val }));
    const links = data.links.map((l: { source: string; target: string }) => ({ source: knowledgeNodeId(l.source), target: knowledgeNodeId(l.target) }));
    return NextResponse.json({ nodes, links }, { headers });
  }
  return NextResponse.json(scanState(), { headers });
}
export async function POST(req: Request) {
  try {
    const origin = req.headers.get("origin"), host = req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host;
    if (!origin || new URL(origin).host !== host) return NextResponse.json({ error: "Ungültiger Ursprung." }, { status: 403, headers });
  } catch { return NextResponse.json({ error: "Ungültiger Ursprung." }, { status: 403, headers }); }
  try {
    const raw = await req.text(); if (raw.length > 2048) return NextResponse.json({ error: "Anfrage zu groß." }, { status: 413, headers });
    const body = JSON.parse(raw);
    if (body.action === "reset") { resetKnowledge(body.ticket); return NextResponse.json({ ok: true }, { headers }); }
    if (body.consent !== true) return NextResponse.json({ error: "Wissensübertragung zuerst freigeben." }, { status: 400, headers });
    return NextResponse.json(searchKnowledge(body.ticket, body.question), { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wissenssuche fehlgeschlagen.";
    return NextResponse.json({ ok: false, error: /^(Wissens|Drehquellen)/.test(message) ? message : "Wissenssuche fehlgeschlagen." }, { status: 400, headers });
  }
}
