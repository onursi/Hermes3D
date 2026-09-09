"use client";
import {useEffect,useMemo,useRef} from 'react';import {useFrame,useThree} from '@react-three/fiber';import * as THREE from 'three';import {useV2} from '../state';
type Controls={target:THREE.Vector3;enabled:boolean;update:()=>void};
/** An explicitly started, finite camera shot. It never changes records or room selection. */
export function CinemaFlight({controlsRef,blocked}:{controlsRef:React.MutableRefObject<Controls|null>;blocked:boolean}){
 const {world,prefs}=useV2(),camera=useThree(s=>s.camera);const shot=useRef<{at:number;eye:THREE.Vector3;target:THREE.Vector3;enabled:boolean}|null>(null);const offset=useMemo(()=>new THREE.Vector3(),[]);
 useEffect(()=>{const finish=()=>{const current=shot.current;if(current&&controlsRef.current)controlsRef.current.enabled=current.enabled;shot.current=null;window.dispatchEvent(new CustomEvent('hermes:cinema-state',{detail:false}));};
 const start=()=>{if(shot.current){finish();return;}const c=controlsRef.current;if(!c||blocked||prefs.reducedMotion)return;shot.current={at:performance.now(),eye:camera.position.clone(),target:c.target.clone(),enabled:c.enabled};c.enabled=false;window.dispatchEvent(new CustomEvent('hermes:cinema-state',{detail:true}));};
 const manual=(e:Event)=>{if(e.type==='keydown'&&(e as KeyboardEvent).key!=='Escape')return;if((e.target as HTMLElement)?.closest?.('[data-cinema-control]'))return;finish();};window.addEventListener('hermes:cinema-toggle',start);window.addEventListener('keydown',manual);window.addEventListener('pointerdown',manual);window.addEventListener('wheel',manual,{passive:true});return()=>{finish();window.removeEventListener('hermes:cinema-toggle',start);window.removeEventListener('keydown',manual);window.removeEventListener('pointerdown',manual);window.removeEventListener('wheel',manual);};},[world,camera,controlsRef,blocked,prefs.reducedMotion]);
 useFrame(()=>{const s=shot.current,c=controlsRef.current;if(!s||!c)return;const t=Math.min(1,(performance.now()-s.at)/24000),e=t*t*(3-2*t);offset.copy(s.eye).sub(s.target);
 if(world==='success'){camera.position.copy(s.eye);camera.position.setZ(camera.position.z-e*Math.min(14,Math.max(2,offset.length()*.25)));camera.position.setY(camera.position.y+Math.sin(e*Math.PI)*1.2);}
 else{const angle=e*(world==='horizon'?.42:world==='memory'?.8:1.05);offset.applyAxisAngle(camera.up,angle).multiplyScalar(1+Math.sin(e*Math.PI)*.12);camera.position.copy(s.target).add(offset);camera.position.setY(camera.position.y+Math.sin(e*Math.PI)*Math.min(3,offset.length()*.08));}
 c.target.copy(s.target);camera.lookAt(c.target);c.update();if(t===1){c.enabled=s.enabled;shot.current=null;window.dispatchEvent(new CustomEvent('hermes:cinema-state',{detail:false}));}});return null;
}
