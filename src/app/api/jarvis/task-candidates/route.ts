import { NextResponse } from "next/server";
import path from "path";

/**
 * Tasks a conversation implied, offered one at a time.
 *
 * The tempting version writes them straight into Todoist. That is how a task
 * list fills with things nobody decided to do, and once it does you stop
 * trusting the list — which costs more than the typing ever saved.
 *
 * So this endpoint only ever *proposes*. Nothing is created here; creating is
 * a separate, explicit act per candidate. The model's job is to notice, and
 * Onur's job is to decide.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Four at most.
 *
 * A model asked for "the tasks in this text" will always find more, and a
 * list of eleven suggestions is not a decision aid — it is the same
 * overwhelm in a new place.
 */
const MAX_CANDIDATES = 4;

export async function POST(req: Request) {
  let body: { text?: string; question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "Ungültige Anfrage." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ ok: false, candidates: [], reason: "Kein Text übergeben." });
  }

  const prompt = [
    "Lies den folgenden Text und finde konkrete Aufgaben, die daraus folgen.",
    "",
    "Regeln:",
    `- Höchstens ${MAX_CANDIDATES}.`,
    "- Nur was wirklich zu tun ist. Erkenntnisse, Zusammenfassungen und",
    "  Feststellungen sind keine Aufgaben.",
    "- Jede Zeile beginnt mit einem Verb und ist ein einzelner Schritt.",
    "- Keine Nummerierung, keine Erklärung, eine Aufgabe pro Zeile.",
    "- Steht keine Aufgabe im Text, antworte mit genau: KEINE",
    "",
    "TEXT:",
    text,
  ].join("\n");

  try {
    const nodeRequire = eval("require") as NodeJS.Require;
    const { askHermes } = nodeRequire(
      path.join(process.cwd(), "server", "hermes-ws-client.js"),
    ) as { askHermes: (input: string) => Promise<string> };

    const reply = (await askHermes(prompt)).trim();

    if (/^Error:/i.test(reply)) {
      return NextResponse.json({ ok: false, candidates: [], reason: reply.slice(0, 400) });
    }

    // "KEINE" is a real answer and the most useful one when it is true. A
    // model that always finds something to do is not reading, it is obliging.
    if (/^keine\b/i.test(reply)) {
      return NextResponse.json({ ok: true, candidates: [], reason: "Keine Aufgabe erkennbar." });
    }

    const candidates = reply
      .split("\n")
      .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
      .filter((line) => line.length > 3 && line.length < 200)
      .slice(0, MAX_CANDIDATES);

    return NextResponse.json({ ok: true, candidates });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      candidates: [],
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
