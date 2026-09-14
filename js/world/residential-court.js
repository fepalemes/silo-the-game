import * as THREE from 'three';
import { RESIDENTIAL as P } from '../residential-layout.js';
import { workshopSurface, getWallSurface } from './materials.js';

// An inhabited alley junction, inspired by the supplied set plans and photos.
// Ground-floor circulation is real; upper windows/balconies are scenic facades.
export function dressCourtyard(group,box,sign) {
  const c=P.court,mid=(c.x0+c.x1)/2,stone=getWallSurface(0);
  const dark=new THREE.MeshStandardMaterial({color:0x344139,roughness:.7,metalness:.3});
  const frame=new THREE.MeshStandardMaterial({color:0x847c62,roughness:.8,metalness:.3});
  const glass=new THREE.MeshStandardMaterial({color:0xbaa876,emissive:0xc59143,emissiveIntensity:.32,roughness:.5});
  function rounded(w,h,r) {
    const s=new THREE.Shape(),x=-w/2,y=-h/2;
    s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
    s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
    s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return new THREE.ShapeGeometry(s,10);
  }
  function window(x,y,z,rotation,w=1.25,h=1.2) {
    for(const [dw,dh,mat,offset] of [[.16,.16,frame,0],[0,0,glass,.008]]) {
      const m=new THREE.Mesh(rounded(w+dw,h+dh,.2),mat);
      m.position.set(x,y,z);m.rotation.y=rotation;
      m.position.x+=Math.sin(rotation)*offset;m.position.z+=Math.cos(rotation)*offset;
      m.raycast=()=>{};group.add(m);
    }
  }
  const wall=(x,z,w,d,h=c.height,y=h/2,color=0x8c8878)=>{
    const m=box(x,y,z,w,h,d,color,stone);m.material.normalScale.set(.25,.25);return m;
  };
  for(const side of [-1,1]) {
    wall(mid,side*c.half,7,.22);
    // Return walls close the enlarged court around both corridor openings.
    for(const x of [c.x0,c.x1])wall(x,side*(c.half+P.half)/2,.2,c.half-P.half);
    const face=side*(c.half-.13),rot=side>0?Math.PI:0;
    for(const x of [27.5,31.3]) {
      box(x,4.68,side*(c.half-.16),2.5,2.25,.17,side>0?0x6d7972:0x8b6550,workshopSurface('paint'));
      window(x,4.8,side*(c.half-.27),rot,1.2,1.25);
      window(x,1.85,face,rot,.6,1.35);
      // Shallow balconies: overhead, outside the player's height.
      box(x,3.65,side*(c.half-.43),2.5,.16,.9,0x686858);
      box(x,4.53,side*(c.half-.84),2.5,.06,.05,0x344139);
      for(let dx=-1.15;dx<=1.15;dx+=.23)box(x+dx,4.1,side*(c.half-.84),.025,.85,.025,0x344139);
      const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,6.25,8),dark);
      pipe.position.set(x+1.35,3.125,face);group.add(pipe);
      // Narrow wall lamps with visible brackets, below the upper balconies.
      box(x,2.85,side*(c.half-.25),.22,.54,.22,0x455044);
      const lens=box(x,2.85,side*(c.half-.38),.15,.4,.04,0xffd9a1);
      lens.material=new THREE.MeshBasicMaterial({color:0xffd7a0});
      const light=new THREE.PointLight(0xffd6a3,20,9,2);light.position.set(x,2.75,side*(c.half-.6));group.add(light);
    }
    // Benches create a place to stop without occupying either through route.
    box(mid,.43,side*5.25,1.8,.12,.52,0x9a8059,workshopSurface('wood'));
    box(mid,.75,side*5.52,1.8,.6,.09,0x73624b,workshopSurface('wood'));
    for(const dx of [-.7,.7])box(mid+dx,.2,side*5.25,.08,.4,.45,0x3e483c);
  }
  // A central service kiosk splits the straight sightline into two alleys.
  // Its full solid volume is registered as one collider by the box helper.
  wall(mid,0,2.4,1.6,3.1,1.55,0x667568);
  box(mid,3.13,0,2.65,.16,1.85,0x3d4b42);
  for(const side of [-1,1]) {
    window(mid,1.8,side*.815,side>0?0:Math.PI,1.5,.9);
    sign('MANUTENÇÃO · 28',mid,2.7,side*.825,side>0?0:Math.PI,1.85);
  }
  sign('APARTAMENTOS / SERVIÇOS →',mid,2.5,-.02,-Math.PI/2,2.4).position.x=c.x0+.02;
  // Roof ribs and a translucent-looking central light well. No opening into
  // the floor above: the entire court stays below the 7.6 m floor spacing.
  for(const x of [26.2,28.4,30.6,32.8])box(x,6.24,0,.17,.36,12,0x4c564b);
  for(const z of [-4,0,4])box(mid,6.24,z,7,.36,.17,0x4c564b);
  const roof=box(mid,6.39,0,6.5,.02,10.8,0xc2c4a3);
  roof.material=new THREE.MeshStandardMaterial({color:0xb3b69a,emissive:0xc3b37f,emissiveIntensity:.2,roughness:.8});
  const fill=new THREE.PointLight(0xdedac1,55,16,2);fill.position.set(mid,5.8,0);group.add(fill);
}
