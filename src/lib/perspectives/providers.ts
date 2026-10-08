import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import type { Answer, CatalogModel, CatalogProvider, Choice, ProviderId } from "@/features/perspectives/model";

type Json = Record<string, unknown>;
const object = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const str = (value: unknown): string => typeof value === "string" ? value : "";
const number = (value: unknown): number | undefined => typeof value === "number" && Number.isFinite(value) ? value : undefined;

/** Credentials stay server-side. Read existing configuration without changing it. */
export function parseEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z_0-9]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, "").trim();
    if (value) env[match[1]] = value;
  }
  return env;
}

function credentials(): Record<string, string> {
  const home = process.env.HERMES_HOME || (process.platform === "win32" ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "hermes") : path.join(os.homedir(), ".hermes"));
  let saved: Record<string, string> = {};
  try { saved = parseEnv(fs.readFileSync(path.join(home, ".env"), "utf8")); } catch { /* optional existing configuration */ }
  return { ...saved, ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()))) };
}

function keyFor(provider: ProviderId): string {
  const env = credentials();
  if (provider === "anthropic") return env.ANTHROPIC_API_KEY || "";
  if (provider === "gemini") return env.GEMINI_API_KEY || env.GOOGLE_API_KEY || "";
  if (provider === "openrouter") return env.OPENROUTER_API_KEY || "";
  return "";
}

const HEADERS = (provider: ProviderId): Record<string, string> => provider === "anthropic"
  ? { "x-api-key": keyFor(provider), "anthropic-version": "2023-06-01", "content-type": "application/json" }
  : provider === "gemini" ? { "x-goog-api-key": keyFor(provider), "content-type": "application/json" }
  : { authorization: `Bearer ${keyFor(provider)}`, "content-type": "application/json" };

async function jsonRequest(url: string, init: RequestInit, signal?: AbortSignal, timeout = 120_000): Promise<Json> {
  const signals = [AbortSignal.timeout(timeout), ...(signal ? [signal] : [])];
  let response: Response;
  try { response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.any(signals) }); }
  catch { if (signal?.aborted) throw new Error("Abgebrochen."); throw new Error("Anbieter nicht erreichbar oder Zeitlimit überschritten."); }
  // Never return provider error bodies: some gateways echo request credentials.
  if (!response.ok) throw new Error(response.status === 429 ? "Anbieterlimit erreicht (HTTP 429). Keine Wiederholung gestartet." : `Anbieter meldet HTTP ${response.status}. Bitte Zugang oder Modell prüfen.`);
  try { return object(await response.json()); } catch { throw new Error("Ungültige Antwort des Anbieters."); }
}

const CODEX_HOME = () => process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
function codexCatalog(): CatalogProvider {
  let models: CatalogModel[] = [];
  let authenticated = false;
  try {
    const auth = object(JSON.parse(fs.readFileSync(path.join(CODEX_HOME(), "auth.json"), "utf8")));
    authenticated = auth.auth_mode === "chatgpt" && Boolean(object(auth.tokens).access_token);
    const data = object(JSON.parse(fs.readFileSync(path.join(CODEX_HOME(), "models_cache.json"), "utf8")));
    models = array(data.models).map(object).filter((m) => m.visibility === "list" && str(m.slug)).map((m) => ({ id: str(m.slug), name: str(m.display_name) || str(m.slug), efforts: array(m.supported_reasoning_levels).map(object).map((level) => str(level.effort)).filter((effort) => ["low", "medium", "high", "xhigh", "max"].includes(effort)) }));
  } catch { /* unavailable is shown explicitly */ }
  return { id: "codex", name: "ChatGPT / Codex", available: authenticated && models.length > 0, billing: "Dein Codex-Abo · verbraucht Kontingent", models, ...(!authenticated || !models.length ? { reason: "Codex-Anmeldung oder lokaler Modellkatalog fehlt." } : {}) };
}

async function remoteCatalog(id: "anthropic" | "gemini" | "openrouter"): Promise<CatalogProvider> {
  const name = { anthropic: "Claude", gemini: "Gemini", openrouter: "OpenRouter / offene Modelle" }[id];
  const result: CatalogProvider = { id, name, available: false, models: [], billing: id === "gemini" ? "Google API · freie oder bezahlte Stufe laut deinem Konto" : "API · Tokenabrechnung" };
  if (!keyFor(id)) return { ...result, reason: "Kein API-Schlüssel in der vorhandenen Konfiguration." };
  try {
    if (id === "anthropic") {
      const data = await jsonRequest("https://api.anthropic.com/v1/models?limit=1000", { headers: HEADERS(id) }, undefined, 15_000);
      result.models = array(data.data).map(object).filter((m) => m.lifecycle !== "retired").map((m) => ({ id: str(m.id), name: str(m.display_name) || str(m.id), efforts: [] }));
    } else if (id === "gemini") {
      let next = "";
      for (let page = 0; page < 5; page++) {
        const data = await jsonRequest(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=100${next ? `&pageToken=${encodeURIComponent(next)}` : ""}`, { headers: HEADERS(id) }, undefined, 15_000);
        result.models.push(...array(data.models).map(object).filter((m) => array(m.supportedGenerationMethods).includes("generateContent") && !/image|audio|tts|robotic|embedding/i.test(str(m.name))).map((m) => ({ id: str(m.name).replace(/^models\//, ""), name: str(m.displayName) || str(m.name), efforts: [] })));
        next = str(data.nextPageToken); if (!next) break;
      }
    } else {
      const data = await jsonRequest("https://openrouter.ai/api/v1/models", { headers: HEADERS(id) }, undefined, 15_000);
      result.models = array(data.data).map(object).filter((m) => !array(object(m.architecture).output_modalities).length || array(object(m.architecture).output_modalities).includes("text")).map((m) => {
        const prices = object(m.pricing);
        const inputPrice = Number(prices.prompt), outputPrice = Number(prices.completion);
        return { id: str(m.id), name: str(m.name) || str(m.id), efforts: array(m.supported_parameters).includes("reasoning") ? ["low", "medium", "high"] : [], ...(Number.isFinite(inputPrice) && inputPrice >= 0 ? { inputPrice } : {}), ...(Number.isFinite(outputPrice) && outputPrice >= 0 ? { outputPrice } : {}) };
      });
    }
    result.models = result.models.filter((m) => m.id).sort((a, b) => a.name.localeCompare(b.name));
    return { ...result, available: result.models.length > 0, ...(!result.models.length ? { reason: "Kein Textmodell im Katalog gefunden." } : {}) };
  } catch (error) { return { ...result, reason: error instanceof Error ? error.message : "Modellkatalog nicht erreichbar." }; }
}

async function localCatalog(): Promise<CatalogProvider> {
  const result: CatalogProvider = { id: "ollama", name: "Lokal / Ollama", available: false, billing: "Dein PC · kein API-Guthaben", models: [] };
  try {
    const data = await jsonRequest("http://127.0.0.1:11434/api/tags", {}, undefined, 3_000);
    result.models = array(data.models).map(object).map((m) => ({ id: str(m.name), name: str(m.name), efforts: [] })).filter((m) => m.id);
    return { ...result, available: result.models.length > 0 };
  } catch { return { ...result, reason: "Lokaler Ollama-Dienst nicht erreichbar." }; }
}

const cacheKey = "__hermesPerspectivesCatalog";
type Cache = { at: number; promise: Promise<CatalogProvider[]> };
const state = globalThis as typeof globalThis & { [cacheKey]?: Cache };
export function getCatalog(refresh = false): Promise<CatalogProvider[]> {
  if (!refresh && state[cacheKey] && Date.now() - state[cacheKey]!.at < 600_000) return state[cacheKey]!.promise;
  const promise = Promise.all([Promise.resolve(codexCatalog()), remoteCatalog("anthropic"), remoteCatalog("gemini"), remoteCatalog("openrouter"), localCatalog()]);
  state[cacheKey] = { at: Date.now(), promise };
  return promise;
}

function codexAnswer(prompt: string, choice: Choice, signal: AbortSignal): Promise<Answer> {
  // A fresh empty working directory and ignored user config prevent inherited MCP tools/hooks.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "hermes-perspectives-"));
  const output = path.join(scratch, "answer.txt");
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/KEY|TOKEN|SECRET|PASSWORD/i.test(name))) as NodeJS.ProcessEnv;
  return new Promise((resolve, reject) => {
    const args = ["exec", "--ignore-user-config", "--ignore-rules", "--ephemeral", "--skip-git-repo-check", "--sandbox", "read-only", "--disable", "shell_tool", "--disable", "unified_exec", "--disable", "multi_agent", "--disable", "skill_search", "-c", "web_search=\"disabled\"", "-c", "features.skip_host_skill_discovery=true", "-c", "model_verbosity=\"low\"", "--model", choice.model, "--json", "--output-last-message", output];
    if (choice.effort) args.push("-c", `model_reasoning_effort=\"${choice.effort}\"`);
    args.push("-");
    const child = spawn(process.platform === "win32" ? "codex.exe" : "codex", args, { cwd: scratch, windowsHide: true, stdio: ["pipe", "pipe", "pipe"], env });
    let settled = false;
    let buffer = "";
    let usage: Answer = { text: "" };
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); try { fs.rmSync(scratch, { recursive: true, force: true }); } catch { /* scratch is always an internally generated child of os.tmpdir */ } };
    const fail = (message: string) => { if (settled) return; settled = true; child.kill(); cleanup(); reject(new Error(message)); };
    const abort = () => fail("Abgebrochen.");
    const timer = setTimeout(() => fail("Codex-Zeitlimit überschritten. Keine Wiederholung gestartet."), 180_000);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      buffer = (buffer + chunk).slice(-160_000);
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        try { const event = object(JSON.parse(buffer.slice(0, newline))); if (event.type === "turn.completed") { const u = object(event.usage); usage = { text: "", inputTokens: number(u.input_tokens), outputTokens: number(u.output_tokens) }; } } catch { /* JSONL only */ }
        buffer = buffer.slice(newline + 1); newline = buffer.indexOf("\n");
      }
    });
    // Consume stderr without returning CLI diagnostics that can contain private paths/configuration.
    child.stderr.on("data", () => {});
    child.stdin.on("error", () => {});
    child.on("error", () => fail("Codex konnte nicht gestartet werden. Anmeldung und Installation prüfen."));
    child.on("close", (code) => {
      if (settled) return;
      let text = "";
      try { text = fs.readFileSync(output, "utf8").trim().slice(0, 16_000); } catch { /* no successful answer */ }
      if (code !== 0 || !text) { fail("Codex hat keine erfolgreiche Antwort geliefert. Modellzugang oder Kontingent prüfen."); return; }
      settled = true; cleanup(); resolve({ ...usage, text });
    });
    if (!signal.aborted) child.stdin.end(prompt);
  });
}

export async function askModel(prompt: string, choice: Choice, signal: AbortSignal): Promise<Answer> {
  if (signal.aborted) throw new Error("Abgebrochen.");
  if (choice.provider === "codex") return codexAnswer(prompt, choice, signal);
  let data: Json, text: string, usage: Json;
  if (choice.provider === "anthropic") {
    data = await jsonRequest("https://api.anthropic.com/v1/messages", { method: "POST", headers: HEADERS(choice.provider), body: JSON.stringify({ model: choice.model, max_tokens: 1800, messages: [{ role: "user", content: prompt }] }) }, signal);
    text = array(data.content).map(object).filter((part) => part.type === "text").map((part) => str(part.text)).join("\n"); usage = object(data.usage);
  } else if (choice.provider === "gemini") {
    data = await jsonRequest(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(choice.model)}:generateContent`, { method: "POST", headers: HEADERS(choice.provider), body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 4096 } }) }, signal);
    text = array(object(object(array(data.candidates)[0]).content).parts).map(object).filter((part) => !part.thought).map((part) => str(part.text)).join("\n"); usage = object(data.usageMetadata);
    usage = { input_tokens: usage.promptTokenCount, output_tokens: typeof usage.candidatesTokenCount === "number" ? usage.candidatesTokenCount + (number(usage.thoughtsTokenCount) ?? 0) : undefined };
  } else if (choice.provider === "openrouter") {
    data = await jsonRequest("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: HEADERS(choice.provider), body: JSON.stringify({ model: choice.model, max_tokens: 2400, messages: [{ role: "user", content: prompt }], ...(choice.effort ? { reasoning: { effort: choice.effort } } : {}) }) }, signal);
    text = str(object(object(array(data.choices)[0]).message).content); usage = object(data.usage);
    usage = { ...usage, input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens };
  } else {
    data = await jsonRequest("http://127.0.0.1:11434/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: choice.model, stream: false, messages: [{ role: "user", content: prompt }], options: { num_predict: 1800 } }) }, signal, 180_000);
    text = str(object(data.message).content); usage = { input_tokens: data.prompt_eval_count, output_tokens: data.eval_count };
  }
  if (!text.trim()) throw new Error("Das Modell hat keine Textantwort geliefert (Limit oder Sperre möglich). Keine Wiederholung gestartet.");
  return { text: text.trim().slice(0, 16_000), inputTokens: number(usage.input_tokens), outputTokens: number(usage.output_tokens), costUsd: number(usage.cost) };
}
