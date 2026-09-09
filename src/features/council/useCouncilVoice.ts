"use client";
import {useEffect,useRef,useState} from 'react';
type Recognition={lang:string;continuous:boolean;interimResults:boolean;start:()=>void;abort:()=>void;onresult:((e:{resultIndex:number;results:{length:number;[i:number]:{isFinal:boolean;[j:number]:{transcript:string}}}})=>void)|null;onerror:((e:{error:string})=>void)|null;onend:(()=>void)|null};
export function useCouncilVoice(onSpeech:(text:string)=>void,onInterrupt:()=>void){
 const recognition=useRef<Recognition|null>(null),callbacks=useRef({onSpeech,onInterrupt});const [listening,setListening]=useState(false),[status,setStatus]=useState('Mikrofon aus');
 useEffect(()=>{callbacks.current={onSpeech,onInterrupt};},[onSpeech,onInterrupt]);
 function stop(){const rec=recognition.current;recognition.current=null;if(rec){rec.onend=null;rec.onresult=null;rec.onerror=null;rec.abort();}setListening(false);setStatus('Mikrofon aus');}
 useEffect(()=>()=>{const rec=recognition.current;if(rec){rec.onend=null;rec.onresult=null;rec.onerror=null;rec.abort();}window.speechSynthesis?.cancel();},[]);
 function start(){if(recognition.current)return;const Ctor=(window as unknown as {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition}).SpeechRecognition||(window as unknown as {webkitSpeechRecognition?:new()=>Recognition}).webkitSpeechRecognition;if(!Ctor){setStatus('Spracherkennung hier nicht verfügbar. Bitte Texteingabe nutzen.');return;}window.speechSynthesis?.cancel();callbacks.current.onInterrupt();const rec=new Ctor();recognition.current=rec;rec.lang='de-DE';rec.continuous=true;rec.interimResults=true;
 rec.onresult=e=>{callbacks.current.onInterrupt();const parts=[];for(let i=0;i<e.results.length;i++)parts.push(e.results[i][0].transcript);callbacks.current.onSpeech(parts.join(' ').trim());};
 rec.onerror=e=>{stop();setStatus(e.error==='not-allowed'?'Mikrofon nicht freigegeben. Texteingabe bleibt verfügbar.':'Spracherkennung beendet: '+e.error);};rec.onend=()=>{recognition.current=null;setListening(false);setStatus('Aufnahme beendet. Text prüfen und bewusst übernehmen.');};try{rec.start();setListening(true);setStatus('Mikrofon aktiv · Entwurf wird diktiert');}catch{stop();setStatus('Mikrofon konnte nicht gestartet werden.');}}
 return {listening,status,start,stop};
}
