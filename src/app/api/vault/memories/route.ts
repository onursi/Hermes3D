import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { NextResponse } from "next/server";
export async function GET(){
 const relative="02⚙️ System/Tagesrückblicke";
 const root=process.env.OBSIDIAN_VAULT_PATH?.trim()||path.join(os.homedir(),"Desktop","Life OS");
 try{const entries=await fs.readdir(path.join(root,relative),{withFileTypes:true});
 const memories=entries.filter(e=>e.isFile() && /^\d{4}-\d{2}-\d{2}\.md$/.test(e.name)).sort((a,b)=>b.name.localeCompare(a.name)).slice(0,32).map(e=>({id:`${relative}/${e.name}`,path:`${relative}/${e.name}`,title:"Tagesrückblick",date:e.name.slice(0,10),phase:"Gegenwart",kind:"note"}));
 return NextResponse.json({ok:true,memories});
 }catch{return NextResponse.json({ok:false,memories:[]},{status:503});}
}
