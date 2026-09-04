import { NextResponse } from "next/server";

import { retrieveFromVault } from "@/lib/jarvis/retrieve";

/**
 * What the vault has to say about a question, as evidence rather than prose.
 *
 * The ranking itself lives in `@/lib/jarvis/retrieve` because the answering
 * endpoint needs exactly the same one. Two copies of a scoring function drift
 * apart within a week, and then the answer cites notes the search never
 * showed.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") ?? 6)));
  return NextResponse.json(retrieveFromVault(query, limit));
}
