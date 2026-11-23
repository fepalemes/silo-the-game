// The interface, redrawn for a headset. The HTML HUD is not visible inside an
// immersive session - nothing from the page is - so the same information goes
// onto three small panels in the world instead:
//
//   wrist   level, zone and current objective, riding above the off hand
//   record  the text of the record being read, held up in front of the plaque
//   prompt  what the trigger will do, at the end of the pointing beam
//
// Each is one canvas, redrawn only when its text changes: a panel repainted
// every frame is a texture upload every frame.
import * as THREE from "three";

const INK = "#d7cdb0", DIM = "rgba(215,205,176,.62)", PAPER = "#0d0f11", RULE = "rgba(215,205,176,.45)";
export const ACCENT = 0xffb15a;
const MONO = "'Courier New', ui-monospace, monospace", SERIF = "Georgia, serif";

function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) { lines.push(line); line = word; }
    else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

function makePanel(width, height, metres) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(metres, metres * height / width),
    // Drawn as authored: no tone mapping, no fog, and never hidden behind the
    // wall it happens to be standing in.
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, fog: false, depthTest: false }),
  );
  mesh.renderOrder = 900;
  mesh.visible = false;
  mesh.raycast = () => {};
  mesh.frustumCulled = false;
  const ctx = canvas.getContext("2d");
  let drawn = null;
  // `key` is everything the drawing depends on; identical keys skip the work.
  function paint(key, draw) {
    if (key === drawn) return;
    drawn = key;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 3;
    ctx.strokeRect(5, 5, width - 10, height - 10);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    draw(ctx);
    texture.needsUpdate = true;
  }
  return { mesh, paint, width, height };
}

export function createXRHud({ scene, camera }) {
  const wrist = makePanel(512, 320, 0.17);
  const record = makePanel(1024, 720, 0.9);
  const prompt = makePanel(512, 96, 0.42);
  // Where the beam lands. The beam itself is a hairline and vanishes against
  // pale concrete; this dot is what actually says "you are pointing here".
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.007, 0.012, 24),
    new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, toneMapped: false, fog: false, depthTest: false }),
  );
  reticle.renderOrder = 901;
  reticle.visible = false;
  reticle.raycast = () => {};
  const root = new THREE.Group();
  root.add(wrist.mesh, record.mesh, prompt.mesh, reticle);
  scene.add(root);

  const level = { number: "", name: "", sub: "" };
  let mission = "", notice = "";
  function paintWrist() {
    wrist.paint(JSON.stringify([level, mission, notice]), (ctx) => {
      const pad = 26, inner = wrist.width - pad * 2;
      ctx.fillStyle = DIM;
      ctx.font = `19px ${MONO}`;
      ctx.fillText(level.number, pad, 46, inner);
      ctx.fillStyle = INK;
      ctx.font = `bold 40px ${MONO}`;
      ctx.fillText(level.name, pad, 100, inner);
      ctx.font = `23px ${MONO}`;
      ctx.fillStyle = DIM;
      ctx.fillText(level.sub, pad, 136, inner);
      ctx.strokeStyle = RULE;
      ctx.beginPath(); ctx.moveTo(pad, 162); ctx.lineTo(wrist.width - pad, 162); ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = `23px ${MONO}`;
      wrap(ctx, mission, inner).slice(0, 3).forEach((line, i) => ctx.fillText(line, pad, 200 + i * 30));
      ctx.fillStyle = DIM;
      ctx.font = `17px ${MONO}`;
      ctx.fillText(notice, pad, wrist.height - 22, inner);
    });
  }

  let recordOpen = false;
  const recordAnchor = new THREE.Vector3();
  function showRecord(title, paragraphs, anchor) {
    recordOpen = true;
    recordAnchor.copy(anchor);
    record.paint(JSON.stringify([title, paragraphs]), (ctx) => {
      const pad = 60, inner = record.width - pad * 2, top = 150, bottom = record.height - 80;
      ctx.fillStyle = INK;
      ctx.font = `34px ${MONO}`;
      ctx.fillText(title.toUpperCase(), pad, 92, inner);
      ctx.strokeStyle = RULE;
      ctx.beginPath(); ctx.moveTo(pad, 116); ctx.lineTo(record.width - pad, 116); ctx.stroke();
      // Shrink the type until the whole record fits rather than cutting it.
      for (let size = 38; size >= 22; size -= 2) {
        ctx.font = `${size}px ${SERIF}`;
        const leading = Math.round(size * 1.42), gap = Math.round(size * 0.7);
        const blocks = paragraphs.map((text) => wrap(ctx, text, inner));
        const total = blocks.reduce((sum, block) => sum + block.length * leading, 0) + gap * (blocks.length - 1);
        if (total > bottom - top && size > 22) continue;
        let y = top + size;
        for (const block of blocks) {
          for (const line of block) { ctx.fillText(line, pad, y); y += leading; }
          y += gap;
        }
        break;
      }
      ctx.fillStyle = DIM;
      ctx.font = `22px ${MONO}`;
      ctx.fillText("GATILHO · FECHAR", pad, record.height - 38);
    });
  }

  let promptText = null;
  const promptAt = new THREE.Vector3();
  function setPrompt(text, at) {
    promptText = text;
    if (!text) return;
    promptAt.copy(at);
    prompt.paint(text, (ctx) => {
      ctx.fillStyle = INK;
      ctx.font = `bold 32px ${MONO}`;
      ctx.textAlign = "center";
      ctx.fillText(text.toUpperCase(), prompt.width / 2, 60, prompt.width - 40);
    });
  }

  const head = new THREE.Vector3(), toward = new THREE.Vector3(), hand = new THREE.Vector3();
  // Called once per frame while presenting. `grip` is the off hand, or null
  // when no controller is tracked - then the wrist panel simply is not there.
  function update(grip) {
    camera.getWorldPosition(head);

    wrist.mesh.visible = Boolean(grip);
    if (grip) {
      grip.getWorldPosition(hand);
      // Above the hand and turned to the face, whatever way the wrist is
      // rolled: reading it should only ever take raising the arm.
      wrist.mesh.position.copy(hand).add(toward.set(0, 0.105, 0));
      wrist.mesh.lookAt(head);
    }

    record.mesh.visible = recordOpen;
    if (recordOpen) {
      // Held between the reader and the plaque, at arm's length when there is
      // room and closer (and proportionally smaller) when there is not.
      toward.subVectors(recordAnchor, head);
      const distance = THREE.MathUtils.clamp(toward.length() - 0.25, 0.45, 1.1);
      record.mesh.position.copy(head).addScaledVector(toward.normalize(), distance);
      record.mesh.scale.setScalar(distance / 1.1);
      record.mesh.lookAt(head);
    }

    prompt.mesh.visible = reticle.visible = Boolean(promptText) && !recordOpen;
    if (prompt.mesh.visible) {
      toward.subVectors(head, promptAt);
      const distance = toward.length();
      // Both keep roughly the same apparent size however far the target is.
      const size = THREE.MathUtils.clamp(distance / 1.5, 0.5, 1.6);
      reticle.position.copy(promptAt);
      reticle.scale.setScalar(size);
      reticle.lookAt(head);
      prompt.mesh.position.copy(promptAt).addScaledVector(toward.normalize(), Math.min(0.1, distance * 0.5));
      prompt.mesh.position.y -= 0.13 * size;
      prompt.mesh.scale.setScalar(size);
      prompt.mesh.lookAt(head);
    }
  }

  return {
    update,
    setVisible: (visible) => { root.visible = visible; },
    setLevel: (labels) => { Object.assign(level, labels); paintWrist(); },
    setMission: (text) => { mission = text; paintWrist(); },
    setNotice: (text) => { notice = text; paintWrist(); },
    showRecord,
    hideRecord: () => { recordOpen = false; },
    setPrompt,
  };
}

// Tunnel vision while the stick is moving the player. Narrowing the field of
// view during artificial motion removes most of the peripheral flow that the
// inner ear disagrees with - and the silo's stair is a continuous downward
// spiral, about the worst case there is. A shell around the head, clear in the
// middle and fading to black towards the edges.
export function createVignette(camera, { clear = 0.6, full = 0.92, strength = 0.9 } = {}) {
  const rings = [clear, full, 2.4], segments = 40, radius = 0.35;
  const positions = [], colors = [], indices = [];
  rings.forEach((angle, ring) => {
    for (let i = 0; i <= segments; i++) {
      const around = (i / segments) * Math.PI * 2;
      positions.push(Math.sin(angle) * Math.cos(around) * radius, Math.sin(angle) * Math.sin(around) * radius, -Math.cos(angle) * radius);
      colors.push(0, 0, 0, ring === 0 ? 0 : 1);
    }
  });
  for (let ring = 0; ring < rings.length - 1; ring++) {
    for (let i = 0; i < segments; i++) {
      const a = ring * (segments + 1) + i, b = a + segments + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, side: THREE.DoubleSide, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 950;
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.raycast = () => {};
  camera.add(mesh);

  // `travel` is 0-1: how hard the stick is pushing. Closes quickly and opens
  // a little slower, so short taps do not strobe.
  function update(travel, dt) {
    const target = Math.max(0, Math.min(1, travel)) * strength;
    const rate = target > material.opacity ? 9 : 4;
    material.opacity += (target - material.opacity) * (1 - Math.exp(-dt * rate));
    mesh.visible = material.opacity > 0.01;
  }
  // Leaving the session mid-stride must not leave a tint on the screen view.
  function reset() {
    material.opacity = 0;
    mesh.visible = false;
  }
  return { update, reset, mesh };
}
