"use client";
import {Canvas,useFrame} from '@react-three/fiber';
import {OrbitControls,Billboard,Text,Line,Stars} from '@react-three/drei';
import {Suspense,useMemo,useRef} from 'react';import * as THREE from 'three';
import {AgentDeck} from '../v2/world/AgentDeck';import {ROLES,type CouncilState} from './model';
function Stage({state,quiet,onSource,onParticipant}:{state:CouncilState;quiet:boolean;onSource:()=>void;onParticipant:(id:string)=>void}){
 const latest=state.events.at(-1),speaker=state.phase==='paused'?null:latest?.participant;const core=useRef<THREE.Mesh>(null),pulse=useRef<THREE.Mesh>(null);const started=useRef({id:'',t:0});
 const seats=useMemo(()=>ROLES.map((p,i)=>{const a=i/ROLES.length*Math.PI*2;return {agent:{id:p.id,name:p.name,model:null,provider:p.provider,role:p.role,isDefault:false,skillCount:null},position:new THREE.Vector3(Math.sin(a)*5,0,-Math.cos(a)*5),angle:a};}),[]);
 const objection=latest?.type==='challenge'?latest:null;const target=objection?state.events.find(e=>e.id===objection.target)?.participant:null;
 const from=seats.find(s=>s.agent.id===speaker)?.position,to=seats.find(s=>s.agent.id===target)?.position;
 const gazeTargetById=Object.fromEntries(seats.map(seat=>[
   seat.agent.id,
   speaker&&speaker!==seat.agent.id
     ? (seats.find(candidate=>candidate.agent.id===speaker)?.position.clone().setY(1.1)??new THREE.Vector3(0,1.4,0))
     : new THREE.Vector3(0,1.7,0),
 ]));
 const spoken=latest?.participant&&['claim','challenge','synthesis'].includes(latest.type)?latest.text:'';
 const bubble=spoken.length>190?spoken.slice(0,187)+'…':spoken;
 useFrame(({clock},dt)=>{for(const seat of seats)seat.position.setY(THREE.MathUtils.damp(seat.position.y,seat.agent.id===speaker?.16:0,6,dt));if(core.current&&!quiet&&state.phase!=='paused')core.current.rotation.y+=Math.min(dt,.05)*.16;if(latest?.id!==started.current.id)started.current={id:latest?.id||'',t:clock.elapsedTime};if(pulse.current){const age=clock.elapsedTime-started.current.t;pulse.current.visible=!!from&&!!to&&age<1.5&&!quiet&&state.phase!=='paused';if(from&&to)pulse.current.position.lerpVectors(from,to,Math.min(1,age/1.5)).multiplyScalar(1.7).add(new THREE.Vector3(0,1.8,0));}});
 return <><color attach="background" args={['#040910']}/><ambientLight intensity={.65}/><pointLight position={[0,8,1]} intensity={160} color="#a0dcef"/><Stars radius={95} depth={35} count={1200} factor={2} fade speed={quiet?0:.1}/>
 <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.2,0]}><circleGeometry args={[12,96]}/><meshStandardMaterial color="#08131e" metalness={.7} roughness={.3}/></mesh>{[3.7,8.5,11.4].map(radius=><mesh key={radius} rotation={[-Math.PI/2,0,0]} raycast={()=>null}><ringGeometry args={[radius,radius+.035,128]}/><meshBasicMaterial color="#4f8d9b" transparent opacity={.5}/></mesh>)}
 <mesh ref={core} position={[0,1.7,0]} onClick={onSource}><icosahedronGeometry args={[1.15,1]}/><meshStandardMaterial color={objection?'#dfac76':'#75dce4'} emissive={objection?'#a96322':'#217f91'} emissiveIntensity={.7} wireframe/></mesh><Billboard position={[0,3.5,0]}><Text fontSize={.36} maxWidth={7} textAlign="center" color="#d9eff4">{state.mission||'Eine Frage. Mehrere Perspektiven.'}</Text></Billboard>
 {seats.map((seat,i)=><group key={seat.agent.id} position={[seat.position.x*1.7,0,seat.position.z*1.7]}><mesh rotation={[-Math.PI/2,0,0]} raycast={()=>null}><ringGeometry args={[.95,1.03,48]}/><meshBasicMaterial color={ROLES[i].color} transparent opacity={speaker===seat.agent.id?.9:.3}/></mesh><Billboard position={[0,2.5,0]}><Text fontSize={.23} color={ROLES[i].color}>{ROLES[i].name}</Text></Billboard>{speaker===seat.agent.id&&bubble&&<Billboard position={[0,4.15,0]}><mesh position={[0,0,-.03]}><planeGeometry args={[4.8,1.45]}/><meshBasicMaterial color="#07131f" transparent opacity={.92}/></mesh><Text fontSize={.18} maxWidth={4.25} lineHeight={1.35} textAlign="left" color="#e9f5f7">{bubble}</Text></Billboard>}</group>)}<group scale={1.7}><AgentDeck seats={seats} selectedId={speaker||null} focus={false} onSelect={onParticipant} gazeTargetById={gazeTargetById}/></group>
 {state.events.some(e=>e.source)&&<group position={[-3.8,3.6,0]} onClick={onSource}><mesh><boxGeometry args={[2.8,1.7,.04]}/><meshStandardMaterial color="#26354a" emissive="#142637"/></mesh><Billboard><Text fontSize={.2} color="#d5c5ef" maxWidth={2.4} textAlign="center">QUELLE 01{ '\n'}Testbriefing öffnen</Text></Billboard></group>}
 {objection&&from&&to&&<Line points={[from.clone().multiplyScalar(1.7).add(new THREE.Vector3(0,1.8,0)),to.clone().multiplyScalar(1.7).add(new THREE.Vector3(0,1.8,0))]} color="#edb879" lineWidth={1.5} transparent opacity={.35}/>}<mesh ref={pulse} visible={false} raycast={()=>null}><sphereGeometry args={[.14,12,12]}/><meshBasicMaterial color="#fff0c7"/></mesh>
 <OrbitControls makeDefault enableDamping target={[0,1,0]} minDistance={5} maxDistance={70}/></>;
}
export default function CouncilScene(props:Parameters<typeof Stage>[0]){return <Canvas camera={{position:[14,13,22],fov:46}} dpr={[1,1.35]}><Suspense fallback={null}><Stage {...props}/></Suspense></Canvas>;}
