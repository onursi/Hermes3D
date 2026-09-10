import {describe,it,expect,vi} from 'vitest';
import {createOpenMicSession,type Recognition} from '../../src/features/v2/jarvis/openMicSession';
function setup(fail=false){const rec:Recognition={lang:'',continuous:false,interimResults:false,start:vi.fn(()=>{if(fail)throw Error('denied');}),abort:vi.fn(),onresult:null,onerror:null,onend:null,onstart:null,onspeechstart:null};const cb={text:vi.fn(),status:vi.fn(),interrupt:vi.fn()};return {rec,cb,session:createOpenMicSession(rec,cb)};}
describe('Open Mic lifecycle',()=>{
 it('retains all segments and replaces corrected interim text',()=>{const {rec,cb}=setup();rec.onresult?.({results:[{isFinal:true,0:{transcript:'Erster Satz.'}},{isFinal:false,0:{transcript:'Zweiter'}}]});rec.onresult?.({results:[{isFinal:true,0:{transcript:'Erster Satz.'}},{isFinal:true,0:{transcript:'Zweiter Satz.'}}]});expect(cb.text).toHaveBeenLastCalledWith('Erster Satz. Zweiter Satz.');});
 it('stops once and ignores callbacks captured before stop',()=>{const {rec,cb,session}=setup();const late=rec.onresult;session.stop();session.stop();late?.({results:[{isFinal:true,0:{transcript:'late'}}]});expect(rec.abort).toHaveBeenCalledTimes(1);expect(cb.text).not.toHaveBeenCalled();expect(session.active).toBe(false);});
 it('permission denial terminates without restart',()=>{const {rec,cb,session}=setup();rec.onerror?.({error:'not-allowed'});expect(session.active).toBe(false);expect(rec.start).toHaveBeenCalledTimes(1);expect(cb.status).toHaveBeenLastCalledWith(false,expect.stringContaining('nicht freigegeben'));});
 it('start failure leaves no active session',()=>{const {session}=setup(true);expect(session.active).toBe(false);});
 it('browser end preserves text without sending or restarting',()=>{const {rec,cb,session}=setup();rec.onend?.();expect(session.active).toBe(false);expect(cb.text).not.toHaveBeenCalled();expect(rec.start).toHaveBeenCalledTimes(1);});
 it('speech onset interrupts playback',()=>{const {rec,cb}=setup();rec.onspeechstart?.();expect(cb.interrupt).toHaveBeenCalledTimes(1);});
});
