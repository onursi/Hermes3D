import { NextResponse } from "next/server";

// High-speed in-memory audio cache for instant replay (0ms latency, zero API cost on repeat)
const voiceCache = new Map<string, ArrayBuffer>();

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

    const cacheKey = `${agentId}:${cleanText}`;
    if (voiceCache.has(cacheKey)) {
      const cached = voiceCache.get(cacheKey)!;
      return new Response(cached, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    const openAiKey = process.env.OPENAI_API_KEY;
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

    // 1. Studio-grade OpenAI TTS (tts-1 with custom personality voices)
    if (openAiKey) {
      let voice = "onyx";
      const lower = (agentId || "").toLowerCase();
      if (lower.includes("gemini")) voice = "nova"; // weiblich, energisch
      else if (lower.includes("chatgpt")) voice = "shimmer"; // weiblich, warm
      else if (lower.includes("hermes")) voice = "onyx"; // tief, maskulin
      else if (lower.includes("claude")) voice = "echo"; // männlich, artikuliert

      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // `tts-1` is the latency-optimised model; `tts-1-hd` trades a little
          // speed for noticeably cleaner audio, which matters more here since
          // every clip is cached after the first request.
          model: "tts-1-hd",
          input: cleanText,
          voice,
          // Was 1.45. Anything much above 1.0 turns a natural voice into the
          // chipmunk-adjacent rush that reads as "robot", which is the exact
          // opposite of what these voices are for.
          speed: 1.0,
        }),
      });

      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        voiceCache.set(cacheKey, arrayBuffer);
        return new Response(arrayBuffer, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    }

    // 2. Studio-grade ElevenLabs Multilingual V2
    if (elevenLabsKey) {
      const elevenVoiceMap: Record<string, string> = {
        hermes: "pNInz6obpgDQGcFmaJgB", // Adam (maskulin dunkel)
        claude: "ErXwobaYiN019PkySvjV", // Antoni (männlich artikuliert)
        chatgpt: "AZnzlk1XvdvUeBnXmlld", // Domi (weiblich warm)
        gemini: "21m00Tcm4TlvDq8ikWAM", // Rachel (weiblich klar)
      };
      const lower = (agentId || "").toLowerCase();
      const voiceId = lower.includes("claude")
        ? elevenVoiceMap.claude
        : lower.includes("chatgpt")
        ? elevenVoiceMap.chatgpt
        : lower.includes("gemini")
        ? elevenVoiceMap.gemini
        : elevenVoiceMap.hermes;

      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": elevenLabsKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: "eleven_multilingual_v2",
        }),
      });

      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        voiceCache.set(cacheKey, arrayBuffer);
        return new Response(arrayBuffer, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    }

    // 3. Free High-Definition Azure Neural Engine (ZERO API KEY REQUIRED!)
    try {
      const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
      const tts = new MsEdgeTTS();
      let edgeVoice = "de-DE-ConradNeural";
      const lower = (agentId || "").toLowerCase();
      if (lower.includes("gemini")) edgeVoice = "de-DE-KatjaNeural"; // hell, weiblich
      else if (lower.includes("chatgpt")) edgeVoice = "de-DE-AmalaNeural"; // warm, weiblich
      else if (lower.includes("hermes")) edgeVoice = "de-DE-ConradNeural"; // maskulin, dunkel
      else if (lower.includes("claude")) edgeVoice = "de-DE-KillianNeural"; // maskulin, artikuliert

      await tts.setMetadata(edgeVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = await tts.toStream(cleanText, { rate: "+25%" }); // genau 1.25x Speed!

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(chunk as Buffer);
      }
      tts.close();

      const buffer = Buffer.concat(chunks);
      voiceCache.set(cacheKey, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));

      return new Response(buffer, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch (edgeErr) {
      console.warn("EdgeTTS error, falling back:", edgeErr);
    }

    // Fallback indicator if network error occurs
    return NextResponse.json({
      fallback: true,
      reason: "EDGE_TTS_UNAVAILABLE",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Voice synthesis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
