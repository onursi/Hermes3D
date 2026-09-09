"use client";
import {useState} from 'react';
import {PanelWindow} from '../hud/PanelWindow';
import {useV2} from '../state';
import {useWorlds} from './WorldsProvider';
import {DIRECTIONS,closedGoal,BAND_LABELS,goalColor,goalStatus,horizonBand,nextMilestone} from './goalLayout';
import {roomSound} from './roomSound';
import './goalHorizon.css';
import {routineDirections} from './horizonRoutines';
import {GoalComposer} from './GoalComposer';
import {supernovaSound} from './roomSound';

export function GoalHorizonHud({onRead}:{onRead:(id:string)=>void}){
 const {prefs}=useV2();const {replaySupernova,routineSignals,routineStatus,timeLayers,setTimeLayers,returnHome,objects,selected,choose,horizonView,setHorizonView,milestone,setMilestone,quick,setQuick,trip,travel,loading,issues}=useWorlds();
 const [composer,setComposer]=useState(false);
 const [catalog,setCatalog]=useState(false);const [query,setQuery]=useState('');
 const goals=objects.filter(o=>o.kind==='goal');const active=goals.find(o=>o.id===selected);
 const achieved=active?.state==='erreicht';
 const next=active?nextMilestone(active):-1;const index=milestone??next;const step=active?.milestones[index];
 const linked=active?objects.filter(o=>o.id!==active.id&&(active.links.includes(o.id)||o.links.includes(active.id))):[];
 const enter=(id:string)=>{setMilestone(null);choose(id);setCatalog(false);roomSound(prefs.sound*.3,true);};
 return <div className="goal-interface" style={{zIndex:composer?80:undefined,visibility:trip?'hidden':undefined}}>
  <header className="goal-heading" style={{display:active?undefined:'none'}}><span>DEIN MORGEN · DEIN TEMPO</span><h1>Goal Horizon</h1><p>{achieved?'Erreicht. Ein Teil deiner Geschichte.':active?'Ein Ziel. Dein nächster sinnvoller Schritt.':'Dein Zukunftsfirmament · W A S D zum Reisen'}</p></header>
  <button className="goal-home-vector" onClick={()=>{setMilestone(null);returnHome();}} title="Zum Bezugspunkt zurückfliegen"><span id="goal-home-arrow">↑</span> Home Vector<small id="goal-home-distance">Rückflug zum Bezugspunkt</small></button><nav className="goal-controls" aria-label="Zielraum Ansichten">
   {active?<button onClick={()=>{choose(null);setMilestone(null);}}>← Zielhimmel</button>:<><button aria-pressed={horizonView==='sky'} onClick={()=>setHorizonView('sky')}>Perspektive</button><button aria-pressed={horizonView==='top'} onClick={()=>setHorizonView('top')}>Draufsicht</button></>}
   <button aria-pressed={timeLayers} onClick={()=>setTimeLayers(!timeLayers)}>{timeLayers?'Zeit ausblenden':'Zeit einblenden'}</button><button onClick={()=>setComposer(true)}>＋ Neues Ziel</button><button aria-expanded={catalog} onClick={()=>setCatalog(!catalog)}>Ziele · {goals.length}</button>
   <button aria-pressed={quick} onClick={()=>setQuick(!quick)}>{quick?'Arbeitsmodus':'Erlebnismodus'}</button>
  </nav>
  {!active&&!composer&&<details className="goal-routines"><summary>Handlungen nähren deine Richtung</summary><p>{routineStatus}</p>{routineSignals.map(r=><p key={r.name}><strong>{r.name}</strong><br/>{!r.found?'Nicht eindeutig gefunden':r.doneToday?'Heute erledigt':'Heute keine Erledigung gemeldet'} · {routineDirections(r,objects).map(id=>DIRECTIONS.find(d=>d.id===id)?.label??id).join(' · ')||'Zielzuordnung noch offen'}<small>{r.days} Tage mit Erledigung im letzten 7-Tage-Zeitraum</small></p>)}<small>Handlungen sind keine neuen Ziele. Eine erledigte Sammelaufgabe ist ein Nachweis dieser Aufgabe, keine Einzelzählung ihrer Bestandteile. Licht bleibt symbolisch.</small></details>}
  {composer&&<GoalComposer onClose={()=>setComposer(false)}/>}
  {loading&&<p className="goal-status" role="status">Dein Zielhimmel wird gelesen …</p>}
  {issues.length>0&&<p className="goal-status" role="status">{issues.join(' · ')}</p>}
  {catalog&&!composer&&<PanelWindow title="Zielkompass" onClose={()=>setCatalog(false)}><aside className="goal-panel goal-catalog" aria-label="Zielkompass"><label>Ziel finden<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Titel oder Lebensbereich"/></label>{goals.filter(o=>(o.title+' '+o.groups.join(' ')).toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de'))).map(o=><button className="goal-list-item" key={o.id} onClick={()=>enter(o.id)}><i style={{background:goalColor(o)}}/><span>{o.title}<small>{goalStatus(o)}</small></span></button>)}{!goals.length&&!loading&&<p>Hier sind noch keine Ziele erfasst.</p>}</aside></PanelWindow>}
  {!active&&!catalog&&!composer&&<details className="goal-legend"><summary>So liest du deinen Himmel</summary><p>Größe: erfasste Bedeutung. Tiefe: dokumentierter Zeithorizont. Zeitschichten erscheinen auf Wunsch. Ziele ohne Termin bleiben zeitlich offen.</p><p>Zielzustand und bewusste Pausen stehen im Zielkompass. Zusätzliches Sektorlicht zeigt zugeordnete, bestätigte Handlungen. Es ist kein berechneter Zielerreichungsgrad.</p><p>Nähe zeigt gemeinsame Lebensbereiche und bestätigte Verbindungen. Tiefe bleibt Zeit. Dies ist eine räumliche Beziehungskarte, keine PCA oder Messung deiner Persönlichkeit.</p><p>Der goldene Schriftzug ist ein unerreichbarer Orientierungspunkt. Sein Licht ist keine Bewertung deines Glaubens. Zusätzliches Licht folgt ausschließlich zugeordneten, bestätigten Handlungen.</p></details>}
  {active&&!composer&&<PanelWindow key={active.id} title="Zielbegleiter" slot="goal"><aside className="goal-panel goal-detail" aria-label="Zielbegleiter">
   <span className="goal-kicker" style={{color:goalColor(active)}}>{active.groups.map(g=>DIRECTIONS.find(d=>d.id===g)?.label??g).join(' · ')||'Richtung noch offen'}</span>
   <h2>{active.title}</h2><p className="goal-state">{goalStatus(active)}</p><p>{active.summary}</p>
   {!closedGoal(active.state)&&<><div className="goal-facts"><span>Horizont<strong>{active.due??'Noch offen'}</strong></span><span>Bedeutung<strong>{active.importance==='gross'?'Groß':active.importance==='mittel'?'Mittel':active.importance==='klein'?'Klein':'Nicht erfasst'}</strong></span></div>
   {active.due&&<small>{horizonBand(active.due)===null?'Zeitangabe nicht automatisch eingeordnet':BAND_LABELS[horizonBand(active.due)!]} · Termin aus deiner Notiz</small>}
   {active.pauseReason&&<p className="goal-note">Bewusste Pause: {active.pauseReason}</p>}
   {active.waiting==='andere'&&<p className="goal-note">Der nächste Schritt liegt bei anderen. Warten wird hier nicht als Versäumnis bewertet.</p>}
   <h3>Dein Goal Path · Station anklicken und anfliegen</h3><small>Gestrichelte Wege zeigen die dokumentierte Reihenfolge, keine bestätigte Abhängigkeit.</small><div className="goal-step-travel"><button disabled={index<=0} onClick={()=>setMilestone(index-1)}>← Vorherige Station</button><button disabled={index<0||index>=active.milestones.length-1} onClick={()=>setMilestone(index+1)}>Nächste Station →</button></div><div className="goal-steps">{active.milestones.map((m,i)=><button key={i} onClick={()=>{setMilestone(i);roomSound(prefs.sound*.15,true);}} aria-pressed={index===i}><b>{m.done?'✓':i+1}</b><span>{m.title}<small>{m.date||'Termin offen'}</small></span></button>)}</div>
   {step?<section className="goal-step-detail"><span className="goal-kicker">{index===next?'NÄCHSTER OFFENER SCHRITT':'MEILENSTEIN '+(index+1)}</span><h3>{step.title}</h3><p>{step.status|| (step.done?'Als erledigt dokumentiert':'Noch offen')}</p><p>Termin: {step.date??'Nicht erfasst'}</p></section>:<p>{active.milestones.length?'Alle erfassten Meilensteine sind erledigt. Das bestätigt noch nicht automatisch das gesamte Ziel.':'Noch keine Meilensteine erfasst. Dein Original ist der nächste Ort, um den Weg zu konkretisieren.'}</p>}
   </>}
   {!achieved&&closedGoal(active.state)&&<section className="goal-achieved"><h3>Deine Erfahrung bleibt</h3><p>{active.state==='nicht-erreicht'?'Dieses Ziel wurde als nicht erreicht dokumentiert.': 'Dieser Weg wurde bewusst beendet.'} Gründe, Erkenntnisse und neue Richtungen gehören zu seiner Geschichte.</p><button className="goal-source" onClick={()=>onRead(active.path)}>Dokumentation im Raum lesen →</button></section>}
   {achieved&&<section className="goal-achieved"><h3>Deine Supernova bleibt</h3><button className="goal-source" onClick={()=>{replaySupernova();supernovaSound(prefs.sound);}}>✦ Erfolg noch einmal erleben</button><small>Wiederholung des Erlebnisses · kein neuer Abschluss</small><p>Dieses Ziel ist als erreicht dokumentiert. Es braucht keinen offenen Zukunftspfad mehr.</p><button className="goal-source" onClick={()=>travel('success',active.id,active.title)}>Erfolg und Belege in Success Singularity ansehen →</button></section>}
   <details><summary>Maßstab & Nachweis</summary><p>{active.measure||'Kein Maßstab erfasst.'}</p><p>Nachweis für das Ziel: {active.proof?.replace(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g,(_,path,label)=>label||path.split('/').pop())||'Noch offen'}</p>{active.cadence&&<p>Vorgabe: {active.cadence}</p>}<small>Diese Angaben stammen aus der Zielnotiz. Ein externer Nachweis wird hier noch nicht automatisch geprüft.</small></details>
   <h3>Unterstützende Handlungen</h3>{active.actions?.length?active.actions.map(a=><p key={a}>{a}<small>{routineSignals.find(r=>r.name===a)?.doneToday?'Heute bestätigt erledigt':'Heute kein bestätigter Abschluss'}</small></p>):<small>Noch keine konkrete Handlung mit diesem Ziel verknüpft.</small>}<h3>Verbundene Räume</h3>{linked.map(o=><button className="goal-link" key={o.id} onClick={()=>o.kind==='goal'?enter(o.id):travel(o.state==='abgeschlossen'?'success':'projects',o.id,o.title)}>{o.kind==='goal'?'Zielverbindung':o.state==='abgeschlossen'?'◎ Wurmloch · Success Singularity':'◎ Wurmloch · Projekte'}<strong>{o.title} →</strong></button>)}{!linked.length&&<small>Noch keine Verbindung zu einem erfassten Projekt oder Ziel.</small>}
   <button className="goal-source" onClick={()=>onRead(active.path)}>Original im Raum lesen ↗</button>
  </aside></PanelWindow>}
 </div>;
}
