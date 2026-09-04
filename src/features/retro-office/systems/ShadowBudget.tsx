"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

/**
 * Small things stop casting shadows.
 *
 * One lamp in this room casts shadows. Everything flagged `castShadow` is
 * therefore drawn a second time each frame, into that lamp's depth map, on
 * top of being drawn into the picture. The source has 177 such flags, and a
 * census of the largest file found most of them on parts *inside* a machine —
 * side panels two centimetres thick, shelf boards, bezels, trim. Their
 * shadows fall inside the cabinet whose outer body already casts one. Nobody
 * has ever seen them.
 *
 * The rule is one line of geometry: if a mesh's longest side is under a
 * quarter of a metre, its shadow from a ceiling lamp is a smudge among
 * hundreds, and it is excused from the depth pass. Everything with a real
 * silhouette — desks, cabinets, robots, the table — is untouched.
 *
 * Applied here rather than at 177 call sites on purpose. One threshold, in
 * one place, is something you can tune, measure and reverse; 177 hand edits
 * are something you can only regret. Objects mount late in this scene (agents
 * arrive after their models load), so it sweeps periodically rather than once
 * — and marks what it has judged, so each mesh is measured a single time.
 */

/** Longest side, in metres, below which a mesh is excused from the shadow pass. */
const SILHOUETTE_THRESHOLD = 0.25;

/** Seconds between sweeps. Late arrivals are caught without polling hard. */
const SWEEP_INTERVAL = 2;

type Judged = { shadowBudgetChecked?: boolean };

export function ShadowBudget() {
  const scene = useThree((state) => state.scene);
  const lastSweep = useRef(0);
  const size = useRef(new THREE.Vector3());

  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    if (now - lastSweep.current < SWEEP_INTERVAL) return;
    lastSweep.current = now;

    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !mesh.castShadow) return;

      const judged = mesh.userData as Judged;
      if (judged.shadowBudgetChecked) return;
      judged.shadowBudgetChecked = true;

      const geometry = mesh.geometry;
      if (!geometry) return;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      if (!box) return;

      // World scale matters: the same unit cube is a wall or a button
      // depending on what its group did to it.
      box.getSize(size.current);
      const scale = mesh.getWorldScale(new THREE.Vector3());
      const longest = Math.max(
        size.current.x * Math.abs(scale.x),
        size.current.y * Math.abs(scale.y),
        size.current.z * Math.abs(scale.z),
      );

      if (longest < SILHOUETTE_THRESHOLD) mesh.castShadow = false;
    });
  });

  return null;
}
