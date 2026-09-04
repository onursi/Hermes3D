"use client";

import React, { useRef, useMemo, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Billboard, Html, Text } from "@react-three/drei";
import { cyberAudio } from "@/lib/sound/cyberAudio";

export type GraphNode = {
  id: string;
  name: string;
  folder: string;
  group: string;
  color: string;
  wordCount: number;
  excerpt: string;
  x: number;
  y: number;
  z: number;
  val: number;
};

export type GraphLink = {
  source: string;
  target: string;
};

export type ObsidianGraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
  totalNotes?: number;
  totalLinks?: number;
};

// Brain Areal Color Map (distinct, vibrant colors per lobe)
export const AREAL_COLORS: Record<string, string> = {
  projects:  "#f59e0b",  // Amber Gold
  system:    "#38bdf8",  // Ice Blue
  inbox:     "#60a5fa",  // Sky Blue
  raw:       "#818cf8",  // Lavender
  knowledge: "#ec4899",  // Electric Pink
  ideas:     "#e879f9",  // Magenta
  identity:  "#34d399",  // Emerald
  profile:   "#a78bfa",  // Violet
  sources:   "#06b6d4",  // Deep Cyan
  interests: "#fbbf24",  // Warm Gold
  core:      "#ffffff",  // White
  other:     "#38bdf8",  // Fallback
};

// Camera positions for each brain lobe (auto-fly on filter click)
const AREAL_CAMERA: Record<string, [number, number, number]> = {
  projects:  [-6, 3, 8],
  system:    [-6, 3, -4],
  inbox:     [-6, -1, 6],
  raw:       [-6, 0, -5],
  knowledge: [6, 3, 8],
  ideas:     [6, 4, 8],
  identity:  [6, 0, 4],
  profile:   [6, 0, -3],
  sources:   [6, 2, -6],
  interests: [6, 3, -3],
  core:      [0, -2, 6],
  all:       [0, 5, 18],
};

export function Obsidian3DGraphCore({
  data,
  selectedNodeId,
  onSelectNode,
  searchQuery = "",
  activeFilter = "all",
  flyToNode = null,
  flyToLobe = null,
  showOrphans = false,
  controlsRef,
}: {
  data: ObsidianGraphData;
  selectedNodeId?: string | null;
  onSelectNode?: (node: GraphNode) => void;
  searchQuery?: string;
  activeFilter?: string;
  flyToNode?: GraphNode | null;
  flyToLobe?: string | null;
  /** Paint the notes nothing links to, so the loose ends become findable. */
  showOrphans?: boolean;
  /** The scene's OrbitControls, so a camera fly can borrow the camera. */
  controlsRef?: { current: { enabled: boolean; target: THREE.Vector3; update: () => void } | null };
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const { camera } = useThree();
  const timeRef = useRef(0);

  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    data.nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [data.nodes]);

  const { connectedNeighborIds, connectedLinkKeys } = useMemo(() => {
    const neighbors = new Set<string>();
    const linkKeys = new Set<string>();
    if (selectedNodeId) {
      neighbors.add(selectedNodeId);
      data.links.forEach((link) => {
        if (link.source === selectedNodeId) {
          neighbors.add(link.target);
          linkKeys.add(link.source + "<->" + link.target);
          linkKeys.add(link.target + "<->" + link.source);
        } else if (link.target === selectedNodeId) {
          neighbors.add(link.source);
          linkKeys.add(link.source + "<->" + link.target);
          linkKeys.add(link.target + "<->" + link.source);
        }
      });
    }
    return { connectedNeighborIds: neighbors, connectedLinkKeys: linkKeys };
  }, [selectedNodeId, data.links]);

  /**
   * How many notes each note is wired to, and the busiest count in the vault.
   *
   * Connection count is what makes a knowledge graph read as a galaxy: the
   * hubs become suns and everything else falls into orbit around them. Note
   * length — the only thing size used to hint at, and only barely — says
   * nothing about how central a note is. `Index.md` links 190 times; most
   * notes link once or twice, so the scale has to be logarithmic or the hubs
   * swallow the picture.
   */
  const { degreeById, maxDegree, labelCutoff } = useMemo(() => {
    const degree = new Map<string, number>();
    data.links.forEach((link) => {
      degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
      degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
    });
    let max = 1;
    degree.forEach((value) => {
      if (value > max) max = value;
    });
    // The dozen busiest notes keep their name on screen. Labelling everything
    // would bury the galaxy in text; labelling nothing means the shape tells
    // you there is a centre without ever telling you which one.
    const ranked = Array.from(degree.values()).sort((a, b) => b - a);
    const cutoff = ranked.length > 12 ? ranked[11] : 1;
    return { degreeById: degree, maxDegree: max, labelCutoff: Math.max(2, cutoff) };
  }, [data.links]);

  const filteredNodes = useMemo(() => {
    return data.nodes.filter((node) => {
      if (activeFilter !== "all" && node.group !== activeFilter && node.folder !== activeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return node.name.toLowerCase().includes(q) || node.folder.toLowerCase().includes(q);
      }
      return true;
    });
  }, [data.nodes, activeFilter, searchQuery]);

  // ═══════════════════════════════════════════════════════════
  // 1. MIKROKOSMOS: BRAIN SCAFFOLDING (700 glial points)
  // ═══════════════════════════════════════════════════════════
  const { brainScaffoldPoints, brainScaffoldLines, brainScaffoldPointsGeo } = useMemo(() => {
    const points: [number, number, number][] = [];
    const lines: number[] = [];
    const count = 700;

    for (let i = 0; i < count; i++) {
      const isLeft = i % 2 === 0;
      const u = Math.random();
      const v = Math.random();
      const theta = u * Math.PI;
      const phi = v * Math.PI * 2;

      if (i < 100) {
        const cx = (isLeft ? -1 : 1) * (0.6 + Math.random() * 1.0);
        const cy = -2.0 + (Math.random() - 0.5) * 1.0;
        const cz = -2.0 + (Math.random() - 0.5) * 1.4;
        points.push([cx, cy, cz]);
        continue;
      }

      if (i < 150) {
        const cx = (Math.random() - 0.5) * 0.6;
        const cy = -2.0 - Math.random() * 1.8;
        const cz = -0.4 + (Math.random() - 0.5) * 0.7;
        points.push([cx, cy, cz]);
        continue;
      }

      const rx = 3.6, ry = 2.8, rz = 4.4;
      const ripple = 1.0 + 0.09 * Math.sin(theta * 8) * Math.cos(phi * 7) + 0.06 * Math.sin(phi * 13);
      let x = rx * Math.sin(theta) * Math.cos(phi) * ripple;
      let y = ry * Math.sin(theta) * Math.sin(phi) * ripple;
      let z = rz * Math.cos(theta) * ripple;

      if (y < -0.3 && z < 1.0 && z > -2.0) { y *= 0.75; x *= 1.1; }
      x += isLeft ? -0.5 : 0.5;
      points.push([x, y, z]);
    }

    for (let i = 0; i < points.length; i++) {
      let conn = 0;
      for (let j = i + 1; j < points.length && conn < 4; j++) {
        const dx = points[i][0] - points[j][0];
        const dy = points[i][1] - points[j][1];
        const dz = points[i][2] - points[j][2];
        if (dx * dx + dy * dy + dz * dz < 1.6) {
          lines.push(points[i][0], points[i][1], points[i][2], points[j][0], points[j][1], points[j][2]);
          conn++;
        }
      }
    }

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lines), 3));

    const ptPos: number[] = [];
    const ptCol: number[] = [];
    points.forEach((p) => { ptPos.push(p[0], p[1], p[2]); ptCol.push(0.0, 0.94, 1.0); });
    const ptGeo = new THREE.BufferGeometry();
    ptGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ptPos), 3));
    ptGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(ptCol), 3));

    return { brainScaffoldPoints: points, brainScaffoldLines: lineGeo, brainScaffoldPointsGeo: ptGeo };
  }, []);

  // ═══════════════════════════════════════════════════════════
  // 2. MAKROKOSMOS: COSMIC WEB + NEBULA + AURORA
  // ═══════════════════════════════════════════════════════════
  const { cosmicWebGeometry, cosmicDustGeometry, auroraGeometry } = useMemo(() => {
    const webL: number[] = [];
    const webC: number[] = [];
    for (let i = 0; i < 100; i++) {
      const p = brainScaffoldPoints[Math.floor(Math.random() * brainScaffoldPoints.length)];
      if (p) {
        const dir = new THREE.Vector3(...p).normalize();
        const od = 10 + Math.random() * 20;
        const op = dir.clone().multiplyScalar(od);
        op.x += (Math.random() - 0.5) * 8;
        op.y += (Math.random() - 0.5) * 8;
        op.z += (Math.random() - 0.5) * 8;
        webL.push(p[0], p[1], p[2], op.x, op.y, op.z);
        webC.push(0.0, 0.85, 1.0, 0.02, 0.15, 0.35);
      }
    }
    const webGeo = new THREE.BufferGeometry();
    webGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(webL), 3));
    webGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(webC), 3));

    const dP: number[] = [];
    const dC: number[] = [];
    for (let i = 0; i < 2000; i++) {
      const r = 4 + Math.random() * 28;
      const t = Math.random() * Math.PI;
      const p = Math.random() * Math.PI * 2;
      dP.push(r * Math.sin(t) * Math.cos(p), r * Math.sin(t) * Math.sin(p) * 0.7, r * Math.cos(t));
      const k = Math.random();
      if (k < 0.35) dC.push(0.0, 0.9, 1.0);
      else if (k < 0.6) dC.push(0.15, 0.55, 0.9);
      else if (k < 0.8) dC.push(0.4, 0.1, 0.7);
      else dC.push(0.0, 0.7, 0.5);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(dP), 3));
    dustGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(dC), 3));

    const aV: number[] = [];
    const aC: number[] = [];
    for (let rib = 0; rib < 5; rib++) {
      const ba = (rib / 5) * Math.PI * 2;
      const yo = (rib - 2) * 1.2;
      for (let s = 0; s < 40; s++) {
        const a1 = ba + (s / 40) * Math.PI * 2;
        const a2 = ba + ((s + 1) / 40) * Math.PI * 2;
        const r1 = 5.5 + Math.sin(s * 0.4) * 1.2;
        const r2 = 5.5 + Math.sin((s + 1) * 0.4) * 1.2;
        aV.push(Math.cos(a1) * r1, yo + Math.sin(s * 0.6) * 0.5, Math.sin(a1) * r1,
                Math.cos(a2) * r2, yo + Math.sin((s + 1) * 0.6) * 0.5, Math.sin(a2) * r2);
        const c = new THREE.Color().setHSL((rib * 0.2 + s * 0.02) % 1.0 * 0.15 + 0.48, 0.9, 0.55);
        aC.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
    }
    const auroraGeo = new THREE.BufferGeometry();
    auroraGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(aV), 3));
    auroraGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(aC), 3));

    return { cosmicWebGeometry: webGeo, cosmicDustGeometry: dustGeo, auroraGeometry: auroraGeo };
  }, [brainScaffoldPoints]);

  // ═══════════════════════════════════════════════════════════
  // 3. SYNAPSE LINES (color-coded by areal)
  // ═══════════════════════════════════════════════════════════
  const { lineGeometry, validLinks } = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const valid: { src: GraphNode; tgt: GraphNode }[] = [];
    const isIsolated = selectedNodeId != null && connectedLinkKeys.size > 0;
    const isFiltered = activeFilter !== "all";

    data.links.forEach((link) => {
      const src = nodeMap.get(link.source);
      const tgt = nodeMap.get(link.target);
      if (src && tgt) {
        valid.push({ src, tgt });
        positions.push(src.x, src.y, src.z, tgt.x, tgt.y, tgt.z);

        const isActive = !isIsolated || connectedLinkKeys.has(link.source + "<->" + link.target);
        const srcInFilter = !isFiltered || src.group === activeFilter;
        const tgtInFilter = !isFiltered || tgt.group === activeFilter;
        const linkInFilter = srcInFilter || tgtInFilter;

        const a = isActive ? (linkInFilter ? 1.0 : 0.12) : 0.06;

        // Use areal color for filtered links, original color otherwise
        const cS = new THREE.Color(isFiltered && srcInFilter ? (AREAL_COLORS[src.group] || src.color) : src.color);
        const cT = new THREE.Color(isFiltered && tgtInFilter ? (AREAL_COLORS[tgt.group] || tgt.color) : tgt.color);
        colors.push(cS.r * a, cS.g * a, cS.b * a, cT.r * a, cT.g * a, cT.b * a);
      }
    });

    const geo = new THREE.BufferGeometry();
    if (positions.length > 0) {
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
      geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3));
    }
    return { lineGeometry: geo, validLinks: valid };
  }, [data.links, nodeMap, selectedNodeId, connectedLinkKeys, activeFilter]);

  // ═══════════════════════════════════════════════════════════
  // 4. ACTION POTENTIALS (150, color-coded sparks!)
  // ═══════════════════════════════════════════════════════════
  const sparkCount = Math.min(150, Math.max(50, validLinks.length));
  const sparks = useMemo(() => {
    const arr: { linkIdx: number; progress: number; speed: number }[] = [];
    for (let i = 0; i < sparkCount; i++) {
      arr.push({
        linkIdx: Math.floor(Math.random() * Math.max(1, validLinks.length)),
        progress: Math.random(),
        speed: 0.4 + Math.random() * 0.8,
      });
    }
    return arr;
  }, [sparkCount, validLinks.length]);

  const sparksMeshRef = useRef<THREE.InstancedMesh>(null);
  const dummyMatrix = useMemo(() => new THREE.Matrix4(), []);
  const dummyScale = useMemo(() => new THREE.Vector3(), []);
  const sparkColorArray = useMemo(() => new Float32Array(sparkCount * 3).fill(1), [sparkCount]);

  // Initialize instanced mesh colors
  useEffect(() => {
    if (sparksMeshRef.current) {
      const colorAttr = new THREE.InstancedBufferAttribute(sparkColorArray, 3);
      sparksMeshRef.current.instanceColor = colorAttr;
    }
  }, [sparkColorArray]);

  /**
   * One unit sphere shared by every note, scaled per node.
   *
   * Each node used to declare `sphereGeometry args={[radius, 12, 12]}`, which
   * builds a fresh geometry per note — and rebuilds all of them whenever a
   * hover or selection changes any radius. At 24x16 segments a focused node
   * finally reads as a sphere instead of a faceted lump, and it costs one
   * geometry for the whole galaxy instead of several hundred.
   */
  const nodeSphere = useMemo(() => new THREE.SphereGeometry(1, 24, 16), []);
  useEffect(() => () => nodeSphere.dispose(), [nodeSphere]);

  const brainScaffoldMatRef = useRef<THREE.LineBasicMaterial>(null);
  const cosmicDustMatRef = useRef<THREE.PointsMaterial>(null);
  const auroraMatRef = useRef<THREE.LineBasicMaterial>(null);
  const noteLineMatRef = useRef<THREE.LineBasicMaterial>(null);

  // Camera Auto-Fly (node or lobe)
  const targetCamPos = useRef<THREE.Vector3 | null>(null);
  const targetCamLook = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (flyToNode) {
      targetCamPos.current = new THREE.Vector3(
        flyToNode.x + (flyToNode.x > 0 ? 1.5 : -1.5), flyToNode.y + 0.6, flyToNode.z + 3.8
      );
      targetCamLook.current = new THREE.Vector3(flyToNode.x, flyToNode.y, flyToNode.z);
    }
  }, [flyToNode]);

  // Auto-fly camera to lobe when filter changes
  useEffect(() => {
    if (flyToLobe && AREAL_CAMERA[flyToLobe]) {
      const pos = AREAL_CAMERA[flyToLobe];
      targetCamPos.current = new THREE.Vector3(pos[0], pos[1], pos[2]);
      targetCamLook.current = new THREE.Vector3(0, 0, 0);
    }
  }, [flyToLobe]);

  // ═══════════════════════════════════════════════════════════
  // ANIMATION LOOP
  // ═══════════════════════════════════════════════════════════
  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    // Flying the camera means taking it away from OrbitControls for the
    // duration. Controls recompute `camera.position` from their own spherical
    // angles on every frame, so a plain `position.lerp` here was overwritten
    // before it could ever be seen — which is why nothing ever moved: not the
    // space key, not the number keys, not clicking a search result.
    const controls = controlsRef?.current ?? null;
    if (targetCamPos.current && targetCamLook.current) {
      if (controls) controls.enabled = false;
      // Doubled: the old approach felt like being towed, not flown.
      camera.position.lerp(targetCamPos.current, 0.24);
      camera.lookAt(targetCamLook.current);
      if (camera.position.distanceTo(targetCamPos.current) < 0.08) {
        targetCamPos.current = null;
        if (controls) {
          // Hand the camera back where it now looks, or the controls would
          // snap it straight back to their stale target on the next frame.
          controls.target.copy(targetCamLook.current);
          controls.enabled = true;
          controls.update();
        }
      }
    }

    if (groupRef.current && !hoveredNode && !selectedNodeId) {
      groupRef.current.rotation.y += delta * 0.04;
      groupRef.current.rotation.x = Math.sin(t * 0.35) * 0.06;
    }

    if (brainScaffoldMatRef.current) brainScaffoldMatRef.current.opacity = 0.18 + Math.sin(t * 1.8) * 0.08;
    if (cosmicDustMatRef.current) {
      cosmicDustMatRef.current.size = 0.04 + Math.sin(t * 0.9) * 0.015;
      cosmicDustMatRef.current.opacity = 0.3 + Math.sin(t * 1.2) * 0.1;
    }
    if (auroraMatRef.current) auroraMatRef.current.opacity = 0.12 + Math.sin(t * 2.0) * 0.06;
    if (noteLineMatRef.current) noteLineMatRef.current.opacity = 0.45 + Math.sin(t * 1.5) * 0.15;

    // Color-coded sparks per areal
    if (sparksMeshRef.current && validLinks.length > 0) {
      sparks.forEach((spark, i) => {
        spark.progress += delta * spark.speed;
        if (spark.progress > 1.0) {
          spark.progress = 0;
          spark.linkIdx = Math.floor(Math.random() * validLinks.length);

          // Update spark color based on source node's areal
          const link = validLinks[spark.linkIdx];
          if (link && sparksMeshRef.current?.instanceColor) {
            const arealColor = new THREE.Color(AREAL_COLORS[link.src.group] || "#ffffff");
            sparkColorArray[i * 3] = arealColor.r;
            sparkColorArray[i * 3 + 1] = arealColor.g;
            sparkColorArray[i * 3 + 2] = arealColor.b;
            sparksMeshRef.current.instanceColor.needsUpdate = true;
          }
        }

        const link = validLinks[spark.linkIdx];
        if (link) {
          const p = spark.progress;
          const px = link.src.x * (1 - p) + link.tgt.x * p;
          const py = link.src.y * (1 - p) + link.tgt.y * p;
          const pz = link.src.z * (1 - p) + link.tgt.z * p;
          const s = 0.05 + Math.sin(p * Math.PI) * 0.04;
          dummyScale.set(s, s, s);
          dummyMatrix.compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion(), dummyScale);
          sparksMeshRef.current!.setMatrixAt(i, dummyMatrix);
        }
      });
      sparksMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      <points geometry={cosmicDustGeometry}>
        <pointsMaterial ref={cosmicDustMatRef} size={0.05} vertexColors transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>

      <lineSegments geometry={cosmicWebGeometry}>
        <lineBasicMaterial vertexColors transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>

      <lineSegments geometry={auroraGeometry}>
        <lineBasicMaterial ref={auroraMatRef} vertexColors transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>

      <lineSegments geometry={brainScaffoldLines}>
        <lineBasicMaterial ref={brainScaffoldMatRef} color="#00f0ff" transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>

      <points geometry={brainScaffoldPointsGeo}>
        <pointsMaterial size={0.06} vertexColors transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>

      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial ref={noteLineMatRef} vertexColors transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>

      <instancedMesh ref={sparksMeshRef} args={[undefined, undefined, sparkCount]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>

      {/* PINPOINT COGNITIVE NEURONS (color-coded per areal) */}
      {filteredNodes.map((node) => {
        const isSelected = selectedNodeId === node.id;
        const isHovered = hoveredNode?.id === node.id;
        const isNeighbor = connectedNeighborIds.has(node.id);
        const isDimmed = selectedNodeId != null && !isSelected && !isNeighbor;
        const isFiltered = activeFilter !== "all";
        const isInActiveAreal = node.group === activeFilter;
        const arealDimmed = isFiltered && !isInActiveAreal;

        // The area palette applies always, not only once a filter is on.
        // `node.color` comes from the graph route, where Projekte and Wissen
        // are both #00f0ff and System and Quellen are both #38bdf8 — so in the
        // overall view four of the nine areas were indistinguishable, which is
        // the one thing the colours exist to prevent.
        const arealColor = AREAL_COLORS[node.group] || node.color;

        // Size carries meaning. Every note used to be 0.05 across the board, so
        // a hub with 190 links looked exactly like an orphan and the galaxy
        // read as even dust.
        const degree = degreeById.get(node.id) ?? 0;
        // A note nothing links to is a loose end: written down once and never
        // connected to anything, so it is effectively invisible to you. There are
        // a dozen of them, and finding them by scrolling is hopeless — but they
        // are obvious the moment they are the only red things in the sky.
        const isOrphan = degree === 0;
        const displayColor = showOrphans && isOrphan ? "#f43f5e" : arealColor;
        const baseRadius =
          0.024 + (Math.log1p(degree) / Math.log1p(maxDegree)) * 0.075;
        const radius = showOrphans && isOrphan
          ? baseRadius * 2.6
          : isSelected
          ? baseRadius * 2.4
          : isHovered
            ? baseRadius * 1.8
            : isInActiveAreal && isFiltered
              ? baseRadius * 1.35
              : baseRadius;
        const opacity = isDimmed
          ? 0.18
          : arealDimmed
            ? 0.15
            : showOrphans && !isOrphan
              ? 0.22
              : 1.0;
        // Brightness follows the same signal as size, so the hubs read as suns
        // and the rest as dust. Every note used to glow at a flat 1.5, which
        // handed the bloom pass nothing to pick out.
        const degreeWeight = Math.log1p(degree) / Math.log1p(maxDegree);
        const restingEmissive = 0.85 + degreeWeight * 2.75;
        const emissive = showOrphans && isOrphan
          ? 4.0
          : isSelected
          ? 4.5
          : isHovered
            ? 3.0
            : isInActiveAreal && isFiltered
              ? 2.5
              : arealDimmed
                ? 0.4
                : restingEmissive;

        return (
          <group key={node.id} position={[node.x, node.y, node.z]}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                cyberAudio.playElectricalZap();
                onSelectNode?.(node);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredNode(node);
                cyberAudio.playSynapseBlip();
              }}
              onPointerOut={() => setHoveredNode(null)}
              geometry={nodeSphere}
              scale={radius}
            >
              <meshStandardMaterial
                color={displayColor}
                emissive={displayColor}
                emissiveIntensity={emissive}
                roughness={0.1}
                metalness={0.95}
                // Flagging an opaque note as transparent drops it out of the
                // opaque queue, costing early-Z and a per-frame depth sort for
                // all 255 of them. Only the dimmed ones actually need it.
                transparent={opacity < 1}
                opacity={opacity}
              />
            </mesh>

            {(isSelected || isHovered) && (
              <mesh geometry={nodeSphere} scale={radius * 2.5}>
                <meshBasicMaterial
                  color={isSelected ? "#ffffff" : displayColor}
                  transparent
                  opacity={isSelected ? 0.55 : 0.35}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            )}

            {isSelected && (
              <>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[radius * 2.5, radius * 3.2, 32]} />
                  <meshBasicMaterial color={displayColor} transparent opacity={0.9} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
                </mesh>
                {/* Secondary expanding bio-electric shockwave ring */}
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[radius * 4.2, radius * 4.9, 32]} />
                  <meshBasicMaterial color="#ffffff" transparent opacity={0.65} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
                </mesh>
              </>
            )}

            {degree >= labelCutoff && !isHovered && !isSelected && !isDimmed && !arealDimmed && (
              <Billboard position={[0, radius + 0.07, 0]}>
                <Text
                  fontSize={0.052}
                  color="#dbeafe"
                  anchorX="center"
                  anchorY="bottom"
                  outlineWidth={0.006}
                  outlineColor="#020617"
                  maxWidth={1.6}
                >
                  {node.name}
                </Text>
              </Billboard>
            )}

            {(isHovered || isSelected) && (
              <Html distanceFactor={14} center>
                <div className="pointer-events-none -translate-y-8 whitespace-nowrap rounded-lg border border-cyan-400/60 bg-[#030712]/95 px-2.5 py-1 font-mono text-[10px] text-cyan-200 shadow-2xl shadow-cyan-500/30 backdrop-blur-md">
                  <span className="font-bold text-white tracking-wide">{node.name}</span>
                  <span className="ml-2 text-[9px] font-medium" style={{ color: arealColor }}>({node.folder})</span>
                  {isSelected && <span className="ml-2 rounded px-1 py-0.2 text-[8px] uppercase font-bold" style={{ backgroundColor: arealColor + "40", color: arealColor }}>FOKUS</span>}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
