import * as THREE from "three";
import { lerp } from "../mathutils.js";
import { PARAPET_HEIGHT, PARAPET_THICKNESS, SLAB_THICKNESS, WALL_THICKNESS } from "../config.js";
import { resolveSurface } from "./materials.js";

// Construction constants live in config.js with the rest of the layout
// numbers, so the Node tests (which cannot import three.js) can assert the
// relationships between them. Re-exported here because every builder reaches
// for them through primitives.
export { PARAPET_HEIGHT, PARAPET_THICKNESS, SLAB_THICKNESS, WALL_THICKNESS } from "../config.js";

export function addBox(group, { x, y, z, w, h, d, color = 0x808080, rotY = 0, emissive = 0x000000, emissiveIntensity = 0, map = null, repeat = null, roughness = 0.92, metalness = 0.04 }) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const surface = resolveSurface(map, repeat);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity,
    map: surface.map,
    normalMap: surface.normalMap,
    roughnessMap: surface.roughnessMap || null,
    roughness,
    metalness,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  group.add(mesh);
  const collision = group.userData.collision;
  if (collision) {
    mesh.updateMatrix();
    geo.computeBoundingBox();
    const box = geo.boundingBox.clone().applyMatrix4(mesh.matrix);
    if (box.max.y > 0.18 && box.min.y < 1.8) {
      collision.station.obstacles.push({ x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2, hw: (box.max.x - box.min.x) / 2, hd: (box.max.z - box.min.z) / 2, angle: collision.angle });
    }
  }
  return mesh;
}

export function addCylinder(group, { x, y, z, r, r2 = null, h, color = 0x808080, radialSegments = 16, rotX = 0, rotZ = 0, emissive = 0x000000, emissiveIntensity = 0, openEnded = false, roughness = 0.75, metalness = 0.12 }) {
  const geo = new THREE.CylinderGeometry(r, r2 === null ? r : r2, h, radialSegments, 1, openEnded);
  const mat = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity, roughness, metalness, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.x = rotX;
  mesh.rotation.z = rotZ;
  group.add(mesh);
  const collision = group.userData.collision;
  if (collision) {
    mesh.updateMatrix();
    geo.computeBoundingBox();
    const box = geo.boundingBox.clone().applyMatrix4(mesh.matrix);
    if (box.max.y > 0.18 && box.min.y < 1.8) {
      collision.station.obstacles.push({ x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2, hw: (box.max.x - box.min.x) / 2, hd: (box.max.z - box.min.z) / 2, angle: collision.angle });
    }
  }
  return mesh;
}

// Shared so 30-odd fixtures do not each allocate their own copy - the same
// per-instance-material trap that has cost this project load time twice.
const HARDWARE = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.6 });

// A bare emissive sphere floats in mid-air. Every lamp in the silo is a real
// fixture, and `mount` says what holds it up; the stem is generated from the
// distance to that anchor, so it cannot come adrift when a height changes.
//   "none"    - an indicator sitting on something the caller already drew (a
//               rack LED, a panel lamp) and so needs no hardware of its own.
//   "ceiling" - hung from `ceilingY` on a stem, with a canopy and a shade.
//   "post"    - stood on a stanchion rising from `baseY`.
export function addGlow(group, { x, y, z, r = 0.09, color = 0xffffff, mount = "none", ceilingY = null, baseY = 0 }) {
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.4) }));
  bulb.position.set(x, y, z);
  group.add(bulb);

  if (mount === "ceiling" && ceilingY !== null && ceilingY > y + r) {
    const drop = ceilingY - y;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, drop, 6), HARDWARE);
    stem.position.set(x, y + drop / 2, z);
    group.add(stem);
    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.05, 10), HARDWARE);
    canopy.position.set(x, ceilingY - 0.025, z);
    group.add(canopy);
    // Shallow shade over the bulb so the light reads as thrown downward.
    const shade = new THREE.Mesh(new THREE.ConeGeometry(r * 2.2, r * 1.6, 12, 1, true), HARDWARE);
    shade.position.set(x, y + r * 0.8, z);
    group.add(shade);
  } else if (mount === "post" && y - r > baseY + 0.05) {
    const h = y - r - baseY;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, h, 8), HARDWARE);
    post.position.set(x, baseY + h / 2, z);
    group.add(post);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.06, 10), HARDWARE);
    foot.position.set(x, baseY + 0.03, z);
    group.add(foot);
  }
  return bulb;
}

// Absolute-placement box: (r, theta) picks the world XZ position directly
// (matching the exact same convention as collision.js), used only for pieces
// that live in the un-rotated "landing" group.
export function addAbsBox(group, { r, theta, y, w, h, d, color, map = null }) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const surface = resolveSurface(map, null);
  const mat = new THREE.MeshStandardMaterial({
    color,
    map: surface.map,
    normalMap: surface.normalMap,
    roughnessMap: surface.roughnessMap || null,
    roughness: 0.93,
    metalness: 0.03,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(r * Math.cos(theta), y, r * Math.sin(theta));
  mesh.rotation.y = -theta;
  group.add(mesh);
  return mesh;
}

// Batches many copies of one shape into a single draw call. Everything
// repeated around a ring (doors, lanterns) goes through this - with twelve
// floors, building these as individual meshes costs hundreds of extra draw
// calls for no visual gain.
export function addInstancedBatch(group, geo, mat, placements) {
  if (placements.length === 0) return null;
  const mesh = new THREE.InstancedMesh(geo, mat, placements.length);
  const dummy = new THREE.Object3D();
  placements.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(p.rotX || 0, p.rotY || 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);
  return mesh;
}

// Flat annular wedge (a slice of a ring), built by hand from the same
// (r*cosθ, r*sinθ) formula collision.js uses, so it can never disagree with
// the walkable floor bounds it visually represents.
export function buildAnnularSectorGeometry(innerR, outerR, thetaStart, thetaEnd, segments = 48, tileSize = 3.5) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  // UVs are in world units / tileSize on BOTH axes. A fixed 0..1 across the
  // radius stretches the texture into concentric bands on a wide ring.
  const midR = (innerR + outerR) / 2;
  const arcLen = Math.abs(thetaEnd - thetaStart) * midR;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const theta = lerp(thetaStart, thetaEnd, t);
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    positions.push(innerR * cos, 0, innerR * sin);
    positions.push(outerR * cos, 0, outerR * sin);
    normals.push(0, 1, 0, 0, 1, 0);
    const u = (t * arcLen) / tileSize;
    uvs.push(u, innerR / tileSize, u, outerR / tileSize);
  }
  for (let i = 0; i < segments; i++) {
    const a = 2 * i;
    const b = 2 * i + 1;
    const c = 2 * (i + 1);
    const d = 2 * (i + 1) + 1;
    indices.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

// Vertical ruled band (a cylinder segment) built from the same
// (r*cosθ, r*sinθ) formula as everything else, so it can never disagree
// with the annular sectors it caps.
export function buildBandGeometry(radius, thetaStart, thetaEnd, yTop, yBottom, segments = 48, faceOutward = true) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const sign = faceOutward ? 1 : -1;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const theta = lerp(thetaStart, thetaEnd, t);
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    positions.push(radius * cos, yTop, radius * sin);
    positions.push(radius * cos, yBottom, radius * sin);
    normals.push(sign * cos, 0, sign * sin, sign * cos, 0, sign * sin);
    const u = (t * Math.abs(thetaEnd - thetaStart) * radius) / 2.5;
    uvs.push(u, (yTop - yBottom) / 2.5, u, 0);
  }
  for (let i = 0; i < segments; i++) {
    const a = 2 * i;
    const b = 2 * i + 1;
    const c = 2 * (i + 1);
    const d = 2 * (i + 1) + 1;
    indices.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

// A floor with real thickness: top surface, underside, and the edge fascia
// you actually see from across the void. Without the fascia a floor reads
// as an infinitely thin sheet of paper from any oblique angle.
export function addThickSlab(group, { innerR, outerR, thetaStart, thetaEnd, y = 0, thickness = 0.55, topMat, edgeMat, segments = 64, capOuter = false }) {
  const top = new THREE.Mesh(buildAnnularSectorGeometry(innerR, outerR, thetaStart, thetaEnd, segments), topMat);
  top.position.y = y;
  group.add(top);

  const under = new THREE.Mesh(buildAnnularSectorGeometry(innerR, outerR, thetaStart, thetaEnd, segments), edgeMat);
  under.position.y = y - thickness;
  group.add(under);

  group.add(new THREE.Mesh(buildBandGeometry(innerR, thetaStart, thetaEnd, y, y - thickness, segments, false), edgeMat));
  if (capOuter) {
    group.add(new THREE.Mesh(buildBandGeometry(outerR, thetaStart, thetaEnd, y, y - thickness, segments, true), edgeMat));
  }
  return top;
}

export function buildDiscGeometry(radius, segments = 40) {
  const geo = new THREE.CircleGeometry(radius, segments);
  geo.rotateX(-Math.PI / 2); // CircleGeometry is built in the XY plane; lay it flat.
  return geo;
}

// ---------------------------------------------------------------------------
// Dressing that makes the shaft read as an inhabited 144-level silo rather
// than twelve slabs floating in fog: lit windows, densely stacked decorative
// levels, full-height service risers and radial beams across the void.
// ---------------------------------------------------------------------------

export class HelixCurve extends THREE.Curve {
  constructor(thetaStart, thetaEnd, yStart, yEnd, yOffset, radiusFn) {
    super();
    this.thetaStart = thetaStart;
    this.thetaEnd = thetaEnd;
    this.yStart = yStart;
    this.yEnd = yEnd;
    this.yOffset = yOffset;
    this.radiusFn = radiusFn;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const theta = lerp(this.thetaStart, this.thetaEnd, t);
    const y = lerp(this.yStart, this.yEnd, t) + this.yOffset;
    const r = this.radiusFn(t);
    return target.set(r * Math.cos(theta), y, r * Math.sin(theta));
  }
}

// Splits [thetaStart, thetaEnd] into the spans that remain after cutting out
// each gap ({center, halfWidth}, in the same absolute theta), so a doorway
// (a bridge crossing this guard wall, say) leaves a real opening instead of
// solid wall the player can see but walk through.
export function splitAngleRangeByGaps(thetaStart, thetaEnd, gaps) {
  const clipped = gaps
    .map((g) => [Math.max(thetaStart, g.center - g.halfWidth), Math.min(thetaEnd, g.center + g.halfWidth)])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);

  const spans = [];
  let cursor = thetaStart;
  for (const [gapStart, gapEnd] of clipped) {
    if (gapStart > cursor) spans.push({ start: cursor, end: gapStart });
    cursor = Math.max(cursor, gapEnd);
  }
  if (cursor < thetaEnd) spans.push({ start: cursor, end: thetaEnd });
  return spans;
}

export function yAtTheta(theta, thetaStart, thetaEnd, yStart, yEnd) {
  const t = (theta - thetaStart) / (thetaEnd - thetaStart);
  return yStart + (yEnd - yStart) * t;
}

export function geometryFromData(data) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
  geo.setIndex(data.indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
