import { NextResponse } from "next/server";

import { getElevenLabsConfig } from "@/lib/elevenlabs/localConfig";
import { MAX_VOICE_UPLOAD_BYTES } from "@/lib/elevenlabs/limits";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    // ── Early size check via Content-Length ──────────────────────────────────
    // Reject obviously-oversized uploads BEFORE buffering any request body
    // into memory. This prevents a DoS/OOM attack where a huge payload is
    // fully read before the limit is enforced.
    //
    // Important: Content-Length for multipart/form-data includes boundary
    // headers and field metadata overhead — not just the raw audio bytes.
    // A typical multipart envelope adds ~200–500 bytes; we use a generous
    // 1 KB overhead allowance so that a file at exactly MAX_VOICE_UPLOAD_BYTES
    // is never incorrectly rejected by this pre-buffer check.
    //
    // The post-buffer check (below) is the authoritative size limit and
    // measures the actual audio bytes — this early check only eliminates
    // obviously-oversized requests.
    const MULTIPART_OVERHEAD_ALLOWANCE = 1024; // 1 KB — safe upper bound
    const contentLengthHeader = request.headers.get("content-length");
    if (contentLengthHeader !== null) {
      const contentLength = Number(contentLengthHeader);
      if (
        !Number.isNaN(contentLength) &&
        contentLength > MAX_VOICE_UPLOAD_BYTES + MULTIPART_OVERHEAD_ALLOWANCE
      ) {
        return NextResponse.json(
          {
            error: `Audio upload exceeds the ${MAX_VOICE_UPLOAD_BYTES} byte limit.`,
          },
          { status: 413 },
        );
      }
    }

    const formData = await request.formData();
    const audio = formData.get("audio");
    // Use duck-typing instead of `instanceof File` to guard against cross-realm
    // issues where jsdom/test environments expose a different File constructor.
    if (
      audio === null ||
      typeof audio !== "object" ||
      typeof (audio as File).arrayBuffer !== "function"
    ) {
      return NextResponse.json({ error: "audio file is required." }, { status: 400 });
    }
    const audioFile = audio as File;

    const arrayBuffer = await audioFile.arrayBuffer();
    const byteLength = arrayBuffer.byteLength;
    if (byteLength <= 0) {
      return NextResponse.json({ error: "Audio upload is empty." }, { status: 400 });
    }

    // ── Secondary (post-buffer) size check ──────────────────────────────────
    // Guards against a missing or falsified Content-Length header. Status 413
    // is used here too for consistency (the body IS too large, regardless of
    // what the header claimed).
    if (byteLength > MAX_VOICE_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `Audio upload exceeds the ${MAX_VOICE_UPLOAD_BYTES} byte limit.`,
        },
        { status: 413 },
      );
    }

    const config = getElevenLabsConfig();
    if (!config.apiKey) {
      return NextResponse.json(
        {
          error: "ElevenLabs Scribe ist nicht mit Hermes3D verbunden.",
          code: "ELEVENLABS_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }

    const payload = new FormData();
    payload.set(
      "file",
      new Blob([arrayBuffer], { type: audioFile.type || "audio/webm" }),
      audioFile.name || "hermes-diktat.webm",
    );
    payload.set("model_id", "scribe_v2");
    payload.set("language_code", "deu");
    payload.set("tag_audio_events", "false");
    payload.set("diarize", "false");
    payload.set("no_verbatim", "true");

    const providerResponse = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": config.apiKey },
      body: payload,
    });
    const result = (await providerResponse.json()) as { text?: unknown; language_code?: unknown; detail?: unknown };
    if (!providerResponse.ok || typeof result.text !== "string") {
      return NextResponse.json(
        {
          error: "ElevenLabs Scribe konnte das Diktat nicht transkribieren.",
          code: "ELEVENLABS_TRANSCRIPTION_FAILED",
          status: providerResponse.status,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      text: result.text.trim(),
      provider: "ElevenLabs Scribe v2",
      language: typeof result.language_code === "string" ? result.language_code : "deu",
      retainedByHermes3D: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to transcribe audio.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
