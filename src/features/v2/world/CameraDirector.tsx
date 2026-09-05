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
};

/**
 * Where to stand to see a cosmos of a given size.
 *
 * Derived, not chosen. A fixed viewpoint put the camera inside the graph and
 * turned a knowledge map into a thicket of lines two metres from the lens.
 * 1.9 radii back and a third of a radius up frames the whole cloud with air
 * around it, whatever the vault currently holds.
 */
export function cosmosView(
  radius: number,
  centre: THREE.Vector3,
): { position: THREE.Vector3; target: THREE.Vector3 } {
  const distance = Math.max(14, radius * 1.75);
  return {
    position: centre
      .clone()
      .add(new THREE.Vector3(distance * 0.3, radius * 0.3, distance)),
    target: centre.clone(),
  };
}

/**
 * The yard, seen from the outside and slightly above.
 *
 * Fixed rather than derived, and for a reason the cosmos does not share: the
 * berths stand on a ring of known radius, so the framing cannot drift when the
 * data changes. A seventh project moves the ring not at all.
 */
export const PROJECTS_VIEW = {
  position: new THREE.Vector3(0.6, 8.4, 15.2),
  target: new THREE.Vector3(0, 1.7, 0),
};

export function viewFor(
  world: V2World,
  cosmosRadius = 12,
  cosmosCentre = new THREE.Vector3(),
): CameraGoal {
  if (world === "cosmos") {
    return { ...cloneView(cosmosView(cosmosRadius, cosmosCentre)), duration: 1.15 };
  }
  if (world === "projects") return { ...cloneView(PROJECTS_VIEW), duration: 1.15 };
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

    // Reduced motion gets the destination immediately. The plan asks for a
    // direct change rather than a shortened animation — a fast warp is still
    // a warp, and the setting exists for people for whom that is the problem.
    if (reducedMotion) {
      camera.position.copy(goal.position);
      if (controlsRef.current) {
        controlsRef.current.target.copy(goal.target);
        controlsRef.current.update();
      }
      active.current = false;
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
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

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
