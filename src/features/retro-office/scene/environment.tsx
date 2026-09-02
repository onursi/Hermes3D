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
import {
  getConcreteTextures,
  getGrassTextures,
  getPlasterTextures,
  withRepeat,
} from "@/features/retro-office/core/proceduralTextures";

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
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* Frame lip. */}
      <mesh position={[0, h / 2 - frameThickness / 2, frameCenterZ]} castShadow>
        <boxGeometry args={[w, frameThickness, frameDepth]} />
        <meshStandardMaterial color="#d8dadd" roughness={0.55} metalness={0.1} />
      </mesh>
      <mesh position={[0, -h / 2 + frameThickness / 2, frameCenterZ]} castShadow>
        <boxGeometry args={[w, frameThickness, frameDepth]} />
        <meshStandardMaterial color="#d8dadd" roughness={0.55} metalness={0.1} />
      </mesh>
      <mesh position={[-w / 2 + frameThickness / 2, 0, frameCenterZ]} castShadow>
        <boxGeometry args={[frameThickness, innerH, frameDepth]} />
        <meshStandardMaterial color="#d8dadd" roughness={0.55} metalness={0.1} />
      </mesh>
      <mesh position={[w / 2 - frameThickness / 2, 0, frameCenterZ]} castShadow>
        <boxGeometry args={[frameThickness, innerH, frameDepth]} />
        <meshStandardMaterial color="#d8dadd" roughness={0.55} metalness={0.1} />
      </mesh>
      {/* Writable surface, recessed — also the click target for editing. */}
      <mesh
        position={[0, 0, backingZ]}
        onClick={
          onClick
            ? (event) => {
                event.stopPropagation();
                onClick();
              }
            : undefined
        }
        onPointerOver={onClick ? () => (document.body.style.cursor = "pointer") : undefined}
        onPointerOut={onClick ? () => (document.body.style.cursor = "auto") : undefined}
      >
        <boxGeometry args={[innerW, innerH, 0.015]} />
        <meshPhysicalMaterial
          color="#ffffff"
          roughness={0.15}
          clearcoat={0.6}
          clearcoatRoughness={0.2}
        />
      </mesh>
      {text ? (
        <Text
          position={[0, 0.04, backingZ + 0.01]}
          fontSize={0.13}
          color="#1d4ed8"
          anchorX="center"
          anchorY="middle"
          maxWidth={innerW - inset}
        >
          {text}
        </Text>
      ) : null}
      {/* A hand-drawn-looking underline, marker-style. */}
      {text ? (
        <mesh position={[0, -0.09, backingZ + 0.01]}>
          <planeGeometry args={[Math.min(innerW - inset, text.length * 0.09), 0.012]} />
          <meshBasicMaterial color="#1d4ed8" />
        </mesh>
      ) : null}
      {/* Marker tray along the bottom edge, sitting on the frame lip. */}
      <mesh position={[0, -h / 2 + 0.02, frameCenterZ + frameDepth / 2 + 0.02]} castShadow>
        <boxGeometry args={[innerW, 0.03, 0.04]} />
        <meshStandardMaterial color="#c3c6ca" roughness={0.5} metalness={0.2} />
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
}: {
  position: [number, number, number];
  rotY?: number;
  w?: number;
  h?: number;
}) {
  const frameThickness = 0.05;
  // Local z=0 is the wall's room-facing surface; the wall itself is a
  // solid, opaque box (see PerimeterWall), so everything here must stay at
  // z >= 0 (in front of the wall) — a negative z here sits INSIDE that
  // opaque geometry and is invisible except for whatever sliver pokes back
  // out past z=0 (a real bug caught live: the niche used to be built at
  // z=-0.11, hiding every card/title behind the wall's own face and
  // leaving only a 1.5cm frame sliver visible — an empty-looking outline).
  // The recessed look instead comes from the backing sitting closer to the
  // wall (small z) than the frame's own front lip (larger z).
  const backingZ = 0.02;
  const frameFrontZ = 0.14;
  const frameDepth = frameFrontZ - backingZ;
  const frameCenterZ = (backingZ + frameFrontZ) / 2;
  const cardZ = 0.065;
  const innerW = w - frameThickness * 2;
  const innerH = h - frameThickness * 2;
  const columnWidth = innerW / 3;

  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* Recessed dark backing, set back into the wall. */}
      <mesh position={[0, 0, backingZ]} receiveShadow>
        <boxGeometry args={[innerW, innerH, 0.015]} />
        <meshStandardMaterial color="#1b2130" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Frame lip — top/bottom/left/right bars filling the recess depth,
          poking just past the wall face so its edge catches light and
          casts a real contact shadow into the niche. */}
      <mesh position={[0, h / 2 - frameThickness / 2, frameCenterZ]} castShadow>
        <boxGeometry args={[w, frameThickness, frameDepth]} />
        <meshStandardMaterial color="#c7cad0" roughness={0.5} metalness={0.15} />
      </mesh>
      <mesh position={[0, -h / 2 + frameThickness / 2, frameCenterZ]} castShadow>
        <boxGeometry args={[w, frameThickness, frameDepth]} />
        <meshStandardMaterial color="#c7cad0" roughness={0.5} metalness={0.15} />
      </mesh>
      <mesh position={[-w / 2 + frameThickness / 2, 0, frameCenterZ]} castShadow>
        <boxGeometry args={[frameThickness, innerH, frameDepth]} />
        <meshStandardMaterial color="#c7cad0" roughness={0.5} metalness={0.15} />
      </mesh>
      <mesh position={[w / 2 - frameThickness / 2, 0, frameCenterZ]} castShadow>
        <boxGeometry args={[frameThickness, innerH, frameDepth]} />
        <meshStandardMaterial color="#c7cad0" roughness={0.5} metalness={0.15} />
      </mesh>
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
        return (
          <group key={title}>
            <Text
              position={[columnCenterX, innerH / 2 - 0.06, cardZ + 0.005]}
              fontSize={0.052}
              color="#cbd5e1"
              anchorX="center"
              anchorY="middle"
              maxWidth={columnWidth - 0.06}
            >
              {title}
            </Text>
            {/* 2 stacked cards per column, each its own mesh (own small
                z-offset) so the stack itself reads as layered, not printed. */}
            {[0, 1].map((cardIndex) => (
              <mesh
                key={`kanban-card-${columnIndex}-${cardIndex}`}
                position={[
                  columnCenterX,
                  innerH / 2 - 0.16 - cardIndex * 0.13,
                  cardZ + cardIndex * 0.004,
                ]}
                castShadow
              >
                <boxGeometry args={[columnWidth - 0.09, 0.09, 0.008]} />
                <meshStandardMaterial
                  color={
                    KANBAN_CARD_COLORS[
                      (columnIndex * 2 + cardIndex) % KANBAN_CARD_COLORS.length
                    ]
                  }
                  roughness={0.6}
                />
              </mesh>
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
function useAnimatedScreenTexture() {
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

  useFrame(({ clock }) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const t = clock.getElapsedTime();
    ctx.fillStyle = "#0a1820";
    ctx.fillRect(0, 0, 256, 144);
    // Faint grid, like a monitoring dashboard.
    ctx.strokeStyle = "rgba(143, 212, 236, 0.12)";
    ctx.lineWidth = 1;
    for (let x = 0; x < 256; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 144);
      ctx.stroke();
    }
    // Two scrolling waveforms, out of phase.
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#8fd4ec";
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 4) {
      const y = 50 + Math.sin(x * 0.045 + t * 2.2) * 16 + Math.sin(x * 0.11 - t * 1.3) * 6;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = "#4fd6a8";
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 4) {
      const y = 100 + Math.sin(x * 0.06 - t * 1.7) * 12 + Math.sin(x * 0.02 + t * 0.6) * 8;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // A slow horizontal scanline sweep for a "live feed" flicker.
    const scanY = ((t * 30) % 144 + 144) % 144;
    const gradient = ctx.createLinearGradient(0, scanY - 10, 0, scanY + 10);
    gradient.addColorStop(0, "rgba(143,212,236,0)");
    gradient.addColorStop(0.5, "rgba(143,212,236,0.15)");
    gradient.addColorStop(1, "rgba(143,212,236,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, scanY - 10, 256, 20);
    if (textureRef.current) textureRef.current.needsUpdate = true;
  });

  return texture;
}

/**
 * Futuristic Interactive Hologram Avatar Screen Wall
 * Projects dynamic holographic agent bays, rotating radar rings, real-time
 * frequency equalizers, and interactive pointer hover targeting onto the glass wall.
 */
function useAvatarScreenTexture({
  hoveredIndex,
  clickEffect,
}: {
  hoveredIndex: number | null;
  clickEffect: { index: number; time: number } | null;
}) {
  const { state: agentStore } = useAgentStore();
  const canvas = useMemo(() => {
    const el = document.createElement("canvas");
    el.width = 2048;
    el.height = 512;
    return el;
  }, []);

  const texture = useMemo(() => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [canvas]);

  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  useEffect(() => {
    ctxRef.current = canvas.getContext("2d");
  }, [canvas]);

  const agentsList = useMemo(() => {
    const raw = agentStore?.agents ?? [];
    const defaults = [
      { id: "hermes", name: "Hermes", role: "Chief Architect", color: "#00f0ff", status: "Active" },
      { id: "claude", name: "Claude", role: "AI Engineer", color: "#a855f7", status: "Linked" },
      { id: "sabine", name: "Sabine", role: "Knowledge Officer", color: "#10b981", status: "Synced" },
      { id: "nexus", name: "Nexus", role: "Security & Gateway", color: "#f59e0b", status: "Standby" },
    ];
    return defaults.map((def, i) => {
      const live = raw[i];
      if (!live) return def;
      return {
        id: live.agentId,
        name: live.name || def.name,
        role: live.role || def.role,
        color: def.color,
        status: live.status === "running" ? "Processing" : def.status,
      };
    });
  }, [agentStore?.agents]);

  useFrame(({ clock }) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const t = clock.getElapsedTime();
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

    // 3. Top Cyber Telemetry Header
    ctx.fillStyle = "rgba(0, 240, 255, 0.85)";
    ctx.font = "bold 20px 'Courier New', monospace";
    ctx.fillText("HERMES-OS // QUANTUM FLEET AVATAR MATRIX v4.5", 48, 38);

    ctx.fillStyle = "rgba(16, 185, 129, 0.9)";
    ctx.font = "16px 'Courier New', monospace";
    const secStr = Math.floor(t * 10).toString().padStart(6, "0");
    ctx.fillText(`NEURAL LINK: 99.98% // TICK: ${secStr} // SYS: NOMINAL`, W - 580, 38);

    ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 52);
    ctx.lineTo(W - 40, 52);
    ctx.stroke();

    // 4. Sweeping horizontal scanner beam
    const scanY = (t * 80) % H;
    const scanGrad = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 10);
    scanGrad.addColorStop(0, "rgba(0, 240, 255, 0)");
    scanGrad.addColorStop(0.5, "rgba(0, 240, 255, 0.09)");
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
        ctx.fillStyle = "rgba(0, 240, 255, 0.12)";
        ctx.fillRect(bayX + 8, 70, bayW - 16, H - 95);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
      } else {
        ctx.fillStyle = "rgba(10, 22, 44, 0.25)";
        ctx.fillRect(bayX + 8, 70, bayW - 16, H - 95);
        ctx.strokeStyle = "rgba(0, 240, 255, 0.22)";
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 0;
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
      // Top-left
      ctx.moveTo(bLeft, bTop + cLen); ctx.lineTo(bLeft, bTop); ctx.lineTo(bLeft + cLen, bTop);
      // Top-right
      ctx.moveTo(bRight - cLen, bTop); ctx.lineTo(bRight, bTop); ctx.lineTo(bRight, bTop + cLen);
      // Bottom-left
      ctx.moveTo(bLeft, bBot - cLen); ctx.lineTo(bLeft, bBot); ctx.lineTo(bLeft + cLen, bBot);
      // Bottom-right
      ctx.moveTo(bRight - cLen, bBot); ctx.lineTo(bRight, bBot); ctx.lineTo(bRight, bBot - cLen);
      ctx.stroke();

      // Avatar Hologram Portal (Circle with rotating rings)
      const cx = bayX + bayW / 2;
      const cy = 190;
      const r = isHovered ? 64 : 56;

      // Glow behind portal
      const radGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, r + 20);
      radGrad.addColorStop(0, color);
      radGrad.addColorStop(0.6, "rgba(0, 240, 255, 0.15)");
      radGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 20, 0, Math.PI * 2);
      ctx.fill();

      // Outer rotating segmented radar ring
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const rotAngle = t * (i % 2 === 0 ? 1.2 : -1.2);
      ctx.arc(cx, cy, r, rotAngle, rotAngle + Math.PI * 1.4);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, r, rotAngle + Math.PI * 1.6, rotAngle + Math.PI * 1.9);
      ctx.stroke();

      // Inner counter-rotating ring
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 12, -rotAngle * 1.5, -rotAngle * 1.5 + Math.PI);
      ctx.stroke();

      // Avatar Initial / Hologram Silhouette
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 38px 'Arial', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillText(agent.name.charAt(0).toUpperCase(), cx, cy);

      // Agent Name & Role
      ctx.fillStyle = isHovered ? "#ffffff" : "#e2e8f0";
      ctx.font = "bold 24px 'Arial', sans-serif";
      ctx.shadowBlur = isHovered ? 12 : 4;
      ctx.shadowColor = color;
      ctx.fillText(agent.name.toUpperCase(), cx, 280);

      ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
      ctx.font = "14px 'Courier New', monospace";
      ctx.shadowBlur = 0;
      ctx.fillText(`// ${agent.role}`, cx, 306);

      // Status Pill
      ctx.fillStyle = "rgba(16, 185, 129, 0.18)";
      ctx.fillRect(cx - 65, 326, 130, 26);
      ctx.strokeStyle = "rgba(16, 185, 129, 0.7)";
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 65, 326, 130, 26);

      // Pulsing LED dot
      const pulseVal = 0.5 + 0.5 * Math.sin(t * 4 + i);
      ctx.fillStyle = `rgba(16, 185, 129, ${pulseVal})`;
      ctx.beginPath();
      ctx.arc(cx - 45, 339, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#34d399";
      ctx.font = "bold 12px 'Courier New', monospace";
      ctx.textAlign = "left";
      ctx.fillText(agent.status.toUpperCase(), cx - 35, 343);
      ctx.textAlign = "center";

      // Real-time animated Audio/Equalizer Bars
      const numBars = 12;
      const barTotalW = bayW - 60;
      const barW = barTotalW / numBars - 4;
      const startX = bayX + 30;
      const eqBaseY = 430;

      for (let b = 0; b < numBars; b++) {
        const barX = startX + b * (barW + 4);
        const freqMult = isHovered ? 38 : 22;
        const barH =
          6 +
          Math.abs(Math.sin(t * 3.5 + b * 0.45 + i * 1.2)) * freqMult +
          Math.abs(Math.cos(t * 2.1 - b * 0.3)) * (freqMult * 0.4);

        const barGrad = ctx.createLinearGradient(barX, eqBaseY, barX, eqBaseY - barH);
        barGrad.addColorStop(0, color);
        barGrad.addColorStop(1, isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.8)");

        ctx.fillStyle = barGrad;
        ctx.fillRect(barX, eqBaseY - barH, barW, barH);
      }

      // Telemetry sparkline / status label at bottom
      ctx.fillStyle = "rgba(148, 163, 184, 0.75)";
      ctx.font = "11px 'Courier New', monospace";
      if (isHovered) {
        ctx.fillStyle = color;
        ctx.fillText(">> DIRECT LINK ACTIVE <<", cx, 465);
      } else {
        const hex = ((i * 12345 + Math.floor(t * 4)) % 0xffff)
          .toString(16)
          .toUpperCase()
          .padStart(4, "0");
        ctx.fillText(`CORE_ID: 0x${hex} [OK]`, cx, 465);
      }

      ctx.restore();
    });

    // 6. Interactive Click Ripple
    if (clickEffect && t - clickEffect.time < 0.6) {
      const dt = t - clickEffect.time;
      const clickBayX = 60 + clickEffect.index * bayW + bayW / 2;
      const rippleR = dt * 240;
      const alpha = Math.max(0, 1 - dt / 0.6);
      ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(clickBayX, 220, rippleR, 0, Math.PI * 2);
      ctx.stroke();
    }

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
}: {
  length: number;
  glassHeight: number;
  axis: "x" | "z";
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [clickEffect, setClickEffect] = useState<{ index: number; time: number } | null>(null);
  const texture = useAvatarScreenTexture({ hoveredIndex, clickEffect });
  const rotY = axis === "z" ? Math.PI / 2 : 0;

  return (
    <mesh
      rotation={[0, rotY, 0]}
      renderOrder={5}
      onPointerMove={(e) => {
        if (!e.uv) return;
        const normalizedX = axis === "z" ? 1 - e.uv.x : e.uv.x;
        const idx = Math.min(3, Math.max(0, Math.floor(normalizedX * 4)));
        setHoveredIndex(idx);
      }}
      onPointerOut={() => setHoveredIndex(null)}
      onClick={(e) => {
        if (!e.uv) return;
        const normalizedX = axis === "z" ? 1 - e.uv.x : e.uv.x;
        const idx = Math.min(3, Math.max(0, Math.floor(normalizedX * 4)));
        setClickEffect({ index: idx, time: performance.now() / 1000 });
      }}
    >
      <planeGeometry args={[length * 0.98, glassHeight * 0.88]} />
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
 * (dark niche backing + protruding frame lip) instead of standing on a
 * floor base/support poles, per the "TV soll in der Wand sein" request.
 * `topic`/content rendering matches the previous freestanding KnowledgeScreen
 * in meetingRoomFixtures.tsx; this is the fixture's home now. */
function WallCouncilScreen({
  position,
  rotY = 0,
  w = 1.9,
  h = 1.05,
  topic,
}: {
  position: [number, number, number];
  rotY?: number;
  w?: number;
  h?: number;
  topic: string | null;
}) {
  const frameThickness = 0.045;
  // Same fix as WallKanbanBoard/WallWhiteboard above — stay at z >= 0 (in
  // front of the wall's own opaque geometry), recessed look comes from the
  // backing sitting closer to the wall than the frame's front lip.
  const backingZ = 0.02;
  const frameFrontZ = 0.14;
  const frameDepth = frameFrontZ - backingZ;
  const frameCenterZ = (backingZ + frameFrontZ) / 2;
  const innerW = w - frameThickness * 2;
  const innerH = h - frameThickness * 2;
  const screenTexture = useAnimatedScreenTexture();

  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0, backingZ]}>
        <boxGeometry args={[innerW, innerH, 0.015]} />
        <meshStandardMaterial
          color="#0c1a22"
          emissiveMap={screenTexture}
          emissive="#ffffff"
          emissiveIntensity={0.85}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, h / 2 - frameThickness / 2, frameCenterZ]} castShadow>
        <boxGeometry args={[w, frameThickness, frameDepth]} />
        <meshStandardMaterial color="#101114" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, -h / 2 + frameThickness / 2, frameCenterZ]} castShadow>
        <boxGeometry args={[w, frameThickness, frameDepth]} />
        <meshStandardMaterial color="#101114" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[-w / 2 + frameThickness / 2, 0, frameCenterZ]} castShadow>
        <boxGeometry args={[frameThickness, innerH, frameDepth]} />
        <meshStandardMaterial color="#101114" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[w / 2 - frameThickness / 2, 0, frameCenterZ]} castShadow>
        <boxGeometry args={[frameThickness, innerH, frameDepth]} />
        <meshStandardMaterial color="#101114" roughness={0.5} metalness={0.3} />
      </mesh>
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
// desk butted against it still reads as flush against a wall) topped by a
// transparent glazed panel instead of solid plaster — the "looking into a
// cutaway set box" look, seeing straight through to the black space void
// behind the room.
function PerimeterWall({
  center,
  length,
  axis,
  glass = false,
}: {
  center: [number, number];
  length: number;
  axis: "x" | "z";
  glass?: boolean;
}) {
  const plaster = useMemo(
    () => withRepeat(getPlasterTextures(), Math.max(2, Math.round(length / 2)), 1),
    [length],
  );
  // Thicker than the old 0.12 — reads as a real wall with depth instead of
  // a flat panel, especially visible at the open corner where you see the
  // wall's cut end.
  const thickness = 0.26;
  // Taller than the old 1.65 — reads as a real room-height wall behind the
  // open corner instead of a low partition.
  const wallHeight = 2.6;
  const capHeight = 0.05;
  const sillHeight = glass ? 0.35 : wallHeight;
  const glassHeight = wallHeight - sillHeight;
  // Maps (along-wall, height, across-wall) sizes onto world axes.
  const dims = (
    along: number,
    height: number,
    across: number,
  ): [number, number, number] =>
    axis === "x" ? [along, height, across] : [across, height, along];

  return (
    <group position={[center[0], 0, center[1]]}>
      <mesh position={[0, sillHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={dims(length, sillHeight, thickness)} />
        <meshStandardMaterial
          color="#ffffff"
          roughnessMap={plaster.roughnessMap}
          normalMap={plaster.normalMap}
          normalScale={[0.25, 0.25]}
          roughness={0.82}
          metalness={0.02}
        />
      </mesh>
      {glass ? (
        <mesh position={[0, sillHeight + glassHeight / 2, 0]} receiveShadow>
          <boxGeometry args={dims(length, glassHeight, thickness * 0.5)} />
          <meshStandardMaterial
            color="#051428"
            transparent
            opacity={0.4}
            roughness={0.15}
            metalness={0.8}
            emissive="#001830"
            emissiveIntensity={0.25}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
      {glass ? (
        <group position={[axis === "z" ? 0.12 : 0, sillHeight + glassHeight / 2, axis === "x" ? 0.12 : 0]}>
          <GlassAvatarScreenProjection length={length} glassHeight={glassHeight} axis={axis} />
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
      <mesh position={[0, wallHeight + capHeight / 2, 0]} castShadow>
        <boxGeometry args={dims(length, capHeight, thickness)} />
        <meshStandardMaterial color="#2b2f33" roughness={0.42} metalness={0.68} />
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

export const FloorAndWalls = memo(function FloorAndWalls({
  showRemoteOffice = true,
  whiteboardText = "Projekt Hermes 3D",
  onWhiteboardClick,
  screenTopic = null,
}: {
  showRemoteOffice?: boolean;
  whiteboardText?: string;
  onWhiteboardClick?: () => void;
  screenTopic?: string | null;
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
  const meetingZoneWidth = Math.max(0, MEETING_ROOM_RUG.w * SCALE);
  const meetingZoneHeight = Math.max(0, MEETING_ROOM_RUG.h * SCALE);
  const roomFloorInset = 0.08;
  const meetingZoneFloorWidth = Math.max(0, meetingZoneWidth - roomFloorInset * 2);
  const meetingZoneFloorHeight = Math.max(0, meetingZoneHeight - roomFloorInset * 2);
  const remoteOfficeOffsetZ = remoteOfficeCenterZ - localOfficeCenterZ;
  // Only north + west are built (see the PerimeterWall JSX below) — south
  // and east stay open so the room reads as an open corner, not a box.
  const localNorthWallZ = localOfficeCenterZ - localOfficeHeight / 2;
  const localWestWallX = localOfficeCenterX - localOfficeWidth / 2;
  const groundCenterX = showRemoteOffice ? districtCenterX : localOfficeCenterX;
  const groundCenterZ = showRemoteOffice ? districtCenterZ : localOfficeCenterZ;
  const groundWidth = showRemoteOffice ? districtWidth : localOfficeWidth;
  const groundHeight = showRemoteOffice ? districtHeight : localOfficeHeight;
  // Floor switched from wood-plank to black marble on request — see
  // useMarbleTexture above. 2x2 keeps the veining looking like large slabs
  // instead of a busy repeating tile at this floor's ~9x7 world-unit size.
  const marbleFloor = useMarbleTexture(2, 2);
  const floorSeamRepeatX = Math.max(1, Math.round(localOfficeWidth / 1.3));
  const floorSeamRepeatZ = Math.max(1, Math.round(localOfficeHeight / 1.3));
  const floorSeamTexture = useFloorSeamTexture(floorSeamRepeatX, floorSeamRepeatZ);
  const districtConcrete = useMemo(
    () => withRepeat(getConcreteTextures(), 10, 10),
    [],
  );
  const pathGrass = useMemo(() => withRepeat(getGrassTextures(), 14, 2), []);
  const pathConcrete = useMemo(() => withRepeat(getConcreteTextures(), 8, 1), []);

  return (
    <group>
      <mesh
        position={[groundCenterX, -0.015, groundCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[groundWidth, groundHeight, 24, 14]} />
        <meshStandardMaterial
          color="#e2e5e9"
          roughnessMap={districtConcrete.roughnessMap}
          normalMap={districtConcrete.normalMap}
          normalScale={[0.3, 0.3]}
          roughness={0.6}
          metalness={0.03}
        />
      </mesh>

      <mesh
        position={[groundCenterX, -0.012, groundCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[groundWidth * 0.95, groundHeight * 0.9]} />
        <meshStandardMaterial
          color="#eceef1"
          roughnessMap={districtConcrete.roughnessMap}
          normalMap={districtConcrete.normalMap}
          normalScale={[0.3, 0.3]}
          roughness={0.55}
          metalness={0.04}
        />
      </mesh>

      {/* A real slab, not a flat plane — boxGeometry gives it visible
          thickness/edge faces, which read clearly now that two sides of
          the room are open (no wall hides the cut edge). */}
      <mesh
        position={[localOfficeCenterX, -FLOOR_SLAB_THICKNESS / 2, localOfficeCenterZ]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[localOfficeWidth, FLOOR_SLAB_THICKNESS, localOfficeHeight]} />
        <meshPhysicalMaterial
          map={marbleFloor}
          color="#ffffff"
          roughness={0.12}
          clearcoat={0.9}
          clearcoatRoughness={0.08}
          metalness={0.03}
        />
      </mesh>

      {/* Contact shadows grounding the table + each seat — a real, always
          visible darkening instead of relying only on the (subtle, at this
          scale) ambient-occlusion pass. */}
      <FloorContactShadow
        position={[meetingZoneCenterX, 0.0015, meetingZoneCenterZ]}
        radius={1.3}
        opacity={0.28}
      />
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
            castShadow
          >
            <boxGeometry args={[localOfficeWidth, FLOOR_SLAB_THICKNESS, localOfficeHeight]} />
            <meshPhysicalMaterial
              map={marbleFloor}
              color="#ffffff"
              roughness={0.28}
              clearcoat={0.55}
              clearcoatRoughness={0.15}
              metalness={0.02}
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

          {Array.from({ length: 8 }).map((_, index) => {
            const [wx, , wz] = toWorld(330 + index * 170, 820 + (index % 2 === 0 ? -44 : 44));
            return (
              <mesh key={`garden-bed-${index}`} position={[wx, 0.03, wz]} castShadow receiveShadow>
                <boxGeometry args={[0.58, 0.06, 0.18]} />
                <meshStandardMaterial color="#5d4037" roughness={0.84} metalness={0.06} />
              </mesh>
            );
          })}

          {Array.from({ length: 8 }).map((_, index) => {
            const [wx, , wz] = toWorld(330 + index * 170, 820 + (index % 2 === 0 ? -44 : 44));
            return (
              <PlanterFoliage
                key={`garden-bed-top-${index}`}
                position={[wx, 0.09, wz]}
                spread={1.1}
              />
            );
          })}

          {Array.from({ length: 6 }).map((_, index) => {
            const [wx, , wz] = toWorld(420 + index * 190, 900);
            return (
              <group key={`garden-light-${index}`} position={[wx, 0, wz]}>
                <mesh position={[0, 0.2, 0]} castShadow>
                  <cylinderGeometry args={[0.025, 0.025, 0.4, 10]} />
                  <meshStandardMaterial color="#d7ccc8" roughness={0.62} metalness={0.24} />
                </mesh>
                <mesh position={[0, 0.43, 0]}>
                  <sphereGeometry args={[0.05, 12, 12]} />
                  <meshStandardMaterial color="#fff3cd" emissive="#fff3cd" emissiveIntensity={0.55} />
                </mesh>
              </group>
            );
          })}

          {Array.from({ length: 8 }).map((_, index) => {
            const [wx, , wz] = toWorld(220 + index * 190, 1005);
            return (
              <mesh
                key={`city-light-${index}`}
                position={[wx, 0.18, wz]}
                castShadow
                receiveShadow
              >
                <cylinderGeometry args={[0.04, 0.04, 0.36, 10]} />
                <meshStandardMaterial color="#d7ccc8" roughness={0.6} metalness={0.35} />
              </mesh>
            );
          })}

          {Array.from({ length: 4 }).map((_, index) => {
            const [wx, , wz] = toWorld(250 + index * 430, 955);
            return (
              <mesh key={`city-planter-${index}`} position={[wx, 0.08, wz]} castShadow>
                <boxGeometry args={[0.46, 0.14, 0.26]} />
                <meshStandardMaterial color="#5d4037" roughness={0.86} metalness={0.08} />
              </mesh>
            );
          })}

          {Array.from({ length: 4 }).map((_, index) => {
            const [wx, , wz] = toWorld(250 + index * 430, 955);
            return (
              <PlanterFoliage
                key={`city-planter-top-${index}`}
                position={[wx, 0.19, wz]}
                spread={0.85}
              />
            );
          })}
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
      />
      {showRemoteOffice ? (
        <PerimeterWall
          center={[localWestWallX, localOfficeCenterZ + remoteOfficeOffsetZ]}
          length={localOfficeHeight}
          axis="z"
          glass
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
      />
      <WallKanbanBoard
        position={[localOfficeCenterX + 140 * SCALE, 1.5, localNorthWallZ + 0.13]}
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
          />
          <WallKanbanBoard
            position={[
              localOfficeCenterX + 140 * SCALE,
              1.5,
              localNorthWallZ + 0.13 + remoteOfficeOffsetZ,
            ]}
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
