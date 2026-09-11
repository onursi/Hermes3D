import {expect,it,vi} from 'vitest';
import {startNeuralAudio} from '../../src/features/atelier-lab/neuralAudio';

it('stops scene-triggered sounds and disconnects all owned nodes on exit',()=>{
 const nodes:ReturnType<typeof node>[]=[];
 function node(){const param=()=>({value:0,setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn(),setTargetAtTime:vi.fn()});return{gain:param(),threshold:param(),knee:param(),ratio:param(),frequency:param(),Q:param(),pan:param(),playbackRate:param(),connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null,buffer:null,loop:false,type:''};}
 const make=()=>{const n=node();nodes.push(n);return n;};
 const context={currentTime:0,sampleRate:100,state:'running',destination:{},createGain:make,createDynamicsCompressor:make,createBiquadFilter:make,createStereoPanner:make,createOscillator:make,createBufferSource:vi.fn(make),createBuffer:(_channels:number,size:number)=>({getChannelData:()=>new Float32Array(size)})};
 const stop=startNeuralAudio(context as unknown as AudioContext,.6);
 expect(context.createBufferSource).toHaveBeenCalledTimes(2);
 window.dispatchEvent(new Event('hermes:neural-discharge'));
 expect(context.createBufferSource).toHaveBeenCalledTimes(3);
 stop();window.dispatchEvent(new Event('hermes:neural-discharge'));
 expect(context.createBufferSource).toHaveBeenCalledTimes(3);
 expect(nodes.every(n=>n.disconnect.mock.calls.length>0)).toBe(true);
});
