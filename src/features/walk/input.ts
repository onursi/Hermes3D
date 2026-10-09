export type PointerSample = { pointerId: number; clientX: number; clientY: number };

/** A drag belongs to one finger until it ends, even during multi-touch. */
export class OwnedPointerDrag {
  private pointer: PointerSample | null = null;
  private distance = 0;

  get activeId() { return this.pointer?.pointerId ?? null; }
  get wasDragged() { return this.distance > 8; }

  begin(sample: PointerSample) {
    if (this.pointer || !Number.isFinite(sample.clientX) || !Number.isFinite(sample.clientY)) return false;
    this.pointer = { pointerId: sample.pointerId, clientX: sample.clientX, clientY: sample.clientY }; this.distance = 0;
    return true;
  }

  move(sample: PointerSample) {
    if (!this.pointer || sample.pointerId !== this.pointer.pointerId || !Number.isFinite(sample.clientX) || !Number.isFinite(sample.clientY)) return null;
    const dx = sample.clientX - this.pointer.clientX, dy = sample.clientY - this.pointer.clientY;
    this.pointer = { pointerId: sample.pointerId, clientX: sample.clientX, clientY: sample.clientY };
    // Rebase a discontinuity (e.g. a viewport change); never turn it into a camera jump.
    if (Math.abs(dx) > 120 || Math.abs(dy) > 120) return null;
    this.distance += Math.hypot(dx, dy);
    return { dx, dy };
  }

  end(pointerId: number) {
    if (pointerId !== this.activeId) return false;
    this.pointer = null;
    return true;
  }

  reset() { this.pointer = null; this.distance = 0; }
}

export function walkKey(code: string, key: string) {
  if (code) return code;
  if (/^[wasd]$/i.test(key)) return `Key${key.toUpperCase()}`;
  if (key === " ") return "Space";
  if (key === "Shift") return "ShiftLeft";
  return key.startsWith("Arrow") ? key : "";
}

export function isWalkMovementKey(key: string) {
  return ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(key);
}
