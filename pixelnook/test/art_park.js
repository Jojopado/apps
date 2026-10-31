// 公園美術檢查：①每個物件 × 4 旋轉 × on/off，零件兩兩不重疊、不超出佔地 ②層級循環 ③繪製順序（透視）
// ④坐野餐桌的人不插進桌子 ⑤輸出物件圖鑑、示範公園、ICONS 放大圖
require('../js/raster.js'); require('../js/models.js'); require('../js/art/city.js'); require('../js/art/park.js');
const { Pix, Iso, depthSort, toPNG, OUT } = PX, M = MODELS, A = ART.park, CITY = ART.city;
const fs = require('fs'), path = require('path');
const outDir = path.join(__dirname, 'out'); fs.mkdirSync(outDir, { recursive: true });
Object.assign(M.ITEMS, CITY.OBJS, A.OBJS);   // 只在測試裡暫時註冊

let bad = 0, checked = 0;
const E = 1e-6;
const overlaps = (a, b) => a.i0 < b.i1 - E && b.i0 < a.i1 - E && a.j0 < b.j1 - E && b.j0 < a.j1 - E && a.z0 < b.z1 - E && b.z0 < a.z1 - E;
const fmt = p => [p.i0, p.i1, p.j0, p.j1, p.z0, p.z1].map(v => +v.toFixed(3));
const ids = Object.keys(A.OBJS);

// ---------- ① 重疊／佔地 ----------
for (const id of ids) {
  const d = A.OBJS[id];
  if (!d.name) { bad++; console.log('NO NAME', id); }
  for (let r = 0; r < 4; r++) for (const on of [false, true]) {
    const parts = M.itemParts({ t: id, i: 0, j: 0, r, on });
    const [wi, wj] = M.footprint(d, r);
    for (let x = 0; x < parts.length; x++) {
      const q = parts[x];
      if (q.i0 < -E || q.j0 < -E || q.i1 > wi + E || q.j1 > wj + E) { bad++; console.log('OUT OF FOOTPRINT', id, 'r' + r, on, x, JSON.stringify(fmt(q))); }
      if (!(q.z1 - q.z0 > 0 && q.i1 - q.i0 > 0 && q.j1 - q.j0 > 0)) { bad++; console.log('EMPTY PART', id, x); }
      for (let y = x + 1; y < parts.length; y++) {
        checked++;
        if (overlaps(q, parts[y])) { bad++; console.log('OVERLAP', id, 'r' + r, on, x, y, JSON.stringify([fmt(q), fmt(parts[y])])); }
      }
    }
  }
}
console.log(bad ? `問題 ${bad} 處` : `零件重疊檢查：全部通過（${ids.length} 件 × 4 方向 × on/off，${checked} 組比對，重疊 0、出界 0）`);

// ---------- ② 層級循環（Tarjan 強連通分量） ----------
function cyclesOf(parts) {
  const n = parts.length, adj = parts.map(() => []);
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const ab = PX.behind(parts[a], parts[b]), ba = PX.behind(parts[b], parts[a]);
    if (ab && !ba) adj[a].push(b); else if (ba && !ab) adj[b].push(a);
  }
  let idx = 0; const st = [], onS = new Array(n).fill(false), num = new Array(n).fill(-1), low = new Array(n).fill(0), comps = [];
  function sc(v) {
    num[v] = low[v] = idx++; st.push(v); onS[v] = true;
    for (const w of adj[v]) { if (num[w] < 0) { sc(w); low[v] = Math.min(low[v], low[w]); } else if (onS[w]) low[v] = Math.min(low[v], num[w]); }
    if (low[v] === num[v]) { const c = []; let w; do { w = st.pop(); onS[w] = false; c.push(w); } while (w !== v); if (c.length > 1) comps.push(c); }
  }
  for (let v = 0; v < n; v++) if (num[v] < 0) sc(v);
  return comps;
}
let cyc = 0;
for (const id of ids) for (let r = 0; r < 4; r++) for (const on of [false, true]) {
  const parts = M.itemParts({ t: id, i: 0, j: 0, r, on });
  for (const c of cyclesOf(parts)) { cyc++; bad++; console.log('CYCLE', id, 'r' + r, on, c.map(k => k + JSON.stringify(fmt(parts[k]))).join(' ')); }
}
console.log(cyc ? `層級循環 ${cyc} 組` : '層級循環檢查：全部通過（0 組）');

// ---------- ③ 繪製順序（透視）：沿視線比對誰比較靠近鏡頭（同 test/art_cafe.js） ----------
function rayInt(b, x, y) {
  const xs = x / 32;
  const lo = Math.max(2 * b.i0 - xs, 2 * b.j0 + xs, (b.z0 + y) / 16), hi = Math.min(2 * b.i1 - xs, 2 * b.j1 + xs, (b.z1 + y) / 16);
  return hi - lo > 1e-4 ? [lo, hi] : null;
}
function scr(b) {
  const xs = [], ys = [];
  for (const i of [b.i0, b.i1]) for (const j of [b.j0, b.j1]) for (const z of [b.z0, b.z1]) { xs.push((i - j) * 32); ys.push((i + j) * 16 - z); }
  return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
}
function orderErrors(sorted) {
  const errs = [];
  for (let a = 0; a < sorted.length; a++) for (let b = a + 1; b < sorted.length; b++) {
    const P = sorted[a], Q = sorted[b], ra = scr(P), rb = scr(Q);
    const x0 = Math.max(ra[0], rb[0]), x1 = Math.min(ra[1], rb[1]), y0 = Math.max(ra[2], rb[2]), y1 = Math.min(ra[3], rb[3]);
    if (x1 - x0 < 1 || y1 - y0 < 1) continue;
    let wrong = 0;
    for (let x = x0 + 0.5; x < x1; x += 1) for (let y = y0 + 0.5; y < y1; y += 1) {
      const ia = rayInt(P, x, y), ib = rayInt(Q, x, y);
      if (ia && ib && ia[0] >= ib[1] - 1e-6) wrong++;
    }
    if (wrong > 1) errs.push([a, b, wrong]);
  }
  return errs;
}
let seeThru = 0;
for (const id of ids) for (let r = 0; r < 4; r++) for (const on of [false, true]) {
  const sorted = depthSort(M.itemParts({ t: id, i: 0, j: 0, r, on }));
  for (const [a, b, n] of orderErrors(sorted)) { seeThru++; bad++; console.log('ORDER', id, 'r' + r, on, JSON.stringify(fmt(sorted[a])), 'before', JSON.stringify(fmt(sorted[b])), n + 'px'); }
}
console.log(seeThru ? `繪製順序錯誤 ${seeThru} 處` : '繪製順序（透視）檢查：全部通過');

// ---------- ④ 坐野餐桌：每個座位 × 4 方向 × 5 種髮型，人和桌子零件不重疊 ----------
{
  let sitBad = 0;
  for (const id of ids.filter(k => A.OBJS[k].seat)) for (let r = 0; r < 4; r++) {
    const it = { t: id, i: 2, j: 2, r }, items = M.itemParts(it);
    for (let k = 0; k < A.OBJS[id].seat.spots.length; k++) {
      const s = M.seatSpot(it, k);
      for (const hair of M.HAIRS) for (const q of M.charParts(s.i, s.j, s.facing, 0, { hair }, 'sit', s.z).parts) for (const b of items) {
        checked++;
        if (overlaps(q, b)) { sitBad++; bad++; if (sitBad < 10) console.log('SIT OVERLAP', id, 'r' + r, 'spot' + k, hair, JSON.stringify([fmt(q), fmt(b)])); }
      }
    }
  }
  console.log(sitBad ? `坐姿重疊 ${sitBad} 處` : '坐姿檢查：全部通過（野餐桌 4 個座位 × 4 方向）');
}

// ---------- ⑤-a 物件圖鑑：每件 4 個方向；可採集的物件再多一列「已採集」，sparkle 多一列第二幀 ----------
const BG = [250, 236, 214];
function catalog(rowsDef, file, scale) {
  const rows = rowsDef.map(([id, on]) => {
    const d = A.OBJS[id]; let zmax = 0;
    for (const q of M.itemParts({ t: id, i: 0, j: 0, r: 0, on })) zmax = Math.max(zmax, q.z1);
    const span = (d.W + d.D) * 32;
    return { id, on, d, zmax, cw: Math.max(span + 50, 140), rh: (d.W + d.D) * 16 + zmax + 34 };
  });
  const cw = Math.max(...rows.map(r => r.cw)), Wd = cw * 4, H = rows.reduce((s, r) => s + r.rh, 0);
  const pix = new Pix(Wd, H); pix.rect(0, 0, Wd - 1, H - 1, BG);
  let y = 0;
  for (const row of rows) {
    for (let r = 0; r < 4; r++) {
      const [wi, wj] = M.footprint(row.d, r);
      const iso = new Iso(pix, r * cw + cw / 2 + (wj - wi) * 16, y + row.zmax + 18);
      iso.flat(0, 0, wi, wj, row.d.onWater ? CITY.COLORS.water : [232, 196, 138], 0, [214, 174, 116]);
      // 正面方向的小記號（前面那一格的邊）
      const [fi, fj] = M.ROT[r];
      const P = iso.P(wi / 2 + fi * (wi / 2 + 0.15), wj / 2 + fj * (wj / 2 + 0.15));
      pix.rect(P[0] - 1, P[1] - 1, P[0] + 1, P[1] + 1, [220, 80, 80]);
      for (const q of depthSort(M.itemParts({ t: row.id, i: 0, j: 0, r, on: row.on }))) q.draw(iso);
    }
    pix.rect(0, y + row.rh - 1, Wd - 1, y + row.rh - 1, [226, 206, 178]);
    y += row.rh;
  }
  fs.writeFileSync(path.join(outDir, file), toPNG(pix, scale));
  console.log(file, rows.length, '列', Wd * scale + 'x' + H * scale);
}
const small = ids.filter(k => !['gazebo', 'tree_big', 'picnic_table', 'mushroom_log'].includes(k));
const rowsOf = list => { const out = []; for (const id of list) { out.push([id, false]); if (A.OBJS[id].gatherable || id === 'sparkle') out.push([id, true]); } return out; };
const sm = rowsOf(small);
catalog(sm.slice(0, 10), 'art_park_objs1.png', 2);
catalog(sm.slice(10), 'art_park_objs2.png', 2);
catalog(rowsOf(['picnic_table', 'mushroom_log', 'tree_big', 'gazebo']), 'art_park_objs_big.png', 2);

// ---------- ⑤-b 示範公園 24×18 ----------
const NI = 24, NJ = 18;
const T = []; for (let i = 0; i < NI; i++) T.push(new Array(NJ).fill('grass'));
const fillT = (i0, j0, i1, j1, v) => { for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (i >= 0 && j >= 0 && i < NI && j < NJ) T[i][j] = v; };
fillT(0, 4, 23, 4, 'dirt');                    // 橫向步道
fillT(12, 0, 12, 17, 'dirt');                  // 直向步道
fillT(15, 9, 20, 14, 'plaza'); fillT(13, 11, 14, 11, 'dirt');   // 涼亭廣場＋接步道
fillT(3, 8, 8, 13, 'water');                   // 池塘（去掉四個角，看起來比較圓）
for (const [i, j] of [[3, 8], [8, 8], [3, 13], [8, 13]]) T[i][j] = 'grass';
fillT(4, 7, 7, 7, 'water'); fillT(9, 9, 9, 12, 'water');
fillT(5, 5, 5, 6, 'dirt'); fillT(6, 14, 6, 17, 'dirt'); fillT(7, 17, 11, 17, 'dirt');
const O = [
  { t: 'park_sign', i: 11, j: 0, r: 1 }, { t: 'park_sign', i: 0, j: 5, r: 0 },
  { t: 'tree_big', i: 0, j: 0, r: 0 }, { t: 'tree_big', i: 20, j: 0, r: 0 }, { t: 'tree_big', i: 9, j: 14, r: 0 }, { t: 'tree_big', i: 21, j: 15, r: 0 }, { t: 'tree_big', i: 14, j: 15, r: 0 },
  { t: 'gazebo', i: 16, j: 10, r: 0 },
  { t: 'picnic_table', i: 14, j: 6, r: 0 }, { t: 'picnic_table', i: 19, j: 6, r: 0 },
  { t: 'lily_pad', i: 4, j: 9, r: 0 }, { t: 'lily_pad', i: 6, j: 11, r: 1 }, { t: 'lily_pad', i: 7, j: 9, r: 2 }, { t: 'lily_pad', i: 5, j: 12, r: 3 },
  { t: 'pond_rock', i: 3, j: 10, r: 0 }, { t: 'pond_rock', i: 8, j: 12, r: 1 }, { t: 'pond_rock', i: 9, j: 9, r: 2 },
  { t: 'reeds', i: 2, j: 9, r: 0 }, { t: 'reeds', i: 2, j: 12, r: 0 }, { t: 'reeds', i: 3, j: 13, r: 0 }, { t: 'reeds', i: 10, j: 11, r: 0 }, { t: 'reeds', i: 8, j: 7, r: 0 },
  { t: 'flower_patch_red', i: 9, j: 5, r: 0 }, { t: 'flower_patch_yellow', i: 10, j: 6, r: 0 }, { t: 'flower_patch_blue', i: 9, j: 7, r: 0, on: true },
  { t: 'flower_patch_red', i: 2, j: 2, r: 0, on: true }, { t: 'flower_patch_blue', i: 4, j: 2, r: 0 }, { t: 'flower_patch_yellow', i: 6, j: 2, r: 0 },
  { t: 'herb_bush', i: 14, j: 13, r: 0 }, { t: 'herb_bush', i: 22, j: 11, r: 0, on: true }, { t: 'mushroom_log', i: 1, j: 15, r: 0 }, { t: 'mushroom_log', i: 22, j: 12, r: 1, on: true },
  { t: 'trash_can_park', i: 13, j: 3, r: 0 }, { t: 'trash_can_park', i: 13, j: 12, r: 1 },
  { t: 'trash_bag', i: 8, j: 4, r: 0 }, { t: 'trash_bottle', i: 12, j: 9, r: 1 }, { t: 'trash_paper', i: 17, j: 4, r: 0 }, { t: 'trash_bottle', i: 4, j: 15, r: 0 }, { t: 'trash_paper', i: 19, j: 9, r: 0 },
  { t: 'sparkle', i: 7, j: 5, r: 0 }, { t: 'sparkle', i: 19, j: 13, r: 0, on: true }, { t: 'sparkle', i: 2, j: 7, r: 0 },
  { t: 'sapling', i: 22, j: 8, r: 0 }, { t: 'sapling', i: 1, j: 11, r: 0 }, { t: 'sapling', i: 7, j: 15, r: 0 },
];
for (let i = 14; i <= 22; i++) if (i !== 17 && i !== 18) O.push({ t: 'hedge_i', i, j: 3, r: 0 });
for (let j = 6; j <= 9; j++) O.push({ t: 'hedge_i', i: 23, j, r: 1 });
{
  const occ = {};
  for (const o of O) {
    const d = M.ITEMS[o.t], [w, dd] = M.footprint(d, o.r);
    for (let x = 0; x < w; x++) for (let y = 0; y < dd; y++) {
      const k = (o.i + x) + ',' + (o.j + y);
      if (o.i + x >= NI || o.j + y >= NJ) { bad++; console.log('公園出界', o.t); continue; }
      const onW = T[o.i + x][o.j + y] === 'water';
      if (d.onWater && !onW) { bad++; console.log('荷葉不在水上', o.t, k); }
      if (occ[k]) { bad++; console.log('公園格子重疊', o.t, occ[k], k); } occ[k] = o.t;
    }
  }
}
const look = (shirt, pants, hair, hairC) => ({ shirt, pants, hair, hairC });
const tbl = O.find(o => o.t === 'picnic_table');
const chars = [
  { i: 12.5, j: 7.5, facing: 'SW', step: 1, look: look(2, 0, 'short', 0) },
  { i: 17.5, j: 11.3, facing: 'SE', look: look(6, 3, 'long', 3) },
  { i: 5.5, j: 4.5, facing: 'SE', step: -1, look: look(3, 2, 'bun', 4) },
];
for (const [k, lk] of [[0, look(1, 1, 'spiky', 1)], [3, look(7, 4, 'bald')]]) { const s = M.seatSpot(tbl, k); chars.push({ i: s.i, j: s.j, facing: s.facing, pose: 'sit', seatZ: s.z, look: lk }); }

const TOP = 200, ww = (NI + NJ) * 32 + 40, wh = (NI + NJ) * 16 + TOP + 40;
const pix = new Pix(ww, wh); pix.rect(0, 0, ww - 1, wh - 1, [176, 222, 236]);
const iso = new Iso(pix, NJ * 32 + 20, TOP);
for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) CITY.TILES[T[i][j]](iso, i, j);
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
for (const d of depthSort(list)) d.draw(iso);
fs.writeFileSync(path.join(outDir, 'art_park_demo.png'), toPNG(pix, 1));
console.log('art_park_demo.png', ww + 'x' + wh, '零件', list.length);
// 放大局部：池塘＋野餐桌＋涼亭
{
  const cx0 = 360, cy0 = 330, cw = 760, ch = 420, crop = new Pix(cw, ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) crop.d[y * cw + x] = pix.d[(y + cy0) * ww + x + cx0];
  fs.writeFileSync(path.join(outDir, 'art_park_demo_zoom.png'), toPNG(crop, 2));
}

// ---------- ⑤-c ICONS 4 倍放大 ----------
{
  const names = Object.keys(A.ICONS), cols = 8, cell = 40;
  const ip = new Pix(cols * cell, Math.ceil(names.length / cols) * cell);
  ip.rect(0, 0, ip.w - 1, ip.h - 1, BG);
  names.forEach((n, k) => {
    const x = (k % cols) * cell + 4, y = Math.floor(k / cols) * cell + 4;
    ip.rect(x - 1, y - 1, x + 32, y + 32, [255, 246, 230]);
    A.ICONS[n](ip, x, y);
  });
  fs.writeFileSync(path.join(outDir, 'art_park_icons.png'), toPNG(ip, 4));
  console.log('icons', names.length, names.join(' '));
}
const need = ['postcard', 'badge', 'old_photo', 'ticket', 'key_old', 'marble', 'flower_red', 'flower_yellow', 'flower_blue', 'leaf_maple', 'acorn', 'clover4', 'feather', 'mushroom', 'coffee_bean', 'croissant', 'cake_slice', 'macaron', 'cookie', 'donut', 'gold_coin', 'music_box', 'compass', 'star_shard', 'mat_flower', 'mat_leaf', 'mat_mushroom', 'mat_wood', 'trash_icon', 'locked'];
for (const n of need) if (!A.ICONS[n]) { bad++; console.log('缺少圖示', n); }
const needObj = ['pond_rock', 'reeds', 'lily_pad', 'picnic_table', 'gazebo', 'park_sign', 'flower_patch_red', 'flower_patch_yellow', 'flower_patch_blue', 'herb_bush', 'mushroom_log', 'trash_can_park', 'trash_bag', 'trash_bottle', 'trash_paper', 'sparkle', 'sapling', 'tree_big', 'hedge_i'];
for (const n of needObj) if (!A.OBJS[n]) { bad++; console.log('缺少物件', n); }
console.log(bad ? `總共問題 ${bad} 處` : '全部檢查通過');
process.exitCode = bad ? 1 : 0;
