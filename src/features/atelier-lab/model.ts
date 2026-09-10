export const ORIGINS=['gesehen','Gespräch','Erinnerung','Problem','anderes Projekt','spontane Idee'] as const;
export type Impulse={position?:[number,number,number];evidence?:{path:string;name:string;note:string}[];id:string;raw:string;origin:string;originKind?:string;tags:string[];example:boolean;created:string;answer:string;question:string;clear:boolean;resting:boolean};
export type Link={id:string;a:string;b:string;status:'candidate'|'confirmed'|'rejected';reason:string};
export type Entry={id:string;at:string;action:string;subject:string;detail:string};
export type Lab={version:1;impulses:Impulse[];links:Link[];events:Entry[]};
export const STORAGE='hermes-atelier-isolated-v1';
export const emptyLab=():Lab=>({version:1,impulses:[],links:[],events:[]});
export const pairId=(a:string,b:string)=>[a,b].sort().join('::');
export const tagsFrom=(s:string)=>[...new Set(s.split(',').map(t=>t.trim().toLocaleLowerCase('de')).filter(Boolean))].slice(0,12);
export function candidates(lab:Lab,id:string):Link[]{
 const from=lab.impulses.find(i=>i.id===id);if(!from)return [];
 return lab.impulses.filter(i=>i.id!==id&&!i.resting).flatMap(to=>{
  const common=from.tags.filter(t=>to.tags.includes(t));const edge=pairId(id,to.id);
  if(!common.length||lab.links.some(l=>l.id===edge))return [];
  return [{id:edge,a:id,b:to.id,status:'candidate' as const,reason:`Gemeinsame Stichwörter: ${common.join(', ')}. Eine mögliche Beziehung, noch nicht bestätigt.`}];
 });
}
export function formOf(lab:Lab,id:string){
 const i=lab.impulses.find(n=>n.id===id);if(!i)return 'Impuls';
 if(i.clear)return 'Klare Idee';if(i.answer.trim())return 'Silhouette';
 return lab.links.some(l=>l.status==='confirmed'&&(l.a===id||l.b===id))?'Gedankenwolke':'Impuls';
}
export const validPosition=(p:unknown):p is [number,number,number]=>Array.isArray(p)&&p.length===3&&p.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=120);
export function moveImpulse(lab:Lab,id:string,position:[number,number,number]):Lab{if(!validPosition(position))throw Error('Ungültige Raumposition.');return {...lab,impulses:lab.impulses.map(i=>i.id===id?{...i,position:[...position] as [number,number,number]}:i)};}
export function parseLab(raw:string):Lab{
 const x=JSON.parse(raw);const str=(s:unknown)=>typeof s==='string'&&s.length<=20000;
 if(!x||x.version!==1||!Array.isArray(x.impulses)||!Array.isArray(x.links)||!Array.isArray(x.events)||x.impulses.length>300||x.links.length>10000||x.events.length>20000)throw Error('Keine unterstützte Atelier-Testdatei.');
 if(!x.impulses.every((i:Impulse)=>i&&(i.position===undefined||validPosition(i.position))&&[i.id,i.raw,i.origin,i.created,i.answer,i.question].every(str)&&(i.originKind===undefined||ORIGINS.includes(i.originKind as typeof ORIGINS[number]))&&Array.isArray(i.tags)&&i.tags.length<=12&&i.tags.every(str)&&(i.evidence===undefined||(Array.isArray(i.evidence)&&i.evidence.length<=30&&i.evidence.every(e=>e&&str(e.name)&&str(e.path)&&str(e.note)&&e.path.startsWith('00📥Inbox/Hermes Impulsbelege/')&&!e.path.includes('..'))))&&typeof i.clear==='boolean'&&typeof i.resting==='boolean'&&typeof i.example==='boolean'))throw Error('Ungültige Impulsdaten.');
 const ids=new Set(x.impulses.map((i:Impulse)=>i.id));if(ids.size!==x.impulses.length)throw Error('Doppelte Impuls-IDs.');
 if(!x.links.every((l:Link)=>l&&str(l.id)&&str(l.reason)&&ids.has(l.a)&&ids.has(l.b)&&l.a!==l.b&&l.id===pairId(l.a,l.b)&&['candidate','confirmed','rejected'].includes(l.status)))throw Error('Ungültige Verbindungen.');
 if(new Set(x.links.map((l:Link)=>l.id)).size!==x.links.length)throw Error('Doppelte Verbindungen.');
 if(!x.events.every((e:Entry)=>e&&[e.id,e.at,e.action,e.subject,e.detail].every(str)))throw Error('Ungültige Historie.');
 return x;
}
export function withEvent(lab:Lab,action:string,subject:string,detail:string):Lab{return {...lab,events:[...lab.events,{id:crypto.randomUUID(),at:new Date().toISOString(),action,subject,detail}]};}
export function demoImpulses():Impulse[]{return [
 ['Technische Hermes3D-Dokumentation?','CAD-Atlas erinnert an die Technikerschule','hermes, dokumentation, technik'],
 ['Eigene Fähigkeiten sichtbar machen','Möglicher Portfolio-Gedanke','technik, portfolio, bewerbung'],
 ['Eine Seite öffentlich zeigen','Mögliches kleines Experiment','dokumentation, portfolio'],
 ['Hermes als Lernjournal','Alternative Richtung zum selben Ausgangspunkt','hermes, dokumentation, lernen'],
 ['Wissen räumlich erklären','Freies Anschauungsbeispiel','lernen, räume'],
 ['Ein stiller Ort zum Nachdenken','Unverbundener Beispielimpuls darf bestehen bleiben','ruhe, räume'],
 ].map(([raw,origin,tags],i)=>({id:'demo-'+i,raw,origin,tags:tagsFrom(tags),example:true,created:new Date().toISOString(),answer:'',question:'Was könnte daraus werden — und was bleibt noch offen?',clear:false,resting:false}));}

export function connectionBenefit(a:Impulse,b:Impulse):string {
 if(a.originKind==='Problem'||b.originKind==='Problem')return 'Prüffrage: Könnte der andere Gedanke einen Lösungsansatz oder einen kleinen Test für dieses Problem liefern?';
 if(a.originKind==='anderes Projekt'||b.originKind==='anderes Projekt')return 'Prüffrage: Lassen sich Erfahrungen oder Bausteine aus dem anderen Projekt wiederverwenden?';
 if(a.originKind&&b.originKind&&a.originKind!==b.originKind)return `Prüffrage: Was wird sichtbar, wenn du ${a.originKind} und ${b.originKind} zusammen betrachtest?`;
 return 'Prüffrage: Können diese Gedanken sich ergänzen, eine offene Frage klären oder einen gemeinsamen kleinen Versuch ermöglichen?';
}
