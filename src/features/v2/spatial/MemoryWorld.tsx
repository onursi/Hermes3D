"use client";
import { Billboard,Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect,useRef } from "react";
import * as THREE from "three";
import {PHASES,PHASE_COLORS,spatialSignal,type MemoryEntry} from './model';
export type MemoryMode = "saturn" | "carousel" | "free";
export const memoryMotion={velocity:0,auto:0};
export function MemoryWorld({entries,mode,phase,reducedMotion,onPhase,onFree,onOpen}:{entries:MemoryEntry[];mode:MemoryMode;phase:string;reducedMotion:boolean;onPhase:(phase:string)=>void;onFree:()=>void;onOpen:(e:MemoryEntry)=>void}){
 const group=useRef<THREE.Group>(null);const drag=useRef<{x:number;time:number;moved:number}|null>(null);
 useEffect(()=>{memoryMotion.velocity=0;memoryMotion.auto=0;return()=>{spatialSignal.memorySpeed=0;memoryMotion.auto=0;memoryMotion.velocity=0;};},[mode,phase]);
 useFrame((_,dt)=>{const t=Math.min(.05,dt);if(mode==='carousel'&&group.current){if(!drag.current){if(reducedMotion){memoryMotion.velocity=0;}else {group.current.rotation.y+=(memoryMotion.velocity+memoryMotion.auto)*t;memoryMotion.velocity*=Math.exp(-2.4*t);}}spatialSignal.memorySpeed=Math.min(1,Math.abs(memoryMotion.velocity+memoryMotion.auto)/8);}else spatialSignal.memorySpeed=0;});
 const visible=mode==='carousel'?entries.filter(e=>e.phase===phase):entries;
 return <group>
  <ambientLight intensity={.7}/><pointLight position={[5,8,10]} intensity={80} color="#f0d5ad"/>
  {mode==='saturn'?<group rotation={[.28,0,.12]}>
   <mesh onClick={e=>{e.stopPropagation();onFree();}}><sphereGeometry args={[3.2,48,32]}/><meshStandardMaterial color="#668599" metalness={.4} roughness={.3} emissive="#294351" emissiveIntensity={.5}/></mesh>
   <Billboard position={[0,4.4,0]}><Text fontSize={.55} letterSpacing={.14} color="#e5d9be">MEMORY SATURN</Text><Text position={[0,-.85,0]} fontSize={.3} color="#a4bac6">Kern berühren · frei erinnern</Text></Billboard>
   {PHASES.map((p,i)=><group key={p}>
    <mesh rotation={[-Math.PI/2,0,0]} onClick={e=>{e.stopPropagation();onPhase(p);}}><ringGeometry args={[5+i*1.8,5.85+i*1.8,144]}/><shaderMaterial transparent depthWrite={false} side={THREE.DoubleSide} uniforms={{tint:{value:new THREE.Color(PHASE_COLORS[i])},inner:{value:5+i*1.8}}} vertexShader="varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}" fragmentShader="uniform vec3 tint;uniform float inner;varying vec3 p;void main(){float r=length(p.xy);float t=(r-inner)/.85;float grain=.35+.65*pow(.5+.5*sin(r*220.),2.);float edge=smoothstep(0.,.12,t)*(1.-smoothstep(.8,1.,t));gl_FragColor=vec4(tint,grain*edge*.7);}"/></mesh>
    <Billboard position={[5.6+i*1.8,0,0]}><Text fontSize={.35} color={PHASE_COLORS[i]} onClick={e=>{e.stopPropagation();onPhase(p);}}>{p}</Text></Billboard>
   </group>)}
  </group>:<group ref={group}
    onPointerDown={e=>{if(mode!=='carousel')return;e.stopPropagation();drag.current={x:e.clientX,time:performance.now(),moved:0};(e.target as unknown as Element & {setPointerCapture:(id:number)=>void}).setPointerCapture(e.pointerId);}}
    onPointerMove={e=>{if(!drag.current||!group.current)return;const now=performance.now(),dx=e.clientX-drag.current.x;group.current.rotation.y+=dx*.006;memoryMotion.velocity=THREE.MathUtils.clamp(dx/Math.max(8,now-drag.current.time)*6,-14,14);drag.current={x:e.clientX,time:now,moved:drag.current.moved+Math.abs(dx)};}}
    onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}
   >{visible.slice(0,32).map((entry,i)=>{
    const angle=i/Math.max(1,visible.length)*Math.PI*2;
    const position: [number,number,number]=mode==='carousel'?[Math.sin(angle)*10,0,Math.cos(angle)*10]:[Math.sin(i*2.399)* (5+i*.26),Math.cos(i*1.7)*5,Math.cos(i*2.399)*(5+i*.26)];
    return <group key={entry.id} position={position} rotation={mode==='carousel'?[0,angle,0]:[0,0,0]} onClick={e=>{e.stopPropagation();if(Math.abs(memoryMotion.velocity)<.8&&(!drag.current||drag.current.moved<6))onOpen(entry);else memoryMotion.velocity=0;}}>
      <mesh><boxGeometry args={[4.4,3.1,.065]}/><meshStandardMaterial color={PHASE_COLORS[PHASES.indexOf(entry.phase)]||'#b9cce1'} roughness={.3} metalness={.5} emissive="#253345" emissiveIntensity={.2}/></mesh>
      {entry.kind==='image'&&entry.url?<Photo url={entry.url}/>:<Text position={[0,.3,.065]} fontSize={.29} color="#ecf0f6" maxWidth={3.8} textAlign="center">{entry.title}</Text>}
      <Text position={[0,-1.08,.07]} fontSize={.23} color="#fff4d7">{entry.date||'Datum offen'}{entry.local?' · Sitzung':''}</Text>
    </group>;
   })}</group>}
 </group>;
}
function Photo({url}:{url:string}){
 const material=useRef<THREE.MeshBasicMaterial>(null);
 useEffect(()=>{let active=true;let texture:THREE.Texture|null=null;new THREE.TextureLoader().load(url,t=>{texture=t;t.colorSpace=THREE.SRGBColorSpace;if(active&&material.current){material.current.map=t;material.current.needsUpdate=true;}else t.dispose();});return()=>{active=false;texture?.dispose();};},[url]);
 return <mesh position={[0,.18,.05]}><planeGeometry args={[4.1,2.2]}/><meshBasicMaterial ref={material} color="white" toneMapped={false}/></mesh>;
}
