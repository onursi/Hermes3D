import { NextResponse } from "next/server";
import { cancelRun, findRun, sameOrigin } from "@/lib/perspectives/runs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_req: Request, context: Context) {
  const run = findRun((await context.params).id);
  return NextResponse.json(run ? { run } : { error: "Ratslauf nicht mehr verfügbar. Ergebnisse bleiben eine Stunde im Arbeitsspeicher." }, { status: run ? 200 : 404, headers: { "Cache-Control": "no-store" } });
}
export async function DELETE(req: Request, context: Context) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Ungültiger Ursprung." }, { status: 403 });
  const run = cancelRun((await context.params).id);
  return NextResponse.json(run ? { run } : { error: "Ratslauf nicht gefunden." }, { status: run ? 200 : 404 });
}
