"use client";

import { useMemo } from "react";
import * as THREE from "three";

import { FreeFlight } from "@/features/v2/universe/FreeFlight";
import { Silhouettes } from "@/features/v2/universe/Silhouettes";
import type { Place } from "@/features/v2/universe/places";

/**
 * The space between the places.
 *
 * Three things and nothing else: the silhouettes, the flight, and a field of
 * fixed stars. The stars are not decoration — without something static in the
 * distance, moving through empty black looks exactly like standing still, and
 * the whole feature falls over. They are the cheapest possible fix: one draw,
 * no animation, and correct under reduced motion without a special case.
 */

export function UniverseWorld({
  places,
  activeId,
  reachableId,
  speed,
  reducedMotion = false,
  flightEnabled,
  onReachChange,
  onSample,
  onFocusPlace,
}: {
  places: Place[];
  /** Never set while the universe is the mounted world — kept for symmetry. */
  activeId: string | null;
  reachableId: string | null;
  speed: number;
  reducedMotion?: boolean;
  /**
   * False while the camera is being flown somewhere by the director.
   *
   * Two things writing the camera in the same frame is not a race that
   * resolves — it is a fight, and the visible result is a jitter that looks
   * like a broken frame rate rather than a broken control scheme.
   */
  flightEnabled: boolean;
  onReachChange: (place: Place | null) => void;
  onSample: (position: THREE.Vector3, target: THREE.Vector3) => void;
  onFocusPlace: (place: Place) => void;
}) {
  return (
    <group>
      <FixedStars />
      <Silhouettes
        places={places}
        activeId={activeId}
        reachableId={reachableId}
        reducedMotion={reducedMotion}
        onFocus={onFocusPlace}
      />
      {flightEnabled ? (
        <FreeFlight
          places={places}
          speed={speed}
          onReachChange={onReachChange}
          onSample={onSample}
        />
      ) : null}
      {/* Enough light to give the silhouettes a lit side. The stage lights
          belong to home and are not mounted out here. */}
      <hemisphereLight args={["#8d8578", "#07070a", 0.9]} />
      <directionalLight position={[40, 60, 30]} intensity={0.75} color="#fff1e0" />
    </group>
  );
}

/**
 * A shell of fixed stars, well outside the boundary he can reach.
 *
 * Deterministic for the same reason the knowledge body is: the sky should be
 * the same sky every time he goes out. A different star field on every mount
 * would make the universe feel randomly generated, which is the opposite of
 * what a place is.
 */
function FixedStars() {
  const geometry = useMemo(() => {
    const count = 1400;
    const positions = new Float32Array(count * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i += 1) {
      const y = 1 - (i / (count - 1)) * 2;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      // Just outside the flight boundary, so he can never reach the backdrop
      // and discover it is a sphere.
      const shell = 300 + ((i * 53) % 40);
      positions[i * 3] = Math.cos(theta) * ring * shell;
      positions[i * 3 + 1] = y * shell;
      positions[i * 3 + 2] = Math.sin(theta) * ring * shell;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color="#d5d8de"
        size={1.5}
        sizeAttenuation={false}
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </points>
  );
}
