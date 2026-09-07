"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

import {
  reportBeamTargets,
  reportBrainCenter,
  reportSweepPoints,
  type BeamPoint,
  type BeamTarget,
} from "./beamAnchors";

export type BeamProbePoint = {
  id: string;
  label: string;
  position: THREE.Vector3;
};

/**
 * BeamProbe
 *
 * Rechnet 3D-Knotenkoordinaten (zitierte Notizen & Gehirn-Mitte) in Bildschirm-Pixelkoordinaten um.
 * Läuft innerhalb der Three.js-Canvas und füttert beamAnchors.ts ohne unnötige Re-Renders.
 */
export function BeamProbe({
  points = [],
  sweepPoints = [],
  active = true,
}: {
  points?: BeamProbePoint[];
  sweepPoints?: BeamProbePoint[];
  active?: boolean;
}) {
  const { camera, size } = useThree();
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const centerScratch = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  useFrame(() => {
    if (size.width <= 0 || size.height <= 0) return;

    // 1. Immer das Gehirn-Zentrum [0, 0, 0] projizieren
    centerScratch.set(0, 0, 0).project(camera);
    if (centerScratch.z < 1) {
      reportBrainCenter({
        x: (centerScratch.x * 0.5 + 0.5) * size.width,
        y: (-centerScratch.y * 0.5 + 0.5) * size.height,
      });
    }

    if (!active) {
      reportBeamTargets([]);
      reportSweepPoints([]);
      return;
    }

    // 2. Real zitierte Notizen projizieren
    const out: BeamTarget[] = [];
    for (const point of points) {
      scratch.copy(point.position).project(camera);

      const sichtbar =
        scratch.z < 1 &&
        scratch.x >= -1.15 &&
        scratch.x <= 1.15 &&
        scratch.y >= -1.15 &&
        scratch.y <= 1.15;

      out.push({
        id: point.id,
        label: point.label,
        x: (scratch.x * 0.5 + 0.5) * size.width,
        y: (-scratch.y * 0.5 + 0.5) * size.height,
        onScreen: sichtbar,
      });
    }
    reportBeamTargets(out);

    // 3. Tastfläche für den Scan-Durchlauf projizieren
    const gestreift: BeamPoint[] = [];
    for (const point of sweepPoints) {
      scratch.copy(point.position).project(camera);
      if (scratch.z >= 1) continue;
      if (scratch.x < -1.1 || scratch.x > 1.1 || scratch.y < -1.1 || scratch.y > 1.1) continue;
      gestreift.push({
        x: (scratch.x * 0.5 + 0.5) * size.width,
        y: (-scratch.y * 0.5 + 0.5) * size.height,
      });
    }
    reportSweepPoints(gestreift);
  });

  return null;
}
