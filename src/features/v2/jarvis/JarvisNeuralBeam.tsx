"use client";
import { useEffect, useRef } from "react";
import { readBeamAnchors } from "./beamAnchors";
import { beamStage } from "./useBeamStage";
import { useV2 } from "../state";
export interface JarvisNeuralBeamProps {
 active: boolean; searching?: boolean; session?: number; onDismiss?:()=>void;
 onSelect?:(id:string)=>void; targetLabel?:string;
}
const COUNT=6;
/** One measured overlay. Scanning ends; source locks survive the answer. */
export function JarvisNeuralBeam({active,searching=false,session=0,onDismiss,onSelect,targetLabel}:JarvisNeuralBeamProps){
 const {prefs}=useV2();
 const svg=useRef<SVGSVGElement>(null); const box=useRef<HTMLDivElement>(null);
 const status=useRef<HTMLSpanElement>(null); const latest=useRef({searching,targetLabel});
 useEffect(()=>{latest.current={searching,targetLabel};},[searching,targetLabel]);
 useEffect(()=>{
  if(!active)return;
  let frame=0,last=0;const started=performance.now();
  const lines=Array.from(svg.current?.querySelectorAll<SVGLineElement>('[data-ray]')??[]);
  const buttons=Array.from(box.current?.querySelectorAll<HTMLButtonElement>('[data-target]')??[]);
  const dock=svg.current?.querySelector<SVGLineElement>('[data-dock]');
  const band=svg.current?.querySelector<SVGLineElement>('[data-scan]');
  const ring=svg.current?.querySelector<SVGCircleElement>('[data-core]');
  const draw=(now:number)=>{
   frame=requestAnimationFrame(draw);if(now-last<33)return;last=now;
   const t=(now-started)/1000;const {head,targets,sweep}=readBeamAnchors();
   const visible=targets.slice(0,COUNT);
   const stage=beamStage(t,latest.current.searching,visible.length>0,prefs.reducedMotion);
   const docking=stage==='docking',scanning=stage==='scanning';
   const locked=!docking&&!scanning;
   const center=sweep.length ? {x:sweep.reduce((n,p)=>n+p.x,0)/sweep.length,y:sweep.reduce((n,p)=>n+p.y,0)/sweep.length}:null;
   if(dock){dock.style.display=head&&center&&!locked?'':'none';if(head&&center){dock.setAttribute('x1',String(head.x));dock.setAttribute('y1',String(head.y));dock.setAttribute('x2',String(center.x));dock.setAttribute('y2',String(center.y));}}
   if(ring){ring.style.display=center&&!locked?'':'none';if(center){ring.setAttribute('cx',String(center.x));ring.setAttribute('cy',String(center.y));ring.setAttribute('r',String(docking?12:22+Math.sin(t*4)*5));}}
   if(band){band.style.display=scanning&&sweep.length&&!prefs.reducedMotion?'':'none';if(sweep.length){const xs=sweep.map(p=>p.x),ys=sweep.map(p=>p.y);const y=Math.min(...ys)+(Math.max(...ys)-Math.min(...ys))*(.5-.5*Math.cos(t*3));band.setAttribute('x1',String(Math.min(...xs)));band.setAttribute('x2',String(Math.max(...xs)));band.setAttribute('y1',String(y));band.setAttribute('y2',String(y));}}
   for(let i=0;i<COUNT;i++){
    const point=locked?visible[i]:null;const line=lines[i],button=buttons[i];
    line.style.display=point&&head?'':'none';button.hidden=!point||!head;
    if(!point||!head)continue;
    line.setAttribute('x1',String(head.x));line.setAttribute('y1',String(head.y));line.setAttribute('x2',String(point.x));line.setAttribute('y2',String(point.y));
    button.style.transform=`translate(${point.x}px,${point.y}px) translate(-50%,-50%)`;
    button.dataset.id=point.id;button.title=point.label+' · Vernetzung anzeigen';
    const label=button.querySelector('span');if(label&&label.textContent!==point.label)label.textContent=point.label;
   }
   if(status.current){const message=docking?'Verbindung zum Gehirn':scanning?'Wissen wird durchsucht':visible.length?`${visible.length} Quellen im Blick · zum Erkunden anklicken`:latest.current.searching?'Suche läuft':(latest.current.targetLabel??'Keine Quelle im Blick');if(status.current.textContent!==message)status.current.textContent=message;}
  };
  frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
 },[active,session,prefs.reducedMotion]);
 if(!active)return null;
 return <div ref={box} className="jarvis-beam pointer-events-none fixed inset-0 z-40 overflow-hidden">
  <svg ref={svg} className="h-full w-full" aria-hidden="true">
   <line data-dock stroke="#86ebef" strokeWidth="2"/><circle data-core fill="none" stroke="#86ebef" strokeWidth="1"/>
   <line data-scan stroke="#86ebef" strokeWidth="1.5" opacity=".6"/>
   {Array.from({length:COUNT},(_,i)=><line key={i} data-ray stroke={i===0?'#a7f1ef':'#c6b1ff'} strokeWidth={i===0?1.8:1} opacity={i===0?.85:.55}/>)}
  </svg>
  {Array.from({length:COUNT},(_,i)=><button key={i} data-target hidden onClick={e=>{const id=e.currentTarget.dataset.id;if(id)onSelect?.(id);}} className="beam-target pointer-events-auto absolute left-0 top-0"><i/><span/></button>)}
  <div className="beam-status pointer-events-auto"><span ref={status}>Verbindung zum Gehirn</span><button onClick={onDismiss} aria-label="Verbindung trennen">Trennen ×</button></div>
 </div>;
}
