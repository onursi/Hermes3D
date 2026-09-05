"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { SELECTION_COLOR } from "@/features/v2/palette";
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

/**
 * `aMatch` is the search, and it is done on the GPU.
 *
 * Filtering in React would mean rebuilding a 273-vertex buffer on every
 * keystroke and, worse, would make the misses *disappear* — which loses the
 * shape of the map at exactly the moment he is trying to find his way around
 * it. A per-vertex weight dims the misses instead: everything stays where it
 * is, and the hits are the only things still lit.
 */
const NODE_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aMatch;
  varying vec3 vColor;
  varying float vMatch;
  uniform float uTime;

  void main() {
    vColor = aColor;
    vMatch = aMatch;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // Hits grow a little; misses shrink. The difference has to survive being
    // seen out of the corner of the eye.
    gl_PointSize = aSize * (0.7 + aMatch * 0.55) * (420.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const NODE_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vMatch;
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    float mask = step(dist, 0.5);
    float core = smoothstep(0.5, 0.08, dist);
    float glow = exp(-dist * 3.6);
    float alpha = (core * 0.95 + glow * 0.45) * mask;
    gl_FragColor = vec4(vColor * 1.3 * (0.35 + vMatch * 0.65), alpha * (0.18 + vMatch * 0.82));
  }
`;

/** Matching is on the title and the folder, lower-cased, substring. */
export const matchesQuery = (node: VaultNode, needle: string): boolean =>
  node.name.toLowerCase().includes(needle) || node.folder.toLowerCase().includes(needle);

export function CosmosWorld({
  nodes,
  links,
  radius,
  selectedId,
  query,
  onSelect,
}: {
  nodes: VaultNode[];
  links: VaultLink[];
  /** The cloud's own extent, so labels and hit targets scale with it. */
  radius: number;
  selectedId: string | null;
  /** The live search term. Empty means everything is a hit. */
  query: string;
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
    // Everything is a hit until something is typed.
    geometry.setAttribute(
      "aMatch",
      new THREE.Float32BufferAttribute(new Float32Array(nodes.length).fill(1), 1),
    );
    geometry.computeBoundingSphere();
    return geometry;
  }, [nodes, busiest]);

  const needle = query.trim().toLowerCase();

  /**
   * The hits, as ids — computed once per keystroke rather than per frame.
   *
   * An empty search returns null rather than every node: "no filter" and "a
   * filter that happens to match everything" behave differently below, and
   * conflating them is how a search box starts lying about a result count.
   */
  const hitIds = useMemo(() => {
    if (!needle) return null;
    const ids = new Set<string>();
    for (const node of nodes) if (matchesQuery(node, needle)) ids.add(node.id);
    return ids;
  }, [nodes, needle]);

  /**
   * The search written into the buffer.
   *
   * One attribute upload for the whole cosmos, and no geometry rebuild — the
   * positions and colours are unchanged, only which of them are lit.
   */
  useEffect(() => {
    const attribute = pointGeometry.getAttribute("aMatch") as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;
    for (let i = 0; i < nodes.length; i += 1) {
      array[i] = !hitIds || hitIds.has(nodes[i].id) ? 1 : 0;
    }
    attribute.needsUpdate = true;
  }, [pointGeometry, nodes, hitIds]);

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

  /**
   * The neighbourhood of the selection, as its own geometry.
   *
   * ASTRA read the cosmos as "vor allem ein dichtes Liniennetz" and that is
   * exactly what 1,132 links at equal weight are: texture, not information.
   * The base web is pushed right back and this second, tiny object carries the
   * only relationships worth reading — the ones touching what he picked.
   *
   * Two draws instead of one. It is the cheapest possible way to answer the
   * question the map exists for: what is this note connected to?
   */
  const neighbourGeometry = useMemo(() => {
    if (!selectedId) return null;
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const positions: number[] = [];
    for (const link of links) {
      if (link.source !== selectedId && link.target !== selectedId) continue;
      const from = byId.get(link.source);
      const to = byId.get(link.target);
      if (!from || !to) continue;
      positions.push(from.position.x, from.position.y, from.position.z);
      positions.push(to.position.x, to.position.y, to.position.z);
    }
    if (positions.length === 0) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, [nodes, links, selectedId]);

  useEffect(() => {
    if (!neighbourGeometry) return;
    return () => neighbourGeometry.dispose();
  }, [neighbourGeometry]);

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

    // While searching, the hits get the titles wherever they are. A search
    // that only names what you were already close enough to read would be a
    // search you do not need.
    const candidates = hitIds ? nodes.filter((node) => hitIds.has(node.id)) : nodes;
    const close = candidates
      .map((node) => ({ node, distance: camera.position.distanceTo(node.position) }))
      .filter((entry) => hitIds !== null || entry.distance < radius * LABEL_RANGE_FACTOR)
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
          // Faint on purpose. At 0.28 the web read as the subject of the
          // picture; the notes are the subject, and the links are the paper
          // they are printed on — until one is asked about.
          opacity={selectedId ? 0.07 : 0.13}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      {neighbourGeometry ? (
        <lineSegments geometry={neighbourGeometry}>
          <lineBasicMaterial
            color={SELECTION_COLOR}
            transparent
            opacity={0.75}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>
      ) : null}

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
          <meshBasicMaterial color={SELECTION_COLOR} transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
    </group>
  );
}
