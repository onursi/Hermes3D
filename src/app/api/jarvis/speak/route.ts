import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

/**
 * Jarvis' Stimme — ohne Schlüssel, ohne Rechnung.
 *
 * Onur fragte nach ElevenLabs, weil die Browserstimme klingt wie ein
 * Navigationsgerät von 2011. Die gute Nachricht: der Weg dahin kostet nichts.
 * Microsoft betreibt für Edges Vorlesefunktion neuronale Stimmen, die über
 * einen offenen WebSocket erreichbar sind — dieselbe Technik, die in Azure
 * Geld kostet, hier ohne Konto und ohne Schlüssel. `de-DE-ConradNeural` ist
 * eine echte neuronale Stimme, keine Formantsynthese.
 *
 * Warum das hier trotzdem eine eigene Route ist und nicht /api/voice, das es
 * schon gibt: die alte Route probiert erst OpenAI, dann ElevenLabs, dann Edge.
 * Sobald irgendwo ein Schlüssel in der Umgebung liegt, kostet jeder Satz von
 * Jarvis Geld — ohne dass jemand es entschieden hätte. Diese Route kann das
 * nicht: sie kennt nur den kostenlosen Weg. Wenn Onur später bezahlen will,
 * ist das eine sichtbare Änderung an einer Datei und keine Nebenwirkung einer
 * Umgebungsvariablen.
 *
 * Zwischengespeichert wird auf der Platte, nicht im Arbeitsspeicher: der
 * Entwicklungsserver lädt Module ständig neu, und ein Cache, der bei jedem
 * Neuladen leer ist, ist kein Cache. Derselbe Satz wird genau einmal erzeugt.
 */

/** Die Stimmen. Jede ist neuronal und deutsch — Jarvis spricht Onurs Sprache. */
const VOICES: Record<string, string> = {
  /** Dunkel, ruhig, sachlich. Die Voreinstellung. */
  conrad: "de-DE-ConradNeural",
  /** Männlich, artikuliert, eine Spur jünger. */
  killian: "de-DE-KillianNeural",
  /** Weiblich, hell, wach. */
  katja: "de-DE-KatjaNeural",
  /** Weiblich, warm, langsamer im Duktus. */
  amala: "de-DE-AmalaNeural",
};

const DEFAULT_VOICE = "conrad";

/**
 * Ein Tempo knapp über Normal.
 *
 * Die alte Route stand auf +25 %. Das war eine Entscheidung gegen die
 * Wartezeit und gegen die Stimme: über etwa +15 % kippt eine neuronale Stimme
 * hörbar ins Gehetzte, und genau das soll Jarvis nicht sein.
 */
const RATE = "+8%";

const CACHE_DIR = path.join(process.cwd(), ".cache", "jarvis-voice");

/** Grob eine Minute Sprache. Alles darüber ist ein Vorlesefehler, kein Satz. */
const MAX_CHARS = 1200;

/**
 * Was gesprochen wird, ist nicht was geschrieben steht.
 *
 * Quellenmarken wie "[2]" liest eine Stimme als "Klammer auf zwei" mitten im
 * Satz vor. Die Quellen stehen ohnehin sichtbar daneben.
 */
function speakable(text: string): string {
  return text
    .replace(/\[\d+\]/g, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CHARS);
}

export async function POST(request: Request) {
  let body: { text?: unknown; voice?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Kein gültiger Text." }, { status: 400 });
  }

  const spoken = typeof body.text === "string" ? speakable(body.text) : "";
  if (!spoken) {
    return NextResponse.json({ ok: false, error: "Nichts zu sagen." }, { status: 400 });
  }

  const voiceKey =
    typeof body.voice === "string" && body.voice in VOICES ? body.voice : DEFAULT_VOICE;
  const voice = VOICES[voiceKey];

  const key = createHash("sha1").update(`${voice}|${RATE}|${spoken}`).digest("hex");
  const file = path.join(CACHE_DIR, `${key}.mp3`);

  try {
    const cached = await readFile(file);
    return audio(cached, "hit");
  } catch {
    // Noch nicht erzeugt. Das ist der Normalfall beim ersten Mal.
  }

  try {
    // Erst hier geladen: das Modul zieht eine WebSocket-Abhängigkeit mit, die
    // auf dem Anfrageweg nichts zu suchen hat, solange nur der Cache gefragt
    // ist.
    const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = await tts.toStream(spoken, { rate: RATE });

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) chunks.push(chunk as Buffer);
    tts.close();

    const buffer = Buffer.concat(chunks);
    if (buffer.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Leere Antwort vom Sprachdienst." },
        { status: 502 },
      );
    }

    // Der Cache darf scheitern, ohne die Antwort zu verhindern — er ist eine
    // Ersparnis, keine Bedingung.
    void mkdir(CACHE_DIR, { recursive: true })
      .then(() => writeFile(file, buffer))
      .catch(() => undefined);

    return audio(buffer, "miss");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sprachausgabe fehlgeschlagen";
    // Kein stiller Ausfall: der Client soll wissen, dass er auf die
    // Browserstimme zurückfallen muss, statt auf Stille zu warten.
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

function audio(buffer: Buffer | Uint8Array, cache: "hit" | "miss") {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, max-age=86400",
      "X-Jarvis-Cache": cache,
    },
  });
}
