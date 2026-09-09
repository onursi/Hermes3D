"use client";
import {Billboard,Line,Text} from '@react-three/drei';
import {useFrame} from '@react-three/fiber';
import {useEffect,useMemo,useRef} from 'react';
import * as THREE from 'three';
import {useV2} from '../state';
import {useWorlds} from './WorldsProvider';
import {isSuccess,successLinks,successPosition} from './successModel';
import type {WorldObject} from './model';
import {roomSound} from './roomSound';
type Point=[number,number,number];
const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
function Trophy({object,position}:{object:WorldObject;position:Point}){
 const {choose,selected}=useWorlds();const {prefs}=useV2();const material=useRef<THREE.ShaderMaterial>(null);const star=useRef<THREE.Mesh>(null);const frame=useRef<THREE.Group>(null);const goal=object.kind==='goal',active=selected===object.id;
 const uniforms=useMemo(()=>({t:{value:0},gold:{value:new THREE.Color(goal?'#ffe9b3':'#ffba60')}}),[goal]);
 useFrame(({clock})=>{if(material.current)material.current.uniforms.t.value=prefs.reducedMotion?0:clock.elapsedTime;if(frame.current&&!prefs.reducedMotion)frame.current.rotation.y=clock.elapsedTime*.16;if(star.current)star.current.scale.setScalar(active?1.2:1);});
 const pick=()=>{choose(object.id);roomSound(prefs.sound*.3,true);};
 return <group position={position}><Billboard><mesh ref={star} onClick={e=>{e.stopPropagation();pick();}}><planeGeometry args={[goal?11:7,goal?11:7]}/><shaderMaterial ref={material} transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} uniforms={uniforms} vertexShader={vertex} fragmentShader={`varying vec2 vUv;uniform float t;uniform vec3 gold;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float pulse=1.+.06*sin(t*1.8);float core=exp(-r*r*440.)*3.;float glow=exp(-r*11.)*.8;float rays=(exp(-abs(p.x)*95.)*exp(-abs(p.y)*5.)+exp(-abs(p.y)*95.)*exp(-abs(p.x)*5.))*.7;float wave=exp(-pow((r-(.24+sin(t*.5)*.025))*65.,2.))*.13;gl_FragColor=vec4(gold,(core+glow+rays+wave)*pulse);}`}/></mesh></Billboard>{!goal&&<group ref={frame}><mesh onClick={pick}><octahedronGeometry args={[1,0]}/><meshStandardMaterial color="#bf8745" metalness={.8} roughness={.22}/></mesh><mesh raycast={()=>null}><octahedronGeometry args={[1.5,0]}/><meshBasicMaterial color="#ffd388" wireframe/></mesh></group>}<Billboard position={[0,-3,0]}><Text fontSize={.4} maxWidth={9} textAlign="center" color={active?'#fff3d3':'#dfc7a0'}>{object.title}</Text></Billboard><mesh position={[0,-7.8,0]} rotation={[-Math.PI/2,0,0]} raycast={()=>null}><ringGeometry args={[1.8,1.9,64]}/><meshBasicMaterial color="#dda54e" transparent opacity={.65}/></mesh></group>;
}
function FoldedLight(){
 const {prefs}=useV2();const lines=useRef<THREE.LineSegments>(null);const data=useMemo(()=>{const vertices=Array.from({length:16},(_,i)=>[0,1,2,3].map(k=>i&(1<<k)?1:-1));const edges:number[][]=[];for(let i=0;i<16;i++)for(let j=i+1;j<16;j++){const d=i^j;if((d&(d-1))===0)edges.push([i,j]);}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(edges.length*6),3));return{vertices,edges,geometry};},[]);
 useEffect(()=>()=>data.geometry.dispose(),[data]);
 useFrame(({clock})=>{const t=prefs.reducedMotion?.3:clock.elapsedTime*.18;const points=data.vertices.map(([x,y,z,w])=>{const a=x*Math.cos(t)-w*Math.sin(t),b=x*Math.sin(t)+w*Math.cos(t),c=y*Math.cos(t*.7)-z*Math.sin(t*.7),d=y*Math.sin(t*.7)+z*Math.cos(t*.7);const f=2.8/(2.8-b);return[a*f*6,c*f*6+9,d*f*6-45];});const geometry=lines.current?.geometry;if(!geometry)return;const p=geometry.attributes.position.array as Float32Array;let k=0;for(const edge of data.edges)for(const i of edge)for(const v of points[i])p[k++]=v;geometry.attributes.position.needsUpdate=true;});
 return <lineSegments ref={lines} geometry={data.geometry} frustumCulled={false} raycast={()=>null}><lineBasicMaterial color="#ffdf93" transparent opacity={.75}/></lineSegments>;
}
function VaultWall({position,size}:{position:Point;size:Point}){return <mesh position={position} raycast={()=>null}><boxGeometry args={size}/><meshStandardMaterial color="#986523" metalness={.76} roughness={.38} emissive="#50310a" emissiveIntensity={.35}/></mesh>;}
export function SuccessScene({onFocus}:{onFocus:(p:Point,t:Point,d?:number)=>void}){
 const {objects,selected,positions}=useWorlds();const {prefs}=useV2();const visible=useMemo(()=>objects.filter(isSuccess),[objects]);
 const layout=useMemo(()=>{let goals=0,projects=0;return new Map(visible.map(o=>[o.id,successPosition(o,o.kind==='goal'?goals++:projects++)]));},[visible]);
 useEffect(()=>{const registry=positions.current;for(const [id,p] of layout)registry.set(id,p);return()=>{for(const id of layout.keys())registry.delete(id);};},[layout,positions]);
 useEffect(()=>{const p=selected?layout.get(selected):undefined;onFocus(p?[p[0],p[1]+2,p[2]+13]:[0,5,29],p??[0,3,-23],prefs.reducedMotion?0:1.8);},[selected,layout,onFocus,prefs.reducedMotion]);
 const active=visible.find(o=>o.id===selected);const linked=active?successLinks(active,visible):[];
 return <><VaultWall position={[-26,7,-30]} size={[.7,30,120]}/><VaultWall position={[26,7,-30]} size={[.7,30,120]}/><VaultWall position={[0,7,-90]} size={[52,30,.7]}/><VaultWall position={[0,7,30]} size={[52,30,.7]}/><VaultWall position={[0,22,-30]} size={[52,.7,120]}/><mesh position={[0,-8,-30]} rotation={[-Math.PI/2,0,0]} raycast={()=>null}><planeGeometry args={[52,120]}/><meshStandardMaterial color="#020203" metalness={.7} roughness={.24}/></mesh>
 {[...Array(12)].map((_,i)=><group key={i} position={[0,0,27-i*10]}>{[-25.5,25.5].map(x=><mesh key={x} position={[x,7,0]} raycast={()=>null}><boxGeometry args={[.12,30,.12]}/><meshBasicMaterial color="#f3c66d"/></mesh>)}<mesh position={[0,21.5,0]} raycast={()=>null}><boxGeometry args={[51,.1,.1]}/><meshBasicMaterial color="#f3c66d"/></mesh></group>)}
 <VaultWall position={[0,0,-35]} size={[.4,16,88]}/>{[-.26,.26].map(x=><mesh key={x} position={[x,10,-35]} rotation={[0,Math.PI/2,0]} raycast={()=>null}><planeGeometry args={[88,8]}/><shaderMaterial transparent depthWrite={false} side={THREE.DoubleSide} vertexShader={vertex} fragmentShader={`varying vec2 vUv;void main(){vec2 g=abs(fract(vUv*vec2(44.,4.))-.5);float line=step(.475,max(g.x,g.y));gl_FragColor=vec4(1.,.72,.3,line*.7+.035);}`}/></mesh>)}
 <Billboard position={[-13,14,-10]}><Text fontSize={.8} letterSpacing={.1} color="#ffe5a3">ERREICHTE ZIELE</Text></Billboard><Billboard position={[13,14,-10]}><Text fontSize={.7} letterSpacing={.08} color="#edbd78">VOLLENDETE PROJEKTE</Text></Billboard><FoldedLight/>
 {[-15,15].map(x=><pointLight key={x} position={[x,13,-18]} color="#ffdc99" intensity={300} distance={85}/>)}
 {visible.map(o=><Trophy key={o.id} object={o} position={layout.get(o.id)!}/>)}
 {active&&linked.map(o=>{const a=layout.get(active.id)!,b=layout.get(o.id)!;return <Line key={o.id} points={[a,[a[0],17,a[2]],[b[0],17,b[2]],b]} color="#e6c6ff" lineWidth={2} transparent opacity={.8}/>;})}
 {!visible.some(o=>o.kind==='goal')&&<Billboard position={[-13,3,-10]}><Text fontSize={.45} maxWidth={15} textAlign="center" color="#b9a78c">Noch kein erreichtes Ziel dokumentiert.</Text></Billboard>}
 </>;
}
