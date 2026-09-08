"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from "react";
import type {WorldObject} from "./model";
import {useV2} from "../state";
import {useHermesLive} from "../useHermesLive";
import type {CronJobSummary} from "@/lib/cron/types";
type WorldData={objects:WorldObject[];issues:string[];loading:boolean;selected:string|null;choose:(id:string|null)=>void;jobs:CronJobSummary[];flowStatus:string;};
const Context=createContext<WorldData|null>(null);
export function WorldsProvider({children}:{children:ReactNode}){
 const {world}=useV2();const [data,setData]=useState({objects:[] as WorldObject[],issues:[] as string[],loading:true});
 const [selected,choose]=useState<string|null>(null);const [jobs,setJobs]=useState<CronJobSummary[]>([]);const [flowError,setFlowError]=useState('');
 const live=useHermesLive(world==='flow');
 const {status,methods,call}=live;
 useEffect(()=>{const abort=new AbortController();fetch('/api/vault/worlds',{signal:abort.signal}).then(r=>{if(!r.ok)throw Error('LifeOS nicht erreichbar');return r.json();}).then(result=>setData({...result,loading:false})).catch(e=>{if(!abort.signal.aborted)setData({objects:[],issues:[String(e.message)],loading:false});});return()=>abort.abort();},[]);
 useEffect(()=>{if(world!=='flow'||status!=='connected'||!methods.includes('cron.list'))return;let cancelled=false;const read=()=>{void call('cron.list',{includeDisabled:true}).then(result=>{if(cancelled)return;setJobs((result as {jobs?:CronJobSummary[]}).jobs||[]);setFlowError('');}).catch(()=>{if(!cancelled){setJobs([]);setFlowError('Laufdaten derzeit nicht abrufbar');}});};read();const timer=setInterval(read,10000);return()=>{cancelled=true;clearInterval(timer);};},[world,status,methods,call]);
 const flowStatus=flowError||(live.status==='connected'?(live.methods.includes('cron.list')?'Verbunden · Laufdaten alle 10 Sekunden':'Gateway bietet noch keine Laufdaten'):live.status==='connecting'?'Verbindung wird aufgebaut':'Keine Live-Verbindung · keine Arbeit simuliert');
 return <Context.Provider value={{...data,selected,choose,jobs:world==='flow'&&live.status==='connected'?jobs:[],flowStatus}}>{children}</Context.Provider>;
}
export function useWorlds(){const c=useContext(Context);if(!c)throw Error('WorldsProvider missing');return c;}
