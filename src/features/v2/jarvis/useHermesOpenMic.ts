"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {createOpenMicSession,type Recognition} from './openMicSession';
function constructor(){const w=window as unknown as {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};return w.SpeechRecognition??w.webkitSpeechRecognition;}
export function useHermesOpenMic(onText:(text:string)=>void,onInterrupt:()=>void){
 const [supported,setSupported]=useState(false),[listening,setListening]=useState(false),[status,setStatus]=useState('Mikrofon aus'),[heard,setHeard]=useState('');
 const session=useRef<ReturnType<typeof createOpenMicSession>|null>(null);
 const callbacks=useRef({onText,onInterrupt});
 useEffect(()=>{callbacks.current={onText,onInterrupt};},[onText,onInterrupt]);
 useEffect(()=>{
 // Detect only after hydration: the server has no microphone API.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 setSupported(Boolean(constructor()));
 },[]);
 const stopListening=useCallback(()=>{session.current?.stop();session.current=null;},[]);
 const startListening=useCallback(()=>{
  if(session.current?.active)return;
  const Ctor=constructor();if(!Ctor){setStatus('Spracherkennung hier nicht verfügbar. Bitte Text eingeben.');return;}
  callbacks.current.onInterrupt();setHeard('');setStatus('Mikrofon wird gestartet …');
  session.current=createOpenMicSession(new Ctor(),{
   text:text=>{setHeard(text);callbacks.current.onText(text);},
   interrupt:()=>callbacks.current.onInterrupt(),
   status:(active,message)=>{setListening(active);setStatus(message);if(!active)session.current=null;}
  });
 },[]);
 useEffect(()=>{const hidden=()=>{if(document.hidden)stopListening();};document.addEventListener('visibilitychange',hidden);return()=>{document.removeEventListener('visibilitychange',hidden);stopListening();};},[stopListening]);
 return {supported,listening,status,heard,startListening,stopListening};
}
