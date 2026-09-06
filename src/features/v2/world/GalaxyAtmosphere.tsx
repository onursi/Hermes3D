"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// Decorative matter, never a second graph or a claim about live agent activity.
// Stable world coordinates make flight produce real parallax. One draw call.
export function GalaxyAtmosphere({ reducedMotion }: { reducedMotion: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const count = 14000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    let seed = 7319;
    const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
    const palette = ["#e9d9b8", "#aac8ee", "#9974ce", "#f4eee1", "#c38a61"].map(c => new THREE.Color(c));
    for (let i = 0; i < count; i++) {
      const radius = 16 + Math.pow(random(), 0.68) * 310;
      const arm = i % 4;
      const angle = arm * Math.PI / 2 + radius * 0.022 + (random() - 0.5) * 0.58;
      positions.set([Math.cos(angle) * radius, (random() - 0.5) * (5 + radius * 0.12) + Math.sin(angle * 2) * radius * 0.035, Math.sin(angle) * radius], i * 3);
      colors.set(palette[Math.floor(random() * palette.length)].toArray(), i * 3);
      sizes[i] = 1.1 + random() * 1.6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 400);
    return g;
  }, []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPointer: { value: new THREE.Vector2() }, uMotion: { value: 1 } }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock, pointer }) => {
    if (!material.current) return;
    material.current.uniforms.uMotion.value = reducedMotion ? 0 : 1;
    if (!reducedMotion) material.current.uniforms.uTime.value = clock.elapsedTime;
    material.current.uniforms.uPointer.value.lerp(pointer, 0.045);
  });
  return <points geometry={geometry} raycast={() => {}}>
    <shaderMaterial ref={material} uniforms={uniforms} transparent depthWrite={false} vertexColors blending={THREE.AdditiveBlending}
      vertexShader={`
        attribute float aSize;
        uniform float uTime;
        uniform float uMotion;
        uniform vec2 uPointer;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.y += sin(length(p.xz) * 0.055 + uTime * 0.22) * 1.3 * uMotion;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vec4 clip = projectionMatrix * mv;
          vec2 screen = clip.xy / max(0.01, clip.w);
          vec2 away = screen - uPointer;
          float touch = exp(-dot(away, away) * 12.0) * uMotion;
          mv.xy += away * touch * min(8.0, abs(mv.z) * 0.07);
          // A small bow wave parts nearby dust as the cockpit approaches.
          float nearField = (1.0 - smoothstep(2.0, 18.0, length(mv.xyz))) * uMotion;
          mv.xy += normalize(mv.xy + vec2(0.001)) * nearField * 2.0;
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aSize * 105.0 / max(20.0, -mv.z), 1.7, 3.5);
          vColor = color;
          vAlpha = (0.66 + 0.18 * sin(position.x + uTime * 0.4)) * smoothstep(1.0, 5.0, -mv.z);
        }`}
      fragmentShader={`
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(vColor, smoothstep(0.5, 0.05, d) * vAlpha);
        }`}
    />
  </points>;
}
