"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { useVault, type VaultNode } from "@/features/v2/useVault";

/**
 * Onur's notes as small glowing cubes drifting in a ring above the council,
 * like SAMS's knowledge cloud — but each cube is a real Obsidian note.
 * Bigger cube = more links. Click one to read its title and excerpt.
 */

const MAX_CUBES = 420;
const RING_INNER = 11.5;
const RING_OUTER = 17;

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

export function KnowledgeCloud({ onSelect }: { onSelect: (node: VaultNode) => void }) {
  const vault = useVault();
  const mesh = useRef<THREE.InstancedMesh>(null);

  // Most-linked notes first, so the cloud shows what matters when it is capped.
  const nodes = useMemo(
    () => [...vault.nodes].sort((a, b) => b.degree - a.degree).slice(0, MAX_CUBES),
    [vault.nodes],
  );

  const layout = useMemo(() => nodes.map((node) => {
    const a = hash(node.id) * Math.PI * 2;
    const r = RING_INNER + hash(node.id + "r") * (RING_OUTER - RING_INNER);
    const y = 2.5 + hash(node.id + "y") * 7;
    const size = 0.12 + Math.min(0.32, Math.sqrt(node.degree) * 0.045);
    return { a, r, y, size, spin: 0.2 + hash(node.id + "s") * 0.5 };
  }), [nodes]);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const color = new THREE.Color();
    nodes.forEach((node, i) => m.setColorAt(i, color.set(node.color || "#5fe3ff")));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [nodes]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    layout.forEach((l, i) => {
      const a = l.a + t * 0.012; // the whole cloud turns slowly
      dummy.position.set(Math.cos(a) * l.r, l.y + Math.sin(t * 0.6 + l.a * 3) * 0.15, Math.sin(a) * l.r);
      dummy.rotation.set(t * l.spin, t * l.spin * 0.7, 0);
      dummy.scale.setScalar(l.size);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  if (!nodes.length) return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, nodes.length]}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined && nodes[e.instanceId]) onSelect(nodes[e.instanceId]);
      }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.35} metalness={0.2} emissive="#0b2a33" emissiveIntensity={0.6} toneMapped={false} />
    </instancedMesh>
  );
}
