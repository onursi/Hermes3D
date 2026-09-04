"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * Today, as a ring in the floor.
 *
 * Five tasks due today and two done fills the ring to forty per cent. That is
 * the whole idea: the state of the day is under your feet, readable at a
 * glance and from any angle, without opening anything.
 *
 * It is drawn as two rings rather than one. A partial arc alone is ambiguous
 * — a short arc could mean "barely started" or "almost nothing due" — so a
 * dim full circle behind it shows the size of the day and the bright arc
 * shows how much of it is done. Ratio and magnitude, in one shape.
 *
 * Nothing due means no ring at all. A permanently visible empty circle would
 * read as failure on a day that simply had nothing scheduled.
 */

export function DayProgressRing({
  dueToday,
  doneToday,
  position,
  radius = 2.6,
}: {
  dueToday: number;
  doneToday: number;
  position: [number, number, number];
  radius?: number;
}) {
  const share = dueToday > 0 ? Math.min(1, doneToday / dueToday) : 0;

  const arcGeometry = useMemo(() => {
    if (share <= 0) return null;
    // Starts at the top and runs clockwise, the direction a person reads a
    // dial. Three.js measures anticlockwise from +X, hence the offset and the
    // negative sweep.
    const geometry = new THREE.RingGeometry(
      radius - 0.09,
      radius,
      64,
      1,
      Math.PI / 2,
      -share * Math.PI * 2,
    );
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }, [share, radius]);

  const trackGeometry = useMemo(() => {
    const geometry = new THREE.RingGeometry(radius - 0.06, radius - 0.03, 64);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }, [radius]);

  if (dueToday <= 0) return null;

  return (
    <group position={position}>
      {/* The size of the day: dim, complete, always there while anything is due. */}
      <mesh geometry={trackGeometry} position={[0, 0.004, 0]}>
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.16}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* What is done of it. Green because finished is the one thing in this
          room that gets to be green, and it means only that. */}
      {arcGeometry ? (
        <mesh geometry={arcGeometry} position={[0, 0.006, 0]}>
          <meshBasicMaterial
            color="#4ade80"
            transparent
            opacity={0.55}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ) : null}
    </group>
  );
}
