import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JarvisDashboard } from "@/features/v2/jarvis/dashboard/JarvisDashboard";
import { validateVisionImage } from "@/lib/jarvis/vision";

function mockAudio() {
  const audio = {
    playbackRate: 1, preservesPitch: false,
    play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), load: vi.fn(), removeAttribute: vi.fn(),
    onplaying: null as (() => void) | null, onended: null as (() => void) | null, onerror: null as (() => void) | null,
  };
  const constructor = vi.fn(function () { return audio; });
  vi.stubGlobal("Audio", constructor);
  return { audio, constructor };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ configured: true }), { headers: { "Content-Type": "application/json" } })));
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Jarvis recorded voice lifecycle", () => {
  it("keeps the bass pitch while changing tempo during playback", () => {
    const { audio } = mockAudio();
    render(createElement(JarvisDashboard));
    fireEvent.click(screen.getByRole("button", { name: "Jarvis ansprechen oder Stimme stoppen" }));
    expect(audio.playbackRate).toBe(1.16);
    expect(audio.preservesPitch).toBe(true);
    fireEvent.change(screen.getByRole("slider", { name: "Sprechtempo" }), { target: { value: "1.25" } });
    expect(audio.playbackRate).toBe(1.25);
    fireEvent.click(screen.getByRole("button", { name: "Jarvis ansprechen oder Stimme stoppen" }));
    expect(audio.pause).toHaveBeenCalledOnce();
  });
  it("closes audio analysis on stop and creates a fresh graph for the next clip", () => {
    const { audio } = mockAudio();
    const close = vi.fn().mockResolvedValue(undefined);
    const create = vi.fn(function () { return { close, resume: vi.fn().mockResolvedValue(undefined), destination: {}, createMediaElementSource: vi.fn(() => ({ connect: vi.fn() })), createAnalyser: vi.fn(() => ({ fftSize: 256, connect: vi.fn(), getByteTimeDomainData: vi.fn() })) }; });
    vi.stubGlobal("AudioContext", create);
    render(createElement(JarvisDashboard));
    fireEvent.click(screen.getByRole("button", { name: "Stimme testen" }));
    expect(create).toHaveBeenCalledOnce();
    act(() => audio.onplaying?.());
    fireEvent.click(screen.getByRole("button", { name: "Stimme stoppen" }));
    expect(close).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Stimme testen" }));
    expect(create).toHaveBeenCalledTimes(2);
  });
  it("plays the selected local clip only on click and stops on scene change", async () => {
    const { audio, constructor } = mockAudio();
    render(createElement(JarvisDashboard));
    expect(constructor).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Stimme testen" }));
    expect(constructor).toHaveBeenCalledWith("/jarvis/voice/focus-dark-v2.mp3");
    act(() => audio.onplaying?.());
    expect(screen.getByText("JARVIS SPRICHT")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Einkauf/ }));
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(audio.removeAttribute).toHaveBeenCalledWith("src");
    expect(screen.getByRole("button", { name: "Stimme testen" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Jarvis-Stimme" }), { target: { value: "synthetic" } });
    fireEvent.click(screen.getByRole("button", { name: "Stimme testen" }));
    expect(constructor).toHaveBeenLastCalledWith("/jarvis/voice/shopping-synthetic-v2.mp3");
  });
  it("cancels pending playback on page leave and ignores a late playing event", async () => {
    const { audio } = mockAudio();
    render(createElement(JarvisDashboard));
    fireEvent.click(screen.getByRole("button", { name: "Stimme testen" }));
    const latePlaying = audio.onplaying;
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(audio.pause).toHaveBeenCalledOnce();
    act(() => latePlaying?.());
    expect(screen.getByText("BEREIT, CHEF.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stimme testen" })).toBeInTheDocument();
  });
});

describe("Jarvis dashboard camera lifecycle", () => {
  it("starts neither camera nor media upload on mount and labels scenes", async () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    render(createElement(JarvisDashboard));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(screen.getByText("SZENENVORSCHAU")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sicht prüfen" })).toBeDisabled();
    expect(document.querySelector("video")).toHaveAttribute("hidden");
  });
  it("releases camera permission granted after unmount", async () => {
    let grant!: (value: MediaStream) => void;
    const stop = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(() => new Promise<MediaStream>(resolve => { grant = resolve; })) } });
    const view = render(createElement(JarvisDashboard));
    fireEvent.click(screen.getByRole("button", { name: "Kamera freigeben" }));
    view.unmount();
    await act(async () => grant({ getTracks: () => [{ stop }] } as unknown as MediaStream));
    expect(stop).toHaveBeenCalledOnce();
  });
  it("stops tracks and disables perception after explicit stop", async () => {
    const stop = vi.fn(); const media = { getTracks: () => [{ stop }], getVideoTracks: () => [{ addEventListener: vi.fn() }] };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => media) } });
    render(createElement(JarvisDashboard));
    fireEvent.click(screen.getByRole("button", { name: "Kamera freigeben" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Kamera stoppen" })).toBeEnabled());
    expect(fetch).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Kamera stoppen" }));
    expect(stop).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Sicht prüfen" })).toBeDisabled();
  });
  it("stops camera and discards an in-flight description on leaving the page", async () => {
    let reply!: (value: Response) => void;
    const stop = vi.fn(); const media = { getTracks: () => [{ stop }], getVideoTracks: () => [{ addEventListener: vi.fn() }] };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => media) } });
    const context = { drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,/9j/AAAAAAAAAAAAAAAAAAAA");
    const mock = vi.mocked(fetch); mock.mockImplementationOnce(async () => new Response(JSON.stringify({ configured: true })));
    mock.mockImplementationOnce(() => new Promise<Response>(resolve => { reply = resolve; }));
    render(createElement(JarvisDashboard));
    const video = document.querySelector("video")!;
    Object.defineProperties(video, { videoWidth: { value: 640 }, videoHeight: { value: 360 } });
    fireEvent.click(screen.getByRole("button", { name: "Kamera freigeben" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Sicht prüfen" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Sicht prüfen" }));
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(2));
    const options = mock.mock.calls[1][1]!;
    fireEvent(window, new Event("pagehide"));
    expect(stop).toHaveBeenCalledOnce(); expect(options.signal?.aborted).toBe(true);
    await act(async () => reply(new Response(JSON.stringify({ description: "obsolete result" }))));
    expect(screen.queryByText("obsolete result")).not.toBeInTheDocument();
  });
  it("blocks non-JPEG and oversized payloads before a provider call", () => {
    expect(() => validateVisionImage(null)).toThrow();
    expect(() => validateVisionImage("A".repeat(1_200_001))).toThrow();
    expect(() => validateVisionImage(Buffer.from("not a jpeg image at all").toString("base64"))).toThrow();
    expect(validateVisionImage(Buffer.from([255, 216, 255, ...new Array(25).fill(0)]).toString("base64"))).toMatch(/^\/9j/);
  });
});
