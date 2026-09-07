"use client";
import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useState, useRef } from "react";
import * as THREE from "three";
import type { Project } from "../useProjects";
import { BlackHole } from "./BlackHole";
import { orbitState, planetSize, type ProjectMeta } from "./model";

export function SingularityWorld({ projects, metadata, selected, reducedMotion, onSelect, onDive }: { projects: Project[]; metadata: Record<string, ProjectMeta>; selected: string | null; reducedMotion: boolean; onSelect: (p: Project)=>void; onDive: ()=>void }) {
  const [now] = useState(()=>Date.now());
  return <>
    <BlackHole reducedMotion={reducedMotion} onDive={onDive}/>
    <ambientLight intensity={.65}/><pointLight position={[0,4,0]} intensity={180} color="#ffd2a4" decay={1.5}/>
    {projects.map((project,i)=><Planet key={project.folder} project={project} angle={i/Math.max(projects.length,1)*Math.PI*2+.35} state={orbitState(metadata[project.folder],now)} selected={selected===project.folder} reducedMotion={reducedMotion} onSelect={onSelect}/>)}
  </>;
}
function Planet({project,angle,state,selected,reducedMotion,onSelect}:{ project: Project; angle:number; state:ReturnType<typeof orbitState>; selected:boolean; reducedMotion:boolean; onSelect:(p:Project)=>void }){
 const group=useRef<THREE.Group>(null); const current=useRef(state.radius); const phase=useRef(angle); const size=planetSize(project);
 useFrame((_,dt)=>{ if(!group.current)return;current.current=THREE.MathUtils.damp(current.current,state.radius,2,Math.min(dt,.05)); if(!reducedMotion)phase.current+=dt*.008;group.current.position.set(Math.cos(phase.current)*current.current,Math.sin(angle*2)*3,Math.sin(phase.current)*current.current); });
 return <group ref={group} position={[Math.cos(angle)*state.radius,Math.sin(angle*2)*3,Math.sin(angle)*state.radius]}>
  <mesh onClick={e=>{e.stopPropagation();onSelect(project);}}>
   <sphereGeometry args={[size,40,24]}/><meshStandardMaterial color={state.tone} roughness={.55} metalness={.35} emissive={state.tone} emissiveIntensity={selected?.25:.04}/>
  </mesh>
  <mesh rotation={[Math.PI/2.7,0,.3]} raycast={()=>null}><torusGeometry args={[size*1.45,.025,6,64]}/><meshBasicMaterial color={selected?"#f2dcba":state.tone} transparent opacity={selected?.9:.22}/></mesh>
  <Billboard position={[0,size+1.2,0]}><Text fontSize={.65} color={selected?"#fff3da":"#bdcbd4"} outlineWidth={.02} outlineColor="#060810" maxWidth={14} textAlign="center">{project.name}</Text></Billboard>
 </group>;
}
