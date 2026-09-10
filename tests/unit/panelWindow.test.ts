import {createElement} from 'react';
import {render,screen,fireEvent,act,cleanup,waitFor} from '@testing-library/react';
import {afterEach,it,expect} from 'vitest';
import {PanelWindow} from '../../src/features/v2/hud/PanelWindow';
afterEach(cleanup);
it('keeps drafts through free view and leaves closed windows closed',()=>{render(createElement(PanelWindow,{title:'Entwurf',children:createElement('section',null,createElement('input',{'aria-label':'Text',defaultValue:'Unfertig'}))}));const input=screen.getByRole('textbox');fireEvent.change(input,{target:{value:'Mein neuer Text'}});act(()=>window.dispatchEvent(new Event('hermes:panels-minimize')));expect(input).not.toBeVisible();act(()=>window.dispatchEvent(new Event('hermes:panels-restore')));expect(input).toBeVisible();expect(input).toHaveValue('Mein neuer Text');fireEvent.click(screen.getByRole('button',{name:'Entwurf schließen'}));act(()=>window.dispatchEvent(new Event('hermes:panels-restore')));expect(input).not.toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Entwurf wiederherstellen'}));expect(input).toHaveValue('Mein neuer Text');});

it('collects minimized windows in one tray without moving their draft bodies',async()=>{
 const tray=document.createElement('div');tray.id='hermes-panel-tray';document.body.append(tray);
 try{
 render(createElement('div',null,...['A','B'].map(title=>createElement(PanelWindow,{key:title,title,slot:title,children:createElement('section',null,createElement('input',{'aria-label':title,defaultValue:title}))}))));
 await act(async()=>{await new Promise(resolve=>requestAnimationFrame(resolve));});
 act(()=>window.dispatchEvent(new Event('hermes:panels-minimize')));
 await waitFor(()=>expect(tray.querySelectorAll('.panel-restore')).toHaveLength(2));
 expect(screen.getByLabelText('A')).not.toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'A wiederherstellen'}));
 expect(screen.getByLabelText('A')).toHaveValue('A');expect(screen.getByLabelText('A')).toBeVisible();
 expect(tray.querySelectorAll('.panel-restore')).toHaveLength(1);
 }finally{cleanup();tray.remove();}
});
