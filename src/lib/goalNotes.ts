import fs from 'node:fs/promises';
import path from 'node:path';
import {frontmatter} from '@/features/v2/foundations/model';
import {goalFilename,goalMarkdown,validateGoalDraft} from '@/features/v2/foundations/goalDraft';
export async function createGoalNote(vault:string,input:unknown){
 const draft=validateGoalDraft(input),root=await fs.realpath(vault);const within=(p:string)=>p.startsWith(root+path.sep);
 const dir=await fs.realpath(path.join(root,'03🪪 Identität/Ziele'));if(!within(dir))throw Error('Zielordner außerhalb des Vaults');
 for(const ref of draft.links){if(!ref.endsWith('.md')||ref.includes(']]')||path.isAbsolute(ref)||ref.split(/[\\/]/).includes('..'))throw Error('Ungültiger Quellverweis');const real=await fs.realpath(path.join(root,ref));if(!within(real)||(await fs.stat(real)).isDirectory())throw Error('Quelle nicht verfügbar');}
 const normalize=(s:string)=>s.normalize('NFKC').trim().toLocaleLowerCase('de');for(const entry of await fs.readdir(dir,{withFileTypes:true})){if(!entry.isFile()||entry.isSymbolicLink()||!entry.name.endsWith('.md'))continue;const file=path.join(dir,entry.name);if((await fs.stat(file)).size>1000000)continue;const existing=frontmatter(await fs.readFile(file,'utf8')).ziel;if(existing&&normalize(existing)===normalize(draft.title))throw Object.assign(Error('Ziel bereits vorhanden'),{code:'EEXIST'});}
 const filename=goalFilename(draft.title),relative='03🪪 Identität/Ziele/'+filename;const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const markdown=goalMarkdown(draft,day);
 // Exclusive creation: an existing personal note can never be overwritten.
 await fs.writeFile(path.join(dir,filename),markdown,{encoding:'utf8',flag:'wx'});
 const warnings:string[]=[];for(const [ref,text] of [['Index.md','\n- [['+relative.replace(/\.md$/,'')+']] – Ziel in Goal Horizon erfasst.\n'],['02⚙️ System/Log.md','\n## ['+day+'] update | Ziel in Hermes3D erfasst\nQuelle/Freigabe: Onurs bestätigte Eingabe. [['+relative.replace(/\.md$/,'')+']]. Zielnotiz neu angelegt; Handlungen und Verknüpfungen in derselben Quelle, offene Angaben nicht erfunden.\n']]){try{const real=await fs.realpath(path.join(root,ref));if(!within(real))throw Error('Pfad außerhalb');await fs.appendFile(real,text,'utf8');}catch{warnings.push(ref+' konnte nicht ergänzt werden; Zielnotiz ist gespeichert.');}}
 return {ok:true,path:relative,markdown,warnings};
}
