"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Die Oberfläche, aus kreisenden Teilchen.
 *
 * Onurs Vorschlag: „bisschen Elektronen dazu, Kreise — vielleicht formt das es
 * zu einem Gehirn." Er hat damit das Richtige benannt. Zehn farbige Wolken
 * bleiben zehn Wolken, solange nichts sie umschließt; was einer Form ihre Form
 * gibt, ist ihre Haut. Ein Drahtgitter war der erste Versuch und las sich wie
 * ein Käfig. Teilchen, die auf Bahnen um den Körper laufen, lesen sich wie
 * Oberfläche.
 *
 * **Diese Punkte sind keine Daten, und das darf man ihnen nicht ansehen
 * müssen.** V6-02 verlangt ausdrücklich, dass Dekoration von auswählbaren
 * Objekten unterscheidbar bleibt. Deshalb: halb so groß wie die kleinste
 * Notiz, eine einzige gedämpfte Farbe statt der Arealfarben, nicht anklickbar,
 * und deutlich außerhalb der Areale. Wer hier klickt, wählt nichts aus — es
 * gibt nichts auszuwählen.
 *
 * Alles bewegt sich im Vertex-Shader. Die CPU setzt eine Uniform pro Bild und
 * fasst sonst nichts an — 1.400 Punkte einzeln zu bewegen wäre genau die Art
 * Schleife, die dieses Projekt an anderer Stelle schon Bildrate gekostet hat.
 */

const SHELL_VERTEX = /* glsl */ `
  attribute float aAngle;   // Startwinkel auf der eigenen Bahn
  attribute float aHeight;  // -1 bis 1, die Höhe der Bahn
  attribute float aRadius;  // Streuung der Schalendicke
  attribute float aSpeed;   // Umlaufgeschwindigkeit, mit Vorzeichen
  attribute float aSize;

  varying float vFade;
  varying float vCrest;

  uniform float uTime;
  uniform vec3 uScale;
  uniform float uFissure;

  void main() {
    float angle = aAngle + uTime * aSpeed;

    // Der Punkt auf der Einheitskugel. Alles Weitere formt diese Kugel.
    float ring = sqrt(max(0.0, 1.0 - aHeight * aHeight));
    vec3 n = vec3(cos(angle) * ring, aHeight, sin(angle) * ring);

    // ---- Aus der Kugel wird ein Gehirn -------------------------------------
    // Onur hat entschieden, die Form ausdruecklich zu bauen statt zu hoffen,
    // dass die Daten sie ergeben. Das ist die ehrlichere Loesung: die Huelle
    // ist Gestaltung und sagt nichts ueber den Inhalt aus. Wo eine Notiz
    // liegt, entscheidet weiterhin ihr Ordner.

    float front = smoothstep(-1.0, 1.0, n.z);
    // Vorne schmaler, hinten breiter — der Stirnlappen laeuft zu.
    float taper = mix(1.06, 0.82, front);
    // Unterseite abgeflacht: ein Gehirn ruht, es schwebt nicht als Kugel.
    float underside = n.y < 0.0 ? mix(1.0, 0.66, -n.y) : 1.0;

    vec3 shaped = n * vec3(taper, underside, 1.0);

    // Kleinhirn: eine Wulst hinten unten. Zwei smoothsteps, und die Silhouette
    // hat die Kerbe, an der man ein Gehirn von einer Bohne unterscheidet.
    float cerebellum = smoothstep(0.25, 0.95, -n.z) * smoothstep(0.0, 0.85, -n.y);
    shaped *= 1.0 + cerebellum * 0.16;

    // ---- Windungen ---------------------------------------------------------
    // Zwei gekreuzte Wellen ueber die Oberflaeche. Kein Rauschen: Windungen
    // laufen in Baendern, nicht zufaellig, und zwei Sinus tun das billiger und
    // regelmaessiger als jede Rauschfunktion.
    float gyri =
      sin(n.x * 8.5 + n.z * 3.2) * cos(n.y * 6.5 - n.z * 4.4)
      + 0.45 * sin(n.z * 11.0 + n.y * 5.0);
    shaped *= 1.0 + gyri * 0.052;
    vCrest = gyri;

    vec3 pos = shaped * aRadius * uScale;

    // Die Furche zwischen den Haelften. Der eine Zug, an dem das Auge eine
    // Form als Gehirn erkennt — und er kostet drei Zeilen.
    float side = pos.x >= 0.0 ? 1.0 : -1.0;
    if (abs(pos.x) < uFissure) {
      pos.x = side * (uFissure + abs(pos.x) * 0.55);
    }

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);

    // Hinten liegende Teilchen treten zurück. Gemessen am Mittelpunkt des
    // Körpers, nicht an absoluten Tiefen: mit festen Werten hing der Verlauf
    // an der Kameraentfernung, und bei 31 Einheiten Abstand war die ganze
    // Schale unsichtbar. So funktioniert er aus jeder Entfernung.
    vec4 centre = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float towardCamera = mv.z - centre.z;
    float depth = 0.4 + 0.6 * smoothstep(-10.0, 8.0, towardCamera);

    // Der Umriss. Teilchen, deren Richtung vom Mittelpunkt quer zur Blickachse
    // steht, liegen auf der Silhouette — und genau die machen aus einer Wolke
    // eine Form. Ohne diesen Term ist die Schale gleichmäßiger Staub; mit ihm
    // zeichnet sie die Kante, an der das Auge eine Gestalt erkennt.
    vec3 outward = normalize(mv.xyz - centre.xyz);
    float rim = 1.0 - abs(outward.z);
    rim = pow(clamp(rim, 0.0, 1.0), 3.0);

    // Fast alles Gewicht auf den Umriss. Eine Schale ist genau dort dicht, wo
    // man sie von der Kante sieht; vorne schaut man hindurch. Mit einem hohen
    // Grundwert legte sie sich als Schleier ueber die Areale und verdeckte
    // genau die Daten, um die es geht.
    vFade = depth * (0.05 + rim * 2.3);

    gl_Position = projectionMatrix * mv;
    // Feste Pixelgröße. Größe nach Entfernung hat in dieser Anwendung schon
    // einmal die halbe Bildrate gekostet, als die Kamera näher kam.
    gl_PointSize = aSize;
  }
`;

const SHELL_FRAGMENT = /* glsl */ `
  precision mediump float;
  varying float vFade;
  varying float vCrest;
  uniform vec3 uColor;
  uniform float uOpacity;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float d = length(coord);
    // Maske statt discard: discard schaltet den frühen Tiefentest für den
    // ganzen Shader ab, und der Rest der Szene bezahlt dafür mit.
    float mask = step(d, 0.5);
    float core = smoothstep(0.5, 0.1, d);
    // Die Kaemme der Windungen liegen im Licht, die Furchen im Schatten.
    // Ohne diesen Unterschied ist das Muster geometrisch vorhanden und
    // trotzdem unsichtbar.
    float lit = 0.45 + 0.55 * clamp(vCrest * 0.8 + 0.5, 0.0, 1.0);
    gl_FragColor = vec4(uColor * (0.7 + lit * 0.5), core * uOpacity * vFade * lit * mask);
  }
`;

export function CortexShell({
  /** Halbachsen des Körpers. Die Schale liegt knapp außerhalb der Areale. */
  // Enger am Körper: mit 11.4 lag die Schale deutlich außerhalb der Areale
  // und las sich als Sternenstaub statt als Haut. Eine Oberfläche muss die
  // Form berühren, die sie umschließt.
  scale = [10.2, 7.4, 9.8] as [number, number, number],
  count = 6000,
  reducedMotion = false,
  /** Zurückgenommen, sobald eine Notiz gewählt ist — die Haut ist dann nicht das Thema. */
  dimmed = false,
}: {
  scale?: [number, number, number];
  count?: number;
  reducedMotion?: boolean;
  dimmed?: boolean;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const angle = new Float32Array(count);
    const height = new Float32Array(count);
    const radius = new Float32Array(count);
    const speed = new Float32Array(count);
    const size = new Float32Array(count);

    // Deterministisch, wie überall in diesem Projekt: dieselbe Haut bei jedem
    // Öffnen. Eine Form, die sich jedes Mal neu würfelt, ist keine Form.
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i += 1) {
      const t = (i + 0.5) / count;
      height[i] = 1 - t * 2;
      angle[i] = golden * i;
      // Dünne Schale mit etwas Streuung, damit sie Tiefe hat und nicht wie
      // eine aufgemalte Linie aussieht.
      radius[i] = 0.93 + ((i * 37) % 100) / 100 * 0.11;
      // Vorzeichen wechselt: die Hälfte läuft in die andere Richtung, sonst
      // dreht sich die Schale als Ganzes und wirkt wie ein Karussell.
      speed[i] = (0.02 + ((i * 53) % 100) / 100 * 0.05) * (i % 2 === 0 ? 1 : -1);
      size[i] = 1.7 + ((i * 29) % 100) / 100 * 1.3;
      // Die Position selbst wird im Shader gerechnet; das Attribut existiert
      // nur, weil three eine Geometrie ohne `position` nicht zeichnet.
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aAngle", new THREE.BufferAttribute(angle, 1));
    geo.setAttribute("aHeight", new THREE.BufferAttribute(height, 1));
    geo.setAttribute("aRadius", new THREE.BufferAttribute(radius, 1));
    geo.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    // Die Punkte werden im Shader bewegt, also weiß three nicht, wo sie sind.
    // Ohne diese Kugel verschwindet die Schale, sobald der Mittelpunkt aus dem
    // Bild läuft.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
    return geo;
  }, [count]);

  // Freigeben. Zwei vergessene Freigaben haben heute schon die halbe Bildrate
  // gekostet; diese hier steht von Anfang an da.
  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScale: { value: new THREE.Vector3(...scale) },
      uFissure: { value: 1.3 },
      uColor: { value: new THREE.Color("#cfc3ae") },
      uOpacity: { value: 0.9 },
    }),
    // Einmal gebaut; Änderungen laufen über die Schleife unten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((state) => {
    if (!material.current) return;
    if (!reducedMotion) material.current.uniforms.uTime.value = state.clock.elapsedTime;
    material.current.uniforms.uOpacity.value = dimmed ? 0.35 : 0.9;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={SHELL_VERTEX}
        fragmentShader={SHELL_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </points>
  );
}
