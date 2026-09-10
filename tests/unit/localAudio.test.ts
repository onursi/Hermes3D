import {describe,it,expect,vi,afterEach} from 'vitest';
import {localSound,enableLocalSounds,stopLocalSounds} from '../../src/features/v2/localAudio';
function context(){
 const param=()=>({value:0,setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),setTargetAtTime:vi.fn(),cancelScheduledValues:vi.fn()});
 const sources: {start:ReturnType<typeof vi.fn>;stop:ReturnType<typeof vi.fn>}[]=[];
 const node=()=>({connect:vi.fn().mockReturnThis(),disconnect:vi.fn()});
 const ctx={state:'running',currentTime:0,destination:{},decodeAudioData:vi.fn(async()=>({numberOfChannels:1,duration:2,getChannelData:()=>new Float32Array([0,.5,-.5])})),createBufferSource:()=>{const s={...node(),start:vi.fn(),stop:vi.fn(),playbackRate:param(),onended:null};sources.push(s);return s;},createGain:()=>({...node(),gain:param()}),createStereoPanner:()=>({...node(),pan:param()})};
 return {ctx:ctx as unknown as AudioContext,sources};
}
const flush=async()=>{await new Promise(r=>setTimeout(r,0));};
afterEach(()=>vi.unstubAllGlobals());
describe('local sound lifecycle',()=>{
 it('does not fetch while muted or before an audio gesture',()=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);const {ctx}=context();localSound(null,'portal',.2);localSound(ctx,'portal',0);enableLocalSounds(ctx,false);localSound(ctx,'portal',.3);expect(fetch).not.toHaveBeenCalled();});
 it('cancels a sound while its local file is loading',async()=>{let resolve!:(v:unknown)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise(r=>{resolve=r;})));const {ctx,sources}=context();const h=localSound(ctx,'portal',.3);h.stop();resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(2)});await flush();expect(sources).toHaveLength(0);});
 it('decodes once but allows repeated effects',async()=>{const fetch=vi.fn(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(2)}));vi.stubGlobal('fetch',fetch);const {ctx,sources}=context();localSound(ctx,'confirm',.2);localSound(ctx,'confirm',.2);await flush();expect(fetch).toHaveBeenCalledTimes(1);expect(sources).toHaveLength(2);stopLocalSounds(ctx);expect(sources.every(s=>s.stop.mock.calls.length===1)).toBe(true);});
 it('mute cancels active and pending audio',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(2)})));const {ctx,sources}=context();localSound(ctx,'brain',.2,{loop:true});await flush();enableLocalSounds(ctx,false);expect(sources[0].stop).toHaveBeenCalledOnce();localSound(ctx,'confirm',.2);await flush();expect(sources).toHaveLength(1);});
 it('failed downloads do not block later retry',async()=>{const fetch=vi.fn().mockResolvedValueOnce({ok:false}).mockResolvedValue({ok:true,arrayBuffer:async()=>new ArrayBuffer(2)});vi.stubGlobal('fetch',fetch);const {ctx,sources}=context();localSound(ctx,'select',.2);await flush();localSound(ctx,'select',.2);await flush();expect(fetch).toHaveBeenCalledTimes(2);expect(sources).toHaveLength(1);stopLocalSounds(ctx);});
});
