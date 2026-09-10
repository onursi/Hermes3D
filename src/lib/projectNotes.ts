import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {frontmatter,toObject} from '@/features/v2/foundations/model';
import {goalFilename} from '@/features/v2/foundations/goalDraft';
export const PROJECT_STAGES=['idee','entwurf','in-arbeit','abnahme','fertig'] as const;
const conflict=(message:string)=>Object.assign(Error(message),{status:409});
const day=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
function stage(value:unknown):string{if(typeof value!=='string'||!PROJECT_STAGES.includes(value as typeof PROJECT_STAGES[number]))throw Error('Ungültige Projektphase');return value;}
function field(value:unknown,max:number,required=false){if(typeof value!=='string'||value.length>max||(required&&!value.trim())||value.includes('\0'))throw Error('Bitte die Projektangaben prüfen');return value.trim();}
async function projectPath(vault:string,relative:string,exists=true){
 const root=await fs.realpath(vault),base=await fs.realpath(path.join(root,'05 🚀 Projekte'));
 if(!base.startsWith(root+path.sep)||typeof relative!=='string'||!relative.startsWith('05 🚀 Projekte/')||relative.includes('\\')||relative.split('/').some(s=>!s||s==='..'||s.startsWith('.')||s==='Code'||s==='_Assets'))throw Error('Ungültiger Projektpfad');
 const candidate=path.join(root,relative),parent=await fs.realpath(path.dirname(candidate));if(!parent.startsWith(base+path.sep))throw Error('Projekt muss in einem Projektbereich liegen');
 const target=path.join(parent,path.basename(candidate));if(!exists)return target;
 const stat=await fs.lstat(target),real=await fs.realpath(target);if(stat.isSymbolicLink()||!stat.isFile()||!real.startsWith(base+path.sep)||stat.size>1000000||!relative.endsWith('.md'))throw Error('Projektdatei nicht unterstützt');return target;
}
export async function projectFolders(vault:string){const root=await fs.realpath(vault),base=await fs.realpath(path.join(root,'05 🚀 Projekte'));if(!base.startsWith(root+path.sep))throw Error('Projektordner außerhalb');return (await fs.readdir(base,{withFileTypes:true})).filter(e=>e.isDirectory()&&!e.isSymbolicLink()&&!e.name.startsWith('.')&&!e.name.startsWith('00 ')&&!['Code','_Assets'].includes(e.name)).map(e=>'05 🚀 Projekte/'+e.name).sort();}
export async function readProject(vault:string,id:string){const target=await projectPath(vault,id),text=await fs.readFile(target,'utf8');if(toObject(id,text)?.kind!=='project')throw Error('Diese Notiz ist kein Projekt mit dokumentierter Phase');return {path:id,phase:frontmatter(text).phase,revision:digest(text)};}
async function appendLog(vault:string,relative:string,description:string,index=false){const root=await fs.realpath(vault),warnings:string[]=[];const additions=[['02⚙️ System/Log.md',`\n## [${day()}] update | Projekt in Hermes3D bearbeitet\nQuelle/Freigabe: Onurs bestätigte Eingabe. [[${relative.replace(/\.md$/,'')}]]. ${description}\n`],...(index?[['Index.md',`\n- [[${relative.replace(/\.md$/,'')}]] – Projekt in Project Singularity erfasst.\n`]]:[])];for(const [id,text] of additions){try{const full=await fs.realpath(path.join(root,id));if(!full.startsWith(root+path.sep))throw Error('Außerhalb');await fs.appendFile(full,text,'utf8');}catch{warnings.push(id+' konnte nicht ergänzt werden; Projektnotiz ist gespeichert.');}}return warnings;}
export async function createProject(vault:string,input:unknown){
 const d=input as Record<string,unknown>;if(!d||typeof d!=='object')throw Error('Projektangaben fehlen');const title=field(d.title,140,true),goal=field(d.goal,4000),next=field(d.next,2000),folder=field(d.folder,400,true),phase=stage(d.phase);
 if(title.length<3||/[\r\n]/.test(title))throw Error('Projekttitel braucht mindestens drei Zeichen');if(!(await projectFolders(vault)).includes(folder))throw Error('Bitte einen vorhandenen Projektbereich wählen');
 const relative=folder+'/'+goalFilename(title),target=await projectPath(vault,relative,false);const date=day();
 const markdown=['---','status: entwurf','quelle: Direkte bestätigte Eingabe in Hermes3D','erfasst_am: '+date,'zeitbezug: '+date,'sensibilität: persönlich','projekt: '+JSON.stringify(title),'phase: '+phase,'phase_seit: '+date,'---','','## Ziel','',goal||'Ziel noch offen.','','## Aktueller Stand','','In Hermes3D angelegt. Die aktuelle Projektphase steht in den Eigenschaften.','','## Nächste Schritte','',next?'- [ ] '+next.replace(/\r?\n/g,' '):'Nächster Schritt noch offen.','','## Meilensteine','','Noch keine weiteren Meilensteine festgelegt.','','## Projektverlauf','',`- ${new Date().toISOString()} · Angelegt in Phase ${phase}. Bestätigte Eingabe von Onur.`,''].join('\n');
 try{await fs.writeFile(target,markdown,{encoding:'utf8',flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')throw conflict('Hier existiert bereits eine gleichnamige Notiz. Nichts überschrieben.');throw e;}
 return {ok:true,path:relative,phase,revision:digest(markdown),warnings:await appendLog(vault,relative,'Projekt neu angelegt; keine vorhandene Notiz überschrieben.',true)};
}
export async function changeProjectPhase(vault:string,input:unknown){
 const d=input as Record<string,unknown>;if(!d||typeof d!=='object')throw Error('Änderung fehlt');const id=field(d.path,600,true),revision=field(d.revision,64,true),reason=field(d.reason,2000,true),phase=stage(d.phase);if(!/^[a-f0-9]{64}$/.test(revision))throw Error('Aktuellen Projektstand neu laden');
 const target=await projectPath(vault,id),lock=target+'.hermes-lock';let handle;try{handle=await fs.open(lock,'wx');}catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')throw conflict('Projekt wird gerade bearbeitet. Bitte später neu laden.');throw e;}
 try{
 const before=await fs.readFile(target,'utf8');if(digest(before)!==revision)throw conflict('Die Projektnotiz wurde inzwischen geändert. Bitte neu laden.');const fm=frontmatter(before);if(toObject(id,before)?.kind!=='project'||fm.phase==='abgeschlossen')throw Error('Abgeschlossene oder nicht erkannte Projekte werden hier nicht verändert');if(fm.phase===phase)throw Error('Das Projekt befindet sich bereits in dieser Phase');
 const match=/^---\r?\n([\s\S]*?)\r?\n---/.exec(before);if(!match)throw Error('Projekteigenschaften fehlen');let head=match[1];if((head.match(/^phase:/gm)||[]).length!==1||(head.match(/^phase_seit:/gm)||[]).length>1)throw Error('Mehrdeutige Projekteigenschaften bitte zuerst klären');
 const nl=before.includes('\r\n')?'\r\n':'\n';head=head.replace(/^phase:[^\r\n]*/m,'phase: '+phase);if(/^phase_seit:/m.test(head))head=head.replace(/^phase_seit:[^\r\n]*/m,'phase_seit: '+day());else head+=nl+'phase_seit: '+day();
 const after='---'+nl+head+nl+'---'+before.slice(match[0].length)+nl+nl+'### '+new Date().toISOString()+' · Phase '+fm.phase+' → '+phase+nl+nl+'Bestätigte Änderung in Hermes3D. Begründung:'+nl+reason+nl;
 const backupDir=path.join(path.dirname(target),'.hermes-history');await fs.mkdir(backupDir,{recursive:true});if((await fs.lstat(backupDir)).isSymbolicLink())throw Error('Sicherungsverzeichnis nicht unterstützt');const backup=path.join(backupDir,path.basename(target)+'.'+revision+'.md');try{await fs.writeFile(backup,before,{encoding:'utf8',flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
 if(digest(await fs.readFile(target,'utf8'))!==revision)throw conflict('Die Projektnotiz wurde während der Vorbereitung geändert. Bitte neu laden.');const temp=target+'.'+randomUUID()+'.tmp';await fs.writeFile(temp,after,{encoding:'utf8',flag:'wx'});try{await fs.rename(temp,target);}catch(e){await fs.unlink(temp).catch(()=>{});throw e;}
 return {ok:true,path:id,phase,revision:digest(after),warnings:await appendLog(vault,id,`Phase ${fm.phase} → ${phase}; Begründung im Projekt ergänzt und vorherige Fassung lokal gesichert.`)};
 }finally{await handle.close();await fs.unlink(lock);}
}
