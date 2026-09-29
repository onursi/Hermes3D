"use client";
/**
 * R45 living Hermes orb (replaces the lightning sphere and orbit rings).
 *
 * One sphere, one halo. The surface breathes with 3D simplex noise, the inside
 * flows, the rim glows. Loudness of Onur's microphone or Hermes' spoken reply
 * (voiceLevel) makes it swell; the presence state sets colour and tempo. When
 * speech comes from the browser voice (no audio graph to measure), a gentle
 * synthetic pulse stands in so "speaking" never looks frozen.
 */
import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useV2 } from "../state";
import { COMMAND_STATES, useCommandPresence } from "./commandPresence";
import { QUALITY, resolveQuality } from "./quality";
import { voiceLevel } from "./voiceLevel";

// Ashima 3D simplex noise (MIT), shared by both shaders.
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const orbVertex = /* glsl */ `
uniform float uTime; uniform float uAmp;
varying vec3 vNormal; varying vec3 vView; varying vec3 vPos; varying float vDisp;
${NOISE}
void main(){
  vec3 p = position;
  float n = snoise(normal * 1.4 + vec3(0.0, uTime * 0.35, uTime * 0.2));
  float n2 = snoise(normal * 3.2 - vec3(uTime * 0.5)) * 0.35;
  vDisp = n + n2;
  p += normal * vDisp * uAmp;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = -mv.xyz; vNormal = normalize(normalMatrix * normal); vPos = position;
  gl_Position = projectionMatrix * mv;
}`;

const orbFragment = /* glsl */ `
uniform float uTime; uniform vec3 uTint; uniform float uLevel; uniform float uStrength;
varying vec3 vNormal; varying vec3 vView; varying vec3 vPos; varying float vDisp;
${NOISE}
void main(){
  vec3 n = normalize(vNormal); vec3 v = normalize(vView);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 2.6);
  // Flowing interior: domain-warped noise read on the sphere surface.
  vec3 q = vPos * 1.8;
  float warp = snoise(q + vec3(uTime * 0.18));
  float flow = snoise(q * 1.7 + warp * 1.3 - vec3(0.0, uTime * 0.28, 0.0));
  float veins = pow(smoothstep(0.55, 0.98, 1.0 - abs(flow)), 1.6);
  // Deep petrol body; light lives in the veins and the rim, not the surface,
  // so bloom picks up the edges instead of washing the sphere out.
  vec3 petrol = vec3(0.10, 0.36, 0.38);
  vec3 glow = mix(petrol, uTint, 0.45);
  vec3 deep = vec3(0.006, 0.020, 0.026);
  vec3 body = mix(deep, petrol * 0.35, 0.3 + 0.35 * warp);
  vec3 col = body + glow * veins * (0.35 + uLevel * 1.4);
  col += mix(glow, vec3(0.85, 1.0, 0.97), 0.3) * fres * (0.7 + uLevel * 0.8);
  col += vec3(0.85, 1.0, 0.97) * pow(max(vDisp, 0.0), 3.0) * 0.18 * (0.3 + uLevel);
  col = col / (1.0 + col * 0.6); // soft shoulder: bright veins, no blown-out sphere
  gl_FragColor = vec4(col * uStrength, 1.0);
}`;

const haloFragment = /* glsl */ `
uniform vec3 uTint; uniform float uLevel; uniform float uStrength;
varying vec3 vNormal; varying vec3 vView;
void main(){
  float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 3.0);
  float a = fres * (0.32 + uLevel * 0.6) * uStrength;
  gl_FragColor = vec4(uTint * 1.4, a);
}`;
const haloVertex = /* glsl */ `
varying vec3 vNormal; varying vec3 vView;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = -mv.xyz; vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`;

const TEMPO: Record<string, number> = { idle: 0.35, waiting: 0.45, offline: 0.12, error: 0.5, listening: 0.9, working: 1.4, speaking: 1.0 };

export function HermesOrb({ reachable, waiting, intensity }: { reachable: boolean; waiting: number; intensity: number }) {
  const state = useCommandPresence(reachable, waiting);
  const { prefs } = useV2();
  const spec = COMMAND_STATES[state];
  const segments = QUALITY[resolveQuality(prefs.quality)].orbSegments;
  const orb = useRef<THREE.ShaderMaterial>(null);
  const halo = useRef<THREE.ShaderMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const tint = useMemo(() => new THREE.Color(spec.color), [spec.color]);
  const orbUniforms = useMemo(() => ({ uTime: { value: 0 }, uAmp: { value: 0.04 }, uTint: { value: tint.clone() }, uLevel: { value: 0 }, uStrength: { value: intensity } }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const haloUniforms = useMemo(() => ({ uTint: { value: tint.clone() }, uLevel: { value: 0 }, uStrength: { value: intensity } }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((clock, dt) => {
    const step = Math.min(dt, 0.05);
    let level = voiceLevel();
    if (state === "speaking" && level < 0.02) level = 0.25 + 0.2 * Math.sin(clock.clock.elapsedTime * 7.0) * Math.sin(clock.clock.elapsedTime * 2.3);
    if (state === "working") level = Math.max(level, 0.15);
    const calm = prefs.reducedMotion;
    for (const m of [orb.current, halo.current]) {
      if (!m) continue;
      (m.uniforms.uTint.value as THREE.Color).lerp(tint, 0.06);
      m.uniforms.uLevel.value += (level - m.uniforms.uLevel.value) * 0.2;
      m.uniforms.uStrength.value = intensity;
    }
    if (orb.current) {
      orb.current.uniforms.uTime.value += calm ? 0 : step * (TEMPO[state] ?? 0.35);
      orb.current.uniforms.uAmp.value = calm ? 0.02 : 0.035 + orb.current.uniforms.uLevel.value * 0.2;
    }
    if (light.current) {
      light.current.color.lerp(tint, 0.06);
      light.current.intensity = (3 + (orb.current?.uniforms.uLevel.value ?? 0) * 5) * intensity;
    }
  });

  return (
    <group position={[0, 1.55, 0]}>
      <group onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new Event("hermes:console-open")); }}>
        <mesh>
          <icosahedronGeometry args={[0.76, Math.round(segments / 4)]} />
          <shaderMaterial ref={orb} vertexShader={orbVertex} fragmentShader={orbFragment} uniforms={orbUniforms} />
        </mesh>
        <mesh scale={1.42}>
          <sphereGeometry args={[0.76, 64, 48]} />
          <shaderMaterial ref={halo} vertexShader={haloVertex} fragmentShader={haloFragment} uniforms={haloUniforms}
            transparent depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
      <pointLight ref={light} color={spec.color} intensity={3 * intensity} distance={7} />
      <Billboard position={[0, 1.55, 0]}>
        <Text fontSize={0.2} color="#e3ecef" letterSpacing={0.02}>Hermes</Text>
        <Text position={[0, -0.3, 0]} fontSize={0.13} color={spec.color}>{spec.label}</Text>
      </Billboard>
    </group>
  );
}
