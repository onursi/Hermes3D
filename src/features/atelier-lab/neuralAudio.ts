/** Procedural tissue ambience. No remote service, audio files or credit usage. */
export function startNeuralAudio(ctx:AudioContext,level:number){
 const master=ctx.createGain(),limiter=ctx.createDynamicsCompressor();
 master.gain.setValueAtTime(0,ctx.currentTime);master.gain.linearRampToValueAtTime(level*.24,ctx.currentTime+.6);
 limiter.threshold.value=-16;limiter.knee.value=12;limiter.ratio.value=5;master.connect(limiter);limiter.connect(ctx.destination);
 const buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),samples=buffer.getChannelData(0);
 let brown=0;for(let i=0;i<samples.length;i++){brown=(brown+(Math.random()*2-1)*.025)/1.025;samples[i]=brown*3;}
 const crackle=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate),white=crackle.getChannelData(0);
 for(let i=0;i<white.length;i++)white[i]=(Math.random()*2-1)*.65;
 const bed=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),bedGain=ctx.createGain();
 bed.buffer=buffer;bed.loop=true;filter.type='bandpass';filter.frequency.value=430;filter.Q.value=.6;bedGain.gain.value=.52;
 bed.connect(filter);filter.connect(bedGain);bedGain.connect(master);bed.start();
 const hum=ctx.createOscillator(),humGain=ctx.createGain();hum.type='sine';hum.frequency.value=83;humGain.gain.value=.09;hum.connect(humGain);humGain.connect(master);hum.start();
 const active=new Set<()=>void>();let stopped=false;
 const discharge=()=>{
  if(stopped||ctx.state!=='running'||document.hidden)return;
  const now=ctx.currentTime;
  const noise=ctx.createBufferSource(),band=ctx.createBiquadFilter(),envelope=ctx.createGain(),pan=ctx.createStereoPanner();
  noise.buffer=crackle;noise.playbackRate.value=1.1+Math.random()*.5;
  band.type='bandpass';band.Q.value=2.2;band.frequency.setValueAtTime(2600+Math.random()*1900,now);band.frequency.exponentialRampToValueAtTime(620,now+.38);
  pan.pan.value=Math.random()*1.5-.75;
  envelope.gain.setValueAtTime(0,now);envelope.gain.linearRampToValueAtTime(.9,now+.018);envelope.gain.exponentialRampToValueAtTime(.04,now+.12);envelope.gain.linearRampToValueAtTime(.4,now+.16);envelope.gain.exponentialRampToValueAtTime(.001,now+.48);
  noise.connect(band);band.connect(envelope);envelope.connect(pan);pan.connect(master);
  const dispose=()=>{noise.disconnect();band.disconnect();envelope.disconnect();pan.disconnect();active.delete(stop);};
  const stop=()=>{try{noise.stop();}catch{/* Already ended. */}dispose();};active.add(stop);noise.onended=dispose;noise.start(now);noise.stop(now+.5);
 };
 const visibility=()=>master.gain.setTargetAtTime(document.hidden?0:level*.24,ctx.currentTime,.12);
 window.addEventListener('hermes:neural-discharge',discharge);document.addEventListener('visibilitychange',visibility);
 discharge();
 return()=>{stopped=true;window.removeEventListener('hermes:neural-discharge',discharge);document.removeEventListener('visibilitychange',visibility);for(const stop of [...active])stop();bed.stop();hum.stop();bed.disconnect();filter.disconnect();bedGain.disconnect();hum.disconnect();humGain.disconnect();master.disconnect();limiter.disconnect();};
}
