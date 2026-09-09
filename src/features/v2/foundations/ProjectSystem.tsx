"use client";
import {Billboard,Text} from '@react-three/drei';
import {useFrame,useThree} from '@react-three/fiber';
import {useEffect,useMemo,useRef,type MutableRefObject} from 'react';
import * as THREE from 'three';
import {useV2} from '../state';
import {useWorlds} from './WorldsProvider';
import {type WorldObject,projectRadius} from './model';
import {PROJECT_PHASES,orbitPosition,planetView} from './projectMotion';
type Focus=(position:[number,number,number],target:[number,number,number],duration?:number)=>void;
type Controls={target:THREE.Vector3;update:()=>void;enabled:boolean};
const TINTS=['#9cbaec','#d9a582','#a4d2bc','#d0acf1','#e1c789'];

export function ProjectSystem({onFocus,controlsRef,cameraBusy}:{onFocus:Focus;controlsRef:MutableRefObject<Controls|null>;cameraBusy:boolean}){
 const {objects,selected,positions,trip}=useWorlds();const projects=objects.filter(o=>o.kind==='project'&&o.state!=='abgeschlossen');const roots=projects.filter(o=>!o.parent);const previous=useRef<string|null>(null);const tracking=useRef<THREE.Vector3|null>(null);const camera=useThree(s=>s.camera);const departing=useRef(false);
 useFrame(()=>{const position=selected?positions.current.get(selected):undefined;if(!position){previous.current=null;tracking.current=null;return;}
  if(previous.current!==selected){previous.current=selected;tracking.current=new THREE.Vector3(...position);const view=planetView(position,camera instanceof THREE.PerspectiveCamera?camera.aspect:1);onFocus(view.position,view.target,1.7/1.5);return;}
  const current=new THREE.Vector3(...position);if(tracking.current&&!cameraBusy&&!trip&&controlsRef.current?.enabled){const angle=Math.atan2(current.z,current.x)-Math.atan2(tracking.current.z,tracking.current.x);const axis=new THREE.Vector3(0,1,0);camera.position.sub(tracking.current).applyAxisAngle(axis,-angle).add(current);controlsRef.current?.target.sub(tracking.current).applyAxisAngle(axis,-angle).add(current);controlsRef.current?.update();}tracking.current=current;
 });
 useEffect(()=>{if(trip?.stage!=='departure')return;const p=positions.current.get(trip.sourceId??'');if(p){const v=planetView(p);onFocus([p[0]+(v.position[0]-p[0])*.14,p[1]-9,p[2]+(v.position[2]-p[2])*.14],[p[0],p[1]-13,p[2]],2.5);}},[trip,positions,onFocus]);
 useEffect(()=>{if(departing.current&&!trip&&selected){const p=positions.current.get(selected);if(p){const v=planetView(p,camera instanceof THREE.PerspectiveCamera?camera.aspect:1);onFocus(v.position,v.target,1);}}departing.current=trip?.stage==='departure';},[trip,selected,positions,camera,onFocus]);
 return <><PhaseBelts/>{roots.map((object,index)=><OrbitPlanet key={object.id} object={object} index={index} total={roots.length} color={TINTS[index%TINTS.length]} childrenProjects={projects.filter(o=>o.parent===object.id)}/>)}</>;
}

function PhaseBelts(){const {setPhase,phase}=useWorlds();const {prefs}=useV2();return <>{PROJECT_PHASES.map((p,i)=><group key={p.id}><PhaseBelt radius={projectRadius(p.id)} color={p.color} active={phase===p.id} reduced={prefs.reducedMotion} onClick={()=>setPhase(p.id)}/><Billboard position={[projectRadius(p.id),.4,0]}><Text fontSize={.6} color={p.color} onClick={e=>{e.stopPropagation();setPhase(p.id);}}>{5-i} · {p.title}</Text></Billboard></group>)}</>;}
function PhaseBelt({radius,color,active=false,reduced,onClick}:{radius:number;color:string;active?:boolean;reduced:boolean;onClick?:()=>void}){
 const material=useRef<THREE.ShaderMaterial>(null);const uniforms=useMemo(()=>({time:{value:0},tint:{value:new THREE.Color(color)},radius:{value:radius},uFocus:{value:active?1:0}}),[radius,color,active]);
 useFrame((_,dt)=>{if(material.current&&!reduced)material.current.uniforms.time.value+=Math.min(dt,.05);});
 return <mesh rotation={[-Math.PI/2,0,0]} onClick={onClick?e=>{e.stopPropagation();onClick();}:undefined}><ringGeometry args={[radius-.4,radius+.4,192]}/><shaderMaterial ref={material} uniforms={uniforms} transparent side={THREE.DoubleSide} depthWrite={false} vertexShader="varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}" fragmentShader={`varying vec3 p;uniform float time;uniform vec3 tint;uniform float radius;uniform float uFocus;void main(){float r=length(p.xy);float edge=1.-smoothstep(.04,.4,abs(r-radius));float a=atan(p.y,p.x);float grain=.4+.6*pow(.5+.5*sin(r*90.+sin(a*31.)*2.),3.);float stream=pow(.5+.5*sin(a*5.-time*.35),18.);gl_FragColor=vec4(tint*(.7+stream*.6+uFocus*.5),edge*(.2+grain*.32+stream*.3+uFocus*.15));}`}/></mesh>;
}

function PlanetSurface({color,size=2.25}:{color:string;size?:number}){
 const material=useRef<THREE.ShaderMaterial>(null);const uniforms=useMemo(()=>({tint:{value:new THREE.Color(color)}}),[color]);
 return <><mesh><sphereGeometry args={[size,48,32]}/><shaderMaterial ref={material} uniforms={uniforms} vertexShader={`varying vec3 p;varying vec3 n;varying vec3 viewDirection;void main(){p=position;n=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);viewDirection=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`} fragmentShader={`varying vec3 p;varying vec3 n;varying vec3 viewDirection;uniform vec3 tint;void main(){float cloud=sin(p.y*7.+sin(p.x*3.+p.z*2.)*1.3);cloud+=sin(p.y*17.+sin(p.z*6.)*1.5)*.28;float bands=smoothstep(-.6,.9,cloud);float storms=pow(.5+.5*sin(p.x*9.+sin(p.y*6.)+p.z*8.),8.);float light=.19+.81*max(0.,dot(normalize(n),normalize(vec3(-.5,.6,1.))));float rim=pow(1.-max(0.,dot(normalize(n),normalize(viewDirection))),3.);vec3 base=mix(tint*.2,tint*1.05,bands)*light;gl_FragColor=vec4(base+rim*tint*.85+storms*tint*.08,1.);}`}/></mesh><mesh raycast={()=>null}><sphereGeometry args={[size*1.065,32,24]}/><shaderMaterial transparent depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending} uniforms={uniforms} vertexShader={`varying vec3 normalV;varying vec3 viewV;void main(){vec4 p=modelViewMatrix*vec4(position,1.);normalV=normalize(normalMatrix*normal);viewV=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`} fragmentShader={`varying vec3 normalV;varying vec3 viewV;uniform vec3 tint;void main(){float rim=pow(1.-abs(dot(normalize(normalV),normalize(viewV))),3.);gl_FragColor=vec4(tint,rim*.28);}`}/></mesh></>;
}

function OrbitPlanet({object,index,total,color,childrenProjects}:{object:WorldObject;index:number;total:number;color:string;childrenProjects:WorldObject[]}){
 const {prefs}=useV2();const {selected,choose,positions,trip}=useWorlds();const group=useRef<THREE.Group>(null);const globe=useRef<THREE.Group>(null);const time=useRef(0);const active=selected===object.id||childrenProjects.some(c=>c.id===selected);
 useFrame((_,dt)=>{if(!group.current)return;if(!prefs.reducedMotion)time.current+=Math.min(dt,.05);const p=orbitPosition(object.state,index,total,time.current);group.current.position.set(...p);positions.current.set(object.id,p);if(globe.current)globe.current.rotation.y=time.current*.12;const engulf=trip?.stage==='departure'&&(trip.sourceId===object.id);const fall=engulf?Math.pow(Math.min(1,Math.max(0,(performance.now()-trip.started-500)/2000)),2):0;group.current.position.y-=fall*14;group.current.scale.setScalar(1-fall*.97);if(globe.current&&engulf)globe.current.rotation.y+=fall*3;});
 useEffect(()=>()=>{positions.current.delete(object.id);},[object.id,positions]);
 return <group ref={group}><group ref={globe} onClick={e=>{e.stopPropagation();choose(object.id);}}><PlanetSurface color={color}/></group><Billboard position={[0,3.7,0]}><Text fontSize={active?.3:.4} maxWidth={active?6:9} textAlign="center" color={active?'#fff1d8':'#bed0dc'} onClick={e=>{e.stopPropagation();choose(object.id);}}>{object.title}</Text></Billboard>
 {childrenProjects.length>0&&<group rotation={[.13,0,.2]}>{PROJECT_PHASES.map((phase,i)=><mesh key={phase.id} rotation={[-Math.PI/2,0,0]} raycast={()=>null}><ringGeometry args={[4.5+(4-i)*.8,4.63+(4-i)*.8,96]}/><meshBasicMaterial color={phase.color} transparent opacity={active?.65:.3} side={THREE.DoubleSide}/></mesh>)}{active&&childrenProjects.map((child,i)=><ProjectMoon key={child.id} object={child} index={i} total={childrenProjects.length} parentRef={group}/>)}</group>}
 </group>;
}
function ProjectMoon({object,index,total,parentRef}:{object:WorldObject;index:number;total:number;parentRef:MutableRefObject<THREE.Group|null>}){
 const {prefs}=useV2();const {choose,positions,selected,trip}=useWorlds();const ref=useRef<THREE.Group>(null);const globe=useRef<THREE.Group>(null);const time=useRef(0);const worldPoint=useMemo(()=>new THREE.Vector3(),[]);const rank=PROJECT_PHASES.findIndex(p=>p.id===object.state);const radius=4.5+(4-Math.max(0,rank))*.8;
 useFrame((_,dt)=>{if(!ref.current)return;if(!prefs.reducedMotion)time.current+=Math.min(dt,.05);const a=index/Math.max(1,total)*Math.PI*2+time.current*.08;ref.current.position.set(Math.cos(a)*radius,0,Math.sin(a)*radius);if(globe.current)globe.current.rotation.y=time.current*.2;parentRef.current?.updateWorldMatrix(true,true);ref.current.getWorldPosition(worldPoint);positions.current.set(object.id,worldPoint.toArray() as [number,number,number]);const falling=trip?.stage==='departure'&&trip.sourceId===object.id;const fall=falling?Math.pow(Math.min(1,Math.max(0,(performance.now()-trip.started-500)/2000)),2):0;ref.current.position.y-=fall*14;ref.current.scale.setScalar(1-fall*.97);});
 useEffect(()=>()=>{positions.current.delete(object.id);},[positions,object.id]);
 return <group ref={ref} onClick={e=>{e.stopPropagation();choose(object.id);}}><group ref={globe}><PlanetSurface color="#bfa8e0" size={.55}/></group><Billboard position={[0,1.2,0]}><Text fontSize={selected===object.id?.4:.3} maxWidth={5} textAlign="center" color="#d4c2f4">{object.title}</Text></Billboard></group>;
}
