"use client";

import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { useAgentStore } from "@/features/agents/state/store";
import {
  CANVAS_H,
  CANVAS_W,
  SCALE,
} from "@/features/retro-office/core/constants";
import {
  MEETING_ROOM_RUG,
  MEETING_ROOM_SEATS,
} from "@/features/retro-office/core/meetingRoom";
import {
  CITY_PATH_ZONE,
  LOCAL_OFFICE_CANVAS_HEIGHT,
  LOCAL_OFFICE_CANVAS_WIDTH,
  REMOTE_OFFICE_ZONE,
} from "@/features/retro-office/core/district";
import { toWorld } from "@/features/retro-office/core/geometry";
import { getGrassTextures, getPlasterTextures, getConcreteTextures, getSpaceShuttleDeckTextures, withRepeat } from "@/features/retro-office/core/proceduralTextures";
import { TableMeetingHoloHub, type TableMeetingState } from "./TableMeetingHoloHub";
import { cyberAudio } from "@/lib/sound/cyberAudio";

/** Floor slab thickness — gives the floor a real visible edge/depth instead
 * of reading as a flat 2D plane, especially now that two sides of the room
 * are open (no wall hides the cut). */
const FLOOR_SLAB_THICKNESS = 0.12;

/** Repeating panel-seam grid drawn on top of the floor slab — a plain flat
 * material read as "too white"/featureless, so this gives it visible
 * joints between panels (a real depth cue) without touching the base
 * material's color/roughness setup. */
function useFloorSeamTexture(repeatX: number, repeatY: number) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Transparent background — only the seam stroke carries alpha, so
      // this composites as a line grid, not an opaque overlay. Light
      // strokes (not dark) now that the floor itself is black marble —
      // dark-on-dark seams would be invisible.
      ctx.strokeStyle = "rgba(210, 210, 215, 0.18)";
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, 125, 125);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.needsUpdate = true;
    return texture;
  }, [repeatX, repeatY]);
}

/** Procedural Italian White Stracciatella Marble (Terrazzo Carrara) —
 * Luminous milky-white calcite base with delicate smoky veins and crisp,
 * organic black and charcoal terrazzo/stracciatella flakes and chips. */
function useMarbleTexture(repeatX: number, repeatY: number) {
  return useMemo(() => {
    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // 1. Pristine luxury white base
      ctx.fillStyle = "#fafbfe";
      ctx.fillRect(0, 0, size, size);

      // Deterministic PRNG
      const prng = (seed: number) => {
        let s = (seed + 1) * 2654435761;
        s = (s ^ (s >> 13)) * 2246822519;
        s ^= s >> 16;
        return (s >>> 0) / 4294967295;
      };

      // 2. Soft, ultra-subtle clouding for Carrara depth
      for (let i = 0; i < 20; i += 1) {
        const x = prng(i * 3 + 1) * size;
        const y = prng(i * 7 + 2) * size;
        const r = 60 + prng(i * 11 + 3) * 160;
        const cloud = ctx.createRadialGradient(x, y, 0, x, y, r);
        cloud.addColorStop(0, "rgba(228, 233, 240, 0.45)");
        cloud.addColorStop(0.6, "rgba(238, 242, 246, 0.2)");
        cloud.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = cloud;
        ctx.fillRect(0, 0, size, size);
      }

      // 3. Elegant, whisper-thin gray marble veins
      for (let v = 0; v < 5; v += 1) {
        let vx = prng(v * 41 + 10) * size;
        let vy = prng(v * 47 + 20) * size;
        let angle = prng(v * 53 + 30) * Math.PI * 2;
        ctx.save();
        ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(vx, vy);
        for (let s = 0; s < 25; s += 1) {
          angle += (prng(v * 200 + s) - 0.5) * 0.6;
          vx += Math.cos(angle) * 22;
          vy += Math.sin(angle) * 22;
          ctx.lineTo(vx, vy);
        }
        ctx.stroke();
        ctx.restore();
      }

      // 4. Stracciatella / Terrazzo Flakes & Chips:
      // A rich mix of sharp dark charcoal and jet black polygonal chips + tiny speckles
      const chipColors = [
        "rgba(15, 18, 23, 0.95)",   // Jet black
        "rgba(26, 31, 40, 0.92)",   // Dark slate
        "rgba(38, 44, 56, 0.85)",   // Charcoal
        "rgba(71, 85, 105, 0.75)",  // Deep graphite
        "rgba(100, 116, 139, 0.65)",// Cool steel
      ];

      // 4a. Sharp irregular chips (polygons)
      const numLargeChips = 220;
      for (let c = 0; c < numLargeChips; c += 1) {
        const cx = prng(c * 17 + 100) * size;
        const cy = prng(c * 23 + 200) * size;
        const radius = 2.5 + prng(c * 31) * 8;
        const numPts = 3 + Math.floor(prng(c * 37) * 4); // 3 to 6 vertices
        const color = chipColors[Math.floor(prng(c * 43) * chipColors.length)];

        ctx.fillStyle = color;
        ctx.beginPath();
        for (let p = 0; p < numPts; p += 1) {
          const ptAngle = (p / numPts) * Math.PI * 2 + prng(c * 10 + p) * 0.5;
          const dist = radius * (0.5 + prng(c * 20 + p) * 0.8);
          const px = cx + Math.cos(ptAngle) * dist;
          const py = cy + Math.sin(ptAngle) * dist;
          if (p === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }

      // 4b. Fine speckles & crushed grains
      const numSpecks = 600;
      for (let s = 0; s < numSpecks; s += 1) {
        const sx = prng(s * 7 + 500) * size;
        const sy = prng(s * 11 + 600) * size;
        const r = 0.8 + prng(s * 13) * 2;
        ctx.fillStyle = prng(s) > 0.3 ? "rgba(15, 18, 23, 0.85)" : "rgba(51, 65, 85, 0.7)";
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }, [repeatX, repeatY]);
}

/** Soft, dark radial-gradient decal grounding a piece of furniture to the
 * floor — a real, always-visible contact shadow instead of relying only on
 * the ambient-occlusion pass (which is subtle at this scene's small scale). */
function FloorContactShadow({
  position,
  radius,
  opacity = 0.4,
}: {
  position: [number, number, number];
  radius: number;
  opacity?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, "rgba(10,12,16,0.9)");
      gradient.addColorStop(0.6, "rgba(10,12,16,0.35)");
      gradient.addColorStop(1, "rgba(10,12,16,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[radius * 2, radius * 2]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </mesh>
  );
}

function FramedPicture({
  position,
  rotY = 0,
  w = 0.52,
  h = 0.38,
  frameColor = "#1c1008",
  bgColor = "#f0ece0",
  art,
}: {
  position: [number, number, number];
  rotY?: number;
  w?: number;
  h?: number;
  frameColor?: string;
  bgColor?: string;
  art: ReactNode;
}) {
  const frameDepth = 0.028;
  const inset = 0.038;
  const artZ = frameDepth / 2 + 0.007;

  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh>
        <boxGeometry args={[w, h, frameDepth]} />
        <meshStandardMaterial
          color={frameColor}
          roughness={0.75}
          metalness={0.18}
        />
      </mesh>
      <mesh position={[0, 0, frameDepth / 2 + 0.003]}>
        <boxGeometry args={[w - inset * 2, h - inset * 2, 0.005]} />
        <meshStandardMaterial color={bgColor} roughness={0.95} metalness={0} />
      </mesh>
      <group position={[0, 0, artZ]}>{art}</group>
    </group>
  );
}

/** Flush wall-mounted whiteboard — no legs/stand/frame-on-a-cart like the
 * furniture-editor "whiteboard" item, just a flat panel + thin bezel
 * hanging directly on the wall, per the TikTok/SAMS reference's mounted
 * boards. Sits a hair off the wall face to avoid z-fighting. */
function WallWhiteboard({
  position,
  rotY = 0,
  w = 1.6,
  h = 1.0,
  text,
  onClick,
}: {
  position: [number, number, number];
  rotY?: number;
  w?: number;
  h?: number;
  /** Marker-pen text written on the board — plain string, no wrapping tricks
   * needed for a short title. */
  text?: string;
  /** Click-to-write — a real text-editing overlay is a bigger feature than
   * this pass warrants, so this drives a plain browser prompt() instead. */
  onClick?: () => void;
}) {
  // Same recessed-niche construction as WallKanbanBoard/WallCouncilScreen
  // below — a backing set back into the wall thickness plus a frame lip
  // that pokes just proud of the wall face, instead of a ~2cm bezel stuck
  // flat to the surface (which read as a thin pinboard, not something
  // actually built into the wall). Group is positioned at the wall's
  // room-facing surface (local z=0), so every z here must stay >= 0 — the
  // wall itself is solid geometry (see PerimeterWall), and anything placed
  // at a negative z here is placed INSIDE that opaque box and invisible
  // (this was a real bug: the niche used to sit at z=-0.11, embedded in
  // the wall's own 0.26-thick body, hiding everything but a 1.5cm sliver
  // of the frame that happened to poke past the wall face — the recessed
  // look instead comes from the backing sitting closer to the wall (small
  // positive z) than the frame's own front lip (larger positive z), all in
  // front of the wall, not behind its face).
  const frameThickness = 0.045;
  const backingZ = 0.02;
  const frameFrontZ = 0.14;
  const frameDepth = frameFrontZ - backingZ;
  const frameCenterZ = (backingZ + frameFrontZ) / 2;
  const innerW = w - frameThickness * 2;
  const innerH = h - frameThickness * 2;
  const inset = 0.07;
  const [hovered, setHovered] = useState(false);

  return (
    <group
      position={position}
      rotation={[0, rotY, 0]}
      onClick={
        onClick
          ? (event) => {
              event.stopPropagation();
              onClick();
            }
          : undefined
      }
      onPointerOver={() => {
        setHovered(true);
        if (onClick) document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        if (onClick) document.body.style.cursor = "auto";
      }}
    >
      {/* Sleek Titanium Frame */}
      <mesh position={[0, h / 2 - frameThickness / 2, frameCenterZ]} castShadow>
        <boxGeometry args={[w, frameThickness, frameDepth]} />
        <meshStandardMaterial color="#0f172a" roughness={0.2} metalness={0.9} />
      </mesh>
      <mesh position={[0, -h / 2 + frameThickness / 2, frameCenterZ]} castShadow>
        <boxGeometry args={[w, frameThickness, frameDepth]} />
        <meshStandardMaterial color="#0f172a" roughness={0.2} metalness={0.9} />
      </mesh>
      <mesh position={[-w / 2 + frameThickness / 2, 0, frameCenterZ]} castShadow>
        <boxGeometry args={[frameThickness, innerH, frameDepth]} />
        <meshStandardMaterial color="#0f172a" roughness={0.2} metalness={0.9} />
      </mesh>
      <mesh position={[w / 2 - frameThickness / 2, 0, frameCenterZ]} castShadow>
        <boxGeometry args={[frameThickness, innerH, frameDepth]} />
        <meshStandardMaterial color="#0f172a" roughness={0.2} metalness={0.9} />
      </mesh>

      {/* Cyber Neon Top & Bottom Rails (Matches Avatar Wall) */}
      <mesh position={[0, h / 2 + 0.005, frameCenterZ + 0.005]}>
        <boxGeometry args={[w + 0.02, 0.012, 0.012]} />
        <meshBasicMaterial color={hovered ? "#38bdf8" : "#00f0ff"} />
      </mesh>
      <mesh position={[0, -h / 2 - 0.005, frameCenterZ + 0.005]}>
        <boxGeometry args={[w + 0.02, 0.012, 0.012]} />
        <meshBasicMaterial color={hovered ? "#38bdf8" : "#00f0ff"} />
      </mesh>

      {/* Dark Obsidian Glass Surface */}
      <mesh position={[0, 0, backingZ]}>
        <boxGeometry args={[innerW, innerH, 0.015]} />
        <meshPhysicalMaterial
          color="#060c18"
          roughness={0.08}
          metalness={0.6}
          clearcoat={0.9}
          clearcoatRoughness={0.05}
        />
      </mesh>

      {/* Digital HUD Header */}
      <Text
        position={[0, innerH * 0.32, backingZ + 0.01]}
        fontSize={0.045}
        color="#38bdf8"
        anchorX="center"
        anchorY="middle"
        maxWidth={innerW - inset}
      >
        SYS // INTERACTIVE MEMO PAD
      </Text>

      {/* Glowing Digital Text */}
      {text ? (
        <Text
          position={[0, 0.02, backingZ + 0.01]}
          fontSize={0.11}
          color={hovered ? "#ffffff" : "#67e8f9"}
          anchorX="center"
          anchorY="middle"
          maxWidth={innerW - inset}
        >
          {text}
        </Text>
      ) : null}

      {/* Neon Digital Underline */}
      {text ? (
        <mesh position={[0, -0.1, backingZ + 0.01]}>
          <planeGeometry args={[Math.min(innerW - inset, text.length * 0.08), 0.008]} />
          <meshBasicMaterial color="#00f0ff" />
        </mesh>
      ) : null}

      {/* Sleek Digital Stylus Dock Bar */}
      <mesh position={[0, -h / 2 + 0.02, frameCenterZ + frameDepth / 2 + 0.015]} castShadow>
        <boxGeometry args={[innerW * 0.5, 0.018, 0.025]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh
        position={[0, -h / 2 + 0.02, frameCenterZ + frameDepth / 2 + 0.029]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.004, 0.004, innerW * 0.38, 12]} />
        <meshStandardMaterial color="#38bdf8" emissive="#00f0ff" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

const KANBAN_COLUMN_TITLES = ["To Do", "In Progress", "Done"];
const KANBAN_CARD_COLORS = ["#fbbf24", "#60a5fa", "#34d399", "#f472b6", "#a78bfa"];

/** Kanban Wall — a real recessed niche cut into the wall (not a flat
 * pinboard proud of the surface): a dark backing set back into the wall
 * thickness, a protruding frame lip around the opening, and three columns
 * of "cards" sitting at their own shallow offset in front of the backing —
 * from an oblique angle the frame, backing and cards read as three distinct
 * depths instead of one flat plane. */
function WallKanbanBoard({
  position,
  rotY = 0,
  w = 1.7,
  h = 1.05,
  onClick,
}: {
  position: [number, number, number];
  rotY?: number;
  w?: number;
  h?: number;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const frameThickness = 0.05;
  const backingZ = 0.02;
  const frameFrontZ = 0.14;
  const frameDepth = frameFrontZ - backingZ;
  const frameCenterZ = (backingZ + frameFrontZ) / 2;
  const cardZ = 0.065;
  const innerW = w - frameThickness * 2;
  const innerH = h - frameThickness * 2;
  const columnWidth = innerW / 3;

  return (
    <group
      position={position}
      rotation={[0, rotY, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      {/* Recessed dark backing, set back into the wall. */}
      <mesh position={[0, 0, backingZ]} receiveShadow>
        <boxGeometry args={[innerW, innerH, 0.015]} />
        <meshStandardMaterial color="#1b2130" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Frame lip with interactive cyan glow on hover */}
      <mesh position={[0, h / 2 - frameThickness / 2, frameCenterZ]} castShadow>
        <boxGeometry args={[w, frameThickness, frameDepth]} />
        <meshStandardMaterial
          color={hovered ? "#00f0ff" : "#c7cad0"}
          emissive={hovered ? "#00f0ff" : "#000000"}
          emissiveIntensity={hovered ? 0.7 : 0}
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>
      <mesh position={[0, -h / 2 + frameThickness / 2, frameCenterZ]} castShadow>
        <boxGeometry args={[w, frameThickness, frameDepth]} />
        <meshStandardMaterial
          color={hovered ? "#00f0ff" : "#c7cad0"}
          emissive={hovered ? "#00f0ff" : "#000000"}
          emissiveIntensity={hovered ? 0.7 : 0}
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>
      <mesh position={[-w / 2 + frameThickness / 2, 0, frameCenterZ]} castShadow>
        <boxGeometry args={[frameThickness, innerH, frameDepth]} />
        <meshStandardMaterial
          color={hovered ? "#00f0ff" : "#c7cad0"}
          emissive={hovered ? "#00f0ff" : "#000000"}
          emissiveIntensity={hovered ? 0.7 : 0}
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>
      <mesh position={[w / 2 - frameThickness / 2, 0, frameCenterZ]} castShadow>
        <boxGeometry args={[frameThickness, innerH, frameDepth]} />
        <meshStandardMaterial
          color={hovered ? "#00f0ff" : "#c7cad0"}
          emissive={hovered ? "#00f0ff" : "#000000"}
          emissiveIntensity={hovered ? 0.7 : 0}
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>

      {/* Interactive Hover Glow Banner */}
      {hovered ? (
        <group position={[0, -h / 2 - 0.12, frameFrontZ + 0.02]}>
          <mesh>
            <planeGeometry args={[1.3, 0.15]} />
            <meshBasicMaterial color="#030712" transparent opacity={0.88} />
          </mesh>
          <Text fontSize={0.055} color="#00f0ff" anchorX="center" anchorY="middle">
            Kanban Board öffnen [Klick]
          </Text>
        </group>
      ) : null}
      {/* Thin column dividers on the backing. */}
      {[1, 2].map((index) => (
        <mesh
          key={`kanban-divider-${index}`}
          position={[-innerW / 2 + columnWidth * index, 0, backingZ + 0.01]}
        >
          <boxGeometry args={[0.006, innerH * 0.92, 0.008]} />
          <meshStandardMaterial color="#3a4258" roughness={0.7} />
        </mesh>
      ))}
      {KANBAN_COLUMN_TITLES.map((title, columnIndex) => {
        const columnCenterX = -innerW / 2 + columnWidth * (columnIndex + 0.5);
        const columnTasks = [
          [
            { title: "Stand-up Ablauf", tag: "Gemini", color: "#eab308", done: false },
            { title: "Multimodal Pipeline", tag: "ChatGPT", color: "#2563eb", done: false },
          ],
          [
            { title: "3D Orbital Bridge", tag: "Claude", color: "#06b6d4", done: false },
            { title: "Audio Sync OK", tag: "Hermes", color: "#3b82f6", done: false },
          ],
          [
            { title: "Council Strategie", tag: "Hermes", color: "#10b981", done: true },
            { title: "LifeOS Routing", tag: "Core", color: "#10b981", done: true },
          ],
        ][columnIndex] ?? [];

        return (
          <group key={title}>
            <Text
              position={[columnCenterX, innerH / 2 - 0.055, cardZ + 0.005]}
              fontSize={0.046}
              color="#38bdf8"
              anchorX="center"
              anchorY="middle"
              maxWidth={columnWidth - 0.06}
            >
              {title}
            </Text>
            {columnTasks.map((task, cardIndex) => (
              <group
                key={`kanban-card-${columnIndex}-${cardIndex}`}
                position={[
                  columnCenterX,
                  innerH / 2 - 0.17 - cardIndex * 0.15,
                  cardZ + cardIndex * 0.006,
                ]}
              >
                <mesh castShadow>
                  <boxGeometry args={[columnWidth - 0.07, 0.11, 0.008]} />
                  <meshStandardMaterial
                    color={task.done ? "#091712" : "#0a1320"}
                    roughness={0.4}
                    metalness={0.6}
                  />
                </mesh>
                <mesh position={[-(columnWidth - 0.07) / 2 + 0.006, 0, 0.005]}>
                  <boxGeometry args={[0.012, 0.09, 0.004]} />
                  <meshBasicMaterial color={task.color} />
                </mesh>
                <Text
                  position={[-(columnWidth - 0.07) / 2 + 0.022, 0.018, 0.007]}
                  fontSize={0.034}
                  color="#f8fafc"
                  anchorX="left"
                  anchorY="middle"
                  maxWidth={columnWidth - 0.12}
                >
                  {task.title}
                </Text>
                <Text
                  position={[-(columnWidth - 0.07) / 2 + 0.022, -0.024, 0.007]}
                  fontSize={0.026}
                  color={task.done ? "#34d399" : "#94a3b8"}
                  anchorX="left"
                  anchorY="middle"
                >
                  {task.done ? "✓ Fertig" : `// ${task.tag}`}
                </Text>
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
}

/** Live-animated screen content — a canvas redrawn every frame (scrolling
 * waveform + scanline flicker), not a flat emissive color, so the mounted
 * screen reads as an actual digital display playing something instead of a
 * painted panel. */
function useAnimatedScreenTexture(workingCount: number) {
  const canvas = useMemo(() => {
    const element = document.createElement("canvas");
    element.width = 256;
    element.height = 144;
    return element;
  }, []);
  const texture = useMemo(() => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [canvas]);
  // Refs are only ever touched inside effects/useFrame below, never during
  // render — `texture` itself can't be mutated later (it's a value a hook
  // returned), so animation goes through this ref instead.
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    textureRef.current = texture;
  }, [texture]);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  useEffect(() => {
    ctxRef.current = canvas.getContext("2d");
  }, [canvas]);

  const lastUpdateRef = useRef(0);
  const lastSampleRef = useRef(0);
  /**
   * One sample per second of how many agents were working, oldest first.
   *
   * This screen used to draw two out-of-phase sine waves. They looked exactly
   * like a monitoring dashboard and reported nothing at all — the definition
   * of a display that costs attention and returns none. The waveform is the
   * same shape now; it just says something.
   */
  const historyRef = useRef<number[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (t - lastSampleRef.current >= 1) {
      lastSampleRef.current = t;
      const history = historyRef.current;
      history.push(workingCount);
      // 64 samples across 256 px: about a minute of history at 4 px each.
      if (history.length > 64) history.shift();
    }

    if (t - lastUpdateRef.current < 0.1) return;
    lastUpdateRef.current = t;
    const ctx = ctxRef.current;
    if (!ctx) return;

    const history = historyRef.current;
    const peak = Math.max(1, ...history);

    ctx.fillStyle = "#0a1820";
    ctx.fillRect(0, 0, 256, 144);

    ctx.strokeStyle = "rgba(143, 212, 236, 0.12)";
    ctx.lineWidth = 1;
    for (let x = 0; x < 256; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 144);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(143, 212, 236, 0.75)";
    ctx.font = "bold 11px monospace";
    ctx.fillText("AGENTEN AKTIV", 8, 16);
    ctx.fillStyle = "#e6f7ff";
    ctx.font = "bold 30px monospace";
    ctx.fillText(String(workingCount), 8, 46);
    ctx.fillStyle = "rgba(143, 212, 236, 0.45)";
    ctx.font = "9px monospace";
    ctx.fillText(`SPITZE ${peak} · LETZTE MINUTE`, 8, 60);

    if (history.length < 2) {
      // Honest empty state: a flat line here would read as "zero activity
      // measured", which is a different claim from "not measured yet".
      ctx.fillStyle = "rgba(143, 212, 236, 0.35)";
      ctx.font = "10px monospace";
      ctx.fillText("… sammelt Verlauf", 8, 110);
    } else {
      const stepX = 256 / 63;
      const baseY = 132;
      const spanY = 58;
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#4fd6a8";
      ctx.beginPath();
      history.forEach((value, index) => {
        const x = index * stepX;
        const y = baseY - (value / peak) * spanY;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Fill under the curve so the shape reads at a glance from the far wall.
      ctx.lineTo((history.length - 1) * stepX, baseY);
      ctx.lineTo(0, baseY);
      ctx.closePath();
      ctx.fillStyle = "rgba(79, 214, 168, 0.16)";
      ctx.fill();
    }

    if (textureRef.current) textureRef.current.needsUpdate = true;
  });

  return texture;
}

type AvatarWallItem = {
  id: string;
  name: string;
  role: string;
  color: string;
  status: string;
};

const AVATAR_WALL_DEFAULTS: AvatarWallItem[] = [
  { id: "hermes", name: "Hermes", role: "Chief AI Officer (Boss)", color: "#f59e0b", status: "Active" },
  { id: "claude", name: "Claude", role: "System & Architecture", color: "#ea580c", status: "Linked" },
  { id: "gemini", name: "Gemini", role: "Deep Research", color: "#eab308", status: "Active" },
  { id: "chatgpt", name: "ChatGPT", role: "Logic & Execution", color: "#2563eb", status: "Ready" },
];

/**
 * Futuristic Interactive Hologram Avatar Screen Wall
 */
function useAvatarScreenTexture({
  hoveredIndex,
  clickEffect,
  screenMode = "avatars",
  agentsList,
}: {
  hoveredIndex: number | null;
  clickEffect: { index: number; time: number } | null;
  screenMode?: "avatars" | "telemetry" | "lifeos";
  agentsList: AvatarWallItem[];
}) {
  const canvas = useMemo(() => {
    const el = document.createElement("canvas");
    el.width = 2048;
    el.height = 512;
    return el;
  }, []);

  const texture = useMemo(() => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.anisotropy = 16;
    return tex;
  }, [canvas]);

  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  useEffect(() => {
    ctxRef.current = canvas.getContext("2d");
  }, [canvas]);

  const lastUpdateRef = useRef(0);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (t - lastUpdateRef.current < 0.016) return; // Smooth 60 FPS update
    lastUpdateRef.current = t;

    const ctx = ctxRef.current;
    if (!ctx) return;
    const W = 2048;
    const H = 512;

    ctx.clearRect(0, 0, W, H);

    // 1. Semi-translucent cyber backing
    ctx.fillStyle = "rgba(4, 12, 28, 0.45)";
    ctx.fillRect(0, 0, W, H);

    // 2. Subtle sci-fi grid lines
    ctx.strokeStyle = "rgba(0, 240, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 64) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = 0; y <= H; y += 64) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();

    // 3. Top Cyber Navigation Bar & Title
    ctx.fillStyle = "rgba(0, 240, 255, 0.95)";
    ctx.font = "bold 20px monospace";
    ctx.fillText("HERMES ORBITAL COUNCIL // AVATAR MATRIX", 60, 42);

    // Mode Buttons in Top-Right
    const modes = [
      { key: "avatars", label: "01 AVATARS" },
      { key: "telemetry", label: "02 TELEMETRY" },
      { key: "lifeos", label: "03 LIFEOS" },
    ];
    modes.forEach((m, idx) => {
      const bx = W - 520 + idx * 150;
      const by = 20;
      const isCur = screenMode === m.key;
      ctx.fillStyle = isCur ? "rgba(0, 240, 255, 0.28)" : "rgba(10, 25, 50, 0.5)";
      ctx.fillRect(bx, by, 140, 30);
      ctx.strokeStyle = isCur ? "#00f0ff" : "rgba(0, 240, 255, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, 140, 30);
      ctx.fillStyle = isCur ? "#ffffff" : "rgba(180, 210, 240, 0.7)";
      ctx.font = "bold 13px monospace";
      ctx.fillText(m.label, bx + 18, by + 20);
    });

    // 4. Subtle Animated Scanline Sweep
    const scanY = ((t * 90) % (H + 80)) - 40;
    const scanGrad = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 10);
    scanGrad.addColorStop(0, "rgba(0, 240, 255, 0)");
    scanGrad.addColorStop(0.5, "rgba(0, 240, 255, 0.08)");
    scanGrad.addColorStop(1, "rgba(0, 240, 255, 0)");
    ctx.fillStyle = scanGrad;
    ctx.fillRect(0, scanY - 30, W, 40);

    // 5. Draw the 4 Avatar Station Pods
    const bayW = (W - 120) / 4;
    agentsList.forEach((agent, i) => {
      const bayX = 60 + i * bayW;
      const isHovered = hoveredIndex === i;
      const color = agent.color;

      // Bay Container Frame
      ctx.save();
      if (isHovered) {
        ctx.fillStyle = "rgba(0, 240, 255, 0.16)";
        ctx.fillRect(bayX + 8, 70, bayW - 16, H - 95);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
      } else {
        ctx.fillStyle = "rgba(10, 22, 44, 0.25)";
        ctx.fillRect(bayX + 8, 70, bayW - 16, H - 95);
        ctx.strokeStyle = "rgba(0, 240, 255, 0.22)";
        ctx.lineWidth = 1.5;
      }

      // Rounded container outline
      ctx.strokeRect(bayX + 8, 70, bayW - 16, H - 95);

      // Sci-fi corner brackets
      const bLeft = bayX + 8;
      const bRight = bayX + bayW - 8;
      const bTop = 70;
      const bBot = H - 25;
      const cLen = 16;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bLeft, bTop + cLen); ctx.lineTo(bLeft, bTop); ctx.lineTo(bLeft + cLen, bTop);
      ctx.moveTo(bRight - cLen, bTop); ctx.lineTo(bRight, bTop); ctx.lineTo(bRight, bTop + cLen);
      ctx.moveTo(bLeft, bBot - cLen); ctx.lineTo(bLeft, bBot); ctx.lineTo(bLeft + cLen, bBot);
      ctx.moveTo(bRight - cLen, bBot); ctx.lineTo(bRight, bBot); ctx.lineTo(bRight, bBot - cLen);
      ctx.stroke();

      // Avatar Hologram Portal
      const cx = bayX + bayW / 2;
      const cy = 190;
      const r = isHovered ? 64 : 56;

      const radGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, r + 20);
      radGrad.addColorStop(0, color);
      radGrad.addColorStop(0.6, "rgba(0, 240, 255, 0.15)");
      radGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 20, 0, Math.PI * 2);
      ctx.fill();

      // Rotating portal ring 1
      ctx.strokeStyle = color;
      ctx.lineWidth = isHovered ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, t * 1.2, t * 1.2 + Math.PI * 1.4);
      ctx.stroke();

      // Rotating portal ring 2 (counter-rotation)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 6, -t * 0.9, -t * 0.9 + Math.PI * 0.9);
      ctx.stroke();

      // Avatar Initial / Hologram Silhouette
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${isHovered ? "42px" : "36px"} monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(agent.name.charAt(0).toUpperCase(), cx, cy);

      // Name & Role labels
      ctx.fillStyle = isHovered ? "#ffffff" : "#00f0ff";
      ctx.font = "bold 24px monospace";
      ctx.fillText(agent.name.toUpperCase(), cx, 300);

      ctx.fillStyle = "rgba(180, 210, 240, 0.85)";
      ctx.font = "14px monospace";
      ctx.fillText(agent.role, cx, 328);

      // Status pill badge
      const statusPillW = 120;
      const statusPillH = 24;
      const spX = cx - statusPillW / 2;
      const spY = 356;
      ctx.fillStyle = "rgba(0, 240, 255, 0.15)";
      ctx.fillRect(spX, spY, statusPillW, statusPillH);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(spX, spY, statusPillW, statusPillH);

      // Status blinking LED dot
      const isDotOn = Math.sin(t * 4 + i) > -0.2;
      ctx.fillStyle = isDotOn ? color : "rgba(100, 100, 100, 0.5)";
      ctx.beginPath();
      ctx.arc(spX + 16, spY + statusPillH / 2, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(agent.status.toUpperCase(), spX + 28, spY + 16);

      // Bottom interactive action button: "SELECT / CHAT"
      const btnW = bayW - 48;
      const btnH = 34;
      const btnX = bayX + 24;
      const btnY = 410;
      ctx.fillStyle = isHovered ? color : "rgba(0, 240, 255, 0.12)";
      ctx.fillRect(btnX, btnY, btnW, btnH);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(btnX, btnY, btnW, btnH);

      ctx.fillStyle = isHovered ? "#000000" : "#ffffff";
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "center";
      ctx.fillText(isHovered ? "▶ ANSPRECHEN" : "STATUS ONLINE", cx, btnY + 22);

      // Click Ripple / Shockwave Effect
      if (clickEffect && clickEffect.index === i) {
        const dt = t - clickEffect.time;
        if (dt >= 0 && dt < 0.6) {
          const progress = dt / 0.6;
          const waveR = r + progress * 80;
          ctx.strokeStyle = `rgba(0, 240, 255, ${1 - progress})`;
          ctx.lineWidth = 3 * (1 - progress);
          ctx.beginPath();
          ctx.arc(cx, cy, waveR, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.restore();
    });

    texture.needsUpdate = true;
  });

  return texture;
}

/**
 * Interactive futuristic Hologram Avatar Screen Wall projected on the glass wall.
 */
function GlassAvatarScreenProjection({
  length,
  glassHeight,
  axis,
  onSelectAgent,
}: {
  length: number;
  glassHeight: number;
  axis: "x" | "z";
  onSelectAgent?: (agentId: string) => void;
}) {
  const { state: agentStore } = useAgentStore();
  const agentsList = useMemo<AvatarWallItem[]>(() => {
    const raw = agentStore?.agents ?? [];
    return AVATAR_WALL_DEFAULTS.map((def, i) => {
      const live =
        raw.find((a) => a.agentId?.toLowerCase() === def.id || a.name?.toLowerCase().includes(def.id)) ||
        raw[i];
      if (!live) return def;
      return {
        id: live.agentId || def.id,
        name: live.name || def.name,
        role: live.role || def.role,
        color: def.color,
        status: live.status === "running" ? "Processing" : def.status,
      };
    });
  }, [agentStore?.agents]);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [clickEffect, setClickEffect] = useState<{ index: number; time: number } | null>(null);
  const [screenMode, setScreenMode] = useState<"avatars" | "telemetry" | "lifeos">("avatars");
  const texture = useAvatarScreenTexture({ hoveredIndex, clickEffect, screenMode, agentsList });
  const rotY = axis === "z" ? Math.PI / 2 : 0;

  return (
    <mesh
      rotation={[0, rotY, 0]}
      renderOrder={5}
      onPointerMove={(e) => {
        if (!e.uv) return;
        const normalizedX = axis === "z" ? 1 - e.uv.x : e.uv.x;
        const normalizedY = e.uv.y;
        if (normalizedY > 0.85 && normalizedX > 0.65) {
          // Hovering mode switcher
          setHoveredIndex(99);
          if (typeof document !== "undefined") document.body.style.cursor = "pointer";
        } else {
          const idx = Math.min(agentsList.length - 1, Math.max(0, Math.floor(normalizedX * agentsList.length)));
          if (hoveredIndex !== idx) {
            cyberAudio.playBlip();
          }
          setHoveredIndex(idx);
          if (typeof document !== "undefined") document.body.style.cursor = "pointer";
        }
      }}
      onPointerOut={() => {
        setHoveredIndex(null);
        if (typeof document !== "undefined") document.body.style.cursor = "auto";
      }}
      onClick={(e) => {
        if (!e.uv) return;
        const normalizedX = axis === "z" ? 1 - e.uv.x : e.uv.x;
        const normalizedY = e.uv.y;

        // Top right mode tab click
        if (normalizedY > 0.85 && normalizedX > 0.65) {
          cyberAudio.playBlip();
          if (normalizedX < 0.77) setScreenMode("avatars");
          else if (normalizedX < 0.89) setScreenMode("telemetry");
          else setScreenMode("lifeos");
          return;
        }

        const idx = Math.min(agentsList.length - 1, Math.max(0, Math.floor(normalizedX * agentsList.length)));
        setClickEffect({ index: idx, time: performance.now() / 1000 });
        cyberAudio.playChime();

        const targetAgent = agentsList[idx];
        if (targetAgent && onSelectAgent) {
          onSelectAgent(targetAgent.id);
        }
      }}
    >
      <planeGeometry args={[length * 0.99, glassHeight * 0.96]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.92}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** Wall-mounted council screen — recessed the same way as the Kanban Wall
 * floor base/support poles, per the "TV soll in der Wand sein" request.
 * `topic`/content rendering matches the previous freestanding KnowledgeScreen
 * in meetingRoomFixtures.tsx; this is the fixture's home now. */
function WallCouncilScreen({
  position,
  rotY = 0,
  w = 1.9,
  h = 1.05,
  topic,
  onClick,
  workingCount = 0,
}: {
  position: [number, number, number];
  rotY?: number;
  w?: number;
  h?: number;
  topic: string | null;
  onClick?: () => void;
  /** Live count driving the wall sparkline. */
  workingCount?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const frameThickness = 0.045;
  const backingZ = 0.02;
  const frameFrontZ = 0.14;
  const frameDepth = frameFrontZ - backingZ;
  const frameCenterZ = (backingZ + frameFrontZ) / 2;
  const innerW = w - frameThickness * 2;
  const innerH = h - frameThickness * 2;
  const screenTexture = useAnimatedScreenTexture(workingCount);

  return (
    <group
      position={position}
      rotation={[0, rotY, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <mesh position={[0, 0, backingZ]}>
        <boxGeometry args={[innerW, innerH, 0.015]} />
        <meshStandardMaterial
          color="#0c1a22"
          emissiveMap={screenTexture}
          emissive="#ffffff"
          emissiveIntensity={hovered ? 1.3 : 0.85}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, h / 2 - frameThickness / 2, frameCenterZ]} castShadow>
        <boxGeometry args={[w, frameThickness, frameDepth]} />
        <meshStandardMaterial
          color={hovered ? "#a855f7" : "#101114"}
          emissive={hovered ? "#a855f7" : "#000000"}
          emissiveIntensity={hovered ? 0.75 : 0}
          roughness={0.5}
          metalness={0.3}
        />
      </mesh>
      <mesh position={[0, -h / 2 + frameThickness / 2, frameCenterZ]} castShadow>
        <boxGeometry args={[w, frameThickness, frameDepth]} />
        <meshStandardMaterial
          color={hovered ? "#a855f7" : "#101114"}
          emissive={hovered ? "#a855f7" : "#000000"}
          emissiveIntensity={hovered ? 0.75 : 0}
          roughness={0.5}
          metalness={0.3}
        />
      </mesh>
      <mesh position={[-w / 2 + frameThickness / 2, 0, frameCenterZ]} castShadow>
        <boxGeometry args={[frameThickness, innerH, frameDepth]} />
        <meshStandardMaterial
          color={hovered ? "#a855f7" : "#101114"}
          emissive={hovered ? "#a855f7" : "#000000"}
          emissiveIntensity={hovered ? 0.75 : 0}
          roughness={0.5}
          metalness={0.3}
        />
      </mesh>
      <mesh position={[w / 2 - frameThickness / 2, 0, frameCenterZ]} castShadow>
        <boxGeometry args={[frameThickness, innerH, frameDepth]} />
        <meshStandardMaterial
          color={hovered ? "#a855f7" : "#101114"}
          emissive={hovered ? "#a855f7" : "#000000"}
          emissiveIntensity={hovered ? 0.75 : 0}
          roughness={0.5}
          metalness={0.3}
        />
      </mesh>

      {/* Interactive Hover Glow Banner */}
      {hovered ? (
        <group position={[0, -h / 2 - 0.12, frameFrontZ + 0.02]}>
          <mesh>
            <planeGeometry args={[1.6, 0.15]} />
            <meshBasicMaterial color="#030712" transparent opacity={0.88} />
          </mesh>
          <Text fontSize={0.055} color="#c084fc" anchorX="center" anchorY="middle">
            Council Telemetrie & Diagramm [Klick]
          </Text>
        </group>
      ) : null}

      <Text
        position={[0, innerH * 0.22, backingZ + 0.01]}
        fontSize={0.075}
        color="#8fd4ec"
        anchorX="center"
        anchorY="middle"
        maxWidth={innerW * 0.9}
      >
        Council
      </Text>
      <Text
        position={[0, -innerH * 0.1, backingZ + 0.01]}
        fontSize={0.052}
        color="#cfeaf4"
        anchorX="center"
        anchorY="middle"
        maxWidth={innerW * 0.9}
      >
        {topic || "Kein aktives Thema."}
      </Text>
    </group>
  );
}

function UsaFlagArt() {
  const flagWidth = 0.52;
  const flagHeight = 0.3;
  const stripeHeight = flagHeight / 13;
  const cantonWidth = flagWidth * 0.4;
  const cantonHeight = stripeHeight * 7;

  return (
    <>
      {Array.from({ length: 13 }).map((_, index) => (
        <mesh
          key={`usa-stripe-${index}`}
          position={[0, flagHeight / 2 - stripeHeight / 2 - index * stripeHeight, 0]}
        >
          <planeGeometry args={[flagWidth, stripeHeight]} />
          <meshBasicMaterial
            color={index % 2 === 0 ? "#b22234" : "#ffffff"}
            side={2}
          />
        </mesh>
      ))}
      <mesh
        position={[
          -flagWidth / 2 + cantonWidth / 2,
          flagHeight / 2 - cantonHeight / 2,
          0.001,
        ]}
      >
        <planeGeometry args={[cantonWidth, cantonHeight]} />
        <meshBasicMaterial color="#3c3b6e" side={2} />
      </mesh>
      {Array.from({ length: 5 }).map((_, row) =>
        Array.from({ length: 6 }).map((__, column) => (
          <mesh
            key={`usa-star-${row}-${column}`}
            position={[
              -flagWidth / 2 + 0.04 + column * 0.025,
              flagHeight / 2 - 0.03 - row * 0.035,
              0.002,
            ]}
          >
            <circleGeometry args={[0.0045, 6]} />
            <meshBasicMaterial color="#ffffff" side={2} />
          </mesh>
        )),
      )}
    </>
  );
}

function BrazilFlagArt() {
  return (
    <>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[0.52, 0.3]} />
        <meshBasicMaterial color="#009b3a" side={2} />
      </mesh>
      <mesh position={[0, 0, 0.001]} rotation={[0, 0, Math.PI / 4]}>
        <planeGeometry args={[0.25, 0.25]} />
        <meshBasicMaterial color="#ffdf00" side={2} />
      </mesh>
      <mesh position={[0, 0, 0.002]}>
        <circleGeometry args={[0.068, 28]} />
        <meshBasicMaterial color="#002776" side={2} />
      </mesh>
      <mesh position={[0, 0.004, 0.003]} rotation={[0, 0, -0.22]}>
        <planeGeometry args={[0.19, 0.026]} />
        <meshBasicMaterial color="#ffffff" side={2} />
      </mesh>
    </>
  );
}

function OfficeFlagPole({
  position,
  rotY = 0,
  art,
}: {
  position: [number, number, number];
  rotY?: number;
  art: ReactNode;
}) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[0.22, 0.28, 0.16, 18]} />
        <meshStandardMaterial color="#3a3229" roughness={0.94} metalness={0.08} />
      </mesh>
      <mesh position={[0, 1.32, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.024, 0.03, 2.48, 14]} />
        <meshStandardMaterial color="#c4c9d1" roughness={0.32} metalness={0.88} />
      </mesh>
      <mesh position={[0, 2.6, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#d4af37" roughness={0.28} metalness={0.92} />
      </mesh>
      <mesh position={[0.3, 2.34, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.62, 10]} />
        <meshStandardMaterial color="#c4c9d1" roughness={0.32} metalness={0.88} />
      </mesh>
      <group position={[0.42, 2.16, 0.02]} scale={[1.9, 1.9, 1.9]}>
        {art}
      </group>
    </group>
  );
}

// One perimeter wall: a solid plaster wall with a thin dark cap trim on top.
// Roughly 1.7 units tall overall so the walls read taller than agents (~1.0)
// and tall furniture such as the fridge (~1.4). The x/z footprint still
// matches the old 1-unit tall box exactly so navigation and tests are
// unaffected. `glass`: renders a low opaque sill (kept solid so a chair or
// High-tech Cyber Command Perimeter Wall:
// North wall: Dark titanium acoustic cyber panels with glowing LED tracks and an upper panoramic space window viewing the deep cosmos.
// West wall: Full-height tinted glass avatar screen projecting the live telemetry HUD into space.
function PerimeterWall({
  center,
  length,
  axis,
  glass = false,
  onSelectAgent,
}: {
  center: [number, number];
  length: number;
  axis: "x" | "z";
  glass?: boolean;
  onSelectAgent?: (agentId: string) => void;
}) {
  const thickness = 0.26;
  const wallHeight = 2.6;
  const capHeight = 0.05;

  // North wall has a panoramic upper cosmos viewport between y=2.05 and y=2.6
  const isNorthWall = axis === "x";
  const sillHeight = glass ? 0.35 : isNorthWall ? 2.05 : wallHeight;
  const glassHeight = wallHeight - sillHeight;

  const dims = (
    along: number,
    height: number,
    across: number,
  ): [number, number, number] =>
    axis === "x" ? [along, height, across] : [across, height, along];

  return (
    <group position={[center[0], 0, center[1]]}>
      {/* Lower Solid Cyber Wall Section */}
      <mesh position={[0, sillHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={dims(length, sillHeight, thickness)} />
        <meshStandardMaterial
          color={isNorthWall ? "#090e1a" : "#0a0f1d"}
          roughness={0.22}
          metalness={0.88}
        />
      </mesh>

      {/* Cyber LED Accent Tracks along the wall */}
      {isNorthWall ? (
        <>
          {/* Bottom Cyan Ground Rail */}
          <mesh position={[0, 0.03, thickness / 2 + 0.005]}>
            <boxGeometry args={[length * 0.99, 0.015, 0.012]} />
            <meshBasicMaterial color="#00f0ff" />
          </mesh>
          {/* Middle Purple LED Accent Rail under the panoramic window */}
          <mesh position={[0, sillHeight - 0.02, thickness / 2 + 0.005]}>
            <boxGeometry args={[length * 0.99, 0.018, 0.012]} />
            <meshBasicMaterial color="#a855f7" />
          </mesh>
          {/* Vertical Architectural Seams */}
          {[-length * 0.35, -length * 0.12, length * 0.12, length * 0.35].map((xPos, idx) => (
            <mesh key={`north-seam-${idx}`} position={[xPos, sillHeight / 2, thickness / 2 + 0.003]}>
              <boxGeometry args={[0.015, sillHeight, 0.008]} />
              <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
            </mesh>
          ))}
        </>
      ) : null}

      {/* Panoramic Upper Cosmos Window (North Wall) or Full Glazing (West Wall) */}
      {glass || isNorthWall ? (
        <mesh position={[0, sillHeight + glassHeight / 2, 0]} receiveShadow>
          <boxGeometry args={dims(length, glassHeight, thickness * 0.45)} />
          <meshStandardMaterial
            color="#051428"
            transparent
            opacity={glass ? 0.4 : 0.28}
            roughness={0.12}
            metalness={0.85}
            emissive="#001830"
            emissiveIntensity={0.2}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}

      {/* West Wall HUD Screen Projections */}
      {glass ? (
        <group position={[axis === "z" ? 0.12 : 0, sillHeight + glassHeight / 2, axis === "x" ? 0.12 : 0]}>
          <GlassAvatarScreenProjection length={length} glassHeight={glassHeight} axis={axis} onSelectAgent={onSelectAgent} />
          {/* Glowing neon top & bottom frame rails */}
          <mesh position={[0, glassHeight / 2 - 0.02, 0]}>
            <boxGeometry args={dims(length * 0.98, 0.03, 0.03)} />
            <meshBasicMaterial color="#00f0ff" />
          </mesh>
          <mesh position={[0, -glassHeight / 2 + 0.02, 0]}>
            <boxGeometry args={dims(length * 0.98, 0.03, 0.03)} />
            <meshBasicMaterial color="#00f0ff" />
          </mesh>
        </group>
      ) : null}

      {/* Top Titanium Trim Cap */}
      <mesh position={[0, wallHeight + capHeight / 2, 0]} castShadow>
        <boxGeometry args={dims(length, capHeight, thickness + 0.02)} />
        <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.9} />
      </mesh>
      {/* Top Cyan Architectural Ceiling Line */}
      <mesh position={[0, wallHeight + 0.01, isNorthWall ? thickness / 2 + 0.01 : 0]}>
        <boxGeometry args={dims(length * 0.99, 0.015, 0.015)} />
        <meshBasicMaterial color="#00f0ff" />
      </mesh>
    </group>
  );
}

// Layered foliage clumps sitting on top of a planter box: slightly offset
// flattened spheres in varied greens instead of a flat green slab.
function PlanterFoliage({
  position,
  spread = 1,
}: {
  position: [number, number, number];
  spread?: number;
}) {
  const clumps: {
    offset: [number, number, number];
    scale: [number, number, number];
    color: string;
  }[] = [
    { offset: [-0.14 * spread, 0, 0.015], scale: [0.13, 0.06, 0.075], color: "#4e7a2f" },
    { offset: [0.02 * spread, 0.012, -0.02], scale: [0.15, 0.07, 0.085], color: "#5f8f38" },
    { offset: [0.15 * spread, 0.004, 0.02], scale: [0.12, 0.055, 0.07], color: "#6da345" },
  ];
  return (
    <group position={position}>
      {clumps.map((clump, index) => (
        <mesh
          key={`foliage-${index}`}
          position={clump.offset}
          scale={clump.scale}
          castShadow
        >
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color={clump.color} roughness={0.98} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Abgespacter Hologram-Kronleuchter mit dynamischem chromatischen Farbenspiel,
 * zwei gegenläufig rotierenden Ringen, schwebendem Quanten-Kristall,
 * pulsierender Lichtsäule und wirbelndem bunten Sternenstaub.
 */
function CouncilChandelier({ position }: { position: [number, number, number] }) {
  const outerRadius = 1.18;
  const innerRadius = 0.92;
  const particleCount = 180;

  const outerGroupRef = useRef<THREE.Group>(null);
  const innerGroupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const outerMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const innerMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const beamMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  // Generate multi-colored swirling stardust
  const [positions, colors, particleData] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const cols = new Float32Array(particleCount * 3);
    const pData: Array<{ speed: number; angle: number; radius: number; rotSpeed: number }> = [];

    const palette = [
      new THREE.Color("#00f0ff"), // Cyan
      new THREE.Color("#a855f7"), // Violett
      new THREE.Color("#ec4899"), // Hot Pink
      new THREE.Color("#38bdf8"), // Sky Blue
      new THREE.Color("#fbbf24"), // Gold
      new THREE.Color("#ffffff"), // Pure White
    ];

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 0.2 + Math.sqrt(Math.random()) * (outerRadius * 0.85);
      const y = -Math.random() * 2.1;

      pos[i * 3] = Math.cos(angle) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(angle) * r;

      const c = palette[Math.floor(Math.random() * palette.length)];
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;

      pData.push({
        speed: 0.22 + Math.random() * 0.45,
        angle,
        radius: r,
        rotSpeed: (Math.random() - 0.5) * 1.6,
      });
    }
    return [pos, cols, pData];
  }, [outerRadius]);

  useFrame(({ clock }, delta) => {
    const time = clock.getElapsedTime();

    // 1. Counter-rotation of energy rings
    if (outerGroupRef.current) outerGroupRef.current.rotation.y += delta * 0.35;
    if (innerGroupRef.current) innerGroupRef.current.rotation.y -= delta * 0.55;

    // 2. Quantum core spin and hover
    if (coreRef.current) {
      coreRef.current.rotation.x += delta * 0.8;
      coreRef.current.rotation.y += delta * 1.2;
      coreRef.current.position.y = Math.sin(time * 2.5) * 0.04;
    }

    // 3. Dynamic Chromatic Color Cycling (Farbenspiel)
    const hueOuter = (time * 0.09) % 1;
    const hueInner = (time * 0.09 + 0.38) % 1;
    const colorOuter = new THREE.Color().setHSL(hueOuter, 0.95, 0.6);
    const colorInner = new THREE.Color().setHSL(hueInner, 0.95, 0.6);

    if (outerMatRef.current) outerMatRef.current.color.copy(colorOuter);
    if (innerMatRef.current) innerMatRef.current.color.copy(colorInner);
    if (beamMatRef.current) beamMatRef.current.color.copy(colorOuter);
    if (lightRef.current) lightRef.current.color.copy(colorOuter);

    // 4. Undulating wave on beam
    if (beamRef.current) {
      const breath = 1 + Math.sin(time * 3.2) * 0.05;
      beamRef.current.scale.set(breath, 1, breath);
    }

    // 5. Helical vortex swirl of stardust (GPU accelerated)
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.45;
      pointsRef.current.position.y = Math.sin(time * 2.2) * 0.03;
    }
  });

  return (
    <group position={position}>
      {/* Outer Rotating Energy Ring (Cyan/Prism) */}
      <group ref={outerGroupRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[outerRadius, 0.022, 16, 64]} />
          <meshStandardMaterial color="#0f172a" roughness={0.15} metalness={0.95} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[outerRadius, 0.013, 16, 64]} />
          <meshBasicMaterial ref={outerMatRef} color="#00f0ff" />
        </mesh>
        {/* Outer Ring Tech Notches */}
        {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((ang, i) => (
          <mesh
            key={`outer-notch-${i}`}
            position={[Math.cos(ang) * outerRadius, 0, Math.sin(ang) * outerRadius]}
          >
            <boxGeometry args={[0.06, 0.04, 0.06]} />
            <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
          </mesh>
        ))}
      </group>

      {/* Inner Counter-Rotating Ring (Violett/Magenta) */}
      <group ref={innerGroupRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[innerRadius, 0.018, 16, 48]} />
          <meshStandardMaterial color="#1e1b4b" roughness={0.2} metalness={0.9} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[innerRadius, 0.011, 16, 48]} />
          <meshBasicMaterial ref={innerMatRef} color="#a855f7" />
        </mesh>
        {/* Inner Ring Glow Ticks */}
        {Array.from({ length: 8 }).map((_, i) => {
          const ang = (i / 8) * Math.PI * 2;
          return (
            <mesh
              key={`inner-tick-${i}`}
              position={[Math.cos(ang) * innerRadius, 0, Math.sin(ang) * innerRadius]}
            >
              <sphereGeometry args={[0.02, 12, 12]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          );
        })}
      </group>

      {/* Floating Center Quantum Crystal Core */}
      <mesh ref={coreRef} position={[0, 0, 0]}>
        <octahedronGeometry args={[0.075, 0]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#38bdf8"
          emissiveIntensity={2.5}
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>

      {/* 3 Thin Suspension Cables */}
      {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => {
        const wx = Math.cos(angle) * outerRadius;
        const wz = Math.sin(angle) * outerRadius;
        return (
          <mesh key={i} position={[wx, 0.6, wz]}>
            <cylinderGeometry args={[0.002, 0.002, 1.2, 8]} />
            <meshBasicMaterial color="#718096" />
          </mesh>
        );
      })}

      {/* Pulsing Holographic Light Column (Portal Tractor Beam) */}
      <mesh ref={beamRef} position={[0, -1.05, 0]}>
        <cylinderGeometry args={[outerRadius * 0.95, innerRadius * 0.9, 2.1, 36, 1, true]} />
        <meshBasicMaterial
          ref={beamMatRef}
          color="#00f0ff"
          transparent
          opacity={0.075}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Multi-Colored Helical Swirling Stardust (Sternenstaub-Wirbel) */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[colors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.042}
          vertexColors
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Dynamic Ambient Point Light illuminating Table & Room */}
      <pointLight
        ref={lightRef}
        position={[0, -0.2, 0]}
        intensity={1.5}
        distance={4.5}
        color="#00f0ff"
      />
    </group>
  );
}

export type FloorAnimationMode = "all" | "ambient" | "sonar" | "stream" | "zen";

function AnimatedFloorConduits({
  width,
  height,
  centerX,
  centerZ,
  mode = "ambient",
}: {
  width: number;
  height: number;
  centerX: number;
  centerZ: number;
  mode?: FloorAnimationMode;
}) {
  const lineMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const ripple1Ref = useRef<THREE.Mesh>(null);
  const ripple2Ref = useRef<THREE.Mesh>(null);
  const dataNodesRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (mode === "zen") return;
    const t = clock.getElapsedTime();

    // 1. Slow, soothing arterial breathing glow (ca. 0.8 Hz instead of 2.8 Hz)
    if (lineMatRef.current) {
      const pulse = 0.35 + Math.sin(t * 0.8) * 0.25;
      lineMatRef.current.opacity = pulse;
    }

    // 2. Slow, graceful expanding holographic shockwaves (ca. 0.12 Hz - takes ~8s per wave)
    if ((mode === "all" || mode === "sonar") && ripple1Ref.current && ripple2Ref.current) {
      const p1 = (t * 0.12) % 1;
      const r1 = 0.6 + p1 * 3.2;
      ripple1Ref.current.scale.set(r1, r1, 1);
      const mat1 = ripple1Ref.current.material as THREE.MeshBasicMaterial;
      if (mat1) mat1.opacity = (1 - p1) * 0.45;

      const p2 = ((t * 0.12) + 0.5) % 1;
      const r2 = 0.6 + p2 * 3.2;
      ripple2Ref.current.scale.set(r2, r2, 1);
      const mat2 = ripple2Ref.current.material as THREE.MeshBasicMaterial;
      if (mat2) mat2.opacity = (1 - p2) * 0.45;
    }

    // 3. Smooth, calm traveling data nodes
    if ((mode === "all" || mode === "stream") && dataNodesRef.current) {
      const children = dataNodesRef.current.children;
      children.forEach((child, i) => {
        const speed = 0.32 + (i % 3) * 0.12;
        const progress = ((t * speed + i * 0.8) % 4) - 2;
        if (i < 4) {
          child.position.z = progress * (height * 0.22);
        } else {
          child.position.x = progress * (width * 0.22);
        }
      });
    }
  });

  if (mode === "zen") return null;

  return (
    <group position={[centerX, 0.004, centerZ]}>
      {/* Expanding Holographic Deck Shockwave Ripples beneath the Table */}
      {(mode === "all" || mode === "sonar") && (
        <>
          <mesh ref={ripple1Ref} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.98, 1.04, 64]} />
            <meshBasicMaterial
              color="#00f0ff"
              transparent
              opacity={0.4}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh ref={ripple2Ref} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.98, 1.04, 64]} />
            <meshBasicMaterial
              color="#38bdf8"
              transparent
              opacity={0.4}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </>
      )}

      {/* Primary Cyber Conduit Grid Lines */}
      {[-2.2, -0.8, 0.8, 2.2].map((xOffset) => (
        <mesh key={`ns-${xOffset}`} position={[xOffset, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.024, height - 0.2]} />
          <meshBasicMaterial
            ref={lineMatRef}
            color="#00f0ff"
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      {[-1.8, -0.6, 0.6, 1.8].map((zOffset) => (
        <mesh key={`ew-${zOffset}`} position={[0, 0, zOffset]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width - 0.2, 0.024]} />
          <meshBasicMaterial
            ref={lineMatRef}
            color="#00f0ff"
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}

      {/* Smooth Traveling Laser Data Packets */}
      {(mode === "all" || mode === "stream") && (
        <group ref={dataNodesRef}>
          <mesh position={[-2.2, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.04, 0.22]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.7} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh position={[-0.8, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.04, 0.26]} />
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.7} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh position={[0.8, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.04, 0.26]} />
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.7} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh position={[2.2, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.04, 0.22]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.7} blending={THREE.AdditiveBlending} />
          </mesh>
          {/* Horizontal moving packets */}
          <mesh position={[0, 0.001, -1.8]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.26, 0.04]} />
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.7} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh position={[0, 0.001, -0.6]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.22, 0.04]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.7} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh position={[0, 0.001, 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.22, 0.04]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.7} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh position={[0, 0.001, 1.8]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.26, 0.04]} />
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.7} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      )}
    </group>
  );
}

export const FloorAndWalls = memo(function FloorAndWalls({
  showRemoteOffice = true,
  whiteboardText = "Projekt Hermes 3D",
  onWhiteboardClick,
  screenTopic = null,
  onKanbanClick,
  onCouncilScreenClick,
  workingAgentCount = 0,
  tableMeetingState,
  holoChandelierVisible = true,
  floorMode = "ambient",
  onStartMeeting,
  onTogglePause,
  onNextMeetingStage,
  onSelectAgent,
}: {
  showRemoteOffice?: boolean;
  whiteboardText?: string;
  onWhiteboardClick?: () => void;
  screenTopic?: string | null;
  onKanbanClick?: () => void;
  onCouncilScreenClick?: () => void;
  /** How many agents are running, for the wall sparkline. */
  workingAgentCount?: number;
  tableMeetingState?: TableMeetingState;
  holoChandelierVisible?: boolean;
  floorMode?: FloorAnimationMode;
  onStartMeeting?: () => void;
  onTogglePause?: () => void;
  onNextMeetingStage?: () => void;
  onSelectAgent?: (agentId: string) => void;
}) {
  const districtWidth = CANVAS_W * SCALE;
  const districtHeight = CANVAS_H * SCALE;
  const localOfficeWidth = LOCAL_OFFICE_CANVAS_WIDTH * SCALE;
  const localOfficeHeight = LOCAL_OFFICE_CANVAS_HEIGHT * SCALE;
  const [districtCenterX, , districtCenterZ] = toWorld(CANVAS_W / 2, CANVAS_H / 2);
  const [localOfficeCenterX, , localOfficeCenterZ] = toWorld(
    LOCAL_OFFICE_CANVAS_WIDTH / 2,
    LOCAL_OFFICE_CANVAS_HEIGHT / 2,
  );
  const [meetingZoneCenterX, , meetingZoneCenterZ] = toWorld(
    MEETING_ROOM_RUG.x,
    MEETING_ROOM_RUG.y,
  );
  const [pathCenterX, , pathCenterZ] = toWorld(
    (CITY_PATH_ZONE.minX + CITY_PATH_ZONE.maxX) / 2,
    (CITY_PATH_ZONE.minY + CITY_PATH_ZONE.maxY) / 2,
  );
  const [, , remoteOfficeCenterZ] = toWorld(
    (REMOTE_OFFICE_ZONE.minX + REMOTE_OFFICE_ZONE.maxX) / 2,
    (REMOTE_OFFICE_ZONE.minY + REMOTE_OFFICE_ZONE.maxY) / 2,
  );
  const remoteOfficeOffsetZ = remoteOfficeCenterZ - localOfficeCenterZ;
  // Only north + west are built (see the PerimeterWall JSX below) — south
  // and east stay open so the room reads as an open corner, not a box.
  const localNorthWallZ = localOfficeCenterZ - localOfficeHeight / 2;
  const localWestWallX = localOfficeCenterX - localOfficeWidth / 2;

  // Starship Obsidian Titanium Deck (Large luxury aerospace slabs)
  const shuttleDeckTextures = useMemo(
    () => withRepeat(getSpaceShuttleDeckTextures(), 4, 3),
    [],
  );
  const pathGrass = useMemo(() => withRepeat(getGrassTextures(), 14, 2), []);
  const pathConcrete = useMemo(() => withRepeat(getConcreteTextures(), 8, 1), []);

  return (
    <group>
      {/* Sci-Fi Space Shuttle / Orbital Station Bridge Deck Slab */}
      <mesh
        position={[localOfficeCenterX, -FLOOR_SLAB_THICKNESS / 2, localOfficeCenterZ]}
        receiveShadow
      >
        <boxGeometry args={[localOfficeWidth, FLOOR_SLAB_THICKNESS, localOfficeHeight]} />
        <meshStandardMaterial
          map={shuttleDeckTextures.map}
          roughnessMap={shuttleDeckTextures.roughnessMap}
          roughness={0.18}
          metalness={0.88}
        />
      </mesh>

      {/* Interactive Pulsing Energy Conduits traversing the floor deck */}
      <AnimatedFloorConduits
        mode={floorMode}
        width={localOfficeWidth}
        height={localOfficeHeight}
        centerX={localOfficeCenterX}
        centerZ={localOfficeCenterZ}
      />

      {/* Orbital Observation Glass Floor Hatch beneath Council Table */}
      <group position={[meetingZoneCenterX, 0.003, meetingZoneCenterZ]}>
        {/* Outer glowing docking / warning collar ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.32, 1.45, 48]} />
          <meshBasicMaterial
            color="#00f0ff"
            transparent
            opacity={0.65}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        {/* Inner transparent reinforced observation viewport showing deep space */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.32, 48]} />
          <meshPhysicalMaterial
            color="#010612"
            transparent
            opacity={0.45}
            roughness={0.06}
            metalness={0.15}
            transmission={0.6}
            ior={1.4}
          />
        </mesh>
      </group>

      {/* Sci-Fi Bridge Floor Perimeter Glow Line */}
      <mesh
        position={[localOfficeCenterX, 0.003, localNorthWallZ + 0.04]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[localOfficeWidth, 0.03]} />
        <meshBasicMaterial color="#00f0ff" transparent opacity={0.6} />
      </mesh>
      <mesh
        position={[localWestWallX + 0.04, 0.003, localOfficeCenterZ]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
      >
        <planeGeometry args={[localOfficeHeight, 0.03]} />
        <meshBasicMaterial color="#00f0ff" transparent opacity={0.6} />
      </mesh>

      {/* Floating Cyber LED Chandelier with Stardust over meeting table */}
      {holoChandelierVisible ? (
        <CouncilChandelier position={[meetingZoneCenterX, 2.2, meetingZoneCenterZ]} />
      ) : null}

      {/* Interactive Table Meeting Hologram Hub directly on the conference table */}
      {holoChandelierVisible ? (
        <TableMeetingHoloHub
          position={[meetingZoneCenterX, 0.525, meetingZoneCenterZ]}
          agentCount={4}
          meetingState={tableMeetingState ?? {
            isActive: false,
            isPaused: false,
            stageIndex: 0,
            speakerName: "Claude",
            speakerColor: "#ea580c",
            question: "Was wurde erledigt?",
            timerSeconds: 30,
            totalStages: 4,
          }}
          onStartMeeting={onStartMeeting}
          onTogglePause={onTogglePause}
          onNextStage={onNextMeetingStage}
        />
      ) : null}

      {/* Seat contact shadows */}
      {MEETING_ROOM_SEATS.map((seat, index) => {
        const [seatWx, , seatWz] = toWorld(seat.x, seat.y);
        return (
          <FloorContactShadow
            key={`seat-shadow-${index}`}
            position={[seatWx, 0.0015, seatWz]}
            radius={0.55}
            opacity={0.32}
          />
        );
      })}

      {showRemoteOffice ? (
        <>
          <mesh
            position={[
              localOfficeCenterX,
              -FLOOR_SLAB_THICKNESS / 2,
              localOfficeCenterZ + remoteOfficeOffsetZ,
            ]}
            receiveShadow
          >
            <boxGeometry args={[localOfficeWidth, FLOOR_SLAB_THICKNESS, localOfficeHeight]} />
            <meshStandardMaterial
              map={shuttleDeckTextures.map}
              roughnessMap={shuttleDeckTextures.roughnessMap}
              roughness={0.38}
              metalness={0.45}
            />
          </mesh>

          <mesh
            position={[pathCenterX, 0.002, pathCenterZ]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry
              args={[
                (CITY_PATH_ZONE.maxX - CITY_PATH_ZONE.minX) * SCALE,
                (CITY_PATH_ZONE.maxY - CITY_PATH_ZONE.minY) * SCALE,
              ]}
            />
            <meshStandardMaterial
              color="#9cb87c"
              map={pathGrass.map}
              roughnessMap={pathGrass.roughnessMap}
              normalMap={pathGrass.normalMap}
              normalScale={[0.7, 0.7]}
              roughness={0.96}
              metalness={0.02}
            />
          </mesh>

          <mesh
            position={[pathCenterX, 0.004, pathCenterZ]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry
              args={[
                (CITY_PATH_ZONE.maxX - CITY_PATH_ZONE.minX) * SCALE * 0.72,
                (CITY_PATH_ZONE.maxY - CITY_PATH_ZONE.minY) * SCALE * 0.26,
              ]}
            />
            <meshStandardMaterial
              color="#d8c5a6"
              map={pathConcrete.map}
              roughnessMap={pathConcrete.roughnessMap}
              normalMap={pathConcrete.normalMap}
              normalScale={[0.5, 0.5]}
              roughness={0.94}
              metalness={0.02}
            />
          </mesh>

        </>
      ) : null}

      {/* Seamless luxury marble floor across the entire council space */}


      {/* Only two walls — north + west — instead of a fully boxed-in
          room. Matches the TikTok/SAMS reference's "standing in the open
          corner looking into the room" framing: south and east stay open
          so the default camera looks straight into the space instead of
          hitting a wall on every side. */}
      <PerimeterWall
        center={[localOfficeCenterX, localNorthWallZ]}
        length={localOfficeWidth}
        axis="x"
      />
      {showRemoteOffice ? (
        <PerimeterWall
          center={[localOfficeCenterX, localNorthWallZ + remoteOfficeOffsetZ]}
          length={localOfficeWidth}
          axis="x"
        />
      ) : null}
      <PerimeterWall
        center={[localWestWallX, localOfficeCenterZ]}
        length={localOfficeHeight}
        axis="z"
        glass
        onSelectAgent={onSelectAgent}
      />
      {showRemoteOffice ? (
        <PerimeterWall
          center={[localWestWallX, localOfficeCenterZ + remoteOfficeOffsetZ]}
          length={localOfficeHeight}
          axis="z"
          glass
          onSelectAgent={onSelectAgent}
        />
      ) : null}

      {/* Three wall fixtures spaced across the (solid) north wall — all
          recessed into the wall itself (see each component), not proud of
          it: whiteboard west, council screen centered, Kanban Wall east. */}
      <WallWhiteboard
        position={[localOfficeCenterX - 140 * SCALE, 1.5, localNorthWallZ + 0.13]}
        text={whiteboardText}
        onClick={onWhiteboardClick}
      />
      <WallCouncilScreen
        position={[localOfficeCenterX, 1.5, localNorthWallZ + 0.13]}
        topic={screenTopic}
        onClick={onCouncilScreenClick}
        workingCount={workingAgentCount}
      />
      <WallKanbanBoard
        position={[localOfficeCenterX + 140 * SCALE, 1.5, localNorthWallZ + 0.13]}
        onClick={onKanbanClick}
      />
      {showRemoteOffice ? (
        <>
          <WallWhiteboard
            position={[
              localOfficeCenterX - 140 * SCALE,
              1.5,
              localNorthWallZ + 0.13 + remoteOfficeOffsetZ,
            ]}
            text={whiteboardText}
            onClick={onWhiteboardClick}
          />
          <WallCouncilScreen
            position={[
              localOfficeCenterX,
              1.5,
              localNorthWallZ + 0.13 + remoteOfficeOffsetZ,
            ]}
            topic={screenTopic}
            onClick={onCouncilScreenClick}
            workingCount={workingAgentCount}
          />
          <WallKanbanBoard
            position={[
              localOfficeCenterX + 140 * SCALE,
              1.5,
              localNorthWallZ + 0.13 + remoteOfficeOffsetZ,
            ]}
            onClick={onKanbanClick}
          />
        </>
      ) : null}

      <mesh position={[localOfficeCenterX, 0.03, localNorthWallZ + 0.04]}>
        <boxGeometry args={[localOfficeWidth, 0.06, 0.04]} />
        <meshStandardMaterial color="#14151a" roughness={0.85} metalness={0.1} />
      </mesh>
      {showRemoteOffice ? (
        <mesh position={[localOfficeCenterX, 0.03, localNorthWallZ + 0.04 + remoteOfficeOffsetZ]}>
          <boxGeometry args={[localOfficeWidth, 0.06, 0.04]} />
          <meshStandardMaterial color="#14151a" roughness={0.85} metalness={0.1} />
        </mesh>
      ) : null}
      <mesh position={[localWestWallX + 0.04, 0.03, localOfficeCenterZ]}>
        <boxGeometry args={[0.04, 0.06, localOfficeHeight]} />
        <meshStandardMaterial color="#14151a" roughness={0.85} metalness={0.1} />
      </mesh>
      {showRemoteOffice ? (
        <mesh position={[localWestWallX + 0.04, 0.03, localOfficeCenterZ + remoteOfficeOffsetZ]}>
          <boxGeometry args={[0.04, 0.06, localOfficeHeight]} />
          <meshStandardMaterial color="#14151a" roughness={0.85} metalness={0.1} />
        </mesh>
      ) : null}
    </group>
  );
});

export const WallPictures = memo(function WallPictures({
  showRemoteOffice = true,
}: {
  showRemoteOffice?: boolean;
}) {
  const localWidth = LOCAL_OFFICE_CANVAS_WIDTH * SCALE;
  const localHeight = LOCAL_OFFICE_CANVAS_HEIGHT * SCALE;
  const [localCenterX, , localCenterZ] = toWorld(
    LOCAL_OFFICE_CANVAS_WIDTH / 2,
    LOCAL_OFFICE_CANVAS_HEIGHT / 2,
  );
  const northZ = localCenterZ - localHeight / 2 + 0.07;
  const southZ = localCenterZ + localHeight / 2 - 0.07;
  const westX = localCenterX - localWidth / 2 + 0.07;
  const eastX = localCenterX + localWidth / 2 - 0.07;
  const pictureY = 0.64;
  const [localFlagPoleX, , localFlagPoleZ] = toWorld(
    180,
    LOCAL_OFFICE_CANVAS_HEIGHT - 110,
  );
  const [remoteFlagPoleX, , remoteFlagPoleZ] = toWorld(
    180,
    REMOTE_OFFICE_ZONE.maxY - 110,
  );
  const localFlagPolePosition: [number, number, number] = [localFlagPoleX, 0, localFlagPoleZ];
  const remoteFlagPolePosition: [number, number, number] = [
    remoteFlagPoleX,
    0,
    remoteFlagPoleZ,
  ];

  return (
    <group>
      <OfficeFlagPole
        position={localFlagPolePosition}
        rotY={0.32}
        art={<UsaFlagArt />}
      />
      {showRemoteOffice ? (
        <OfficeFlagPole
          position={remoteFlagPolePosition}
          rotY={0.32}
          art={<BrazilFlagArt />}
        />
      ) : null}

      <FramedPicture
        position={[localCenterX - 7.5, pictureY, northZ]}
        rotY={0}
        w={0.58}
        h={0.42}
        frameColor="#1a0e06"
        bgColor="#f8f4ec"
        art={
          <>
            <mesh position={[-0.12, 0.07, 0]}>
              <planeGeometry args={[0.22, 0.14]} />
              <meshBasicMaterial color="#c0392b" />
            </mesh>
            <mesh position={[0.09, 0.07, 0]}>
              <planeGeometry args={[0.18, 0.14]} />
              <meshBasicMaterial color="#2980b9" />
            </mesh>
            <mesh position={[0.04, -0.07, 0]}>
              <planeGeometry args={[0.26, 0.12]} />
              <meshBasicMaterial color="#f39c12" />
            </mesh>
            <mesh position={[0, 0, 0.001]}>
              <planeGeometry args={[0.006, 0.3]} />
              <meshBasicMaterial color="#1c1008" />
            </mesh>
            <mesh position={[0, 0.01, 0.001]}>
              <planeGeometry args={[0.4, 0.006]} />
              <meshBasicMaterial color="#1c1008" />
            </mesh>
          </>
        }
      />

      <FramedPicture
        position={[localCenterX - 1.5, pictureY, northZ]}
        rotY={0}
        w={0.64}
        h={0.4}
        frameColor="#2a1a0a"
        bgColor="#a8d8f0"
        art={
          <>
            <mesh position={[0, 0.08, 0]}>
              <planeGeometry args={[0.56, 0.1]} />
              <meshBasicMaterial color="#6ab8e8" />
            </mesh>
            <mesh position={[0.18, 0.09, 0.001]}>
              <circleGeometry args={[0.038, 12]} />
              <meshBasicMaterial color="#f8d060" />
            </mesh>
            <mesh position={[0, 0, 0.001]}>
              <planeGeometry args={[0.56, 0.1]} />
              <meshBasicMaterial color="#7ab870" />
            </mesh>
            <mesh position={[-0.12, -0.04, 0.002]}>
              <planeGeometry args={[0.28, 0.1]} />
              <meshBasicMaterial color="#5a9a58" />
            </mesh>
            <mesh position={[0, -0.1, 0.001]}>
              <planeGeometry args={[0.56, 0.08]} />
              <meshBasicMaterial color="#8b6348" />
            </mesh>
          </>
        }
      />

      <FramedPicture
        position={[localCenterX + 4, pictureY, northZ]}
        rotY={0}
        w={0.5}
        h={0.42}
        frameColor="#1a0e06"
        bgColor="#f0d090"
        art={
          <>
            <mesh position={[0, 0.07, 0]}>
              <planeGeometry args={[0.4, 0.12]} />
              <meshBasicMaterial color="#e07820" />
            </mesh>
            <mesh position={[0, -0.02, 0]}>
              <planeGeometry args={[0.4, 0.09]} />
              <meshBasicMaterial color="#c0403a" />
            </mesh>
            <mesh position={[0, -0.1, 0]}>
              <planeGeometry args={[0.4, 0.08]} />
              <meshBasicMaterial color="#4a2870" />
            </mesh>
          </>
        }
      />

      <FramedPicture
        position={[localCenterX + 8.5, pictureY, northZ]}
        rotY={0}
        w={0.55}
        h={0.38}
        frameColor="#262626"
        bgColor="#101820"
        art={
          <>
            {([-0.11, -0.05, 0.01, 0.07, 0.12] as const).map((y, index) => (
              <mesh
                key={index}
                position={[index % 2 === 0 ? -0.04 : 0.02, y, 0]}
              >
                <planeGeometry args={[0.22 + (index % 3) * 0.07, 0.012]} />
                <meshBasicMaterial
                  color={
                    ["#22d3ee", "#a78bfa", "#4ade80", "#f472b6", "#fb923c"][
                      index
                    ]
                  }
                />
              </mesh>
            ))}
            <mesh position={[0.17, 0.12, 0]}>
              <circleGeometry args={[0.018, 10]} />
              <meshBasicMaterial color="#22d3ee" />
            </mesh>
          </>
        }
      />

      <FramedPicture
        position={[localCenterX - 5.5, pictureY, southZ]}
        rotY={Math.PI}
        w={0.6}
        h={0.4}
        frameColor="#1c1008"
        bgColor="#e8e0f0"
        art={
          <>
            <mesh position={[-0.14, 0.06, 0]}>
              <planeGeometry args={[0.2, 0.22]} />
              <meshBasicMaterial color="#7b68ee" />
            </mesh>
            <mesh position={[0.06, 0.04, 0]}>
              <planeGeometry args={[0.26, 0.18]} />
              <meshBasicMaterial color="#20b2aa" />
            </mesh>
            <mesh position={[-0.05, -0.1, 0]}>
              <planeGeometry args={[0.32, 0.1]} />
              <meshBasicMaterial color="#ff7f50" />
            </mesh>
          </>
        }
      />

      <FramedPicture
        position={[localCenterX, pictureY, southZ]}
        rotY={Math.PI}
        w={0.5}
        h={0.36}
        frameColor="#0a0a12"
        bgColor="#0a0a12"
        art={
          <>
            {([0, 1, 2, 3, 4, 5] as const).map((index) => (
              <mesh key={index} position={[-0.17 + index * 0.068, 0, 0]}>
                <planeGeometry args={[0.052, 0.26]} />
                <meshBasicMaterial
                  color={
                    [
                      "#ef4444",
                      "#f97316",
                      "#eab308",
                      "#22c55e",
                      "#3b82f6",
                      "#a855f7",
                    ][index]
                  }
                />
              </mesh>
            ))}
          </>
        }
      />

      <FramedPicture
        position={[localCenterX + 5.5, pictureY, southZ]}
        rotY={Math.PI}
        w={0.46}
        h={0.42}
        frameColor="#2a2008"
        bgColor="#d4c8a8"
        art={
          <>
            <mesh position={[0, 0.02, 0]}>
              <boxGeometry args={[0.1, 0.14, 0.001]} />
              <meshBasicMaterial color="#2a1a0a" />
            </mesh>
            <mesh position={[0, 0.13, 0]}>
              <circleGeometry args={[0.04, 14]} />
              <meshBasicMaterial color="#2a1a0a" />
            </mesh>
            <mesh position={[-0.03, -0.09, 0]}>
              <boxGeometry args={[0.035, 0.1, 0.001]} />
              <meshBasicMaterial color="#2a1a0a" />
            </mesh>
            <mesh position={[0.03, -0.09, 0]}>
              <boxGeometry args={[0.035, 0.1, 0.001]} />
              <meshBasicMaterial color="#2a1a0a" />
            </mesh>
          </>
        }
      />

      <FramedPicture
        position={[westX, pictureY, localCenterZ - 3.5]}
        rotY={-Math.PI / 2}
        w={0.52}
        h={0.4}
        frameColor="#1c1008"
        bgColor="#f0c840"
        art={
          <>
            {([0, Math.PI / 3, -Math.PI / 3] as const).map(
              (rotation, index) => (
                <mesh
                  key={index}
                  position={[0, 0, 0]}
                  rotation={[0, 0, rotation]}
                >
                  <boxGeometry args={[0.08, 0.28, 0.001]} />
                  <meshBasicMaterial color="#c84020" />
                </mesh>
              ),
            )}
          </>
        }
      />

      <FramedPicture
        position={[westX, pictureY, localCenterZ + 2.5]}
        rotY={-Math.PI / 2}
        w={0.58}
        h={0.44}
        frameColor="#102040"
        bgColor="#1a3a6a"
        art={
          <>
            {([-0.14, -0.07, 0, 0.07, 0.14] as const).map((x, index) => (
              <mesh key={`bv${index}`} position={[x, 0, 0]}>
                <planeGeometry args={[0.004, 0.34]} />
                <meshBasicMaterial color="#4080c0" transparent opacity={0.5} />
              </mesh>
            ))}
            {([-0.12, -0.06, 0, 0.06, 0.12] as const).map((y, index) => (
              <mesh key={`bh${index}`} position={[0, y, 0]}>
                <planeGeometry args={[0.42, 0.004]} />
                <meshBasicMaterial color="#4080c0" transparent opacity={0.5} />
              </mesh>
            ))}
            <mesh position={[-0.05, 0.04, 0.001]}>
              <planeGeometry args={[0.16, 0.12]} />
              <meshBasicMaterial color="#4080c0" transparent opacity={0.3} />
            </mesh>
            <mesh position={[0.1, -0.05, 0.001]}>
              <planeGeometry args={[0.12, 0.1]} />
              <meshBasicMaterial color="#4080c0" transparent opacity={0.3} />
            </mesh>
          </>
        }
      />

      <FramedPicture
        position={[eastX, pictureY, localCenterZ - 2.5]}
        rotY={Math.PI / 2}
        w={0.56}
        h={0.42}
        frameColor="#1c1008"
        bgColor="#1a2840"
        art={
          <>
            {([0.12, 0.04, -0.04, -0.12] as const).map((y, index) => (
              <mesh key={index} position={[0, y, 0]}>
                <planeGeometry args={[0.44, 0.03 + index * 0.008]} />
                <meshBasicMaterial
                  color={["#60a0f8", "#4080d8", "#3060b8", "#205090"][index]}
                />
              </mesh>
            ))}
          </>
        }
      />

      <FramedPicture
        position={[eastX, pictureY, localCenterZ + 3.5]}
        rotY={Math.PI / 2}
        w={0.48}
        h={0.44}
        frameColor="#2a1a0a"
        bgColor="#f8f4e8"
        art={
          <>
            <mesh position={[0, -0.06, 0]}>
              <boxGeometry args={[0.018, 0.18, 0.001]} />
              <meshBasicMaterial color="#3a6a2a" />
            </mesh>
            <mesh position={[-0.07, 0.04, 0.001]} rotation={[0, 0, 0.4]}>
              <boxGeometry args={[0.12, 0.06, 0.001]} />
              <meshBasicMaterial color="#4a8a38" />
            </mesh>
            <mesh position={[0.07, 0.02, 0.001]} rotation={[0, 0, -0.4]}>
              <boxGeometry args={[0.12, 0.06, 0.001]} />
              <meshBasicMaterial color="#5aa042" />
            </mesh>
            <mesh position={[0, 0.1, 0.001]}>
              <boxGeometry args={[0.08, 0.1, 0.001]} />
              <meshBasicMaterial color="#48904a" />
            </mesh>
            <mesh position={[0, -0.14, 0.001]}>
              <boxGeometry args={[0.1, 0.05, 0.001]} />
              <meshBasicMaterial color="#b86040" />
            </mesh>
          </>
        }
      />

      {null}
    </group>
  );
});
