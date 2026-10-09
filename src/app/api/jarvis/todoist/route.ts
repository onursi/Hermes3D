import { NextResponse } from "next/server";
import { completeTask, prepareCompletion, taskSummary, todoistToken } from "@/lib/jarvis/todoistLive";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function GET() { return NextResponse.json({ connected: Boolean(todoistToken()) }, { headers }); }
export async function POST(req: Request) {
  try {
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== (req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host)) return NextResponse.json({ ok: false, error: "Ungültiger Ursprung." }, { status: 403, headers });
  } catch { return NextResponse.json({ ok: false, error: "Ungültiger Ursprung." }, { status: 403, headers }); }
  try {
    const raw = await req.text(); if (raw.length > 2048) throw new Error("Anfrage zu groß.");
    const body = JSON.parse(raw); const token = todoistToken(req);
    if (!token) throw new Error("Todoist ist nicht verbunden. Zugang in Hermes hinterlegen.");
    if (body.action === "summary" && ["today", "tomorrow"].includes(body.period)) {
      const zone = typeof body.timeZone === "string" && body.timeZone.length < 100 ? body.timeZone : "UTC";
      return NextResponse.json(await taskSummary(token, body.period, zone, new Date(), req.signal), { headers });
    }
    if (body.action === "prepare" && typeof body.taskId === "string") return NextResponse.json(await prepareCompletion(token, body.taskId, req.signal), { headers });
    if (body.action === "complete" && body.confirmed === true && typeof body.proof === "string") return NextResponse.json(await completeTask(token, body.proof, req.signal), { headers });
    throw new Error("Unbekannter Aufgabenauftrag.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Aufgabenabruf fehlgeschlagen.";
    const safe = /^(Todoist|Diese Aufgabe|Ungültige Aufgaben|Aufgabenfreigabe|Unbekannter Aufgaben|Anfrage zu groß)/.test(message);
    return NextResponse.json({ ok: false, error: safe ? message : "Aufgabenabruf fehlgeschlagen. Bitte erneut versuchen." }, { status: 400, headers });
  }
}
