import * as THREE from 'three';
import { RESIDENTIAL as P } from '../residential-layout.js';
import { WORLD } from '../config.js';
import { addBox, addCylinder } from './primitives.js';
import { workshopSurface, getWallSurface } from './materials.js';
import { dressCourtyard } from './residential-court.js';
import { dressAlley } from './residential-alley.js';
import { makeSignTexture } from '../textures.js';
import { letteringMaterial, mountPlate } from './signs.js';
import { WALL_THICKNESS } from './primitives.js';
import { getWallSurface as wallSurface } from './materials.js';

const FRAME_MAT = new THREE.MeshStandardMaterial({ color: 0x434a3e, roughness: .8, metalness: .15, side: THREE.DoubleSide });

export function buildResidential(scene, station, angle, interactables) {
  const group=new THREE.Group();group.name='residential-28';
  group.position.y=station.y;group.rotation.y=-angle;scene.add(group);
  group.userData.collision={station,angle};
  const wallColor=0xaaa08b, trim=0x743e30;
  const box=(x,y,z,w,h,d,color=wallColor,map=null)=>addBox(group,{x,y,z,w,h,d,color,map,repeat:map && h<.3 && w>3 ? [w/3,d/3] : undefined});
  const wall=(x,z,w,d)=>{
    // Past the floor and ceiling, which sit 4mm off the nominal planes at the
    // alley's mouth (see floor()); flush, they left a slit at both junctions.
    const surface=box(x,1.7,z,w,3.48,d,wallColor,getWallSurface(0));
    surface.material.normalScale.set(.3,.3);
    box(x,1.05,z,w+.006,.22,d+.006,trim);
    box(x,.12,z,w+.008,.18,d+.008,0x48483c);
  };
  // Wayfinding strips, drawn with the same generator as the public-safety
  // notices so the whole silo shares one printed language. The generator caches
  // by content, which matters here: this helper is called about fifteen times
  // per wing and used to mint a fresh canvas on every call.
  //
  // Every strip is a plate with a body and lettering on one face only, so none
  // can be read mirrored. `hang` is for the ones that are not on a wall: they
  // get rods up to the ceiling instead of floating across the walkway.
  function sign(text,x,y,z,rotation=0,w=1.3,hang=0) {
    const tex=makeSignTexture({kind:'teal',headline:text,width:512,height:112});
    const h=w*.215;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),letteringMaterial(tex,{toneMapped:false}));
    m.position.set(x,y,z);m.rotation.y=rotation;group.add(m);
    const back=new THREE.Mesh(new THREE.BoxGeometry(w+.05,h+.05,.03),new THREE.MeshStandardMaterial({color:0x1b1d1f,roughness:.55,metalness:.55}));
    back.position.set(x-Math.sin(rotation)*.019,y,z-Math.cos(rotation)*.019);back.rotation.y=rotation;back.raycast=()=>{};group.add(back);
    if(hang>y+h/2) m.name='hung-sign';
    if(hang>y+h/2) for(const side of [-1,1]) {
      const rod=new THREE.Mesh(new THREE.BoxGeometry(.025,hang-y-h/2,.025),back.material);
      rod.position.set(back.position.x+Math.cos(rotation)*side*(w/2-.15),(hang+y+h/2)/2,back.position.z-Math.sin(rotation)*side*(w/2-.15));
      rod.raycast=()=>{};group.add(rod);
    }
    return m;
  }
  function lamp(x,z,color=0xffdfb8) {
    box(x,3.24,z,1.15,.1,.3,0x363d34);
    const lens=box(x,3.17,z,1,.025,.22,0xffe1ac);
    lens.material=new THREE.MeshBasicMaterial({color:0xffddaa});
    const light=new THREE.PointLight(color,16,10,2);light.position.set(x,2.95,z);group.add(light);
  }
  function floor(x0,x1,z0,z1,ceiling=3.4,drop=0) {
    box((x0+x1)/2,-.1-drop,(z0+z1)/2,x1-x0,.2,z1-z0,0xb7aa8d,workshopSurface('stone'));
    box((x0+x1)/2,ceiling+.1+drop,(z0+z1)/2,x1-x0,.2,z1-z0,0x7d7868);
  }
  // The alley starts within the ring wall's thickness, a hair below the ring's
  // floor and above its ceiling. It used to start 40cm out in the gallery,
  // coplanar with the ring's own floor and ceiling, and flickered against both.
  const mouth=WORLD.landingR+.15;
  floor(mouth,P.court.x0,-P.half,P.half,3.4,.004);
  floor(P.court.x0,P.court.x1,-P.court.half,P.court.half,P.court.height);
  // Between the court and the square the alley is a canyon open well above
  // the doors, as in the set (new-references 029-039): its ceiling used
  // to sit at 3.4m like the corridor's, and hid everything over the doors -
  // the upper storeys, their gallery, the stairs' landings and the very lamps
  // that light the alley. The walls run on up to it over the rooms' own.
  floor(P.court.x1,P.plaza.x0,-P.half,P.half,P.canyon);
  for(const side of [-1,1]) {
    const upper=box((P.court.x1+P.plaza.x0)/2,(3.4+P.canyon)/2,side*(P.half+.08),P.plaza.x0-P.court.x1,P.canyon-3.4+.02,.16,wallColor,getWallSurface(0));
    upper.material.normalScale.set(.3,.3);
  }
  floor(P.plaza.x0,P.plaza.x1,-P.plaza.half,P.plaza.half,P.plaza.height);
  for(const side of [-1,1]) {
    wall((mouth+P.court.x0)/2,side*P.half,P.court.x0-mouth,.16);
    wall((P.court.x1+34)/2,side*P.half,34-P.court.x1,.16);
    wall((52+P.plaza.x0)/2,side*P.half,P.plaza.x0-52,.16);
  }
  // The alley no longer dead-ends in a blank wall: the plaza's end wall closes it.
  for(const x of [24,35,39,43,47,51])lamp(x,0);
  dressCourtyard(group,box,sign);
  dressAlley(group,box,sign);
  // The head of the doorway in the ring wall, and the wing's name on it. The
  // strip used to hang loose in the opening.
  box(WORLD.landingR+WALL_THICKNESS/2,2.925,0,WALL_THICKNESS,.95,WORLD.corridorHalfW*2+.5,wallColor,wallSurface(0));
  sign('HABITAÇÃO · 28',WORLD.landingR-.02,2.72,0,-Math.PI/2,2.4);
  sign('APARTAMENTOS →',33.5,2.1,-P.half+.09,0,2);
  const record=sign('RESIDENCIAL · REGISTRO',25,1.65,-P.half+.1,0,1.5);
  interactables.push({mesh:record,station});

  for(const room of P.rooms) {
    // The door plane is the same for every room. `recess` deepens the NICHE in
    // front of it instead of pushing the leaf further into the room: offsetting
    // the plane made 28-B's open leaf swing across its own entrance, which the
    // other two escaped only by centimetres.
    const a=P.roomStart+room.index*P.roomWidth,b=a+P.roomWidth,s=room.side,cx=a+2.2,z=s*P.half;
    const nd=P.niche+(room.recess||0);
    floor(a,b,Math.min(s*P.half,s*P.outer),Math.max(s*P.half,s*P.outer));
    if(room.index===0)wall(a,s*(P.half+P.outer)/2,.16,P.outer-P.half);
    wall(b,s*(P.half+P.outer)/2,.16,P.outer-P.half);
    wall((a+b)/2,s*P.outer,6,.16);
    const left=cx-.75,right=cx+.75,nz=s*(P.half-nd);
    wall((a+left)/2,nz,left-a,.16);wall((right+b)/2,nz,b-right,.16);
    // Returns closing the sides of the niche back to the door plane.
    for(const jx of [left,right])wall(jx,s*(P.half-nd/2),.16,nd);
    box(cx,2.94,z,1.5,.92,.16);
    for(const x of [left,right])box(x,1.2,z,.09,2.4,.23,0x434a3e);
    box(cx,2.39,z,1.59,.09,.23,0x434a3e);
    // The frame's head is rounded into its jambs, like every opening in the
    // set (new-references 029-039): a fillet in each top corner, the leaf's
    // square corners tucked behind it. And the door stands a step up from the
    // alley, on a worn concrete stoop in its niche.
    for(const side of [-1,1]) {
      const r=.3,f=new THREE.Shape();
      // Drawn mirrored rather than scaled by -1, which would turn its faces inside out.
      if(side>0){f.moveTo(0,0);f.lineTo(-r,0);f.absarc(-r,-r,r,Math.PI/2,0,true);}
      else{f.moveTo(0,0);f.lineTo(0,-r);f.absarc(r,-r,r,Math.PI,Math.PI/2,true);}
      f.lineTo(0,0);
      const g=new THREE.ExtrudeGeometry(f,{depth:.23,bevelEnabled:false,curveSegments:8});
      g.translate(0,0,-.115);
      const fillet=new THREE.Mesh(g,FRAME_MAT);fillet.position.set(cx+side*.705,2.345,z);fillet.raycast=()=>{};group.add(fillet);
    }
    box(cx,.05,z-s*.25,1.72,.1,.46,0x8a8a80,getWallSurface(0));
    sign(room.label,cx,2.69,z-s*.1,s>0?Math.PI:0,2.3);
    lamp(a+2.5,s*4.9);

    // Hinged doors have matching collision footprints in both states.
    const doorColor=room.kind==='home'?[0x794f3e,0x3b4b59,0x657063][room.index]:0x68705a;
    const door=box(cx,1.17,z,1.4,2.32,.08,doorColor,workshopSurface('paint'));
    // Recessed panels and varied paint follow the paired doors in set photo 17.
    if(room.kind==='home') {
      const panelMat=new THREE.MeshStandardMaterial({color:doorColor,roughness:.8,metalness:.15});
      const panelGeo=new THREE.BoxGeometry(.51,.46,.012);
      for(const face of [-1,1])for(const x of [-.29,.29])for(const y of [-.68,.02,.67]) {
        const panel=new THREE.Mesh(panelGeo,panelMat);panel.position.set(x,y,face*.047);panel.raycast=()=>{};door.add(panel);
      }
    }
    door.name=room.id;
    const obstacle=station.obstacles.at(-1);
    const handle=new THREE.Mesh(new THREE.BoxGeometry(.06,.2,.09),new THREE.MeshStandardMaterial({color:0xa59162,metalness:.65,roughness:.5}));
    handle.position.set(.48,0,-s*.075);handle.raycast=()=>{};door.add(handle);
    const otherHandle=handle.clone();otherHandle.position.z=s*.075;otherHandle.raycast=()=>{};door.add(otherHandle);
    let open=false;
    const setOpen=value=>{
      open=Boolean(value);
      door.position.set(open?cx-.7:cx,1.17,open?z+s*.7:z);
      door.rotation.y=open?-s*Math.PI/2:0;
      door.updateMatrix();door.updateMatrixWorld(true);
      Object.assign(obstacle,{x:door.position.x,z:door.position.z,hw:open?.04:.7,hd:open?.7:.04});
    };
    interactables.push({mesh:door,station,id:room.id,isDoor:true,setOpen,getOpen:()=>open,
      prompt:()=>`[E] ${open?'fechar':'abrir'} ${room.kind==='home'?'apartamento':'sala'}`,
      action:state=>{
        const next=!open,px=state.x*Math.cos(angle)+state.z*Math.sin(angle),pz=-state.x*Math.sin(angle)+state.z*Math.cos(angle);
        const dx=px-(next?cx-.7:cx),dz=pz-(next?z+s*.7:z);
        if(Math.hypot(Math.max(0,Math.abs(dx)-(next?.04:.7)),Math.max(0,Math.abs(dz)-(next?.7:.04)))<WORLD.playerRadius)return false;
        setOpen(next);return true;
      }});

    if(room.kind==='home') {
      // Two openings in the rear partition: bedroom and bathroom.
      const back=s*7.2;
      for(const [l,r] of [[a,a+1],[a+2.4,a+4.1],[a+5.5,b]])wall((l+r)/2,back,r-l,.12);
      for(const x of [a+1.7,a+4.8])box(x,2.91,back,1.4,.98,.12);
      wall(a+3.8,s*9,.12,3.6);
      // Living room: worn fabric sofa, timber table and kitchen counter.
      box(a+.65,.38,s*4.8,.9,.55,1.9,room.index===1?0x786d51:0x965f48);
      box(a+.22,.8,s*4.8,.18,.8,2,0x704a3c);
      box(a+3.1,.64,s*5.5,1.35,.09,.95,0xb19a70,workshopSurface('wood'));
      for(const dx of [-.5,.5])for(const dz of [-.32,.32])box(a+3.1+dx,.3,s*5.5+dz,.06,.6,.06,0x444b3f);
      box(b-.45,.46,s*4.8,.72,.92,2.9,0x7b826a,workshopSurface('paint'));
      box(b-.45,.94,s*4.8,.8,.055,3,0xc7bca0);
      box(b-.43,.98,s*4.25,.53,.025,.65,0x333e36);
      addCylinder(group,{x:b-.48,y:1.05,z:s*5.1,r:.11,h:.16,color:0xc6bda4});
      box(a+2.1,.012,s*5.1,2.8,.02,2.8,0x6e5240);
      // Bed, blanket, pillow and wardrobe, all outside the entrance routes.
      const bedW=room.index===0?1.05:1.55;
      box(a+1.5,.24,s*9.45,bedW,.38,2,0x514e3e,workshopSurface('wood'));
      box(a+1.5,.47,s*9.45,bedW,.17,2,0xc8b997);
      box(a+1.5,.57,s*9.15,bedW+.02,.025,1.3,room.index===2?0x9b7048:0x6a7b6a);
      box(a+1.5,.62,s*10.05,bedW*.7,.13,.4,0xd7cbb0);
      box(a+3.2,1,s*10.25,.85,2,.65,0x71634b,workshopSurface('wood'));
      // Bathroom: basin, WC and a shower tray with exposed pipework.
      box(b-.38,.83,s*8.1,.55,.15,.6,0xd0c7ad);
      addCylinder(group,{x:a+4.5,y:.3,z:s*10.1,r:.28,h:.55,color:0xc3bea9});
      box(a+4.5,.64,s*10.48,.6,.8,.22,0xb7b5a4);
      box(b-.55,.04,s*9.25,.9,.08,.95,0xaaa894);
      box(b-.18,1.25,s*9.25,.04,2.4,.04,0x666e63);
      lamp(a+1.7,s*8.5);lamp(a+4.8,s*8.5,0xd2d9c2);
      // Small potted plant; foliage uses shaded material, not emission.
      addCylinder(group,{x:b-.45,y:.25,z:s*6.5,r:.22,r2:.16,h:.45,color:0x896149});
      for(let i=0;i<5;i++) {
        const leaf=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshStandardMaterial({color:0x536746,roughness:1}));
        leaf.scale.set(.1,.36,.075);leaf.position.set(b-.45+.13*Math.cos(i*1.26),.66,s*6.5+.13*Math.sin(i*1.26));leaf.rotation.z=(i-2)*.22;group.add(leaf);
      }
    } else {
      for(let i=0;i<3;i++) {
        const x=a+1+i*1.8,rz=s*9.6;
        if(room.kind==='laundry') {
          box(x,.55,rz,1.15,1.1,.95,0xa5a68f,workshopSurface('paint'));
          const drum=addCylinder(group,{x,y:.57,z:rz-s*.49,r:.33,h:.04,color:0x333c35,rotX:Math.PI/2});
          drum.receiveShadow=true;
          box(x,.98,rz-s*.49,.56,.08,.04,0x4c564a);
        } else if(room.kind==='store') {
          for(const y of [.16,.9,1.65,2.4])box(x,y,rz,1.55,.07,.9,0x625c47,workshopSurface('wood'));
          for(const dx of [-.72,.72])box(x+dx,1.3,rz,.06,2.6,.85,0x3e493d);
          for(const y of [.45,1.2,1.95])box(x,y,rz,.8,.48,.65,0x877751,workshopSurface('wood'));
        } else {
          box(x,.88,rz,1.6,.1,1,0x9d8c66,workshopSurface('wood'));
          for(const dx of [-.65,.65])box(x+dx,.42,rz,.09,.84,.8,0x414b3c);
          box(x,1.1,rz,.5,.3,.35,0x5e6855,workshopSurface('paint'));
        }
      }
      lamp(a+3,s*8.6);
      sign(room.kind==='laundry'?'DEVOLVA OS CESTOS':room.kind==='store'?'CONTROLE DE MATERIAIS':'REPARAR · REUTILIZAR',a+3,2.1,s*(P.outer-.1),s>0?Math.PI:0,2.5);
    }
  }
  group.traverse(o=>{if(o.isMesh)o.receiveShadow=true;});
  return group;
}
