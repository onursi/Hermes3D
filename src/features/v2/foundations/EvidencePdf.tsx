"use client";
import {useEffect,useRef,useState} from 'react';
/** Local PDF canvas renderer: independent of the browser's PDF plug-in. */
export function EvidencePdf({id}:{id:string}){
 const canvas=useRef<HTMLCanvasElement>(null);const [page,setPage]=useState(1);const [count,setCount]=useState(0);const [error,setError]=useState('');
 useEffect(()=>{let cancelled=false;let dispose:(()=>void)|undefined;
 void import('pdfjs-dist').then(async pdf=>{if(cancelled)return;pdf.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';const task=pdf.getDocument({url:'/api/vault/attachment?id='+encodeURIComponent(id)});dispose=()=>{void task.destroy();};const doc=await task.promise;if(cancelled)return;setCount(doc.numPages);const sheet=await doc.getPage(Math.min(page,doc.numPages));if(cancelled||!canvas.current)return;const viewport=sheet.getViewport({scale:1.7});canvas.current.width=viewport.width;canvas.current.height=viewport.height;await sheet.render({canvas:canvas.current,viewport}).promise;}).catch(e=>{if(!cancelled)setError('Dokument kann nicht dargestellt werden: '+String(e.message||e));});
 return()=>{cancelled=true;dispose?.();};},[id,page]);
 return <div className="evidence-pdf"><nav aria-label="Dokumentseiten"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>← Seite</button><span>{count?`Seite ${page} / ${count}`:'Dokument wird geladen …'}</span><button disabled={!count||page>=count} onClick={()=>setPage(p=>p+1)}>Seite →</button></nav>{error?<p role="alert">{error}</p>:<canvas ref={canvas} aria-label={`Dokumentseite ${page}`} role="img"/>}</div>;
}
