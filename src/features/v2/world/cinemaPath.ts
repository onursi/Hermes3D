import * as THREE from 'three';
export const FILM_SECONDS=24;
/** Room-specific framing around the current subject. No data or selection changes. */
export function cinemaPath(world:string,eye:THREE.Vector3,target:THREE.Vector3){
 const offset=eye.clone().sub(target);const radius=Math.max(3.2,offset.length());
 const calm=world==='memory'||world==='sanctuary';
 const turns=world==='success'?[0,.16,-.2,.28,-.12,0]:calm?[0,.32,.68,.95,.48,0]:[0,.48,-.35,.95,1.25,0];
 const scales=calm?[1,.8,.63,.95,1.15,1]:[1,.72,.48,.85,1.2,1];
 const heights=[0,.10,.025,.28,.07,0];
 const points=turns.map((angle,i)=>{
  const p=offset.clone().applyAxisAngle(new THREE.Vector3(0,1,0),angle).multiplyScalar(scales[i]).add(target);
  p.y+=radius*heights[i];if(world==='success')p.y=Math.max(0,p.y);
  return p;
 });
 // Exact start/end avoid a framing jump; centripetal interpolation avoids loops at close shots.
 points[0]=eye.clone();points[points.length-1]=eye.clone();
 return new THREE.CatmullRomCurve3(points,false,'centripetal');
}
