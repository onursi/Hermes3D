"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { useV2 } from "@/features/v2/state";
import type { RosterAgent } from "@/features/v2/useRoster";
import { AgentAura, type AuraSpot } from "@/features/v2/world/AgentAura";
import { archetypeOf, buildLogoAtlas, LOGO_UV, type Archetype } from "@/features/v2/world/agentLogos";

/**
 * Die Agenten auf dem Deck — Antigravitys Figuren, instanziert.
 *
 * Das Chassis, die Mimik und die Gesten stammen aus seinem Übergabedokument:
 * Maße als Tabelle, Bewegungen als Formeln über der Zeit. Von hier kommt, wie
 * sie gezeichnet werden — **ein InstancedMesh pro Körperteil für alle Agenten
 * zusammen**, getrieben von einer einzigen Bildschleife.
 *
 * Warum das nicht verhandelbar war: Eine eigene Komponente je Figur hatte auf
 * Onurs Vega 11 gemessene 122 Draws und 40 fps; so gebaut waren es 55 und 60.
 * Die Zahl der Aufrufe hängt an der Zahl der *Körperteile*, nicht an der Zahl
 * der Agenten — drei Figuren kosten so viel wie acht.
 *
 * Die Gesten laufen nur bei Berührung, nicht von selbst. Das ist Onurs
 * Entscheidung: „das ist ja auch nur, wenn ich die bewege, sollen die sich
 * bewegen." Im Ruhezustand bleibt nur das Schweben und der Blick.
 *
 * Die vier Brustzeichen liegen in einem Atlas — einem Bild mit vier Feldern.
 * Vier Texturen wären vier Materialien und damit vier Aufrufe; so ist es einer.
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

/**
 * Die Rollen, wie Onur sie vergeben hat — nicht wie ich sie mir denke.
 *
 * Was Hermes über ein Profil weiß, ist dessen eigene Beschreibung. Was hier
 * steht, ist Onurs Besetzung seiner Werkstatt, und die kann nur von ihm
 * kommen. Wo er nichts vergeben hat, zeigt die Figur weiter die Beschreibung
 * aus Hermes statt einer erfundenen Rolle. Der Satz darunter ist ein Motto,
 * kein Zitat — der Agent sagt ihn nicht.
 */
const ROLES: Record<string, { role: string; motto: string }> = {
  anthropic: { role: "Entwickler", motto: "Architektur, Code, und die Frage, was es kostet" },
  gemini: { role: "Designer", motto: "Form, Farbe, Raum" },
  "openai-codex": { role: "Stratege", motto: "Plan, Abwägung, Entscheidung" },
  "opencode-free": { role: "Reserve", motto: "Steht bereit — noch ohne Aufgabe" },
};

export function agentRole(provider: string | null): { role: string; motto: string } | null {
  if (!provider) return null;
  return ROLES[provider] ?? null;
}

/** Antigravitys Materialtöne, aus der Tabelle im Übergabedokument. */
const BODY_TINT = new THREE.Color("#f8fafc");
const HEAD_TINT = new THREE.Color("#ffffff");
const VISOR_TINT = new THREE.Color("#020617");
const JOINT_TINT = new THREE.Color("#1e293b");
const FOOT_TINT = new THREE.Color("#0f172a");
const PUPIL_TINT = new THREE.Color("#ffffff");
const BLUSH_TINT = new THREE.Color("#f472b6");
const LOGO_RIM_TINT = new THREE.Color("#0f172a");

/** Wie stark eine zurückgetretene Figur abgedunkelt wird. */
const DIM = 0.3;

/** Der Kopf sitzt hier; alles im Gesicht hängt daran. */
const HEAD_Y = 0.94;

/**
 * Antigravitys Halsbereich: gut 135 Grad zur Seite, −34 bis +30 Grad hoch und
 * runter. Weiter als meine erste Fassung, und richtiger — eine Figur ganz
 * hinten kann sich damit wirklich umdrehen, statt am Anschlag zu kleben.
 */
const YAW_LIMIT = 2.35;
const PITCH_MIN = -0.6;
const PITCH_MAX = 0.52;

/** Das Brustzeichen: ein Atlas mit vier Feldern, ein Aufruf für alle Figuren. */
const LOGO_VERTEX = /* glsl */ `
  attribute vec2 aTile;
  varying vec2 vUv;
  varying vec2 vTile;
  void main() {
    vUv = uv;
    vTile = aTile;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const LOGO_FRAGMENT = /* glsl */ `
  uniform sampler2D uAtlas;
  varying vec2 vUv;
  varying vec2 vTile;
  void main() {
    // Jede Figur liest ihr eigenes Viertel des Atlas.
    vec4 texel = texture2D(uAtlas, vUv * 0.5 + vTile);
    if (texel.a <= 0.01) discard;
    gl_FragColor = vec4(texel.rgb, texel.a);
  }
`;

type ArmRotation = { rx: number; ry: number; rz: number };

/**
 * Die Armgesten, unverändert aus Antigravitys Baustein.
 *
 * Ohne Berührung hängen die Arme; erst beim Zeigen oder Anklicken tippt der
 * Entwickler, malt der Designer, denkt oder winkt der Stratege, und die
 * Reserve salutiert.
 */
function computeArmRotation(
  role: Archetype,
  isRight: boolean,
  t: number,
  isInteracting: boolean,
): ArmRotation {
  if (!isInteracting) {
    return { rx: 0, ry: 0, rz: isRight ? 0.18 : -0.18 };
  }

  if (role === "developer") {
    const typeSpeed = t * 15.0;
    const phase = isRight ? Math.PI : 0;
    return {
      rx: -0.75 + Math.sin(typeSpeed + phase) * 0.12,
      ry: isRight ? -0.25 : 0.25,
      rz: isRight ? 0.35 : -0.35,
    };
  }

  if (role === "designer") {
    if (isRight) {
      return {
        rx: -0.55 + Math.sin(t * 3.0) * 0.25,
        ry: Math.sin(t * 2.0) * 0.3,
        rz: 0.75 + Math.cos(t * 2.5) * 0.2,
      };
    }
    return { rx: -0.15, ry: 0, rz: -0.4 };
  }

  if (role === "advisor") {
    if (isRight) {
      const wave = Math.sin(t * 2.0);
      if (wave > 0.1) {
        return { rx: -1.2, ry: 0, rz: 0.85 + Math.sin(t * 7.0) * 0.25 };
      }
      return { rx: -1.35, ry: -0.4, rz: 0.35 };
    }
    return { rx: -0.1, ry: 0, rz: -0.22 };
  }

  if (isRight) {
    return { rx: -1.45, ry: -0.3, rz: 0.95 };
  }
  return { rx: 0.05, ry: 0, rz: -0.06 };
}

export function AgentDeck({
  seats,
  selectedId,
  focus,
  onSelect,
  gazeTargetById,
}: {
  seats: Seat[];
  selectedId: string | null;
  focus: boolean;
  onSelect: (id: string) => void;
  /** Optional local-space gaze targets, used by the Council for real turn-taking. */
  gazeTargetById?: Record<string, THREE.Vector3>;
}) {
  const { prefs } = useV2();
  const count = seats.length;

  const body = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const visor = useRef<THREE.InstancedMesh>(null);
  const eye = useRef<THREE.InstancedMesh>(null);
  const pupil = useRef<THREE.InstancedMesh>(null);
  const mouth = useRef<THREE.InstancedMesh>(null);
  const blush = useRef<THREE.InstancedMesh>(null);
  const earRing = useRef<THREE.InstancedMesh>(null);
  const shoulder = useRef<THREE.InstancedMesh>(null);
  const arm = useRef<THREE.InstancedMesh>(null);
  const hand = useRef<THREE.InstancedMesh>(null);
  const foot = useRef<THREE.InstancedMesh>(null);
  const dockRing = useRef<THREE.InstancedMesh>(null);
  const logoRim = useRef<THREE.InstancedMesh>(null);
  const logoFace = useRef<THREE.InstancedMesh>(null);

  const [hovered, setHovered] = useState<number | null>(null);

  /** Der Bodenring liegt flach — einmal in der Geometrie statt in jeder Matrix. */
  const ringGeometry = useMemo(() => {
    const geometry = new THREE.RingGeometry(0.34, 0.44, 32);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }, []);
  useEffect(() => () => ringGeometry.dispose(), [ringGeometry]);

  const logoRimGeometry = useMemo(() => new THREE.RingGeometry(0.052, 0.068, 28), []);
  useEffect(() => () => logoRimGeometry.dispose(), [logoRimGeometry]);

  const logoFaceGeometry = useMemo(() => {
    const geometry = new THREE.CircleGeometry(0.052, 28);
    geometry.setAttribute(
      "aTile",
      new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, count) * 2), 2),
    );
    return geometry;
  }, [count]);
  useEffect(() => () => logoFaceGeometry.dispose(), [logoFaceGeometry]);

  const atlas = useMemo(() => buildLogoAtlas(), []);
  useEffect(() => () => atlas?.dispose(), [atlas]);
  const logoUniforms = useMemo(() => ({ uAtlas: { value: atlas } }), [atlas]);

  const tones = useMemo(
    () => seats.map((seat) => new THREE.Color(providerTone(seat.agent.provider))),
    [seats],
  );

  const roles = useMemo(
    () => seats.map((seat) => archetypeOf(seat.agent.provider, seat.agent.name)),
    [seats],
  );

  const phases = useMemo(
    () =>
      seats.map((seat) =>
        seat.agent.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) * 0.1,
      ),
    [seats],
  );

  const live = useRef({ seats, hovered, selectedId, roles, reduced: prefs.reducedMotion, gazeTargetById });
  useEffect(() => {
    live.current = { seats, hovered, selectedId, roles, reduced: prefs.reducedMotion, gazeTargetById };
  }, [seats, hovered, selectedId, roles, prefs.reducedMotion, gazeTargetById]);

  /**
   * Die Trefferkugel von Hand setzen — sonst ist keine Figur anklickbar.
   *
   * Ein `InstancedMesh` prüft beim Strahlentest zuerst seine Hüllkugel und
   * merkt sie sich beim ersten Mal. Wird sie berechnet, **bevor** die
   * Bildschleife die Matrizen zum ersten Mal geschrieben hat, stehen dort
   * lauter Nullen; daraus wird eine entartete Kugel, und danach verfehlt jeder
   * Strahl alles — dauerhaft und ohne jede Fehlermeldung.
   *
   * Genau das ist beim Umbau passiert: Die Figuren standen da, sahen richtig
   * aus und liessen sich nicht anklicken. Gefunden nur durch Abrastern der
   * Fläche, nicht durch Hinsehen. Eine fest gesetzte, grosszügige Kugel um das
   * Deck ist deterministisch und billiger als jede Neuberechnung.
   */
  useEffect(() => {
    const reach = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 6);
    for (const mesh of [body.current, head.current]) {
      if (mesh) mesh.boundingSphere = reach.clone();
    }
  }, [count]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.cursor = hovered !== null ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered]);

  /** Farben ändern sich nur bei echten Änderungen — nie pro Bild. */
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
    paint(shoulder.current, PAIRED, () => JOINT_TINT);
    paint(arm.current, PAIRED, () => BODY_TINT);
    paint(hand.current, PAIRED, () => JOINT_TINT);
    paint(foot.current, PAIRED, () => FOOT_TINT);
    paint(pupil.current, PAIRED, () => PUPIL_TINT);
    paint(blush.current, PAIRED, () => BLUSH_TINT);
    paint(logoRim.current, 1, () => LOGO_RIM_TINT);
    paint(eye.current, PAIRED, (i) => tones[i]);
    paint(earRing.current, PAIRED, (i) => tones[i]);
    paint(mouth.current, 1, (i) => tones[i]);

    if (dockRing.current) {
      for (let i = 0; i < count; i += 1) {
        const dimmed = focus && seats[i].agent.id !== selectedId;
        const selected = seats[i].agent.id === selectedId;
        const strength = dimmed ? 0.25 : selected ? 1 : hovered === i ? 0.75 : 0.45;
        tint.copy(tones[i]).multiplyScalar(strength);
        dockRing.current.setColorAt(i, tint);
      }
      if (dockRing.current.instanceColor) dockRing.current.instanceColor.needsUpdate = true;
    }

    // Welches Viertel des Atlas jede Figur liest.
    const tile = logoFace.current?.geometry.attributes.aTile;
    if (tile) {
      const buffer = tile.array as Float32Array;
      for (let i = 0; i < count; i += 1) {
        const [u, v] = LOGO_UV[roles[i]];
        buffer[i * 2] = u;
        buffer[i * 2 + 1] = v;
      }
      tile.needsUpdate = true;
    }
  }, [count, seats, tones, roles, focus, selectedId, hovered]);

  const auraSpots = useMemo<AuraSpot[]>(
    () =>
      seats.map((seat, index) => {
        const dimmed = focus && seat.agent.id !== selectedId;
        const selected = seat.agent.id === selectedId;
        return {
          id: seat.agent.id,
          position: seat.position,
          colour: providerTone(seat.agent.provider),
          glow: dimmed ? 0.07 : selected ? 0.85 : hovered === index ? 0.58 : 0.3,
          phase: phases[index] ?? 0,
        };
      }),
    [seats, focus, selectedId, hovered, phases],
  );

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
      delta: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
    }),
    [],
  );

  useFrame(({ clock, camera }) => {
    const state = live.current;
    const n = state.seats.length;
    if (n === 0) return;
    const now = clock.elapsedTime;

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
      rx = 0,
      ry = 0,
      rz = 0,
    ) => {
      if (!mesh) return;
      scratch.euler.set(rx, ry, rz);
      scratch.quat.setFromEuler(scratch.euler);
      scratch.pos.set(x, y, z);
      scratch.scale.set(sx, sy, sz);
      scratch.local.compose(scratch.pos, scratch.quat, scratch.scale);
      scratch.out.multiplyMatrices(parent, scratch.local);
      mesh.setMatrixAt(index, scratch.out);
    };

    for (let i = 0; i < n; i += 1) {
      const seat = state.seats[i];
      const role = state.roles[i] ?? "reserve";
      const t = state.reduced ? 0 : now + (phases[i] ?? 0);
      const interacting = state.hovered === i || seat.agent.id === state.selectedId;

      const seatYaw = -seat.angle + Math.PI / 2;
      scratch.euler.set(0, seatYaw, 0);
      scratch.quat.setFromEuler(scratch.euler);
      scratch.scale.set(1, 1, 1);
      scratch.root.compose(seat.position, scratch.quat, scratch.scale);

      // Der Rumpf schwebt leicht — das Einzige, was ohne Berührung passiert.
      const lift = state.reduced ? 0.16 : 0.16 + Math.sin(t * 1.4) * 0.022;
      scratch.euler.set(0, 0, 0);
      scratch.quat.setFromEuler(scratch.euler);
      scratch.pos.set(0, lift, 0);
      scratch.local.compose(scratch.pos, scratch.quat, scratch.scale);
      scratch.rig.multiplyMatrices(scratch.root, scratch.local);

      place(body.current, i, scratch.rig, 0, 0.42, 0);
      // Antigravitys Tabelle setzt das Zeichen auf z = 0,202 — der Rumpf hat aber
      // Radius 0,22, also steckte es darin. Auf die Oberfläche geschoben.
      place(logoRim.current, i, scratch.rig, 0, 0.46, 0.224);
      place(logoFace.current, i, scratch.rig, 0, 0.46, 0.227);

      /**
       * Der Kopf sieht dich an — in den Grenzen eines Halses.
       *
       * Gerechnet im Koordinatensystem des Sitzes: der Abstand zur Kamera wird
       * um die Eigendrehung zurückgedreht, und was übrig bleibt, ist genau die
       * Kopfdrehung. Antigravitys Formel, seine Grenzen.
       */
      const gazeTarget = state.gazeTargetById?.[seat.agent.id] ?? camera.position;
      scratch.delta
        .copy(gazeTarget)
        .sub(seat.position)
        // Ueber eine Methode statt ueber `.y -=`: der Lint-Waechter verbietet
        // das direkte Schreiben in einen gemerkten Wert, und er hat recht.
        .addScaledVector(scratch.up, -HEAD_Y)
        .applyAxisAngle(scratch.up, -seatYaw);
      const flat = Math.hypot(scratch.delta.x, scratch.delta.z);
      const headYaw = THREE.MathUtils.clamp(
        Math.atan2(scratch.delta.x, scratch.delta.z),
        -YAW_LIMIT,
        YAW_LIMIT,
      );
      const headPitch = THREE.MathUtils.clamp(
        -Math.atan2(scratch.delta.y, flat),
        PITCH_MIN,
        PITCH_MAX,
      );

      let headRoll = 0;
      if (!state.reduced && interacting) {
        if (role === "designer") headRoll = 0.22 + Math.sin(t * 2.0) * 0.05;
        else if (role === "developer") headRoll = Math.sin(t * 6.0) * 0.04;
      }

      scratch.euler.set(headPitch, headYaw, headRoll);
      scratch.quat.setFromEuler(scratch.euler);
      scratch.pos.set(0, HEAD_Y, 0);
      scratch.scale.set(1, 1, 1);
      scratch.local.compose(scratch.pos, scratch.quat, scratch.scale);
      scratch.headM.multiplyMatrices(scratch.rig, scratch.local);

      place(head.current, i, scratch.headM, 0, 0, 0, 1.22, 0.96, 0.92);
      place(visor.current, i, scratch.headM, 0, 0.02, 0.18, 1.45, 0.72, 0.32);

      const blink = state.reduced
        ? 1
        : Math.sin(t * 0.7 + (phases[i] ?? 0)) > 0.985
          ? 0.1
          : interacting
            ? 1.3
            : 1.0;

      for (let k = 0; k < PAIRED; k += 1) {
        const side = k === 0 ? -1 : 1;
        place(
          eye.current, i * PAIRED + k, scratch.headM,
          side * 0.088, 0.03, 0.228, 1.1, 1.45 * blink, 0.4,
        );
        place(
          pupil.current, i * PAIRED + k, scratch.headM,
          side * 0.088, 0.03, 0.24, 0.6, 0.6 * blink, 0.2,
        );
        // Die Wangen erscheinen nur bei Beruehrung. Auf null skaliert statt
        // ausgeblendet: das kostet nichts und spart einen zweiten Aufruf.
        const blushScale = interacting ? 1 : 0;
        place(
          blush.current, i * PAIRED + k, scratch.headM,
          side * 0.042, -0.039, 0.224, blushScale, blushScale, blushScale,
        );
        place(
          earRing.current, i * PAIRED + k, scratch.headM,
          side * 0.3, 0, 0, 1, 1, 1, 0, Math.PI / 2, 0,
        );
      }

      place(
        mouth.current, i, scratch.headM,
        0, -0.045, 0.222, interacting ? 1.35 : 1, interacting ? 1.45 : 1, 1, 0, 0, Math.PI,
      );

      for (let k = 0; k < PAIRED; k += 1) {
        const side = k === 0 ? -1 : 1;
        const rotation = computeArmRotation(
          role,
          k === 1,
          state.reduced ? 0 : t,
          interacting && !state.reduced,
        );

        place(shoulder.current, i * PAIRED + k, scratch.rig, side * 0.28, 0.58, 0);

        scratch.euler.set(rotation.rx, rotation.ry, rotation.rz);
        scratch.quat.setFromEuler(scratch.euler);
        scratch.pos.set(side * 0.29, 0.58, 0);
        scratch.scale.set(1, 1, 1);
        scratch.local.compose(scratch.pos, scratch.quat, scratch.scale);
        scratch.limb.multiplyMatrices(scratch.rig, scratch.local);

        place(arm.current, i * PAIRED + k, scratch.limb, 0, -0.12, 0);
        place(hand.current, i * PAIRED + k, scratch.limb, 0, -0.27, 0.015);
        place(foot.current, i * PAIRED + k, scratch.rig, side * 0.12, 0.018, 0.03, 1, 0.65, 1.45);
      }

      place(dockRing.current, i, scratch.root, 0, 0.006, 0);
    }

    for (const mesh of [
      body.current,
      head.current,
      visor.current,
      eye.current,
      pupil.current,
      mouth.current,
      blush.current,
      earRing.current,
      shoulder.current,
      arm.current,
      hand.current,
      foot.current,
      dockRing.current,
      logoRim.current,
      logoFace.current,
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

  const advisorSeat = seats.findIndex(
    (seat, index) =>
      roles[index] === "advisor" && (hovered === index || seat.agent.id === selectedId),
  );

  return (
    <group>
      {/* Nur Körper und Kopf nehmen Zeiger an. Ein Auge als Trefferfläche macht
          das Anklicken zur Geschicklichkeitsübung. */}
      <instancedMesh
        ref={body}
        args={[undefined, undefined, count]}
        castShadow
        onPointerOver={enter}
        onPointerOut={() => setHovered(null)}
        onClick={pick}
      >
        <capsuleGeometry args={[0.22, 0.28, 6, 14]} />
        <meshStandardMaterial roughness={0.22} metalness={0.18} />
      </instancedMesh>

      <instancedMesh
        ref={head}
        args={[undefined, undefined, count]}
        castShadow
        onPointerOver={enter}
        onPointerOut={() => setHovered(null)}
        onClick={pick}
      >
        <sphereGeometry args={[0.24, 22, 16]} />
        <meshStandardMaterial roughness={0.16} metalness={0.14} />
      </instancedMesh>

      <instancedMesh ref={visor} args={[undefined, undefined, count]}>
        <sphereGeometry args={[0.165, 18, 12]} />
        <meshStandardMaterial roughness={0.06} metalness={0.92} />
      </instancedMesh>

      <instancedMesh ref={eye} args={[undefined, undefined, count * PAIRED]}>
        <sphereGeometry args={[0.028, 12, 10]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={pupil} args={[undefined, undefined, count * PAIRED]}>
        <sphereGeometry args={[0.018, 10, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={mouth} args={[undefined, undefined, count]}>
        <torusGeometry args={[0.024, 0.0045, 6, 16, Math.PI * 0.72]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={blush} args={[undefined, undefined, count * PAIRED]}>
        <circleGeometry args={[0.007, 10]} />
        <meshBasicMaterial transparent opacity={0.75} toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={earRing} args={[undefined, undefined, count * PAIRED]}>
        <torusGeometry args={[0.055, 0.014, 8, 20]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={shoulder} args={[undefined, undefined, count * PAIRED]}>
        <sphereGeometry args={[0.065, 12, 10]} />
        <meshStandardMaterial roughness={0.4} metalness={0.5} />
      </instancedMesh>

      <instancedMesh ref={arm} args={[undefined, undefined, count * PAIRED]}>
        <capsuleGeometry args={[0.058, 0.16, 4, 10]} />
        <meshStandardMaterial roughness={0.24} metalness={0.18} />
      </instancedMesh>

      <instancedMesh ref={hand} args={[undefined, undefined, count * PAIRED]}>
        <sphereGeometry args={[0.068, 12, 10]} />
        <meshStandardMaterial roughness={0.4} metalness={0.5} />
      </instancedMesh>

      <instancedMesh ref={foot} args={[undefined, undefined, count * PAIRED]}>
        <sphereGeometry args={[0.098, 12, 10]} />
        <meshStandardMaterial roughness={0.4} metalness={0.4} />
      </instancedMesh>

      <instancedMesh ref={dockRing} args={[undefined, undefined, count]} geometry={ringGeometry}>
        <meshBasicMaterial transparent opacity={0.55} side={THREE.DoubleSide} toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={logoRim} args={[undefined, undefined, count]} geometry={logoRimGeometry}>
        <meshStandardMaterial roughness={0.3} metalness={0.8} side={THREE.DoubleSide} />
      </instancedMesh>

      {atlas ? (
        <instancedMesh
          ref={logoFace}
          args={[undefined, undefined, count]}
          geometry={logoFaceGeometry}
        >
          <shaderMaterial
            vertexShader={LOGO_VERTEX}
            fragmentShader={LOGO_FRAGMENT}
            uniforms={logoUniforms}
            transparent
          />
        </instancedMesh>
      ) : null}

      {/* Das Oktaeder des Strategen — nur, wenn er gemeint ist. */}
      {advisorSeat >= 0 ? <StrategyOctahedron seat={seats[advisorSeat]} /> : null}

      <AgentAura spots={auraSpots} />

      {seats.map((seat, index) => {
        if (hovered !== index && seat.agent.id !== selectedId) return null;
        const assigned = agentRole(seat.agent.provider);
        const line = assigned ? assigned.motto : seat.agent.role;
        const tone = providerTone(seat.agent.provider);
        return (
          <Billboard key={seat.agent.id} position={[seat.position.x, 1.78, seat.position.z]}>
            <Text
              fontSize={0.15}
              color="#f3f7fb"
              anchorX="center"
              anchorY="bottom"
              outlineWidth={0.005}
              outlineColor="#000000"
            >
              {seat.agent.name}
            </Text>
            {assigned ? (
              <Text
                position={[0, -0.045, 0]}
                fontSize={0.108}
                color={tone}
                anchorX="center"
                anchorY="top"
                outlineWidth={0.006}
                outlineColor="#000000"
              >
                {assigned.role.toUpperCase()}
              </Text>
            ) : null}
            {line ? (
              <Text
                position={[0, assigned ? -0.185 : -0.045, 0]}
                fontSize={0.084}
                color="#dde4ee"
                anchorX="center"
                anchorY="top"
                maxWidth={2.4}
                textAlign="center"
                outlineWidth={0.005}
                outlineColor="#000000"
              >
                {line}
              </Text>
            ) : null}
          </Billboard>
        );
      })}
    </group>
  );
}

/**
 * „Das Dreieck, was da aufploppt wenn man auf den klickt."
 *
 * Antigravitys Geometrie und Farben. Es steht nur da, solange der Stratege
 * gemeint ist — drei Zeichenaufrufe, und die auch nur dann. Ein Ding, das
 * dauernd schwebt, wäre Deko; eines, das auf eine Auswahl antwortet, ist eine
 * Antwort.
 */
function StrategyOctahedron({ seat }: { seat: Seat }) {
  const group = useRef<THREE.Group>(null);
  const { prefs } = useV2();

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = prefs.reducedMotion ? 0 : clock.elapsedTime;
    group.current.position.y = 1.25 + Math.sin(t * 2.5) * 0.02;
    group.current.rotation.y = t * 0.9;
  });

  return (
    <group position={[seat.position.x, 0, seat.position.z]}>
      <group ref={group} position={[0.26, 1.25, 0.1]}>
        <mesh>
          <octahedronGeometry args={[0.075, 0]} />
          <meshStandardMaterial
            color="#10b981"
            emissive="#34d399"
            emissiveIntensity={0.9}
            wireframe
          />
        </mesh>
        <mesh>
          <octahedronGeometry args={[0.045, 0]} />
          <meshBasicMaterial color="#fef08a" transparent opacity={0.7} toneMapped={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
          <ringGeometry args={[0.09, 0.11, 24]} />
          <meshBasicMaterial
            color="#34d399"
            transparent
            opacity={0.65}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}
