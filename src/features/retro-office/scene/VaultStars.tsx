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

/**
 * Every note twinkles, at its own rate.
 *
 * Onur, on the invented planets that used to share this sky: "ich finde mehr
 * so bewegende sterne funkelnde besser". The sixty-four thousand fake stars
 * are gone by his own instruction, and what remains are these — one point per
 * note he has actually written. Still points read as a diagram; a sky is
 * something that moves.
 *
 * Done on the GPU with a per-vertex rate and phase, so all two hundred and
 * sixty-one still cost the one draw call they cost when they were static.
 * Doing it on the CPU would mean touching a buffer every frame, which is the
 * exact shape of mistake that had this room at eight frames a second.
 *
 * The rate is derived from the note's own brightness rather than randomised:
 * a hub with many links breathes slowly and steadily, a note with one link
 * flickers. Nothing here is chosen for looks that is not also true.
 */
const STAR_VERTEX = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute vec2 aTwinkle;
  varying vec3 vColor;
  varying float vTwinkle;
  uniform float uTime;

  void main() {
    vColor = aColor;
    vTwinkle = 0.72 + 0.28 * sin(uTime * aTwinkle.x + aTwinkle.y);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (240.0 / -mvPosition.z) * vTwinkle;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const STAR_FRAGMENT = `
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    // A mask rather than discard: discard disables early depth testing for
    // the whole shader, so it would run in full even for hidden fragments.
    float mask = step(dist, 0.5);
    float core = smoothstep(0.5, 0.06, dist);
    float glow = exp(-dist * 4.4);
    gl_FragColor = vec4(vColor * 1.25, (core * 0.9 + glow * 0.4) * vTwinkle * mask);
  }
`;

export function VaultStars({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  const [data, setData] = useState<{ nodes: GraphNode[]; links: GraphLink[] } | null>(null);
  const orphanRef = useRef<THREE.Points>(null);
  const groupRef = useRef<THREE.Group>(null);

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
    const linkedSizes: number[] = [];
    const linkedTwinkles: number[] = [];
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
      linkedSizes.push(0.5 + weight * 0.9);
      // A hub breathes; a leaf flickers. The rate is the note's own
      // connectedness, and the phase is spread so they never pulse in unison.
      linkedTwinkles.push(0.55 + (1 - weight) * 2.4, (linkedSizes.length * 2.399) % 6.283);
    }

    const linkedGeometry = new THREE.BufferGeometry();
    linkedGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(linkedPositions, 3),
    );
    linkedGeometry.setAttribute("aColor", new THREE.Float32BufferAttribute(linkedColours, 3));
    linkedGeometry.setAttribute("aSize", new THREE.Float32BufferAttribute(linkedSizes, 1));
    linkedGeometry.setAttribute("aTwinkle", new THREE.Float32BufferAttribute(linkedTwinkles, 2));

    const orphanGeometry = new THREE.BufferGeometry();
    orphanGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(orphanPositions, 3),
    );

    return { linked: linkedGeometry, orphans: orphanGeometry };
  }, [data]);

  /** One uniform, shared by every star. Created once, not per frame. */
  const starUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // One number per frame feeds all 261 stars. The twinkling itself happens
    // on the GPU; this is the only CPU cost the whole sky has.
    starUniforms.uTime.value = t;

    // The sky turns, very slowly — a full revolution takes about twenty
    // minutes. Fast enough that the room is never quite still, slow enough
    // that you cannot catch it moving.
    const group = groupRef.current;
    if (group) group.rotation.y = t * 0.0052;

    const orphanPoints = orphanRef.current;
    if (!orphanPoints) return;
    const material = orphanPoints.material as THREE.PointsMaterial;
    // Irregular, not a blink: a loose end should read as unsettled rather than
    // as an indicator lamp.
    material.opacity = 0.35 + Math.abs(Math.sin(t * 1.7) * Math.sin(t * 0.63)) * 0.6;
  });

  if (!linked || !orphans) return null;

  return (
    <group position={position} ref={groupRef}>
      <points geometry={linked}>
        <shaderMaterial
          vertexShader={STAR_VERTEX}
          fragmentShader={STAR_FRAGMENT}
          uniforms={starUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
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
