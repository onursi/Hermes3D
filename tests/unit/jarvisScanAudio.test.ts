import { afterEach, describe, expect, it, vi } from "vitest";
import { freshScan, ScanAudio } from "@/features/v2/jarvis/live/scanAudio";
describe("Jarvis scan sound lifecycle", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("never replays a stale, idle or failed search as a fresh scan", () => {
    const event = { version: 1, at: 10000, phase: "found" as const, ids: ["opaque"], count: 1 };
    expect(freshScan(event, 10500)).toBe(true);
    expect(freshScan(event, 13000)).toBe(false);
    expect(freshScan({ ...event, phase: "idle" }, 10500)).toBe(false);
    expect(freshScan({ ...event, phase: "error" }, 10500)).toBe(false);
  });
  it("requires activation, cancels scheduled tones and closes its audio device", async () => {
    const oscillators: { stop: ReturnType<typeof vi.fn> }[] = [];
    const close = vi.fn(async () => {}), resume = vi.fn(async () => {});
    const create = vi.fn(function () { return { state: "running", currentTime: 0, destination: {}, resume, close,
      createOscillator: () => { const osc = { frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(()=>({connect:vi.fn()})), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() }; oscillators.push(osc); return osc; },
      createGain: () => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, disconnect: vi.fn() }) }; });
    vi.stubGlobal("AudioContext", create);
    const audio = new ScanAudio(); audio.play("search"); expect(create).not.toHaveBeenCalled();
    await audio.enable(); audio.play("found", 1);
    expect(oscillators).toHaveLength(2);
    audio.close(); expect(oscillators.every(osc=>osc.stop.mock.calls.length===2)).toBe(true); expect(close).toHaveBeenCalledOnce();
    audio.play("search"); expect(oscillators).toHaveLength(2);
  });
});
