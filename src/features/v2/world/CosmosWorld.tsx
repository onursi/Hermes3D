"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import type { VaultNode, VaultLink } from "@/features/v2/useVault";

/**
 * The knowledge cosmos: the same 272 notes, close enough to touch.
 *
 * The plan forbids a second search engine and a copy of the vault, so this is
 * the same data the horizon draws, at the graph's own layout scale instead of
 * pushed out to the sky. A star here and a star at home are provably the same
 * note — the id is the same and the position comes from one computation.
 *
 * Three objects for the whole cosmos:
 *
 *   points   272 notes, one draw, per-vertex colour and size
 *   lines    1,132 links as a single LineSegments — one draw, not 1,132
 *   labels   only what is near the camera, capped, and only above a threshold
 *
 * The labels are the interesting constraint. Titles for everything would be
 * 272 troika text meshes, each with its own geometry, material and draw call —
 * roughly six times the entire draw budget of the home stage. So titles appear
 * on approach, which is also how it reads better: from far away the cosmos is
 * a shape, up close it is a library.
 */

/**
 * How near a note has to be before it is worth a title, as a share of the
 * cloud's own radius. Absolute distances broke the moment the framing changed:
 * at thirteen units the camera was inside the graph and every title was a
 * headline across the screen.
 */
const LABEL_RANGE_FACTOR = 1.05;
/** Hard cap on labels, whatever the camera does. */
const MAX_LABELS = 12;

const NODE_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  varying vec3 vColor;
  uniform float uTime;

  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (420.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const NODE_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    float mask = step(dist, 0.5);
    float core = smoothstep(0.5, 0.08, dist);
    float glow = exp(-dist * 3.6);
    gl_FragColor = vec4(vColor * 1.3, (core * 0.95 + glow * 0.45) * mask);
  }
`;

export function CosmosWorld({
  nodes,
  links,
  radius,
  selectedId,
  onSelect,
}: {
  nodes: VaultNode[];
  links: VaultLink[];
  /** The cloud's own extent, so labels and hit targets scale with it. */
  radius: number;
  selectedId: string | null;
  onSelect: (node: VaultNode) => void;
}) {
  const camera = useThree((state) => state.camera);
  const [nearby, setNearby] = useState<VaultNode[]>([]);
  // Created once by useState rather than useMemo or a ref. A memo promises a
  // value nobody rewrites, and this one is written on every frame; a ref may
  // not be read during render. useState's initialiser gives a stable object
  // that is honest about both.
  const [uniforms] = useState(() => ({ uTime: { value: 0 } }));
  const selectionRef = useRef<THREE.Mesh>(null);
  const lastLabelPass = useRef(0);

  const busiest = useMemo(
    () => Math.max(1, ...nodes.map((node) => node.degree)),
    [nodes],
  );

  const pointGeometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    const colour = new THREE.Color();
    for (const node of nodes) {
      positions.push(node.position.x, node.position.y, node.position.z);
      const weight = Math.log1p(node.degree) / Math.log1p(busiest);
      colour.set(node.color).multiplyScalar(0.55 + weight * 0.7);
      colors.push(colour.r, colour.g, colour.b);
      sizes.push(0.05 + weight * 0.12);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("aColor", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
    geometry.computeBoundingSphere();
    return geometry;
  }, [nodes, busiest]);

  /**
   * Every link as one geometry.
   *
   * 1,132 separate line objects would be 1,132 draw calls — three times what
   * the entire V1 office cost. As one LineSegments it is one, and the vertex
   * count is trivial next to a single robot.
   */
  const linkGeometry = useMemo(() => {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const positions: number[] = [];
    for (const link of links) {
      const from = byId.get(link.source);
      const to = byId.get(link.target);
      if (!from || !to) continue;
      positions.push(from.position.x, from.position.y, from.position.z);
      positions.push(to.position.x, to.position.y, to.position.z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, [nodes, links]);

  useEffect(
    () => () => {
      pointGeometry.dispose();
      linkGeometry.dispose();
    },
    [pointGeometry, linkGeometry],
  );

  const selected = useMemo(
    () => (selectedId ? nodes.find((node) => node.id === selectedId) : undefined),
    [nodes, selectedId],
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // A shader uniform is mutable render state by contract: three.js reads
    // `.value` during the draw and there is no other way to feed it. The
    // compiler's immutability rule is about React data flow and does not
    // reach across into the renderer, so it is silenced here and only here.
    // eslint-disable-next-line react-hooks/immutability
    uniforms.uTime.value = t;

    if (selectionRef.current) {
      selectionRef.current.scale.setScalar(1 + Math.sin(t * 2.4) * 0.15);
      selectionRef.current.lookAt(camera.position);
    }

    // Which notes deserve a title is recomputed four times a second, not sixty.
    // Sorting 272 nodes by distance every frame would be pure waste for a list
    // that changes when the camera moves several metres.
    if (t - lastLabelPass.current < 0.25) return;
    lastLabelPass.current = t;

    const close = nodes
      .map((node) => ({ node, distance: camera.position.distanceTo(node.position) }))
      .filter((entry) => entry.distance < radius * LABEL_RANGE_FACTOR)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, MAX_LABELS)
      .map((entry) => entry.node);

    setNearby((previous) => {
      if (previous.length === close.length && previous.every((n, i) => n.id === close[i].id)) {
        return previous;
      }
      return close;
    });
  });

  if (nodes.length === 0) return null;

  return (
    <group>
      {/* Links first, so the notes sit in front of their own connections. */}
      <lineSegments geometry={linkGeometry}>
        <lineBasicMaterial
          color="#2b4a63"
          transparent
          opacity={0.28}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      <points geometry={pointGeometry}>
        <shaderMaterial
          vertexShader={NODE_VERTEX}
          fragmentShader={NODE_FRAGMENT}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Clickable proxies for the nearby notes only. Invisible spheres are
          how a Points cloud becomes selectable without a raycast against
          every one of 272 vertices on every pointer move. */}
      {nearby.map((node) => (
        <mesh
          key={node.id}
          position={node.position}
          visible={false}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(node);
          }}
          onPointerOver={(event) => {
            event.stopPropagation();
            if (typeof document !== "undefined") document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            if (typeof document !== "undefined") document.body.style.cursor = "auto";
          }}
        >
          <sphereGeometry args={[radius * 0.022, 8, 6]} />
          <meshBasicMaterial />
        </mesh>
      ))}

      {nearby.map((node) => (
        <Billboard
          key={`label-${node.id}`}
          position={[node.position.x, node.position.y + radius * 0.024, node.position.z]}
        >
          <Text
            fontSize={radius * 0.016}
            color={node.id === selectedId ? "#ffffff" : "#b8cbdc"}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.008}
            outlineColor="#000000"
            maxWidth={radius * 0.35}
          >
            {node.name}
          </Text>
        </Billboard>
      ))}

      {selected ? (
        <mesh ref={selectionRef} position={selected.position}>
          <ringGeometry args={[radius * 0.028, radius * 0.035, 32]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
    </group>
  );
}
