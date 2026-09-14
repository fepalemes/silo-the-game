import * as THREE from 'three';
import { RESIDENTIAL as P } from '../residential-layout.js';
import { workshopSurface, getWallSurface } from './materials.js';
import { placeSign, notice, shopSign } from './signs.js';

// Rounded window plates, shared with the court so both read as one building.
// Frames and glass are single shared materials: the alley alone would otherwise
// allocate a material per opening.
const FRAME = new THREE.MeshStandardMaterial({color:0x847c62,roughness:.8,metalness:.3});
const GLASS_LIT = new THREE.MeshStandardMaterial({color:0xbaa876,emissive:0xc59143,emissiveIntensity:.32,roughness:.5});
const GLASS_DARK = new THREE.MeshStandardMaterial({color:0x2b2f2c,roughness:.45,metalness:.1});
const RAIL = new THREE.MeshStandardMaterial({color:0x344139,roughness:.7,metalness:.3});

export function roundedPlate(w,h,r) {
  const s=new THREE.Shape(),x=-w/2,y=-h/2;
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
  s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
  s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return new THREE.ShapeGeometry(s,10);
}

// `window(x,y,z,rotation,w,h,lit)` in the group's local frame. Never a collider:
// these are plates on a wall face, and every caller places them above 1.8 m.
export function makeWindow(group) {
  return function window(x,y,z,rotation,w=1.25,h=1.2,lit=true) {
    for(const [dw,dh,mat,offset] of [[.16,.16,FRAME,0],[0,0,lit?GLASS_LIT:GLASS_DARK,.008]]) {
      const m=new THREE.Mesh(roundedPlate(w+dw,h+dh,.2),mat);
      m.position.set(x,y,z);m.rotation.y=rotation;
      m.position.x+=Math.sin(rotation)*offset;m.position.z+=Math.cos(rotation)*offset;
      m.raycast=()=>{};group.add(m);
    }
  };
}

// The alley proper: blocks projecting from alternating sides, the storeys that
// overhang them, and the square the route ends in. Ground-floor volumes are
// real colliders; everything above head height is facade.
export function dressAlley(group,box,sign) {
  const window=makeWindow(group);
  const stone=getWallSurface(0);
  const face=(x,y,z,w,h,d,color)=>{const m=box(x,y,z,w,h,d,color,stone);m.material.normalScale.set(.25,.25);return m;};

  // --- Projecting blocks -----------------------------------------------------
  // Each one is a solid volume from the floor up, so it pinches the alley and
  // hides what is beyond it. Staggering the sides is what turns a corridor into
  // a route with corners.
  for(const j of P.jogs) {
    const w=j.x1-j.x0, cx=(j.x0+j.x1)/2, s=j.side;
    const outerZ=s*P.half, innerZ=s*(P.half-j.depth), midZ=(outerZ+innerZ)/2;
    face(cx,j.height/2,midZ,w,j.height,j.depth,j.color);
    // Sill course and skirting, matching the corridor walls' banding.
    box(cx,1.05,innerZ-s*.01,w+.01,.22,.04,0x743e30);
    box(cx,.12,innerZ-s*.01,w+.01,.18,.05,0x48483c);
    // Corner downpipe on the leading edge - the set photos have one at almost
    // every re-entrant corner.
    const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,j.height,8),RAIL);
    pipe.position.set(j.x0+.14,j.height/2,innerZ-s*.09);pipe.raycast=()=>{};group.add(pipe);
    // Windows on the alley face, and one on each return so the block reads as
    // inhabited from both approaches.
    window(cx,2.55,innerZ-s*.06,s>0?Math.PI:0,1.15,1.0);
    window(cx,4.3,innerZ-s*.06,s>0?Math.PI:0,1.0,.9,(cx|0)%2===0);
    for(const end of [j.x0,j.x1]) window(end,2.7,midZ,end===j.x0?-Math.PI/2:Math.PI/2,.7,.85,false);
    // A shallow balcony over the pinch, with a rail. Above 1.8 m, so free.
    box(cx,3.52,innerZ-s*.42,w-.2,.14,.8,0x686858);
    box(cx,4.36,innerZ-s*.78,w-.2,.06,.05,0x344139);
    for(let dx=-(w/2-.3);dx<=w/2-.3;dx+=.24) {
      const bar=new THREE.Mesh(new THREE.BoxGeometry(.025,.8,.025),RAIL);
      bar.position.set(cx+dx,3.97,innerZ-s*.78);bar.raycast=()=>{};group.add(bar);
    }
  }

  // --- Storeys over the alley walls -----------------------------------------
  // The reference model stacks apartments two and three deep above the walkway.
  // These are plates and boxes on the wall plane, never entered.
  const runs=[[36.95,41.45],[42.95,47.45],[48.95,52.0]];
  for(const side of [-1,1]) for(const [x0,x1] of runs) {
    const w=x1-x0, cx=(x0+x1)/2;
    // Setback upper storey, slightly proud of the wall below it.
    face(cx,4.55,side*(P.half-.3),w-.4,2.1,.5,side>0?0x9a9076:0x8e8a74);
    for(let i=0;i<Math.max(1,Math.round(w/2.4));i++) {
      const x=x0+(w/(Math.max(1,Math.round(w/2.4))+1))*(i+1);
      window(x,4.6,side*(P.half-.56),side>0?Math.PI:0,1.0,1.0,((x*3)|0)%3!==0);
      // Laundry poles under about half the windows.
      if(i%2===0) {
        const pole=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.7,6),RAIL);
        pole.position.set(x,3.85,side*(P.half-.62));pole.rotation.x=Math.PI/2;pole.raycast=()=>{};group.add(pole);
      }
    }
    // Continuous cornice so the storeys do not float over the wall head.
    box(cx,3.5,side*(P.half-.22),w,.18,.46,0x6f6b5b);

    // A gallery runs in front of the upper storey, with its own front doors:
    // in the concept art people live above the alley and walk along it, which
    // is most of why the alley reads as a canyon rather than a corridor.
    const gz=side*(P.half-1.0);
    box(cx,3.62,gz,w,.16,1.0,0x6d6a5c);
    box(cx,4.56,gz-side*.42,w,.07,.06,0x344139);
    for(let dx=-(w/2-.15);dx<=w/2-.15;dx+=.26) {
      const bar=new THREE.Mesh(new THREE.BoxGeometry(.028,.86,.028),RAIL);
      bar.position.set(cx+dx,4.13,gz-side*.42);bar.raycast=()=>{};group.add(bar);
    }
    // Two front doors per run, recessed into the upper facade.
    for(const dx of [-w/4,w/4]) {
      box(x0+w/2+dx,4.75,side*(P.half-.34),.95,2.05,.1,side>0?0x5d6a63:0x74523f);
      box(x0+w/2+dx,4.75,side*(P.half-.42),.78,1.9,.05,side>0?0x3b4b59:0x794f3e,workshopSurface('paint'));
    }
    // Duct run under the gallery, and a bundle of conduit climbing the wall.
    const duct=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,w,10),RAIL);
    duct.rotation.z=Math.PI/2;duct.position.set(cx,3.32,side*(P.half-.62));duct.raycast=()=>{};group.add(duct);
    for(const dz of [-.09,0,.09]) {
      const c=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,2.6,6),RAIL);
      c.position.set(x0+.34,2.1,side*(P.half-.2)+dz*side);c.raycast=()=>{};group.add(c);
    }
  }

  // --- External stairs up to the galleries -----------------------------------
  // Solid volumes, so their footprint comes from the shared plan and the width
  // check accounts for them. Scenic in the sense that the gallery above is not
  // walkable yet - these read as the way up rather than pretending to be one.
  for(const st of P.stairs) {
    const s=st.side, run=st.x1-st.x0, steps=8, zc=s*(P.half-st.depth/2);
    for(let i=0;i<steps;i++) {
      const x=st.x0+(run/steps)*(i+.5), h=.26+i*.42;
      box(x,h/2,zc,run/steps,h,st.depth,0x7b7768,getWallSurface(0));
    }
    // Stringer and posts along the open side.
    const edgeZ=s*(P.half-st.depth);
    const stringer=new THREE.Mesh(new THREE.BoxGeometry(run*1.06,.14,.08),RAIL);
    stringer.position.set((st.x0+st.x1)/2,2.0,edgeZ);stringer.rotation.z=Math.atan2(3.4,run);
    stringer.raycast=()=>{};group.add(stringer);
    for(let i=0;i<7;i++) {
      const post=new THREE.Mesh(new THREE.BoxGeometry(.035,.95,.035),RAIL);
      post.position.set(st.x0+.2+i*(run/7),.75+i*.42,edgeZ);post.raycast=()=>{};group.add(post);
    }
  }

  // --- Lamps strung down the middle of the alley -----------------------------
  // Conical shades on a cable, the single most recognisable fixture in the
  // alleyway renderings. The cable is one line; the shades hang off it.
  for(const x of [33.6,37.2,40.8,44.4,48.0,51.6]) {
    const cable=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.55,4),RAIL);
    cable.position.set(x,5.4,0);cable.raycast=()=>{};group.add(cable);
    const shade=new THREE.Mesh(new THREE.ConeGeometry(.34,.34,14,1,true),new THREE.MeshStandardMaterial({color:0x3f4640,roughness:.7,metalness:.35,side:THREE.DoubleSide}));
    shade.position.set(x,4.98,0);shade.raycast=()=>{};group.add(shade);
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),new THREE.MeshBasicMaterial({color:0xffd9a1}));
    bulb.position.set(x,4.86,0);bulb.raycast=()=>{};group.add(bulb);
    // An emissive bulb lights nothing on its own. These are the alley's main
    // source, so they carry real lights; the pool picks whichever are nearest.
    const lamp=new THREE.PointLight(0xffd2a0,20,11,2);lamp.position.set(x,4.6,0);group.add(lamp);
  }
  // A spine cable linking them, so the lamps are hung from something.
  const spine=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,19.2,4),RAIL);
  spine.rotation.z=Math.PI/2;spine.position.set(42.6,5.66,0);spine.raycast=()=>{};group.add(spine);

  // --- Shopfronts --------------------------------------------------------
  // The alley renderings are full of small trade. These go on the two squares
  // rather than in the alley itself: along the alley both walls are the niche
  // faces standing proud of the doors, so a counter there would be buried
  // behind a wall and would eat the only channel past the blocks. On a square
  // there is full-depth wall and room to stop. Facades, not interiors - the
  // ground floor's six doors are still the only rooms you can enter.
  const fronts = [
    {x:29.4,z:P.court.half,side: 1,id:'cantina',headline:'CANTINA 28',lines:['REFEIÇÕES · 06-20'],color:0x7a4636,lit:0xffb469},
    {x:29.4,z:P.court.half,side:-1,id:'reparos',headline:'REPAROS',lines:['TECIDOS E CALÇADOS'],color:0x3f5a52,lit:0xa8d8c0},
    {x:55.2,z:P.plaza.half,side:-1,id:'trocas',headline:'TROCAS',lines:['REGISTRE ANTES DE LEVAR'],color:0x5d5233,lit:0xffd79a},
  ];
  for(const f of fronts) {
    const s2=f.side, wallZ=s2*f.z;
    box(f.x,1.05,s2*(f.z-.18),2.1,2.1,.3,f.color,workshopSurface('paint'));
    box(f.x,2.32,s2*(f.z-.5),2.3,.1,.95,0x4a4f42);
    window(f.x,1.55,s2*(f.z-.34),s2>0?Math.PI:0,1.5,.85);
    // Warm spill from inside, and a lamp under the awning.
    const glow=new THREE.Mesh(new THREE.PlaneGeometry(1.4,.8),new THREE.MeshBasicMaterial({color:f.lit,toneMapped:false}));
    glow.position.set(f.x,1.55,s2*(f.z-.36));glow.rotation.y=s2>0?Math.PI:0;glow.raycast=()=>{};group.add(glow);
    const lamp=new THREE.PointLight(f.lit,14,7,2);lamp.position.set(f.x,2.15,s2*(f.z-.75));group.add(lamp);
    placeSign(group,shopSign(f.id,f.headline,f.lines),{x:f.x,y:2.72,z:wallZ-s2*.24,rotY:s2>0?Math.PI:0,width:1.9});
  }

  // Public-safety notices in the alley itself: it is circulation, and notice 2
  // is literally about keeping to one side of it. Both sit on stretches where
  // the wall is at full depth, not on a niche face or a door.
  placeSign(group,notice('stay-right'),{x:33.5,y:2.5,z:-P.half+.1,rotY:0,width:1.15});
  placeSign(group,notice('running'),{x:52.2,y:2.5,z:P.half-.1,rotY:Math.PI,width:1.1});

  // --- Small square at the end of the alley ---------------------------------
  dressPlaza(group,box,sign,window,face);
}

// Where the alley opens out: a dead end used as a meeting place rather than a
// turning circle, with seating, a standpipe and a notice wall.
function dressPlaza(group,box,sign,window,face) {
  const q=P.plaza, cx=(q.x0+q.x1)/2, h=q.height;
  for(const side of [-1,1]) {
    // Return walls from the corridor mouth out to the square's full width.
    face(q.x0,h/2,side*(q.half+P.half)/2,.22,h,q.half-P.half,0x8c8878);
    face(cx,h/2,side*q.half,q.x1-q.x0,h,.22,0x8c8878);
    // Two storeys of facade looking onto the square.
    for(const x of [cx-1.6,cx+1.6]) {
      window(x,2.5,side*(q.half-.14),side>0?Math.PI:0,1.1,1.15);
      window(x,4.6,side*(q.half-.14),side>0?Math.PI:0,1.0,1.0,((x*5)|0)%2===0);
      box(x,3.6,side*(q.half-.5),2.0,.14,.8,0x686858);
      box(x,4.44,side*(q.half-.86),2.0,.06,.05,0x344139);
    }
    // Benches around the edge, clear of the through route.
    box(cx,.43,side*(q.half-.8),2.4,.12,.52,0x9a8059,workshopSurface('wood'));
    box(cx,.75,side*(q.half-.53),2.4,.6,.09,0x73624b,workshopSurface('wood'));
  }
  // End wall with the notice board, and a standpipe the block shares.
  face(q.x1,h/2,0,.24,h,q.half*2,0x8c8878);
  box(q.x1-.16,1.9,0,.06,1.3,2.6,0x4b5347,workshopSurface('paint'));
  sign('AVISOS · HABITAÇÃO 28',q.x1-.22,2.72,0,-Math.PI/2,2.4);
  box(cx+1.9,.6,0,.5,1.2,.5,0x6a7263);
  const spout=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.5,8),RAIL);
  spout.position.set(cx+1.9,1.35,0);spout.raycast=()=>{};group.add(spout);
  sign('PRAÇA · 28',q.x0+.3,2.6,-q.half+.14,0,2);
  // Roof ribs and a light panel, matching the court's treatment.
  for(const x of [q.x0+1.4,cx,q.x1-1.4])box(x,h-.3,0,.17,.34,q.half*2,0x4c564b);
  const roof=box(cx,h-.12,0,q.x1-q.x0-1,.02,q.half*1.5,0xc2c4a3);
  roof.material=new THREE.MeshStandardMaterial({color:0xb3b69a,emissive:0xc3b37f,emissiveIntensity:.2,roughness:.8});
  const fill=new THREE.PointLight(0xdedac1,48,15,2);fill.position.set(cx,h-.9,0);group.add(fill);
}
