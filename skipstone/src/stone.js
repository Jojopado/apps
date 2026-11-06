// stone.js — 石頭本體：體素密度場、雕刻、網格化、質量性質
// 座標：石頭本地座標（公尺），原點在格子中心，Z 軸＝丟出去時的自轉軸（平放時朝上）。
// 密度場 d ∈ [0,1]，0.5 是表面。雕刻只會減少材料，不會增加。

export const NX = 64, NY = 64, NZ = 32;
export const H = 0.002;                 // 一格 2 mm → 12.8 × 12.8 × 6.4 cm
export const NCELL = NX * NY * NZ;
const SX = 1, SY = NX, SZ = NX * NY;
const CX = (NX - 1) / 2, CY = (NY - 1) / 2, CZ = (NZ - 1) / 2;

// 岩石密度為常見範圍的代表值（砂岩約 2.2–2.6、花崗岩約 2.6–2.7、玄武岩約 2.8–3.0 g/cm³）
export const ROCKS = {
  sandstone: { name: '砂岩', density: 2300, hard: 0.7, color: [0.80, 0.66, 0.48], speck: [0.62, 0.48, 0.33] },
  granite:   { name: '花崗岩', density: 2650, hard: 1.0, color: [0.70, 0.68, 0.66], speck: [0.36, 0.35, 0.36] },
  basalt:    { name: '玄武岩', density: 2950, hard: 1.4, color: [0.30, 0.31, 0.35], speck: [0.18, 0.19, 0.22] },
};
export const ROCK_KEYS = Object.keys(ROCKS);

export function rng32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

// 網格化用的暫存（重複使用，避免每次配置）
const MAXV = 90000, MAXQ = 90000;
const _vidx = new Int32Array(NCELL);
const _pos = new Float32Array(MAXV * 3);
const _quad = new Uint32Array(MAXQ * 4);
const _tmp = new Float32Array(NCELL);
const EDGE_A = [0, 2, 4, 6, 0, 1, 4, 5, 0, 1, 2, 3];
const EDGE_B = [1, 3, 5, 7, 2, 3, 6, 7, 4, 5, 6, 7];

export class Stone {
  constructor(rock = 'granite') {
    this.d = new Float32Array(NCELL);
    this.rock = rock;
  }
  clone() { const s = new Stone(this.rock); s.d.set(this.d); return s; }

  // ---------- 產生 ----------
  // sdf(x,y,z)：公尺，內部為負
  fillSDF(sdf) {
    const d = this.d;
    for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const id = i + SY * j + SZ * k;
      if (i < 2 || j < 2 || k < 2 || i > NX - 3 || j > NY - 3 || k > NZ - 3) { d[id] = 0; continue; }
      d[id] = clamp01(0.5 - sdf((i - CX) * H, (j - CY) * H, (k - CZ) * H) / H);
    }
    return this;
  }

  // 圓角圓盤（測試、校正用）
  static disc(radius, thick, round = 0.003, rock = 'granite') {
    const s = new Stone(rock);
    const e = Math.min(round, thick / 2, radius);
    return s.fillSDF((x, y, z) => {
      const qx = Math.hypot(x, y) - (radius - e), qz = Math.abs(z) - (thick / 2 - e);
      return Math.min(Math.max(qx, qz), 0) + Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) - e;
    });
  }

  // 河邊撿到的原石：凹凸的扁橢球＋幾個破裂面
  static raw(seed, rock) {
    const r = rng32(seed);
    if (!rock) rock = ROCK_KEYS[Math.floor(r() * ROCK_KEYS.length)];
    const s = new Stone(rock);
    const a = 0.040 + 0.012 * r(), b = 0.030 + 0.012 * r(), c = 0.015 + 0.009 * r();
    const pw = 2 + 1.6 * r();
    const lumps = [];
    for (let i = 0; i < 5; i++) {
      const kk = 35 + 85 * r(), th = Math.acos(2 * r() - 1), ph = 6.283 * r();
      lumps.push([0.05 + 0.06 * r(), kk * Math.sin(th) * Math.cos(ph), kk * Math.sin(th) * Math.sin(ph), kk * Math.cos(th), 6.283 * r()]);
    }
    const planes = [];
    const np = 2 + Math.floor(3 * r());
    for (let i = 0; i < np; i++) {
      const th = Math.acos(2 * r() - 1), ph = 6.283 * r();
      planes.push([Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th), 0.72 + 0.25 * r()]);
    }
    const yaw = 6.283 * r(), cy = Math.cos(yaw), sy = Math.sin(yaw);
    const m = Math.min(a, b, c);
    s.fillSDF((X, Y, z) => {
      const x = cy * X + sy * Y, y = -sy * X + cy * Y;
      let n = 0;
      for (const l of lumps) n += l[0] * Math.sin(l[1] * x + l[2] * y + l[3] * z + l[4]);
      let f = Math.pow(Math.pow(Math.abs(x / a), pw) + Math.pow(Math.abs(y / b), pw) + Math.pow(Math.abs(z / c), pw), 1 / pw) * (1 + n) - 1;
      for (const p of planes) f = Math.max(f, (p[0] * x / a + p[1] * y / b + p[2] * z / c) - p[3]);
      return f * m;
    });
    s.blurAll(2);
    s.keepLargest();
    return s;
  }

  blurAll(passes = 1) {
    const d = this.d, t = _tmp;
    for (let p = 0; p < passes; p++) {
      for (const st of [SX, SY, SZ]) {
        t.set(d);
        for (let id = st; id < NCELL - st; id++) d[id] = 0.25 * t[id - st] + 0.5 * t[id] + 0.25 * t[id + st];
      }
    }
    this._clearBorder();
  }
  _clearBorder() {
    const d = this.d;
    for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      if (i < 1 || j < 1 || k < 1 || i > NX - 2 || j > NY - 2 || k > NZ - 2) d[i + SY * j + SZ * k] = 0;
    }
  }

  // ---------- 質量性質 ----------
  // 回傳 { mass(kg), volume(m³), com[3], I[9]（對質心、本地軸）, size[3]（公尺，長寬厚）, tiltDeg（最大慣量主軸偏離 Z 的角度）}
  massProps() {
    const d = this.d, rho = ROCKS[this.rock].density, cell = H * H * H;
    let m = 0, sx = 0, sy = 0, sz = 0;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) {
      const row = SY * j + SZ * k;
      for (let i = 0; i < NX; i++) {
        const v = d[row + i];
        if (v <= 0) continue;
        m += v; sx += v * i; sy += v * j; sz += v * k;
        if (v > 0.5) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; if (k < z0) z0 = k; if (k > z1) z1 = k; }
      }
    }
    if (m <= 0) return { mass: 0, volume: 0, com: [0, 0, 0], I: [0, 0, 0, 0, 0, 0, 0, 0, 0], size: [0, 0, 0], tiltDeg: 0 };
    const gx = sx / m, gy = sy / m, gz = sz / m;
    let ixx = 0, iyy = 0, izz = 0, ixy = 0, ixz = 0, iyz = 0;
    for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) {
      const row = SY * j + SZ * k, y = (j - gy) * H, z = (k - gz) * H;
      for (let i = 0; i < NX; i++) {
        const v = d[row + i];
        if (v <= 0) continue;
        const x = (i - gx) * H;
        ixx += v * (y * y + z * z); iyy += v * (x * x + z * z); izz += v * (x * x + y * y);
        ixy -= v * x * y; ixz -= v * x * z; iyz -= v * y * z;
      }
    }
    const k0 = rho * cell, self = m * H * H / 6;
    const I = [(ixx + self) * k0, ixy * k0, ixz * k0, ixy * k0, (iyy + self) * k0, iyz * k0, ixz * k0, iyz * k0, (izz + self) * k0];
    const ax = principalMaxAxis(I);
    const tiltDeg = Math.acos(Math.min(1, Math.abs(ax[2]))) * 180 / Math.PI;
    return {
      mass: m * k0, volume: m * cell,
      com: [(gx - CX) * H, (gy - CY) * H, (gz - CZ) * H], I,
      size: [(x1 - x0 + 1) * H, (y1 - y0 + 1) * H, (z1 - z0 + 1) * H], tiltDeg,
    };
  }

  // ---------- 網格化（Surface Nets）----------
  // 回傳 { positions, normals, indices, quads, nv, nq }；positions 為本地公尺
  mesh() {
    const d = this.d;
    let nv = 0, nq = 0;
    _vidx.fill(-1);
    const cv = new Float32Array(8);
    for (let k = 0; k < NZ - 1; k++) for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
      const id = i + SY * j + SZ * k;
      let mask = 0;
      const a0 = d[id], a1 = d[id + SX], a2 = d[id + SY], a3 = d[id + SX + SY];
      const a4 = d[id + SZ], a5 = d[id + SZ + SX], a6 = d[id + SZ + SY], a7 = d[id + SZ + SX + SY];
      if (a0 > 0.5) mask |= 1; if (a1 > 0.5) mask |= 2; if (a2 > 0.5) mask |= 4; if (a3 > 0.5) mask |= 8;
      if (a4 > 0.5) mask |= 16; if (a5 > 0.5) mask |= 32; if (a6 > 0.5) mask |= 64; if (a7 > 0.5) mask |= 128;
      if (mask === 0 || mask === 255) continue;
      if (nv >= MAXV) continue;
      cv[0] = a0 - 0.5; cv[1] = a1 - 0.5; cv[2] = a2 - 0.5; cv[3] = a3 - 0.5; cv[4] = a4 - 0.5; cv[5] = a5 - 0.5; cv[6] = a6 - 0.5; cv[7] = a7 - 0.5;
      let px = 0, py = 0, pz = 0, n = 0;
      for (let e = 0; e < 12; e++) {
        const ea = EDGE_A[e], eb = EDGE_B[e];
        const va = cv[ea], vb = cv[eb];
        if ((va > 0) === (vb > 0)) continue;
        const t = va / (va - vb);
        px += (ea & 1) + t * ((eb & 1) - (ea & 1));
        py += ((ea >> 1) & 1) + t * (((eb >> 1) & 1) - ((ea >> 1) & 1));
        pz += ((ea >> 2) & 1) + t * (((eb >> 2) & 1) - ((ea >> 2) & 1));
        n++;
      }
      _pos[nv * 3] = (i + px / n - CX) * H;
      _pos[nv * 3 + 1] = (j + py / n - CY) * H;
      _pos[nv * 3 + 2] = (k + pz / n - CZ) * H;
      _vidx[id] = nv++;
    }
    // 四邊形：每條穿過表面的格線邊對應一片
    for (let k = 1; k < NZ - 1; k++) for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) {
      const id = i + SY * j + SZ * k;
      const s0 = d[id] > 0.5;
      if (nq > MAXQ - 3) break;
      if (s0 !== (d[id + SX] > 0.5)) {
        const A = _vidx[id], B = _vidx[id - SY], C = _vidx[id - SY - SZ], D = _vidx[id - SZ];
        if (A >= 0 && B >= 0 && C >= 0 && D >= 0) {
          const o = nq * 4; nq++;
          if (s0) { _quad[o] = A; _quad[o + 1] = B; _quad[o + 2] = C; _quad[o + 3] = D; }
          else { _quad[o] = D; _quad[o + 1] = C; _quad[o + 2] = B; _quad[o + 3] = A; }
        }
      }
      if (s0 !== (d[id + SY] > 0.5)) {
        const A = _vidx[id], B = _vidx[id - SZ], C = _vidx[id - SZ - SX], D = _vidx[id - SX];
        if (A >= 0 && B >= 0 && C >= 0 && D >= 0) {
          const o = nq * 4; nq++;
          if (s0) { _quad[o] = A; _quad[o + 1] = B; _quad[o + 2] = C; _quad[o + 3] = D; }
          else { _quad[o] = D; _quad[o + 1] = C; _quad[o + 2] = B; _quad[o + 3] = A; }
        }
      }
      if (s0 !== (d[id + SZ] > 0.5)) {
        const A = _vidx[id], B = _vidx[id - SX], C = _vidx[id - SX - SY], D = _vidx[id - SY];
        if (A >= 0 && B >= 0 && C >= 0 && D >= 0) {
          const o = nq * 4; nq++;
          if (s0) { _quad[o] = A; _quad[o + 1] = B; _quad[o + 2] = C; _quad[o + 3] = D; }
          else { _quad[o] = D; _quad[o + 1] = C; _quad[o + 2] = B; _quad[o + 3] = A; }
        }
      }
    }
    const positions = _pos.slice(0, nv * 3);
    const quads = _quad.slice(0, nq * 4);
    const normals = new Float32Array(nv * 3);
    const indices = new Uint32Array(nq * 6);
    for (let q = 0; q < nq; q++) {
      const a = quads[q * 4], b = quads[q * 4 + 1], c = quads[q * 4 + 2], e = quads[q * 4 + 3];
      const ux = positions[c * 3] - positions[a * 3], uy = positions[c * 3 + 1] - positions[a * 3 + 1], uz = positions[c * 3 + 2] - positions[a * 3 + 2];
      const vx = positions[e * 3] - positions[b * 3], vy = positions[e * 3 + 1] - positions[b * 3 + 1], vz = positions[e * 3 + 2] - positions[b * 3 + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const v of [a, b, c, e]) { normals[v * 3] += nx; normals[v * 3 + 1] += ny; normals[v * 3 + 2] += nz; }
      const o = q * 6;
      indices[o] = a; indices[o + 1] = b; indices[o + 2] = c; indices[o + 3] = a; indices[o + 4] = c; indices[o + 5] = e;
    }
    for (let v = 0; v < nv; v++) {
      const l = Math.hypot(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]) || 1;
      normals[v * 3] /= l; normals[v * 3 + 1] /= l; normals[v * 3 + 2] /= l;
    }
    return { positions, normals, indices, quads, nv, nq };
  }

  // ---------- 雕刻 ----------
  // 射線打到表面的距離 t（公尺），沒打到回傳 -1。o、dir 為本地座標，dir 為單位向量。
  raycast(o, dir) {
    const hx = NX * H / 2, hy = NY * H / 2, hz = NZ * H / 2;
    let t0 = 0, t1 = 1e9;
    const bo = [o[0], o[1], o[2]], bd = [dir[0], dir[1], dir[2]], bh = [hx, hy, hz];
    for (let a = 0; a < 3; a++) {
      if (Math.abs(bd[a]) < 1e-9) { if (Math.abs(bo[a]) > bh[a]) return -1; continue; }
      let ta = (-bh[a] - bo[a]) / bd[a], tb = (bh[a] - bo[a]) / bd[a];
      if (ta > tb) { const s = ta; ta = tb; tb = s; }
      if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
    }
    if (t0 > t1) return -1;
    const step = H * 0.5;
    let prev = 0, tp = t0;
    for (let t = t0; t <= t1; t += step) {
      const v = this.sample(o[0] + dir[0] * t, o[1] + dir[1] * t, o[2] + dir[2] * t);
      if (v > 0.5) {
        if (t === t0) return t;
        return tp + (t - tp) * (0.5 - prev) / (v - prev);
      }
      prev = v; tp = t;
    }
    return -1;
  }
  sample(x, y, z) {
    const gx = x / H + CX, gy = y / H + CY, gz = z / H + CZ;
    const i = Math.floor(gx), j = Math.floor(gy), k = Math.floor(gz);
    if (i < 0 || j < 0 || k < 0 || i >= NX - 1 || j >= NY - 1 || k >= NZ - 1) return 0;
    const fx = gx - i, fy = gy - j, fz = gz - k, d = this.d, id = i + SY * j + SZ * k;
    const c00 = d[id] + fx * (d[id + SX] - d[id]), c10 = d[id + SY] + fx * (d[id + SY + SX] - d[id + SY]);
    const c01 = d[id + SZ] + fx * (d[id + SZ + SX] - d[id + SZ]), c11 = d[id + SZ + SY] + fx * (d[id + SZ + SY + SX] - d[id + SZ + SY]);
    const c0 = c00 + fy * (c10 - c00), c1 = c01 + fy * (c11 - c01);
    return c0 + fz * (c1 - c0);
  }

  // 「切」：沿視線方向整個切穿的圓柱（半徑 r）
  cutCylinder(o, dir, r) {
    const d = this.d, rc = r / H, ext = Math.ceil(rc + 1.5);
    const ox = o[0] / H + CX, oy = o[1] / H + CY, oz = o[2] / H + CZ;
    // 找出跟格子相交的 t 範圍（格子座標）
    let t0 = -1e9, t1 = 1e9;
    const O = [ox, oy, oz], Dm = [NX - 1, NY - 1, NZ - 1];
    for (let a = 0; a < 3; a++) {
      if (Math.abs(dir[a]) < 1e-9) { if (O[a] < -ext || O[a] > Dm[a] + ext) return 0; continue; }
      let ta = (-ext - O[a]) / dir[a], tb = (Dm[a] + ext - O[a]) / dir[a];
      if (ta > tb) { const s = ta; ta = tb; tb = s; }
      if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
    }
    if (t0 > t1) return 0;
    let removed = 0;
    for (let t = t0; t <= t1; t += 1) {
      const cx = ox + dir[0] * t, cy = oy + dir[1] * t, cz = oz + dir[2] * t;
      const i0 = Math.max(1, Math.floor(cx - ext)), i1 = Math.min(NX - 2, Math.ceil(cx + ext));
      const j0 = Math.max(1, Math.floor(cy - ext)), j1 = Math.min(NY - 2, Math.ceil(cy + ext));
      const k0 = Math.max(1, Math.floor(cz - ext)), k1 = Math.min(NZ - 2, Math.ceil(cz + ext));
      for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const id = i + SY * j + SZ * k, v = d[id];
        if (v <= 0) continue;
        const wx = i - ox, wy = j - oy, wz = k - oz, al = wx * dir[0] + wy * dir[1] + wz * dir[2];
        const dist = Math.sqrt(Math.max(0, wx * wx + wy * wy + wz * wz - al * al));
        const nv = clamp01(0.5 + (dist - rc));
        if (nv < v) { removed += v - nv; d[id] = nv; }
      }
    }
    return removed;
  }

  // 平面磨具最先碰到的高度：圓柱（軸過 c、方向 nt、半徑 R）內實心格子的 p·nt 最大值
  maxAlong(c, nt, R) {
    const d = this.d, R2 = (R / H) * (R / H);
    const cx = c[0] / H + CX, cy = c[1] / H + CY, cz = c[2] / H + CZ;
    let best = -1e9;
    for (let k = 1; k < NZ - 1; k++) for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) {
      if (d[i + SY * j + SZ * k] <= 0.5) continue;
      const wx = i - cx, wy = j - cy, wz = k - cz, al = wx * nt[0] + wy * nt[1] + wz * nt[2];
      if (wx * wx + wy * wy + wz * wz - al * al > R2) continue;
      const s = ((i - CX) * nt[0] + (j - CY) * nt[1] + (k - CZ) * nt[2]) * H;
      if (s > best) best = s;
    }
    return best;
  }

  // 「磨」：平面磨具。軸過 c、法線 nt（朝向磨具那一側）、半徑 R；把 p·nt > s 的材料磨掉。
  grindPlane(c, nt, s, R) {
    const d = this.d, Rc = R / H, sc = s / H;
    const cx = c[0] / H + CX, cy = c[1] / H + CY, cz = c[2] / H + CZ;
    const ext = Math.ceil(Rc + 1.5);
    // 圓柱從平面往外延伸到格子外；包圍盒用軸上兩端點估
    const al0 = sc - ((cx - CX) * nt[0] + (cy - CY) * nt[1] + (cz - CZ) * nt[2]);   // 軸上平面位置（相對 c）
    const L = NX + NY;
    const ax = cx + nt[0] * (al0 - 1), ay = cy + nt[1] * (al0 - 1), az = cz + nt[2] * (al0 - 1);
    const bx = cx + nt[0] * (al0 + L), by = cy + nt[1] * (al0 + L), bz = cz + nt[2] * (al0 + L);
    const i0 = Math.max(1, Math.floor(Math.min(ax, bx) - ext)), i1 = Math.min(NX - 2, Math.ceil(Math.max(ax, bx) + ext));
    const j0 = Math.max(1, Math.floor(Math.min(ay, by) - ext)), j1 = Math.min(NY - 2, Math.ceil(Math.max(ay, by) + ext));
    const k0 = Math.max(1, Math.floor(Math.min(az, bz) - ext)), k1 = Math.min(NZ - 2, Math.ceil(Math.max(az, bz) + ext));
    let removed = 0;
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const id = i + SY * j + SZ * k, v = d[id];
      if (v <= 0) continue;
      const h = (i - CX) * nt[0] + (j - CY) * nt[1] + (k - CZ) * nt[2] - sc;   // 高出平面多少格
      if (h < -0.5) continue;
      const wx = i - cx, wy = j - cy, wz = k - cz, al = wx * nt[0] + wy * nt[1] + wz * nt[2];
      const dist = Math.sqrt(Math.max(0, wx * wx + wy * wy + wz * wz - al * al));
      if (dist > Rc + 0.5) continue;
      const nv = Math.max(clamp01(0.5 - h), clamp01(0.5 + (dist - Rc)));
      if (nv < v) { removed += v - nv; d[id] = nv; }
    }
    return removed;
  }

  // 「拋」：局部磨圓（只會去掉凸起，不會補洞）
  smoothAt(c, R, strength = 0.6) {
    const d = this.d, Rc = R / H;
    const cx = c[0] / H + CX, cy = c[1] / H + CY, cz = c[2] / H + CZ;
    const i0 = Math.max(1, Math.floor(cx - Rc)), i1 = Math.min(NX - 2, Math.ceil(cx + Rc));
    const j0 = Math.max(1, Math.floor(cy - Rc)), j1 = Math.min(NY - 2, Math.ceil(cy + Rc));
    const k0 = Math.max(1, Math.floor(cz - Rc)), k1 = Math.min(NZ - 2, Math.ceil(cz + Rc));
    const upd = [];
    let removed = 0;
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const id = i + SY * j + SZ * k, v = d[id];
      if (v <= 0) continue;
      const wx = i - cx, wy = j - cy, wz = k - cz, r2 = (wx * wx + wy * wy + wz * wz) / (Rc * Rc);
      if (r2 >= 1) continue;
      const avg = (v * 2 + d[id - SX] + d[id + SX] + d[id - SY] + d[id + SY] + d[id - SZ] + d[id + SZ]) / 8;
      if (avg < v) { const nv = v + (avg - v) * strength * (1 - r2); upd.push(id, nv); removed += v - nv; }
    }
    for (let u = 0; u < upd.length; u += 2) d[upd[u]] = upd[u + 1];
    return removed;
  }

  // 翻面：繞 X 軸轉 180°（上下對調）
  flip() {
    const d = this.d, t = _tmp; t.set(d);
    for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) d[i + SY * j + SZ * k] = t[i + SY * (NY - 1 - j) + SZ * (NZ - 1 - k)];
  }

  // 只留最大的一塊（切下來的碎片掉了）。回傳留下的實心格數。
  // preferAxis＝true 時（轉盤）：優先留下轉軸穿過的那一塊，外圈切下來的環會掉
  keepLargest(preferAxis = false) {
    const d = this.d, lab = new Int32Array(NCELL), stack = new Int32Array(NCELL), sizes = [0];
    let best = 0, bestN = 0, cur = 0;
    for (let s = 0; s < NCELL; s++) {
      if (d[s] <= 0.5 || lab[s]) continue;
      cur++; let n = 0, sp = 0; stack[sp++] = s; lab[s] = cur;
      while (sp) {
        const id = stack[--sp]; n++;
        const i = id % NX, j = ((id / NX) | 0) % NY, k = (id / SZ) | 0;
        if (i > 0 && d[id - SX] > 0.5 && !lab[id - SX]) { lab[id - SX] = cur; stack[sp++] = id - SX; }
        if (i < NX - 1 && d[id + SX] > 0.5 && !lab[id + SX]) { lab[id + SX] = cur; stack[sp++] = id + SX; }
        if (j > 0 && d[id - SY] > 0.5 && !lab[id - SY]) { lab[id - SY] = cur; stack[sp++] = id - SY; }
        if (j < NY - 1 && d[id + SY] > 0.5 && !lab[id + SY]) { lab[id + SY] = cur; stack[sp++] = id + SY; }
        if (k > 0 && d[id - SZ] > 0.5 && !lab[id - SZ]) { lab[id - SZ] = cur; stack[sp++] = id - SZ; }
        if (k < NZ - 1 && d[id + SZ] > 0.5 && !lab[id + SZ]) { lab[id + SZ] = cur; stack[sp++] = id + SZ; }
      }
      sizes.push(n);
      if (n > bestN) { bestN = n; best = cur; }
    }
    if (preferAxis && cur > 1) {
      const i0 = NX >> 1, j0 = NY >> 1;
      let ax = 0;
      for (let k = 0; k < NZ && !ax; k++) for (let dj = -1; dj <= 0 && !ax; dj++) for (let di = -1; di <= 0; di++) { const l = lab[(i0 + di) + SY * (j0 + dj) + SZ * k]; if (l) { ax = l; break; } }
      if (ax && sizes[ax] >= 40) { best = ax; bestN = sizes[ax]; }
    }
    for (let id = 0; id < NCELL; id++) {
      const v = d[id];
      if (v <= 0) continue;
      if (v > 0.5) { if (lab[id] !== best) d[id] = 0; continue; }
      // 半透明邊界格：旁邊要有留下來的實心格才保留
      const i = id % NX, j = ((id / NX) | 0) % NY, k = (id / SZ) | 0;
      let keep = false;
      for (let dk = -1; dk <= 1 && !keep; dk++) for (let dj = -1; dj <= 1 && !keep; dj++) for (let di = -1; di <= 1; di++) {
        const ii = i + di, jj = j + dj, kk = k + dk;
        if (ii < 0 || jj < 0 || kk < 0 || ii >= NX || jj >= NY || kk >= NZ) continue;
        if (lab[ii + SY * jj + SZ * kk] === best && best) { keep = true; break; }
      }
      if (!keep) d[id] = 0;
    }
    return bestN;
  }

  // ---------- 存檔 ----------
  // 量化成 8 bit＋RLE＋base64
  encode() {
    const d = this.d, out = [];
    let i = 0;
    while (i < NCELL) {
      const v = Math.round(d[i] * 255);
      let n = 1;
      while (i + n < NCELL && n < 255 && Math.round(d[i + n] * 255) === v) n++;
      out.push(n, v); i += n;
    }
    let s = '';
    for (let p = 0; p < out.length; p += 8192) s += String.fromCharCode.apply(null, out.slice(p, p + 8192));
    return btoa(s);
  }
  static decode(str, rock = 'granite') {
    const s = new Stone(ROCKS[rock] ? rock : 'granite');
    const bin = atob(str), d = s.d;
    let i = 0;
    for (let p = 0; p + 1 < bin.length && i < NCELL; p += 2) {
      const n = bin.charCodeAt(p), v = bin.charCodeAt(p + 1) / 255;
      for (let q = 0; q < n && i < NCELL; q++) d[i++] = v;
    }
    if (i !== NCELL) throw new Error('stone data length mismatch');
    s._clearBorder();
    return s;
  }
  // 復原用的輕量快照
  snapshot() { const u = new Uint8Array(NCELL), d = this.d; for (let i = 0; i < NCELL; i++) u[i] = Math.round(d[i] * 255); return u; }
  restore(u) { const d = this.d; for (let i = 0; i < NCELL; i++) d[i] = u[i] / 255; }
}

// 3×3 對稱矩陣最大特徵值的特徵向量（冪迭代）
export function principalMaxAxis(I) {
  let v = [0.3, 0.2, 1];
  for (let it = 0; it < 60; it++) {
    const x = I[0] * v[0] + I[1] * v[1] + I[2] * v[2], y = I[3] * v[0] + I[4] * v[1] + I[5] * v[2], z = I[6] * v[0] + I[7] * v[1] + I[8] * v[2];
    const l = Math.hypot(x, y, z) || 1;
    v = [x / l, y / l, z / l];
  }
  return v;
}
