import {describe,it,expect} from 'vitest';
import {toObject,ideaObjects,projectRadius} from '../../src/features/v2/foundations/model';
import {excerptAround} from '../../src/lib/jarvis/retrieve';
import {beamStage} from '../../src/features/v2/jarvis/useBeamStage';
describe('world identities and lifecycle',()=>{
 it('does not turn a folder or a code example into a project',()=>{expect(toObject('05 🚀 Projekte/X.md','## Spec\nphase: idee')).toBeNull();});
 it('preserves distinct goal and project identities and their relation',()=>{const p=toObject('05 🚀 Projekte/P.md','---\nphase: in-arbeit\nzahlt_ein_auf: "[[03🪪 Identität/Ziele/Z]]"\n---');expect(p?.kind).toBe('project');expect(p?.links).toEqual(['03🪪 Identität/Ziele/Z.md']);expect(p?.id).not.toBe(p?.links[0]);});
 it('distinguishes waiting from lack of progress',()=>{const goal=toObject('03🪪 Identität/Ziele/Z.md','---\nziel: Ein Ziel\nzustand: aktiv\nam_zug: andere\n---');expect(goal?.waiting).toBe('andere');});
 it('does not treat arbitrary numbered tables as milestones',()=>{const p=toObject('05 🚀 Projekte/P.md','---\nphase: entwurf\n---\n## Übersicht\n| 1 | Modell | Beispiel |');expect(p?.milestones).toEqual([]);});
 it('retrieves the passage that contains the whole question instead of the first generic mention',()=>{const body='Jarvis ist ein Assistent. '+ 'Allgemeiner Kontext. '.repeat(80)+'Der Jarvis Strahl bleibt dauerhaft stehen.';expect(excerptAround(body,['jarvis','strahl'],150)).toContain('Strahl bleibt');});
 it('moves mature projects inward without consulting file age',()=>{expect(projectRadius('fertig')).toBeLessThan(projectRadius('idee'));});
 it('only includes ideas within the open section',()=>{expect(ideaObjects('ideas.md','## Offene Ideen\n### Alpha\n## Verworfene Ideen\n### Beta')).toHaveLength(1);});
 it('locks results indefinitely after the short scan',()=>{expect(beamStage(.1,true,false)).toBe('docking');expect(beamStage(1,true,true)).toBe('scanning');expect(beamStage(120,false,true)).toBe('locked');expect(beamStage(120,false,false)).toBe('empty');});
 it('does not force a scan animation with reduced motion',()=>{expect(beamStage(0,false,true,true)).toBe('locked');});
});
