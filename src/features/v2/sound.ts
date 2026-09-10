"use client";
import {getAudioContext,getAtmosphereVolume} from './atmosphereAudio';
import {localSound} from './localAudio';
export function playSelect(volume:number){localSound(getAudioContext(),'select',Math.min(volume,getAtmosphereVolume())*.22);}
export function playArrive(volume:number){localSound(getAudioContext(),'arrival',Math.min(volume,getAtmosphereVolume())*.22);}
