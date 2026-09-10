"use client";
import {useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {cinemaPath,FILM_SECONDS} from './cinemaPath';
type Controls={target:THREE.Vector3;enabled:boolean;update:()=>void};
function setFov(camera:THREE.Camera,value:number){if(camera instanceof THREE.PerspectiveCamera){camera.fov=value;camera.updateProjectionMatrix();}}
type Cue=(phase:number)=>(()=>void)|undefined;
export function CinematicTour({controlsRef,world,blocked,quiet,onCue}:{controlsRef:React.RefObject<Controls|null>;world:string;blocked:boolean;quiet:boolean;onCue?:Cue}){
 const camera=useThree(s=>s.camera);
 const shot=useRef<{at:number;path:THREE.CatmullRomCurve3;target:THREE.Vector3;enabled:boolean;fov:number;phase:number}|null>(null);
 const cue=useRef(onCue),soundStop=useRef<(()=>void)|undefined>(undefined);
 const output=useMemo(()=>new THREE.Vector3(),[]);
 useEffect(()=>{soundStop.current?.();soundStop.current=undefined;cue.current=onCue;},[onCue]);
 useEffect(()=>{
  const finish=()=>{const s=shot.current;if(!s)return;shot.current=null;soundStop.current?.();soundStop.current=undefined;
   if(controlsRef.current)controlsRef.current.enabled=s.enabled;
   setFov(camera,s.fov);
   window.dispatchEvent(new CustomEvent('hermes:cinema-state',{detail:false}));
  };
  const start=()=>{if(shot.current){finish();return;}const c=controlsRef.current;if(!c||blocked||quiet||!c.enabled)return;
   shot.current={at:performance.now(),path:cinemaPath(world,camera.position,c.target),target:c.target.clone(),enabled:c.enabled,fov:camera instanceof THREE.PerspectiveCamera?camera.fov:50,phase:-1};c.enabled=false;
   window.dispatchEvent(new CustomEvent('hermes:cinema-state',{detail:true}));
  };
  const manual=(event:Event)=>{if(event.type==='keydown'&&(event as KeyboardEvent).key!=='Escape')return;if((event.target as HTMLElement)?.closest?.('[data-cinema-control]'))return;finish();};
  window.addEventListener('hermes:cinema-toggle',start);window.addEventListener('keydown',manual);window.addEventListener('pointerdown',manual);window.addEventListener('wheel',manual,{passive:true});
  const hidden=()=>{if(document.hidden)finish();};document.addEventListener('visibilitychange',hidden);
  return()=>{finish();window.removeEventListener('hermes:cinema-toggle',start);window.removeEventListener('keydown',manual);window.removeEventListener('pointerdown',manual);window.removeEventListener('wheel',manual);document.removeEventListener('visibilitychange',hidden);};
 },[world,camera,controlsRef,blocked,quiet]);
 useFrame(()=>{
  const s=shot.current,c=controlsRef.current;if(!s||!c)return;
  const t=Math.min(1,(performance.now()-s.at)/(FILM_SECONDS*1000));const u=t*t*(3-2*t);
  s.path.getPoint(u,output);if(world==='success')output.setY(Math.max(0,output.y));camera.position.copy(output);c.target.copy(s.target);
  setFov(camera,s.fov-Math.sin(t*Math.PI)*5);
  camera.lookAt(c.target);c.update();
  const phase=Math.min(4,Math.floor(u*5));if(phase!==s.phase){s.phase=phase;soundStop.current?.();soundStop.current=cue.current?.(phase);}
  if(t===1){c.enabled=s.enabled;setFov(camera,s.fov);soundStop.current?.();soundStop.current=undefined;shot.current=null;window.dispatchEvent(new CustomEvent('hermes:cinema-state',{detail:false}));}
 });return null;
}
