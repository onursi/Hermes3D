import * as THREE from "three";

/** Sculpted front with the established artwork, closed rounded armour behind it.
 * Sockets, rear panels and mechanical ear assemblies rotate with the entire skull.
 */
export function addAndroidRelief(parent: THREE.Group, texture: THREE.Texture) {
  const image=texture.image as HTMLImageElement;
  const sample=document.createElement("canvas");sample.width=160;sample.height=190;
  const context=sample.getContext("2d")!;context.drawImage(image,0,0,160,190);
  const pixels=context.getImageData(0,0,160,190).data;
  const alpha=(u:number,v:number)=>pixels[(Math.min(189,Math.floor(v*190))*160+Math.min(159,Math.floor(u*160)))*4+3]/255;
  const surface=(u:number,v:number)=>{
    const x=(u-.5)*3.8;
    const dome=.78*Math.sqrt(Math.max(0,1-(x/1.94)**2))*Math.sqrt(Math.max(.05,1-((v-.44)/.62)**2));
    const nose=.47*Math.exp(-(((u-.5)/.066)**2+((v-.53)/.105)**2));
    const chin=.13*Math.exp(-(((u-.5)/.17)**2+((v-.77)/.12)**2));
    return .14+dome+nose+chin;
  };
  const point=(u:number,v:number)=>[(u-.5)*3.8,(.5-v)*4.53-.1,surface(u,v)];
  const width=100,height=120,positions:number[]=[],uvs:number[]=[],indices:number[]=[],jawPositions:number[]=[];
  for(let j=0;j<=height;j++)for(let i=0;i<=width;i++){
    const u=i/width,v=j/height,p=point(u,v);
    positions.push(...p);uvs.push(u,1-v);
    const lower=Math.max(0,Math.min(1,(v-.652)/.032));
    const centre=Math.max(0,Math.min(1,(.235-Math.abs(u-.5))/.05));
    const chin=Math.max(0,Math.min(1,(.85-v)/.025));
    const weight=lower*centre*chin;
    jawPositions.push(p[0],p[1]-.27*weight,p[2]+.04*weight);
  }
  for(let j=0;j<height;j++)for(let i=0;i<width;i++){
    if(alpha((i+.5)/width,(j+.5)/height)<.05)continue;
    const a=j*(width+1)+i,b=a+1,c=a+width+1,d=c+1;indices.push(a,c,b,b,c,d);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  geometry.morphAttributes.position=[new THREE.Float32BufferAttribute(jawPositions,3)];
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.03,toneMapped:false});
  // Recessed black eye aperture replaces the fixed pupils in the artwork.
  // The jaw morph stretches the lip seam; that band becomes a dark, lit mouth interior while speaking.
  const mouth={value:0};
  material.onBeforeCompile=shader=>{
    shader.uniforms.uMouth=mouth;
    shader.fragmentShader="uniform float uMouth;\n"+shader.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
      float lipT=(vMapUv.y-.316)/.032;
      float lipU=abs(vMapUv.x-.5)/.15;
      float lens=sqrt(max(0.,1.-lipU*lipU));
      float inside=(1.-smoothstep(lens*.5-.12,lens*.5,abs(lipT-.5)))*step(lipU,1.);
      float openness=smoothstep(.05,.3,uMouth);
      float rim=smoothstep(lens*.5-.3,lens*.5,abs(lipT-.5));
      vec3 interior=mix(vec3(.0,.002,.004),vec3(.03,.3,.6),rim*rim*.7);
      diffuseColor.rgb=mix(diffuseColor.rgb,interior,inside*openness);
      vec2 eyeA=(vMapUv-vec2(.333,.576))/vec2(.069,.035);
      vec2 eyeB=(vMapUv-vec2(.664,.576))/vec2(.069,.035);
      float cavity=1.0-smoothstep(.80,1.03,min(length(eyeA),length(eyeB)));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.004,.018,.025),cavity);
    `);
  };
  const face=new THREE.Mesh(geometry,material);parent.add(face);
  const eyes:THREE.Group[]=[],sockets:THREE.Group[]=[];
  for(const u of [.333,.664]){
    const v=.424,p=point(u,v);
    const socket=new THREE.Group();socket.position.set(p[0],p[1],p[2]+.045);parent.add(socket);sockets.push(socket);
    const aperture=new THREE.Shape();const direction=u<.5?1:-1;
    [[-.245,.058],[.235,-.015],[.194,-.079],[-.19,-.066]].forEach(([x,y],i)=>{if(i===0)aperture.moveTo(x*direction,y);else aperture.lineTo(x*direction,y);});aperture.closePath();
    const stencilRef=u<.5?1:2;
    const sclera=new THREE.Mesh(new THREE.ShapeGeometry(aperture),new THREE.MeshBasicMaterial({color: "#71cce9",toneMapped:false,side:THREE.DoubleSide,stencilWrite:true,stencilRef,stencilFunc:THREE.AlwaysStencilFunc,stencilZPass:THREE.ReplaceStencilOp}));sclera.renderOrder=1;socket.add(sclera);
    const eye=new THREE.Group();eye.position.set(p[0],p[1]-.023,p[2]+.100);parent.add(eye);eyes.push(eye);
    const iris=new THREE.Mesh(new THREE.PlaneGeometry(.094,.106),new THREE.MeshBasicMaterial({color:"#c5f5ff",toneMapped:false}));eye.add(iris);
    const pupil=new THREE.Mesh(new THREE.PlaneGeometry(.064,.101),new THREE.MeshBasicMaterial({color:"#00121e",toneMapped:false}));pupil.position.z=.004;eye.add(pupil);
    const slit=new THREE.Mesh(new THREE.PlaneGeometry(.008,.079),new THREE.MeshBasicMaterial({color:"#53bded",toneMapped:false}));slit.position.z=.008;eye.add(slit);
    eye.children.forEach(child=>{const mesh=child as THREE.Mesh;mesh.renderOrder=2;const m=mesh.material as THREE.MeshBasicMaterial;m.stencilWrite=true;m.stencilRef=stencilRef;m.stencilFunc=THREE.EqualStencilFunc;});
  }
  const rows:{l:number;r:number;v:number}[]=[];
  for(let j=1;j<189;j+=2){let l=-1,r=-1;for(let i=0;i<160;i++)if(pixels[(j*160+i)*4+3]>130){if(l<0)l=i;r=i;}if(l>=0)rows.push({l:(l+.5)/160,r:(r+.5)/160,v:j/190});}
  // Ignore small particle/plate bumps when shaping the rounded rear armour.
  for(let pass=0;pass<3;pass++){const source=rows.map(row=>({...row}));rows.forEach((row,j)=>{if(j<2||j>rows.length-3)return;const neighbours=source.slice(Math.max(0,j-4),Math.min(source.length,j+5));row.l=neighbours.reduce((sum,r)=>sum+r.l,0)/neighbours.length;row.r=neighbours.reduce((sum,r)=>sum+r.r,0)/neighbours.length;});}
  const backPoint=(row:typeof rows[number],angle:number)=>{
    const centre=(row.l+row.r)/2,half=(row.r-row.l)/2;
    const u=centre+half*Math.cos(angle);
    const edgeDepth=surface(row.l,row.v)*(1-Math.cos(angle))/2+surface(row.r,row.v)*(1+Math.cos(angle))/2;
    const depth=row.v<.78?1.9*Math.sqrt(Math.max(.002,1-((row.v-.4)/.405)**2)):.65*Math.max(.06,(.99-row.v)/.21);
    return new THREE.Vector3((u-.5)*3.8,(.5-row.v)*4.53-.1,edgeDepth-Math.sin(angle)*depth);
  };
  const segments=48,sides:number[]=[],sideIndices:number[]=[];
  rows.forEach(row=>{for(let i=0;i<=segments;i++)sides.push(...backPoint(row,i/segments*Math.PI).toArray());});
  for(let j=0;j<rows.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;sideIndices.push(a,a+1,b,a+1,b+1,b);}
  // Cap both ends; the rear is a volume, never an open billboard.
  for(const j of [0,rows.length-1]){const first=j*(segments+1);const centre=sides.length/3;const p=backPoint(rows[j],Math.PI/2);p.z=(p.z+surface(.5,rows[j].v))/2;sides.push(...p.toArray());for(let i=0;i<segments;i++)sideIndices.push(centre,first+i,first+i+1);sideIndices.push(centre,first+segments,first);}
  const shell=new THREE.BufferGeometry();shell.setAttribute("position",new THREE.Float32BufferAttribute(sides,3));shell.setIndex(sideIndices);shell.computeVertexNormals();
  const armour=new THREE.MeshStandardMaterial({color:"#293a46",metalness:.7,roughness:.55,side:THREE.DoubleSide});
  parent.add(new THREE.Mesh(shell,armour));
  const seam=new THREE.MeshStandardMaterial({color:"#02090d",roughness:.8});
  const glow=new THREE.MeshBasicMaterial({color:"#35bdff",toneMapped:false});
  const pipe=(points:THREE.Vector3[],radius:number,material:THREE.Material)=>{if(points.length<2)return;parent.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),points.length*2,radius,5,false),material));};
  for(const angle of [.32,.76,Math.PI/2,Math.PI-.76,Math.PI-.32]){
    const line=rows.filter(row=>row.v>.045&&row.v<.82).map(row=>{const p=backPoint(row,angle);p.z-=.014;return p;});pipe(line,.023,seam);
    if(angle!==Math.PI/2)pipe(line.filter(p=>p.y<1.55&&p.y>-.55).map(p=>p.clone().add(new THREE.Vector3(Math.cos(angle)*.04,0,-Math.sin(angle)*.04))),.012,glow);
  }
  for(const v of [.24,.59,.75]){const row=rows.reduce((best,r)=>Math.abs(r.v-v)<Math.abs(best.v-v)?r:best);pipe(Array.from({length:33},(_,i)=>{const p=backPoint(row,.22+i/32*(Math.PI-.44));p.z-=.016;return p;}),.023,seam);}
  for(const side of [-1,1]){
    const ear=new THREE.Group();ear.position.set(side*1.59,.02,-.05);ear.rotation.y=side*Math.PI/2;parent.add(ear);
    const housing=new THREE.Mesh(new THREE.CylinderGeometry(.35,.39,.17,48),armour);housing.rotation.x=Math.PI/2;ear.add(housing);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.265,.018,8,48),glow);ring.position.z=.1;ear.add(ring);
    const core=new THREE.Mesh(new THREE.CylinderGeometry(.21,.21,.025,32),seam);core.rotation.x=Math.PI/2;core.position.z=.11;ear.add(core);
    for(let i=0;i<4;i++){const vent=new THREE.Mesh(new THREE.BoxGeometry(.036,.36,.04),seam);vent.position.set(side*1.25,.55+i*.1,-.79);vent.rotation.y=side*.65;parent.add(vent);}
  }
  return {face,eyes,sockets,mouth,eyeOrigins:eyes.map(eye=>eye.position.clone())};
}
