import { NextResponse } from "next/server";
import { createLiveToken } from "@/lib/jarvis/live";
import { visionConfig } from "@/lib/jarvis/vision";
import { issueSpeechGrant, speechStatus } from "@/lib/jarvis/elevenVoice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
let busy = false, last = 0;
export async function GET(req?: Request) { return NextResponse.json({ configured: Boolean(visionConfig().key), mode: "live-audio-video", provider: "Google Gemini Live", elevenlabs: await speechStatus(req?.signal, Boolean(req && new URL(req.url).searchParams.get("refresh"))) }, { headers }); }
export async function POST(req: Request) {
  try {
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== (req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host)) return NextResponse.json({ error: "Ungültiger Ursprung." }, { status: 403, headers });
  } catch { return NextResponse.json({ error: "Ungültiger Ursprung." }, { status: 403, headers }); }
  if (busy || Date.now() - last < 3000) return NextResponse.json({ error: "Verbindung wird vorbereitet. Kurz warten." }, { status: 429, headers });
  try {
    const raw = await req.text(); if (raw.length > 1024) return NextResponse.json({ error: "Anfrage zu groß." }, { status: 413, headers });
    const data = JSON.parse(raw);
    if (data.consent !== true) return NextResponse.json({ error: "Mikrofon-/Kameraübertragung zuerst freigeben." }, { status: 400, headers });
    const voice = typeof data.voice === "string" ? data.voice : "Charon";
    busy = true; last = Date.now();
    const external = voice === "ElevenLabs";
    if (external) { const status = await speechStatus(req.signal, true); if (!status.ready) return NextResponse.json({ error: status.error }, { status: 402, headers }); }
    const live = await createLiveToken(external ? "Charon" : voice, req.signal, data.todoist === true);
    return NextResponse.json({ ...live, ...(external ? { speech: { provider: "ElevenLabs", session: issueSpeechGrant(), sampleRate: 24000 } } : {}) }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const expected = /^(Unbekannte Stimme|Google-Live|Kein gültiger)/.test(message);
    return NextResponse.json({ error: expected ? message : "Live-Verbindung konnte nicht vorbereitet werden." }, { status: expected ? 400 : 502, headers });
  } finally { busy = false; }
}
