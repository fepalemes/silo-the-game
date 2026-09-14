import * as THREE from "three";
import { appendSweptSolid, meshData } from "../geometry.js";
import { geometryFromData } from "./primitives.js";
import { WORLD } from "../config.js";
import { slopeOuterRadius } from "../collision.js";
import { lerp } from "../mathutils.js";
import { makePlaqueTexture } from "../textures.js";
import { getStructureSurface } from "./materials.js";
import { buildParapet } from "./fixtures.js";
import { PARAPET_THICKNESS } from "./primitives.js";

export function buildTransit(scene, layout, slope) {
  const angleSpan = slope.thetaEnd - slope.thetaStart;
  const anglePerStep = (Math.PI * 2) / WORLD.stepsPerTurn;
  const stepCount = Math.max(1, Math.round(angleSpan / anglePerStep));
  // Derived, not guessed: a tread thinner than the rise between consecutive
  // steps leaves a horizontal slot you can see the void through all the way
  // down the flight. Keeping it just over the rise makes the treads overlap
  // into a continuous helical ribbon.
  const stepThickness = WORLD.risePerTurn / WORLD.stepsPerTurn + 0.03;

  const treadMat = new THREE.MeshStandardMaterial({ ...getStructureSurface(), color: 0xb1b2a8, roughness: 0.94, metalness: 0.01, side: THREE.DoubleSide });
  const data = meshData();
  const nosings = meshData();
  // Wedges meet along radial edges. Rectangular boxes used to leave holes
  // at the outer rim and overlap into a sawtooth silhouette at the centre.
  for (let i = 0; i <= stepCount; i++) {
    const t = i / stepCount;
    const theta = lerp(slope.thetaStart, slope.thetaEnd, t);
    const y = lerp(slope.yStart, slope.yEnd, t);
    const halfStep = angleSpan / stepCount / 2;
    appendSweptSolid(data, {
      start: Math.max(slope.thetaStart, theta - halfStep),
      end: Math.min(slope.thetaEnd, theta + halfStep), segments: 4,
      inner: WORLD.shaftR, outer: slopeOuterRadius(t), bottom: y - stepThickness, top: y,
    });
    if (slope.fromIndex < 2) {
      const edge = Math.min(slope.thetaEnd, theta + halfStep);
      appendSweptSolid(nosings, { start: edge - .012, end: edge, segments: 1,
        inner: WORLD.shaftR + .3, outer: slopeOuterRadius(t) - .3, bottom: y, top: y + .003 });
    }
  }
  scene.add(new THREE.Mesh(geometryFromData(data), treadMat));
  if (nosings.positions.length) scene.add(new THREE.Mesh(geometryFromData(nosings), new THREE.MeshStandardMaterial({ color: 0x686b5d, roughness: .95, side: THREE.DoubleSide })));

  // Inset onto the treads (see buildParapet): the outer wall pulls in, the
  // shaft-side wall pushes out, so neither overhangs the step it sits on.
  const half = PARAPET_THICKNESS / 2;
  // "coping", not "rail": the stairwell edge in the references is one poured
  // concrete run, with no metal pipe along the top of it.
  buildParapet(scene, slope.thetaStart, slope.thetaEnd, slope.yStart, slope.yEnd, (t) => slopeOuterRadius(t), [], -half, "coping");
  buildParapet(scene, slope.thetaStart, slope.thetaEnd, slope.yStart, slope.yEnd, () => WORLD.shaftR, [], half, "coping");

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
