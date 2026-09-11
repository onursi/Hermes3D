export const FLOW_STATES = {offen:'Offen', 'in-arbeit':'In Arbeit', pruefen:'Zur Prüfung', fertig:'Bestätigt', blockiert:'Blockiert'};
export type FlowState = keyof typeof FLOW_STATES;
export type FlowFile = {id:string; label:string; exists:boolean; size?:number; type:string; url:string};
export type FlowStage = {id:string; title:string; description:string; next:string; status:FlowState; files:FlowFile[]};
export type FlowWorkspaceData = {project:string; title:string; revision:string; stages:FlowStage[]; history:{at:string; stage:string; from:FlowState; to:FlowState; reason:string}[]};
export const flowSelection = (project:string,stage:string) => 'flow:'+encodeURIComponent(project)+'#'+stage;
export function selectedFlow(id:string|null){if(!id?.startsWith('flow:'))return null;const [project,stage]=id.slice(5).split('#');try{return {project:decodeURIComponent(project),stage};}catch{return null;}}
export const flowPosition=(index:number,total:number):[number,number,number]=>{const a=index/Math.max(1,total)*Math.PI*2-.9;return [Math.cos(a)*13,2+Math.sin(a*2)*2,Math.sin(a)*10];};
