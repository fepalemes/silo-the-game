import * as THREE from "three";

// Dust in the air: a few hundred motes drifting round the player, caught by
// the light. In a headset, with depth, it is what makes the shaft feel like a
// space full of air rather than an empty render - and it costs one draw call.
//
// The motes live in a box that wraps around the camera (in the shader), so
// they stay put in the world as the player moves and never run out.
export function createDust(scene, { count = 700, size = 14 } = {}) {
  const positions = new Float32Array(count * 3), seeds = new Float32Array(count);
  let s = 1234567;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    positions.set([rand() * size, rand() * size, rand() * size], i * 3);
    seeds[i] = rand();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uSize: { value: size }, uColor: { value: new THREE.Color(0xe2d6bf) } },
    vertexShader: /* glsl */ `
      uniform vec3 uCam; uniform float uTime; uniform float uSize;
      attribute float aSeed;
      varying float vAlpha;
      void main() {
        vec3 drift = vec3(sin(uTime * 0.11 + aSeed * 6.28) * 0.35, -uTime * 0.035 * (0.5 + aSeed), cos(uTime * 0.09 + aSeed * 3.1) * 0.35);
        vec3 p = mod(position + drift - uCam, uSize) - uSize * 0.5 + uCam;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = length(mv.xyz);
        // Fades out at the edge of the box and right at the eye.
        vAlpha = smoothstep(uSize * 0.5, uSize * 0.18, d) * smoothstep(0.25, 0.9, d) * (0.35 + 0.65 * aSeed);
        gl_PointSize = 820.0 * (0.012 + aSeed * 0.01) / max(0.1, -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying float vAlpha;
      void main() {
        float a = smoothstep(0.5, 0.05, length(gl_PointCoord - 0.5)) * vAlpha * 0.55;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor, a);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 10;
  points.raycast = () => {};
  points.name = "dust";
  scene.add(points);
  return {
    update(eye, dt) {
      material.uniforms.uCam.value.copy(eye);
      material.uniforms.uTime.value += dt;
    },
    points,
  };
}

// A soft round pool of light, for floors under lamps. One shared texture.
let poolTexture = null;
export function lightPoolTexture() {
  if (poolTexture) return poolTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  poolTexture = new THREE.CanvasTexture(canvas);
  return poolTexture;
}
