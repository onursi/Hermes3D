"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { hyperState } from "@/features/v2/universe/hyperState";
import { useV2 } from "@/features/v2/state";

/**
 * Hyperlichtgeschwindigkeit — ein Ritt, keine Reise.
 *
 * Onur wollte genau das: der Bildschirm rast, der Ton zieht an, und er steht
 * in Wahrheit weiter auf demselben Fleck. Das ist eine ehrliche Ansage und
 * kein Trick, solange sie auch so heißt — deshalb steht am Schalter „Effekt,
 * keine Reise", und die Entfernungen im Cockpit ändern sich sichtbar nicht.
 *
 * **Warum die Kamera stillsteht und trotzdem alles rast:** Die Streifen leben
 * im *Sichtraum*. Jeder hat einen festen Abstand zur Blickachse und eine
 * Tiefe, die mit der Zeit umläuft; die Perspektive macht daraus von selbst
 * die Strahlen, die aus der Bildmitte nach außen schießen. Es gibt keine
 * Bewegung, die man rückgängig machen müsste, und nichts kann aus dem Tritt
 * geraten, wenn man den Schalter mitten im Flug umlegt.
 *
 * **Kosten:** ein Zeichenaufruf. Ein InstancedMesh, ein Uniform, keine
 * Rechenzeit pro Bild auf der CPU. Wenn der Ritt aus ist, steht die Stärke
 * auf null und der Shader verwirft jeden Bildpunkt in der ersten Zeile —
 * gezeichnet wird dann nichts.
 */

const STREAKS = 320;

/** Wie weit der Tunnel reicht und wie weit die Streifen von der Achse liegen. */
const RANGE = 140;
const INNER = 1.6;
const OUTER = 26;

const VERTEX = /* glsl */ `
  attribute vec2 aOffset;
  attribute float aDepth;
  attribute float aSpeed;
  attribute float aLength;
  attribute vec3 aTone;

  uniform float uTime;
  uniform float uWarp;
  uniform float uRange;

  varying vec3 vTone;
  varying float vFade;
  varying vec2 vLocal;

  void main() {
    // Die Tiefe laeuft um: erreicht ein Streifen die Kamera, setzt er hinten
    // wieder ein. Kein Zustand, keine Verwaltung — nur ein Rest.
    float speedMult = 0.25 + uWarp * 3.8;
    float travelled = mod(aDepth + uTime * aSpeed * speedMult, uRange);
    float z = -uRange + travelled;

    // Radiale Richtung im Bild, und die Senkrechte dazu fuer die Breite.
    vec2 dir = normalize(aOffset);
    vec2 perp = vec2(-dir.y, dir.x);

    // Je staerker der Ritt, desto laenger der Streifen. Bei null ist er ein
    // Punkt und faellt nicht auf.
    float len = aLength * (0.12 + uWarp * uWarp * 8.5);
    vec2 across = perp * position.x * (0.05 + uWarp * 0.08);

    vec3 viewPos = vec3(aOffset + across, z + position.y * len);

    // Nah an der Kamera und ganz hinten ausblenden, damit nichts aufploppt.
    float near = smoothstep(0.0, 14.0, -viewPos.z);
    float far = 1.0 - smoothstep(uRange * 0.72, uRange, -viewPos.z);
    vFade = near * far;
    vTone = aTone;
    vLocal = position.xy;

    gl_Position = projectionMatrix * vec4(viewPos, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uWarp;

  varying vec3 vTone;
  varying float vFade;
  varying vec2 vLocal;

  void main() {
    if (uWarp <= 0.001) discard;

    // Weicher Kern quer zum Streifen und ein Auslaufen an beiden Enden: so
    // bekommt er den Kopf und den Schweif einer Sternschnuppe statt der
    // harten Kanten eines Balkens.
    float across = 1.0 - abs(vLocal.x * 2.0);
    float along = 1.0 - abs(vLocal.y * 2.0);
    float shape = pow(max(across, 0.0), 1.6) * pow(max(along, 0.0), 0.55);

    float a = shape * vFade * uWarp * 0.92;
    if (a <= 0.003) discard;
    gl_FragColor = vec4(vTone, a);
  }
`;

/**
 * Die Warp-Blase — der Teil, den Onur eigentlich meint.
 *
 * Sie stand **nicht** in Antigravitys Übergabedokument. Dort war nur der
 * Streifen-Tunnel; die Blase lebt in seinem `FreeFlight.tsx` auf Track 2. Ich
 * habe den übergebenen Baustein genau umgesetzt und damit etwas gebaut, das
 * Onur zu Recht als „nur eine schnellere Geschwindigkeit" beschrieben hat: das
 * Auffälligste am Effekt fehlte schlicht.
 *
 * Das hier ist sein Shader, übernommen wie er ist: rasende weisse Lichtringe
 * über einem Verlauf zwischen Cyan und Violett, dazu Lichtadern in
 * Umfangsrichtung. Ein Zylinder von 28 auf 9 Einheiten, 220 lang, ohne Deckel,
 * um die Kamera gelegt.
 */
const TUNNEL_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const TUNNEL_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uHyper;
  varying vec2 vUv;
  varying vec3 vPos;

  void main() {
    if (uHyper < 0.005) discard;
    float z = vUv.y;
    float speed = uTime * 7.5;

    // Rasende Warp-Lichtringe
    float rings = sin((z * 36.0 - speed) * 3.14159) * 0.5 + 0.5;
    rings = pow(rings, 3.2);

    // Hyperspace-Lichtadern
    float veins = sin(vUv.x * 64.0 + sin(uTime * 3.2 + z * 12.0) * 2.0) * 0.5 + 0.5;
    veins = pow(veins, 2.5);

    vec3 cyan = vec3(0.0, 0.95, 1.0);
    vec3 violet = vec3(0.85, 0.25, 1.0);
    vec3 col = mix(cyan, violet, sin(vUv.x * 6.283 + uTime * 2.5) * 0.5 + 0.5);
    col += vec3(1.0, 1.0, 1.0) * rings * 1.4;

    float edgeFade = smoothstep(0.0, 0.18, z) * smoothstep(1.0, 0.65, z);
    float alpha = (rings * 0.7 + veins * 0.45) * edgeFade * uHyper;

    gl_FragColor = vec4(col * 2.2, alpha * 0.9);
  }
`;

export function HyperRide() {
  const { prefs } = useV2();
  const material = useRef<THREE.ShaderMaterial>(null);
  const mesh = useRef<THREE.InstancedMesh>(null);

  /** Die aktuelle Stärke, weich nachgezogen — ein Ritt schaltet nicht um, er zieht an. */
  const warp = useRef(0);

  const geometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const offset = new Float32Array(STREAKS * 2);
    const depth = new Float32Array(STREAKS);
    const speed = new Float32Array(STREAKS);
    const length = new Float32Array(STREAKS);
    const tone = new Float32Array(STREAKS * 3);

    const noise = (index: number, channel: number) => {
      const x = Math.sin(index * 91.7 + channel * 271.3 + 2.71) * 43758.5453;
      return x - Math.floor(x);
    };

    const pale = new THREE.Color("#dceaff");
    const cool = new THREE.Color("#8fd4ff");
    const warm = new THREE.Color("#ffb877");

    for (let i = 0; i < STREAKS; i += 1) {
      // Gleichmässig über die Kreisfläche statt über den Radius: sonst
      // sammelt sich alles in der Bildmitte, und der Rand bleibt leer.
      const radius = Math.sqrt(INNER * INNER + noise(i, 1) * (OUTER * OUTER - INNER * INNER));
      const angle = noise(i, 2) * Math.PI * 2;
      offset[i * 2] = Math.cos(angle) * radius;
      offset[i * 2 + 1] = Math.sin(angle) * radius;

      depth[i] = noise(i, 3) * RANGE;
      speed[i] = 28 + noise(i, 4) * 48;
      length[i] = 1.8 + noise(i, 5) * 5.4;

      const pick = noise(i, 6);
      const colour = pick > 0.88 ? warm : pick > 0.42 ? cool : pale;
      tone[i * 3] = colour.r;
      tone[i * 3 + 1] = colour.g;
      tone[i * 3 + 2] = colour.b;
    }

    geometry.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offset, 2));
    geometry.setAttribute("aDepth", new THREE.InstancedBufferAttribute(depth, 1));
    geometry.setAttribute("aSpeed", new THREE.InstancedBufferAttribute(speed, 1));
    geometry.setAttribute("aLength", new THREE.InstancedBufferAttribute(length, 1));
    geometry.setAttribute("aTone", new THREE.InstancedBufferAttribute(tone, 3));
    return geometry;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uWarp: { value: 0 }, uRange: { value: RANGE } }),
    [],
  );

  /** Die Röhre um den Betrachter: Antigravitys Maße, unverändert. */
  const tunnel = useRef<THREE.Group>(null);
  const tunnelMaterial = useRef<THREE.ShaderMaterial>(null);
  const tunnelUniforms = useMemo(() => ({ uTime: { value: 0 }, uHyper: { value: 0 } }), []);
  const tunnelGeometry = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(28, 9, 220, 36, 16, true);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, 0, -90);
    return geometry;
  }, []);
  useEffect(() => () => tunnelGeometry.dispose(), [tunnelGeometry]);

  /**
   * Der Tunnel hängt an der Kamera, nicht an der Welt.
   *
   * Die Streifen sind im Shader schon im Sichtraum gerechnet, also darf das
   * Objekt selbst nicht mitwandern oder mitgedreht werden. Es bleibt deshalb
   * ausserhalb jeder Sichtbarkeitsprüfung und ohne eigene Verschiebung.
   */
  useFrame(({ clock, camera }, delta) => {
    if (!material.current) return;
    const wanted = prefs.hyperRide && !prefs.reducedMotion ? 1 : 0;
    // Anziehen dauert, Auslaufen dauert länger: ein Ritt, der sofort steht,
    // fühlt sich nach einem Schalter an und nicht nach Geschwindigkeit.
    const rate = wanted > warp.current ? 1.6 : 0.85;
    warp.current += Math.max(-1, Math.min(1, wanted - warp.current)) * Math.min(1, delta * rate);
    if (Math.abs(wanted - warp.current) < 0.002) warp.current = wanted;

    material.current.uniforms.uTime.value = clock.elapsedTime;
    material.current.uniforms.uWarp.value = warp.current;

    // Sichtfeld, Rütteln und Antriebsklang setzt FreeFlight — dort gehören sie
    // hin, weil er die Steuerung besitzt und sie ohnehin jedes Bild schreibt.
    // Hier wird nur gemeldet, wie stark der Ritt gerade zieht. Warum das nicht
    // beides an derselben Stelle stehen darf, steht in hyperState.ts.
    hyperState.warp = warp.current;

    if (mesh.current) mesh.current.visible = warp.current > 0.002;

    // Die Röhre hängt an der Kamera und schaut, wohin geschaut wird. Sie ist in
    // Weltkoordinaten gebaut, nicht im Sichtraum wie die Streifen — deshalb muss
    // sie mitgeführt werden statt im Shader aufgespannt.
    if (tunnel.current) {
      tunnel.current.position.copy(camera.position);
      tunnel.current.quaternion.copy(camera.quaternion);
      tunnel.current.visible = warp.current > 0.005;
    }
    if (tunnelMaterial.current) {
      tunnelMaterial.current.uniforms.uHyper.value = warp.current;
      tunnelMaterial.current.uniforms.uTime.value = clock.elapsedTime;
    }
  });

  return (
    <>
    <group ref={tunnel} visible={false}>
      <mesh geometry={tunnelGeometry} frustumCulled={false} raycast={() => {}}>
        <shaderMaterial
          ref={tunnelMaterial}
          uniforms={tunnelUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          vertexShader={TUNNEL_VERTEX}
          fragmentShader={TUNNEL_FRAGMENT}
        />
      </mesh>
    </group>

    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, STREAKS]}
      geometry={geometry}
      frustumCulled={false}
      renderOrder={3}
      visible={false}
    >
      <shaderMaterial
        ref={material}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        // Ohne das hier ist der Ritt unsichtbar, und zwar vollstaendig: die
        // Flaechennormale eines Streifens zeigt radial von der Kamera weg,
        // also sortiert die Voreinstellung FrontSide jeden einzelnen aus.
        // Der Zeichenaufruf laeuft dann, und kein Dreieck ueberlebt ihn.
        side={THREE.DoubleSide}
      />
    </instancedMesh>
    </>
  );
}
