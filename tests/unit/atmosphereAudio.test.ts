import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });

describe("atmosphere audio lifecycle", () => {
  it("does not create audio from a stored preference without a user gesture", async () => {
    const ctor = vi.fn(); vi.stubGlobal("AudioContext", ctor);
    const { runAtmosphere } = await import("../../src/features/v2/atmosphereAudio");
    expect(runAtmosphere("cosmos", 0.6)).toBeNull();
    expect(ctor).not.toHaveBeenCalled();
  });

  it("stops every source and timer when muted or leaving a world", async () => {
    vi.useFakeTimers();
    const nodes: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
    const param = () => ({ value: 0, setTargetAtTime: vi.fn(), setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
    function node() {
      const n = { gain: param(), frequency: param(), detune: param(), threshold: param(), ratio: param(), Q: param(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      n.connect.mockReturnValue(n); nodes.push(n); return n;
    }
    const fake = { currentTime: 0, sampleRate: 100, destination: {}, resume: vi.fn().mockResolvedValue(undefined), createGain: node, createDynamicsCompressor: node, createOscillator: node, createBiquadFilter: node, createBufferSource: node, createBuffer: () => ({getChannelData: () => new Float32Array(300)}) };
    vi.stubGlobal("AudioContext", class { constructor() { return fake; } });
    const { unlockAtmosphere, runAtmosphere } = await import("../../src/features/v2/atmosphereAudio");
    unlockAtmosphere();
    expect(runAtmosphere("universe", 0)).toBeNull();
    const stop = runAtmosphere("cosmos", 0.5);
    vi.advanceTimersByTime(900);
    const sources = nodes.filter(n => n.start.mock.calls.length > 0);
    expect(sources).toHaveLength(6);
    stop!(); vi.advanceTimersByTime(200);
    expect(sources.every(n => n.stop.mock.calls.length === 1)).toBe(true);
    expect(nodes.every(n => n.disconnect.mock.calls.length === 1)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
