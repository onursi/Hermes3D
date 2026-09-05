"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { useV2 } from "@/features/v2/state";
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
const COLOR_AMBER = "#fbbf24";

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
      <mesh position={[0, -0.16, 0]} scale={[1, 1, 0.82]} receiveShadow castShadow>
        <cylinderGeometry args={[PLATFORM_RADIUS, PLATFORM_RADIUS * 0.94, 0.32, 64]} />
        <meshStandardMaterial color="#12181f" roughness={0.62} metalness={0.35} />
      </mesh>

      {/* The walking surface, a shade lighter so the rim reads as an edge. */}
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.82, 1]} receiveShadow>
        <circleGeometry args={[PLATFORM_RADIUS * 0.985, 64]} />
        <meshStandardMaterial color="#171f28" roughness={0.5} metalness={0.42} />
      </mesh>

      {/* The light channel. One thin emissive ring is the entire "premium"
          budget of this object, and it does more than any texture would. */}
      <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.82, 1]}>
        <ringGeometry args={[PLATFORM_RADIUS * 0.9, PLATFORM_RADIUS * 0.935, 96]} />
        <meshBasicMaterial color={COLOR_INFO} transparent opacity={0.34} side={THREE.DoubleSide} />
      </mesh>

      {/* Two faint concentric guides. Without them the deck reads as a black
          void with a bright rim: there is nothing for the eye to measure the
          surface against, and a floor you cannot read is not a floor. */}
      {[0.44, 0.68].map((factor) => (
        <mesh
          key={factor}
          position={[0, 0.003, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[1, 0.82, 1]}
        >
          <ringGeometry args={[PLATFORM_RADIUS * factor, PLATFORM_RADIUS * factor + 0.014, 72]} />
          <meshBasicMaterial color="#3f6d8c" transparent opacity={0.22} side={THREE.DoubleSide} />
        </mesh>
      ))}
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
        <meshStandardMaterial color="#1c2733" roughness={0.4} metalness={0.65} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI * 0.57]} position={[0, 0, 0.055]}>
        <torusGeometry args={[4.8, 0.018, 8, 64, Math.PI * 0.82]} />
        <meshBasicMaterial color={COLOR_INFO} transparent opacity={0.55} />
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
  const glowRef = useRef<THREE.Mesh>(null);

  // Colour is identity, derived from the provider so the same provider always
  // looks the same. Not decoration: it answers "who actually answers this".
  const tone = useMemo(() => providerTone(agent.provider), [agent.provider]);

  useFrame(() => {
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

      <group
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
          <capsuleGeometry args={[0.16, 0.44, 6, 12]} />
          <meshStandardMaterial
            color="#8794a4"
            roughness={0.42}
            metalness={0.55}
            transparent={dimmed}
            opacity={opacity}
          />
        </mesh>
        {/* Head */}
        <mesh position={[0, 0.86, 0]} castShadow>
          <sphereGeometry args={[0.15, 20, 16]} />
          <meshStandardMaterial
            color="#aab6c4"
            roughness={0.3}
            metalness={0.6}
            transparent={dimmed}
            opacity={opacity}
          />
        </mesh>
        {/* Identity band — the one coloured element on the figure. */}
        <mesh position={[0, 0.86, 0.115]}>
          <boxGeometry args={[0.17, 0.045, 0.03]} />
          <meshBasicMaterial color={tone} transparent opacity={dimmed ? 0.3 : 0.95} />
        </mesh>
      </group>

      {/* The name only when it is wanted. A permanent label above every figure
          is how a room turns into a diagram. */}
      {(hovered || selected) && !dimmed ? (
        <Billboard position={[0, 1.32, 0]}>
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
