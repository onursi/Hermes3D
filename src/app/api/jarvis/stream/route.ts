import path from "path";

import { retrieveFromVault } from "@/lib/jarvis/retrieve";

/**
 * The same answer as /api/jarvis/ask, but as it is being written.
 *
 * Two things need this rather than the finished JSON. Reading starts at the
 * first word instead of after a minute of nothing, which is the difference
 * between waiting and watching. And the display can show what Jarvis is
 * actually doing — searching, thinking, speaking — because those states are
 * real events on the wire, not a spinner guessing.
 *
 * Server-sent events rather than a socket: this is one-way and short-lived,
 * and SSE reconnects by itself.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SOURCE_COUNT = 6;
const EXCERPT_LIMIT = 1200;

function buildPrompt(question: string, hits: { title: string; folder: string; excerpt: string }[]) {
  const sources = hits
    .map((hit, index) => `[${index + 1}] ${hit.title}  (${hit.folder})\n${hit.excerpt.slice(0, EXCERPT_LIMIT)}`)
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        if (!question) {
          send("error", { reason: "Keine Frage übergeben." });
          controller.close();
          return;
        }

        send("state", { phase: "searching" });
        const retrieval = retrieveFromVault(question, SOURCE_COUNT);

        if (!retrieval.ok || retrieval.results.length === 0) {
          send("error", {
            reason: retrieval.reason ?? "Nichts im Vault gefunden, das dazu passt.",
          });
          controller.close();
          return;
        }

        // Sent before the answer, deliberately: you can start reading which
        // notes were consulted while the answer is still being written, and
        // judge for yourself whether they are the right ones.
        send("sources", { sources: retrieval.results, searched: retrieval.searched });
        send("state", { phase: "thinking" });

        const nodeRequire = eval("require") as NodeJS.Require;
        const { askHermes } = nodeRequire(
          path.join(process.cwd(), "server", "hermes-ws-client.js"),
        ) as { askHermes: (text: string, options?: Record<string, unknown>) => Promise<string> };

        let spoke = false;
        const answer = await askHermes(buildPrompt(question, retrieval.results), {
          onDelta: (piece: string) => {
            if (!spoke) {
              spoke = true;
              send("state", { phase: "speaking" });
            }
            send("delta", { text: piece });
          },
        });

        // Hermes reports some failures as the assistant's own message rather
        // than as an error, so a reply that opens with "Error:" is a failure
        // however fluent it looks.
        if (/^Error:/i.test(answer.trim())) {
          send("error", { reason: answer.trim().slice(0, 500) });
        } else {
          send("done", { answer });
        }
      } catch (error) {
        send("error", { reason: error instanceof Error ? error.message : String(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
