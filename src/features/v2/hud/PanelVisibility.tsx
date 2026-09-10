"use client";
import {useState} from 'react';

export function PanelVisibility(){
 const [clear,setClear]=useState(false);
 return <button type="button" className="room-tool" aria-pressed={clear} title="Arbeitsfenster minimieren; Eingaben bleiben erhalten" onClick={()=>{window.dispatchEvent(new Event(clear?'hermes:panels-restore':'hermes:panels-minimize'));setClear(!clear);}}>{clear?'▣ Fenster zurück':'▢ Freie Sicht'}</button>;
}
