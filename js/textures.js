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

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Raw poured-concrete look: base tone, soft speckle noise, a few horizontal
// panel seams and vertical damp/rust streaks. Used for most walls/floors.
export function makeConcreteTexture(baseHex, { size = 256, seed = 1, streaks = true, seams = true } = {}) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const rand = mulberry32(seed * 9301 + 49297);

  ctx.fillStyle = toRgbString(baseHex);
  ctx.fillRect(0, 0, size, size);

  const speckles = Math.floor(size * size * 0.35);
  for (let i = 0; i < speckles; i++) {
    const shade = rand() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.02 + rand() * 0.05})`;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 1.5, 1 + rand() * 1.5);
  }

  if (seams) {
    const seamCount = 3 + Math.floor(rand() * 2);
    for (let i = 0; i < seamCount; i++) {
      const y = (size / seamCount) * i + rand() * 6;
      ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
      ctx.fillRect(0, y, size, 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      ctx.fillRect(0, y + 2, size, 1);
    }
  }

  if (streaks) {
    const streakCount = 4 + Math.floor(rand() * 5);
    for (let i = 0; i < streakCount; i++) {
      const x = rand() * size;
      const w = 4 + rand() * 14;
      const grad = ctx.createLinearGradient(x, 0, x, size);
      grad.addColorStop(0, "rgba(0, 0, 0, 0)");
      grad.addColorStop(0.5, `rgba(10, 12, 10, ${0.05 + rand() * 0.12})`);
      grad.addColorStop(1, `rgba(10, 12, 10, ${0.08 + rand() * 0.15})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x - w / 2, 0, w, size);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
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
