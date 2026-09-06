"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { useV2 } from "@/features/v2/state";

/**
 * Die Aura — als eigenes Bauteil, damit sie jede Figur umhüllen kann.
 *
 * Sie lag vorher im Deck, weil sie dort entstanden ist. Onur nimmt jetzt
 * Antigravitys Roboter und meine Aura, und dafür darf sie nicht mehr davon
 * abhängen, wie eine Figur gebaut ist. Sie bekommt nur noch: wo jemand steht,
 * welche Farbe er hat, und wie stark er gerade leuchten soll. Was in der Aura
 * steht, ist ihr gleichgültig.
 *
 * **Was sie ist:** die Anbieterfarbe, aus zehn Metern erkennbar — eine
 * Angabe, keine Verzierung. Man sieht ohne Klick, wer hier antwortet.
 *
 * **Was sie kostet:** einen Zeichenaufruf, egal wie viele Figuren dastehen.
 * Die Fläche wird im Vertex-Shader zur Kamera aufgespannt statt von einem
 * Billboard-Objekt gedreht; die CPU rührt zwischen zwei Bildern nichts an.
 * Gemessen: mit auf null geschrumpfter Fläche dieselbe Bildrate wie mit voller
 * — die Aura ist umsonst.
 */

/** Die Aurafläche in Weltmaß — groß genug zum Umhüllen, klein genug für die Füllrate. */
const AURA_SIZE = 1.9;

const VERTEX = /* glsl */ `
  attribute vec3 aTone;
  attribute float aGlow;
  attribute float aPhase;
  varying vec2 vUv;
  varying vec3 vTone;
  varying float vGlow;
  varying float vPhase;

  void main() {
    vUv = uv;
    vTone = aTone;
    vGlow = aGlow;
    vPhase = aPhase;
    // Nur die Mitte kommt aus der Instanzmatrix; die Fläche selbst wird im
    // Sichtraum aufgespannt und steht damit immer zur Kamera.
    vec4 centre = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    centre.xy += position.xy;
    gl_Position = projectionMatrix * centre;
  }
`;

/**
 * Die Aura bewegt sich, und zwar aus einem Grund.
 *
 * Ein ruhender Farbkreis um eine Figur liest sich als Aufkleber. Was ihn zur
 * Aura macht, ist, dass etwas von der Figur *ausgeht*: zwei Wellen laufen
 * versetzt nach außen und vergehen am Rand, der Schleier atmet darunter, und
 * der Saum flimmert in Umfangsrichtung, damit der Kreis nicht gedruckt wirkt.
 *
 * Alles davon ist Rechnung pro Bildpunkt auf einer Fläche, die ohnehin schon
 * gezeichnet wird — es kommt kein einziger Bildpunkt hinzu. Die Prüfung auf
 * `r > 1.0` bleibt die erste Zeile: auf einer Vega 11 ist Füllrate die Grenze,
 * und eine verworfene Ecke kostet genauso viel wie eine gefüllte.
 */
const FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vTone;
  varying float vGlow;
  varying float vPhase;

  void main() {
    vec2 d = vUv - 0.5;
    float r = length(d) * 2.0;
    if (r > 1.0) discard;

    float angle = atan(d.y, d.x);

    // Der Schleier darunter atmet — deutlich, aber langsam.
    float breath = 0.70 + 0.30 * sin(uTime * 1.25 + vPhase);
    float core = pow(1.0 - r, 2.6) * breath;

    // Zwei Wellen, um eine halbe Umlaufzeit versetzt, damit nie eine Lücke
    // entsteht. Jede läuft von innen nach außen und verliert dabei an Kraft.
    float t1 = fract(uTime * 0.40 + vPhase * 0.15);
    float t2 = fract(uTime * 0.40 + vPhase * 0.15 + 0.5);
    float wave1 = smoothstep(0.11, 0.0, abs(r - t1)) * (1.0 - t1);
    float wave2 = smoothstep(0.11, 0.0, abs(r - t2)) * (1.0 - t2);

    // Der Saum, mit einer langsam wandernden Schwankung im Umfang.
    float shimmer = 0.72 + 0.28 * sin(angle * 5.0 + uTime * 1.5 + vPhase);
    float rim = smoothstep(0.58, 0.86, r) * (1.0 - smoothstep(0.86, 1.0, r)) * shimmer;

    float a = (core * 0.34 + (wave1 + wave2) * 0.62 + rim * 0.72) * vGlow;
    if (a <= 0.002) discard;
    gl_FragColor = vec4(vTone, a);
  }
`;

/**
 * Ein Platz, den eine Aura umhüllen soll.
 *
 * Bewusst nur das Nötigste: kein Agent, kein Roster, keine Kenntnis davon,
 * was in der Aura steht. Wer sie benutzt, rechnet die vier Werte selbst aus.
 */
export type AuraSpot = {
  /** Etwas, das diesen Platz eindeutig macht — nur für die Zuordnung. */
  id: string;
  /** Wo die Aura steht, in Weltkoordinaten. */
  position: THREE.Vector3;
  /** Die Farbe, als CSS-Farbe. Bei uns die des Anbieters. */
  colour: string;
  /** Wie stark sie leuchtet, 0 bis 1. Auswahl heller, Nebensache dunkler. */
  glow: number;
  /** Ein eigener Versatz, damit nicht alle im Gleichschritt pulsen. */
  phase: number;
};

export function AgentAura({
  spots,
  /** Wie hoch über dem Boden die Aura sitzt. Brusthöhe der jeweiligen Figur. */
  height = 0.62,
}: {
  spots: AuraSpot[];
  height?: number;
}) {
  const { prefs } = useV2();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const count = spots.length;

  /**
   * Die Fläche trägt ihre Instanzattribute von Anfang an. Sie werden hier beim
   * Anlegen gesetzt und später nur noch über die Referenz des Meshes
   * beschrieben — ein gemerkter Wert, den man nachträglich verändert, ist
   * genau das, was der Lint-Wächter zu Recht verbietet.
   */
  const geometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(AURA_SIZE, AURA_SIZE);
    const n = Math.max(1, count);
    geometry.setAttribute("aTone", new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
    geometry.setAttribute("aGlow", new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    return geometry;
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      quaternion: new THREE.Quaternion(),
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(1, 1, 1),
      colour: new THREE.Color(),
    }),
    [],
  );

  /**
   * Ort, Farbe und Stärke ändern sich nur, wenn sich wirklich etwas ändert —
   * also in einem Effekt und nicht in der Bildschleife. Eine Schleife, die
   * sechzigmal pro Sekunde dieselbe Farbe schreibt, ist Arbeit ohne Ergebnis.
   */
  useEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const attributes = target.geometry.attributes;
    const tone = attributes.aTone;
    const glow = attributes.aGlow;
    const phase = attributes.aPhase;
    if (!tone || !glow || !phase) return;

    const toneBuffer = tone.array as Float32Array;
    const glowBuffer = glow.array as Float32Array;
    const phaseBuffer = phase.array as Float32Array;

    for (let i = 0; i < count; i += 1) {
      const spot = spots[i];
      scratch.colour.set(spot.colour);
      toneBuffer[i * 3] = scratch.colour.r;
      toneBuffer[i * 3 + 1] = scratch.colour.g;
      toneBuffer[i * 3 + 2] = scratch.colour.b;
      glowBuffer[i] = spot.glow;
      phaseBuffer[i] = spot.phase;

      scratch.position.set(spot.position.x, spot.position.y + height, spot.position.z);
      scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
      target.setMatrixAt(i, scratch.matrix);
    }

    tone.needsUpdate = true;
    glow.needsUpdate = true;
    phase.needsUpdate = true;
    target.instanceMatrix.needsUpdate = true;
  }, [spots, count, height, scratch]);

  useFrame(({ clock }) => {
    if (!material.current) return;
    // Bei "weniger Bewegung" steht die Aura still statt zu pulsen — die
    // Einstellung ist ein Versprechen und keine Empfehlung.
    material.current.uniforms.uTime.value = prefs.reducedMotion ? 0 : clock.elapsedTime;
  });

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, count]}
      geometry={geometry}
      frustumCulled={false}
      renderOrder={2}
    >
      <shaderMaterial
        ref={material}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}
