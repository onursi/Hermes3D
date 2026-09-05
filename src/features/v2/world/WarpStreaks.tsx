"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * The warp: light drawn out into lines, for as long as the journey lasts.
 *
 * Onur asked to travel "mit Lichtgeschwindigkeit". This is the whole of that
 * effect and it costs one draw call: 220 segments in a single LineSegments,
 * stretched along the direction of travel and faded in and out.
 *
 * It exists only while travelling. Mounted never, drawn never, when standing
 * still — which is the difference between an effect and a decoration.
 */

const STREAK_COUNT = 220;

export function WarpStreaks({ progress }: { progress: number }) {
  const linesRef = useRef<THREE.LineSegments>(null);
  const materialRef = useRef<THREE.LineBasicMaterial>(null);

  const { geometry, seeds } = useMemo(() => {
    const positions = new Float32Array(STREAK_COUNT * 6);
    const seedList: { x: number; y: number; z: number }[] = [];
    // Deterministic, so two journeys look like the same tunnel rather than
    // two different ones — the room should feel like a place.
    let seed = 11;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < STREAK_COUNT; i += 1) {
      const angle = rnd() * Math.PI * 2;
      const radius = 1.6 + rnd() * 7.5;
      seedList.push({
        x: Math.cos(angle) * radius,
        y: (rnd() - 0.5) * 9,
        z: Math.sin(angle) * radius,
      });
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { geometry: buffer, seeds: seedList };
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ camera }) => {
    const attribute = geometry.getAttribute("position") as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;

    // Streaks live in front of the camera and stretch along its own forward
    // axis, so the tunnel is wherever he is looking.
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    // Longest in the middle of the journey, nothing at either end.
    const stretch = Math.sin(Math.min(1, Math.max(0, progress)) * Math.PI) * 6.5;

    for (let i = 0; i < STREAK_COUNT; i += 1) {
      const seed = seeds[i];
      const base = new THREE.Vector3()
        .copy(camera.position)
        .addScaledVector(forward, 6 + ((i * 0.37) % 9))
        .addScaledVector(right, seed.x)
        .addScaledVector(up, seed.y * 0.5);

      const tip = base.clone().addScaledVector(forward, -stretch * (0.4 + (i % 7) / 10));

      array[i * 6 + 0] = base.x;
      array[i * 6 + 1] = base.y;
      array[i * 6 + 2] = base.z;
      array[i * 6 + 3] = tip.x;
      array[i * 6 + 4] = tip.y;
      array[i * 6 + 5] = tip.z;
    }
    attribute.needsUpdate = true;

    if (materialRef.current) {
      materialRef.current.opacity = Math.sin(Math.min(1, Math.max(0, progress)) * Math.PI) * 0.62;
    }
  });

  return (
    <lineSegments ref={linesRef} geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial
        ref={materialRef}
        color="#9fd8ff"
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}
