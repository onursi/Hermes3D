import type {WorldObject} from './model';
export const HORIZON_ROUTINES=[{name:'5 Gebete praktizieren',sector:'spirituell'},{name:'Esma-ül Hüsna lernen',sector:'spirituell'},{name:'Meds & Supps',sector:'gesundheit'},{name:'Journaling',sector:null},{name:'Achtsamkeit und Bewusstsein',sector:null}] as const;
export type RoutineSignal={name:string;sector:string|null;found:boolean;doneToday:boolean;days:number};
export const normalizeRoutine=(s:string)=>s.normalize('NFKC').trim().toLocaleLowerCase('de').replace(/\s+/g,' ');
const TASK_ALIASES:Record<string,string[]>={'Meds & Supps':['Meds & Supps 💊'],'Achtsamkeit und Bewusstsein':['Achtsamkeit & Bewusstsein']};
const matchesRoutine=(content:string,name:string)=>[name,...(TASK_ALIASES[name]??[])].some(alias=>normalizeRoutine(content)===normalizeRoutine(alias));
export const berlinDay=(s:string)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s));
export function routineSignals(open:{content:string}[],completed:{content:string;completed_at?:string|null}[],now=new Date()){
 const today=berlinDay(now.toISOString());return HORIZON_ROUTINES.map(r=>{const matches=completed.filter(t=>matchesRoutine(t.content,r.name)&&t.completed_at&&!Number.isNaN(Date.parse(t.completed_at)));const days=new Set(matches.map(t=>berlinDay(t.completed_at!)));return {...r,found:open.some(t=>matchesRoutine(t.content,r.name))||matches.length>0,doneToday:days.has(today),days:days.size};});
}

export function routineDirections(r:RoutineSignal,goals:WorldObject[]){const linked=goals.filter(g=>g.kind==='goal'&&g.actions?.includes(r.name));return linked.length?[...new Set(linked.flatMap(g=>g.groups))]:r.sector?[r.sector]:[];}
