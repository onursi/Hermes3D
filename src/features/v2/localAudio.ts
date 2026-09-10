"use client";

/** Generated once, served locally. No provider requests or credentials at runtime. */
export const soundNames = ['deck','space','brain','gravity','memory','horizon','success','flow','sanctuary','portal','arrival','wormhole','singularity','supernova','warp','engine','scan','beam','synapse','confirm','select','cinema'] as const;
export type SoundName = typeof soundNames[number];
const buffers = new WeakMap<AudioContext, Map<string, Promise<AudioBuffer>>>();
const playing = new WeakMap<AudioContext, Set<() => void>>();
const enabled = new WeakMap<AudioContext, boolean>();

function load(ctx: AudioContext, name: SoundName) {
 let cache = buffers.get(ctx); if (!cache) { cache = new Map(); buffers.set(ctx, cache); }
 let pending = cache.get(name);
 if (!pending) {
  pending = fetch(`/audio/r30/${name}.mp3`).then(r => {if(!r.ok)throw Error('Audio unavailable');return r.arrayBuffer();}).then(b => ctx.decodeAudioData(b)).then(buffer => {
   // Peak normalization makes the mix independent of generation loudness.
   let peak=0;for(let c=0;c<buffer.numberOfChannels;c++){const a=buffer.getChannelData(c);for(let i=0;i<a.length;i++)peak=Math.max(peak,Math.abs(a[i]));}
   if(peak>0){const scale=Math.min(3,.75/peak);for(let c=0;c<buffer.numberOfChannels;c++){const a=buffer.getChannelData(c);for(let i=0;i<a.length;i++)a[i]*=scale;}}
   return buffer;
  }).catch(e=>{cache!.delete(name);throw e;});
  cache.set(name,pending);
 }
 return pending;
}
export function preloadSounds(ctx:AudioContext){for(const name of soundNames)void load(ctx,name).catch(()=>{});}
export function stopLocalSounds(ctx:AudioContext){for(const stop of [...(playing.get(ctx)??[])])stop();}
export function enableLocalSounds(ctx:AudioContext,value:boolean){enabled.set(ctx,value);if(!value)stopLocalSounds(ctx);}

export function localSound(ctx:AudioContext|null,name:SoundName,volume:number,options:{loop?:boolean;rate?:number;pan?:number}={}) {
 let ended=false,source:AudioBufferSourceNode|undefined,gain:GainNode|undefined,pan:StereoPannerNode|undefined;
 let level=Math.max(0,Math.min(.6,volume)),rate=options.rate??1;
 const born=Date.now();let timer:ReturnType<typeof setTimeout>|undefined;
 const stops=ctx?(playing.get(ctx)??new Set<()=>void>()):new Set<()=>void>();if(ctx)playing.set(ctx,stops);
 const clean=()=>{source?.disconnect();gain?.disconnect();pan?.disconnect();stops.delete(stop);if(timer)clearTimeout(timer);};
 const stop=()=>{if(ended)return;ended=true;if(source&&ctx&&gain){gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setTargetAtTime(0,ctx.currentTime,.025);try{source.stop(ctx.currentTime+.12);}catch{}timer=setTimeout(clean,200);}else clean();};
 const handle={stop,setLevel:(v:number)=>{level=Math.max(0,Math.min(.6,v));if(ctx&&gain)gain.gain.setTargetAtTime(document.hidden?0:level,ctx.currentTime,.12);},setRate:(v:number)=>{rate=Math.max(.5,Math.min(2,v));if(ctx&&source)source.playbackRate.setTargetAtTime(rate,ctx.currentTime,.15);}};
 if(!ctx||ctx.state!=='running'||volume<=0||enabled.get(ctx)===false||document.hidden)return handle;
 // Bound concurrent effects; never queue old UI sounds after delayed loading.
 if(stops.size>=12)stops.values().next().value?.();stops.add(stop);
 void load(ctx,name).then(buffer=>{
  if(ended||ctx.state!=='running'||enabled.get(ctx)===false||document.hidden||(!options.loop&&Date.now()-born>1800)){stop();return;}
  source=ctx.createBufferSource();gain=ctx.createGain();pan=ctx.createStereoPanner();source.buffer=buffer;source.loop=!!options.loop;source.playbackRate.value=rate;pan.pan.value=options.pan??0;
  gain.gain.setValueAtTime(0,ctx.currentTime);gain.gain.linearRampToValueAtTime(level,ctx.currentTime+(options.loop?.7:.012));
  if(!options.loop){const duration=buffer.duration/rate;gain.gain.setValueAtTime(level,ctx.currentTime+Math.max(.02,duration-.1));gain.gain.linearRampToValueAtTime(0,ctx.currentTime+duration);}
  source.connect(gain).connect(pan).connect(ctx.destination);source.onended=()=>{ended=true;clean();};source.start();
 }).catch(()=>{stop();});
 return handle;
}
