import {localSound} from '../localAudio';
/** Finite local cue; cancelling a camera shot cancels pending and playing audio. */
export function cinemaCue(ctx:AudioContext|null,world:string,volume:number,phase:number):(()=>void)|undefined{
 if(!ctx||volume<=0)return;
 return localSound(ctx,world==='atelier'||world==='cosmos'?'synapse':'cinema',volume*.23,{rate:1+(phase%3)*.06,pan:phase%2?.25:-.25}).stop;
}
