export type WorldKind="goal"|"project"|"idea";
export type WorldObject={id:string;kind:WorldKind;title:string;path:string;state:string;parent?:string;links:string[];groups:string[];due?:string;waiting?:string;milestones:{title:string;done:boolean}[]};
export const PHASES=["idee","entwurf","in-arbeit","abnahme","fertig","abgeschlossen"];
export function frontmatter(text:string):Record<string,string>{
 const result:Record<string,string>={};const head=/^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];if(!head)return result;
 for(const line of head.split(/\r?\n/)){const match=/^([a-z_]+):\s*(.*?)\s*$/.exec(line);if(match)result[match[1]]=match[2].replace(/^['"]|['"]$/g,"");}return result;
}
export function linkIds(text:string){return [...text.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)].map(m=>m[1].replace(/\.md$/,"")+".md");}
export function toObject(path:string,text:string):WorldObject|null{
 const fm=frontmatter(text);const goal=path.startsWith("03🪪 Identität/Ziele/")&&!!fm.ziel;
 if(!goal&&!PHASES.includes(fm.phase))return null;
 const milestoneBlock=text.split(/^## Meilensteine[^\n]*$/m)[1]?.split(/^## /m)[0]||'';
 const milestones=milestoneBlock.split(/\r?\n/).filter(line=>/^\|\s*\d+\s*\|/.test(line)).map(line=>{const cells=line.split('|');return{title:cells[2]?.trim()??"",done:line.includes('✅')};});
 return {id:path,kind:goal?"goal":"project",path,title:fm.ziel||path.split('/').pop()!.replace(/\.md$/,''),state:goal?fm.zustand||"unklar":fm.phase,parent:linkIds(fm.gehoert_zu||'')[0],links:linkIds(fm.zahlt_ein_auf||''),groups:(fm.sternbild||'').replace(/[\[\]"']/g,'').split(',').map(s=>s.trim()).filter(Boolean),due:fm.frist,waiting:fm.am_zug,milestones};
}
export function projectRadius(state:string){const i=PHASES.indexOf(state);return i<0?36:36-Math.min(i,4)*5.5;}
export function ideaObjects(path:string,text:string):WorldObject[]{const open=text.split('## Offene Ideen')[1]?.split('## Verworfene Ideen')[0]||'';return [...open.matchAll(/^### (.+)$/gm)].map(m=>({id:path+'#'+m[1].trim(),kind:'idea',path,title:m[1].trim(),state:'offen',links:[],groups:[],milestones:[]}));}
