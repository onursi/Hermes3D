"use client";
import {Billboard,Line,Text} from '@react-three/drei';
import {useFrame,useThree} from '@react-three/fiber';
import {useEffect,useMemo,useRef} from 'react';
import * as THREE from 'three';
import {useV2} from '../state';
import {useWorlds} from './WorldsProvider';
import {DIRECTIONS,closedGoal,goalConstellation,goalColor,nextMilestone,goalPath,BAND_LABELS,stableSeed,type Point} from './goalLayout';
import {roomSound,wormholeSound} from './roomSound';

import {routineDirections} from './horizonRoutines';
import {GoalActions} from './GoalActions';
import {HorizonLight,DivineHorizon,SupernovaReplay,DevotionStream} from './HorizonLight';
const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const glow=`varying vec2 vUv;uniform vec3 tint;uniform float outline;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float halo=exp(-r*6.)*.45;float core=exp(-r*r*140.);float rays=exp(-abs(p.x)*90.)*exp(-abs(p.y)*6.)+exp(-abs(p.y)*90.)*exp(-abs(p.x)*6.);float ring=exp(-pow((r-.24)*50.,2.));float a=mix(halo+core+rays*.6,halo*.2+ring*.65,outline);gl_FragColor=vec4(tint,a);}`;
function Star({position,color,size=1,outline=false,onClick}:{position:Point;color:string;size?:number;outline?:boolean;onClick?:()=>void}){
 const uniforms=useMemo(()=>({tint:{value:new THREE.Color(color)},outline:{value:outline?1:0}}),[color,outline]);
 return <Billboard position={position}><mesh onClick={onClick?e=>{e.stopPropagation();onClick();}:undefined} raycast={onClick?undefined:()=>null}><planeGeometry args={[size*7,size*7]}/><shaderMaterial vertexShader={vertex} fragmentShader={glow} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false}/></mesh></Billboard>;
}
function Firmament(){
 const backdrop=useRef<THREE.Group>(null);const {prefs}=useV2();const nebula=useRef<THREE.ShaderMaterial>(null);
 const uniforms=useMemo(()=>({time:{value:0}}),[]);
 const cloud=useMemo(()=>{const p=new Float32Array(4200*3),c=new Float32Array(p.length);for(let i=0;i<4200;i++){const a=stableSeed('az'+i)*Math.PI*2,b=Math.acos(2*stableSeed('el'+i)-1),r=130+stableSeed('r'+i)*280;p.set([Math.sin(b)*Math.cos(a)*r,Math.cos(b)*r,Math.sin(b)*Math.sin(a)*r],i*3);const color=new THREE.Color(['#e8cfad','#a4c6ef','#e3b9e9','#b7ddd4'][i%4]);c.set(color.toArray(),i*3);}return{p,c};},[]);
 useFrame(({clock,camera})=>{if(backdrop.current)backdrop.current.position.copy(camera.position);if(nebula.current)nebula.current.uniforms.time.value=prefs.reducedMotion?0:clock.elapsedTime*.016;});
 return <group ref={backdrop}><points raycast={()=>null}><bufferGeometry><bufferAttribute attach="attributes-position" args={[cloud.p,3]}/><bufferAttribute attach="attributes-color" args={[cloud.c,3]}/></bufferGeometry><pointsMaterial vertexColors size={.19} transparent opacity={.7} depthWrite={false}/></points>
 <mesh raycast={()=>null}><sphereGeometry args={[480,32,20]}/><shaderMaterial ref={nebula} side={THREE.BackSide} depthWrite={false} uniforms={uniforms} vertexShader={vertex} fragmentShader={`varying vec2 vUv;uniform float time;
 float field(vec2 p){float f=0.;float a=.5;for(int i=0;i<5;i++){f+=a*sin(p.x)*cos(p.y);p=mat2(1.6,1.2,-1.2,1.6)*p+2.;a*=.5;}return f;}
 void main(){vec2 p=vUv*vec2(12.,7.);float n=field(p+vec2(time*.25,0.));float band=exp(-pow((vUv.y-.51+sin(vUv.x*6.28)*.12+n*.045)*9.,2.));float cloud=pow(max(0.,n*.5+.5),2.)*band;vec3 c=mix(vec3(.065,.11,.19),vec3(.24,.095,.20),sin(p.x*.6)*.5+.5);gl_FragColor=vec4(vec3(.003,.007,.018)+c*cloud*1.9+vec3(.19,.15,.09)*pow(cloud,2.)*.8,1.);}`}/></mesh></group>;
}

function Sector({center,color,label,activity=0}:{center:Point;color:string;label:string;activity?:number}){
 const {prefs}=useV2();
 const layers=useRef<THREE.Group>(null);const materials=useRef<Array<THREE.ShaderMaterial|null>>([]);
 const uniforms=useMemo(()=>({tint:{value:new THREE.Color(color)},time:{value:0},strength:{value:1+Math.min(activity,5)*.08}}),[color,activity]);
 const particles=useMemo(()=>{
  const p=new Float32Array(340*3);
  for(let i=0;i<340;i++){
   const a=stableSeed(label+'angle'+i)*Math.PI*2;
   const r=Math.sqrt(stableSeed(label+'radius'+i));
   p.set([Math.cos(a)*r*45,Math.sin(a)*r*26,(stableSeed(label+'depth'+i)-.5)*65],i*3);
  }
  return p;
 },[label]);
 useFrame(({clock})=>{for(const material of materials.current)if(material)material.uniforms.time.value=prefs.reducedMotion?0:clock.elapsedTime*.025;if(layers.current)layers.current.rotation.z=prefs.reducedMotion?0:Math.sin(clock.elapsedTime*.035)*.035;});
 return <group position={center}>
  <group ref={layers}>{[0,1,2].map(k=><Billboard key={k} position={[Math.sin(k*2.1)*13,Math.cos(k*2.1)*7,-k*21]}><mesh raycast={()=>null} rotation={[0,0,k*.75]}><planeGeometry args={[112-k*7,78+k*8]}/><shaderMaterial ref={material=>{materials.current[k]=material;}} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} uniforms={uniforms} vertexShader={vertex} fragmentShader={`
   varying vec2 vUv;uniform vec3 tint;uniform float time;uniform float strength;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
   float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=noise(p)*a;p=mat2(1.6,1.2,-1.2,1.6)*p+3.7;a*=.5;}return v;}
   void main(){vec2 p=(vUv-.5)*2.;vec2 q=p*2.8+vec2(time*.12,-time*.08);float n=fbm(q+fbm(q+2.));float radius=length(p*vec2(.85,1.12));float edge=1.-smoothstep(.42,1.,radius);edge*=1.-smoothstep(.72,.98,max(abs(p.x),abs(p.y)));float ridge=pow(max(0.,1.-abs(n-.48)*3.4),3.);float dust=smoothstep(.22,.64,fbm(q*2.+n));float alpha=edge*edge*(.04+ridge*.13+dust*.10)*strength;vec3 c=mix(tint*.5,tint, dust);gl_FragColor=vec4(c,alpha);}`}/></mesh></Billboard>)}</group>
  <points raycast={()=>null}><bufferGeometry><bufferAttribute attach="attributes-position" args={[particles,3]}/></bufferGeometry><pointsMaterial color={color} size={.13} transparent opacity={.55} depthWrite={false} blending={THREE.AdditiveBlending}/></points>
  <Billboard position={[0,23,12]}><Text fontSize={1.35} letterSpacing={.16} color={color} outlineColor="#080d19" outlineWidth={.015}>{label.toUpperCase()}</Text></Billboard>
 </group>;
}
function GoalBody({point,color,title,size,onPick,achieved=false,dormant=false}:{point:Point;color:string;title:string;size:number;onPick:()=>void;achieved?:boolean;dormant?:boolean}){
 const label=useRef<THREE.Group>(null);const position=useMemo(()=>new THREE.Vector3(...point),[point]);
 useFrame(({camera})=>{if(label.current){const distance=camera.position.distanceTo(position);label.current.visible=distance<400;label.current.scale.setScalar(Math.max(.7,distance*.016));}});
 return <group><HorizonLight point={point} color={color} size={size} achieved={achieved} dormant={dormant} onPick={onPick}/><Billboard position={[point[0],point[1]-size*3,point[2]]}><group ref={label}><Text fontSize={.55} maxWidth={12} textAlign="center" color="#ece5da" outlineColor="#050810" outlineWidth={.015}>{title}</Text></group></Billboard></group>;
}
function OriginVector({origin}:{origin:Point}){
 const arrow=useRef<HTMLElement|null>(null),distance=useRef<HTMLElement|null>(null);const last=useRef(0);const point=useMemo(()=>new THREE.Vector3(),[]);
 useEffect(()=>{arrow.current=document.getElementById('goal-home-arrow');distance.current=document.getElementById('goal-home-distance');},[]);
 useFrame(({camera,clock})=>{if(clock.elapsedTime-last.current<.12)return;last.current=clock.elapsedTime;point.set(...origin);const d=camera.position.distanceTo(point);point.project(camera);const behind=point.z>1;const x=point.x*(behind?-1:1),y=-point.y*(behind?-1:1);if(arrow.current&&Number.isFinite(x)&&Number.isFinite(y))arrow.current.style.transform=`rotate(${Math.atan2(y,x)*180/Math.PI+90}deg)`;if(distance.current)distance.current.textContent=d<8?'Am Bezugspunkt':`${Math.round(d)} Raumeinheiten${behind?' · hinter dir':''}`;});
 return <Star position={origin} color="#c8e9ee" size={.5}/>;
}
function FlightVeil({journey,quiet}:{journey:string;quiet:boolean}){
 const material=useRef<THREE.ShaderMaterial>(null),group=useRef<THREE.Group>(null),start=useRef(0);const uniforms=useMemo(()=>({amount:{value:0},time:{value:0}}),[]);
 useEffect(()=>{start.current=performance.now();},[journey]);
 useFrame(({camera})=>{if(!material.current||!group.current)return;const t=(performance.now()-start.current)/2100;group.current.position.copy(camera.position);group.current.quaternion.copy(camera.quaternion);material.current.uniforms.amount.value=quiet||t>1?0:Math.sin(t*Math.PI)*.24;material.current.uniforms.time.value=t;});
 return <group ref={group}><mesh position={[0,0,-1]} raycast={()=>null} renderOrder={100}><planeGeometry args={[4,3]}/><shaderMaterial ref={material} transparent depthTest={false} depthWrite={false} uniforms={uniforms} vertexShader={vertex} fragmentShader={`varying vec2 vUv;uniform float amount;uniform float time;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.y,p.x);float rays=pow(max(0.,sin(a*71.+sin(a*11.))),22.);float stream=pow(max(0.,sin(r*26.-time*75.)),5.);gl_FragColor=vec4(.68,.82,1.,rays*stream*smoothstep(.3,1.,r)*amount);}`}/></mesh></group>;
}
export function GoalHorizonScene({onFocus}:{onFocus:(position:Point,target:Point,duration?:number)=>void}){
 const {prefs}=useV2();const {supernova,routineSignals,objects,selected,choose,horizonView,milestone,setMilestone,quick,positions,timeLayers,homeSignal}=useWorlds();
 const camera=useThree(s=>s.camera);
 useEffect(()=>{const look=()=>{const p=camera.position;onFocus([p.x,p.y,p.z],[p.x,p.y+100,p.z-10],prefs.reducedMotion?0:1.4);};window.addEventListener('hermes:horizon-zenith',look);return()=>window.removeEventListener('hermes:horizon-zenith',look);},[camera,onFocus,prefs.reducedMotion]);
 const size=useThree(s=>s.size);const goals=useMemo(()=>objects.filter(o=>o.kind==='goal'),[objects]);const active=goals.find(o=>o.id===selected);const next=active?nextMilestone(active):-1;const layout=useMemo(()=>goalConstellation(goals),[goals]);const route=useMemo(()=>{if(!active)return null;const path=goalPath(active),anchor=layout.get(active.id)!;if(closedGoal(active.state))return {...path,points:[],edges:[],goal:anchor,anchor};const offset=(p:Point):Point=>[p[0]+anchor[0],p[1]+anchor[1],p[2]+anchor[2]];return {...path,points:path.points.map(offset),goal:offset(path.goal),anchor};},[active,layout]);
 const color=active?goalColor(active):'#eacfa3';
 useEffect(()=>{const registry=positions.current;for(const [id,p] of layout)registry.set(id,p);if(active&&route)registry.set(active.id,route.goal);return()=>{for(const id of layout.keys())registry.delete(id);};},[layout,positions,active,route]);
 useEffect(()=>{const duration=prefs.reducedMotion?0:quick?.25:2.2;const frame=requestAnimationFrame(()=>{if(active&&route){const i=milestone??Math.max(0,next),p=route.points[i]??route.anchor;if(closedGoal(active.state)){onFocus([p[0],p[1]+2,p[2]+29],p,duration);return;}onFocus([p[0]+3,p[1]+3,p[2]+12],[p[0],p[1],p[2]-7],duration);}else if(horizonView==='top')onFocus([0,160,-45],[0,0,-45],duration);else onFocus([0,5,size.width<size.height?155:100],[0,8,-65],duration);});return()=>cancelAnimationFrame(frame);},[active,route,milestone,next,horizonView,homeSignal,onFocus,quick,prefs.reducedMotion,size.width,size.height]);
 const enter=(id:string)=>{setMilestone(null);choose(id);if(!quick&&!prefs.reducedMotion)wormholeSound(prefs.sound*.35);};
 return <><Firmament/><DivineHorizon/><DevotionStream active={routineSignals.some(r=>routineDirections(r,objects).includes('spirituell')&&r.doneToday)}/>{active?.state==='erreicht'&&route&&<SupernovaReplay key={active.id} point={route.goal} signal={supernova} quiet={prefs.reducedMotion}/> }<FlightVeil journey={(active?.id??'sky')+':'+milestone+':'+homeSignal} quiet={prefs.reducedMotion||quick}/><GoalActions goals={goals} signals={routineSignals} layout={layout} selected={selected}/><OriginVector origin={route?[route.anchor[0],route.anchor[1],route.anchor[2]+8]:[0,0,20]}/>
 {!active&&<>
 {DIRECTIONS.map(d=><Sector key={d.id} center={[d.center[0]*1.9,d.center[1]*1.5,-45]} color={d.color} label={d.label} activity={routineSignals.filter(r=>routineDirections(r,objects).includes(d.id)&&r.doneToday).length}/>)}
 {timeLayers&&BAND_LABELS.map((label,i)=><group key={label} position={[0,0,-28-i*32]}><mesh raycast={()=>null}><planeGeometry args={[170,85]}/><meshBasicMaterial color="#a3cde5" transparent opacity={.035} side={THREE.DoubleSide} depthWrite={false}/></mesh><Billboard position={[-58,-22,0]}><Text fontSize={1} color="#b8cbdc">{label}</Text></Billboard></group>)}
 {goals.map(o=><GoalBody key={o.id} point={layout.get(o.id)!} color={goalColor(o)} achieved={o.state==='erreicht'} dormant={['nicht-erreicht','beendet','verworfen','zurueckgestellt'].includes(o.state)} size={o.importance==='gross'?1.9:o.importance==='klein'?1:1.4} title={o.path.split('/').pop()?.replace(/\.md$/,'')??o.title} onPick={()=>enter(o.id)}/>)}
 </>}
 {active&&route&&<>
 <Sector center={[route.goal[0],route.goal[1]+12,route.goal[2]-18]} color={color} label={active.state==='erreicht'?'Dein erreichtes Ziel':closedGoal(active.state)?'Deine Erfahrung bleibt':'Dein Ziel'}/>
 <GoalBody point={route.goal} color={color} size={active.state==='erreicht'?3.6:2.4} achieved={active.state==='erreicht'} dormant={['nicht-erreicht','beendet','verworfen','zurueckgestellt'].includes(active.state)} title={active.title} onPick={()=>onFocus([route.goal[0]+5,route.goal[1]+8,route.goal[2]+20],route.goal,quick?.25:2)}/>
 {!closedGoal(active.state)&&active.milestones.map((m,i)=>{const p=route.points[i],chosen=(milestone??next)===i;return <group key={i}>
 {route.edges[i].map(parent=><Line key={parent} points={[route.points[parent],[(route.points[parent][0]+p[0])/2,(route.points[parent][1]+p[1])/2+1.5,(route.points[parent][2]+p[2])/2],p]} color={m.done&&active.milestones[parent].done?'#98e2bf':'#9aafc9'} transparent opacity={chosen?.55:.23} dashed={!route.branched} dashSize={.7} gapSize={.3} lineWidth={chosen?2:1}/>)}
 <group position={p}><mesh rotation={[-Math.PI/2,0,0]} onClick={e=>{e.stopPropagation();setMilestone(i);}}><torusGeometry args={[2.3,.075,8,64]}/><meshBasicMaterial color={m.done?'#a2e8c1':chosen?'#ffdb98':'#9ab7d3'}/></mesh><Star position={[0,.8,0]} size={chosen?.95:.7} color={m.done?'#a2e8c1':chosen?'#ffdb98':'#9ab7d3'} onClick={()=>{setMilestone(i);roomSound(prefs.sound*.16,true);}}/><Billboard position={[0,3.7,0]}><Text fontSize={.25} maxWidth={5.5} textAlign="center" color="#e5ded0" outlineColor="#050810" outlineWidth={.02}>{`${m.done?'✓':i+1} ${m.title}`}</Text>{(timeLayers||chosen)&&<Text position={[0,-1.15,0]} fontSize={.2} maxWidth={12} color="#bdd3df">{m.date||'Termin offen'}</Text>}</Billboard></group>
 </group>;})}
 {!closedGoal(active.state)&&next>=0&&<Billboard position={[route.points[next][0]-4,route.points[next][1]+1,route.points[next][2]+6]}><Text fontSize={.42} color="#ffe4af">DEIN AKTUELLER STAND</Text><Text position={[0,-.7,0]} fontSize={.27} color="#bbc8d2">Vor dem ersten offenen Schritt</Text></Billboard>}
 {!closedGoal(active.state)&&!active.milestones.length&&<Billboard position={[route.anchor[0],route.anchor[1]+2,route.anchor[2]-4]}><Text fontSize={.55} maxWidth={18} color="#cbd5e3">Noch keine Meilensteine dokumentiert.</Text></Billboard>}
 </>}
 </>;
}
