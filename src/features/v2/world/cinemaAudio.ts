/** Short, cancellable room-specific movement cue. Never opens an audio device. */
export function cinemaCue(ctx:AudioContext|null,world:string,volume:number,phase:number):(()=>void)|undefined{
 if(!ctx||ctx.state!=='running'||volume<=0)return;
 const t=ctx.currentTime,duration=1.2;const master=ctx.createGain();master.gain.value=Math.min(1,volume)*.06;master.connect(ctx.destination);
 const osc=ctx.createOscillator(),level=ctx.createGain();const neural=world==='atelier'||world==='cosmos';const soft=world==='memory'||world==='sanctuary';
 const hz=neural?620:world==='success'?110:soft?220:65;osc.type='sine';osc.frequency.setValueAtTime(hz*(1+phase*.08),t);osc.frequency.exponentialRampToValueAtTime(hz*(phase%2?1.7:.7),t+duration);
 level.gain.setValueAtTime(.0001,t);level.gain.exponentialRampToValueAtTime(.6,t+.1);level.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(level).connect(master);
 const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),ng=ctx.createGain();const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(neural?Math.pow(.5+.5*Math.sin(i/ctx.sampleRate*95),12):1);
 noise.buffer=buffer;filter.type=neural?'highpass':'bandpass';filter.frequency.setValueAtTime(neural?2600:soft?700:180,t);filter.frequency.exponentialRampToValueAtTime(neural?4200:soft?1100:2400,t+duration*.8);
 ng.gain.setValueAtTime(.0001,t);ng.gain.exponentialRampToValueAtTime(soft?.1:.25,t+.2);ng.gain.exponentialRampToValueAtTime(.0001,t+duration);noise.connect(filter).connect(ng).connect(master);
 let ended=0,disposed=false;const dispose=()=>{if(disposed)return;disposed=true;osc.disconnect();noise.disconnect();level.disconnect();filter.disconnect();ng.disconnect();master.disconnect();};
 const done=()=>{if(++ended===2)dispose();};osc.onended=done;noise.onended=done;osc.start(t);noise.start(t);osc.stop(t+duration+.02);noise.stop(t+duration+.02);
 return()=>{if(disposed)return;master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(0,ctx.currentTime,.02);try{osc.stop(ctx.currentTime+.08);noise.stop(ctx.currentTime+.08);}catch{dispose();}};
}
