"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { useV2 } from "@/features/v2/state";

/**
 * Staub, der das Deck umkreist.
 *
 * Onur wollte Teilchen, die den Ring umlaufen — „dezent, nicht extrem", und
 * im Hintergrund. Beides steckt in den Zahlen hier: die Bahnen liegen
 * ausserhalb des Decks und meist unterhalb der Augenhöhe, die Deckkraft ist
 * niedrig, und nichts davon kreuzt die Figuren.
 *
 * **Ein Zeichenaufruf, keine Rechenzeit.** Die Punkte bewegen sich im
 * Vertex-Shader: jeder trägt seinen Bahnradius, seinen Startwinkel und sein
 * Tempo als Attribut, und eine einzige Uniform treibt alle. Die CPU rührt
 * zwischen zwei Bildern keinen einzigen Punkt an.
 *
 * Die Punktgrösse ist **fest** und nicht entfernungsabhängig. Das ist keine
 * Kleinigkeit: eine additiv gezeichnete Wolke, deren Punkte beim Näherkommen
 * wachsen, hat uns hier schon einmal von 60 auf 37 Bilder gedrückt. Auf einer
 * Vega 11 ist Füllrate die Grenze, und ein grosser Punkt kostet quadratisch.
 */

const COUNT = 260;

/** Wo die Bahnen liegen: draussen um das Deck herum, nicht darüber. */
const INNER = 5.4;
const OUTER = 10.5;

const VERTEX = /* glsl */ `
  attribute float aRadius;
  attribute float aAngle;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aTone;

  uniform float uTime;

  varying vec3 vTone;
  varying float vFade;

  void main() {
    // Die Bahn: ein Winkel, der mit der Zeit wandert. Unterschiedliche
    // Geschwindigkeiten sorgen dafuer, dass sich das Bild nie wiederholt —
    // ein gleichmaessig rotierender Ring sieht nach Zahnrad aus.
    float a = aAngle + uTime * aSpeed;
    float y = position.y + sin(uTime * 0.45 + aPhase) * 0.22;

    vec3 world = vec3(cos(a) * aRadius, y, sin(a) * aRadius);
    vec4 mv = modelViewMatrix * vec4(world, 1.0);

    // Weiter hinten dunkler: das legt die Teilchen hinter die Szene, statt
    // sie davorzuhaengen.
    vFade = smoothstep(46.0, 8.0, -mv.z);
    vTone = aTone;

    gl_PointSize = aSize;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec3 vTone;
  varying float vFade;

  void main() {
    // Runder Punkt mit weichem Rand. Die Ecken werden verworfen, bevor sie
    // Fuellrate kosten.
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    if (r > 1.0) discard;

    float a = pow(1.0 - r, 2.0) * vFade * 0.55;
    if (a <= 0.003) discard;
    gl_FragColor = vec4(vTone, a);
  }
`;

export function DeckDust() {
  const { prefs } = useV2();
  const material = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const position = new Float32Array(COUNT * 3);
    const radius = new Float32Array(COUNT);
    const angle = new Float32Array(COUNT);
    const speed = new Float32Array(COUNT);
    const size = new Float32Array(COUNT);
    const phase = new Float32Array(COUNT);
    const tone = new Float32Array(COUNT * 3);

    // Feste Reihe statt Math.random: derselbe Himmel bei jedem Laden. Ein
    // Hintergrund, der sich bei jedem Neuladen anders anordnet, fällt auf.
    //
    // Zustandslos gerechnet statt fortlaufend: ein Zähler, der zwischen den
    // Aufrufen weiterläuft, ist eine veränderliche Variable im Renderdurchlauf,
    // und die verbietet der Lint-Wächter zu Recht. Aus Index und Kanal ergibt
    // sich hier direkt eine Zahl — reproduzierbar und ohne Zustand.
    const noise = (index: number, channel: number) => {
      const x = Math.sin(index * 127.1 + channel * 311.7 + 4.13) * 43758.5453;
      return x - Math.floor(x);
    };

    const cool = new THREE.Color("#7fd7ff");
    const pale = new THREE.Color("#dfe8f2");
    const warm = new THREE.Color("#e8c9a6");

    for (let i = 0; i < COUNT; i += 1) {
      const r = INNER + Math.pow(noise(i, 1), 0.7) * (OUTER - INNER);
      radius[i] = r;
      angle[i] = noise(i, 2) * Math.PI * 2;

      // Weiter aussen langsamer — so liest sich die Wolke als Bahn und nicht
      // als drehende Scheibe. Etwa die Hälfte läuft gegenläufig.
      const direction = noise(i, 3) > 0.5 ? 1 : -1;
      speed[i] =
        direction *
        (0.055 - ((r - INNER) / (OUTER - INNER)) * 0.032) *
        (0.7 + noise(i, 4) * 0.6);

      // Meist unterhalb der Augenhöhe, damit nichts vor den Gesichtern hängt.
      position[i * 3 + 1] = -1.4 + Math.pow(noise(i, 5), 1.4) * 3.2;
      phase[i] = noise(i, 6) * Math.PI * 2;
      size[i] = 1.4 + Math.pow(noise(i, 7), 2.2) * 3.4;

      // Wenige helle, viele blasse: eine Wolke, in der alles gleich hell ist,
      // wirkt wie ein Raster.
      const pick = noise(i, 8);
      const colour = pick > 0.86 ? cool : pick > 0.2 ? pale : warm;
      tone[i * 3] = colour.r;
      tone[i * 3 + 1] = colour.g;
      tone[i * 3 + 2] = colour.b;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
    geometry.setAttribute("aRadius", new THREE.BufferAttribute(radius, 1));
    geometry.setAttribute("aAngle", new THREE.BufferAttribute(angle, 1));
    geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    geometry.setAttribute("aTone", new THREE.BufferAttribute(tone, 3));
    return geometry;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame(({ clock }) => {
    if (!material.current) return;
    // Bei "weniger Bewegung" stehen die Teilchen still statt langsamer zu
    // kreisen — die Einstellung ist ein Versprechen.
    material.current.uniforms.uTime.value = prefs.reducedMotion ? 0 : clock.elapsedTime;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
