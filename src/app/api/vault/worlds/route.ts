import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {NextResponse} from "next/server";
import {toObject,ideaObjects,type WorldObject} from "@/features/v2/foundations/model";
export const dynamic="force-dynamic";
export async function GET(){
 try{
  const root=await fs.realpath(process.env.OBSIDIAN_VAULT_PATH?.trim()||path.join(os.homedir(),'Desktop','Life OS'));
  const objects:WorldObject[]=[];const issues:string[]=[];
  async function walk(relative:string,depth=0){
   if(depth>6)return;
   let entries;try{entries=await fs.readdir(path.join(root,relative),{withFileTypes:true});}catch{issues.push(relative+' nicht lesbar');return;}
   for(const entry of entries){if(entry.isSymbolicLink()||entry.name.startsWith('.')||entry.name==='Code'||entry.name==='_Assets')continue;
    const rel=relative+'/'+entry.name;const full=await fs.realpath(path.join(root,rel));if(!full.startsWith(root+path.sep))continue;
    if(entry.isDirectory()){await walk(rel,depth+1);continue;}
    if(!entry.isFile()||!entry.name.endsWith('.md')||(await fs.stat(full)).size>1000000)continue;
    const object=toObject(rel,await fs.readFile(full,'utf8'));if(object)objects.push(object);
   }
  }
  await walk('03🪪 Identität/Ziele');await walk('05 🚀 Projekte');
  const ideas='09🅿️Ideenparkplatz/Ideen.md';try{const full=await fs.realpath(path.join(root,ideas));if(full.startsWith(root+path.sep))objects.push(...ideaObjects(ideas,await fs.readFile(full,'utf8')));}catch{issues.push('Ideenquelle nicht lesbar');}
  return NextResponse.json({objects,issues},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({objects:[],issues:['LifeOS nicht erreichbar']},{status:503});}
}
