// PixelNook 城市：分區地圖（中央廣場、商業街）、室內（咖啡廳）、攝影機、區域切換、門。
// 跟房間共用繪圖核心（raster.js）、角色模型（models.js）、房間背景（scene.js）。
(function (G) {
  'use strict';
  const { Pix, Iso, depthSort, TW, TH, shade } = G.PX;
  const M = G.MODELS, S = G.SCENE, I = M.ITEMS;
  const VW = 800, VH = 480;
  const p = (f, s, wf, ws, h, z, c, b, hi) => ({ f, s, wf, ws, h, z, c, b, hi: hi !== false });

  // ---------------- 美術（美術助手交件前的替代品；交件後由 G.ART 覆蓋） ----------------
  const PH = {};
  function bld(id, name, W, D, h, col, roof) {
    PH[id] = { id, name, W, D, kind: 'floor', hidden: true, door: { f: D / 2 + 0.3, s: 0 },
      model: () => [p(0, 0, D, W, h, 0, col), p(0, 0, D + 0.12, W + 0.12, 10, h, roof), p(D / 2 + 0.02, 0, 0.04, 0.8, 84, 0, [120, 84, 60], null, false)] };
  }
  bld('cafe_building', '咖啡廳', 5, 4, 140, [236, 214, 180], [150, 90, 70]);
  bld('bakery_building', '麵包店', 4, 4, 130, [250, 226, 170], [200, 120, 80]);
  bld('market_building', '超市', 6, 4, 130, [220, 236, 246], [90, 150, 210]);
  bld('apartment_building', '公寓', 5, 4, 180, [214, 200, 230], [120, 100, 150]);
  bld('house_player', '我的家', 3, 3, 110, [250, 240, 220], [200, 96, 80]);
  const small = (id, name, W, D, parts) => { PH[id] = { id, name, W, D, kind: 'floor', hidden: true, model: () => parts }; };
  small('street_lamp', '路燈', 1, 1, [p(0, 0, 0.1, 0.1, 80, 0, [60, 64, 80], null, false), p(0, 0, 0.26, 0.26, 12, 80, [255, 236, 150])]);
  small('bench', '長椅', 1, 1, [p(0, 0, 0.5, 0.9, 14, 0, [180, 120, 80])]);
  small('tree_round', '圓樹', 1, 1, [p(0, 0, 0.14, 0.14, 26, 0, [140, 94, 62], null, false), p(0, 0, 0.8, 0.8, 40, 26, [96, 168, 92])]);
  small('tree_pine', '松樹', 1, 1, [p(0, 0, 0.14, 0.14, 20, 0, [140, 94, 62], null, false), p(0, 0, 0.8, 0.8, 24, 20, [80, 150, 90]), p(0, 0, 0.5, 0.5, 24, 44, [80, 150, 90])]);
  small('bush', '灌木', 1, 1, [p(0, 0, 0.7, 0.7, 18, 0, [100, 170, 96])]);
  small('flower_bed', '花圃', 1, 1, [p(0, 0, 0.9, 0.9, 8, 0, [180, 120, 80]), p(0, 0, 0.8, 0.8, 4, 8, [240, 140, 170])]);
  small('fountain', '噴水池', 3, 3, [p(0, 0, 2.8, 2.8, 14, 0, [200, 204, 214]), p(0, 0, 0.5, 0.5, 30, 14, [200, 204, 214])]);
  small('bulletin_board', '公告欄', 1, 1, [p(0, -0.3, 0.1, 0.1, 50, 0, [140, 94, 62], null, false), p(0, 0.3, 0.1, 0.1, 50, 0, [140, 94, 62], null, false), p(0, 0, 0.12, 0.9, 34, 50, [214, 166, 112])]);
  small('trash_bin', '垃圾桶', 1, 1, [p(0, 0, 0.4, 0.4, 24, 0, [110, 150, 120])]);
  small('mailbox', '郵筒', 1, 1, [p(0, 0, 0.4, 0.4, 40, 0, [220, 90, 80])]);
  small('fence_i', '施工圍欄', 1, 1, [p(0, 0, 0.12, 1, 30, 0, [250, 180, 60], [[10, 18, [60, 60, 70]]])]);
  small('fence_j', '施工圍欄', 1, 1, [p(0, 0, 0.12, 1, 30, 0, [250, 180, 60], [[10, 18, [60, 60, 70]]])]);
  small('sign_arrow', '路標', 1, 1, [p(0, 0, 0.08, 0.08, 50, 0, [120, 120, 130], null, false), p(0, 0, 0.1, 0.7, 16, 50, [90, 150, 210])]);

  const TILEC = { grass: [140, 196, 110], road_i: [96, 100, 112], road_j: [96, 100, 112], sidewalk: [214, 206, 192], crosswalk_i: [96, 100, 112], crosswalk_j: [96, 100, 112], plaza: [226, 214, 190], dirt: [196, 160, 110], water: [120, 190, 230] };
  const PH_TILES = {};
  for (const k in TILEC) PH_TILES[k] = (iso, i, j) => iso.flat(i, j, 1, 1, TILEC[k], 0, shade(TILEC[k], 0.92));

  // 把美術（替代品或正式版）註冊進 MODELS.ITEMS（hidden：不會出現在商店）
  function art() { return (G.ART && G.ART.city) || {}; }
  function cafeArt() { return (G.ART && G.ART.cafe) || {}; }
  function registerArt() {
    for (const k in PH) if (!I[k]) I[k] = PH[k];
    const a = art(), c = cafeArt();
    for (const src of [a.OBJS, c.OBJS]) if (src) for (const k in src) I[k] = Object.assign({}, src[k], { hidden: true, kind: src[k].kind || 'floor' });
    if (c.WALLDECO) for (const k in c.WALLDECO) I[k] = Object.assign({}, c.WALLDECO[k], { hidden: true, kind: 'wall' });
    // 咖啡廳壁紙／地板接在房間清單後面（玩家也能用）
    if (c.WALLS && !M.WALLS.some(w => w.cafe)) for (const w of c.WALLS) M.WALLS.push(Object.assign({ cafe: 1 }, w));
    if (c.FLOORS && !M.FLOORS.some(w => w.cafe)) for (const w of c.FLOORS) M.FLOORS.push(Object.assign({ cafe: 1 }, w));
  }
  const tileFn = name => (art().TILES && art().TILES[name]) || PH_TILES[name] || PH_TILES.grass;
  const hasObj = id => !!I[id];

  // ---------------- 地圖資料 ----------------
  function grid(ni, nj, fill) { const g = []; for (let i = 0; i < ni; i++) { g.push(new Array(nj).fill(fill)); } return g; }
  function rect(g, i0, j0, i1, j1, v) { for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (g[i] && j >= 0 && j < g[i].length) g[i][j] = v; }
  function fp(t, r) { return M.footprint(I[t], r || 0); }

  // 中央廣場：玩家的家在左後方、噴水池在中間、往右下接商業街、往左下是整理中的公園
  function buildCentral() {
    const NI_ = 24, NJ_ = 18, T = grid(NI_, NJ_, 'grass'), O = [];
    rect(T, 6, 3, 17, 13, 'plaza');
    rect(T, 18, 8, 23, 8, 'road_i_a'); rect(T, 18, 9, 23, 9, 'road_i_b');   // 往商業街
    rect(T, 18, 7, 23, 7, 'sidewalk'); rect(T, 18, 10, 23, 10, 'sidewalk');
    rect(T, 11, 14, 12, 17, 'dirt');            // 往公園（整理中）
    rect(T, 3, 6, 5, 9, 'dirt');                // 家門口的小徑
    const [hw, hj] = fp('house_player', 1);
    O.push({ t: 'house_player', i: 0, j: 6, r: 1, home: true });
    const [fw, fh] = fp('fountain', 0);
    O.push({ t: 'fountain', i: 12 - Math.floor(fw / 2), j: 8 - Math.floor(fh / 2), r: 0 });
    O.push({ t: 'bulletin_board', i: 8, j: 4, r: 0, talk: '公告欄：歡迎來到小鎮！咖啡廳正在招募店員，往右下的商業街走就到了。' });
    for (const [i, j, r] of [[9, 7, 1], [9, 10, 1], [16, 6, 3], [16, 11, 3]]) O.push({ t: 'bench', i, j, r });
    for (const [i, j] of [[6, 3], [17, 3], [6, 13], [17, 13]]) O.push({ t: 'street_lamp', i, j, r: 0 });
    for (const [i, j, t] of [[4, 2, 'tree_round'], [2, 12, 'tree_pine'], [8, 15, 'tree_round'], [15, 16, 'tree_pine'], [20, 3, 'tree_round'], [21, 14, 'tree_round'], [1, 2, 'tree_pine'], [19, 16, 'bush'], [5, 15, 'bush'], [14, 1, 'flower_bed'], [10, 1, 'flower_bed'], [22, 5, 'bush']]) O.push({ t, i, j, r: 0 });
    O.push({ t: 'fence_i', i: 11, j: 16, r: 1, talk: '公園正在整理中，過陣子就會開放囉！' }, { t: 'fence_i', i: 12, j: 16, r: 1, talk: '公園正在整理中，過陣子就會開放囉！' });
    O.push({ t: 'sign_arrow', i: 18, j: 6, r: 0, talk: '路標：→ 商業街（咖啡廳、麵包店、超市）' });
    O.push({ t: 'mailbox', i: 4, j: 10, r: 1 });
    return { id: 'central', name: '中央廣場', ni: NI_, nj: NJ_, tiles: T, objs: O,
      exits: [{ cells: [[23, 8], [23, 9]], to: 'commercial', spawn: [1, 9], facing: 'SE' }],
      spawns: { house: null } };
  }
  // 商業街：建築在後排、面向人行道；中間是馬路；對面是樹和長椅
  function buildCommercial() {
    const NI_ = 24, NJ_ = 18, T = grid(NI_, NJ_, 'grass'), O = [];
    rect(T, 0, 9, 23, 9, 'road_i_a'); rect(T, 0, 10, 23, 10, 'road_i_b'); rect(T, 0, 7, 23, 8, 'sidewalk'); rect(T, 0, 11, 23, 12, 'sidewalk');
    rect(T, 7, 9, 7, 10, 'crosswalk_i');
    let i = 2;
    for (const [t, open] of [['cafe_building', 'cafe'], ['bakery_building', null], ['market_building', null]]) {
      const [w, d] = fp(t, 0);
      O.push({ t, i, j: 7 - d, r: 0, enter: open, closed: open ? null : I[t].name + '還在準備中，之後開放！' });
      i += w + 1;
    }
    for (const [x, j] of [[1, 6], [i, 6], [8, 13], [16, 13]]) if (x < NI_) O.push({ t: 'street_lamp', i: x, j, r: 0 });
    for (const [x, j, t] of [[3, 14, 'tree_round'], [6, 15, 'bench'], [10, 14, 'tree_round'], [12, 15, 'flower_bed'], [14, 14, 'tree_pine'], [18, 14, 'tree_round'], [20, 15, 'bench'], [22, 13, 'bush'], [1, 16, 'bush'], [23, 3, 'tree_round'], [22, 1, 'tree_pine']]) O.push({ t, i: x, j, r: t === 'bench' ? 2 : 0 });
    O.push({ t: 'trash_bin', i: 9, j: 13, r: 0 });
    O.push({ t: 'sign_arrow', i: 1, j: 12, r: 3, talk: '路標：← 中央廣場' });
    return { id: 'commercial', name: '商業街', ni: NI_, nj: NJ_, tiles: T, objs: O,
      exits: [{ cells: [[0, 9], [0, 10]], to: 'central', spawn: [22, 9], facing: 'NW' }] };
  }
  // 咖啡廳室內（房間系統畫，門在右牆）
  function buildCafe() {
    const c = cafeArt(), has = id => hasObj(id) && !PH[id];
    const room = S.newRoom();
    const wi = M.WALLS.findIndex(w => w.cafe), fi = M.FLOORS.findIndex(w => w.cafe);
    room.wall = wi >= 0 ? wi : 1; room.floor = fi >= 0 ? (M.FLOORS.findIndex((w, k) => w.cafe && k > fi) > 0 ? M.FLOORS.findIndex((w, k) => w.cafe && k > fi) : fi) : 1;
    room.door = { side: 'R', u: 1, color: [120, 80, 56] };
    const items = [];
    const put = (t, i, j, r) => { if (!I[t]) return; const it = { t, i, j, r }; if (S.canPlace(room, it)) { room.items.push(it); items.push(it); } };
    if (has('cafe_counter')) {
      put('cafe_counter', 3, 2, 0); put('espresso_machine', 6, 0, 0); put('cup_shelf', 3, 0, 0); put('register', 2, 2, 0);
      put('pastry_case', 7, 3, 3); put('menu_stand', 0, 4, 1); put('plant_cafe', 8, 0, 0);
      for (const [i, j] of [[2, 5], [5, 5], [6, 7], [1, 7]]) { put('cafe_table', i, j, 0); put('cafe_chair', i + 1, j, 3); put('cafe_chair', i - 1, j, 1); }
    } else {
      put('desk_wood', 3, 2, 0); put('shelf_wood', 3, 0, 0); put('plant_b', 8, 0, 0); put('fridge_modern', 6, 0, 0);
      for (const [i, j] of [[2, 5], [6, 6]]) { put('table_wood', i, j, 0); put('chair_wood', i + 1, j, 3); put('chair_wood', i - 1, j, 1); }
    }
    if (c.WALLDECO) { if (I.menu_board) room.walls.push({ t: 'menu_board', side: 'L', u: 2 }); if (I.cafe_sign_wall) room.walls.push({ t: 'cafe_sign_wall', side: 'R', u: 4 }); }
    else room.walls.push({ t: 'win_blind', side: 'L', u: 3 });
    // Mia 站在櫃台後面（櫃台後一排），玩家從櫃台前面跟她說話
    // Mia 站在櫃台右端、咖啡機前面（前方沒有東西擋住），玩家站在她前面一格說話
    const counter = room.items.find(o => o.t === 'cafe_counter' || o.t === 'desk_wood');
    const cw = counter ? M.footprint(I[counter.t], counter.r)[0] : 2;
    const mi = counter ? counter.i + cw : 5, mj = counter ? counter.j - 1 : 1;
    const npcs = [{ id: 'mia', i: mi + 0.5, j: mj + 0.5, facing: 'SW', talkFrom: [[mi, mj + 1], [mi + 1, mj + 1], [mi, mj + 2]] }];
    return { id: 'cafe', name: '咖啡廳', interior: true, room, npcs, ni: S.NI, nj: S.NJ, back: { to: 'commercial', obj: 'cafe_building' } };
  }

  // ---------------- NPC ----------------
  const NPCS = {
    mia: { id: 'mia', name: 'Mia', role: '咖啡廳老闆', job: 'cafe',
      look: { skin: 0, hair: 'bun', hairC: 4, shirt: 4, pants: 1, shoes: 4, apron: [126, 86, 60] } },
  };
  // ---------------- 場景物件 ----------------
  const BUILDERS = { central: buildCentral, commercial: buildCommercial, cafe: buildCafe };
  function makeScene(id) {
    registerArt();
    const a = BUILDERS[id]();
    if (a.interior) {
      Object.assign(a, { ox: S.OX, oy: S.OY, ww: VW, wh: VH, fixed: true });
      a.blocked = S.blockedGrid(a.room);
      for (const n of a.npcs || []) a.blocked[Math.floor(n.i)][Math.floor(n.j)] = true;
      a.items = a.room.items;
      return a;
    }
    // 世界大小：等角菱形＋上方留給建築的高度
    a.top = 240; a.ox = a.nj * TW / 2 + 20; a.oy = a.top;
    a.ww = (a.ni + a.nj) * TW / 2 + 40; a.wh = (a.ni + a.nj) * TH / 2 + a.top + 30;
    a.items = a.objs.filter(o => I[o.t]);
    // 擋路：物件佔的格子、水
    a.blocked = grid(a.ni, a.nj, false);
    for (let i = 0; i < a.ni; i++) for (let j = 0; j < a.nj; j++) if (a.tiles[i][j] === 'water') a.blocked[i][j] = true;
    for (const o of a.items) { const [w, d] = fp(o.t, o.r); for (let x = 0; x < w; x++) for (let y = 0; y < d; y++) if (a.blocked[o.i + x]) a.blocked[o.i + x][o.j + y] = true; }
    return a;
  }
  function drawSceneBG(sc) {
    const pix = new Pix(sc.ww, sc.wh);
    if (sc.interior) { S.drawBG(pix, sc.room); return pix; }
    pix.rect(0, 0, sc.ww - 1, sc.wh - 1, [126, 182, 100]);
    const iso = new Iso(pix, sc.ox, sc.oy);
    for (let s = 0; s < sc.ni + sc.nj - 1; s++) for (let i = 0; i < sc.ni; i++) { const j = s - i; if (j >= 0 && j < sc.nj) tileFn(sc.tiles[i][j])(iso, i, j); }
    // 地圖邊緣的厚度
    const P = (i, j) => iso.P(i, j), A = P(0, sc.nj), B = P(sc.ni, sc.nj), C = P(sc.ni, 0);
    pix.poly([A, B, [B[0], B[1] + 10], [A[0], A[1] + 10]], [110, 150, 90], G.PX.OUT);
    pix.poly([C, B, [B[0], B[1] + 10], [C[0], C[1] + 10]], [96, 132, 80], G.PX.OUT);
    // 出口提示：地上的箭頭格
    for (const ex of sc.exits || []) for (const [i, j] of ex.cells) iso.flat(i + 0.25, j + 0.25, 0.5, 0.5, [255, 236, 120], 0, [200, 160, 60]);
    return pix;
  }
  function doorCellOf(o) {
    const d = I[o.t]; if (!d || !d.door) return null;
    const [fi, fj] = M.ROT[o.r & 3], si = fj, sj = -fi, [w, dd] = fp(o.t, o.r);
    return [Math.floor(o.i + w / 2 + fi * d.door.f + si * d.door.s), Math.floor(o.j + dd / 2 + fj * d.door.f + sj * d.door.s)];
  }
  function bfs(blocked, ni, nj, from, to) {
    if (to[0] < 0 || to[1] < 0 || to[0] >= ni || to[1] >= nj || blocked[to[0]][to[1]]) return null;
    const key = (i, j) => i * 1000 + j, prev = new Map([[key(from[0], from[1]), null]]), q = [from];
    for (let h = 0; h < q.length; h++) {
      const [i, j] = q[h]; if (i === to[0] && j === to[1]) break;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj, k = key(a, b);
        if (a < 0 || b < 0 || a >= ni || b >= nj || blocked[a][b] || prev.has(k)) continue;
        prev.set(k, [i, j]); q.push([a, b]);
      }
    }
    if (!prev.has(key(to[0], to[1]))) return null;
    const out = []; let c = to; while (c) { out.push(c); c = prev.get(key(c[0], c[1])); } return out.reverse();
  }

  G.WORLD = { makeScene, drawSceneBG, doorCellOf, bfs, registerArt, PH, NPCS };
})(typeof window !== 'undefined' ? window : globalThis);
