"use client";

/**
 * ============================================================================
 * W1 — Antigravitys Wissensareale, in V2 integriert
 * ============================================================================
 *
 * Geliefert von Antigravity unter
 * `05 🚀 Projekte/01 Hermes Agent OS/Code/Hermes3D-KnowledgeAreas-Module/`.
 * Rendering, Auswahl- und Nachbarschaftslogik sind Antigravitys Arbeit und
 * unverändert. Form, Bahnen und Bewegung sind auf Onurs ausdrücklichen
 * Wunsch von mir geändert — vollständig aufgeführt, damit der Vergleich mit
 * der Lieferung keine Rätsel aufgibt.
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
 * 3. Die zehn Arealfarben standen als eigene Tabelle in dieser Datei und
 *    waren zu acht Elfteln blau. Onurs Rückmeldung war „zu blau", und die
 *    Ursache lag hier. Die Tabelle liegt jetzt in `palette.ts` neben den
 *    Signalfarben, damit „welche Farbe hat ein Areal" eine Antwort hat und
 *    nicht zwei. Die Zuordnung der Schlüssel ist unverändert.
 *
 * 4. **Die Form.** Die zehn Areale waren zehn Kugeln, und zehn Kugeln lesen
 *    sich als zehn Kugeln. Zentren und Achsen liegen jetzt in
 *    `brainLayout.ts`: gespiegelte Hemisphären, ein Kern, ein Stamm, und vor
 *    allem eine Furche in der Mitte. Welche Notiz in welchem Areal liegt,
 *    entscheidet unverändert ihr Ordner.
 *
 * 5. **Gebogene Bahnen statt gerader Sehnen.** 1.132 gerade Linien durch eine
 *    Wolke sind ein Knäuel, egal wie man die Punkte legt. Jede Kante wird zur
 *    Mitte gebogen; Verbindungen zwischen denselben Arealen laufen dadurch
 *    zusammen. Keine Kante wurde erfunden oder weggelassen.
 *
 * 6. **Bewegung.** Signale wandern auf den Bahnen (eine Uniform, kein
 *    CPU-Aufwand pro Bild), und der Körper dreht sich langsam — hält aber an,
 *    sobald ausgewählt oder gesucht wird. Sichtbarkeit hat Vorrang vor
 *    Bewegung; das war Onurs Bedingung und es ist auch die richtige.
 *
 * Alles Weitere geschieht ausserhalb dieser Datei: die Anpassung der
 * Vault-Daten steht in `adaptVault.ts`, die Kamera in `CameraDirector.tsx`.
 * Wer diese Datei mit der Lieferung vergleicht, soll genau diese sechs
 * Unterschiede finden.
 */

import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import * as THREE from "three";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";

import { AREA_COLORS, DECISION_COLOR, SELECTION_COLOR } from "@/features/v2/palette";
import { applyFissure, areaRadius, AREA_SHAPE, BRAIN_CENTERS, curvePoints } from "@/features/v2/knowledge/brainLayout";
import { CortexShell } from "@/features/v2/knowledge/CortexShell";
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
export const NEIGHBOR_COLOR = "#7fd4e8";  // Gedämpftes Cyan für direkte Nachbarn
// Warmes Dunkelgrau statt Marineblau. Das Grundnetz ist die größte
// zusammenhängende Fläche im Bild; in Blau färbte es den ganzen Raum.
export const INACTIVE_EDGE_COLOR = "#bca7ef";

// Eingriff 3: die Arealfarben kommen aus der Palette. Siehe Dateikopf.
const GROUP_COLORS = AREA_COLORS;

// Eingriff 4: Zentren und Formen liegen in brainLayout.ts. Siehe Dateikopf.
const CLUSTER_CENTERS = BRAIN_CENTERS;


/**
 * Eingriff 6: Signale, die auf den Bahnen laufen.
 *
 * Onur wollte Bewegung „wie Neuronen die hin und her". Das hier ist die
 * billigste ehrliche Umsetzung: jeder Punkt weiß, wie weit er auf seiner Bahn
 * liegt (`aT`), und der Shader hellt die Stelle auf, an der gerade ein Signal
 * vorbeikommt. Die CPU rührt pro Bild nichts an — es gibt genau eine Uniform.
 *
 * Wichtig: Die Grundhelligkeit bleibt erhalten. Die Bahn verschwindet nicht
 * zwischen zwei Signalen, sonst blinkt das Netz statt zu leiten.
 */
const TRACT_VERTEX = /* glsl */ `
  attribute float aT;
  attribute float aSeed;
  varying float vGlow;
  uniform float uTime;
  uniform float uSpeed;

  void main() {
    // Zwei Signale je Bahn, gegenläufig und unterschiedlich schnell.
    //
    // Eines allein sah aus wie ein Laufband: alles wandert in dieselbe
    // Richtung, gleichmäßig, und wird nach zehn Sekunden Tapete. Zwei, die
    // sich begegnen, lesen sich als Verkehr — und genau das war der Wunsch,
    // dass es "hin und her springt". Kostet nichts: dieselbe Rechnung zweimal
    // im Vertex-Shader, keine zusätzliche Geometrie, keine zweite Uniform.
    float head = fract(uTime * uSpeed + aSeed);
    float d = abs(aT - head);
    // Der kürzere Weg um den Ring herum, damit der Übergang nicht springt.
    d = min(d, 1.0 - d);

    // Der Rückläufer: langsamer, schwächer, anders gestartet. Er soll dem
    // ersten begegnen und nicht mit ihm im Gleichschritt laufen.
    float back = fract(-uTime * uSpeed * 0.63 + aSeed * 1.7 + 0.37);
    float db = abs(aT - back);
    db = min(db, 1.0 - db);

    vGlow = max(smoothstep(0.07, 0.0, d), smoothstep(0.05, 0.0, db) * 0.75);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const TRACT_FRAGMENT = /* glsl */ `
  precision mediump float;
  varying float vGlow;
  uniform vec3 uColor;
  uniform float uBase;
  uniform float uGlow;

  void main() {
    gl_FragColor = vec4(uColor * (0.55 + vGlow * uGlow), uBase + vGlow * uGlow * 0.45);
  }
`;

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
  queryHitIds,
  reducedMotion = false,
  onSelect,
  onFocusRequest,
}: KnowledgeAreasProps) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  const selectionMeshRef = useRef<THREE.Mesh>(null);
  const backgroundMaterial = useRef<THREE.ShaderMaterial>(null);
  const activeMaterial = useRef<THREE.ShaderMaterial>(null);
  /** How much of the rotation is currently running, 0 to 1. Eased, not switched. */
  const spin = useRef(1);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Built once. The colours and the speed are pushed in as uniforms, so a
  // change of selection never rebuilds a material.
  const backgroundUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSpeed: { value: 0.075 },
      uColor: { value: new THREE.Color(INACTIVE_EDGE_COLOR) },
      // Sehr niedrig, und das ist kein Geschmack: acht Stücke je Kante mal
      // 1.132 Kanten überlagern sich, und Additivmischung summiert jede
      // Überlagerung. Bei 0.16 war das Grundnetz ein weißer Schleier über
      // allem — die erste Fassung sah aus wie Watte.
      uBase: { value: 0.05 },
      uGlow: { value: 0.22 },
    }),
    [],
  );
  const activeUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      // Faster on the selected note's own tracts: the signal he asked about
      // should be the liveliest thing on screen.
      uSpeed: { value: 0.19 },
      uColor: { value: new THREE.Color("#ecdfff") },
      uBase: { value: 0.4 },
      uGlow: { value: 2.2 },
    }),
    [],
  );

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
      
      // Radius skaliert mit Wurzel der Notizanzahl (Bereichsausdehnung zeigt
      // Notizanzahl). Eingriff 4: Faktor von 1.15 auf 0.78. Bei 1.15 maß das
      // Quellenareal 9,5 Einheiten bei 7 Einheiten Abstand zum Nachbarn — die
      // zehn Areale lagen vollständig ineinander, und was man sah, war ein
      // Klumpen mit zehn Beschriftungen. Die Kennzahl bleibt dieselbe.
      const clusterRadius = areaRadius(nodeCount);
      const color = GROUP_COLORS[gid] || groupNodes[0]?.color || "#38bdf8";

      clustersList.push({
        groupId: gid,
        label: gid,
        center: centerCoord,
        radius: clusterRadius,
        nodeCount,
        color,
      });

      // Notizen deterministisch im Volumen um das Clusterzentrum verteilen.
      // Eingriff 4: kein Kugelvolumen mehr, sondern ein Ellipsoid je Areal,
      // plus die Mittelfurche. Verteilung und Reihenfolge sind unverändert.
      const shape = AREA_SHAPE[gid] ?? [1, 1, 1];
      groupNodes.forEach((node, idx) => {
        // Spherical Fibonacci Verteilung
        const phi = Math.acos(1 - (2 * (idx + 0.5)) / Math.max(1, nodeCount));
        const theta = Math.PI * (1 + Math.sqrt(5)) * (idx + 0.5);

        // Radius-Jitter basierend auf Node-ID Hash (verhindert hohle Schale)
        const jitter = 0.35 + 0.65 * hashStringToUnit(node.id, 42);
        const r = clusterRadius * 0.85 * Math.cbrt(jitter);

        const x = centerVec.x + r * Math.sin(phi) * Math.cos(theta) * shape[0];
        const y = centerVec.y + r * Math.cos(phi) * 0.85 * shape[1];
        const z = centerVec.z + r * Math.sin(phi) * Math.sin(theta) * shape[2];

        const posNode: PositionedNode = {
          ...node,
          position: applyFissure(new THREE.Vector3(x, y, z), centerVec.x),
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

  /**
   * 3. Kanten als gebogene Bahnen statt gerader Sehnen.
   *
   * Eingriff 5. Jede Kante wird in acht Stücke geteilt und zur Mitte hin
   * gebogen; Verbindungen zwischen denselben zwei Arealen nehmen dadurch fast
   * denselben Weg und legen sich zu sichtbaren Bahnen zusammen. Das ist die
   * eine Änderung, die aus dem Linienknäuel ein Nervensystem macht.
   *
   * Jeder Punkt trägt zusätzlich `aT` — wie weit er auf seiner Bahn liegt —
   * und `aSeed`. Damit kann der Shader Signale wandern lassen, ohne dass die
   * CPU pro Bild irgendetwas anfasst.
   *
   * Kosten: 1.132 Kanten × 8 Stücke = rund 18.000 Punkte in einem Draw. Die
   * Berechnung läuft bei Datenänderung, nicht pro Bild.
   */
  const { backgroundLinesGeo, activeLinesGeo } = useMemo(() => {
    const bgPositions: number[] = [];
    const bgT: number[] = [];
    const bgSeed: number[] = [];
    const activePositions: number[] = [];
    const activeT: number[] = [];
    const activeSeed: number[] = [];

    const centre = new THREE.Vector3(0, 1.4, 0);
    const SAMPLES = 8;

    edges.forEach((edge, edgeIndex) => {
      const from = nodeMap.get(edge.sourceId);
      const to = nodeMap.get(edge.targetId);
      if (!from || !to) return;

      const isConnectedToSelected =
        selectedId && (edge.sourceId === selectedId || edge.targetId === selectedId);

      const points = curvePoints(from.position, to.position, centre, SAMPLES);
      const seed = (edgeIndex % 97) / 97;

      const positions = isConnectedToSelected ? activePositions : bgPositions;
      const ts = isConnectedToSelected ? activeT : bgT;
      const seeds = isConnectedToSelected ? activeSeed : bgSeed;

      // Als Liniensegmente: jedes Stück braucht Anfang und Ende.
      for (let i = 0; i < points.length - 1; i += 1) {
        const a = points[i];
        const b = points[i + 1];
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        ts.push(i / (points.length - 1), (i + 1) / (points.length - 1));
        seeds.push(seed, seed);
      }
    });

    const build = (positions: number[], ts: number[], seeds: number[]) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute("aT", new THREE.Float32BufferAttribute(ts, 1));
      geo.setAttribute("aSeed", new THREE.Float32BufferAttribute(seeds, 1));
      return geo;
    };

    return {
      backgroundLinesGeo: build(bgPositions, bgT, bgSeed),
      activeLinesGeo: build(activePositions, activeT, activeSeed),
    };
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
      /**
       * Suchabgleich — Titel, Ordner, **oder** ein Volltexttreffer von oben.
       *
       * Ohne den dritten Fall blieb eine Notiz dunkel, deren Name gar nicht
       * gesucht war: Wer nach einem Namen sucht, der im Text von zehn Notizen
       * steht und in keinem Titel, bekam ihn in der Liste und im Raum nicht.
       * Eine Suche, deren beide Haelften sich widersprechen, wirkt kaputt —
       * auch wenn jede fuer sich „funktioniert".
       */
      const matchesQuery =
        !queryLower ||
        node.title.toLowerCase().includes(queryLower) ||
        (node.groupId && node.groupId.toLowerCase().includes(queryLower)) ||
        Boolean(queryHitIds?.has(node.id));

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
  }, [positionedNodes, selectedId, directNeighborIds, hoveredId, query, queryHitIds]);

  // 5. Animierte Effekte in useFrame (bei reducedMotion komplett statisch)
  useFrame(({ clock }, delta) => {
    if (reducedMotion) return;

    const t = clock.getElapsedTime();

    // Dezentes Atmen / Schwebepuls des selektierten Rings
    if (selectionMeshRef.current && selectedNode) {
      selectionMeshRef.current.position.copy(selectedNode.position);
      const pulse = 1 + Math.sin(t * 3.2) * 0.12;
      selectionMeshRef.current.scale.setScalar(pulse);
      selectionMeshRef.current.lookAt(camera.position);
    }

    // Eingriff 6: die Signale auf den Bahnen. Eine Uniform, kein CPU-Aufwand.
    if (backgroundMaterial.current) {
      backgroundMaterial.current.uniforms.uTime.value = t;
      // Zurückgenommen, sobald eine Notiz gewählt ist — sonst konkurriert das
      // Grundnetz mit genau der Nachbarschaft, die es zeigen soll.
      backgroundMaterial.current.uniforms.uBase.value = selectedId ? 0.012 : 0.065;
    }
    if (activeMaterial.current) {
      activeMaterial.current.uniforms.uTime.value = t;
    }

    /**
     * Eingriff 6: der Körper dreht sich — und hält an, sobald gezielt wird.
     *
     * Onur wollte die Drehung ausdrücklich, und ebenso ausdrücklich, dass die
     * Sichtbarkeit nicht verloren geht. Beides gleichzeitig gibt es nur so:
     * ein Ziel, das sich wegdreht, während er darauf klickt, ist kein Feature.
     * Auswahl oder Suche friert die Drehung ein, das Loslassen taut sie wieder
     * auf — und zwar weich, damit das Anhalten nicht wie ein Ruckler aussieht.
     */
    if (groupRef.current) {
      const wantsStill = Boolean(selectedId) || query.trim().length > 0;
      spin.current += ((wantsStill ? 0 : 1) - spin.current) * Math.min(1, delta * 3);
      groupRef.current.rotation.y += delta * 0.055 * spin.current;
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
                opacity={isClusterSelected ? 0.32 : 0.055}
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

      {/* Eingriff 4: die Haut des Körpers, aus kreisenden Teilchen.
          Das Drahtgitter, das vorher hier stand, las sich als Käfig — eine
          Form braucht eine Oberfläche, keine Umrandung. Die Schale ist
          ausdrücklich Dekoration und sieht auch so aus: eine Farbe, halb so
          groß wie die kleinste Notiz, nicht anklickbar. */}
      <CortexShell reducedMotion={reducedMotion} dimmed={Boolean(selectedId) || query.trim().length > 0} />

      {/* 2. HINTERGRUND-BAHNEN. Gebogen, gebündelt, mit wandernden Signalen. */}
      <lineSegments geometry={backgroundLinesGeo}>
        <shaderMaterial
          ref={backgroundMaterial}
          vertexShader={TRACT_VERTEX}
          fragmentShader={TRACT_FRAGMENT}
          uniforms={backgroundUniforms}
          transparent
          depthWrite={false}
        />
      </lineSegments>

      {/* 3. AKTIVE BAHNEN (zur ausgewählten Notiz) */}
      {selectedId && (
        <lineSegments geometry={activeLinesGeo}>
          <shaderMaterial
            ref={activeMaterial}
            vertexShader={TRACT_VERTEX}
            fragmentShader={TRACT_FRAGMENT}
            uniforms={activeUniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
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
