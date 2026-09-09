import type {WorldObject} from './model';
export type Point=[number,number,number];
export const DIRECTIONS=[
 {id:'beruflich',label:'Beruf',color:'#ffd397',center:[-26,9,-7] as Point},
 {id:'lernen',label:'Lernen',color:'#92c8ff',center:[-24,-9,8] as Point},
 {id:'familiär',label:'Familie',color:'#9de9d2',center:[0,20,-12] as Point},
 {id:'gesundheit',label:'Gesundheit',color:'#ffb5ac',center:[27,10,-6] as Point},
 {id:'spirituell',label:'Spiritualität',color:'#d6b5ff',center:[24,-10,7] as Point},
];
export function stableSeed(id:string){let hash=2166136261;for(const c of id)hash=Math.imul(hash^c.charCodeAt(0),16777619);return (hash>>>0)/4294967296;}
/** A year means its end, a month its last day. Unknown dates never get a fake deadline. */
export function horizonBand(due:string|undefined,now=new Date()):number|null{
 if(!due||!/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(due))return null;
 const [y,m,d]=due.split('-').map(Number);
 if(m&&(m<1||m>12))return null;
 const date=new Date(Date.UTC(y,m===undefined?12:d===undefined?m:m-1,d??0));
 if(d&&(d<1||date.getUTCMonth()!==m-1))return null;
 const months=(date.getTime()-now.getTime())/2629800000;
 return months<=3?0:months<=12?1:months<=36?2:3;
}
export const BAND_LABELS=['bis 3 Monate','3–12 Monate','1–3 Jahre','über 3 Jahre'];
export function goalPosition(goal:WorldObject,now=new Date()):Point{
 const direction=DIRECTIONS.find(d=>goal.groups.includes(d.id));
 const seed=stableSeed(goal.id),a=seed*Math.PI*2,band=horizonBand(goal.due,now);
 const c=direction?.center??[0,-22,8];
 return [c[0]*1.9+Math.cos(a)*14,c[1]*1.5+Math.sin(a)*10,-28-(band===null?22:band*32)-stableSeed(goal.id+'depth')*12];
}
export function nextMilestone(goal:WorldObject){return goal.milestones.findIndex(m=>!m.done);}
export function pathPosition(index:number,count:number):Point{
 const t=count<=1?.5:index/(count-1);
 return [Math.sin(t*Math.PI*1.5-.6)*6,Math.sin(t*Math.PI)*1.4,-t*32+12];
}
export function goalColor(goal:WorldObject){return DIRECTIONS.find(d=>goal.groups.includes(d.id))?.color??'#d6dce8';}
export function goalStatus(goal:WorldObject){
 if(goal.state==='zurueckgestellt')return 'Bewusst zurückgestellt';
 if(goal.state==='verworfen')return 'Verworfen · Teil deiner Geschichte';
 if(goal.state==='erreicht')return 'Als erreicht dokumentiert';
 if(goal.waiting==='andere')return 'Andere sind am Zug';
 if(goal.state==='unklar')return 'Klärung offen';
 if(goal.state==='unterversorgt')return 'Als unterversorgt dokumentiert';
 return 'Aktives Ziel';
}

/** Explicit dependencies may point backwards only: no cycles, no invented parallelism. */
export function goalPath(goal:WorldObject){
 const steps=goal.milestones;const levels:number[]=[];
 const edges=steps.map((m,i)=>{const parents=m.after===undefined?(i?[i-1]:[]):[...new Set(m.after)].filter(n=>Number.isInteger(n)&&n>=0&&n<i);levels[i]=parents.length?Math.max(...parents.map(n=>levels[n]))+1:0;return parents;});
 const current=nextMilestone(goal);const base=levels[current<0?Math.max(0,steps.length-1):current]??0;
 const points=steps.map((_,i)=>{const peers=levels.flatMap((v,k)=>v===levels[i]?[k]:[]);const lane=peers.indexOf(i)-(peers.length-1)/2;return [lane*16+Math.sin(levels[i]*.8)*3,Math.sin(levels[i]*.7)*1.5,-(levels[i]-base)*24] as Point;});
 return {points,edges,branched:steps.some(m=>m.after!==undefined),goal:[0,5,-((Math.max(0,...levels)-base)+1.6)*24] as Point};
}
