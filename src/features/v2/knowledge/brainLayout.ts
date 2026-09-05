import * as THREE from "three";

/**
 * The shape of the knowledge body — and why it is a shape at all.
 *
 * Onur's complaint: "aktuell ist es einfach kreuz und quer". He was describing
 * two separate things, and both are fixed here rather than in the renderer:
 *
 * 1. **The areas were ten spheres.** Ten balls of the same kind, at different
 *    coordinates, read as ten balls. A brain reads as a brain because of two
 *    features the eye finds instantly: it is wider than it is tall, and it has
 *    a fissure down the middle. Neither is expensive; both are below.
 *
 * 2. **The edges were straight chords.** 1,132 straight lines through a cloud
 *    is a ball of wool no matter how the nodes are placed — that is ASTRA's
 *    "undifferenzierter Linienball", and it cannot be solved by dimming. Real
 *    tracts curve and run together. `curvePoints` bends every edge toward the
 *    centre, so links between the same two regions travel the same way and
 *    form bundles by themselves.
 *
 * The metaphor stops at the shape. This is not a model of a brain and does not
 * claim to be — V6-07 is explicit that anatomy is inspiration, not a factual
 * assertion. Nothing here means anything medically; it means "your knowledge
 * has regions, and they are connected".
 *
 * **Meaning is unchanged.** Which note sits in which area still comes from the
 * folder it is in, and every edge is still a link the vault records. This file
 * moves things; it does not decide anything.
 */

/**
 * Where each area sits. Left and right are mirrored on purpose: a body with
 * two halves is the single strongest cue that this is anatomy and not a heap.
 */
export const BRAIN_CENTERS: Record<string, [number, number, number]> = {
  // The core, in the middle and slightly high — everything else surrounds it.
  "07🧠Wissen": [0, 1.4, 0],

  // Left hemisphere: who he is and how the system runs.
  "03🪪 Identität": [-7.0, 1.4, 3.4],
  "04📖 Lebensprofil": [-7.7, 6.0, -2.4],
  "02⚙️ System": [-6.1, -2.8, 1.4],

  // Right hemisphere: what he is doing and what he is drawn to.
  "05 🚀 Projekte": [7.0, 1.4, 3.4],
  "06💡Interessen": [7.7, 6.0, -2.4],
  "09🅿️Ideenparkplatz": [4.1, 7.4, 2.2],

  // Behind: what everything rests on.
  "08📚Quellen": [0, 2.8, -9.2],
  // Below and back: the stem. Raw material, unprocessed.
  "01📦RAW": [0, -5.6, -4.0],
  // In front, at the threshold: what has just arrived.
  "00📥Inbox": [0, -1.8, 7.6],

  // Outside the body entirely, and that is the statement: it belongs nowhere.
  Ungeordnet: [11.2, -5.2, -3.4],
};

/**
 * How each region is stretched.
 *
 * Spheres everywhere is what made it read as balls. A lobe that runs
 * front-to-back, a source arc that spreads sideways and a stem that hangs
 * downward are three different silhouettes from the same point count.
 */
export const AREA_SHAPE: Record<string, [number, number, number]> = {
  "07🧠Wissen": [1.05, 0.95, 1.15],
  "03🪪 Identität": [0.78, 0.9, 1.35],
  "04📖 Lebensprofil": [0.78, 0.9, 1.3],
  "02⚙️ System": [0.85, 0.8, 1.25],
  "05 🚀 Projekte": [0.78, 0.9, 1.35],
  "06💡Interessen": [0.78, 0.9, 1.3],
  "09🅿️Ideenparkplatz": [0.9, 0.75, 1.0],
  "08📚Quellen": [1.45, 0.75, 0.75],
  "01📦RAW": [0.95, 0.8, 1.15],
  "00📥Inbox": [1.05, 0.7, 0.85],
  Ungeordnet: [0.85, 0.85, 0.85],
};

/** Half-width of the gap down the middle. The one detail that says "brain". */
const FISSURE = 1.15;

/**
 * Push a point out of the midline, unless its area lives there.
 *
 * The fissure is what the eye reads first, and without it two hemispheres are
 * just a wide cloud. Areas that genuinely belong on the centre line — the
 * core, the sources, the stem, the inbox — are exempt, because pushing them
 * aside would split things the data says are one.
 */
export function applyFissure(point: THREE.Vector3, centreX: number): THREE.Vector3 {
  if (Math.abs(centreX) < 0.5) return point;
  const side = Math.sign(centreX);
  if (Math.sign(point.x) === side && Math.abs(point.x) >= FISSURE) return point;
  point.x = side * (FISSURE + Math.abs(point.x) * 0.85);
  return point;
}

/**
 * A curved path from one note to another, sampled into points.
 *
 * The control point is the midpoint pulled toward the body's centre. That one
 * choice does the whole job: two links between the same pair of regions get
 * nearly the same curve, so they lie together and form a visible tract, and a
 * link that crosses the middle bends *through* the core rather than cutting
 * across it in a straight line.
 *
 * `sag` scales with distance, so short links inside one area stay almost
 * straight — bending those would be decoration, not structure.
 */
export function curvePoints(
  from: THREE.Vector3,
  to: THREE.Vector3,
  centre: THREE.Vector3,
  samples: number,
): THREE.Vector3[] {
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const span = from.distanceTo(to);
  const sag = Math.min(0.42, 0.06 + span * 0.026);
  const control = mid.lerp(centre, sag);

  const curve = new THREE.QuadraticBezierCurve3(from, control, to);
  return curve.getPoints(samples);
}
