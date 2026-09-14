import * as THREE from "three";
import { appendSweptSolid, meshData, stairSections } from "../geometry.js";
import { geometryFromData } from "./primitives.js";
import { WORLD } from "../config.js";
import { slopeOuterRadius } from "../collision.js";
import { lerp } from "../mathutils.js";
import { makePlaqueTexture, mulberry32 } from "../textures.js";
import { getStructureSurface } from "./materials.js";
import { buildParapet } from "./fixtures.js";
import { PARAPET_THICKNESS } from "./primitives.js";

export function buildTransit(scene, layout, slope) {
  const angleSpan = slope.thetaEnd - slope.thetaStart;
  const sections = stairSections(slope, WORLD.stepsPerTurn);

  const treadMat = new THREE.MeshStandardMaterial({ ...getStructureSurface(), color: 0xb1b2a8, roughness: 0.94, metalness: 0.01, side: THREE.DoubleSide });
  const data = meshData();
  const nosings = meshData();
  const grooves = meshData();
  const rand = mulberry32(901 + slope.fromIndex);
  // Wedges meet along radial edges. Rectangular boxes used to leave holes
  // at the outer rim and overlap into a sawtooth silhouette at the centre.
  for (const section of sections) {
    const {t,y,start,end,thickness} = section;
    const uvStart = data.uvs.length;
    appendSweptSolid(data, {
      start, end, segments: 4,
      inner: WORLD.shaftR,
      outer: u => slopeOuterRadius((lerp(start,end,u)-slope.thetaStart)/angleSpan),
      bottom: y - thickness, top: y,
    });
    // Offset each tread's UVs while retaining metre scale. Reusing UV origin
    // repeated precisely the same crack on every step of the spiral.
    const du = rand(), dv = rand();
    for (let j = uvStart; j < data.uvs.length; j += 2) {
      data.uvs[j] += du; data.uvs[j + 1] += dv;
    }
    if (slope.fromIndex < 2) {
      const edge = end;
      appendSweptSolid(nosings, { start: Math.max(slope.thetaStart, edge - .015), end: edge, segments: 4,
        inner: WORLD.shaftR + .3, outer: slopeOuterRadius(t) - .3, bottom: y, top: y + .003 });
      // Narrow, flush anti-slip inserts behind the worn concrete edge.
      // Surface detail only: the collision profile remains a smooth descent.
      for (const inset of [.022, .031]) {
        const end = edge - inset;
        if (end - .002 <= slope.thetaStart) continue;
        appendSweptSolid(grooves, { start: end - .002, end, segments: 4,
          inner: WORLD.shaftR + .45, outer: slopeOuterRadius(t) - .45,
          bottom: y, top: y + .004 });
      }
    }
  }
  // Continuous structural soffit joins the undersides, including the flare.
  // Its top remains below every tread and overlaps each riser vertically.
  appendSweptSolid(data, {
    start:slope.thetaStart,end:slope.thetaEnd,segments:sections.length*4,
    inner:WORLD.shaftR,outer:slopeOuterRadius,
    bottom:t=>lerp(slope.yStart,slope.yEnd,t)-.55,
    top:t=>lerp(slope.yStart,slope.yEnd,t)-sections[0].rise/2-.01,
  });
  const treads = new THREE.Mesh(geometryFromData(data), treadMat);
  treads.name = `stair-treads-${slope.fromIndex}`;
  treads.castShadow = treads.receiveShadow = true;
  scene.add(treads);
  if (nosings.positions.length) scene.add(new THREE.Mesh(geometryFromData(nosings), new THREE.MeshStandardMaterial({ ...getStructureSurface(), color: 0xb9b39e, roughness: .78, side: THREE.DoubleSide })));

  if (grooves.positions.length) {
    const inserts = new THREE.Mesh(geometryFromData(grooves), new THREE.MeshStandardMaterial({ color: 0x55564a, roughness: .92 }));
    inserts.name = `stair-inserts-${slope.fromIndex}`;
    inserts.receiveShadow = true;
    inserts.raycast = () => {};
    scene.add(inserts);
  }

  // Inset onto the treads (see buildParapet): the outer wall pulls in, the
  // shaft-side wall pushes out, so neither overhangs the step it sits on.
  const half = PARAPET_THICKNESS / 2;
  // Set photographs in new-references confirm a raised metal handrail above
  // the continuous concrete guard, including its support brackets.
  buildParapet(scene, slope.thetaStart, slope.thetaEnd, slope.yStart, slope.yEnd, (t) => slopeOuterRadius(t), [], -half, "handrail");
  buildParapet(scene, slope.thetaStart, slope.thetaEnd, slope.yStart, slope.yEnd, () => WORLD.shaftR, [], half, "handrail");

  // One numbered plaque per full turn, mounted on the pole, facing outward
  // along the descent so it reads naturally as the player passes it.
  const fromLevel = layout.stations[slope.fromIndex].level;
  const toLevel = layout.stations[slope.toIndex].level;
  const turns = Math.floor(angleSpan / (Math.PI * 2));
  let lastLevel = fromLevel;
  for (let k = 1; k <= turns; k++) {
    const theta = slope.thetaStart + k * Math.PI * 2;
    if (theta >= slope.thetaEnd) break;
    const t = (theta - slope.thetaStart) / angleSpan;
    const y = lerp(slope.yStart, slope.yEnd, t);
    let level = fromLevel;
    lastLevel = level;

    const tex = makePlaqueTexture([`${fromLevel} ↓ ${toLevel}`], { width: 320, height: 180, fg: 0xd8cba4, bg: 0x0c0d0e });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.28), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    const plaqueR = WORLD.shaftR + 0.02;
    mesh.position.set(plaqueR * Math.cos(theta), y + 1.1, plaqueR * Math.sin(theta));
    mesh.rotation.y = Math.PI / 2 - theta;
    scene.add(mesh);
  }
}

// ---------------------------------------------------------------------------
// Station shell: a near-360 degree flat hall around the shaft (walls with a
// few doorway gaps + porthole windows + support pillars with tube lights),
// plus a continuous guard rail around the inner shaft opening so every point
// on the hall can look straight down/up through the stairwell.
// ---------------------------------------------------------------------------
