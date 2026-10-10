import { NextResponse } from "next/server";
import { createTask, prepareNote, prepareTask, readDocument, saveNote } from "@/lib/jarvis/assist";
import { todoistToken } from "@/lib/jarvis/todoistLive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function POST(req: Request) {
  try {
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== (req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host)) return NextResponse.json({ ok: false, error: "Ungültiger Ursprung." }, { status: 403, headers });
  } catch { return NextResponse.json({ ok: false, error: "Ungültiger Ursprung." }, { status: 403, headers }); }
  try {
    if (Number(req.headers.get("content-length")) > 1_215_000) return NextResponse.json({ ok: false, error: "Anfrage zu groß." }, { status: 413, headers });
    const raw = await req.text();
    if (raw.length > 1_215_000) return NextResponse.json({ ok: false, error: "Anfrage zu groß." }, { status: 413, headers });
    const body = JSON.parse(raw);
    if (body.action === "document") return NextResponse.json(await readDocument(body.image, body.question, req.signal), { headers });
    if (raw.length > 12_000) return NextResponse.json({ ok: false, error: "Anfrage zu groß." }, { status: 413, headers });
    if (body.action === "note-prepare") return NextResponse.json(prepareNote(body.title, body.text), { headers });
    if (body.action === "note-save" && body.confirmed === true) return NextResponse.json(saveNote(body.proof), { headers });
    if (body.action === "task-prepare" || body.action === "task-create") {
      const token = todoistToken(req);
      if (!token) throw new Error("Todoist ist nicht verbunden.");
      if (body.action === "task-prepare") return NextResponse.json(prepareTask(token, body.content, body.due), { headers });
      if (body.confirmed === true) return NextResponse.json(await createTask(token, body.proof, req.signal), { headers });
    }
    throw new Error("Unbekannter Auftrag.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const safe = /^(Google-|Lesen |Ein gültiges|Die Sichtprüfung|Notiz|Aufgabe|Todoist|Unbekannter Auftrag)/.test(message);
    return NextResponse.json({ ok: false, error: safe ? message : "Auftrag fehlgeschlagen. Bitte erneut versuchen." }, { status: 400, headers });
  }
}
