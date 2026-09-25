"use client";

import { Billboard, Float, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { useV2 } from "../state";

export type AgentId = "astra" | "codex" | "claude" | "deep";

export type CouncilAgent = {
  id: AgentId;
  name: string;
  role: string;
  color: string;
  accentHex: number;
  position: [number, number, number];
  rotationY: number;
  statusText: string;
};

export const COUNCIL_AGENTS: CouncilAgent[] = [
  {
    id: "astra",
    name: "ASTRA",
    role: "Lead Architekt & Regie",
    color: "#38bdf8", // Sky Blue
    accentHex: 0x38bdf8,
    position: [-6.8, 0, 0],
    rotationY: Math.PI / 2,
    statusText: "DEBATTE (FOKUS)",
  },
  {
    id: "codex",
    name: "CODEX",
    role: "System & Performance",
    color: "#f59e0b", // Amber / Gold
    accentHex: 0xf59e0b,
    position: [0, 0, -6.8],
    rotationY: 0,
    statusText: "PRÜFUNG LAUFT",
  },
  {
    id: "claude",
    name: "CLAUDE",
    role: "Diskurs & Semantik",
    color: "#a855f7", // Violet
    accentHex: 0xa855f7,
    position: [6.8, 0, 0],
    rotationY: -Math.PI / 2,
    statusText: "GEGENARGUMENT",
  },
  {
    id: "deep",
    name: "DEEP",
    role: "Synthese & Konsens",
    color: "#10b981", // Emerald
    accentHex: 0x10b981,
    position: [0, 0, 6.8],
    rotationY: Math.PI,
    statusText: "SYNTHESE BEREIT",
  },
];

export function CouncilWorld({
  activeSpeaker = "astra",
  onSelectAgent,
  onurSpeaking = false,
}: {
  activeSpeaker?: AgentId | "onur" | "none";
  onSelectAgent?: (id: AgentId) => void;
  onurSpeaking?: boolean;
}) {
  const { prefs } = useV2();
  const [internalSpeaker, setInternalSpeaker] = useState<AgentId | "onur" | "none">(activeSpeaker);
  const [isIntervening, setIsIntervening] = useState(onurSpeaking);

  // Sync external props
  useEffect(() => {
    setInternalSpeaker(activeSpeaker);
  }, [activeSpeaker]);

  useEffect(() => {
    setIsIntervening(onurSpeaking);
  }, [onurSpeaking]);

  // Listen for global custom events from HUD
  useEffect(() => {
    const handleSpeechToggle = (e: CustomEvent<{ active: boolean }>) => {
      setIsIntervening(e.detail.active);
    };
    const handleSpeakerChange = (e: CustomEvent<{ speaker: AgentId }>) => {
      setInternalSpeaker(e.detail.speaker);
    };

    window.addEventListener("hermes:vad-speech" as any, handleSpeechToggle as any);
    window.addEventListener("hermes:council-speaker" as any, handleSpeakerChange as any);
    return () => {
      window.removeEventListener("hermes:vad-speech" as any, handleSpeechToggle as any);
      window.removeEventListener("hermes:council-speaker" as any, handleSpeakerChange as any);
    };
  }, []);

  return (
    <group>
      {/* Dynamic Lighting */}
      <ambientLight intensity={0.45} />
      <directionalLight position={[10, 25, 15]} intensity={1.2} color="#e0f2fe" />
      <directionalLight position={[-10, 15, -15]} intensity={0.6} color="#c084fc" />

      {/* Arena Floor & Concentric Energy Rings */}
      <ArenaFloor isIntervening={isIntervening} />

      {/* Central KERN Fusion Core */}
      <CentralKernCore
        reducedMotion={prefs.reducedMotion}
        isIntervening={isIntervening}
        activeSpeaker={internalSpeaker}
      />

      {/* 4 Agent Consoles */}
      {COUNCIL_AGENTS.map((agent) => (
        <AgentPodium
          key={agent.id}
          agent={agent}
          isActiveSpeaker={internalSpeaker === agent.id && !isIntervening}
          isIntervening={isIntervening}
          reducedMotion={prefs.reducedMotion}
          onSelect={() => {
            setInternalSpeaker(agent.id);
            onSelectAgent?.(agent.id);
          }}
        />
      ))}

      {/* Debate Laser Arc between Astra and Claude */}
      {internalSpeaker === "astra" && !isIntervening && (
        <DebateLaser start={[-6.8, 2.4, 0]} end={[6.8, 2.4, 0]} color="#38bdf8" />
      )}
      {internalSpeaker === "claude" && !isIntervening && (
        <DebateLaser start={[6.8, 2.4, 0]} end={[-6.8, 2.4, 0]} color="#c084fc" />
      )}
      {internalSpeaker === "codex" && !isIntervening && (
        <DebateLaser start={[0, 2.4, -6.8]} end={[0, 2.4, 0]} color="#f59e0b" />
      )}
      {internalSpeaker === "deep" && !isIntervening && (
        <DebateLaser start={[0, 2.4, 6.8]} end={[0, 2.4, 0]} color="#10b981" />
      )}

      {/* Executive Master Desk (Onur's Station) */}
      <ExecutiveDais isIntervening={isIntervening} />
    </group>
  );
}

/** Arena Floor with Sci-Fi Grid and Ripple Waves */
function ArenaFloor({ isIntervening }: { isIntervening: boolean }) {
  const rippleRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (rippleRef.current) {
      if (isIntervening) {
        const s = 1 + (clock.elapsedTime * 2.5) % 8;
        rippleRef.current.scale.set(s, s, 1);
        (rippleRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 - s * 0.08);
      } else {
        rippleRef.current.scale.set(0.1, 0.1, 1);
        (rippleRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }
  });

  return (
    <group position={[0, -0.05, 0]}>
      {/* Dark Main Foundation Disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[14, 64]} />
        <meshStandardMaterial
          color="#060c14"
          metalness={0.88}
          roughness={0.24}
        />
      </mesh>

      {/* Outer Luminous Rim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[13.8, 14.05, 64]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.65} side={THREE.DoubleSide} />
      </mesh>

      {/* Middle Golden Orbit Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[6.7, 6.9, 64]} />
        <meshBasicMaterial color="#d97706" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* Inner KERN Collar Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[2.8, 2.95, 48]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>

      {/* Radiating Axis Spoke Lines to 4 Pedestals */}
      {COUNCIL_AGENTS.map((agent) => (
        <group key={agent.id} rotation={[0, -agent.rotationY + Math.PI / 2, 0]}>
          <mesh position={[0, 0.01, 3.5]}>
            <boxGeometry args={[0.04, 0.005, 6.5]} />
            <meshBasicMaterial color={agent.color} transparent opacity={0.5} />
          </mesh>
        </group>
      ))}

      {/* VAD Speech Expansion Ripple */}
      <mesh ref={rippleRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1, 1.25, 64]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Central KERN Fusion Core with Gimbal Rings */
function CentralKernCore({
  reducedMotion,
  isIntervening,
  activeSpeaker,
}: {
  reducedMotion: boolean;
  isIntervening: boolean;
  activeSpeaker: string;
}) {
  const ring1Ref = useRef<THREE.Group>(null);
  const ring2Ref = useRef<THREE.Group>(null);
  const ring3Ref = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const coreLightRef = useRef<THREE.PointLight>(null);

  const coreColor = isIntervening
    ? "#fbbf24" // Amber / Gold on Onur intervention
    : activeSpeaker === "astra"
    ? "#38bdf8"
    : activeSpeaker === "codex"
    ? "#f59e0b"
    : activeSpeaker === "claude"
    ? "#c084fc"
    : activeSpeaker === "deep"
    ? "#10b981"
    : "#38bdf8";

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!reducedMotion) {
      if (ring1Ref.current) ring1Ref.current.rotation.x = t * 0.45;
      if (ring2Ref.current) ring2Ref.current.rotation.y = t * 0.65;
      if (ring3Ref.current) ring3Ref.current.rotation.z = t * 0.35;

      if (coreRef.current) {
        const pulse = 1 + Math.sin(t * 3) * 0.06;
        coreRef.current.scale.set(pulse, pulse, pulse);
      }
    }
  });

  return (
    <group position={[0, 2.6, 0]}>
      {/* Central Glowing Fusion Sphere */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={coreColor}
          emissiveIntensity={isIntervening ? 2.5 : 1.4}
          roughness={0.15}
          metalness={0.9}
        />
      </mesh>

      {/* Internal High-Intensity PointLight */}
      <pointLight
        ref={coreLightRef}
        color={coreColor}
        intensity={isIntervening ? 320 : 160}
        distance={25}
      />

      {/* Inner Gyro Cage */}
      <mesh>
        <sphereGeometry args={[1.45, 16, 16]} />
        <meshBasicMaterial color={coreColor} wireframe transparent opacity={0.35} />
      </mesh>

      {/* Gimbal Ring 1 */}
      <group ref={ring1Ref}>
        <mesh rotation={[Math.PI / 4, 0, 0]}>
          <torusGeometry args={[1.9, 0.045, 16, 64]} />
          <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.6} metalness={0.9} />
        </mesh>
      </group>

      {/* Gimbal Ring 2 */}
      <group ref={ring2Ref}>
        <mesh rotation={[0, Math.PI / 4, 0]}>
          <torusGeometry args={[2.35, 0.04, 16, 64]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.5} metalness={0.9} />
        </mesh>
      </group>

      {/* Gimbal Ring 3 */}
      <group ref={ring3Ref}>
        <mesh rotation={[Math.PI / 6, 0, Math.PI / 3]}>
          <torusGeometry args={[2.8, 0.035, 16, 64]} />
          <meshStandardMaterial color="#c084fc" emissive="#c084fc" emissiveIntensity={0.4} metalness={0.9} />
        </mesh>
      </group>

      {/* Billboard Core Status Label */}
      <Billboard position={[0, 2.3, 0]}>
        <Text
          fontSize={0.42}
          color={isIntervening ? "#fbbf24" : "#e0f2fe"}
          outlineWidth={0.02}
          outlineColor="#020617"
          textAlign="center"
        >
          {isIntervening ? "⚡ ONUR INTERVENTION (VAD)" : "HERMES KERN"}
        </Text>
      </Billboard>
    </group>
  );
}

/** Individual Agent Podium with 3D Artifact and Holo-Badge */
function AgentPodium({
  agent,
  isActiveSpeaker,
  isIntervening,
  reducedMotion,
  onSelect,
}: {
  agent: CouncilAgent;
  isActiveSpeaker: boolean;
  isIntervening: boolean;
  reducedMotion: boolean;
  onSelect: () => void;
}) {
  const artifactRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (artifactRef.current && !reducedMotion) {
      const speed = isActiveSpeaker ? 1.4 : 0.5;
      artifactRef.current.rotation.y = clock.elapsedTime * speed;
      artifactRef.current.position.y = 1.9 + Math.sin(clock.elapsedTime * 2 + agent.position[0]) * 0.12;
    }
  });

  return (
    <group position={agent.position} rotation={[0, agent.rotationY, 0]}>
      {/* Base Console Cylinder */}
      <mesh position={[0, 0.45, 0]} onClick={onSelect}>
        <cylinderGeometry args={[1.2, 1.45, 0.9, 32]} />
        <meshStandardMaterial
          color="#0b1320"
          metalness={0.85}
          roughness={0.25}
        />
      </mesh>

      {/* Luminous Top Collar Ring */}
      <mesh position={[0, 0.91, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.05, 1.22, 32]} />
        <meshBasicMaterial
          color={agent.color}
          transparent
          opacity={isActiveSpeaker ? 0.95 : 0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Vertical Light Column when active */}
      {isActiveSpeaker && (
        <mesh position={[0, 4.5, 0]}>
          <cylinderGeometry args={[0.9, 1.1, 7.2, 32, 1, true]} />
          <meshBasicMaterial
            color={agent.color}
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Floating 3D Geometric Avatar Artifact */}
      <group ref={artifactRef} position={[0, 1.9, 0]} onClick={onSelect}>
        {agent.id === "astra" && (
          <group>
            <mesh>
              <sphereGeometry args={[0.55, 24, 24]} />
              <meshStandardMaterial color={agent.color} emissive={agent.color} emissiveIntensity={isActiveSpeaker ? 1.2 : 0.4} />
            </mesh>
            <mesh rotation={[0.4, 0.3, 0]}>
              <torusGeometry args={[0.85, 0.04, 16, 48]} />
              <meshBasicMaterial color={agent.color} wireframe />
            </mesh>
          </group>
        )}

        {agent.id === "codex" && (
          <mesh>
            <octahedronGeometry args={[0.65, 0]} />
            <meshStandardMaterial color={agent.color} emissive={agent.color} emissiveIntensity={isActiveSpeaker ? 1.4 : 0.4} metalness={0.9} roughness={0.15} />
          </mesh>
        )}

        {agent.id === "claude" && (
          <mesh>
            <torusKnotGeometry args={[0.48, 0.14, 64, 16]} />
            <meshStandardMaterial color={agent.color} emissive={agent.color} emissiveIntensity={isActiveSpeaker ? 1.3 : 0.4} roughness={0.2} metalness={0.8} />
          </mesh>
        )}

        {agent.id === "deep" && (
          <mesh>
            <dodecahedronGeometry args={[0.62, 0]} />
            <meshStandardMaterial color={agent.color} emissive={agent.color} emissiveIntensity={isActiveSpeaker ? 1.4 : 0.4} metalness={0.9} roughness={0.1} />
          </mesh>
        )}
      </group>

      {/* 3D Billboard Info Badge */}
      <Billboard position={[0, 3.2, 0]}>
        <Text
          fontSize={0.42}
          color={isActiveSpeaker ? "#ffffff" : "#94a3b8"}
          outlineWidth={0.02}
          outlineColor="#020617"
          textAlign="center"
        >
          {agent.name}
        </Text>
        <Text
          position={[0, -0.42, 0]}
          fontSize={0.24}
          color={agent.color}
          textAlign="center"
        >
          {agent.role}
        </Text>
        <Text
          position={[0, -0.74, 0]}
          fontSize={0.2}
          color={isActiveSpeaker ? "#4ade80" : "#64748b"}
          textAlign="center"
        >
          {isActiveSpeaker ? "● SPRICHT GERADE" : isIntervening ? "⏸ PAUSIERT (ONUR)" : "BEREIT"}
        </Text>
      </Billboard>
    </group>
  );
}

/** High-Intensity Debating Laser Bridge */
function DebateLaser({
  start,
  end,
  color,
}: {
  start: [number, number, number];
  end: [number, number, number];
  color: string;
}) {
  const points = useMemo(() => [new THREE.Vector3(...start), new THREE.Vector3(...end)], [start, end]);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  const geom = useMemo(() => new THREE.TubeGeometry(curve, 20, 0.045, 8, false), [curve]);

  return (
    <mesh geometry={geom}>
      <meshBasicMaterial color={color} transparent opacity={0.85} />
    </mesh>
  );
}

/** Onur's Executive Master Station at Arena Border */
function ExecutiveDais({ isIntervening }: { isIntervening: boolean }) {
  return (
    <group position={[0, 0, 10.5]}>
      {/* Platform Desk */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[3.2, 0.7, 1.2]} />
        <meshStandardMaterial
          color="#090f1a"
          metalness={0.92}
          roughness={0.18}
        />
      </mesh>

      {/* Desk Top Glowing Line */}
      <mesh position={[0, 0.71, 0.45]}>
        <boxGeometry args={[2.8, 0.02, 0.06]} />
        <meshBasicMaterial color={isIntervening ? "#fbbf24" : "#38bdf8"} />
      </mesh>

      {/* Executive Billboard Badge */}
      <Billboard position={[0, 1.5, 0]}>
        <Text
          fontSize={0.34}
          color={isIntervening ? "#fbbf24" : "#e2e8f0"}
          outlineWidth={0.015}
          outlineColor="#020617"
          textAlign="center"
        >
          ONUR · EXECUTIVE TERMINAL
        </Text>
        <Text
          position={[0, -0.32, 0]}
          fontSize={0.22}
          color={isIntervening ? "#34d399" : "#94a3b8"}
          textAlign="center"
        >
          {isIntervening ? "🎙️ OFFENES MIKROFON: AKTIV" : "VAD STANDBY"}
        </Text>
      </Billboard>
    </group>
  );
}
