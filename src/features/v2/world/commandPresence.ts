"use client";
import {useSyncExternalStore} from 'react';
export type CommandActivity='idle'|'listening'|'working'|'speaking'|'error';
export type CommandPresence=CommandActivity|'offline'|'waiting';
let activity:CommandActivity='idle';const listeners=new Set<()=>void>();
export function publishCommandActivity(next:CommandActivity){if(activity===next)return;activity=next;listeners.forEach(fn=>fn());}
const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
export function commandPresence(active:CommandActivity,reachable:boolean,waiting:number):CommandPresence{if(active==='listening'||active==='speaking'||active==='working'||active==='error')return active;if(!reachable)return 'offline';if(waiting>0)return 'waiting';return 'idle';}
export function useCommandPresence(reachable:boolean,waiting:number){return commandPresence(useSyncExternalStore(subscribe,()=>activity,()=> 'idle' as CommandActivity),reachable,waiting);}
export const COMMAND_STATES:Record<CommandPresence,{label:string;color:string;detail:string}>={
 idle:{label:'Bereit',color:'#8dc8d9',detail:'Konsole öffnen und einen Gedanken aufnehmen.'},
 listening:{label:'Mikrofon aktiv',color:'#9ee2c6',detail:'Deine Worte werden als editierbarer Entwurf aufgenommen.'},
 working:{label:'Anfrage läuft',color:'#b6a6e5',detail:'Hermes verarbeitet die gestartete Anfrage.'},
 speaking:{label:'Sprachausgabe läuft',color:'#aad7f3',detail:'Die Antwort wird gerade abgespielt.'},
 waiting:{label:'Entscheidung wartet',color:'#e5bc7a',detail:'Öffne die Freigaben und prüfe den gemeldeten Auftrag.'},
 offline:{label:'Verbindung prüfen',color:'#8d9aab',detail:'Hermes ist derzeit nicht erreichbar. Projektnotizen bleiben zugänglich.'},
 error:{label:'Anfrage prüfen',color:'#dc9b9b',detail:'Die Konsole enthält den Fehler der letzten Anfrage.'}
};
export function openCommandArea(area:'projects'|'tasks'|'decisions'){window.dispatchEvent(new CustomEvent('hermes:work-tab',{detail:area}));window.dispatchEvent(new CustomEvent('hermes:panel-open',{detail:'work'}));}
