export type Phase='briefing'|'retrieving'|'positioning'|'debating'|'decision'|'paused'|'completed';
export type CouncilEvent={id:string;sessionId:string;seq:number;revision:number;type:'phase'|'claim'|'challenge'|'synthesis'|'action';text:string;participant?:string;target?:string;source?:string};
export type CouncilState={id:string;revision:number;phase:Phase;mode:'demo'|'live'|'replay';events:CouncilEvent[];mission:string;source:string;testTask?:{id:string;payload:string};applied:number;approval:string|null};
export const ROLES=[
 {id:'hermes',name:'Jarvis // Hermes',role:'Moderation · LifeOS-Kontext · Hauptsicht',color:'#82d8ed',provider:'openai-codex'},
 {id:'gemini',name:'Gemini',role:'Unabhängige Gegenprüfung',color:'#edbb83',provider:'gemini'},
 {id:'astra',name:'Astra',role:'Strategische Codex-Perspektive',color:'#c3a8ee',provider:'openai-codex'},
];
export function initialCouncil(id:string,mission:string,source:string,revision=1,mode:'demo'|'live'='demo'):CouncilState{return {id,mission,source,revision,phase:'briefing',mode,events:[],applied:0,approval:null};}
export function reduceCouncil(state:CouncilState,event:CouncilEvent):CouncilState{
 if(event.sessionId!==state.id||event.revision!==state.revision||event.seq!==state.events.length+1||state.events.some(e=>e.id===event.id))return state;
 if(event.type==='challenge'&&!state.events.some(e=>e.type==='claim'&&e.id===event.target))return state;
 const phases:Phase[]=['briefing','retrieving','positioning','debating','decision','paused','completed'];
 const phase=event.type==='phase'&&phases.includes(event.text as Phase)?event.text as Phase:event.type==='synthesis'?'decision':state.phase;
 return {...state,phase,events:[...state.events,event]};
}
export function demoSequence(s:CouncilState):CouncilEvent[]{
 const events:Omit<CouncilEvent,'id'|'seq'|'sessionId'|'revision'>[]=[
  {type:'phase',text:'retrieving'},
  {type:'claim',participant:'hermes',source:'brief',text:s.source?'Die ausgewählte Quelle ist das eingegebene Testbriefing. Es wird unverändert im Quellenring angezeigt.':'Es wurde keine Quelle eingegeben. Eine belastbare Sachprüfung ist deshalb nicht möglich.'},
  {type:'phase',text:'positioning'},
  {type:'claim',participant:'hermes',text:'Demo-Vorschlag: Die Frage zunächst mit einem kleinen, reversiblen Versuch bearbeiten. Das ist ein Ablaufbeispiel, keine KI-Antwort auf deine Frage.'},
  {type:'phase',text:'debating'},
  {type:'challenge',participant:'gemini',target:s.id+':4',text:'Offener Einwand: Erfolgskriterium und Aufwand des Versuchs fehlen. Ohne diese Angaben kann ich den Vorschlag nicht bestätigen.'},
  {type:'claim',participant:'astra',text:'Strategische Ergänzung: Lege vor dem Versuch fest, welche Beobachtung die Idee widerlegen würde.'},
  {type:'synthesis',participant:'hermes',text:'Der kleine Versuch bleibt ein Vorschlag. Kläre zuerst Erfolgskriterium, Aufwand und Abbruchkriterium; der Einwand bleibt offen.'},
 ];return events.map((e,i)=>({...e,id:s.id+':'+(i+1),seq:i+1,sessionId:s.id,revision:s.revision}));
}
export function actionPayload(s:CouncilState){return JSON.stringify({destination:'Konsil-Testspeicher dieser Sitzung',revision:s.revision,mission:s.mission,task:'Erfolgskriterium und Aufwand des kleinen Versuchs klären.'});}
export function approveTest(s:CouncilState,payload:string):CouncilState{return s.mode==='demo'&&s.phase==='decision'&&payload===actionPayload(s)?{...s,approval:payload}:s;}
export function executeTest(s:CouncilState):CouncilState{
 if(s.mode!=='demo'||s.phase!=='decision'||s.applied||s.approval!==actionPayload(s))return s;
 return {...s,applied:1,phase:'completed',testTask:{id:s.id+':test-task',payload:actionPayload(s)}};
}
