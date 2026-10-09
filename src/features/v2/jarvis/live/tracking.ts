export type FacePoint = { x: number; y: number; z?: number };
export type GazeTarget = { x: number; y: number; roll: number; seen: number };
export const neutralGaze = (): GazeTarget => ({ x: 0, y: 0, roll: 0, seen: 0 });
const clamp = (v: number, n = 1) => Math.max(-n, Math.min(n, v));

/** Nose, eye corners, forehead and chin, in unmirrored camera coordinates. */
export function gazeFromFace(points: FacePoint[], mirror: boolean, now: number): GazeTarget | null {
  if (points.length !== 5 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const [nose, left, right, top, chin] = points;
  const eyeWidth = Math.abs(right.x - left.x);
  if (eyeWidth < .015 || chin.y <= top.y) return null;
  const centerX = (left.x + right.x) / 2;
  const centerY = (top.y + chin.y) / 2;
  // Position directs the gaze; a small nose offset adds attention to a turned face.
  const offset = clamp((nose.x - centerX) / eyeWidth, .35);
  return {
    x: clamp(((centerX - .5) * 4.2 + offset * .15) * (mirror ? -1 : 1)),
    y: clamp((centerY - .48) * 2.6),
    roll: clamp(Math.atan2(right.y - left.y, right.x - left.x), .15) * (mirror ? -1 : 1),
    seen: now,
  };
}

/** Short occlusions hold focus. A lost face relaxes to centre without searching. */
export function currentGaze(target: GazeTarget, now: number): GazeTarget {
  const age = now - target.seen;
  if (!target.seen || age >= 2600) return neutralGaze();
  const hold = age <= 950 ? 1 : 1 - (age - 950) / 1650;
  return { ...target, x: target.x * hold, y: target.y * hold, roll: target.roll * hold };
}

export function damp(current: number, target: number, rate: number, seconds: number) {
  return current + (target - current) * (1 - Math.exp(-rate * Math.min(.1, Math.max(0, seconds))));
}
