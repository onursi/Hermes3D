import { NextResponse } from "next/server";

import { getElevenLabsConfig, resolveVoice } from "@/lib/elevenlabs/localConfig";

// High-speed in-memory audio cache for instant replay (0ms latency, zero API cost on repeat)
const voiceCache = new Map<string, ArrayBuffer>();

export const runtime = "nodejs";

export async function GET() {
  const config = getElevenLabsConfig();
  return NextResponse.json({
    ok: Boolean(config.apiKey && config.voices.hermes.id),
    provider: "ElevenLabs",
    source: config.source,
    voices: Object.fromEntries(
      Object.entries(config.voices).map(([key, voice]) => [key, { configured: Boolean(voice.id), name: voice.name }]),
    ),
    fallback: false,
  });
}

export async function POST(req: Request) {
  try {
    const { text, agentId } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const cleanText = text.replace(/[*#_`[\]()]/g, "").trim();
    if (!cleanText) {
      return NextResponse.json({ error: "Empty text" }, { status: 400 });
    }

    if (cleanText.length > 5_000) {
      return NextResponse.json({ error: "Text ist länger als 5.000 Zeichen." }, { status: 413 });
    }

    const selected = resolveVoice(agentId);
    const cacheKey = `${selected.key}:${cleanText}`;
    if (voiceCache.has(cacheKey)) {
      const cached = voiceCache.get(cacheKey)!;
      return new Response(cached, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "public, max-age=86400",
          "X-Hermes-Voice-Provider": "ElevenLabs",
          "X-Hermes-Voice-Name": encodeURIComponent(selected.name),
        },
      });
    }
    if (!selected.apiKey || !selected.id) {
      return NextResponse.json(
        {
          error: "ElevenLabs ist für Hermes3D nicht vollständig verbunden.",
          code: "ELEVENLABS_NOT_CONFIGURED",
          provider: "ElevenLabs",
          fallback: false,
        },
        { status: 503 },
      );
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selected.id}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": selected.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.58,
            similarity_boost: 0.78,
            style: 0.12,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!res.ok) {
      const providerMessage = (await res.text()).slice(0, 500);
      return NextResponse.json(
        {
          error: "ElevenLabs konnte die ausgewählte Stimme nicht erzeugen.",
          code: "ELEVENLABS_REQUEST_FAILED",
          status: res.status,
          detail: providerMessage,
          fallback: false,
        },
        { status: 502 },
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    voiceCache.set(cacheKey, arrayBuffer);
    return new Response(arrayBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
        "X-Hermes-Voice-Provider": "ElevenLabs",
        "X-Hermes-Voice-Name": encodeURIComponent(selected.name),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Voice synthesis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
