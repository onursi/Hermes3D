"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";

/** Stylised emission clouds, inspired by nebula colour photography. No sky survey data. */
export function Nebula({ reducedMotion }: { reducedMotion: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const positions: number[] = [], colors: number[] = [], radii: number[] = [];
    const palette = ["#7b426f", "#415d82", "#966059"].map(c => new THREE.Color(c));
    for (let i = 0; i < 190; i++) {
      const r = 35 + (i * 67 % 275);
      const a = i % 4 * Math.PI / 2 + r * 0.022 + Math.sin(i * 7.3) * 0.22;
      positions.push(Math.cos(a) * r, Math.sin(i * 2.31) * (12 + r * 0.085), Math.sin(a) * r);
      colors.push(...palette[i % 3].toArray()); radii.push(20 + i % 19);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.setAttribute("aRadius", new THREE.Float32BufferAttribute(radii, 1));
    g.computeBoundingSphere(); return g;
  }, []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uHeight: { value: 720 } }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock, size, gl }) => {
    if (!material.current) return;
    if (!reducedMotion) material.current.uniforms.uTime.value = clock.elapsedTime;
    material.current.uniforms.uHeight.value = size.height * gl.getPixelRatio();
  });
  return <points geometry={geometry} raycast={() => {}}>
    <shaderMaterial ref={material} uniforms={uniforms} vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending}
      vertexShader={`
        attribute float aRadius;
        uniform float uTime;
        uniform float uHeight;
        varying vec3 vColor;
        varying float vFade;
        void main() {
          float t = uTime * 0.016;
          vec3 p = vec3(cos(t)*position.x-sin(t)*position.z, position.y, sin(t)*position.x+cos(t)*position.z);
          vec4 mv = modelViewMatrix * vec4(p,1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aRadius * uHeight / max(30.0,-mv.z), 1.0, 240.0);
          vFade = smoothstep(8.0,45.0,-mv.z);
          vColor = color;
        }`}
      fragmentShader={`
        varying vec3 vColor;
        varying float vFade;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float edge = max(0.0, 1.0 - length(p)*2.0);
          float wisps = 0.65 + 0.2*sin(p.x*23.0 + sin(p.y*17.0)) + 0.15*cos(p.y*31.0+p.x*14.0);
          gl_FragColor = vec4(vColor, edge*edge*wisps*0.065*vFade);
        }`}
    />
  </points>;
}
