"use client";
/* Local blob URLs must stay on this device rather than enter an image optimization service. */
/* eslint-disable @next/next/no-img-element */
import {useV2} from "../state";
import { useRef,useState } from "react";
import type { MemoryEntry } from "./model";
import {PHASES} from './model';
import {memoryMotion,type MemoryMode} from './MemoryWorld';
export function MemoryHud({mode,phase,count,entries,onOpen,onMode,onPhase,onImport}:{mode:MemoryMode;phase:string;count:number;entries:MemoryEntry[];onOpen:(entry:MemoryEntry)=>void;onMode:(m:MemoryMode)=>void;onPhase:(p:string)=>void;onImport:(files:FileList,phase:string)=>void}){
 const input=useRef<HTMLInputElement>(null);const [speed,setSpeed]=useState(0);
 return <>
  <div className="r10-title"><span className="r10-eyebrow">Zeit · Raum · Erinnerung</span><h1>{mode==='saturn'?'Dein Erinnerungsuniversum':mode==='free'?'Freies Erinnern':phase}</h1><p>{mode==='saturn'?'Innen die frühen Jahre. Außen die Gegenwart.':mode==='free'?'Momente entdecken, ohne einer Zeitlinie zu folgen.':'Greifen und drehen. Zum Öffnen abbremsen.'}</p></div>
  <section className="r10-glass r10-memory-controls">
   {mode!=='saturn'&&<button onClick={()=>{memoryMotion.auto=0;setSpeed(0);onMode('saturn');}}>← Lebensringe</button>}
   <label>Lebensphase<select value={phase} onChange={e=>onPhase(e.target.value)}>{PHASES.map(p=><option key={p}>{p}</option>)}</select></label>
   {mode==='carousel'&&<label>Lebensfilm <input aria-label="Karusselltempo" type="range" min="-8" max="8" step=".25" value={speed} onChange={e=>{setSpeed(+e.target.value);memoryMotion.auto=+e.target.value;}}/><button onClick={()=>{setSpeed(0);memoryMotion.auto=0;memoryMotion.velocity=0;}}>Anhalten</button></label>}
   <button onClick={()=>input.current?.click()}>Eigene Fotos / Videos hinzufügen</button><input ref={input} hidden type="file" multiple accept="image/*,video/*" onChange={e=>{if(e.target.files)onImport(e.target.files,phase);e.target.value='';}}/>
   <details><summary>Erinnerungen direkt öffnen</summary><div className="r10-filelist">{entries.filter(e=>mode!=='carousel'||e.phase===phase).map(e=><button key={e.id} onClick={()=>{memoryMotion.auto=0;memoryMotion.velocity=0;onOpen(e);}}>{e.date ? `${e.date} · ` : ""}{e.title}</button>)}</div></details>
   <small>{count?`${count} Einträge in dieser Ansicht`:'Hier sind noch keine Erinnerungen zugeordnet.'} Eigene Medien bleiben lokal in dieser Sitzung. Vorhandene Tagesrückblicke kommen aus dem Vault; keine erfundene Biografie.</small>
  </section>
 </>;
}
export function MemoryCard({entry,onClose,onRead}:{entry:MemoryEntry;onClose:()=>void;onRead:()=>void}){
 const ref=useRef<HTMLElement>(null); const {prefs}=useV2();
 return <div className="r10-memory-backdrop" onClick={onClose}><article ref={ref} className="r10-glass r10-memory-card" onClick={e=>e.stopPropagation()} onPointerMove={e=>{if(!ref.current||prefs.reducedMotion||e.pointerType==='touch')return;const r=ref.current.getBoundingClientRect();ref.current.style.transform=`perspective(1400px) rotateY(${((e.clientX-r.left)/r.width-.5)*5}deg) rotateX(${((e.clientY-r.top)/r.height-.5)*-4}deg)`;}} onPointerLeave={()=>{if(ref.current)ref.current.style.transform='none';}}>
  <button className="r10-close" aria-label="Erinnerung schließen" onClick={onClose}>×</button><span className="r10-eyebrow">{entry.phase} · {entry.date||'Datum offen'}</span><h2>{entry.title}</h2>
  {entry.kind==='image'?<img src={entry.url} alt={entry.title}/>:entry.kind==='video'?<video src={entry.url} controls/>:<><p>Ein belegter Tagesrückblick aus deinem LifeOS.</p><button onClick={onRead}>Originalnotiz lesen ↗</button></>}
 </article></div>;
}
