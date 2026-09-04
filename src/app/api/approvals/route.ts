import { NextResponse } from "next/server";
import path from "path";

/**
 * What is waiting for Onur to decide.
 *
 * The room has a waiting station that has always been furniture. This is the
 * data that gives it a job: an agent needs a decision, something is about to
 * be sent, a file is about to change, a paid model wants to run.
 *
 * Approvals live in Hermes, one queue per session, so this asks the client to
 * walk the active sessions and collect them. Nothing here invents a queue of
 * its own — if Hermes has nothing pending, the answer is an empty list and
 * the station in the room stays dark.
 */

export const dynamic = "force-dynamic";

type ApprovalClient = {
  listPendingApprovals: () => Promise<Record<string, unknown>[]>;
  respondToApproval: (
    sessionId: string,
    requestId: string,
    choice: string,
  ) => Promise<unknown>;
};

function loadClient(): ApprovalClient {
  // eval so the bundler leaves it alone — the module lives in server/ and is
  // shared with the gateway adapter, which is plain Node and not bundled.
  const nodeRequire = eval("require") as NodeJS.Require;
  return nodeRequire(
    path.join(process.cwd(), "server", "hermes-ws-client.js"),
  ) as ApprovalClient;
}

export async function GET() {
  try {
    const approvals = await loadClient().listPendingApprovals();
    return NextResponse.json({ ok: true, approvals, count: approvals.length });
  } catch (error) {
    // Reported as a failure rather than as an empty list. "Nothing is waiting"
    // and "I could not ask" must never look the same on a station whose whole
    // job is to be trusted when it is dark.
    return NextResponse.json({
      ok: false,
      approvals: [],
      count: 0,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function POST(req: Request) {
  let body: { sessionId?: string; requestId?: string; choice?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "Ungültige Anfrage." }, { status: 400 });
  }

  const { sessionId, requestId, choice } = body;
  if (!sessionId || !requestId || !choice) {
    return NextResponse.json({
      ok: false,
      reason: "sessionId, requestId und choice sind erforderlich.",
    });
  }

  try {
    const result = await loadClient().respondToApproval(sessionId, requestId, choice);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
