"use client";

import { PointerLockControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Walk into the room.
 *
 * The orbit camera looks at the office the way you look at a model on a table:
 * always from outside, always at arm's length. This lets you stand in it
 * instead — mouse to look, WASD to move, space and shift to rise and sink.
 *
 * That is not only for the fun of it, though it is fun. The room's whole
 * premise is that space carries meaning: distance means relevance, position
 * means category, and a display you have to walk up to is a display you will
 * remember the location of. None of that lands from a fixed orbit. It lands
 * when the wall is further away than the desk.
 *
 * Movement is deliberately floating rather than a physics body. There is no
 * collision mesh in this scene, and inventing one would mean either walking
 * through walls anyway or getting stuck on a chair — a ghost has neither
 * problem, and passing through a wall to reach the war room below reads as a
 * feature rather than a bug.
 */

/** Metres per second on the ground plane. Roughly a brisk walk. */
const WALK_SPEED = 3.2;
/** Held shift. Fast enough to cross the floor without feeling like a cannon. */
const SPRINT_SPEED = 8.5;
/** Vertical speed for space/ctrl, slower so height stays controllable. */
const LIFT_SPEED = 2.4;
/**
 * How quickly the camera reaches the speed the keys ask for. High enough to
 * feel responsive, low enough that stopping does not snap.
 */
const DAMPING = 9;

/** Eye height when entering, in metres above the floor. */
export const GHOST_EYE_HEIGHT = 1.62;

/** Keeps you inside the world: below the war room, above the orbital view. */
const MIN_Y = -9;
const MAX_Y = 14;

type Props = {
  active: boolean;
  /** Called when the pointer lock ends, including via Escape. */
  onExit: () => void;
  /**
   * Where to stand on entry, usually the floor's centre. Without it you would
   * begin wherever the orbit camera happened to be — often twenty metres out
   * in space, staring at the back of a wall.
   */
  entry?: [number, number, number];
};

export function GhostMode({ active, onExit, entry }: Props) {
  const camera = useThree((state) => state.camera);
  const keys = useRef<Record<string, boolean>>({});
  // Refs rather than memos: these are scratch vectors reused every frame, and
  // a value the compiler believes is immutable is not one you may write into.
  const velocityRef = useRef(new THREE.Vector3());
  const forwardRef = useRef(new THREE.Vector3());
  const rightRef = useRef(new THREE.Vector3());
  const desiredRef = useRef(new THREE.Vector3());
  /** Where the orbit camera stood, so leaving puts it back exactly. */
  const restoreRef = useRef<{ position: THREE.Vector3; quaternion: THREE.Quaternion } | null>(null);

  useEffect(() => {
    if (!active) return;
    restoreRef.current = {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
    };
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
      restoreRef.current = null;
    };
  }, [active, camera, entry]);

  useEffect(() => {
    if (!active) {
      keys.current = {};
      return;
    }
    const down = (event: KeyboardEvent) => {
      keys.current[event.code] = true;
      // Space scrolls the page by default, which is a nasty surprise mid-flight.
      if (event.code === "Space") event.preventDefault();
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
  }, [active]);

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

    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();

    desired.set(0, 0, 0);
    if (pressed.KeyW || pressed.ArrowUp) desired.add(forward);
    if (pressed.KeyS || pressed.ArrowDown) desired.sub(forward);
    if (pressed.KeyD || pressed.ArrowRight) desired.add(right);
    if (pressed.KeyA || pressed.ArrowLeft) desired.sub(right);

    const speed = pressed.ShiftLeft || pressed.ShiftRight ? SPRINT_SPEED : WALK_SPEED;
    if (desired.lengthSq() > 0) desired.normalize().multiplyScalar(speed);

    let lift = 0;
    if (pressed.Space) lift += LIFT_SPEED;
    if (pressed.ControlLeft || pressed.ControlRight || pressed.KeyC) lift -= LIFT_SPEED;
    desired.y = lift;

    // Exponential approach: frame-rate independent, and stopping eases out.
    const blend = 1 - Math.exp(-DAMPING * delta);
    velocity.lerp(desired, blend);
    camera.position.addScaledVector(velocity, delta);
    camera.position.setY(THREE.MathUtils.clamp(camera.position.y, MIN_Y, MAX_Y));
  });

  if (!active) return null;
  return <PointerLockControls onUnlock={onExit} makeDefault={false} />;
}
