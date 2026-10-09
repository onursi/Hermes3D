import { NextResponse } from "next/server";
import { reserveSpeech, speechStatus, streamSelectedVoice } from "@/lib/jarvis/elevenVoice";
import { expressiveText, readExpression } from "@/lib/jarvis/expression";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function POST(req: Request) {
  try {
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== (req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host)) return NextResponse.json({ error: "Ungültiger Ursprung." }, { status: 403, headers });
  } catch { return NextResponse.json({ error: "Ungültiger Ursprung." }, { status: 403, headers }); }
  let release: (() => void) | undefined;
  try {
    const raw = await req.text();
    if (raw.length > 4000) return NextResponse.json({ error: "Sprachanfrage zu groß." }, { status: 413, headers });
    const data = JSON.parse(raw);
    if (data.consent !== true || typeof data.text !== "string" || !data.text.trim() || data.text.length > 600 || (data.previousText != null && (typeof data.previousText !== "string" || data.previousText.length > 600))) return NextResponse.json({ error: "Ungültige Sprachanfrage oder fehlende Freigabe." }, { status: 400, headers });
    const expression = readExpression(data.expression);
    const characters = expressiveText(data.text, expression).length;
    const selected = reserveSpeech(data.session, characters); release = selected.release;
    const status = await speechStatus(req.signal);
    if (!status.ready || status.remainingCredits! < Math.ceil(characters * .5)) return NextResponse.json({ error: status.error || "ElevenLabs-Kontingent reicht nicht für diese Antwort." }, { status: 402, headers });
    const audio = await streamSelectedVoice(selected.apiKey, selected.voiceId, data.text.trim(), data.previousText || "", req.signal, expression);
    const reader = audio.getReader(), done = release;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) { try { const part = await reader.read(); if (part.done) { done(); controller.close(); } else controller.enqueue(part.value); } catch (error) { done(); controller.error(error); } },
      async cancel(reason) { done(); await reader.cancel(reason); },
    });
    release = undefined;
    return new Response(body, { headers: { ...headers, "Content-Type": "audio/pcm", "X-Audio-Sample-Rate": "24000" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const expected = /^(Sprachsitzung|Sprachlimit|ElevenLabs|Ungültiger Sprachausdruck)/.test(message);
    return NextResponse.json({ error: expected ? message : "Die ausgewählte ElevenLabs-Stimme konnte nicht antworten. Kontingent und Zugang prüfen." }, { status: expected ? 400 : 502, headers });
  } finally { release?.(); }
}
