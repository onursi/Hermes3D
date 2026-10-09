import { afterEach, describe, expect, it, vi } from "vitest";
import { liveSetup, createLiveToken, LIVE_MODEL } from "@/lib/jarvis/live";
import { bytesToBase64, pcmFromBase64, LivePcmPlayer, JarvisLiveSession } from "@/features/v2/jarvis/live/session";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("Jarvis live token", () => {
  it("pins a real native audio model, camera grounding and interruptible speech", () => {
    const setup = liveSetup("Charon");
    expect(setup.model).toBe(LIVE_MODEL);
    expect(setup.generationConfig.responseModalities).toEqual(["AUDIO"]);
    expect(setup.realtimeInputConfig.activityHandling).toBe("START_OF_ACTIVITY_INTERRUPTS");
    expect(setup.systemInstruction.parts[0].text).toContain("nur auf wirklich sichtbare");
    expect(() => liveSetup("arbitrary-provider-voice")).toThrow("Unbekannte");
  });
  it("issues a single-use, short-lived token with the entire REST setup locked", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key-only");
    const mock = vi.fn(async () => new Response(JSON.stringify({ name: "auth_tokens/test" })));
    vi.stubGlobal("fetch", mock);
    const result = await createLiveToken("Orus");
    expect(result.token).toBe("auth_tokens/test");
    const body = JSON.parse(mock.mock.calls[0][1].body);
    expect(body.uses).toBe(1); expect(body.bidiGenerateContentSetup.model).toBe(LIVE_MODEL);
    expect(body.liveConnectConstraints).toBeUndefined();
    expect(Date.parse(body.newSessionExpireTime) - Date.now()).toBeLessThanOrEqual(60000);
    expect(result).not.toHaveProperty("key");
    vi.unstubAllEnvs();
  });
});
describe("Jarvis live PCM", () => {
  it("reads little-endian signed samples without losing negative amplitude", () => {
    expect(Array.from(pcmFromBase64(bytesToBase64(new Uint8Array([0, 128, 0, 0, 255, 127]))))).toEqual([-1, 0, 32767 / 32768]);
    expect(() => pcmFromBase64("AA==")).toThrow();
  });
  it("queues streaming packets sequentially and empties the queue on interruption", () => {
    const sources: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn>; onended: null | (() => void) }> = [];
    const context = { currentTime: 1, createBuffer: vi.fn(() => ({ duration: .1, copyToChannel: vi.fn() })), createBufferSource: vi.fn(() => { const s = { start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), connect: vi.fn(), onended: null }; sources.push(s); return s; }) };
    const state = vi.fn(); const player = new LivePcmPlayer(context as unknown as AudioContext, {} as AudioNode, state);
    player.play("AAA="); player.play("AAA=");
    expect(sources[0].start.mock.calls[0][0]).toBeCloseTo(1.035);
    expect(sources[1].start.mock.calls[0][0]).toBeCloseTo(1.135);
    expect(player.playing).toBe(true);
    player.stop(); expect(player.playing).toBe(false);
    expect(sources[0].stop).toHaveBeenCalledOnce(); expect(sources[1].stop).toHaveBeenCalledOnce();
    expect(state).toHaveBeenLastCalledWith(false);
    context.currentTime = 2; player.play("AAA="); expect(sources[2].start.mock.calls[0][0]).toBeCloseTo(2.035);
  });
  it("stops a microphone grant arriving after the caller has hung up", async () => {
    let grant!: (media: MediaStream) => void;
    const getUserMedia = vi.fn(() => new Promise<MediaStream>(resolve => { grant = resolve; }));
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    const close = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("AudioContext", vi.fn(function () { return { resume: vi.fn().mockResolvedValue(undefined), close }; }));
    const video = document.createElement("video"); vi.spyOn(video, "pause").mockImplementation(() => {});
    const events = { phase: vi.fn(), error: vi.fn(), level: { current: .4 } };
    const session = new JarvisLiveSession(video, events);
    const start = session.start({ camera: true, coach: false, voice: "Charon" });
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
    session.stop(); const stop = vi.fn(); grant({ getTracks: () => [{ stop }] } as unknown as MediaStream); await start;
    expect(stop).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce(); expect(events.level.current).toBe(0);
    expect(events.phase).toHaveBeenLastCalledWith("idle"); expect(events.error).not.toHaveBeenCalled();
  });
});
