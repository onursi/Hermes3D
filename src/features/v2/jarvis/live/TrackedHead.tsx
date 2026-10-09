"use client";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { addAndroidRelief } from "./reliefModel";
import { currentGaze, damp, focusYaw, type GazeTarget } from "./tracking";

export function TrackedHead({ level, gaze, attention, onActivate, inspect = 0, active = false }: { level: MutableRefObject<number>; gaze: MutableRefObject<GazeTarget>; attention?: MutableRefObject<number>; onActivate: () => void; inspect?: number; active?: boolean }) {
  const container = useRef<HTMLButtonElement>(null);
  const inspection = useRef(0), suppressClick = useRef(false);
  const resetVersion = useRef(0);
  useEffect(()=>{inspection.current=inspect&&!active?performance.now():0;resetVersion.current++;},[inspect,active]);
  const [fallback,setFallback]=useState(false);
  useEffect(() => {
    const host=container.current;
    if(!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,stencil:true,powerPreference:"high-performance"}); }
    catch { const fallbackFrame=requestAnimationFrame(()=>setFallback(true));return ()=>cancelAnimationFrame(fallbackFrame); }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
    host.appendChild(renderer.domElement);
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(35,1,.1,50);camera.position.set(0,.05,8.6);camera.lookAt(0,-.13,0);
    scene.add(new THREE.HemisphereLight(0xa0d7ff,0x030609,2.3));
    for(const [color,intensity,x,y,z] of [[0xe9f7ff,5,-3,5,6],[0x40b8ff,3,4,1,3],[0x0997ff,6,-3,1,-3]] as const) {
      const lamp=new THREE.DirectionalLight(color,intensity);lamp.position.set(x,y,z);scene.add(lamp);
    }
    const head=new THREE.Group();scene.add(head);
    let android: ReturnType<typeof addAndroidRelief> | undefined;
    let disposed=false;
    const texture=new THREE.TextureLoader().load("/jarvis/hologram-android-v3.png",loaded=>{if(disposed){loaded.dispose();return;}loaded.colorSpace=THREE.SRGBColorSpace;android=addAndroidRelief(head,loaded);},undefined,()=>{if(!disposed)setFallback(true);});
    const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let frame=0,last=0,eyeX=0,eyeY=0,energy=0,headX=0,headY=0;
    let manual: number | null=null, pointer: {id:number;x:number;yaw:number} | null=null, version=0;
    const down=(event:PointerEvent)=>{pointer={id:event.pointerId,x:event.clientX,yaw:head.rotation.y};host.setPointerCapture(event.pointerId);suppressClick.current=false;};
    const move=(event:PointerEvent)=>{if(!pointer||event.pointerId!==pointer.id)return;const dx=event.clientX-pointer.x;if(Math.abs(dx)>5){suppressClick.current=true;inspection.current=0;manual=pointer.yaw+dx/Math.max(180,host.clientWidth)*Math.PI*2;}};
    const up=()=>{pointer=null;};
    const reset=()=>{manual=null;inspection.current=0;};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")reset();};
    host.addEventListener("pointerdown",down);host.addEventListener("pointermove",move);host.addEventListener("pointerup",up);host.addEventListener("pointercancel",up);host.addEventListener("dblclick",reset);window.addEventListener("keydown",escape);
    const draw=(now:number)=>{
      if(document.hidden){frame=0;last=0;return;}
      const dt=last?(now-last)/1000:1/60;last=now;
      if(version!==resetVersion.current){version=resetVersion.current;manual=null;}
      const target=currentGaze(gaze.current,now);
      eyeX=damp(eyeX,target.x,16,dt);eyeY=damp(eyeY,target.y,16,dt);
      headX=damp(headX,attention?.current ? attention.current * .8 : focusYaw(target),5,dt);headY=damp(headY,target.y,4,dt);
      energy=damp(energy,Math.min(1,level.current),20,dt);
      const amount=reduced?.matches?.45:1;
      const progress=inspection.current?Math.min(1,(now-inspection.current)/8000):0;
      const spinning=inspection.current>0&&progress<1;
      if(inspection.current&&progress>=1){inspection.current=0;headX=0;}
      // One complete revolution returns to the same orientation without reversing.
      const turn=spinning?Math.PI*2*(progress*progress*(3-2*progress)):manual??headX*amount;
      head.rotation.set(headY*.36*amount,turn,damp(head.rotation.z,-target.roll*.5,3,dt));
      android?.eyes.forEach((eye,i)=>{eye.position.x=android!.eyeOrigins[i].x+(eyeX-target.x*.35)*.145;eye.position.y=android!.eyeOrigins[i].y-(eyeY-headY*.25)*.026;});
      if(android?.face.morphTargetInfluences)android.face.morphTargetInfluences[0]=energy*amount;
      host.dataset.yaw=head.rotation.y.toFixed(3);host.dataset.eye=eyeX.toFixed(3);
      host.dataset.rotationMode=spinning?"360":manual!==null?"manual":"tracking";
      host.dataset.meshes=String(renderer.info.render.calls);
      renderer.render(scene,camera);frame=requestAnimationFrame(draw);
    };
    const visibility=()=>{if(!document.hidden&&!frame)frame=requestAnimationFrame(draw);};
    const contextLost=(event:Event)=>{event.preventDefault();cancelAnimationFrame(frame);setFallback(true);};
    renderer.domElement.addEventListener("webglcontextlost",contextLost);
    document.addEventListener("visibilitychange",visibility);frame=requestAnimationFrame(draw);
    return ()=>{
      disposed=true;texture.dispose();cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener("visibilitychange",visibility);
      renderer.domElement.removeEventListener("webglcontextlost",contextLost);
      host.removeEventListener("pointerdown",down);host.removeEventListener("pointermove",move);host.removeEventListener("pointerup",up);host.removeEventListener("pointercancel",up);host.removeEventListener("dblclick",reset);window.removeEventListener("keydown",escape);
      const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
      scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.LineSegments){geometries.add(object.geometry);(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>materials.add(m));}});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();
    };
  },[level,gaze,attention]);
  return <button ref={container} className="jl-tracked-head" type="button" aria-label="Jarviskopf drehen oder Gesprächseinstellungen öffnen" title="Ziehen dreht den Kopf frei · ESC setzt ihn zurück" onClick={()=>{if(!suppressClick.current)onActivate();}}>{fallback&&<><img src="/jarvis/hologram-android-v3.png" alt="Mechanischer Jarviskopf" /><span className="jl-render-note">3D-Darstellung auf diesem Gerät nicht verfügbar</span></>}</button>;
}
