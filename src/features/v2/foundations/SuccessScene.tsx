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
/** A camera-centred envelope has no exterior the orbit camera can reveal.
 * Real trophies remain in world coordinates; only the distant architecture repeats. */
function TimelessVault(){
 const {prefs}=useV2();
 const shell=useRef<THREE.Mesh>(null),floor=useRef<THREE.Mesh>(null),arches=useRef<THREE.Group>(null);
 const material=useRef<THREE.ShaderMaterial>(null);
 const uniforms=useMemo(()=>({time:{value:0}}),[]);
 const arch=useMemo(()=>Array.from({length:81},(_,i):Point=>{const a=i/80*Math.PI;return [Math.cos(a)*42,-8+Math.sin(a)*50,0];}),[]);
 useFrame(({camera,clock})=>{
  if(shell.current)shell.current.position.copy(camera.position);
  if(floor.current)floor.current.position.set(camera.position.x,-8,camera.position.z);
  if(arches.current)arches.current.position.z=Math.floor(camera.position.z/22)*22;
  if(material.current)material.current.uniforms.time.value=prefs.reducedMotion?0:clock.elapsedTime;
 });
 return <>
  <mesh ref={shell} raycast={()=>null} renderOrder={-10}>
   <sphereGeometry args={[4000,48,32]}/>
   <shaderMaterial ref={material} side={THREE.BackSide} depthWrite={false} toneMapped={false} uniforms={uniforms}
    vertexShader={`varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
    fragmentShader={`varying vec3 direction;uniform float time;
     void main(){vec3 d=normalize(direction);float az=atan(d.z,d.x);float elevation=asin(d.y);
      float ribs=pow(.5+.5*cos(az*24.),48.);float bands=pow(.5+.5*cos(elevation*32.),70.);
      float veil=.5+.5*sin(az*5.+sin(elevation*7.)*.6+time*.025);
      float echo=pow(.5+.5*cos(az*12.+elevation*8.+time*.014),18.);
      float ceiling=smoothstep(-.15,.8,d.y);float horizon=exp(-abs(d.y)*7.);
      vec3 dark=vec3(.009,.008,.013);vec3 gold=vec3(.64,.35,.105);
      vec3 color=dark+gold*(.08+ceiling*.12+veil*.075+ribs*.16+bands*.055+echo*.035);
      color+=vec3(.30,.19,.075)*horizon*.24;
      gl_FragColor=vec4(color,1.);
     }`}/>
  </mesh>
  <mesh ref={floor} position={[0,-8,0]} rotation={[-Math.PI/2,0,0]} raycast={()=>null}>
   <planeGeometry args={[20000,20000]}/><meshStandardMaterial color="#050508" metalness={.65} roughness={.32}/>
  </mesh>
  <group ref={arches}>{Array.from({length:25},(_,i)=><group key={i} position={[0,0,(i-12)*22]}>
   <Line points={arch} color="#eac17e" transparent opacity={.24} lineWidth={1.2}/>
   <group scale={[1.07,1.05,1]} position={[0,.4,-3]}><Line points={arch} color="#b78b49" transparent opacity={.12} lineWidth={1}/></group>
  </group>)}</group>
  {[-23,23].map(x=><mesh key={x} position={[x,-7.94,-90]} rotation={[-Math.PI/2,0,0]} raycast={()=>null}>
   <planeGeometry args={[.055,420]}/><meshBasicMaterial color="#c99850" transparent opacity={.32}/>
  </mesh>)}
 </>;
}
export function SuccessScene({onFocus}:{onFocus:(p:Point,t:Point,d?:number)=>void}){
 const {objects,selected,positions}=useWorlds();const {prefs}=useV2();const visible=useMemo(()=>objects.filter(isSuccess),[objects]);
 const layout=useMemo(()=>{let goals=0,projects=0;return new Map(visible.map(o=>[o.id,successPosition(o,o.kind==='goal'?goals++:projects++)]));},[visible]);
 useEffect(()=>{const registry=positions.current;for(const [id,p] of layout)registry.set(id,p);return()=>{for(const id of layout.keys())registry.delete(id);};},[layout,positions]);
 useEffect(()=>{const p=selected?layout.get(selected):undefined;onFocus(p?[p[0],p[1]+2,p[2]+13]:[0,5,29],p??[0,3,-23],prefs.reducedMotion?0:1.8);},[selected,layout,onFocus,prefs.reducedMotion]);
 const active=visible.find(o=>o.id===selected);const linked=active?successLinks(active,visible):[];
 return <><TimelessVault/>
 <Billboard position={[-13,14,-10]}><Text fontSize={.8} letterSpacing={.1} color="#ffe5a3">ERREICHTE ZIELE</Text></Billboard><Billboard position={[13,14,-10]}><Text fontSize={.7} letterSpacing={.08} color="#edbd78">VOLLENDETE PROJEKTE</Text></Billboard>
 {[-15,15].map(x=><pointLight key={x} position={[x,13,-18]} color="#ffdc99" intensity={300} distance={85}/>)}
 {visible.map(o=><Trophy key={o.id} object={o} position={layout.get(o.id)!}/>)}
 {active&&linked.map(o=>{const a=layout.get(active.id)!,b=layout.get(o.id)!;return <Line key={o.id} points={[a,[a[0],17,a[2]],[b[0],17,b[2]],b]} color="#e6c6ff" lineWidth={2} transparent opacity={.8}/>;})}
 {!visible.some(o=>o.kind==='goal')&&<Billboard position={[-13,3,-10]}><Text fontSize={.45} maxWidth={15} textAlign="center" color="#b9a78c">Noch kein erreichtes Ziel dokumentiert.</Text></Billboard>}
 </>;
}
