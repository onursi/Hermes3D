import { describe, expect, it } from "vitest";
import { GESTURES, handPose, isWalkInputTarget } from "@/features/walk/gestures";

describe("first-person gestures", () => {
  it("raises both thumbs with mirrored wrists and clenched fingers", () => {
    const left = handPose(-1, "thumbs", .7), right = handPose(1, "thumbs", .7);
    expect(left.thumb).toBe(1); expect(right.thumb).toBe(1);
    expect(left.curl).toBeGreaterThan(1.4);
    expect(left.position[0]).toBe(-right.position[0]);
    expect(left.position[1]).toBeGreaterThan(handPose(-1, null, 0).position[1]);
    expect(left.rotation[2]).toBe(-right.rotation[2]);
  });
  it("brings fists together at contact then returns them", () => {
    const left = handPose(-1, "bump", .5), right = handPose(1, "bump", .5);
    expect(right.position[0] - left.position[0]).toBeGreaterThan(.09);
    expect(right.position[0] - left.position[0]).toBeLessThan(.12);
    expect(left.thumb).toBe(0); expect(right.point).toBe(0);
    expect(handPose(1, "bump", 1.3).position[0]).toBeGreaterThan(right.position[0]);
  });
  it("alternates four punches rather than moving both fists together", () => {
    for (const [side, time] of [[-1, .48], [1, .83], [-1, 1.19], [1, 1.66]] as const) {
      const punch = handPose(side, "boxing", time), guard = handPose(side === 1 ? -1 : 1, "boxing", time);
      expect(punch.position[2]).toBeLessThan(guard.position[2] - .2);
    }
  });
  it("finishes every clip at idle and keeps all sampled poses finite", () => {
    for (const gesture of GESTURES) {
      expect(handPose(1, gesture.id, gesture.duration)).toEqual(handPose(1, null, 0));
      for (let t = 0; t < gesture.duration; t += .02) {
        for (const side of [-1, 1] as const) {
          const pose = handPose(side, gesture.id, t);
          expect([...pose.position, ...pose.rotation, pose.curl, pose.thumb].every(Number.isFinite)).toBe(true);
        }
      }
    }
  });
  it("reduced-motion boxing holds a guard without punches", () => {
    expect(handPose(1, "boxing", .3, false, true)).toEqual(handPose(1, "boxing", 1.7, false, true));
  });
  it("blocks gameplay shortcuts in inputs, editable text, buttons and dialogs", () => {
    const panel = document.createElement("div"); panel.setAttribute("role", "dialog");
    const child = document.createElement("span"); panel.appendChild(child);
    expect(isWalkInputTarget(child)).toBe(true);
    expect(isWalkInputTarget(document.createElement("textarea"))).toBe(true);
    expect(isWalkInputTarget(document.createElement("button"))).toBe(true);
    expect(isWalkInputTarget(document.createElement("canvas"))).toBe(false);
  });
});
