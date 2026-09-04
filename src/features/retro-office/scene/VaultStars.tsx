"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/**
 * Your notes, as the stars over the office.
 *
 * The sky already had 64,000 points that mean nothing. These are 261 that do:
 * one per note in the vault, at the position the knowledge graph gives it,
 * scaled up and pushed out until it reads as sky rather than as a diagram.
 *
 * Brightness is connection count — the hubs you actually build on are the
 * bright ones — and the notes nothing links to flicker, because a loose end
 * should catch your eye from across the room even when you are not looking
 * for it.
 *
 * Drawn as a single Points object: 261 vertices in one draw call, which is
 * within noise next to the 64,000 already there. This was the one proposal I
 * flagged as a risk to today's performance pass, and building it this way is
 * the reason it is not.
 */

type GraphNode = { id: string; x: number; y: number; z: number };
type GraphLink = { source: string; target: string };

/** How far out the vault sits, and how much bigger than the graph's own scale. */
const SKY_SCALE = 5.2;
const SKY_LIFT = 26;

export function VaultStars({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  const [data, setData] = useState<{ nodes: GraphNode[]; links: GraphLink[] } | null>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const orphanRef = useRef<THREE.Points>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/obsidian-graph")
      .then((res) => res.json())
      .then((payload) => {
        if (!cancelled && payload?.nodes?.length) setData(payload);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const { linked, orphans } = useMemo(() => {
    if (!data) return { linked: null, orphans: null };

    const degree = new Map<string, number>();
    for (const link of data.links) {
      degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
      degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
    }
    const busiest = Math.max(1, ...degree.values());

    const linkedPositions: number[] = [];
    const linkedColours: number[] = [];
    const orphanPositions: number[] = [];
    const colour = new THREE.Color();

    for (const node of data.nodes) {
      const point = [node.x * SKY_SCALE, node.y * SKY_SCALE + SKY_LIFT, node.z * SKY_SCALE];
      const count = degree.get(node.id) ?? 0;
      if (count === 0) {
        orphanPositions.push(...point);
        continue;
      }
      linkedPositions.push(...point);
      // Log scale again: Index links 191 times and most notes once or twice,
      // so a linear brightness would leave a single sun and 250 black dots.
      const weight = Math.log1p(count) / Math.log1p(busiest);
      colour.setHSL(0.55, 0.35, 0.35 + weight * 0.6);
      linkedColours.push(colour.r, colour.g, colour.b);
    }

    const makeGeometry = (positions: number[], colours?: number[]) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      if (colours) {
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
      }
      return geometry;
    };

    return {
      linked: makeGeometry(linkedPositions, linkedColours),
      orphans: makeGeometry(orphanPositions),
    };
  }, [data]);

  useFrame(({ clock }) => {
    const orphanPoints = orphanRef.current;
    if (!orphanPoints) return;
    const material = orphanPoints.material as THREE.PointsMaterial;
    // Irregular, not a blink: a loose end should read as unsettled rather than
    // as an indicator lamp.
    const t = clock.getElapsedTime();
    material.opacity = 0.35 + Math.abs(Math.sin(t * 1.7) * Math.sin(t * 0.63)) * 0.6;
  });

  if (!linked || !orphans) return null;

  return (
    <group position={position}>
      <points geometry={linked}>
        <pointsMaterial
          ref={materialRef}
          size={0.62}
          vertexColors
          transparent
          opacity={0.9}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
      <points ref={orphanRef} geometry={orphans}>
        <pointsMaterial
          size={0.8}
          color="#f43f5e"
          transparent
          opacity={0.6}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
    </group>
  );
}
