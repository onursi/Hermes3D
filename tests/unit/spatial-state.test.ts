// @vitest-environment node
import { afterAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EMPTY_META, orbitState } from '../../src/features/v2/spatial/model';

describe('project attention is explicit',()=>{
 const now=Date.parse('2026-09-07T12:00:00Z');
 it('does not punish a pause or waiting without a due review',()=>{
  expect(orbitState({...EMPTY_META,disposition:'paused'},now).label).toBe('Bewusst pausiert');
  expect(orbitState({...EMPTY_META,disposition:'waiting'},now).label).toBe('Wartet auf Rückmeldung');
 });
 it('only brings due reviews closer; completed projects remain completed',()=>{
  expect(orbitState({...EMPTY_META,reviewAt:'2026-09-01'},now).label).toBe('Wiedervorlage fällig');
  expect(orbitState({...EMPTY_META,disposition:'completed',reviewAt:'2026-09-01'},now).label).toBe('Abgeschlossen');
  expect(orbitState(undefined,now).label).toBe('Noch nicht eingeordnet');
 });
});

const root=await fs.mkdtemp(path.join(os.tmpdir(),'hermes-r10-test-'));
vi.stubEnv('OBSIDIAN_VAULT_PATH',root);
vi.resetModules();
const api=await import('../../src/app/api/vault/project-state/route');
const folder='Testprojekt';
const dir=path.join(root,'05 🚀 Projekte',folder);
await fs.mkdir(dir,{recursive:true});
const request=(data:object,origin='http://localhost:3462')=>new Request('http://localhost:3462/api/vault/project-state',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(data)});
const data={folder,goal:'Prüfziel',disposition:'paused',reviewAt:null,note:'Bewusste Pause'};
afterAll(async()=>{vi.unstubAllEnvs();await fs.rm(root,{recursive:true,force:true});});
it('persists explicit decisions and preserves earlier history',async()=>{
 expect((await api.POST(request(data))).status).toBe(200);
 expect((await api.POST(request({...data,note:'Wieder aufgenommen',disposition:'active'}))).status).toBe(200);
 const content=await fs.readFile(path.join(dir,'Hermes3D Projektstatus.md'),'utf8');
 expect(content).toContain('Bewusste Pause');expect(content).toContain('Wieder aufgenommen');
 expect((await (await api.GET()).json()).states[folder].disposition).toBe('active');
});
it('rejects foreign origins, invalid dates and path traversal',async()=>{
 expect((await api.POST(request(data,'https://foreign.invalid'))).status).toBe(403);
 expect((await api.POST(request({...data,reviewAt:'2026-02-31'}))).status).toBe(400);
 expect((await api.POST(request({...data,folder:'../escape'}))).status).toBe(400);
});
it('does not overwrite a preexisting note of the same name',async()=>{
 await fs.writeFile(path.join(dir,'Hermes3D Projektstatus.md'),'Original erhalten');
 expect((await api.POST(request(data))).status).toBe(400);
 expect(await fs.readFile(path.join(dir,'Hermes3D Projektstatus.md'),'utf8')).toBe('Original erhalten');
});
