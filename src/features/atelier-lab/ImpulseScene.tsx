"use client";
import {Billboard,Line,OrbitControls,Text} from '@react-three/drei';
import {Canvas,useFrame} from '@react-three/fiber';
import {Suspense,useEffect,useMemo,useRef} from 'react';
import * as THREE from 'three';
import {formOf,type Lab,type Impulse,type Link} from './model';
type Pulse={id:string;at:number}|null;
type Point=[number,number,number];
function hash(s:string){let n=17;for(const c of s)n=(Math.imul(n,31)+c.charCodeAt(0))>>>0;return n/4294967296;}
function position(i:Impulse,index:number):Point{const angle=index*2.399963;const r=5+Math.sqrt(index)*3;return [Math.cos(angle)*r,Math.sin(angle)*r*.82,(hash(i.id+'depth')-.5)*27];}
function Neuron({impulse,stage,point,active,quiet,pulseAt,arrival,onPick}:{impulse:Impulse;stage:string;point:Point;active:boolean;quiet:boolean;pulseAt?:number;arrival:number;onPick:()=>void}){
 const core=useRef<THREE.Group>(null);const shell=useRef<THREE.Mesh>(null);
 const color=impulse.resting?'#8797ae':stage==='Klare Idee'?'#c4efc8':stage==='Silhouette'?'#c1b5ff':stage==='Gedankenwolke'?'#b6c7ff':'#8bdaed';
 const arms=useMemo(()=>Array.from({length:7},(_,k)=>{const angle=k/7*Math.PI*2+hash(impulse.id),r=1.8+hash(impulse.id+k)*1.3;const end:Point=[Math.cos(angle)*r,Math.sin(angle)*r,Math.sin(k*2+hash(impulse.id)*5)*2.2];return {end,points:[[0,0,0],[end[0]*.4+.2,end[1]*.4-.2,end[2]*.8],end] as Point[]};}),[impulse.id]);
 useFrame(({clock})=>{const t=quiet?0:clock.elapsedTime;if(core.current)core.current.scale.setScalar(1+Math.sin(t*.75+point[0])*.065+(!quiet&&pulseAt?Math.max(0,1-Math.abs((performance.now()-pulseAt)/1000-arrival)/.65)*.48:0));if(shell.current)shell.current.rotation.set(t*.06,t*.1,0);});
 return <group position={point} rotation={[hash(impulse.id)*.6,hash(impulse.id+'tilt')*1.1,0]}>
  <group ref={core}>
   {arms.map((arm,k)=><group key={k}><Line points={arm.points} color={color} lineWidth={active?1.5:.85} transparent opacity={impulse.resting?.2:.48}/><Line points={[arm.points[1],[arm.end[0]*.8+.7,arm.end[1]*.8-.5,arm.end[2]+.6]]} color={color} transparent opacity={.22} lineWidth={.6}/><mesh position={arm.end} raycast={()=>null}><sphereGeometry args={[.038,6,6]}/><meshBasicMaterial color={color}/></mesh></group>)}
   <mesh onClick={e=>{e.stopPropagation();onPick();}}><sphereGeometry args={[.42,24,16]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={active?2.2:1.1} roughness={.25} metalness={.6}/></mesh>
   <mesh ref={shell} raycast={()=>null}><icosahedronGeometry args={[stage==='Impuls'?.68:1.15,1]}/><meshBasicMaterial color={color} wireframe={stage!=='Klare Idee'} transparent opacity={stage==='Impuls'?.09:stage==='Klare Idee'?.18:.3}/></mesh>
   {stage==='Gedankenwolke'&&[0,1,2].map(k=><mesh key={k} position={[Math.cos(k*2.1)*.7,Math.sin(k*2.1)*.6,0]} raycast={()=>null}><sphereGeometry args={[.65,16,12]}/><meshBasicMaterial color={color} transparent opacity={.07} depthWrite={false}/></mesh>)}
   <Billboard><mesh onClick={e=>{e.stopPropagation();onPick();}}><planeGeometry args={[3.5,3.5]}/><shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} uniforms={{tint:{value:new THREE.Color(color)}}} vertexShader={'varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}'} fragmentShader={'varying vec2 uv0;uniform vec3 tint;void main(){float r=length(uv0-.5)*2.;gl_FragColor=vec4(tint,exp(-r*7.)*.7);}'} /></mesh></Billboard>
  </group>
  <Billboard position={[0,-3.1,0]}><Text fontSize={active?.37:.28} maxWidth={6} textAlign="center" color={active?'#f4ecff':'#a9bfd0'} outlineWidth={.018} outlineColor="#050b16">{impulse.raw.length>70?impulse.raw.slice(0,67)+'…':impulse.raw}</Text><Text position={[0,-.75,0]} fontSize={.19} color={color}>{impulse.resting?'RUHEND':stage.toUpperCase()}</Text></Billboard>
 </group>;
}
function Synapse({link,a,b,scanning,quiet,pulse,onPick}:{link:Link;a:Point;b:Point;scanning:boolean;quiet:boolean;pulse:Pulse;onPick:()=>void}){
 const dot=useRef<THREE.Mesh>(null);const curve=useMemo(()=>new THREE.QuadraticBezierCurve3(new THREE.Vector3(...a),new THREE.Vector3((a[0]+b[0])/2,(a[1]+b[1])/2+2,(a[2]+b[2])/2-1),new THREE.Vector3(...b)),[a,b]);
 const points=useMemo(()=>curve.getPoints(32),[curve]);const vec=useMemo(()=>new THREE.Vector3(),[]);
 useFrame(({clock})=>{if(!dot.current)return;const age=pulse?.id===link.id?(performance.now()-pulse.at)/1000:-1;const firing=age>=0&&age<2.4;const idle=link.status==='confirmed'&&(clock.elapsedTime+hash(link.id)*12)%9<1.8;dot.current.visible=!quiet&&(firing||scanning||idle);const u=firing?Math.min(1,age/1.6):scanning?(clock.elapsedTime*.35)%1:((clock.elapsedTime+hash(link.id)*12)%9)/1.8;dot.current.position.copy(curve.getPoint(Math.max(0,Math.min(1,u)),vec));dot.current.scale.setScalar(firing?2.6:1);});
 return <><Line points={points} color={link.status==='confirmed'?'#d5b2ff':'#729bb0'} lineWidth={link.status==='confirmed'?1.6:.85} dashed={link.status==='candidate'} dashSize={.3} gapSize={.2} transparent opacity={link.status==='confirmed'?.8:.4} onClick={e=>{e.stopPropagation();onPick();}}/>{<mesh ref={dot} raycast={()=>null}><sphereGeometry args={[.11,8,8]}/><meshBasicMaterial color="#c8f6ff"/></mesh>}</>;
}
function Environment({quiet}:{quiet:boolean}){
 const group=useRef<THREE.Points>(null);
 const dust=useMemo(()=>{const p=new Float32Array(1900*3);for(let i=0;i<1900;i++){const a=hash('a'+i)*Math.PI*2,r=28+hash('r'+i)*85;p.set([Math.cos(a)*r,(hash('h'+i)-.5)*70,Math.sin(a)*r-30],i*3);}return p;},[]);
 useFrame((_,dt)=>{if(group.current&&!quiet)group.current.rotation.y+=dt*.002;});
 return <><color attach="background" args={['#040912']}/><fog attach="fog" args={['#040912',65,155]}/><ambientLight intensity={.5}/><pointLight position={[0,8,15]} intensity={120} color="#9ec7ff" distance={80}/><points ref={group} raycast={()=>null}><bufferGeometry><bufferAttribute attach="attributes-position" args={[dust,3]}/></bufferGeometry><pointsMaterial size={.055} color="#8eb2d5" transparent opacity={.42}/></points><mesh position={[0,0,-36]} raycast={()=>null}><planeGeometry args={[180,130]}/><shaderMaterial depthWrite={false} transparent vertexShader={'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}'} fragmentShader={'varying vec2 p;void main(){float a=exp(-length((p-vec2(.25,.5))*vec2(2.,3.))*4.);float b=exp(-length((p-vec2(.75,.6))*vec2(2.,4.))*5.);gl_FragColor=vec4(vec3(.10,.22,.29)*a+vec3(.20,.10,.28)*b,.9);}'} /></mesh></>;
}
function Camera({reset}:{reset:number}){
 const controls=useRef<React.ComponentRef<typeof OrbitControls>>(null);
 useEffect(()=>{controls.current?.reset();},[reset]);
 return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.075} minDistance={5} maxDistance={100} maxPolarAngle={Math.PI*.95}/>;
}
export default function ImpulseScene({lab,selected,scanning,quiet,pulse,onPick,reset}:{lab:Lab;selected:string|null;scanning:boolean;quiet:boolean;pulse:Pulse;onPick:(id:string)=>void;reset:number}){
 const layout=useMemo(()=>new Map(lab.impulses.map((i,k)=>[i.id,position(i,k)])),[lab.impulses]);
 return <Canvas camera={{position:[9,9,43],fov:48,near:.1,far:250}} dpr={[1,1.5]} onPointerMissed={()=>{}}><Environment quiet={quiet}/><NeuralVolume quiet={quiet}/><Camera reset={reset}/><Suspense fallback={null}>{lab.links.filter(l=>l.status!=='rejected').map(l=><Synapse key={l.id} link={l} a={layout.get(l.a)!} b={layout.get(l.b)!} scanning={scanning&&(l.a===selected||l.b===selected)} quiet={quiet} pulse={pulse} onPick={()=>onPick(l.a)}/>)}{lab.impulses.map(i=><Neuron key={i.id} impulse={i} stage={formOf(lab,i.id)} point={layout.get(i.id)!} active={selected===i.id} quiet={quiet} pulseAt={lab.links.some(l=>l.id===pulse?.id&&(l.a===i.id||l.b===i.id))?pulse?.at:undefined} arrival={lab.links.find(l=>l.id===pulse?.id)?.a===i.id?0:1.6} onPick={()=>onPick(i.id)}/>)}</Suspense></Canvas>;
}

/** Ambient neural tissue is decorative; only the labelled links above represent user data. */
function NeuralVolume({quiet}:{quiet:boolean}){
 const material=useRef<THREE.ShaderMaterial>(null);const uniforms=useMemo(()=>({time:{value:0}}),[]);
 const points=useMemo(()=>{const out=new Float32Array(900*3);for(let i=0;i<900;i++){const h=i%2?1:-1;const a=hash('cortex-a'+i)*Math.PI*2,b=hash('cortex-b'+i)*Math.PI;const fold=1+Math.sin(a*9.+Math.sin(b*6.)*2.)*.1;out.set([h*(9+Math.abs(Math.sin(b)*Math.cos(a))*16)*fold,Math.cos(b)*19,Math.sin(b)*Math.sin(a)*20-30],i*3);}return out;},[]);
 const fibers=useMemo(()=>{const out:number[]=[];for(let i=0;i<900;i++){let closest=-1,distance=30;for(let j=i+1;j<Math.min(900,i+90);j++){const d=(points[i*3]-points[j*3])**2+(points[i*3+1]-points[j*3+1])**2+(points[i*3+2]-points[j*3+2])**2;if(d<distance){closest=j;distance=d;}}if(closest>=0)out.push(...points.slice(i*3,i*3+3),...points.slice(closest*3,closest*3+3));}return new Float32Array(out);},[points]);
 useFrame(({clock})=>{if(material.current)material.current.uniforms.time.value=quiet?0:clock.elapsedTime;});
 return <group raycast={()=>null}><lineSegments><bufferGeometry><bufferAttribute attach="attributes-position" args={[fibers,3]}/></bufferGeometry><lineBasicMaterial color="#447d92" transparent opacity={.13}/></lineSegments><points><bufferGeometry><bufferAttribute attach="attributes-position" args={[points,3]}/></bufferGeometry><shaderMaterial ref={material} transparent depthWrite={false} blending={THREE.AdditiveBlending} uniforms={uniforms} vertexShader={`uniform float time;varying float pulse;void main(){pulse=pow(.5+.5*sin(position.x*.7+position.z*.4-time*1.5),12.);vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=(2.+pulse*3.)*min(2.,35./max(1.,-p.z));gl_Position=projectionMatrix*p;}`} fragmentShader={`varying float pulse;void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(.4,.79,.89,exp(-r*r*5.)*(.15+pulse*.6));}`}/></points></group>;
}
