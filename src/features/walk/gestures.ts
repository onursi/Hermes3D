export const GESTURES = [
  { id: "thumbs", label: "Beide Daumen hoch", icon: "👍", key: "1", duration: 1.9 },
  { id: "bump", label: "Fäuste zusammen", icon: "👊", key: "2", duration: 1.65 },
  { id: "boxing", label: "Schattenboxen", icon: "🥊", key: "3", duration: 2.6 },
] as const;
export type Gesture = typeof GESTURES[number]["id"];
export type GestureClip = { kind: Gesture; started: number };
export type HandPose = { position: [number, number, number]; rotation: [number, number, number]; curl: number; thumb: number; point: number };

const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const pulse = (t: number, centre: number, width: number) => Math.max(0, 1 - Math.abs(t - centre) / width) ** 1.35;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Camera-local poses: fast attacks, short holds, smooth return, no cumulative rotation. */
export function handPose(side: -1 | 1, kind: Gesture | null, seconds: number, pointing = false, reduced = false): HandPose {
  const idle: HandPose = { position: [side * .19, -.21, -.42], rotation: [.35, -side * .25, -side * .35], curl: pointing && side === 1 ? 1.35 : .32, thumb: 0, point: pointing && side === 1 ? 1 : 0 };
  const gesture = GESTURES.find(g => g.id === kind);
  if (!gesture || !Number.isFinite(seconds) || seconds < 0 || seconds >= gesture.duration) return idle;
  const weight = reduced ? 1 : smooth(seconds / .19) * smooth((gesture.duration - seconds) / .36);
  let position: HandPose["position"], rotation: HandPose["rotation"];
  if (kind === "thumbs") {
    position = [side * .145, -.025, -.34];
    rotation = [1.25, -side * .10, side * .08];
  } else if (kind === "bump") {
    const hit = reduced ? 1 : smooth((seconds - .16) / .25) * (1 - smooth((seconds - .92) / .27));
    const rebound = reduced ? 0 : pulse(seconds, .59, .1) * .012 + pulse(seconds, .79, .08) * .005;
    position = [side * (.17 - hit * .118 + rebound), -.09, -.35];
    rotation = [.6, side * .25, -side * .18];
  } else {
    const punch = reduced ? 0 : side === -1 ? Math.max(pulse(seconds, .48, .18), pulse(seconds, 1.19, .2)) : Math.max(pulse(seconds, .83, .2), pulse(seconds, 1.66, .22));
    const slip = reduced ? 0 : Math.sin(seconds * 11) * .006;
    position = [side * (.165 - punch * .10), -.085 + punch * .045 + slip, -.33 - punch * .29];
    rotation = [.28 - punch * .2, -side * (.32 - punch * .24), -side * .13 + side * punch * .14];
  }
  return {
    position: idle.position.map((v, i) => mix(v, position[i], weight)) as HandPose["position"],
    rotation: idle.rotation.map((v, i) => mix(v, rotation[i], weight)) as HandPose["rotation"],
    curl: mix(idle.curl, 1.45, weight), thumb: kind === "thumbs" ? weight : 0, point: 0,
  };
}

/** Controls must not react to typing, dialog shortcuts, or a button's Space key. */
export function isWalkInputTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('input,textarea,select,button,a,[contenteditable="true"],[role="dialog"]'));
}
