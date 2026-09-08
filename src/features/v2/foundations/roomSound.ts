import {getAudioContext} from "../atmosphereAudio";
/** Original local transition chord; volume follows the shared mute control. */
export function roomSound(volume:number,arrival=false){
 const ctx=getAudioContext();if(!ctx||ctx.state!=='running'||volume<=0)return;
 [65.41,130.81,196,293.66,523.25].forEach((hz,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain();const t=ctx.currentTime+i*.09;osc.frequency.setValueAtTime(arrival?hz:hz*.6,t);osc.frequency.exponentialRampToValueAtTime(arrival?hz*1.004:hz*1.9,t+1.7);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume*(i===0?.08:.018),t+.25);gain.gain.exponentialRampToValueAtTime(.0001,t+2.7);osc.connect(gain).connect(ctx.destination);osc.start(t);osc.stop(t+2.8);osc.onended=()=>{osc.disconnect();gain.disconnect();};});
}
/** Finite local whoosh, sub sweep and arrival harmonics; no external assets. */
export function wormholeSound(volume:number,arrival=false){
 const ctx=getAudioContext();if(!ctx||ctx.state!=='running'||volume<=0)return;
 const length=arrival?1.1:2.2,t=ctx.currentTime;const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*length),ctx.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.45;
 const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();noise.buffer=buffer;filter.type='bandpass';filter.Q.value=.65;filter.frequency.setValueAtTime(arrival?4200:180,t);filter.frequency.exponentialRampToValueAtTime(arrival?240:5600,t+length*.85);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(volume*.16,t+length*.55);gain.gain.exponentialRampToValueAtTime(.0001,t+length);noise.connect(filter).connect(gain).connect(ctx.destination);noise.start(t);noise.stop(t+length);noise.onended=()=>{noise.disconnect();filter.disconnect();gain.disconnect();};
 const bass=ctx.createOscillator(),level=ctx.createGain();bass.type='sine';bass.frequency.setValueAtTime(arrival?110:65,t);bass.frequency.exponentialRampToValueAtTime(arrival?65:36,t+length);level.gain.setValueAtTime(.0001,t);level.gain.exponentialRampToValueAtTime(volume*.1,t+.15);level.gain.exponentialRampToValueAtTime(.0001,t+length);bass.connect(level).connect(ctx.destination);bass.start(t);bass.stop(t+length);bass.onended=()=>{bass.disconnect();level.disconnect();};if(arrival)roomSound(volume*.7,true);
}
