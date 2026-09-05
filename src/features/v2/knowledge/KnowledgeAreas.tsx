"use client";

/**
 * ============================================================================
 * W1 — Antigravitys Wissensareale, in V2 integriert
 * ============================================================================
 *
 * Geliefert von Antigravity unter
 * `05 🚀 Projekte/01 Hermes Agent OS/Code/Hermes3D-KnowledgeAreas-Module/`.
 * Diese Datei ist die Lieferung, nicht meine Arbeit. Layout, Arealzentren,
 * Nachbarschaftslogik und Materialien sind unverändert.
 *
 * MEINE EINGRIFFE AN DER NAHT — vollständig, damit niemand raten muss:
 *
 * 1. Die Farben kommen jetzt aus `palette.ts` statt aus zwei eigenen
 *    Konstanten. Zwei Dateien, die dieselbe Auswahlfarbe behaupten, sind
 *    zwei Wahrheiten; sie stimmten heute überein und wären beim nächsten
 *    Edit auseinandergelaufen. Die Namen bleiben exportiert, damit die
 *    Demo des Moduls weiter baut.
 *
 * 2. Zwei Ereignisbehandler waren mit `any` typisiert und eine Bindung
 *    (`activeEdgeMap`) wurde berechnet und nie gelesen. Beides bricht die
 *    Lint-Schranke dieses Projekts, und eine abgeschaltete Schranke ist
 *    schlimmer als der Verstoß. Die Handler haben jetzt die echten
 *    R3F-Ereignistypen; die Logik ist Zeile für Zeile dieselbe.
 *
 * Alles Weitere geschieht ausserhalb dieser Datei: die Anpassung der
 * Vault-Daten steht in `adaptVault.ts`, die Kamera in `CameraDirector.tsx`.
 * Wer diese Datei mit der Lieferung vergleicht, soll genau diese zwei
 * Unterschiede finden.
 */

import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import * as THREE from "three";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";

import { DECISION_COLOR, SELECTION_COLOR } from "@/features/v2/palette";
import type {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeAreasProps,
  AreaClusterInfo,
} from "./knowledgeTypes";

// ============================================================================
// KONSTANTEN & PALETTE (abgestimmt auf Hermes 3D V2)
// ============================================================================

// Eingriff 1: aus der Palette, nicht neben ihr. Siehe Dateikopf.
export { SELECTION_COLOR, DECISION_COLOR };
export const NEIGHBOR_COLOR = "#38bdf8";  // Frisches Cyan für direkte Nachbarn
export const INACTIVE_EDGE_COLOR = "#1e3a5f";

// Standardfarben je LifeOS-Hauptgruppe (falls nicht in Metadaten definiert)
const GROUP_COLORS: Record<string, string> = {
  "00📥Inbox": "#38bdf8",
  "01📦RAW": "#64748b",
  "02⚙️ System": "#94a3b8",
  "03🪪 Identität": "#818cf8",
  "04📖 Lebensprofil": "#a78bfa",
  "05 🚀 Projekte": "#34d399",
  "06💡Interessen": "#f472b6",
  "07🧠Wissen": "#60a5fa",
  "08📚Quellen": "#f59e0b",
  "09🅿️Ideenparkplatz": "#2dd4bf",
  "Ungeordnet": "#475569",
};

// 3D-Zentren für den gehirn-/kosmosartigen Wissenskörper
const CLUSTER_CENTERS: Record<string, [number, number, number]> = {
  "07🧠Wissen": [0, 2, 0],           // Zentraler Wissenskern
  "03🪪 Identität": [-7, 1, 3],       // Linke Hemisphäre vorne
  "04📖 Lebensprofil": [-8, 5, -1],   // Linke Hemisphäre oben
  "02⚙️ System": [-5, -2, 2],         // Linker Kontrollsockel
  "05 🚀 Projekte": [7, 1, 3],        // Rechte Hemisphäre vorne
  "06💡Interessen": [8, 5, -1],       // Rechte Hemisphäre oben
  "09🅿️Ideenparkplatz": [3.5, 6, 1.5], // Oberer Orbit
  "08📚Quellen": [0, 3, -8],          // Hinterer Quellenbogen
  "01📦RAW": [0, -4, -4],             // Tiefes Fundament
  "00📥Inbox": [0, -1, 7],            // Eingangsschwelle vorne
  "Ungeordnet": [11, -1, -4],         // Äußerer Halo
};

// Deterministischer Pseudo-Zufall aus String-Hash (reproduzierbare XYZ-Positionen)
function hashStringToUnit(str: string, seed = 0): number {
  let h = 0x811c9dc5 ^ seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 100000) / 100000;
}

// ============================================================================
// HILFSTYPEN FÜR DAS INTERNE 3D-LAYOUT
// ============================================================================

interface PositionedNode extends KnowledgeNode {
  position: THREE.Vector3;
  clusterCenter: THREE.Vector3;
  clusterRadius: number;
  colorHex: string;
}

// ============================================================================
// HAUPTKOMPONENTE: KnowledgeAreas
// ============================================================================

export function KnowledgeAreas({
  nodes = [],
  edges = [],
  selectedId = null,
  query = "",
  reducedMotion = false,
  onSelect,
  onFocusRequest,
}: KnowledgeAreasProps) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  const selectionMeshRef = useRef<THREE.Mesh>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // 1. Cluster- und Positionsberechnung (nur bei Datenänderung, NICHT pro Frame)
  const { positionedNodes, nodeMap, clusters } = useMemo(() => {
    // Gruppierung nach groupId
    const groups = new Map<string, KnowledgeNode[]>();
    for (const node of nodes) {
      const gid = node.groupId || "Ungeordnet";
      if (!groups.has(gid)) groups.set(gid, []);
      groups.get(gid)!.push(node);
    }

    const clustersList: AreaClusterInfo[] = [];
    const posList: PositionedNode[] = [];
    const nMap = new Map<string, PositionedNode>();

    // Jede Gruppe im 3D-Raum anordnen
    for (const [gid, groupNodes] of groups.entries()) {
      const centerCoord = CLUSTER_CENTERS[gid] || [9, 0, 0];
      const centerVec = new THREE.Vector3(...centerCoord);
      const nodeCount = groupNodes.length;
      
      // Radius skaliert mit Wurzel der Notizanzahl (Bereichsausdehnung zeigt Notizanzahl)
      const clusterRadius = Math.max(1.8, Math.sqrt(nodeCount) * 1.15);
      const color = GROUP_COLORS[gid] || groupNodes[0]?.color || "#38bdf8";

      clustersList.push({
        groupId: gid,
        label: gid,
        center: centerCoord,
        radius: clusterRadius,
        nodeCount,
        color,
      });

      // Notizen deterministisch im Kugelvolumen um das Clusterzentrum verteilen
      groupNodes.forEach((node, idx) => {
        // Spherical Fibonacci Verteilung
        const phi = Math.acos(1 - (2 * (idx + 0.5)) / Math.max(1, nodeCount));
        const theta = Math.PI * (1 + Math.sqrt(5)) * (idx + 0.5);

        // Radius-Jitter basierend auf Node-ID Hash (verhindert hohle Schale)
        const jitter = 0.35 + 0.65 * hashStringToUnit(node.id, 42);
        const r = clusterRadius * 0.85 * Math.cbrt(jitter);

        const x = centerVec.x + r * Math.sin(phi) * Math.cos(theta);
        const y = centerVec.y + r * Math.cos(phi) * 0.85; // leicht vertikal gestaucht
        const z = centerVec.z + r * Math.sin(phi) * Math.sin(theta);

        const posNode: PositionedNode = {
          ...node,
          position: new THREE.Vector3(x, y, z),
          clusterCenter: centerVec,
          clusterRadius,
          colorHex: node.color || color,
        };

        posList.push(posNode);
        nMap.set(node.id, posNode);
      });
    }

    return {
      positionedNodes: posList,
      nodeMap: nMap,
      clusters: clustersList,
    };
  }, [nodes]);

  // 2. Direkte Nachbarn und aktive Kanten bei Auswahl ermitteln
  const { directNeighborIds, selectedNode } = useMemo(() => {
    const neighbors = new Set<string>();
    const activeEdges = new Map<string, KnowledgeEdge>();

    if (selectedId) {
      for (const edge of edges) {
        if (edge.sourceId === selectedId) {
          neighbors.add(edge.targetId);
          activeEdges.set(`${edge.sourceId}->${edge.targetId}`, edge);
        } else if (edge.targetId === selectedId) {
          neighbors.add(edge.sourceId);
          activeEdges.set(`${edge.sourceId}->${edge.targetId}`, edge);
        }
      }
    }

    return {
      directNeighborIds: neighbors,
      activeEdgeMap: activeEdges,
      selectedNode: selectedId ? nodeMap.get(selectedId) || null : null,
    };
  }, [selectedId, edges, nodeMap]);

  // 3. Kanten-Geometrien erstellen: Hintergrund (alle) vs. Aktiv (Nachbarschaft)
  const { backgroundLinesGeo, activeLinesGeo } = useMemo(() => {
    const bgPositions: number[] = [];
    const activePositions: number[] = [];

    for (const edge of edges) {
      const from = nodeMap.get(edge.sourceId);
      const to = nodeMap.get(edge.targetId);
      if (!from || !to) continue;

      const isConnectedToSelected =
        selectedId && (edge.sourceId === selectedId || edge.targetId === selectedId);

      if (isConnectedToSelected) {
        activePositions.push(
          from.position.x, from.position.y, from.position.z,
          to.position.x, to.position.y, to.position.z
        );
      } else {
        bgPositions.push(
          from.position.x, from.position.y, from.position.z,
          to.position.x, to.position.y, to.position.z
        );
      }
    }

    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute("position", new THREE.Float32BufferAttribute(bgPositions, 3));

    const actGeo = new THREE.BufferGeometry();
    actGeo.setAttribute("position", new THREE.Float32BufferAttribute(activePositions, 3));

    return { backgroundLinesGeo: bgGeo, activeLinesGeo: actGeo };
  }, [edges, nodeMap, selectedId]);

  // Bereinigung der BufferGeometries bei Unmount
  useEffect(() => {
    return () => {
      backgroundLinesGeo.dispose();
      activeLinesGeo.dispose();
    };
  }, [backgroundLinesGeo, activeLinesGeo]);

  // 4. InstancedMesh für Notizpunkte aktualisieren (Transform, Farben & Größen)
  useEffect(() => {
    const mesh = instancedMeshRef.current;
    if (!mesh || positionedNodes.length === 0) return;

    const dummy = new THREE.Object3D();
    const tempColor = new THREE.Color();
    const queryLower = query.trim().toLowerCase();

    positionedNodes.forEach((node, i) => {
      dummy.position.copy(node.position);

      const isSelected = selectedId === node.id;
      const isNeighbor = directNeighborIds.has(node.id);
      const isHovered = hoveredId === node.id;

      // Suchabgleich
      const matchesQuery = !queryLower || 
        node.title.toLowerCase().includes(queryLower) ||
        (node.groupId && node.groupId.toLowerCase().includes(queryLower));

      // Basis-Skalierung abhängig vom Vernetzungsgrad (degree)
      const baseScale = Math.max(0.75, Math.min(1.8, 0.8 + (node.degree || 1) * 0.08));

      let finalScale = baseScale;
      if (isSelected) {
        finalScale = baseScale * 1.6;
      } else if (isNeighbor || isHovered) {
        finalScale = baseScale * 1.35;
      } else if (selectedId && !isNeighbor) {
        // Nicht-Nachbarn dezent verkleinern
        finalScale = baseScale * 0.65;
      }

      if (!matchesQuery) {
        finalScale = finalScale * 0.35;
      }

      dummy.scale.setScalar(finalScale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Farbsteuerung: Selektion = SELECTION_COLOR, Nachbarn = NEIGHBOR_COLOR/Akzent
      if (isSelected) {
        tempColor.set(SELECTION_COLOR);
      } else if (isNeighbor) {
        tempColor.set(NEIGHBOR_COLOR).lerp(new THREE.Color(node.colorHex), 0.3);
      } else if (selectedId) {
        // Stark gedimmt, wenn andere Notiz aktiv
        tempColor.set(node.colorHex).multiplyScalar(0.18);
      } else if (!matchesQuery) {
        tempColor.set(node.colorHex).multiplyScalar(0.2);
      } else {
        tempColor.set(node.colorHex);
      }

      mesh.setColorAt(i, tempColor);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [positionedNodes, selectedId, directNeighborIds, hoveredId, query]);

  // 5. Animierte Effekte in useFrame (bei reducedMotion komplett statisch)
  useFrame(({ clock }) => {
    if (reducedMotion) return;

    const t = clock.getElapsedTime();

    // Dezentes Atmen / Schwebepuls des selektierten Rings
    if (selectionMeshRef.current && selectedNode) {
      selectionMeshRef.current.position.copy(selectedNode.position);
      const pulse = 1 + Math.sin(t * 3.2) * 0.12;
      selectionMeshRef.current.scale.setScalar(pulse);
      selectionMeshRef.current.lookAt(camera.position);
    }

    // Sehr feine, langsame Raumdrift der gesamten Gruppe
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.04) * 0.02;
    }
  });

  // Klick-Handler für Instanzen
  const handleInstanceClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const instanceId = e.instanceId;
      if (typeof instanceId === "number" && instanceId >= 0 && instanceId < positionedNodes.length) {
        const clickedNode = positionedNodes[instanceId];
        if (clickedNode && onSelect) {
          onSelect(clickedNode.id);
        }
      }
    },
    [positionedNodes, onSelect]
  );

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const instanceId = e.instanceId;
    if (typeof instanceId === "number" && instanceId >= 0 && instanceId < positionedNodes.length) {
      setHoveredId(positionedNodes[instanceId].id);
    }
  }, [positionedNodes]);

  const handlePointerOut = useCallback(() => {
    setHoveredId(null);
  }, []);

  return (
    <group ref={groupRef}>
      {/* 1. CLUSTER-AREALE: Zentren, Halo-Ringe & Gruppen-Labels */}
      {clusters.map((cluster) => {
        const isClusterSelected = selectedNode?.groupId === cluster.groupId;

        return (
          <group key={cluster.groupId} position={cluster.center}>
            {/* Halo-Ring in der XZ-Ebene (zeigt Bereichsausdehnung nach Notizanzahl) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[cluster.radius * 0.96, cluster.radius * 1.02, 48]} />
              <meshBasicMaterial
                color={cluster.color}
                transparent
                opacity={isClusterSelected ? 0.35 : 0.12}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Areal-Beschriftung (Cluster-Titel + Anzahl Notizen) */}
            <Billboard
              position={[0, cluster.radius * 0.85 + 0.4, 0]}
              follow={true}
              lockX={false}
              lockY={false}
              lockZ={false}
            >
              <Text
                fontSize={0.42}
                color={isClusterSelected ? SELECTION_COLOR : cluster.color}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.03}
                outlineColor="#070d14"
                onClick={(e) => {
                  e.stopPropagation();
                  onFocusRequest?.({
                    center: cluster.center,
                    radius: cluster.radius,
                    groupId: cluster.groupId,
                  });
                }}
              >
                {`${cluster.label} (${cluster.nodeCount})`}
              </Text>
            </Billboard>
          </group>
        );
      })}

      {/* 2. HINTERGRUND-KANTEN (Gedämpft als LineSegments) */}
      <lineSegments geometry={backgroundLinesGeo}>
        <lineBasicMaterial
          color={INACTIVE_EDGE_COLOR}
          transparent
          opacity={selectedId ? 0.05 : 0.22}
          depthWrite={false}
        />
      </lineSegments>

      {/* 3. AKTIVE KANTEN (Hervorgehoben zur ausgewählten Notiz) */}
      {selectedId && (
        <lineSegments geometry={activeLinesGeo}>
          <lineBasicMaterial
            color={SELECTION_COLOR}
            transparent
            opacity={0.92}
            linewidth={2}
            depthWrite={false}
          />
        </lineSegments>
      )}

      {/* 4. NOTIZEN ALS INSTANCED MESH (1 Draw Call für alle Punkte) */}
      <instancedMesh
        ref={instancedMeshRef}
        args={[undefined, undefined, positionedNodes.length]}
        onClick={handleInstanceClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial
          roughness={0.25}
          metalness={0.15}
          emissive="#000000"
          emissiveIntensity={0.2}
        />
      </instancedMesh>

      {/* 5. SELEKTIONS-RING (Pulsierender Indikator auf der gewählten Notiz) */}
      {selectedNode && (
        <mesh
          ref={selectionMeshRef}
          position={selectedNode.position}
        >
          <ringGeometry args={[0.32, 0.42, 32]} />
          <meshBasicMaterial
            color={SELECTION_COLOR}
            transparent
            opacity={0.88}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* 6. LABELS FÜR AUSWAHL & DIREKTE NACHBARN (Selektives Labeling) */}
      {selectedNode && (
        <Billboard
          position={[
            selectedNode.position.x,
            selectedNode.position.y + 0.45,
            selectedNode.position.z,
          ]}
        >
          <Text
            fontSize={0.34}
            maxWidth={3.8}
            textAlign="center"
            color={SELECTION_COLOR}
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.035}
            outlineColor="#070d14"
          >
            {selectedNode.title}
          </Text>
        </Billboard>
      )}

      {/* Labels der direkten Nachbarn */}
      {Array.from(directNeighborIds).slice(0, 10).map((neighborId) => {
        const neighbor = nodeMap.get(neighborId);
        if (!neighbor) return null;

        return (
          <Billboard
            key={neighborId}
            position={[
              neighbor.position.x,
              neighbor.position.y + 0.35,
              neighbor.position.z,
            ]}
          >
            <Text
              fontSize={0.24}
              maxWidth={2.8}
              textAlign="center"
              color="#e2e8f0"
              anchorX="center"
              anchorY="bottom"
              outlineWidth={0.025}
              outlineColor="#070d14"
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(neighbor.id);
              }}
            >
              {neighbor.title}
            </Text>
          </Billboard>
        );
      })}
    </group>
  );
}

export default KnowledgeAreas;
