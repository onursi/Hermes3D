import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/perspectives/providers";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  return NextResponse.json({ providers: await getCatalog(new URL(req.url).searchParams.get("refresh") === "1") }, { headers: { "Cache-Control": "no-store" } });
}
