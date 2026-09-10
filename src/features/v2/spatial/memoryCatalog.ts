import {MEMORY_TOPICS} from './memoryTopics';
import {PHASES} from './model';
export type MemoryAlbum={id:string;title:string;archived?:boolean};
export type MemoryRealm={id:string;title:string;color:string;albums:MemoryAlbum[];archived?:boolean};
export type MemoryCatalog={version:1;realms:MemoryRealm[]};
export function initialCatalog():MemoryCatalog{return {version:1,realms:MEMORY_TOPICS.map(t=>({...t,title:t.id,albums:t.id==='Lebensweg'?PHASES.map(id=>({id,title:id})):[]}))};}
export function parseCatalog(value:unknown):MemoryCatalog{
 const v=value as MemoryCatalog;
 if(!v||v.version!==1||!Array.isArray(v.realms)||v.realms.length>100)throw Error('Erinnerungsstruktur ist nicht lesbar. Der Bestand bleibt unverändert.');
 const ids=new Set<string>();
 for(const r of v.realms){if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id)||typeof r.title!=='string'||!r.title.trim()||r.title.length>80||!/^#[0-9a-f]{6}$/i.test(r.color)||!Array.isArray(r.albums)||r.albums.length>100)throw Error('Ungültige Erinnerungswelt');ids.add(r.id);const albums=new Set<string>();for(const a of r.albums){if(!a||typeof a.id!=='string'||!a.id||albums.has(a.id)||typeof a.title!=='string'||!a.title.trim()||a.title.length>80)throw Error('Ungültiger Erinnerungsring');albums.add(a.id);}}
 return v;
}
/** Recover legacy assignments without changing a media ID, blob, or archived choice. */
export function recoverCatalog(catalog:MemoryCatalog,media:{topic?:string;phase:string}[]):MemoryCatalog{
 const next:MemoryCatalog=structuredClone(catalog);
 for(const m of media){const id=m.topic||'Lebensweg';let r=next.realms.find(r=>r.id===id);if(!r){r={id,title:id,color:'#b8cddd',albums:[]};next.realms.push(r);}if(!r.albums.some(a=>a.id===m.phase))r.albums.push({id:m.phase,title:m.phase});}
 return parseCatalog(next);
}
