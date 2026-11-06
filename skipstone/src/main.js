// main.js — 畫面、操作、存檔
import * as THREE from '../vendor/three.module.min.js';
import { Stone, ROCKS, H, NX, NY, NZ } from './stone.js';
import { prepareBody, Throw, throwSpeed, throwSpin, ARM } from './physics.js';

THREE.ColorManagement.enabled = false;
const $ = id => document.getElementById(id);
const deg = Math.PI / 180;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const WORLD_RECORD = 88;   // Kurt Steiner，2013（金氏世界紀錄）

// ============================================================ 存檔
const KEY = 'skipstone.v1';
const MAX_STONES = 40;
function loadStore() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.stones)) return s; } catch (e) { /* 壞掉就重來 */ }
  return { stones: [], currentId: null, board: [], tilt: 12, sound: true, nextNo: 1, seed: (Math.random() * 1e9) | 0 };
}
const store = loadStore();
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); return true; } catch (e) { toast('存不進去，空間滿了'); return false; } }
function nextSeed() { store.seed = (Math.imul(store.seed | 0, 1664525) + 1013904223) | 0; return store.seed; }

// ============================================================ 小工具
let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }

// 對話框：input 為 null 時只問是／否。回傳 Promise（取消＝null，確定＝字串或 true）
let dlgResolve = null;
function ask({ title, text = '', input = null, yes = '好', no = '取消' }) {
  if (dlgResolve) { dlgResolve(null); dlgResolve = null; }
  $('dlgTitle').textContent = title; $('dlgText').textContent = text;
  $('dlgText').classList.toggle('hide', !text);
  const inp = $('dlgInput'); inp.classList.toggle('hide', input === null); inp.value = input ?? '';
  $('dlgYes').textContent = yes; $('dlgNo').textContent = no;
  $('dlg').classList.remove('hide');
  if (input !== null) setTimeout(() => { try { inp.focus(); inp.select(); } catch (e) { /* 沒差 */ } }, 50);
  return new Promise(res => { dlgResolve = res; });
}
function dlgClose(v) { $('dlg').classList.add('hide'); const r = dlgResolve; dlgResolve = null; if (r) r(v); }
$('dlgNo').onclick = () => dlgClose(null);
$('dlgYes').onclick = () => { const inp = $('dlgInput'); dlgClose(inp.classList.contains('hide') ? true : (inp.value.trim() || inp.value || '')); };
$('dlgInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('dlgYes').click(); e.stopPropagation(); });

function openPanel(title, build) { $('panelTitle').textContent = title; const b = $('panelBody'); b.innerHTML = ''; build(b); $('panel').classList.remove('hide'); }
function closePanel() { $('panel').classList.add('hide'); }
$('panelClose').onclick = closePanel;
$('panel').addEventListener('pointerdown', e => { if (e.target === $('panel')) closePanel(); });
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

// 俯視縮圖（2D，不用讀回 WebGL）
function makeThumb(stone) {
  const S = 96, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S), d = stone.d, rock = ROCKS[stone.rock];
  const hm = new Float32Array(NX * NY).fill(-1);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) for (let k = NZ - 1; k >= 0; k--) {
    const v = d[i + NX * (j + NY * k)];
    if (v > 0.5) { hm[i + NX * j] = k + Math.min(1, v - 0.5); break; }
  }
  const at = (i, j) => { i = clamp(i, 0, NX - 1); j = clamp(j, 0, NY - 1); return hm[i + NX * j]; };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = Math.floor(x / S * NX), j = Math.floor((1 - (y + 0.5) / S) * NY), h = at(i, j), o = (x + S * y) * 4;
    if (h < 0) { img.data[o + 3] = 0; continue; }
    const hx = (at(i + 1, j) < 0 ? h - 2 : at(i + 1, j)) - (at(i - 1, j) < 0 ? h - 2 : at(i - 1, j));
    const hy = (at(i, j + 1) < 0 ? h - 2 : at(i, j + 1)) - (at(i, j - 1) < 0 ? h - 2 : at(i, j - 1));
    const sh = clamp(0.78 + (-hx * 0.5 + hy * 0.7) * 0.16, 0.35, 1.15);
    const sp = ((i * 73856093) ^ (j * 19349663)) & 7;
    const col = sp === 0 ? rock.speck : rock.color;
    img.data[o] = 255 * clamp(col[0] * sh, 0, 1); img.data[o + 1] = 255 * clamp(col[1] * sh, 0, 1); img.data[o + 2] = 255 * clamp(col[2] * sh, 0, 1); img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

// ============================================================ 音效
const sfx = {
  ctx: null, noise: null, grindNode: null, grindGain: null,
  init() {
    if (this.ctx || !store.sound) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC();
      const n = this.ctx.sampleRate, buf = this.ctx.createBuffer(1, n, n), a = buf.getChannelData(0);
      for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1;
      this.noise = buf;
    } catch (e) { this.ctx = null; }
  },
  ok() { if (!store.sound || !this.ctx) return false; if (this.ctx.state === 'suspended') this.ctx.resume(); return true; },
  burst(freq, q, vol, dur) {
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(c.destination); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  },
  plip(n, a) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(), f0 = 420 + Math.min(n, 40) * 22;
    o.type = 'sine'; o.frequency.setValueAtTime(f0 * 1.6, t); o.frequency.exponentialRampToValueAtTime(f0, t + 0.07);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.10 + 0.14 * a, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.2);
    this.burst(2600, 0.8, 0.05 + 0.12 * a, 0.12);
  },
  sink() {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.35);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.55);
    this.burst(900, 0.6, 0.16, 0.4);
  },
  whoosh(a) { if (this.ok()) this.burst(700, 0.5, 0.05 + 0.1 * a, 0.25); },
  grind(on) {
    if (!this.ok()) { return; }
    const c = this.ctx;
    if (!this.grindNode) {
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noise; s.loop = true; f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.7; g.gain.value = 0;
      s.connect(f).connect(g).connect(c.destination); s.start();
      this.grindNode = s; this.grindGain = g;
    }
    this.grindGain.gain.setTargetAtTime(on ? 0.07 : 0, c.currentTime, 0.04);
  },
};

// ============================================================ 繪圖基礎
const canvas = $('gl');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { document.body.insertAdjacentHTML('beforeend', '<div id="err">這個瀏覽器開不了 3D 畫面（WebGL）。</div>'); throw e; }
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const hex = h => { const c = new THREE.Color(h); return new THREE.Vector3(c.r, c.g, c.b); };

// 物理座標（x 前、y 左、z 上）→ three（X 右、Y 上、−Z 前）
const toThree = (p, out = new THREE.Vector3()) => out.set(-p[1], p[2], -p[0]);
// 石頭網格矩陣：three = C·(R·(local − com) + p)
function setStoneMatrix(mesh, R, p, com) {
  const tx = p[0] - (R[0] * com[0] + R[1] * com[1] + R[2] * com[2]);
  const ty = p[1] - (R[3] * com[0] + R[4] * com[1] + R[5] * com[2]);
  const tz = p[2] - (R[6] * com[0] + R[7] * com[1] + R[8] * com[2]);
  const e = mesh.matrix.elements;
  e[0] = -R[3]; e[4] = -R[4]; e[8] = -R[5]; e[12] = -ty;
  e[1] = R[6]; e[5] = R[7]; e[9] = R[8]; e[13] = tz;
  e[2] = -R[0]; e[6] = -R[1]; e[10] = -R[2]; e[14] = -tx;
  e[3] = 0; e[7] = 0; e[11] = 0; e[15] = 1;
  mesh.matrixWorld.copy(mesh.matrix);
}
// 仰角 th（前緣抬高）＋繞自轉軸轉 ph 的旋轉矩陣（列優先）
function rotTilt(th, ph, out) {
  const c = Math.cos(th), s = Math.sin(th), cp = Math.cos(ph), sp = Math.sin(ph);
  out[0] = c * cp; out[1] = -c * sp; out[2] = -s; out[3] = sp; out[4] = cp; out[5] = 0; out[6] = s * cp; out[7] = -s * sp; out[8] = c;
  return out;
}

const stoneMat = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Vector3(0.7, 0.68, 0.66) }, uSpeck: { value: new THREE.Vector3(0.36, 0.35, 0.36) }, uLight: { value: new THREE.Vector3(-0.35, 0.75, -0.45).normalize() } },
  vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV;
    void main(){ vP=position; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalMatrix*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform vec3 uColor,uSpeck,uLight; varying vec3 vP; varying vec3 vN; varying vec3 vV;
    float hash(vec3 p){ p=fract(p*.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
      return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
    void main(){
      vec3 N=normalize(vN), V=normalize(vV);
      vec3 L=normalize((viewMatrix*vec4(uLight,0.)).xyz), U=normalize((viewMatrix*vec4(0.,1.,0.,0.)).xyz);
      float n1=noise(vP*900.), n2=noise(vP*140.+7.);
      vec3 base=mix(uColor,uSpeck,smoothstep(.62,.85,n1)*.8)*(.86+.28*n2);
      float dif=max(dot(N,L),0.), amb=.44+.2*dot(N,U);
      float spec=pow(max(dot(N,normalize(L+V)),0.),40.)*.16, rim=pow(1.-max(dot(N,V),0.),3.)*.10;
      gl_FragColor=vec4(base*(amb+dif*.8)+spec+rim,1.);
    }`,
});
function setRockColor(rock) { const r = ROCKS[rock]; stoneMat.uniforms.uColor.value.set(...r.color); stoneMat.uniforms.uSpeck.value.set(...r.speck); }
function stoneGeometry(stone) {
  const m = stone.mesh(), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  return g;
}
function newStoneMesh() { const m = new THREE.Mesh(new THREE.BufferGeometry(), stoneMat); m.matrixAutoUpdate = false; m.frustumCulled = false; return m; }

// ============================================================ 湖
const SKY = { top: hex('#2b5b90'), mid: hex('#86b6cc'), hor: hex('#f4d9ad'), deep: hex('#0e3643') };
const SUN = new THREE.Vector3(-0.42, 0.2, -1).normalize();
const SKY_GLSL = `uniform vec3 cTop,cMid,cHor,uSun;
  vec3 sky(vec3 d){ float h=clamp(d.y,0.,1.); vec3 c=mix(cHor,cMid,smoothstep(0.,.25,h)); c=mix(c,cTop,smoothstep(.2,.9,h));
    float s=max(dot(d,uSun),0.); return c+vec3(1.,.8,.55)*(pow(s,400.)*.9+pow(s,24.)*.16+pow(s,4.)*.05); }`;
const skyUni = () => ({ cTop: { value: SKY.top }, cMid: { value: SKY.mid }, cHor: { value: SKY.hor }, uSun: { value: SUN } });

const lake = new THREE.Scene();
const lakeCam = new THREE.PerspectiveCamera(55, 1, 0.04, 9000);
lake.add(new THREE.HemisphereLight(0xe6f0ff, 0x55604f, 0.95));
{ const dl = new THREE.DirectionalLight(0xffe4bd, 1.0); dl.position.copy(SUN).multiplyScalar(10); lake.add(dl); }
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, uniforms: skyUni(),
  vertexShader: `varying vec3 vD; void main(){ vD=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: SKY_GLSL + `varying vec3 vD; void main(){ gl_FragColor=vec4(sky(normalize(vD)),1.); }`,
}));
skyDome.renderOrder = -10; lake.add(skyDome);
const waterMat = new THREE.ShaderMaterial({
  uniforms: { ...skyUni(), uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, cDeep: { value: SKY.deep } },
  vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: SKY_GLSL + `uniform float uTime; uniform vec3 uCam,cDeep; varying vec3 vW;
    void main(){ vec3 V=normalize(uCam-vW); float dist=length(uCam-vW); vec2 p=vW.xz; float t=uTime; float a=1./(1.+dist*.035);
      vec2 g=vec2(cos(p.x*1.7+t*1.1+sin(p.y*.9)),cos(p.y*2.1-t*.9+sin(p.x*1.3)))*.04;
      g+=vec2(cos(p.x*5.3-t*1.7+p.y*2.),cos(p.y*6.1+t*2.1-p.x*1.5))*.022;
      g+=vec2(cos(p.x*.31+t*.4),cos(p.y*.27-t*.35))*.03;
      vec3 N=normalize(vec3(-g.x*a,1.,-g.y*a));
      float F=.05+.95*pow(1.-max(dot(N,V),0.),4.);
      vec3 R=reflect(-V,N); R.y=abs(R.y);
      vec3 c=mix(cDeep,sky(R),F);
      c=mix(c,cHor,smoothstep(500.,3600.,dist)*.8);
      gl_FragColor=vec4(c,1.); }`,
});
const water = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000).rotateX(-Math.PI / 2), waterMat);
lake.add(water);
// 遠山
function hills(radius, hMin, hMax, color, seed) {
  const seg = 220, pos = [], idx = [];
  const f = a => { let v = 0; for (let k = 1; k <= 5; k++) v += Math.sin(a * (k * 2 + 1) * 1.7 + seed * k) / k; return v; };
  for (let i = 0; i <= seg; i++) {
    const a = i / seg * Math.PI * 2, h = hMin + (hMax - hMin) * clamp(0.5 + 0.33 * f(a), 0, 1);
    pos.push(Math.cos(a) * radius, -4, Math.sin(a) * radius, Math.cos(a) * radius, h, Math.sin(a) * radius);
    if (i < seg) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })); m.frustumCulled = false; return m;
}
const hillsA = hills(3300, 60, 330, 0xa9bfc4, 1.7), hillsB = hills(2500, 30, 190, 0x6f929b, 4.1);
lake.add(hillsA, hillsB);
// 岸邊
{
  const g = new THREE.PlaneGeometry(90, 46, 60, 30).rotateX(-Math.PI / 2), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), z = P.getZ(i) + 23.3;           // 水線在 three z = 0.3
    const back = z - 0.3;
    P.setZ(i, z); P.setY(i, back < 0 ? -0.2 : 0.012 + 0.045 * back + 0.02 * Math.sin(x * 2.3) * Math.sin(z * 1.7));
  }
  g.computeVertexNormals();
  lake.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xb7a685 })));
  const rnd = (() => { let s = 12345; return () => (s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff) / 0x7fffffff; })();
  const N = 260, peb = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), N);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), T = new THREE.Vector3(), C = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const z = 0.32 + Math.pow(rnd(), 1.6) * 9, x = (rnd() - 0.5) * (5 + z * 2.2), s = 0.015 + rnd() * 0.06;
    T.set(x, 0.012 + 0.045 * (z - 0.3) + s * 0.15, z); S.set(s * (0.8 + rnd() * 0.6), s * (0.3 + rnd() * 0.3), s * (0.8 + rnd() * 0.6));
    Q.setFromEuler(new THREE.Euler(0, rnd() * 6.28, 0)); M.compose(T, Q, S); peb.setMatrixAt(i, M);
    const v = 0.45 + rnd() * 0.4; C.setRGB(v, v * (0.94 + rnd() * 0.08), v * (0.88 + rnd() * 0.1)); peb.setColorAt(i, C);
  }
  lake.add(peb);
}
// 距離浮標（右側，每 10 公尺）
{
  const post = new THREE.CylinderGeometry(0.07, 0.09, 0.5, 10), cap = new THREE.SphereGeometry(0.1, 12, 8);
  const red = new THREE.MeshLambertMaterial({ color: 0xd9533b }), white = new THREE.MeshLambertMaterial({ color: 0xf2efe6 });
  for (let dm = 10; dm <= 150; dm += 10) {
    const gp = new THREE.Group(); gp.position.copy(toThree([dm, -3.2, 0]));
    const a = new THREE.Mesh(post, dm % 50 === 0 ? red : white); a.position.y = 0.2; const b = new THREE.Mesh(cap, red); b.position.y = 0.48; gp.add(a, b);
    const cv = document.createElement('canvas'); cv.width = 160; cv.height = 80; const g = cv.getContext('2d');
    g.font = '700 54px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = 'rgba(10,30,38,.75)'; g.strokeText(dm, 80, 42); g.fillStyle = '#fff'; g.fillText(dm, 80, 42);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    sp.scale.set(1.3, 0.65, 1); sp.position.y = 1.05; gp.add(sp);
    lake.add(gp);
  }
}
// 漣漪
const RIPN = 56, ripples = [];
{
  const g = new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2);
  for (let i = 0; i < RIPN; i++) {
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; m.renderOrder = 2; lake.add(m); ripples.push({ m, age: 0, life: 0, r0: 0, grow: 0, a: 0 });
  }
}
let ripI = 0;
function spawnRipple(x, y, a, delay = 0) {
  const r = ripples[ripI++ % RIPN];
  r.age = -delay; r.life = 1.3 + a * 1.2; r.r0 = 0.05 + a * 0.05; r.grow = 0.55 + a * 0.6; r.a = 0.3 + 0.5 * a;
  toThree([x, y, 0.006], r.m.position); r.m.visible = true; r.m.material.opacity = 0;
}
// 水花
const DROPN = 360, drops = { p: new Float32Array(DROPN * 3), v: new Float32Array(DROPN * 3), life: new Float32Array(DROPN), i: 0 };
const dropGeo = new THREE.BufferGeometry(); dropGeo.setAttribute('position', new THREE.BufferAttribute(drops.p, 3));
for (let i = 0; i < DROPN; i++) drops.p[i * 3 + 1] = -50;
const dropTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
const dropPts = new THREE.Points(dropGeo, new THREE.PointsMaterial({ color: 0xffffff, map: dropTex, size: 0.03, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false }));
dropPts.frustumCulled = false; lake.add(dropPts);
function spawnDrops(x, y, hx, hy, speed, a) {
  const n = Math.round(5 + 22 * a);
  for (let k = 0; k < n; k++) {
    const i = drops.i++ % DROPN, ang = Math.random() * 6.283, s = (0.3 + Math.random()) * (0.5 + a);
    const vx = hx * speed * 0.22 * Math.random() + Math.cos(ang) * s, vy = hy * speed * 0.22 * Math.random() + Math.sin(ang) * s, vz = (0.8 + Math.random() * 1.8) * (0.4 + a);
    drops.p[i * 3] = -y; drops.p[i * 3 + 1] = 0.01; drops.p[i * 3 + 2] = -x;
    drops.v[i * 3] = -vy; drops.v[i * 3 + 1] = vz; drops.v[i * 3 + 2] = -vx; drops.life[i] = 0.9;
  }
}
const lakeStone = newStoneMesh(); lake.add(lakeStone);

// ============================================================ 工作台
const shop = new THREE.Scene(); shop.background = new THREE.Color(0x1b262b);
const shopCam = new THREE.PerspectiveCamera(32, 1, 0.02, 5);
shop.add(new THREE.HemisphereLight(0xffffff, 0x333a3d, 1.0));
{ const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(-0.4, 1, 0.5); shop.add(dl); }
const turntable = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.006, 64), new THREE.MeshLambertMaterial({ color: 0x8a6b4c }));
turntable.position.y = -0.045; shop.add(turntable);
{ const mark = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.0082, 0.03), new THREE.MeshLambertMaterial({ color: 0xe8d9b8 })); mark.position.set(0, 0, 0.054); turntable.add(mark); }
const axisLine = new THREE.Mesh(new THREE.CylinderGeometry(0.0005, 0.0005, 0.16, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28 }));
shop.add(axisLine);
const shopStone = newStoneMesh(); shop.add(shopStone);
const view = { yaw: 0.6, pitch: 0.55, dist: 0.34, tyaw: 0.6, tpitch: 0.55 };

// ============================================================ 狀態
let mode = 'lake';            // 'lake' | 'shop'
let state = 'aim';            // 湖：'aim' | 'fly' | 'sink' | 'result'
const cache = new Map();      // id → { stone, body }
let cur = null;               // { rec, stone, body }
let thr = null, flight = null;
let time = 0, spinPhase = 0, sinkT = 0;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camPosT = new THREE.Vector3(), camLookT = new THREE.Vector3();
const AIM_POS = [-0.6, -0.03, 0.5], AIM_LOOK = [3.2, 0.25, 0.02];
toThree(AIM_POS, camPos); toThree(AIM_LOOK, camLook);
const Rtmp = new Float64Array(9);

function getStone(rec) {
  let c = cache.get(rec.id);
  if (!c) {
    let stone;
    try { stone = Stone.decode(rec.data, rec.rock); } catch (e) { stone = Stone.raw(7, 'granite'); }
    c = { stone, body: prepareBody(stone) }; cache.set(rec.id, c);
    if (cache.size > 6) cache.delete(cache.keys().next().value);
  }
  return c;
}
function recFromStone(stone, name) {
  const mp = stone.massProps();
  return { id: 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), name, rock: stone.rock, data: stone.encode(), mass: mp.mass, size: mp.size, wob: mp.tiltDeg, thumb: makeThumb(stone), best: null, throws: 0, created: Date.now() };
}
function selectStone(id) {
  let rec = store.stones.find(s => s.id === id) || store.stones[0];
  if (!rec) {   // 第一次玩：送一顆路邊的原石
    const st = Stone.raw(20261106, 'granite'); rec = recFromStone(st, '路邊的石頭'); store.stones.push(rec); store.nextNo = Math.max(store.nextNo, 2);
  }
  store.currentId = rec.id;
  const c = getStone(rec);
  cur = { rec, stone: c.stone, body: c.body };
  lakeStone.geometry.dispose(); lakeStone.geometry = stoneGeometry(cur.stone);
  setRockColor(rec.rock);
  $('chipName').textContent = rec.name; $('chipImg').src = rec.thumb;
  $('chipInfo').textContent = `${Math.round(rec.mass * 1000)} g　${rec.best ? '最佳 ' + rec.best.skips + ' 下' : '還沒丟過'}`;
  save();
}

// ============================================================ 丟
function setState(s) {
  state = s;
  $('hint').classList.toggle('hide', s !== 'aim');
  $('tilt').classList.toggle('hide', s !== 'aim');
  $('count').classList.toggle('hide', s === 'aim' || s === 'result');
  $('result').classList.toggle('hide', s !== 'result');
  $('top').classList.toggle('hide', s === 'fly' || s === 'sink');
}
function doThrow(effort, yaw) {
  if (mode !== 'lake' || state !== 'aim' || !cur) return false;
  effort = clamp(effort, 0.3, 1); yaw = clamp(yaw, -0.4, 0.4);
  const b = cur.body, V = throwSpeed(b.mass, effort), spin = throwSpin(V, b.rGrip);
  thr = new Throw(b, { speed: V, tilt: store.tilt * deg, spin, yaw, height: ARM.height, phase: spinPhase });
  flight = { V, spin, tilt: store.tilt, effort, fast: false, shown: 0 };
  $('countN').textContent = '0'; $('countD').textContent = '0.0 m';
  setState('fly'); sfx.whoosh(effort);
  return true;
}
function onEvents(evs) {
  for (const e of evs) {
    if (e.type === 'in') {
      const a = clamp(Math.abs(e.vz) / 2.6 * 0.6 + e.speed / 16 * 0.4, 0.12, 1), sp = Math.hypot(thr.v[0], thr.v[1]) || 1;
      spawnRipple(e.x, e.y, a); spawnRipple(e.x, e.y, a * 0.6, 0.18);
      spawnDrops(e.x, e.y, thr.v[0] / sp, thr.v[1] / sp, e.speed, a);
      sfx.plip(thr.skips, a);
    } else if (e.type === 'skip') {
      const n = $('countN'); n.textContent = e.n; n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop');
    } else if (e.type === 'sink') {
      spawnRipple(e.x, e.y, 1); spawnRipple(e.x, e.y, 0.8, 0.25); sfx.sink();
    }
  }
}
function finishThrow() {
  const skips = thr.skips, dist = Math.round(thr.distance() * 10) / 10, rec = cur.rec;
  rec.throws = (rec.throws || 0) + 1;
  const stoneBest = skips > 0 && (!rec.best || skips > rec.best.skips || (skips === rec.best.skips && dist > rec.best.dist));
  if (stoneBest) rec.best = { skips, dist };
  const top = store.board[0];
  const allBest = skips > 0 && (!top || skips > top.skips || (skips === top.skips && dist > top.dist));
  if (skips > 0) {
    store.board.push({ name: rec.name, sid: rec.id, skips, dist, mass: Math.round(rec.mass * 1000), t: Date.now() });
    store.board.sort((a, b) => b.skips - a.skips || b.dist - a.dist);
    // 兩種排法都要留得住：依「下數」前 60 名＋依「距離」前 60 名
    const keep = new Set(store.board.slice(0, 60));
    [...store.board].sort((a, b) => b.dist - a.dist).slice(0, 60).forEach(e => keep.add(e));
    store.board = store.board.filter(e => keep.has(e));
  }
  save();
  $('resN').textContent = skips; $('resD').textContent = dist.toFixed(1);
  $('resV').textContent = flight.V.toFixed(1); $('resS').textContent = (flight.spin / (2 * Math.PI)).toFixed(1); $('resT').textContent = flight.tilt + '°';
  const bd = $('resBadges'); bd.innerHTML = '';
  if (allBest) bd.appendChild(el('span', 'badge', '新紀錄'));
  else if (stoneBest) bd.appendChild(el('span', 'badge', '這顆石頭的最佳'));
  $('resTip').textContent = tipFor(skips);
  $('chipInfo').textContent = `${Math.round(rec.mass * 1000)} g　${rec.best ? '最佳 ' + rec.best.skips + ' 下' : '還沒丟過'}`;
  setState('result');
}
function tipFor(skips) {
  const r = cur.rec;
  if (flight.effort < 0.6) return '滑快一點，出手會更有力。';
  if (r.size[2] > 0.022 && skips < 12) return '這顆太厚了。去「磨石頭」把它磨扁，會彈更多下。';
  if (r.wob > 6) return '石頭歪歪的，飛起來會晃。用「轉盤」把它磨對稱。';
  if (flight.tilt > 24) return '仰角大，每一下彈得高但很耗速度。試試 10° 上下。';
  if (flight.tilt < 3) return '仰角太小，容易直接鏟進水裡。';
  if (skips >= WORLD_RECORD) return `你超過世界紀錄的 ${WORLD_RECORD} 下了。`;
  return `世界紀錄是 ${WORLD_RECORD} 下（Kurt Steiner，2013）。`;
}
function again() { if (state === 'result') { thr = null; setState('aim'); } }

// ============================================================ 湖邊操作
const swipe = { id: null, pts: [] };
function lakeDown(e) {
  sfx.init();
  if (state === 'aim') { swipe.id = e.pointerId; swipe.pts = [{ x: e.clientX, y: e.clientY, t: performance.now() }]; }
  else if (state === 'fly' && flight) flight.fast = true;
}
function lakeMove(e) {
  if (swipe.id !== e.pointerId) return;
  swipe.pts.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  if (swipe.pts.length > 40) swipe.pts.shift();
}
function lakeUp(e, cancel) {
  if (flight) flight.fast = false;
  if (swipe.id !== e.pointerId) return;
  swipe.id = null;
  if (cancel || state !== 'aim') return;
  const pts = swipe.pts, last = pts[pts.length - 1];
  let first = pts[0];
  for (let i = pts.length - 1; i >= 0; i--) { if (last.t - pts[i].t > 130) break; first = pts[i]; }
  const dt = Math.max(0.016, (last.t - first.t) / 1000), dx = last.x - first.x, dy = last.y - first.y;
  const total = pts[0].y - last.y;
  if (total < 36 || dy > -8) return;       // 沒有往上滑就不算
  const speed = Math.hypot(dx, dy) / dt;   // px/s
  doThrow(speed / (innerHeight * 2.4), Math.atan2(-dx, -dy) * 0.6);
}
// 仰角滑桿
const TILT_MAX = 35;
function setTilt(v) {
  store.tilt = Math.round(clamp(v, 0, TILT_MAX));
  $('tiltVal').textContent = store.tilt + '°';
  const tr = $('tilt').getBoundingClientRect(), pad = 16;
  $('tiltKnob').style.top = (pad + (1 - store.tilt / TILT_MAX) * (tr.height - pad * 2)) + 'px';
}
{
  const t = $('tilt'); let on = false;
  const upd = e => { const r = t.getBoundingClientRect(); setTilt((1 - (e.clientY - r.top - 16) / (r.height - 32)) * TILT_MAX); };
  t.addEventListener('pointerdown', e => { on = true; try { t.setPointerCapture(e.pointerId); } catch (x) { /* */ } upd(e); e.stopPropagation(); });
  t.addEventListener('pointermove', e => { if (on) upd(e); });
  const end = () => { if (on) { on = false; save(); } };
  t.addEventListener('pointerup', end); t.addEventListener('pointercancel', end);
}

// ============================================================ 工作台操作
let edit = null;       // { stone, rec, undo[], changed, body? }
let tool = 'grind', lathe = false, lathePhi = 0, geoDirty = false, statsT = 0;
// 「磨」是一整塊平的磨刀石：面向你的那一面整面被磨平（半徑給很大，等於無限大的平面）
const TOOL_R = { cut: 0.0035, grind: 0.3, polish: 0.011 };
const TIPS = {
  turn: '拖曳轉動石頭，兩指可以縮放',
  cut: '手指滑過的地方會整塊切掉。先按「俯視」修外形',
  grind: '在石頭上來回磨，面向你的那一面會整面磨平',
  polish: '來回擦，把稜角磨圓',
  lathe: '轉盤開著：按住不放，石頭轉一圈就磨得對稱',
};
function setTool(t) {
  tool = t;
  document.querySelectorAll('#tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  $('shopTip').textContent = lathe && t !== 'turn' ? TIPS.lathe : TIPS[t];
  $('ring').classList.add('hide');
}
document.querySelectorAll('#tools button').forEach(b => b.onclick = () => setTool(b.dataset.tool));
function setLathe(on) { lathe = on; $('actLathe').classList.toggle('on', on); setTool(tool); }
$('actLathe').onclick = () => setLathe(!lathe);
$('actTop').onclick = () => { view.tpitch = 88 * deg; };
$('actSide').onclick = () => { view.tpitch = 0; };
$('actUndo').onclick = () => {
  if (!edit || !edit.undo.length || stroke) return;
  edit.stone.restore(edit.undo.pop()); geoDirty = true; statsT = 0; $('actUndo').disabled = !edit.undo.length;
};
$('actFlip').onclick = () => {
  if (!edit || stroke) return;
  pushUndo(); edit.stone.flip(); edit.changed = true; geoDirty = true; statsT = 0; $('actUndo').disabled = false;
};
$('actNew').onclick = async () => {
  if (!edit || stroke) return;
  if (edit.changed && !(await ask({ title: '換一顆新的原石？', text: '現在這顆磨到一半的會不見。', yes: '換一顆', no: '繼續磨' }))) return;
  startEdit(Stone.raw(nextSeed()), null, true); save();
};
function startEdit(stone, rec, changed) {
  edit = { stone, rec, undo: [], changed };
  setRockColor(stone.rock); geoDirty = true; statsT = 0; lathePhi = 0; $('actUndo').disabled = true;
}
function openShop(newRaw) {
  if (mode === 'shop' || state === 'fly' || state === 'sink') return;
  if (newRaw && store.stones.length >= MAX_STONES) { toast(`最多留 ${MAX_STONES} 顆，先刪掉幾顆`); return; }
  closePanel(); sfx.init();
  mode = 'shop'; $('lakeUI').classList.add('hide'); $('shopUI').classList.remove('hide');
  if (newRaw) { startEdit(Stone.raw(nextSeed()), null, true); save(); } else startEdit(cur.stone.clone(), cur.rec, false);
  view.yaw = view.tyaw = 0.6; view.pitch = view.tpitch = 0.55; view.dist = 0.34;
  setLathe(false); setTool('grind');
}
function closeShop() {
  endStroke(true); sfx.grind(false);
  mode = 'lake'; edit = null; $('shopUI').classList.add('hide'); $('lakeUI').classList.remove('hide');
  setRockColor(cur.rec.rock); thr = null; setState('aim'); setTilt(store.tilt);
}
$('btnBack').onclick = async () => {
  if (!edit) return;
  endStroke(true);
  if (edit.changed && edit.undo.length && !(await ask({ title: '不存就離開？', text: '這次磨的不會留下來。', yes: '離開', no: '繼續磨' }))) return;
  if (mode === 'shop') closeShop();
};
$('btnDone').onclick = async () => {
  if (!edit) return;
  endStroke(true);
  const e = edit;
  e.stone.keepLargest(); geoDirty = true;
  const mp = e.stone.massProps();
  if (mp.mass < 0.008) { toast('石頭太小了，丟不出去'); return; }
  if (!e.changed) { closeShop(); return; }
  if (!e.rec && store.stones.length >= MAX_STONES) { toast(`最多留 ${MAX_STONES} 顆，先刪掉幾顆`); return; }
  const name = await ask({ title: '幫石頭取名字', text: e.rec ? '形狀改過了，這顆的最佳紀錄會重新算。' : '', input: e.rec ? e.rec.name : `石頭 ${store.nextNo}號`, yes: '存起來' });
  if (name === null || edit !== e || mode !== 'shop') return;
  const fresh = recFromStone(e.stone, String(name).slice(0, 12) || '石頭');
  let rec = e.rec && store.stones.find(s => s.id === e.rec.id);
  if (rec) { Object.assign(rec, fresh, { id: rec.id, created: rec.created }); }
  else { rec = fresh; store.stones.unshift(rec); store.nextNo++; }
  cache.delete(rec.id);
  if (!save()) { toast('存不進去，先刪掉幾顆石頭'); }
  selectStone(rec.id); closeShop();
};

const ptrs = new Map();
let stroke = null, orbit = null, pinch = null;
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2(), vTmp = new THREE.Vector3();
function w2l(v, phi) {   // three 世界向量 → 石頭本地
  const px = -v.z, py = -v.x, pz = v.y, c = Math.cos(phi), s = Math.sin(phi);
  return [c * px + s * py, -s * px + c * py, pz];
}
function localRay(x, y, phi) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight * 2 - 1)); raycaster.setFromCamera(ndc, shopCam);
  return { o: w2l(raycaster.ray.origin, phi), d: w2l(raycaster.ray.direction, phi) };
}
function camNormal(phi) { shopCam.getWorldDirection(vTmp); const d = w2l(vTmp, phi); return [-d[0], -d[1], -d[2]]; }
function pushUndo() { edit.undo.push(edit.stone.snapshot()); if (edit.undo.length > 24) edit.undo.shift(); }

function beginStroke(x, y) {
  const r = localRay(x, y, lathePhi), hit = edit.stone.raycast(r.o, r.d);
  if (tool !== 'cut' && hit < 0) return false;      // 沒按到石頭 → 當成轉視角
  pushUndo();
  stroke = { x, y, removed: 0, s: null, hard: ROCKS[edit.stone.rock].hard };
  sfx.grind(true);
  carveAt(x, y, lathePhi, 0, 0);
  return true;
}
// 在螢幕座標 (x,y) 動一次刀。px＝這次手指移動的像素、dt＝經過的時間（轉盤用）
function carveAt(x, y, phi, px, dt) {
  const st = edit.stone, r = localRay(x, y, phi);
  let rem = 0;
  if (tool === 'cut') rem = st.cutCylinder(r.o, r.d, TOOL_R.cut);
  else if (tool === 'polish') {
    const t = st.raycast(r.o, r.d);
    if (t >= 0) rem = st.smoothAt([r.o[0] + r.d[0] * t, r.o[1] + r.d[1] * t, r.o[2] + r.d[2] * t], TOOL_R.polish, clamp(0.75 / stroke.hard, 0.2, 0.9));
  } else if (tool === 'grind') {
    const nt = camNormal(phi), dn = r.d[0] * nt[0] + r.d[1] * nt[1] + r.d[2] * nt[2];
    if (Math.abs(dn) < 1e-4) return;
    if (stroke.s === null) {
      // 磨具從它底下最高的地方開始碰到石頭
      const t0 = st.raycast(r.o, r.d), tt = t0 >= 0 ? t0 : -(r.o[0] * r.d[0] + r.o[1] * r.d[1] + r.o[2] * r.d[2]);
      const s0 = st.maxAlong([r.o[0] + r.d[0] * tt, r.o[1] + r.d[1] * tt, r.o[2] + r.d[2] * tt], nt, TOOL_R.grind);
      if (s0 < -1e8) return;
      stroke.s = s0 + H * 0.5;
    }
    stroke.s -= (px * H / 100 + dt * 0.004) / stroke.hard;
    const t = (stroke.s - (r.o[0] * nt[0] + r.o[1] * nt[1] + r.o[2] * nt[2])) / dn;
    rem = st.grindPlane([r.o[0] + r.d[0] * t, r.o[1] + r.d[1] * t, r.o[2] + r.d[2] * t], nt, stroke.s, TOOL_R.grind);
  }
  if (rem > 0) { stroke.removed += rem; geoDirty = true; }
}
function moveStroke(x, y) {
  if (!stroke) return;
  const dx = x - stroke.x, dy = y - stroke.y, dist = Math.hypot(dx, dy);
  if (dist < 1) return;
  const n = tool === 'grind' ? 1 : Math.min(40, Math.max(1, Math.ceil(dist / 5)));   // 平面磨具跟手指位置無關，一次就好
  for (let i = 1; i <= n; i++) carveAt(stroke.x + dx * i / n, stroke.y + dy * i / n, lathePhi, dist / n, 0);
  stroke.x = x; stroke.y = y;
}
function endStroke(silent) {
  if (!stroke) return;
  const s = stroke; stroke = null; sfx.grind(false);
  if (!edit) return;
  if (s.removed > 0.01) {
    edit.changed = true;
    const n = edit.stone.keepLargest(lathe);
    if (n < 8) { edit.stone.restore(edit.undo.pop()); if (!silent) toast('不能整顆磨光'); }
    geoDirty = true; statsT = 0;
  } else edit.undo.pop();
  $('actUndo').disabled = !edit.undo.length;
}
function ringAt(x, y) {
  const r = $('ring');
  if (mode !== 'shop' || tool === 'turn' || tool === 'grind') { r.classList.add('hide'); return; }
  const ppm = (innerHeight / 2) / (Math.tan(shopCam.fov * deg / 2) * view.dist), d = Math.max(10, TOOL_R[tool] * 2 * ppm);
  r.style.width = r.style.height = d + 'px'; r.style.left = x + 'px'; r.style.top = y + 'px'; r.classList.remove('hide');
}
function shopDown(e) {
  sfx.init();
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size >= 2) {
    endStroke(); orbit = null;
    const [a, b] = [...ptrs.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, dist: view.dist };
    $('ring').classList.add('hide');
    return;
  }
  if (tool !== 'turn' && e.button !== 2 && beginStroke(e.clientX, e.clientY)) { stroke.id = e.pointerId; ringAt(e.clientX, e.clientY); return; }
  orbit = { id: e.pointerId, x: e.clientX, y: e.clientY };
}
function shopMove(e) {
  const p = ptrs.get(e.pointerId);
  if (!p) { if (e.pointerType === 'mouse') ringAt(e.clientX, e.clientY); return; }
  p.x = e.clientX; p.y = e.clientY;
  if (pinch && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    view.dist = clamp(pinch.dist * pinch.d / d, 0.16, 0.6);
    view.tyaw -= (mx - pinch.mx) * 0.008; view.tpitch = clamp(view.tpitch + (my - pinch.my) * 0.008, -88 * deg, 88 * deg);
    view.yaw = view.tyaw; view.pitch = view.tpitch; pinch.mx = mx; pinch.my = my;
    return;
  }
  if (stroke && stroke.id === e.pointerId) { moveStroke(e.clientX, e.clientY); ringAt(e.clientX, e.clientY); }
  else if (orbit && orbit.id === e.pointerId) {
    view.tyaw -= (e.clientX - orbit.x) * 0.008; view.tpitch = clamp(view.tpitch + (e.clientY - orbit.y) * 0.008, -88 * deg, 88 * deg);
    view.yaw = view.tyaw; view.pitch = view.tpitch; orbit.x = e.clientX; orbit.y = e.clientY;
  }
}
function shopUp(e) {
  ptrs.delete(e.pointerId);
  if (stroke && stroke.id === e.pointerId) endStroke();
  if (orbit && orbit.id === e.pointerId) orbit = null;
  if (ptrs.size < 2) pinch = null;
  if (e.pointerType !== 'mouse') $('ring').classList.add('hide');
}
canvas.addEventListener('pointerdown', e => { try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* */ } if (mode === 'lake') lakeDown(e); else shopDown(e); });
canvas.addEventListener('pointermove', e => { if (mode === 'lake') lakeMove(e); else shopMove(e); });
canvas.addEventListener('pointerup', e => { if (mode === 'lake') { const was = state; lakeUp(e, false); if (was === 'result') again(); } else shopUp(e); });
canvas.addEventListener('pointercancel', e => { if (mode === 'lake') lakeUp(e, true); else shopUp(e); });
canvas.addEventListener('wheel', e => { if (mode === 'shop') view.dist = clamp(view.dist * (1 + Math.sign(e.deltaY) * 0.08), 0.16, 0.6); e.preventDefault(); }, { passive: false });
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());

function updateStats() {
  const mp = edit.stone.massProps();
  $('stMass').textContent = Math.round(mp.mass * 1000);
  $('stDia').textContent = Math.round(Math.max(mp.size[0], mp.size[1]) * 1000);
  $('stThick').textContent = Math.round(mp.size[2] * 1000);
  const w = $('stWob'); w.textContent = mp.tiltDeg.toFixed(1) + '°'; w.classList.toggle('warn', mp.tiltDeg > 6);
}

// ============================================================ 面板
function showStones() {
  if (mode !== 'lake' || state === 'fly' || state === 'sink') return;
  openPanel('我的石頭', body => {
    const g = el('div', 'grid');
    const add = el('div', 'card new'); add.appendChild(el('i', '', '＋')); add.appendChild(document.createTextNode('去河邊撿一顆新的'));
    add.onclick = () => openShop(true); g.appendChild(add);
    for (const r of store.stones) {
      const c = el('div', 'card' + (r.id === store.currentId ? ' cur' : ''));
      const im = el('img'); im.src = r.thumb; im.alt = ''; c.appendChild(im);
      c.appendChild(el('b', '', r.name));
      c.appendChild(el('span', '', `${ROCKS[r.rock]?.name || ''}　${Math.round(r.mass * 1000)} g`));
      c.appendChild(el('span', '', r.best ? `最佳 ${r.best.skips} 下　${r.best.dist.toFixed(1)} m` : '還沒丟過'));
      const row = el('div', 'row');
      const use = el('button', r.id === store.currentId ? 'on' : '', r.id === store.currentId ? '使用中' : '用這顆');
      use.onclick = () => { selectStone(r.id); thr = null; setState('aim'); closePanel(); };
      const ed = el('button', '', '重磨'); ed.onclick = () => { selectStone(r.id); openShop(false); };
      const del = el('button', '', '刪'); del.onclick = async () => {
        if (!(await ask({ title: `刪掉「${r.name}」？`, text: '刪了就拿不回來。排行榜上的紀錄會留著。', yes: '刪掉' }))) return;
        store.stones = store.stones.filter(s => s.id !== r.id); cache.delete(r.id);
        if (store.currentId === r.id) { selectStone(null); thr = null; setState('aim'); } else save();
        showStones();
      };
      row.append(use, ed, del); c.appendChild(row); g.appendChild(c);
    }
    body.appendChild(g);
  });
}
let boardTab = 'skips';
function showBoard() {
  if (mode !== 'lake' || state === 'fly' || state === 'sink') return;
  openPanel('排行榜', body => {
    const tabs = el('div', 'tabs');
    for (const [k, label] of [['skips', '彈最多下'], ['dist', '丟最遠']]) {
      const b = el('button', boardTab === k ? 'on' : '', label); b.onclick = () => { boardTab = k; showBoard(); }; tabs.appendChild(b);
    }
    body.appendChild(tabs);
    const rows = [...store.board].sort(boardTab === 'skips' ? (a, b) => b.skips - a.skips || b.dist - a.dist : (a, b) => b.dist - a.dist || b.skips - a.skips).slice(0, 30);
    if (!rows.length) body.appendChild(el('div', 'empty', '還沒有紀錄。丟一顆試試。'));
    else {
      const t = el('table'), h = el('tr');
      for (const s of ['#', '石頭', '下', '公尺', '重 g']) h.appendChild(el('th', '', s));
      t.appendChild(h);
      rows.forEach((r, i) => {
        const tr = el('tr', r.sid === store.currentId ? 'me' : '');
        for (const s of [i + 1, r.name, r.skips, r.dist.toFixed(1), r.mass]) tr.appendChild(el('td', '', s));
        t.appendChild(tr);
      });
      body.appendChild(t);
    }
    body.appendChild(el('p', 'note', `目前是這台裝置上的紀錄。世界紀錄：${WORLD_RECORD} 下（Kurt Steiner，2013，金氏世界紀錄）。`));
  });
}
$('chip').onclick = showStones;
$('btnBoard').onclick = showBoard;
$('btnShop').onclick = () => openShop(false);
$('btnShop2').onclick = () => openShop(false);
$('btnAgain').onclick = again;
function setSound(on) { store.sound = on; $('btnSound').textContent = on ? '🔊' : '🔇'; if (on) sfx.init(); else if (sfx.grindGain) sfx.grindGain.gain.value = 0; }
$('btnSound').onclick = () => { setSound(!store.sound); save(); };

// ============================================================ 每一幀
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
  lakeCam.aspect = shopCam.aspect = w / h;
  lakeCam.fov = w > h ? 42 : 55; lakeCam.updateProjectionMatrix(); shopCam.updateProjectionMatrix();
  setTilt(store.tilt);
}
addEventListener('resize', resize);

function updateLake(dt) {
  waterMat.uniforms.uTime.value = time;
  if (state === 'aim' || state === 'result') {
    spinPhase += dt * 1.2;
    if (state === 'aim') {
      rotTilt(store.tilt * deg, spinPhase, Rtmp);
      setStoneMatrix(lakeStone, Rtmp, [0, 0, ARM.height + 0.008 * Math.sin(time * 1.7)], cur.body.com);
      lakeStone.visible = true;
      toThree(AIM_POS, camPosT); toThree(AIM_LOOK, camLookT);
    }
  }
  if (state === 'fly' || state === 'sink') {
    if (state === 'fly') {
      const evs = thr.advance(dt * (flight.fast ? 3 : 1));
      onEvents(evs);
      if (thr.done) { state = 'sink'; sinkT = 0; if (!thr.sunk || thr.p[2] > -0.05) { spawnRipple(thr.p[0], thr.p[1], 0.7); sfx.sink(); } }
      const d = thr.distance();
      $('countD').textContent = d.toFixed(1) + ' m';
    } else {
      sinkT += dt; thr.p[2] -= dt * 0.35;
      if (sinkT > 0.9) finishThrow();
    }
    // 石頭的網格以格子中心為原點，物理以質心為原點
    setStoneMatrix(lakeStone, thr.R, thr.p, cur.body.com);
    lakeStone.visible = thr.p[2] > -0.2;
    const sp = Math.hypot(thr.v[0], thr.v[1]), hx = sp > 0.5 ? thr.v[0] / sp : 1, hy = sp > 0.5 ? thr.v[1] / sp : 0;
    const back = 0.95 + Math.min(1.1, sp * 0.075), pz = Math.max(thr.p[2], 0);
    toThree([thr.p[0] - hx * back + hy * 0.4, thr.p[1] - hy * back - hx * 0.4 + 0.2, 0.42 + pz * 0.6 + back * 0.1], camPosT);
    toThree([thr.p[0] + hx * 1.6, thr.p[1] + hy * 1.6, pz * 0.5], camLookT);
  }
  if (state === 'result') lakeStone.visible = false;
  const k = 1 - Math.exp(-dt * (state === 'aim' ? 3.5 : 7));
  camPos.lerp(camPosT, k); camLook.lerp(camLookT, k);
  lakeCam.position.copy(camPos); lakeCam.lookAt(camLook);
  skyDome.position.copy(camPos); hillsA.position.set(camPos.x, 0, camPos.z); hillsB.position.set(camPos.x * 0.9, 0, camPos.z * 0.9);
  water.position.set(Math.round(camPos.x / 50) * 50, 0, Math.round(camPos.z / 50) * 50);
  waterMat.uniforms.uCam.value.copy(camPos);
  for (const r of ripples) {
    if (!r.m.visible) continue;
    r.age += dt;
    if (r.age < 0) continue;
    if (r.age > r.life) { r.m.visible = false; continue; }
    const s = r.r0 + r.grow * r.age; r.m.scale.set(s, 1, s); r.m.material.opacity = r.a * (1 - r.age / r.life);
  }
  const P = drops.p, Vv = drops.v;
  for (let i = 0; i < DROPN; i++) {
    if (drops.life[i] <= 0) continue;
    drops.life[i] -= dt; Vv[i * 3 + 1] -= 9.81 * dt;
    P[i * 3] += Vv[i * 3] * dt; P[i * 3 + 1] += Vv[i * 3 + 1] * dt; P[i * 3 + 2] += Vv[i * 3 + 2] * dt;
    if (P[i * 3 + 1] < 0 || drops.life[i] <= 0) { drops.life[i] = 0; P[i * 3 + 1] = -50; }
  }
  dropGeo.attributes.position.needsUpdate = true;
}
const RZ = new Float64Array(9);
function updateShop(dt) {
  if (!edit) return;
  if (lathe) {
    const dphi = dt * 2 * Math.PI * 0.9;
    if (stroke && tool !== 'turn') {
      const n = tool === 'grind' ? 2 : Math.max(1, Math.ceil(dphi * 30 / 1.5));
      for (let i = 1; i <= n; i++) carveAt(stroke.x, stroke.y, lathePhi + dphi * i / n, 0, dt / n);
    }
    lathePhi = (lathePhi + dphi) % (2 * Math.PI);
  }
  view.yaw += (view.tyaw - view.yaw) * Math.min(1, dt * 10); view.pitch += (view.tpitch - view.pitch) * Math.min(1, dt * 10);
  const cp = Math.cos(view.pitch);
  shopCam.position.set(view.dist * cp * Math.sin(view.yaw), view.dist * Math.sin(view.pitch), view.dist * cp * Math.cos(view.yaw));
  shopCam.lookAt(0, 0, 0); shopCam.updateMatrixWorld();
  if (geoDirty) { geoDirty = false; shopStone.geometry.dispose(); shopStone.geometry = stoneGeometry(edit.stone); }
  statsT -= dt; if (statsT <= 0) { statsT = 0.25; updateStats(); }
  const c = Math.cos(lathePhi), s = Math.sin(lathePhi);
  RZ[0] = c; RZ[1] = -s; RZ[2] = 0; RZ[3] = s; RZ[4] = c; RZ[5] = 0; RZ[6] = 0; RZ[7] = 0; RZ[8] = 1;
  setStoneMatrix(shopStone, RZ, [0, 0, 0], [0, 0, 0]);
  turntable.rotation.y = lathePhi;
}
let lastTs = 0, frames = 0;
function frame(ts) {
  const dt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000)); lastTs = ts; time += dt; frames++;
  const run = !window.__pause;
  if (mode === 'lake') { if (run) updateLake(dt); renderer.render(lake, lakeCam); }
  else { if (run) updateShop(dt); renderer.render(shop, shopCam); }
  requestAnimationFrame(frame);
}

// ============================================================ 開始
selectStone(store.currentId);
setSound(store.sound !== false);
resize(); setState('aim');
requestAnimationFrame(t => { lastTs = t; requestAnimationFrame(frame); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { endStroke(true); sfx.grind(false); } });

// 測試用的鉤子
window.__g = {
  get mode() { return mode; }, get state() { return state; }, get thr() { return thr; }, get edit() { return edit; }, get cur() { return cur; }, get frames() { return frames; },
  get tool() { return tool; }, get lathe() { return lathe; }, get stroke() { return stroke; },
  store, doThrow, openShop, closeShop, setTool, setLathe, selectStone, showStones, showBoard, again, view, Stone, save,
  step(dt) { if (mode === 'lake') updateLake(dt); else updateShop(dt); time += dt; },
};
if (/[?&]fuzz=/.test(location.search)) import('../test/fuzz.js').then(m => m.run(window.__g)).catch(e => { document.title = 'FUZZ-LOAD-FAIL ' + e; });
