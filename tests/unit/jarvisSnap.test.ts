import { describe, expect, it } from "vitest";
import { SnapDetector } from "@/features/v2/jarvis/live/snap";

const packet = (fill: (index: number) => number) => Int16Array.from({ length: 1600 }, (_, i) => Math.round(fill(i) * 32767));
const silence = () => packet(() => .005);
const snap = () => packet(i => i >= 480 && i < 560 ? .8 * Math.exp(-(i - 480) / 30) * (i % 2 ? 1 : -1) : .005);
const speech = () => packet(i => .5 * Math.sin(i / 9));
const feed = (detector: SnapDetector, packets: Int16Array[]) => packets.filter(item => detector.push(item)).length;

describe("Jarvis snap detector", () => {
  it("hears one short burst between silence", () => {
    expect(feed(new SnapDetector(), [silence(), snap(), silence(), silence()])).toBe(1);
  });
  it("ignores silence and sustained speech", () => {
    expect(feed(new SnapDetector(), [silence(), silence(), silence()])).toBe(0);
    expect(feed(new SnapDetector(), [silence(), speech(), speech(), speech(), silence()])).toBe(0);
  });
  it("does not fire twice within the cooldown", () => {
    expect(feed(new SnapDetector(), [silence(), snap(), silence(), snap(), silence(), silence()])).toBe(1);
  });
});
