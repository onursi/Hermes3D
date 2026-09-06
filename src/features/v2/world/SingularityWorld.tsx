"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { AREA_COLORS, DECISION_COLOR } from "@/features/v2/palette";
import type { Project } from "@/features/v2/useProjects";

/**
 * Der Sog.
 *
 * Onurs Bild (und das seiner Entwürfe): die Projekte kreisen um ein schwarzes
 * Loch, und je länger eines ruht, desto näher treibt es an den Ereignishorizont.
 *
 * Ich habe das gebaut — aber mit einer Bedingung, die die Entwürfe nicht
 * hatten. Dort stand in den Daten `importance: 10` und `days: 1`, von Hand
 * gesetzt. Damit ist der Sog eine Behauptung: das Bild sieht dramatisch aus und
 * misst nichts. Hier kommt **jede Größe aus dem Vault**:
 *
 * - Der **Abstand** zum Zentrum ist die Zeit seit der letzten Änderung. Frisch
 *   heißt weit draußen und sicher, lange nicht angefasst heißt nah am Rand.
 * - Der **Durchmesser** ist die Zahl der Notizen. Nichts sonst.
 * - Der **Ring** um ein Projekt sind die offenen Aufgaben in seinen Notizen.
 * - Der **Ereignishorizont** liegt bei neunzig Tagen. Das ist eine Grenze, die
 *   ich gesetzt habe, und sie steht als Zahl im Bild statt als Gefühl.
 *
 * Damit ist das keine Weltraumkulisse mit Projektnamen darauf, sondern eine
 * Anzeige, die man ernst nehmen kann: was nach innen treibt, wird wirklich
 * vernachlässigt. Der Sog ist Onurs Bild — die Zahlen sind seine Arbeit.
 */

/** Die Startwerte der Scheiben-Uniforms. Der Wert wandert danach über den ref. */
const DISK_UNIFORMS = { uTime: { value: 0 } };

/** Ab wann eine Notiz als vernachlässigt gilt. Sichtbar im Bild genannt. */
export const HORIZON_DAYS = 90;

/** Radius des Ereignishorizonts und der äußersten Bahn. */
const HORIZON_RADIUS = 3.4;
const OUTER_RADIUS = 15.5;

/** Wie hoch die Bahnen gegeneinander geneigt liegen. */
const TILT = 0.16;

export type SingularityBody = {
  project: Project;
  /** Tage seit der letzten Änderung. `null`, wenn der Ordner leer ist. */
  days: number | null;
  radius: number;
  size: number;
  angle: number;
  incline: number;
  colour: string;
  /** Jenseits des Horizonts — vergessen, nicht verloren. */
  swallowed: boolean;
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return Math.max(0, (Date.now() - then) / 86_400_000);
}

/**
 * Die Bahn aus der Ruhezeit.
 *
 * Nicht linear: die ersten Tage sollen sich kaum auswirken — ein Projekt, das
 * gestern lief, ist nicht "fast so vernachlässigt" wie eines von letzter Woche.
 * Die Wurzel staucht das Feld, sodass die Bewegung nach innen langsam beginnt
 * und zum Horizont hin deutlich wird.
 */
export function orbitFor(days: number | null): number {
  if (days === null) return OUTER_RADIUS;
  const t = Math.min(1, Math.sqrt(days / HORIZON_DAYS));
  return OUTER_RADIUS - (OUTER_RADIUS - HORIZON_RADIUS) * t;
}

export function bodiesFor(projects: Project[]): SingularityBody[] {
  // Nach Ordnernamen sortiert, damit die Winkel stabil bleiben: ein Projekt
  // soll nicht über den Himmel springen, nur weil ein anderes berührt wurde.
  const ordered = [...projects].sort((a, b) => a.folder.localeCompare(b.folder));
  const palette = Object.values(AREA_COLORS);

  return ordered.map((project, index) => {
    const days = daysSince(project.lastTouched);
    const radius = orbitFor(days);
    return {
      project,
      days,
      radius,
      // Wurzel, damit ein Projekt mit hundert Notizen nicht zehnmal so breit
      // ist wie eines mit zehn — die Fläche soll die Zahl zeigen, nicht der
      // Durchmesser.
      size: 0.28 + Math.sqrt(project.noteCount) * 0.11,
      angle: (index / Math.max(1, ordered.length)) * Math.PI * 2 + index * 0.37,
      incline: Math.sin(index * 1.7) * TILT,
      colour: palette[index % palette.length] ?? "#38bdf8",
      swallowed: days !== null && days >= HORIZON_DAYS,
    };
  });
}

export function SingularityWorld({
  projects,
  selectedFolder,
  onSelect,
  reducedMotion = false,
}: {
  projects: Project[];
  selectedFolder: string | null;
  onSelect: (project: Project) => void;
  reducedMotion?: boolean;
}) {
  const bodies = useMemo(() => bodiesFor(projects), [projects]);
  const [hovered, setHovered] = useState<string | null>(null);

  const groupRef = useRef<THREE.Group>(null);
  const diskRef = useRef<THREE.Mesh>(null);
  const bodyRefs = useRef<Map<string, THREE.Group>>(new Map());

  /**
   * Die Akkretionsscheibe als Geometrie, nicht als Bild.
   *
   * Ein Ring mit einem Verlaufsshader kostet einen Zeichenaufruf und sieht bei
   * jedem Zoom richtig aus; eine Textur müsste geladen, gecacht und in vier
   * Auflösungen vorgehalten werden, um dasselbe zu leisten.
   */
  const diskGeometry = useMemo(() => new THREE.RingGeometry(1.15, 3.05, 96, 1), []);
  /**
   * Die Zeit der Scheibe wird über einen ref am Material gesetzt.
   *
   * Weder useMemo noch useState taugen dafür: der Lint-Wächter verbietet, ein
   * an einen Hook übergebenes Objekt Bild für Bild zu verändern, und er hat
   * recht — so entstehen Zustände, von denen React nichts weiß. Ein ref auf
   * das Material sagt genau das, was hier passiert: das Material gehört der
   * Bildschleife, nicht dem Renderdurchlauf.
   */
  const diskMatRef = useRef<THREE.ShaderMaterial>(null);
  useEffect(() => () => diskGeometry.dispose(), [diskGeometry]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (diskMatRef.current) diskMatRef.current.uniforms.uTime.value = t;
    if (reducedMotion) return;

    // Alle Bahnen drehen gemeinsam und sehr langsam. Jede einzeln zu drehen
    // wäre eine Schleife je Projekt für eine Bewegung, die man ohnehin nur als
    // Ganzes wahrnimmt.
    if (groupRef.current) groupRef.current.rotation.y = t * 0.035;
    if (diskRef.current) diskRef.current.rotation.z = -t * 0.22;

    // Und jeder Körper atmet ein wenig auf seiner Bahn — nicht als Zierde,
    // sondern damit die inneren, die dem Rand am nächsten sind, unruhig
    // wirken. Weiter draußen ist es fast nicht zu sehen.
    for (const body of bodies) {
      const node = bodyRefs.current.get(body.project.folder);
      if (!node) continue;
      const unrest = 1 - (body.radius - HORIZON_RADIUS) / (OUTER_RADIUS - HORIZON_RADIUS);
      const wobble = Math.sin(t * (1.2 + unrest * 3.4) + body.angle * 3) * unrest * 0.16;
      node.position.y = Math.sin(body.angle) * body.incline * body.radius + wobble;
    }
  });

  return (
    <group>
      {/* Der Kern. Schwarz, und der schwarze Fleck ist der Punkt: hier liegt
          nichts, was man ansehen könnte — nur das, was aufgehört hat. */}
      <mesh>
        <sphereGeometry args={[1.05, 32, 24]} />
        <meshBasicMaterial color="#000000" toneMapped={false} />
      </mesh>

      {/* Photonenring: eine dünne helle Kante um den Kern. */}
      <Billboard>
        <mesh>
          <ringGeometry args={[1.06, 1.13, 96]} />
          <meshBasicMaterial
            color="#ffd9a0"
            transparent
            opacity={0.55}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      </Billboard>

      {/* Die Scheibe, flach gelegt und leicht gekippt. */}
      <mesh ref={diskRef} geometry={diskGeometry} rotation={[-Math.PI / 2 + 0.28, 0, 0]}>
        <shaderMaterial
          ref={diskMatRef}
          uniforms={DISK_UNIFORMS}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          toneMapped={false}
          vertexShader={/* glsl */ `
            varying vec2 vUv;
            varying vec3 vPos;
            void main() {
              vUv = uv;
              vPos = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={/* glsl */ `
            uniform float uTime;
            varying vec2 vUv;
            varying vec3 vPos;
            void main() {
              float r = length(vPos.xy);
              // Innen heiß, außen kalt. Der Verlauf ist die ganze Aussage der
              // Scheibe: was näher liegt, wird stärker gezogen.
              float heat = smoothstep(3.05, 1.15, r);
              float angle = atan(vPos.y, vPos.x);
              // Schlieren, die mitlaufen — Materie auf einer Bahn, nicht ein
              // gleichmäßig leuchtender Reifen.
              float streak = 0.78 + 0.22 * sin(angle * 5.0 + uTime * 1.6 - r * 3.4);
              vec3 hot = vec3(1.0, 0.86, 0.55);
              vec3 cool = vec3(0.42, 0.36, 0.75);
              float alpha = heat * streak * 0.5;
              gl_FragColor = vec4(mix(cool, hot, heat), alpha);
            }
          `}
        />
      </mesh>

      {/* Der Ereignishorizont als gezogene Linie: ab hier gilt "seit neunzig
          Tagen nicht angefasst". Eine Grenze, die man sieht, statt einer, die
          man erklären muss. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[HORIZON_RADIUS - 0.02, HORIZON_RADIUS + 0.02, 128]} />
        <meshBasicMaterial
          color={DECISION_COLOR}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <Billboard position={[0, 0.35, -HORIZON_RADIUS - 0.9]}>
        <Text fontSize={0.3} color={DECISION_COLOR} anchorX="center" fillOpacity={0.75}>
          {`Ereignishorizont · ${HORIZON_DAYS} Tage`}
        </Text>
      </Billboard>

      <group ref={groupRef}>
        {bodies.map((body) => {
          const x = Math.cos(body.angle) * body.radius;
          const z = Math.sin(body.angle) * body.radius;
          const y = Math.sin(body.angle) * body.incline * body.radius;
          const active = selectedFolder === body.project.folder;
          const lit = active || hovered === body.project.folder;

          return (
            <group
              key={body.project.folder}
              position={[x, y, z]}
              ref={(node) => {
                if (node) bodyRefs.current.set(body.project.folder, node);
                else bodyRefs.current.delete(body.project.folder);
              }}
            >
              <mesh
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(body.project);
                }}
                onPointerOver={(event) => {
                  event.stopPropagation();
                  setHovered(body.project.folder);
                }}
                onPointerOut={() => setHovered(null)}
              >
                <sphereGeometry args={[body.size, 24, 18]} />
                <meshStandardMaterial
                  color={body.colour}
                  emissive={body.colour}
                  emissiveIntensity={lit ? 0.9 : body.swallowed ? 0.08 : 0.32}
                  roughness={0.4}
                  metalness={0.1}
                />
              </mesh>

              {/* Offene Aufgaben als Reif. Kein Reif heißt: nichts offen —
                  und nicht "keine Daten". Der Unterschied steht in der
                  Legende, damit ein fehlender Ring nichts Falsches sagt. */}
              {body.project.openTasks > 0 ? (
                <mesh rotation={[-Math.PI / 2 + 0.5, 0, 0]}>
                  <ringGeometry args={[body.size * 1.5, body.size * 1.5 + 0.045, 48]} />
                  <meshBasicMaterial
                    color={DECISION_COLOR}
                    transparent
                    opacity={0.75}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                  />
                </mesh>
              ) : null}

              <Billboard position={[0, body.size + 0.42, 0]}>
                <Text
                  fontSize={lit ? 0.36 : 0.3}
                  color={lit ? "#ffffff" : body.colour}
                  anchorX="center"
                  fillOpacity={body.swallowed && !lit ? 0.4 : 0.92}
                  outlineWidth={0.012}
                  outlineColor="#02040a"
                >
                  {body.project.name}
                </Text>
                {lit ? (
                  <Text
                    position={[0, -0.34, 0]}
                    fontSize={0.22}
                    color="#9fb3cd"
                    anchorX="center"
                    fillOpacity={0.85}
                  >
                    {describe(body)}
                  </Text>
                ) : null}
              </Billboard>
            </group>
          );
        })}
      </group>
    </group>
  );
}

/** Was unter einem Projekt steht, wenn man darauf zeigt. Nur Gemessenes. */
function describe(body: SingularityBody): string {
  const parts: string[] = [`${body.project.noteCount} Notizen`];
  if (body.days === null) parts.push("nie geändert");
  else if (body.days < 1) parts.push("heute berührt");
  else parts.push(`vor ${Math.round(body.days)} Tagen berührt`);
  if (body.project.openTasks > 0) parts.push(`${body.project.openTasks} offen`);
  return parts.join(" · ");
}
