import {NextResponse} from 'next/server';
import path from 'node:path';import os from 'node:os';
import {listFlows,updateFlow} from '@/lib/flowNotes';
export const dynamic='force-dynamic';
const vault=()=>process.env.OBSIDIAN_VAULT_PATH?.trim()||path.join(os.homedir(),'Desktop','Life OS');
export async function GET(){try{return NextResponse.json(await listFlows(vault()),{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Produktionsabläufe nicht verfügbar'},{status:500});}}
export async function POST(req:Request){if(req.headers.get('origin')!==new URL(req.url).protocol+'//'+req.headers.get('host')||req.headers.get('sec-fetch-site')==='cross-site')return NextResponse.json({error:'Fremder Ursprung'},{status:403});try{const text=await req.text();if(text.length>10000)throw Error('Angaben zu lang');return NextResponse.json(await updateFlow(vault(),JSON.parse(text)));}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Speichern fehlgeschlagen'},{status:(e as {status?:number}).status===409?409:400});}}
