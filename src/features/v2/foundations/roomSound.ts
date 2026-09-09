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

/** Finite portal pull and airy arrival; no voice or religious recitation. */
export function portalSound(volume:number,arrival=false){
 wormholeSound(volume*.8,arrival);const ctx=getAudioContext();if(!ctx||ctx.state!=='running'||volume<=0)return;
 [92.5,185,277.2,554.4].forEach((hz,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain(),t=ctx.currentTime+i*.045;osc.type='sine';osc.frequency.setValueAtTime(arrival?hz*2:hz*.5,t);osc.frequency.exponentialRampToValueAtTime(arrival?hz:hz*3,t+1.05);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(volume*.026,t+.18);gain.gain.exponentialRampToValueAtTime(.0001,t+1.8);osc.connect(gain).connect(ctx.destination);osc.start(t);osc.stop(t+1.9);osc.onended=()=>{osc.disconnect();gain.disconnect();};});
}

/** Replay is a finite celebratory sound, never a new completion event. */
export function supernovaSound(volume:number){roomSound(volume*.8,true);wormholeSound(volume*.55,true);}

/** Black-hole descent: overlapping falling octaves, then a sparse golden arrival. */
export function singularitySound(volume:number,arrival=false){
 const ctx=getAudioContext();if(!ctx||ctx.state!=='running'||volume<=0)return;
 const t=ctx.currentTime,length=arrival?3.8:3.25;
 const bus=ctx.createGain(),filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.setValueAtTime(arrival?1800:2400,t);filter.frequency.exponentialRampToValueAtTime(arrival?900:90,t+length);
 bus.gain.value=Math.min(1,volume);filter.connect(bus).connect(ctx.destination);
 let remaining=6;
 for(let i=0;i<6;i++){const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';const start=t+i*.095;const hz=arrival?[82.4,164.8,247.2,329.6,494.4,659.2][i]:55*Math.pow(2,i);osc.frequency.setValueAtTime(hz,start);osc.frequency.exponentialRampToValueAtTime(arrival?hz*.997:hz*.18,t+length);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime((arrival?.027:.042)/(1+i*.16),start+.35);gain.gain.exponentialRampToValueAtTime(.0001,t+length);osc.connect(gain).connect(filter);osc.start(start);osc.stop(t+length+.1);osc.onended=()=>{osc.disconnect();gain.disconnect();if(--remaining===0){filter.disconnect();bus.disconnect();}};}
}
