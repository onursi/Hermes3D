import { NextResponse } from "next/server";
import path from "path";

import { retrieveFromVault, type RetrievalHit } from "@/lib/jarvis/retrieve";

/**
 * Ask the vault a question and get an answer, with its sources.
 *
 * Two halves that have to stay honest about each other. Retrieval decides
 * which notes are relevant; the model may only speak about those. Everything
 * here exists to keep the second half from inventing what the first half did
 * not find — because an assistant that answers confidently from nothing is
 * worse than one that says it does not know.
 *
 * So: the sources are returned alongside the answer, always, and the prompt
 * tells the model to say when the notes do not cover the question. The answer
 * without its sources would be a claim; with them it is a claim you can check.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** How many notes go into the prompt. Six is enough context, little noise. */
const SOURCE_COUNT = 6;

/**
 * How much of each note the model sees.
 *
 * Excerpts, not whole notes. A note can run to thousands of words, and six of
 * those would bury the question. The excerpt is already centred on the words
 * that matched, which is the part that answers.
 */
const EXCERPT_LIMIT = 1200;

function buildPrompt(question: string, hits: RetrievalHit[]) {
  const sources = hits
    .map((hit, index) => {
      const excerpt = hit.excerpt.slice(0, EXCERPT_LIMIT);
      return `[${index + 1}] ${hit.title}  (${hit.folder})\n${excerpt}`;
    })
    .join("\n\n");

  return [
    "Du bist Jarvis, der Assistent für Onurs Obsidian-Vault (Life OS).",
    "Beantworte die Frage ausschließlich aus den folgenden Notizen.",
    "",
    "Regeln:",
    "- Belege jede Aussage mit der Quellennummer, z. B. [2].",
    "- Steht die Antwort nicht in den Notizen, sage das klar und rate nicht.",
    "- Antworte auf Deutsch, kurz und konkret.",
    "",
    "NOTIZEN:",
    sources,
    "",
    `FRAGE: ${question}`,
  ].join("\n");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const question = (url.searchParams.get("q") ?? "").trim();

  if (!question) {
    return NextResponse.json({ ok: false, reason: "Keine Frage übergeben." });
  }

  const retrieval = retrieveFromVault(question, SOURCE_COUNT);

  // Nothing found is an answer, and a cheap one: there is no point paying a
  // model to say "I don't know" about notes we already know do not exist.
  if (!retrieval.ok || retrieval.results.length === 0) {
    return NextResponse.json({
      ok: false,
      question,
      answer: null,
      sources: [],
      reason: retrieval.reason ?? "Nichts im Vault gefunden, das dazu passt.",
    });
  }

  let askHermes: (text: string, options?: Record<string, unknown>) => Promise<string>;
  try {
    // Loaded at call time and through createRequire, for two separate reasons.
    //
    // At call time, because the client opens a socket to Hermes and a build —
    // or a request that never asks anything — has no business doing that.
    //
    // Through createRequire, because the bundler rewrites a plain `require`
    // and then cannot find a file that lives outside the app tree. The module
    // is shared with the gateway adapter, which is plain Node and not bundled
    // at all, so it stays in server/ and is reached at runtime instead.
    // `eval("require")` because the bundler rewrites every other form. A plain
    // require is resolved at build time against a file that is not in the app
    // tree; `await import("module")` gets rewritten too and hands back a shim
    // whose createRequire is not a function. Hidden behind eval, the call
    // reaches Node's own loader at runtime, which is the whole point.
    const nodeRequire = eval("require") as NodeJS.Require;
    ({ askHermes } = nodeRequire(path.join(process.cwd(), "server", "hermes-ws-client.js")));
  } catch (error) {
    return NextResponse.json({
      ok: false,
      question,
      answer: null,
      sources: retrieval.results,
      reason: `Hermes-Client nicht ladbar: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  try {
    const answer = await askHermes(buildPrompt(question, retrieval.results));

    // Hermes reports some failures as the assistant's own message rather than
    // as a turn error — a model whose context window is misconfigured, for
    // one. Passing that through as `ok: true` would dress a failure up as an
    // answer, which is the exact thing this endpoint is built not to do.
    if (/^Error:/i.test(answer.trim())) {
      return NextResponse.json({
        ok: false,
        question,
        answer: null,
        sources: retrieval.results,
        reason: answer.trim().slice(0, 500),
      });
    }

    return NextResponse.json({
      ok: true,
      question,
      answer,
      // Returned even on success, and deliberately: the sources are what make
      // the answer checkable instead of merely fluent.
      sources: retrieval.results,
      searched: retrieval.searched,
    });
  } catch (error) {
    // The retrieval still succeeded, so the notes are worth handing back even
    // when the model could not be reached — half an answer beats none.
    return NextResponse.json({
      ok: false,
      question,
      answer: null,
      sources: retrieval.results,
      reason: `Hermes hat nicht geantwortet: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
