// 城市外觀美術檢查：①每個物件 × 4 個旋轉，零件兩兩不重疊 ②物件圖鑑、地面格子、示範街景 PNG
require('../js/raster.js'); require('../js/models.js'); require('../js/art/city.js');
const { Pix, Iso, depthSort, toPNG, OUT } = PX, M = MODELS, A = ART.city;
const fs = require('fs'), path = require('path');
const outDir = path.join(__dirname, 'out'); fs.mkdirSync(outDir, { recursive: true });
Object.assign(M.ITEMS, A.OBJS);   // 只在測試裡暫時註冊

// ---------- ① 重疊檢查 ----------
let bad = 0, checked = 0;
const overlaps = (a, b, e = 1e-6) => a.i0 < b.i1 - e && b.i0 < a.i1 - e && a.j0 < b.j1 - e && b.j0 < a.j1 - e && a.z0 < b.z1 - e && b.z0 < a.z1 - e;
for (const id in A.OBJS) {
  const d = A.OBJS[id];
  for (let r = 0; r < 4; r++) for (const on of [false, true]) {
    const parts = M.itemParts({ t: id, i: 0, j: 0, r, on });
    const [wi, wj] = M.footprint(d, r);
    for (let x = 0; x < parts.length; x++) {
      const q = parts[x];
      if (q.i0 < -1e-6 || q.j0 < -1e-6 || q.i1 > wi + 1e-6 || q.j1 > wj + 1e-6) { bad++; console.log('OUT OF FOOTPRINT', id, 'r' + r, x); }
      for (let y = x + 1; y < parts.length; y++) {
        checked++;
        if (overlaps(q, parts[y])) { bad++; console.log('OVERLAP', id, 'r' + r, x, y, JSON.stringify([q, parts[y]].map(p => [p.i0, p.i1, p.j0, p.j1, p.z0, p.z1].map(v => +v.toFixed(3))))); }
      }
    }
  }
  if (!d.name) { bad++; console.log('NO NAME', id); }
}
console.log(bad ? `問題 ${bad} 處` : `零件重疊檢查：全部通過（${Object.keys(A.OBJS).length} 件 × 4 方向，${checked} 組比對，重疊 0）`);

// ①-b 層級循環檢查：PX.depthSort 遇到「A 在 B 後、B 在 C 後、C 又在 A 後」的循環時只能亂猜順序（會透視）。
// 每個物件 × 4 方向，用 Tarjan 找強連通分量；只要有一個分量 > 1 個零件就算失敗。
function cyclesOf(parts) {
  const n = parts.length, adj = parts.map(() => []);
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const ab = PX.behind(parts[a], parts[b]), ba = PX.behind(parts[b], parts[a]);
    if (ab && !ba) adj[a].push(b); else if (ba && !ab) adj[b].push(a);
  }
  let idx = 0; const st = [], on = new Array(n).fill(false), num = new Array(n).fill(-1), low = new Array(n).fill(0), comps = [];
  function sc(v) {
    num[v] = low[v] = idx++; st.push(v); on[v] = true;
    for (const w of adj[v]) { if (num[w] < 0) { sc(w); low[v] = Math.min(low[v], low[w]); } else if (on[w]) low[v] = Math.min(low[v], num[w]); }
    if (low[v] === num[v]) { const c = []; let w; do { w = st.pop(); on[w] = false; c.push(w); } while (w !== v); if (c.length > 1) comps.push(c); }
  }
  for (let v = 0; v < n; v++) if (num[v] < 0) sc(v);
  return comps;
}
let cyc = 0;
for (const id in A.OBJS) for (let r = 0; r < 4; r++) for (const on of [false, true]) {
  const comps = cyclesOf(M.itemParts({ t: id, i: 0, j: 0, r, on }));
  if (comps.length) { cyc += comps.length; bad += comps.length; console.log('CYCLE', id, 'r' + r, comps.map(c => '[' + c.sort((x, y) => x - y).join(',') + ']').join(' ')); }
}
console.log(cyc ? `層級循環 ${cyc} 組` : '層級循環檢查：全部通過（每個物件 4 方向都排得出唯一正確的前後順序）');

// ---------- ② 圖鑑 ----------
const BG = [250, 236, 214];
function catalog(ids, file, scale) {
  const rows = ids.map(id => {
    const d = A.OBJS[id]; let zmax = 0;
    for (const q of M.itemParts({ t: id, i: 0, j: 0, r: 0, on: true })) zmax = Math.max(zmax, q.z1);
    const span = (d.W + d.D) * 32;
    return { id, d, zmax, cw: span + 50, rh: (d.W + d.D) * 16 + zmax + 40 };
  });
  const W = Math.max(...rows.map(r => r.cw * 4)), H = rows.reduce((s, r) => s + r.rh, 0);
  const pix = new Pix(W, H); pix.rect(0, 0, W - 1, H - 1, BG);
  let y = 0;
  for (const row of rows) {
    for (let r = 0; r < 4; r++) {
      const [wi, wj] = M.footprint(row.d, r);
      const iso = new Iso(pix, r * row.cw + 25 + wj * 32, y + row.zmax + 22);
      iso.flat(0, 0, wi, wj, [232, 196, 138], 0, [214, 174, 116]);
      // 門口那一格標成黃色
      if (row.d.door) {
        const [fi, fj] = M.ROT[r], si = fj, sj = -fi;
        const ci = Math.floor(wi / 2 + fi * row.d.door.f + si * row.d.door.s), cj = Math.floor(wj / 2 + fj * row.d.door.f + sj * row.d.door.s);
        iso.flat(ci, cj, 1, 1, [255, 230, 120], 0, [210, 170, 70]);
      }
      for (const q of depthSort(M.itemParts({ t: row.id, i: 0, j: 0, r, on: r % 2 === 1 }))) q.draw(iso);
    }
    pix.rect(0, y + row.rh - 1, W - 1, y + row.rh - 1, [226, 206, 178]);
    y += row.rh;
  }
  fs.writeFileSync(path.join(outDir, file), toPNG(pix, scale));
  console.log(file, ids.length, '件', W * scale + 'x' + H * scale);
}
const buildings = ['cafe_building', 'bakery_building', 'market_building', 'apartment_building', 'house_player'];
catalog(buildings.slice(0, 3), 'art_city_buildings1.png', 1);
catalog(buildings.slice(3), 'art_city_buildings2.png', 1);
// 放大圖：每棟建築正面兩個方向（r=0、r=1）×2
for (const id of buildings) catalogZoom(id);
function catalogZoom(id) {
  const d = A.OBJS[id]; let zmax = 0;
  for (const q of M.itemParts({ t: id, i: 0, j: 0, r: 0 })) zmax = Math.max(zmax, q.z1);
  const cw = (d.W + d.D) * 32 + 40, rh = (d.W + d.D) * 16 + zmax + 30;
  const pix = new Pix(cw * 2, rh); pix.rect(0, 0, pix.w - 1, pix.h - 1, BG);
  for (let r = 0; r < 2; r++) {
    const [wi, wj] = M.footprint(d, r), iso = new Iso(pix, r * cw + 20 + wj * 32, zmax + 15);
    iso.flat(0, 0, wi, wj, [232, 196, 138], 0, [214, 174, 116]);
    for (const q of depthSort(M.itemParts({ t: id, i: 0, j: 0, r }))) q.draw(iso);
  }
  fs.writeFileSync(path.join(outDir, 'art_city_zoom_' + id + '.png'), toPNG(pix, 2));
}
const props = Object.keys(A.OBJS).filter(k => !buildings.includes(k));
catalog(props.slice(0, 7), 'art_city_props1.png', 2);
catalog(props.slice(7), 'art_city_props2.png', 2);

// ---------- 地面格子：每種 3×3 一塊 ----------
{
  const names = Object.keys(A.TILES), cols = 4, cw = 230, rh = 130;
  const pix = new Pix(cw * cols, rh * Math.ceil(names.length / cols)); pix.rect(0, 0, pix.w - 1, pix.h - 1, BG);
  names.forEach((n, k) => {
    const iso = new Iso(pix, (k % cols) * cw + cw / 2, Math.floor(k / cols) * rh + 14);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const t = (n === 'road_i_a' || n === 'road_i_b') ? (j === 0 ? 'road_i_a' : j === 1 ? 'road_i_b' : 'road')
        : (n === 'road_j_a' || n === 'road_j_b') ? (i === 0 ? 'road_j_a' : i === 1 ? 'road_j_b' : 'road') : n;
      A.TILES[t](iso, i, j);
    }
  });
  fs.writeFileSync(path.join(outDir, 'art_city_tiles.png'), toPNG(pix, 2));
  console.log('art_city_tiles.png', names.join(','));
}

// ---------- 示範街景 24×18 ----------
const NI = 24, NJ = 18;
const T = []; for (let i = 0; i < NI; i++) T.push(new Array(NJ).fill('grass'));
const fillT = (i0, j0, i1, j1, v) => { for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (i >= 0 && j >= 0 && i < NI && j < NJ) T[i][j] = v; };
fillT(1, 1, 8, 7, 'plaza');                                      // 中央廣場
fillT(9, 4, 23, 4, 'sidewalk'); fillT(9, 7, 23, 7, 'sidewalk');  // 主街（沿 i，兩線道）
fillT(9, 5, 23, 5, 'road_i_a'); fillT(9, 6, 23, 6, 'road_i_b');
fillT(13, 5, 13, 6, 'crosswalk_i');
fillT(18, 8, 18, 17, 'sidewalk'); fillT(21, 8, 21, 17, 'sidewalk'); // 支線（沿 j）
fillT(19, 8, 19, 17, 'road_j_a'); fillT(20, 8, 20, 17, 'road_j_b');
fillT(19, 5, 20, 7, 'road'); fillT(19, 8, 20, 8, 'crosswalk_j');
fillT(9, 8, 17, 8, 'sidewalk');
fillT(4, 11, 6, 11, 'dirt'); fillT(6, 8, 6, 10, 'dirt');         // 家門口的小徑
fillT(9, 11, 11, 13, 'water');                                   // 小池塘
const O = [
  { t: 'fountain', i: 4, j: 3, r: 0 }, { t: 'bulletin_board', i: 1, j: 1, r: 0 },
  { t: 'bench', i: 6, j: 1, r: 0 }, { t: 'bench', i: 1, j: 4, r: 1 }, { t: 'bench', i: 4, j: 7, r: 2 },
  { t: 'tree_round', i: 8, j: 1, r: 0 }, { t: 'tree_pine', i: 1, j: 7, r: 0 }, { t: 'tree_round', i: 8, j: 7, r: 0 },
  { t: 'street_lamp', i: 1, j: 3, r: 0, on: true }, { t: 'street_lamp', i: 8, j: 4, r: 0, on: true },
  { t: 'flower_bed', i: 3, j: 0, r: 0 }, { t: 'flower_bed', i: 6, j: 0, r: 0 },
  { t: 'cafe_building', i: 9, j: 0, r: 0 }, { t: 'bakery_building', i: 15, j: 0, r: 0 }, { t: 'apartment_building', i: 19, j: 0, r: 0 },
  { t: 'street_lamp', i: 14, j: 4, r: 0, on: true }, { t: 'trash_bin', i: 14, j: 3, r: 0 },
  { t: 'street_lamp', i: 11, j: 7, r: 0, on: true }, { t: 'street_lamp', i: 16, j: 7, r: 0, on: true },
  { t: 'sign_arrow', i: 18, j: 7, r: 0 },
  { t: 'market_building', i: 13, j: 9, r: 1 },
  { t: 'house_player', i: 1, j: 10, r: 1 }, { t: 'mailbox', i: 4, j: 12, r: 1 }, { t: 'flower_bed', i: 1, j: 13, r: 0 },
  { t: 'bush', i: 0, j: 9, r: 0 }, { t: 'bush', i: 8, j: 12, r: 0 }, { t: 'bush', i: 12, j: 12, r: 0 }, { t: 'tree_round', i: 8, j: 10, r: 0 },
  { t: 'fence_j', i: 23, j: 5, r: 0 }, { t: 'fence_j', i: 23, j: 6, r: 0 }, { t: 'fence_i', i: 19, j: 17, r: 0 }, { t: 'fence_i', i: 20, j: 17, r: 0 },
  { t: 'tree_round', i: 22, j: 9, r: 0 }, { t: 'tree_pine', i: 22, j: 12, r: 0 }, { t: 'tree_round', i: 23, j: 15, r: 0 },
  { t: 'tree_pine', i: 8, j: 15, r: 0 }, { t: 'tree_round', i: 2, j: 15, r: 0 }, { t: 'bush', i: 12, j: 16, r: 0 }, { t: 'bush', i: 5, j: 14, r: 0 },
  { t: 'tree_pine', i: 15, j: 16, r: 0 }, { t: 'trash_bin', i: 17, j: 16, r: 0 }, { t: 'bench', i: 16, j: 17, r: 2 },
];
// 物件格子互不重疊
{
  const occ = {};
  for (const o of O) {
    const [w, d] = M.footprint(M.ITEMS[o.t], o.r);
    for (let x = 0; x < w; x++) for (let y = 0; y < d; y++) {
      const k = (o.i + x) + ',' + (o.j + y);
      if (o.i + x >= NI || o.j + y >= NJ) { bad++; console.log('街景出界', o.t); }
      if (occ[k]) { bad++; console.log('街景格子重疊', o.t, occ[k], k); } occ[k] = o.t;
    }
  }
}
const look = (shirt, pants, hair, hairC) => ({ shirt, pants, hair, hairC });
const chars = [
  { i: 7.5, j: 6.4, facing: 'SW', look: look(2, 0, 'short', 0) }, { i: 2.6, j: 6.5, facing: 'SE', step: 1, look: look(6, 3, 'long', 3) },
  { i: 11.5, j: 4.5, facing: 'NE', look: look(1, 1, 'spiky', 1) }, { i: 18.5, j: 12.4, facing: 'SW', step: -1, look: look(3, 2, 'long', 4) },
  { i: 4.5, j: 11.5, facing: 'SE', look: look(0, 0, 'short', 2) },
];
const benchIt = O.find(o => o.t === 'bench'), sp = M.seatSpot(benchIt, 1);
chars.push({ i: sp.i, j: sp.j, facing: sp.facing, pose: 'sit', seatZ: sp.z, look: look(7, 4, 'bald') });

const TOP = 270, ww = (NI + NJ) * 32 + 40, wh = (NI + NJ) * 16 + TOP + 40;
const pix = new Pix(ww, wh); pix.rect(0, 0, ww - 1, wh - 1, [176, 222, 236]);
const iso = new Iso(pix, NJ * 32 + 20, TOP);
for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) A.TILES[T[i][j]](iso, i, j);
{
  const P = (i, j) => iso.P(i, j), a = P(0, NJ), b = P(NI, NJ), c = P(NI, 0);
  pix.poly([a, b, [b[0], b[1] + 12], [a[0], a[1] + 12]], [150, 112, 80], OUT);
  pix.poly([c, b, [b[0], b[1] + 12], [c[0], c[1] + 12]], [124, 92, 66], OUT);
}
const list = [];
for (const o of O) for (const q of M.itemParts(o)) list.push(q);
for (const ch of chars) {
  const cp = M.charParts(ch.i, ch.j, ch.facing, ch.step || 0, ch.look, ch.pose, ch.seatZ), a = cp.aabb;
  list.push({ i0: a.i0, i1: a.i1, j0: a.j0, j1: a.j1, z0: a.z0, z1: a.z1, draw(is) { for (const q of cp.parts) q.draw(is); } });
}
const t0 = Date.now();
for (const d of depthSort(list)) d.draw(iso);
fs.writeFileSync(path.join(outDir, 'art_city_street.png'), toPNG(pix, 1));
// 縮小版（2×2 平均）
const sm = new Pix(ww >> 1, wh >> 1);
for (let y = 0; y < sm.h; y++) for (let x = 0; x < sm.w; x++) {
  let r = 0, g = 0, b = 0;
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const v = pix.d[(y * 2 + dy) * ww + x * 2 + dx]; r += v & 255; g += (v >>> 8) & 255; b += (v >>> 16) & 255; }
  sm.px(x, y, [r / 4, g / 4, b / 4]);
}
fs.writeFileSync(path.join(outDir, 'art_city_street_small.png'), toPNG(sm, 1));
console.log('art_city_street.png', ww + 'x' + wh, '零件', list.length, '排序+繪製', Date.now() - t0, 'ms');
console.log(bad ? `總共問題 ${bad} 處` : '全部檢查通過');
process.exitCode = bad ? 1 : 0;
