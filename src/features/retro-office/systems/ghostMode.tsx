"use client";

import { PointerLockControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Gliding through the room rather than steering around it.
 *
 * The first version was WASD, which means the flight only happens while you
 * hold a key and stops the moment you want to look at something. Onur asked
 * for the opposite and he is right: you are always moving forward, the mouse
 * points where forward is, and when something is worth reading you stop.
 *
 * So there are exactly two states. Cruising, where the camera drifts along
 * whatever direction it faces — pitch the mouse up and you climb, down and you
 * descend, no separate altitude control needed. And halted, where it coasts to
 * a stop and the field of view widens a little, which is what "step back to
 * take it in" looks like without actually moving away from what you came to
 * see. Space swaps between them.
 *
 * WASD still nudges sideways and vertically. It costs nothing to keep and it
 * is the difference between drifting past a console and lining up on it.
 *
 * Movement floats rather than simulating a body. There is no collision mesh in
 * this scene, so a physics character would either pass through walls anyway or
 * snag on a chair; a ghost has neither problem, and drifting down through the
 * floor into the war room reads as a feature.
 */

/** Forward drift, in metres per second. A slow walk — the room is small. */
const CRUISE_SPEED = 2.6;
/** Held shift while cruising. Crosses the floor without feeling like a cannon. */
const CRUISE_BOOST = 7.5;
/** Sideways and vertical nudge from WASD, independent of the drift. */
const NUDGE_SPEED = 2.4;
/**
 * How quickly velocity reaches what the controls ask for. High enough to feel
 * responsive, low enough that stopping eases out instead of snapping.
 */
const DAMPING = 6;

/** Field of view while moving, and the wider one used when halted to look. */
const FOV_CRUISE = 60;
const FOV_LOOK = 74;

/** Eye height when entering, in metres above the floor. */
export const GHOST_EYE_HEIGHT = 1.62;

/** Keeps you inside the world: below the war room, above the orbital view. */
const MIN_Y = -9;
const MAX_Y = 14;

type Props = {
  active: boolean;
  /** Called when the pointer lock ends, including via Escape. */
  onExit: () => void;
  /** Where to stand on entry, usually the floor's centre. */
  entry?: [number, number, number];
  /** Told whether the camera is drifting, so the HUD can say which. */
  onCruisingChange?: (cruising: boolean) => void;
};

export function GhostMode({ active, onExit, entry, onCruisingChange }: Props) {
  const camera = useThree((state) => state.camera);
  /**
   * The camera, held by reference.
   *
   * Driving a camera means writing to it every frame, and the compiler
   * rightly refuses direct writes to a value a hook returned. A ref is the
   * honest way to say "this object is mine to mutate for the duration".
   */
  const cameraRef = useRef(camera);
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);
  const keys = useRef<Record<string, boolean>>({});
  // Refs rather than memos: these are scratch vectors reused every frame, and
  // a value the compiler believes is immutable is not one you may write into.
  const velocityRef = useRef(new THREE.Vector3());
  const forwardRef = useRef(new THREE.Vector3());
  const rightRef = useRef(new THREE.Vector3());
  const desiredRef = useRef(new THREE.Vector3());
  const cruisingRef = useRef(true);
  /** Where the orbit camera stood, so leaving puts it back exactly. */
  const restoreRef = useRef<{
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    fov: number;
  } | null>(null);

  useEffect(() => {
    if (!active) return;
    // Captured once so the cleanup writes to the same vector the frame loop did.
    const velocity = velocityRef.current;
    const perspective = camera as THREE.PerspectiveCamera;
    restoreRef.current = {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      fov: perspective.fov ?? FOV_CRUISE,
    };
    cruisingRef.current = true;
    onCruisingChange?.(true);
    if (entry) {
      // Step in at the given spot and look level, so the first frame inside is
      // a room rather than whatever the orbit camera was pointing at.
      const [x, , z] = entry;
      camera.position.set(x, GHOST_EYE_HEIGHT, z + 3.2);
      camera.lookAt(x, GHOST_EYE_HEIGHT, z);
    }
    return () => {
      const restore = restoreRef.current;
      if (!restore) return;
      camera.position.copy(restore.position);
      camera.quaternion.copy(restore.quaternion);
      const perspectiveOut = camera as THREE.PerspectiveCamera;
      if (typeof perspectiveOut.fov === "number") {
        perspectiveOut.fov = restore.fov;
        perspectiveOut.updateProjectionMatrix();
      }
      velocity.set(0, 0, 0);
      restoreRef.current = null;
    };
  }, [active, camera, entry, onCruisingChange]);

  useEffect(() => {
    if (!active) {
      keys.current = {};
      return;
    }
    const down = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        // Space is the whole control scheme: stop to look, press again to go.
        event.preventDefault();
        if (event.repeat) return;
        cruisingRef.current = !cruisingRef.current;
        onCruisingChange?.(cruisingRef.current);
        return;
      }
      keys.current[event.code] = true;
    };
    const up = (event: KeyboardEvent) => {
      keys.current[event.code] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      keys.current = {};
    };
  }, [active, onCruisingChange]);

  useFrame((_, rawDelta) => {
    if (!active) return;
    // A tab that was in the background hands over a huge delta; without this
    // the first frame back teleports you across the map.
    const delta = Math.min(rawDelta, 0.1);
    const pressed = keys.current;
    const forward = forwardRef.current;
    const right = rightRef.current;
    const desired = desiredRef.current;
    const velocity = velocityRef.current;
    const cruising = cruisingRef.current;

    // Full 3D forward, deliberately not flattened: aiming the mouse upward is
    // how you gain height, which is one control instead of two.
    camera.getWorldDirection(forward);
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();

    desired.set(0, 0, 0);
    if (cruising) {
      const boosted = pressed.ShiftLeft || pressed.ShiftRight;
      desired.addScaledVector(forward, boosted ? CRUISE_BOOST : CRUISE_SPEED);
    }
    // Nudges work in both states, so a halt can still be lined up precisely.
    if (pressed.KeyD || pressed.ArrowRight) desired.addScaledVector(right, NUDGE_SPEED);
    if (pressed.KeyA || pressed.ArrowLeft) desired.addScaledVector(right, -NUDGE_SPEED);
    if (pressed.KeyW || pressed.ArrowUp) desired.addScaledVector(forward, NUDGE_SPEED);
    if (pressed.KeyS || pressed.ArrowDown) desired.addScaledVector(forward, -NUDGE_SPEED);
    if (pressed.KeyE) desired.y += NUDGE_SPEED;
    if (pressed.KeyQ || pressed.ControlLeft || pressed.ControlRight) desired.y -= NUDGE_SPEED;

    const blend = 1 - Math.exp(-DAMPING * delta);
    velocity.lerp(desired, blend);
    camera.position.addScaledVector(velocity, delta);
    camera.position.setY(THREE.MathUtils.clamp(camera.position.y, MIN_Y, MAX_Y));

    // Widening the view when halted reads as leaning back to take something in,
    // and it does it without moving away from what you stopped for.
    const perspective = cameraRef.current as THREE.PerspectiveCamera;
    if (typeof perspective.fov === "number") {
      const targetFov = cruising ? FOV_CRUISE : FOV_LOOK;
      const nextFov = perspective.fov + (targetFov - perspective.fov) * Math.min(1, delta * 4);
      if (Math.abs(nextFov - perspective.fov) > 0.01) {
        perspective.fov = nextFov;
        perspective.updateProjectionMatrix();
      }
    }
  });

  if (!active) return null;
  return <PointerLockControls onUnlock={onExit} makeDefault={false} />;
}
