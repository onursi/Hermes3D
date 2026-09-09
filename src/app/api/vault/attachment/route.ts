import fs from 'node:fs/promises';
import path from 'node:path';
import {NextResponse} from 'next/server';
import {resolveNotePath,VAULT_ROOT} from '@/lib/vault/root';
export const dynamic='force-dynamic';
const types:Record<string,string>={'.pdf':'application/pdf','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
export async function GET(request:Request){
 const id=new URL(request.url).searchParams.get('id')||'';const candidate=resolveNotePath(id);
 if(!candidate)return new NextResponse('Ungültiger Belegpfad',{status:400});
 try{const [root,file]=await Promise.all([fs.realpath(VAULT_ROOT),fs.realpath(candidate)]);if(!file.startsWith(root+path.sep)||!types[path.extname(file).toLowerCase()])return new NextResponse('Format oder Pfad nicht freigegeben',{status:400});const stat=await fs.stat(file);if(!stat.isFile()||stat.size>50*1024*1024)return new NextResponse('Beleg zu groß oder keine Datei',{status:413});return new NextResponse(await fs.readFile(file),{headers:{'Content-Type':types[path.extname(file).toLowerCase()],'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});}catch{return new NextResponse('Beleg nicht gefunden',{status:404});}
}
