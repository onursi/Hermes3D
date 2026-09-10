import {createElement} from 'react';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {MemoryManager} from '../../src/features/v2/spatial/MemoryManager';
import type {MemoryCatalog} from '../../src/features/v2/spatial/memoryCatalog';
afterEach(cleanup);
const original:MemoryCatalog={version:1,realms:[{id:'stable-id',title:'Reisen',color:'#aabbcc',albums:[{id:'japan-id',title:'Japan'}]}]};
function setup(ok=true){const onSave=vi.fn(async(_catalog:MemoryCatalog)=>ok),onTopic=vi.fn();render(createElement(MemoryManager,{catalog:original,topic:'stable-id',phase:'japan-id',ready:true,onSave,onTopic}));return{onSave,onTopic};}
describe('memory editing preserves references',()=>{
 it('preloads the name and changes only title',async()=>{const {onSave}=setup();fireEvent.click(screen.getByRole('button',{name:'Saturn umbenennen'}));const input=screen.getByRole('textbox',{name:'Name des Saturns'});expect(input).toHaveValue('Reisen');fireEvent.change(input,{target:{value:'Unsere Reisen'}});fireEvent.click(screen.getByRole('button',{name:'Namen speichern'}));await waitFor(()=>expect(onSave).toHaveBeenCalledOnce());const next=onSave.mock.calls[0][0] as MemoryCatalog;expect(next.realms[0]).toEqual({...original.realms[0],title:'Unsere Reisen'});expect(original.realms[0].title).toBe('Reisen');});
 it('requires a second click to archive and retains rings',async()=>{const {onSave,onTopic}=setup();fireEvent.click(screen.getByRole('button',{name:'Saturn entfernen'}));expect(onSave).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Ins Archiv entfernen'}));await waitFor(()=>expect(onTopic).toHaveBeenCalledWith(''));expect((onSave.mock.calls[0][0] as MemoryCatalog).realms[0]).toEqual({...original.realms[0],archived:true});});
 it('keeps entered name on failed persistence',async()=>{setup(false);fireEvent.click(screen.getByRole('button',{name:'Saturn umbenennen'}));fireEvent.change(screen.getByRole('textbox',{name:'Name des Saturns'}),{target:{value:'Mein Entwurf'}});fireEvent.click(screen.getByRole('button',{name:'Namen speichern'}));await screen.findByText(/Nicht gespeichert/);expect(screen.getByRole('textbox',{name:'Name des Saturns'})).toHaveValue('Mein Entwurf');});
});
