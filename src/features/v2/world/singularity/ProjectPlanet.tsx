"use client";

import { Billboard, Line, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

export interface ProjectPlanetData {
  folder: string;
  name: string;
  goal: string;
  daysSinceUpdate: number;
  noteCount: number;
  importance: number; // 1 to 10
  color: string;
  orbitAngle: number;
  orbitSpeed: number;
}

interface ProjectPlanetProps {
  data: ProjectPlanetData;
  blackHoleCenter?: [number, number, number];
  isSelected: boolean;
  onSelect: () => void;
  onStabilizeOrbit: () => void;
}

export function ProjectPlanet({
  data,
  blackHoleCenter = [0, 2.5, 0],
  isSelected,
  onSelect,
  onStabilizeOrbit,
}: ProjectPlanetProps) {
  const [hovered, setHovered] = useState(false);
  const planetRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Group>(null);
  const satelliteRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Points>(null);

  // Physics: Orbit radius is directly proportional to recency!
  // Recent project (1 day) -> Outer safe orbit (R ~ 14 to 18)
  // Neglected project (100+ days) -> Dangerously close to event horizon (R ~ 5.5 to 8)
  const baseRadius = useMemo(() => {
    const minR = 5.8;  // Close to accretion disk (R=4.5 - 7.5)
    const maxR = 17.5; // Safe outer rim
    // Higher days -> Smaller radius (sucked inward)
    const decay = Math.min(1, data.daysSinceUpdate / 120);
    return THREE.MathUtils.lerp(maxR, minR, Math.pow(decay, 0.7));
  }, [data.daysSinceUpdate]);

  // Planet scale based on project importance/noteCount
  const planetScale = useMemo(() => {
    const base = 0.55 + Math.min(1.2, data.noteCount / 18) * 0.45;
    return base * (0.85 + (data.importance / 10) * 0.35);
  }, [data.noteCount, data.importance]);

  // Danger status based on proximity to the black hole
  const isDanger = baseRadius < 8.5;
  const isWarning = baseRadius >= 8.5 && baseRadius < 12.0;
  const statusColor = isDanger ? "#ef4444" : isWarning ? "#fbbf24" : "#10b981";
  const statusLabel = isDanger ? "🔴 IM SOG" : isWarning ? "🟡 DRIFTET" : "🟢 STABIL";

  // Stream particle coordinates for matter being sucked into the black hole
  const STREAM_COUNT = isDanger ? 32 : 16;
  const [streamPositions, streamOffsets] = useMemo(() => {
    const pos = new Float32Array(STREAM_COUNT * 3);
    const offsets = new Float32Array(STREAM_COUNT);
    for (let i = 0; i < STREAM_COUNT; i++) {
      offsets[i] = i / STREAM_COUNT;
    }
    return [pos, offsets];
  }, [STREAM_COUNT]);

  // Dynamic current position on orbit
  const currentPos = useRef(new THREE.Vector3());

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Angular motion
    const angle = data.orbitAngle + t * data.orbitSpeed;
    const x = Math.cos(angle) * baseRadius;
    const z = Math.sin(angle) * baseRadius;
    // Slight vertical wave across the orbit
    const y = blackHoleCenter[1] + Math.sin(angle * 2 + data.importance) * 0.8;

    currentPos.current.set(x, y, z);

    if (planetRef.current) {
      planetRef.current.position.copy(currentPos.current);

      // Tidal stretch / spaghettification if in danger zone
      if (isDanger && coreRef.current) {
        // Stretch along vector toward black hole
        const dirToCenter = new THREE.Vector3(...blackHoleCenter).sub(currentPos.current).normalize();
        const stretchAmount = 1 + Math.sin(t * 8) * 0.12 + 0.15;
        coreRef.current.scale.set(1 / Math.sqrt(stretchAmount), stretchAmount, 1 / Math.sqrt(stretchAmount));
        coreRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirToCenter);
      }
    }

    // Rotate planetary rings
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.5;
    }

    // Orbit mini data satellite around planet
    if (satelliteRef.current) {
      satelliteRef.current.rotation.y = t * 1.8;
      satelliteRef.current.rotation.x = t * 0.9;
    }

    // Update matter accretion stream particles flowing from planet into black hole
    if (trailRef.current) {
      const bh = new THREE.Vector3(...blackHoleCenter);
      const pl = currentPos.current;
      const positions = trailRef.current.geometry.attributes.position.array as Float32Array;

      for (let i = 0; i < STREAM_COUNT; i++) {
        // Flow progress from 0 (at planet) to 1 (at black hole)
        let prog = (streamOffsets[i] + t * (isDanger ? 1.2 : 0.6)) % 1;
        // Cubic easing: accelerates dramatically as it approaches black hole!
        const easedProg = Math.pow(prog, 1.4);
        const cur = new THREE.Vector3().lerpVectors(pl, bh, easedProg);

        // Add spiral vortex deflection
        const swirlAngle = prog * Math.PI * 4;
        const swirlR = (1 - prog) * 0.35;
        cur.x += Math.cos(swirlAngle) * swirlR;
        cur.y += Math.sin(swirlAngle) * swirlR;

        positions[i * 3] = cur.x;
        positions[i * 3 + 1] = cur.y;
        positions[i * 3 + 2] = cur.z;
      }
      trailRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <>
      {/* ================= 1. ORBIT TRAJECTORY RING ================= */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[blackHoleCenter[0], blackHoleCenter[1], blackHoleCenter[2]]}>
        <ringGeometry args={[baseRadius - 0.03, baseRadius + 0.03, 96]} />
        <meshBasicMaterial
          color={isDanger ? "#ef4444" : data.color}
          transparent
          opacity={isDanger ? 0.35 : 0.12}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ================= 2. GRAVITATIONAL ACCRETION STREAM PARTICLES ================= */}
      {/* Visual proof that the planet is being sucked into the Singularity! */}
      <points ref={trailRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[streamPositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={isDanger ? 0.22 : 0.14}
          color={isDanger ? "#f43f5e" : data.color}
          transparent
          opacity={isDanger ? 0.9 : 0.6}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>

      {/* ================= 3. COMPLEX SCI-FI PLANET BODY ================= */}
      <group
        ref={planetRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={() => {
          setHovered(true);
          if (typeof document !== "undefined") document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          if (typeof document !== "undefined") document.body.style.cursor = "auto";
        }}
      >
        {/* Core Planet Sphere with Emissive Lattice */}
        <mesh ref={coreRef} scale={[planetScale, planetScale, planetScale]}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial
            color={data.color}
            emissive={isDanger ? "#991b1b" : data.color}
            emissiveIntensity={isDanger ? 0.8 : hovered || isSelected ? 0.6 : 0.25}
            roughness={0.35}
            metalness={0.65}
            wireframe={isDanger}
          />
        </mesh>

        {/* Pulsing Fresnel Atmosphere Shield Bubble */}
        <mesh scale={[planetScale * 1.22, planetScale * 1.22, planetScale * 1.22]}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshBasicMaterial
            color={isDanger ? "#ef4444" : data.color}
            transparent
            opacity={hovered || isSelected ? 0.35 : isDanger ? 0.25 : 0.12}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* Planetary Techno Ring System (Inclined) */}
        <group ref={ringRef} rotation={[0.4, 0.2, 0]}>
          {/* Inner Data Ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[planetScale * 1.45, planetScale * 1.75, 48]} />
            <meshBasicMaterial
              color={data.color}
              transparent
              opacity={hovered ? 0.8 : 0.45}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          {/* Outer Segmented Laser Ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[planetScale * 1.9, planetScale * 2.05, 32]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={hovered ? 0.6 : 0.25}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>

        {/* Orbiting Mini AI Satellite Probes */}
        <group ref={satelliteRef}>
          <mesh position={[planetScale * 2.2, 0, 0]}>
            <boxGeometry args={[0.12, 0.12, 0.12]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[-planetScale * 2.2, 0, 0]}>
            <octahedronGeometry args={[0.09]} />
            <meshBasicMaterial color={data.color} />
          </mesh>
        </group>

        {/* Selection / Hover Indicator Ring */}
        {(isSelected || hovered) && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[planetScale * 2.3, planetScale * 2.45, 48]} />
            <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
          </mesh>
        )}

        {/* ================= 4. BILLBOARD LABEL & HUD ================= */}
        <Billboard position={[0, planetScale * 1.8 + 0.5, 0]}>
          <group>
            {/* Project Name Header */}
            <Text
              fontSize={0.24}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.02}
              outlineColor="#020617"
            >
              {data.name}
            </Text>

            {/* Status & Neglect Days Subtitle */}
            <Text
              position={[0, -0.28, 0]}
              fontSize={0.14}
              color={statusColor}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.015}
              outlineColor="#020617"
            >
              {statusLabel} · {data.daysSinceUpdate} Tage inaktiv
            </Text>

            {/* Inward Gravitational Pull Warning when in Danger */}
            {isDanger && (
              <Text
                position={[0, -0.52, 0]}
                fontSize={0.12}
                color="#f87171"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.015}
                outlineColor="#450a0a"
              >
                ⚠️ DROHTE VERSINKEN IM SCHWARZEN LOCH
              </Text>
            )}
          </group>
        </Billboard>
      </group>
    </>
  );
}
