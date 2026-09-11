"use client";
import {Billboard,Line,Text} from '@react-three/drei';
import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import type {Group} from 'three';
import {useFlowWorkspace} from './FlowWorkspace';
import {useWorlds} from './WorldsProvider';
import {useV2} from '../state';
import {FLOW_STATES,flowPosition,flowSelection,type FlowState} from './flowModel';
const colors:Record<FlowState,string>={offen:'#9da9c3','in-arbeit':'#8ccee0',pruefen:'#e5c292',fertig:'#99d6b1',blockiert:'#d49da6'};
export function FlowScene({onFocus}:{onFocus?:(p:[number,number,number],t:[number,number,number],d?:number)=>void}){
 const {flow,stage}=useFlowWorkspace();const {choose,positions}=useWorlds();const {prefs}=useV2();const halo=useRef<Group>(null);const focus=useRef(onFocus);useEffect(()=>{focus.current=onFocus;},[onFocus]);
 const points=useMemo(()=>flow?.stages.map((_,i)=>flowPosition(i,flow.stages.length))??[],[flow]);
 useEffect(()=>{if(!flow)return;const map=positions.current;flow.stages.forEach((s,i)=>map.set(flowSelection(flow.project,s.id),points[i]));map.set(flow.project,[0,0,0]);return()=>{flow.stages.forEach(s=>map.delete(flowSelection(flow.project,s.id)));map.delete(flow.project);};},[flow,points,positions]);
 const stageIndex=flow?.stages.findIndex(s=>s.id===stage?.id)??-1, stageCount=flow?.stages.length??0, project=flow?.project;
 useEffect(()=>{if(!project)return;if(stageIndex<0){focus.current?.([0,22,42],[0,2,0],prefs.reducedMotion?.04:.85);return;}const p=flowPosition(stageIndex,stageCount);focus.current?.([p[0]*1.3,p[1]+5,p[2]+10],p,prefs.reducedMotion?.04:.85);},[stageIndex,stageCount,project,prefs.reducedMotion]);
 useFrame((_,dt)=>{if(halo.current&&!prefs.reducedMotion)halo.current.rotation.y+=dt*.035;});
 if(!flow)return null;
 return <group><group ref={halo}><mesh rotation={[-Math.PI/2,0,0]} raycast={()=>null}><torusGeometry args={[7,.025,6,128]}/><meshBasicMaterial color="#95b9cb" transparent opacity={.3}/></mesh><mesh rotation={[.55,.2,.6]} raycast={()=>null}><torusGeometry args={[5,.018,6,100]}/><meshBasicMaterial color="#af9bcf" transparent opacity={.28}/></mesh></group>
 <Billboard position={[0,3,0]}><Text fontSize={.65} maxWidth={10} textAlign="center" color="#d7e4e7">{flow.title}</Text><Text position={[0,-1.2,0]} fontSize={.3} color="#9faebc">PRODUKTIONSABLAUF · STATION WÄHLEN</Text></Billboard>
 {points.length>1&&<Line points={points} color="#728899" transparent opacity={.28} lineWidth={1}/>}
 {flow.stages.map((s,i)=><group key={s.id} position={points[i]}><mesh onClick={e=>{e.stopPropagation();choose(flowSelection(flow.project,s.id));window.dispatchEvent(new CustomEvent('hermes:panel-open',{detail:'left'}));}}><icosahedronGeometry args={[stage?.id===s.id?1.1:.85,2]}/><meshStandardMaterial color={colors[s.status]} emissive={colors[s.status]} emissiveIntensity={stage?.id===s.id?.9:.35} metalness={.55} roughness={.3}/></mesh><mesh rotation={[Math.PI/2,.25*i,.3]} raycast={()=>null}><torusGeometry args={[1.55,.035,8,64]}/><meshBasicMaterial color={colors[s.status]} transparent opacity={.65}/></mesh><Billboard position={[0,2.4,0]}><Text fontSize={.52} color="#dce6ea">{String(i+1).padStart(2,'0')} · {s.title}</Text><Text position={[0,-.7,0]} fontSize={.3} color={colors[s.status]}>{FLOW_STATES[s.status]}</Text></Billboard></group>)}
 </group>;
}
