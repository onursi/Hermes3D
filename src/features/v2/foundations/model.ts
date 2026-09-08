export type WorldKind="goal"|"project"|"idea";
export type WorldObject={id:string;kind:WorldKind;title:string;path:string;state:string;parent?:string;links:string[];groups:string[];due?:string;waiting?:string;importance?:string;proof?:string;measure?:string;cadence?:string;pauseReason?:string;milestones:{title:string;done:boolean;date?:string;status?:string}[];summary?:string;current?:string;nextTodo?:string;nextHeading?:string;flowAccess?:boolean};
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
 const milestones=milestoneBlock.split(/\r?\n/).filter(line=>/^\|\s*\d+\s*\|/.test(line)).map(line=>{const cells=line.split('|');return{title:cells[2]?.trim()??"",done:line.includes('✅'),date:cells[3]?.trim(),status:cells[4]?.trim()};});
 const title=fm.ziel||path.split('/').pop()!.replace(/\.md$/,'');
 const sections=[...text.matchAll(/^## (.+)\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
 const plain=(s:string)=>s.replace(/```[\s\S]*?```/g,'').replace(/<[^>]*>/g,'').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g,'$2').replace(/\[\[([^\]]+)\]\]/g,'$1').replace(/[*_#]/g,'').trim();
 const summary=sections.find(s=>/^(Ziel|Zweck|Kurzbeschreibung|Ausgangslage)/i.test(s[1]));
 const current=sections.find(s=>/^(Aktueller Stand|Ist-Stand|Stand |Update )/i.test(s[1]));
 const next=sections.find(s=>/^(Nächste Schritte|Nächstes Todo|Offene Punkte)/i.test(s[1]));
 const nextLine=next?.[2].split(/\r?\n/).find(line=>/^\s*(?:- \[ \]|[-*]|\d+\.)\s+/.test(line)&&! /~~|\[[xX]\]|erledigt|abgeschlossen/i.test(line));
 return {id:path,kind:goal?"goal":"project",path,title,state:goal?fm.zustand||"unklar":fm.phase,parent:linkIds(fm.gehoert_zu||'')[0],links:[...new Set(linkIds(goal?text:fm.zahlt_ein_auf||''))].filter(id=>id!==path),groups:(fm.sternbild||'').replace(/[\[\]"']/g,'').split(',').map(s=>s.trim()).filter(Boolean),importance:fm.bedeutung,proof:fm.nachweis,measure:fm.messgroesse,cadence:fm.vorgabe,pauseReason:fm.zurueckgestellt_wegen,due:fm.frist,waiting:fm.am_zug,milestones,summary:summary?plain(summary[2]).slice(0,700):undefined,current:current?current[1]+' · '+plain(current[2]).slice(0,460):undefined,nextTodo:nextLine?plain(nextLine).replace(/^[-\d.\s]+/,'').replace(/^\[ \]\s*/,''):undefined,nextHeading:next?.[1],flowAccess:/workflow|automation|pipeline|automatis/i.test(title)};
}
export function projectRadius(state:string){const i=PHASES.indexOf(state);return i<0?44:44-Math.min(i,4)*6;}
export function ideaObjects(path:string,text:string):WorldObject[]{const open=text.split('## Offene Ideen')[1]?.split('## Verworfene Ideen')[0]||'';return [...open.matchAll(/^### (.+)$/gm)].map(m=>({id:path+'#'+m[1].trim(),kind:'idea',path,title:m[1].trim(),state:'offen',links:[],groups:[],milestones:[]}));}
