"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Scheduled jobs as comets.
 *
 * One comet per cron job, and the sky is empty when nothing is scheduled —
 * which it is today, because the Kompass jobs are paused. That emptiness is
 * the feature working, not the feature missing: a sky with comets in it means
 * something is genuinely set to run.
 *
 *   enabled   steady on its ellipse, bright, trailing forward
 *   disabled  dim and tumbling, still on its path — a paused job has not
 *             stopped existing, and hiding it would lose the fact that you
 *             once decided it should run
 *
 * The period is not the real schedule. A job that fires weekly cannot be
 * animated at its true rate without being invisible, so the orbit reads as
 * "this recurs", and the name says how often. Guessing a visual rate and
 * calling it the schedule would be the kind of lie this room refuses.
 */

export type CometJob = {
  id: string;
  name: string;
  enabled: boolean;
};

export function CronComets({
  jobs,
  position = [0, 10, 0],
}: {
  jobs: CometJob[];
  position?: [number, number, number];
}) {
  const groupRef = useRef<THREE.Group>(null);

  const paths = useMemo(
    () =>
      jobs.map((job, index) => ({
        ...job,
        // Ellipses rather than circles, tilted differently per job, so several
        // comets read as separate errands instead of one carousel.
        radiusX: 19 + index * 3.5,
        radiusZ: 12 + index * 2.2,
        tilt: 0.25 + index * 0.18,
        phase: (index / Math.max(1, jobs.length)) * Math.PI * 2,
        speed: job.enabled ? 0.055 + index * 0.008 : 0.02,
      })),
    [jobs],
  );

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    group.children.forEach((child, index) => {
      const path = paths[index];
      if (!path) return;
      child.userData.angle = (child.userData.angle ?? path.phase) + delta * path.speed;
      const angle = child.userData.angle as number;
      child.position.set(
        Math.cos(angle) * path.radiusX,
        Math.sin(angle) * path.tilt * 6,
        Math.sin(angle) * path.radiusZ,
      );
      // A paused job tumbles. Motion that is not going anywhere is what
      // "scheduled but switched off" looks like without a label.
      if (!path.enabled) {
        child.rotation.x += delta * 1.6;
        child.rotation.z += delta * 1.1;
      }
    });
  });

  if (paths.length === 0) return null;

  return (
    <group ref={groupRef} position={position}>
      {paths.map((path) => (
        <group key={path.id}>
          <mesh>
            <sphereGeometry args={[path.enabled ? 0.2 : 0.15, 12, 8]} />
            <meshBasicMaterial
              color={path.enabled ? "#e0f2fe" : "#475569"}
              transparent
              opacity={path.enabled ? 0.95 : 0.5}
            />
          </mesh>
          {/* The tail, only while it is actually running to a schedule. */}
          {path.enabled ? (
            <mesh position={[0, 0, -0.9]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.12, 1.8, 8, 1, true]} />
              <meshBasicMaterial
                color="#7dd3fc"
                transparent
                opacity={0.28}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          ) : null}
          <Billboard position={[0, 0.5, 0]}>
            <Text
              fontSize={0.22}
              color={path.enabled ? "#bae6fd" : "#64748b"}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.012}
              outlineColor="#000000"
            >
              {path.name}
            </Text>
          </Billboard>
        </group>
      ))}
    </group>
  );
}
