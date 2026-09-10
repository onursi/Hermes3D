"use client";
import {createPortal} from 'react-dom';
import {cloneElement,useState,useEffect,type ReactElement,type ReactNode,type CSSProperties} from 'react';
/** Keep the body mounted so minimizing preserves text, scroll position and drafts. */
export function PanelWindow({title,children,slot='left',onClose,onMinimizedChange}:{title:string;children:ReactElement<{children?:ReactNode;style?:CSSProperties;'data-panel-window'?:string}>;slot?:string;onClose?:()=>void;onMinimizedChange?:(minimized:boolean)=>void}){
 const [tray,setTray]=useState<HTMLElement|null>(null);
 useEffect(()=>{const frame=requestAnimationFrame(()=>setTray(document.getElementById('hermes-panel-tray')));return()=>cancelAnimationFrame(frame);},[]);
 const [mode,setMode]=useState<'open'|'minimized'|'closed'>('open');
 useEffect(()=>{const show=(event:Event)=>{if((event as CustomEvent).detail===slot){setMode('open');onMinimizedChange?.(false);}};window.addEventListener('hermes:panel-open',show);return()=>window.removeEventListener('hermes:panel-open',show);},[slot,onMinimizedChange]);
 useEffect(()=>{const minimize=()=>{if(mode!=='open')return;setMode('minimized');onMinimizedChange?.(true);};const restore=()=>{if(mode!=='minimized')return;setMode('open');onMinimizedChange?.(false);};window.addEventListener('hermes:panels-minimize',minimize);window.addEventListener('hermes:panels-restore',restore);return()=>{window.removeEventListener('hermes:panels-minimize',minimize);window.removeEventListener('hermes:panels-restore',restore);};},[mode,onMinimizedChange]);
 const close=()=>{if(onClose)onClose();else setMode('closed');};
 const restoreControl=<div className={`panel-restore panel-slot-${slot}`}><button onClick={()=>{setMode('open');onMinimizedChange?.(false);}} aria-label={`${title} wiederherstellen`}>↗ {title}{mode==='closed'?' öffnen':''}</button>{mode==='minimized'&&<button aria-label={`${title} schließen`} onClick={close}>×</button>}</div>;
 return <>{mode!=='open'&&(tray?createPortal(restoreControl,tray):restoreControl)}{cloneElement(children,{'data-panel-window':slot,style:{...children.props.style,...(mode==='open'?{}:{display:'none'})}},<><div className="panel-window-tools" onClick={event=>event.stopPropagation()}><span>{title}</span><button aria-label={`${title} minimieren`} onClick={()=>{setMode('minimized');onMinimizedChange?.(true);}}>—</button><button aria-label={`${title} schließen`} onClick={close}>×</button></div>{children.props.children}</>)}</>;
}
