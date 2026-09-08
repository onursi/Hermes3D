"use client";
import {Billboard,Line,Text} from '@react-three/drei';
import {useFrame,useThree} from '@react-three/fiber';
import {useEffect,useMemo,useRef} from 'react';
import * as THREE from 'three';
import {useV2} from '../state';
import {useWorlds} from './WorldsProvider';
import {DIRECTIONS,goalPosition,goalColor,nextMilestone,pathPosition,stableSeed,type Point} from './goalLayout';
import {roomSound} from './roomSound';

const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const glow=`varying vec2 vUv;uniform vec3 tint;uniform float outline;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float halo=exp(-r*6.)*.45;float core=exp(-r*r*140.);float rays=exp(-abs(p.x)*90.)*exp(-abs(p.y)*6.)+exp(-abs(p.y)*90.)*exp(-abs(p.x)*6.);float ring=exp(-pow((r-.24)*50.,2.));float a=mix(halo+core+rays*.6,halo*.2+ring*.65,outline);gl_FragColor=vec4(tint,a);}`;
function Star({position,color,size=1,outline=false,onClick}:{position:Point;color:string;size?:number;outline?:boolean;onClick?:()=>void}){
 const uniforms=useMemo(()=>({tint:{value:new THREE.Color(color)},outline:{value:outline?1:0}}),[color,outline]);
 return <Billboard position={position}><mesh onClick={onClick?e=>{e.stopPropagation();onClick();}:undefined} raycast={onClick?undefined:()=>null}><planeGeometry args={[size*7,size*7]}/><shaderMaterial vertexShader={vertex} fragmentShader={glow} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false}/></mesh></Billboard>;
}
function Firmament(){
 const {prefs}=useV2();const nebula=useRef<THREE.ShaderMaterial>(null);
 const uniforms=useMemo(()=>({time:{value:0}}),[]);
 const cloud=useMemo(()=>{const p=new Float32Array(4200*3),c=new Float32Array(p.length);for(let i=0;i<4200;i++){const a=stableSeed('az'+i)*Math.PI*2,b=Math.acos(2*stableSeed('el'+i)-1),r=130+stableSeed('r'+i)*280;p.set([Math.sin(b)*Math.cos(a)*r,Math.cos(b)*r,Math.sin(b)*Math.sin(a)*r],i*3);const color=new THREE.Color(['#e8cfad','#a4c6ef','#e3b9e9','#b7ddd4'][i%4]);c.set(color.toArray(),i*3);}return{p,c};},[]);
 useFrame(({clock})=>{if(nebula.current)nebula.current.uniforms.time.value=prefs.reducedMotion?0:clock.elapsedTime*.016;});
 return <><points raycast={()=>null}><bufferGeometry><bufferAttribute attach="attributes-position" args={[cloud.p,3]}/><bufferAttribute attach="attributes-color" args={[cloud.c,3]}/></bufferGeometry><pointsMaterial vertexColors size={.19} transparent opacity={.7} depthWrite={false}/></points>
 <mesh raycast={()=>null}><sphereGeometry args={[480,32,20]}/><shaderMaterial ref={nebula} side={THREE.BackSide} depthWrite={false} uniforms={uniforms} vertexShader={vertex} fragmentShader={`varying vec2 vUv;uniform float time;
 float field(vec2 p){float f=0.;float a=.5;for(int i=0;i<5;i++){f+=a*sin(p.x)*cos(p.y);p=mat2(1.6,1.2,-1.2,1.6)*p+2.;a*=.5;}return f;}
 void main(){vec2 p=vUv*vec2(12.,7.);float n=field(p+vec2(time*.25,0.));float band=exp(-pow((vUv.y-.51+sin(vUv.x*6.28)*.12+n*.045)*9.,2.));float cloud=pow(max(0.,n*.5+.5),2.)*band;vec3 c=mix(vec3(.026,.043,.07),vec3(.12,.058,.15),sin(p.x*.6)*.5+.5);gl_FragColor=vec4(vec3(.002,.004,.012)+c*cloud,1.);}`}/></mesh></>;
}
export function GoalHorizonScene({onFocus}:{onFocus:(position:Point,target:Point,duration?:number)=>void}){
 const {prefs}=useV2();const {objects,selected,choose,horizonView,milestone,setMilestone,quick,positions}=useWorlds();
 const size=useThree(s=>s.size);const goals=useMemo(()=>objects.filter(o=>o.kind==='goal'),[objects]);
 const active=goals.find(o=>o.id===selected);const next=active?nextMilestone(active):-1;
 const activeColor=active?goalColor(active):'#eacfa3';
 const layout=useMemo(()=>new Map(goals.map(o=>[o.id,goalPosition(o)])),[goals]);
 useEffect(()=>{const registry=positions.current;for(const [id,p] of layout)registry.set(id,p);if(active)registry.set(active.id,[0,3,-30]);return()=>{for(const id of layout.keys())registry.delete(id);};},[layout,positions,active]);
 useEffect(()=>{
  const narrow=size.width/size.height<1;
  const duration=prefs.reducedMotion?0:quick?.25:1.65;
  // Schedule after the enclosing world's entry camera so this framing owns the room.
  const frame=requestAnimationFrame(()=>{
   if(active){const target:Point=[0,1,-5];onFocus(narrow?[17,15,53]:[23,15,33],target,duration);}
   else if(horizonView==='top')onFocus([0,narrow?175:105,.01],[0,0,-8],duration);
   else onFocus([0,8,narrow?160:88],[0,1,-10],duration);
  });
  return()=>cancelAnimationFrame(frame);
 },[active,horizonView,onFocus,quick,prefs.reducedMotion,size.width,size.height]);
 const focusMilestone=(i:number)=>{setMilestone(i);roomSound(prefs.sound*.22,true);};
 return <><Firmament/>
 {!active&&<>
  {DIRECTIONS.map(d=>{const members=goals.filter(o=>o.groups.includes(d.id));return <group key={d.id}>
   <Billboard position={[d.center[0],d.center[1]+10,d.center[2]]}><Text fontSize={1.4} letterSpacing={.16} color={d.color}>{d.label.toUpperCase()}</Text><Text position={[0,-1.8,0]} fontSize={.5} color="#a6b1c6">{members.length?`${members.length} Ziel${members.length===1?'':'e'}`:'Raum für deine Zukunft'}</Text></Billboard>
   {members.map(o=><Line key={o.id} points={[d.center,layout.get(o.id)!]} color={d.color} transparent opacity={.2} lineWidth={.8}/>)}
   <Star position={d.center} color={d.color} size={.3}/>
  </group>;})}
  {goals.some(o=>!DIRECTIONS.some(d=>o.groups.includes(d.id)))&&<Billboard position={[0,-30,0]}><Text fontSize={.9} color="#c3cad8">NOCH OHNE RICHTUNG</Text></Billboard>}
  {goals.map(o=>{const p=layout.get(o.id)!;return <group key={o.id}>
   <Star position={p} color={goalColor(o)} size={o.importance==='gross'?1.1:o.importance==='klein'?.55:.8} outline={o.state==='unklar'||o.state==='verworfen'} onClick={()=>{setMilestone(null);choose(o.id);roomSound(prefs.sound*.35,true);}}/>
   {o.state==='zurueckgestellt'&&<Billboard position={p}><mesh raycast={()=>null}><ringGeometry args={[1.5,1.55,64]}/><meshBasicMaterial color="#c6c9e0" transparent opacity={.65}/></mesh></Billboard>}
   <Billboard position={[p[0],p[1]-2.5,p[2]]}><Text fontSize={.85} maxWidth={15} textAlign="center" color="#e5e4e5" outlineColor="#050810" outlineWidth={.035}>{o.path.split('/').pop()?.replace(/\.md$/,'')??o.title}</Text></Billboard>
  </group>;})}
 </>}
 {active&&<>
  <Star position={[0,3,-30]} color={activeColor} size={3.1} outline={active.state==='unklar'}/>
  <Billboard position={[0,11,-32]}><Text fontSize={.95} letterSpacing={.08} color={activeColor}>DEIN ZIELRAUM</Text><Text position={[0,-2.7,0]} maxWidth={30} textAlign="center" fontSize={.82} color="#e9e5df">{active.title}</Text></Billboard>
  <mesh position={[0,-2,-8]} rotation={[-Math.PI/2,0,0]} raycast={()=>null}><ringGeometry args={[23.9,24,160]}/><meshBasicMaterial color={activeColor} transparent opacity={.24}/></mesh>
  {[0,1,2].map(i=><mesh key={i} position={[0,-1.8,-7]} rotation={[Math.PI/2,.15+i*.45,0]} raycast={()=>null}><torusGeometry args={[27+i*2,.017,4,128,Math.PI*1.4]}/><meshBasicMaterial color={activeColor} transparent opacity={.12}/></mesh>)}
  {active.milestones.map((m,i)=>{const p=pathPosition(i,active.milestones.length),previous=pathPosition(i-1,active.milestones.length);const chosen=milestone===i;return <group key={i}>
   {i>0&&<Line points={[previous,[(p[0]+previous[0])/2,(p[1]+previous[1])/2+.4,(p[2]+previous[2])/2],p]} color={m.done&&active.milestones[i-1].done?'#9cebc7':'#9caecc'} transparent opacity={m.done?.75:.3} lineWidth={chosen?2.5:1.4}/>}
   <Star position={p} size={chosen?.8:.48} color={m.done?'#a5f2cb':i===next?'#ffda92':'#b7cceb'} onClick={()=>focusMilestone(i)}/>
   <Billboard position={[p[0],p[1]+1.5,p[2]]}><Text fontSize={.45} maxWidth={6} textAlign="center" color={chosen?'#fff2db':'#c8d4e4'} outlineWidth={.018} outlineColor="#050810">{`${m.done?'✓':i+1} ${m.title}`}</Text><Text position={[0,-1.25,0]} fontSize={.28} maxWidth={7} color="#94a7bf">{m.date??'Termin offen'}</Text></Billboard>
  </group>;})}
  {next>=0&&(()=>{const p=pathPosition(next,active.milestones.length);return <group position={[p[0]-2,p[1]-.3,p[2]+2]}><mesh raycast={()=>null}><cylinderGeometry args={[.06,.32,2.8,16]}/><meshBasicMaterial color="#ffda92" transparent opacity={.7}/></mesh><Billboard position={[0,2.2,0]}><Text fontSize={.4} color="#ffe4ac">DU BIST HIER</Text><Text position={[0,-.6,0]} fontSize={.25} color="#d3c8b4">Erster offener Meilenstein</Text></Billboard></group>;})()}
  {!active.milestones.length&&<Billboard position={[0,1,5]}><Text fontSize={.65} maxWidth={18} textAlign="center" color="#c6d2e4">Dein Weg ist noch offen.\nNoch keine Meilensteine dokumentiert.</Text></Billboard>}
 </>}
 </>;
}
