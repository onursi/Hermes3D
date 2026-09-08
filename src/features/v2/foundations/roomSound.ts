import {getAudioContext} from "../atmosphereAudio";
/** Original local transition chord; volume follows the shared mute control. */
export function roomSound(volume:number,arrival=false){
 const ctx=getAudioContext();if(!ctx||ctx.state!=='running'||volume<=0)return;
 [65.41,130.81,196,293.66,523.25].forEach((hz,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain();const t=ctx.currentTime+i*.09;osc.frequency.setValueAtTime(arrival?hz:hz*.6,t);osc.frequency.exponentialRampToValueAtTime(arrival?hz*1.004:hz*1.9,t+1.7);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume*(i===0?.08:.018),t+.25);gain.gain.exponentialRampToValueAtTime(.0001,t+2.7);osc.connect(gain).connect(ctx.destination);osc.start(t);osc.stop(t+2.8);osc.onended=()=>{osc.disconnect();gain.disconnect();};});
}
