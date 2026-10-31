// PixelNook 遊戲本體
(function () {
  'use strict';
  const { Pix, Iso, depthSort, TW, TH } = PX;
  const M = MODELS, S = SCENE, I = M.ITEMS;
  const { NI, NJ, WALL, SW, SH, OX, OY } = S;
  const $ = q => document.querySelector(q), $$ = q => Array.from(document.querySelectorAll(q));
  const cv = $('#cv'), ctx = cv.getContext('2d');
  const KEY = 'pixelnook.v1';
  const dayNum = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  const rand = n => { const a = 'abcdefghijkmnpqrstuvwxyz23456789', r = crypto.getRandomValues(new Uint8Array(n)); return Array.from(r, x => a[x % a.length]).join(''); };
  const clone = o => JSON.parse(JSON.stringify(o));
  const BAD = ['幹', '靠北', '白癡', '智障', '操你', 'fuck', 'shit', '屎', '屌', '雞掰', '機掰'];

  // ---------------- 存檔 ----------------
  const HOME_DOOR = { side: 'R', u: 7 };
  function starterRoom() {
    const r = S.newRoom(); r.door = Object.assign({}, HOME_DOOR);
    r.items = [
      { t: 'bed_wood', i: 0, j: 0, r: 1 }, { t: 'rug_wood', i: 3, j: 3, r: 0 },
      { t: 'table_wood', i: 6, j: 4, r: 0 }, { t: 'chair_wood', i: 7, j: 4, r: 3 },
      { t: 'plant_s', i: 8, j: 0, r: 0 }, { t: 'lamp_wood', i: 0, j: 7, r: 0, on: true },
    ];
    r.walls = [{ t: 'win_wood', side: 'R', u: 4 }, { t: 'clock', side: 'L', u: 3 }];
    return r;
  }
  function newState() {
    return { v: 1, id: rand(14), pw: rand(28), name: '', look: Object.assign({}, M.DEFAULT_LOOK), coins: 300, bag: {}, room: starterRoom(),
      lastDay: 0, likesSeen: 0, likeLog: { d: 0, n: 0, ids: [] }, published: false };
  }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.id && s.pw) { const n = Object.assign(newState(), s); if (!n.room || !Array.isArray(n.room.items)) n.room = starterRoom(); return n; } } catch (e) {}
    return newState();
  }
  let st = load();
  st.room.door = Object.assign({}, HOME_DOOR);
  let saveT = 0;
  function save(cloudToo) {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
    if (cloudToo !== false) scheduleCloud();
  }
  let cloudT = 0, cloudBusy = false, cloudPending = false;
  function scheduleCloud() { clearTimeout(cloudT); cloudT = setTimeout(pushCloud, 1800); }
  async function pushCloud() {
    if (!st.name) return;
    if (cloudBusy) { cloudPending = true; return; }
    cloudBusy = true;
    try {
      await Cloud.save(st.id, st.pw, st.name, S.comfortOf(st.room).total, { v: 1, name: st.name, look: st.look, room: st.room });
      st.published = true; try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
    } catch (e) { setTimeout(scheduleCloud, 30000); }
    cloudBusy = false;
    if (cloudPending) { cloudPending = false; scheduleCloud(); }
  }

  // 讀別人的資料一律檢查（只收認識的家具、範圍內的數字）
  const int = (v, lo, hi, d) => (Number.isInteger(v) && v >= lo && v <= hi) ? v : d;
  function cleanLook(l) {
    l = l && typeof l === 'object' ? l : {};
    return { skin: int(l.skin, 0, M.SKINS.length - 1, 1), hair: M.HAIRS.includes(l.hair) ? l.hair : 'short', hairC: int(l.hairC, 0, M.HAIRC.length - 1, 0),
      shirt: int(l.shirt, -1, M.CLOTH.length - 1, 0), pants: int(l.pants, -1, M.PANTS.length - 1, 0), shoes: int(l.shoes, -1, M.SHOES.length - 1, 0) };
  }
  function cleanRoom(r) {
    const out = S.newRoom(); if (!r || typeof r !== 'object') return out;
    out.wall = int(r.wall, 0, M.WALLS.length - 1, 0); out.floor = int(r.floor, 0, M.FLOORS.length - 1, 0);
    for (const it of (Array.isArray(r.items) ? r.items : []).slice(0, 80)) {
      if (!it || !I[it.t] || I[it.t].kind === 'wall') continue;
      const o = { t: it.t, i: int(it.i, 0, NI - 1, -1), j: int(it.j, 0, NJ - 1, -1), r: int(it.r, 0, 3, 0) };
      if (it.on === true) o.on = true;
      if (o.i >= 0 && o.j >= 0 && S.canPlace(out, o)) out.items.push(o);
    }
    for (const w of (Array.isArray(r.walls) ? r.walls : []).slice(0, 30)) {
      if (!w || !I[w.t] || I[w.t].kind !== 'wall' || (w.side !== 'R' && w.side !== 'L')) continue;
      const o = { t: w.t, side: w.side, u: int(w.u, 0, NI, -1) };
      if (o.u >= 0 && S.canPlace(out, o)) out.walls.push(o);
    }
    return out;
  }

  // ---------------- 狀態 ----------------
  let mode = 'home';             // home | edit | visit | city
  let wsc = null;                // 目前的城市／室內場景
  const scenes = {};
  let cam = [0, 0];
  let visit = null;              // {id, name, room, look, likes}
  const me = { i: 4.5, j: 5.5, facing: 'SW', step: 0, path: [], pose: 'stand', seatZ: 0, onArrive: null, walkT: 0, stand: null };
  const guest = { i: 4.5, j: 4.5, facing: 'SW', step: 0, path: [], pose: 'stand', walkT: 0, nextT: 0 };
  let sel = null;                // 佈置模式選中的東西（房間裡的物件）
  let hold = null;               // 手上拿著要放的東西 {t, i, j, r} 或 {t, side, u}
  let drag = null;               // 拖曳中 {obj, orig, grab:[di,dj], moved}
  let editTab = 'floor';
  let dirty = true;
  const curRoom = () => mode === 'visit' && visit ? visit.room : st.room;

  // ---------------- 畫面 ----------------
  function toCanvas(pix) {
    const c = document.createElement('canvas'); c.width = pix.w; c.height = pix.h;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pix.d.buffer.slice(0)), pix.w, pix.h), 0, 0);
    return c;
  }
  function spriteOf(o, padTop, ox, oy) {
    ox = ox === undefined ? OX : ox; oy = oy === undefined ? OY : oy;
    const x0 = Math.floor(ox + (o.i0 - o.j1) * TW / 2) - 3, x1 = Math.ceil(ox + (o.i1 - o.j0) * TW / 2) + 3;
    const y0 = Math.floor(oy + (o.i0 + o.j0) * TH / 2 - o.z1) - (padTop || 4), y1 = Math.ceil(oy + (o.i1 + o.j1) * TH / 2 - o.z0) + 4;
    const pix = new Pix(Math.max(1, x1 - x0), Math.max(1, y1 - y0));
    o.draw(new Iso(pix, ox - x0, oy - y0));
    return { pix, c: toCanvas(pix), x: x0, y: y0 };
  }
  const partCache = new Map();
  function itemDrawables(it) {
    const k = [it.t, it.i, it.j, it.r, it.on ? 1 : 0].join(',');
    let v = partCache.get(k);
    if (!v) { v = M.itemParts(it).map(p => Object.assign(p, { spr: spriteOf(p) })); partCache.set(k, v); if (partCache.size > 600) partCache.delete(partCache.keys().next().value); }
    return v.map(p => Object.assign(Object.create(p), { item: it }));
  }
  let bgCache = { key: '', c: null };
  function bgCanvas(room) {
    const rugs = room.items.filter(x => I[x.t] && I[x.t].kind === 'rug');
    const key = JSON.stringify([room.wall, room.floor, room.walls, rugs, mode === 'edit']);
    if (key !== bgCache.key) { const pix = new Pix(SW, SH); S.drawBG(pix, room, { grid: mode === 'edit' }); bgCache = { key, c: toCanvas(pix) }; }
    return bgCache.c;
  }
  function charDrawable(ch, look, ox, oy) {
    const cp = M.charParts(ch.i, ch.j, ch.facing, ch.step, look, ch.pose, ch.seatZ);
    const a = cp.aabb, o = { i0: a.i0, i1: a.i1, j0: a.j0, j1: a.j1, z0: a.z0, z1: a.z1, isChar: true, draw(iso) { for (const p of cp.parts) p.draw(iso); } };
    o.spr = spriteOf(Object.assign({}, o, { z0: ch.pose === 'sit' ? 0 : a.z0 }), 16, ox, oy);
    return o;
  }
  let order = [];
  function P(i, j, z) { return [OX + (i - j) * TW / 2, OY + (i + j) * TH / 2 - (z || 0)]; }
  function polyPath(pts) { ctx.beginPath(); pts.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }
  function footPoly(it) { const [wi, wj] = M.footprint(I[it.t], it.r); return [P(it.i, it.j), P(it.i + wi, it.j), P(it.i + wi, it.j + wj), P(it.i, it.j + wj)]; }
  function wallPoly(w) { const d = I[w.t], q = w.side === 'R' ? (u, z) => P(w.u + u, 0, z) : (u, z) => P(0, w.u + u, z); return [q(0, d.z0), q(d.W, d.z0), q(d.W, d.z1), q(0, d.z1)]; }
  let ghostWall = { key: '', c: null };

  function render() {
    if (mode === 'city') return renderCity();
    const room = curRoom();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bgCanvas(room), 0, 0);
    // 選取／幽靈的地面框
    if (mode === 'edit') {
      if (sel && !drag && I[sel.t].kind !== 'wall') { polyPath(footPoly(sel)); ctx.fillStyle = 'rgba(255,214,90,.45)'; ctx.fill(); }
      const g = drag && drag.moved ? drag.obj : hold;
      if (g && I[g.t].kind !== 'wall' && g.i !== undefined) { polyPath(footPoly(g)); ctx.fillStyle = canPlaceNow(g) ? 'rgba(80,220,120,.5)' : 'rgba(240,80,80,.55)'; ctx.fill(); }
    }
    // 物件（拖曳中的那件先拿掉）
    const list = [];
    for (const it of room.items) if (I[it.t] && I[it.t].kind === 'floor' && !(drag && drag.moved && drag.orig === it)) for (const p of itemDrawables(it)) list.push(p);
    if (mode === 'visit' && visit) list.push(charDrawable(guest, visit.look)); else list.push(charDrawable(me, st.look));
    order = depthSort(list);
    for (const d of order) ctx.drawImage(d.spr.c, d.spr.x, d.spr.y);
    // 幽靈（拿著或拖著的家具）畫在最上面
    if (mode === 'edit') {
      const g = drag && drag.moved ? drag.obj : hold;
      if (g && g.i !== undefined && I[g.t].kind !== 'wall') {
        ctx.globalAlpha = 0.85;
        for (const p of depthSort(M.itemParts(g))) { const s = spriteOf(p); ctx.drawImage(s.c, s.x, s.y); }
        ctx.globalAlpha = 1;
      }
      if (g && g.side) {
        const k = JSON.stringify(g);
        if (k !== ghostWall.key) { const pix = new Pix(SW, SH); S.drawWallItem(pix, new Iso(pix, OX, OY), g); ghostWall = { key: k, c: toCanvas(pix) }; }
        ctx.globalAlpha = 0.85; ctx.drawImage(ghostWall.c, 0, 0); ctx.globalAlpha = 1;
        polyPath(wallPoly(g)); ctx.lineWidth = 2; ctx.strokeStyle = canPlaceNow(g) ? '#3fdc78' : '#f05050'; ctx.stroke();
      }
      if (sel && I[sel.t].kind === 'wall' && !drag) { polyPath(wallPoly(sel)); ctx.lineWidth = 2; ctx.strokeStyle = '#ffd65a'; ctx.stroke(); }
    }
  }
  function canPlaceNow(g) {
    const room = st.room;
    if (drag) return S.canPlace(room, g, drag.orig);
    return S.canPlace(room, g);
  }

  // ---------------- 走路 ----------------
  const cellOf = ch => [Math.floor(ch.i), Math.floor(ch.j)];
  function freeCell(room, near) {
    const g = S.blockedGrid(room); let best = null, bd = 1e9;
    for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) if (!g[i][j]) { const d = Math.abs(i - near[0]) + Math.abs(j - near[1]); if (d < bd) { bd = d; best = [i, j]; } }
    return best;
  }
  function standUp(ch) {
    if (ch.pose !== 'sit') return;
    ch.pose = 'stand';
    const c = ch.stand && !S.blockedGrid(st.room)[ch.stand[0]][ch.stand[1]] ? ch.stand : freeCell(st.room, cellOf(ch));
    if (c) { ch.i = c[0] + 0.5; ch.j = c[1] + 0.5; }
  }
  function ensureFree(ch, room) {
    if (ch.pose === 'sit') return;
    const c = cellOf(ch), g = S.blockedGrid(room);
    if (c[0] < 0 || c[1] < 0 || c[0] >= NI || c[1] >= NJ || g[c[0]][c[1]]) { const f = freeCell(room, c); if (f) { ch.i = f[0] + 0.5; ch.j = f[1] + 0.5; ch.path = []; } }
  }
  function walkTo(ch, room, cell, onArrive) {
    standUp(ch); ensureFree(ch, room);
    const path = S.findPath(room, cellOf(ch), cell);
    if (!path) return false;
    ch.path = path.slice(1); ch.onArrive = onArrive || null;
    if (!ch.path.length && onArrive) { ch.onArrive = null; onArrive(); }
    dirty = true; return true;
  }
  function stepChar(ch, dt) {
    if (!ch.path.length) { if (ch.step) { ch.step = 0; dirty = true; } return false; }
    const [ci, cj] = ch.path[0], ti = ci + 0.5, tj = cj + 0.5, di = ti - ch.i, dj = tj - ch.j, dist = Math.hypot(di, dj), sp = 2.6 * dt;
    if (Math.abs(di) > Math.abs(dj)) ch.facing = di > 0 ? 'SE' : 'NW'; else if (dist > 1e-6) ch.facing = dj > 0 ? 'SW' : 'NE';
    if (dist <= sp) { ch.i = ti; ch.j = tj; ch.path.shift(); if (!ch.path.length) { ch.step = 0; const f = ch.onArrive; ch.onArrive = null; if (f) f(); } }
    else { ch.i += di / dist * sp; ch.j += dj / dist * sp; }
    ch.walkT += dt; if (ch.path.length) ch.step = Math.floor(ch.walkT / 0.14) % 2 ? 1 : -1;
    dirty = true; return true;
  }
  function approachCells(room, it) {
    const own = new Set(S.cellsOf(it).map(c => c + '')), g = S.blockedGrid(room), out = [];
    for (const [a, b] of S.cellsOf(it)) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = [a + di, b + dj];
      if (c[0] < 0 || c[1] < 0 || c[0] >= NI || c[1] >= NJ || g[c[0]][c[1]] || own.has(c + '')) continue;
      out.push(c);
    }
    const here = cellOf(me);
    return out.sort((x, y) => (Math.abs(x[0] - here[0]) + Math.abs(x[1] - here[1])) - (Math.abs(y[0] - here[0]) + Math.abs(y[1] - here[1])));
  }
  function faceToward(ch, it) {
    const [wi, wj] = M.footprint(I[it.t], it.r), di = it.i + wi / 2 - ch.i, dj = it.j + wj / 2 - ch.j;
    ch.facing = Math.abs(di) > Math.abs(dj) ? (di > 0 ? 'SE' : 'NW') : (dj > 0 ? 'SW' : 'NE');
  }
  function interact(it) {
    const d = I[it.t], room = st.room;
    if (d.seat) {
      const spots = d.seat.spots.map((_, k) => M.seatSpot(it, k));
      spots.sort((a, b) => Math.hypot(a.i - me.i, a.j - me.j) - Math.hypot(b.i - me.i, b.j - me.j));
      for (const sp of spots) {
        const fv = M.DIRS[sp.facing], front = [Math.floor(sp.i + fv[0] * 0.8), Math.floor(sp.j + fv[1] * 0.8)];
        const cands = [front].concat(approachCells(room, it));
        for (const c of cands) {
          if (c[0] < 0 || c[1] < 0 || c[0] >= NI || c[1] >= NJ || S.blockedGrid(room)[c[0]][c[1]]) continue;
          if (walkTo(me, room, c, () => { me.pose = 'sit'; me.i = sp.i; me.j = sp.j; me.facing = sp.facing; me.seatZ = sp.z; me.stand = c; dirty = true; })) return;
        }
      }
      toast('走不過去，被擋住了'); return;
    }
    for (const c of approachCells(room, it)) {
      if (walkTo(me, room, c, () => {
        faceToward(me, it);
        if (d.toggle) { it.on = !it.on; save(); toast(d.name + (it.on ? ' 打開了' : ' 關掉了')); }
        else toast(d.name);
        dirty = true;
      })) return;
    }
    toast('走不過去，被擋住了');
  }

  // ---------------- 城市（分區地圖、室內、攝影機、出入口） ----------------
  const W_ = () => window.WORLD;
  function getScene(id) {
    if (!scenes[id]) {
      const sc = W_().makeScene(id);
      sc.bgC = toCanvas(W_().drawSceneBG(sc));
      sc.parts = [];
      for (const it of sc.items) if (I[it.t] && I[it.t].kind === 'floor') for (const pp of M.itemParts(it)) sc.parts.push(Object.assign(pp, { spr: spriteOf(pp, 4, sc.ox, sc.oy), item: it }));
      scenes[id] = sc;
    }
    return scenes[id];
  }
  function cityBlocked() { return wsc.blocked; }
  function cityPath(from, to) { return W_().bfs(cityBlocked(), wsc.ni, wsc.nj, from, to); }
  function cityFree(near) {
    const g = cityBlocked(); let best = null, bd = 1e9;
    for (let i = 0; i < wsc.ni; i++) for (let j = 0; j < wsc.nj; j++) if (!g[i][j]) { const d = Math.abs(i - near[0]) + Math.abs(j - near[1]); if (d < bd) { bd = d; best = [i, j]; } }
    return best;
  }
  function cityWalk(cell, cb) {
    if (me.pose === 'sit') { me.pose = 'stand'; const c = me.stand || cityFree(cellOf(me)); me.i = c[0] + 0.5; me.j = c[1] + 0.5; }
    const here = cellOf(me);
    if (here[0] < 0 || here[1] < 0 || here[0] >= wsc.ni || here[1] >= wsc.nj || cityBlocked()[here[0]][here[1]]) { const f = cityFree(here); me.i = f[0] + 0.5; me.j = f[1] + 0.5; }
    const path = cityPath(cellOf(me), cell);
    if (!path) return false;
    me.path = path.slice(1); me.onArrive = cb || null;
    if (!me.path.length && cb) { me.onArrive = null; cb(); }
    dirty = true; return true;
  }
  function nearCells(cells) {
    const g = cityBlocked(), out = [], own = new Set(cells.map(c => c + ''));
    for (const [a, b] of cells) for (const [di, dj] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = [a + di, b + dj];
      if (c[0] < 0 || c[1] < 0 || c[0] >= wsc.ni || c[1] >= wsc.nj || g[c[0]][c[1]] || ((di || dj) && own.has(c + ''))) continue;
      out.push(c);
    }
    const h = cellOf(me);
    return out.sort((x, y) => Math.abs(x[0] - h[0]) + Math.abs(x[1] - h[1]) - Math.abs(y[0] - h[0]) - Math.abs(y[1] - h[1]));
  }
  function walkNear(cells, cb) { for (const c of nearCells(cells)) if (cityWalk(c, cb)) return true; toast('走不過去'); return false; }
  let fading = false;
  function fadeTo(fn) {
    if (fading) return; fading = true;
    const f = $('#fade'); f.style.opacity = 1;
    setTimeout(() => { try { fn(); } finally { f.style.opacity = 0; fading = false; dirty = true; } }, 220);
  }
  function enterScene(id, cell, facing) {
    wsc = getScene(id); order = [];
    if (mode !== 'city') setMode('city');
    const c = cell && cell[0] >= 0 && cell[1] >= 0 && cell[0] < wsc.ni && cell[1] < wsc.nj && !wsc.blocked[cell[0]][cell[1]] ? cell : cityFree(cell || [Math.floor(wsc.ni / 2), Math.floor(wsc.nj / 2)]);
    me.i = c[0] + 0.5; me.j = c[1] + 0.5; me.path = []; me.pose = 'stand'; me.step = 0; me.facing = facing || 'SW'; me.onArrive = null;
    $('#place').textContent = '📍 ' + wsc.name;
    st.where = id; dirty = true;
    sfx('door'); try { SFX.music(wsc.interior ? 'cafe' : 'city'); } catch (e) {}
    emit('ENTER', { scene: id });
  }
  function goOut() {
    const central = getScene('central'), house = central.items.find(o => o.home);
    fadeTo(() => enterScene('central', house ? W_().doorCellOf(house) : null, 'SE'));
  }
  function goHome() {
    fadeTo(() => {
      wsc = null; order = []; setMode('home');
      const c = S.doorCell(st.room.door); me.i = c[0] + 0.5; me.j = c[1] + 0.5; me.facing = 'SW'; me.path = []; me.pose = 'stand';
      ensureFree(me, st.room); st.where = 'home';
      sfx('door'); try { SFX.music('home'); } catch (e) {}
      emit('HOME', {});
    });
  }
  function leaveInterior() {
    const back = wsc.back, out = getScene(back.to), b = out.items.find(o => o.t === back.obj);
    fadeTo(() => enterScene(back.to, b ? W_().doorCellOf(b) : null, 'SW'));
  }
  function cityCam() {
    if (!wsc || wsc.fixed) { cam = [0, 0]; return; }
    const sx = wsc.ox + (me.i - me.j) * TW / 2, sy = wsc.oy + (me.i + me.j) * TH / 2 - 40;
    const cx = wsc.ww <= SW ? (wsc.ww - SW) / 2 : Math.max(0, Math.min(wsc.ww - SW, sx - SW / 2));
    const cy = wsc.wh <= SH ? (wsc.wh - SH) / 2 : Math.max(0, Math.min(wsc.wh - SH, sy - SH / 2));
    cam = [Math.round(cx), Math.round(cy)];
  }
  function renderCity() {
    cityCam();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = wsc.interior ? '#18161f' : '#7eb664'; ctx.fillRect(0, 0, SW, SH);
    ctx.drawImage(wsc.bgC, -cam[0], -cam[1]);
    const list = wsc.parts.slice();
    list.push(charDrawable(me, st.look, wsc.ox, wsc.oy));
    for (const n of wsc.npcs || []) { const d = charDrawable(n, W_().NPCS[n.id].look, wsc.ox, wsc.oy); d.npc = n; list.push(d); }
    order = depthSort(list);
    for (const d of order) {
      const s = d.spr, x = s.x - cam[0], y = s.y - cam[1];
      if (x > SW || y > SH || x + s.pix.w < 0 || y + s.pix.h < 0) continue;
      ctx.drawImage(s.c, x, y);
    }
  }
  function cityTap(x, y) {
    if (fading) return;
    const wx = x + cam[0], wy = y + cam[1];
    const h = hitAt(wx, wy);
    if (h && h.npc) return walkNear(h.npc.talkFrom, () => { const n = h.npc; me.facing = 'NE'; dirty = true; talkTo(n.id); });
    if (h && h.item) return cityInteract(h.item);
    if (h && h.isChar) { toast('嗨，' + st.name + '！'); return; }
    if (wsc.interior) {
      const w = toWallAt(wx, wy, wsc.ox, wsc.oy), dr = wsc.room.door;
      if (w && w.side === dr.side && w.u >= dr.u && w.u <= dr.u + S.DOOR_W && w.z <= S.DOOR_H + 6) { walkNear([S.doorCell(dr)], leaveInterior); return; }
    }
    const a = (wx - wsc.ox) / (TW / 2), b = (wy - wsc.oy) / (TH / 2), c = [Math.floor((a + b) / 2), Math.floor((b - a) / 2)];
    if (c[0] < 0 || c[1] < 0 || c[0] >= wsc.ni || c[1] >= wsc.nj) return;
    const ex = (wsc.exits || []).find(e => e.cells.some(q => q[0] === c[0] && q[1] === c[1]));
    if (ex) { if (!cityWalk(c, () => fadeTo(() => enterScene(ex.to, ex.spawn, ex.facing)))) toast('那裡走不過去'); return; }
    if (!cityWalk(c)) toast('那裡走不過去');
  }
  function cityInteract(o) {
    const d = I[o.t];
    // 點櫃台這類家具時，如果緊鄰著 NPC，就去跟 NPC 說話（NPC 常被櫃台擋住下半身）
    for (const n of wsc.npcs || []) {
      const ni = Math.floor(n.i), nj = Math.floor(n.j);
      if (S.cellsOf(o).some(([a, b]) => Math.max(Math.abs(a - ni), Math.abs(b - nj)) === 1)) return walkNear(n.talkFrom, () => { me.facing = 'NE'; dirty = true; talkTo(n.id); });
    }
    const door = W_().doorCellOf(o);
    if (o.home) return walkNear([door], goHome);
    if (o.enter) return walkNear([door], () => fadeTo(() => enterScene(o.enter, [1, 0], 'SW')));
    if (o.closed) return walkNear(door ? [door] : S.cellsOf(o), () => toast(o.closed));
    if (d.seat && wsc.interior) {
      const sp = M.seatSpot(o, 0), fv = M.DIRS[sp.facing], front = [Math.floor(sp.i + fv[0] * 0.8), Math.floor(sp.j + fv[1] * 0.8)];
      for (const c of nearCells([front].concat(S.cellsOf(o)))) if (cityWalk(c, () => { me.pose = 'sit'; me.i = sp.i; me.j = sp.j; me.facing = sp.facing; me.seatZ = sp.z; me.stand = c; dirty = true; })) return;
      toast('走不過去'); return;
    }
    walkNear(S.cellsOf(o), () => toast(o.talk || d.name));
  }
  // ---------------- NPC 對話 ----------------
  const MIA_CHAT = ['這附近的公園聽說快整理好了，到時候一起去走走吧！', '拿鐵和卡布奇諾的差別？卡布奇諾多了一層綿綿的奶泡喔。', '早上的客人最多，大家都要一杯熱美式才醒得過來。', '你的房間佈置得怎麼樣了？有空帶我去參觀！', '焦糖拿鐵是我的私房招牌，等你更熟練再教你。'];
  function jobState() { st.jobs = st.jobs || {}; const j = st.jobs.cafe = st.jobs.cafe || { xp: 0, day: 0, paid: 0 }; if (j.day !== dayNum()) { j.day = dayNum(); j.paid = 0; } return j; }
  function portrait(look) {
    const pix = new Pix(70, 70), iso = new Iso(pix, 35, 100);   // 取景：頭＋上半身
    for (const pp of M.charParts(0, 0, 'SW', 0, look, 'stand').parts) pp.draw(iso);
    return toCanvas(pix);
  }
  function talkTo(id) {
    const n = W_().NPCS[id]; st.met = st.met || {};
    const first = !st.met[id], j = jobState();
    let text, opts;
    if (first) {
      text = `嗨，你是新搬來的吧？我是 ${n.name}，這間咖啡廳的老闆。最近客人好多，我一個人忙不過來……要不要來幫忙打工？做得好薪水就高喔！`;
      opts = [['好啊，我來幫忙！', 'job'], ['先聊聊天', 'chat'], ['下次再說', 'bye']];
      st.met[id] = 1; save(false);
    } else {
      text = j.paid >= CafeJob.DAILY_PAID ? '今天辛苦啦！完整薪水明天再發，不過想練習的話還是可以來喔。' : ['歡迎光臨～今天也來幫忙嗎？', '你來得正好，外面排了好多客人！', '嗨！今天想打工還是坐下來休息？'][Math.floor(Math.random() * 3)];
      opts = [['我要打工', 'job'], ['聊聊天', 'chat'], ['再見', 'bye']];
    }
    showTalk(n, text, opts);
    sfx('talk'); emit('TALK', { npc: id });
  }
  function showTalk(n, text, opts) {
    const box = $('#mTalk');
    const pc = $('#talkPic'); pc.innerHTML = ''; pc.appendChild(portrait(n.look));
    $('#talkName').textContent = n.name; $('#talkRole').textContent = n.role; $('#talkText').textContent = text;
    const ob = $('#talkOpts'); ob.innerHTML = '';
    for (const [label, act] of opts) {
      const b = document.createElement('button'); b.textContent = label; if (act === 'job') b.className = 'pri';
      b.onclick = () => {
        if (act === 'bye') { box.classList.remove('show'); return; }
        if (act === 'chat') { showTalk(n, MIA_CHAT[Math.floor(Math.random() * MIA_CHAT.length)], [['我要打工', 'job'], ['再見', 'bye']]); return; }
        if (act === 'job') { box.classList.remove('show'); startJob(n); }
      };
      ob.appendChild(b);
    }
    box.classList.add('show');
  }
  let jobRun = null;
  function startJob(n) {
    const j = jobState(), m = $('#mJob');
    m.classList.add('show');
    jobRun = CafeJob.open($('#jobRoot'), { xp: j.xp, paidToday: j.paid }, r => {
      m.classList.remove('show'); jobRun = null;
      j.xp += r.xp; if (r.paid) j.paid++;
      if (r.coins) sfx('coin'); if (r.levelUp) sfx('level');
      emit('JOB', { served: r.served, correct: r.correct, coins: r.coins });
      st.coins += r.coins; st.stats = st.stats || {}; st.stats.jobs = (st.stats.jobs || 0) + (r.served ? 1 : 0);
      save(); refreshHud(); dirty = true;
      const line = r.coins ? `辛苦了！這是今天的薪水 ${r.coins} 金幣，拿去買喜歡的家具吧！` : (r.served ? '謝謝你來幫忙！今天的薪水已經發完了，明天再來喔。' : '沒關係，下次再來試試看！');
      showTalk(n, line + (r.levelUp ? `\n你越來越熟練了，升到 Lv.${CafeJob.levelOf(j.xp)}！` : ''), [['再打一次工', 'job'], ['好的，再見', 'bye']]);
    });
  }
  function toWallAt(x, y, ox, oy) {
    let u = (x - ox) / (TW / 2);
    if (u >= 0 && u <= NI) { const z = oy + u * TH / 2 - y; if (z >= -10 && z <= WALL + 10) return { side: 'R', u, z }; }
    u = (ox - x) / (TW / 2);
    if (u >= 0 && u <= NJ) { const z = oy + u * TH / 2 - y; if (z >= -10 && z <= WALL + 10) return { side: 'L', u, z }; }
    return null;
  }

  // ---------------- 輸入 ----------------
  function toLogical(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * SW, (e.clientY - r.top) / r.height * SH]; }
  function toGrid(x, y) { const a = (x - OX) / (TW / 2), b = (y - OY) / (TH / 2); return [(a + b) / 2, (b - a) / 2]; }
  function toWall(x, y) {
    let u = (x - OX) / (TW / 2);
    if (u >= 0 && u <= NI) { const z = OY + u * TH / 2 - y; if (z >= -10 && z <= WALL + 10) return { side: 'R', u, z }; }
    u = (OX - x) / (TW / 2);
    if (u >= 0 && u <= NJ) { const z = OY + u * TH / 2 - y; if (z >= -10 && z <= WALL + 10) return { side: 'L', u, z }; }
    return null;
  }
  function hitAt(x, y) {
    for (let k = order.length - 1; k >= 0; k--) {
      const d = order[k], s = d.spr, px = Math.floor(x - s.x), py = Math.floor(y - s.y);
      if (px >= 0 && py >= 0 && px < s.pix.w && py < s.pix.h && s.pix.d[py * s.pix.w + px]) return d;
    }
    return null;
  }
  function wallHit(x, y) {
    const w = toWall(x, y); if (!w) return null;
    for (const o of curRoom().walls) { const d = I[o.t]; if (o.side === w.side && w.u >= o.u && w.u <= o.u + d.W && w.z >= d.z0 && w.z <= d.z1) return o; }
    return null;
  }
  function placeGhostAt(g, x, y, grab) {
    const d = I[g.t];
    if (d.kind === 'wall') {
      const w = toWall(x, y); if (!w) return;
      const N = w.side === 'R' ? NI : NJ;
      g.side = w.side; g.u = Math.max(0, Math.min(N - d.W, Math.round(w.u - d.W / 2)));
    } else {
      const [gi, gj] = toGrid(x, y), [wi, wj] = M.footprint(d, g.r);
      const oi = grab ? grab[0] : wi / 2, oj = grab ? grab[1] : wj / 2;
      g.i = Math.max(0, Math.min(NI - wi, Math.round(gi - oi))); g.j = Math.max(0, Math.min(NJ - wj, Math.round(gj - oj)));
    }
    dirty = true;
  }
  let down = null;
  cv.addEventListener('pointerdown', e => {
    e.preventDefault(); const [x, y] = toLogical(e); down = { x, y, t: performance.now() };
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    if (mode !== 'edit') return;
    if (hold) { placeGhostAt(hold, x, y); return; }
    const h = hitAt(x, y), w = h && h.item ? null : wallHit(x, y);
    const obj = h && h.item ? h.item : w;
    if (obj) {
      sel = obj;
      let grab = null;
      if (I[obj.t].kind !== 'wall') { const [gi, gj] = toGrid(x, y); grab = [gi - obj.i, gj - obj.j]; }
      drag = { obj: clone(obj), orig: obj, grab, moved: false, x, y };
      showSelBar(); dirty = true;
    } else { sel = null; showSelBar(); dirty = true; }
  });
  cv.addEventListener('pointermove', e => {
    if (mode !== 'edit') return;
    const [x, y] = toLogical(e);
    if (hold && (down || e.pointerType === 'mouse')) { placeGhostAt(hold, x, y); }
    if (drag && down) {
      if (!drag.moved && Math.hypot(x - drag.x, y - drag.y) > 6) { drag.moved = true; hideSelBar(); }
      if (drag.moved) placeGhostAt(drag.obj, x, y, drag.grab);
    }
  });
  cv.addEventListener('pointerup', e => {
    const [x, y] = toLogical(e), tap = down && Math.hypot(x - down.x, y - down.y) < 8;
    down = null;
    if (mode === 'edit') {
      if (hold) { placeGhostAt(hold, x, y); tryPlaceHold(); return; }
      if (drag) {
        const o = drag.orig;
        if (drag.moved) {
          if (S.canPlace(st.room, drag.obj, o)) { if (I[o.t].kind === 'wall') { o.side = drag.obj.side; o.u = drag.obj.u; } else { o.i = drag.obj.i; o.j = drag.obj.j; } save(); refreshHud(); }
          else toast('這裡放不下');
        }
        drag = null; showSelBar(); dirty = true;
      }
      return;
    }
    if (!tap) return;
    if (mode === 'city') { cityTap(x, y); return; }
    if (mode === 'visit') { const [gi, gj] = toGrid(x, y); walkTo(guest, visit.room, [Math.floor(gi), Math.floor(gj)]); guest.nextT = performance.now() + 6000; return; }
    const h = hitAt(x, y);
    if (h && h.item) { interact(h.item); return; }
    if (h && h.isChar) { toast('嗨，' + st.name + '！'); return; }
    { const tw = toWall(x, y), dr = st.room.door; if (tw && dr && tw.side === dr.side && tw.u >= dr.u && tw.u <= dr.u + S.DOOR_W && tw.z <= S.DOOR_H + 6) { walkToDoor(); return; } }
    const w = wallHit(x, y); if (w) { toast(I[w.t].name); return; }
    const [gi, gj] = toGrid(x, y), c = [Math.floor(gi), Math.floor(gj)];
    if (c[0] >= 0 && c[1] >= 0 && c[0] < NI && c[1] < NJ) { if (!walkTo(me, st.room, c)) toast('那裡走不過去'); }
  });
  cv.addEventListener('pointercancel', () => { down = null; if (drag) { drag = null; showSelBar(); dirty = true; } });

  function walkToDoor() {
    const c = S.doorCell(st.room.door), g = S.blockedGrid(st.room);
    const cands = [c, [c[0] - 1, c[1]], [c[0] + 1, c[1]], [c[0], c[1] + 1], [c[0] - 1, c[1] + 1], [c[0] + 1, c[1] + 1]].filter(q => q[0] >= 0 && q[1] >= 0 && q[0] < NI && q[1] < NJ && !g[q[0]][q[1]]);
    for (const q of cands) if (walkTo(me, st.room, q, () => { me.facing = 'NE'; goOut(); })) return;
    toast('門口被家具擋住了，先挪開吧');
  }
  function tryPlaceHold() {
    const g = hold, d = I[g.t];
    if (d.kind === 'wall' ? g.side === undefined : g.i === undefined) return;
    if (!S.canPlace(st.room, g)) { toast('這裡放不下'); dirty = true; return; }
    const o = d.kind === 'wall' ? { t: g.t, side: g.side, u: g.u } : { t: g.t, i: g.i, j: g.j, r: g.r };
    (d.kind === 'wall' ? st.room.walls : st.room.items).push(o);
    st.bag[g.t]--; if (st.bag[g.t] <= 0) delete st.bag[g.t];
    if (!st.bag[g.t]) hold = null; else hold = { t: g.t, r: g.r };
    sel = o; save(); refreshHud(); renderBag(); showSelBar(); dirty = true;
    sfx('place'); emit('PLACE', { item: o.t });
  }

  // ---------------- 佈置模式 UI ----------------
  function setMode(m) {
    mode = m; sel = null; hold = null; drag = null;
    $('#edit').style.display = m === 'edit' ? 'block' : 'none';
    $('#hudB').style.display = m === 'home' ? 'flex' : 'none';
    $('#hudR').style.display = m === 'home' || m === 'city' ? 'flex' : 'none';
    $('#visitBar').style.display = m === 'visit' ? 'flex' : 'none';
    $('#hudL').style.display = m === 'visit' ? 'none' : 'flex';
    $('#hudCity').style.display = m === 'city' ? 'flex' : 'none';
    $('#place').style.display = m === 'city' ? '' : 'none';
    if (m === 'edit') { standUp(me); me.path = []; renderBag(); }
    if (m === 'home') ensureFree(me, st.room);
    hideSelBar(); fit(); dirty = true;
  }
  $('#bEdit').onclick = () => setMode('edit');
  $('#bOut').onclick = () => walkToDoor();
  $('#bGoHome').onclick = () => goHome();
  $('#bDone').onclick = () => { setMode('home'); save(); };
  $$('#edit .tabs button[data-tab]').forEach(b => b.onclick = () => {
    editTab = b.dataset.tab; hold = null; $$('#edit .tabs button[data-tab]').forEach(x => x.classList.toggle('on', x === b)); renderBag(); dirty = true;
  });
  const thumbs = new Map();
  function thumb(id) {
    if (thumbs.has(id)) return thumbs.get(id);
    const d = I[id], pix = new Pix(300, 260), iso = new Iso(pix, 150, 150);
    if (d.kind === 'floor') { for (const p of depthSort(M.itemParts({ t: id, i: 0, j: 0, r: 0 }))) p.draw(iso); }
    else if (d.kind === 'rug') S.drawRug(iso, { t: id, i: 0, j: 0, r: 0 });
    else { const q = S.wallQ(pix, new Iso(pix, 110, 230), 'R', 0); q(-0.1, d.W + 0.1, d.z0 - 6, d.z1 + 6, [240, 214, 170], null); d.paint(q, d.W); }
    const t = pix.trim(), c = toCanvas(t.pix); thumbs.set(id, c); return c;
  }
  function slot(canvas, name, count, on, onclick) {
    const el = document.createElement('div'); el.className = 'slot' + (on ? ' on' : '');
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; c.getContext('2d').drawImage(canvas, 0, 0);
    el.appendChild(c);
    if (count) { const b = document.createElement('div'); b.className = 'c'; b.textContent = '×' + count; el.appendChild(b); }
    const n = document.createElement('div'); n.className = 'n'; n.textContent = name; el.appendChild(n);
    el.onclick = onclick; return el;
  }
  function swatch(colA, colB, label, on, onclick) {
    const c = document.createElement('canvas'); c.width = 40; c.height = 30; const g = c.getContext('2d');
    g.fillStyle = `rgb(${colA})`; g.fillRect(0, 0, 40, 30); g.fillStyle = `rgb(${colB})`;
    for (let x = 0; x < 40; x += 10) g.fillRect(x, 0, 5, 30);
    return slot(c, label, 0, on, onclick);
  }
  function renderBag() {
    const bag = $('#bag'); bag.innerHTML = '';
    if (editTab === 'paper' || editTab === 'ground') {
      const arr = editTab === 'paper' ? M.WALLS : M.FLOORS, key = editTab === 'paper' ? 'wall' : 'floor';
      arr.forEach((w, k) => bag.appendChild(swatch(w.a, w.b, w.name, st.room[key] === k, () => { st.room[key] = k; save(); renderBag(); dirty = true; })));
      $('#editHelp').textContent = '點一下就換上（免費）';
      return;
    }
    $('#editHelp').textContent = editTab === 'wall' ? '點牆面裝飾 → 點牆壁掛上去' : '點背包裡的家具 → 點房間放下；點家具可以拖曳、旋轉、收起';
    const ids = Object.keys(st.bag).filter(id => I[id] && st.bag[id] > 0 && ((editTab === 'wall') === (I[id].kind === 'wall')));
    if (!ids.length) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = '背包是空的，去 🛒 商店買家具吧！（或點房間裡的家具收起來）'; bag.appendChild(e); return; }
    for (const id of ids) bag.appendChild(slot(thumb(id), I[id].name, st.bag[id], hold && hold.t === id, () => {
      if (hold && hold.t === id) hold = null; else { hold = { t: id, r: 0 }; sel = null; hideSelBar(); }
      renderBag(); dirty = true;
      if (hold) toast(I[id].kind === 'wall' ? '點牆壁掛上去' : '點房間的地板放下去');
    }));
  }
  function showSelBar() {
    const bar = $('#selBar');
    if (!sel || mode !== 'edit' || drag && drag.moved) { bar.style.display = 'none'; return; }
    const d = I[sel.t]; $('#bRot').style.display = d.kind === 'floor' || d.kind === 'rug' ? '' : 'none';
    // 固定在畫面上方中間：不會蓋住選到的家具（小螢幕也一樣）
    bar.style.display = 'flex';
    bar.style.left = Math.max(6, (innerWidth - bar.offsetWidth) / 2) + 'px';
    bar.style.top = 'calc(10px + env(safe-area-inset-top, 0px))';
  }
  function hideSelBar() { $('#selBar').style.display = 'none'; }
  $('#bDesel').onclick = () => { sel = null; hideSelBar(); dirty = true; };
  $('#bRot').onclick = () => {
    if (!sel) return; const o = clone(sel); o.r = (o.r + 1) & 3;
    // 轉了放不下就試著挪一下位置
    for (const [di, dj] of [[0, 0], [-1, 0], [0, -1], [-1, -1], [1, 0], [0, 1], [-2, 0], [0, -2]]) {
      const t = Object.assign({}, o, { i: o.i + di, j: o.j + dj });
      if (S.canPlace(st.room, t, sel)) { sel.r = t.r; sel.i = t.i; sel.j = t.j; save(); showSelBar(); dirty = true; return; }
    }
    toast('轉不過來，旁邊太擠了');
  };
  $('#bStore').onclick = () => {
    if (!sel) return; const arr = I[sel.t].kind === 'wall' ? st.room.walls : st.room.items, k = arr.indexOf(sel);
    if (k >= 0) arr.splice(k, 1);
    st.bag[sel.t] = (st.bag[sel.t] || 0) + 1; toast('收進背包了'); sfx('pick'); sel = null; hideSelBar(); save(); refreshHud(); renderBag(); dirty = true;
  };
  addEventListener('keydown', e => { if (mode === 'edit' && (e.key === 'r' || e.key === 'R')) { if (hold && hold.i !== undefined) { hold.r = (hold.r + 1) & 3; dirty = true; } else $('#bRot').click(); } if (e.key === 'Escape') { hold = null; sel = null; hideSelBar(); renderBag(); dirty = true; } });

  // ---------------- 商店 ----------------
  let shopCat = 'all';
  function saleIds() {
    const ids = Object.keys(I).filter(id => !I[id].hidden).sort(); let s = dayNum() * 9301 + 49297; const out = [];
    while (out.length < 4) { s = (s * 9301 + 49297) % 233280; const id = ids[Math.floor(s / 233280 * ids.length)]; if (!out.includes(id)) out.push(id); }
    return out;
  }
  const priceOf = id => saleIds().includes(id) ? Math.round(I[id].price * 0.7) : I[id].price;
  function openShop() {
    const cats = $('#shopCats'); cats.innerHTML = '';
    [['all', '全部'], ['sale', '🔥 今日特價']].concat(Object.entries(M.CATS)).forEach(([k, n]) => {
      const b = document.createElement('button'); b.textContent = n; b.className = shopCat === k ? 'on' : ''; b.onclick = () => { shopCat = k; openShop(); }; cats.appendChild(b);
    });
    const grid = $('#shopGrid'); grid.innerHTML = ''; $('#shopCoins').textContent = st.coins;
    const sale = saleIds();
    let ids = Object.keys(I).filter(id => !I[id].hidden).filter(id => shopCat === 'all' || (shopCat === 'sale' ? sale.includes(id) : I[id].cat === shopCat));
    ids.sort((a, b) => (sale.includes(b) - sale.includes(a)) || I[a].price - I[b].price);
    for (const id of ids) {
      const d = I[id], pr = priceOf(id), card = document.createElement('div'); card.className = 'card';
      const c = document.createElement('canvas'), t = thumb(id); c.width = t.width; c.height = t.height; c.getContext('2d').drawImage(t, 0, 0);
      card.appendChild(c);
      if (sale.includes(id)) { const s = document.createElement('div'); s.className = 'sale'; s.textContent = '7 折'; card.appendChild(s); }
      const own = (st.bag[id] || 0) + st.room.items.concat(st.room.walls).filter(x => x.t === id).length;
      card.insertAdjacentHTML('beforeend', `<div class="t"></div><div class="m"><span class="tag">${M.SETS[d.set]}</span>❤ ${d.comfort}${d.seat ? ' ・可以坐' : ''}${d.toggle ? ' ・可開關' : ''}${own ? ' ・已有 ' + own : ''}</div>`);
      card.querySelector('.t').textContent = d.name;
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span><i class="coin"></i> <b>${pr}</b> ${pr !== d.price ? '<s>' + d.price + '</s>' : ''}</span>`;
      const b = document.createElement('button'); b.className = 'pri'; b.textContent = '買'; b.disabled = st.coins < pr;
      b.onclick = () => {
        if (st.coins < pr) return;
        st.coins -= pr; st.bag[id] = (st.bag[id] || 0) + 1; save(false); refreshHud();
        sfx('coin'); emit('BUY', { item: id });
        toast(`買了 ${d.name}！到 🛠 佈置 裡放進房間`); openShop();
      };
      row.appendChild(b); card.appendChild(row); grid.appendChild(card);
    }
    $('#mShop').classList.add('show');
  }
  $('#bShop').onclick = openShop;

  // ---------------- 角色 ----------------
  let draft = null, pvFacing = 0, creating = false;
  const FAC = ['SW', 'SE', 'NE', 'NW'];
  function openLook(isNew) {
    creating = !!isNew; draft = Object.assign({}, st.look, { name: st.name });
    $('#lookTitle').firstChild.textContent = isNew ? '👋 歡迎！先做一個你自己 ' : '🧑 我的角色 ';
    $('#lookClose').style.display = isNew ? 'none' : '';
    renderLookOpts(); drawPreview(); $('#mLook').classList.add('show');
  }
  function renderLookOpts() {
    const box = $('#lookOpts'); box.innerHTML = '';
    const nm = document.createElement('div'); nm.className = 'opt'; nm.innerHTML = '<b>名字（最多 12 個字）</b>';
    const inp = document.createElement('input'); inp.type = 'text'; inp.maxLength = 12; inp.value = draft.name || ''; inp.placeholder = '例如：小窩主人';
    inp.oninput = () => { draft.name = inp.value; }; nm.appendChild(inp); box.appendChild(nm);
    const row = (label, key, arr, cssOf, extra) => {
      const o = document.createElement('div'); o.className = 'opt'; o.innerHTML = `<b>${label}</b>`;
      const sw = document.createElement('div'); sw.className = 'sw';
      if (extra) for (const [v, t] of extra) { const b = document.createElement('button'); b.className = 'txt' + (draft[key] === v ? ' on' : ''); b.textContent = t; b.onclick = () => { draft[key] = v; renderLookOpts(); drawPreview(); }; sw.appendChild(b); }
      arr.forEach((c, k) => { const b = document.createElement('button'); b.style.background = cssOf(c); if (draft[key] === k) b.className = 'on'; b.onclick = () => { draft[key] = k; renderLookOpts(); drawPreview(); }; sw.appendChild(b); });
      o.appendChild(sw); box.appendChild(o);
    };
    const css = c => `rgb(${c})`;
    row('膚色', 'skin', M.SKINS, css);
    row('髮型', 'hair', [], css, M.HAIRS.map(h => [h, M.HAIR_NAMES[h]]));
    if (draft.hair !== 'bald') row('髮色', 'hairC', M.HAIRC, css);
    row('上衣', 'shirt', M.CLOTH, css, [[-1, '不穿']]);
    row('褲子', 'pants', M.PANTS, css, [[-1, '不穿']]);
    row('鞋子', 'shoes', M.SHOES, css, [[-1, '光腳']]);
  }
  function drawPreview() {
    const pix = new Pix(80, 100), iso = new Iso(pix, 40, 90);
    iso.flat(-0.5, -0.5, 1, 1, [226, 200, 160], 0, [206, 178, 136]);
    for (const p of M.charParts(0, 0, FAC[pvFacing], 0, draft, 'stand').parts) p.draw(iso);
    const c = $('#pv').getContext('2d'); c.clearRect(0, 0, 80, 100); c.drawImage(toCanvas(pix), 0, 0);
  }
  $('#pvL').onclick = () => { pvFacing = (pvFacing + 3) % 4; drawPreview(); };
  $('#pvR').onclick = () => { pvFacing = (pvFacing + 1) % 4; drawPreview(); };
  $('#lookOK').onclick = () => {
    const name = (draft.name || '').trim();
    if (!name) { toast('取個名字吧！'); return; }
    if (BAD.some(w => name.toLowerCase().includes(w))) { toast('換個名字吧～'); return; }
    st.name = name.slice(0, 12); st.look = cleanLook(draft);
    $('#mLook').classList.remove('show'); save(); refreshHud(); dirty = true;
    if (creating) { creating = false; daily(); toast('歡迎來到像素小窩！點地板走路、點家具互動'); }
  };
  $('#bLook').onclick = () => openLook(false);

  // ---------------- 參觀 ----------------
  let visitTab = 'recent';
  $$('#visitTabs button').forEach(b => b.onclick = () => { visitTab = b.dataset.v; $$('#visitTabs button').forEach(x => x.classList.toggle('on', x === b)); loadVisitList(); });
  async function loadVisitList() {
    const list = $('#visitList'); list.innerHTML = '<div class="empty">讀取中…</div>';
    try {
      const recent = await Cloud.recent(200), byId = new Map(recent.map(r => [r.id, r]));
      let rows;
      if (visitTab === 'recent') rows = recent.slice(0, 30);
      else if (visitTab === 'rand') rows = recent.slice().sort(() => Math.random() - 0.5).slice(0, 15);
      else {
        const likes = await Cloud.likesAll(), wk = dayNum() - 7, cnt = [];
        for (const id in likes) { const n = Object.values(likes[id] || {}).filter(d => typeof d === 'number' && d > wk).length; if (n) cnt.push([id, n]); }
        cnt.sort((a, b) => b[1] - a[1]); rows = [];
        for (const [id, n] of cnt.slice(0, 20)) { let r = byId.get(id); if (!r) { try { r = await Cloud.idxOf(id); if (r) r.id = id; } catch (e) {} } if (r) rows.push(Object.assign({}, r, { likes: n })); }
      }
      rows = rows.filter(r => r.id !== st.id);
      list.innerHTML = '';
      if (!rows.length) { list.innerHTML = '<div class="empty">還沒有其他人的房間，晚點再來看看！</div>'; return; }
      for (const r of rows) {
        const el = document.createElement('div'); el.className = 'r';
        el.innerHTML = '<span>🏠</span><span class="nm"></span><span class="st"></span><button>去看看</button>';
        el.querySelector('.nm').textContent = String(r.n || '').slice(0, 12);
        el.querySelector('.st').textContent = `❤ ${+r.c || 0}` + (r.likes ? `　👍 ${r.likes}` : '');
        el.onclick = () => goVisit(r.id, String(r.n || ''));
        list.appendChild(el);
      }
    } catch (e) { list.innerHTML = '<div class="empty">連不上雲端，等一下再試試看</div>'; }
  }
  $('#bVisit').onclick = () => { $('#mVisit').classList.add('show'); loadVisitList(); };
  async function goVisit(id, name) {
    $('#mVisit').classList.remove('show'); toast('前往 ' + name + ' 的小窩…');
    try {
      const d = await Cloud.room(id); if (!d) { toast('這間房間打不開'); return; }
      const room = cleanRoom(d.room), look = cleanLook(d.look);
      visit = { id, name: String(d.name || name).slice(0, 12), room, look, likes: 0, liked: false };
      const f = freeCell(room, [4, 5]); guest.i = f[0] + 0.5; guest.j = f[1] + 0.5; guest.path = []; guest.facing = 'SW'; guest.nextT = performance.now() + 1500;
      setMode('visit'); updateVisitBar(); sfx('door'); emit('VISIT', { id });
      const [n, liked] = await Promise.all([Cloud.likeCount(id).catch(() => 0), Cloud.hasLiked(id, st.id).catch(() => false)]);
      if (visit && visit.id === id) { visit.likes = n; visit.liked = liked; updateVisitBar(); }
    } catch (e) { toast('連不上雲端，等一下再試試看'); }
  }
  // 每個人對同一間房間只能讚一次（雲端規則），以雲端紀錄為準
  function likedToday(id) { return !!(visit && visit.id === id && visit.liked) || st.likeLog.ids.includes(id); }
  function updateVisitBar() {
    if (!visit) return;
    $('#vName').textContent = `🏠 ${visit.name} 的小窩　❤ ${S.comfortOf(visit.room).total}　👍 ${visit.likes}`;
    const b = $('#bLike'); b.disabled = likedToday(visit.id); b.textContent = b.disabled ? '👍 已讚過' : '👍 按讚';
  }
  $('#bLike').onclick = async () => {
    if (!visit || likedToday(visit.id)) return;
    if (!st.published) { await pushCloud(); if (!st.published) { toast('先連上雲端才能按讚'); return; } }
    try {
      await Cloud.like(visit.id, st.id, dayNum());
      if (st.likeLog.d !== dayNum()) st.likeLog = { d: dayNum(), n: 0, ids: st.likeLog.ids || [] };
      st.likeLog.ids.push(visit.id); visit.likes++; visit.liked = true;
      let msg = '按讚成功！'; sfx('coin'); emit('LIKE', { id: visit.id });
      if (st.likeLog.n < 10) { st.likeLog.n++; st.coins += 5; msg += ' 金幣 +5'; }
      save(false); refreshHud(); updateVisitBar(); toast(msg);
    } catch (e) {
      const already = await Cloud.hasLiked(visit.id, st.id).catch(() => false);
      if (already) { visit.liked = true; toast('你已經讚過這間了'); } else toast('按讚失敗，等一下再試試看');
      updateVisitBar();
    }
  };
  $('#bHome').onclick = () => { visit = null; setMode('home'); checkLikes(); };
  function wanderGuest(now) {
    if (mode !== 'visit' || !visit || guest.path.length || now < guest.nextT) return;
    const g = S.blockedGrid(visit.room), free = [];
    for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) if (!g[i][j]) free.push([i, j]);
    if (free.length) walkTo(guest, visit.room, free[Math.floor(Math.random() * free.length)]);
    guest.nextT = now + 2500 + Math.random() * 3000;
  }

  // ---------------- 每日、讚 ----------------
  function daily() {
    if (!st.name || st.lastDay === dayNum()) return;
    const gain = 30 + Math.floor(S.comfortOf(st.room).total / 10);
    st.coins += gain; st.lastDay = dayNum(); save(); refreshHud();
    setTimeout(() => toast(`☀️ 每日舒適度收入：金幣 +${gain}`), 600);
  }
  async function checkLikes() {
    if (!st.published) return;
    try {
      const n = await Cloud.likeCount(st.id);
      if (n > st.likesSeen) { const g = (n - st.likesSeen) * 10; st.coins += g; toast(`有人來你家按讚了！👍 ${n - st.likesSeen}　金幣 +${g}`); }
      st.likesSeen = Math.max(st.likesSeen, n); save(false); refreshHud();
    } catch (e) {}
  }

  // ---------------- HUD、雜項 ----------------
  const sfx = n => { try { window.SFX && SFX.play(n); } catch (e) {} };
  function emit(type, data) {
    let done = [];
    try { done = Quests.on(st, type, data || {}); } catch (e) { console.error(e); }
    // 主線：完成就自動領獎並進到下一步；每日／每週要到任務面板領
    const main = done.filter(d => Quests.MAIN.includes(d)), other = done.filter(d => !Quests.MAIN.includes(d));
    for (const d of main) {
      const r = Quests.claim(st, d.id); if (!r) continue;
      st.coins += r.coins || 0; if (r.item) st.bag[r.item] = (st.bag[r.item] || 0) + 1;
      const nx = Quests.current(st);
      setTimeout(() => { sfx('quest'); toast(`✅ ${d.title}　${r.item ? '獲得禮物：' + I[r.item].name : '金幣 +' + r.coins}${nx ? '\n下一步：' + nx.def.desc : ''}`); }, 350);
      refreshHud();
    }
    if (other.length) { sfx('quest'); setTimeout(() => toast('✅ 任務完成：' + other.map(d => d.title).join('、') + '（點左上任務領獎）'), main.length ? 2600 : 0); }
    refreshQuest(); save(false);
  }
  function refreshQuest() {
    const c = Quests.current(st), n = Quests.claimable(st);
    $('#qText').textContent = c ? '🎯 ' + c.def.desc : '📋 每日任務';
    $('#qBadge').style.display = n ? '' : 'none'; $('#qBadge').textContent = n;
  }
  function openQuests() {
    Quests.ensure(st); sfx('open');
    const box = $('#questList'); box.innerHTML = '';
    const card = (def, prog, claimed, kind) => {
      const el = document.createElement('div'); el.className = 'qcard' + (claimed ? ' done' : '');
      const pct = Math.min(100, Math.round(prog / def.need * 100));
      const reward = def.item ? '🎁 ' + (I[def.item] ? I[def.item].name : '禮物') : '金幣 ' + def.coins;
      el.innerHTML = `<div class="qk">${kind}</div><div class="qm"><b></b><div class="qd"></div><div class="qbar"><i style="width:${pct}%"></i></div><div class="qp">${prog} / ${def.need}　獎勵：${reward}</div></div>`;
      el.querySelector('b').textContent = def.title; el.querySelector('.qd').textContent = def.desc;
      const b = document.createElement('button'); b.className = 'pri';
      b.textContent = claimed ? '已領取' : prog >= def.need ? '領取' : '進行中'; b.disabled = claimed || prog < def.need;
      b.onclick = () => {
        const r = Quests.claim(st, def.id); if (!r) return;
        st.coins += r.coins || 0;
        if (r.item) st.bag[r.item] = (st.bag[r.item] || 0) + 1;
        sfx('coin'); toast(r.item ? `領到禮物：${I[r.item].name}！到 🛠 佈置 的「牆面」掛起來` : `領到 ${r.coins} 金幣！`);
        save(); refreshHud(); openQuests();
      };
      el.appendChild(b); box.appendChild(el);
    };
    const q = st.q, c = Quests.current(st);
    if (c) card(c.def, q.mainProg, false, '主線');
    else { const e = document.createElement('div'); e.className = 'empty'; e.textContent = '新手主線都完成了！之後會有新的故事。'; box.appendChild(e); }
    for (const it of q.daily.list) card(Quests.defOf(it.id), it.prog, it.claimed, '每日');
    for (const it of q.weekly.list) card(Quests.defOf(it.id), it.prog, it.claimed, '每週');
    $('#mQuest').classList.add('show');
  }
  $('#qChip').onclick = openQuests;
  function refreshHud() {
    $('#name').textContent = st.name ? `🏠 ${st.name} 的小窩` : '像素小窩';
    $('#coins').textContent = st.coins; $('#comfort').textContent = S.comfortOf(st.room).total;
  }
  let toastT = 0;
  function toast(t) { const el = $('#toast'); el.textContent = t; el.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => el.style.display = 'none', 2400); }
  $$('[data-close]').forEach(b => b.onclick = () => b.closest('.modal').classList.remove('show'));
  $$('.modal').forEach(m => m.addEventListener('pointerdown', e => { if (e.target === m && !(m.id === 'mLook' && creating) && m.id !== 'mJob') m.classList.remove('show'); }));
  let rotDismissed = false;
  function fit() {
    const bottom = mode === 'edit' ? ($('#edit').offsetHeight || 130) : 0;
    const W = innerWidth, H = innerHeight - bottom, s = Math.min(W / SW, H / SH);
    cv.style.width = SW * s + 'px'; cv.style.height = SH * s + 'px';
    cv.style.left = (W - SW * s) / 2 + 'px'; cv.style.top = Math.max(0, (H - SH * s) / 2) + 'px';
    $('#rot').style.display = !rotDismissed && innerHeight > innerWidth * 1.15 ? 'flex' : 'none';
    showSelBar();
  }
  $('#rotOK').onclick = () => { rotDismissed = true; fit(); };
  addEventListener('resize', fit);

  // ---------------- 主迴圈 ----------------
  let last = performance.now();
  let frames = 0, loopErr = null;
  function loop(now) {
    requestAnimationFrame(loop);              // 先排下一幀：就算這一幀出錯，迴圈也不會停
    frames++;
    const dt = Math.min(0.2, Math.max(0, (now - last) / 1000)); last = now;
    try { if (mode === 'visit') { wanderGuest(now); stepChar(guest, dt); } else stepChar(me, dt); }
    catch (e) { loopErr = String(e && e.stack || e); console.error('step', e); }
    if (dirty) { dirty = false; try { render(); } catch (e) { loopErr = String(e && e.stack || e); console.error('render', e); } }
  }
  ensureFree(me, st.room);
  fit(); refreshHud(); refreshQuest(); requestAnimationFrame(loop);
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('button')) sfx('tap'); }, true);
  const snd = $('#bSound'); const sndTxt = () => { snd.textContent = SFX.on ? '🔊' : '🔇'; }; sndTxt();
  snd.onclick = () => { SFX.setOn(!SFX.on); sndTxt(); };
  if (!st.name) openLook(true); else { daily(); checkLikes(); scheduleCloud(); }
  setInterval(() => { if (mode === 'home') checkLikes(); }, 120000);

  // 測試用
  window.__nook = { emit, openQuests, Quests, talkTo, startJob, jobState, get wsc() { return wsc; }, get cam() { return cam; }, enterScene, goOut, goHome, cityTap, get frames() { return frames; }, get loopErr() { return loopErr; }, get st() { return st; }, get mode() { return mode; }, me, guest, setMode, interact, walkTo, render: () => { dirty = true; }, S, M, cleanRoom, cleanLook, get order() { return order; }, toast };
})();
