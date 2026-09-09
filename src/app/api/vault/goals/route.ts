import {NextResponse} from 'next/server';
import path from 'node:path';import os from 'node:os';
import {createGoalNote} from '@/lib/goalNotes';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 if((req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)||req.headers.get('sec-fetch-site')==='cross-site')return NextResponse.json({ok:false,error:'Fremder Ursprung'},{status:403});
 try{const text=await req.text();if(text.length>24000)throw Error('Zielentwurf zu lang');return NextResponse.json(await createGoalNote(process.env.OBSIDIAN_VAULT_PATH?.trim()||path.join(os.homedir(),'Desktop','Life OS'),JSON.parse(text)));}
 catch(e){const conflict=(e as NodeJS.ErrnoException).code==='EEXIST';return NextResponse.json({ok:false,error:conflict?'Eine Zielnotiz mit diesem Namen existiert bereits. Bitte im Zielkompass prüfen.':e instanceof Error?e.message:'Speichern fehlgeschlagen'},{status:conflict?409:400});}
}
