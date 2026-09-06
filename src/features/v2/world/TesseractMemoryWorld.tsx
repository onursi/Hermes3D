"use client";

import { Billboard, Text, useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

export type PersonalMemory = {
  id: string;
  title: string;
  category: "Reise" | "Roadtrip" | "Lebensmoment" | "Meilenstein";
  date: string;
  location: string;
  image: string;
  story: string;
  pos: [number, number, number];
  color: string;
};

export const PERSONAL_MEMORIES: PersonalMemory[] = [
  {
    id: "mem-tokyo",
    title: "Tokio // Cyberpunk Neon & Nachtregen",
    category: "Reise",
    date: "Oktober 2024",
    location: "Shibuya & Shinjuku, Japan",
    image: "/photos/tokyo.jpg",
    story: "Nachtregen, Spiegelungen auf dem Asphalt und endlose Neonlichter. Hier entstand die visuelle Inspiration für das futuristische Spatial OS.",
    pos: [-8, 2.5, -4],
    color: "#00f0ff",
  },
  {
    id: "mem-alps",
    title: "Alpen-Pass // Sonnenaufgang im Morgennebel",
    category: "Roadtrip",
    date: "Juli 2025",
    location: "Passo Sella / Dolomiten",
    image: "/photos/alps.jpg",
    story: "Sonnenaufgang auf 2.200 Metern. Absolute Stille, Kurven im Morgengrauen und der Kopf wird frei für die großen Lebensentscheidungen.",
    pos: [0, 4.2, -10],
    color: "#fbbf24",
  },
  {
    id: "mem-coastal",
    title: "Pazifikküste // Der Horizont der Weite",
    category: "Lebensmoment",
    date: "Herbst 2025",
    location: "Big Sur & Highway 1",
    image: "/photos/coastal.jpg",
    story: "Mit offenen Armen über den Klippen. Der Moment, an dem klar war: Ich will nicht mehr in 100 flachen Fenstern ersticken, sondern Raum erschaffen.",
    pos: [8, 2.5, -4],
    color: "#c084fc",
  },
  {
    id: "mem-hermes",
    title: "Der Urknall // Hermes Agent OS",
    category: "Meilenstein",
    date: "04. September 2026",
    location: "Studio & Auto-Memos",
    image: "/photos/tokyo.jpg",
    story: "Die Vision wird Wirklichkeit: Das erste autonome 3D-Agenten-Betriebssystem mit Multi-Modell-Council und Obsidian-Vault-Gedächtnis.",
    pos: [0, 1.8, 2],
    color: "#34d399",
  },
];

/**
 * Procedural 4D Tesseract Grid Lines (Infinite strings of gravity & time)
 */
function TesseractGridLines() {
  const lineData = useMemo(() => {
    const points: number[] = [];
    const colors: number[] = [];

    const gold = new THREE.Color("#fbbf24");
    const cyan = new THREE.Color("#00f0ff");
    const purple = new THREE.Color("#c084fc");

    const spread = 24;
    const step = 4;

    // Vertical strings (Y-axis gravity pillars)
    for (let x = -spread; x <= spread; x += step) {
      for (let z = -spread; z <= spread; z += step) {
        points.push(x, -10, z, x, 18, z);
        const col = Math.abs(x) < 5 ? gold : Math.abs(z) < 5 ? cyan : purple;
        colors.push(col.r, col.g, col.b, col.r, col.g, col.b);
      }
    }

    // Horizontal time rails (Z-axis time filaments)
    for (let x = -spread; x <= spread; x += step * 2) {
      for (let y = -4; y <= 14; y += step) {
        points.push(x, y, -spread * 1.5, x, y, spread * 1.5);
        const col = cyan;
        colors.push(col.r, col.g, col.b, col.r, col.g, col.b);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, []);

  return (
    <lineSegments geometry={lineData}>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.32}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineSegments>
  );
}

/**
 * 3D Floating Memory Portal Plate
 */
function MemoryPlate({
  memory,
  isSelected,
  onSelect,
}: {
  memory: PersonalMemory;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const meshRef = useRef<THREE.Group>(null);
  const texture = useTexture(memory.image);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime() + memory.pos[0];
    meshRef.current.position.y = memory.pos[1] + Math.sin(t * 1.2) * 0.12;
    if (!isSelected) {
      meshRef.current.rotation.y = Math.sin(t * 0.5) * 0.08;
    }
  });

  return (
    <group
      ref={meshRef}
      position={memory.pos}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Outer Glow Halo Frame */}
      <mesh scale={isSelected || hovered ? 1.08 : 1.0}>
        <planeGeometry args={[4.2, 2.5]} />
        <meshBasicMaterial
          color={memory.color}
          transparent
          opacity={isSelected ? 0.9 : hovered ? 0.6 : 0.25}
          wireframe
        />
      </mesh>

      {/* Actual Photo Surface */}
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[4.0, 2.3]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>

      {/* Floating Glass Bezel */}
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[4.05, 2.35]} />
        <meshBasicMaterial
          color={memory.color}
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Info Billboard */}
      <Billboard position={[0, -1.6, 0]} follow lockX={false} lockY={false} lockZ={false}>
        <Text
          fontSize={0.24}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#020612"
        >
          {memory.title}
        </Text>
        <Text
          position={[0, -0.28, 0]}
          fontSize={0.16}
          color={memory.color}
          anchorX="center"
          anchorY="middle"
        >
          {`${memory.category.toUpperCase()} · ${memory.date} · ${memory.location}`}
        </Text>
      </Billboard>

      {/* Gravity String Indicator to Floor */}
      <line>
        <bufferGeometry
          attach="geometry"
          onUpdate={(geo) => {
            geo.setFromPoints([
              new THREE.Vector3(0, -1.2, 0),
              new THREE.Vector3(0, -memory.pos[1] - 3, 0),
            ]);
          }}
        />
        <lineBasicMaterial color={memory.color} transparent opacity={0.4} />
      </line>
    </group>
  );
}

/**
 * 4D TESSERACT MEMORY WORLD
 */
export function TesseractMemoryWorld({
  onClose,
}: {
  onClose: () => void;
}) {
  const [selectedMem, setSelectedMem] = useState<PersonalMemory | null>(null);
  const [isFlying, setIsFlying] = useState(false);
  const { camera } = useThree();

  // Hans Zimmer Synth Drone Audio
  useEffect(() => {
    let ctx: AudioContext | null = null;
    let osc1: OscillatorNode | null = null;
    let osc2: OscillatorNode | null = null;
    let tickInterval: number | null = null;

    try {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.045, ctx.currentTime);
      gain.connect(ctx.destination);

      // Deep Organ Drone (D-minor root)
      osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(73.42, ctx.currentTime); // D2
      osc1.connect(gain);
      osc1.start();

      osc2 = ctx.createOscillator();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(110.0, ctx.currentTime); // A2
      osc2.connect(gain);
      osc2.start();

      // Hypnotic Clock Tick (Interstellar watch second hand)
      tickInterval = window.setInterval(() => {
        if (!ctx) return;
        const tickOsc = ctx.createOscillator();
        const tickGain = ctx.createGain();
        tickOsc.frequency.setValueAtTime(1400, ctx.currentTime);
        tickGain.gain.setValueAtTime(0.025, ctx.currentTime);
        tickGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
        tickOsc.connect(tickGain);
        tickGain.connect(ctx.destination);
        tickOsc.start();
        tickOsc.stop(ctx.currentTime + 0.045);
      }, 1000);
    } catch (e) {
      console.warn("Audio init deferred", e);
    }

    return () => {
      if (tickInterval) clearInterval(tickInterval);
      try {
        osc1?.stop();
        osc2?.stop();
        ctx?.close();
      } catch {
        // ignore
      }
    };
  }, []);

  // Cinematic Fly-Through Animation
  useFrame(({ clock }) => {
    if (!isFlying) return;
    const t = clock.getElapsedTime() * 0.4;
    camera.position.x = Math.sin(t) * 9;
    camera.position.z = Math.cos(t) * 12;
    camera.position.y = 3.5 + Math.sin(t * 1.5) * 1.5;
    camera.lookAt(0, 2.5, -4);
  });

  return (
    <group>
      {/* Space Background Glow */}
      <mesh position={[0, 4, -20]}>
        <sphereGeometry args={[40, 16, 16]} />
        <meshBasicMaterial color="#020612" side={THREE.BackSide} />
      </mesh>

      {/* 4D Tesseract Grid Lines */}
      <TesseractGridLines />

      {/* Center Gravitational Singularity Core */}
      <mesh position={[0, 2.5, -4]}>
        <octahedronGeometry args={[1.2, 2]} />
        <meshBasicMaterial
          color="#00f0ff"
          wireframe
          transparent
          opacity={0.5}
        />
      </mesh>

      {/* Personal Memory Plates */}
      {PERSONAL_MEMORIES.map((mem) => (
        <MemoryPlate
          key={mem.id}
          memory={mem}
          isSelected={selectedMem?.id === mem.id}
          onSelect={() => setSelectedMem(mem)}
        />
      ))}

      {/* Header Billboard */}
      <Billboard position={[0, 9.5, -4]}>
        <Text
          fontSize={0.7}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.03}
          outlineColor="#000"
        >
          INTERSTELLAR 4D-ERINNERUNGSRAUM
        </Text>
        <Text
          position={[0, -0.6, 0]}
          fontSize={0.28}
          color="#c084fc"
          anchorX="center"
          anchorY="middle"
        >
          ZEIT ALS BEGEHBARE DIMENSION // PERSÖNLICHE REISEN & MEILENSTEINE
        </Text>
      </Billboard>
    </group>
  );
}
