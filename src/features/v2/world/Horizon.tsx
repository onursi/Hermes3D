"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { SELECTION_COLOR } from "@/features/v2/palette";
import type { VaultNode } from "@/features/v2/useVault";

/**
 * The horizon: every note in the vault, seen from the stage.
 *
 * This is the load-bearing idea of the counter-model. Nothing is in another
 * room — it is near or far. The vault is not somewhere you go to; it is the
 * sky you already stand under, and travelling into it later is closing a
 * distance rather than opening a door.
 *
 * 272 notes in one draw call. The twinkle, the size and the colour are all
 * per-vertex attributes evaluated on the GPU, so the CPU cost of the entire
 * sky is one uniform per frame. Animating this by rewriting a buffer is
 * exactly the mistake that had V1 at eight frames a second.
 */

export const KNOWLEDGE_PULSE_EVENT = "hermes_knowledge_pulse";

const STAR_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute vec2 aTwinkle;
  varying vec3 vColor;
  varying float vTwinkle;
  uniform float uTime;
  uniform float uDim;

  void main() {
    vColor = aColor;
    vTwinkle = (0.72 + 0.28 * sin(uTime * aTwinkle.x + aTwinkle.y)) * uDim;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (260.0 / -mv.z) * vTwinkle;
    gl_Position = projectionMatrix * mv;
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    // A mask, not discard: discard disables early depth for the whole shader,
    // so it would run in full even for hidden fragments.
    float mask = step(dist, 0.5);
    float core = smoothstep(0.5, 0.06, dist);
    float glow = exp(-dist * 4.4);
    gl_FragColor = vec4(vColor * 1.25, (core * 0.9 + glow * 0.4) * vTwinkle * mask);
  }
`;

/** Seconds a note takes to travel from its star to the core. */
const PULSE_FLIGHT = 2.0;
const MAX_PULSES = 8;
const PULSE_TARGET = new THREE.Vector3(0, 1.35, 0);

const pulseMatrix = new THREE.Matrix4();
const pulsePoint = new THREE.Vector3();

type Pulse = { from: THREE.Vector3; born: number };

export function Horizon({
  nodes,
  byId,
  dimmed,
  highlightId,
}: {
  nodes: VaultNode[];
  byId: Map<string, VaultNode>;
  /** Focus mode pushes the sky back rather than removing it. */
  dimmed: boolean;
  /** The source currently selected — brought home from the cosmos. */
  highlightId: string | null;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pulsesRef = useRef<Pulse[]>([]);
  const pulseMeshRef = useRef<THREE.InstancedMesh>(null);
  const markerRef = useRef<THREE.Mesh>(null);

  // Created once by useState rather than useMemo or a ref. A memo promises a
  // value nobody rewrites, and this one is written on every frame; a ref may
  // not be read during render. useState's initialiser gives a stable object
  // that is honest about both.
  const [uniforms] = useState(() => ({ uTime: { value: 0 }, uDim: { value: 1 } }));

  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    const twinkles: number[] = [];
    const colour = new THREE.Color();
    const busiest = Math.max(1, ...nodes.map((node) => node.degree));

    nodes.forEach((node, index) => {
      positions.push(node.skyPosition.x, node.skyPosition.y, node.skyPosition.z);
      // Log scale: the Index note links 191 times and most notes once or
      // twice. Linear brightness would leave one sun and 270 black dots.
      const weight = Math.log1p(node.degree) / Math.log1p(busiest);
      colour.set(node.color).multiplyScalar(0.6 + weight * 0.85);
      colors.push(colour.r, colour.g, colour.b);
      // Raised after seeing the first render: at the old size a 46-unit dome
      // resolved to two or three pixels a star and the sky read as noise
      // rather than as a sky. Brightness still carries connectedness.
      sizes.push(1.1 + weight * 2.2);
      // A hub breathes slowly; a leaf flickers. Rate from connectedness, phase
      // spread so they never pulse in unison.
      twinkles.push(0.55 + (1 - weight) * 2.4, (index * 2.399) % 6.283);
    });

    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    buffer.setAttribute("aColor", new THREE.Float32BufferAttribute(colors, 3));
    buffer.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
    buffer.setAttribute("aTwinkle", new THREE.Float32BufferAttribute(twinkles, 2));
    return buffer;
  }, [nodes]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  /**
   * A note travels when it was really read.
   *
   * The event carries the vault-relative ids the retrieval endpoint actually
   * used, which are the same ids the graph names its nodes — so each pulse
   * leaves the exact point of light that stands for that note, not an
   * approximation. If those could disagree, the effect would be a lie about
   * which note was read, and that is worse than no effect.
   */
  useEffect(() => {
    const onPulse = (event: Event) => {
      const ids = (event as CustomEvent<{ ids?: string[] }>).detail?.ids;
      if (!Array.isArray(ids) || ids.length === 0) return;
      const now = performance.now() / 1000;
      const next: Pulse[] = [];
      ids.forEach((id, index) => {
        const node = byId.get(id);
        // A source the graph does not know simply does not fly. Inventing a
        // launch point would put a note in the sky that is not there.
        if (!node) return;
        next.push({ from: node.skyPosition, born: now + index * 0.15 });
      });
      pulsesRef.current = [...pulsesRef.current, ...next].slice(-MAX_PULSES);
    };
    window.addEventListener(KNOWLEDGE_PULSE_EVENT, onPulse);
    return () => window.removeEventListener(KNOWLEDGE_PULSE_EVENT, onPulse);
  }, [byId]);

  const highlighted = highlightId ? byId.get(highlightId) : undefined;

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    // A shader uniform is mutable render state by contract: three.js reads
    // `.value` during the draw and there is no other way to feed it. The
    // compiler's immutability rule is about React data flow and does not
    // reach across into the renderer, so it is silenced here and only here.
    // eslint-disable-next-line react-hooks/immutability
    uniforms.uTime.value = t;
    // Focus dims the sky rather than hiding it — what is not relevant is
    // unlit, not absent.
    const wanted = dimmed ? 0.22 : 1;
    uniforms.uDim.value += (wanted - uniforms.uDim.value) * Math.min(1, delta * 4);

    // The sky turns once in about twenty minutes: fast enough that the room is
    // never quite still, slow enough that you cannot catch it moving.
    if (groupRef.current) groupRef.current.rotation.y = t * 0.0052;

    if (markerRef.current && highlighted) {
      markerRef.current.scale.setScalar(1 + Math.sin(t * 2.2) * 0.16);
    }

    // ---- notes in flight ---------------------------------------------------
    const mesh = pulseMeshRef.current;
    if (!mesh) return;
    const now = performance.now() / 1000;
    const live = pulsesRef.current.filter((p) => now >= p.born && now - p.born < PULSE_FLIGHT);
    const pending = pulsesRef.current.filter((p) => now < p.born);
    pulsesRef.current = [...pending, ...live];

    // Nothing in flight costs nothing: the mesh is not drawn at all.
    if (live.length === 0) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    for (let i = 0; i < MAX_PULSES; i += 1) {
      const pulse = live[i];
      if (!pulse) {
        pulseMatrix.makeScale(0, 0, 0);
        mesh.setMatrixAt(i, pulseMatrix);
        continue;
      }
      const progress = (now - pulse.born) / PULSE_FLIGHT;
      const eased = progress * progress * (3 - 2 * progress);
      pulsePoint.lerpVectors(pulse.from, PULSE_TARGET, eased);
      const size = 0.3 + Math.sin(progress * Math.PI) * 0.5;
      pulseMatrix.makeScale(size, size, size);
      pulseMatrix.setPosition(pulsePoint);
      mesh.setMatrixAt(i, pulseMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (nodes.length === 0) return null;

  return (
    <group ref={groupRef}>
      <points geometry={geometry}>
        <shaderMaterial
          vertexShader={STAR_VERTEX}
          fragmentShader={STAR_FRAGMENT}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* The source brought back from the cosmos keeps a visible marker, which
          is how "the selection survived the journey" is provable by looking. */}
      {highlighted ? (
        <mesh ref={markerRef} position={highlighted.skyPosition}>
          <ringGeometry args={[0.9, 1.15, 24]} />
          <meshBasicMaterial color={SELECTION_COLOR} transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      ) : null}

      <instancedMesh
        ref={pulseMeshRef}
        args={[undefined, undefined, MAX_PULSES]}
        visible={false}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.5, 10, 8]} />
        <meshBasicMaterial
          color="#7dd3fc"
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </group>
  );
}
