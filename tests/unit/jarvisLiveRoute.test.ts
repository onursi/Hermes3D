import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/jarvis/live", () => ({ createLiveToken: vi.fn(async () => ({ token: "auth_tokens/test", setup: {}, endpoint: "wss://google.invalid" })) }));
vi.mock("@/lib/jarvis/vision", () => ({ visionConfig: () => ({ key: "never-return-this-key" }) }));
vi.mock("@/lib/jarvis/elevenVoice", () => ({ speechStatus: vi.fn(async () => ({ configured: true, ready: false, remainingCredits: 1, error: "ElevenLabs-Kontingent reicht nicht." })), issueSpeechGrant: vi.fn(() => "test-speech-session") }));
import { GET, POST } from "@/app/api/jarvis/live/route";
import { createLiveToken } from "@/lib/jarvis/live";
afterEach(() => vi.clearAllMocks());
describe("Jarvis live consent and origin", () => {
  it("does not expose the provider key in availability", async () => {
    const response = await GET(); const body = await response.text();
    expect(body).toContain('"configured":true'); expect(body).not.toContain("never-return"); expect(createLiveToken).not.toHaveBeenCalled();
  });
  it("rejects a cross-origin request before issuing a token", async () => {
    const response = await POST(new Request("http://localhost:3464/api/jarvis/live", { method: "POST", headers: { origin: "https://other.invalid", host: "localhost:3464" }, body: JSON.stringify({ consent: true }) }));
    expect(response.status).toBe(403); expect(createLiveToken).not.toHaveBeenCalled();
  });
  it("requires explicit media transmission consent", async () => {
    const response = await POST(new Request("http://localhost:3464/api/jarvis/live", { method: "POST", headers: { origin: "http://localhost:3464", host: "localhost:3464" }, body: JSON.stringify({ consent: false }) }));
    expect(response.status).toBe(400); expect(createLiveToken).not.toHaveBeenCalled();
  });
  it("rejects an exhausted selected voice before spending Google quota", async () => {
    const response = await POST(new Request("http://localhost:3464/api/jarvis/live", { method: "POST", headers: { origin: "http://localhost:3464", host: "localhost:3464" }, body: JSON.stringify({ consent: true, voice: "ElevenLabs" }) }));
    expect(response.status).toBe(402); expect(createLiveToken).not.toHaveBeenCalled();
  });
});
