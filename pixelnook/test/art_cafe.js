// 咖啡廳美術檢查：①所有物件 × 4 旋轉零件不重疊（含坐著的客人 vs 椅子）②輸出圖鑑、坐姿、示範咖啡廳、圖示 PNG
require('../js/raster.js'); require('../js/models.js'); require('../js/scene.js'); require('../js/art/cafe.js');
const { Pix, Iso, depthSort, toPNG, OUT } = PX, M = MODELS, S = SCENE, A = ART.cafe;
const fs = require('fs'), path = require('path');
const outDir = path.join(__dirname, 'out'); fs.mkdirSync(outDir, { recursive: true });

// 暫時加入（只在這個測試行程裡，不改 models.js）
Object.assign(M.ITEMS, A.OBJS, A.WALLDECO);
const W0 = M.WALLS.length, F0 = M.FLOORS.length;
M.WALLS.push(...A.WALLS); M.FLOORS.push(...A.FLOORS);

let bad = 0, checked = 0;
const ov = (a, b) => { const e = 1e-6; return a.i0 < b.i1 - e && b.i0 < a.i1 - e && a.j0 < b.j1 - e && b.j0 < a.j1 - e && a.z0 < b.z1 - e && b.z0 < a.z1 - e; };
const fmt = p => [p.i0, p.i1, p.j0, p.j1, p.z0, p.z1].map(v => +v.toFixed(3));
function checkParts(name, parts, others) {
  for (let x = 0; x < parts.length; x++) {
    const ys = others ? others.map((_, k) => k) : parts.map((_, k) => k).filter(k => k > x);
    for (const y of ys) {
      const b = others ? others[y] : parts[y]; checked++;
      if (ov(parts[x], b)) { bad++; console.log('OVERLAP', name, x, y, JSON.stringify([fmt(parts[x]), fmt(b)])); }
    }
  }
}
const ids = Object.keys(A.OBJS);
for (const id of ids) for (let r = 0; r < 4; r++) for (const on of [false, true]) checkParts(id + ' r' + r, M.itemParts({ t: id, i: 0, j: 0, r, on }));
// 坐著的客人不能插進椅子
for (const id of ids.filter(k => A.OBJS[k].seat)) for (let r = 0; r < 4; r++) {
  const it = { t: id, i: 2, j: 2, r }, s = M.seatSpot(it, 0);
  for (const hair of M.HAIRS) checkParts('sit ' + id + ' r' + r + ' ' + hair, M.charParts(s.i, s.j, s.facing, 0, { hair }, 'sit', s.z).parts, M.itemParts(it));
}
console.log(bad ? `重疊 ${bad} 處（檢查 ${checked} 對）` : `零件重疊檢查：全部通過（${ids.length} 件 × 4 旋轉，檢查 ${checked} 對）`);

// ---- 透視檢查（畫家順序是否正確）：對每兩個零件，在畫面重疊處沿視線射線算誰比較靠近鏡頭，
//      跟 depthSort 的繪製順序比對。視線：螢幕點 (x,y) 上的點 i=(u+x/32)/2, j=(u-x/32)/2, z=16u-y，u 越大越靠近鏡頭。
function rayInt(b, x, y) {
  const xs = x / 32;
  const lo = Math.max(2 * b.i0 - xs, 2 * b.j0 + xs, (b.z0 + y) / 16), hi = Math.min(2 * b.i1 - xs, 2 * b.j1 + xs, (b.z1 + y) / 16);
  return hi - lo > 1e-4 ? [lo, hi] : null;
}
function scr(b) {   // 螢幕外框（不含 Iso 原點）
  const xs = [], ys = [];
  for (const i of [b.i0, b.i1]) for (const j of [b.j0, b.j1]) for (const z of [b.z0, b.z1]) { xs.push((i - j) * 32); ys.push((i + j) * 16 - z); }
  return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
}
function orderErrors(sorted) {
  const errs = [];
  for (let a = 0; a < sorted.length; a++) for (let b = a + 1; b < sorted.length; b++) {
    const A = sorted[a], B = sorted[b];             // A 先畫、B 後畫 → B 必須不在 A 後面
    const ra = scr(A), rb = scr(B);
    const x0 = Math.max(ra[0], rb[0]), x1 = Math.min(ra[1], rb[1]), y0 = Math.max(ra[2], rb[2]), y1 = Math.min(ra[3], rb[3]);
    if (x1 - x0 < 1 || y1 - y0 < 1) continue;
    let wrong = 0;
    for (let x = x0 + 0.5; x < x1; x += 1) for (let y = y0 + 0.5; y < y1; y += 1) {
      const ia = rayInt(A, x, y), ib = rayInt(B, x, y);
      if (ia && ib && ia[0] >= ib[1] - 1e-6) wrong++;   // A 整段都比 B 靠近鏡頭，卻被 B 蓋住
    }
    if (wrong > 1) errs.push([a, b, wrong]);
  }
  return errs;
}
// depthSort 遇到循環時會亂挑，所以每個物件內部的「前後」關係必須無循環
function cycles(list) {
  const n = list.length, adj = list.map(() => []);
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (a !== b) {
    const ab = PX.behind(list[a], list[b]), ba = PX.behind(list[b], list[a]);
    if (ab && !ba) adj[a].push(b);
  }
  let idx = 0; const st = [], on = [], ix = [], low = [], out = [];
  function sc(v) {
    ix[v] = low[v] = idx++; st.push(v); on[v] = true;
    for (const w of adj[v]) { if (ix[w] === undefined) { sc(w); low[v] = Math.min(low[v], low[w]); } else if (on[w]) low[v] = Math.min(low[v], ix[w]); }
    if (low[v] === ix[v]) { const c = []; let w; do { w = st.pop(); on[w] = false; c.push(w); } while (w !== v); if (c.length > 1) out.push(c); }
  }
  for (let v = 0; v < n; v++) if (ix[v] === undefined) sc(v);
  return out;
}
let cyc = 0;
for (const id of ids) for (let r = 0; r < 4; r++) {
  const parts = M.itemParts({ t: id, i: 0, j: 0, r });
  for (const c of cycles(parts)) { cyc++; console.log('CYCLE', id, 'r' + r, c.map(k => 'part' + k + JSON.stringify(fmt(parts[k]))).join(' ')); }
}
console.log(cyc ? `前後關係循環 ${cyc} 組` : '前後關係循環檢查：全部通過');
let seeThru = 0;
for (const id of ids) for (let r = 0; r < 4; r++) {
  const sorted = depthSort(M.itemParts({ t: id, i: 0, j: 0, r }));
  for (const [a, b, n] of orderErrors(sorted)) { seeThru++; console.log('ORDER', id, 'r' + r, 'drawn', sorted[a].dbg || '', JSON.stringify(fmt(sorted[a])), 'before', JSON.stringify(fmt(sorted[b])), n + 'px'); }
}
console.log(seeThru ? `繪製順序錯誤 ${seeThru} 處` : '繪製順序（透視）檢查：全部通過');

// ---- 圖鑑：每件 4 個方向 ----
{
  const cw = 280, rh = 200, W = cw * 4, H = rh * ids.length;
  const pix = new Pix(W, H); pix.rect(0, 0, W - 1, H - 1, [250, 236, 214]);
  ids.forEach((id, row) => {
    const d = A.OBJS[id];
    for (let r = 0; r < 4; r++) {
      const iso = new Iso(pix, r * cw + cw / 2, row * rh + 50);
      const [wi, wj] = M.footprint(d, r);
      iso.flat(0, 0, 4, 4, [232, 196, 138], 0, [214, 174, 116]);
      const it = { t: id, i: (4 - wi) / 2, j: (4 - wj) / 2, r };
      for (const q of depthSort(M.itemParts(it))) q.draw(iso);
    }
  });
  fs.writeFileSync(path.join(outDir, 'art_cafe_items.png'), toPNG(pix, 1));
}

// ---- 坐姿：咖啡椅 4 個方向各坐一人，前面放桌子 ----
{
  const room = S.newRoom(); room.wall = W0; room.floor = F0 + 1; const chars = [];
  const spots = [[1, 1], [5, 1], [1, 5], [5, 5]];
  for (let r = 0; r < 4; r++) {
    const [fi, fj] = M.ROT[r];
    const it = { t: 'cafe_chair', i: spots[r][0] + 1, j: spots[r][1] + 1, r }; room.items.push(it);
    room.items.push({ t: 'cafe_table', i: it.i + fi, j: it.j + fj, r: 0 });
    const s = M.seatSpot(it, 0);
    chars.push({ i: s.i, j: s.j, facing: s.facing, look: { shirt: r + 1, pants: r, hair: M.HAIRS[r], hairC: r + 1 }, pose: 'sit', seatZ: s.z });
  }
  fs.writeFileSync(path.join(outDir, 'art_cafe_seats.png'), toPNG(S.renderFull(room, chars), 2));
}

// ---- 示範咖啡廳 ----
function demo(wall, floor, file) {
  const room = S.newRoom(); room.wall = wall; room.floor = floor;
  room.items = [
    // 後排靠牆：杯架、咖啡機 ×2、盆栽
    { t: 'cup_shelf', i: 0, j: 0, r: 0 }, { t: 'espresso_machine', i: 2, j: 0, r: 0 }, { t: 'espresso_machine', i: 3, j: 0, r: 0 },
    { t: 'cup_shelf', i: 6, j: 0, r: 0 }, { t: 'plant_cafe', i: 8, j: 0, r: 0 },
    // 櫃台列
    { t: 'pastry_case', i: 1, j: 2, r: 0 }, { t: 'cafe_counter', i: 3, j: 2, r: 0 }, { t: 'register', i: 6, j: 2, r: 0 },
    // 座位區
    { t: 'cafe_table', i: 2, j: 5, r: 0 }, { t: 'cafe_chair', i: 1, j: 5, r: 1 }, { t: 'cafe_chair', i: 3, j: 5, r: 3 },
    { t: 'cafe_table', i: 6, j: 5, r: 0 }, { t: 'cafe_chair', i: 6, j: 4, r: 0 }, { t: 'cafe_chair', i: 6, j: 6, r: 2 },
    { t: 'plant_cafe', i: 0, j: 2, r: 0 },
    { t: 'menu_stand', i: 8, j: 4, r: 1 }, { t: 'plant_cafe', i: 0, j: 7, r: 0 }, { t: 'plant_cafe', i: 8, j: 7, r: 0 },
  ];
  room.walls = [
    { t: 'cafe_sign_wall', side: 'R', u: 2 }, { t: 'menu_board', side: 'R', u: 4 },
    { t: 'cafe_sign_wall', side: 'L', u: 1 }, { t: 'wall_shelf_cups', side: 'L', u: 4 }, { t: 'menu_board', side: 'L', u: 6 },
  ];
  for (const it of room.items.concat(room.walls)) if (!S.canPlace(room, it, it)) console.log('不能放', JSON.stringify(it));
  const sit = (it, look) => { const s = M.seatSpot(it, 0); return { i: s.i, j: s.j, facing: s.facing, look, pose: 'sit', seatZ: s.z }; };
  const chair = (i, j) => room.items.find(x => x.t === 'cafe_chair' && x.i === i && x.j === j);
  const chars = [
    sit(chair(1, 5), { hair: 'long', hairC: 3, shirt: 6, pants: 3, shoes: 1 }),
    sit(chair(6, 4), { hair: 'short', hairC: 1, skin: 3, shirt: 2, pants: 1 }),
    { i: 4.5, j: 1.5, facing: 'SW', step: 0, look: { hair: 'spiky', hairC: 4, shirt: 5, pants: 1, shoes: 0 } },   // 店員
  ];
  fs.writeFileSync(path.join(outDir, file), toPNG(S.renderFull(room, chars), 2));
}
demo(W0, F0 + 1, 'art_cafe_demo.png');
demo(W0 + 1, F0, 'art_cafe_demo2.png');

// ---- 圖示 4 倍放大 ----
{
  const names = Object.keys(A.ICONS), cols = 6, cell = 40;
  const pix = new Pix(cols * cell, Math.ceil(names.length / cols) * cell);
  pix.rect(0, 0, pix.w - 1, pix.h - 1, [250, 236, 214]);
  names.forEach((n, k) => {
    const x = (k % cols) * cell + 4, y = Math.floor(k / cols) * cell + 4;
    pix.rect(x - 1, y - 1, x + 32, y + 32, [255, 246, 230]);
    A.ICONS[n](pix, x, y);
  });
  fs.writeFileSync(path.join(outDir, 'art_cafe_icons.png'), toPNG(pix, 4));
  console.log('icons', names.join(' '));
}
console.log('done');
