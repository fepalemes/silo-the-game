// One shared plan for rendering, collision and route checks. Metres, wing-local.
// The alley is deliberately not a straight corridor: the set plans show blocks
// pushed and pulled along an irregular route, so `jogs` are solid volumes that
// alternate sides and break the sightline, and the corridor opens into the
// court halfway and a social square at the end.
export const RESIDENTIAL = {
  start:22.6, end:58, half:2.2, roomStart:34, roomWidth:6, outer:10.8,
  court: { x0:26, x1:33, half:6, height:6.5 },
  plaza: { x0:52.4, x1:58, half:5.4, height:6.2 },
  // How far the walls flanking a door stand proud of it, leaving the leaf in a
  // niche. Each room's `recess` adds to this depth; the door plane itself is
  // the same everywhere, so every leaf swings into the same clear space.
  niche: .5,
  // Blocks projecting into the alley. Each sits in a clear run of wall between
  // two door niches, and they alternate sides going outward so the route zigzags.
  // The middle pair is deep enough to cross the centreline in opposite
  // directions, so the route genuinely changes direction instead of merely
  // narrowing; the outer pair only pinches.
  jogs: [
    {x0:34.1,x1:35.3,side:-1,depth:1.35,height:5.6,color:0x8f8b76},
    {x0:37.4,x1:39.2,side: 1,depth:2.55,height:6.1,color:0xa1957c},
    {x0:43.2,x1:45.0,side:-1,depth:2.35,height:5.4,color:0x94907a},
    {x0:49.2,x1:51.0,side: 1,depth:1.30,height:5.9,color:0x9c9078},
  ],
  // External stairs up to the galleries. Solid from the floor up, so they are
  // colliders like the jogs and must sit in full-width stretches: putting one
  // opposite a crossing jog strangles the only channel past it.
  stairs: [
    {x0:39.4,x1:41.45,side: 1,depth:1.08},
    {x0:45.3,x1:47.35,side:-1,depth:1.08},
  ],
  rooms: [
    {id:'apt-28-a',label:'28-A · INDIVIDUAL',side:1,index:0,kind:'home'},
    {id:'apt-28-b',label:'28-B · FAMILIAR',side:1,index:1,kind:'home',recess:.3},
    {id:'apt-28-c',label:'28-C · SUPERVISÃO',side:1,index:2,kind:'home',recess:.15},
    {id:'laundry-28',label:'LAVANDERIA',side:-1,index:0,kind:'laundry'},
    {id:'store-28',label:'DEPÓSITO',side:-1,index:1,kind:'store'},
    {id:'workshop-28',label:'OFICINA',side:-1,index:2,kind:'workshop'},
  ],
};
export function residentialAreas() {
  const p=RESIDENTIAL;
  return [{x0:p.court.x0,x1:p.court.x1,z0:-p.court.half,z1:p.court.half},{x0:p.plaza.x0,x1:p.plaza.x1,z0:-p.plaza.half,z1:p.plaza.half},{x0:p.start,x1:p.end,z0:-p.half,z1:p.half},...p.rooms.map(r=>({x0:p.roomStart+r.index*p.roomWidth,x1:p.roomStart+(r.index+1)*p.roomWidth,z0:r.side>0?p.half:-p.outer,z1:r.side>0?p.outer:-p.half}))];
}
const AREAS = residentialAreas();
// Rectangle union membership. Physical boundary walls handle player clearance.
export function inResidential(x,z) {
  return AREAS.some(r=>x>=r.x0 && x<=r.x1 && z>=r.z0 && z<=r.z1);
}
