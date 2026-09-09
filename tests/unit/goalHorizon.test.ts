import {goalPath} from '../../src/features/v2/foundations/goalLayout';
import {describe,it,expect} from 'vitest';
import {toObject,type WorldObject} from '../../src/features/v2/foundations/model';
import {goalPosition,horizonBand,nextMilestone,goalStatus} from '../../src/features/v2/foundations/goalLayout';
const goal=(extra:Partial<WorldObject>={}):WorldObject=>({id:'g.md',path:'g.md',title:'Ziel',kind:'goal',state:'aktiv',groups:[],links:[],milestones:[],...extra});
describe('Goal Horizon uses evidence rather than invented progress',()=>{
 it('keeps unknown and invalid dates outside time bands',()=>{for(const due of [undefined,'offen','2027-13','2027-02-31'])expect(horizonBand(due)).toBeNull();});
 it('keeps year and month precision without inventing a day',()=>{const now=new Date('2026-09-08');expect(horizonBand('2026-12',now)).toBe(1);expect(horizonBand('2027',now)).toBe(2);});
 it('keeps positions stable when other goals are added or reordered',()=>{const g=goal({groups:['beruflich','lernen']});expect(goalPosition(g,new Date('2026-09-08'))).toEqual(goalPosition({...g},new Date('2026-09-08')));});
 it('does not rename a personal direction into health',()=>{expect(goalPosition(goal({groups:['persönlich']}))).toEqual(goalPosition(goal({groups:[]})));});
 it('points to the first open milestone even with non-contiguous completion',()=>{expect(nextMilestone(goal({milestones:[{title:'A',done:true},{title:'B',done:false},{title:'C',done:true}]}))).toBe(1);expect(nextMilestone(goal())).toBe(-1);});
 it('preserves dates, annotations and documented evidence from goal notes',()=>{const g=toObject('03🪪 Identität/Ziele/Z.md','---\nziel: Z\nbedeutung: gross\nnachweis: Selbsterklärung\n---\n## Meilensteine\n| 1 | A | ~~2026~~ → 2027 | ⏳ neu terminiert |\n## Quelle\n[[05 🚀 Projekte/P]]');expect(g?.milestones[0]).toMatchObject({title:'A',done:false,date:'~~2026~~ → 2027',status:'⏳ neu terminiert'});expect(g?.links).toContain('05 🚀 Projekte/P.md');expect(g?.proof).toBe('Selbsterklärung');});
 it('does not accuse waiting or deliberately paused goals of inactivity',()=>{expect(goalStatus(goal({waiting:'andere'}))).toBe('Andere sind am Zug');expect(goalStatus(goal({state:'zurueckgestellt'}))).toBe('Bewusst zurückgestellt');});
});

describe('navigable goal paths',()=>{
 it('puts completed stations behind the current open station',()=>{const g=goal({milestones:[{title:'A',done:true},{title:'B',done:false},{title:'C',done:false}]});const p=goalPath(g);expect(p.points[0][2]).toBeGreaterThan(p.points[1][2]);expect(p.points[2][2]).toBeLessThan(p.points[1][2]);});
 it('branches only from explicit dependency data',()=>{const g=goal({milestones:[{title:'A',done:true},{title:'B',done:false,after:[0]},{title:'C',done:false,after:[0]},{title:'D',done:false,after:[1,2]}]});const p=goalPath(g);expect(p.points[1][2]).toBe(p.points[2][2]);expect(p.points[1][0]).not.toBe(p.points[2][0]);expect(p.edges[3]).toEqual([1,2]);});
 it('ignores invalid forward references and cycles',()=>{const p=goalPath(goal({milestones:[{title:'A',done:false,after:[0,1,-1]}]}));expect(p.edges[0]).toEqual([]);});
 it('reads explicitly supplied predecessors without inventing them',()=>{const g=toObject('03🪪 Identität/Ziele/Z.md','---\nziel: Z\n---\n## Meilensteine\n| 1 | A | offen | offen |\n| 2 | B | offen | offen | nach: 1 |');expect(g?.milestones[1].after).toEqual([0]);expect(g?.milestones[0].after).toBeUndefined();});
});
