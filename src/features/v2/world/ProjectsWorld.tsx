"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { SELECTION_COLOR } from "@/features/v2/palette";
import type { Project } from "@/features/v2/useProjects";

/**
 * Die Ergebniswerft: one berth per project, and nothing invented.
 *
 * The plan wanted a place a project can be *arrived at* rather than a card in
 * a list. What it must not be is a progress bar: the project notes carry no
 * checkboxes, so any percentage would be a number with nothing behind it. So
 * the only two things a berth says are things the disk can prove — how much
 * has been written, and when it was last touched.
 *
 *   height  scales with the number of notes written
 *   warmth  scales with file activity — when a file here last changed
 *
 * Neither is progress, and ASTRA was right to insist on the distinction: a
 * modification date proves a file was touched, not that the project moved
 * forward. The panel says "zuletzt bearbeitet", never "aktiv".
 *
 * Cost: one dais, one column and one label per project. Six projects is
 * eighteen draws, which is why this can be a world rather than a panel.
 */

/** How far the berths stand from the middle. */
const RING_RADIUS = 5.2;
/** After this long without a change, a berth is as cold as it gets. */
const COLD_AFTER_DAYS = 30;

const WARM = new THREE.Color("#7dd3fc");
const COLD = new THREE.Color("#3d5468");

export type ProjectBerth = {
  project: Project;
  position: THREE.Vector3;
  height: number;
  /** 0 = untouched for a month or more, 1 = touched today. */
  warmth: number;
  color: string;
};

/**
 * Where each project stands, and how it looks.
 *
 * Computed from the data alone and in a stable order, so a project does not
 * move around the ring between two visits — a place you can learn is worth
 * more than a layout that is optimal on any single day.
 */
export function berthsFor(projects: Project[], now = Date.now()): ProjectBerth[] {
  const ordered = [...projects].sort((a, b) => a.folder.localeCompare(b.folder, "de"));
  const busiest = Math.max(1, ...ordered.map((p) => p.noteCount));
  return ordered.map((project, index) => {
    const angle = (index / Math.max(1, ordered.length)) * Math.PI * 2;
    const ageDays = project.lastTouched
      ? (now - Date.parse(project.lastTouched)) / 86_400_000
      : COLD_AFTER_DAYS;
    const warmth = THREE.MathUtils.clamp(1 - ageDays / COLD_AFTER_DAYS, 0, 1);
    return {
      project,
      position: new THREE.Vector3(
        Math.cos(angle) * RING_RADIUS,
        0,
        Math.sin(angle) * RING_RADIUS,
      ),
      // Logarithmic: a project with 40 notes should read as larger than one
      // with 4, not ten times taller than the room.
      height: 0.5 + (Math.log1p(project.noteCount) / Math.log1p(busiest)) * 2.6,
      warmth,
      color: "#" + COLD.clone().lerp(WARM, warmth).getHexString(),
    };
  });
}

export function ProjectsWorld({
  projects,
  selectedFolder,
  onSelect,
}: {
  projects: Project[];
  selectedFolder: string | null;
  onSelect: (project: Project) => void;
}) {
  const berths = useMemo(() => berthsFor(projects), [projects]);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const t = clock.getElapsedTime();
      ringRef.current.scale.setScalar(1 + Math.sin(t * 2.2) * 0.06);
    }
  });

  const selected = berths.find((berth) => berth.project.folder === selectedFolder);

  return (
    <group>
      {/* The floor of the yard. Dark, so the columns are the only light. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[RING_RADIUS + 2.4, 56]} />
        <meshStandardMaterial color="#0c1219" roughness={0.86} metalness={0.15} />
      </mesh>

      {berths.map((berth) => (
        <group
          key={berth.project.folder}
          position={berth.position}
          // The whole berth is the target, not just its base. The column is
          // the tall lit thing the eye goes to, and a click that lands on it
          // and does nothing teaches him the world is scenery. Handled once
          // on the group so dais and column cannot disagree.
          onClick={(event) => {
            event.stopPropagation();
            onSelect(berth.project);
          }}
          onPointerOver={(event) => {
            event.stopPropagation();
            if (typeof document !== "undefined") document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            if (typeof document !== "undefined") document.body.style.cursor = "auto";
          }}
        >
          <mesh castShadow receiveShadow position={[0, 0.09, 0]}>
            <cylinderGeometry args={[0.86, 0.94, 0.18, 6]} />
            <meshStandardMaterial color="#151d26" roughness={0.72} metalness={0.3} />
          </mesh>

          {/* The column: written work, standing up. Height is the note count,
              colour is how recently anything changed. */}
          <mesh position={[0, 0.18 + berth.height / 2, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.26, berth.height, 12]} />
            <meshStandardMaterial
              color={berth.color}
              emissive={berth.color}
              // Emissive scales with warmth, so a cold project is visibly
              // present but not lit — dormant reads as dormant.
              emissiveIntensity={0.25 + berth.warmth * 1.1}
              roughness={0.4}
              metalness={0.1}
            />
          </mesh>

          <Billboard position={[0, 0.18 + berth.height + 0.42, 0]}>
            <Text
              fontSize={0.2}
              color={berth.project.folder === selectedFolder ? "#ffffff" : "#c3d4e2"}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.008}
              outlineColor="#000000"
              maxWidth={3}
            >
              {berth.project.name}
            </Text>
          </Billboard>
        </group>
      ))}

      {selected ? (
        <mesh
          ref={ringRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[selected.position.x, 0.03, selected.position.z]}
        >
          <ringGeometry args={[1.02, 1.16, 40]} />
          <meshBasicMaterial color={SELECTION_COLOR} transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
    </group>
  );
}
