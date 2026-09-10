import {describe,it,expect} from 'vitest';
import {orderedTasks,localDay,taskDate} from '../../src/features/v2/hud/workCentralModel';
describe('work central ordering',()=>{
it('keeps overdue before today and completed out without mutating source',()=>{const tasks=[{id:'later',content:'Later',dueDate:'2026-09-12',priority:4},{id:'today',content:'Today',dueDate:'2026-09-10T12:00:00'},{id:'done',content:'Done',isCompleted:true},{id:'overdue',content:'Overdue',dueDate:'2026-09-09'}];expect(orderedTasks(tasks,'2026-09-10').map(t=>t.id)).toEqual(['overdue','today','later']);expect(tasks).toHaveLength(4);expect(tasks[0].id).toBe('later');});
it('uses local calendar date and strips time for due comparison',()=>{expect(localDay(new Date(2026,8,10,0,1))).toBe('2026-09-10');expect(taskDate('2026-09-10T23:00')).toBe('2026-09-10');expect(taskDate('unknown')).toBeNull();});
it('uses priority on equal dates and retains undated tasks',()=>{expect(orderedTasks([{id:'a',content:'A',priority:1},{id:'b',content:'B',priority:4}],'2026-09-10').map(t=>t.id)).toEqual(['b','a']);});
});
