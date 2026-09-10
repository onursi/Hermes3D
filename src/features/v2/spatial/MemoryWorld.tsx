"use client";
import { Billboard,Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect,useRef,useState } from "react";
import * as THREE from "three";
import type {MemoryCatalog} from './memoryCatalog';
import {fitPhoto} from "./photoStore";
import {PHASES,PHASE_COLORS,spatialSignal,type MemoryEntry} from './model';
export type MemoryMode = "saturn" | "carousel" | "free";
export const memoryMotion={velocity:0,auto:0};
export function MemoryWorld({catalog,entries,mode,phase,reducedMotion,onPhase,onFree,onOpen,topic,onTopic}:{catalog:MemoryCatalog;topic:string;onTopic:(topic:string)=>void;entries:MemoryEntry[];mode:MemoryMode;phase:string;reducedMotion:boolean;onPhase:(phase:string)=>void;onFree:()=>void;onOpen:(e:MemoryEntry)=>void}){
 const realm=catalog.realms.find(r=>r.id===topic&&!r.archived);const albums=realm?.albums.filter(a=>!a.archived)??[];
 const group=useRef<THREE.Group>(null);
 useEffect(()=>{memoryMotion.velocity=0;memoryMotion.auto=0;return()=>{spatialSignal.memorySpeed=0;memoryMotion.auto=0;memoryMotion.velocity=0;};},[mode,phase]);
 useFrame((_,dt)=>{if(mode==='free'&&group.current&&!reducedMotion){group.current.rotation.y+=memoryMotion.auto*Math.min(.05,dt);spatialSignal.memorySpeed=Math.min(1,Math.abs(memoryMotion.auto)/8);}else spatialSignal.memorySpeed=0;});
 const visible=entries.filter(e=>e.kind!=='note');
 return <group>
  {mode==='saturn'&&catalog.realms.filter(t=>t.id!==topic&&!t.archived).map((t,i)=><group key={t.id} position={[Math.sin((i-2)*.6)*25,4+Math.cos(i)*3,-15-Math.cos((i-2)*.6)*9]} rotation={[.3,0,.18]} onClick={e=>{e.stopPropagation();onTopic(t.id);}}><mesh><sphereGeometry args={[1.8,32,24]}/><meshStandardMaterial color={t.color} emissive={t.color} emissiveIntensity={.22} roughness={.5}/></mesh><mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[2.5,4,80]}/><meshBasicMaterial color={t.color} transparent opacity={.45} side={THREE.DoubleSide}/></mesh><Billboard position={[0,3,0]}><Text fontSize={.43} color={t.color}>{t.title}</Text></Billboard></group>)}
  <ambientLight intensity={.7}/><pointLight position={[5,8,10]} intensity={80} color="#f0d5ad"/>
  {(mode==='saturn'||mode==='carousel')&&realm?<group rotation={[.28,0,.12]}>
   <mesh onClick={e=>{e.stopPropagation();onFree();}}><sphereGeometry args={[3.2,48,32]}/><meshStandardMaterial color="#668599" metalness={.4} roughness={.3} emissive="#294351" emissiveIntensity={.5}/></mesh>
   <Billboard position={[0,4.4,0]}><Text fontSize={.55} letterSpacing={.14} color="#e5d9be">{realm.title.toLocaleUpperCase("de")}</Text><Text position={[0,-.85,0]} fontSize={.3} color="#a4bac6">Kern berühren · frei erinnern</Text></Billboard>
   {albums.map((album,i)=><group key={album.id}>
    <mesh rotation={[-Math.PI/2,0,0]} onClick={e=>{e.stopPropagation();onPhase(album.id);}}><ringGeometry args={[5+i*1.8,5.85+i*1.8,144]}/><shaderMaterial transparent depthWrite={false} side={THREE.DoubleSide} uniforms={{tint:{value:new THREE.Color(PHASE_COLORS[i%PHASE_COLORS.length])},inner:{value:5+i*1.8}}} vertexShader="varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}" fragmentShader="uniform vec3 tint;uniform float inner;varying vec3 p;void main(){float r=length(p.xy);float t=(r-inner)/.85;float grain=.35+.65*pow(.5+.5*sin(r*220.),2.);float edge=smoothstep(0.,.12,t)*(1.-smoothstep(.8,1.,t));gl_FragColor=vec4(tint,grain*edge*.7);}"/></mesh>
    <Billboard position={[5.6+i*1.8,0,0]}><Text fontSize={.35} color={PHASE_COLORS[i%PHASE_COLORS.length]} onClick={e=>{e.stopPropagation();onPhase(album.id);}}>{album.title}</Text></Billboard>
   </group>)}
  </group>:<group ref={group}>{visible.slice(0,32).map((entry,i)=>{

    const position: [number,number,number]=[Math.sin(i*2.399)* (5+i*.26),Math.cos(i*1.7)*5,Math.cos(i*2.399)*(5+i*.26)];
    return <group key={entry.id} position={position} rotation={[0,0,0]} onClick={e=>{e.stopPropagation();onOpen(entry);}}>
      <mesh><boxGeometry args={[4.4,3.1,.065]}/><meshStandardMaterial color={PHASE_COLORS[PHASES.indexOf(entry.phase)]||'#b9cce1'} roughness={.3} metalness={.5} emissive="#253345" emissiveIntensity={.2}/></mesh>
      {entry.kind==='image'&&entry.url?<Photo url={entry.url}/>:<Text position={[0,.3,.065]} fontSize={.29} color="#ecf0f6" maxWidth={3.8} textAlign="center">{entry.title}</Text>}
      <Text position={[0,-1.08,.07]} fontSize={.23} color="#fff4d7">{entry.date||'Datum offen'}{entry.local?' · Lokal':''}</Text>
    </group>;
   })}</group>}
 </group>;
}
function Photo({url}:{url:string}){
 const material=useRef<THREE.MeshBasicMaterial>(null);const [size,setSize]=useState<[number,number]>([4.1,2.2]);
 useEffect(()=>{let active=true;let texture:THREE.Texture|null=null;new THREE.TextureLoader().load(url,t=>{texture=t;t.colorSpace=THREE.SRGBColorSpace;if(active&&material.current){setSize(fitPhoto(t.image.width,t.image.height));t.anisotropy=4;material.current.map=t;material.current.needsUpdate=true;}else t.dispose();});return()=>{active=false;texture?.dispose();};},[url]);
 return <mesh position={[0,.18,.05]}><planeGeometry args={size}/><meshBasicMaterial ref={material} color="white" toneMapped={false}/></mesh>;
}
