import {describe,it,expect} from 'vitest';
import {toObject} from '../../src/features/v2/foundations/model';
const path='05 🚀 Projekte/Test.md';const meta='---\nphase: in-arbeit\narbeitsstand_am: 2026-09-10\n---\n';
describe('explicit current project state',()=>{
 it('uses current block over older updates regardless of order',()=>{const data=toObject(path,meta+'## Update 2026-08-01\nOld state\n## Nächste Schritte\n- Old action\n## Aktueller Arbeitsstand\n### Ergebnis\nWorking product\n### Stand\nNew state\n### Nächster Schritt\n- [x] Finished\n- [ ] Current action\n### Blocker\nLogin missing\n## Historie\nUnrelated');expect(data?.current).toBe('New state');expect(data?.nextTodo).toBe('Current action');expect(data?.blocker).toBe('Login missing');expect(data?.workDate).toBe('2026-09-10');});
 it('does not resurrect old actions when current block intentionally has none',()=>{const data=toObject(path,meta+'## Nächste Schritte\n- Old action\n## Aktueller Arbeitsstand\n### Stand\nWaiting\n### Nächster Schritt\nNoch zu klären.');expect(data?.nextTodo).toBeUndefined();});
 it('does not treat a code example as the current block',()=>{const data=toObject(path,meta+'```md\n## Aktueller Arbeitsstand\n### Stand\nExample\n```\n## Aktueller Stand\nReal legacy state');expect(data?.current).toContain('Real legacy state');expect(data?.workDate).toBeUndefined();});
 it('keeps legacy parsing when no new block exists',()=>{expect(toObject(path,meta+'## Nächste Schritte\n- Existing action')?.nextTodo).toBe('Existing action');});
});
