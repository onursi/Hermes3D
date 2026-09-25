"use client";
import {FlowWorkspace} from "./FlowWorkspace";
import {ProjectCreate,ProjectPhaseEditor} from "./ProjectEditing";
import {AtmosphereAudio} from "../hud/AtmosphereAudio";
import {PanelVisibility} from "../hud/PanelVisibility";
import {HudLayoutSwitch} from "../hud/HudLayoutSwitch";
import {CinemaButton} from "../hud/CinemaButton";
import {EvidencePdf} from './EvidencePdf';
import NextLink from 'next/link';
import {useEffect,useRef,useState} from "react";
import {PROJECT_PHASES} from "./projectMotion";
import {PanelWindow} from "../hud/PanelWindow";
import {useV2,type V2World} from "../state";
import {useWorlds} from "./WorldsProvider";
import {ROOM_WORLDS} from "./WorldsScene";
import {isSuccess} from './successModel';
import {roomSound,singularitySound} from "./roomSound";
import {GoalHorizonHud} from "./GoalHorizonHud";
const ROOMS:{id:V2World;title:string;description:string}[]=[{id:'horizon',title:'Goal Horizon',description:'Richtung finden'},{id:'projects',title:'Project Singularity',description:'Vorhaben vollenden'},{id:'flow',title:'Flow Orbit',description:'Was gerade läuft'},{id:'cosmos',title:'Second Brain',description:'Wissen verbinden'},{id:'atelier',title:'Ideenatelier',description:'Aus Gedanken wird ein nächster Schritt'},{id:'sanctuary',title:'Vision Sanctuary',description:'Raum für das Warum'},{id:'success',title:'Success Singularity',description:'Erreichtes wiederfinden'},{id:'memory',title:'Memory Orbit',description:'Zurückblicken'}];
const ROOM_SEARCH_TERMS:Partial<Record<V2World,string>>={horizon:'Ziele Zukunft Meilensteine',projects:'Projekte Vorhaben Planung',flow:'Automationen Routinen Handlungen',cosmos:'Gehirn Notizen Quellen Wissen',atelier:'Ideen Impulse Gedanken',sanctuary:'Vision Werte Sinn',success:'Erfolge erreicht abgeschlossen',memory:'Erinnerungen Fotos Reisen'};
export function WorldsHud({onRead,onDive}:{onRead:(id:string)=>void;onDive:()=>void}){
 const {world,goTo,prefs}=useV2();const {objects,selected,choose,loading,issues,phase,setPhase,travel,trip}=useWorlds();
 const [roomQuery,setRoomQuery]=useState('');const menuRef=useRef<HTMLElement>(null);
 const [preview,setPreview]=useState<string|null>(null);const [menu,setMenu]=useState(false);const [drafts,setDrafts]=useState<Record<string,{decision:string;thought:string}>>({});const [reflection,setReflection]=useState('');
 useEffect(()=>{if(!menu)return;const close=(event:PointerEvent)=>{const target=event.target as Element;if(!menuRef.current?.contains(target)&&!target.closest('[aria-controls="room-navigation"]'))setMenu(false);};document.addEventListener('pointerdown',close);if(!window.matchMedia('(max-width: 700px), (max-width: 1000px) and (max-height: 500px)').matches)menuRef.current?.querySelector<HTMLInputElement>('input')?.focus();return()=>document.removeEventListener('pointerdown',close);},[menu]);
 useEffect(()=>{const open=()=>{setRoomQuery('');setMenu(true);};const close=()=>setMenu(false);window.addEventListener('hermes:rooms-open',open);window.addEventListener('hermes:rooms-close',close);return()=>{window.removeEventListener('hermes:rooms-open',open);window.removeEventListener('hermes:rooms-close',close);};},[]);
 const matchesRoom=(r:typeof ROOMS[number])=>(r.title+' '+r.description+' '+(ROOM_SEARCH_TERMS[r.id]??'')).toLocaleLowerCase('de').includes(roomQuery.trim().toLocaleLowerCase('de'));
 const room=ROOMS.find(r=>r.id===world);const active=objects.find(o=>o.id===selected);
 const {decision,thought}=drafts[active?.id??'']??{decision:'Experiment',thought:''};
 const updateDraft=(change:Partial<{decision:string;thought:string}>)=>{if(active)setDrafts(prev=>({...prev,[active.id]:{...(prev[active.id]??{decision:'Experiment',thought:''}),...change}}));};
 const list=objects.filter(o=>world==='projects'?o.kind==='project'&&o.state!=='abgeschlossen':world==='success'?isSuccess(o):world==='horizon'?o.kind==='goal':world==='atelier'?o.kind==='idea':false);
 const enter=(id:V2World)=>{choose(null);setMenu(false);if(world==='home'&&!prefs.reducedMotion&&!window.matchMedia('(max-width: 700px), (max-width: 1000px) and (max-height: 500px)').matches){window.dispatchEvent(new CustomEvent('hermes:portal-enter',{detail:id}));return;}roomSound(prefs.sound);goTo(id);};
 const draft=()=>{if(!active)return;const text=`# Entscheidung zur Idee

Quelle: [[${active.path.replace(/\.md$/,'')}]]

Idee: ${active.title}

Vorgeschlagener nächster Schritt: ${decision}

${thought}

Status: Entwurf, noch nicht im LifeOS übernommen.
`;const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Ideenentscheidung.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <>
 <div id="hermes-panel-tray" role="region" aria-label="Minimierte Arbeitsfenster"/>
  {preview&&<PanelWindow key={preview} title="Belegansicht"><aside className="success-proof-view"><button onClick={()=>setPreview(null)}>Beleg schließen ×</button><h2>{preview.split('/').pop()}</h2>{/\.pdf$/i.test(preview)?<EvidencePdf key={preview} id={preview}/>:<img alt={preview.split('/').pop()} src={'/api/vault/attachment?id='+encodeURIComponent(preview)}/>}<a href={'/api/vault/attachment?id='+encodeURIComponent(preview)} target="_blank" rel="noreferrer">In voller Größe öffnen ↗</a></aside></PanelWindow>}
  <div className="room-toolbar" role="toolbar" aria-label="Raumwerkzeuge">
   <AtmosphereAudio/><CinemaButton/><HudLayoutSwitch/><PanelVisibility key={world}/>
   {world==='home'&&<button className="room-tool" onClick={()=>window.dispatchEvent(new Event('hermes:portal-overview'))}>◎ Portalkreis</button>}
   <button className="room-tool" onClick={()=>{setRoomQuery('');setMenu(!menu);}} aria-expanded={menu} aria-controls="room-navigation">◈ Räume</button>
  </div>
  {menu&&<nav ref={menuRef} id="room-navigation" className="worlds-menu" aria-label="Alle Räume" onKeyDown={e=>{if(e.key==='Escape'){setMenu(false);document.querySelector<HTMLButtonElement>('[aria-controls="room-navigation"]')?.focus();}}}>
   <div className="room-navigation-heading"><span>DEIN UNIVERSUM</span><strong>Wohin möchtest du?</strong><input aria-label="Raum suchen" placeholder="Raum oder Tätigkeit suchen …" value={roomQuery} onChange={e=>setRoomQuery(e.target.value)}/></div>
   {!roomQuery||'Neuronales Impulsfeld Gedanken neuronalen Raum verbinden'.toLocaleLowerCase('de').includes(roomQuery.toLocaleLowerCase('de'))?<NextLink className="worlds-room-card" href="/atelier-lab"><strong>Neuronales Impulsfeld</strong><span>Gedanken im neuronalen Raum verbinden →</span></NextLink>:null}
   {ROOMS.filter(matchesRoom).map(r=><button key={r.id} onClick={()=>enter(r.id)} aria-current={world===r.id?'page':undefined}><strong>{r.title}</strong><span>{r.description}</span></button>)}
   {roomQuery&&!ROOMS.some(matchesRoom)&&!'Neuronales Impulsfeld Gedanken neuronalen Raum verbinden'.toLocaleLowerCase('de').includes(roomQuery.toLocaleLowerCase('de'))&&<p className="room-navigation-empty" role="status">Kein passender Raum. Versuche „Wissen“, „Ziel“ oder „Gedanken“.</p>}
   <button className="room-menu-close" onClick={()=>setMenu(false)}>Menü schließen ×</button>
  </nav>}
  {world==='horizon'&&<GoalHorizonHud onRead={onRead}/>}
  {world!=='horizon'&&(ROOM_WORLDS.includes(world)||world==='projects')&&<PanelWindow key={world} slot={world==='projects'?'project':'left'} title={room?.title??"Raum"}><aside className="worlds-panel" aria-label="Raumübersicht" style={{visibility:trip?"hidden":undefined}}>
   <span className="worlds-eyebrow">{world==='success'?'DAS BLEIBT':world==='atelier'?'FORMRAUM':world==='flow'?'BETRIEB':'DEIN UNIVERSUM'}</span>
   <h1>{room?.title}</h1>{world==='atelier'&&<NextLink className="worlds-primary" href="/atelier-lab">Im neuronalen Impulsfeld weiterdenken →</NextLink>}<p>{room?.description}</p>
   {loading&&<p role="status">LifeOS wird gelesen …</p>}{issues.length>0&&<p role="status">{issues.join(' · ')}</p>}
   {world==='projects'&&<><p>Wähle einen Ring, um dort ein Projekt anzulegen. Wähle einen Planeten, um seine Phase zu bearbeiten.</p><button className="worlds-primary" onClick={onDive}>Durch den Ereignishorizont →</button></>}
   {world==='projects'&&<><button className="worlds-primary" onClick={()=>setPhase(phase??'idee')}>＋ Neues Projekt</button><details className="phase-legend"><summary>Die fünf Projektphasen</summary>{PROJECT_PHASES.map(p=><button key={p.id} onClick={()=>setPhase(p.id)}>{p.title}</button>)}</details>{phase&&<section className="worlds-phase-info"><h3>{PROJECT_PHASES.find(p=>p.id===phase)?.title}</h3><p>{PROJECT_PHASES.find(p=>p.id===phase)?.description}</p><ProjectCreate key={phase} phase={phase}/><button onClick={()=>setPhase(null)}>Phasenerklärung schließen</button></section>}</>}
   {world==='success'&&<><p>Links leuchten erreichte Ziele. Rechts bewahren wir vollendete Projekte. Wähle einen Erfolg, um seine Belege und Verbindungen zu sehen.</p><button onClick={()=>enter('projects')}>← Zur Singularität</button></>}
   {world==='flow'&&<FlowWorkspace onRead={onRead}/>}
   {world==='sanctuary'&&<><p>Ein weiter, ruhiger Ort für das, was dir wichtig ist. Hier muss noch nichts messbar sein.</p><label>Welcher Gedanke soll Raum bekommen?<textarea value={reflection} onChange={e=>setReflection(e.target.value)} placeholder="Was wünsche ich mir – und weshalb?"/></label><small>Dein Gedanke bleibt vorerst in dieser Sitzung.</small><button onClick={()=>enter('horizon')}>Zu meinen Zielen →</button><button onClick={()=>enter('atelier')}>Eine Idee weiterdenken →</button></>}
   {!loading&&['projects','horizon','atelier','success'].includes(world)&&list.length===0&&<p>Hier ist noch kein passender Eintrag erfasst.</p>}
   {world==='home'&&<NextLink href="/council-lab" className="worlds-primary">Konsil · Testbühne öffnen ↗</NextLink>}<div className="worlds-object-list">{list.map(o=><button key={o.id} onClick={()=>{choose(o.id);roomSound(prefs.sound,true);}} aria-pressed={selected===o.id}><span>{world==='success'?(o.kind==='goal'?'✦ Ziel · ':'◇ Projekt · '):''}{o.parent?'◦ ':'◇ '}{o.title}</span><small>{o.state}{o.waiting==='andere'?' · wartet auf andere':''}</small></button>)}</div>
   {active&&list.some(o=>o.id===active.id)&&<section className="worlds-detail"><h2>{active.title}</h2><p>{active.due?'Zeithorizont: '+active.due:'Kein Zeithorizont erfasst'}</p><button onClick={()=>onRead(active.path)}>Original im Raum lesen ↗</button>
    {active.kind==='project'&&<>{world==='projects'&&<ProjectPhaseEditor key={active.id} id={active.path}/>}<h3>Projektziel & Zusammenfassung</h3><p>{active.summary||'Kein eindeutiger Kurztext erfasst. Die Originalnotiz enthält den vollständigen Kontext.'}</p><h3>Dokumentierter Stand</h3><p>{active.current||`Erfasste Phase: ${PROJECT_PHASES.find(p=>p.id===active.state)?.title??active.state}.`}</p><h3>Nächstes Todo</h3><p>{active.nextTodo||'Kein nächstes Todo eindeutig erfasst.'}</p>{active.nextHeading&&<small>Quelle: {active.nextHeading} · Datum und Gültigkeit vor Ausführung prüfen.</small>}<h3>{world==='success'?'Weiterführende Räume':'Wurmlöcher'}</h3>{active.flowAccess&&<button onClick={()=>travel('flow',active.id,'Flow Orbit')}>◎ Flow Orbit · Ablauf ansehen →</button>}</>}
    {world==='success'&&<section><h3>Belege & Erinnerungen</h3><p>{active.proof||'Kein gesonderter Nachweis beschrieben.'}</p>{(active.attachments||[]).map(file=><button className="success-proof" key={file} onClick={()=>setPreview(file)}>{file.split('/').pop()} ansehen ↗</button>)}{!active.attachments?.length&&<small>Noch kein Foto, Zeugnis oder Dokument verknüpft.</small>}<h3>Verbindungen</h3></section>}
    {active.milestones.map((m,i)=><p key={i}>{m.done?'✓':'○'} {m.title}</p>)}
    {[...new Set([...(active.parent?[active.parent]:[]),...active.links.filter(id=>!(active.attachments||[]).some(file=>id===file||id===file+'.md')),...objects.filter(o=>o.links.includes(active.id)||o.parent===active.id).map(o=>o.id)])].map(id=>{const target=objects.find(o=>o.id===id);return target?<button key={id} onClick={()=>{travel(isSuccess(target)?'success':target.kind==='goal'?'horizon':'projects',id,target.title);}}>{(isSuccess(target)?'success':target.kind==='goal'?'horizon':'projects')===world?'Verbindung: ':'Wurmloch: '}{target.title} →</button>:<button key={id} onClick={()=>onRead(id)}>Verknüpfte Quelle öffnen ↗</button>;})}
    {world==='atelier'&&<><label>Nächster Schritt<select value={decision} onChange={e=>updateDraft({decision:e.target.value})}>{['Experiment','Ziel formulieren','Meilensteine festlegen','Projekt starten','Später prüfen','Archivieren / verwerfen'].map(s=><option key={s}>{s}</option>)}</select></label><label>Was soll konkret passieren?<textarea value={thought} onChange={e=>updateDraft({thought:e.target.value})}/></label><button disabled={!thought.trim()} onClick={draft}>Entscheidungsentwurf herunterladen</button><small>Du prüfst den Entwurf vor einer Übernahme ins LifeOS.</small></>}
   </section>}
  </aside></PanelWindow>}
 </>;
}
export function HorizonCrossing({onComplete}:{onComplete:()=>void}){
 const {prefs}=useV2();const done=useRef(onComplete);useEffect(()=>{done.current=onComplete;},[onComplete]);
 useEffect(()=>{singularitySound(prefs.sound);const t=setTimeout(()=>{singularitySound(prefs.sound,true);done.current();},prefs.reducedMotion?40:3400);return()=>clearTimeout(t);},[prefs.sound,prefs.reducedMotion]);
 return <div className="horizon-crossing" aria-label="Übergang in den Erfolgsraum">{!prefs.reducedMotion&&Array.from({length:12},(_,i)=><i key={i} style={{animationDelay:`${i*.085}s`,transform:`rotate(${i*7}deg)`}}/>)}<b className="singularity-seed"/><span>Success Singularity</span></div>;
}
