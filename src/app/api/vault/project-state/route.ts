import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { NextResponse } from "next/server";
import { EMPTY_META, type ProjectMeta } from "@/features/v2/spatial/model";

const ROOT=path.join(process.env.OBSIDIAN_VAULT_PATH?.trim() || path.join(os.homedir(),"Desktop","Life OS"),"05 🚀 Projekte");
const FILE="Hermes3D Projektstatus.md";
const MARKER="<!-- hermes-project-state-v1 -->";
async function directory(folder:string){
 if(!folder || folder!==path.basename(folder) || /[\\/]/.test(folder) || folder.startsWith('.'))throw Error("Ungültiges Projekt");
 const root=await fs.realpath(ROOT);const dir=await fs.realpath(path.join(root,folder));
 if(!dir.startsWith(root+path.sep) || !(await fs.stat(dir)).isDirectory())throw Error("Projekt nicht verfügbar");
 return dir;
}
async function read(dir:string):Promise<{meta:ProjectMeta;content:string}>{
 const dest=path.join(dir,FILE);
 let content:string;
 try { const stat=await fs.lstat(dest);if(stat.isSymbolicLink() || !stat.isFile() || stat.size>1024*1024)throw Error("Statusdatei nicht unterstützt");content=await fs.readFile(dest,"utf8"); }
 catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {meta:{...EMPTY_META},content:""};throw e;}
 if(!content.includes(MARKER))throw Error("Bestehende Datei gehört nicht zu diesem Statusformat");
 const encoded=/<!-- state:([^\n]+) -->/.exec(content)?.[1];
 if(!encoded)throw Error("Statusdaten fehlen");
 return {meta:JSON.parse(Buffer.from(encoded,"base64").toString("utf8")),content};
}
export async function GET(){
 try{const entries=await fs.readdir(ROOT,{withFileTypes:true});const states:Record<string,ProjectMeta>={};
 for(const entry of entries){if(!entry.isDirectory() || entry.name.startsWith('.'))continue;try{const result=await read(await directory(entry.name));if(result.content)states[entry.name]=result.meta;}catch{/* An unreadable record never becomes a made-up status. */}}
 return NextResponse.json({ok:true,states});
 }catch{return NextResponse.json({ok:false,states:{}},{status:503});}
}
export async function POST(request:Request){
 if(request.headers.get("origin") && request.headers.get("origin")!==new URL(request.url).origin)return NextResponse.json({ok:false,error:"Fremder Ursprung"},{status:403});
 try{
 const data=await request.json();const {folder,goal,disposition,reviewAt,note}=data;
 if(typeof folder!=="string" || typeof goal!=="string" || goal.length>500 || !["active","paused","waiting","completed"].includes(disposition) || typeof note!=="string" || !note.trim() || note.length>3000 || (reviewAt && !/^\d{4}-\d{2}-\d{2}$/.test(reviewAt)))throw Error("Ziel, Entscheidung und gültigen Zustand angeben");
 if (reviewAt && (typeof reviewAt!=="string" || !Number.isFinite(Date.parse(reviewAt)) || new Date(reviewAt).toISOString().slice(0,10)!==reviewAt)) throw Error("Ungültiges Datum");
 const dir=await directory(folder);const lock=path.join(dir,'.hermes-project-state.lock');
 const handle=await fs.open(lock,'wx');
 try{
 const old=await read(dir);const stamp=new Date().toISOString();
 const meta:ProjectMeta={goal:goal.trim(),disposition,activity:stamp,reviewAt:reviewAt||null,note:note.trim()};
 const state=Buffer.from(JSON.stringify(meta)).toString('base64');
 const head=`---\nstatus: geprüft\nquelle: Direkte Eingabe in Hermes3D\nerfasst_am: ${stamp.slice(0,10)}\nzeitbezug: ${stamp.slice(0,10)}\nsensibilität: persönlich\n---\n${MARKER}\n<!-- state:${state} -->\n`;
 const history=old.content?old.content.slice(old.content.indexOf('## Verlauf')):'## Verlauf\n';
 const content=head+'\n'+history+`\n### ${stamp} · ${disposition}\n\nZiel: ${meta.goal||'Noch offen'}\n\nWiedervorlage: ${meta.reviewAt||'Keine'}\n\n${meta.note}\n`;
 const temp=path.join(dir,`.hermes-state-${crypto.randomUUID()}.tmp`);
 await fs.writeFile(temp,content,{encoding:'utf8',flag:'wx'});await fs.rename(temp,path.join(dir,FILE));
 return NextResponse.json({ok:true,meta,path:`05 🚀 Projekte/${folder}/${FILE}`});
 }finally{await handle.close();await fs.unlink(lock);}
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:"Speichern fehlgeschlagen"},{status:400});}
}
