// 裂冰湖 Crackline — 畫面、輸入、演出、音效
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Game, BOUNDS, cellAt } from './ice.js';
import { LEVELS, FISH_NAMES } from './levels.js';

const FAST = location.hash.includes('fast');
const SPD = FAST ? 4 : 1;
const $ = (id) => document.getElementById(id);
const TOP = 0, BOT = -0.16, THICK_TOP = 0.05, SNOW_TOP = 0.15, ROCK_TOP = 0.3, WATER_Y = -0.07;

// ---------------- 存檔 ----------------
const save = (() => { try { return JSON.parse(localStorage.getItem('crackline') || '{}'); } catch { return {}; } })();
save.stars = save.stars || {};
const store = () => { try { localStorage.setItem('crackline', JSON.stringify(save)); } catch {} };

// ---------------- three 基本 ----------------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe4f1fb);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
scene.add(new THREE.HemisphereLight(0xffffff, 0xb8d6ee, 1.15));
const sun = new THREE.DirectionalLight(0xfff6ea, 1.7);
sun.position.set(3.5, 9, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 7, bottom: -7, near: 1, far: 25 });
sun.shadow.bias = -0.0008;
scene.add(sun);

// ---------------- 程式畫的貼圖 ----------------
function canvasTex(size, draw, repeat) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.repeat.set(repeat, repeat);
  return t;
}
const rnd = Math.random;
const iceTex = canvasTex(512, (g, S) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 140; i++) { // 細刮痕
    g.strokeStyle = `rgba(160,200,230,${0.08 + rnd() * 0.12})`; g.lineWidth = 0.5 + rnd();
    const x = rnd() * S, y = rnd() * S, a = rnd() * 6.28, l = 10 + rnd() * 60;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let i = 0; i < 90; i++) { // 氣泡
    const x = rnd() * S, y = rnd() * S, r = 1 + rnd() * 3.5;
    g.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.4})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.strokeStyle = 'rgba(150,195,230,0.35)'; g.lineWidth = 0.6; g.stroke();
  }
});
const snowTex = canvasTex(256, (g, S) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${200 + rnd() * 40},${215 + rnd() * 30},245,${rnd() * 0.25})`; g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 1 + rnd() * 2); }
});
const frostTex = canvasTex(256, (g, S) => {
  const gr = g.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.55, 'rgba(235,248,255,0.28)'); gr.addColorStop(1, 'rgba(235,248,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.25 + rnd() * 0.3})`; g.lineWidth = 0.6 + rnd();
    const a = rnd() * 6.28, r0 = 30 + rnd() * 50, r1 = r0 + 10 + rnd() * 40;
    g.beginPath(); g.moveTo(S / 2 + Math.cos(a) * r0, S / 2 + Math.sin(a) * r0); g.lineTo(S / 2 + Math.cos(a) * r1, S / 2 + Math.sin(a) * r1); g.stroke();
  }
  for (let i = 0; i < 25; i++) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(S / 2 + (rnd() - 0.5) * S * 0.7, S / 2 + (rnd() - 0.5) * S * 0.7, 1 + rnd() * 2.5, 0, 7); g.fill(); }
});
frostTex.wrapS = frostTex.wrapT = THREE.ClampToEdgeWrapping;
const ringTex = canvasTex(128, (g, S) => {
  g.strokeStyle = '#fff'; g.lineWidth = 7; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 8, 0, 7); g.stroke();
});
ringTex.wrapS = ringTex.wrapT = THREE.ClampToEdgeWrapping;
const dotTex = canvasTex(64, (g, S) => {
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
});

const crackTex = (() => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, 'rgba(160,220,255,0)'); gr.addColorStop(0.3, 'rgba(190,232,255,0.35)');
  gr.addColorStop(0.44, 'rgba(255,255,255,1)'); gr.addColorStop(0.56, 'rgba(255,255,255,1)');
  gr.addColorStop(0.7, 'rgba(190,232,255,0.35)'); gr.addColorStop(1, 'rgba(160,220,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const jointTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, 'rgba(255,255,255,1)');
  gr.addColorStop(0.4, 'rgba(190,232,255,0.35)'); gr.addColorStop(1, 'rgba(160,220,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

// ---------------- 材質 ----------------
const M = {
  ice: new THREE.MeshStandardMaterial({ vertexColors: true, map: iceTex, transparent: true, opacity: 0.8, roughness: 0.06, metalness: 0.0, envMapIntensity: 1.1, depthWrite: false }),
  snow: new THREE.MeshStandardMaterial({ vertexColors: true, map: snowTex, roughness: 0.85, envMapIntensity: 0.5, emissive: 0x2a3440 }),
  rock: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, flatShading: true }),
  crack: new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  joint: new THREE.MeshBasicMaterial({ map: jointTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  crackGlow: new THREE.MeshBasicMaterial({ map: crackTex, color: 0x9fe3ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  crackOld: new THREE.MeshBasicMaterial({ map: crackTex, color: 0xd5e9f6, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide }),
  glow: new THREE.MeshBasicMaterial({ color: 0x9fe3ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
  preview: new THREE.MeshBasicMaterial({ map: crackTex, color: 0xffe066, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  previewJ: new THREE.MeshBasicMaterial({ map: jointTex, color: 0xffe066, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  sinkPrev: new THREE.MeshBasicMaterial({ color: 0x29d3a0, transparent: true, opacity: 0.32, depthWrite: false }),
  sinkBad: new THREE.MeshBasicMaterial({ color: 0xff5a45, transparent: true, opacity: 0.38, depthWrite: false }),
  frost: new THREE.MeshBasicMaterial({ map: frostTex, transparent: true, depthWrite: false }),
};
M.ice.map.repeat.set(1, 1);

// 水面與湖底
const floorMat = new THREE.ShaderMaterial({
  uniforms: { t: { value: 0 } },
  vertexShader: 'varying vec2 vP; void main(){ vec4 w = modelMatrix*vec4(position,1.); vP = w.xz; gl_Position = projectionMatrix*viewMatrix*w; }',
  fragmentShader: `uniform float t; varying vec2 vP;
    float c(vec2 p){ return abs(sin(p.x*3.1+t*0.9+sin(p.y*2.3+t*0.7))*sin(p.y*2.7-t*0.8+sin(p.x*1.9-t*0.5))); }
    void main(){ float k = pow(1.0-c(vP*1.3),6.0)*0.55 + pow(1.0-c(vP*2.1+3.0),8.0)*0.35;
      vec3 deep = vec3(0.01,0.05,0.12), lite = vec3(0.10,0.30,0.48);
      gl_FragColor = vec4(mix(deep, lite, clamp(k,0.,1.)), 1.0); }`,
});
const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 18), floorMat);
floor.rotation.x = -Math.PI / 2; floor.position.y = -1.1; scene.add(floor);
const waterMat = new THREE.MeshStandardMaterial({ color: 0x0e3b66, transparent: true, opacity: 0.55, roughness: 0.04, metalness: 0.1, envMapIntensity: 1.5, depthWrite: false });
const water = new THREE.Mesh(new THREE.PlaneGeometry(14, 18), waterMat);
water.rotation.x = -Math.PI / 2; water.position.y = WATER_Y; water.renderOrder = 1; scene.add(water);
// 範圍外的雪地
const outerSnow = new THREE.Group(); scene.add(outerSnow);
{
  const [X0, Z0, X1, Z1] = BOUNDS, B = 30;
  const mk = (x0, z0, x1, z1) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshStandardMaterial({ color: 0xffffff, map: snowTex, roughness: 0.85 }));
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, SNOW_TOP, (z0 + z1) / 2); m.receiveShadow = true; outerSnow.add(m);
  };
  mk(-B, -B, B, Z0 + 0.01); mk(-B, Z1 - 0.01, B, B); mk(-B, Z0, X0 + 0.01, Z1); mk(X1 - 0.01, Z0, B, Z1);
}

// ---------------- 模型 ----------------
const proto = {};
async function loadModels() {
  const ld = new GLTFLoader();
  for (const f of ['models/fish.glb', 'models/critters.glb']) {
    const g = await ld.loadAsync(f);
    g.scene.traverse((o) => { if (o.isMesh && o.parent === g.scene) proto[o.name] = o; });
    g.scene.children.forEach((o) => { proto[o.name] = o; });
  }
}
// 複製模型：把最長的水平軸轉成 +X、置中、縮放到指定長度
function makeModel(name, size, mode) {
  const src = proto[name];
  const inner = src.clone(true);
  inner.position.set(0, 0, 0); inner.rotation.set(0, 0, 0); inner.scale.set(1, 1, 1);
  inner.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.material = o.material.clone(); } });
  const box = new THREE.Box3().setFromObject(inner);
  const sz = box.getSize(new THREE.Vector3());
  const holder = new THREE.Group();
  const pivot = new THREE.Group();
  holder.add(pivot); pivot.add(inner);
  if (mode === 'fish') {
    // 魚：身體長度在 x 或 z
    if (sz.z > sz.x) inner.rotation.y = Math.PI / 2;
    const len = Math.max(sz.x, sz.z);
    const s = size / len;
    pivot.scale.setScalar(s);
    const b2 = new THREE.Box3().setFromObject(pivot);
    const c = b2.getCenter(new THREE.Vector3());
    pivot.position.sub(c);
  } else {
    const h = mode === 'height' ? sz.y : Math.max(sz.x, sz.z);
    pivot.scale.setScalar(size / h);
    const b2 = new THREE.Box3().setFromObject(pivot);
    const c = b2.getCenter(new THREE.Vector3());
    pivot.position.x -= c.x; pivot.position.z -= c.z; pivot.position.y -= b2.min.y;
  }
  return holder;
}

// ---------------- 冰面網格 ----------------
let G = null;            // 這局 Game
let world = null;        // 這局的 three 物件
const pts = (v) => G.ice.verts[v];

function geoBuilder() {
  const pos = [], nor = [], col = [], uv = [];
  const tmp = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  function tri(a, b, c, n, cl) {
    e1.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); e2.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    tmp.crossVectors(e1, e2);
    if (tmp.x * n[0] + tmp.y * n[1] + tmp.z * n[2] < 0) { const t = b; b = c; c = t; }
    for (const p of [a, b, c]) { pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]); col.push(cl[0], cl[1], cl[2]); uv.push(p[0] * 0.33, p[2] * 0.33); }
  }
  function build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeBoundingSphere();
    return g;
  }
  return { tri, build, get count() { return pos.length; } };
}
// 一格稜柱：top/bot 高度；sideTest(鄰格)決定要不要畫側面；ox/oz 平移（碎片用）
function addCell(B, ci, top, bot, color, sideTest, sideColor, ox = 0, oz = 0, bottom = false) {
  const c = G.ice.cells[ci];
  const R = c.ring.map((v) => [pts(v)[0] - ox, pts(v)[1] - oz]);
  const cx = c.x - ox, cz = c.z - oz;
  for (let k = 0; k < R.length; k++) {
    const a = R[k], b = R[(k + 1) % R.length];
    B.tri([cx, top, cz], [a[0], top, a[1]], [b[0], top, b[1]], [0, 1, 0], color);
    if (bottom) B.tri([cx, bot, cz], [a[0], bot, a[1]], [b[0], bot, b[1]], [0, -1, 0], sideColor);
  }
  c.edges.forEach((e) => {
    const E = G.ice.edges[e];
    const other = E.cells.find((o) => o !== ci);
    if (sideTest && !sideTest(other, e)) return;
    const a = [pts(E.a)[0] - ox, pts(E.a)[1] - oz], b = [pts(E.b)[0] - ox, pts(E.b)[1] - oz];
    let nx = b[1] - a[1], nz = -(b[0] - a[0]);
    const mx = (a[0] + b[0]) / 2 - cx, mz = (a[1] + b[1]) / 2 - cz;
    if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
    const l = Math.hypot(nx, nz) || 1; const n = [nx / l, 0, nz / l];
    B.tri([a[0], top, a[1]], [b[0], top, b[1]], [b[0], bot, b[1]], n, sideColor);
    B.tri([a[0], top, a[1]], [b[0], bot, b[1]], [a[0], bot, a[1]], n, sideColor);
  });
}

const lin = (r, g, b) => { const c = new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace); return [c.r, c.g, c.b]; };
function cellColor(c) {
  if (c.type === 'thick') { const v = 0.9 + c.jit * 0.06; return lin(v, v + 0.03, 1); }
  const f = c.frost;
  const base = [0.18 + c.jit * 0.06, 0.46 + c.jit * 0.06, 0.58 + c.jit * 0.05];
  return lin(base[0] + (0.86 - base[0]) * f, base[1] + (0.94 - base[1]) * f, base[2] + (1 - base[2]) * f);
}

function buildStatic() {
  const ice = G.ice;
  // 每格的霜（離岸越近越白）與小變化
  const dist = ice.cells.map((c) => (c.type === 'snow' ? 0 : 99));
  for (let it = 0; it < 5; it++) ice.cells.forEach((c, i) => {
    if (dist[i] === 0) return;
    for (const e of c.edges) for (const o of ice.edges[e].cells) if (o !== i) dist[i] = Math.min(dist[i], dist[o] + 1);
  });
  ice.cells.forEach((c, i) => { c.frost = Math.max(0, 1 - (dist[i] - 1) / 3) * 0.55; c.jit = Math.sin(i * 12.9898) * 0.5 + 0.5; });
  // 雪地＋岩石（不會變）
  const S = geoBuilder(), Rk = geoBuilder();
  ice.cells.forEach((c, i) => {
    if (c.type !== 'snow') return;
    if (c.rock) {
      const v = 0.42 + c.jit * 0.12;
      addCell(Rk, i, ROCK_TOP + c.jit * 0.12, -0.4, [v * 0.85, v * 0.92, v], (o) => o === undefined || ice.cells[o].type !== 'snow' || !ice.cells[o].rock, [v * 0.7, v * 0.75, v * 0.82]);
    } else {
      const v = 0.95 + c.jit * 0.05;
      addCell(S, i, SNOW_TOP, -0.4, [v, v, 1], (o) => o === undefined || ice.cells[o].type !== 'snow' || ice.cells[o].rock, [0.86, 0.92, 0.98]);
    }
  });
  const snow = new THREE.Mesh(S.build(), M.snow); snow.receiveShadow = true;
  const rock = new THREE.Mesh(Rk.build(), M.rock); rock.castShadow = rock.receiveShadow = true;
  world.root.add(snow, rock);
}

function buildIceMesh() {
  if (world.iceMesh) { world.root.remove(world.iceMesh); world.iceMesh.geometry.dispose(); }
  const ice = G.ice, B = geoBuilder();
  ice.cells.forEach((c, i) => {
    if (c.type !== 'ice' && c.type !== 'thick') return;
    const top = c.type === 'thick' ? THICK_TOP : TOP;
    addCell(B, i, top, BOT, cellColor(c), (o) => {
      if (o === undefined) return true;
      const t = ice.cells[o].type;
      if (t === 'snow') return false;
      if (t === 'ice' && c.type === 'thick') return true;
      return t !== 'ice' && t !== 'thick';
    }, lin(0.55, 0.78, 0.92));
  });
  world.iceMesh = new THREE.Mesh(B.build(), M.ice);
  world.iceMesh.renderOrder = 3;
  world.iceMesh.receiveShadow = true;
  world.root.add(world.iceMesh);
}

// 裂痕：彩帶（兩層：深色底＋白色亮線）
function ribbon(B, a, b, w, y) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
  const nx = (-dz / l) * w / 2, nz = (dx / l) * w / 2;
  const p1 = [a[0] + nx, y, a[1] + nz], p2 = [a[0] - nx, y, a[1] - nz], p3 = [b[0] - nx, y, b[1] - nz], p4 = [b[0] + nx, y, b[1] + nz];
  B.tri(p1, p2, p3, [0, 1, 0], [1, 1, 1]); B.tri(p1, p3, p4, [0, 1, 0], [1, 1, 1]);
}
function lineBuilder() {
  const P = [], U = [], J = [], JU = [];
  const quad = (arr, uv, p1, p2, p3, p4, u) => {
    arr.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4);
    uv.push(u[0], 0, u[0], 1, u[1], 1, u[0], 0, u[1], 1, u[1], 0);
  };
  return {
    seg(a, b, w, y) {
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
      const nx = (-dz / l) * w / 2, nz = (dx / l) * w / 2;
      quad(P, U, [a[0] + nx, y, a[1] + nz], [a[0] - nx, y, a[1] - nz], [b[0] - nx, y, b[1] - nz], [b[0] + nx, y, b[1] + nz], [0, 1]);
    },
    joint(p, w, y) {
      const r = w / 2;
      J.push(p[0] - r, y, p[1] - r, p[0] - r, y, p[1] + r, p[0] + r, y, p[1] + r, p[0] - r, y, p[1] - r, p[0] + r, y, p[1] + r, p[0] + r, y, p[1] - r);
      JU.push(0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0);
    },
    build(mat, jmat, order) {
      const mk = (pos, uv, m) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); const me = new THREE.Mesh(g, m); me.renderOrder = order; return me; };
      const grp = new THREE.Group(); grp.add(mk(P, U, mat)); if (jmat) grp.add(mk(J, JU, jmat)); return grp;
    },
  };
}
function edgeTop(E) {
  const t0 = G.ice.cells[E.cells[0]].type, t1 = E.cells[1] !== undefined ? G.ice.cells[E.cells[1]].type : 'ice';
  return (t0 === 'thick' && t1 === 'thick') ? THICK_TOP : TOP;
}
function buildCracks() {
  for (const m of world.crackMeshes || []) { world.root.remove(m); m.traverse((o) => o.geometry && o.geometry.dispose()); }
  const lite = lineBuilder(), old = lineBuilder();
  const solid = (t) => t === 'ice' || t === 'thick';
  G.ice.edges.forEach((E) => {
    if (!E.cracked || E.cells.length < 2) return;
    if (!solid(G.ice.cells[E.cells[0]].type) || !solid(G.ice.cells[E.cells[1]].type)) return;
    const y = edgeTop(E) + 0.004, L = E.old ? old : lite, w = E.old ? 0.085 : 0.1;
    L.seg(pts(E.a), pts(E.b), w, y); L.joint(pts(E.a), w, y + 0.0005); L.joint(pts(E.b), w, y + 0.0005);
  });
  for (const sp of world.spurs) if (sp.alive()) lite.seg(sp.a, sp.b, 0.05, TOP + 0.005);
  world.crackMeshes = [old.build(M.crackOld, M.crackOld, 5), lite.build(M.crack, M.joint, 6)];
  world.crackMeshes.forEach((m) => world.root.add(m));
}

// ---------------- 關卡生成 ----------------
function clearWorld() {
  if (!world) return;
  scene.remove(world.root);
  world.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}
function startLevel(i) {
  clearWorld();
  const L = LEVELS[i];
  G = new Game(L);
  world = { idx: i, root: new THREE.Group(), fish: [], peng: [], swim: [], fx: [], spurs: [], anims: [], iceMesh: null, crackMeshes: [] };
  scene.add(world.root);
  buildStatic(); buildIceMesh(); buildCracks();
  // 凍住的魚
  for (const f of G.fish) {
    const m = makeModel(f.kind, 0.72, 'fish');
    m.position.set(f.x, -0.06, f.z); m.rotation.y = f.rot;
    m.children[0].rotation.x = Math.PI / 2; // 側躺，從上面看得到花紋
    // 畫在冰之後（冰不寫深度），看起來在冰裡但清楚
    m.traverse((o) => { if (o.isMesh) { o.material.emissive = new THREE.Color(0x0e2c40); o.material.transparent = true; o.material.opacity = 0.9; o.renderOrder = 3.5; o.castShadow = false; } });
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), M.frost);
    fr.rotation.x = -Math.PI / 2; fr.position.set(f.x, TOP + 0.002, f.z); fr.renderOrder = 4;
    world.root.add(m, fr);
    world.fish.push({ f, m, fr, state: 'frozen', t: rnd() * 6 });
  }
  for (const p of G.penguins) {
    const m = makeModel('Creature_Penguin', 0.5, 'height');
    m.position.set(p.x, TOP, p.z); m.rotation.y = p.rot;
    world.root.add(m);
    world.peng.push({ p, m, state: 'idle', t: rnd() * 5, hop: 0 });
  }
  if (L.seal) {
    const m = makeModel('Creature_Seal', 0.9, 'len');
    m.position.set(L.seal[0], SNOW_TOP, L.seal[1]); m.rotation.y = L.seal[2];
    world.root.add(m); world.seal = { m, t: 0 };
  }
  // 冰下游來游去的魚（裝飾）
  const kinds = Object.keys(FISH_NAMES).filter((k) => proto[k]);
  const lakeCells = G.ice.cells.filter((c) => c.type === 'ice' || c.type === 'thick');
  for (let k = 0; k < 6; k++) {
    const c = lakeCells[Math.floor(rnd() * lakeCells.length)];
    const m = makeModel(kinds[Math.floor(rnd() * kinds.length)], 0.32 + rnd() * 0.2, 'fish');
    m.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    m.position.set(c.x, -0.45 - rnd() * 0.3, c.z);
    world.root.add(m);
    world.swim.push({ m, a: rnd() * 6.28, sp: 0.25 + rnd() * 0.25, turn: (rnd() - 0.5) * 0.8, cx: c.x, cz: c.z });
  }
  fitCamera();
  busy = false; aim = null; clearPreview();
  hud(); showHint(L.hint);
  ['oMenu', 'oOver'].forEach((k) => $(k).classList.add('hidden'));
}

// ---------------- 相機 ----------------
const camTarget = new THREE.Vector3();
let shake = 0;
function fitCamera() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // 湖的範圍
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  if (G) for (const c of G.ice.cells) if (c.type !== 'snow' || c.rock) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); z0 = Math.min(z0, c.z); z1 = Math.max(z1, c.z); }
  if (x0 > x1) { x0 = -3; x1 = 3; z0 = -5; z1 = 5; }
  x0 = Math.max(x0 - 0.45, -4.2); x1 = Math.min(x1 + 0.45, 4.2); z0 = Math.max(z0 - 0.45, -6.4); z1 = Math.min(z1 + 0.45, 6.4);
  const topPad = 120 / h, botPad = 90 / h; // HUD 與提示的位置
  camTarget.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const dir = new THREE.Vector3(0, 1, 0.36).normalize();
  const corners = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]];
  let D = 6;
  for (let it = 0; it < 60; it++) {
    camera.position.copy(camTarget).addScaledVector(dir, D);
    camera.lookAt(camTarget);
    camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    let ok = true;
    for (const [x, z] of corners) {
      const v = new THREE.Vector3(x, 0, z).project(camera);
      if (Math.abs(v.x) > 0.96 || v.y > 1 - topPad * 2 || v.y < -1 + botPad * 2) ok = false;
    }
    if (ok) break;
    D *= 1.06;
  }
  // 把湖的中心往上下留白的中間挪
  const shift = (botPad - topPad) * 0.5;
  camera.position.z += shift * D * 0.5;
  camTarget.z += shift * D * 0.5;
  camera.lookAt(camTarget);
  camera.updateProjectionMatrix();
  world && (world.camBase = camera.position.clone());
}
window.addEventListener('resize', () => { if (G) fitCamera(); });

// ---------------- 音效 ----------------
const AC = window.AudioContext || window.webkitAudioContext;
let ac = null, master = null, sfxGain = null, musicGain = null, soundOn = save.sound !== false;
const buf = {};
const SFX = ['glass_001', 'glass_002', 'glass_003', 'glass_004', 'glass_006', 'confirmation_002', 'drop_002', 'click_002', 'error_004', 'maximize_006', 'pluck_001', 'creak1', 'creak3'];
function audioInit() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    ac = new AC();
    master = ac.createGain(); master.gain.value = soundOn ? 1 : 0; master.connect(ac.destination);
    sfxGain = ac.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
    musicGain = ac.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
    const load = (n, cb) => fetch(`sfx/${n}.mp3`).then((r) => r.arrayBuffer()).then((a) => new Promise((res, rej) => ac.decodeAudioData(a, res, rej))).then(cb).catch(() => {});
    SFX.forEach((n) => load(n, (b) => (buf[n] = b)));
    load('bgm', (b) => { const s = ac.createBufferSource(); s.buffer = b; s.loop = true; s.connect(musicGain); s.start(); });
  } catch { ac = null; }
}
function play(name, vol = 1, rate = 1) {
  if (!ac || !buf[name]) return;
  const s = ac.createBufferSource(); s.buffer = buf[name]; s.playbackRate.value = rate;
  const g = ac.createGain(); g.gain.value = vol; s.connect(g); g.connect(sfxGain); s.start();
}
function noise(dur, f0, f1, vol, type = 'bandpass', q = 1) {
  if (!ac) return;
  const n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ac.createBufferSource(); s.buffer = b;
  const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q; const t = ac.currentTime;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxGain); s.start();
}
function tone(f0, f1, dur, vol, type = 'sine', delay = 0) {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + delay;
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + dur + 0.05);
}
let lastPing = 0;
const S = {
  thud() { tone(110, 38, 0.32, 0.5); noise(0.16, 1800, 300, 0.35, 'lowpass'); play('glass_004', 0.35, 0.7); },
  // 冰湖特有的「啾～」：高頻往下掉的頻散聲
  ping(k) {
    if (!ac || ac.currentTime - lastPing < 0.045) return;
    lastPing = ac.currentTime;
    const p = 0.8 + Math.random() * 0.5;
    tone(3200 * p, 420 * p, 0.22, 0.07, 'sine');
    tone(5200 * p, 900 * p, 0.12, 0.03, 'triangle');
    noise(0.04, 5000, 2500, 0.12, 'highpass');
    if (k % 3 === 0) play(['glass_001', 'glass_002', 'glass_003', 'glass_006'][k % 4], 0.18, 1.2 + Math.random() * 0.4);
  },
  crunch() { noise(0.5, 1400, 250, 0.4); play('creak' + (Math.random() < 0.5 ? 1 : 3), 0.5, 1.3); play('glass_004', 0.3, 0.9); },
  splash() { noise(0.7, 2200, 200, 0.35, 'lowpass'); setTimeout(() => noise(0.4, 900, 200, 0.18, 'lowpass'), 120); },
  freed() { play('confirmation_002', 0.7); tone(880, 1320, 0.15, 0.06, 'triangle', 0.05); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, f * 1.01, 0.3, 0.1, 'triangle', i * 0.12)); play('maximize_006', 0.5); },
  lose() { play('error_004', 0.7); tone(330, 220, 0.5, 0.08, 'sine', 0.1); },
  click() { play('click_002', 0.6); },
  aim() { play('pluck_001', 0.25, 1.4); },
};

// ---------------- 特效 ----------------
const chipGeo = new THREE.TetrahedronGeometry(0.035);
const chipMat = new THREE.MeshStandardMaterial({ color: 0xeaf7ff, roughness: 0.1, transparent: true, opacity: 0.9 });
const dropMat = new THREE.MeshBasicMaterial({ color: 0xcfeeff, transparent: true, opacity: 0.85 });
const dropGeo = new THREE.SphereGeometry(0.03, 6, 4);
function chips(x, z, n, spd = 1) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(chipGeo, chipMat);
    m.position.set(x, TOP + 0.02, z);
    const a = rnd() * 6.28, v = (0.6 + rnd() * 1.6) * spd;
    world.root.add(m);
    world.fx.push({ m, v: new THREE.Vector3(Math.cos(a) * v, 1.5 + rnd() * 2.2, Math.sin(a) * v), life: 0.9 + rnd() * 0.5, spin: rnd() * 10, g: 9 });
  }
}
function splash(x, z, n) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(dropGeo, dropMat);
    m.position.set(x + (rnd() - 0.5) * 0.3, WATER_Y, z + (rnd() - 0.5) * 0.3);
    const a = rnd() * 6.28, v = 0.4 + rnd() * 1.2;
    world.root.add(m);
    world.fx.push({ m, v: new THREE.Vector3(Math.cos(a) * v, 1.8 + rnd() * 2.4, Math.sin(a) * v), life: 0.8 + rnd() * 0.4, g: 9 });
  }
  const r = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, color: 0xe8f7ff }));
  r.rotation.x = -Math.PI / 2; r.position.set(x, WATER_Y + 0.01, z); r.renderOrder = 8;
  world.root.add(r);
  world.fx.push({ m: r, ring: true, life: 0.9, max: 0.9, s0: 0.2, s1: 1.6 });
}
function impactRing(x, z, y) {
  const r = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xbfeaff }));
  r.rotation.x = -Math.PI / 2; r.position.set(x, y + 0.01, z); r.renderOrder = 9;
  world.root.add(r);
  world.fx.push({ m: r, ring: true, life: 0.45, max: 0.45, s0: 0.1, s1: 1.8 });
  const f = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  f.rotation.x = -Math.PI / 2; f.position.set(x, y + 0.02, z); f.renderOrder = 9;
  world.root.add(f);
  world.fx.push({ m: f, ring: true, life: 0.25, max: 0.25, s0: 1.2, s1: 0.4 });
}
function bubbles(x, z, n) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, color: 0xdff4ff }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x + (rnd() - 0.5) * 0.6, WATER_Y + 0.005, z + (rnd() - 0.5) * 0.6);
    world.root.add(m);
    world.fx.push({ m, ring: true, life: 0.6 + rnd() * 0.8, max: 1.4, s0: 0.3, s1: 1.3, delay: rnd() * 0.6 });
  }
}
function updateFx(dt) {
  for (let i = world.fx.length - 1; i >= 0; i--) {
    const p = world.fx[i];
    if (p.delay > 0) { p.delay -= dt; p.m.visible = false; continue; }
    p.m.visible = true;
    p.life -= dt;
    if (p.life <= 0) { world.root.remove(p.m); world.fx.splice(i, 1); continue; }
    if (p.ring) {
      const k = 1 - p.life / p.max;
      p.m.scale.setScalar(p.s0 + (p.s1 - p.s0) * k);
      p.m.material.opacity = Math.min(1, p.life / p.max * 1.5);
      continue;
    }
    p.v.y -= p.g * dt;
    p.m.position.addScaledVector(p.v, dt);
    if (p.spin) { p.m.rotation.x += p.spin * dt; p.m.rotation.z += p.spin * 0.7 * dt; }
    if (p.m.position.y < WATER_Y - 0.05) { world.root.remove(p.m); world.fx.splice(i, 1); }
  }
}

// ---------------- 預覽（拖曳中） ----------------
let prev = null;
function clearPreview() {
  if (prev) { for (const m of prev.meshes) { world && world.root.remove(m); m.traverse((o) => o.geometry && o.geometry.dispose()); } }
  prev = null;
  if (world) for (const w of world.peng) w.warn = false;
}
function drawPreview(plan) {
  clearPreview();
  if (!plan) return;
  const B = lineBuilder();
  for (const o of plan.order) { const E = G.ice.edges[o.e]; const y = edgeTop(E) + 0.008; B.seg(pts(E.a), pts(E.b), 0.09, y); B.joint(pts(E.a), 0.09, y); B.joint(pts(E.b), 0.09, y); }
  const meshes = [B.build(M.preview, M.previewJ, 12)];
  const pv = G.preview(plan);
  if (pv && pv.cells.size) {
    const bad = pv.penguins.length > 0;
    const C = geoBuilder();
    for (const ci of pv.cells) {
      const c = G.ice.cells[ci];
      addCell(C, ci, (c.type === 'thick' ? THICK_TOP : TOP) + 0.004, TOP, [1, 1, 1], () => false, [1, 1, 1]);
    }
    meshes.push(new THREE.Mesh(C.build(), bad ? M.sinkBad : M.sinkPrev));
    for (const w of world.peng) w.warn = pv.penguins.includes(w.p);
  }
  meshes.forEach((m, i) => { if (m.isMesh) m.renderOrder = 10 + i; world.root.add(m); });
  prev = { meshes, plan };
}

// ---------------- 輸入 ----------------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitP = new THREE.Vector3();
function groundAt(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.ray.intersectPlane(plane, hitP) ? [hitP.x, hitP.z] : null;
}
let aim = null, busy = false;
const DRAG_FULL = 2.4, DRAG_MIN = 0.22;
const aimMarker = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, color: 0xffffff }));
aimMarker.rotation.x = -Math.PI / 2; aimMarker.renderOrder = 12; aimMarker.visible = false; scene.add(aimMarker);
canvas.addEventListener('pointerdown', (e) => {
  audioInit();
  if (busy || !G || G.result !== 'play' || aim) return;
  const p = groundAt(e); if (!p) return;
  const c = G.ice.cells[cellAt(G.ice, p[0], p[1])];
  if (!c || (c.type !== 'ice' && c.type !== 'thick')) { toast('要敲在冰上喔'); return; }
  aim = { id: e.pointerId, x: p[0], z: p[1], dx: 0, dz: 0, power: 0, plan: null, key: '' };
  try { canvas.setPointerCapture(e.pointerId); } catch {}
  aimMarker.position.set(p[0], (c.type === 'thick' ? THICK_TOP : TOP) + 0.02, p[1]); aimMarker.scale.setScalar(0.35); aimMarker.visible = true;
  $('hint').classList.add('hide');
});
canvas.addEventListener('pointermove', (e) => {
  if (!aim || e.pointerId !== aim.id) return;
  const p = groundAt(e); if (!p) return;
  const dx = p[0] - aim.x, dz = p[1] - aim.z, l = Math.hypot(dx, dz);
  if (l < DRAG_MIN) { aim.plan = null; aim.key = ''; drawPreview(null); return; }
  aim.dx = dx / l; aim.dz = dz / l; aim.power = Math.min(1, l / DRAG_FULL);
  const plan = G.plan(aim.x, aim.z, aim.dx, aim.dz, aim.power);
  const key = plan ? plan.edges.join(',') : '';
  if (key !== aim.key) { aim.key = key; aim.plan = plan; drawPreview(plan); if (plan) S.aim(); }
  aimMarker.scale.setScalar(0.35 + aim.power * 0.5);
});
function endAim(e) {
  if (!aim || e.pointerId !== aim.id) return;
  const a = aim; aim = null; aimMarker.visible = false;
  clearPreview();
  if (e.type === 'pointercancel') return;
  if (!a.plan) { toast('按住後往旁邊拖，再放開'); return; }
  doStrike(a.plan);
}
canvas.addEventListener('pointerup', endAim);
canvas.addEventListener('pointercancel', endAim);

// ---------------- 敲擊流程 ----------------
const wait = (s) => anim(() => {}, s);
function animsDone() { return new Promise((res) => { const chk = () => (!world || world.anims.length === 0 ? res() : requestAnimationFrame(chk)); chk(); }); }
function anim(fn, dur) { return new Promise((res) => world.anims.push({ fn, t: 0, dur: dur / SPD, res })); }
async function doStrike(plan) {
  if (busy) return;
  busy = true;
  const myWorld = world;
  try {
    const res = G.strike(plan);
    hud();
    const E0 = G.ice.edges[plan.start];
    const sx = (pts(E0.a)[0] + pts(E0.b)[0]) / 2, sz = (pts(E0.a)[1] + pts(E0.b)[1]) / 2;
    S.thud(); shake = 0.12; impactRing(sx, sz, TOP); chips(sx, sz, 14, 1);
    for (const w of world.peng) if (!w.p.lost) w.hop = 0.35;
    // 裂痕蔓延動畫：先把這次的邊藏起來，逐段畫
    const total = Math.max(...plan.order.map((o) => o.d0 + G.ice.edges[o.e].len));
    const speed = 9;
    const live = { mesh: null };
    let k = 0;
    const shown = new Set();
    // 細碎的小分岔（裝飾）
    for (const o of plan.order) {
      if (rnd() < 0.35) {
        const v = pts(o.to), a = rnd() * 6.28, l = 0.05 + rnd() * 0.14;
        world.spurs.push({ a: v, b: [v[0] + Math.cos(a) * l, v[1] + Math.sin(a) * l], alive: () => { const c = G.ice.cells[cellAt(G.ice, v[0], v[1])]; return c.type === 'ice' || c.type === 'thick'; } });
      }
    }
    // 動畫期間：這次的裂痕先藏起來、要沉的冰先當作還在
    for (const e of plan.edges) G.ice.edges[e].cracked = false;
    const restoreTypes = [];
    for (const g of res.sunk) for (const c of g.cells) { restoreTypes.push(c); G.ice.cells[c].type = 'ice'; }
    buildCracks();
    await anim((t) => {
      const D = t * speed;
      if (live.mesh) { world.root.remove(live.mesh); live.mesh.traverse((o) => o.geometry && o.geometry.dispose()); }
      const B = lineBuilder(), Bg = lineBuilder();
      for (const o of plan.order) {
        const E = G.ice.edges[o.e], len = E.len;
        const f = Math.max(0, Math.min(1, (D - o.d0) / len));
        if (f <= 0) continue;
        const a = pts(o.from), b = pts(o.to), m = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
        const y = edgeTop(E) + 0.004;
        B.seg(a, m, 0.11, y); B.joint(a, 0.11, y + 0.0005); B.joint(m, 0.11, y + 0.0005);
        const fresh = D - o.d0 - len;
        if (fresh < 0.8) Bg.seg(a, m, 0.34 * (1 - Math.max(0, fresh) / 0.8), y + 0.001);
        if (f >= 1 && !shown.has(o.e)) { shown.add(o.e); S.ping(k++); if (rnd() < 0.3) chips(b[0], b[1], 2, 0.4); }
      }
      const g = new THREE.Group();
      g.add(B.build(M.crack, M.joint, 6), Bg.build(M.crackGlow, null, 7));
      live.mesh = g; world.root.add(g);
    }, total / speed + 0.05);
    if (live.mesh) { world.root.remove(live.mesh); }
    for (const e of plan.edges) G.ice.edges[e].cracked = true;
    for (const c of restoreTypes) G.ice.cells[c].type = 'gone';
    buildCracks();
    // 沉下去的冰塊：拆成一格一格碎片
    if (res.sunk.length) {
      await wait(0.12);
      S.crunch(); shake = 0.08;
      buildIceMesh(); buildCracks();
      for (const g of res.sunk) sinkPiece(g);
      for (const fz of world.fish) if (fz.f.freed && fz.state === 'frozen') releaseFish(fz);
      for (const w of world.peng) if (w.p.lost && w.state === 'idle') dropPenguin(w);
      await wait(0.5);
      S.splash();
      for (const f of res.freed) { await wait(0.35); S.freed(); toast(`救出 ${FISH_NAMES[f.kind] || '魚'}！`); }
    }
    hud();
    if (G.result !== 'play') {
      await animsDone();
      await wait(0.4);
      if (world === myWorld) over();
    }
  } finally {
    if (world === myWorld) busy = false;
  }
}
function sinkPiece(g) {
  let cx = 0, cz = 0;
  for (const ci of g.cells) { cx += G.ice.cells[ci].x; cz += G.ice.cells[ci].z; }
  cx /= g.cells.length; cz /= g.cells.length;
  for (const ci of g.cells) {
    const c = G.ice.cells[ci];
    const B = geoBuilder();
    addCell(B, ci, TOP - 0.0, BOT, cellColor(c), () => true, [0.55, 0.78, 0.95], c.x, c.z, true);
    const m = new THREE.Mesh(B.build(), M.ice.clone());
    m.material.opacity = 0.75; m.material.depthWrite = false;
    m.position.set(c.x, 0, c.z); m.renderOrder = 3;
    world.root.add(m);
    const ox = c.x - cx, oz = c.z - cz, d = Math.hypot(ox, oz) || 1;
    const delay = rnd() * 0.25 + d * 0.05;
    world.anims.push({
      t: 0, dur: (2.0 + rnd() * 0.6) / SPD, res: () => world.root.remove(m),
      fn: (t) => {
        const k = Math.max(0, t - delay);
        m.position.x = c.x + (ox / d) * k * 0.25;
        m.position.z = c.z + (oz / d) * k * 0.25;
        m.position.y = -k * k * 0.5 + Math.sin(k * 9) * 0.01 * Math.max(0, 1 - k);
        m.rotation.x = (oz / d) * k * 0.9; m.rotation.z = -(ox / d) * k * 0.9;
        m.material.opacity = Math.max(0, 0.75 - k * 0.32);
      },
    });
  }
  splash(cx, cz, 18); bubbles(cx, cz, 10);
}
function releaseFish(fz) {
  fz.state = 'free';
  world.root.remove(fz.fr);
  const m = fz.m, x0 = m.position.x, z0 = m.position.z;
  const a = rnd() * 6.28;
  m.traverse((o) => { if (o.isMesh) { o.material.emissive = new THREE.Color(0); o.material.color.multiplyScalar(1.12); } });
  world.anims.push({
    t: 0, dur: 3.4 / SPD, res: () => world.root.remove(m),
    fn: (t) => {
      if (t < 0.6) { // 跳出水面
        const k = t / 0.6;
        m.position.y = -0.075 + Math.sin(k * Math.PI) * 0.7;
        m.rotation.z = Math.sin(k * Math.PI * 2) * 0.6;
        m.children[0].rotation.x = (Math.PI / 2) * (1 - k);
        m.rotation.y = fz.f.rot + k * 3.2;
        if (k > 0.95 && !fz.splashed) { fz.splashed = true; splash(x0, z0, 10); }
      } else { // 游走
        const k = t - 0.6;
        m.rotation.z = 0;
        m.rotation.y = -a + Math.sin(k * 14) * 0.25;
        m.position.set(x0 + Math.cos(a) * k * 1.1, -0.15 - k * 0.22, z0 + Math.sin(a) * k * 1.1);
        m.traverse((o) => { if (o.isMesh) { o.material.transparent = true; o.material.opacity = Math.max(0, 1 - k / 2.8); } });
      }
    },
  });
}
function dropPenguin(w) {
  w.state = 'fall';
  const m = w.m;
  world.anims.push({
    t: 0, dur: 1.0 / SPD,
    res: () => {
      world.root.remove(m);
      const s = makeModel('Creature_Penguin_Swim', 0.55, 'len');
      s.position.set(m.position.x, WATER_Y - 0.12, m.position.z);
      world.root.add(s);
      w.swimM = s; w.state = 'swim';
      splash(m.position.x, m.position.z, 14);
    },
    fn: (t) => { m.position.y = TOP - t * t * 0.6; m.rotation.x = t * 1.4; },
  });
}

// ---------------- 每幀 ----------------
const clock = new THREE.Clock();
let elapsed = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;
  floorMat.uniforms.t.value = elapsed;
  if (world) {
    for (let i = world.anims.length - 1; i >= 0; i--) {
      const a = world.anims[i];
      a.t += dt;
      try { a.fn(Math.min(a.t, a.dur) * SPD); } catch (err) { console.error(err); }
      if (a.t >= a.dur) { world.anims.splice(i, 1); a.res && a.res(); }
    }
    updateFx(dt);
    for (const s of world.swim) {
      s.a += s.turn * dt;
      s.m.position.x += Math.cos(s.a) * s.sp * dt; s.m.position.z += Math.sin(s.a) * s.sp * dt;
      if (Math.hypot(s.m.position.x - s.cx, s.m.position.z - s.cz) > 1.6) s.a += dt * 2;
      s.m.rotation.y = -s.a + Math.sin(elapsed * 9 + s.sp * 40) * 0.12;
    }
    for (const w of world.peng) {
      w.t += dt;
      if (w.state === 'idle') {
        w.hop = Math.max(0, w.hop - dt);
        const hop = w.hop > 0 ? Math.sin((w.hop / 0.35) * Math.PI) * 0.18 : 0;
        w.m.position.y = TOP + hop;
        w.m.rotation.z = Math.sin(w.t * 3.1) * (w.warn ? 0.16 : 0.05);
        w.m.rotation.y = w.p.rot + Math.sin(w.t * 0.7) * 0.3;
      } else if (w.state === 'swim' && w.swimM) {
        w.swimM.position.x += Math.cos(w.t * 0.8) * dt * 0.3;
        w.swimM.position.z += Math.sin(w.t * 0.8) * dt * 0.3;
        w.swimM.rotation.y = -w.t * 0.8 - Math.PI / 2;
      }
    }
    for (const fz of world.fish) if (fz.state === 'frozen') { fz.fr.material.opacity = 0.85 + Math.sin(elapsed * 2 + fz.t) * 0.1; }
    if (world.seal) { world.seal.t += dt; world.seal.m.rotation.z = Math.sin(world.seal.t * 1.3) * 0.03; }
    if (aimMarker.visible) aimMarker.material.opacity = 0.6 + Math.sin(elapsed * 10) * 0.3;
    if (world.camBase) {
      shake = Math.max(0, shake - dt * 0.6);
      camera.position.copy(world.camBase);
      if (shake > 0) camera.position.add(new THREE.Vector3((rnd() - 0.5) * shake, 0, (rnd() - 0.5) * shake));
    }
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------------- 介面 ----------------
const PICK = '<svg class="pick" viewBox="0 0 24 24"><path d="M4 20 L13 11" stroke="#7a4b2a" stroke-width="3" stroke-linecap="round"/><path d="M9 5 Q15 3 20 9 L17 11 Q14 7 9 5Z" fill="#8fb3cf" stroke="#3d6584" stroke-width="1.2"/></svg>';
function hud() {
  if (!G) return;
  const L = G.level;
  $('lvlNo').textContent = `第 ${world.idx + 1} 關`;
  $('lvlName').textContent = L.name;
  let h = '';
  for (let i = 0; i < L.strikes; i++) h += PICK.replace('class="pick"', `class="pick${i < G.used ? ' used' : ''}"`);
  $('picks').innerHTML = h;
  const fr = G.fish.filter((f) => f.freed).length;
  $('fishGoal').innerHTML = `🐟 ${fr} / ${G.fish.length}` + (G.penguins.length ? `　🐧 ${G.penguins.filter((p) => !p.lost).length}` : '');
}
function showHint(t) { const h = $('hint'); h.innerHTML = t; h.classList.remove('hide'); }
let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1400 / Math.min(SPD, 2)); }
function over() {
  const win = G.result === 'win';
  const i = world.idx;
  if (win) { const st = G.stars(); save.stars[i] = Math.max(save.stars[i] || 0, st); store(); S.win(); }
  else S.lose();
  $('rTitle').textContent = win ? '過關！' : '再試一次';
  const st = win ? G.stars() : 0;
  $('rStars').innerHTML = [0, 1, 2].map((k) => `<span class="${k < st ? '' : 'off'}">★</span>`).join('');
  const names = G.fish.filter((f) => f.freed).map((f) => FISH_NAMES[f.kind]).join('、');
  $('rBody').innerHTML = win ? `救出了：${names}<br>用了 ${G.used} 鎚（最佳 ${G.level.par} 鎚）`
    : G.penguins.some((p) => p.lost) ? '企鵝掉進水裡了！<br>拖曳時注意紅色的預覽。' : '鎚子用完了，魚還困在冰裡。';
  $('bNext').style.display = win && i < LEVELS.length - 1 ? '' : 'none';
  $('oOver').classList.remove('hidden');
}
function menu() {
  const grid = $('grid'); grid.innerHTML = '';
  LEVELS.forEach((L, i) => {
    const b = document.createElement('button'); b.className = 'lv';
    const st = save.stars[i] || 0;
    b.innerHTML = `<b>${i + 1}</b><i>${L.name}</i><span class="st">${'★'.repeat(st)}</span>`;
    b.onclick = () => { audioInit(); S.click(); startLevel(i); };
    grid.appendChild(b);
  });
  $('oOver').classList.add('hidden');
  $('oMenu').classList.remove('hidden');
}
$('bMenu').onclick = () => { if (!busy) { S.click(); menu(); } };
$('bRetry').onclick = () => { if (!busy && world) { S.click(); startLevel(world.idx); } };
$('bAgain').onclick = () => { S.click(); startLevel(world.idx); };
$('bNext').onclick = () => { S.click(); startLevel(Math.min(LEVELS.length - 1, world.idx + 1)); };
$('bBack').onclick = () => { S.click(); menu(); };
const setSound = () => { $('bSound').textContent = soundOn ? '🔊' : '🔇'; if (master) master.gain.value = soundOn ? 1 : 0; };
$('bSound').onclick = () => { audioInit(); soundOn = !soundOn; save.sound = soundOn; store(); setSound(); };
setSound();
document.addEventListener('gesturestart', (e) => e.preventDefault());

// ---------------- 開始 ----------------
(async () => {
  try {
    await loadModels();
  } catch (err) {
    $('loading').textContent = '載入失敗，請重新整理';
    console.error(err);
    return;
  }
  startLevel(0);
  menu();
  $('loading').classList.add('hidden');
  requestAnimationFrame(frame);
})();

// 測試用
window.__cl = {
  get game() { return G; }, get busy() { return busy; }, get world() { return world; }, startLevel, LEVELS,
  strike: (x, z, dx, dz, p) => { const plan = G && G.plan(x, z, dx, dz, p); if (plan) doStrike(plan); return !!plan; },
  project: (x, z) => { const v = new THREE.Vector3(x, 0, z).project(camera); const r = canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; },
};
