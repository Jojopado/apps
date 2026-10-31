// 麵包店＋超市美術檢查：①所有物件 × 4 旋轉零件不重疊（含坐著的客人 vs 椅子）、不超出佔地
// ②層級循環 cycles() ③繪製順序 orderErrors() ④輸出圖鑑、坐姿、示範麵包店、示範超市、圖示 PNG
require('../js/raster.js'); require('../js/models.js'); require('../js/scene.js'); require('../js/art/shops.js');
const { Pix, Iso, depthSort, toPNG } = PX, M = MODELS, S = SCENE, A = ART.shops;
const fs = require('fs'), path = require('path');
const outDir = path.join(__dirname, 'out'); fs.mkdirSync(outDir, { recursive: true });

// 暫時加入（只在這個測試行程裡，不改 models.js）
Object.assign(M.ITEMS, A.OBJS, A.WALLDECO);
const W0 = M.WALLS.length, F0 = M.FLOORS.length;
M.WALLS.push(...A.WALLS); M.FLOORS.push(...A.FLOORS);

let bad = 0, checked = 0, outside = 0;
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
for (const id of ids) for (let r = 0; r < 4; r++) {
  const parts = M.itemParts({ t: id, i: 0, j: 0, r });
  checkParts(id + ' r' + r, parts);
  const [wi, wj] = M.footprint(A.OBJS[id], r), e = 1e-6;
  parts.forEach((q, k) => { if (q.i0 < -e || q.j0 < -e || q.i1 > wi + e || q.j1 > wj + e || q.z0 < -e) { outside++; console.log('OUTSIDE', id, 'r' + r, k, JSON.stringify(fmt(q))); } });
}
// 坐著的客人不能插進椅子
for (const id of ids.filter(k => A.OBJS[k].seat)) for (let r = 0; r < 4; r++) {
  const it = { t: id, i: 2, j: 2, r }, s = M.seatSpot(it, 0);
  for (const hair of M.HAIRS) checkParts('sit ' + id + ' r' + r + ' ' + hair, M.charParts(s.i, s.j, s.facing, 0, { hair }, 'sit', s.z).parts, M.itemParts(it));
}
console.log(bad ? `重疊 ${bad} 處（檢查 ${checked} 對）` : `零件重疊檢查：全部通過（${ids.length} 件 × 4 旋轉，檢查 ${checked} 對）`);
console.log(outside ? `超出佔地 ${outside} 處` : '佔地範圍檢查：全部通過');

// ---- 透視檢查（畫家順序是否正確），同 test/art_cafe.js ----
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
    const A = sorted[a], B = sorted[b];
    const ra = scr(A), rb = scr(B);
    const x0 = Math.max(ra[0], rb[0]), x1 = Math.min(ra[1], rb[1]), y0 = Math.max(ra[2], rb[2]), y1 = Math.min(ra[3], rb[3]);
    if (x1 - x0 < 1 || y1 - y0 < 1) continue;
    let wrong = 0;
    for (let x = x0 + 0.5; x < x1; x += 1) for (let y = y0 + 0.5; y < y1; y += 1) {
      const ia = rayInt(A, x, y), ib = rayInt(B, x, y);
      if (ia && ib && ia[0] >= ib[1] - 1e-6) wrong++;
    }
    if (wrong > 1) errs.push([a, b, wrong]);
  }
  return errs;
}
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
  for (const [a, b, n] of orderErrors(sorted)) { seeThru++; console.log('ORDER', id, 'r' + r, JSON.stringify(fmt(sorted[a])), 'before', JSON.stringify(fmt(sorted[b])), n + 'px'); }
}
console.log(seeThru ? `繪製順序錯誤 ${seeThru} 處` : '繪製順序（透視）檢查：全部通過');

// ---- 圖鑑：每件 4 個方向 ----
function catalog(list, file, scale) {
  const cw = 300, rh = 230, W = cw * 4, H = rh * list.length;
  const pix = new Pix(W, H); pix.rect(0, 0, W - 1, H - 1, [250, 236, 214]);
  list.forEach((id, row) => {
    const d = A.OBJS[id];
    for (let r = 0; r < 4; r++) {
      const iso = new Iso(pix, r * cw + cw / 2, row * rh + 76);
      const [wi, wj] = M.footprint(d, r);
      iso.flat(0, 0, 4, 4, [232, 196, 138], 0, [214, 174, 116]);
      const it = { t: id, i: (4 - wi) / 2, j: (4 - wj) / 2, r };
      for (const q of depthSort(M.itemParts(it))) q.draw(iso);
    }
  });
  fs.writeFileSync(path.join(outDir, file), toPNG(pix, scale || 1));
}
const bakeryIds = ids.filter(k => A.OBJS[k].set === 'bakery'), marketIds = ids.filter(k => A.OBJS[k].set !== 'bakery');
catalog(bakeryIds, 'art_shops_items_bakery.png');
catalog(marketIds, 'art_shops_items_market.png');
if (process.argv[2]) catalog(process.argv.slice(2), 'art_shops_zoom.png', 2);   // 放大檢查：node test/art_shops.js 物件id ...

// ---- 坐姿：麵包店椅 4 個方向各坐一人，前面放小桌 ----
{
  const room = S.newRoom(); room.wall = W0; room.floor = F0; const chars = [];
  const spots = [[1, 1], [5, 1], [1, 5], [5, 5]];
  for (let r = 0; r < 4; r++) {
    const [fi, fj] = M.ROT[r];
    const it = { t: 'bakery_chair', i: spots[r][0] + 1, j: spots[r][1] + 1, r }; room.items.push(it);
    room.items.push({ t: 'bakery_table', i: it.i + fi, j: it.j + fj, r: 0 });
    const s = M.seatSpot(it, 0);
    chars.push({ i: s.i, j: s.j, facing: s.facing, look: { shirt: r + 1, pants: r, hair: M.HAIRS[r], hairC: r + 1 }, pose: 'sit', seatZ: s.z });
  }
  fs.writeFileSync(path.join(outDir, 'art_shops_seats.png'), toPNG(S.renderFull(room, chars), 2));
}

function place(room) { for (const it of room.items.concat(room.walls)) if (!S.canPlace(room, it, it)) console.log('不能放', JSON.stringify(it)); }
const sit = (it, look) => { const s = M.seatSpot(it, 0); return { i: s.i, j: s.j, facing: s.facing, look, pose: 'sit', seatZ: s.z }; };

// ---- 示範麵包店 ----
{
  const room = S.newRoom(); room.wall = W0; room.floor = F0;
  room.items = [
    // 後牆（R）：烤箱、兩座麵包層架、麵粉袋、蛋糕架
    { t: 'bakery_oven', i: 0, j: 0, r: 0 }, { t: 'bread_shelf', i: 2, j: 0, r: 0 }, { t: 'bread_shelf', i: 4, j: 0, r: 0 },
    { t: 'flour_sacks', i: 6, j: 0, r: 0 }, { t: 'flour_sacks', i: 7, j: 0, r: 0 }, { t: 'cake_stand', i: 8, j: 0, r: 0 },
    // 左牆（L）：麵包層架面向右下
    { t: 'bread_shelf', i: 0, j: 3, r: 1 },
    // 櫃台列
    { t: 'bakery_counter', i: 2, j: 2, r: 0 }, { t: 'bread_basket', i: 5, j: 2, r: 0 }, { t: 'cake_stand', i: 6, j: 2, r: 0 },
    // 座位區
    { t: 'bakery_table', i: 6, j: 5, r: 0 }, { t: 'bakery_chair', i: 5, j: 5, r: 1 }, { t: 'bakery_chair', i: 7, j: 5, r: 3 },
    { t: 'bakery_table', i: 2, j: 6, r: 0 }, { t: 'bakery_chair', i: 2, j: 5, r: 0 },
    { t: 'bread_basket', i: 0, j: 7, r: 0 }, { t: 'bread_basket', i: 8, j: 7, r: 0 },
  ];
  room.walls = [
    { t: 'wheat_deco', side: 'R', u: 6 }, { t: 'bread_sign_wall', side: 'R', u: 7 },
    { t: 'bread_sign_wall', side: 'L', u: 1 }, { t: 'wheat_deco', side: 'L', u: 6 },
  ];
  place(room);
  const chair = (i, j) => room.items.find(x => x.t === 'bakery_chair' && x.i === i && x.j === j);
  const chars = [
    sit(chair(5, 5), { hair: 'long', hairC: 4, shirt: 2, pants: 0, shoes: 1 }),
    { i: 3.5, j: 1.5, facing: 'SW', step: 0, look: { hair: 'bun', hairC: 2, shirt: 4, pants: 1, apron: [240, 150, 120] } }, // 店員
    { i: 3.5, j: 4.5, facing: 'NE', step: 0, look: { hair: 'short', hairC: 1, skin: 3, shirt: 3, pants: 2 } },             // 客人
  ];
  fs.writeFileSync(path.join(outDir, 'art_shops_demo_bakery.png'), toPNG(S.renderFull(room, chars), 2));
}

// ---- 示範超市 ----
{
  const room = S.newRoom(); room.wall = W0 + 1; room.floor = F0 + 1;
  room.items = [
    // 後牆（R）：冷藏櫃 ×2、臥式冰櫃、購物籃
    { t: 'fridge_case', i: 0, j: 0, r: 0 }, { t: 'fridge_case', i: 2, j: 0, r: 0 }, { t: 'freezer_chest', i: 4, j: 0, r: 0 },
    { t: 'basket_stack', i: 8, j: 0, r: 0 }, { t: 'cart', i: 7, j: 0, r: 1 },
    // 左牆（L）：蔬果攤
    { t: 'produce_stand', i: 0, j: 3, r: 1 }, { t: 'produce_stand', i: 0, j: 5, r: 1 },
    // 中間貨架
    { t: 'market_shelf', i: 2, j: 3, r: 0 }, { t: 'market_shelf', i: 4, j: 3, r: 0 }, { t: 'market_shelf', i: 2, j: 5, r: 0 },
    // 收銀
    { t: 'checkout_counter', i: 6, j: 5, r: 0 }, { t: 'cart', i: 5, j: 7, r: 0 }, { t: 'basket_stack', i: 8, j: 7, r: 0 },
    { t: 'parcel', i: 8, j: 5, r: 0 }, { t: 'delivery_spot', i: 3, j: 7, r: 0 },
  ];
  room.walls = [
    { t: 'sale_banner', side: 'R', u: 4 }, { t: 'market_clock', side: 'R', u: 7 },
    { t: 'sale_banner', side: 'L', u: 0 }, { t: 'market_clock', side: 'L', u: 7 },
  ];
  place(room);
  const chars = [
    { i: 7, j: 4.5, facing: 'SW', step: 0, look: { hair: 'spiky', hairC: 6, shirt: 3, pants: 1, apron: [96, 184, 128] } }, // 店員
    { i: 6.5, j: 6.5, facing: 'NE', step: 0, look: { hair: 'long', hairC: 0, shirt: 6, pants: 3, shoes: 2 } },             // 客人（結帳）
    { i: 3.5, j: 4.5, facing: 'NE', step: 1, look: { hair: 'short', hairC: 2, skin: 2, shirt: 1, pants: 0 } },             // 客人（逛貨架）
  ];
  fs.writeFileSync(path.join(outDir, 'art_shops_demo_market.png'), toPNG(S.renderFull(room, chars), 2));
}

// ---- 圖示 4 倍放大 ----
{
  const names = Object.keys(A.ICONS), cols = 7, cell = 40;
  const pix = new Pix(cols * cell, Math.ceil(names.length / cols) * cell);
  pix.rect(0, 0, pix.w - 1, pix.h - 1, [250, 236, 214]);
  names.forEach((n, k) => {
    const x = (k % cols) * cell + 4, y = Math.floor(k / cols) * cell + 4;
    pix.rect(x - 1, y - 1, x + 32, y + 32, [255, 246, 230]);
    A.ICONS[n](pix, x, y);
  });
  fs.writeFileSync(path.join(outDir, 'art_shops_icons.png'), toPNG(pix, 4));
  console.log('icons', names.length, names.join(' '));
}
console.log('done');
