import * as THREE from 'three';
import { WORLD, PARAPET_THICKNESS } from '../config.js';
import { makePlaqueTexture, mulberry32 } from '../textures.js';
import { workshopMaterial } from './materials.js';

let kit;
function materials() {
  return kit ||= {
    paint: workshopMaterial('paint'), wood: workshopMaterial('wood'),
    dark: new THREE.MeshStandardMaterial({color: 0x303831, roughness: .7, metalness: .45}),
    brass: new THREE.MeshStandardMaterial({color: 0x8b7957, roughness: .55, metalness: .7}),
    ceramic: new THREE.MeshStandardMaterial({color: 0xd2c8a7, roughness: .38}),
    glass: new THREE.MeshStandardMaterial({color: 0x263c37, roughness: .3, metalness: .18}),
  };
}
function mesh(group, geometry, material, x, y, z) {
  const m = new THREE.Mesh(geometry, material); m.position.set(x,y,z);
  m.castShadow = m.receiveShadow = true; group.add(m); return m;
}
function roundedRect(w, h, radius) {
  const s = new THREE.Shape(), r = Math.min(radius, w/2, h/2), x=-w/2, y=-h/2;
  s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r);
  s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r);
  s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y);
  return s;
}
function panel(group,w,h,d,r,mat,x,y,z) {
  const geo = new THREE.ExtrudeGeometry(roundedRect(w,h,r), {depth:d, bevelEnabled:true, bevelThickness:.012, bevelSize:.012, bevelSegments:2, steps:1, curveSegments:8});
  geo.translate(0,0,-d/2);
  return mesh(group,geo,mat,x,y,z);
}
let contactMat;
function contact(group,x,z,w,d,opacity=.28) {
  if (!contactMat) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
    const ctx=canvas.getContext('2d'), g=ctx.createRadialGradient(32,32,5,32,32,32);
    g.addColorStop(0,'rgba(0,0,0,.9)');g.addColorStop(.55,'rgba(0,0,0,.5)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
    contactMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,toneMapped:false});
  }
  const mat=contactMat.clone();mat.opacity=opacity;
  const m=mesh(group,new THREE.PlaneGeometry(w,d),mat,x,.008,z);m.rotation.x=-Math.PI/2;m.castShadow=false;
  // Decoration must never intercept a record interaction ray.
  m.raycast=()=>{};
}
function pipe(group, points, radius=.045) {
  return mesh(group,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),32,radius,8,false),materials().dark,0,0,0);
}
function sign(group, lines, w,h,x,y,z,rotation=0) {
  const m=mesh(group,new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:makePlaqueTexture(lines,{fg:0xd3c8a6,bg:0x303a30}),side:THREE.DoubleSide}),x,y,z);
  m.rotation.y=rotation;return m;
}

export function dressGallery(group, doors, pillars, station) {
  const m=materials();
  for (const [index, door] of doors.entries()) {
    station.obstacles.push({ x: door.r - .12, z: 0, hw: .19, hd: .66, angle: door.theta });
    const g=new THREE.Group();g.position.set((door.r-.12)*Math.cos(door.theta),0,(door.r-.12)*Math.sin(door.theta));g.rotation.y=-Math.PI/2-door.theta;group.add(g);
    panel(g,1.28,2.32,.08,.2,m.dark,0,1.16,0);
    panel(g,1.08,2.12,.06,.15,m.paint,0,1.12,.065);
    panel(g,.58,.32,.03,.06,m.dark,0,1.65,.115);
    panel(g,.49,.23,.015,.04,m.glass,0,1.65,.14);
    mesh(g,new THREE.BoxGeometry(.035,.22,.065),m.brass,.35,1.05,.15);
    for (const y of [.45,1.85]) mesh(g,new THREE.BoxGeometry(.1,.16,.08),m.brass,-.48,y,.13);
    for(let i=0;i<5;i++) mesh(g,new THREE.BoxGeometry(.48,.025,.025),m.dark,0,.38+i*.06,.11);
    // Conduits follow the facade, above head height and clear of doorways.
    pipe(g,[[.76,.2,-.05],[.76,2.7,-.05],[.55,2.93,-.05],[-.8,2.93,-.05]],.027);
    contact(g,0,.12,1.5,.7,.2);
    // Each service entrance has a distinct maintained label and localized wear.
    sign(g,[['ÁGUA','DEPÓSITO','HABITAÇÃO'][index%3],door.label],.62,.22,0,2.02,.12);
    const stain=wallWear(g,.7,1.1,0,.7,.102,index%4);
    stain.material.opacity=.22;
    if(index%3===0) {
      station.obstacles.push({x:door.r-.12,z:.96,hw:.08,hd:.17,angle:door.theta});
      panel(g,.28,.36,.08,.035,m.paint,.96,1.42,-.045);
      mesh(g,new THREE.CylinderGeometry(.037,.037,.06,12),m.brass,.96,1.42,.018).rotation.x=Math.PI/2;
    }
  }
  for(const p of pillars) {
    contact(group,p.x,p.z,2.3,2.3,.36);
    const opal=new THREE.MeshBasicMaterial({color:new THREE.Color(0xffe6bb).multiplyScalar(1.3)});
    mesh(group,new THREE.CylinderGeometry(.46,.46,.38,24),opal,p.x,2.46,p.z);
    for(const y of [2.24,2.68])mesh(group,new THREE.CylinderGeometry(.49,.49,.07,24),m.dark,p.x,y,p.z);
    for(let i=0;i<8;i++)mesh(group,new THREE.BoxGeometry(.025,.4,.025),m.dark,p.x+.463*Math.cos(i*Math.PI/4),2.46,p.z+.463*Math.sin(i*Math.PI/4));
    const angle=Math.atan2(p.z,p.x);
    const light=new THREE.PointLight(0xffdfb0,22,9,2);
    light.position.set(p.x-.58*Math.cos(angle),2.46,p.z-.58*Math.sin(angle));group.add(light);
    for(const y of [.28,2.88])mesh(group,new THREE.CylinderGeometry(.46,.46,.045,20),m.dark,p.x,y,p.z);
  }
  // A restrained landing stencil, readable on the approach from the stair.
  sign(group,['CAFETERIA →','01 / SILO 18'],2.2,.7,WORLD.landingR-.5,2.1,1.5,-Math.PI/2);
  const a=.5, r=18.8;
  const key=new THREE.SpotLight(0xffe1b0,65,15,1.05,.85,2);
  key.name='gallery-shadow';key.position.set(r*Math.cos(a),3.04,r*Math.sin(a));
  key.target.position.set(20*Math.cos(.8),0,20*Math.sin(.8));
  key.castShadow=true;key.shadow.mapSize.set(512,512);key.shadow.camera.near=.15;key.shadow.camera.far=15;
  key.shadow.bias=-.00015;key.shadow.normalBias=.025;key.shadow.autoUpdate=false;key.shadow.needsUpdate=true;
  group.add(key,key.target);
  // Visible luminaire and bracket above the shadow-casting source.
  mesh(group,new THREE.CylinderGeometry(.19,.26,.12,16),m.dark,key.position.x,3.17,key.position.z);
  mesh(group,new THREE.CylinderGeometry(.21,.21,.025,16),new THREE.MeshBasicMaterial({color:0xffe6be}),key.position.x,3.1,key.position.z);
  mesh(group,new THREE.CylinderGeometry(.022,.022,.17,8),m.dark,key.position.x,3.315,key.position.z);
  group.traverse(o=>{if(o.isMesh && !o.material.transparent){o.castShadow=true;o.receiveShadow=true;}});
}

export function dressCafeteria(group, station, start, end, hw) {
  const firstChild=group.children.length;
  const m=materials(), H=WORLD.roomHeight, mid=(start+end)/2;
  // Replace the flat screen's bare edges with a deep, rounded service bezel.
  const bezel=panel(group,hw*1.76,H*.83,.17,.14,m.dark,end-.18,H*.52,0);bezel.rotation.y=-Math.PI/2;
  // The existing screen lies in front of the bezel (toward the room).
  for(const side of [-1,1]) {
    mesh(group,new THREE.BoxGeometry(end-start,.13,.07),m.dark,mid,.12,side*(hw-.05));
    mesh(group,new THREE.BoxGeometry(end-start,.22,.045),m.paint,mid,1.13,side*(hw-.025));
    pipe(group,[[start+.25,2.85,side*(hw-.17)],[end-.6,2.85,side*(hw-.17)],[end-.3,2.65,side*(hw-.17)],[end-.3,.3,side*(hw-.17)]],.055);
    for(let x=start+.8;x<end;x+=2) {
      mesh(group,new THREE.BoxGeometry(.065,.2,.17),m.brass,x,2.85,side*(hw-.14));
    }
  }
  // Overlaid wood tops retain the already-tested table/bench footprints.
  for(const side of [-1,1])for(let row=0;row<2;row++) {
    const x=start+4.7+row*2.7,z=side*2.9;
    const top=panel(group,1.91,1.11,.045,.07,m.wood,x,.826,z);top.rotation.x=-Math.PI/2;
    contact(group,x,z,3.1,3.5,.34);
    for(const dz of [-.8,.8]) {
      const seat=panel(group,1.91,.35,.035,.045,m.wood,x,.507,z+dz);seat.rotation.x=-Math.PI/2;
    }
    // Plates, reused enamel cups and a folded ration notice.
    mesh(group,new THREE.CylinderGeometry(.14,.12,.022,24),m.ceramic,x-.45,.863,z+.15);
    mesh(group,new THREE.CylinderGeometry(.065,.052,.13,20,1,true),m.ceramic,x+.43,.914,z-.15);
    const handle=mesh(group,new THREE.TorusGeometry(.042,.012,6,12),m.ceramic,x+.5,.924,z-.15);handle.rotation.y=Math.PI/2;
    const paper=sign(group,['RAÇÃO DIÁRIA','DEVOLVA A LOUÇA'],.3,.21,x+.1,.854,z+.17);paper.rotation.x=-Math.PI/2;paper.rotation.z=.18;
  }
  // Noticeboard and service grille sit flush on the wall, outside the aisle.
  panel(group,1.6,1.1,.08,.06,m.wood,start+1.6,1.95,-hw+.09);
  sign(group,['AVISOS DO TURNO','MANTENHA A PASSAGEM LIVRE'],1.35,.42,start+1.6,2.18,-hw+.15);
  for(let i=0;i<3;i++)sign(group,[['ESCALA','RECICLAGEM','MANUTENÇÃO'][i],'SILO 18'],.37,.38,start+1.13+i*.46,1.75,-hw+.15);
  panel(group,1.4,.48,.08,.08,m.dark,end-1.2,2.62,-hw+.1);
  for(let i=0;i<8;i++)mesh(group,new THREE.BoxGeometry(1.2,.025,.04),m.paint,end-1.2,2.46+i*.046,-hw+.16);
  // One static shadow map for this exemplar; the rest of the silo keeps its
  // ten-light pool. Low fill stands in for bounced light from the screen.
  const key=new THREE.SpotLight(0xffe5bb,85,19,1.12,.75,2);
  key.position.set(mid,H-.22,0);key.target.position.set(mid+.5,0,0);
  key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.near=.15;key.shadow.camera.far=19;
  key.shadow.bias=-.00015;key.shadow.normalBias=.025;key.shadow.autoUpdate=false;key.shadow.needsUpdate=true;
  group.add(key,key.target);
  const bounce=new THREE.PointLight(0xc4d1cb,8,12,2);bounce.position.set(end-1,1.4,0);group.add(bounce);
  for(const object of group.children.slice(firstChild)) {
    if (!object.isMesh || object.material.transparent) continue;
    object.updateMatrix();object.geometry.computeBoundingBox();
    const box=object.geometry.boundingBox.clone().applyMatrix4(object.matrix);
    if(box.max.y>.18 && box.min.y<1.8) {
      station.obstacles.push({x:(box.min.x+box.max.x)/2,z:(box.min.z+box.max.z)/2,hw:(box.max.x-box.min.x)/2,hd:(box.max.z-box.min.z)/2,angle:group.userData.collision.angle});
    }
  }
  group.traverse(o=>{if(o.isMesh && !o.material.transparent){o.castShadow=true;o.receiveShadow=true;}});
}

export function dressBridge(group) {
  const m=materials(), phi=WORLD.landingHalfAngle;
  // Repairs and rail fixings sit on the existing parapets, outside the lane.
  for(const side of [-1,1])for(let r=WORLD.hubR+.7;r<WORLD.ringInnerR-.3;r+=1.7) {
    const x=r*Math.cos(phi), z=side*(r*Math.sin(phi)-.115);
    const saddle=mesh(group,new THREE.BoxGeometry(.11,.055,.22),m.dark,x,1.08,z);
    saddle.rotation.y=-side*phi;
    for(const offset of [-.06,.06])mesh(group,new THREE.CylinderGeometry(.025,.025,.025,6),m.brass,x+offset,1.116,z);
  }
  // Pour joints and runoff sit on the inside face of the existing concrete
  // parapet. A shared batch keeps this detail cheap and outside the aisle.
  const joints = new THREE.InstancedMesh(new THREE.PlaneGeometry(.012,.97),
    new THREE.MeshStandardMaterial({color:0x514e42,roughness:1,side:THREE.DoubleSide}),8);
  joints.name='bridge-pour-joints';
  const dummy=new THREE.Object3D();let index=0;
  for(const side of [-1,1])for(let i=0;i<4;i++) {
    const r=WORLD.hubR+1+i*2;
    const face=new THREE.Group();
    const inset=PARAPET_THICKNESS+.004;
    face.position.set(r*Math.cos(phi)+inset*Math.sin(phi),0,side*(r*Math.sin(phi)-inset*Math.cos(phi)));
    face.rotation.y=-side*phi;group.add(face);
    dummy.position.copy(face.position);dummy.position.y=.51;
    dummy.rotation.set(0,-side*phi,0);dummy.updateMatrix();
    joints.setMatrixAt(index++,dummy.matrix);
    const runoff=wallWear(face,.46,.83,.1,.6,0,i);
    runoff.material.opacity=.42;
    runoff.rotation.y=side>0?Math.PI:0;
  }
  joints.instanceMatrix.needsUpdate=true;joints.receiveShadow=true;
  joints.raycast=()=>{};group.add(joints);
  const arrow=sign(group,['CAFETERIA →','NÍVEL 01'],1.25,.32,10.5,.019,0);
  arrow.rotation.x=-Math.PI/2;arrow.rotation.z=Math.PI/2;arrow.material.transparent=true;arrow.material.opacity=.55;
  arrow.raycast=()=>{};
}


const wearMaps = new Map();
function wallWear(group,w,h,x,y,z,seed=0) {
  if(!wearMaps.has(seed)) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d'),rand=mulberry32(773+seed);
    for(let i=0;i<60;i++) {
      const px=rand()*128,py=rand()*100,rr=2+rand()*10;
      const g=ctx.createRadialGradient(px,py,0,px,py,rr);
      g.addColorStop(0,'rgba(46,38,24,.24)');g.addColorStop(1,'rgba(46,38,24,0)');
      ctx.fillStyle=g;ctx.fillRect(px-rr,py-rr,rr*2,rr*2);
    }
    for(let i=0;i<14;i++) {
      const px=12+rand()*104,py=rand()*70,len=8+rand()*38;
      const g=ctx.createLinearGradient(0,py,0,py+len);
      g.addColorStop(0,'rgba(79,48,25,.28)');g.addColorStop(1,'rgba(79,48,25,0)');
      ctx.fillStyle=g;ctx.fillRect(px,py,1+rand()*3,len);
    }
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;wearMaps.set(seed,tex);
  }
  const m=mesh(group,new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:wearMaps.get(seed),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),x,y,z);
  m.castShadow=false;m.raycast=()=>{};return m;
}

export function dressEntrance(group, station, offset, main) {
  const m=materials(), half=WORLD.corridorHalfW, r=WORLD.landingR;
  // This portal frame straddles the existing wall opening. Its inner faces
  // stay outside the walkable corridor, so it cannot narrow the route.
  const first=group.children.length;
  for(const side of [-1,1]) {
    mesh(group,new THREE.BoxGeometry(.22,2.7,.16),m.paint,r-.1,1.35,side*(half+.09));
    for(const y of [.25,1.35,2.45])mesh(group,new THREE.BoxGeometry(.06,.1,.22),m.dark,r-.24,y,side*(half+.07));
    for(let x=r+.3;x<r+WORLD.corridorLen;x+=2.8) {
      mesh(group,new THREE.BoxGeometry(.12,.34,.065),m.paint,x,.22,side*(half-.025));
      const stain=wallWear(group,1.2,.7,x,.42,side*(half-.006),Math.floor(x)%4);
      stain.rotation.y=side>0?Math.PI:0;
    }
  }
  mesh(group,new THREE.BoxGeometry(.25,.2,half*2+.35),m.paint,r-.1,2.8,0);
  for(const dz of [-1.4,-.7,0,.7,1.4])mesh(group,new THREE.BoxGeometry(.07,.04,.06),m.brass,r-.24,2.8,dz);
  // Ceiling cable tray and a warm, recessed fixture at the entrance.
  mesh(group,new THREE.BoxGeometry(3.6,.08,.4),m.dark,r+1.6,3.15,0);
  for(let x=r+.1;x<r+3.4;x+=.36)mesh(group,new THREE.BoxGeometry(.045,.06,.46),m.paint,x,3.08,0);
  for(const dz of [-.11,.11])mesh(group,new THREE.BoxGeometry(1.1,.025,.055),new THREE.MeshBasicMaterial({color:0xffe4bb}),r+.8,3.02,dz);
  const bounce=new THREE.PointLight(0xffdcac,15,8,2);bounce.position.set(r+.8,2.85,0);group.add(bounce);
  // Register only solid additions crossing the player's height.
  for(const object of group.children.slice(first)) {
    if(!object.isMesh || object.material.transparent)continue;
    object.updateMatrix();object.geometry.computeBoundingBox();
    const box=object.geometry.boundingBox.clone().applyMatrix4(object.matrix);
    if(box.max.y>.18 && box.min.y<1.8)station.obstacles.push({x:(box.min.x+box.max.x)/2,z:(box.min.z+box.max.z)/2,hw:(box.max.x-box.min.x)/2,hd:(box.max.z-box.min.z)/2,angle:(station.wingRotation||0)+offset});
  }
}
