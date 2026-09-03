"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Billboard } from "@react-three/drei";
import * as THREE from "three";
import { cyberAudio } from "@/lib/sound/cyberAudio";

/**
 * Shown wherever a metric has no source behind it.
 *
 * Every console in this room used to fall back to a plausible-looking default
 * — `€ 0.00`, `24ms`, `[main]`, `✓ CHECKS: ALLE BESTANDEN` — which is worse
 * than showing nothing, because a wrong number is indistinguishable from a
 * right one and quietly teaches you to distrust the whole room. An unmeasured
 * value now reads as unmeasured.
 */
const UNKNOWN = "—";

const showNumber = (
  value: number | null | undefined,
  format: (n: number) => string,
) => (typeof value === "number" ? format(value) : UNKNOWN);

export interface QuantumWarRoomMetrics {
  totalAgentsCount?: number;
  totalCostToday?: number;
  totalTokensToday?: number;
  inputTokensToday?: number;
  outputTokensToday?: number;
  activeTasksCount?: number;
  reviewTasksCount?: number;
  doneTasksCount?: number;
  workingAgentsCount?: number;
  activeTaskTitle?: string | null;
  repoName?: string | null;
  branchName?: string | null;
  failingChecks?: boolean;
  gatewayLatencyMs?: number;
}

export interface QuantumWarRoomProps {
  /** Center position of the Sub-Level 1 room in 3D world space (default: [-10, -5.2, -10]) */
  position?: [number, number, number];
  onTerminalClick?: (terminalType: "metrics" | "pipeline" | "logs") => void;
  activeAnalystAgent?: string | null;
  metrics?: QuantumWarRoomMetrics;
}

export function QuantumWarRoom({
  position = [0, -5.2, 0],
  onTerminalClick,
  activeAnalystAgent,
  metrics,
}: QuantumWarRoomProps) {
  // Center of War Room is position = [0, -5.2, 0] directly under the main office
  // Radius of cylindrical room = 4.8
  const roomRadius = 4.8;
  const wallHeight = 3.0;
  // Upper floor is at y = 5.2 relative to this sub-level room
  const upperFloorHeight = 5.2;
  const liftX = 0; // Directly centered under the conference table!

  // Animation refs
  const globeRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Group>(null);
  const ring2Ref = useRef<THREE.Group>(null);
  const ring3Ref = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const liftRingsRef = useRef<THREE.Group>(null);
  const terminal1ScreenRef = useRef<THREE.MeshBasicMaterial>(null);
  const terminal2ScreenRef = useRef<THREE.MeshBasicMaterial>(null);
  const terminal3ScreenRef = useRef<THREE.MeshBasicMaterial>(null);

  // Generate random data points on the globe
  const globePoints = useMemo(() => {
    const points: [number, number, number][] = [];
    const count = 36;
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      const r = 0.98;
      points.push([
        r * Math.cos(theta) * Math.sin(phi),
        r * Math.sin(theta) * Math.sin(phi),
        r * Math.cos(phi),
      ]);
    }
    return points;
  }, []);

  // Floating Quantum Particles inside the room
  const particleGeo = useMemo(() => {
    const count = 75;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 0.5 + Math.random() * 3.5;
      positions[i * 3] = Math.cos(angle) * dist;
      positions[i * 3 + 1] = 0.4 + Math.random() * 2.4;
      positions[i * 3 + 2] = Math.sin(angle) * dist;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Rotate 3D hologram globe
    if (globeRef.current) {
      globeRef.current.rotation.y = t * 0.35;
      globeRef.current.rotation.x = Math.sin(t * 0.2) * 0.1;
    }

    // Counter-rotating quantum data rings
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = t * 0.7;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y = -t * 0.9;
      ring2Ref.current.rotation.x = -Math.PI / 6 + Math.cos(t * 0.7) * 0.2;
    }
    if (ring3Ref.current) {
      ring3Ref.current.rotation.z = -t * 0.5;
      ring3Ref.current.rotation.y = t * 0.4;
    }

    // Drift particles gently
    if (particlesRef.current) {
      particlesRef.current.rotation.y = t * 0.04;
    }

    // Animate vertical Grav-Lift energy suction pulses through central tube
    if (liftRingsRef.current) {
      liftRingsRef.current.children.forEach((child, idx) => {
        const offset = idx * 1.04;
        const currentY = upperFloorHeight - ((t * 2.6 + offset) % upperFloorHeight);
        child.position.y = currentY;
        const progress = currentY / upperFloorHeight;
        child.scale.setScalar(0.75 + Math.sin(progress * Math.PI) * 0.35);
      });
    }
  });

  return (
    <group position={position}>
      {/* ============================================================ */}
      {/* 1. DARK CYBER MIRROR FLOOR (Obsidian Circle on Level 0)     */}
      {/* ============================================================ */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
        <circleGeometry args={[roomRadius, 64]} />
        <meshStandardMaterial
          color="#020610"
          roughness={0.12}
          metalness={0.94}
        />
      </mesh>

      {/* Glowing Neon Floor Border Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[roomRadius - 0.08, roomRadius, 64]} />
        <meshBasicMaterial color="#00f0ff" transparent opacity={0.8} />
      </mesh>

      {/* Concentric Sub-Floor Data Tracks */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <ringGeometry args={[2.8, 2.84, 64]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.4} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <ringGeometry args={[1.5, 1.53, 48]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.5} />
      </mesh>

      {/* 2. CYLINDRICAL PERIMETER WALLS (Level 0) */}
      <mesh position={[0, wallHeight / 2, 0]}>
        <cylinderGeometry
          args={[roomRadius, roomRadius, wallHeight, 48, 1, true, Math.PI * 0.65, Math.PI * 1.7]}
        />
        <meshStandardMaterial
          color="#050a14"
          roughness={0.25}
          metalness={0.88}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Top Ambient Cyber Crown Rim */}
      <mesh position={[0, wallHeight, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[roomRadius - 0.15, roomRadius + 0.05, 64]} />
        <meshBasicMaterial color="#00f0ff" transparent opacity={0.7} />
      </mesh>

      {/* ============================================================ */}
      {/* 3. QUANTUM GRAVITY TUBE (Zentraler Schacht unter dem Tisch)   */}
      {/* ============================================================ */}
      <group position={[0, 0, 0]}>
        {/* Lower Floor Landing Pad (Level 0) */}
        <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.1, 32]} />
          <meshStandardMaterial color="#071224" roughness={0.2} metalness={0.9} />
        </mesh>
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.02, 1.1, 32]} />
          <meshBasicMaterial color="#00f0ff" transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.54, 24]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} />
        </mesh>

        {/* Vertical Translucent Forcefield Glass Tube directly connecting table to War Room */}
        <mesh position={[0, upperFloorHeight / 2, 0]}>
          <cylinderGeometry args={[0.92, 0.92, upperFloorHeight, 32, 1, true]} />
          <meshPhysicalMaterial
            color="#00f0ff"
            transparent
            opacity={0.42}
            roughness={0.05}
            metalness={0.95}
            transmission={0.65}
            thickness={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Inner Glowing Suction Forcefield Beam */}
        <mesh position={[0, upperFloorHeight / 2, 0]}>
          <cylinderGeometry args={[0.82, 0.82, upperFloorHeight, 24, 1, true]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.25}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Outer Neon Magnetic Rings along the Elevator Shaft */}
        {[0.65, 1.3, 1.95, 2.6, 3.25, 3.9, 4.55].map((ringY) => (
          <mesh key={ringY} position={[0, ringY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.91, 0.99, 32]} />
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.85} />
          </mesh>
        ))}

        {/* Animated Ascending/Descending Energy Pulse Rings inside Tube */}
        <group ref={liftRingsRef}>
          {[0, 1, 2, 3, 4].map((idx) => (
            <mesh key={idx} position={[0, idx * 1.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.25, 0.86, 32]} />
              <meshBasicMaterial color="#00f0ff" transparent opacity={0.75} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>

        {/* Upper Table Interface (flush with conference table center at y = 5.2) */}
        <group position={[0, upperFloorHeight, 0]}>
          {/* Glass Portal Center in the Middle of Conference Table */}
          <mesh position={[0, 0.505, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.78, 32]} />
            <meshPhysicalMaterial
              color="#040d1a"
              transparent
              opacity={0.6}
              roughness={0.1}
              metalness={0.9}
              clearcoat={1}
            />
          </mesh>
          {/* Luminous table core accent ring */}
          <mesh position={[0, 0.51, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.74, 0.78, 32]} />
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.85} />
          </mesh>
          <mesh position={[0, 0.512, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.38, 0.42, 24]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.8} />
          </mesh>
        </group>
      </group>

      {/* ============================================================ */}
      {/* 4. CENTRAL HOLOGRAPHIC GLOBE & QUANTUM DATA RINGS (Level 0)  */}
      {/* ============================================================ */}
      {/* Central Pedestal */}
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.05, 1.25, 0.44, 32]} />
        <meshStandardMaterial color="#0a1222" roughness={0.2} metalness={0.9} />
      </mesh>
      {/* Pedestal Glowing Accent Ring */}
      <mesh position={[0, 0.445, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 1.05, 32]} />
        <meshBasicMaterial color="#00f0ff" transparent opacity={0.85} />
      </mesh>

      {/* Rotating 3D Hologram Globe */}
      <group ref={globeRef} position={[0, 1.45, 0]}>
        {/* Wireframe Core Sphere */}
        <mesh>
          <sphereGeometry args={[0.98, 24, 24]} />
          <meshBasicMaterial
            color="#00f0ff"
            wireframe
            transparent
            opacity={0.35}
          />
        </mesh>
        {/* Inner Luminous Core */}
        <mesh>
          <sphereGeometry args={[0.42, 16, 16]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.65} />
        </mesh>
        {/* Active Orbital Data Nodes on Globe */}
        {globePoints.map((pt, i) => (
          <mesh key={i} position={pt}>
            <sphereGeometry args={[0.024, 8, 8]} />
            <meshBasicMaterial
              color={i % 3 === 0 ? "#fbbf24" : i % 3 === 1 ? "#00f0ff" : "#22c55e"}
            />
          </mesh>
        ))}
      </group>

      {/* 3 Concentric Floating Quantum Data Rings */}
      <group position={[0, 1.45, 0]}>
        {/* Ring 1: Equatorial Blue */}
        <group ref={ring1Ref}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.65, 0.015, 12, 64]} />
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.8} />
          </mesh>
        </group>
        {/* Ring 2: Inclined Violet Stream */}
        <group ref={ring2Ref}>
          <mesh>
            <torusGeometry args={[1.9, 0.012, 12, 64]} />
            <meshBasicMaterial color="#a855f7" transparent opacity={0.7} />
          </mesh>
        </group>
        {/* Ring 3: Outer Golden Orbit */}
        <group ref={ring3Ref}>
          <mesh rotation={[0.4, 0.4, 0]}>
            <torusGeometry args={[2.2, 0.014, 12, 64]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.65} />
          </mesh>
        </group>
      </group>

      {/* Floating Ambient Particles */}
      <points ref={particlesRef} geometry={particleGeo}>
        <pointsMaterial size={0.032} color="#38bdf8" transparent opacity={0.7} />
      </points>

      {/* ============================================================ */}
      {/* 5. DREI COMMAND-KONSOLEN // KPI-MONITORE (Level 0)           */}
      {/* ============================================================ */}

      {/* KONSOLE 1: SERVER CLUSTER & PERFORMANCE METRICS */}
      <group
        position={[
          Math.cos((45 * Math.PI) / 180) * 3.3,
          0,
          Math.sin((45 * Math.PI) / 180) * 3.3,
        ]}
        rotation={[0, -(45 * Math.PI) / 180 - Math.PI / 2, 0]}
      >
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[1.5, 0.9, 0.6]} />
          <meshStandardMaterial color="#091222" roughness={0.3} metalness={0.85} />
        </mesh>
        <mesh position={[0, 1.35, 0.1]} rotation={[-0.12, 0, 0]}>
          <planeGeometry args={[1.4, 0.75]} />
          <meshBasicMaterial ref={terminal1ScreenRef} color="#030814" />
        </mesh>
        <lineSegments position={[0, 1.35, 0.101]} rotation={[-0.12, 0, 0]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(1.4, 0.75)]} />
          <lineBasicMaterial color="#00f0ff" linewidth={2} />
        </lineSegments>
        <group position={[0, 1.35, 0.11]} rotation={[-0.12, 0, 0]}>
          <Text position={[-0.58, 0.28, 0]} fontSize={0.054} color="#00f0ff" anchorX="left">
            CLUSTER // METRIKEN
          </Text>
          <Text position={[-0.58, 0.16, 0]} fontSize={0.038} color="#e2e8f0" anchorX="left">
            {typeof metrics?.workingAgentsCount === "number"
              ? `AGENTEN: ${metrics.workingAgentsCount}${
                  typeof metrics.totalAgentsCount === "number"
                    ? `/${metrics.totalAgentsCount}`
                    : ""
                } AKTIV`
              : `AGENTEN: ${UNKNOWN}`}
          </Text>
          <Text position={[-0.58, 0.08, 0]} fontSize={0.038} color="#38bdf8" anchorX="left">
            {`KOSTEN HEUTE: ${showNumber(metrics?.totalCostToday, (n) => `€ ${n.toFixed(2)}`)}`}
          </Text>
          <Text position={[-0.58, -0.01, 0]} fontSize={0.038} color="#4ade80" anchorX="left">
            {`TOKEN VERBRAUCH: ${showNumber(metrics?.totalTokensToday, (n) => `${n.toLocaleString("de-DE")} t`)}`}
          </Text>
          <Text position={[-0.58, -0.10, 0]} fontSize={0.038} color="#fbbf24" anchorX="left">
            {`GATEWAY LATENZ: ${showNumber(metrics?.gatewayLatencyMs, (n) => `${n}ms`)}`}
          </Text>
        </group>
        <mesh position={[0, 0.91, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.7, 0.26]} />
          <meshBasicMaterial color="#00f0ff" transparent opacity={0.6} />
        </mesh>
        <mesh position={[0, 0.003, 0.8]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.42, 24]} />
          <meshBasicMaterial color="#00f0ff" transparent opacity={0.5} />
        </mesh>
      </group>

      {/* KONSOLE 2: GITHUB CI/CD PIPELINE & REPO HEALTH */}
      <group
        position={[
          Math.cos((0 * Math.PI) / 180) * 3.4,
          0,
          Math.sin((0 * Math.PI) / 180) * 3.4,
        ]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[1.5, 0.9, 0.6]} />
          <meshStandardMaterial color="#091222" roughness={0.3} metalness={0.85} />
        </mesh>
        <mesh position={[0, 1.35, 0.1]} rotation={[-0.12, 0, 0]}>
          <planeGeometry args={[1.4, 0.75]} />
          <meshBasicMaterial ref={terminal2ScreenRef} color="#030814" />
        </mesh>
        <lineSegments position={[0, 1.35, 0.101]} rotation={[-0.12, 0, 0]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(1.4, 0.75)]} />
          <lineBasicMaterial color="#a855f7" linewidth={2} />
        </lineSegments>
        <group position={[0, 1.35, 0.11]} rotation={[-0.12, 0, 0]}>
          <Text position={[-0.58, 0.28, 0]} fontSize={0.054} color="#a855f7" anchorX="left">
            GITHUB // PIPELINE
          </Text>
          <Text position={[-0.58, 0.16, 0]} fontSize={0.038} color="#4ade80" anchorX="left">
            {typeof metrics?.failingChecks === "boolean"
              ? metrics.failingChecks
                ? "⚠ CHECKS: FEHLER GEFUNDEN"
                : "✓ CHECKS: ALLE BESTANDEN"
              : `CHECKS: ${UNKNOWN}`}
          </Text>
          <Text position={[-0.58, 0.08, 0]} fontSize={0.038} color="#e2e8f0" anchorX="left">
            {metrics?.repoName
              ? `REPO: ${metrics.repoName}${metrics.branchName ? ` [${metrics.branchName}]` : ""}`
              : `REPO: ${UNKNOWN}`}
          </Text>
          <Text position={[-0.58, -0.01, 0]} fontSize={0.038} color="#c084fc" anchorX="left">
            {`TASKS: ${showNumber(metrics?.activeTasksCount, (n) => `${n} in Arbeit`)} • ${showNumber(metrics?.doneTasksCount, (n) => `${n} erledigt`)}`}
          </Text>
          <Text position={[-0.58, -0.10, 0]} fontSize={0.038} color="#38bdf8" anchorX="left">
            {`REVIEWS: ${showNumber(metrics?.reviewTasksCount, (n) => `${n} warten auf Freigabe`)}`}
          </Text>
        </group>
        <mesh position={[0, 0.91, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.7, 0.26]} />
          <meshBasicMaterial color="#a855f7" transparent opacity={0.6} />
        </mesh>
        <mesh position={[0, 0.003, 0.8]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.42, 24]} />
          <meshBasicMaterial color="#a855f7" transparent opacity={0.5} />
        </mesh>
      </group>

      {/* KONSOLE 3: LIVE SYSTEM LOGS & DEBUG STREAM */}
      <group
        position={[
          Math.cos((-50 * Math.PI) / 180) * 3.3,
          0,
          Math.sin((-50 * Math.PI) / 180) * 3.3,
        ]}
        rotation={[0, -(-50 * Math.PI) / 180 - Math.PI / 2, 0]}
      >
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[1.5, 0.9, 0.6]} />
          <meshStandardMaterial color="#091222" roughness={0.3} metalness={0.85} />
        </mesh>
        <mesh position={[0, 1.35, 0.1]} rotation={[-0.12, 0, 0]}>
          <planeGeometry args={[1.4, 0.75]} />
          <meshBasicMaterial ref={terminal3ScreenRef} color="#030b14" />
        </mesh>
        <lineSegments position={[0, 1.35, 0.101]} rotation={[-0.12, 0, 0]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(1.4, 0.75)]} />
          <lineBasicMaterial color="#22c55e" linewidth={2} />
        </lineSegments>
        <group position={[0, 1.35, 0.11]} rotation={[-0.12, 0, 0]}>
          <Text position={[-0.58, 0.28, 0]} fontSize={0.052} color="#4ade80" anchorX="left">
            SYSTEM // ECHTZEIT-STATUS
          </Text>
          <Text position={[-0.58, 0.16, 0]} fontSize={0.036} color="#86efac" anchorX="left">
            [SYS] Gateway verbunden (Port 3200)
          </Text>
          <Text position={[-0.58, 0.07, 0]} fontSize={0.036} color="#e2e8f0" anchorX="left">
            [VOICE] Azure Neural Studio Voices aktiv
          </Text>
          <Text position={[-0.58, -0.02, 0]} fontSize={0.036} color="#38bdf8" anchorX="left">
            [ORBIT] Gravitations-Drift & Erde aktiv
          </Text>
          <Text position={[-0.58, -0.11, 0]} fontSize={0.036} color="#fbbf24" anchorX="left">
            {metrics?.activeTaskTitle
              ? `[TASK] ${metrics.activeTaskTitle.slice(0, 30)}...`
              : "[TASK] 4 Agenten im Ruhezustand"}
          </Text>
        </group>
        <mesh position={[0, 0.91, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.7, 0.26]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.6} />
        </mesh>
        <mesh position={[0, 0.003, 0.8]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.42, 24]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.5} />
        </mesh>
      </group>

      {/* ============================================================ */}
      {/* 6. DEV COMPUTER WORKSTATIONS (Arbeitsplätze für Roboter)     */}
      {/* ============================================================ */}
      {/* Dev Desk 1: Curved Ultrawide Workstation (North-West) */}
      <group position={[-1.6, 0, 3.1]} rotation={[0, -Math.PI / 3, 0]}>
        <mesh position={[0, 0.42, 0]}>
          <boxGeometry args={[1.4, 0.84, 0.55]} />
          <meshStandardMaterial color="#08101e" roughness={0.3} metalness={0.8} />
        </mesh>
        {/* Curved Ultrawide Display */}
        <mesh position={[0, 1.15, 0.05]} rotation={[-0.08, 0, 0]}>
          <planeGeometry args={[1.3, 0.55]} />
          <meshBasicMaterial color="#040914" />
        </mesh>
        <lineSegments position={[0, 1.15, 0.051]} rotation={[-0.08, 0, 0]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(1.3, 0.55)]} />
          <lineBasicMaterial color="#38bdf8" linewidth={1.5} />
        </lineSegments>
        <group position={[0, 1.15, 0.06]} rotation={[-0.08, 0, 0]}>
          <Text position={[-0.52, 0.18, 0]} fontSize={0.046} color="#38bdf8" anchorX="left">
            DEV-POD #01 // IDE RUNNER
          </Text>
          <Text position={[-0.52, 0.07, 0]} fontSize={0.034} color="#94a3b8" anchorX="left">
            $ agy test --coverage: 100%
          </Text>
          <Text position={[-0.52, -0.03, 0]} fontSize={0.034} color="#4ade80" anchorX="left">
            &gt; Claude: Architectural check passed
          </Text>
          <Text position={[-0.52, -0.13, 0]} fontSize={0.034} color="#e2e8f0" anchorX="left">
            &gt; ChatGPT: Compiling Next.js bundle...
          </Text>
        </group>
        {/* Glowing Keyboard */}
        <mesh position={[0, 0.85, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.6, 0.22]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.65} />
        </mesh>
        {/* Standing Mat */}
        <mesh position={[0, 0.003, 0.65]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.26, 0.38, 24]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.5} />
        </mesh>
      </group>

      {/* Dev Desk 2: Analytics & Control Pod (South-West) */}
      <group position={[1.6, 0, 3.1]} rotation={[0, Math.PI / 3, 0]}>
        <mesh position={[0, 0.42, 0]}>
          <boxGeometry args={[1.4, 0.84, 0.55]} />
          <meshStandardMaterial color="#08101e" roughness={0.3} metalness={0.8} />
        </mesh>
        <mesh position={[0, 1.15, 0.05]} rotation={[-0.08, 0, 0]}>
          <planeGeometry args={[1.3, 0.55]} />
          <meshBasicMaterial color="#040914" />
        </mesh>
        <lineSegments position={[0, 1.15, 0.051]} rotation={[-0.08, 0, 0]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(1.3, 0.55)]} />
          <lineBasicMaterial color="#f59e0b" linewidth={1.5} />
        </lineSegments>
        <group position={[0, 1.15, 0.06]} rotation={[-0.08, 0, 0]}>
          <Text position={[-0.52, 0.18, 0]} fontSize={0.046} color="#fbbf24" anchorX="left">
            DEV-POD #02 // EXECUTIVE CONTROL
          </Text>
          <Text position={[-0.52, 0.07, 0]} fontSize={0.034} color="#e2e8f0" anchorX="left">
            Hermes CAO Synthesis Stream
          </Text>
          <Text position={[-0.52, -0.03, 0]} fontSize={0.034} color="#fbbf24" anchorX="left">
            Decision Gateway: 4 Nodes in Sync
          </Text>
          <Text position={[-0.52, -0.13, 0]} fontSize={0.034} color="#4ade80" anchorX="left">
            Status: Operations Uninterrupted
          </Text>
        </group>
        <mesh position={[0, 0.85, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.6, 0.22]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.65} />
        </mesh>
        <mesh position={[0, 0.003, 0.65]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.26, 0.38, 24]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.5} />
        </mesh>
      </group>

      {/* ============================================================ */}
      {/* 7. HIGH-DENSITY SERVER RACKS & ESPRESSO ENERGY BAR (Level 0) */}
      {/* ============================================================ */}
      {/* Server Tower 1 */}
      <group position={[-3.4, 0, 1.6]} rotation={[0, Math.PI / 4, 0]}>
        <mesh position={[0, 1.25, 0]}>
          <boxGeometry args={[0.6, 2.5, 0.7]} />
          <meshStandardMaterial color="#040812" roughness={0.3} metalness={0.9} />
        </mesh>
        {/* Blinking Diagnostic LEDs */}
        {[0.4, 0.8, 1.2, 1.6, 2.0].map((ledY, i) => (
          <mesh key={i} position={[0.305, ledY, 0]}>
            <planeGeometry args={[0.08, 0.03]} />
            <meshBasicMaterial color={i % 2 === 0 ? "#00f0ff" : "#22c55e"} />
          </mesh>
        ))}
      </group>

      {/* Sub-Level Cyber Espresso Bar */}
      <group position={[3.4, 0, 1.6]} rotation={[0, -Math.PI / 4, 0]}>
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[1.0, 0.9, 0.6]} />
          <meshStandardMaterial color="#0b162a" roughness={0.3} metalness={0.8} />
        </mesh>
        {/* Espresso Machine */}
        <mesh position={[0, 1.05, 0]}>
          <boxGeometry args={[0.45, 0.35, 0.35]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} />
        </mesh>
        {/* Glowing Hologram Coffee Sign */}
        <Billboard position={[0, 1.45, 0]}>
          <Text fontSize={0.09} color="#fbbf24" anchorX="center" letterSpacing={0.1}>
            ☕ ESPRESSO // ENERGY
          </Text>
        </Billboard>
      </group>
    </group>
  );
}
