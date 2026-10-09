import { describe, expect, it } from "vitest";
import { OwnedPointerDrag, isWalkMovementKey, walkKey } from "@/features/walk/input";

const p = (pointerId: number, clientX: number, clientY: number) => ({ pointerId, clientX, clientY });

describe("walk multi-touch regression", () => {
  it("keeps the camera on its original finger while a second finger uses the joystick", () => {
    const look = new OwnedPointerDrag(), stick = new OwnedPointerDrag();
    expect(look.begin(p(10, 240, 300))).toBe(true);
    expect(stick.begin(p(20, 60, 700))).toBe(true);
    expect(look.begin(p(20, 60, 700))).toBe(false);
    expect(look.move(p(20, 90, 740))).toBeNull();
    expect(look.move(p(10, 246, 304))).toEqual({ dx: 6, dy: 4 });
    expect(stick.activeId).toBe(20);
    expect(look.end(20)).toBe(false);
    expect(look.move(p(10, 250, 307))).toEqual({ dx: 4, dy: 3 });
  });
  it("cannot let a second finger steal or release joystick ownership", () => {
    const stick = new OwnedPointerDrag();
    stick.begin(p(1, 60, 700));
    expect(stick.begin(p(2, 90, 700))).toBe(false);
    expect(stick.end(2)).toBe(false);
    expect(stick.activeId).toBe(1);
    expect(stick.end(1)).toBe(true);
    expect(stick.move(p(1, 100, 700))).toBeNull();
  });
  it("rejects stale motion after cancellation, then accepts a fresh finger", () => {
    const drag = new OwnedPointerDrag();
    drag.begin(p(1, 20, 20)); drag.move(p(1, 25, 40)); drag.end(1); drag.reset();
    expect(drag.move(p(1, 200, 300))).toBeNull();
    expect(drag.begin(p(2, 200, 300))).toBe(true);
    expect(drag.move(p(2, 204, 305))).toEqual({ dx: 4, dy: 5 });
  });
  it("clears held input on interruption without replaying the old drag", () => {
    const drag = new OwnedPointerDrag();
    for (let i = 0; i < 30; i++) {
      drag.begin(p(i, 20, 20)); drag.move(p(i, 25, 40)); drag.reset();
      expect(drag.activeId).toBeNull(); expect(drag.wasDragged).toBe(false);
      expect(drag.move(p(i, 400, 500))).toBeNull();
    }
  });
  it("rebases viewport discontinuities without turning them into a camera jump", () => {
    const drag = new OwnedPointerDrag(); drag.begin(p(1, 20, 20));
    expect(drag.move(p(1, 20, 600))).toBeNull();
    expect(drag.move(p(1, 23, 604))).toEqual({ dx: 3, dy: 4 });
  });
  it("preserves tap selection while suppressing selection at the end of a swipe", () => {
    const drag = new OwnedPointerDrag(); drag.begin(p(1, 20, 20)); drag.move(p(1, 22, 22)); drag.end(1);
    expect(drag.wasDragged).toBe(false);
    drag.begin(p(2, 20, 20)); drag.move(p(2, 25, 30)); drag.end(2);
    expect(drag.wasDragged).toBe(true);
    drag.reset(); expect(drag.wasDragged).toBe(false);
  });
  it("does not poison a drag with invalid coordinates or a retained DOM event", () => {
    const drag = new OwnedPointerDrag();
    expect(drag.begin(p(1, NaN, 0))).toBe(false);
    const event = p(1, 20, 20); drag.begin(event); event.clientY = 999;
    expect(drag.move(p(1, Infinity, 300))).toBeNull();
    expect(drag.move(p(1, 20, 25))).toEqual({ dx: 0, dy: 5 });
  });
});

describe("walk keyboard scroll prevention", () => {
  it("uses physical keys and supports key-only input", () => {
    expect(walkKey("KeyW", "z")).toBe("KeyW");
    expect(walkKey("", "W")).toBe("KeyW");
    expect(walkKey("", "ArrowDown")).toBe("ArrowDown");
    expect(walkKey("", " ")).toBe("Space");
    expect(walkKey("", "Shift")).toBe("ShiftLeft");
  });
  it("identifies movement keys that otherwise scroll the page", () => {
    for (const key of ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Space", "KeyW"]) expect(isWalkMovementKey(key)).toBe(true);
    for (const key of ["Tab", "Escape", "Enter", "Digit1"]) expect(isWalkMovementKey(key)).toBe(false);
  });
});
