"use client";
import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {useV2} from '../state';
import {useWorlds} from './WorldsProvider';
import {wormholeSound} from './roomSound';

/** One transition state drives the scene mouth, travel, arrival, and sound. */
export function WormholeJourney(){
 const {trip,setTrip,choose}=useWorlds();const {world,goTo,prefs}=useV2();
 useEffect(()=>{if(!trip)return;const allowed=trip.stage==='departure'?trip.sourceWorld:trip.targetWorld;if(world!==allowed){setTrip(null);return;}
  wormholeSound(prefs.sound,trip.stage==='arrival');
  const timer=setTimeout(()=>{if(trip.stage==='departure'){goTo(trip.targetWorld,'direct');choose(trip.targetId??null);setTrip({...trip,stage:'arrival',started:performance.now()});}else setTrip(null);},prefs.reducedMotion?40:trip.stage==='departure'?2700:1600);
  return()=>clearTimeout(timer);
 },[trip,world,goTo,choose,setTrip,prefs.sound,prefs.reducedMotion]);
 if(!trip)return null;
 return <div className={`wormhole-journey ${trip.stage} ${prefs.reducedMotion?'still':''}`} role="status" aria-label="Wurmlochreise"><div className="wormhole-iris"/>{!prefs.reducedMotion&&Array.from({length:16},(_,i)=><i key={i} style={{animationDelay:`${.85+i*.055}s`,rotate:`${i*19}deg`}}/>)}<span>{trip.stage==='departure'?'Wurmloch öffnet sich':'Angekommen'} · {trip.label}</span><button onClick={()=>setTrip(null)}>Reise beenden ×</button></div>;
}

export function WormholeMouth(){
 const {trip,positions}=useWorlds();const {prefs}=useV2();const group=useRef<THREE.Group>(null);const mat=useRef<THREE.ShaderMaterial>(null);
 const uniforms=useMemo(()=>({time:{value:0},progress:{value:0}}),[]);
 useFrame(({camera},dt)=>{if(!trip||!group.current)return;const t=(performance.now()-trip.started)/1000;const location=trip.stage==='departure'?positions.current.get(trip.sourceId??''):[0,3,0];group.current.position.set(location?.[0]??0,(location?.[1]??0)-(trip.stage==='departure'?2.7:0),location?.[2]??0);if(trip.stage==='departure')group.current.rotation.set(-Math.PI/2,0,0);else group.current.quaternion.copy(camera.quaternion);group.current.scale.setScalar(trip.stage==='departure'?1+Math.min(1,t/2.6)*3.8:Math.max(.05,1.8-t));if(mat.current){mat.current.uniforms.time.value+=prefs.reducedMotion?0:Math.min(dt,.05);mat.current.uniforms.progress.value=t;}});
 if(!trip)return null;
 return <group ref={group}>{trip.stage==='departure'&&<mesh position={[0,0,-6]} rotation={[Math.PI/2,0,0]} raycast={()=>null}><cylinderGeometry args={[3.9,.35,12,64,16,true]}/><shaderMaterial uniforms={uniforms} transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} vertexShader="varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}" fragmentShader={`varying vec2 v;uniform float time;void main(){float thread=pow(.5+.5*sin(v.x*100.+v.y*16.-time*6.),18.);float wave=pow(.5+.5*sin(v.y*60.-time*12.+sin(v.x*20.)*2.),10.);gl_FragColor=vec4(mix(vec3(.35,.2,.9),vec3(.3,.85,1.),v.y),(.06+thread*.2+wave*.3)*smoothstep(0.,.18,v.y));}`}/></mesh>}<mesh raycast={()=>null}><planeGeometry args={[14,14,1,1]}/><shaderMaterial ref={mat} uniforms={uniforms} transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} vertexShader="varying vec2 uvv;void main(){uvv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}" fragmentShader={`varying vec2 uvv;uniform float time;uniform float progress;void main(){vec2 p=(uvv-.5)*2.;float r=length(p),a=atan(p.y,p.x);float edge=.56+.026*sin(a*13.-time*8.)+.016*sin(a*27.+time*5.);float rim=exp(-abs(r-edge)*48.);float throat=pow(max(0.,sin(r*44.-a*3.-time*7.)),10.)*smoothstep(.1,.5,r)*(1.-smoothstep(.55,.8,r));float haze=exp(-abs(r-edge)*7.);vec3 c=mix(vec3(.45,.22,1.),vec3(.3,.9,1.),.5+.5*sin(a*2.+time));gl_FragColor=vec4(c*(rim*2.+throat*.65+haze*.2),clamp(rim+throat*.4+haze*.22,0.,1.));}`}/></mesh>{trip.stage==='arrival'&&<mesh><sphereGeometry args={[1.2,24,16]}/><meshStandardMaterial color="#98bddf" emissive="#a58cdd" emissiveIntensity={.5}/></mesh>}</group>;
}
