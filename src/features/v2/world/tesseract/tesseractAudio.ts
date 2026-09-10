import {getAudioContext,getAtmosphereVolume} from '../../atmosphereAudio';
import {localSound,type SoundName} from '../../localAudio';
export const getTesseractAudio=getAudioContext;
function play(name:SoundName,volume:number,rate=1){localSound(getAudioContext(),name,Math.min(volume,getAtmosphereVolume())*.3,{rate});}
export function playCrystalChime(index=0,volume=.35){play('confirm',volume,1+(index%6)*.03);}
export function playPhoenixSynthesis(volume=.5){play('supernova',volume);}
export function playDimensionalShift(volume=.3){play('wormhole',volume);}
export function playMonolithDrone(volume=.4){play('singularity',volume);}
export function playOracleBalance(direction=1,volume=.35){play('cinema',volume,direction>0?1.1:.9);}
export function playAgentVoice(agentName:string,volume=.3){play('confirm',volume,1+(agentName.length%4)*.04);}
