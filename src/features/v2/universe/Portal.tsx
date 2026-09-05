"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * A way in, rather than a thing in the way.
 *
 * Onur's own diagnosis, and it was the right one: a knowledge body twenty
 * units across takes up space it has not earned. You do not need to see the
 * whole of a place in order to go there — you need to see the door, and the
 * door should tell you what is behind it.
 *
 * So each destination is a portal: a ring of turbulent light with something
 * visible through it. Small on screen, unmistakable as an entrance, and about
 * three draw calls.
 *
 * **The rule that keeps this from being a mistake:** the frame is the same for
 * every portal, the view through it is not. The plan forbids interchangeable
 * columns, and eleven identical rings with eleven labels would be exactly that
 * with a nicer shader — he would read the label and never the shape. So the
 * caller passes what shows through, and the portal is a frame around it.
 *
 * Written as a shader rather than as geometry because it has to *move*: flow,
 * swirl and flicker are functions of time and position, which is what a
 * fragment shader is for. Animating this with meshes would cost per-frame CPU
 * work for every portal and look worse.
 */

const PORTAL_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * The surface, in polar coordinates.
 *
 * Everything here is a function of radius and angle, because that is what a
 * portal is: rings of stuff turning at different speeds. Cartesian noise would
 * have needed three times the instructions to look half as circular.
 */
const PORTAL_FRAGMENT = /* glsl */ `
  precision mediump float;

  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uRim;
  uniform vec3 uCore;
  uniform float uOpen;   // 0 = calm, 1 = reacting to attention
  uniform float uSeed;

  // Value noise ohne sin(). Die erste Fassung rief pro Pixel 32 mal sin()
  // auf — vier Oktaven mal vier Ecken mal zwei fbm — und das kostete auf der
  // Vega 11 die Hälfte der Bildrate: 60 fps fielen auf 35. Diese Variante
  // rechnet dasselbe mit Multiplikationen.
  float hash(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * (0.1031 + uSeed * 0.0007));
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // Zwei Oktaven. Bei vieren war der Unterschied auf einem Tor von hundert
  // Pixeln nicht zu sehen und im Bildratenzähler sehr wohl.
  float fbm(vec2 p) {
    float sum = noise(p) * 0.62;
    sum += noise(p * 2.07) * 0.31;
    return sum;
  }

  void main() {
    vec2 centred = vUv * 2.0 - 1.0;
    float radius = length(centred);

    // Outside the disc there is nothing. A round mask on a square quad.
    if (radius > 1.0) discard;

    float angle = atan(centred.y, centred.x);

    // The swirl: inner rings turn faster than outer ones, which is the whole
    // reason this reads as a vortex rather than as a spinning texture.
    float twist = angle + uTime * (0.35 + 0.9 * (1.0 - radius)) ;
    vec2 flow = vec2(cos(twist), sin(twist)) * radius;

    float turbulence = fbm(flow * 3.2 + vec2(uTime * 0.25, -uTime * 0.18));
    float filaments = fbm(flow * 7.0 - vec2(uTime * 0.6, uTime * 0.4));

    // The rim: a broad band just inside the edge, pushed in and out by the
    // noise so the ring is torn rather than drawn. This is the part that
    // makes it a portal instead of a glowing coin, so it gets the width.
    // Der Ring sitzt bei 0.62 statt am Rand, damit außerhalb Platz für den
    // Lichtsaum bleibt. Die Fläche ist entsprechend größer als das Tor.
    float ring = 0.62 + turbulence * 0.13;
    float edge = 1.0 - abs(radius - ring) * 4.6;
    edge = clamp(edge, 0.0, 1.0);
    edge = pow(edge, 1.35) * (0.75 + filaments * 0.6);

    // Light spilling outward. Without it the disc ends where the geometry
    // ends, and an edge you can see is the one thing a portal must not have.
    float halo = exp(-max(0.0, radius - ring) * 8.5) * 0.34;

    // The throat. Streaks live in a band just inside the rim and die out
    // toward the middle, which stays almost black — a portal you can see the
    // far side of is a lamp. Filling this in was what made the first version
    // read as a glowing ball instead of a way through.
    float band = smoothstep(0.12, 0.5, radius) * (1.0 - smoothstep(0.5, 0.66, radius));
    float inner = (0.1 + filaments * 0.95) * band * 0.62;

    // Attention brightens the rim, not the middle: the thing showing through
    // has to stay readable, and washing it out is how a highlight goes wrong.
    float lift = 1.0 + uOpen * 1.1;

    // Die Strähnen im Schlund tragen einen Hauch der Randfarbe, damit das
    // Innere zum Tor gehört und nicht wie ein zweites Objekt wirkt.
    vec3 throat = mix(uCore, uRim, 0.35) * inner * 1.9;
    vec3 colour = throat + uRim * (edge * 1.7 + halo) * lift;

    float alpha = clamp(edge * 1.35 * lift + halo * lift + inner * 0.7, 0.0, 1.0);

    gl_FragColor = vec4(colour, alpha);
  }
`;

export function Portal({
  radius,
  rim,
  core,
  /** Raised when this portal is the one in reach. */
  open = false,
  reducedMotion = false,
  /** Distinguishes the noise of one portal from the next. Stable per place. */
  seed = 0,
  children,
}: {
  radius: number;
  rim: string;
  core: string;
  open?: boolean;
  reducedMotion?: boolean;
  seed?: number;
  children?: React.ReactNode;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const billboard = useRef<THREE.Group>(null);
  const openValue = useRef(0);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uRim: { value: new THREE.Color(rim) },
      uCore: { value: new THREE.Color(core) },
      uOpen: { value: 0 },
      uSeed: { value: seed },
    }),
    // Colours are pushed in the frame loop below, so this builds once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((state, delta) => {
    // Always face the camera. A portal seen edge-on is a line, and a door you
    // cannot see is not a door — this is the one case where billboarding is
    // the honest choice rather than a shortcut.
    if (billboard.current) billboard.current.quaternion.copy(state.camera.quaternion);

    if (!material.current) return;
    // Reduced motion keeps the shape and drops the movement. The portal still
    // reads as a portal; it simply holds still.
    if (!reducedMotion) material.current.uniforms.uTime.value = state.clock.elapsedTime;

    material.current.uniforms.uRim.value.set(rim);
    material.current.uniforms.uCore.value.set(core);

    // Eased rather than switched: a rim that snaps to bright on approach looks
    // like a rendering glitch, and one that fades looks like it noticed you.
    const target = open ? 1 : 0;
    openValue.current += (target - openValue.current) * Math.min(1, delta * 4);
    material.current.uniforms.uOpen.value = openValue.current;
  });

  return (
    <group ref={billboard}>
      {/* What shows through, behind the surface and clipped by it. */}
      {children}
      <mesh>
        <planeGeometry args={[radius * 2.6, radius * 2.6]} />
        <shaderMaterial
          ref={material}
          vertexShader={PORTAL_VERTEX}
          fragmentShader={PORTAL_FRAGMENT}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
