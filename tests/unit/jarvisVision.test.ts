import { describe, expect, it } from "vitest";
import { bounds, distanceCm, eyeOpenness, hasIris, shadeSilhouette } from "@/features/v2/jarvis/live/vision";

function mesh(points: Record<number, [number, number]>, size = 478) {
  const data = new Float32Array(size * 2).fill(.5);
  for (const [index, [x, y]] of Object.entries(points)) { data[Number(index) * 2] = x; data[Number(index) * 2 + 1] = y; }
  return data;
}
const eyes = (lid: number) => mesh({ 33: [.4, .5], 133: [.46, .5], 159: [.43, .5 - lid], 145: [.43, .5 + lid], 263: [.6, .5], 362: [.54, .5], 386: [.57, .5 - lid], 374: [.57, .5 + lid] });

describe("Jarvis vision measurements", () => {
  it("separates open from closed eyes", () => {
    expect(eyeOpenness(eyes(.012), 1)).toBeGreaterThan(.3);
    expect(eyeOpenness(eyes(.002), 1)).toBeLessThan(.13);
  });
  it("estimates a plausible distance from the iris width and refuses without iris points", () => {
    const near = mesh({ 469: [.52, .5], 471: [.5, .5], 474: [.62, .5], 476: [.6, .5] });
    const far = mesh({ 469: [.51, .5], 471: [.5, .5], 474: [.61, .5], 476: [.6, .5] });
    expect(distanceCm(near)).toBeCloseTo(48.7, 0);
    expect(distanceCm(far)!).toBeGreaterThan(distanceCm(near)!);
    expect(hasIris(mesh({}, 468))).toBe(false);
    expect(distanceCm(mesh({}, 468))).toBeNull();
    expect(distanceCm(mesh({}))).toBeNull();
  });
  it("bounds the given landmarks", () => {
    expect(bounds(mesh({ 1: [.2, .3], 2: [.7, .9] }), [1, 2])).toEqual({ l: expect.closeTo(.2), r: expect.closeTo(.7), t: expect.closeTo(.3), b: expect.closeTo(.9) });
  });
  it("outlines the body edge, keeps the outside clear and lights the scan band inside", () => {
    const width = 4, height = 20, data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) { data[(y * width) * 4 + 3] = 0; data[(y * width + 1) * 4 + 3] = 128; data[(y * width + 2) * 4 + 3] = 255; data[(y * width + 3) * 4 + 3] = 255; }
    shadeSilhouette(data, width, height, .5);
    const alpha = (x: number, y: number) => data[(y * width + x) * 4 + 3];
    expect(alpha(0, 3)).toBe(0);
    expect(alpha(1, 3)).toBeGreaterThan(200);
    expect(alpha(3, 10)).toBeGreaterThan(alpha(3, 3));
  });
});
