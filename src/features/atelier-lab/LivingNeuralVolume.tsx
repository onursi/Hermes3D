"use client";
import {useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';

// Decorative cyan tissue never represents a saved, lilac user connection.
export function LivingNeuralVolume({quiet}:{quiet:boolean}){
 const elapsed=useRef(0),lastCue=useRef(0);
 const materials=useRef<(THREE.ShaderMaterial|null)[]>([]);
 const uniforms=useMemo(()=>({time:{value:0},motion:{value:1}}),[]);
 const data=useMemo(()=>{
  let seed=18473;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const cells:number[]=[],fibers:number[]=[],progress:number[]=[],phases:number[]=[],starts:number[]=[],ends:number[]=[],bends:number[]=[],sparks:number[]=[],tails:number[]=[];
  const addPath=(a:THREE.Vector3,b:THREE.Vector3,bend:THREE.Vector3)=>{
   const phase=rand(),curve=new THREE.QuadraticBezierCurve3(a,bend,b),points=curve.getPoints(16);
   for(let n=0;n<16;n++){fibers.push(...points[n].toArray(),...points[n+1].toArray());progress.push(n/16,(n+1)/16);phases.push(phase,phase);}
   for(let n=0;n<9;n++){starts.push(...a.toArray());ends.push(...b.toArray());bends.push(...bend.toArray());sparks.push(phase);tails.push(n);}
  };
  const centers:THREE.Vector3[]=[];
  for(let i=0;i<150;i++){
   const az=rand()*Math.PI*2,y=rand()*2-1,r=23+rand()*55;
   const c=new THREE.Vector3(Math.cos(az)*Math.sqrt(1-y*y)*r,y*r*.85,Math.sin(az)*Math.sqrt(1-y*y)*r);
   centers.push(c);cells.push(...c.toArray());
   for(let k=0;k<5;k++){
    const dir=new THREE.Vector3(rand()-.5,rand()-.5,rand()-.5).normalize();
    const end=c.clone().addScaledVector(dir,5+rand()*9),mid=c.clone().lerp(end,.5).add(new THREE.Vector3(rand()*3-1.5,rand()*3-1.5,rand()*3-1.5));
    addPath(c,end,mid);
    const fork=mid.clone().add(new THREE.Vector3(rand()*6-3,rand()*6-3,rand()*6-3));
    addPath(mid,fork,mid.clone().lerp(fork,.5).addScaledVector(dir,1.3));
   }
  }
  centers.forEach((c,i)=>{const near=centers.filter((_,j)=>j!==i).sort((a,b)=>c.distanceToSquared(a)-c.distanceToSquared(b))[0];if(near&&c.distanceTo(near)<26)addPath(c,near,c.clone().lerp(near,.5).add(new THREE.Vector3(2,3,-2)));});
  return Object.fromEntries(Object.entries({cells,fibers,progress,phases,starts,ends,bends,sparks,tails}).map(([k,v])=>[k,new Float32Array(v)]));
 },[]);
 useFrame((_,dt)=>{
  const active=!quiet&&!document.hidden;
  if(active)elapsed.current+=Math.min(dt,.05);
  for(const material of materials.current)if(material){material.uniforms.time.value=elapsed.current;material.uniforms.motion.value=active?1:0;}
  if(active&&elapsed.current-lastCue.current>1.15){lastCue.current=elapsed.current;window.dispatchEvent(new Event('hermes:neural-discharge'));}
 });
 const common=`uniform float time;uniform float motion;`;
 return <group>
  <lineSegments raycast={()=>null}><bufferGeometry><bufferAttribute attach="attributes-position" args={[data.fibers,3]}/><bufferAttribute attach="attributes-progress" args={[data.progress,1]}/><bufferAttribute attach="attributes-seed" args={[data.phases,1]}/></bufferGeometry>
   <shaderMaterial ref={m=>{materials.current[0]=m;}} transparent depthWrite={false} blending={THREE.AdditiveBlending} uniforms={uniforms}
    vertexShader={`${common}attribute float progress;attribute float seed;varying float light;varying float fade;void main(){vec4 p=modelViewMatrix*vec4(position,1.);float head=fract(time*.28+seed);float d=abs(progress-head);light=.13+motion*.7*exp(-d*d*650.);fade=smoothstep(1.,9.,-p.z)*(1.-smoothstep(65.,135.,-p.z));gl_Position=projectionMatrix*p;}`}
    fragmentShader={'varying float light;varying float fade;void main(){gl_FragColor=vec4(.18,.60,.78,light*fade);}'} />
  </lineSegments>
  <points raycast={()=>null}><bufferGeometry><bufferAttribute attach="attributes-position" args={[data.cells,3]}/></bufferGeometry><shaderMaterial ref={m=>{materials.current[1]=m;}} transparent depthWrite={false} blending={THREE.AdditiveBlending} uniforms={uniforms}
   vertexShader={`${common}varying float glow;void main(){vec4 p=modelViewMatrix*vec4(position,1.);glow=(.65+.35*motion*sin(time*2.+position.x))*smoothstep(2.,10.,-p.z);gl_PointSize=clamp(1100./max(1.,-p.z),3.,45.);gl_Position=projectionMatrix*p;}`}
   fragmentShader={'varying float glow;void main(){float r=length(gl_PointCoord-.5)*2.;float core=exp(-r*r*70.);float halo=exp(-r*r*5.)*.38;gl_FragColor=vec4(.36,.83,1.,(core+halo)*glow);}'} /></points>
  <points frustumCulled={false} raycast={()=>null}><bufferGeometry><bufferAttribute attach="attributes-position" args={[data.starts,3]}/><bufferAttribute attach="attributes-end" args={[data.ends,3]}/><bufferAttribute attach="attributes-bend" args={[data.bends,3]}/><bufferAttribute attach="attributes-seed" args={[data.sparks,1]}/><bufferAttribute attach="attributes-tail" args={[data.tails,1]}/></bufferGeometry><shaderMaterial ref={m=>{materials.current[2]=m;}} transparent depthWrite={false} blending={THREE.AdditiveBlending} uniforms={uniforms}
   vertexShader={`${common}attribute vec3 end;attribute vec3 bend;attribute float seed;attribute float tail;varying float alpha;void main(){float u=fract(time*.28+seed)-tail*.012;float t=clamp(u,0.,1.);vec3 q=(1.-t)*(1.-t)*position+2.*(1.-t)*t*bend+t*t*end;vec4 p=modelViewMatrix*vec4(q,1.);alpha=motion*step(0.,u)*pow(1.-tail/10.,1.5)*smoothstep(2.,9.,-p.z)*(1.-smoothstep(65.,130.,-p.z));gl_PointSize=clamp((430.-tail*25.)/max(1.,-p.z),1.5,19.);gl_Position=projectionMatrix*p;}`}
   fragmentShader={'varying float alpha;void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(.56,.94,1.,exp(-r*r*5.)*alpha);}'} /></points>
 </group>;
}
