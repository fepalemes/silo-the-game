import * as THREE from "three";

function makeCanvas(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function toRgbString(hex, alpha = 1) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 2D value noise, tiling seamlessly over `period` cells so the
// texture can repeat without visible seams.
function makeTilingNoise(period, rand) {
  const grid = new Float32Array(period * period);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const smooth = (t) => t * t * (3 - 2 * t);
  return (u, v) => {
    const x = u * period;
    const y = v * period;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const at = (ix, iy) => grid[(((iy % period) + period) % period) * period + (((ix % period) + period) % period)];
    const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
    const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
}

// Derives a tangent-space normal map from a grayscale height canvas using a
// Sobel gradient. This is what actually stops flat-shaded concrete from
// looking like painted cardboard under the point lights.
function makeNormalMapFromHeight(heightCanvas, strength = 2.4) {
  const size = heightCanvas.width;
  const src = heightCanvas.getContext("2d").getImageData(0, 0, size, size).data;
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const outCtx = out.getContext("2d");
  const img = outCtx.createImageData(size, size);

  const h = (x, y) => {
    const xi = ((x % size) + size) % size;
    const yi = ((y % size) + size) % size;
    return src[(yi * size + xi) * 4] / 255;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx =
        h(x - 1, y - 1) + 2 * h(x - 1, y) + h(x - 1, y + 1) - (h(x + 1, y - 1) + 2 * h(x + 1, y) + h(x + 1, y + 1));
      const dy =
        h(x - 1, y - 1) + 2 * h(x, y - 1) + h(x + 1, y - 1) - (h(x - 1, y + 1) + 2 * h(x, y + 1) + h(x + 1, y + 1));
      let nx = dx * strength;
      let ny = dy * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz / len) * 0.5 * 255 + 127.5;
      img.data[i + 3] = 255;
    }
  }
  outCtx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(out);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}


// Branching hairline cracks. The production designer describes the fissures
// in the silo's walls as deliberate - "display the structure rather than
// hide it" - so they scale with how deep/worn a level is rather than being
// uniform noise.
function drawCracks(ctx, hCtx, size, rand, count) {
  for (let c = 0; c < count; c++) {
    let x = rand() * size;
    let y = rand() * size;
    let angle = rand() * Math.PI * 2;
    const segments = 14 + Math.floor(rand() * 22);
    let width = 0.9 + rand() * 1.3;

    for (let i = 0; i < segments; i++) {
      angle += (rand() - 0.5) * 0.9;
      const len = 3 + rand() * 9;
      const nx = x + Math.cos(angle) * len;
      const ny = y + Math.sin(angle) * len;

      ctx.strokeStyle = `rgba(0, 0, 0, ${0.3 + rand() * 0.3})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.stroke();

      // Recessed in the height field so the normal map catches the light.
      hCtx.strokeStyle = "rgba(40, 0, 0, 0.75)";
      hCtx.lineWidth = width + 0.6;
      hCtx.beginPath();
      hCtx.moveTo(x, y);
      hCtx.lineTo(nx, ny);
      hCtx.stroke();

      // Occasional branch.
      if (rand() < 0.16 && width > 0.6) {
        const ba = angle + (rand() < 0.5 ? 1 : -1) * (0.5 + rand() * 0.6);
        const bl = 4 + rand() * 10;
        ctx.lineWidth = width * 0.6;
        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.lineTo(nx + Math.cos(ba) * bl, ny + Math.sin(ba) * bl);
        ctx.stroke();
      }

      x = nx;
      y = ny;
      width *= 0.94;
      if (x < -10 || x > size + 10 || y < -10 || y > size + 10) break;
    }
  }
}

// Raw poured-concrete: large-scale blotching, fine aggregate grain,
// form-board seams with a chipped lower lip, and damp streaks running down
// from them. Returns the colour map plus a matching height canvas so a
// normal map can be derived from the same surface.
function drawConcrete(baseHex, { size, seed, streaks, seams, wear = 0 }) {
  const rand = mulberry32(seed * 9301 + 49297);
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const height = makeCanvas(size);
  const hCtx = height.getContext("2d");

  ctx.fillStyle = toRgbString(baseHex);
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = "rgb(128,128,128)";
  hCtx.fillRect(0, 0, size, size);

  // Large-scale patchiness: uneven pour, damp patches, old repairs.
  const coarse = makeTilingNoise(4, rand);
  const mid = makeTilingNoise(11, rand);
  const img = ctx.getImageData(0, 0, size, size);
  const hImg = hCtx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n = coarse(u, v) * 0.65 + mid(u, v) * 0.35;
      const shade = (n - 0.5) * (46 + wear * 40);
      const grain = (rand() - 0.5) * 26;
      const i = (y * size + x) * 4;
      img.data[i] = clamp255(img.data[i] + shade + grain);
      img.data[i + 1] = clamp255(img.data[i + 1] + shade + grain);
      img.data[i + 2] = clamp255(img.data[i + 2] + shade + grain * 0.9);
      const hv = 128 + (n - 0.5) * 40 + grain * 1.6;
      hImg.data[i] = hImg.data[i + 1] = hImg.data[i + 2] = clamp255(hv);
    }
  }
  ctx.putImageData(img, 0, 0);
  hCtx.putImageData(hImg, 0, 0);

  // Exposed aggregate: small darker pebbles that also read on the normal map.
  const pebbles = Math.floor(size * 1.4);
  for (let i = 0; i < pebbles; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.7 + rand() * 1.9;
    ctx.fillStyle = `rgba(0, 0, 0, ${0.05 + rand() * 0.12})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    hCtx.fillStyle = `rgba(${rand() > 0.5 ? 200 : 60}, 0, 0, 0.5)`;
    hCtx.beginPath();
    hCtx.arc(x, y, r, 0, Math.PI * 2);
    hCtx.fill();
  }

  if (seams) {
    const seamCount = 3 + Math.floor(rand() * 2);
    for (let i = 0; i < seamCount; i++) {
      const y = Math.floor((size / seamCount) * i + rand() * 6);
      // Recessed joint line plus the lighter lip of the pour below it.
      ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
      ctx.fillRect(0, y, size, 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      ctx.fillRect(0, y + 2, size, 1);
      hCtx.fillStyle = "rgb(70,70,70)";
      hCtx.fillRect(0, y, size, 2);
      hCtx.fillStyle = "rgb(168,168,168)";
      hCtx.fillRect(0, y + 2, size, 1);

      // Chips knocked out of the edge.
      const chips = 3 + Math.floor(rand() * 5);
      for (let c = 0; c < chips; c++) {
        const cx = rand() * size;
        const cw = 3 + rand() * 9;
        ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
        ctx.fillRect(cx, y - 1, cw, 3 + rand() * 2);
        hCtx.fillStyle = "rgb(96,96,96)";
        hCtx.fillRect(cx, y - 1, cw, 3);
      }

      // Tie-rod holes left by the formwork.
      for (let t = 0; t < 3; t++) {
        const tx = rand() * size;
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.beginPath();
        ctx.arc(tx, y + 10 + rand() * 12, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (streaks) {
    const streakCount = 5 + Math.floor(rand() * 6);
    for (let i = 0; i < streakCount; i++) {
      const x = rand() * size;
      const w = 4 + rand() * 16;
      const grad = ctx.createLinearGradient(x, 0, x, size);
      grad.addColorStop(0, "rgba(0, 0, 0, 0)");
      grad.addColorStop(0.45, `rgba(24, 22, 16, ${0.05 + rand() * 0.12})`);
      grad.addColorStop(1, `rgba(18, 16, 12, ${0.1 + rand() * 0.18})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x - w / 2, 0, w, size);
    }
    // A couple of rust bleeds for age.
    for (let i = 0; i < 2; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const grad = ctx.createLinearGradient(x, y, x, y + size * 0.4);
      grad.addColorStop(0, `rgba(120, 62, 24, ${0.12 + rand() * 0.1})`);
      grad.addColorStop(1, "rgba(120, 62, 24, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x - 3, y, 5 + rand() * 5, size * 0.4);
    }
  }

  // Damage scales with depth: the upper levels are kept clean, the lower
  // ones are damp, cracked and stained (see the production notes on aging).
  drawCracks(ctx, hCtx, size, rand, Math.round(1 + wear * 7));

  if (wear > 0.25) {
    // Damp patches creeping up from the bottom of the pour.
    const patches = Math.round(wear * 7);
    for (let i = 0; i < patches; i++) {
      const px = rand() * size;
      const py = rand() * size;
      const pr = size * (0.05 + rand() * 0.16);
      const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
      grad.addColorStop(0, `rgba(22, 26, 24, ${0.1 + wear * 0.22})`);
      grad.addColorStop(1, "rgba(22, 26, 24, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    }

    // Efflorescence / mineral bloom around the damp.
    for (let i = 0; i < Math.round(wear * 5); i++) {
      const px = rand() * size;
      const py = rand() * size;
      const pr = size * (0.02 + rand() * 0.06);
      const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
      grad.addColorStop(0, `rgba(214, 214, 200, ${0.1 + wear * 0.14})`);
      grad.addColorStop(1, "rgba(214, 214, 200, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    }
  }

  // Patch repairs - lighter rectangles of newer concrete over old damage.
  for (let i = 0; i < Math.round(wear * 3); i++) {
    const px = rand() * size;
    const py = rand() * size;
    const pw = size * (0.08 + rand() * 0.14);
    const ph = size * (0.06 + rand() * 0.12);
    ctx.fillStyle = `rgba(206, 204, 192, ${0.09 + rand() * 0.08})`;
    ctx.fillRect(px, py, pw, ph);
    hCtx.fillStyle = "rgba(160,160,160,0.5)";
    hCtx.fillRect(px, py, pw, ph);
  }

  return { canvas, height };
}

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function finishColorTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function makeConcreteTexture(baseHex, { size = 512, seed = 1, streaks = true, seams = true, wear = 0 } = {}) {
  return finishColorTexture(drawConcrete(baseHex, { size, seed, streaks, seams, wear }).canvas);
}

// Colour map + matching normal map for one concrete surface. Callers share a
// single surface across many meshes of the same station, so the cost of
// deriving the normal map is paid once per station, not per wall.
export function makeConcreteSurface(baseHex, { size = 512, seed = 1, streaks = true, seams = true, normalStrength = 2.4, normalSize = 256, wear = 0 } = {}) {
  const { canvas, height } = drawConcrete(baseHex, { size, seed, streaks, seams, wear });

  // The Sobel pass is O(pixels), so derive the normal map from a downscaled
  // copy of the height field - at normal-map resolutions the difference is
  // invisible but the load-time cost drops by 4x.
  let heightSource = height;
  if (normalSize < size) {
    heightSource = makeCanvas(normalSize);
    const hctx = heightSource.getContext("2d");
    hctx.imageSmoothingEnabled = true;
    hctx.drawImage(height, 0, 0, normalSize, normalSize);
  }

  return {
    map: finishColorTexture(canvas),
    normalMap: makeNormalMapFromHeight(heightSource, normalStrength),
  };
}

// Diamond-plate / catwalk grating look for Mechanical, Water Treatment and
// the Generator floors.
export function makeGrateTexture(baseHex, accentHex, { size = 256 } = {}) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = toRgbString(baseHex);
  ctx.fillRect(0, 0, size, size);

  const cell = size / 8;
  ctx.strokeStyle = toRgbString(accentHex, 0.5);
  ctx.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cell);
    ctx.lineTo(size, i * cell);
    ctx.stroke();
  }
  ctx.fillStyle = toRgbString(0x000000, 0.25);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if ((x + y) % 2 === 0) {
        ctx.fillRect(x * cell + 3, y * cell + 3, cell - 6, cell - 6);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Small text/number plaque, e.g. floor signage or lore-panel titles.
export function makePlaqueTexture(lines, { width = 512, height = 256, bg = 0x101214, fg = 0xd7cdb0 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = toRgbString(bg, 0.92);
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = toRgbString(fg, 0.6);
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, width - 12, height - 12);

  ctx.fillStyle = toRgbString(fg);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const list = Array.isArray(lines) ? lines : [lines];
  const mainSize = Math.floor(height * 0.34);
  ctx.font = `bold ${mainSize}px 'Courier New', monospace`;
  const mainY = list[1] ? height * 0.4 : height * 0.5;
  ctx.fillText(list[0], width / 2, mainY);

  if (list[1]) {
    ctx.font = `${Math.floor(height * 0.16)}px 'Courier New', monospace`;
    ctx.fillText(list[1], width / 2, height * 0.72);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Hazy dead-world backdrop for the "Topo" viewport screen.
export function makeWastelandTexture({ size = 512, seed = 7 } = {}) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const rand = mulberry32(seed);

  const sky = ctx.createLinearGradient(0, 0, 0, size);
  sky.addColorStop(0, "#3c3630");
  sky.addColorStop(0.55, "#8a7156");
  sky.addColorStop(0.75, "#b08f62");
  sky.addColorStop(1, "#5c4a35");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "rgba(20, 16, 12, 0.5)";
  const horizon = size * 0.72;
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(0, horizon + 10);
  for (let x = 0; x <= size; x += size / 24) {
    ctx.lineTo(x, horizon + Math.sin(x * 0.02) * 10 + rand() * 14);
  }
  ctx.lineTo(size, size);
  ctx.closePath();
  ctx.fill();

  for (let i = 0; i < 900; i++) {
    const y = rand() * size;
    const fade = Math.max(0, (y - size * 0.1) / size);
    ctx.fillStyle = `rgba(30, 24, 18, ${0.02 + fade * 0.05})`;
    ctx.fillRect(rand() * size, y, 1 + rand() * 2, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
