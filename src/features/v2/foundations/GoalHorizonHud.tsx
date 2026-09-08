"use client";
import {useState} from 'react';
import {PanelWindow} from '../hud/PanelWindow';
import {useV2} from '../state';
import {useWorlds} from './WorldsProvider';
import {DIRECTIONS,BAND_LABELS,goalColor,goalStatus,horizonBand,nextMilestone} from './goalLayout';
import {roomSound} from './roomSound';
import './goalHorizon.css';

export function GoalHorizonHud({onRead}:{onRead:(id:string)=>void}){
 const {prefs}=useV2();const {objects,selected,choose,horizonView,setHorizonView,milestone,setMilestone,quick,setQuick,trip,travel,loading,issues}=useWorlds();
 const [catalog,setCatalog]=useState(false);const [query,setQuery]=useState('');
 const goals=objects.filter(o=>o.kind==='goal');const active=goals.find(o=>o.id===selected);
 const next=active?nextMilestone(active):-1;const index=milestone??next;const step=active?.milestones[index];
 const linked=active?objects.filter(o=>o.id!==active.id&&(active.links.includes(o.id)||o.links.includes(active.id))):[];
 const enter=(id:string)=>{setMilestone(null);choose(id);setCatalog(false);roomSound(prefs.sound*.3,true);};
 return <div className="goal-interface" style={{visibility:trip?'hidden':undefined}}>
  <header className="goal-heading"><span>DEIN MORGEN · DEIN TEMPO</span><h1>Goal Horizon</h1><p>{active?'Ein Ziel. Dein nächster sinnvoller Schritt.':'Nicht nur träumen. Sehen, wo es hinführt.'}</p></header>
  <nav className="goal-controls" aria-label="Zielraum Ansichten">
   {active?<button onClick={()=>{choose(null);setMilestone(null);}}>← Zielhimmel</button>:<><button aria-pressed={horizonView==='sky'} onClick={()=>setHorizonView('sky')}>Perspektive</button><button aria-pressed={horizonView==='top'} onClick={()=>setHorizonView('top')}>Draufsicht</button></>}
   <button aria-expanded={catalog} onClick={()=>setCatalog(!catalog)}>Ziele · {goals.length}</button>
   <button aria-pressed={quick} onClick={()=>setQuick(!quick)}>{quick?'Arbeitsmodus':'Erlebnismodus'}</button>
  </nav>
  {loading&&<p className="goal-status" role="status">Dein Zielhimmel wird gelesen …</p>}
  {issues.length>0&&<p className="goal-status" role="status">{issues.join(' · ')}</p>}
  {catalog&&<PanelWindow title="Zielkompass" onClose={()=>setCatalog(false)}><aside className="goal-panel goal-catalog" aria-label="Zielkompass"><label>Ziel finden<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Titel oder Lebensbereich"/></label>{goals.filter(o=>(o.title+' '+o.groups.join(' ')).toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de'))).map(o=><button className="goal-list-item" key={o.id} onClick={()=>enter(o.id)}><i style={{background:goalColor(o)}}/><span>{o.title}<small>{goalStatus(o)}</small></span></button>)}{!goals.length&&!loading&&<p>Hier sind noch keine Ziele erfasst.</p>}</aside></PanelWindow>}
  {!active&&!catalog&&<details className="goal-legend"><summary>So liest du deinen Himmel</summary><p>Größe: erfasste Bedeutung. Tiefe: dokumentierter Zeithorizont. Linien: Zugehörigkeit zu Lebensbereichen.</p><p>Umriss: Klärung offen. Halo: bewusst zurückgestellt. Die Helligkeit bewertet noch keine Aktivität — dafür fehlt eine verlässliche Datenanbindung.</p><p>Ein Ziel kann mehrere Richtungen verbinden. Leere Richtungen bleiben Platz für deine Zukunft.</p></details>}
  {active&&<PanelWindow key={active.id} title="Zielbegleiter" slot="goal"><aside className="goal-panel goal-detail" aria-label="Zielbegleiter">
   <span className="goal-kicker" style={{color:goalColor(active)}}>{active.groups.map(g=>DIRECTIONS.find(d=>d.id===g)?.label??g).join(' · ')||'Richtung noch offen'}</span>
   <h2>{active.title}</h2><p className="goal-state">{goalStatus(active)}</p><p>{active.summary}</p>
   <div className="goal-facts"><span>Horizont<strong>{active.due??'Noch offen'}</strong></span><span>Bedeutung<strong>{active.importance==='gross'?'Groß':active.importance==='mittel'?'Mittel':active.importance==='klein'?'Klein':'Nicht erfasst'}</strong></span></div>
   {active.due&&<small>{horizonBand(active.due)===null?'Zeitangabe nicht automatisch eingeordnet':BAND_LABELS[horizonBand(active.due)!]} · Termin aus deiner Notiz</small>}
   {active.pauseReason&&<p className="goal-note">Bewusste Pause: {active.pauseReason}</p>}
   {active.waiting==='andere'&&<p className="goal-note">Der nächste Schritt liegt bei anderen. Warten wird hier nicht als Versäumnis bewertet.</p>}
   <h3>Dein Goal Path</h3><div className="goal-steps">{active.milestones.map((m,i)=><button key={i} onClick={()=>{setMilestone(i);roomSound(prefs.sound*.15,true);}} aria-pressed={index===i}><b>{m.done?'✓':i+1}</b><span>{m.title}<small>{m.date||'Termin offen'}</small></span></button>)}</div>
   {step?<section className="goal-step-detail"><span className="goal-kicker">{index===next?'NÄCHSTER OFFENER SCHRITT':'MEILENSTEIN '+(index+1)}</span><h3>{step.title}</h3><p>{step.status|| (step.done?'Als erledigt dokumentiert':'Noch offen')}</p><p>Termin: {step.date??'Nicht erfasst'}</p></section>:<p>{active.milestones.length?'Alle erfassten Meilensteine sind erledigt. Das bestätigt noch nicht automatisch das gesamte Ziel.':'Noch keine Meilensteine erfasst. Dein Original ist der nächste Ort, um den Weg zu konkretisieren.'}</p>}
   <details><summary>Maßstab & Nachweis</summary><p>{active.measure||'Kein Maßstab erfasst.'}</p><p>Nachweis für das Ziel: {active.proof||'Noch offen'}</p>{active.cadence&&<p>Vorgabe: {active.cadence}</p>}<small>Diese Angaben stammen aus der Zielnotiz. Ein externer Nachweis wird hier noch nicht automatisch geprüft.</small></details>
   <h3>Verbundene Räume</h3>{linked.map(o=><button className="goal-link" key={o.id} onClick={()=>o.kind==='goal'?enter(o.id):travel('projects',o.id,o.title)}>{o.kind==='goal'?'Zielverbindung':'◎ Wurmloch · Projekte'}<strong>{o.title} →</strong></button>)}{!linked.length&&<small>Noch keine Verbindung zu einem erfassten Projekt oder Ziel.</small>}
   <button className="goal-source" onClick={()=>onRead(active.path)}>Original im Raum lesen ↗</button>
  </aside></PanelWindow>}
 </div>;
}
