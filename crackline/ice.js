// 裂冰湖 Crackline — 冰面邏輯（瀏覽器與 node 共用，不碰畫面）
// 冰面＝Voronoi 小格（冰的紋理），裂痕沿著格子的邊走；被裂痕圍起來、面積夠小的冰塊會碎掉沉下去。
import { Delaunay } from 'd3-delaunay';

export const BOUNDS = [-4.4, -6.8, 4.4, 6.8]; // x0 z0 x1 z1
export const MAXLEN = 7.0;                    // 力道 1 時，裂痕兩頭加起來最長
const SOLID = { ice: 1, thick: 1 };

export class Rng {
  constructor(s) { this.s = (s >>> 0) || 1; }
  next() {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

// ---- 形狀：圓 [x,z,r]、方 {r:[x0,z0,x1,z1]}；回傳有號距離（負＝在裡面） ----
function sdPrim(p, x, z) {
  if (Array.isArray(p)) return Math.hypot(x - p[0], z - p[1]) - p[2];
  if (p.r) {
    const [x0, z0, x1, z1] = p.r;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
    const dx = Math.abs(x - cx) - hx, dz = Math.abs(z - cz) - hz;
    return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0);
  }
  if (p.seg) { // 粗線段 {seg:[x0,z0,x1,z1], w}
    const [ax, az, bx, bz] = p.seg;
    const vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    return Math.hypot(x - ax - vx * t, z - az - vz * t) - p.w / 2;
  }
  return 1e9;
}
const sdList = (list, x, z) => (list || []).reduce((m, p) => Math.min(m, sdPrim(p, x, z)), 1e9);
function noise2(x, z, seed) {
  // 便宜的值雜訊（湖岸自然一點）
  const s = Math.sin(x * 1.7 + seed) * Math.cos(z * 1.3 - seed * 0.7) + 0.5 * Math.sin(x * 3.9 - z * 2.7 + seed * 1.3);
  return s / 1.5;
}

export function buildIce(level) {
  const rng = new Rng(level.seed || 7);
  const sp = level.spacing || 0.3;
  const [X0, Z0, X1, Z1] = BOUNDS;
  const pts = [];
  for (let z = Z0 + sp / 2; z < Z1; z += sp * 0.88) {
    for (let x = X0 + sp / 2; x < X1; x += sp) {
      pts.push(x + (rng.next() - 0.5) * sp * 0.85, z + (rng.next() - 0.5) * sp * 0.8);
    }
  }
  const n = pts.length / 2;
  const del = new Delaunay(Float64Array.from(pts));
  const vor = del.voronoi(BOUNDS);
  const verts = [], vkey = new Map();
  const vid = (x, z) => {
    const k = Math.round(x * 1e4) + ',' + Math.round(z * 1e4);
    let i = vkey.get(k);
    if (i === undefined) { i = verts.length; verts.push([x, z]); vkey.set(k, i); }
    return i;
  };
  const cells = [], edges = [], ekey = new Map();
  for (let i = 0; i < n; i++) {
    const poly = vor.cellPolygon(i);
    const ring = [];
    for (let k = 0; k < poly.length - 1; k++) {
      const v = vid(poly[k][0], poly[k][1]);
      if (ring[ring.length - 1] !== v) ring.push(v);
    }
    if (ring.length > 1 && ring[0] === ring[ring.length - 1]) ring.pop();
    const x = pts[2 * i], z = pts[2 * i + 1];
    let area = 0;
    for (let k = 0; k < ring.length; k++) {
      const a = verts[ring[k]], b = verts[ring[(k + 1) % ring.length]];
      area += a[0] * b[1] - b[0] * a[1];
    }
    const cell = { i, x, z, ring, area: Math.abs(area) / 2, edges: [], type: 'snow', snowAdj: false };
    // 類型
    const nz = noise2(x, z, level.seed || 7) * (level.rough ?? 0.18);
    const lake0 = sdList(level.lake, x, z);
    const lake = Math.max(lake0, -sdList(level.rocks, x, z));
    if (lake0 + nz < 0 && lake + nz >= 0) cell.rock = true;
    if (lake + nz < 0) {
      cell.type = 'ice';
      if (sdList(level.thick, x, z) < 0) cell.type = 'thick';
      if (sdList(level.water, x, z) < 0) cell.type = 'water';
    }
    cells.push(cell);
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k], b = ring[(k + 1) % ring.length];
      const key = a < b ? a + '_' + b : b + '_' + a;
      let e = ekey.get(key);
      if (e === undefined) { e = edges.length; edges.push({ a, b, cells: [i], cracked: false, len: Math.hypot(verts[a][0] - verts[b][0], verts[a][1] - verts[b][1]) }); ekey.set(key, e); }
      else edges[e].cells.push(i);
      cell.edges.push(e);
    }
  }
  const vEdges = verts.map(() => []);
  edges.forEach((e, k) => { vEdges[e.a].push(k); vEdges[e.b].push(k); });
  const ice = { level, del, verts, cells, edges, vEdges, sinkArea: level.sinkArea || 3.5 };
  refreshSnowAdj(ice);
  for (const c of level.cracks || []) {
    const plan = planCrack(ice, c[0], c[1], c[2], c[3], c[4]);
    if (plan) for (const e of plan.edges) { ice.edges[e].cracked = true; ice.edges[e].old = true; }
  }
  return ice;
}

function refreshSnowAdj(ice) {
  for (const c of ice.cells) {
    c.snowAdj = c.edges.some((e) => ice.edges[e].cells.some((o) => ice.cells[o].type === 'snow'));
  }
}

export function cellAt(ice, x, z) { return ice.del.find(x, z); }

function crackable(ice, e) {
  const E = ice.edges[e];
  if (E.cracked || E.cells.length < 2) return false;
  const t0 = ice.cells[E.cells[0]].type, t1 = ice.cells[E.cells[1]].type;
  if (!SOLID[t0] || !SOLID[t1]) return false;
  return !(t0 === 'thick' && t1 === 'thick');
}

// 走到這個頂點要不要停：碰到舊裂痕＝接上；碰到岸、岩石、水＝到底
function vertexStop(ice, v, from) {
  for (const e of ice.vEdges[v]) {
    if (e === from) continue;
    const E = ice.edges[e];
    if (E.cracked) return 'join';
    if (E.cells.length < 2) return 'shore';
    for (const c of E.cells) {
      const t = ice.cells[c].type;
      if (t === 'snow') return 'shore';
      if (t === 'water' || t === 'gone') return 'water';
    }
  }
  return null;
}

function distSeg(px, pz, a, b) {
  const vx = b[0] - a[0], vz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * vx + (pz - a[1]) * vz) / (vx * vx + vz * vz || 1)));
  return Math.hypot(px - a[0] - vx * t, pz - a[1] - vz * t);
}

// 規劃一次敲擊：從 (px,pz) 附近的冰縫開始，沿 (dx,dz) 兩頭延伸；power 0..1。確定性（預覽＝實際）
export function planCrack(ice, px, pz, dx, dz, power) {
  const L = Math.hypot(dx, dz);
  if (!(L > 1e-6) || !(power > 0)) return null;
  dx /= L; dz /= L;
  let best = -1, bd = 0.45;
  const c0 = cellAt(ice, px, pz);
  const near = new Set([c0]);
  for (const e of ice.cells[c0].edges) for (const o of ice.edges[e].cells) near.add(o);
  for (const c of near) for (const e of ice.cells[c].edges) {
    if (!crackable(ice, e)) continue;
    const E = ice.edges[e];
    const d = distSeg(px, pz, ice.verts[E.a], ice.verts[E.b]);
    // 偏好跟方向垂直的那條縫以外的縫：沿著方向的縫比較像「從這裡裂開」
    const ux = ice.verts[E.b][0] - ice.verts[E.a][0], uz = ice.verts[E.b][1] - ice.verts[E.a][1];
    const al = Math.abs(ux * dx + uz * dz) / (E.len || 1);
    const sc = d - al * 0.08;
    if (sc < bd) { bd = sc; best = e; }
  }
  if (best < 0) return null;
  const E = ice.edges[best];
  const A = ice.verts[E.a], B = ice.verts[E.b];
  const pa = (A[0] - px) * dx + (A[1] - pz) * dz, pb = (B[0] - px) * dx + (B[1] - pz) * dz;
  const fwd = pa >= pb ? E.a : E.b, back = pa >= pb ? E.b : E.a;
  const budget = Math.max(0.2, power) * MAXLEN / 2;
  const inPath = new Set([best]);
  const walk = (v, s) => {
    const out = [];
    let cur = v, prev = best, used = E.len / 2, stop = null;
    const hx = dx * s, hz = dz * s;
    for (let g = 0; g < 400; g++) {
      stop = vertexStop(ice, cur, prev);
      if (stop) break;
      if (used >= budget) { stop = 'tired'; break; }
      let be = -1, bs = Infinity;
      for (const e of ice.vEdges[cur]) {
        if (e === prev || inPath.has(e) || !crackable(ice, e)) continue;
        const F = ice.edges[e];
        const o = F.a === cur ? F.b : F.a;
        const ux = (ice.verts[o][0] - ice.verts[cur][0]) / F.len, uz = (ice.verts[o][1] - ice.verts[cur][1]) / F.len;
        const dot = ux * hx + uz * hz;
        if (dot < 0.2) continue;
        const lat = Math.abs((ice.verts[o][0] - px) * -dz + (ice.verts[o][1] - pz) * dx);
        const sc = -dot + 0.9 * lat;
        if (sc < bs) { bs = sc; be = e; }
      }
      if (be < 0) { stop = 'blocked'; break; }
      inPath.add(be);
      out.push(be);
      used += ice.edges[be].len;
      prev = be;
      cur = ice.edges[be].a === cur ? ice.edges[be].b : ice.edges[be].a;
    }
    return { edges: out, stop, end: cur };
  };
  const f = walk(fwd, 1), b = walk(back, -1);
  // 動畫順序：從起點往兩頭，記錄每段離起點的距離
  const order = [{ e: best, d0: 0, from: back, to: fwd }];
  let d = E.len / 2, cur = fwd;
  for (const e of f.edges) { const F = ice.edges[e]; const to = F.a === cur ? F.b : F.a; order.push({ e, d0: d, from: cur, to }); d += F.len; cur = to; }
  d = E.len / 2; cur = back;
  for (const e of b.edges) { const F = ice.edges[e]; const to = F.a === cur ? F.b : F.a; order.push({ e, d0: d, from: cur, to }); d += F.len; cur = to; }
  return {
    start: best, px, pz, dx, dz, power,
    edges: [best, ...f.edges, ...b.edges], order,
    stops: [f.stop, b.stop], ends: [f.end, b.end],
    length: order.reduce((s, o) => s + ice.edges[o.e].len, 0),
  };
}

// 冰塊分組（extra＝假裝也裂了的邊，給預覽用）
export function pieces(ice, extra) {
  const cells = ice.cells;
  const parent = cells.map((c, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  ice.edges.forEach((E, k) => {
    if (E.cells.length < 2 || E.cracked || (extra && extra.has(k))) return;
    const [a, b] = E.cells;
    if (SOLID[cells[a].type] && SOLID[cells[b].type]) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
  });
  const groups = new Map();
  cells.forEach((c, i) => {
    if (!SOLID[c.type]) return;
    const r = find(i);
    let g = groups.get(r);
    if (!g) { g = { cells: [], area: 0 }; groups.set(r, g); }
    g.cells.push(i); g.area += c.area;
  });
  return [...groups.values()];
}

export function sinkingPieces(ice, extra) {
  return pieces(ice, extra).filter((g) => g.area < ice.sinkArea);
}

// 真的敲下去：標記裂痕，太小的冰塊變成 'gone'；回傳沉下去的冰塊
export function applyCrack(ice, plan) {
  for (const e of plan.edges) ice.edges[e].cracked = true;
  const sunk = sinkingPieces(ice);
  for (const g of sunk) for (const c of g.cells) ice.cells[c].type = 'gone';
  return sunk;
}

// ---- 一局遊戲（規則＋勝負），畫面只負責演出 ----
export class Game {
  constructor(level) {
    this.level = level;
    this.ice = buildIce(level);
    this.strikesLeft = level.strikes;
    this.used = 0;
    this.fish = (level.fish || []).map(([x, z, kind, rot]) => ({ x, z, kind, rot: rot || 0, cell: cellAt(this.ice, x, z), freed: false }));
    this.penguins = (level.penguins || []).map(([x, z, rot]) => ({ x, z, rot: rot || 0, cell: cellAt(this.ice, x, z), lost: false }));
    this.result = 'play';
  }
  plan(px, pz, dx, dz, power) { return this.result === 'play' && this.strikesLeft > 0 ? planCrack(this.ice, px, pz, dx, dz, power) : null; }
  preview(plan) {
    if (!plan) return null;
    const extra = new Set(plan.edges);
    const sink = sinkingPieces(this.ice, extra);
    const set = new Set(); for (const g of sink) for (const c of g.cells) set.add(c);
    return { cells: set, fish: this.fish.filter((f) => !f.freed && set.has(f.cell)), penguins: this.penguins.filter((p) => !p.lost && set.has(p.cell)) };
  }
  strike(plan) {
    if (!plan || this.result !== 'play' || this.strikesLeft <= 0) return null;
    this.strikesLeft--; this.used++;
    const sunk = applyCrack(this.ice, plan);
    const gone = new Set(); for (const g of sunk) for (const c of g.cells) gone.add(c);
    const freed = [], lost = [];
    for (const f of this.fish) if (!f.freed && gone.has(f.cell)) { f.freed = true; freed.push(f); }
    for (const p of this.penguins) if (!p.lost && gone.has(p.cell)) { p.lost = true; lost.push(p); }
    if (this.penguins.some((p) => p.lost)) this.result = 'lose';
    else if (this.fish.every((f) => f.freed)) this.result = 'win';
    else if (this.strikesLeft <= 0) this.result = 'lose';
    return { sunk, freed, lost, result: this.result };
  }
  stars() {
    const par = this.level.par || this.level.strikes;
    return this.used <= par ? 3 : this.used <= par + 1 ? 2 : 1;
  }
}
