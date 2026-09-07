"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

export type TesseractConceptMode = "kausalitaet" | "phoenix" | "maschinenraum" | "orakel";

// 16 vertices of a 4D Hypercube: (+-1, +-1, +-1, +-1)
const VERTICES_4D: [number, number, number, number][] = [];
for (const x of [-1, 1]) {
  for (const y of [-1, 1]) {
    for (const z of [-1, 1]) {
      for (const w of [-1, 1]) {
        VERTICES_4D.push([x, y, z, w]);
      }
    }
  }
}

// 32 edges of a 4D Hypercube
const EDGES_4D: [number, number][] = [];
for (let i = 0; i < 16; i++) {
  for (let j = i + 1; j < 16; j++) {
    let diff = 0;
    for (let k = 0; k < 4; k++) {
      if (VERTICES_4D[i][k] !== VERTICES_4D[j][k]) diff++;
    }
    if (diff === 1) EDGES_4D.push([i, j]);
  }
}

/**
 * 1. REAL MATHEMATICAL 4D HYPERCUBE (TESSERACT)
 * Rotates dynamically across 4D planes (XW, YW, ZW) and projects with perspective W-depth into 3D.
 */
function Mathematical4DHypercube({ scale = 3.6, color = "#00f0ff" }: { scale?: number; color?: string }) {
  const lineRef = useRef<THREE.LineSegments>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(EDGES_4D.length * 2 * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const theta = t * 0.45; // XW plane rotation
    const phi = t * 0.32;   // YW plane rotation
    const psi = t * 0.22;   // ZW plane rotation

    const cosT = Math.cos(theta), sinT = Math.sin(theta);
    const cosP = Math.cos(phi), sinP = Math.sin(phi);
    const cosS = Math.cos(psi), sinS = Math.sin(psi);

    const projected3D: [number, number, number][] = [];
    const D = 2.4; // 4D perspective distance

    for (let i = 0; i < 16; i++) {
      let [x, y, z, w] = VERTICES_4D[i];

      // Rotate in XW plane
      const x1 = x * cosT - w * sinT;
      const w1 = x * sinT + w * cosT;

      // Rotate in YW plane
      const y2 = y * cosP - w1 * sinP;
      const w2 = y * sinP + w1 * cosP;

      // Rotate in ZW plane
      const z3 = z * cosS - w2 * sinS;
      const w3 = z * sinS + w2 * cosS;

      // Perspective projection 4D -> 3D
      const factor = D / (D - w3);
      projected3D.push([x1 * factor * scale, y2 * factor * scale, z3 * factor * scale]);
    }

    if (lineRef.current) {
      const posAttr = lineRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
      const array = posAttr.array as Float32Array;
      let ptr = 0;

      for (const [startIdx, endIdx] of EDGES_4D) {
        const p1 = projected3D[startIdx];
        const p2 = projected3D[endIdx];

        array[ptr++] = p1[0];
        array[ptr++] = p1[1];
        array[ptr++] = p1[2];

        array[ptr++] = p2[0];
        array[ptr++] = p2[1];
        array[ptr++] = p2[2];
      }

      posAttr.needsUpdate = true;
    }

    if (coreRef.current) {
      coreRef.current.rotation.x = t * 0.6;
      coreRef.current.rotation.y = t * 0.8;
      const pulse = 1 + Math.sin(t * 3.5) * 0.15;
      coreRef.current.scale.set(pulse, pulse, pulse);
    }

    if (glowRef.current) {
      const pulse = 1 + Math.cos(t * 2.2) * 0.2;
      glowRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  return (
    <group position={[0, 3.2, 0]}>
      {/* 4D Wireframe Line Skeleton */}
      <lineSegments ref={lineRef} geometry={geometry}>
        <lineBasicMaterial color={color} transparent opacity={0.85} blending={THREE.AdditiveBlending} />
      </lineSegments>

      {/* Pulsing Inner Singularity Core */}
      <mesh ref={coreRef}>
        <octahedronGeometry args={[0.9, 0]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={color}
          emissiveIntensity={2.5}
          wireframe
        />
      </mesh>

      {/* Outer Quantum Haze Sphere */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.4, 24, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          wireframe
        />
      </mesh>
    </group>
  );
}

/**
 * 2. INFINITE DIMENSIONAL STRING MATRIX (Interstellar Bookshelf Lattice)
 */
function InterstellarDimensionalStrings() {
  const lineData = useMemo(() => {
    const points: number[] = [];
    const colors: number[] = [];

    const gold = new THREE.Color("#fbbf24");
    const cyan = new THREE.Color("#00f0ff");
    const purple = new THREE.Color("#c084fc");

    const spread = 28;
    const step = 4.5;

    // Vertical gravity strings extending into infinite heights and depths
    for (let x = -spread; x <= spread; x += step) {
      for (let z = -spread; z <= spread; z += step) {
        points.push(x, -25, z, x, 35, z);
        const col = Math.abs(x) < 6 ? gold : Math.abs(z) < 6 ? cyan : purple;
        colors.push(col.r, col.g, col.b, col.r, col.g, col.b);
      }
    }

    // Horizontal time rails
    for (let x = -spread; x <= spread; x += step * 2) {
      for (let y = -8; y <= 22; y += step * 1.5) {
        points.push(x, y, -spread * 1.6, x, y, spread * 1.6);
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
      <lineBasicMaterial vertexColors transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} />
    </lineSegments>
  );
}

/**
 * 3. MODE 1: KAUSALITÄTS- & ZUKUNFTS-TESSERACT
 * Real 3D crystalline polyhedra connected by glowing laser causal filaments.
 */
interface DecisionNode {
  id: string;
  title: string;
  category: string;
  pos: [number, number, number];
  color: string;
  status: string;
  impact: string;
}

const DECISION_NODES: DecisionNode[] = [
  {
    id: "dec-v2",
    title: "V2 Architektur & Dual-Track",
    category: "Architektur",
    pos: [-5.5, 3.5, -4],
    color: "#00f0ff",
    status: "Bestätigt (2026-09-04)",
    impact: "Entkopplung von Claude (Track 1) und Antigravity (Track 2). Maximale Innovations-Geschwindigkeit.",
  },
  {
    id: "dec-council",
    title: "Council Concurrency §3",
    category: "Infrastruktur",
    pos: [-3.0, 5.2, -1],
    color: "#fbbf24",
    status: "Gelöst & Bewiesen (96.8% Überlappung)",
    impact: "Simultane Ausführung der Agenten-Turns. Keine Wartezeiten mehr am virtuellen Rundtisch.",
  },
  {
    id: "dec-saturn",
    title: "Memory Saturn & Orbit",
    category: "Erinnerung",
    pos: [3.5, 4.8, -3],
    color: "#c084fc",
    status: "Integriert in Track 2",
    impact: "Persönliche Reisefotos und Lebensmomente erhalten ihren eigenen erhabenen Saturn-Orbit.",
  },
  {
    id: "dec-vault",
    title: "Obsidian Vault als Source of Truth",
    category: "Wissen",
    pos: [-4.0, 1.6, 2.5],
    color: "#34d399",
    status: "Kanonisch aktiv",
    impact: "Zero Vendor Lock-in. Alle Erkenntnisse fließen dauerhaft in den lokalen Markdown-Vault zurück.",
  },
  {
    id: "dec-tesseract",
    title: "4D Singularitäts-Tesserakt",
    category: "Singularität",
    pos: [0, 6.2, 0],
    color: "#f43f5e",
    status: "Im Bau (Antigravity Exklusiv)",
    impact: "Das Schwarze Loch transformiert sich in eine 4-dimensionale interaktive Schöpfungs-Dimension.",
  },
  {
    id: "dec-future",
    title: "Hermes OS Zukunft 2027",
    category: "Vision",
    pos: [4.8, 2.2, 2.0],
    color: "#eab308",
    status: "Projektion",
    impact: "Vollautonomes Multi-Agenten-Unternehmen mit räumlicher VR-Kollaboration und Sprachsteuerung.",
  },
];

function CausalityConceptView() {
  const [selectedNode, setSelectedNode] = useState<DecisionNode | null>(DECISION_NODES[0]);

  // Laser lines connecting decisions
  const laserGeometry = useMemo(() => {
    const points: number[] = [];
    const colors: number[] = [];
    const cyan = new THREE.Color("#00f0ff");

    for (let i = 0; i < DECISION_NODES.length; i++) {
      for (let j = i + 1; j < DECISION_NODES.length; j++) {
        const p1 = DECISION_NODES[i].pos;
        const p2 = DECISION_NODES[j].pos;
        const dist = Math.hypot(p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]);
        if (dist < 8.5) {
          points.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
          colors.push(cyan.r, cyan.g, cyan.b, cyan.r, cyan.g, cyan.b);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, []);

  return (
    <group>
      {/* 3D Laser Causal Network */}
      <lineSegments geometry={laserGeometry}>
        <lineBasicMaterial vertexColors transparent opacity={0.4} blending={THREE.AdditiveBlending} />
      </lineSegments>

      {/* 3D Crystalline Decision Nodes */}
      {DECISION_NODES.map((node) => {
        const isSelected = selectedNode?.id === node.id;
        return (
          <group
            key={node.id}
            position={node.pos}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedNode(node);
            }}
          >
            {/* 3D Faceted Crystal */}
            <mesh>
              <octahedronGeometry args={[isSelected ? 0.95 : 0.75, 0]} />
              <meshStandardMaterial
                color={node.color}
                emissive={node.color}
                emissiveIntensity={isSelected ? 1.8 : 0.7}
                roughness={0.15}
                metalness={0.85}
              />
            </mesh>

            {/* Orbiting Quantum Halo */}
            <mesh rotation={[Math.PI / 4, 0, 0]}>
              <ringGeometry args={[1.05, 1.15, 32]} />
              <meshBasicMaterial
                color={node.color}
                transparent
                opacity={isSelected ? 0.8 : 0.3}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* 3D Spatial Billboard Label */}
            <Billboard position={[0, -1.2, 0]}>
              <Text fontSize={0.24} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000000">
                {node.title}
              </Text>
              <Text position={[0, -0.28, 0]} fontSize={0.16} color={node.color} anchorX="center" anchorY="middle">
                {node.category.toUpperCase()}
              </Text>
            </Billboard>
          </group>
        );
      })}

      {/* Floating 3D Holographic Detail HUD for selected Node (Pure WebGL) */}
      {selectedNode && (
        <Billboard position={[selectedNode.pos[0], selectedNode.pos[1] + 2.2, selectedNode.pos[2]]}>
          <group>
            {/* Hologram Backing */}
            <mesh position={[0, 0, -0.05]}>
              <planeGeometry args={[4.6, 2.0]} />
              <meshBasicMaterial color="#030712" transparent opacity={0.85} />
            </mesh>
            <mesh position={[0, 0, -0.04]}>
              <planeGeometry args={[4.65, 2.05]} />
              <meshBasicMaterial color={selectedNode.color} wireframe transparent opacity={0.5} />
            </mesh>
            <Text position={[0, 0.65, 0]} fontSize={0.22} color="#ffffff" anchorX="center" anchorY="middle" maxWidth={4.2}>
              {selectedNode.title}
            </Text>
            <Text position={[0, 0.32, 0]} fontSize={0.15} color={selectedNode.color} anchorX="center" anchorY="middle">
              {`STATUS: ${selectedNode.status}`}
            </Text>
            <Text position={[0, -0.25, 0]} fontSize={0.14} color="#94a3b8" anchorX="center" anchorY="middle" maxWidth={4.0} textAlign="center">
              {selectedNode.impact}
            </Text>
          </group>
        </Billboard>
      )}
    </group>
  );
}

/**
 * 4. MODE 2: PHÖNIX-RAUM (Verdichtete Ideen & Kollision)
 * Real 3D diamond crystals with particle collision synthesis.
 */
interface IdeaCrystal {
  id: string;
  title: string;
  origin: string;
  pos: [number, number, number];
  color: string;
}

const IDEA_CRYSTALS: IdeaCrystal[] = [
  { id: "c1", title: "AI Avatar Sales Rep", origin: "Ströer Vertriebs-Vault", pos: [-6, 2.8, -3], color: "#a855f7" },
  { id: "c2", title: "Biohacking Dashboard", origin: "Gesundheitsnotizen 2026", pos: [-2.8, 5.0, -4], color: "#06b6d4" },
  { id: "c3", title: "Voice Workflow Hub", origin: "Auto-Sprachmemos", pos: [2.8, 4.8, -4], color: "#f59e0b" },
  { id: "c4", title: "Autonomous Lead Gen", origin: "Lead Pipeline Notiz", pos: [6, 2.6, -3], color: "#10b981" },
  { id: "c5", title: "Smart Contract Notary", origin: "Alte Blockchain-Idee", pos: [-3.5, 1.5, 2], color: "#3b82f6" },
  { id: "c6", title: "Micro-SaaS Agent Suite", origin: "Entwurf Entrepreneur", pos: [3.5, 1.8, 2], color: "#ec4899" },
];

function PhoenixConceptView() {
  const [activeCollision, setActiveCollision] = useState<string | null>(null);
  const [synthesizedTitle, setSynthesizedTitle] = useState<string | null>(null);

  const handleCrystalClick = (c: IdeaCrystal) => {
    setActiveCollision(c.id);
    setSynthesizedTitle(`SYNTHESE: ${c.title} × Hermes 3D Brain Matrix`);
    setTimeout(() => {
      setActiveCollision(null);
    }, 4500);
  };

  return (
    <group>
      {IDEA_CRYSTALS.map((c) => {
        const isColliding = activeCollision === c.id;
        return (
          <group
            key={c.id}
            position={c.pos}
            onClick={(e) => {
              e.stopPropagation();
              handleCrystalClick(c);
            }}
          >
            {/* 3D Dodecahedron Diamond */}
            <mesh>
              <dodecahedronGeometry args={[0.9, 0]} />
              <meshStandardMaterial
                color={c.color}
                emissive={c.color}
                emissiveIntensity={isColliding ? 3.0 : 0.8}
                metalness={0.9}
                roughness={0.1}
                wireframe={isColliding}
              />
            </mesh>

            {/* Orbiting Spark Ring */}
            <mesh rotation={[Math.PI / 3, 0, 0]}>
              <torusGeometry args={[1.2, 0.03, 16, 32]} />
              <meshBasicMaterial color={c.color} transparent opacity={0.6} />
            </mesh>

            <Billboard position={[0, -1.3, 0]}>
              <Text fontSize={0.22} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000000">
                {c.title}
              </Text>
              <Text position={[0, -0.28, 0]} fontSize={0.15} color={c.color} anchorX="center" anchorY="middle">
                {c.origin}
              </Text>
            </Billboard>
          </group>
        );
      })}

      {/* 3D Synthesis Toast Hologram in Center */}
      {synthesizedTitle && (
        <Billboard position={[0, 6.5, 0]}>
          <group>
            <mesh position={[0, 0, -0.05]}>
              <planeGeometry args={[5.8, 1.4]} />
              <meshBasicMaterial color="#020617" transparent opacity={0.92} />
            </mesh>
            <mesh position={[0, 0, -0.04]}>
              <planeGeometry args={[5.85, 1.45]} />
              <meshBasicMaterial color="#a855f7" wireframe transparent opacity={0.7} />
            </mesh>
            <Text position={[0, 0.35, 0]} fontSize={0.22} color="#f43f5e" anchorX="center" anchorY="middle">
              ⚡ 4D KOLLISIONS-SYNTHESE ERFOLGREICH
            </Text>
            <Text position={[0, -0.2, 0]} fontSize={0.17} color="#ffffff" anchorX="center" anchorY="middle">
              {synthesizedTitle}
            </Text>
          </group>
        </Billboard>
      )}
    </group>
  );
}

/**
 * 5. MODE 3: MASCHINENRAUM DER SCHÖPFUNG (System-DNA & 5 Agenten-Kognitionsfelder)
 * Towering obsidian monolith of AGENTS.md surrounded by 5 orbital agent energy orbs.
 */
interface AgentOrb {
  name: string;
  color: string;
  role: string;
  radius: number;
  speed: number;
  phase: number;
}

const AGENT_ORBS: AgentOrb[] = [
  { name: "Astra // Hermes", color: "#00f0ff", role: "Visions-Koordinator & Synthese", radius: 5.5, speed: 0.6, phase: 0 },
  { name: "Claude 3.5 Sonnet", color: "#f59e0b", role: "Präzisions-Architekt & V2", radius: 6.8, speed: 0.45, phase: (Math.PI * 2) / 5 },
  { name: "Codex // OpenAI", color: "#10b981", role: "Council-Kernel & Logik", radius: 6.0, speed: 0.55, phase: (Math.PI * 4) / 5 },
  { name: "Hermes Core", color: "#a855f7", role: "Autonomer Daemon & System", radius: 7.2, speed: 0.35, phase: (Math.PI * 6) / 5 },
  { name: "Antigravity // DeepMind", color: "#ec4899", role: "4D Singularität & Spatial UI", radius: 5.0, speed: 0.75, phase: (Math.PI * 8) / 5 },
];

function MachineRoomConceptView() {
  const groupRef = useRef<THREE.Group>(null);
  const monolithRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (monolithRef.current) {
      monolithRef.current.rotation.y = t * 0.12;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Central Monolithic Obsidian Stele (AGENTS.md System-DNA) */}
      <mesh ref={monolithRef} position={[0, 4.0, 0]}>
        <boxGeometry args={[1.8, 14, 1.8]} />
        <meshStandardMaterial
          color="#090d16"
          roughness={0.1}
          metalness={0.95}
          emissive="#00f0ff"
          emissiveIntensity={0.35}
        />
      </mesh>

      {/* Monolith Glowing Inscription */}
      <Billboard position={[0, 6.5, 1.1]}>
        <Text fontSize={0.34} color="#00f0ff" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="#000000">
          AGENTS.md
        </Text>
        <Text position={[0, -0.42, 0]} fontSize={0.18} color="#94a3b8" anchorX="center" anchorY="middle">
          DIE SYSTEM-DNA DES LIFE OS
        </Text>
      </Billboard>

      {/* 5 Orbiting Agent Cognition Orbs */}
      {AGENT_ORBS.map((agent) => (
        <OrbitingAgentSphere key={agent.name} agent={agent} />
      ))}
    </group>
  );
}

function OrbitingAgentSphere({ agent }: { agent: AgentOrb }) {
  const meshRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * agent.speed + agent.phase;
    if (meshRef.current) {
      meshRef.current.position.x = Math.cos(t) * agent.radius;
      meshRef.current.position.z = Math.sin(t) * agent.radius;
      meshRef.current.position.y = 3.5 + Math.sin(t * 2) * 1.2;
    }
  });

  return (
    <group ref={meshRef}>
      {/* 3D Agent Core Sphere */}
      <mesh>
        <sphereGeometry args={[0.65, 32, 32]} />
        <meshStandardMaterial
          color={agent.color}
          emissive={agent.color}
          emissiveIntensity={2.2}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>

      {/* Glowing Orbital Aura Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.95, 0.03, 16, 32]} />
        <meshBasicMaterial color={agent.color} transparent opacity={0.7} />
      </mesh>

      {/* 3D Billboard Tag */}
      <Billboard position={[0, 1.1, 0]}>
        <Text fontSize={0.22} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000000">
          {agent.name}
        </Text>
        <Text position={[0, -0.28, 0]} fontSize={0.15} color={agent.color} anchorX="center" anchorY="middle">
          {agent.role}
        </Text>
      </Billboard>
    </group>
  );
}

/**
 * 6. MODE 4: DAS ORAKEL DER SINGULARITÄT
 * 3D Gravitational Balance Scale for fundamental life and business decisions.
 */
function OracleConceptView() {
  const beamRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (beamRef.current) {
      // Dynamic tilting based on strategic weight oscillation
      beamRef.current.rotation.z = Math.sin(t * 0.8) * 0.18;
    }
  });

  return (
    <group position={[0, 3.5, 0]}>
      {/* Central Fulcrum Pillar */}
      <mesh position={[0, -1.5, 0]}>
        <cylinderGeometry args={[0.25, 0.6, 5, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Tilting Balance Beam */}
      <group ref={beamRef} position={[0, 1.2, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 11, 16]} />
          <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={0.6} />
        </mesh>

        {/* Left Scale Pan: Produkt & Tiefe */}
        <group position={[-5.2, -1.8, 0]}>
          <mesh>
            <sphereGeometry args={[1.2, 32, 32]} />
            <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.5} roughness={0.1} />
          </mesh>
          <Billboard position={[0, -1.7, 0]}>
            <Text fontSize={0.24} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000000">
              Fokus: Hermes OS Produkt & Tiefe
            </Text>
            <Text position={[0, -0.32, 0]} fontSize={0.16} color="#38bdf8" anchorX="center" anchorY="middle">
              GEWICHTUNG: 75%
            </Text>
          </Billboard>
        </group>

        {/* Right Scale Pan: Breite & Vertrieb */}
        <group position={[5.2, -1.8, 0]}>
          <mesh>
            <sphereGeometry args={[0.85, 32, 32]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.2} roughness={0.1} />
          </mesh>
          <Billboard position={[0, -1.7, 0]}>
            <Text fontSize={0.24} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000000">
              Fokus: Outreach & Vertrieb
            </Text>
            <Text position={[0, -0.32, 0]} fontSize={0.16} color="#f59e0b" anchorX="center" anchorY="middle">
              GEWICHTUNG: 25%
            </Text>
          </Billboard>
        </group>
      </group>

      {/* Oracle Guidance Message */}
      <Billboard position={[0, 4.8, 0]}>
        <Text fontSize={0.28} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="#000000">
          ⚖️ DAS ORAKEL DER SINGULARITÄT
        </Text>
        <Text position={[0, -0.45, 0]} fontSize={0.18} color="#00f0ff" anchorX="center" anchorY="middle">
          EMPFEHLUNG: Zuerst das Produkt vollenden – der Sog entsteht aus Exzellenz.
        </Text>
      </Billboard>
    </group>
  );
}

/**
 * 7. 3D SPATIAL CONCEPT CONTROLLER PEDESTAL (Zero Cheap 2D!)
 * 4 interactive 3D crystal buttons hovering in front of the viewer.
 */
function SpatialConceptSelector({
  activeMode,
  onSelectMode,
}: {
  activeMode: TesseractConceptMode;
  onSelectMode: (mode: TesseractConceptMode) => void;
}) {
  const modes: { id: TesseractConceptMode; label: string; color: string; x: number }[] = [
    { id: "kausalitaet", label: "1. Kausalität", color: "#00f0ff", x: -4.2 },
    { id: "phoenix", label: "2. Phönix-Raum", color: "#a855f7", x: -1.4 },
    { id: "maschinenraum", label: "3. Maschinenraum", color: "#10b981", x: 1.4 },
    { id: "orakel", label: "4. Orakel", color: "#fbbf24", x: 4.2 },
  ];

  return (
    <group position={[0, -1.8, 5.0]}>
      {modes.map((m) => {
        const isActive = activeMode === m.id;
        return (
          <group
            key={m.id}
            position={[m.x, 0, 0]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectMode(m.id);
            }}
          >
            {/* 3D Hexagonal Pedestal */}
            <mesh rotation={[0, Math.PI / 6, 0]}>
              <cylinderGeometry args={[1.0, 1.1, 0.35, 6]} />
              <meshStandardMaterial
                color={isActive ? m.color : "#0f172a"}
                emissive={m.color}
                emissiveIntensity={isActive ? 1.4 : 0.25}
                metalness={0.9}
                roughness={0.2}
              />
            </mesh>

            {/* Glowing Edge Wireframe */}
            <mesh rotation={[0, Math.PI / 6, 0]} position={[0, 0.05, 0]}>
              <cylinderGeometry args={[1.02, 1.12, 0.36, 6]} />
              <meshBasicMaterial color={m.color} wireframe transparent opacity={isActive ? 0.9 : 0.35} />
            </mesh>

            {/* 3D Text Label */}
            <Billboard position={[0, 0.45, 0]}>
              <Text fontSize={0.22} color={isActive ? "#ffffff" : "#94a3b8"} anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000000">
                {m.label}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}

/**
 * 8. MAIN MASTERPIECE COMPONENT: TESSERACT DIMENSION WORLD
 */
export function TesseractDimensionWorld({
  onExit,
}: {
  onExit: () => void;
}) {
  const [activeConcept, setActiveConcept] = useState<TesseractConceptMode>("kausalitaet");
  const { camera } = useThree();

  // Initial Camera position for 4D Tesseract view
  useEffect(() => {
    camera.position.set(0, 3.2, 14);
    camera.lookAt(0, 3.0, 0);
  }, [camera]);

  // Native Web Audio API 28Hz Sub-Bass Drone
  useEffect(() => {
    let ctx: AudioContext | null = null;
    let osc: OscillatorNode | null = null;
    let filter: BiquadFilterNode | null = null;
    let gain: GainNode | null = null;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AudioCtx();
      osc = ctx.createOscillator();
      filter = ctx.createBiquadFilter();
      gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(28, ctx.currentTime); // 28Hz sub-bass singular rumble

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(65, ctx.currentTime);

      gain.gain.setValueAtTime(0.065, ctx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
    } catch {}

    return () => {
      try {
        osc?.stop();
        ctx?.close();
      } catch {}
    };
  }, []);

  return (
    <group>
      {/* Dynamic Lighting */}
      <ambientLight intensity={0.45} />
      <pointLight position={[0, 10, 0]} intensity={3.0} color="#00f0ff" distance={45} />
      <pointLight position={[-10, 5, -10]} intensity={2.0} color="#c084fc" distance={35} />
      <pointLight position={[10, 5, 10]} intensity={2.0} color="#fbbf24" distance={35} />

      {/* Infinite Interstellar Bookshelf Time Strings */}
      <InterstellarDimensionalStrings />

      {/* Central 4D Mathematical Hypercube */}
      <Mathematical4DHypercube scale={3.4} color="#00f0ff" />

      {/* 4 Switchable Spatial Concepts */}
      {activeConcept === "kausalitaet" && <CausalityConceptView />}
      {activeConcept === "phoenix" && <PhoenixConceptView />}
      {activeConcept === "maschinenraum" && <MachineRoomConceptView />}
      {activeConcept === "orakel" && <OracleConceptView />}

      {/* 3D Spatial Concept Selector on Ground */}
      <SpatialConceptSelector activeMode={activeConcept} onSelectMode={setActiveConcept} />

      {/* 3D Spatial Re-surface Portal Beacon (Exit back to Gargantua) */}
      <group position={[0, 9.2, 0]} onClick={onExit}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.0, 0.08, 16, 48]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.4, 16, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <Billboard position={[0, 0.85, 0]}>
          <Text fontSize={0.26} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="#0284c7">
            ⬆️ Aus der Singularität auftauchen (Re-Surface)
          </Text>
        </Billboard>
      </group>
    </group>
  );
}
