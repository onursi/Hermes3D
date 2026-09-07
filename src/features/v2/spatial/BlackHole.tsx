"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { spatialSignal } from "./model";

// Artistic bent-ray integration, not a general-relativistic simulation.
const fragment = `
precision highp float;
varying vec2 vUv;
uniform mat4 uProjectionInverse;
uniform mat4 uCameraWorld;
uniform vec3 uEye;
uniform float uTime;
uniform float uDepth;
float hash(vec3 p){ p=fract(p*.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }
float noise(vec3 p){ vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
vec3 sky(vec3 d){
 vec3 cell=floor(d*440.); vec3 f=fract(d*440.)-.5;
 float star=pow(max(0.,1.-length(f)*2.),12.)*step(.994,hash(cell));
 float band=pow(max(0.,1.-abs(d.y*.8+d.x*.25)*2.),5.);
 float cloud=noise(d*7.+vec3(4,1,6))*noise(d*19.);
 return vec3(.004,.006,.013)+vec3(.045,.04,.069)*cloud*band+star*mix(vec3(.55,.7,1.),vec3(1.,.8,.53),hash(cell+8.))*2.;
}
void main(){
 vec2 uv=vUv*2.-1.;
 vec4 view=uProjectionInverse*vec4(uv,1.,1.);
 vec3 direction=normalize((uCameraWorld*vec4(normalize(view.xyz/view.w),0.)).xyz);
 vec3 p=uEye; vec3 rd=direction; vec3 light=vec3(0.); vec3 aureole=vec3(0.); float transmission=1.; float captured=0.; float closest=10000.;
 for(int i=0;i<64;i++){
  float r=length(p); closest=min(closest,r);
  if(r<2.9){captured=1.;break;}
  if(r>220.)break;
  float stepSize=clamp(r*.13,.22,11.);
  vec3 bend=-normalize(p)*(5.7/(r*r));
  rd=normalize(rd+bend*stepSize);
  vec3 next=p+rd*stepSize;
  if(p.y*next.y<0.){
   vec3 hit=mix(p,next,abs(p.y)/(abs(p.y)+abs(next.y)));
   float ring=length(hit.xz);
   float mask=smoothstep(3.65,4.6,ring)*(1.-smoothstep(12.,16.,ring));
   float angle=atan(hit.z,hit.x);
   float lanes=.4+.6*noise(vec3(ring*2.8,cos(angle)*9.,sin(angle)*9.-uTime*.55));
   float filaments=.7+.3*sin(ring*21.+angle*5.-uTime*2.5);
   float hot=pow(4.6/max(ring,4.6),1.65);
   float doppler=clamp(1.+dot(normalize(vec3(-hit.z,0.,hit.x)),-rd)*.65,.25,1.7);
   vec3 heat=mix(vec3(1.,.25,.055),vec3(1.,.87,.58),hot);
   light+=transmission*heat*mask*lanes*filaments*hot*doppler*2.4;
   transmission*=1.-mask*.68;
  }
  float halo=exp(-abs(r-3.28)*7.5) * (1.-abs(dot(normalize(p),rd)));
  aureole+=vec3(1.,.66,.3)*halo*stepSize*.28;
  p=next;
 }
 vec3 background=sky(rd);
 // Approaching rays reveal increasingly stretched celestial trails.
 background+=sky(normalize(rd+vec3(.0008,-.0006,0)))*uDepth*.2;
 vec3 color=light+(aureole+background*transmission)*(1.-captured);
 color*=1.-.14*length(uv);
 gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

export function BlackHole({ reducedMotion, onDive }: { reducedMotion: boolean; onDive: () => void }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uDepth: { value: 0 }, uEye: { value: new THREE.Vector3() }, uProjectionInverse: { value: new THREE.Matrix4() }, uCameraWorld: { value: new THREE.Matrix4() } }), []);
  useEffect(() => () => { spatialSignal.depth = 0; }, []);
  useFrame(({ camera }, dt) => {
    const u = material.current?.uniforms; if (!u) return;
    u.uTime.value += reducedMotion ? 0 : Math.min(dt,.05);
    u.uEye.value.copy(camera.position);
    u.uProjectionInverse.value.copy(camera.projectionMatrixInverse);
    u.uCameraWorld.value.copy(camera.matrixWorld);
    spatialSignal.depth = THREE.MathUtils.clamp((45-camera.position.length())/36,0,1);
    u.uDepth.value = spatialSignal.depth;
  });
  return <>
    <mesh frustumCulled={false} renderOrder={-100} raycast={() => null}>
      <planeGeometry args={[2,2]} />
      <shaderMaterial ref={material} uniforms={uniforms} vertexShader="varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.99999,1.);}" fragmentShader={fragment} depthTest={false} depthWrite={false} />
    </mesh>
    <mesh onClick={e=>{e.stopPropagation();onDive();}}>
      <sphereGeometry args={[3.3,24,16]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  </>;
}
