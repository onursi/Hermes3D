import { NextResponse } from "next/server";
import { describeCamera, validateVisionImage, visionConfig } from "@/lib/jarvis/vision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function GET() { return NextResponse.json({ configured: Boolean(visionConfig().key), mode: "single-frame", automatic: false }, { headers }); }
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  try {
    if (!origin || new URL(origin).host !== (req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host)) return NextResponse.json({ error: "Ungültiger Ursprung." }, { status: 403, headers });
  } catch { return NextResponse.json({ error: "Ungültiger Ursprung." }, { status: 403, headers }); }
  try {
    if (Number(req.headers.get("content-length")) > 1_210_000) return NextResponse.json({ error: "Kamerabild zu groß." }, { status: 413, headers });
    const raw = await req.text();
    if (raw.length > 1_210_000) return NextResponse.json({ error: "Kamerabild zu groß." }, { status: 413, headers });
    const image = validateVisionImage(JSON.parse(raw).image);
    const description = await describeCamera(image, req.signal);
    return NextResponse.json({ description, mode: "single-frame" }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sichtprüfung fehlgeschlagen.";
    const expected = /^(Ein gültiges|Die Sichtprüfung|Google-|Eine Sichtprüfung|Bildanalyse meldet|Keine Bildbeschreibung)/.test(message);
    return NextResponse.json({ error: expected ? message : "Sichtprüfung fehlgeschlagen oder Zeitlimit erreicht." }, { status: expected ? 400 : 502, headers });
  }
}
