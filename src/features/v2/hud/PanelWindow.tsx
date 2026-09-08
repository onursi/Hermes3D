"use client";
import {cloneElement,useState,type ReactElement,type ReactNode,type CSSProperties} from 'react';
/** Keep the body mounted so minimizing preserves text, scroll position and drafts. */
export function PanelWindow({title,children,slot='left',onClose,onMinimizedChange}:{title:string;children:ReactElement<{children?:ReactNode;style?:CSSProperties}>;slot?:string;onClose?:()=>void;onMinimizedChange?:(minimized:boolean)=>void}){
 const [mode,setMode]=useState<'open'|'minimized'|'closed'>('open');
 const close=()=>{if(onClose)onClose();else setMode('closed');};
 return <>{mode!=='open'&&<div className={`panel-restore panel-slot-${slot}`}><button onClick={()=>{setMode('open');onMinimizedChange?.(false);}} aria-label={`${title} wiederherstellen`}>↗ {title}{mode==='closed'?' öffnen':''}</button>{mode==='minimized'&&<button aria-label={`${title} schließen`} onClick={close}>×</button>}</div>}{cloneElement(children,{style:{...children.props.style,...(mode==='open'?{}:{display:'none'})}},<><div className="panel-window-tools" onClick={event=>event.stopPropagation()}><span>{title}</span><button aria-label={`${title} minimieren`} onClick={()=>{setMode('minimized');onMinimizedChange?.(true);}}>—</button><button aria-label={`${title} schließen`} onClick={close}>×</button></div>{children.props.children}</>)}</>;
}
