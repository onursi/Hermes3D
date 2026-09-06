"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { useV2 } from "@/features/v2/state";
import type { RosterAgent } from "@/features/v2/useRoster";

/**
 * Die Agenten auf dem Deck — dieselben Figuren, ein Zehntel der Zeichenaufrufe.
 *
 * Vorher war jeder Roboter eine eigene Gruppe aus dreizehn Meshes: Körper,
 * Kopf, Visier, zwei Augen, Mund, zwei Oberarme, zwei Hände, zwei Füße und der
 * Bodenring — dazu eine eigene Bildschleife je Figur. Gemessen auf Onurs
 * Vega 11, gleiche Szene, Hermes in beiden Läufen an: **mit Roster 122 Draws
 * und 40 fps, ohne Roster 44 Draws und 60 fps.** Die Figuren waren die
 * Ursache, nicht die Anbindung.
 *
 * Hier ist es umgedreht: ein InstancedMesh pro Körperteil für alle Agenten
 * zusammen, und eine einzige Schleife, die nur Matrizen setzt. Zehn Aufrufe,
 * ob drei Agenten dastehen oder acht. Das ist dieselbe Regel, die uns die
 * Portale schon einmal gelehrt haben: eine Schleife pro Sache, nie eine pro
 * Exemplar.
 *
 * Farbe und Helligkeit stehen bewusst *nicht* in der Schleife. Sie ändern sich
 * nur, wenn sich Auswahl, Zeiger oder Roster ändern — also in einem Effekt.
 * Eine Bildschleife, die sechzigmal pro Sekunde dieselbe Farbe schreibt, ist
 * Arbeit ohne Ergebnis.
 *
 * Die Aura kostet genau einen weiteren Aufruf. Sie wird im Vertex-Shader zur
 * Kamera aufgespannt — kein Billboard-Objekt, keine CPU-Arbeit pro Bild. Ihre
 * Farbe ist die Anbieterfarbe: eine Angabe, keine Verzierung. Man sieht aus
 * zehn Metern, wer hier antwortet.
 */

export type Seat = {
  agent: RosterAgent;
  position: THREE.Vector3;
  angle: number;
};

/** Wie viele Instanzen ein paariges Körperteil je Agent braucht. */
const PAIRED = 2;

/**
 * Same provider, same colour — everywhere in V2.
 *
 * Die Zuordnung folgt den Marken, damit man sie ohne Legende erkennt, weicht
 * aber dort aus, wo eine Bedeutung schon vergeben ist: Blau gehört im Wissen
 * den Notizen (`#8fa8ff`), Cyan der Auswahl (`#a5f3ff`), Bernstein
 * (`#fbbf24`) den Freigaben. Deshalb ist GPT ein kräftigeres, dunkleres Blau
 * und Gemini ein Gold, das neben einer wartenden Freigabe nicht mit ihr
 * verwechselt wird. Bernstein bleibt dem HUD und wird nie eine Aura.
 */
export function providerTone(provider: string | null): string {
  switch (provider) {
    case "anthropic":
      return "#e2703a";
    case "openai-codex":
      return "#3b82f6";
    case "gemini":
      return "#f4c025";
    case "openrouter":
      return "#a78bfa";
    case "opencode-free":
      return "#cbd5e1";
    default:
      return "#94a3b8";
  }
}

const BODY_TINT = new THREE.Color("#8794a4");
const HEAD_TINT = new THREE.Color("#aab6c4");
const JOINT_TINT = new THREE.Color("#657787");
const VISOR_TINT = new THREE.Color("#071018");

/** Wie stark eine zurückgetretene Figur abgedunkelt wird. */
const DIM = 0.3;

const AURA_VERTEX = /* glsl */ `
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
const AURA_FRAGMENT = /* glsl */ `
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

    // Der Schleier darunter atmet — deutlicher als vorher, aber langsam.
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

/** Die Aurafläche in Weltmaß — gross genug zum Umhüllen, klein genug für die Füllrate. */
const AURA_SIZE = 1.9;

export function AgentDeck({
  seats,
  selectedId,
  focus,
  onSelect,
}: {
  seats: Seat[];
  /** Der ausgewählte Agent, falls einer ausgewählt ist. */
  selectedId: string | null;
  /** Ob etwas anderes im Mittelpunkt steht — dann treten alle zurück. */
  focus: boolean;
  onSelect: (id: string) => void;
}) {
  const { prefs } = useV2();
  const count = seats.length;

  const body = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const visor = useRef<THREE.InstancedMesh>(null);
  const eye = useRef<THREE.InstancedMesh>(null);
  const mouth = useRef<THREE.InstancedMesh>(null);
  const arm = useRef<THREE.InstancedMesh>(null);
  const hand = useRef<THREE.InstancedMesh>(null);
  const foot = useRef<THREE.InstancedMesh>(null);
  const ring = useRef<THREE.InstancedMesh>(null);
  const aura = useRef<THREE.InstancedMesh>(null);

  const [hovered, setHovered] = useState<number | null>(null);

  /**
   * Der Bodenring liegt flach. Die Drehung steckt in der Geometrie und nicht
   * in jeder Instanzmatrix — einmal beim Anlegen statt sechzigmal pro Sekunde.
   */
  const ringGeometry = useMemo(() => {
    const geometry = new THREE.RingGeometry(0.34, 0.44, 32);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }, []);
  useEffect(() => () => ringGeometry.dispose(), [ringGeometry]);

  /**
   * Die Aurafläche trägt ihre Instanzattribute von Anfang an.
   *
   * Sie werden hier beim Anlegen gesetzt und später nur noch über die Referenz
   * des Meshes beschrieben. Ein gemerkter Wert, den man nachträglich verändert,
   * ist genau das, was der Lint-Wächter zu Recht verbietet — und was einem
   * beim Nachlesen später auch nicht auffällt.
   */
  const auraGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(AURA_SIZE, AURA_SIZE);
    const n = Math.max(1, count);
    geometry.setAttribute("aTone", new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
    geometry.setAttribute("aGlow", new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    // Eigene Phase je Agent: sonst pulsen fünf Auren im Gleichschritt, und das
    // sieht nach Blinklicht aus statt nach fünf Anwesenden.
    geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    return geometry;
  }, [count]);
  useEffect(() => () => auraGeometry.dispose(), [auraGeometry]);

  /** Anbieterfarbe je Sitz, einmal berechnet. */
  const tones = useMemo(
    () => seats.map((seat) => new THREE.Color(providerTone(seat.agent.provider))),
    [seats],
  );

  /** Ein eigener Phasenversatz je Agent, damit sie nicht im Gleichschritt atmen. */
  const phases = useMemo(
    () =>
      seats.map((seat) =>
        seat.agent.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) * 0.1,
      ),
    [seats],
  );

  const auraUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const auraMaterial = useRef<THREE.ShaderMaterial>(null);

  /**
   * Was die Bildschleife lesen muss, liegt in einem Ref. Eine Schleife, die
   * `hovered` aus dem Renderdurchlauf kennt, arbeitet ab dem nächsten Wechsel
   * mit einem veralteten Wert.
   */
  const live = useRef({ seats, hovered, reduced: prefs.reducedMotion });
  useEffect(() => {
    live.current = { seats, hovered, reduced: prefs.reducedMotion };
  }, [seats, hovered, prefs.reducedMotion]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.cursor = hovered !== null ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered]);

  /**
   * Farbe und Aurastärke — nur bei echten Änderungen, nie pro Bild.
   */
  useEffect(() => {
    const tint = new THREE.Color();
    const paint = (
      mesh: THREE.InstancedMesh | null,
      per: number,
      pick: (index: number) => THREE.Color,
    ) => {
      if (!mesh) return;
      for (let i = 0; i < count; i += 1) {
        const dimmed = focus && seats[i].agent.id !== selectedId;
        tint.copy(pick(i));
        if (dimmed) tint.multiplyScalar(DIM);
        for (let k = 0; k < per; k += 1) mesh.setColorAt(i * per + k, tint);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };

    paint(body.current, 1, () => BODY_TINT);
    paint(head.current, 1, () => HEAD_TINT);
    paint(visor.current, 1, () => VISOR_TINT);
    paint(arm.current, PAIRED, () => HEAD_TINT);
    paint(hand.current, PAIRED, () => JOINT_TINT);
    paint(foot.current, PAIRED, () => JOINT_TINT);
    paint(eye.current, PAIRED, (i) => tones[i]);
    paint(mouth.current, 1, (i) => tones[i]);

    // Der Bodenring teilt sich ein Material mit allen anderen, also trägt die
    // Instanzfarbe seine Helligkeit — eine Deckkraft pro Instanz gibt es nicht.
    if (ring.current) {
      for (let i = 0; i < count; i += 1) {
        const dimmed = focus && seats[i].agent.id !== selectedId;
        const selected = seats[i].agent.id === selectedId;
        const strength = dimmed ? 0.25 : selected ? 1 : hovered === i ? 0.75 : 0.45;
        tint.copy(tones[i]).multiplyScalar(strength);
        ring.current.setColorAt(i, tint);
      }
      if (ring.current.instanceColor) ring.current.instanceColor.needsUpdate = true;
    }

    // Die Aurapuffer über die Referenz des Meshes, nicht über den gemerkten
    // Wert: derselbe Speicher, aber der Weg, den React erlaubt.
    const attributes = aura.current?.geometry.attributes;
    const toneAttribute = attributes?.aTone;
    const glowAttribute = attributes?.aGlow;
    const phaseAttribute = attributes?.aPhase;
    if (!toneAttribute || !glowAttribute || !phaseAttribute) return;
    const toneBuffer = toneAttribute.array as Float32Array;
    const glowBuffer = glowAttribute.array as Float32Array;
    const phaseBuffer = phaseAttribute.array as Float32Array;

    for (let i = 0; i < count; i += 1) {
      const colour = tones[i];
      toneBuffer[i * 3] = colour.r;
      toneBuffer[i * 3 + 1] = colour.g;
      toneBuffer[i * 3 + 2] = colour.b;
      const dimmed = focus && seats[i].agent.id !== selectedId;
      const selected = seats[i].agent.id === selectedId;
      glowBuffer[i] = dimmed ? 0.07 : selected ? 0.85 : hovered === i ? 0.58 : 0.3;
      phaseBuffer[i] = phases[i] ?? 0;
    }
    toneAttribute.needsUpdate = true;
    glowAttribute.needsUpdate = true;
    phaseAttribute.needsUpdate = true;
  }, [count, seats, tones, phases, focus, selectedId, hovered]);

  /**
   * Eine Schleife für alle Figuren. Sie setzt Matrizen und sonst nichts —
   * keine Zuweisung an React, kein neues Objekt, keine Materialsuche.
   */
  const scratch = useMemo(
    () => ({
      root: new THREE.Matrix4(),
      rig: new THREE.Matrix4(),
      headM: new THREE.Matrix4(),
      limb: new THREE.Matrix4(),
      local: new THREE.Matrix4(),
      out: new THREE.Matrix4(),
      quat: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      pos: new THREE.Vector3(),
      scale: new THREE.Vector3(1, 1, 1),
    }),
    [],
  );

  useFrame(({ clock }) => {
    const state = live.current;
    const n = state.seats.length;
    if (n === 0) return;

    const now = clock.elapsedTime;
    // Bei "weniger Bewegung" steht die Aura still statt zu pulsen — die
    // Einstellung ist ein Versprechen und keine Empfehlung.
    if (auraMaterial.current) auraMaterial.current.uniforms.uTime.value = state.reduced ? 0 : now;

    /** Ein Teil an seinen Platz, relativ zu einem Elternrahmen. */
    const place = (
      mesh: THREE.InstancedMesh | null,
      index: number,
      parent: THREE.Matrix4,
      x: number,
      y: number,
      z: number,
      sx = 1,
      sy = 1,
      sz = 1,
      rotZ = 0,
    ) => {
      if (!mesh) return;
      scratch.euler.set(0, 0, rotZ);
      scratch.quat.setFromEuler(scratch.euler);
      scratch.pos.set(x, y, z);
      scratch.scale.set(sx, sy, sz);
      scratch.local.compose(scratch.pos, scratch.quat, scratch.scale);
      scratch.out.multiplyMatrices(parent, scratch.local);
      mesh.setMatrixAt(index, scratch.out);
    };

    for (let i = 0; i < n; i += 1) {
      const seat = state.seats[i];
      const t = state.reduced ? 0 : now + (phases[i] ?? 0);
      const isHovered = state.hovered === i;

      // Wurzel: der Sitz auf dem Ring, zur Mitte gedreht.
      scratch.euler.set(0, -seat.angle + Math.PI / 2, 0);
      scratch.quat.setFromEuler(scratch.euler);
      scratch.scale.set(1, 1, 1);
      scratch.root.compose(seat.position, scratch.quat, scratch.scale);

      // Rumpf: leichtes Schweben und Wiegen.
      const lift = 0.16 + (state.reduced ? 0 : Math.sin(t * 1.4) * 0.025);
      scratch.euler.set(0, 0, state.reduced ? 0 : Math.sin(t * 0.7) * 0.045);
      scratch.quat.setFromEuler(scratch.euler);
      scratch.pos.set(0, lift, 0);
      scratch.scale.set(1, 1, 1);
      scratch.local.compose(scratch.pos, scratch.quat, scratch.scale);
      scratch.rig.multiplyMatrices(scratch.root, scratch.local);

      place(body.current, i, scratch.rig, 0, 0.42, 0);

      // Der Kopf ist ein eigener Rahmen: Visier, Augen und Mund hängen daran,
      // damit ein Nicken alles mitnimmt statt vier Teile auseinanderzuziehen.
      const turn = state.reduced ? 0 : Math.sin(t * 0.55) * 0.25;
      const tilt = state.reduced ? 0 : isHovered ? -0.12 : Math.sin(t * 0.85) * 0.07;
      scratch.euler.set(0, turn, tilt);
      scratch.quat.setFromEuler(scratch.euler);
      scratch.pos.set(0, 0.92, 0);
      scratch.scale.set(1, 1, 1);
      scratch.local.compose(scratch.pos, scratch.quat, scratch.scale);
      scratch.headM.multiplyMatrices(scratch.rig, scratch.local);

      place(head.current, i, scratch.headM, 0, 0, 0, 1.25, 0.95, 0.9);
      place(visor.current, i, scratch.headM, 0, 0.02, 0.19, 1.5, 0.72, 0.28);

      const blink = !state.reduced && Math.sin(t * 1.05) > 0.995 ? 0.12 : isHovered ? 1.2 : 1;
      place(eye.current, i * PAIRED, scratch.headM, -0.09, 0.03, 0.235, 1, 1.5 * blink, 0.5);
      place(eye.current, i * PAIRED + 1, scratch.headM, 0.09, 0.03, 0.235, 1, 1.5 * blink, 0.5);
      place(mouth.current, i, scratch.headM, 0, -0.055, 0.233, 1, 1, 1, Math.PI);

      for (let k = 0; k < PAIRED; k += 1) {
        const side = k === 0 ? -1 : 1;
        const swing =
          side *
          (0.2 +
            (state.reduced
              ? 0
              : Math.sin(t * 1.2 + k) * 0.12 + (isHovered ? 0.75 + Math.sin(t * 5) * 0.2 : 0)));
        scratch.euler.set(0, 0, swing);
        scratch.quat.setFromEuler(scratch.euler);
        scratch.pos.set(side * 0.3, 0.58, 0);
        scratch.scale.set(1, 1, 1);
        scratch.local.compose(scratch.pos, scratch.quat, scratch.scale);
        scratch.limb.multiplyMatrices(scratch.rig, scratch.local);

        place(arm.current, i * PAIRED + k, scratch.limb, 0, -0.12, 0);
        place(hand.current, i * PAIRED + k, scratch.limb, 0, -0.28, 0.015);
        place(foot.current, i * PAIRED + k, scratch.rig, side * 0.12, 0.015, 0.04, 1, 0.7, 1.5);
      }

      place(ring.current, i, scratch.root, 0, 0.006, 0);
      place(aura.current, i, scratch.root, 0, 0.62, 0);
    }

    for (const mesh of [
      body.current,
      head.current,
      visor.current,
      eye.current,
      mouth.current,
      arm.current,
      hand.current,
      foot.current,
      ring.current,
      aura.current,
    ]) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  });

  if (count === 0) return null;

  const pick = (event: { stopPropagation: () => void; instanceId?: number }) => {
    event.stopPropagation();
    const seat = seats[event.instanceId ?? -1];
    if (seat) onSelect(seat.agent.id);
  };

  const enter = (event: { stopPropagation: () => void; instanceId?: number }) => {
    event.stopPropagation();
    setHovered(event.instanceId ?? null);
  };

  return (
    <group>
      {/* Nur Körper und Kopf nehmen Zeiger an. Ein Auge oder eine Hand als
          Trefferfläche macht das Anklicken zur Geschicklichkeitsübung. */}
      <instancedMesh
        ref={body}
        args={[undefined, undefined, count]}
        castShadow
        onPointerOver={enter}
        onPointerOut={() => setHovered(null)}
        onClick={pick}
      >
        <capsuleGeometry args={[0.23, 0.27, 6, 12]} />
        <meshStandardMaterial roughness={0.42} metalness={0.55} />
      </instancedMesh>

      <instancedMesh
        ref={head}
        args={[undefined, undefined, count]}
        castShadow
        onPointerOver={enter}
        onPointerOut={() => setHovered(null)}
        onClick={pick}
      >
        <sphereGeometry args={[0.25, 20, 16]} />
        <meshStandardMaterial roughness={0.3} metalness={0.6} />
      </instancedMesh>

      <instancedMesh ref={visor} args={[undefined, undefined, count]}>
        <sphereGeometry args={[0.17, 16, 10]} />
        <meshStandardMaterial roughness={0.28} />
      </instancedMesh>

      <instancedMesh ref={eye} args={[undefined, undefined, count * PAIRED]}>
        <sphereGeometry args={[0.03, 8, 6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={mouth} args={[undefined, undefined, count]}>
        <torusGeometry args={[0.058, 0.009, 4, 12, Math.PI]} />
        <meshBasicMaterial transparent opacity={0.7} toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={arm} args={[undefined, undefined, count * PAIRED]}>
        <capsuleGeometry args={[0.07, 0.16, 4, 8]} />
        <meshStandardMaterial metalness={0.5} roughness={0.4} />
      </instancedMesh>

      <instancedMesh ref={hand} args={[undefined, undefined, count * PAIRED]}>
        <sphereGeometry args={[0.085, 8, 6]} />
        <meshStandardMaterial />
      </instancedMesh>

      <instancedMesh ref={foot} args={[undefined, undefined, count * PAIRED]}>
        <sphereGeometry args={[0.105, 10, 8]} />
        <meshStandardMaterial />
      </instancedMesh>

      <instancedMesh ref={ring} args={[undefined, undefined, count]} geometry={ringGeometry}>
        <meshBasicMaterial transparent opacity={0.55} side={THREE.DoubleSide} toneMapped={false} />
      </instancedMesh>

      <instancedMesh
        ref={aura}
        args={[undefined, undefined, count]}
        geometry={auraGeometry}
        frustumCulled={false}
        renderOrder={2}
      >
        <shaderMaterial
          vertexShader={AURA_VERTEX}
          fragmentShader={AURA_FRAGMENT}
          ref={auraMaterial}
          uniforms={auraUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>

      {/* Der Name nur, wenn er gewollt ist. Ein festes Schild über jeder Figur
          macht aus dem Raum ein Schaubild. */}
      {seats.map((seat, index) =>
        hovered === index || seat.agent.id === selectedId ? (
          <Billboard key={seat.agent.id} position={[seat.position.x, 1.55, seat.position.z]}>
            <Text
              fontSize={0.13}
              color="#e8eef6"
              anchorX="center"
              outlineWidth={0.005}
              outlineColor="#000000"
            >
              {seat.agent.name}
            </Text>
          </Billboard>
        ) : null,
      )}
    </group>
  );
}
