import {describe,it,expect} from 'vitest';
import {fitPhoto} from '../../src/features/v2/spatial/photoStore';
import {highlightFoundText,matchingExcerpt} from '../../src/features/v2/hud/foundText';
import {orbitPosition,planetView,PROJECT_PHASES} from '../../src/features/v2/foundations/projectMotion';
import {toObject,projectRadius} from '../../src/features/v2/foundations/model';
describe('R13 spatial experience',()=>{
 it('does not present a completed or struck-through step as the next todo',()=>{const object=toObject('05 🚀 Projekte/Workflow.md','---\nphase: in-arbeit\n---\n## Nächste Schritte\n- ~~Altes Todo~~\n- [x] Bereits erledigt\n- [ ] Nächster offener Schritt\n');expect(object?.nextTodo).toBe('Nächster offener Schritt');});
 it('fits portrait and landscape photos without changing their aspect ratio',()=>{for(const [w,h] of [[3000,4000],[6000,2000],[2000,2000]]){const [x,y]=fitPhoto(w,h);expect(x/y).toBeCloseTo(w/h);expect(x).toBeLessThanOrEqual(4.1);expect(y).toBeLessThanOrEqual(2.2);}});
 it('moves a planet along its phase orbit rather than changing its phase',()=>{const a=orbitPosition('idee',1,4,0),b=orbitPosition('idee',1,4,15);expect(a).not.toEqual(b);expect(Math.hypot(a[0],a[2])).toBeCloseTo(projectRadius('idee'));expect(Math.hypot(b[0],b[2])).toBeCloseTo(projectRadius('idee'));});
 it('places the camera outside the selected planet with the centre behind it',()=>{const p=orbitPosition('entwurf',0,3,0),v=planetView(p);expect(Math.hypot(v.position[0],v.position[2])).toBeGreaterThan(Math.hypot(p[0],p[2]));expect(v.target).toEqual(p);});
 it('keeps all five selectable belts outside the accretion disc',()=>{expect(PROJECT_PHASES).toHaveLength(5);expect(Math.min(...PROJECT_PHASES.map(p=>projectRadius(p.id)))).toBeGreaterThan(16);});
 it('highlights case-insensitive real text without changing a link target',()=>{const tree={type:'root',children:[{type:'element',tagName:'a',properties:{href:'/Yasin'},children:[{type:'text',value:'Treffen mit Yasin und YASIN.'}]}]};highlightFoundText('yasin')()(tree);const text=JSON.stringify(tree);expect(text.match(/"tagName":"mark"/g)).toHaveLength(2);expect(tree.children[0].properties.href).toBe('/Yasin');});
 it('brings a late match into the excerpt and leaves unrelated notes unmarked',()=>{expect(matchingExcerpt('Vorwort '.repeat(400)+'Yasin sitzt hier.','Yasin')).toContain('Yasin sitzt hier');expect(matchingExcerpt('Keine passende Stelle','Yasin')).toBe('');});
 it('preserves a dated next-step heading instead of inventing a current todo',()=>{const object=toObject('05 🚀 Projekte/Workflow.md','---\nphase: in-arbeit\n---\n## Zweck\nEin nützlicher Prozess.\n## Nächste Schritte für 2026-08-26\n- [ ] Unterlagen prüfen\n## Links\n');expect(object?.nextTodo).toBe('Unterlagen prüfen');expect(object?.nextHeading).toContain('2026-08-26');expect(object?.flowAccess).toBe(true);});
});
