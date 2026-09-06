"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { useV2 } from "@/features/v2/state";
import { DECISION_COLOR } from "@/features/v2/palette";
import type { RosterAgent } from "@/features/v2/useRoster";

/**
 * The home stage.
 *
 * A compact floating oval of graphite, open at the front to the cosmos, with a
 * low curved brace behind that carries the light. No ceiling: the plan asks for
 * a room that reads from every angle, and a lid is the one thing that makes an
 * isometric room look like a box.
 *
 * The whole stage is about ten metres across. That is deliberate and it is the
 * central performance decision: V1 spent its budget on a nine-by-seven-metre
 * office where most of the floor was empty and every wall carried a screen. A
 * small stage can afford good materials, real contact shadows and clean edges
 * on a GPU that cannot afford a large one.
 */

const PLATFORM_RADIUS = 4.6;
const DOCK_RADIUS = 3.15;

/** Cyan = information, mint = confirmed, amber = a decision is waiting. */
const COLOR_INFO = "#38bdf8";
/**
 * Die Architektur des Decks — nicht die Signale darauf.
 *
 * Der Lichtkanal, die Hilfsringe und die Rückenspange waren alle in COLOR_INFO.
 * Damit war das größte Objekt im Bild in der Farbe, die eigentlich "hier wird
 * etwas abgerufen" bedeutet, und Onurs "zu blau" hatte hier seine größte
 * Fläche. Das Deck ist jetzt warmes Metall; Cyan bleibt dem Kern und den
 * Signalen.
 */
const COLOR_STRUCTURE = "#c2b19a";
const COLOR_AMBER = DECISION_COLOR;

export function HomeWorld({
  agents,
  rosterReachable,
  approvalsWaiting,
  onSelectAgent,
}: {
  agents: RosterAgent[];
  rosterReachable: boolean;
  approvalsWaiting: number;
  onSelectAgent: (id: string) => void;
}) {
  const { selection, focus, prefs } = useV2();

  /**
   * Seats are derived from the real roster, never from a fixed five.
   *
   * The plan is explicit: additional participants need a visible overflow, not
   * invisible chairs. Eight is what fits at this radius without the figures
   * touching; beyond that the inspector lists the rest.
   */
  const seats = useMemo(() => {
    const shown = agents.slice(0, 8);
    return shown.map((agent, index) => {
      // Start at the back and open toward the viewer, so the front stays clear
      // and nobody has their back to the camera in the composed view.
      const spread = Math.PI * 1.45;
      const t = shown.length === 1 ? 0.5 : index / (shown.length - 1);
      const angle = -Math.PI / 2 - spread / 2 + spread * t;
      return {
        agent,
        position: new THREE.Vector3(
          Math.cos(angle) * DOCK_RADIUS,
          0,
          Math.sin(angle) * DOCK_RADIUS,
        ),
        angle,
      };
    });
  }, [agents]);

  return (
    <group>
      <StagePlatform />
      <BackBrace />
      <HermesCore intensity={prefs.coreIntensity} approvalsWaiting={approvalsWaiting} />

      {seats.map(({ agent, position, angle }) => (
        <AgentDock
          key={agent.id}
          agent={agent}
          position={position}
          angle={angle}
          selected={selection.kind === "agent" && selection.id === agent.id}
          dimmed={focus && !(selection.kind === "agent" && selection.id === agent.id)}
          onSelect={() => onSelectAgent(agent.id)}
        />
      ))}

      {/* No roster is a real state and says so, rather than showing empty
          seats that look like a room nobody came to. */}
      {!rosterReachable ? (
        <Billboard position={[0, 2.4, 0]}>
          <Text
            fontSize={0.19}
            color="#f43f5e"
            anchorX="center"
            outlineWidth={0.006}
            outlineColor="#000000"
          >
            Hermes nicht erreichbar — keine Agenten geladen
          </Text>
        </Billboard>
      ) : null}
    </group>
  );
}

/**
 * The platform: a shallow oval slab with an inset light channel.
 *
 * Two meshes and one ring. The quality comes from the material and the light
 * that grazes it, not from geometry — which is the only way to look expensive
 * on an integrated GPU.
 */
function StagePlatform() {
  return (
    <group>
      {/* Open orbital terraces: empty space remains visible between the decks. */}
      {[0, 1, 2].map((segment) => (
        <group key={segment} rotation={[0, segment * Math.PI * 2 / 3 + 0.2, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <ringGeometry args={[1.75, PLATFORM_RADIUS, 48, 1, 0, Math.PI * 0.56]} />
            <meshStandardMaterial color="#202933" roughness={0.34} metalness={0.65} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]}>
            <ringGeometry args={[PLATFORM_RADIUS - 0.035, PLATFORM_RADIUS, 48, 1, 0, Math.PI * 0.56]} />
            <meshBasicMaterial color={segment === 1 ? "#c8a77c" : "#9dbbc8"} transparent opacity={0.65} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -0.18, 0]}>
        <cylinderGeometry args={[1.18, 0.6, 0.36, 6]} />
        <meshStandardMaterial color="#26313c" roughness={0.3} metalness={0.7} />
      </mesh>
    </group>
  );
}

/**
 * The brace: a low arc behind the stage that gives the room a back without
 * giving it a wall. It also carries the key light's falloff, which is what
 * separates the figures from the void behind them.
 */
function BackBrace() {
  // A torus lies in its own XY plane, so an unrotated one stands upright like
  // a gate — which is what the first version did: a stray arc in the sky
  // rather than architecture. Laid flat and tipped back it becomes a low rail
  // that follows the rear of the platform and carries the light along it.
  return (
    <group position={[0, 0.7, -0.4]} rotation={[-Math.PI / 2 + 0.3, 0, 0]}>
      <mesh rotation={[0, 0, Math.PI * 0.57]} castShadow>
        <torusGeometry args={[4.8, 0.075, 10, 64, Math.PI * 0.82]} />
        <meshStandardMaterial color="#282420" roughness={0.4} metalness={0.65} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI * 0.57]} position={[0, 0, 0.055]}>
        <torusGeometry args={[4.8, 0.018, 8, 64, Math.PI * 0.82]} />
        <meshBasicMaterial color={COLOR_STRUCTURE} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

/**
 * Hermes, as a presence rather than a face.
 *
 * A face lands in the uncanny valley the moment it is not perfect, and perfect
 * is not available at this budget. A form that breathes when idle and brightens
 * when something waits reads as attention without claiming to be a person.
 *
 * The breathing is the one deliberate exception to "movement means an event".
 * Codex was right that the rule taken literally produces a dead room; what
 * matters is that ambient motion stays far below the intensity of a real
 * event. This breathes at eight per cent — an approval pulse is four times
 * that and changes hue.
 */
function HermesCore({
  intensity,
  approvalsWaiting,
}: {
  intensity: number;
  approvalsWaiting: number;
}) {
  const innerRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const waiting = approvalsWaiting > 0;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const breath = 1 + Math.sin(t * 0.9) * 0.08;
    if (innerRef.current) innerRef.current.scale.setScalar(breath);
    if (shellRef.current) {
      shellRef.current.rotation.y = t * 0.12;
      shellRef.current.rotation.x = Math.sin(t * 0.17) * 0.14;
    }
    if (haloRef.current) {
      const material = haloRef.current.material as THREE.MeshBasicMaterial;
      // A waiting decision pulses four times as hard as the idle breath, so
      // the difference is visible from across the room without reading a word.
      material.opacity = waiting
        ? 0.28 + Math.abs(Math.sin(t * 1.6)) * 0.34
        : 0.1 + Math.sin(t * 0.9) * 0.03;
    }
  });

  const tone = waiting ? COLOR_AMBER : COLOR_INFO;

  return (
    <group position={[0, 1.35, 0]}>
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[0.29, 2]} />
        <meshStandardMaterial
          color={tone}
          emissive={tone}
          emissiveIntensity={1.5 * intensity}
          roughness={0.25}
          metalness={0.1}
        />
      </mesh>

      {/* Open shell: wireframe rather than glass, because transmission is the
          single most expensive material choice available and buys nothing here. */}
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[0.62, 1]} />
        <meshBasicMaterial color={tone} wireframe transparent opacity={0.22 * intensity} />
      </mesh>

      {/* A ring of light in the floor beneath the core, not a disc. The first
          version was a filled circle and read as a flat teal pancake lying on
          the platform — an object, where this is meant to be light falling. */}
      <mesh ref={haloRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.33, 0]}>
        <ringGeometry args={[0.62, 1.05, 48]} />
        <meshBasicMaterial
          color={tone}
          transparent
          opacity={0.12}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <pointLight color={tone} intensity={2.6 * intensity} distance={7} decay={2} />
    </group>
  );
}

/**
 * One agent at its dock.
 *
 * A stylised figure, not a robot model: five of these plus the stage has to
 * cost less than the V1 room did, and a GLTF robot with its own skinned
 * animation costs more than the entire platform. Silhouette carries identity
 * here — the colour band and the height are what tell them apart at a glance.
 */
function AgentDock({
  agent,
  position,
  angle,
  selected,
  dimmed,
  onSelect,
}: {
  agent: RosterAgent;
  position: THREE.Vector3;
  angle: number;
  selected: boolean;
  dimmed: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const { prefs } = useV2();
  const rig = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const arms = useRef<(THREE.Group | null)[]>([]);
  const phase = agent.id.split("").reduce((n,c) => n+c.charCodeAt(0), 0) * 0.1;
  const glowRef = useRef<THREE.Mesh>(null);

  // Colour is identity, derived from the provider so the same provider always
  // looks the same. Not decoration: it answers "who actually answers this".
  const tone = useMemo(() => providerTone(agent.provider), [agent.provider]);

  useFrame(({ clock }) => {
    const t = prefs.reducedMotion ? 0 : clock.elapsedTime + phase;
    if (rig.current) {
      rig.current.position.y = 0.16 + (prefs.reducedMotion ? 0 : Math.sin(t*1.4)*0.025);
      rig.current.rotation.z = prefs.reducedMotion ? 0 : Math.sin(t*0.7)*0.045;
    }
    if (head.current) {
      head.current.rotation.y = prefs.reducedMotion ? 0 : Math.sin(t*0.55)*0.25;
      head.current.rotation.z = prefs.reducedMotion ? 0 : (hovered ? -0.12 : Math.sin(t*0.85)*0.07);
    }
    if (eyes.current) eyes.current.scale.y = !prefs.reducedMotion && Math.sin(t*1.05)>0.995 ? 0.12 : hovered ? 1.2 : 1;
    arms.current.forEach((arm,i) => {
      if (arm) arm.rotation.z = (i===0 ? -1 : 1) * (0.2 + (prefs.reducedMotion ? 0 : Math.sin(t*1.2+i)*0.12 + (hovered ? 0.75+Math.sin(t*5)*0.2 : 0)));
    });
    if (!glowRef.current) return;
    const material = glowRef.current.material as THREE.MeshBasicMaterial;
    const base = selected ? 0.5 : hovered ? 0.34 : 0.16;
    material.opacity = dimmed ? base * 0.25 : base;
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.cursor = hovered ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered]);

  const opacity = dimmed ? 0.3 : 1;

  return (
    <group position={position} rotation={[0, -angle + Math.PI / 2, 0]}>
      {/* Dock plate */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <ringGeometry args={[0.34, 0.44, 32]} />
        <meshBasicMaterial color={tone} transparent opacity={0.16} side={THREE.DoubleSide} />
      </mesh>

      <group ref={rig}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        {/* Body */}
        <mesh position={[0, 0.42, 0]} castShadow>
          <capsuleGeometry args={[0.23, 0.27, 6, 12]} />
          <meshStandardMaterial
            color="#8794a4"
            roughness={0.42}
            metalness={0.55}
            transparent={dimmed}
            opacity={opacity}
          />
        </mesh>
        <group ref={head} position={[0,0.92,0]}>
        {/* Head */}
        <mesh position={[0, 0, 0]} scale={[1.25, 0.95, 0.9]} castShadow>
          <sphereGeometry args={[0.25, 20, 16]} />
          <meshStandardMaterial
            color="#aab6c4"
            roughness={0.3}
            metalness={0.6}
            transparent={dimmed}
            opacity={opacity}
          />
        </mesh>
        {/* Rounded visor and two eyes give the real roster a friendly face. */}
        <mesh position={[0, 0.02, 0.19]} scale={[1.5, 0.72, 0.28]}>
          <sphereGeometry args={[0.17, 16, 10]} />
          <meshStandardMaterial color="#071018" roughness={0.28} transparent={dimmed} opacity={opacity} />
        </mesh>
        <group ref={eyes}>
        {[-1,1].map(side => <mesh key={side} position={[side*0.09,0.03,0.235]} scale={[1,1.5,0.5]}>
          <sphereGeometry args={[0.03,8,6]} /><meshBasicMaterial color={tone} transparent opacity={opacity} />
        </mesh>)}
        </group>
        <mesh position={[0,-0.055,0.233]} rotation={[0,0,Math.PI]}>
          <torusGeometry args={[0.058,0.009,4,12,Math.PI]} /><meshBasicMaterial color={tone} transparent opacity={opacity*0.7} />
        </mesh>
        </group>
        {[-1,1].map((side,i) => <group key={side}>
          <group ref={g => { arms.current[i]=g; }} position={[side*0.3,0.58,0]}>
            <mesh position={[0,-0.12,0]}><capsuleGeometry args={[0.07,0.16,4,8]} /><meshStandardMaterial color="#aab6c4" metalness={0.5} roughness={0.4} transparent={dimmed} opacity={opacity} /></mesh>
            <mesh position={[0,-0.28,0.015]}><sphereGeometry args={[0.085,8,6]} /><meshStandardMaterial color="#657787" transparent={dimmed} opacity={opacity} /></mesh>
          </group>
          <mesh position={[side*0.12,0.015,0.04]} scale={[1,0.7,1.5]}><sphereGeometry args={[0.105,10,8]} /><meshStandardMaterial color="#657787" transparent={dimmed} opacity={opacity} /></mesh>
        </group>)}
      </group>

      {/* The name only when it is wanted. A permanent label above every figure
          is how a room turns into a diagram. */}
      {(hovered || selected) && !dimmed ? (
        <Billboard position={[0, 1.55, 0]}>
          <Text
            fontSize={0.13}
            color="#e8eef6"
            anchorX="center"
            outlineWidth={0.005}
            outlineColor="#000000"
          >
            {agent.name}
          </Text>
        </Billboard>
      ) : null}
    </group>
  );
}

/** Same provider, same colour — everywhere in V2. */
export function providerTone(provider: string | null): string {
  switch (provider) {
    case "anthropic":
      return "#e2703a";
    case "openai-codex":
      return "#4ade80";
    case "gemini":
      return "#a78bfa";
    case "openrouter":
      return "#38bdf8";
    default:
      return "#94a3b8";
  }
}
