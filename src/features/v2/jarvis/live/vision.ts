/** Pure measurements on the MediaPipe face mesh (flat x,y pairs, normalised to the camera frame). */
export const FACE_OVAL = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
export const EYE_A = [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246];
export const EYE_B = [263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466];
export const LIPS = [61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185];
export const IRIS_A = 468, IRIS_B = 473;
const at = (mesh: Float32Array, i: number) => [mesh[i * 2], mesh[i * 2 + 1]] as const;
const gap = (mesh: Float32Array, a: number, b: number, aspect: number) => { const [ax, ay] = at(mesh, a), [bx, by] = at(mesh, b); return Math.hypot((ax - bx) * aspect, ay - by); };

export const hasIris = (mesh: Float32Array | null): mesh is Float32Array => !!mesh && mesh.length >= 478 * 2;

/** Lid opening relative to eye width; about .25 to .35 open, below .12 closed. */
export function eyeOpenness(mesh: Float32Array, aspect: number) {
  const a = gap(mesh, 159, 145, aspect) / Math.max(1e-6, gap(mesh, 33, 133, aspect));
  const b = gap(mesh, 386, 374, aspect) / Math.max(1e-6, gap(mesh, 263, 362, aspect));
  return (a + b) / 2;
}

/** Rough camera distance from the visible iris width (a human iris is close to 11.7 mm).
 * Assumes a typical webcam field of view, so it is an estimate, not a measurement. */
export function distanceCm(mesh: Float32Array, horizontalFovDeg = 62) {
  if (!hasIris(mesh)) return null;
  const width = (Math.abs(mesh[469 * 2] - mesh[471 * 2]) + Math.abs(mesh[474 * 2] - mesh[476 * 2])) / 2;
  if (!(width > .004)) return null;
  const focal = .5 / Math.tan(horizontalFovDeg * Math.PI / 360);
  const cm = 1.17 * focal / width;
  return cm > 15 && cm < 400 ? cm : null;
}

export function bounds(mesh: Float32Array, indices = FACE_OVAL) {
  let l = 1, r = 0, t = 1, b = 0;
  for (const i of indices) { const [x, y] = at(mesh, i); l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); }
  return { l, r, t, b };
}

/** MediaPipe pose joints drawn as the body frame: shoulders, arms, torso, legs. */
export const SKELETON: [number, number][] = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];

/** Turns a soft person mask (alpha channel) into outline, faint grid fill and a travelling scan band, in place. */
export function shadeSilhouette(data: Uint8ClampedArray, width: number, height: number, sweep: number) {
  for (let y = 0; y < height; y++) {
    const band = Math.max(0, 1 - Math.abs(y / height - sweep) / .06);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4, a = data[i + 3] / 255;
      const edge = Math.max(0, 1 - Math.abs(a - .5) / .2);
      const fill = a > .5 ? .05 + (y % 6 === 0 || x % 10 === 0 ? .1 : 0) + band * .5 : 0;
      const light = Math.min(1, edge + band * (a > .5 ? .6 : 0));
      data[i] = 120 + 135 * light * .6; data[i + 1] = 211 + 44 * light * .6; data[i + 2] = 255;
      data[i + 3] = Math.min(1, edge * .95 + fill) * 255;
    }
  }
}
