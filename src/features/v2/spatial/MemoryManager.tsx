"use client";
import {useRef,useState} from 'react';
import type {MemoryCatalog} from './memoryCatalog';
type Action='world'|'album'|'rename-world'|'rename-album';
export function MemoryManager({catalog,topic,phase,ready,onSave,onTopic}:{catalog:MemoryCatalog;topic:string;phase:string;ready:boolean;onSave:(c:MemoryCatalog)=>Promise<boolean>;onTopic:(id:string)=>void}){
 const [name,setName]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [action,setAction]=useState<Action|null>(null),[removing,setRemoving]=useState<'world'|'album'|null>(null);
 const lock=useRef(false);
 const realm=catalog.realms.find(r=>r.id===topic&&!r.archived),album=realm?.albums.find(a=>a.id===phase&&!a.archived);
 const start=(kind:Action)=>{setAction(kind);setRemoving(null);setName(kind==='rename-world'?realm?.title??'':kind==='rename-album'?album?.title??'':'');setMessage('');};
 async function persist(next:MemoryCatalog,success:string,select?:string){
  if(lock.current||!ready)return;lock.current=true;setBusy(true);
  try{if(await onSave(next)){setAction(null);setRemoving(null);setName('');setMessage(success);if(select!==undefined)onTopic(select);}else setMessage('Nicht gespeichert. Der bisherige Stand bleibt erhalten. Bitte erneut versuchen oder die Ansicht neu laden.');}
  catch{setMessage('Nicht gespeichert. Bitte erneut versuchen; deine Eingabe bleibt erhalten.');}
  finally{lock.current=false;setBusy(false);}
 }
 function save(){
  if(!action||busy||!ready)return;const title=name.trim();if(!title){setMessage('Bitte einen Namen eingeben.');return;}
  const next=structuredClone(catalog),r=next.realms.find(r=>r.id===topic);let select:string|undefined;
  if(action==='world'){if(next.realms.length>=100){setMessage('Maximal 100 Saturne einschließlich Archiv.');return;}select=crypto.randomUUID();next.realms.push({id:select,title,color:['#83d7dc','#dbabd1','#e9b47a','#acd3ab'][next.realms.length%4],albums:[]});}
  else if(r){if(action==='rename-world')r.title=title;if(action==='album'){if(r.albums.length>=100){setMessage('Maximal 100 Ringe einschließlich Archiv.');return;}r.albums.push({id:crypto.randomUUID(),title});}if(action==='rename-album'){const a=r.albums.find(a=>a.id===phase);if(a)a.title=title;}}
  void persist(next,'Gespeichert. Fotos und Verknüpfungen bleiben zugeordnet.',select);
 }
 function archive(){
  if(!removing||!realm)return;const next=structuredClone(catalog),r=next.realms.find(r=>r.id===topic)!;let select:string|undefined;
  if(removing==='world'){r.archived=true;select=next.realms.find(r=>!r.archived)?.id??'';}
  else {const a=r.albums.find(a=>a.id===phase);if(a)a.archived=true;}
  void persist(next,'Aus dem Raum entfernt. Im Archiv kannst du alles wiederherstellen.',select);
 }
 function restore(world:string,albumId?:string){const next=structuredClone(catalog),r=next.realms.find(r=>r.id===world);if(!r)return;r.archived=false;if(albumId){const a=r.albums.find(a=>a.id===albumId);if(a)a.archived=false;}void persist(next,'Wiederhergestellt.',world);}
 function move(direction:number){const next=structuredClone(catalog),r=next.realms.find(r=>r.id===topic);if(!r)return;const visible=r.albums.map((a,i)=>({a,i})).filter(({a})=>!a.archived),at=visible.findIndex(({a})=>a.id===phase),to=at+direction;if(at<0||to<0||to>=visible.length)return;const a=visible[at].i,b=visible[to].i;[r.albums[a],r.albums[b]]=[r.albums[b],r.albums[a]];void persist(next,'Ring verschoben.');}
 return <section className="memory-manager" aria-label="Saturne und Ringe bearbeiten">
  <div className="memory-manager-current"><small>DEIN SATURN</small><strong>{realm?.title??'Noch kein Saturn ausgewählt'}</strong></div>
  <fieldset disabled={busy||!ready}>
   <button type="button" disabled={!realm} onClick={()=>start('rename-world')}>Saturn umbenennen</button>
   <button type="button" disabled={!realm} onClick={()=>{setRemoving('world');setAction(null);}}>Saturn entfernen</button>
   <button type="button" onClick={()=>start('world')}>＋ Saturn erstellen</button>
   <button type="button" disabled={!realm} onClick={()=>start('album')}>＋ Ring erstellen</button>
  </fieldset>
  {action&&<form className="memory-name-editor" onSubmit={e=>{e.preventDefault();save();}}>
   <label>{action.endsWith('world')?'Name des Saturns':'Name des Rings'}<input autoFocus aria-label={action.endsWith('world')?'Name des Saturns':'Name des Rings'} maxLength={80} value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></label>
   <fieldset disabled={busy}><button type="submit" disabled={!ready}>{busy?'Wird gespeichert …':'Namen speichern'}</button><button type="button" onClick={()=>setAction(null)}>Abbrechen</button></fieldset>
  </form>}
  {removing&&<div className="memory-remove-confirm" role="group" aria-label="Entfernen bestätigen"><p>„{removing==='world'?realm?.title:album?.title}“ aus dem Raum entfernen? Fotos und Ringe bleiben im Archiv erhalten.</p><fieldset disabled={busy||!ready}><button type="button" onClick={archive}>Ins Archiv entfernen</button><button type="button" onClick={()=>setRemoving(null)}>Behalten</button></fieldset></div>}
  <details><summary>Ringe anordnen und bearbeiten</summary><p>{album?'Ausgewählter Ring: '+album.title:'Wähle zuerst einen Ring aus.'}</p><fieldset disabled={busy||!ready||!album}><button type="button" onClick={()=>start('rename-album')}>Ring umbenennen</button><button type="button" onClick={()=>{setRemoving('album');setAction(null);}}>Ring entfernen</button><button type="button" onClick={()=>move(-1)}>Ring nach innen</button><button type="button" onClick={()=>move(1)}>Ring nach außen</button></fieldset></details>
  {message&&<p role="status">{message}</p>}
  <details><summary>Archiv · Wiederherstellen</summary>{!catalog.realms.some(r=>r.archived||r.albums.some(a=>a.archived))&&<p>Dein Archiv ist leer.</p>}{catalog.realms.map(r=><div key={r.id}>{r.archived&&<button type="button" disabled={busy||!ready} onClick={()=>restore(r.id)}>{r.title} wiederherstellen</button>}{r.albums.filter(a=>a.archived).map(a=><button type="button" key={a.id} disabled={busy||!ready} onClick={()=>restore(r.id,a.id)}>{r.title} · {a.title} wiederherstellen</button>)}</div>)}</details>
 </section>;
}
