import {describe,it,expect} from 'vitest';
import {ORIGINS,connectionBenefit,emptyLab,demoImpulses,candidates,formOf,parseLab} from '../../src/features/atelier-lab/model';
describe('isolated impulse laboratory',()=>{
 it('starts without importing personal data',()=>expect(emptyLab().impulses).toEqual([]));
 it('labels every demo impulse as an example',()=>expect(demoImpulses().every(i=>i.example)).toBe(true));
 it('explains candidates using actual shared tags',()=>{const lab={...emptyLab(),impulses:demoImpulses()};const links=candidates(lab,'demo-0');expect(links.length).toBeGreaterThan(0);expect(links.every(l=>l.status==='candidate'&&lab.impulses.find(i=>i.id===l.b)!.tags.some(t=>lab.impulses[0].tags.includes(t)&&l.reason.includes(t)))).toBe(true);});
 it('does not equate a suggestion with a confirmed connection',()=>{const lab={...emptyLab(),impulses:demoImpulses()};lab.links=candidates(lab,'demo-0');expect(formOf(lab,'demo-0')).toBe('Impuls');lab.links[0].status='confirmed';expect(formOf(lab,'demo-0')).toBe('Gedankenwolke');});
 it('does not resurface rejected suggestions on a repeat scan',()=>{const lab={...emptyLab(),impulses:demoImpulses()};lab.links=candidates(lab,'demo-0').map(l=>({...l,status:'rejected'}));expect(candidates(lab,'demo-0')).toEqual([]);});
 it('preserves the raw thought after forming and roundtrip export',()=>{const lab={...emptyLab(),impulses:demoImpulses()};const original=lab.impulses[0].raw;lab.impulses[0].answer='Eine technische Portfolioseite';expect(formOf(lab,'demo-0')).toBe('Silhouette');expect(parseLab(JSON.stringify(lab)).impulses[0].raw).toBe(original);});
 it('requires explicit clarity rather than answering one question',()=>{const lab={...emptyLab(),impulses:demoImpulses()};lab.impulses[0].answer='Ein Versuch';expect(formOf(lab,'demo-0')).not.toBe('Klare Idee');lab.impulses[0].clear=true;expect(formOf(lab,'demo-0')).toBe('Klare Idee');});
 it('rejects dangling imported relations',()=>{const lab={...emptyLab(),impulses:demoImpulses(),links:[{id:'a::b',a:'a',b:'b',status:'confirmed',reason:'test'}]};expect(()=>parseLab(JSON.stringify(lab))).toThrow('Ungültige Verbindungen');});
});

describe('structured origins',()=>{
 it('retains old files without an origin category',()=>expect(parseLab(JSON.stringify({...emptyLab(),impulses:demoImpulses()})).impulses).toHaveLength(6));
 it('roundtrips every allowed origin',()=>{for(const originKind of ORIGINS){const impulses=demoImpulses();impulses[0].originKind=originKind;expect(parseLab(JSON.stringify({...emptyLab(),impulses})).impulses[0].originKind).toBe(originKind);}});
 it('rejects unknown categories without replacing the saved state',()=>{const impulses=demoImpulses();impulses[0].originKind='invented';expect(()=>parseLab(JSON.stringify({...emptyLab(),impulses}))).toThrow();});
 it('frames usefulness as a question rather than evidence',()=>{const [a,b]=demoImpulses();a.originKind='Problem';expect(connectionBenefit(a,b)).toContain('Prüffrage:');expect(connectionBenefit(a,b)).toContain('Lösungsansatz');});
});
