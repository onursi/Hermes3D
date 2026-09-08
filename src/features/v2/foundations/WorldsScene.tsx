"use client";
import {Billboard,Text,Line} from "@react-three/drei";
import {useFrame} from "@react-three/fiber";
import {useEffect,useMemo,useRef} from "react";
import * as THREE from "three";
import {useV2} from "../state";
import {useWorlds} from "./WorldsProvider";
import {projectRadius,type WorldObject} from "./model";
import {ProjectSystem} from "./ProjectSystem";
import {BlackHole} from "../spatial/BlackHole";
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
function HyperArchive(){
 const {prefs}=useV2();const lines=useRef<THREE.LineSegments>(null);const racks=useRef<THREE.InstancedMesh>(null);
 const structure=useMemo(()=>{
  const vertices:number[][]=[];for(let i=0;i<16;i++)vertices.push([0,1,2,3].map(k=>i&(1<<k)?1:-1));
  const edges:number[][]=[];for(let i=0;i<16;i++)for(let j=i+1;j<16;j++){const d=i^j;if((d&(d-1))===0)edges.push([i,j]);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(edges.length*6*4),3));return{vertices,edges,geometry};
 },[]);
 useEffect(()=>()=>structure.geometry.dispose(),[structure]);
 useEffect(()=>{if(!racks.current)return;const dummy=new THREE.Object3D();let i=0;for(let depth=0;depth<16;depth++)for(let side=-1;side<=1;side+=2)for(let level=0;level<5;level++){dummy.position.set(side*20,level*5-8,-depth*9+35);dummy.scale.set(.1,.08,7);dummy.updateMatrix();racks.current.setMatrixAt(i++,dummy.matrix);}for(let depth=0;depth<16;depth++)for(let side=-1;side<=1;side+=2){dummy.position.set(side*20,2,-depth*9+35);dummy.scale.set(.11,29,.12);dummy.updateMatrix();racks.current.setMatrixAt(i++,dummy.matrix);}racks.current.instanceMatrix.needsUpdate=true;},[]);
 useFrame(({clock})=>{const t=prefs.reducedMotion?.4:clock.elapsedTime*.065;const p=structure.geometry.attributes.position.array as Float32Array;let k=0;
  for(let layer=0;layer<4;layer++){const scale=5+layer*4;const points=structure.vertices.map(([x,y,z,w])=>{const xx=x*Math.cos(t)-w*Math.sin(t),ww=x*Math.sin(t)+w*Math.cos(t);const yy=y*Math.cos(t*.7)-z*Math.sin(t*.7),zz=y*Math.sin(t*.7)+z*Math.cos(t*.7);const projection=2.8/(2.8-ww);return[xx*projection*scale,yy*projection*scale+9,zz*projection*scale-34];});for(const edge of structure.edges)for(const index of edge){p[k++]=points[index][0];p[k++]=points[index][1];p[k++]=points[index][2];}}
  structure.geometry.attributes.position.needsUpdate=true;
 });
 return <><lineSegments ref={lines} geometry={structure.geometry} frustumCulled={false}><lineBasicMaterial color="#edc993" transparent opacity={.22}/></lineSegments><instancedMesh ref={racks} args={[undefined,undefined,192]} raycast={()=>null}><boxGeometry/><meshBasicMaterial color="#dbaa70" toneMapped={false}/></instancedMesh><mesh position={[0,-7,-20]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[160,220]}/><meshStandardMaterial color="#0c1018" roughness={.38} metalness={.7}/></mesh>{[-1,1].map(side=><mesh key={side} position={[side*20.1,3,-26]} rotation={[0,Math.PI/2,0]}><planeGeometry args={[145,30]}/><meshStandardMaterial color="#694830" emissive="#855a32" emissiveIntensity={.15} transparent opacity={.23} side={THREE.DoubleSide} depthWrite={false}/></mesh>)}<mesh position={[0,7,-100]}><planeGeometry args={[170,110]}/><shaderMaterial transparent depthWrite={false} vertexShader={`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`} fragmentShader={`varying vec2 vUv;void main(){vec2 p=vUv-.5;float light=exp(-length(p*vec2(1.3,1.8))*5.);float rays=pow(max(0.,sin(vUv.x*190.)),18.)*.14;vec3 c=vec3(.22,.13,.055)*light+vec3(.2,.16,.08)*rays*light;gl_FragColor=vec4(c,.9);}`}/></mesh><pointLight position={[0,12,-20]} intensity={180} color="#ffc681" distance={100}/></>;
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
 const {world,prefs}=useV2();const {objects,selected,choose,jobs}=useWorlds();
 const kind=world==='horizon'?'goal':world==='atelier'?'idea':'project';
 const visible=objects.filter(o=>o.kind===kind&&(world!=='success'||o.state==='abgeschlossen')&&(world!=='projects'||o.state!=='abgeschlossen'));
 const roots=visible.filter(o=>!o.parent);const positions=new Map(roots.map((o,i)=>[o.id,objectPosition(o,i,roots.length,world)]));
 const active=objects.find(o=>o.id===selected);
 return <>
  <ambientLight intensity={.55}/><pointLight position={[8,20,12]} intensity={160} color={world==='success'?'#ffe2b6':'#b5cbf6'} distance={140}/>
  {world==='projects'?<BlackHole reducedMotion={prefs.reducedMotion} onDive={onDive??(()=>{})}/>:<Dust warm={world==='success'||world==='sanctuary'}/>}
  {world==='success'&&<HyperArchive/>}
  {world==='projects'&&onFocus&&controlsRef&&<ProjectSystem onFocus={onFocus} controlsRef={controlsRef} cameraBusy={cameraBusy}/>}
  {['horizon','success','atelier'].includes(world)&&roots.map((o,i)=><Artifact key={o.id} object={o} position={positions.get(o.id)!} color={PALETTE[i%5]}/>)}
  {world==='horizon'&&['Beruf','Lernen','Familie','Gesundheit','Spiritualität'].map((name,i)=>{const a=i/5*Math.PI*2;return <Billboard key={name} position={[Math.cos(a)*22,11,Math.sin(a)*15]}><Text fontSize={.62} color={PALETTE[i]} letterSpacing={.12}>{name}</Text></Billboard>;})}
  {world==='horizon'&&active?.kind==='goal'&&active.groups.map(group=>{const index=['beruflich','lernen','familiär','gesundheit','spirituell'].indexOf(group);const position=positions.get(active.id);if(index<0||!position)return null;const a=index/5*Math.PI*2;return <Line key={group} points={[position,[Math.cos(a)*22,11,Math.sin(a)*15]]} color={PALETTE[index]} transparent opacity={.55} lineWidth={1}/>;})}
  {world==='horizon'&&active?.kind==='goal'&&active.milestones.map((m,i)=><group key={i} position={[-10+i*4,-3,9]}><mesh><sphereGeometry args={[.23,12,8]}/><meshBasicMaterial color={m.done?'#e9c681':'#78869e'}/></mesh><Billboard position={[0,-1.1,0]}><Text fontSize={.3} maxWidth={3.6} textAlign="center" color="#c4cad7">{m.title}</Text></Billboard></group>)}
  {world==='flow'&&<><mesh rotation={[-Math.PI/2,0,0]} raycast={()=>null}><torusGeometry args={[13,.06,8,160]}/><meshBasicMaterial color="#719fbe" transparent opacity={.4}/></mesh>{['Eingang','Verarbeitung','Deine Freigabe','Ergebnis'].map((label,i)=><group key={label} position={[Math.cos(i*Math.PI/2)*13,0,Math.sin(i*Math.PI/2)*13]}><mesh><octahedronGeometry args={[.8,0]}/><meshStandardMaterial color={PALETTE[i]} emissive={PALETTE[i]} emissiveIntensity={.4}/></mesh><Billboard position={[0,2,0]}><Text fontSize={.5} color="#b9cadb">{label}</Text></Billboard></group>)}{jobs.map((job,i)=><FlowRun key={job.id} index={i} running={!!job.state?.runningAtMs&&job.enabled} title={job.name} onClick={()=>choose('run:'+job.id)}/>)}</>}
  {world==='sanctuary'&&<><mesh position={[0,-4,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[26,80]}/><meshStandardMaterial color="#162a26" roughness={.9}/></mesh>{Array.from({length:7},(_,i)=><group key={i} rotation={[0,i*Math.PI/7,0]}><mesh position={[0,6,-18]}><torusGeometry args={[9+i*.3,.045,8,96,Math.PI]}/><meshStandardMaterial color="#e9c488" emissive="#e9c488" emissiveIntensity={.6}/></mesh></group>)}<mesh position={[0,5,-22]}><sphereGeometry args={[4,32,24]}/><meshBasicMaterial color="#f2d6a0"/></mesh><pointLight position={[0,7,-15]} color="#ffe0a4" intensity={200}/></>}
 </>;
}
function FlowRun({index,running,title,onClick}:{index:number;running:boolean;title:string;onClick:()=>void}){const ref=useRef<THREE.Group>(null);const {prefs}=useV2();useFrame(({clock})=>{if(ref.current){const a=index*1.3+(running&&!prefs.reducedMotion?clock.elapsedTime*.22:0);ref.current.position.set(Math.cos(a)*13,1,Math.sin(a)*13);}});return <group ref={ref}><mesh onClick={onClick}><sphereGeometry args={[.3,12,8]}/><meshBasicMaterial color={running?'#8df2d1':'#a8b6c7'}/></mesh><Billboard position={[0,1,0]}><Text fontSize={.35} color="#baccd7">{title}</Text></Billboard></group>;}
