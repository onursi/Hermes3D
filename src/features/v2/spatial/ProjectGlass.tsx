"use client";
import { useState } from "react";
import type { Project,ProjectNote } from "../useProjects";
import { orbitState,type ProjectMeta,type ProjectDisposition } from "./model";

export function ProjectGlass({project,meta,onClose,onEnter,onOpen,onSaved}:{project:Project;meta?:ProjectMeta;onClose:()=>void;onEnter:()=>void;onOpen:(n:ProjectNote)=>void;onSaved:(m:ProjectMeta)=>void}){
 const [files,setFiles]=useState(false),[edit,setEdit]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('');
 const [goal,setGoal]=useState(meta?.goal||''),[disposition,setDisposition]=useState<ProjectDisposition>(meta?.disposition||'active'),[review,setReview]=useState(meta?.reviewAt||''),[note,setNote]=useState('');
 const label=orbitState(meta,Date.now()).label;
 const save=async()=>{setPending(true);setError('');try{const r=await fetch('/api/vault/project-state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({folder:project.folder,goal,disposition,reviewAt:review,note})});const result=await r.json();if(!r.ok||!result.ok)throw Error(result.error||'Speichern fehlgeschlagen');onSaved(result.meta);setEdit(false);setNote('');}catch(e){setError(e instanceof Error?e.message:'Fehler');}finally{setPending(false);}};
 return <aside className="r10-glass r10-project" aria-label="Projektübersicht">
  <button className="r10-close" onClick={onClose} aria-label="Projekt schließen">×</button><span className="r10-eyebrow">{label}</span><h2>{project.name}</h2>
  <p className="r10-goal">{meta?.goal||'Welches Ergebnis soll dieses Projekt erreichen?'}</p>
  <div className="r10-actions"><button onClick={onEnter}>Projektraum betreten ↗</button><button onClick={()=>setEdit(!edit)}>Entscheidung festhalten</button><button onClick={()=>setFiles(!files)}>MD-Dateien · {project.noteCount}</button></div>
  {files&&<div className="r10-filelist">{project.areas.flatMap(a=>a.notes).map(n=><button key={n.path} onClick={()=>onOpen(n)}>{n.title}<small>{n.modified.slice(0,10)} · Dateiänderung</small></button>)}</div>}
  {edit&&<form onSubmit={e=>{e.preventDefault();void save();}} className="r10-form">
   <label>Projektziel<input value={goal} onChange={e=>setGoal(e.target.value)} maxLength={500}/></label>
   <label>Zustand<select value={disposition} onChange={e=>setDisposition(e.target.value as ProjectDisposition)}><option value="active">Aktiv</option><option value="paused">Bewusst pausiert</option><option value="waiting">Warte auf Rückmeldung</option><option value="completed">Abgeschlossen</option></select></label>
   <label>Wiedervorlage<input type="date" value={review} onChange={e=>setReview(e.target.value)}/></label>
   <label>Ergebnis oder bewusste Entscheidung<textarea required value={note} onChange={e=>setNote(e.target.value)} maxLength={3000}/></label>
   <small>Speichert im Projekt als „Hermes3D Projektstatus.md“. Eine Entscheidung ist kein automatisch erzielter Fortschritt.</small>
   {error&&<p role="alert">{error}</p>}<button disabled={pending||!note.trim()} type="submit">{pending?'Speichert …':'Im Vault festhalten'}</button>
  </form>}
  <small className="r10-caption">Planetengröße = Umfang der Notizen. Orbit = bewusster Zustand und Wiedervorlage.</small>
 </aside>;
}
