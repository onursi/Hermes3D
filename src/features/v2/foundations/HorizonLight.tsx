"use client";
import {Billboard,Text} from '@react-three/drei';
import {useFrame} from '@react-three/fiber';
import {useEffect,useMemo,useRef,useState} from 'react';
import * as THREE from 'three';
import {useV2} from '../state';
import {useWorlds} from './WorldsProvider';
import type {Point} from './goalLayout';
const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
/** Persistent remnant rather than a repeated completion event. */
export function HorizonLight({point,color,size,achieved=false,onPick}:{point:Point;color:string;size:number;achieved?:boolean;onPick:()=>void}){
 const material=useRef<THREE.ShaderMaterial>(null);const {prefs}=useV2();const uniforms=useMemo(()=>({time:{value:0},tint:{value:new THREE.Color(color)},remnant:{value:achieved?1:0}}),[color,achieved]);
 useFrame(({clock})=>{if(material.current)material.current.uniforms.time.value=prefs.reducedMotion?0:clock.elapsedTime;});
 return <group position={point}><Billboard><mesh onClick={e=>{e.stopPropagation();onPick();}}><planeGeometry args={[size*10,size*10]}/><shaderMaterial ref={material} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} uniforms={uniforms} vertexShader={vertex} fragmentShader={`varying vec2 vUv;uniform float time;uniform float remnant;uniform vec3 tint;
 void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);float filaments=sin(a*13.+sin(a*7.-time*.17)*2.+r*22.)*.5+.5;float shape=.30+sin(a*5.+time*.08)*.018+sin(a*11.-time*.12)*.012;float shell=exp(-pow((r-shape)*48.,2.))*(.3+filaments*.7);float inner=exp(-r*14.)*.8;float rays=pow(max(0.,cos(a*4.)),65.)*exp(-r*5.)*.5;float core=exp(-r*r*950.)*2.;float wisps=exp(-pow((r-.38)*13.,2.))*filaments*.16;float corona=exp(-pow((r-.10)*65.,2.))*(.3+filaments*.25);float alpha=core+inner+rays+mix(corona*.6,shell*.65+wisps,remnant);vec3 c=mix(tint,vec3(.75,.65,1.),remnant*smoothstep(.19,.47,r)*.45);gl_FragColor=vec4(c,alpha);}`}/></mesh></Billboard>{achieved&&<Billboard position={[0,-size*2.1,0]}><Text fontSize={size*.18} letterSpacing={.16} color="#ffe8b5">ERREICHT · SUPERNOVA</Text></Billboard>}</group>;
}
/** Follows translation only: always at infinity, never a destination or score. */
export function DivineHorizon(){
 const offset=useMemo(()=>new THREE.Vector3(0,138,-430),[]);const group=useRef<THREE.Group>(null),material=useRef<THREE.MeshBasicMaterial>(null);const {prefs}=useV2();const {objects,routineSignals}=useWorlds();const [texture,setTexture]=useState<THREE.CanvasTexture|null>(null);
 const daily=routineSignals.filter(r=>r.sector==='spirituell'&&r.doneToday).length;
 const hadsch=objects.some(o=>o.kind==='goal'&&o.state==='erreicht'&&o.horizonSignal==='pilgrimage');
 useEffect(()=>{let cancelled=false;let map:THREE.CanvasTexture|undefined;void document.fonts.ready.then(()=>{if(cancelled)return;const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=768;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.textAlign='center';ctx.direction='rtl';ctx.font='360px "Traditional Arabic", "Segoe UI", serif';ctx.shadowColor='#edb94e';ctx.shadowBlur=32;const fill=ctx.createLinearGradient(0,150,0,540);fill.addColorStop(0,'#fff7d7');fill.addColorStop(.45,'#ffe8a0');fill.addColorStop(1,'#c99230');ctx.fillStyle=fill;ctx.fillText('الله',768,510);map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;setTexture(map);});return()=>{cancelled=true;map?.dispose();};},[]);
 useFrame(({camera,clock})=>{if(group.current)group.current.position.copy(camera.position).add(offset);if(material.current)material.current.opacity=Math.min(1,.72+(hadsch?.16:0)+daily*.05)+(prefs.reducedMotion?0:Math.sin(clock.elapsedTime*.55)*.025);});
 return <group ref={group}><Billboard>{texture&&<mesh raycast={()=>null}><planeGeometry args={[125,62.5]}/><meshBasicMaterial ref={material} map={texture} transparent depthWrite={false} toneMapped={false}/></mesh>}<mesh position={[0,0,-1]} raycast={()=>null}><planeGeometry args={[220,105]}/><shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} vertexShader={vertex} fragmentShader={`varying vec2 vUv;void main(){vec2 p=(vUv-.5)*vec2(1.,1.7);float g=exp(-dot(p,p)*32.);gl_FragColor=vec4(1.,.64,.20,g*${(.10+(hadsch?.12:0)+daily*.04).toFixed(2)});}`}/></mesh></Billboard></group>;
}
