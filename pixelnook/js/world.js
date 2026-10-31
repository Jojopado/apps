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

  small('pond_rock', '大石頭', 1, 1, [p(0, 0, 0.6, 0.6, 14, 0, [150, 150, 160])]);
  small('reeds', '蘆葦', 1, 1, [p(0, 0, 0.5, 0.5, 26, 0, [120, 160, 90])]);
  small('lily_pad', '荷葉', 1, 1, [p(0, 0, 0.6, 0.6, 2, 0, [90, 170, 90])]);
  small('picnic_table', '野餐桌', 2, 1, [p(0, 0, 0.8, 1.8, 20, 0, [180, 130, 90])]);
  small('gazebo', '涼亭', 3, 3, [p(0, 0, 2.8, 2.8, 6, 0, [210, 190, 160]), p(0, 0, 2.9, 2.9, 12, 70, [180, 90, 70])]);
  small('park_sign', '公園木牌', 1, 1, [p(0, 0, 0.1, 0.8, 40, 0, [160, 110, 70])]);
  small('herb_bush', '香草叢', 1, 1, [p(0, 0, 0.6, 0.6, 14, 0, [110, 170, 100])]);
  small('mushroom_log', '倒木', 2, 1, [p(0, 0, 0.5, 1.8, 14, 0, [150, 100, 70])]);
  small('tree_big', '大樹', 2, 2, [p(0, 0, 0.3, 0.3, 30, 0, [140, 94, 62]), p(0, 0, 1.8, 1.8, 50, 30, [90, 160, 90])]);
  small('trash_can_park', '公園垃圾桶', 1, 1, [p(0, 0, 0.4, 0.4, 26, 0, [100, 140, 110])]);
  small('hedge_i', '樹籬', 1, 1, [p(0, 0, 0.9, 0.9, 16, 0, [90, 150, 90])]);
  for (const [k, c] of [['red', [230, 90, 90]], ['yellow', [250, 210, 90]], ['blue', [110, 150, 230]]])
    PH['flower_patch_' + k] = { id: 'flower_patch_' + k, name: '花叢', W: 1, D: 1, kind: 'floor', hidden: true, model: on => on ? [p(0, 0, 0.6, 0.6, 6, 0, [100, 160, 90])] : [p(0, 0, 0.6, 0.6, 6, 0, [100, 160, 90]), p(0, 0, 0.4, 0.4, 5, 6, c)] };
  for (const [k, c] of [['trash_bag', [60, 64, 80]], ['trash_bottle', [140, 200, 220]], ['trash_paper', [240, 240, 236]]])
    PH[k] = { id: k, name: '垃圾', W: 1, D: 1, kind: 'floor', hidden: true, model: () => [p(0, 0, 0.3, 0.3, k === 'trash_paper' ? 2 : 8, 0, c)] };
  PH.sparkle = { id: 'sparkle', name: '閃光物品', W: 1, D: 1, kind: 'floor', hidden: true, model: on => [p(0, 0, 0.12, 0.12, on ? 10 : 6, 0, [255, 240, 140], null, false)] };
  const TILEC = { grass: [140, 196, 110], road_i: [96, 100, 112], road_j: [96, 100, 112], sidewalk: [214, 206, 192], crosswalk_i: [96, 100, 112], crosswalk_j: [96, 100, 112], plaza: [226, 214, 190], dirt: [196, 160, 110], water: [120, 190, 230] };
  const PH_TILES = {};
  for (const k in TILEC) PH_TILES[k] = (iso, i, j) => iso.flat(i, j, 1, 1, TILEC[k], 0, shade(TILEC[k], 0.92));

  // 把美術（替代品或正式版）註冊進 MODELS.ITEMS（hidden：不會出現在商店）
  function art() { return (G.ART && G.ART.city) || {}; }
  function cafeArt() { return (G.ART && G.ART.cafe) || {}; }
  function registerArt() {
    for (const k in PH) if (!I[k]) I[k] = PH[k];
    const a = art(), c = cafeArt(), pk = (G.ART && G.ART.park) || {};
    for (const src of [a.OBJS, c.OBJS, pk.OBJS]) if (src) for (const k in src) I[k] = Object.assign({}, src[k], { hidden: true, kind: src[k].kind || 'floor' });
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
    O.push({ t: 'bulletin_board', i: 8, j: 4, r: 0, search: 'bulletin_board', talk: '公告欄：歡迎來到小鎮！咖啡廳正在招募店員，往右下的商業街走就到了。' });
    for (const [i, j, r] of [[9, 7, 1], [9, 10, 1], [16, 6, 3], [16, 11, 3]]) O.push({ t: 'bench', i, j, r });
    for (const [i, j] of [[6, 3], [17, 3], [6, 13], [17, 13]]) O.push({ t: 'street_lamp', i, j, r: 0 });
    for (const [i, j, t] of [[4, 2, 'tree_round'], [2, 12, 'tree_pine'], [8, 15, 'tree_round'], [15, 16, 'tree_pine'], [20, 3, 'tree_round'], [21, 14, 'tree_round'], [1, 2, 'tree_pine'], [19, 16, 'bush'], [5, 15, 'bush'], [14, 1, 'flower_bed'], [10, 1, 'flower_bed'], [22, 5, 'bush']]) O.push({ t, i, j, r: 0 });
    O.push({ t: 'sign_arrow', i: 13, j: 15, r: 0, talk: '路標：↙ 城市公園（池塘、花圃、涼亭）' });
    O.push({ t: 'sign_arrow', i: 18, j: 6, r: 0, talk: '路標：→ 商業街（咖啡廳、麵包店、超市）' });
    O.push({ t: 'mailbox', i: 4, j: 10, r: 1, search: 'mailbox' });
    for (const o of O) { if (o.t === 'fountain') o.search = 'fountain'; if (o.t === 'bench') o.search = 'bench'; if (o.t === 'tree_round') o.search = 'tree_round'; }
    return { id: 'central', name: '中央廣場', ni: NI_, nj: NJ_, tiles: T, objs: O,
      exits: [{ cells: [[23, 8], [23, 9]], to: 'commercial', spawn: [1, 9], facing: 'SE' }, { cells: [[11, 17], [12, 17]], to: 'park', spawn: [11, 1], facing: 'SW' }],
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
  // 城市公園：池塘、涼亭、花叢（可採集）、步道；Oliver 在入口附近
  function buildPark() {
    const NI_ = 24, NJ_ = 18, T = grid(NI_, NJ_, 'grass'), O = [];
    rect(T, 11, 0, 12, 6, 'dirt'); rect(T, 5, 6, 20, 7, 'dirt'); rect(T, 18, 7, 19, 15, 'dirt'); rect(T, 8, 14, 18, 15, 'dirt'); rect(T, 5, 7, 6, 12, 'dirt');
    rect(T, 8, 9, 13, 12, 'water');                       // 池塘
    const put = (t, i, j, r, extra) => { if (!I[t]) return; const [w, d] = fp(t, r || 0); for (let x = 0; x < w; x++) for (let y = 0; y < d; y++) if (!T[i + x] || T[i + x][j + y] === undefined) return; O.push(Object.assign({ t, i, j, r: r || 0 }, extra || {})); };
    put('park_sign', 13, 1, 0, { talk: '城市公園：請愛護花草，垃圾請丟垃圾桶。' });
    put('gazebo', 14, 9, 0, { search: 'gazebo' });
    put('picnic_table', 20, 3, 0, { search: 'picnic_table' }); put('picnic_table', 2, 14, 1, { search: 'picnic_table' });
    for (const [i, j] of [[7, 9], [14, 13], [7, 13]]) put('pond_rock', i, j, 0, { search: 'pond_rock' });
    for (const [i, j] of [[9, 13], [12, 8], [13, 13], [8, 8]]) put('reeds', i, j, 0);
    let fk = 0;
    for (const [i, j] of [[3, 3], [8, 3], [15, 3], [21, 9], [22, 12], [3, 9], [14, 16], [6, 16], [16, 1], [1, 6]]) { const c = ['red', 'yellow', 'blue'][fk++ % 3]; put('flower_patch_' + c, i, j, 0, { harvest: 'flower_patch_' + c }); }
    for (const [i, j] of [[2, 4], [21, 15], [10, 16]]) put('herb_bush', i, j, 0, { harvest: 'herb_bush' });
    put('mushroom_log', 1, 11, 1, { harvest: 'mushroom_log' });
    for (const [i, j] of [[3, 0], [20, 0], [22, 6], [0, 15], [16, 16]]) put('tree_big', i, j, 0, { harvest: 'tree_big' });
    for (const [i, j] of [[7, 1], [9, 4], [17, 12], [4, 13]]) put('tree_round', i, j, 0, { search: 'tree_round' });
    for (const [i, j] of [[10, 5], [16, 5]]) put('bench', i, j, 2, { search: 'bench' });
    for (const [i, j] of [[10, 2], [17, 8], [7, 15]]) put('street_lamp', i, j, 0);
    for (const [i, j] of [[13, 5], [17, 14]]) put('trash_can_park', i, j, 0);
    for (const [i, j] of [[0, 0], [1, 0], [23, 17], [22, 17]]) put('hedge_i', i, j, 0);
    for (const [i, j] of [[10, 10], [11, 11], [9, 11]]) if (T[i][j] === 'water') O.push({ t: 'lily_pad', i, j, r: 0, deco: true });
    return { id: 'park', name: '城市公園', ni: NI_, nj: NJ_, tiles: T, objs: O, outdoor: true,
      npcs: [{ id: 'oliver', i: 14.5, j: 4.5, facing: 'SW', talkFrom: [[14, 5], [13, 4], [15, 4]] }],
      exits: [{ cells: [[11, 0], [12, 0]], to: 'central', spawn: [11, 16], facing: 'NE' }] };
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
    oliver: { id: 'oliver', name: 'Oliver', role: '公園管理員', job: 'park',
      look: { skin: 2, hair: 'short', hairC: 1, shirt: 3, pants: 2, shoes: 4, hat: [96, 140, 84] } },
    mia: { id: 'mia', name: 'Mia', role: '咖啡廳老闆', job: 'cafe',
      look: { skin: 0, hair: 'bun', hairC: 4, shirt: 4, pants: 1, shoes: 4, apron: [126, 86, 60] } },
  };
  // ---------------- 場景物件 ----------------
  const BUILDERS = { central: buildCentral, commercial: buildCommercial, park: buildPark, cafe: buildCafe };
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
    for (const n of a.npcs || []) a.blocked[Math.floor(n.i)][Math.floor(n.j)] = true;
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
