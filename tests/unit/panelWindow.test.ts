import {createElement} from 'react';
import {render,screen,fireEvent,act,cleanup} from '@testing-library/react';
import {afterEach,it,expect} from 'vitest';
import {PanelWindow} from '../../src/features/v2/hud/PanelWindow';
afterEach(cleanup);
it('keeps drafts through free view and leaves closed windows closed',()=>{render(createElement(PanelWindow,{title:'Entwurf',children:createElement('section',null,createElement('input',{'aria-label':'Text',defaultValue:'Unfertig'}))}));const input=screen.getByRole('textbox');fireEvent.change(input,{target:{value:'Mein neuer Text'}});act(()=>window.dispatchEvent(new Event('hermes:panels-minimize')));expect(input).not.toBeVisible();act(()=>window.dispatchEvent(new Event('hermes:panels-restore')));expect(input).toBeVisible();expect(input).toHaveValue('Mein neuer Text');fireEvent.click(screen.getByRole('button',{name:'Entwurf schließen'}));act(()=>window.dispatchEvent(new Event('hermes:panels-restore')));expect(input).not.toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Entwurf wiederherstellen'}));expect(input).toHaveValue('Mein neuer Text');});
