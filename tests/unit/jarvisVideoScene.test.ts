import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { JarvisVideoScene } from "@/features/v2/jarvis/JarvisVideoScene";
import { DEFAULT_VIDEO_TASKS, VIDEO_SCENE_STORAGE_KEY, makeVideoScene, readVideoTasks } from "@/features/v2/jarvis/videoScene";

const props = () => ({ voiceKey: "hermes", onPrepare: vi.fn(async (_replies: string[]) => {}), onPlay: vi.fn(async (_cue: string, _reply: string) => true), onStop: vi.fn() });
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("Jarvis staged video scene", () => {
  it("recovers malformed saved tasks and bounds edited voice input", () => {
    expect(readVideoTasks({ calendar: true })).toEqual([...DEFAULT_VIDEO_TASKS]);
    expect(readVideoTasks([1, "two", "three"])).toEqual([...DEFAULT_VIDEO_TASKS]);
    expect(readVideoTasks(["a".repeat(300), "", "  Brot kaufen  "])).toEqual(["a".repeat(220), DEFAULT_VIDEO_TASKS[1], "Brot kaufen"]);
    expect(makeVideoScene(["Paket abgeben", "Wäsche", "Brot kaufen"])[0].reply).toContain("Brot kaufen");
  });
  it("is a labelled scene and never starts playback automatically", () => {
    const p = props(); render(createElement(JarvisVideoScene, p));
    expect(screen.getByText("Video-Szene · Beispieldaten")).toBeInTheDocument();
    expect(p.onPlay).not.toHaveBeenCalled();
    expect(p.onPrepare).not.toHaveBeenCalled();
  });
  it("stops the countdown before any voice is sent", async () => {
    vi.useFakeTimers(); const p = props(); render(createElement(JarvisVideoScene, p));
    fireEvent.click(screen.getByRole("button", { name: "Antwort abspielen" }));
    fireEvent.click(screen.getByRole("button", { name: "Video-Antwort stoppen" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(p.onPlay).not.toHaveBeenCalled();
    expect(p.onStop).toHaveBeenCalled();
  });
  it("replays a selected reply and reports a playback failure", async () => {
    const p = props(); p.onPlay.mockResolvedValue(false); render(createElement(JarvisVideoScene, p));
    fireEvent.change(screen.getByLabelText("Vorlauf für Video-Antwort"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Käffchen" }));
    fireEvent.click(screen.getByRole("button", { name: "Antwort abspielen" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("nicht vollständig"));
    expect(p.onPlay).toHaveBeenCalledWith("Erst mal mein Käffchen.", expect.stringContaining("künstliche Intelligenz"));
    fireEvent.click(screen.getByRole("button", { name: "Antwort abspielen" }));
    await waitFor(() => expect(p.onPlay).toHaveBeenCalledTimes(2));
  });
  it("prepares all replies and invalidates readiness after task or voice changes", async () => {
    const p = props(); const view = render(createElement(JarvisVideoScene, p));
    fireEvent.click(screen.getByRole("button", { name: "Stimme vorbereiten" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Stimme bereit" })).toBeDisabled());
    expect(p.onPrepare.mock.calls[0][0]).toHaveLength(3);
    view.rerender(createElement(JarvisVideoScene, { ...p, voiceKey: "other" }));
    expect(screen.getByRole("button", { name: "Stimme vorbereiten" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Aufgaben ändern" }));
    fireEvent.change(screen.getByLabelText("Video-Aufgabe 3"), { target: { value: "Milch kaufen" } });
    expect(JSON.parse(localStorage.getItem(VIDEO_SCENE_STORAGE_KEY)!)[2]).toBe("Milch kaufen");
    expect(screen.getByText(/Und drittens, Milch kaufen/)).toBeInTheDocument();
  });
  it("releases a camera granted after the scene has already closed", async () => {
    let grant!: (stream: MediaStream) => void;
    const stop = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(() => new Promise<MediaStream>(resolve => { grant = resolve; })) } });
    const view = render(createElement(JarvisVideoScene, props()));
    fireEvent.click(screen.getByRole("button", { name: "Webcam-Vorschau" }));
    view.unmount();
    await act(async () => grant({ getTracks: () => [{ stop }] } as unknown as MediaStream));
    expect(stop).toHaveBeenCalledOnce();
  });
});
