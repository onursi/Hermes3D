"use client";
import {useCallback} from 'react';
import * as THREE from 'three';
import {useV2} from '../state';
import {getAudioContext} from '../atmosphereAudio';
import {CinematicTour} from './CinematicTour';
import {cinemaCue} from './cinemaAudio';
type Controls={target:THREE.Vector3;enabled:boolean;update:()=>void};
export function CinemaFlight({controlsRef,blocked}:{controlsRef:React.MutableRefObject<Controls|null>;blocked:boolean}){
 const {world,prefs}=useV2();
 const cue=useCallback((phase:number)=>cinemaCue(getAudioContext(),world,prefs.sound,phase),[world,prefs.sound]);
 return <CinematicTour controlsRef={controlsRef} world={world} blocked={blocked} quiet={prefs.reducedMotion} onCue={cue}/>;
}
