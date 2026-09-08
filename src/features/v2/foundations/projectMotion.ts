import {projectRadius} from './model';
export const PROJECT_PHASES=[
 {id:'idee',title:'Idee',color:'#bda2ef',description:'Ein frisches Vorhaben. Ziel und nächster Schritt dürfen noch offen sein.'},
 {id:'entwurf',title:'Entwurf',color:'#88c1e3',description:'Zielbild, Umfang und Vorgehen werden konkretisiert.'},
 {id:'in-arbeit',title:'In Arbeit',color:'#88d3b0',description:'Das Projekt wird umgesetzt. Die Bahn zeigt die erfasste Phase, keinen automatischen Fortschrittswert.'},
 {id:'abnahme',title:'Abnahme',color:'#e6c58c',description:'Das Ergebnis liegt zur Prüfung bereit. Rückmeldungen können weitere Arbeit auslösen.'},
 {id:'fertig',title:'Fertig',color:'#f1d9c0',description:'Das Ergebnis ist fertig. Ein ausdrücklich abgeschlossener Eintrag erscheint anschließend im Erfolgsraum.'},
];
export function orbitPosition(state:string,index:number,total:number,time:number):[number,number,number]{const radius=projectRadius(state),angle=index/Math.max(total,1)*Math.PI*2+.4+time*(.017+(.006*(44-radius)/24));return[Math.cos(angle)*radius,Math.sin(angle*2)*1.4,Math.sin(angle)*radius];}
export function planetView(position:[number,number,number],aspect=1){const length=Math.hypot(position[0],position[2])||1;const distance=Math.max(11,10/Math.max(.3,aspect));return{position:[position[0]+position[0]/length*distance,position[1]+3.5,position[2]+position[2]/length*distance] as [number,number,number],target:position};}
