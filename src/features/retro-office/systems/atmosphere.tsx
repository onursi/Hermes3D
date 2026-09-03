"use client";

// Atmosphere and cinematic rendering systems for the immersive office:
// image-based lighting from a bundled CC0 HDRI (reflections/lighting only —
// no visible sky), a physically-plausible key light rig with soft shadows,
// a black-space void backdrop with a twinkling starfield (no grass/trees/
// horizon — the office reads as a lit room floating in space), drifting
// dust motes, and the post-processing chain (ambient occlusion, bloom,
// vignette, filmic tone mapping, SMAA, follow-cam depth of field).

import { Billboard, Environment, useGLTF } from "@react-three/drei";
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
} from "@/features/retro-office/core/constants";
import {
  LOCAL_OFFICE_CANVAS_HEIGHT,
  LOCAL_OFFICE_CANVAS_WIDTH,
} from "@/features/retro-office/core/district";
import { toWorld } from "@/features/retro-office/core/geometry";

export const OFFICE_ENVIRONMENT_HDR = "/office-assets/env/office_env_1k.hdr";

/**
 * Slack added around the active footprint so walls, shelves and anything
 * standing at the very edge still throw their shadow inward. The tallest wall
 * is ~2.6 m and the sun sits at roughly 50°, so ~2.2 m of throw plus headroom.
 */
const SHADOW_MARGIN = 3;

/**
 * Half-extent of the sun's shadow frustum, derived from whichever footprint is
 * actually on screen.
 *
 * This used to be `max(WORLD_W, WORLD_H) * 0.72` — 28.5, i.e. a 57 x 57 m
 * frustum sized for the old district canvas. The local office is 9.0 x 7.2 m,
 * so 98 % of the shadow map covered empty space and a single texel spanned
 * 28 mm. At that resolution most casters cannot produce a shadow anyone can
 * see, which is why the room's shadows read as mush rather than as shape.
 */
function shadowExtentFor(width: number, height: number) {
  return Math.max(width, height) / 2 + SHADOW_MARGIN;
}

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
    // Balanced studio lighting: eliminates specular blowout on the marble floor
    sun.intensity = 0.55 + phase * 0.15;
    sun.color.copy(SUN_WARM).lerp(SUN_NEUTRAL, phase);
    // The sun deliberately does not move any more. It used to sway a few
    // degrees over the drift period, which nobody could see at this distance
    // but which invalidated the shadow map on every single frame — the sun is
    // the only shadow caster left, so a still sun is what makes caching the
    // map possible at all. Its position is also office-relative now (see the
    // directionalLight below); rewriting it here would drag it back to the
    // world origin and pull the room out of its own shadow frustum.
  });

  return null;
}

// ============================================================================
// 100% GPU-ACCELERATED COSMIC SHADERS (120 FPS / ZERO CPU OVERHEAD)
// ============================================================================

const COSMIC_STAR_VERTEX = `
  attribute float aSize;
  attribute vec3 aColor;
  attribute vec2 aTwinkle;
  varying vec3 vColor;
  varying float vTwinkle;
  uniform float uTime;

  void main() {
    vColor = aColor;
    float tw = sin(uTime * aTwinkle.x + aTwinkle.y);
    vTwinkle = 0.65 + 0.35 * tw;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (175.0 / -mvPosition.z) * vTwinkle;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const COSMIC_STAR_FRAGMENT = `
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    float core = smoothstep(0.5, 0.04, dist);
    float glow = exp(-dist * 4.2);
    float alpha = (core * 0.85 + glow * 0.45) * vTwinkle;
    gl_FragColor = vec4(vColor * 1.35, alpha);
  }
`;

const NEBULA_VERTEX = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const NEBULA_FRAGMENT = `
  varying vec3 vWorldPosition;
  uniform float uTime;

  void main() {
    vec3 dir = normalize(vWorldPosition);
    float galPlane = exp(-abs(dir.y) * 3.2);
    vec3 deepVoid = vec3(0.012, 0.02, 0.04);
    vec3 cyanGlow = vec3(0.02, 0.08, 0.16) * sin(dir.x * 2.2 + uTime * 0.02);
    vec3 violetGlow = vec3(0.07, 0.03, 0.12) * cos(dir.z * 2.0 - uTime * 0.015);
    vec3 col = deepVoid + (cyanGlow + violetGlow + vec3(0.03, 0.05, 0.10)) * galPlane * 0.85;
    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * 60,000+ Astronomical Stars in a single GPU draw call with spectral colors
 * and real-time stochastic twinkling on the shader pipeline.
 */
function CosmicStarfieldShader({ count = 64000 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const shaderMatRef = useRef<THREE.ShaderMaterial>(null);

  const [geometry, uniforms] = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const twinkles = new Float32Array(count * 2);

    // Astronomical Spectral Classes (Hertzsprung-Russell)
    const spectralColors = [
      new THREE.Color("#bcd7ff"), // Class O/B: Hot blue-white (45%)
      new THREE.Color("#ffffff"), // Class A/F: Pure bright white (35%)
      new THREE.Color("#ffe8a3"), // Class G: Warm solar gold (15%)
      new THREE.Color("#ff8b60"), // Class M: Red Supergiant (5%)
    ];

    for (let i = 0; i < count; i++) {
      const u = hash1(i * 13 + 1);
      const v = hash1(i * 37 + 7);
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);

      // Layered depth shells: Near (20-55), Mid (55-110), Deep infinity (110-185)
      const shellSelector = hash1(i * 7 + 3);
      const radius = shellSelector < 0.3
        ? 18 + hash1(i * 11) * 38
        : shellSelector < 0.7
          ? 56 + hash1(i * 19) * 54
          : 110 + hash1(i * 29) * 75;

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi) * 0.88;
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      // Star size distribution: mostly fine pinpricks with rare brilliant beacons
      const sizeRand = hash1(i * 47);
      sizes[i] = sizeRand > 0.985 ? 0.48 : sizeRand > 0.85 ? 0.26 : 0.13;

      // Assign spectral color
      const colorRand = hash1(i * 59);
      const color = colorRand < 0.45
        ? spectralColors[0]
        : colorRand < 0.80
          ? spectralColors[1]
          : colorRand < 0.95
            ? spectralColors[2]
            : spectralColors[3];

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      // Twinkle parameters: frequency (0.4 - 3.2 rad/s) & phase (0 - 2PI)
      twinkles[i * 2] = 0.4 + hash1(i * 71) * 2.8;
      twinkles[i * 2 + 1] = hash1(i * 83) * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aTwinkle", new THREE.BufferAttribute(twinkles, 2));

    const uni = {
      uTime: { value: 0 },
    };

    return [geo, uni];
  }, [count]);

  useFrame((_, delta) => {
    if (shaderMatRef.current) {
      shaderMatRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <shaderMaterial
        ref={shaderMatRef}
        vertexShader={COSMIC_STAR_VERTEX}
        fragmentShader={COSMIC_STAR_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/** Ethereal Deep Space Celestial Nebula Sky Dome */
function CosmicNebulaDome() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh>
      <sphereGeometry args={[190, 32, 32]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={NEBULA_VERTEX}
        fragmentShader={NEBULA_FRAGMENT}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
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
          fog={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </Billboard>
  );
}

type GalaxyColorTheme = "violet" | "cyan" | "gold" | "rose" | "emerald";

const PINPOINT_8K_GALAXY_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PINPOINT_8K_GALAXY_FRAGMENT = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColorCore;
  uniform vec3 uColorArm;
  uniform vec3 uColorDust;
  uniform float uArms;
  uniform float uSpeed;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;

    float angle = atan(p.y, p.x);
    float rotSpeed = uSpeed * (0.12 + 0.35 / (r + 0.12));
    float rotAngle = angle - uTime * rotSpeed;

    // Logarithmic spiral arms
    float spiral = sin(rotAngle * uArms - log(max(0.005, r)) * 4.2);
    spiral = smoothstep(-0.25, 0.85, spiral);

    // Fractal dust modulation
    float dust = noise(vec2(rotAngle * 1.5, r * 4.5) + vec2(uTime * 0.04, 0.0));
    dust += 0.5 * noise(vec2(rotAngle * 3.0, r * 9.0));

    // Dense bright galactic core
    float coreGlow = exp(-r * 7.5) * 2.5;
    float innerBulge = exp(-r * 3.4);

    // Arm density
    float armDensity = spiral * (1.0 - dust * 0.35) * innerBulge;

    // Pinprick star cluster highlights in 8K
    float starSeed = hash21(floor(p * 80.0));
    float stars = pow(starSeed, 16.0) * spiral * 3.2;

    vec3 col = uColorCore * coreGlow;
    col += uColorArm * (armDensity * 1.5 + stars);
    col += uColorDust * (dust * innerBulge * 0.4);

    float alpha = smoothstep(1.0, 0.25, r) * min(1.0, coreGlow + armDensity + stars * 0.85);
    gl_FragColor = vec4(col * 1.5, alpha);
  }
`;

const GALAXY_COLOR_PALETTES: Record<
  GalaxyColorTheme,
  { core: THREE.Color; arm: THREE.Color; dust: THREE.Color }
> = {
  cyan: {
    core: new THREE.Color("#ffffff"),
    arm: new THREE.Color("#38bdf8"),
    dust: new THREE.Color("#0284c7"),
  },
  violet: {
    core: new THREE.Color("#ffffff"),
    arm: new THREE.Color("#c084fc"),
    dust: new THREE.Color("#7e22ce"),
  },
  gold: {
    core: new THREE.Color("#ffffff"),
    arm: new THREE.Color("#fbbf24"),
    dust: new THREE.Color("#ea580c"),
  },
  rose: {
    core: new THREE.Color("#ffffff"),
    arm: new THREE.Color("#f472b6"),
    dust: new THREE.Color("#db2777"),
  },
  emerald: {
    core: new THREE.Color("#ffffff"),
    arm: new THREE.Color("#34d399"),
    dust: new THREE.Color("#059669"),
  },
};

function SpiralGalaxy({
  position,
  size = 28,
  theme = "cyan",
  arms = 2,
  speed = 0.06,
}: {
  position: [number, number, number];
  size?: number;
  theme?: GalaxyColorTheme;
  arms?: number;
  tilt?: number;
  speed?: number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const palette = GALAXY_COLOR_PALETTES[theme] ?? GALAXY_COLOR_PALETTES.cyan;

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorCore: { value: palette.core },
      uColorArm: { value: palette.arm },
      uColorDust: { value: palette.dust },
      uArms: { value: arms },
      uSpeed: { value: speed },
    }),
    [palette, arms, speed],
  );

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <Billboard position={position}>
      <mesh>
        <planeGeometry args={[size, size]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={PINPOINT_8K_GALAXY_VERTEX}
          fragmentShader={PINPOINT_8K_GALAXY_FRAGMENT}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </Billboard>
  );
}

/**
 * Majestic Milky Way Galactic Arch — a dense celestial stream of stardust,
 * clusters and cosmic clouds stretching across the space station sky.
 */
function MilkyWayBand() {
  const positions = useMemo(() => {
    const count = 9500;
    const array = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Angle along the arching celestial ring
      const t = (i / count) * Math.PI * 2;
      const radius = 48 + Math.sin(t * 3) * 6;
      // Dense cluster with Gaussian dispersion along the galactic equator
      const dispersion = (Math.random() - 0.5) * 14 * (1 + 0.4 * Math.sin(t * 2));
      const depthJitter = (Math.random() - 0.5) * 12;

      // 40-degree tilted galactic plane
      const x = Math.cos(t) * radius + dispersion * 0.5;
      const y = Math.sin(t) * radius * 0.82 + dispersion;
      const z = Math.sin(t) * radius * 0.72 + depthJitter;

      array[i * 3] = x;
      array[i * 3 + 1] = y;
      array[i * 3 + 2] = z;
    }
    return array;
  }, []);

  return (
    <group>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#dbeafe"
          size={0.15}
          sizeAttenuation={true}
          transparent
          opacity={0.82}
          depthWrite={false}
          fog={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* Ethereal glowing Milky Way interstellar dust clouds along the band */}
      <NebulaGlow position={[-25, 18, -12]} color="#818cf8" radius={32} opacity={0.25} />
      <NebulaGlow position={[12, 22, -18]} color="#06b6d4" radius={30} opacity={0.22} />
      <NebulaGlow position={[28, 12, 14]} color="#c084fc" radius={28} opacity={0.24} />
      <NebulaGlow position={[-18, -14, 22]} color="#ec4899" radius={30} opacity={0.2} />
    </group>
  );
}

const SHOOTING_STAR_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SHOOTING_STAR_FRAGMENT = `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uOpacity;

  void main() {
    // Razor-sharp needle profile along Y axis
    float needle = exp(-abs(vUv.y - 0.5) * 32.0);
    // Exponential tail falloff from incandescent tip (vUv.x == 1.0) to tail (vUv.x == 0.0)
    float tail = pow(vUv.x, 2.2);
    // Super-hot incandescent tip
    float tipCore = pow(vUv.x, 16.0) * needle * 4.0;
    
    vec3 col = mix(uColor, vec3(1.0, 1.0, 1.0), pow(vUv.x, 3.5)) * needle * tail;
    col += vec3(1.2) * tipCore;

    float alpha = (needle * tail + tipCore) * uOpacity;
    gl_FragColor = vec4(col * 2.5, min(1.0, alpha));
  }
`;

type ShootingStarState = {
  active: boolean;
  progress: number;
  duration: number;
  length: number;
  start: THREE.Vector3;
  dir: THREE.Vector3;
  color: THREE.Color;
  nextLaunch: number;
};

/** Razor-sharp 8K Relativistic Shooting Stars streaking across the cosmos */
function PinpointShootingStars({ count = 5 }: { count?: number }) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const matRefs = useRef<(THREE.ShaderMaterial | null)[]>([]);

  const colors = useMemo(
    () => [
      new THREE.Color("#38bdf8"), // Electric Cyan
      new THREE.Color("#ffffff"), // Pure Diamond White
      new THREE.Color("#fbbf24"), // Solar Gold
      new THREE.Color("#c084fc"), // Quantum Violet
      new THREE.Color("#34d399"), // Emerald Pulse
    ],
    [],
  );

  const stars = useRef<ShootingStarState[]>(
    Array.from({ length: count }, (_, i) => ({
      active: false,
      progress: 0,
      duration: 0.8,
      length: 12,
      start: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      color: colors[i % colors.length],
      nextLaunch: 1.0 + i * 2.2,
    })),
  );

  const launchStar = (star: ShootingStarState) => {
    star.active = true;
    star.progress = 0;
    star.duration = 0.55 + Math.random() * 0.55;
    star.length = 10 + Math.random() * 12;

    const theta = Math.random() * Math.PI * 2;
    const phi = 0.2 + Math.random() * 0.6;
    const radius = 60 + Math.random() * 18;

    star.start.set(
      Math.sin(phi) * Math.cos(theta) * radius,
      Math.cos(phi) * radius + 12,
      Math.sin(phi) * Math.sin(theta) * radius,
    );

    const angle = Math.random() * Math.PI * 2;
    star.dir.set(
      Math.cos(angle) * 30,
      -10 - Math.random() * 16,
      Math.sin(angle) * 30,
    ).normalize();
  };

  useFrame((_, delta) => {
    stars.current.forEach((star, idx) => {
      const mesh = meshRefs.current[idx];
      const mat = matRefs.current[idx];
      if (!mesh || !mat) return;

      if (!star.active) {
        star.nextLaunch -= delta;
        if (star.nextLaunch <= 0) {
          launchStar(star);
        }
        mesh.visible = false;
        return;
      }

      star.progress += delta / star.duration;
      if (star.progress >= 1) {
        star.active = false;
        mesh.visible = false;
        star.nextLaunch = 2.0 + Math.random() * 5.0;
        return;
      }

      mesh.visible = true;
      const currentPos = star.start.clone().addScaledVector(star.dir, star.progress * 42);
      mesh.position.copy(currentPos);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), star.dir);

      const opacity = Math.sin(star.progress * Math.PI);
      mat.uniforms.uOpacity.value = opacity;
    });
  });

  return (
    <group>
      {stars.current.map((star, idx) => (
        <mesh
          key={idx}
          ref={(el) => {
            meshRefs.current[idx] = el;
          }}
          visible={false}
        >
          <planeGeometry args={[star.length, 0.22]} />
          <shaderMaterial
            ref={(el) => {
              matRefs.current[idx] = el;
            }}
            vertexShader={SHOOTING_STAR_VERTEX}
            fragmentShader={SHOOTING_STAR_FRAGMENT}
            uniforms={{
              uColor: { value: star.color },
              uOpacity: { value: 1.0 },
            }}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

let cachedEarthTexture: THREE.Texture | null = null;
function getEarthTexture(): THREE.Texture {
  if (!cachedEarthTexture && typeof window !== "undefined") {
    const loader = new THREE.TextureLoader();
    cachedEarthTexture = loader.load("/office-assets/textures/earth.jpg");
    cachedEarthTexture.colorSpace = THREE.SRGBColorSpace;
  }
  return cachedEarthTexture!;
}

export function PlanetEarth({
  position = [-38, -2, -18],
  radius = 6.8,
}: {
  position?: [number, number, number];
  radius?: number;
}) {
  const earthRef = useRef<THREE.Group>(null);
  const texture = useMemo(() => getEarthTexture(), []);

  useFrame((_, delta) => {
    if (earthRef.current) {
      earthRef.current.rotation.y += delta * 0.03;
      earthRef.current.rotation.x = 0.23; // Earth's 23.5 degree axial tilt
    }
  });

  return (
    <group position={position}>
      <group ref={earthRef}>
        <mesh receiveShadow={false}>
          <sphereGeometry args={[radius, 64, 64]} />
          <meshStandardMaterial
            map={texture}
            roughness={0.55}
            metalness={0.05}
          />
        </mesh>
      </group>
      {/* Subtle atmospheric blue Rayleigh scattering rim glow */}
      <mesh>
        <sphereGeometry args={[radius * 1.02, 48, 48]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.16}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

export const SpaceEarthBackdrop = PlanetEarth;

function SpaceXRocket({
  startPos = [-35, 8, -25],
  direction = [0.8, 0.15, 0.4],
  speed = 1.4,
}: {
  startPos?: [number, number, number];
  direction?: [number, number, number];
  speed?: number;
}) {
  const rocketRef = useRef<THREE.Group>(null);
  const travelRef = useRef(0);

  useFrame((_, delta) => {
    if (!rocketRef.current) return;
    travelRef.current = (travelRef.current + delta * speed) % 80;
    rocketRef.current.position.set(
      startPos[0] + direction[0] * travelRef.current,
      startPos[1] + direction[1] * travelRef.current,
      startPos[2] + direction[2] * travelRef.current,
    );
  });

  return (
    <group ref={rocketRef} rotation={[0.2, -0.6, 0.1]} scale={1.2}>
      {/* Fuselage */}
      <mesh>
        <cylinderGeometry args={[0.2, 0.26, 2.2, 16]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Nose cone */}
      <mesh position={[0, 1.4, 0]}>
        <coneGeometry args={[0.2, 0.65, 16]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Delta Fins */}
      {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((ang, i) => (
        <mesh key={`fin-${i}`} position={[Math.cos(ang) * 0.22, -0.85, Math.sin(ang) * 0.22]} rotation={[0, -ang, 0]}>
          <boxGeometry args={[0.22, 0.42, 0.03]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}
      {/* Glowing Plasma Thruster Flame */}
      <mesh position={[0, -1.45, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.16, 0.75, 12]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.85} />
      </mesh>
    </group>
  );
}



/** Starfield + nebula glow ringing the office */
function Starfield({ center }: { center: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.0006;
    }
  });

  return (
    <group ref={groupRef} position={center}>
      {/* 1. KOSMISCHE TIEFEN-NEBELKUPPEL (Raymarched Interstellar Glow) */}
      <CosmicNebulaDome />

      {/* 2. 64.000 ASTRONOMISCHE STERNE (100% GPU-Shader, 120 FPS, 1 Draw Call) */}
      <CosmicStarfieldShader count={64000} />

      {/* 3. MILCHSTRASSE: Gewaltiges galaktisches Band aus Sternenstaub & Wolken */}
      <MilkyWayBand />

      {/* Photorealistic Planet Earth rotating in clear foreground outside station window */}
      <PlanetEarth position={[-18, 1.2, -6]} radius={3.6} />

      {/* Cruising SpaceX Rockets in deep space */}
      <SpaceXRocket startPos={[-30, 5, -20]} direction={[0.85, 0.1, 0.3]} speed={2.0} />
      <SpaceXRocket startPos={[24, 9, -28]} direction={[-0.8, -0.06, 0.35]} speed={1.6} />

      {/* 4. FARBENFROHE, STERNENREICHE SPIRALGALAXIEN (Sauber räumlich gestaffelt) */}
      {/* West Galaxy (Aqua Cyan Whirlpool) — weit im tiefen Hintergrund */}
      <SpiralGalaxy position={[-46, 12, 12]} size={38} theme="cyan" arms={2} tilt={0.5} />

      {/* North Galaxy (Andromeda Tiefviolett/Purpur) */}
      <SpiralGalaxy position={[0, 9, -26]} size={30} theme="violet" arms={3} tilt={0.6} />

      {/* North-West Galaxy (Goldener Supernova-Kern) */}
      <SpiralGalaxy position={[-24, 18, -36]} size={28} theme="gold" arms={2} tilt={0.45} />

      {/* East Galaxy (Cosmic Rose / Pinke Spirale) */}
      <SpiralGalaxy position={[26, 7, 12]} size={30} theme="rose" arms={2} tilt={0.55} />

      {/* South-East Galaxy (Smaragdgrüne Helix) */}
      <SpiralGalaxy position={[16, -5, 26]} size={26} theme="emerald" arms={3} tilt={0.6} />

      {/* 5. MESSERSCHARFE 8K STERNSCHNUPPEN & RELATIVISTISCHE PLASMASCHWEIFE */}
      <PinpointShootingStars count={5} />
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

  useFrame(({ clock }, delta) => {
    const points = pointsRef.current;
    if (!points) return;
    points.rotation.y += delta * 0.015;
    points.position.y = Math.sin(clock.elapsedTime * 0.4) * 0.04;
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

  // The sun aims at the active footprint instead of the world origin. Without
  // this the room sits ~20 m off-centre in the shadow frustum, so tightening
  // the frustum would drop it out of the map entirely.
  const sunTarget = useMemo(() => new THREE.Object3D(), []);
  const shadowExtent = shadowExtentFor(groundWidth, groundHeight);
  // Keep the sun's direction identical by moving it with its target.
  const sunDistance = SUN_BASE_POSITION.length();
  const sunNear = Math.max(0.5, sunDistance - shadowExtent - SHADOW_MARGIN);
  const sunFar = sunDistance + shadowExtent + SHADOW_MARGIN;

  return (
    <>
      {/* Black-space void with an infinite twinkling starfield in 360 degrees — no fog culling */}
      <color attach="background" args={["#03040a"]} />
      <Starfield center={[localCenterX, 0, localCenterZ]} />

      {/* HDRI kept for image-based reflections — soft satin speculars */}
      <Suspense fallback={null}>
        <Environment
          files={OFFICE_ENVIRONMENT_HDR}
          background={false}
          environmentIntensity={0.42}
          environmentRotation={[0, Math.PI * 0.85, 0]}
        />
      </Suspense>

      {/* Cool, soft ambient fill */}
      <hemisphereLight args={["#475569", "#090d16", 0.38]} />

      {/* Clean, glare-free studio key light — the only shadow caster. */}
      <primitive object={sunTarget} position={[groundCenterX, 0, groundCenterZ]} />
      <directionalLight
        ref={sunRef}
        position={[
          groundCenterX + SUN_BASE_POSITION.x,
          SUN_BASE_POSITION.y,
          groundCenterZ + SUN_BASE_POSITION.z,
        ]}
        target={sunTarget}
        intensity={1.25}
        color="#ffffff"
        castShadow
        shadow-mapSize={[config.shadowMapSize, config.shadowMapSize]}
        shadow-bias={-0.00012}
        shadow-normalBias={0.02}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-camera-near={sunNear}
        shadow-camera-far={sunFar}
      />

      {/* Softened Satin Overhead Fill on Central Workstation Table — No blinding glare.
          Deliberately casts no shadow. It used to, which meant a second full
          depth pass over every caster in the room on every frame, for a cone
          hanging 4.4 m above the table with no shadow camera bounds of its
          own — three fell back to a 90° perspective with a 0.5–500 depth
          range, so the map it produced was mush anyway. The sun below is the
          only shadow caster. If a contact shadow under the table is missed,
          add a FloorContactShadow (see scene/environment.tsx) rather than
          bringing this pass back. */}
      <spotLight
        position={[localCenterX, 4.4, localCenterZ]}
        target-position={[localCenterX, 0.5, localCenterZ]}
        angle={0.78}
        penumbra={0.65}
        intensity={1.4}
        color="#f0f9ff"
      />

      {/* Subtle Cyan/Blue Horizon Accent Rim Light */}
      <pointLight
        position={[localCenterX + 4.5, 2.4, localCenterZ - 2.5]}
        intensity={0.65}
        distance={14}
        color="#38bdf8"
      />

      {/* Cool fill from the opposite side — lifts shadowed faces */}
      <directionalLight position={[-14, 12, -10]} intensity={0.45} color="#dce6f5" />

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
      <EffectComposer multisampling={config.msaaSamples}>
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
            intensity={0.42}
            luminanceThreshold={0.92}
            luminanceSmoothing={0.32}
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
