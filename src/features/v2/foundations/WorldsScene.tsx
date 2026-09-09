"use client";
import {Billboard,Text} from "@react-three/drei";
import {useFrame} from "@react-three/fiber";
import {useMemo,useRef} from "react";
import * as THREE from "three";
import {useV2} from "../state";
import {useWorlds} from "./WorldsProvider";
import {projectRadius,type WorldObject} from "./model";
import {ProjectSystem} from "./ProjectSystem";
import {BlackHole} from "../spatial/BlackHole";
import {GoalHorizonScene} from "./GoalHorizonScene";
import {SuccessScene} from './SuccessScene';
const PALETTE=['#ead1a0','#a6bde7','#d9afc9','#98cfb8','#beaff0'];
export const ROOM_WORLDS=['horizon','flow','atelier','sanctuary','success'];
export function objectPosition(o:WorldObject,i:number,n:number,world:string):[number,number,number]{
 if(world==='projects'){const r=projectRadius(o.state),a=i/Math.max(1,n)*Math.PI*2+.4;return [Math.cos(a)*r,Math.sin(a*2)*2,Math.sin(a)*r];}
 if(world==='success')return [(i%3-1)*11,2,-Math.floor(i/3)*12];
 if(world==='horizon'){const group=['beruflich','lernen','familiär','gesundheit','spirituell'].indexOf(o.groups[0]);const a=Math.max(group,0)/5*Math.PI*2;return [Math.cos(a)*17+Math.cos(i*2.4)*3,5+Math.sin(i*2.4)*2,Math.sin(a)*12+Math.sin(i*2.4)*3];}
 const a=i/Math.max(n,1)*Math.PI*2+.2;
 return [Math.cos(a)*13,world==='horizon'?5+Math.sin(a*2)*4:2+Math.sin(a*3)*2,Math.sin(a)*9];
}
function Dust({warm=false}:{warm?:boolean}){
 const positions=useMemo(()=>{const p=new Float32Array(1600*3);let s=71;for(let i=0;i<p.length;i++){s=(s*1664525+1013904223)>>>0;p[i]=(s/4294967296-.5)*180;}return p;},[]);
 return <points raycast={()=>null}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]}/></bufferGeometry><pointsMaterial color={warm?'#dfbb83':'#9dafd6'} size={.055} transparent opacity={.55} depthWrite={false}/></points>;
}
function Artifact({object,position,color,moon=false}:{object:WorldObject;position:[number,number,number];color:string;moon?:boolean}){
 const {world,prefs}=useV2();const {selected,choose}=useWorlds();const ref=useRef<THREE.Group>(null);const active=selected===object.id;
 useFrame(({clock})=>{if(ref.current&&!prefs.reducedMotion){ref.current.rotation.y=clock.elapsedTime*(world==='success'?.035:.07);ref.current.position.y=Math.sin(clock.elapsedTime*.5+position[0])*.18;}});
 const size=moon?.55:world==='projects'?1.5:world==='success'?2:world==='atelier'?.7:.65;
 return <group position={position}>
  <group ref={ref}><mesh onClick={e=>{e.stopPropagation();choose(object.id);}}>
   {world==='success'||world==='atelier'?<octahedronGeometry args={[size,world==='success'?0:1]}/>:<sphereGeometry args={[size,24,16]}/>}
   <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active?1.5:.3} metalness={.8} roughness={.24} flatShading/>
  </mesh>{world==='success'&&<><mesh raycast={()=>null} rotation={[.4,.3,.15]}><octahedronGeometry args={[size*1.35,0]}/><meshBasicMaterial color="#f0d39c" wireframe transparent opacity={.4}/></mesh><mesh position={[0,-size-1,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[size*1.5,size*1.56,64]}/><meshBasicMaterial color="#d8ba82" side={THREE.DoubleSide}/></mesh></>}<mesh rotation={[Math.PI*.43,0,.3]} raycast={()=>null}><torusGeometry args={[size*1.7,.016,5,64]}/><meshBasicMaterial color={color} transparent opacity={active?.9:.35}/></mesh></group>
  {moon&&active&&[.85,1,1.15,1.3,1.45].map((r,i)=><mesh key={r} rotation={[-Math.PI/2,0,0]} raycast={()=>null}><torusGeometry args={[r,.013,4,48]}/><meshBasicMaterial color={i===Math.max(0,['idee','entwurf','in-arbeit','abnahme','fertig'].indexOf(object.state))?'#ffe5af':'#9d85c2'} transparent opacity={.7}/></mesh>)}
  <Billboard position={[0,size+1.2,0]}><Text fontSize={active?.65:.48} color={active?'#fff4dc':'#b9bdc9'} maxWidth={12} textAlign="center" outlineWidth={.015} outlineColor="#050810">{object.title}</Text></Billboard>
 </group>;
}
export function WorldsScene({onDive,onFocus,controlsRef,cameraBusy=false}:{onDive?:()=>void;onFocus?:(position:[number,number,number],target:[number,number,number],duration?:number)=>void;controlsRef?:React.MutableRefObject<{target:THREE.Vector3;update:()=>void;enabled:boolean}|null>;cameraBusy?:boolean}){
 const {world,prefs}=useV2();const {objects,choose,jobs}=useWorlds();
 const kind=world==='horizon'?'goal':world==='atelier'?'idea':'project';
 const visible=objects.filter(o=>o.kind===kind&&(world!=='success'||o.state==='abgeschlossen')&&(world!=='projects'||o.state!=='abgeschlossen'));
 const roots=visible.filter(o=>!o.parent);const positions=new Map(roots.map((o,i)=>[o.id,objectPosition(o,i,roots.length,world)]));

 return <>
  <ambientLight intensity={.55}/><pointLight position={[8,20,12]} intensity={160} color={world==='success'?'#ffe2b6':'#b5cbf6'} distance={140}/>
  {world==='projects'?<BlackHole reducedMotion={prefs.reducedMotion} onDive={onDive??(()=>{})}/>:world!=='horizon'?<Dust warm={world==='success'||world==='sanctuary'}/>:null}
  {world==='success'&&onFocus&&<SuccessScene onFocus={onFocus}/>}
  {world==='horizon'&&onFocus&&<GoalHorizonScene onFocus={onFocus}/>}
  {world==='projects'&&onFocus&&controlsRef&&<ProjectSystem onFocus={onFocus} controlsRef={controlsRef} cameraBusy={cameraBusy}/>}
  {world==='atelier'&&roots.map((o,i)=><Artifact key={o.id} object={o} position={positions.get(o.id)!} color={PALETTE[i%5]}/>)}
  {world==='flow'&&<><mesh rotation={[-Math.PI/2,0,0]} raycast={()=>null}><torusGeometry args={[13,.06,8,160]}/><meshBasicMaterial color="#719fbe" transparent opacity={.4}/></mesh>{['Eingang','Verarbeitung','Deine Freigabe','Ergebnis'].map((label,i)=><group key={label} position={[Math.cos(i*Math.PI/2)*13,0,Math.sin(i*Math.PI/2)*13]}><mesh><octahedronGeometry args={[.8,0]}/><meshStandardMaterial color={PALETTE[i]} emissive={PALETTE[i]} emissiveIntensity={.4}/></mesh><Billboard position={[0,2,0]}><Text fontSize={.5} color="#b9cadb">{label}</Text></Billboard></group>)}{jobs.map((job,i)=><FlowRun key={job.id} index={i} running={!!job.state?.runningAtMs&&job.enabled} title={job.name} onClick={()=>choose('run:'+job.id)}/>)}</>}
  {world==='sanctuary'&&<><mesh position={[0,-4,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[26,80]}/><meshStandardMaterial color="#162a26" roughness={.9}/></mesh>{Array.from({length:7},(_,i)=><group key={i} rotation={[0,i*Math.PI/7,0]}><mesh position={[0,6,-18]}><torusGeometry args={[9+i*.3,.045,8,96,Math.PI]}/><meshStandardMaterial color="#e9c488" emissive="#e9c488" emissiveIntensity={.6}/></mesh></group>)}<mesh position={[0,5,-22]}><sphereGeometry args={[4,32,24]}/><meshBasicMaterial color="#f2d6a0"/></mesh><pointLight position={[0,7,-15]} color="#ffe0a4" intensity={200}/></>}
 </>;
}
function FlowRun({index,running,title,onClick}:{index:number;running:boolean;title:string;onClick:()=>void}){const ref=useRef<THREE.Group>(null);const {prefs}=useV2();useFrame(({clock})=>{if(ref.current){const a=index*1.3+(running&&!prefs.reducedMotion?clock.elapsedTime*.22:0);ref.current.position.set(Math.cos(a)*13,1,Math.sin(a)*13);}});return <group ref={ref}><mesh onClick={onClick}><sphereGeometry args={[.3,12,8]}/><meshBasicMaterial color={running?'#8df2d1':'#a8b6c7'}/></mesh><Billboard position={[0,1,0]}><Text fontSize={.35} color="#baccd7">{title}</Text></Billboard></group>;}
