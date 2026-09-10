"use client";
import {enableLocalSounds,localSound,preloadSounds,stopLocalSounds,type SoundName} from './localAudio';
export const flightAudio={speed:0,hyperdrive:false};
let context:AudioContext|null=null;
let volume=0;
export function getAudioContext(){return context;}
export function getAtmosphereVolume(){return volume;}
/** A user gesture unlocks the device; persisted preferences do not. */
export function unlockAtmosphere(){
 if(!context)context=new AudioContext();
 if(context.state==='suspended')void context.resume().catch(()=>{});
 preloadSounds(context);
 window.dispatchEvent(new Event('hermes:audio-ready'));
}
const worlds:Record<string,SoundName>={home:'deck',universe:'space',cosmos:'brain',library:'brain',projects:'gravity',memory:'memory',saturn:'memory',horizon:'horizon',success:'success',tesseract:'success',flow:'flow',sanctuary:'sanctuary',atelier:'brain'};
export function runAtmosphere(world:string,value:number):(()=>void)|null{
 volume=Math.max(0,Math.min(1,value));const ctx=context;if(!ctx)return null;
 enableLocalSounds(ctx,volume>0);if(volume<=0)return null;
 let ambience:ReturnType<typeof localSound>|undefined,engine:ReturnType<typeof localSound>|undefined;
 const begin=()=>{if(document.hidden)return;ambience?.stop();engine?.stop();ambience=localSound(ctx,worlds[world]??'space',volume*.22,{loop:true});if(world==='universe')engine=localSound(ctx,'engine',volume*.01,{loop:true});};
 begin();
 const update=()=>{const audible=!document.hidden&&document.hasFocus();ambience?.setLevel(audible?volume*.22:0);const speed=Math.min(1,Math.abs(flightAudio.speed)/100);engine?.setLevel(audible?volume*(flightAudio.hyperdrive?.32:.22)*speed:0);engine?.setRate(.7+speed*.7);};
 const visibility=()=>{if(document.hidden){stopLocalSounds(ctx);}else{begin();update();}};
 const interval=setInterval(update,100);document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',update);window.addEventListener('focus',update);
 return()=>{clearInterval(interval);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',update);window.removeEventListener('focus',update);ambience?.stop();engine?.stop();};
}
export function playHyperJump(value:number){if(value>0)localSound(context,'warp',Math.min(value,volume)*.38);}
