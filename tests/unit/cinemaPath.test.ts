import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {cinemaPath} from '../../src/features/v2/world/cinemaPath';
describe('room film routes',()=>{
 for(const world of ['home','projects','cosmos','memory','horizon','success','atelier','flow','sanctuary'])it(world+' returns to its original framing without changing the subject',()=>{
  const eye=new THREE.Vector3(9,9,43),target=new THREE.Vector3(0,0,0),original=eye.clone();
  const path=cinemaPath(world,eye,target);
  expect(path.getPoint(0).distanceTo(eye)).toBeLessThan(.00001);expect(path.getPoint(1).distanceTo(eye)).toBeLessThan(.00001);
  for(let i=0;i<=100;i++)expect(path.getPoint(i/100).toArray().every(Number.isFinite)).toBe(true);
  expect(eye.equals(original)).toBe(true);expect(target.length()).toBe(0);
 });
 it('gives quiet memories and energetic projects different routes',()=>{
  const eye=new THREE.Vector3(0,8,40),target=new THREE.Vector3();
  expect(cinemaPath('memory',eye,target).getPoint(.5).distanceTo(cinemaPath('projects',eye,target).getPoint(.5))).toBeGreaterThan(5);
 });
 it('keeps Success waypoints above its black floor',()=>{
  const p=cinemaPath('success',new THREE.Vector3(0,3,100),new THREE.Vector3(0,2,-20));
  for(let i=0;i<=100;i++)expect(p.getPoint(i/100).y).toBeGreaterThan(-8);
 });
});
