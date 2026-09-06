"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

interface GargantuaProps {
  position?: [number, number, number];
  onDive?: () => void;
}

export function GargantuaBlackHole({
  position = [0, 2.5, 0],
  onDive,
}: GargantuaProps) {
  const groupRef = useRef<THREE.Group>(null);
  const diskRef = useRef<THREE.Group>(null);
  const lensUpperRef = useRef<THREE.Mesh>(null);
  const lensLowerRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const [hovered, setHovered] = useState(false);

  // Generate 800 accretion swirl particles
  const [particlePositions, particleColors] = useMemo(() => {
    const count = 900;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const colorHot = new THREE.Color("#67e8f9"); // Bright cyan
    const colorMid = new THREE.Color("#fbbf24"); // Golden amber
    const colorRed = new THREE.Color("#f43f5e"); // Redshift

    for (let i = 0; i < count; i++) {
      // Radius between 2.6 and 7.8 with higher density near event horizon
      const r = 2.6 + Math.pow(Math.random(), 1.6) * 5.2;
      const angle = Math.random() * Math.PI * 2;
      // Slight vertical spread that flattens near the center
      const ySpread = (Math.random() - 0.5) * (0.25 * (r - 2.5));

      pos[i * 3] = Math.cos(angle) * r;
      pos[i * 3 + 1] = ySpread;
      pos[i * 3 + 2] = Math.sin(angle) * r;

      // Doppler & temperature coloring
      const lerpVal = (r - 2.6) / 5.2;
      const c = new THREE.Color();
      if (lerpVal < 0.3) {
        c.lerpColors(colorHot, colorMid, lerpVal / 0.3);
      } else {
        c.lerpColors(colorMid, colorRed, (lerpVal - 0.3) / 0.7);
      }
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return [pos, col];
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Rotate horizontal accretion disk
    if (diskRef.current) {
      diskRef.current.rotation.y = t * 0.4;
    }

    // Swirl accretion particles
    if (particlesRef.current) {
      particlesRef.current.rotation.y = t * 0.65;
    }

    // Gentle pulse and shimmer of the gravitational lens arcs
    if (lensUpperRef.current && lensLowerRef.current) {
      const wobble = Math.sin(t * 1.8) * 0.03;
      lensUpperRef.current.scale.set(1 + wobble, 1 + wobble, 1);
      lensLowerRef.current.scale.set(1 - wobble, 1 - wobble, 1);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* ================= 1. PITCH-BLACK EVENT HORIZON ================= */}
      {/* Central Black Sphere: Completely absorbs all light */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onDive?.();
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
        <sphereGeometry args={[2.35, 64, 64]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* ================= 2. PHOTON SPHERE & CORONA ================= */}
      {/* Ultra-hot razor-thin halo right at the event horizon boundary */}
      <mesh>
        <sphereGeometry args={[2.42, 48, 48]} />
        <meshBasicMaterial
          color={hovered ? "#38bdf8" : "#fef08a"}
          transparent
          opacity={hovered ? 0.45 : 0.25}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Razor-sharp photon ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.38, 2.52, 96]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ================= 3. GRAVITATIONAL LENSING (GARGANTUA ARCS) ================= */}
      {/* Upper Lensing Arc: Light from the rear accretion disk bent over the top */}
      <mesh
        ref={lensUpperRef}
        rotation={[Math.PI / 2.35, 0, 0]}
        position={[0, 0.4, 0]}
      >
        <ringGeometry args={[2.46, 5.8, 80]} />
        <meshBasicMaterial
          color="#fbbf24"
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Lower Lensing Arc: Light bent beneath the black hole */}
      <mesh
        ref={lensLowerRef}
        rotation={[-Math.PI / 2.35, 0, 0]}
        position={[0, -0.4, 0]}
      >
        <ringGeometry args={[2.46, 5.8, 80]} />
        <meshBasicMaterial
          color="#f59e0b"
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* ================= 4. HORIZONTAL ACCRETION DISK ================= */}
      <group ref={diskRef} rotation={[-0.12, 0, 0.08]}>
        {/* Inner high-energy relativistic ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.52, 4.4, 96]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.65}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* Mid fiery plasma disk */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.8, 6.8, 96]} />
          <meshBasicMaterial
            color="#f59e0b"
            transparent
            opacity={0.45}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* Outer cool reddish dust ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[6.2, 8.8, 80]} />
          <meshBasicMaterial
            color="#dc2626"
            transparent
            opacity={0.22}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* ================= 5. SWIRLING ACCRETION PARTICLES ================= */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particlePositions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[particleColors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.12}
          vertexColors
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>

      {/* ================= 6. AMBIENT GRAVITATIONAL SOG BILLBOARD ================= */}
      <Billboard position={[0, 4.2, 0]}>
        <group
          onClick={(e) => {
            e.stopPropagation();
            onDive?.();
          }}
          onPointerOver={() => {
            if (typeof document !== "undefined") document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            if (typeof document !== "undefined") document.body.style.cursor = "auto";
          }}
        >
          <Text
            fontSize={0.28}
            color="#67e8f9"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#020617"
          >
            🌌 GARGANTUA · SINGULARITY
          </Text>
          <Text
            position={[0, -0.32, 0]}
            fontSize={0.14}
            color="#94a3b8"
            anchorX="center"
            anchorY="middle"
          >
            [ Klick für Singularity-Dive ]
          </Text>
        </group>
      </Billboard>
    </group>
  );
}
