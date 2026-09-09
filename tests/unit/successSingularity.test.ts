import {describe,it,expect} from 'vitest';
import {isSuccess,successPosition,successLinks} from '../../src/features/v2/foundations/successModel';
import {toObject,type WorldObject} from '../../src/features/v2/foundations/model';
const obj=(id:string,kind:WorldObject['kind'],state:string):WorldObject=>({id,path:id,title:id,kind,state,links:[],groups:[],milestones:[]});
describe('Success Singularity',()=>{
 it('keeps active goals and unfinished projects out of the vault',()=>{expect(isSuccess(obj('a','goal','aktiv'))).toBe(false);expect(isSuccess(obj('a','goal','erreicht'))).toBe(true);expect(isSuccess(obj('b','project','fertig'))).toBe(false);expect(isSuccess(obj('b','project','abgeschlossen'))).toBe(true);});
 it('separates goals and projects spatially',()=>{expect(successPosition(obj('a','goal','erreicht'),0)[0]).toBeLessThan(0);expect(successPosition(obj('b','project','abgeschlossen'),0)[0]).toBeGreaterThan(0);});
 it('uses explicit forward or back links, never matching titles',()=>{const g=obj('goal','goal','erreicht'),p=obj('project','project','abgeschlossen'),u=obj('other','project','abgeschlossen');p.links=['goal'];expect(successLinks(g,[g,p,u]).map(o=>o.id)).toEqual(['project']);});
 it('extracts original PDF and image attachment paths',()=>{const o=toObject('03🪪 Identität/Ziele/Test.md','---\nziel: Test\nzustand: erreicht\n---\n[[01📦RAW/Diplom.pdf]]\n![[Fotos/Bild.jpg]]');expect(o?.attachments).toEqual(['01📦RAW/Diplom.pdf','Fotos/Bild.jpg']);});
});
