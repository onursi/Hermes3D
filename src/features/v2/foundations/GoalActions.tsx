"use client";
import {Billboard,Line,Text} from '@react-three/drei';
import {DIRECTIONS,type Point} from './goalLayout';
import type {WorldObject} from './model';
import type {RoutineSignal} from './horizonRoutines';
export function GoalActions({goals,signals,layout,selected}:{goals:WorldObject[];signals:RoutineSignal[];layout:Map<string,Point>;selected:string|null}){
 return <>{signals.filter(r=>r.found).map((r,index)=>{const targets=goals.filter(g=>g.actions?.includes(r.name));if(selected&&!targets.some(g=>g.id===selected))return null;const sector=DIRECTIONS.find(d=>d.id===r.sector);if(!targets.length&&!sector)return null;const p:Point=targets.length?targets.reduce((a,g)=>{const q=layout.get(g.id)!;return [a[0]+q[0]/targets.length,a[1]+q[1]/targets.length,a[2]+q[2]/targets.length] as Point;},[0,0,0] as Point):[sector!.center[0]*1.9,sector!.center[1]*1.5,-45];p[0]+=7+index*2;p[1]-=7+index*2;return <group key={r.name}><Billboard position={p}><mesh raycast={()=>null}><ringGeometry args={[.25,.40,24]}/><meshBasicMaterial color={r.doneToday?'#ffe5a0':'#7e91a9'} transparent opacity={.8}/></mesh><Text position={[0,-1,0]} maxWidth={13} fontSize={.25} color={r.doneToday?'#ffe5a0':'#a5b1c1'}>{'Handlung · '+r.name}</Text></Billboard>{selected&&targets.map(g=><Line key={g.id} points={[p,layout.get(g.id)!]} color="#d9c19a" transparent opacity={.3} lineWidth={1}/>)}</group>;})}</>;
}
