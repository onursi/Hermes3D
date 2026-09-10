"use client";
/* eslint-disable @next/next/no-img-element */
import {useEffect,useRef,useState} from 'react';
import {PanelWindow} from '../hud/PanelWindow';
import {useV2} from '../state';
import type {MemoryEntry} from './model';
export function PhotoCarousel({entries,phase,onClose,topic,albumTitle}:{albumTitle:string;topic:string;entries:MemoryEntry[];phase:string;onClose:()=>void}){
 const photos=entries.filter(e=>e.phase===phase&&e.kind!=='note');const [index,setIndex]=useState(0);const [playing,setPlaying]=useState(false);const {prefs}=useV2();
 const at=photos.length?index%photos.length:0;
 const stage=useRef<HTMLDivElement>(null);
 const pause=()=>{setPlaying(false);stage.current?.querySelectorAll('video').forEach(v=>v.pause());};
 useEffect(()=>{stage.current?.querySelectorAll('.photo-slide:not([data-active="true"]) video').forEach(v=>(v as HTMLVideoElement).pause());},[at]);
 useEffect(()=>{if(!playing||photos.length<2||prefs.reducedMotion)return;const timer=setInterval(()=>setIndex(i=>(i+1)%photos.length),4500);return()=>clearInterval(timer);},[playing,photos.length,prefs.reducedMotion]);
 const move=(direction:number)=>setIndex((at+direction+photos.length)%Math.max(1,photos.length));
 return <PanelWindow title={`${topic} · ${albumTitle}`} slot="photos" onClose={onClose} onMinimizedChange={minimized=>{if(minimized)pause();}}><section className={`photo-album ${prefs.reducedMotion?"still":""}`} aria-label={`Fotoalbum ${albumTitle}`}>
  <header><span>DEIN LEBENSFILM</span><h2>{topic} · {albumTitle}</h2><p>{photos.length?`${at+1} / ${photos.length} · ${photos[at].title}`:'Füge Fotos für dieses Album hinzu.'}</p></header>
  <div ref={stage} className="photo-stage" onPointerDown={e=>{stage.current?.setAttribute("data-swipe",String(e.clientX));}} onPointerUp={e=>{const start=Number(stage.current?.getAttribute("data-swipe"));if(Number.isFinite(start)&&Math.abs(e.clientX-start)>45)move(e.clientX<start?1:-1);}} onKeyDown={e=>{if(e.key==='ArrowRight')move(1);if(e.key==='ArrowLeft')move(-1);}} tabIndex={0} aria-label="Fotokarussell · Pfeiltasten zum Blättern">
   {photos.filter((_,i)=>{const distance=(i-at+photos.length)%photos.length;return distance<=2||distance>=photos.length-2;}).map(entry=>{const i=photos.indexOf(entry);let offset=(i-at+photos.length)%photos.length;if(offset>photos.length/2)offset-=photos.length;return <div className="photo-slide" data-active={offset===0} key={entry.id} style={{transform:`translateX(${Math.sin(offset*.62)*100}%) translateZ(${(Math.cos(offset*.62)-1)*480}px) rotateY(${-offset*35}deg)`,opacity:Math.abs(offset)>1?.16:offset===0?1:.42,zIndex:5-Math.abs(offset)}} onClick={()=>{if(offset!==0)setIndex(i);}}>{entry.kind==='image'?<img src={entry.url} alt={entry.title} draggable={false}/>:<video src={entry.url} controls={offset===0} preload="metadata"/>}</div>;})}
  </div>
  <nav aria-label="Fotoalbum-Steuerung"><button disabled={!photos.length} onClick={()=>move(-1)} aria-label="Vorheriges Foto">←</button><button disabled={photos.length<2||prefs.reducedMotion} onClick={()=>setPlaying(p=>!p)}>{playing?'Anhalten':'Lebensfilm starten'}</button><button disabled={!photos.length} onClick={()=>move(1)} aria-label="Nächstes Foto">→</button></nav>
  <small>Originalformat bleibt erhalten. Fotos werden ausschließlich lokal in diesem Browser gespeichert.</small>
 </section></PanelWindow>;
}
