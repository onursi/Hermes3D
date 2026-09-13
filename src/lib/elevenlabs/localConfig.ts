import fs from "node:fs";
import path from "node:path";

type VoiceKey = "hermes" | "gemini" | "chatgpt" | "astra" | "solana" | "jarvis";

const LOCAL_CONFIG = path.join(
  process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Local"),
  "Hermes3D-tools",
  "elevenlabs",
  ".env",
);

const VARIABLE_BY_VOICE: Record<VoiceKey, string> = {
  hermes: "ELEVENLABS_VOICE_HERMES",
  gemini: "ELEVENLABS_VOICE_GEMINI",
  chatgpt: "ELEVENLABS_VOICE_CHATGPT",
  astra: "ELEVENLABS_VOICE_ASTRA",
  solana: "ELEVENLABS_VOICE_SOLANA",
  jarvis: "ELEVENLABS_VOICE_JARVIS",
};

const DISPLAY_NAME: Record<VoiceKey, string> = {
  hermes: "Jones · Deep, Dark, Authoritative",
  gemini: "Laura · Enthusiast, Quirky",
  chatgpt: "Liam",
  astra: "Sarah · Mature, Reassuring, Confident",
  solana: "Lily · Velvety Actress",
  jarvis: "Jones · Deep, Dark, Authoritative",
};

function readLocalValues(): Record<string, string> {
  try {
    const lines = fs.readFileSync(LOCAL_CONFIG, "utf8").split(/\r?\n/);
    return Object.fromEntries(
      lines.flatMap((line) => {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (!match) return [];
        const value = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
        return [[match[1], value]];
      }),
    );
  } catch {
    return {};
  }
}

export function getElevenLabsConfig() {
  const local = readLocalValues();
  const value = (name: string) => process.env[name]?.trim() || local[name]?.trim() || "";
  const apiKey = value("ELEVENLABS_API_KEY");
  const voices = Object.fromEntries(
    (Object.keys(VARIABLE_BY_VOICE) as VoiceKey[]).map((voice) => [
      voice,
      {
        id: value(VARIABLE_BY_VOICE[voice]),
        name: DISPLAY_NAME[voice],
      },
    ]),
  ) as Record<VoiceKey, { id: string; name: string }>;
  return { apiKey, voices, source: apiKey ? (process.env.ELEVENLABS_API_KEY ? "environment" : "local-store") : "missing" };
}

export function resolveVoice(agentId: unknown) {
  const id = typeof agentId === "string" ? agentId.toLowerCase() : "hermes";
  const key: VoiceKey = id.includes("gemini")
    ? "gemini"
    : id.includes("astra") || id.includes("codex")
      ? "astra"
      : id.includes("solana")
        ? "solana"
        : id.includes("chatgpt")
          ? "chatgpt"
          : "hermes";
  const config = getElevenLabsConfig();
  return { ...config.voices[key], key, apiKey: config.apiKey, source: config.source };
}

export const elevenLabsCredentialLocation = LOCAL_CONFIG;
