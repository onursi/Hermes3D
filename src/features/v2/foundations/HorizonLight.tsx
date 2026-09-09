"use client";
import {Billboard,Text} from '@react-three/drei';
import {useFrame} from '@react-three/fiber';
import {useEffect,useMemo,useRef,useState} from 'react';
import * as THREE from 'three';
import {useV2} from '../state';
import {useWorlds} from './WorldsProvider';
import {routineDirections} from './horizonRoutines';
import type {Point} from './goalLayout';
const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
/** Persistent remnant rather than a repeated completion event. */
export function HorizonLight({point,color,size,achieved=false,dormant=false,onPick}:{point:Point;color:string;size:number;achieved?:boolean;dormant?:boolean;onPick:()=>void}){
 const material=useRef<THREE.ShaderMaterial>(null);const {prefs}=useV2();const uniforms=useMemo(()=>({time:{value:0},tint:{value:new THREE.Color(dormant?'#91a0ba':color)},remnant:{value:achieved?1:0}}),[color,achieved,dormant]);
 useFrame(({clock})=>{if(material.current)material.current.uniforms.time.value=prefs.reducedMotion?0:clock.elapsedTime;});
 return <group position={point}><LivingCorona size={size} color={dormant?'#8594aa':color} quiet={prefs.reducedMotion||dormant}/><Billboard><mesh onClick={e=>{e.stopPropagation();onPick();}}><planeGeometry args={[size*10,size*10]}/><shaderMaterial ref={material} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} uniforms={uniforms} vertexShader={vertex} fragmentShader={`varying vec2 vUv;uniform float time;uniform float remnant;uniform vec3 tint;
 void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);float filaments=sin(a*13.+sin(a*7.-time*.17)*2.+r*22.)*.5+.5;float shape=.30+sin(a*5.+time*.08)*.018+sin(a*11.-time*.12)*.012;float shell=exp(-pow((r-shape)*48.,2.))*(.3+filaments*.7);float inner=exp(-r*14.)*.8;float rays=pow(max(0.,cos(a*4.)),65.)*exp(-r*5.)*.5;float core=exp(-r*r*950.)*2.;float wisps=exp(-pow((r-.38)*13.,2.))*filaments*.16;float corona=exp(-pow((r-.10)*65.,2.))*(.3+filaments*.25);float alpha=core+inner+rays+mix(corona*.6,shell*.65+wisps,remnant);vec3 c=mix(tint,vec3(.75,.65,1.),remnant*smoothstep(.19,.47,r)*.45);gl_FragColor=vec4(c,alpha);}`}/></mesh></Billboard>{achieved&&<Billboard position={[0,-size*2.1,0]}><Text fontSize={size*.18} letterSpacing={.16} color="#ffe8b5">ERREICHT · SUPERNOVA</Text></Billboard>}</group>;
}
/** Follows translation only: always at infinity, never a destination or score. */
export function DivineHorizon(){
 const offset=useMemo(()=>new THREE.Vector3(0,150,-1600),[]);const group=useRef<THREE.Group>(null),material=useRef<THREE.MeshBasicMaterial>(null);const {prefs}=useV2();const {objects,routineSignals}=useWorlds();const [texture,setTexture]=useState<THREE.Texture|null>(null);
 const daily=routineSignals.filter(r=>routineDirections(r,objects).includes('spirituell')&&r.doneToday).length;
 const hadsch=objects.some(o=>o.kind==='goal'&&o.state==='erreicht'&&o.horizonSignal==='pilgrimage');
 useEffect(()=>{let cancelled=false;let map:THREE.Texture|undefined;new THREE.TextureLoader().load('/hermes-assets/divine-calligraphy-r19.png',loaded=>{map=loaded;map.colorSpace=THREE.SRGBColorSpace;if(cancelled)map.dispose();else setTexture(map);});return()=>{cancelled=true;map?.dispose();};},[]);
 useFrame(({camera,clock})=>{if(group.current)group.current.position.copy(camera.position).add(offset);if(material.current)material.current.opacity=Math.min(1,.72+(hadsch?.16:0)+daily*.05)+(prefs.reducedMotion?0:Math.sin(clock.elapsedTime*.55)*.025);});
 return <group ref={group}><Billboard>{texture&&<mesh raycast={()=>null}><planeGeometry args={[750,1000]}/><meshBasicMaterial ref={material} map={texture} blending={THREE.AdditiveBlending} transparent depthTest={false} depthWrite={false} toneMapped={false}/></mesh>}<mesh position={[0,0,-1]} raycast={()=>null}><planeGeometry args={[2300,1800]}/><shaderMaterial transparent depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} vertexShader={vertex} fragmentShader={`varying vec2 vUv;void main(){vec2 p=(vUv-.5)*vec2(1.,1.7);float a=atan(p.y,p.x);float r=length(p);float rays=pow(.5+.5*sin(a*19.+sin(a*7.)),12.)*exp(-r*5.)*.28;float g=exp(-dot(p,p)*22.)+rays;gl_FragColor=vec4(1.,.64,.20,g*${(.28+(hadsch?.12:0)+daily*.04).toFixed(2)});}`}/></mesh></Billboard></group>;
}

/** A genuine volume of slow filaments around each light body. */
function LivingCorona({size,color,quiet}:{size:number;color:string;quiet:boolean}){
 const group=useRef<THREE.Points>(null);const positions=useMemo(()=>{const p=new Float32Array(240*3);for(let i=0;i<240;i++){const a=i*2.399963,r=size*(.65+(i%19)/19*.85),z=(i/240-.5)*size*1.7;p.set([Math.cos(a)*r,Math.sin(a)*r,z],i*3);}return p;},[size]);
 useFrame((_,delta)=>{if(group.current&&!quiet){group.current.rotation.y+=delta*.07;group.current.rotation.z+=delta*.025;}});
 return <points ref={group} raycast={()=>null}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]}/></bufferGeometry><pointsMaterial color={color} size={size*.055} transparent opacity={.5} depthWrite={false} blending={THREE.AdditiveBlending}/></points>;
}
export function SupernovaReplay({point,signal,quiet}:{point:Point;signal:number;quiet:boolean}){
 const group=useRef<THREE.Group>(null),material=useRef<THREE.ShaderMaterial>(null),start=useRef(-10000),previous=useRef(signal);const uniforms=useMemo(()=>({progress:{value:2}}),[]);
 useEffect(()=>{if(signal!==previous.current){start.current=performance.now();previous.current=signal;}},[signal]);
 useFrame(()=>{const t=(performance.now()-start.current)/4200;if(group.current)group.current.visible=t<1;if(material.current)material.current.uniforms.progress.value=quiet?2:t;});
 return <group ref={group} position={point}><Billboard><mesh raycast={()=>null} renderOrder={20}><planeGeometry args={[75,75]}/><shaderMaterial ref={material} transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} uniforms={uniforms} vertexShader={vertex} fragmentShader={`varying vec2 vUv;uniform float progress;void main(){vec2 p=(vUv-.5)*2.;float r=length(p),t=clamp(progress,0.,1.);float wave=exp(-pow((r-t*.95)*60.,2.))*(1.-t);float flash=exp(-r*r*28.)*exp(-t*11.);float a=atan(p.y,p.x);float dust=pow(max(0.,sin(a*63.+r*35.)),14.)*exp(-abs(r-t*.70)*17.)*(1.-t);gl_FragColor=vec4(mix(vec3(1.,.81,.4),vec3(.70,.83,1.),t),(wave*.6+flash*.7+dust*.4)*(1.-step(1.,progress)));}`}/></mesh></Billboard></group>;
}
export function DevotionStream({active}:{active:boolean}){
 const {prefs}=useV2();const group=useRef<THREE.Group>(null);const particle=useRef<THREE.Points>(null);const buffer=useMemo(()=>new Float32Array(180*3),[]);
 useFrame(({camera,clock})=>{if(group.current)group.current.position.copy(camera.position);if(!particle.current)return;const attr=particle.current.geometry.getAttribute('position') as THREE.BufferAttribute;for(let i=0;i<180;i++){const t=(i/180+(prefs.reducedMotion?0:clock.elapsedTime*.045))%1;attr.setXYZ(i,85*(1-t)+Math.sin(t*10+i)*7, -30+t*300,-240-t*350);}attr.needsUpdate=true;});
 if(!active)return null;
 return <group ref={group}><points ref={particle} raycast={()=>null}><bufferGeometry><bufferAttribute attach="attributes-position" args={[buffer,3]}/></bufferGeometry><pointsMaterial color="#ffd27b" size={1.1} transparent opacity={.7} depthWrite={false} blending={THREE.AdditiveBlending}/></points></group>;
}
