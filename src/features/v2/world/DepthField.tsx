"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { useV2 } from "@/features/v2/state";

/**
 * Tiefe, die man sehen kann — die Antwort auf „Mensch-ärger-dich-nicht-Brett".
 *
 * Onurs Einwand war richtig und ich habe ihn selbst verursacht: Ich hatte den
 * Nebel entfernt, weil er den Horizont fraß, und damit das einzige Mittel
 * gestrichen, das Ferne von Nähe unterscheidet. Übrig blieb Bloom, und Bloom
 * ist kein Tiefenmittel. Was übrig bleibt, ist eine Ebene mit Figuren darauf —
 * ein Brett.
 *
 * **Das Auge erkennt Entfernung an unterschiedlicher Bewegung, nicht an
 * Größe.** Deshalb drei Schichten statt einer: nahe Körner, mittlerer Staub,
 * ferne Wand. Sie stehen still in der Welt; was sie unterscheidet, ist, wie
 * schnell sie beim Bewegen der Kamera vorbeiziehen — und das ergibt sich von
 * selbst aus ihrer Entfernung, ohne dass irgendetwas berechnet werden muss.
 *
 * Drei Zeichenaufrufe, keine Rechenzeit pro Bild: Die Punkte bewegen sich nur
 * dadurch, dass sich der Betrachter bewegt. Feste Punktgröße, nicht
 * entfernungsabhängig — eine additive Wolke, deren Punkte beim Näherkommen
 * wachsen, hat uns hier schon einmal von 60 auf 37 Bilder gedrückt.
 */

type Layer = {
  /** Wie weit die Schale reicht. */
  radius: number;
  count: number;
  size: number;
  colour: string;
  opacity: number;
};

const LAYERS: Layer[] = [
  // Nah: wenige, große, schwache Körner. Sie ziehen am schnellsten vorbei und
  // machen den Unterschied zwischen „Bild" und „Raum".
  { radius: 14, count: 90, size: 4.2, colour: "#cfe3f2", opacity: 0.34 },
  // Mitte: der eigentliche Staub, auf Höhe der Szene.
  { radius: 46, count: 260, size: 2.6, colour: "#9fc4de", opacity: 0.5 },
  // Fern: dicht und klein, fast eine Wand. Sie steht praktisch still.
  { radius: 140, count: 520, size: 1.6, colour: "#7f93ab", opacity: 0.62 },
];

/** Zustandslos gerechnet: derselbe Raum bei jedem Laden, ohne veränderliche Variable. */
const noise = (index: number, channel: number): number => {
  const x = Math.sin(index * 57.31 + channel * 191.7 + 1.37) * 43758.5453;
  return x - Math.floor(x);
};

function buildLayer(layer: Layer, seed: number): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const position = new Float32Array(layer.count * 3);
  for (let i = 0; i < layer.count; i += 1) {
    // Gleichmässig auf einer Kugelschale, nicht in einem Würfel: In einem
    // Würfel sind die Ecken dichter, und das sieht man als vier Ballungen.
    const u = noise(i + seed, 1) * 2 - 1;
    const angle = noise(i + seed, 2) * Math.PI * 2;
    const flat = Math.sqrt(Math.max(0, 1 - u * u));
    // Etwas nach innen gezogen, damit die Schale nicht als Hohlkugel liest.
    const r = layer.radius * (0.62 + noise(i + seed, 3) * 0.38);
    position[i * 3] = Math.cos(angle) * flat * r;
    // Flacher als breit: der Raum ist eine Scheibe, kein Ball.
    position[i * 3 + 1] = u * r * 0.55;
    position[i * 3 + 2] = Math.sin(angle) * flat * r;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  return geometry;
}

export function DepthField() {
  const { prefs } = useV2();
  const group = useRef<THREE.Group>(null);

  const geometries = useMemo(
    () => LAYERS.map((layer, index) => buildLayer(layer, index * 977)),
    [],
  );
  useEffect(() => {
    const list = geometries;
    return () => list.forEach((geometry) => geometry.dispose());
  }, [geometries]);

  /**
   * Eine sehr langsame Eigendrehung, und nur die.
   *
   * Ohne sie steht der Raum absolut still, sobald man die Maus loslässt, und
   * das war Onurs zweiter Einwand: „es passiert nichts von selbst". Mit ihr
   * lebt der Hintergrund, ohne von irgendetwas abzulenken — eine Umdrehung
   * dauert gut fünf Minuten.
   */
  useFrame(({ clock }) => {
    if (!group.current || prefs.reducedMotion) return;
    group.current.rotation.y = clock.elapsedTime * 0.02;
  });

  return (
    <group ref={group}>
      {LAYERS.map((layer, index) => (
        <points key={layer.radius} geometry={geometries[index]} frustumCulled={false}>
          <pointsMaterial
            color={layer.colour}
            size={layer.size}
            sizeAttenuation={false}
            transparent
            opacity={layer.opacity}
            depthWrite={false}
            toneMapped={false}
          />
        </points>
      ))}
    </group>
  );
}
