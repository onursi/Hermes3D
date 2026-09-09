import {describe,it,expect} from 'vitest';
import {routineSignals,berlinDay} from '../../src/features/v2/foundations/horizonRoutines';
const now=new Date('2026-09-09T10:00:00Z');
describe('documented horizon actions',()=>{
 it('does not treat an open recurring task as completed',()=>{const r=routineSignals([{content:'5 Gebete praktizieren'}],[],now)[0];expect(r.found).toBe(true);expect(r.doneToday).toBe(false);expect(r.days).toBe(0);});
 it('matches exact names with harmless whitespace/case normalization',()=>{const r=routineSignals([],[{content:' 5 GEBETE  praktizieren ',completed_at:now.toISOString()}],now)[0];expect(r.doneToday).toBe(true);expect(routineSignals([],[{content:'5 Gebete praktizieren vorbereiten',completed_at:now.toISOString()}],now)[0].found).toBe(false);});
 it('uses Berlin calendar days and deduplicates same-day events',()=>{expect(berlinDay('2026-09-08T22:30:00Z')).toBe('2026-09-09');const r=routineSignals([],[{content:'5 Gebete praktizieren',completed_at:'2026-09-08T22:30:00Z'},{content:'5 Gebete praktizieren',completed_at:now.toISOString()}],now)[0];expect(r.doneToday).toBe(true);expect(r.days).toBe(1);});
 it('recognizes the two verified Todoist spelling variants',()=>{const signals=routineSignals([{content:'Meds & Supps 💊'},{content:'Achtsamkeit & Bewusstsein'}],[],now);expect(signals.find(r=>r.name==='Meds & Supps')?.found).toBe(true);expect(signals.find(r=>r.name==='Achtsamkeit und Bewusstsein')?.found).toBe(true);});
 it('does not infer a spiritual goal from journaling',()=>{const r=routineSignals([],[{content:'Journaling',completed_at:now.toISOString()}],now).find(r=>r.name==='Journaling')!;expect(r.doneToday).toBe(true);expect(r.sector).toBe(null);});
 it('ignores missing and invalid completion timestamps',()=>{const r=routineSignals([],[{content:'5 Gebete praktizieren'},{content:'5 Gebete praktizieren',completed_at:'invalid'}],now)[0];expect(r.found).toBe(false);expect(r.doneToday).toBe(false);});
});
