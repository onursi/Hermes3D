"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { AREA_COLORS, SELECTION_COLOR } from "@/features/v2/palette";
import type { TimelineStation } from "@/features/v2/useTimeline";

/**
 * Der Erinnerungsorbit.
 *
 * Onurs Entwurf war ein Saturn: Ringe namens "Babyjahre", "Kindheit",
 * "Jugend", und darin Erinnerungen wie `["2005", "Sommer"]`. Das Bild ist gut.
 * Die Daten waren getippt — kein einziger dieser Sommer steht in seinem Vault.
 *
 * Meine Fassung nimmt das Bild und lässt die Erfindung weg. Sein Zeitstrahl
 * existiert wirklich: dreiunddreißig Abschnitte in `04📖 Lebensprofil`, jeder
 * mit einer Jahreszahl in der Überschrift und seinem eigenen Text darunter.
 * Daraus wird eine **Wendel**, die mit den Jahren steigt.
 *
 * Warum eine Wendel und keine Ringe: Ringe behaupten Phasen, und Phasen müsste
 * ich erfinden — "ab wann ist Jugend?" steht nirgends. Eine steigende Bahn
 * behauptet nur eines, und das steht in jeder Überschrift: dass es später
 * wurde. Die Lücken bleiben Lücken. Zwischen 2008 und 2014 liegt ein weiter
 * Abstand, weil dort wenig aufgeschrieben ist — und das ist die Wahrheit über
 * die Aufzeichnung, nicht über das Leben.
 *
 * - **Höhe** ist das Jahr.
 * - **Größe** ist, wie viel er dazu geschrieben hat.
 * - **Farbe** ist die Notiz, aus der es stammt — Finanzen sehen anders aus als
 *   Reisen, und man erkennt im Vorbeifliegen, woher eine Erinnerung kommt.
 * - **Ein Band** zwischen den Stationen: die Reihenfolge, nichts weiter.
 */

/** Wie hoch die Wendel insgesamt wird, in Einheiten. */
const HEIGHT = 17;

/** Wie weit die Stationen vom Mittelpunkt stehen. */
const RADIUS = 7.2;

/** Wie viele volle Umdrehungen die Wendel über die ganze Zeit macht. */
const TURNS = 2.35;

export type OrbitStation = TimelineStation & {
  position: THREE.Vector3;
  size: number;
  colour: string;
  /** 0 am Anfang der Zeit, 1 am Ende — die Kamera fliegt daran entlang. */
  t: number;
};

/**
 * Die Farbe einer Station kommt aus ihrer Quellnotiz.
 *
 * Aus dem Namen abgeleitet und nicht zugewiesen: käme eine einundzwanzigste
 * Notiz dazu, hätte sie sofort eine Farbe, und keine bestehende änderte sich.
 */
function colourFor(source: string): string {
  const palette = Object.values(AREA_COLORS);
  let hash = 0;
  for (let i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length] ?? "#38bdf8";
}

export function layoutStations(stations: TimelineStation[]): OrbitStation[] {
  if (stations.length === 0) return [];
  const first = stations[0].year;
  const last = stations[stations.length - 1].year;
  const span = Math.max(1, last - first);
  // Die schwerste Station bestimmt den Maßstab, damit ein einzelner sehr
  // langer Abschnitt nicht alle anderen zu Punkten schrumpft.
  const heaviest = Math.max(...stations.map((s) => s.weight));

  return stations.map((station, index) => {
    const t = (station.year - first) / span;
    // Innerhalb eines Jahres versetzt: 2026 hat elf Stationen, und ohne den
    // Versatz lägen sie exakt aufeinander.
    const sameYear = stations.filter((s) => s.year === station.year);
    const rank = sameYear.indexOf(station);
    const spread = sameYear.length > 1 ? rank / sameYear.length : 0;
    const angle = (t + spread * 0.42) * Math.PI * 2 * TURNS;
    const y = t * HEIGHT + spread * 0.55;
    // Radius leicht atmend, damit die Wendel nicht wie eine Sprungfeder aus
    // dem Katalog aussieht.
    const radius = RADIUS + Math.sin(index * 1.3) * 0.5;

    return {
      ...station,
      position: new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius),
      size: 0.24 + Math.sqrt(station.weight / heaviest) * 0.5,
      colour: colourFor(station.source),
      t,
    };
  });
}

export function MemoryOrbit({
  stations,
  selectedId,
  onSelect,
  reducedMotion = false,
}: {
  stations: TimelineStation[];
  selectedId: string | null;
  onSelect: (station: OrbitStation) => void;
  reducedMotion?: boolean;
}) {
  const laid = useMemo(() => layoutStations(stations), [stations]);
  const [hovered, setHovered] = useState<string | null>(null);
  const markerRef = useRef<THREE.Mesh>(null);

  /**
   * Das Band durch die Stationen.
   *
   * Eine Linie durch alle Punkte, in einem Zug. Sie sagt nur "danach kam
   * das" — keine Stärke, keine Wertung. Eine Kurve wäre schöner und würde
   * eine Glätte behaupten, die zwischen 2008 und 2014 nicht existiert.
   */
  const ribbon = useMemo(() => {
    if (laid.length < 2) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setFromPoints(laid.map((station) => station.position));
    return geometry;
  }, [laid]);

  /** Die Jahresmarken: alle fünf Jahre eine, damit die Höhe lesbar bleibt. */
  const marks = useMemo(() => {
    if (laid.length === 0) return [];
    const first = laid[0].year;
    const last = laid[laid.length - 1].year;
    const out: { year: number; y: number }[] = [];
    for (let year = Math.ceil(first / 5) * 5; year <= last; year += 5) {
      out.push({ year, y: ((year - first) / Math.max(1, last - first)) * HEIGHT });
    }
    return out;
  }, [laid]);

  const selected = laid.find((station) => station.id === selectedId) ?? null;

  useFrame(({ clock }) => {
    if (reducedMotion || !markerRef.current || !selected) return;
    const t = clock.getElapsedTime();
    markerRef.current.position.copy(selected.position);
    markerRef.current.scale.setScalar(1 + Math.sin(t * 2.4) * 0.09);
  });

  return (
    <group>
      {/* Die Achse: eine dünne Säule vom ersten bis zum letzten Jahr. Sie ist
          der Bezug, ohne den eine Höhe nichts bedeutet. */}
      <mesh position={[0, HEIGHT / 2, 0]}>
        <cylinderGeometry args={[0.012, 0.012, HEIGHT, 6]} />
        <meshBasicMaterial color="#3b4a63" transparent opacity={0.5} />
      </mesh>

      {marks.map((mark) => (
        <group key={mark.year} position={[0, mark.y, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[RADIUS - 0.9, RADIUS - 0.87, 72]} />
            <meshBasicMaterial
              color="#5b6b86"
              transparent
              opacity={0.16}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <Billboard position={[0, 0.1, -RADIUS - 1.1]}>
            <Text fontSize={0.42} color="#7d8ea8" anchorX="center" fillOpacity={0.7}>
              {String(mark.year)}
            </Text>
          </Billboard>
        </group>
      ))}

      {ribbon ? (
        <line>
          <primitive object={ribbon} attach="geometry" />
          <lineBasicMaterial color="#7f8fb0" transparent opacity={0.35} depthWrite={false} />
        </line>
      ) : null}

      {laid.map((station) => {
        const lit = station.id === selectedId || station.id === hovered;
        return (
          <group key={station.id} position={station.position}>
            <mesh
              onClick={(event) => {
                event.stopPropagation();
                onSelect(station);
              }}
              onPointerOver={(event) => {
                event.stopPropagation();
                setHovered(station.id);
              }}
              onPointerOut={() => setHovered(null)}
            >
              <sphereGeometry args={[station.size, 20, 16]} />
              <meshStandardMaterial
                color={station.colour}
                emissive={station.colour}
                emissiveIntensity={lit ? 1.1 : 0.35}
                roughness={0.35}
                metalness={0.05}
              />
            </mesh>

            {lit ? (
              <Billboard position={[0, station.size + 0.5, 0]}>
                <Text
                  fontSize={0.4}
                  color="#ffffff"
                  anchorX="center"
                  maxWidth={7}
                  outlineWidth={0.014}
                  outlineColor="#02040a"
                >
                  {station.title}
                </Text>
                <Text position={[0, -0.42, 0]} fontSize={0.26} color="#9fb3cd" anchorX="center">
                  {station.source.split("/").pop() ?? station.source}
                </Text>
              </Billboard>
            ) : null}
          </group>
        );
      })}

      {selected ? (
        <mesh ref={markerRef} position={selected.position}>
          <sphereGeometry args={[selected.size * 1.5, 16, 12]} />
          <meshBasicMaterial
            color={SELECTION_COLOR}
            transparent
            opacity={0.16}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ) : null}
    </group>
  );
}

/** Die Höhe der Wendel — das Kameraziel braucht sie. */
export const ORBIT_HEIGHT = HEIGHT;
export const ORBIT_RADIUS = RADIUS;
