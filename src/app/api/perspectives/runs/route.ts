import { NextResponse } from "next/server";
import { validateSettings } from "@/features/perspectives/model";
import { getCatalog } from "@/lib/perspectives/providers";
import { sameOrigin, startRun } from "@/lib/perspectives/runs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Ungültiger Ursprung." }, { status: 403 });
  try {
    const text = await req.text();
    if (text.length > 30_000) throw new Error("Das Briefing ist zu lang.");
    const body = JSON.parse(text);
    if (typeof body.mission !== "string" || !body.mission.trim() || body.mission.length > 3000) throw new Error("Eine Frage mit höchstens 3000 Zeichen eingeben.");
    if (typeof body.context !== "string" || body.context.length > 12_000) throw new Error("Kontext darf höchstens 12000 Zeichen haben.");
    const settings = validateSettings(body.settings, await getCatalog());
    return NextResponse.json({ run: startRun(body.mission.trim(), body.context.trim(), settings) }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof SyntaxError ? "Ungültige Anfrage." : error instanceof Error ? error.message : "Ratslauf konnte nicht gestartet werden." }, { status: 400 }); }
}
