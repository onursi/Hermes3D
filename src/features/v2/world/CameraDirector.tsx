"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import type { V2World } from "@/features/v2/state";

/**
 * One camera, two worlds, no cuts.
 *
 * The counter-model's promise is that Onur never leaves — the horizon comes
 * closer. That is only true if the camera *moves* rather than jumps, so this
 * interpolates between composed viewpoints instead of assigning a position.
 *
 * It also owns the two things section B insists on: home is reachable at any
 * moment, and the way back is the same movement in reverse.
 */

/** The composed three-quarter view the stage was designed for. */
export const HOME_VIEW = {
  position: new THREE.Vector3(5.4, 4.1, 7.4),
  target: new THREE.Vector3(0, 1.1, 0),
};

export type CameraGoal = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  /** Seconds. A warp is deliberately slower than a correction. */
  duration: number;
  /**
   * Be there on the next frame. No interpolation, no waiting.
   *
   * This is what the dock uses. It is the same code path reduced motion has
   * always taken, given a name and a second caller — which is the honest way
   * to build it: the instant arrival was never the accessibility compromise,
   * it was the better default hiding inside one.
   */
  instant?: boolean;
  pull?: boolean;
};

/**
 * The yard, seen from the outside and slightly above.
 *
 * Fixed rather than derived, and for a reason the cosmos does not share: the
 * berths stand on a ring of known radius, so the framing cannot drift when the
 * data changes. A seventh project moves the ring not at all.
 */
export const PROJECTS_VIEW = {
  position: new THREE.Vector3(0, 31, 78),
  target: new THREE.Vector3(0, 0, 0),
};

export const PROJECT_INSIDE_VIEW = {
  position: new THREE.Vector3(0, 9.5, 21),
  target: new THREE.Vector3(0, 0.2, 0),
};

/**
 * The library, from the reading table looking into the shelves.
 *
 * Closer than the other worlds on purpose: a library is a room you stand in,
 * not a landscape you survey. The other three are seen from outside.
 */
export const LIBRARY_VIEW = {
  position: new THREE.Vector3(6.8, 4.6, 8.2),
  target: new THREE.Vector3(-1.2, 2.0, -2.4),
};

/**
 * The first look out from the platform, standing off it.
 *
 * Behind and above home, facing the places: the point is that the first frame
 * of free flight already answers "where is everything", so that steering is a
 * choice rather than a search.
 */
export const UNIVERSE_VIEW = {
  position: new THREE.Vector3(0, 7, 22),
  target: new THREE.Vector3(0, -5, -48),
};

/**
 * The knowledge areas, framed whole and slightly from above.
 *
 * W1's areas span roughly ±11 across and ±6 vertically, and the widest one —
 * the sources — reaches nine units on its own. Standing back far enough to
 * hold all of that is the difference between "a body with regions" and "a
 * thicket two metres from the lens", which is what the old fixed viewpoint
 * produced before the cosmos framing was derived.
 */
export const KNOWLEDGE_VIEW = {
  position: new THREE.Vector3(0, 5.5, 31),
  target: new THREE.Vector3(0, 1, 0),
};

export const TESSERACT_VIEW = {
  position: new THREE.Vector3(0, 3.2, 14),
  target: new THREE.Vector3(0, 3.0, 0),
};

export function viewFor(world: V2World): CameraGoal {
  if (["horizon","flow","atelier","sanctuary","success"].includes(world)) return {position:new THREE.Vector3(0,world==='success'?6:17,world==='success'?42:45),target:new THREE.Vector3(0,world==='success'?5:0,world==='success'?-15:0),duration:1.4};
  if (world === "memory") return { position: new THREE.Vector3(0, 17, 34), target: new THREE.Vector3(0, 0, 0), duration: 1.2 };
  if (world === "universe") return { ...cloneView(UNIVERSE_VIEW), duration: 1.15 };
  if (world === "cosmos") {
    // The knowledge world is W1's layout now, and W1 places its areas on its
    // own fixed coordinates rather than on the graph's. Deriving the framing
    // from `vault.radius` would frame a cloud that is no longer there.
    return { ...cloneView(KNOWLEDGE_VIEW), duration: 1.15 };
  }
  if (world === "projects") return { ...cloneView(PROJECTS_VIEW), duration: 1.15 };
  if (world === "library") return { ...cloneView(LIBRARY_VIEW), duration: 1.15 };
  if (world === "tesseract") return { ...cloneView(TESSERACT_VIEW), duration: 1.15 };
  return { ...cloneView(HOME_VIEW), duration: 1.15 };
}

const cloneView = (view: { position: THREE.Vector3; target: THREE.Vector3 }) => ({
  position: view.position.clone(),
  target: view.target.clone(),
});

type Controls = { target: THREE.Vector3; update: () => void; enabled: boolean };

/**
 * Drives the camera toward a goal, then hands control back.
 *
 * `goal` is null while the user is free to orbit. Setting a goal takes over
 * for its duration; when it lands, control returns — which is why a warp does
 * not feel like a cutscene you have to sit through.
 */
export function CameraDirector({
  goal,
  controlsRef,
  speed,
  reducedMotion,
  onArrive,
  onSampleHome,
}: {
  goal: CameraGoal | null;
  controlsRef: React.MutableRefObject<Controls | null>;
  /** Onur's flight-speed preference. Scales the approach, never the distance. */
  speed: number;
  reducedMotion: boolean;
  onArrive: () => void;
  /** Reports the live home camera so returning lands where he left. */
  onSampleHome?: (position: THREE.Vector3, target: THREE.Vector3) => void;
}) {
  const camera = useThree((state) => state.camera);
  const elapsed = useRef(0);
  const fromPosition = useRef(new THREE.Vector3());
  const fromTarget = useRef(new THREE.Vector3());
  const active = useRef(false);

  useEffect(() => {
    if (!goal) {
      active.current = false;
      return;
    }
    fromPosition.current.copy(camera.position);
    fromTarget.current.copy(controlsRef.current?.target ?? new THREE.Vector3());
    elapsed.current = 0;
    active.current = true;

    // Straight there, for either of two reasons: the caller asked for a cut
    // (the dock), or motion is reduced. The plan asks for a direct change
    // rather than a shortened animation — a fast warp is still a warp, and
    // the setting exists for people for whom that is the problem.
    if (goal.instant || reducedMotion) {
      camera.position.copy(goal.position);
      if (controlsRef.current) {
        controlsRef.current.target.copy(goal.target);
        controlsRef.current.update();
      } else {
        // Without orbit controls nothing else aims the camera, and a position
        // without a heading is not a viewpoint. This branch used to be reached
        // only under reduced motion, where the controls were always mounted —
        // so the omission was invisible until the dock and the universe both
        // started using it, and the first frame of the app came up facing the
        // empty half of the sky.
        camera.lookAt(goal.target);
      }
      active.current = false;
      if(controlsRef.current)controlsRef.current.enabled=true;
      onArrive();
    }
  }, [goal, camera, controlsRef, reducedMotion, onArrive]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;

    if (!active.current || !goal) {
      // Free look. Sample where he is standing, so "home" means the view he
      // actually left rather than the one the designer chose.
      if (controls && onSampleHome) onSampleHome(camera.position, controls.target);
      return;
    }

    if (controls) controls.enabled = false;

    // Speed scales the approach and is clamped: a warp is a change of world,
    // not a numerically enormous physical flight.
    const rate = THREE.MathUtils.clamp(speed, 0.5, 3);
    elapsed.current += delta * rate;
    const t = Math.min(1, elapsed.current / goal.duration);
    // Ease in and out: leaves unhurried, arrives settled.
    const eased = goal.pull ? Math.pow(t,2.4) : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    camera.position.lerpVectors(fromPosition.current, goal.position, eased);
    if (controls) {
      controls.target.lerpVectors(fromTarget.current, goal.target, eased);
      controls.update();
    } else {
      camera.lookAt(goal.target);
    }

    if (t >= 1) {
      active.current = false;
      if (controls) controls.enabled = true;
      onArrive();
    }
  });

  return null;
}
