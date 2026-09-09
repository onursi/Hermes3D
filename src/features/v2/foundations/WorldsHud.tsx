"use client";
import NextLink from 'next/link';
import {useEffect,useRef,useState} from "react";
import {PROJECT_PHASES} from "./projectMotion";
import {PanelWindow} from "../hud/PanelWindow";
import {useV2,type V2World} from "../state";
import {useWorlds} from "./WorldsProvider";
import {ROOM_WORLDS} from "./WorldsScene";
import {isSuccess} from './successModel';
import {roomSound,wormholeSound} from "./roomSound";
import {GoalHorizonHud} from "./GoalHorizonHud";
const ROOMS:{id:V2World;title:string;description:string}[]=[{id:'horizon',title:'Goal Horizon',description:'Richtung finden'},{id:'projects',title:'Project Singularity',description:'Vorhaben vollenden'},{id:'flow',title:'Flow Orbit',description:'Was gerade läuft'},{id:'cosmos',title:'Second Brain',description:'Wissen verbinden'},{id:'atelier',title:'Ideenatelier',description:'Aus Gedanken wird ein nächster Schritt'},{id:'sanctuary',title:'Vision Sanctuary',description:'Raum für das Warum'},{id:'success',title:'Success Singularity',description:'Erreichtes wiederfinden'},{id:'memory',title:'Memory Orbit',description:'Zurückblicken'}];
export function WorldsHud({onRead,onDive}:{onRead:(id:string)=>void;onDive:()=>void}){
 const {world,goTo,prefs}=useV2();const {objects,selected,choose,loading,issues,jobs,flowStatus,phase,setPhase,travel,origin,trip}=useWorlds();
 const [preview,setPreview]=useState<string|null>(null);const [menu,setMenu]=useState(false);const [drafts,setDrafts]=useState<Record<string,{decision:string;thought:string}>>({});const [reflection,setReflection]=useState('');
 const room=ROOMS.find(r=>r.id===world);const active=objects.find(o=>o.id===selected);const run=jobs.find(j=>'run:'+j.id===selected);
 const {decision,thought}=drafts[active?.id??'']??{decision:'Experiment',thought:''};
 const updateDraft=(change:Partial<{decision:string;thought:string}>)=>{if(active)setDrafts(prev=>({...prev,[active.id]:{...(prev[active.id]??{decision:'Experiment',thought:''}),...change}}));};
 const list=objects.filter(o=>world==='projects'?o.kind==='project'&&o.state!=='abgeschlossen':world==='success'?isSuccess(o):world==='horizon'?o.kind==='goal':world==='atelier'?o.kind==='idea':false);
 const enter=(id:V2World)=>{choose(null);setMenu(false);if(world==='home'&&!prefs.reducedMotion){window.dispatchEvent(new CustomEvent('hermes:portal-enter',{detail:id}));return;}roomSound(prefs.sound);goTo(id);};
 const draft=()=>{if(!active)return;const text=`# Entscheidung zur Idee

Quelle: [[${active.path.replace(/\.md$/,'')}]]

Idee: ${active.title}

Vorgeschlagener nächster Schritt: ${decision}

${thought}

Status: Entwurf, noch nicht im LifeOS übernommen.
`;const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Ideenentscheidung.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <>
  {preview&&<PanelWindow key={preview} title="Belegansicht"><aside className="success-proof-view"><button onClick={()=>setPreview(null)}>Beleg schließen ×</button><h2>{preview.split('/').pop()}</h2>{/\.pdf$/i.test(preview)?<iframe title="Abschlussdokument" src={'/api/vault/attachment?id='+encodeURIComponent(preview)}/>:<img alt={preview.split('/').pop()} src={'/api/vault/attachment?id='+encodeURIComponent(preview)}/>}<a href={'/api/vault/attachment?id='+encodeURIComponent(preview)} target="_blank" rel="noreferrer">In voller Größe öffnen ↗</a></aside></PanelWindow>}
  <button className="worlds-switch" onClick={()=>setMenu(!menu)} aria-expanded={menu}>◈ Räume</button>
  {world==='home'&&<button className="home-portal-overview" onClick={()=>window.dispatchEvent(new Event('hermes:portal-overview'))}>◎ Portalkreis ansehen</button>}
  {menu&&<nav className="worlds-menu" aria-label="Alle Räume"><NextLink className="worlds-primary" href="/atelier-lab">Neuronales Impulsfeld →</NextLink>{ROOMS.map(r=><button key={r.id} onClick={()=>enter(r.id)} aria-current={world===r.id?'page':undefined}><strong>{r.title}</strong><span>{r.description}</span></button>)}</nav>}
  {world==='horizon'&&<GoalHorizonHud onRead={onRead}/>}
  {world!=='horizon'&&(ROOM_WORLDS.includes(world)||world==='projects')&&<PanelWindow key={world} title={room?.title??"Raum"}><aside className="worlds-panel" aria-label="Raumübersicht" style={{visibility:trip?"hidden":undefined}}>
   <span className="worlds-eyebrow">{world==='success'?'DAS BLEIBT':world==='atelier'?'FORMRAUM':world==='flow'?'BETRIEB':'DEIN UNIVERSUM'}</span>
   <h1>{room?.title}</h1>{world==='atelier'&&<NextLink className="worlds-primary" href="/atelier-lab">Im neuronalen Impulsfeld weiterdenken →</NextLink>}<p>{room?.description}</p>
   {loading&&<p role="status">LifeOS wird gelesen …</p>}{issues.length>0&&<p role="status">{issues.join(' · ')}</p>}
   {world==='projects'&&<><p>Die Bahn zeigt die erfasste Projektphase. Monde erscheinen bei Auswahl ihres Projekts.</p><button className="worlds-primary" onClick={onDive}>Durch den Ereignishorizont →</button></>}
   {world==='projects'&&<><details className="phase-legend"><summary>Die fünf Projektphasen</summary>{PROJECT_PHASES.map(p=><button key={p.id} onClick={()=>setPhase(p.id)}>{p.title}</button>)}</details>{phase&&<section className="worlds-phase-info"><h3>{PROJECT_PHASES.find(p=>p.id===phase)?.title}</h3><p>{PROJECT_PHASES.find(p=>p.id===phase)?.description}</p><button onClick={()=>setPhase(null)}>Phasenerklärung schließen</button></section>}</>}
   {world==='success'&&<><p>Links leuchten erreichte Ziele. Rechts bewahren wir vollendete Projekte. Wähle einen Erfolg, um seine Belege und Verbindungen zu sehen.</p><button onClick={()=>enter('projects')}>← Zur Singularität</button></>}
   {world==='flow'&&<>{origin&&<p>Ankunft von {objects.find(o=>o.id===origin)?.title}. Dieser Projektbezug ist noch keinem gemeldeten Lauf zugeordnet.</p>}<p role="status">{flowStatus}</p><small>Die Stationen zeigen die Ablaufstruktur. Bewegte Objekte stehen ausschließlich für gemeldete aktive Läufe.</small>{jobs.map(j=><button key={j.id} onClick={()=>choose('run:'+j.id)}>{j.name}<small>{j.state?.runningAtMs?'Läuft':j.enabled?'Geplant':'Pausiert'}</small></button>)}{run&&<section><h2>{run.name}</h2><p>{run.state?.lastError||run.description||'Keine weitere Beschreibung gemeldet.'}</p><p>Letzter Status: {run.state?.lastStatus||'Noch nicht gemeldet'}</p></section>}</>}
   {world==='sanctuary'&&<><p>Ein weiter, ruhiger Ort für das, was dir wichtig ist. Hier muss noch nichts messbar sein.</p><label>Welcher Gedanke soll Raum bekommen?<textarea value={reflection} onChange={e=>setReflection(e.target.value)} placeholder="Was wünsche ich mir – und weshalb?"/></label><small>Dein Gedanke bleibt vorerst in dieser Sitzung.</small><button onClick={()=>enter('horizon')}>Zu meinen Zielen →</button><button onClick={()=>enter('atelier')}>Eine Idee weiterdenken →</button></>}
   {!loading&&['projects','horizon','atelier','success'].includes(world)&&list.length===0&&<p>Hier ist noch kein passender Eintrag erfasst.</p>}
   <div className="worlds-object-list">{list.map(o=><button key={o.id} onClick={()=>{choose(o.id);roomSound(prefs.sound,true);}} aria-pressed={selected===o.id}><span>{world==='success'?(o.kind==='goal'?'✦ Ziel · ':'◇ Projekt · '):''}{o.parent?'◦ ':'◇ '}{o.title}</span><small>{o.state}{o.waiting==='andere'?' · wartet auf andere':''}</small></button>)}</div>
   {active&&list.some(o=>o.id===active.id)&&<section className="worlds-detail"><h2>{active.title}</h2><p>{active.due?'Zeithorizont: '+active.due:'Kein Zeithorizont erfasst'}</p><button onClick={()=>onRead(active.path)}>Original im Raum lesen ↗</button>
    {active.kind==='project'&&<><h3>Projektziel & Zusammenfassung</h3><p>{active.summary||'Kein eindeutiger Kurztext erfasst. Die Originalnotiz enthält den vollständigen Kontext.'}</p><h3>Dokumentierter Stand</h3><p>{active.current||`Erfasste Phase: ${PROJECT_PHASES.find(p=>p.id===active.state)?.title??active.state}.`}</p><h3>Nächstes Todo</h3><p>{active.nextTodo||'Kein nächstes Todo eindeutig erfasst.'}</p>{active.nextHeading&&<small>Quelle: {active.nextHeading} · Datum und Gültigkeit vor Ausführung prüfen.</small>}<h3>{world==='success'?'Weiterführende Räume':'Wurmlöcher'}</h3>{active.flowAccess&&<button onClick={()=>travel('flow',undefined,'Flow Orbit')}>◎ Flow Orbit · Automation ansehen →</button>}</>}
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
 useEffect(()=>{wormholeSound(prefs.sound);const t=setTimeout(()=>{wormholeSound(prefs.sound,true);done.current();},prefs.reducedMotion?40:3400);return()=>clearTimeout(t);},[prefs.sound,prefs.reducedMotion]);
 return <div className="horizon-crossing" aria-label="Übergang in den Erfolgsraum">{!prefs.reducedMotion&&Array.from({length:12},(_,i)=><i key={i} style={{animationDelay:`${i*.085}s`,transform:`rotate(${i*7}deg)`}}/>)}<b className="singularity-seed"/><span>Success Singularity</span></div>;
}
