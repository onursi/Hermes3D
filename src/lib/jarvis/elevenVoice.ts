import { createHash, randomBytes } from "node:crypto";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { getElevenLabsConfig } from "@/lib/elevenlabs/localConfig";
import { expressiveText, neutralExpression, type VoiceExpression } from "./expression";

export const JARVIS_SPEECH_MODEL = "eleven_v4_turbo";

export type SpeechStatus = { configured: boolean; ready: boolean; voiceName: string; voiceId: string; previewUrl: string; remainingCredits: number | null; error: string };
type Grant = { expires: number; voiceId: string; account: string; remaining: number; requests: number; busy: boolean };
type State = { grants: Map<string, Grant>; cached?: { account: string; voiceId: string; until: number; status: SpeechStatus } };
const stateKey = Symbol.for("hermes.jarvis.eleven-speech");
const globals = globalThis as unknown as Record<symbol, State>;
const state = globals[stateKey] ||= { grants: new Map() };
const accountId = (key: string) => createHash("sha256").update(key).digest("hex");
const config = () => { const c = getElevenLabsConfig(); return { apiKey: c.apiKey, ...c.voices.jarvis }; };

export async function speechStatus(signal?: AbortSignal, refresh = false): Promise<SpeechStatus> {
  const c = config(), account = accountId(c.apiKey);
  if (!refresh && state.cached?.account === account && state.cached.voiceId === c.id && state.cached.until > Date.now()) return state.cached.status;
  const result: SpeechStatus = { configured: Boolean(c.apiKey && c.id), ready: false, voiceName: c.name, voiceId: c.id, previewUrl: "", remainingCredits: null, error: "" };
  if (!result.configured) return { ...result, error: "ElevenLabs-Zugang oder Jarvis-Stimme fehlt." };
  try {
    const options = { headers: { "xi-api-key": c.apiKey }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000), cache: "no-store" as const };
    const [voice, subscription] = await Promise.all([fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(c.id)}`, options), fetch("https://api.elevenlabs.io/v1/user/subscription", options)]);
    if (!voice.ok || !subscription.ok) throw new Error("ElevenLabs-Zugang oder ausgewählte Stimme ist nicht verfügbar.");
    const [v, s] = await Promise.all([voice.json(), subscription.json()]);
    if (v.voice_id !== c.id || !Number.isFinite(s.character_count) || !Number.isFinite(s.character_limit)) throw new Error("ElevenLabs-Kontingent konnte nicht geprüft werden.");
    result.voiceName = typeof v.name === "string" ? v.name : c.name;
    result.previewUrl = typeof v.preview_url === "string" && v.preview_url.startsWith("https://") ? v.preview_url : "";
    result.remainingCredits = Math.max(0, s.character_limit - s.character_count);
    result.ready = result.remainingCredits >= 32;
    if (!result.ready) result.error = `ElevenLabs-Kontingent reicht nicht für ein Gespräch. Verfügbar: ${result.remainingCredits} Credits. Bitte Kontingent bereitstellen oder eine Gemini-Stimme wählen.`;
  } catch (error) { result.error = error instanceof Error ? error.message : "ElevenLabs ist nicht erreichbar."; }
  state.cached = { account, voiceId: c.id, until: Date.now() + 5000, status: result };
  return result;
}

export function issueSpeechGrant() {
  const c = config();
  if (!c.apiKey || !c.id) throw new Error("ElevenLabs ist nicht konfiguriert.");
  for (const [key, grant] of state.grants) if (grant.expires <= Date.now()) state.grants.delete(key);
  if (state.grants.size >= 128) throw new Error("Zu viele Sprachsitzungen. Bitte später neu starten.");
  const session = randomBytes(32).toString("hex");
  state.grants.set(session, { expires: Date.now() + 10 * 60_000, voiceId: c.id, account: accountId(c.apiKey), remaining: 8000, requests: 0, busy: false });
  return session;
}

export function reserveSpeech(session: unknown, characters: number) {
  const grant = typeof session === "string" ? state.grants.get(session) : undefined, c = config();
  if (!grant || grant.expires <= Date.now() || grant.voiceId !== c.id || grant.account !== accountId(c.apiKey)) throw new Error("Sprachsitzung ist ungültig oder abgelaufen. Gespräch neu starten.");
  if (grant.busy || grant.requests >= 80 || characters > grant.remaining) throw new Error("Sprachlimit erreicht. Gespräch neu starten.");
  grant.busy = true; grant.requests++; grant.remaining -= characters;
  return { apiKey: c.apiKey, voiceId: grant.voiceId, release: () => { grant.busy = false; } };
}

export async function streamSelectedVoice(apiKey: string, voiceId: string, text: string, previousText: string, signal: AbortSignal, expression: VoiceExpression = neutralExpression()) {
  const client = new ElevenLabsClient({ apiKey });
  return client.textToSpeech.stream(voiceId, {
    text: expressiveText(text, expression), previousText: previousText || undefined, modelId: JARVIS_SPEECH_MODEL, languageCode: "de", outputFormat: "pcm_24000",
    voiceSettings: { similarityBoost: .8 },
  }, { abortSignal: signal, timeoutInSeconds: 20, maxRetries: 0 });
}
