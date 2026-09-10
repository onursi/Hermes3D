export type RecognitionResult = {isFinal:boolean; 0:{transcript:string}};
export type Recognition = {
 lang:string; continuous:boolean; interimResults:boolean;
 start:()=>void; abort:()=>void;
 onresult:((event:{results:ArrayLike<RecognitionResult>})=>void)|null;
 onerror:((event:{error:string})=>void)|null;
 onend:(()=>void)|null; onstart:(()=>void)|null; onspeechstart:(()=>void)|null;
};
/** Own exactly one recognition session; late events after stop are ignored. */
export function createOpenMicSession(rec:Recognition, callbacks:{text:(text:string)=>void; status:(active:boolean,message:string)=>void; interrupt:()=>void}) {
 let active=true;
 const stop=(message='Mikrofon aus · Entwurf bleibt erhalten')=>{
  if(!active)return; active=false;
  rec.onresult=null;rec.onerror=null;rec.onend=null;rec.onstart=null;rec.onspeechstart=null;
  try{rec.abort();}catch{/* Already stopped by browser. */}
  callbacks.status(false,message);
 };
 rec.lang='de-DE';rec.continuous=true;rec.interimResults=true;
 rec.onstart=()=>{if(active)callbacks.status(true,'Open Mic aktiv · Text wird als Entwurf gesammelt');};
 rec.onspeechstart=()=>{if(active)callbacks.interrupt();};
 rec.onresult=event=>{
  if(!active)return;
  const parts=Array.from(event.results,result=>result[0]?.transcript?.trim()||'').filter(Boolean);
  callbacks.interrupt();callbacks.text(parts.join(' '));
 };
 rec.onerror=event=>stop(event.error==='not-allowed'||event.error==='service-not-allowed'?'Mikrofon oder Spracherkennung nicht freigegeben. Texteingabe bleibt möglich.':`Spracherkennung beendet (${event.error}). Entwurf bleibt erhalten.`);
 rec.onend=()=>stop('Aufnahme beendet · Entwurf prüfen oder Open Mic erneut starten');
 try{rec.start();}catch{stop('Mikrofon konnte nicht gestartet werden. Texteingabe bleibt möglich.');}
 return {stop,get active(){return active;}};
}
