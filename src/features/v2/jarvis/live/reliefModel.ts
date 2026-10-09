import * as THREE from "three";

/** Limited-angle solid relief, textured with the established android artwork.
 * Front depth, opaque side walls and separate eye patches are genuine geometry.
 * This is deliberately not a reconstructed all-angle anatomical character rig.
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
    jawPositions.push(p[0],p[1]-.15*weight,p[2]+.025*weight);
  }
  for(let j=0;j<height;j++)for(let i=0;i<width;i++){
    if(alpha((i+.5)/width,(j+.5)/height)<.05)continue;
    const a=j*(width+1)+i,b=a+1,c=a+width+1,d=c+1;indices.push(a,c,b,b,c,d);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  geometry.morphAttributes.position=[new THREE.Float32BufferAttribute(jawPositions,3)];
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.03,toneMapped:false});
  // Recessed black eye aperture replaces the fixed pupils in the artwork.
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
      vec2 eyeA=(vMapUv-vec2(.333,.576))/vec2(.069,.035);
      vec2 eyeB=(vMapUv-vec2(.664,.576))/vec2(.069,.035);
      float cavity=1.0-smoothstep(.80,1.03,min(length(eyeA),length(eyeB)));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.004,.018,.025),cavity);
    `);
  };
  const face=new THREE.Mesh(geometry,material);parent.add(face);
  const eyes:THREE.Group[]=[];
  for(const u of [.333,.664]){
    const v=.424,p=point(u,v);
    const socket=new THREE.Group();socket.position.set(p[0],p[1],p[2]+.045);parent.add(socket);
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
  // Close the silhouette with opaque sides; their depth is visible in a turn.
  const bounds:{u:number;v:number}[]=[];
  const left:{u:number;v:number}[]=[],right:{u:number;v:number}[]=[];
  for(let j=1;j<189;j+=2){let l=-1,r=-1;for(let i=0;i<160;i++)if(pixels[(j*160+i)*4+3]>130){if(l<0)l=i;r=i;}if(l>=0){left.push({u:(l+.5)/160,v:j/190});right.push({u:(r+.5)/160,v:j/190});}}
  bounds.push(...left,...right.reverse());
  const sides:number[]=[],sideIndices:number[]=[];
  bounds.forEach(({u,v})=>{const p=point(u,v);sides.push(...p,p[0]*.94,p[1],-.50);});
  for(let i=0;i<bounds.length;i++){const a=i*2,b=((i+1)%bounds.length)*2;sideIndices.push(a,b,a+1,b,b+1,a+1);}
  const shell=new THREE.BufferGeometry();shell.setAttribute("position",new THREE.Float32BufferAttribute(sides,3));shell.setIndex(sideIndices);shell.computeVertexNormals();
  parent.add(new THREE.Mesh(shell,new THREE.MeshStandardMaterial({color:"#213b4b",metalness:.8,roughness:.35,side:THREE.DoubleSide})));
  return {face,eyes,eyeOrigins:eyes.map(eye=>eye.position.clone())};
}
