import {NextResponse} from 'next/server';
import {routineSignals} from '@/features/v2/foundations/horizonRoutines';
export const dynamic='force-dynamic';
let cached:{until:number;body:unknown}|undefined;
export async function GET(){
 const token=process.env.TODOIST_API_TOKEN?.trim();if(!token)return NextResponse.json({connected:false,signals:[],reason:'Todoist nicht verbunden'});
 if(cached&&cached.until>Date.now())return NextResponse.json(cached.body);
 const now=new Date();const since=new Date(now.getTime()-7*86400000).toISOString();
 try{
 async function pages(path:string){const out:{content:string;completed_at?:string|null}[]=[];let cursor:string|null=null;for(let i=0;i<20;i++){const url=new URL('https://api.todoist.com/api/v1'+path);url.searchParams.set('limit','200');if(cursor)url.searchParams.set('cursor',cursor);const res=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(12000)});if(!res.ok)throw Error('Todoist-Erledigungen derzeit nicht abrufbar ('+res.status+')');const data=await res.json();const entries=data.items??data.results;if(!Array.isArray(entries))throw Error('Todoist-Antwort nicht auswertbar');out.push(...entries);cursor=data.next_cursor??null;if(!cursor)return out;}throw Error('Todoist-Daten unvollständig; keine Lichtbewertung');}
 const [open,completed]=await Promise.all([pages('/tasks'),pages('/tasks/completed/by_completion_date?since='+encodeURIComponent(since)+'&until='+encodeURIComponent(now.toISOString()))]);const body={connected:true,signals:routineSignals(open,completed,now),checkedAt:now.toISOString()};cached={until:Date.now()+60000,body};return NextResponse.json(body);
 }catch(e){return NextResponse.json({connected:false,signals:[],reason:e instanceof Error?e.message:'Todoist nicht erreichbar'});}
}
