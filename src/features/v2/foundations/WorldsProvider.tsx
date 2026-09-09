"use client";
import {createContext,useContext,useEffect,useState,useRef,useCallback,type ReactNode,type MutableRefObject} from "react";
import type {WorldObject} from "./model";
import {type V2World,useV2} from "../state";
import {useHermesLive} from "../useHermesLive";
import type {CronJobSummary} from "@/lib/cron/types";
export type WormholeTrip={sourceId:string|null;sourceWorld:V2World;targetWorld:V2World;targetId?:string;label:string;stage:'departure'|'arrival';started:number};
type WorldData={timeLayers:boolean;setTimeLayers:(v:boolean)=>void;homeSignal:number;returnHome:()=>void;horizonView:"sky"|"top";setHorizonView:(v:"sky"|"top")=>void;milestone:number|null;setMilestone:(v:number|null)=>void;quick:boolean;setQuick:(v:boolean)=>void;objects:WorldObject[];issues:string[];loading:boolean;selected:string|null;choose:(id:string|null)=>void;jobs:CronJobSummary[];flowStatus:string;phase:string|null;setPhase:(p:string|null)=>void;positions:MutableRefObject<Map<string,[number,number,number]>>;trip:WormholeTrip|null;setTrip:React.Dispatch<React.SetStateAction<WormholeTrip|null>>;travel:(world:V2World,id:string|undefined,label:string)=>void;origin:string|null;};
const Context=createContext<WorldData|null>(null);
export function WorldsProvider({children}:{children:ReactNode}){
 const {world}=useV2();
 const [timeLayers,setTimeLayers]=useState(false);const [homeSignal,setHomeSignal]=useState(0);const returnHome=useCallback(()=>setHomeSignal(n=>n+1),[]);
 const [horizonView,setHorizonView]=useState<"sky"|"top">("sky");const [milestone,setMilestone]=useState<number|null>(null);const [quick,setQuick]=useState(false);
 const [phase,setPhase]=useState<string|null>(null);const positions=useRef(new Map<string,[number,number,number]>());const [trip,setTrip]=useState<WormholeTrip|null>(null);const [origin,setOrigin]=useState<string|null>(null);const [data,setData]=useState({objects:[] as WorldObject[],issues:[] as string[],loading:true});
 const [selected,choose]=useState<string|null>(null);const [jobs,setJobs]=useState<CronJobSummary[]>([]);const [flowError,setFlowError]=useState('');
 const travel=useCallback((targetWorld:V2World,targetId:string|undefined,label:string)=>{if(trip)return;if(targetWorld===world){choose(targetId??null);return;}setOrigin(selected);setTrip({sourceId:selected,sourceWorld:world,targetWorld,targetId,label,stage:'departure',started:performance.now()});},[selected,world,trip]);
 const live=useHermesLive(world==='flow');
 const {status,methods,call}=live;
 useEffect(()=>{const abort=new AbortController();fetch('/api/vault/worlds',{signal:abort.signal}).then(r=>{if(!r.ok)throw Error('LifeOS nicht erreichbar');return r.json();}).then(result=>setData({...result,loading:false})).catch(e=>{if(!abort.signal.aborted)setData({objects:[],issues:[String(e.message)],loading:false});});return()=>abort.abort();},[]);
 useEffect(()=>{if(world!=='flow'||status!=='connected'||!methods.includes('cron.list'))return;let cancelled=false;const read=()=>{void call('cron.list',{includeDisabled:true}).then(result=>{if(cancelled)return;setJobs((result as {jobs?:CronJobSummary[]}).jobs||[]);setFlowError('');}).catch(()=>{if(!cancelled){setJobs([]);setFlowError('Laufdaten derzeit nicht abrufbar');}});};read();const timer=setInterval(read,10000);return()=>{cancelled=true;clearInterval(timer);};},[world,status,methods,call]);
 const flowStatus=flowError||(live.status==='connected'?(live.methods.includes('cron.list')?'Verbunden · Laufdaten alle 10 Sekunden':'Gateway bietet noch keine Laufdaten'):live.status==='connecting'?'Verbindung wird aufgebaut':'Keine Live-Verbindung · keine Arbeit simuliert');
 return <Context.Provider value={{timeLayers,setTimeLayers,homeSignal,returnHome,horizonView,setHorizonView,milestone,setMilestone,quick,setQuick,...data,phase,setPhase,positions,trip,setTrip,travel,origin,selected,choose,jobs:world==='flow'&&live.status==='connected'?jobs:[],flowStatus}}>{children}</Context.Provider>;
}
export function useWorlds(){const c=useContext(Context);if(!c)throw Error('WorldsProvider missing');return c;}
