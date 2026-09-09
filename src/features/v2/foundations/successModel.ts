import type {WorldObject} from './model';
export function isSuccess(o:WorldObject){return o.kind==='goal'?o.state==='erreicht':o.kind==='project'&&o.state==='abgeschlossen';}
export function successPosition(o:WorldObject,index:number):[number,number,number]{return [(o.kind==='goal'?-1:1)*(8+(index%2)*9),2+Math.floor(index/6)*5,-8-Math.floor(index/2)*12];}
export function successLinks(o:WorldObject,objects:WorldObject[]){return objects.filter(t=>t.id!==o.id&&(o.links.includes(t.id)||t.links.includes(o.id)||o.parent===t.id||t.parent===o.id));}
