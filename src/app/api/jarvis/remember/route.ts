import os from "node:os";
import path from "node:path";

import { NextResponse } from "next/server";

import {
  commitMemoryProposal,
  createMemoryProposal,
  forgetProposal,
  rememberProposal,
  type MemoryAction,
  type MemoryAttachment,
  type MemorySource,
} from "@/lib/jarvis/memoryGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const vault = () => process.env.OBSIDIAN_VAULT_PATH?.trim() || path.join(os.homedir(), "Desktop", "Life OS");

function foreignOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") return true;
  if (!origin) return false;
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const allowed = new Set([url.origin]);
  if (host) allowed.add(`${protocol}://${host}`);
  return !allowed.has(origin);
}

export async function POST(request: Request) {
  if (foreignOrigin(request)) return NextResponse.json({ ok: false, reason: "Fremder Ursprung." }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 300_000) throw new Error("Memory-Gate-Anfrage ist zu groß.");
    const body = JSON.parse(raw) as Record<string, unknown>;
    const mode = body.mode === "commit" ? "commit" : "propose";
    if (mode === "propose") {
      const proposal = await createMemoryProposal(vault(), {
        question: typeof body.question === "string" ? body.question : "",
        answer: typeof body.answer === "string" ? body.answer : typeof body.text === "string" ? body.text : "",
        sources: Array.isArray(body.sources) ? body.sources as MemorySource[] : [],
        attachments: Array.isArray(body.attachments) ? body.attachments as MemoryAttachment[] : [],
      });
      rememberProposal(proposal);
      const { question: _question, answer: _answer, candidateDigests: _digests, ...publicProposal } = proposal;
      return NextResponse.json({ ok: true, proposal: publicProposal });
    }
    const result = await commitMemoryProposal(vault(), {
      proposalId: typeof body.proposalId === "string" ? body.proposalId : "",
      action: typeof body.action === "string" ? body.action as MemoryAction : undefined,
      targetId: typeof body.targetId === "string" ? body.targetId : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 400;
    return NextResponse.json({ ok: false, reason: error instanceof Error ? error.message : "Memory Gate fehlgeschlagen." }, { status });
  }
}

export async function DELETE(request: Request) {
  if (foreignOrigin(request)) return NextResponse.json({ ok: false, reason: "Fremder Ursprung." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (id) forgetProposal(id);
  return NextResponse.json({ ok: true });
}
