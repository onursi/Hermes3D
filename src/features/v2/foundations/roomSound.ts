import {getAudioContext,getAtmosphereVolume} from '../atmosphereAudio';
import {localSound,type SoundName} from '../localAudio';
function play(name:SoundName,volume:number){return localSound(getAudioContext(),name,Math.min(volume,getAtmosphereVolume())*.38).stop;}
export function roomSound(volume:number,arrival=false){return play(arrival?'confirm':'portal',volume);}
export function wormholeSound(volume:number,arrival=false){return play(arrival?'arrival':'wormhole',volume);}
export function portalSound(volume:number,arrival=false){return play(arrival?'arrival':'portal',volume);}
export function supernovaSound(volume:number){return play('supernova',volume);}
export function singularitySound(volume:number,arrival=false){return play(arrival?'arrival':'singularity',volume);}
