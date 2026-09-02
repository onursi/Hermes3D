"use client";

// Atmosphere and cinematic rendering systems for the immersive office:
// image-based lighting from a bundled CC0 HDRI (reflections/lighting only —
// no visible sky), a physically-plausible key light rig with soft shadows,
// a black-space void backdrop with a twinkling starfield (no grass/trees/
// horizon — the office reads as a lit room floating in space), drifting
// dust motes, and the post-processing chain (ambient occlusion, bloom,
// vignette, filmic tone mapping, SMAA, follow-cam depth of field).

import { Billboard, Environment } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  Bloom,
  DepthOfField,
  EffectComposer,
  N8AO,
  SMAA,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import type { DepthOfFieldEffect } from "postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Suspense, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import type { GraphicsQualityConfig } from "@/features/retro-office/core/graphicsQuality";
import {
  CANVAS_H,
  CANVAS_W,
  SCALE,
  WORLD_H,
  WORLD_W,
} from "@/features/retro-office/core/constants";
import {
  LOCAL_OFFICE_CANVAS_HEIGHT,
  LOCAL_OFFICE_CANVAS_WIDTH,
} from "@/features/retro-office/core/district";
import { toWorld } from "@/features/retro-office/core/geometry";

export const OFFICE_ENVIRONMENT_HDR = "/office-assets/env/office_env_1k.hdr";

/** Half-extent of the sun shadow frustum — covers the whole district. */
const SHADOW_EXTENT = Math.max(WORLD_W, WORLD_H) * 0.72;

/** Period of the subtle daylight drift, in seconds. */
const DAYLIGHT_DRIFT_PERIOD = 480;

const SUN_BASE_POSITION = new THREE.Vector3(16, 24, 13);
const SUN_WARM = new THREE.Color("#ffe3bd");
const SUN_NEUTRAL = new THREE.Color("#fff4e4");

/** Deterministic hash so the exterior looks identical across sessions. */
const hash1 = (n: number) => {
  let h = (n + 1) * 374761393;
  h = (h ^ (h >> 13)) * 1274126177;
  h ^= h >> 16;
  return (h >>> 0) / 4294967295;
};

/**
 * Slowly drifts the sun between a warm golden tone and neutral daylight so
 * the office feels alive without ever leaving flattering light. Kept subtle
 * on purpose — hard day/night swings fight the fixed HDRI sky.
 */
function DaylightDrift({
  sunRef,
}: {
  sunRef: MutableRefObject<THREE.DirectionalLight | null>;
}) {
  const elapsedRef = useRef(0);

  useFrame((_, delta) => {
    const sun = sunRef.current;
    if (!sun) return;
    elapsedRef.current += delta;
    const phase =
      (Math.sin((elapsedRef.current / DAYLIGHT_DRIFT_PERIOD) * Math.PI * 2) + 1) / 2;
    // Was 3.05 + phase*0.5 — this ran every frame and silently overrode
    // the <directionalLight intensity> prop entirely (along with the
    // warm/neutral color cycle below), which is why previous lighting
    // tweaks on the JSX prop never visibly changed anything: this is the
    // actual source of truth for the sun's live intensity/color.
    sun.intensity = 1.25 + phase * 0.3;
    sun.color.copy(SUN_WARM).lerp(SUN_NEUTRAL, phase);
    // Sun swings a few degrees across the sky over the drift period.
    const sway = (phase - 0.5) * 6;
    sun.position.set(
      SUN_BASE_POSITION.x + sway,
      SUN_BASE_POSITION.y,
      SUN_BASE_POSITION.z - sway * 0.5,
    );
  });

  return null;
}

const STAR_COUNT_PER_LAYER = 1800;
// Was 260 world units — for a room that's only ~9x7 world units across
// (the office footprint shrank a lot over this session, see district.ts),
// a shell that far out spread ~260 points across a sphere so vast they
// read as a faint, flat sprinkle instead of a starfield actually wrapping
// around the room, per "sieht aus wie ein unlebendiges schwarzes Blatt".
// Much closer + denser gives real parallax between layers and enough
// visible stars close to the visible frustum to read as a night sky.
const STAR_FIELD_RADIUS = 22;

/** One layer of the starfield — a fixed shell of points whose overall
 * brightness pulses on its own frequency/phase so the whole field
 * "flunkert" (twinkles) instead of just sitting there as a static skybox. */
function StarLayer({
  seed,
  size,
  baseOpacity,
  twinkleSpeed,
  color = "#ffffff",
}: {
  seed: number;
  size: number;
  baseOpacity: number;
  twinkleSpeed: number;
  /** Per-layer tint — real starfields aren't pure white (hot blue-white
   * giants, cool orange dwarfs), and it reads as "Farbeffekte" instead of a
   * flat monochrome sprinkle. */
  color?: string;
}) {
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const phase = useMemo(() => hash1(seed * 31) * Math.PI * 2, [seed]);
  const positions = useMemo(() => {
    const array = new Float32Array(STAR_COUNT_PER_LAYER * 3);
    for (let index = 0; index < STAR_COUNT_PER_LAYER; index += 1) {
      // Random point on a sphere shell (rejection-free polar method), so
      // stars surround the office instead of clustering at the poles.
      const u = hash1(seed * 101 + index * 7);
      const v = hash1(seed * 211 + index * 13);
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      // Was 0.7-1.3x radius — left a conspicuous star-free halo immediately
      // around the room (nothing closer than ~0.7x the shell). 0.35x still
      // clears the room's own bounding radius (~5-6 units) with margin, so
      // stars can come in much closer while never appearing to sit inside
      // the room itself.
      const radius = STAR_FIELD_RADIUS * (0.35 + hash1(seed * 7 + index) * 1.05);
      array[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      array[index * 3 + 1] = radius * Math.cos(phi);
      array[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    return array;
  }, [seed]);

  useFrame(({ clock }) => {
    const material = materialRef.current;
    if (!material) return;
    const pulse = (Math.sin(clock.elapsedTime * twinkleSpeed + phase) + 1) / 2;
    material.opacity = baseOpacity * (0.5 + pulse * 0.5);
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        color={color}
        size={size}
        sizeAttenuation
        transparent
        opacity={baseOpacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/** A soft, dim, colored glow disc — several overlapping ones behind the
 * stars read as distant nebula gas, giving the black void some actual
 * depth/color instead of being pure flat black between the points. Always
 * faces the camera so it reads as a soft glow from any angle. */
function NebulaGlow({
  position,
  color,
  radius,
  opacity,
}: {
  position: [number, number, number];
  color: string;
  radius: number;
  opacity: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.4, "rgba(255,255,255,0.35)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  return (
    <Billboard position={position}>
      <mesh>
        <planeGeometry args={[radius, radius]} />
        <meshBasicMaterial
          map={texture}
          color={color}
          transparent
          opacity={opacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </Billboard>
  );
}

/** A distant spiral galaxy, drawn on canvas (soft core + curved dust-lane
 * arms of dot clusters) and rendered as a big additive billboard — the
 * single recognizable "there's a galaxy out there" focal point the plain
 * star shell doesn't give you, visible through the glass wall the same way
 * a real window would show a distant galaxy at a fixed spot in the sky. */
function SpiralGalaxy({
  position,
  size = 30,
}: {
  position: [number, number, number];
  size?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);
    const cx = 256;
    const cy = 256;
    // Soft bright core.
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
    core.addColorStop(0, "rgba(255,250,235,1)");
    core.addColorStop(0.3, "rgba(255,240,210,0.7)");
    core.addColorStop(1, "rgba(255,240,210,0)");
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, 512, 512);
    // Two spiral arms, each a scattering of soft dots along a log-spiral
    // curve — reads as dust/star clusters rather than a smooth solid swirl.
    const seedRandom = (n: number) => {
      let h = (n + 1) * 374761393;
      h = (h ^ (h >> 13)) * 1274126177;
      h ^= h >> 16;
      return (h >>> 0) / 4294967295;
    };
    for (let arm = 0; arm < 2; arm += 1) {
      for (let i = 0; i < 260; i += 1) {
        const t = i / 260;
        const angle = t * Math.PI * 4.2 + arm * Math.PI;
        const radius = 18 + t * 200;
        const jitter = (seedRandom(arm * 1000 + i) - 0.5) * 26 * (0.3 + t);
        const px = cx + Math.cos(angle) * radius + jitter;
        const py = cy + Math.sin(angle) * radius * 0.45 + jitter * 0.5;
        const dotSize = 1.5 + seedRandom(arm * 2000 + i) * 3.5 * (1 - t * 0.6);
        const alpha = (1 - t) * 0.5 + 0.08;
        ctx.fillStyle = `rgba(232, 224, 255, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  return (
    <Billboard position={position}>
      <mesh>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </Billboard>
  );
}

/** Starfield + nebula glow ringing the office — several independently
 * twinkling point layers plus a few soft color washes, instead of a static,
 * flat-black skybox with sparse dots. Wrapped in a group centered on the
 * local office (not world origin, which sits well outside the room — see
 * toWorld's CANVAS_W/H-based offset in core/geometry.ts) so the shell
 * actually surrounds what the camera looks at. */
function Starfield({ center }: { center: [number, number, number] }) {
  return (
    <group position={center}>
      <StarLayer seed={1} size={0.05} baseOpacity={0.95} twinkleSpeed={0.6} color="#ffffff" />
      <StarLayer seed={2} size={0.08} baseOpacity={0.75} twinkleSpeed={0.35} color="#bcd7ff" />
      <StarLayer seed={3} size={0.12} baseOpacity={0.6} twinkleSpeed={0.9} color="#ffe4c2" />
      <StarLayer seed={4} size={0.035} baseOpacity={0.85} twinkleSpeed={1.2} color="#ffffff" />
      <StarLayer seed={5} size={0.06} baseOpacity={0.5} twinkleSpeed={0.5} color="#d9c2ff" />
      <StarLayer seed={6} size={0.025} baseOpacity={0.7} twinkleSpeed={1.6} color="#c2f5ff" />
      {/* Negative X is through the west (glass) wall — see localWestWallX
          in scene/environment.tsx — so the galaxy sits at a fixed spot
          visible through the glass, like a real window onto space. */}
      <SpiralGalaxy position={[-42, 9, -4]} size={34} />
      <NebulaGlow
        position={[-14, 6, -10]}
        color="#5b6fd8"
        radius={20}
        opacity={0.1}
      />
      <NebulaGlow
        position={[12, -4, -16]}
        color="#a75bd8"
        radius={16}
        opacity={0.08}
      />
      <NebulaGlow
        position={[-6, -10, 14]}
        color="#3fb6c9"
        radius={14}
        opacity={0.07}
      />
    </group>
  );
}

const DUST_COUNT = 220;

/**
 * Faint warm dust motes drifting through the office air — invisible from
 * afar, magical up close and in follow-cam.
 */
function DustMotes({
  centerX,
  centerZ,
  extentX,
  extentZ,
}: {
  centerX: number;
  centerZ: number;
  extentX: number;
  extentZ: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const { positions, speeds, phases } = useMemo(() => {
    const positionsArray = new Float32Array(DUST_COUNT * 3);
    const speedsArray = new Float32Array(DUST_COUNT);
    const phasesArray = new Float32Array(DUST_COUNT);
    for (let index = 0; index < DUST_COUNT; index += 1) {
      positionsArray[index * 3] = centerX + (hash1(index * 3 + 1) - 0.5) * extentX;
      positionsArray[index * 3 + 1] = 0.15 + hash1(index * 3 + 2) * 2.1;
      positionsArray[index * 3 + 2] = centerZ + (hash1(index * 3 + 3) - 0.5) * extentZ;
      speedsArray[index] = 0.02 + hash1(index * 5 + 4) * 0.05;
      phasesArray[index] = hash1(index * 7 + 5) * Math.PI * 2;
    }
    return { positions: positionsArray, speeds: speedsArray, phases: phasesArray };
  }, [centerX, centerZ, extentX, extentZ]);

  useFrame(({ clock }) => {
    const points = pointsRef.current;
    if (!points) return;
    const attribute = points.geometry.getAttribute("position") as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;
    const time = clock.elapsedTime;
    for (let index = 0; index < DUST_COUNT; index += 1) {
      let y = array[index * 3 + 1] + speeds[index] * 0.016;
      if (y > 2.4) y = 0.15;
      array[index * 3 + 1] = y;
      array[index * 3] += Math.sin(time * 0.3 + phases[index]) * 0.0006;
      array[index * 3 + 2] += Math.cos(time * 0.24 + phases[index]) * 0.0006;
    }
    attribute.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#ffe9c4"
        size={0.032}
        sizeAttenuation
        transparent
        opacity={0.32}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export function SceneAtmosphere({
  config,
  remoteOfficeEnabled = true,
}: {
  config: GraphicsQualityConfig;
  remoteOfficeEnabled?: boolean;
}) {
  const sunRef = useRef<THREE.DirectionalLight | null>(null);

  // The active grounds match the district when the remote office is shown,
  // otherwise just the local office footprint. Still used to center the
  // dust motes over whichever footprint is active.
  const [districtCenterX, , districtCenterZ] = toWorld(CANVAS_W / 2, CANVAS_H / 2);
  const [localCenterX, , localCenterZ] = toWorld(
    LOCAL_OFFICE_CANVAS_WIDTH / 2,
    LOCAL_OFFICE_CANVAS_HEIGHT / 2,
  );
  const groundCenterX = remoteOfficeEnabled ? districtCenterX : localCenterX;
  const groundCenterZ = remoteOfficeEnabled ? districtCenterZ : localCenterZ;
  const groundWidth = remoteOfficeEnabled ? CANVAS_W * SCALE : LOCAL_OFFICE_CANVAS_WIDTH * SCALE;
  const groundHeight = remoteOfficeEnabled
    ? CANVAS_H * SCALE
    : LOCAL_OFFICE_CANVAS_HEIGHT * SCALE;

  return (
    <>
      {/* Black-space void with a twinkling starfield — no grass/sky/
          horizon. The lit office floats in the dark instead of sitting in a
          white studio backdrop. */}
      <color attach="background" args={["#03040a"]} />
      {/* Short-range fog only, matched to the void color so it never washes
          out into a visible gray horizon band against the black. */}
      <fog attach="fog" args={["#03040a", 90, 240]} />
      <Starfield center={[localCenterX, 0, localCenterZ]} />

      {/* HDRI kept for image-based lighting/reflections only — background
          disabled so its sky is never visible behind the black void. */}
      <Suspense fallback={null}>
        <Environment
          files={OFFICE_ENVIRONMENT_HDR}
          background={false}
          environmentIntensity={0.4}
          environmentRotation={[0, Math.PI * 0.85, 0]}
        />
      </Suspense>

      {/* Cool, dim ambient fill — a space-night mood behind the office's
          own bright interior lighting, instead of a bright sky bounce. */}
      <hemisphereLight args={["#3a4560", "#0a0b12", 0.3]} />

      {/* Clean, neutral-white key light with tight, high-resolution soft
          shadows — a studio look instead of a warm outdoor sun. Intensity
          was 3.1, tuned for the old warm-wood floor's darker albedo; against
          this room's near-white walls/floor (high diffuse reflectance) that
          blew the whole scene out to flat white. */}
      <directionalLight
        ref={sunRef}
        position={SUN_BASE_POSITION.toArray()}
        intensity={1.4}
        color="#ffffff"
        castShadow
        shadow-mapSize={[config.shadowMapSize, config.shadowMapSize]}
        shadow-bias={-0.00015}
        shadow-normalBias={0.025}
        shadow-radius={4}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={1}
        shadow-camera-far={90}
      />

      {/* Cool fill from the opposite side — lifts shadowed faces. */}
      <directionalLight position={[-14, 12, -10]} intensity={0.3} color="#dce6f5" />

      {/* Drifting dust motes over the office interior. */}
      <DustMotes
        centerX={groundCenterX}
        centerZ={groundCenterZ}
        extentX={groundWidth * 0.9}
        extentZ={groundHeight * 0.9}
      />

      <DaylightDrift sunRef={sunRef} />
    </>
  );
}

/**
 * Keeps the depth-of-field focus locked on the followed agent by measuring
 * the camera-to-focus-point distance each frame.
 */
function FollowFocusUpdater({
  dofRef,
  focusPointRef,
}: {
  dofRef: MutableRefObject<DepthOfFieldEffect | null>;
  focusPointRef: MutableRefObject<THREE.Vector3>;
}) {
  useFrame(({ camera }) => {
    const dof = dofRef.current;
    if (!dof) return;
    const distance = camera.position.distanceTo(focusPointRef.current);
    dof.cocMaterial.worldFocusDistance = distance;
  });
  return null;
}

export function ScenePostFx({
  config,
  followActive,
  followFocusPointRef,
}: {
  config: GraphicsQualityConfig;
  followActive: boolean;
  followFocusPointRef: MutableRefObject<THREE.Vector3>;
}) {
  const dofRef = useRef<DepthOfFieldEffect | null>(null);
  const showDof = followActive && config.followDepthOfField;

  if (!config.postProcessing) return null;

  return (
    <>
      {showDof ? (
        <FollowFocusUpdater dofRef={dofRef} focusPointRef={followFocusPointRef} />
      ) : null}
      <EffectComposer multisampling={0}>
        {config.ambientOcclusion ? (
          <N8AO
            halfRes
            depthAwareUpsampling
            quality={config.aoQuality}
            // aoRadius/distanceFalloff were tuned for the old 1800-canvas
            // room (~3.6x larger than the current 500-canvas one) — at that
            // radius, AO barely hugged contact points on furniture this
            // small, reading as weak/soft instead of grounding objects to
            // the floor. Shrunk to match, with intensity nudged up for
            // punchier contact shadows under chairs/table/whiteboard.
            aoRadius={0.18}
            distanceFalloff={0.5}
            intensity={3.2}
          />
        ) : (
          <></>
        )}
        {config.bloom ? (
          <Bloom
            mipmapBlur
            intensity={0.3}
            luminanceThreshold={1.3}
            luminanceSmoothing={0.25}
          />
        ) : (
          <></>
        )}
        {showDof ? (
          <DepthOfField
            ref={dofRef}
            worldFocusDistance={2.2}
            worldFocusRange={1.6}
            bokehScale={4}
            focalLength={0.06}
          />
        ) : (
          <></>
        )}
        <Vignette eskil={false} offset={0.26} darkness={0.55} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        {config.smaa ? <SMAA /> : <></>}
      </EffectComposer>
    </>
  );
}
