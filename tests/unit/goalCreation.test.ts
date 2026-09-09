import {describe,it,expect} from 'vitest';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {createGoalNote} from '../../src/lib/goalNotes';
import {EMPTY_GOAL,validateGoalDraft,goalFilename,goalMarkdown} from '../../src/features/v2/foundations/goalDraft';
import {toObject,type WorldObject} from '../../src/features/v2/foundations/model';
import {goalConstellation,closedGoal,goalStatus} from '../../src/features/v2/foundations/goalLayout';
const draft={...EMPTY_GOAL,title:'Ein eigenes Ziel',why:'Warum',groups:['lernen'],measure:'Ein Ergebnis',actions:['Journaling']};
describe('goal note creation',()=>{
 it('rejects invalid calendar dates and unsafe reserved names',()=>{for(const due of ['2027-00','2027-01-00','2027-02-30','morgen'])expect(()=>validateGoalDraft({...draft,due})).toThrow();expect(()=>goalFilename('CON')).toThrow();expect(goalFilename('../../Test')).not.toMatch(/[\\/]/);});
 it('round trips confirmed fields, quotes, actions and relationships',()=>{const d={...draft,title:'Ziel mit "Zitat"',links:['05 🚀 Projekte/Projekt.md'],firstStep:'Schritt 1'};const o=toObject('03🪪 Identität/Ziele/Neu.md',goalMarkdown(d,'2026-09-09'))!;expect(o.title).toBe(d.title);expect(o.actions).toEqual(['Journaling']);expect(o.links).toContain(d.links[0]);expect(o.milestones[0].title).toBe('Schritt 1');});
 it('creates one canonical note, indexes it, and refuses overwrite or duplicate titles',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'hermes-r18-test-'));await fs.mkdir(path.join(root,'03🪪 Identität/Ziele'),{recursive:true});await fs.mkdir(path.join(root,'02⚙️ System'));await fs.writeFile(path.join(root,'Index.md'),'Index\n');await fs.writeFile(path.join(root,'02⚙️ System/Log.md'),'History\n');const result=await createGoalNote(root,draft);const original=await fs.readFile(path.join(root,result.path),'utf8');expect(result.warnings).toEqual([]);expect(await fs.readFile(path.join(root,'Index.md'),'utf8')).toContain('Ein eigenes Ziel');expect(await fs.readFile(path.join(root,'02⚙️ System/Log.md'),'utf8')).toMatch(/^History/);await expect(createGoalNote(root,draft)).rejects.toThrow();expect(await fs.readFile(path.join(root,result.path),'utf8')).toBe(original);await expect(createGoalNote(root,{...draft,title:'Anderes Ziel',links:['../outside.md']})).rejects.toThrow();});
});
const goal=(id:string,links:string[]=[],groups=['lernen']):WorldObject=>({id,path:id,title:id,kind:'goal',state:'aktiv',links,groups,milestones:[]});
describe('spatial relationships and outcomes',()=>{
 it('is deterministic under list reordering and preserves time depth',()=>{const a=goal('a.md',['b.md']),b=goal('b.md');const x=goalConstellation([a,b]),y=goalConstellation([b,a]);expect(x.get(a.id)).toEqual(y.get(a.id));expect(x.get(b.id)).toEqual(y.get(b.id));const alone=goalConstellation([a]);expect(x.get(a.id)![2]).toBe(alone.get(a.id)![2]);});
 it('separates closed outcomes from waiting and unfinished work',()=>{expect(closedGoal('nicht-erreicht')).toBe(true);expect(closedGoal('beendet')).toBe(true);expect(closedGoal('zurueckgestellt')).toBe(false);expect(closedGoal('aktiv')).toBe(false);expect(goalStatus({...goal('a'),state:'nicht-erreicht'})).toContain('Erfahrung');});
});
