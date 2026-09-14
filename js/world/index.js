// Static geometry is grouped by elevation. A fixed light pool keeps shader
// cost independent of the 148 floors and avoids recompilation during travel.
import * as THREE from "three";
import { WING_OFFSETS, WORLD } from "../config.js";
import { createLightPool } from "../lightpool.js";
import { buildTransit } from "./stairs.js";
import { buildCentralPole, buildOuterShell, buildServiceRisers } from "./scenery.js";
import { buildStation } from "./station.js";
import { buildSafetySigns } from "./signs.js";

export function buildWorld(scene, layout) {
  const structure = new THREE.Group();
  scene.add(structure);
  buildOuterShell(structure, layout);
  buildCentralPole(structure, layout);
  buildServiceRisers(structure, layout);
  const chunks = [];
  const interactables = [];
  for (const slope of layout.slopes) {
    const group = new THREE.Group();
    buildTransit(group, layout, slope);
    scene.add(group);
    chunks.push({ group, y: (slope.yStart + slope.yEnd) / 2 });
  }
  layout.stations.forEach((station, i) => {
    const group = new THREE.Group();
    buildStation(group, station, {
      isFirst: i === 0, isLast: i === layout.stations.length - 1, detailed: !station.generated,
    }, interactables);
    scene.add(group);
    chunks.push({ group, y: station.y });
  });
  // Signage spans every level, so it is one instanced batch per notice rather
  // than meshes inside the per-elevation chunks: 592 quads that are never
  // culled still cost less than 592 objects that are.
  buildSafetySigns(scene, layout, {
    radius: WORLD.landingR,
    // Generated levels have an unbroken ring wall; only the authored ones cut
    // doorways for their wings.
    doorways: (station) => (station.generated ? [] : WING_OFFSETS.map((o) => (station.wingRotation || 0) + o)),
  });

  scene.updateMatrixWorld(true);
  const sources = [];
  const shadowLights = [];
  scene.traverse((object) => {
    if (object.isSpotLight && object.castShadow) shadowLights.push(object);
    if (object.isPointLight) sources.push({ object, position: object.getWorldPosition(new THREE.Vector3()), color: object.color.clone(), intensity: object.intensity, distance: object.distance });
  });
  for (const light of shadowLights) { scene.attach(light.target); scene.attach(light); }
  for (const source of sources) source.object.removeFromParent();
  const lights = Array.from({ length: 10 }, () => {
    const light = new THREE.PointLight(0xffffff, 0, 16, 2);
    scene.add(light);
    return light;
  });
  // Static matrices are baked once; only camera and pooled lights move.
  for (const root of [structure, ...chunks.map((c) => c.group)]) {
    root.updateMatrixWorld(true);
    root.traverse((o) => { o.matrixAutoUpdate = false; });
  }
  const pool = createLightPool(lights.length);
  let shadowRegionVisible = false;
  let lastX = Infinity, lastY = Infinity, lastZ = Infinity;
  function update(position, dt = 0.05) {
    if (Math.hypot(position.x-lastX,position.y-lastY,position.z-lastZ) >= 0.5) {
      lastX=position.x;lastY=position.y;lastZ=position.z;
      for (const chunk of chunks) chunk.group.visible = Math.abs(chunk.y-position.y) < 135;
      const visible = Math.abs(position.y-layout.stations[0].y) < 135;
      if (visible && !shadowRegionVisible) for (const light of shadowLights) light.shadow.needsUpdate=true;
      shadowRegionVisible=visible;
      pool.select(sources,position);
    }
    pool.advance(dt).forEach((slot,i) => {
      const light=lights[i],source=slot.source;
      light.intensity=source ? source.intensity*slot.weight : 0;
      if (source) {
        light.position.copy(source.position);
        light.color.copy(source.color);
        light.distance=source.distance;
      }
    });
  }

  return { interactables, update };
}
