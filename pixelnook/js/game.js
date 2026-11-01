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
  const mkCode = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(16)); return Array.from(r, x => a[x % a.length]).join('').replace(/(.{4})(?=.)/g, '$1-'); };
  if (!st.code) st.code = mkCode();
  let saveT = 0;
  function save(cloudToo) {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
    if (cloudToo !== false) scheduleCloud(); else scheduleBackup();
  }
  let cloudT = 0, cloudBusy = false, cloudPending = false;
  function scheduleCloud() { clearTimeout(cloudT); cloudT = setTimeout(pushCloud, 1800); scheduleBackup(); }
  let backupT = 0;
  function scheduleBackup() { clearTimeout(backupT); backupT = setTimeout(doBackup, 10000); }
  async function doBackup() {
    if (!st.name) return;
    try {
      if (st.acct && await pullIfNewer()) return;   // 別的裝置有更新的進度：先載入，不要蓋掉
      const t = await Cloud.backup(st.code, st); st.backupT = t; st.syncT = t;
      try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
    } catch (e) { setTimeout(scheduleBackup, 30000); }
  }
  // 已登入：雲端備份比這台上次同步的還新 → 自動載入（換裝置接著玩）
  let pulling = false;
  async function pullIfNewer() {
    if (!st.acct || pulling) return false;
    pulling = true;
    try {
      const t = await Cloud.backupTime(st.code);
      if (!t || t <= (st.syncT || 0) + 500) return false;
      const r = await Cloud.restore(st.code);
      if (!r || !r.state || !r.state.id || !r.state.room) return false;
      applyState(r.state, { acct: st.acct, code: st.code, t: r.t });
      toast('已載入你在其他裝置的最新進度');
      return true;
    } catch (e) { return false; } finally { pulling = false; }
  }
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
    const cp = M.charParts(ch.i, ch.j, ch.facing, ch.step, look, ch.pose, ch.seatZ, ch.head);
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
    if (mode !== 'edit') { const cd = order.find(d => d.isChar); if (cd) xray(order, cd, 0, 0); }
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
    const [ci, cj] = ch.path[0], ti = ci + 0.5, tj = cj + 0.5, di = ti - ch.i, dj = tj - ch.j, dist = Math.hypot(di, dj), sp = (mode === 'city' && wsc && !wsc.interior ? 4.6 : 3.8) * dt;
    ch.head = null; if (Math.abs(di) > Math.abs(dj)) ch.facing = di > 0 ? 'SE' : 'NW'; else if (dist > 1e-6) ch.facing = dj > 0 ? 'SW' : 'NE';
    if (dist <= sp) { ch.i = ti; ch.j = tj; ch.path.shift(); if (!ch.path.length) { ch.step = 0; const f = ch.onArrive; ch.onArrive = null; if (f) f(); } }
    else { ch.i += di / dist * sp; ch.j += dj / dist * sp; }
    ch.walkT += dt; if (ch.path.length) ch.step = Math.floor(ch.walkT / 0.11) % 2 ? 1 : -1;
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
    if (id === 'furniture' && scenes[id] && scenes[id].day !== dayNum()) delete scenes[id];
    if (!scenes[id]) {
      const sc = W_().makeScene(id, id === 'furniture' ? showroomPick() : undefined);
      if (id === 'furniture') sc.day = dayNum();
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
    if (park && id !== 'park') endParkJob(true);
    wsc = getScene(id); order = [];
    wsc.pickups = scenePickups(wsc).concat(deliverPickups(wsc)); refreshHarvest(wsc);
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
      if (park) endParkJob(true);
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
  // 把會動的物件插進已排序的靜態清單：放在「所有在它後面、畫面上有重疊的零件」之後，
  // 「所有在它前面、畫面上有重疊的零件」之前；找不到合法位置時退回整體排序。
  function overlapScr(a, b) { const s = a.spr, t = b.spr; return s.x < t.x + t.pix.w && t.x < s.x + s.pix.w && s.y < t.y + t.pix.h && t.y < s.y + s.pix.h; }
  function insertDynamic(stat, dyn) {
    let out = stat.slice();
    for (const d of dyn) {
      let lo = -1, hi = out.length;
      for (let k = 0; k < out.length; k++) {
        const o = out[k]; if (!overlapScr(o, d)) continue;
        const ob = PX.behind(o, d), db = PX.behind(d, o);
        if (ob && !db) lo = Math.max(lo, k); else if (db && !ob) hi = Math.min(hi, k);
      }
      if (lo >= hi) return depthSort(stat.concat(dyn));   // 有衝突：退回完整排序
      out.splice(lo + 1, 0, d);
    }
    return out;
  }
  function renderCity() {
    cityCam();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = wsc.interior ? '#18161f' : '#7eb664'; ctx.fillRect(0, 0, SW, SH);
    ctx.drawImage(wsc.bgC, -cam[0], -cam[1]);
    // 不會動的零件只排序一次；會動的（角色、NPC、撿拾物）每幀插到正確位置
    if (!wsc.staticOrder || wsc.staticParts !== wsc.parts) { wsc.staticOrder = depthSort(wsc.parts); wsc.staticParts = wsc.parts; }
    const dyn = pickupDrawables(wsc);
    const meD = charDrawable(me, st.look, wsc.ox, wsc.oy); dyn.push(meD);
    for (const n of wsc.npcs || []) { const d = npcDrawable(n, W_().NPCS[n.id].look, wsc.ox, wsc.oy); d.npc = n; dyn.push(d); }
    for (const d of lifeDrawables(wsc)) dyn.push(d);
    order = insertDynamic(wsc.staticOrder, depthSort(dyn));
    for (const d of order) {
      const s = d.spr, x = s.x - cam[0], y = s.y - cam[1];
      if (x > SW || y > SH || x + s.pix.w < 0 || y + s.pix.h < 0) continue;
      ctx.drawImage(s.c, x, y);
    }
    xray(order, meD, cam[0], cam[1]);
    if (wsc.id === 'furniture') drawTags(wsc);
    drawBubbles(wsc);
    // 浮動文字（撿到東西）
    const now = performance.now();
    for (let k = floats.length - 1; k >= 0; k--) {
      const f = floats[k], t = (now - f.t0) / 1000; if (t > 1.2) { floats.splice(k, 1); continue; }
      const x = wsc.ox + (f.i - f.j) * TW / 2 - cam[0], y = wsc.oy + (f.i + f.j) * TH / 2 - 100 - t * 30 - cam[1];
      ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.globalAlpha = Math.min(1, 1.6 - t);
      ctx.lineWidth = 4; ctx.strokeStyle = '#22283f'; ctx.strokeText(f.text, x, y); ctx.fillStyle = '#ffe680'; ctx.fillText(f.text, x, y); ctx.globalAlpha = 1;
    }
    if (floats.length || (wsc.pickups && wsc.pickups.length)) dirty = true;   // 閃爍動畫、浮動文字
  }
  // ---------------- 城市生活：路人、小動物、居民的小動作、對話泡泡 ----------------
  const sprCache = new Map();
  function cachedDrawable(key, ent, partsFn, ox, oy, padTop) {
    // 同樣外觀／姿勢只畫一次，換位置時平移；排序用的 AABB 仍然用實際位置
    let base = sprCache.get(key);
    if (!base) {
      const r = partsFn(0.5, 0.5), a = r.aabb;
      base = { a: { i0: a.i0 - 0.5, i1: a.i1 - 0.5, j0: a.j0 - 0.5, j1: a.j1 - 0.5, z0: a.z0, z1: a.z1 } };
      base.spr = spriteOf({ i0: a.i0, i1: a.i1, j0: a.j0, j1: a.j1, z0: Math.min(0, a.z0), z1: a.z1, draw(iso) { for (const p of r.parts) p.draw(iso); } }, padTop || 16, 0, 0);
      sprCache.set(key, base); if (sprCache.size > 500) sprCache.delete(sprCache.keys().next().value);
    }
    const dx = Math.round(ox + (ent.i - 0.5 - (ent.j - 0.5)) * TW / 2), dy = Math.round(oy + (ent.i + ent.j - 1) * TH / 2);
    const b = base.a;
    return { i0: ent.i + b.i0, i1: ent.i + b.i1, j0: ent.j + b.j0, j1: ent.j + b.j1, z0: b.z0, z1: b.z1, spr: { pix: base.spr.pix, c: base.spr.c, x: base.spr.x + dx, y: base.spr.y + dy } };
  }
  const lookKey = l => [l.skin, l.hair, l.hairC, l.shirt, l.pants, l.shoes, l.apron, l.hat].join('/');
  function npcDrawable(ch, look, ox, oy) {
    const k = 'c|' + lookKey(look) + '|' + ch.facing + '|' + (ch.head || '') + '|' + (ch.step || 0) + '|' + (ch.pose || 'stand') + '|' + (ch.seatZ || 0);
    const d = cachedDrawable(k, ch, (i, j) => M.charParts(i, j, ch.facing, ch.step, look, ch.pose, ch.seatZ, ch.head), ox, oy, 16);
    d.isChar = true; return d;
  }
  // 小動物：貓、鴿子（方塊拼成，零件互不重疊）
  function animalParts(kind, i, j, facing, step, pose, fly) {
    const [fi, fj] = M.DIRS[facing], si = fj, sj = -fi, parts = [];
    // 用「前後 f、左右 s」描述方塊，再轉成 i/j
    const B = (f0, f1, s0, s1, z0, z1, col) => {
      const a = [i + fi * f0 + si * s0, i + fi * f1 + si * s1], b = [j + fj * f0 + sj * s0, j + fj * f1 + sj * s1];
      const i0 = Math.min(a[0], a[1]), j0 = Math.min(b[0], b[1]);
      parts.push(PX.boxPart(i0, j0, Math.abs(a[1] - a[0]), Math.abs(b[1] - b[0]), z1 - z0, col, z0));
    };
    if (kind === 'cat') {
      const c = [236, 152, 72], d2 = [206, 120, 52], w = [250, 236, 214];
      if (pose === 'sleep') {
        B(-0.16, 0.10, -0.10, 0.10, 0, 7, c); B(0.10, 0.22, -0.08, 0.08, 0, 7, c);
        B(0.12, 0.16, -0.08, -0.04, 7, 9, d2); B(0.12, 0.16, 0.04, 0.08, 7, 9, d2);
        B(-0.22, -0.16, -0.10, 0.04, 0, 3, d2);
      } else {
        const lift = step ? 1 : 0;
        B(0.06, 0.12, -0.08, -0.03, 0, 5 + (step > 0 ? lift : 0), d2); B(0.06, 0.12, 0.03, 0.08, 0, 5 + (step < 0 ? lift : 0), d2);
        B(-0.14, -0.08, -0.08, -0.03, 0, 5, d2); B(-0.14, -0.08, 0.03, 0.08, 0, 5, d2);
        B(-0.16, 0.14, -0.09, 0.09, 6, 14, c);
        B(0.14, 0.27, -0.08, 0.08, 9, 19, c); B(0.27, 0.29, -0.04, 0.04, 10, 13, w);
        B(0.16, 0.21, -0.08, -0.04, 19, 22, d2); B(0.16, 0.21, 0.04, 0.08, 19, 22, d2);
        B(-0.21, -0.16, -0.02, 0.02, 12, 24, d2);
      }
    } else {
      const g = [154, 158, 176], h = [104, 112, 138], bk = [236, 176, 96], z = fly || 0;
      B(-0.08, 0.05, -0.05, 0.05, 2 + z, 8 + z, g); B(0.05, 0.11, -0.03, 0.03, 6 + z, 11 + z, h); B(0.11, 0.13, -0.01, 0.01, 8 + z, 9 + z, bk);
      if (fly) { B(-0.04, 0.03, -0.14, -0.05, 6 + z, 7 + z, g); B(-0.04, 0.03, 0.05, 0.14, 6 + z, 7 + z, g); }
      else { B(-0.01, 0.01, -0.03, -0.01, 0, 2, bk); B(-0.01, 0.01, 0.01, 0.03, 0, 2, bk); }
    }
    let a = null;
    for (const p of parts) a = a ? { i0: Math.min(a.i0, p.i0), i1: Math.max(a.i1, p.i1), j0: Math.min(a.j0, p.j0), j1: Math.max(a.j1, p.j1), z0: Math.min(a.z0, p.z0), z1: Math.max(a.z1, p.z1) } : Object.assign({}, p);
    return { parts: depthSort(parts), aabb: a };
  }
  function animalDrawable(an, ox, oy) {
    const fz = Math.round(an.fly || 0);
    const d = cachedDrawable('a|' + an.kind + '|' + an.facing + '|' + (an.step || 0) + '|' + an.pose + '|' + fz, an, (i, j) => animalParts(an.kind, i, j, an.facing, an.step, an.pose, fz), ox, oy, 6);
    d.animal = an; return d;
  }
  const FOLK_LINES = ['今天天氣真好～', '新開的麵包店好香喔！', '咖啡廳的拿鐵很好喝。', '公園的池塘有時候會閃閃發亮耶。', '你也住在這附近嗎？', '週末要不要一起去公園？', '超市今天好像有特價。', '我剛搬來這個城市！', '噴水池晚上很漂亮喔。', '聽說公園裡藏著四葉草……'];
  const BUB = ['♪', '…', '♥', '!', '?', '♫'];
  const NPC_BUB = { mia: ['♪', '…', '♥'], leo: ['♪', '!', '…'], nora: ['…', '♪', '?'], oliver: ['♪', '…', '!'], ethan: ['?', '♪', '…'] };
  const rnd = (a, b) => a + Math.random() * (b - a), pick = arr => arr[Math.floor(Math.random() * arr.length)];
  function randLook() {
    return { skin: Math.floor(Math.random() * M.SKINS.length), hair: pick(['short', 'long', 'bun', 'spiky', 'short', 'long']), hairC: Math.floor(Math.random() * M.HAIRC.length),
      shirt: Math.floor(Math.random() * M.CLOTH.length), pants: Math.floor(Math.random() * M.PANTS.length), shoes: Math.floor(Math.random() * M.SHOES.length) };
  }
  function seatsOf(sc) {
    const out = [];
    for (const it of sc.items) { const d = I[it.t]; if (!d || !d.seat || it.home || it.enter) continue; d.seat.spots.forEach((_, k) => out.push({ it, k, key: it.i + ',' + it.j + ':' + k })); }
    return out;
  }
  function freeCellsOf(sc) {
    if (sc.freeList) return sc.freeList;
    const out = []; for (let i = 0; i < sc.ni; i++) for (let j = 0; j < sc.nj; j++) if (!sc.blocked[i][j]) out.push([i, j]);
    return (sc.freeList = out);
  }
  function seatApproach(sc, it, k) {
    const sp = M.seatSpot(it, k), fv = M.DIRS[sp.facing], front = [Math.floor(sp.i + fv[0] * 0.8), Math.floor(sp.j + fv[1] * 0.8)];
    const ok = c => c[0] >= 0 && c[1] >= 0 && c[0] < sc.ni && c[1] < sc.nj && !sc.blocked[c[0]][c[1]];
    if (ok(front)) return { sp, cell: front };
    for (const [a, b] of S.cellsOf(it)) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = [a + di, b + dj]; if (ok(c)) return { sp, cell: c }; }
    return null;
  }
  function initLife(sc) {
    const L = sc.life = { walkers: [], animals: [], seatsTaken: {} };
    const free = freeCellsOf(sc);
    if (!free.length) return;
    const nW = sc.interior ? (sc.id === 'cafe' ? 2 : 1) : ({ central: 5, commercial: 6, park: 4 }[sc.id] || 3);
    for (let k = 0; k < nW; k++) {
      const c = pick(free), w = { i: c[0] + 0.5, j: c[1] + 0.5, facing: pick(['SW', 'SE', 'NE', 'NW']), step: 0, walkT: 0, path: [], pose: 'stand', look: randLook(), st: 'idle', t: rnd(1, 8), line: pick(FOLK_LINES), spd: rnd(1.0, 1.3) };
      L.walkers.push(w);
      if (sc.interior) folkSit(sc, w, true);
    }
    if (!sc.interior) {
      if (sc.id !== 'commercial' || Math.random() < 0.5) { const c = pick(free); L.animals.push({ kind: 'cat', i: c[0] + 0.5, j: c[1] + 0.5, facing: 'SW', step: 0, walkT: 0, path: [], pose: Math.random() < 0.5 ? 'sleep' : 'stand', t: rnd(3, 9) }); }
      const nP = sc.id === 'central' ? 4 : sc.id === 'park' ? 3 : 0;
      const c0 = pick(free);
      for (let k = 0; k < nP; k++) L.animals.push({ kind: 'pigeon', i: c0[0] + rnd(0.2, 0.8) + (k % 2), j: c0[1] + rnd(0.2, 0.8) + (k >> 1), facing: pick(['SW', 'SE', 'NE', 'NW']), step: 0, walkT: 0, path: [], pose: 'stand', t: rnd(1, 4), home: c0 });
    }
  }
  function folkSit(sc, w, instant) {
    const L = sc.life, seats = seatsOf(sc).filter(s => !L.seatsTaken[s.key] && !(me.pose === 'sit' && me.seatKey === s.key));
    if (!seats.length) return false;
    const s = pick(seats), ap = seatApproach(sc, s.it, s.k); if (!ap) return false;
    L.seatsTaken[s.key] = w; w.seat = s;
    const sit = () => { w.pose = 'sit'; w.i = ap.sp.i; w.j = ap.sp.j; w.facing = ap.sp.facing; w.seatZ = ap.sp.z; w.stand = ap.cell; w.st = 'sit'; w.t = rnd(12, 30); };
    if (instant) { sit(); return true; }
    const p = W_().bfs(sc.blocked, sc.ni, sc.nj, cellOf(w), ap.cell);
    if (!p) { delete L.seatsTaken[s.key]; w.seat = null; return false; }
    w.path = p.slice(1); w.st = 'walk'; w.onArrive = sit; return true;
  }
  function folkStand(sc, w) {
    if (w.pose !== 'sit') return;
    w.pose = 'stand'; w.seatZ = 0; w.head = null; if (w.seat) delete sc.life.seatsTaken[w.seat.key]; w.seat = null;
    const c = w.stand || cellOf(w); w.i = c[0] + 0.5; w.j = c[1] + 0.5;
  }
  function stepEnt(e, dt, speed) {
    if (!e.path.length) { e.step = 0; return; }
    const [ci, cj] = e.path[0], ti = ci + 0.5, tj = cj + 0.5, di = ti - e.i, dj = tj - e.j, dist = Math.hypot(di, dj), sp = speed * dt;
    e.head = null; if (Math.abs(di) > Math.abs(dj)) e.facing = di > 0 ? 'SE' : 'NW'; else if (dist > 1e-6) e.facing = dj > 0 ? 'SW' : 'NE';
    if (dist <= sp) { e.i = ti; e.j = tj; e.path.shift(); if (!e.path.length) { e.step = 0; const f = e.onArrive; e.onArrive = null; if (f) f(); return; } }
    else { e.i += di / dist * sp; e.j += dj / dist * sp; }
    e.walkT += dt; e.step = Math.floor(e.walkT * speed / 0.26) % 2 ? 1 : -1;
  }
  const OPP = { SW: 'NE', NE: 'SW', SE: 'NW', NW: 'SE' };
  const dirTo = (e, i, j) => { const di = i - e.i, dj = j - e.j; return Math.abs(di) > Math.abs(dj) ? (di > 0 ? 'SE' : 'NW') : (dj > 0 ? 'SW' : 'NE'); };
  function lookAt(e, i, j) { const d = dirTo(e, i, j); if (d === OPP[e.facing]) { e.facing = d; e.head = null; } else e.head = d === e.facing ? null : d; }
  function lookDir(e, d) { if (d === OPP[e.facing]) return; e.head = d === e.facing ? null : d; }
  const SIDE = { SW: ['SE', 'NW'], NE: ['SE', 'NW'], SE: ['SW', 'NE'], NW: ['SW', 'NE'] };
  function faceTo(e, i, j) { const di = i - e.i, dj = j - e.j; e.facing = Math.abs(di) > Math.abs(dj) ? (di > 0 ? 'SE' : 'NW') : (dj > 0 ? 'SW' : 'NE'); }
  function say(e, text, sec) { e.bub = { text, until: performance.now() + (sec || 2.2) * 1000 }; }
  // ---- 路人：每個人都有「要去哪、去做什麼」，到了會停下來做事，不會一直亂走 ----
  function folkGoals(sc) {
    if (sc.folkGoals) return sc.folkGoals;
    const ok = c => c[0] >= 0 && c[1] >= 0 && c[0] < sc.ni && c[1] < sc.nj && !sc.blocked[c[0]][c[1]];
    const doors = [], exits = [];
    for (const it of sc.items) {
      const dc = W_().doorCellOf(it); if (!dc) continue;
      const cand = [dc, [dc[0] + 1, dc[1]], [dc[0] - 1, dc[1]], [dc[0], dc[1] + 1], [dc[0], dc[1] - 1]].filter(ok);
      if (cand.length) doors.push({ cell: cand[0], look: dc, canEnter: !!it.enter });
    }
    for (const ex of sc.exits || []) for (const c of ex.cells) if (ok(c)) exits.push(c);
    if (!sc.interior && !exits.length) {   // 沒有出口的場景：用地圖邊緣當「走出畫面」的地方
      for (let i = 0; i < sc.ni; i++) for (const j of [0, sc.nj - 1]) if (ok([i, j])) exits.push([i, j]);
    }
    return (sc.folkGoals = { doors, exits });
  }
  function folkGo(sc, w, tgt, after) {
    const p = W_().bfs(sc.blocked, sc.ni, sc.nj, cellOf(w), tgt);
    if (!p) return false;
    if (p.length < 2) { after(); return true; }
    w.path = p.slice(1); w.st = 'walk'; w.onArrive = after; return true;
  }
  function folkLinger(w, sec, lookCell) { w.st = 'idle'; w.t = sec; w.lookHome = null; if (lookCell) { faceTo(w, lookCell[0] + 0.5, lookCell[1] + 0.5); w.lookHome = w.facing; } }
  function folkHide(w, sec) { w.hidden = true; w.st = 'away'; w.t = sec; w.path = []; w.bub = null; }
  function folkThink(sc, w, dt, free) {
    if (w.st === 'walk') { stepEnt(w, dt, w.spd || 1.15); if (!w.path.length && w.st === 'walk') folkLinger(w, rnd(4, 8)); return; }
    if (w.st === 'chat') { w.t -= dt; if (w.t <= 0) w.st = w.pose === 'sit' ? 'sit' : 'idle'; return; }
    w.t -= dt;
    if (w.st === 'away') {   // 在店裡／離開了：時間到從門口或出口重新出現
      if (w.t > 0) return;
      const G = folkGoals(sc);
      let c = w.back;
      if (!c) { c = G.exits.length ? pick(G.exits) : pick(free); w.look = randLook(); w.line = pick(FOLK_LINES); w.spd = rnd(1.0, 1.3); }
      w.i = c[0] + 0.5; w.j = c[1] + 0.5; w.hidden = false; w.back = null; w.st = 'idle'; w.t = 0; return;
    }
    // 站著時偶爾看看四周，看完會轉回原本在看的方向
    if (w.st === 'idle') {
      if (w.glance > 0) { w.glance -= dt; if (w.glance <= 0) w.head = null; }
      else if (Math.random() < dt * 0.08) { lookDir(w, pick(SIDE[w.facing])); w.glance = rnd(1, 2.5); }
    }
    if (Math.random() < dt * 0.03) say(w, pick(BUB));
    if (w.t > 0) return;
    if (w.next) { const f = w.next; w.next = null; f(); return; }
    if (w.st === 'sit') { folkStand(sc, w); folkLinger(w, rnd(1, 2.5)); return; }
    const G = folkGoals(sc), r = Math.random();
    if (sc.interior) {
      if (r < 0.75 && folkSit(sc, w)) return;
      if (r < 0.8 && G.exits.length && folkGo(sc, w, pick(G.exits), () => { folkHide(w, rnd(10, 25)); })) return;
    } else {
      // 去店門口看看，有一半機率走進去逛一下
      if (r < 0.35 && G.doors.length) {
        const d = pick(G.doors);
        if (folkGo(sc, w, d.cell, () => {
          folkLinger(w, rnd(5, 10), d.look);
          if (d.canEnter && Math.random() < 0.5) { w.t = rnd(1.5, 3); w.next = () => { w.back = d.cell; folkHide(w, rnd(10, 25)); }; }
          else if (Math.random() < 0.3) say(w, pick(['♪', '!', '…']));
        })) return;
      }
      if (r < 0.55 && folkSit(sc, w)) return;
      // 走出畫面（之後會有新的路人從出口進來）
      if (r < 0.75 && G.exits.length && folkGo(sc, w, pick(G.exits), () => folkHide(w, rnd(6, 16)))) return;
    }
    // 散步到稍遠的地方，停下來休息一下
    const here = cellOf(w), near = free.filter(c => { const d = Math.abs(c[0] - here[0]) + Math.abs(c[1] - here[1]); return d >= (sc.interior ? 2 : 4) && d <= (sc.interior ? 5 : 11); });
    if (!folkGo(sc, w, near.length ? pick(near) : pick(free), () => folkLinger(w, rnd(6, 14)))) w.t = rnd(2, 4);
  }
  let idleT = 0, lookT = 0;
  function updateLife(dt) {
    if (!wsc) return;
    if (!wsc.life) initLife(wsc);
    const L = wsc.life, sc = wsc, free = freeCellsOf(sc);
    for (const w of L.walkers) folkThink(sc, w, dt, free);
    for (const a of L.animals) {
      const dme = Math.hypot(a.i - me.i, a.j - me.j);
      if (a.kind === 'pigeon') {
        if (a.flying) {   // 飛走、過一陣子回來
          a.fly += dt * 60; a.i += a.vx * dt; a.j += a.vy * dt;
          if (a.fly > 160) { a.flying = false; a.gone = rnd(6, 14); a.fly = 0; }
          continue;
        }
        if (a.gone > 0) { a.gone -= dt; if (a.gone <= 0) { const c = a.home; a.i = c[0] + rnd(0.1, 1.9); a.j = c[1] + rnd(0.1, 1.9); if (dme < 3) a.gone = 3; } continue; }
        if (dme < 1.6) { a.flying = true; a.fly = 0; const k = Math.max(0.3, dme); a.vx = (a.i - me.i) / k * 3; a.vy = (a.j - me.j) / k * 3; sfx('tap'); continue; }
        stepEnt(a, dt, 0.8);
        a.t -= dt; if (a.t <= 0) { a.t = rnd(0.8, 3); if (Math.random() < 0.5) a.facing = pick(['SW', 'SE', 'NE', 'NW']); else { a.step = a.step ? 0 : 1; } }
        continue;
      }
      // 貓：睡覺、散步、偶爾跟著玩家
      if (a.path.length) { stepEnt(a, dt, a.chase ? 2.2 : 1.1); continue; }
      a.t -= dt; if (a.t > 0) continue;
      if (a.pose === 'sleep') { a.pose = 'stand'; a.t = rnd(1, 3); continue; }
      const r = Math.random();
      if (r < 0.25) { a.pose = 'sleep'; a.t = rnd(8, 20); continue; }
      const here = cellOf(a), tgt = r < 0.4 && dme < 7 ? cellOf(me) : pick(free.filter(c => Math.abs(c[0] - here[0]) + Math.abs(c[1] - here[1]) <= 6) || free);
      const p = tgt && W_().bfs(sc.blocked, sc.ni, sc.nj, here, tgt);
      a.chase = r < 0.4; if (p && p.length > 1) a.path = p.slice(1, a.chase ? -1 : undefined); a.t = rnd(2, 6);
    }
    // 有名字的居民：玩家靠近會轉頭看你，偶爾冒泡泡
    for (const n of sc.npcs || []) {
      if (Math.hypot(n.i - me.i, n.j - me.j) < 2.6) { n.lookAt = true; const d = dirTo(n, me.i, me.j); n.head = d === n.facing || d === OPP[n.facing] ? null : d; }
      else if (n.lookAt) { n.lookAt = false; n.head = null; }
      else if (Math.random() < dt * 0.12) n.head = n.head ? null : pick(SIDE[n.facing]);
      if (Math.random() < dt * 0.05) say(n, pick(NPC_BUB[n.id] || BUB));
    }
    // 玩家站著發呆太久，會自己東張西望
    if (me.path.length || me.pose === 'sit') idleT = 0; else idleT += dt;
    if (idleT > 7) { lookT -= dt; if (lookT <= 0) { lookT = rnd(3, 6); me.head = me.head ? null : pick(SIDE[me.facing]); } }
    dirty = true;
  }
  function lifeDrawables(sc) {
    const out = [];
    if (!sc.life) return out;
    for (const w of sc.life.walkers) { if (w.hidden) continue; const d = npcDrawable(w, w.look, sc.ox, sc.oy); d.walker = w; out.push(d); }
    for (const a of sc.life.animals) if (!(a.kind === 'pigeon' && a.gone > 0)) out.push(animalDrawable(a, sc.ox, sc.oy));
    return out;
  }
  function drawBubbles(sc) {
    const now = performance.now(), ents = (sc.life ? sc.life.walkers.concat(sc.life.animals) : []).concat(sc.npcs || []);
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const e of ents) {
      if (!e.bub || e.bub.until < now || e.hidden) continue;
      const h = e.kind ? 30 : (e.pose === 'sit' ? 92 : 100);
      const x = Math.round(sc.ox + (e.i - e.j) * TW / 2 - cam[0]), y = Math.round(sc.oy + (e.i + e.j) * TH / 2 - h - cam[1]);
      const w = Math.max(20, ctx.measureText(e.bub.text).width + 12);
      ctx.fillStyle = '#fffdf6'; ctx.strokeStyle = '#2b2a33'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - 10, w, 20, 8) : ctx.rect(x - w / 2, y - 10, w, 20); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 4, y + 9); ctx.lineTo(x, y + 15); ctx.lineTo(x + 4, y + 9); ctx.fill();
      ctx.fillStyle = '#2b2a33'; ctx.fillText(e.bub.text, x, y + 1);
    }
    ctx.textBaseline = 'alphabetic';
  }
  // 玩家被前面的東西擋住時，把被擋住的部分畫成半透明剪影
  const xrC = document.createElement('canvas'), xrX = xrC.getContext('2d', { willReadFrequently: true });
  function xray(ord, meD, cx, cy) {
    const k = ord.indexOf(meD); if (k < 0) return;
    const s = meD.spr, occ = [];
    for (let q = k + 1; q < ord.length; q++) { const o = ord[q]; if (o.isChar || o.pickup || o.animal) continue; if (overlapScr(o, meD)) occ.push(o); }
    if (!occ.length) return;
    xrC.width = s.pix.w; xrC.height = s.pix.h;
    xrX.globalCompositeOperation = 'source-over'; xrX.clearRect(0, 0, s.pix.w, s.pix.h);
    for (const o of occ) xrX.drawImage(o.spr.c, o.spr.x - s.x, o.spr.y - s.y);
    xrX.globalCompositeOperation = 'source-in'; xrX.drawImage(s.c, 0, 0);
    // 被擋住的像素太少（例如只遮到腳尖）就不畫
    const dd = xrX.getImageData(0, 0, s.pix.w, s.pix.h).data; let n = 0, tot = 0;
    for (let p = 3; p < dd.length; p += 4) if (dd[p]) n++;
    for (let p = 0; p < s.pix.d.length; p++) if (s.pix.d[p]) tot++;
    if (n < Math.max(30, tot * 0.08)) return;
    xrX.globalCompositeOperation = 'source-atop'; xrX.fillStyle = 'rgba(110,190,255,0.55)'; xrX.fillRect(0, 0, s.pix.w, s.pix.h);
    ctx.globalAlpha = 0.75; ctx.drawImage(xrC, s.x - cx, s.y - cy); ctx.globalAlpha = 1;
  }
  function cityTap(x, y) {
    if (fading) return;
    const wx = x + cam[0], wy = y + cam[1];
    { const a0 = (wx - wsc.ox) / (TW / 2), b0 = (wy - wsc.oy) / (TH / 2), gi = (a0 + b0) / 2, gj = (b0 - a0) / 2;
      const pk = (wsc.pickups || []).find(p => Math.abs(p.i + 0.5 - gi) < 0.75 && Math.abs(p.j + 0.5 - gj) < 0.75);
      if (pk) return tapPickup(pk); }
    const h = hitAt(wx, wy);
    if (h && h.pickup) return tapPickup(h.pickup);
    if (h && h.walker) { const w = h.walker; if (w.st !== 'sit') { w.path = []; w.onArrive = null; if (w.seat && w.pose !== 'sit') { delete wsc.life.seatsTaken[w.seat.key]; w.seat = null; } } lookAt(w, me.i, me.j); w.st = 'chat'; w.t = 3; w.glance = 3; say(w, '嗨！', 1.5); lookAt(me, w.i, w.j); toast('路人：' + w.line); w.line = pick(FOLK_LINES); sfx('tap'); return; }
    if (h && h.animal) { const a = h.animal; if (a.kind === 'cat') { say(a, a.pose === 'sleep' ? 'Zzz' : '喵～', 1.6); if (a.pose !== 'sleep') faceTo(a, me.i, me.j); toast(a.pose === 'sleep' ? '貓咪睡得正香……' : '貓咪看著你。喵～'); } else toast('咕咕～'); return; }
    if (h && h.npc) return walkNear(h.npc.talkFrom, () => { const n = h.npc; me.facing = 'NE'; dirty = true; talkTo(n.id); });
    if (h && h.item) return cityInteract(h.item);
    if (h && h.isChar) { toast('嗨，' + st.name + '！'); return; }
    if (wsc.interior) {
      const w = toWallAt(wx, wy, wsc.ox, wsc.oy), dr = wsc.room.door;
      if (w && w.side === dr.side && w.u >= dr.u && w.u <= dr.u + S.DOOR_W && w.z <= S.DOOR_H + 6) { walkNear([S.doorCell(dr)], leaveInterior); return; }
      if (w && wsc.id === 'furniture') {
        const wi = wsc.room.walls.find(x => x.shop && x.side === w.side && w.u >= x.u && w.u <= x.u + I[x.t].W && w.z >= I[x.t].z0 - 6 && w.z <= I[x.t].z1 + 6);
        if (wi) { const c = w.side === 'R' ? [Math.min(S.NI - 1, Math.floor(wi.u + I[wi.t].W / 2)), 0] : [0, Math.min(S.NJ - 1, Math.floor(wi.u + I[wi.t].W / 2))]; walkNear([c], () => { me.facing = w.side === 'R' ? 'NE' : 'NW'; dirty = true; openProduct(wi); }); return; }
      }
      if (wsc.id === 'furniture') {
        const a0 = (wx - wsc.ox) / (TW / 2), b0 = (wy - wsc.oy) / (TH / 2), gc = [Math.floor((a0 + b0) / 2), Math.floor((b0 - a0) / 2)];
        const rug = wsc.room.items.find(x => x.shop && I[x.t].kind === 'rug' && S.cellsOf(x).some(q => q[0] === gc[0] && q[1] === gc[1]));
        if (rug && !wsc.blocked[gc[0]][gc[1]]) { cityWalk(gc, () => openProduct(rug)); return; }
      }
    }
    const a = (wx - wsc.ox) / (TW / 2), b = (wy - wsc.oy) / (TH / 2), c = [Math.floor((a + b) / 2), Math.floor((b - a) / 2)];
    if (c[0] < 0 || c[1] < 0 || c[0] >= wsc.ni || c[1] >= wsc.nj) return;
    // 撿拾物很小：點到它所在（或旁邊）的格子也算點到
    const pk = (wsc.pickups || []).find(p => Math.abs(p.i - c[0]) <= 0 && Math.abs(p.j - c[1]) <= 0) || (wsc.pickups || []).find(p => Math.abs(p.i + 0.5 - (a + b) / 2) < 0.9 && Math.abs(p.j + 0.5 - (b - a) / 2) < 0.9);
    if (pk) return tapPickup(pk);
    const ex = (wsc.exits || []).find(e => e.cells.some(q => q[0] === c[0] && q[1] === c[1]));
    if (ex) { if (!cityWalk(c, () => fadeTo(() => enterScene(ex.to, ex.spawn, ex.facing)))) toast('那裡走不過去'); return; }
    if (!cityWalk(c)) toast('那裡走不過去');
  }
  function cityInteract(o) {
    const d = I[o.t];
    if (o.shop) return walkNear(S.cellsOf(o), () => { faceTo(me, o.i + 0.5, o.j + 0.5); dirty = true; openProduct(o); });
    // 點櫃台這類家具時，如果緊鄰著 NPC，就去跟 NPC 說話（NPC 常被櫃台擋住下半身）
    for (const n of wsc.npcs || []) {
      const ni = Math.floor(n.i), nj = Math.floor(n.j);
      if (S.cellsOf(o).some(([a, b]) => Math.max(Math.abs(a - ni), Math.abs(b - nj)) === 1)) return walkNear(n.talkFrom, () => { me.facing = 'NE'; dirty = true; talkTo(n.id); });
    }
    const door = W_().doorCellOf(o);
    if (o.home) return walkNear([door], goHome);
    if (o.enter) return walkNear([door], () => fadeTo(() => enterScene(o.enter, [1, 0], 'SW')));
    if (o.closed) return walkNear(door ? [door] : S.cellsOf(o), () => toast(o.closed));
    if (d.seat && !o.home && !o.enter) return sitOn(o);
    if (o.harvest) return tapHarvest(o);
    if (o.search) return tapSearch(o);
    if (o.deco) return;
    walkNear(S.cellsOf(o), () => toast(o.talk || d.name));
  }
  function sitOn(o) {
    const d = I[o.t];
    {
      const taken = (wsc.life && wsc.life.seatsTaken) || {};
      const ks = d.seat.spots.map((_, k) => k).filter(k => !taken[o.i + ',' + o.j + ':' + k])
        .sort((a, b) => { const p = M.seatSpot(o, a), q = M.seatSpot(o, b); return Math.hypot(p.i - me.i, p.j - me.j) - Math.hypot(q.i - me.i, q.j - me.j); });
      if (!ks.length) { toast('位子都被坐走了'); return; }
      for (const k of ks) {
        const sp = M.seatSpot(o, k), fv = M.DIRS[sp.facing], front = [Math.floor(sp.i + fv[0] * 0.8), Math.floor(sp.j + fv[1] * 0.8)];
        for (const c of nearCells([front].concat(S.cellsOf(o)))) if (cityWalk(c, () => {
          if (taken[o.i + ',' + o.j + ':' + k]) { toast('剛好被別人坐走了'); return; }
          me.pose = 'sit'; me.i = sp.i; me.j = sp.j; me.facing = sp.facing; me.seatZ = sp.z; me.stand = c; me.seatKey = o.i + ',' + o.j + ':' + k; dirty = true;
          if (o.search) sitSearch(o);
        })) return;
      }
      toast('走不過去'); return;
    }
  }
  // ---------------- NPC 對話 ----------------
  const NPC_TALK = {
    hazel: {
      first: '歡迎光臨！我是 Hazel，這間家具店是我開的。店裡擺的家具都可以摸、可以坐，點一下就看得到價錢。店裡沒擺出來的，翻我的型錄也買得到喔！',
      greet: ['今天的展示換過了，逛逛看吧！', '歡迎光臨～找什麼樣的家具呢？', '紅色價格牌的是今天的特價品喔。'],
      tired: '', chat: ['每天我都會換一個系列擺出來，今天是哪一系列呢？', '沙發一定要坐坐看才知道舒不舒服。', '同一系列的家具擺在一起，房間會特別有感覺。', '地毯不擋路，可以放在桌子下面。', '聽說公園的倒木可以做成家具……我還在研究。'],
      jobLabel: '', firstJob: '', extra: [['📖 看型錄（全部家具）', 'catalog']],
    },
    leo: {
      first: '歡迎光臨！我是 Leo，這間麵包店的師傅。每天早上要烤好幾百個麵包，分類包裝常常忙不過來……可以來幫忙嗎？偶爾也要外送喔。',
      greet: ['剛出爐的可頌，香吧？', '今天也來幫忙分類嗎？', '外送單又來了，有空的話幫我跑一趟！'],
      tired: '今天的麵包都賣完啦，謝謝你！明天再來。',
      chat: ['法棍要放長籃，不然會折斷喔。', '扭結麵包的形狀，是我師父教我的。', '每天第一爐麵包，我都會留一個給 Mia。', '烤箱需要好的柴火，公園的大樹下有時候撿得到樹枝。'],
      jobLabel: '我來分類包裝', firstJob: '好，我來幫忙！', extra: [['有外送單嗎？', 'deliver']],
    },
    nora: {
      first: '嗨嗨！我是 Nora，在超市顧收銀。客人一多就排好長的隊……你算數好嗎？要不要來幫忙結帳？',
      greet: ['歡迎光臨～要買什麼嗎？', '收銀台今天也很忙喔！', '嗨！要不要來幫忙結帳？'],
      tired: '今天的班都排滿了，謝謝你幫忙！明天見。',
      chat: ['蘋果今天特價喔！', '找錢的時候先用大的硬幣，會比較快。', '我其實很想去公園的涼亭野餐。', '聽說公園的倒木上長了好多蘑菇。'],
      jobLabel: '我來幫忙結帳', firstJob: '交給我吧！',
    },
    ethan: {
      first: '欸，你好！我是 Ethan，住在這附近。我很喜歡在城市裡到處亂逛，常常撿到奇怪的東西……也常常把東西弄丟就是了。',
      greet: ['今天有什麼新發現嗎？', '嘿！又見面了。', '這座城市每天都有不一樣的地方。'],
      tired: '', chat: ['噴水池裡好像有人丟過古金幣許願。', '晚上的時候我喜歡坐在廣場看星星。', '信箱裡偶爾會卡著舊明信片，不知道是誰寄的。', '我白天常在公園池塘邊發呆。'],
      jobLabel: '', firstJob: '',
    },
    mia: {
      first: '嗨，你是新搬來的吧？我是 Mia，這間咖啡廳的老闆。最近客人好多，我一個人忙不過來……要不要來幫忙打工？做得好薪水就高喔！',
      greet: ['歡迎光臨～今天也來幫忙嗎？', '你來得正好，外面排了好多客人！', '嗨！今天想打工還是坐下來休息？'],
      tired: '今天辛苦啦！完整薪水明天再發，不過想練習的話還是可以來喔。',
      chat: ['城市公園已經開放了！池塘邊的花叢可以採花喔。', '拿鐵和卡布奇諾的差別？卡布奇諾多了一層綿綿的奶泡。', '早上的客人最多，大家都要一杯熱美式才醒得過來。', '你的房間佈置得怎麼樣了？有空帶我去參觀！', '焦糖拿鐵是我的私房招牌，等你更熟練再教你。', '常來打工的話，說不定會拿到我做的點心喔。'],
      jobLabel: '我要打工', firstJob: '好啊，我來幫忙！',
    },
    oliver: {
      first: '喔，新面孔！我是 Oliver，負責照顧這座公園。最近遊客亂丟垃圾，我一個人撿不完……可以幫我清理一下嗎？當然會付你薪水。',
      greet: ['今天的公園也很漂亮吧？', '嘿！要幫忙清理公園嗎？', '花叢的花每天都會重新開，記得來採喔。'],
      tired: '今天已經很乾淨了，謝謝你！明天再來幫忙吧。',
      chat: ['池塘邊的大石頭底下，聽說有人撿過古老的羅盤。', '大樹下有時候會掉橡實，搖一搖試試看。', '涼亭是這座城市最老的建築之一喔。', '四葉草很難找，但香草叢裡偶爾會冒出來。', '晚上的公園偶爾會有閃閃發亮的星星碎片。'],
      jobLabel: '我來幫忙清理', firstJob: '交給我吧！',
    },
  };
  function jobState(job) {
    job = job || 'cafe'; st.jobs = st.jobs || {};
    const j = st.jobs[job] = st.jobs[job] || { xp: 0, day: 0, paid: 0 };
    if (j.day !== dayNum()) { j.day = dayNum(); j.paid = 0; }
    return j;
  }
  function portrait(look) {
    const pix = new Pix(70, 70), iso = new Iso(pix, 35, 100);   // 取景：頭＋上半身
    for (const pp of M.charParts(0, 0, 'SW', 0, look, 'stand').parts) pp.draw(iso);
    return toCanvas(pix);
  }
  function talkTo(id) {
    const n = W_().NPCS[id], T = NPC_TALK[id]; st.met = st.met || {};
    const first = !st.met[id], j = jobState(n.job);
    let text, opts;
    if (first) { text = T.first; opts = n.job ? [[T.firstJob, 'job'], ['先聊聊天', 'chat'], ['下次再說', 'bye']] : (T.extra || []).concat([['聊聊天', 'chat'], ['你好！', 'bye']]); st.met[id] = 1; save(false); }
    else { text = n.job && j.paid >= CafeJob.DAILY_PAID ? T.tired : T.greet[Math.floor(Math.random() * T.greet.length)]; opts = (n.job ? [[T.jobLabel, 'job']] : []).concat(T.extra || [], [['聊聊天', 'chat']]); }
    st.req = st.req || {}; if (!first && REQS[id] && st.req[id] !== 'done') opts.push([st.req[id] === 'active' ? '委託：' + REQS[id].title : '有什麼需要幫忙的嗎？', 'req']);
    if (!first) opts.push(['再見', 'bye']);
    showTalk(n, text, opts);
    sfx('talk'); emit('TALK', { npc: id });
  }
  function showTalk(n, text, opts) {
    const box = $('#mTalk'), T = NPC_TALK[n.id];
    const pc = $('#talkPic'); pc.innerHTML = ''; pc.appendChild(portrait(n.look));
    $('#talkName').textContent = n.name; $('#talkRole').textContent = n.role; $('#talkText').textContent = text;
    const ob = $('#talkOpts'); ob.innerHTML = '';
    for (const [label, act] of opts) {
      const b = document.createElement('button'); b.textContent = label; if (act === 'job') b.className = 'pri';
      b.onclick = () => {
        if (act === 'bye') { box.classList.remove('show'); return; }
        if (act === 'chat') { showTalk(n, T.chat[Math.floor(Math.random() * T.chat.length)], (n.job ? [[T.jobLabel, 'job']] : []).concat([['再見', 'bye']])); return; }
        if (act === 'req') { talkReq(n); return; }
        if (act === 'catalog') { box.classList.remove('show'); shopCat = 'all'; openShop(); return; }
        if (act === 'reqdone') { finishReq(n); return; }
        if (act === 'deliver') { if (deliver) { showTalk(n, '你手上已經有一個包裹在送了喔！送到「' + deliver.sp.name + '」。', [['好', 'bye']]); return; } startDelivery(n); return; }
        if (act === 'job') { box.classList.remove('show'); startJob(n); }
      };
      ob.appendChild(b);
    }
    box.classList.add('show');
  }
  let jobRun = null;
  function payJob(n, job, r) {
    const j = jobState(job);
    j.xp += r.xp; if (r.paid) j.paid++;
    if (r.coins) sfx('coin'); if (r.levelUp) sfx('level');
    st.coins += r.coins; st.stats = st.stats || {}; st.stats.jobs = (st.stats.jobs || 0) + (r.served ? 1 : 0);
    emit('JOB', { job, served: r.served, correct: r.correct, coins: r.coins });
    let bonus = '';
    const b = r.served ? Explore.jobBonus(st, job, r.score) : null;
    if (b && b.first) emit('COLLECT', { n: 1 });
    if (b) { bonus = `\n（還送你一個${Explore.COLLECT[b.item].name}！${b.first ? '已加入收藏圖鑑' : ''}）`; sfx('pickup'); }
    save(); refreshHud(); dirty = true;
    const line = r.coins ? `辛苦了！這是你的薪水 ${r.coins} 金幣。` : (r.served ? '謝謝你來幫忙！今天的薪水已經發完了，明天再來喔。' : '沒關係，下次再來試試看！');
    showTalk(n, line + bonus + (r.levelUp ? `\n你越來越熟練了，升到 Lv.${CafeJob.levelOf(j.xp)}！` : ''), [['再做一次', 'job'], ['好的，再見', 'bye']]);
  }
  function startJob(n) {
    if (n.job === 'park') return startParkJob(n);
    if (n.job === 'bakery' || n.job === 'market') {
      const jb = jobState(n.job), m2 = $('#mJob'); m2.classList.add('show');
      const open = n.job === 'bakery' ? Jobs2.openBakery : Jobs2.openCashier;
      jobRun = open($('#jobRoot'), { xp: jb.xp, paidToday: jb.paid }, r => { m2.classList.remove('show'); jobRun = null; payJob(n, n.job, r); });
      return;
    }
    const j = jobState('cafe'), m = $('#mJob');
    m.classList.add('show');
    jobRun = CafeJob.open($('#jobRoot'), { xp: j.xp, paidToday: j.paid }, r => { m.classList.remove('show'); jobRun = null; payJob(n, 'cafe', r); });
  }
  // ---------------- NPC 委託（一次性） ----------------
  const REQS = {
    mia: { title: '花瓣裝飾', ask: '店裡想擺點花，可以幫我帶 3 份花瓣嗎？公園的花叢可以採喔。', need: { mat: 'mat_flower', n: 3 }, coins: 120, item: 'plant_cafe', thanks: '好漂亮！店裡看起來更溫馨了，這盆植物送你！' },
    oliver: { title: '幸運的四葉草', ask: '傳說公園裡有四葉草……如果你找到了，可以給我看看嗎？（看看就好，不會拿走）', need: { col: 'clover4' }, coins: 200, item: 'sapling', thanks: '真的是四葉草！太幸運了。這棵小樹苗送你，種在房間裡吧。' },
    ethan: { title: '弄丟的鑰匙', ask: '我好像把一把舊鑰匙弄丟了……可能掉在長椅附近？如果你找到了告訴我！', need: { col: 'key_old' }, coins: 150, item: 'street_lamp', thanks: '就是這把！謝謝你～這盞路燈是我做的，放在你房間吧。' },
    leo: { title: '烤箱的柴火', ask: '烤箱的柴火快用完了，可以幫我撿 3 根樹枝嗎？公園的大樹可以搖搖看。', need: { mat: 'mat_wood', n: 3 }, coins: 120, item: 'bread_basket', thanks: '太好了，明天的麵包有著落了！這個麵包籃送你。' },
    nora: { title: '新鮮蘑菇', ask: '超市想進一批蘑菇，你能幫我採 2 份嗎？公園倒木上就有。', need: { mat: 'mat_mushroom', n: 2 }, coins: 120, item: 'basket_stack', thanks: '好新鮮！謝謝你～這疊購物籃送你當擺設，很可愛喔。' },
  };
  function reqOk(r) { return r.need.mat ? (st.mats && st.mats[r.need.mat] || 0) >= r.need.n : !!(st.col && st.col[r.need.col]); }
  function reqProgress(r) { return r.need.mat ? `（目前 ${(st.mats && st.mats[r.need.mat]) || 0} / ${r.need.n}）` : (st.col && st.col[r.need.col] ? '（你已經有了！）' : '（還沒找到）'); }
  function talkReq(n) {
    const r = REQS[n.id]; st.req = st.req || {};
    if (!r || st.req[n.id] === 'done') { showTalk(n, '目前沒有什麼需要幫忙的，謝謝你！', [['再見', 'bye']]); return; }
    if (!st.req[n.id]) { st.req[n.id] = 'active'; save(false); }
    if (reqOk(r)) { showTalk(n, r.ask + '\n' + reqProgress(r), [['交給你！', 'reqdone'], ['等一下', 'bye']]); return; }
    showTalk(n, r.ask + '\n' + reqProgress(r), [['好，我去找找看', 'bye']]);
  }
  function finishReq(n) {
    const r = REQS[n.id]; if (!r || !reqOk(r) || st.req[n.id] === 'done') return;
    if (r.need.mat) st.mats[r.need.mat] -= r.need.n;
    st.req[n.id] = 'done'; st.coins += r.coins; if (r.item && I[r.item]) st.bag[r.item] = (st.bag[r.item] || 0) + 1;
    sfx('level'); save(); refreshHud();
    emit('REQ', { npc: n.id });
    showTalk(n, r.thanks + `\n（金幣 +${r.coins}${r.item && I[r.item] ? '、獲得 ' + I[r.item].name : ''}）`, [['不客氣！', 'bye']]);
  }
  // ---------------- 外送（Leo） ----------------
  let deliver = null;
  const DELIVER_TIME = 180;
  function startDelivery(n) {
    const j = jobState('delivery');
    const spots = W_().DELIVERY, sp = spots[Math.floor(Math.random() * spots.length)];
    deliver = { n, sp, left: DELIVER_TIME, timer: setInterval(() => { if (!deliver) return; deliver.left--; deliverBar(); if (deliver.left <= 0) endDelivery(false); }, 1000) };
    $('#jobBar').style.display = 'flex'; deliverBar();
    showTalk(n, `謝謝！這個包裹要送到「${sp.name}」。地上會有亮亮的標記，走過去點它就好。3 分鐘內送到喔！`, [['出發！', 'bye']]);
  }
  function deliverBar() { if (!deliver) return; const m = Math.floor(deliver.left / 60), s = deliver.left % 60; $('#jobInfo').textContent = `📦 外送到：${deliver.sp.name}　⏱ ${m}:${String(s).padStart(2, '0')}`; }
  function deliverPickups(sc) { return deliver && deliver.sp.scene === sc.id ? [{ kind: 'deliver', t: I.delivery_spot ? 'delivery_spot' : 'sparkle', i: deliver.sp.cell[0], j: deliver.sp.cell[1], key: 'dv' }] : []; }
  function endDelivery(ok) {
    if (!deliver) return;
    const D = deliver; deliver = null; clearInterval(D.timer); $('#jobBar').style.display = 'none';
    if (wsc && wsc.pickups) wsc.pickups = wsc.pickups.filter(p => p.kind !== 'deliver');
    const j = jobState('delivery');
    if (!ok) { toast('時間到了，包裹沒送到……下次再加油！'); emit('JOB', { job: 'delivery', served: 0, correct: 0, coins: 0 }); return; }
    const T = Math.min(100, D.left / (DELIVER_TIME * 0.5) * 100), score = Math.round(70 + 0.2 * T + 10);
    const paid = j.paid < CafeJob.DAILY_PAID, coins = paid ? CafeJob.pay(score, 120) : 0;
    j.xp += 20; if (paid) j.paid++; st.coins += coins; sfx('coin');
    emit('JOB', { job: 'delivery', served: 1, correct: 1, coins });
    save(); refreshHud(); floatText(coins ? '+' + coins : '送達', me.i, me.j);
    toast(coins ? `包裹送達！外送費 ${coins} 金幣（分數 ${score}）` : '包裹送達！今天的外送費已經領完了，謝謝你幫忙');
  }
  // ---------------- 清理公園（在地圖上撿垃圾） ----------------
  let park = null;
  const PARK_TIME = 150, PARK_TRASH = 8;
  function startParkJob(n) {
    if (!wsc || wsc.id !== 'park') return;
    const free = visibleFree(wsc, (i, j) => Math.abs(i - me.i) + Math.abs(j - me.j) <= 3 || (wsc.pickups || []).some(p => p.i === i && p.j === j));
    const kinds = ['trash_bag', 'trash_bottle', 'trash_paper'], trash = [];
    while (trash.length < PARK_TRASH && free.length) { const k = Math.floor(Math.random() * free.length), c = free.splice(k, 1)[0]; trash.push({ kind: 'trash', t: kinds[trash.length % 3], i: c[0], j: c[1], key: 'tr' + trash.length }); }
    park = { n, left: PARK_TIME, picked: 0, total: trash.length, trash, timer: setInterval(parkTick, 1000) };
    wsc.pickups = (wsc.pickups || []).filter(p => p.kind !== 'trash').concat(trash);
    $('#jobBar').style.display = 'flex'; parkBar(); dirty = true;
    toast('公園裡有 ' + trash.length + ' 個垃圾，點垃圾就會走過去撿起來！');
  }
  function parkBar() { if (!park) return; const m = Math.floor(park.left / 60), s = park.left % 60; $('#jobInfo').textContent = `🧹 清理公園　⏱ ${m}:${String(s).padStart(2, '0')}　🗑 ${park.picked} / ${park.total}`; }
  function parkTick() { if (!park) return; park.left--; parkBar(); if (park.left <= 0) endParkJob(false); }
  function endParkJob(quit) {
    if (!park) return;
    const P = park; park = null; clearInterval(P.timer); $('#jobBar').style.display = 'none';
    if (wsc && wsc.pickups) wsc.pickups = wsc.pickups.filter(p => p.kind !== 'trash');
    const all = P.picked >= P.total;
    const A = P.picked / P.total * 100, T = all ? Math.min(100, P.left / (PARK_TIME * 0.5) * 100) : 0, C = all ? 100 : A;
    const score = Math.round(0.7 * A + 0.2 * T + 0.1 * C), j = jobState('park');
    const paid = j.paid < CafeJob.DAILY_PAID && P.picked > 0, coins = paid ? CafeJob.pay(score, 80) : 0, xp = P.picked * 10;
    const levelUp = CafeJob.levelOf(j.xp + xp) > CafeJob.levelOf(j.xp);
    dirty = true;
    if (!P.n || !wsc || wsc.id !== 'park') { payJob(P.n, 'park', { served: P.picked, correct: P.picked, score, coins, xp, paid, levelUp }); $('#mTalk').classList.remove('show'); toast(`清理中斷：撿了 ${P.picked} 個，薪水 ${coins} 金幣`); return; }
    toast(`${quit ? '提早結束' : all ? '全部清乾淨了！' : '時間到！'}　撿了 ${P.picked}/${P.total}　分數 ${score}`);
    payJob(P.n, 'park', { served: P.picked, correct: P.picked, score, coins, xp, paid, levelUp });
  }
  $('#jobQuit').onclick = () => { if (park) endParkJob(true); else if (deliver) endDelivery(false); };
  // ---------------- 探索：閃光物品、採集、調查 ----------------
  const floats = [];
  function floatText(text, i, j) { floats.push({ text, i, j, t0: performance.now() }); dirty = true; }
  const colName = id => (Explore.COLLECT[id] || Explore.MATS[id] || {}).name || id;
  function gotItem(res, where) {
    if (!res) return;
    if (res.coins) { st.coins += res.coins; sfx('coin'); floatText('+' + res.coins, me.i, me.j); toast(`撿到 ${res.coins} 金幣！`); }
    if (res.mat) { floatText(colName(res.mat) + ' ×' + res.n, me.i, me.j); }
    if (res.item) { sfx('pickup'); toast(`${where || '找到了'}：${colName(res.item)}！${res.first ? '（新收藏！已加入圖鑑）' : ''}`); }
    if (res.item && res.first) emit('COLLECT', { n: 1 });
    else if (res.mat) { sfx('pickup'); toast(`採到 ${colName(res.mat)} ×${res.n}`); }
    save(); refreshHud();
  }
  // 看得到的空格：自己能走、不是水、不是出口，而且前方三格沒有擋住視線的東西
  function visibleFree(sc, avoid) {
    const out = [], B = sc.blocked, ok = (i, j) => i >= sc.ni || j >= sc.nj || !B[i][j];
    for (let i = 0; i < sc.ni; i++) for (let j = 0; j < sc.nj; j++) {
      if (B[i][j] || sc.tiles[i][j] === 'water' || (sc.exits || []).some(e => e.cells.some(c => c[0] === i && c[1] === j))) continue;
      if (!ok(i + 1, j) || !ok(i, j + 1) || !ok(i + 1, j + 1)) continue;
      if (avoid && avoid(i, j)) continue;
      out.push([i, j]);
    }
    return out;
  }
  function scenePickups(sc) {
    if (sc.interior) return [];
    const free = visibleFree(sc);
    return Explore.sparkles(st, sc.id, free).map(s => Object.assign({ kind: 'sparkle', t: 'sparkle' }, s));
  }
  function refreshHarvest(sc) {
    let changed = false;
    for (const o of sc.items) if (o.harvest) { const on = Explore.harvested(st, sc.id + ':' + o.i + ',' + o.j); if (!!o.on !== on) { o.on = on; changed = true; } }
    if (changed) rebuildParts(sc);
  }
  function rebuildParts(sc) {
    sc.parts = [];
    for (const it of sc.items) if (I[it.t] && I[it.t].kind === 'floor') for (const pp of M.itemParts(it)) sc.parts.push(Object.assign(pp, { spr: spriteOf(pp, 4, sc.ox, sc.oy), item: it }));
  }
  const pickSprites = new Map();
  function pickupDrawables(sc) {
    const out = [], frame = Math.floor(performance.now() / 400) % 2 === 1;
    for (const p of sc.pickups || []) {
      const it = { t: p.t, i: p.i, j: p.j, r: 0, on: p.kind === 'sparkle' ? frame : false };
      const k = sc.id + it.t + it.i + ',' + it.j + (it.on ? 1 : 0);
      let parts = pickSprites.get(k);
      if (!parts) { parts = M.itemParts(it).map(pp => Object.assign(pp, { spr: spriteOf(pp, 4, sc.ox, sc.oy) })); pickSprites.set(k, parts); }
      for (const pp of parts) out.push(Object.assign(Object.create(pp), { pickup: p }));
    }
    return out;
  }
  function tapPickup(p) {
    walkNear([[p.i, p.j]], () => {
      if (!wsc.pickups || !wsc.pickups.includes(p)) return;
      wsc.pickups = wsc.pickups.filter(x => x !== p); dirty = true;
      if (p.kind === 'deliver') { endDelivery(true); return; }
      if (p.kind === 'trash') {
        if (!park) return;
        park.picked++; parkBar(); sfx('pickup'); floatText('🗑 ' + park.picked + '/' + park.total, p.i, p.j);
        if (park.picked >= park.total) endParkJob(false);
        return;
      }
      const res = Explore.pickSparkle(st, p.key, wsc.id);
      gotItem(res, '撿到閃光物品'); emit('PICK', {});
    });
  }
  function tapHarvest(o) {
    const key = wsc.id + ':' + o.i + ',' + o.j;
    walkNear(S.cellsOf(o), () => {
      const res = Explore.harvest(st, o.harvest, key);
      if (!res) { toast(o.t.startsWith('tree') ? '今天已經搖過這棵樹了，明天再來吧' : '今天已經採過了，明天會再長出來'); return; }
      o.on = true; rebuildParts(wsc); dirty = true;
      gotItem(res, '採集時發現'); emit('HARVEST', {});
    });
  }
  function sitSearch(o) {
    const key = wsc.id + ':' + o.t + ':' + o.i + ',' + o.j, d = I[o.t], res = Explore.search(st, o.search, key);
    if (!res || res.again || res.nothing) return;
    setTimeout(() => { gotItem(res, '坐在' + d.name + '上時發現'); emit('SEARCH', {}); }, 600);
  }
  function tapSearch(o) {
    const key = wsc.id + ':' + o.t + ':' + o.i + ',' + o.j, d = I[o.t];
    walkNear(S.cellsOf(o), () => {
      if (o.talk) toast(o.talk);
      const res = Explore.search(st, o.search, key);
      setTimeout(() => {
        if (!res || res.again) { if (!o.talk) toast(d.name + '：今天已經調查過了'); return; }
        if (res.nothing) { if (!o.talk) toast('調查了' + d.name + '……什麼都沒有發現'); return; }
        gotItem(res, '調查' + d.name + '時發現'); emit('SEARCH', {});
      }, o.talk ? 1600 : 0);
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
    if (!ids.length) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = '背包是空的，去商業街的 🛋 家具店買家具吧！（或點房間裡的家具收起來）'; bag.appendChild(e); return; }
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
  // ---------------- 家具店：每天的展示品、價格牌、商品卡 ----------------
  function showroomPick() {
    const day = dayNum(), sets = Object.keys(M.SETS), feat = sets[day % sets.length], sale = saleIds();
    const vis = Object.keys(I).filter(id => !I[id].hidden && I[id].set);
    const floor = vis.filter(id => I[id].kind !== 'wall' && (I[id].set === feat || sale.includes(id)));
    const wall = vis.filter(id => I[id].kind === 'wall' && (I[id].set === feat || sale.includes(id)));
    // 再隨機加兩件別的系列，讓店裡不會全是同一色
    let sd = day * 31 + 7; const others = vis.filter(id => I[id].kind === 'floor' && I[id].set !== feat && !floor.includes(id)).sort();
    for (let k = 0; k < 2 && others.length; k++) { sd = (sd * 9301 + 49297) % 233280; floor.push(others.splice(Math.floor(sd / 233280 * others.length), 1)[0]); }
    // 特價品優先擺，再來主打系列
    floor.sort((a, b) => (sale.includes(b) - sale.includes(a)) || ((I[b].set === feat) - (I[a].set === feat)));
    return { seed: day, featured: feat, floor, wall };
  }
  function drawTags(sc) {
    if (!sc.tags) {
      sc.tags = [];
      for (const it of sc.room.items) {
        if (!it.shop) continue;
        const ps = sc.parts.filter(p => p.item === it);
        let x, y;
        if (ps.length) { const x0 = Math.min(...ps.map(p => p.spr.x)), x1 = Math.max(...ps.map(p => p.spr.x + p.spr.pix.w)); y = Math.min(...ps.map(p => p.spr.y)) + 6; x = (x0 + x1) / 2; }
        else { const [w, d] = M.footprint(I[it.t], it.r); x = sc.ox + (it.i + w / 2 - it.j - d / 2) * TW / 2; y = sc.oy + (it.i + w / 2 + it.j + d / 2) * TH / 2 - 4; }
        sc.tags.push({ it, x, y });
      }
    }
    const sale = saleIds();
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const g of sc.tags) {
      const on = sale.includes(g.it.t), txt = (on ? '🔥' : '') + priceOf(g.it.t), w = ctx.measureText(txt).width + 12, x = Math.round(g.x - cam[0]), y = Math.round(g.y - cam[1]);
      ctx.fillStyle = on ? '#e2574c' : '#fffdf6'; ctx.strokeStyle = '#2b2a33'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - 9, w, 18, 6) : ctx.rect(x - w / 2, y - 9, w, 18); ctx.fill(); ctx.stroke();
      ctx.fillStyle = on ? '#fff' : '#2b2a33'; ctx.fillText(txt, x, y + 1);
    }
    ctx.textBaseline = 'alphabetic';
  }
  let buyItem = null;
  function openProduct(it) {
    const id = it.t, d = I[id]; buyItem = it;
    const pr = priceOf(id), own = (st.bag[id] || 0) + st.room.items.concat(st.room.walls).filter(x => x.t === id).length;
    $('#buyName').textContent = d.name;
    const pic = $('#buyPic'); pic.innerHTML = ''; const t = thumb(id), c = document.createElement('canvas'); c.width = t.width; c.height = t.height; c.getContext('2d').drawImage(t, 0, 0);
    c.style.cssText = 'max-width:130px;max-height:110px;image-rendering:pixelated'; pic.appendChild(c);
    $('#buyMeta').innerHTML = `<span class="tag">${M.SETS[d.set] || ''}</span> ❤ 舒適度 ${d.comfort}${d.seat ? '・可以坐' : ''}${d.toggle ? '・可開關' : ''}${d.kind === 'wall' ? '・掛牆上' : d.kind === 'rug' ? '・地毯' : ''}`;
    $('#buyPrice').innerHTML = `<i class="coin"></i> ${pr}` + (pr !== d.price ? ` <s style="font-size:14px">${d.price}</s> <span style="color:var(--bad);font-size:14px">今日 7 折</span>` : '');
    $('#buyOwn').textContent = (own ? `你已經有 ${own} 件。` : '') + `身上有 ${st.coins} 金幣。`;
    $('#buyBtn').disabled = st.coins < pr; $('#buyBtn').textContent = st.coins < pr ? '金幣不夠' : '買下來';
    $('#buySit').style.display = d.seat && d.kind === 'floor' && mode === 'city' ? '' : 'none';
    $('#mBuy').classList.add('show'); sfx('open');
  }
  function buy(id) {
    const d = I[id], pr = priceOf(id);
    if (st.coins < pr) return false;
    st.coins -= pr; st.bag[id] = (st.bag[id] || 0) + 1; save(false); refreshHud();
    sfx('coin'); emit('BUY', { item: id });
    return true;
  }
  $('#buyBtn').onclick = () => { if (!buyItem) return; const d = I[buyItem.t]; if (buy(buyItem.t)) { toast(`買了 ${d.name}！已經送到你的背包，回家用 🛠 佈置 擺進房間`); openProduct(buyItem); } };
  $('#buySit').onclick = () => { const o = buyItem; $('#mBuy').classList.remove('show'); if (o) sitOn(o); };
  $('#buyCat').onclick = () => { $('#mBuy').classList.remove('show'); if (buyItem) shopCat = I[buyItem.t].cat || 'all'; openShop(); };
  function goFurnitureStore() { $('#mShop').classList.remove('show'); fadeTo(() => enterScene('furniture', [1, 0], 'SW')); }
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
        if (!buy(id)) return;
        toast(`買了 ${d.name}！到 🛠 佈置 裡放進房間`); openShop();
      };
      row.appendChild(b); card.appendChild(row); grid.appendChild(card);
    }
    $('#mShop').classList.add('show');
  }
  $('#bShop').onclick = goFurnitureStore;

  // ---------------- 角色 ----------------
  let draft = null, pvFacing = 0, creating = false;
  const FAC = ['SW', 'SE', 'NE', 'NW'];
  function openLook(isNew) {
    $('#lookRestore').style.display = isNew ? '' : 'none';
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
  $('#lookRestore').onclick = () => { $('#mLook').classList.remove('show'); creating = false; openSettings(); setTimeout(() => $('#restoreIn').focus(), 100); };

  // ---------------- 參觀 ----------------
  let visitTab = 'recent';
  const THEMES = [
    { name: '森林生活', hint: '多用綠植、木頭、藤編家具' }, { name: '粉色夢幻', hint: '粉彩風家具、粉紅壁紙地板' },
    { name: '藍色現代', hint: '藍白配色、電器、簡潔線條' }, { name: '咖啡廳風', hint: '桌椅、植物、溫暖燈光' },
    { name: '溫馨書房', hint: '書櫃、書桌、立燈' }, { name: '繽紛派對', hint: '越多顏色越好！' },
    { name: '小小臥室', hint: '床、床頭櫃、地毯，舒服最重要' }, { name: '復古木頭', hint: '原木家具、格紋地毯、牆上層板' },
  ];
  const weekId = () => 'w' + Quests.weekNum(dayNum());
  const themeNow = () => THEMES[Quests.weekNum(dayNum()) % THEMES.length];
  function myVotes() { st.votes = st.votes || {}; if (st.votes.week !== weekId()) st.votes = { week: weekId(), ids: [] }; return st.votes; }
  $$('#visitTabs button').forEach(b => b.onclick = () => { visitTab = b.dataset.v; $$('#visitTabs button').forEach(x => x.classList.toggle('on', x === b)); loadVisitList(); });
  async function loadVisitList() {
    const list = $('#visitList'); list.innerHTML = '<div class="empty">讀取中…</div>';
    try {
      const recent = await Cloud.recent(200), byId = new Map(recent.map(r => [r.id, r]));
      let rows;
      if (visitTab === 'fav') {
        rows = (st.favs || []).map(f => Object.assign({ n: f.n, c: 0 }, byId.get(f.id) || {}, { id: f.id }));
        if (!rows.length) { list.innerHTML = '<div class="empty">還沒有收藏的房間。參觀時按「⭐ 收藏」就會出現在這裡。</div>'; return; }
      } else if (visitTab === 'theme') { return loadTheme(list, byId); }
      else if (visitTab === 'recent') rows = recent.slice(0, 30);
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
  async function loadTheme(list, byId) {
    const wk = weekId(), th = themeNow();
    const [entries, votes] = await Promise.all([Cloud.themeList(wk), Cloud.themeVotes(wk)]);
    const mv = myVotes(), mine = !!entries[st.id];
    list.innerHTML = '';
    const head = document.createElement('div'); head.className = 'themeHead';
    head.innerHTML = `<div><b>本週主題：</b><span class="tn"></span><div class="help"></div></div>`;
    head.querySelector('.tn').textContent = th.name; head.querySelector('.help').textContent = `提示：${th.hint}。每人每週 3 票（剩 ${3 - mv.ids.length} 票），不能投自己。`;
    const sb = document.createElement('button'); sb.className = 'pri'; sb.textContent = mine ? '更新我的參賽房間' : '提交我的房間參賽';
    sb.onclick = async () => {
      sb.disabled = true;
      try {
        await Cloud.submitTheme(wk, st.id, st.pw, st.name, S.comfortOf(st.room).total, { v: 1, name: st.name, look: st.look, room: st.room });
        st.published = true; st.themeWeek = st.themeWeek || {};
        if (!st.themeWeek[wk]) { st.themeWeek[wk] = 1; st.coins += 50; sfx('coin'); toast('參賽成功！金幣 +50（每週第一次）'); } else toast('已更新你的參賽房間');
        emit('THEME', {}); save(false); refreshHud(); loadVisitList();
      } catch (e) { toast('連不上雲端，等一下再試試看'); sb.disabled = false; }
    };
    head.appendChild(sb); list.appendChild(head);
    const rows = Object.entries(entries).map(([id, v]) => ({ id, n: String(v.n || '').slice(0, 12), c: +v.c || 0, votes: Object.keys(votes[id] || {}).length }))
      .sort((a, b) => b.votes - a.votes || b.c - a.c);
    if (!rows.length) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = '這週還沒有人參賽，當第一個吧！'; list.appendChild(e); return; }
    rows.forEach((r, k) => {
      const el = document.createElement('div'); el.className = 'r';
      el.innerHTML = `<span class="rank">${k + 1}</span><span class="nm"></span><span class="st"></span>`;
      el.querySelector('.nm').textContent = r.n + (r.id === st.id ? '（我）' : '');
      el.querySelector('.st').textContent = `❤ ${r.c}　🗳 ${r.votes}`;
      const vb = document.createElement('button'); const voted = mv.ids.includes(r.id);
      vb.textContent = voted ? '已投票' : '投一票'; vb.disabled = voted || r.id === st.id || mv.ids.length >= 3;
      vb.onclick = async ev => {
        ev.stopPropagation(); if (!st.published) { await pushCloud(); }
        try { await Cloud.vote(wk, r.id, st.id, dayNum()); mv.ids.push(r.id); sfx('coin'); toast('投票成功！'); emit('VOTE', {}); save(false); loadVisitList(); }
        catch (e) { if (!mv.ids.includes(r.id)) mv.ids.push(r.id); save(false); toast('這間你已經投過了'); loadVisitList(); }
      };
      const go = document.createElement('button'); go.textContent = '去看看'; go.onclick = ev => { ev.stopPropagation(); goVisit(r.id, r.n); };
      el.appendChild(vb); el.appendChild(go); el.onclick = () => goVisit(r.id, r.n);
      list.appendChild(el);
    });
  }
  function isFav(id) { return (st.favs || []).some(f => f.id === id); }
  $('#bFav').onclick = () => {
    if (!visit) return; st.favs = st.favs || [];
    if (isFav(visit.id)) { st.favs = st.favs.filter(f => f.id !== visit.id); toast('已取消收藏'); }
    else { st.favs.unshift({ id: visit.id, n: visit.name }); st.favs = st.favs.slice(0, 50); toast('已收藏！可以在參觀的「收藏」分頁找到'); sfx('coin'); }
    save(false); updateVisitBar();
  };
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
  const curVisit = () => visit;
  function updateVisitBar() {
    if (!visit) return;
    $('#vName').textContent = `🏠 ${visit.name} 的小窩　❤ ${S.comfortOf(visit.room).total}　👍 ${visit.likes}`;
    const b = $('#bLike'); b.disabled = likedToday(visit.id); b.textContent = b.disabled ? '👍 已讚過' : '👍 按讚';
    $('#bFav').textContent = isFav(visit.id) ? '⭐ 已收藏' : '☆ 收藏';
  }
  $('#bLike').onclick = async () => {
    const visit = curVisit(); if (!visit || likedToday(visit.id)) return;   // 先抓住：等雲端時玩家可能已經離開
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

  // ---------------- 背包與收藏圖鑑 ----------------
  let bagTab = 'col';
  function itemIcon(id) {
    const icons = (window.ART && ART.park && ART.park.ICONS) || {}, c = document.createElement('canvas'); c.width = 32; c.height = 32; c.className = 'ico';
    if (icons[id]) { try { const pix = new Pix(32, 32); icons[id](pix, 0, 0); c.getContext('2d').drawImage(toCanvas(pix), 0, 0); return c; } catch (e) {} }
    const g2 = c.getContext('2d'), e = (Explore.COLLECT[id] || Explore.MATS[id] || {}).emoji || '❔';
    g2.font = '24px sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(e, 16, 17); return c;
  }
  function lockedIcon() {
    const icons = (window.ART && ART.park && ART.park.ICONS) || {};
    if (icons.locked) return itemIcon('locked');
    const c = document.createElement('canvas'); c.width = 32; c.height = 32; const g2 = c.getContext('2d');
    g2.fillStyle = '#cfc6b2'; g2.fillRect(6, 6, 20, 20); g2.fillStyle = '#8a8270'; g2.font = 'bold 18px sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText('?', 16, 17); return c;
  }
  function openBag() {
    Explore.ensure(st); sfx('open');
    $$('#bagTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === bagTab));
    const box = $('#bagBody'); box.innerHTML = '';
    if (bagTab === 'mat') {
      const grid = document.createElement('div'); grid.className = 'colgrid';
      for (const id in Explore.MATS) { const el = document.createElement('div'); el.className = 'colc'; el.appendChild(itemIcon(id)); const n = document.createElement('div'); n.textContent = `${Explore.MATS[id].name} ×${st.mats[id] || 0}`; el.appendChild(n); grid.appendChild(el); }
      box.appendChild(grid);
      const h = document.createElement('div'); h.className = 'help'; h.textContent = '材料在城市公園採集得到（花叢、香草叢、倒木、大樹）。之後可以用來做家具。'; box.appendChild(h);
    } else {
      for (const s in Explore.SERIES) {
        const p = Explore.seriesProgress(st, s), S2 = Explore.SERIES[s];
        const head = document.createElement('div'); head.className = 'colhead';
        head.innerHTML = `<b></b><span>${p.have} / ${p.total}</span>`; head.querySelector('b').textContent = S2.name;
        if (p.have >= p.total) {
          const b = document.createElement('button'); b.className = 'pri';
          b.textContent = st.seriesDone[s] ? '已領獎' : '領取系列獎勵'; b.disabled = !!st.seriesDone[s];
          b.onclick = () => { const r = Explore.claimSeries(st, s); if (!r) return; st.coins += r.coins || 0; if (r.item) st.bag[r.item] = (st.bag[r.item] || 0) + 1; sfx('level'); toast(`集滿${S2.name}！獲得 ${r.coins} 金幣${r.item ? '＋' + I[r.item].name : ''}`); save(); refreshHud(); openBag(); };
          head.appendChild(b);
        } else { const sm = document.createElement('small'); sm.textContent = '集滿獎勵：' + S2.reward.coins + ' 金幣' + (S2.reward.item ? '＋' + I[S2.reward.item].name : ''); head.appendChild(sm); }
        box.appendChild(head);
        const grid = document.createElement('div'); grid.className = 'colgrid';
        for (const id of p.ids) {
          const have = st.col[id], el = document.createElement('div'); el.className = 'colc' + (have ? '' : ' lock');
          el.appendChild(have ? itemIcon(id) : lockedIcon());
          const n = document.createElement('div'); n.textContent = have ? Explore.COLLECT[id].name : '？？？'; el.appendChild(n); grid.appendChild(el);
        }
        box.appendChild(grid);
      }
    }
    $('#mBag').classList.add('show');
  }
  $$('#bagTabs button').forEach(b => b.onclick = () => { bagTab = b.dataset.t; openBag(); });
  $('#bBag').onclick = openBag;
  // ---------------- 設定：存檔碼、還原、聲音 ----------------
  function openSettings() {
    sfx('open');
    $('#setCode').textContent = st.code;
    $('#setBackup').textContent = st.backupT ? '最近備份：' + new Date(st.backupT).toLocaleString() : '還沒備份（改動後 10 秒內會自動備份）';
    $('#setSfx').checked = SFX.on; $('#setMusic').checked = SFX.musicOn;
    $('#restoreIn').value = ''; refreshAcct(); $('#mSet').classList.add('show');
  }
  $('#bSet').onclick = openSettings;
  $('#setSfx').onchange = e => SFX.setOn(e.target.checked);
  $('#setMusic').onchange = e => SFX.setMusic(e.target.checked);
  $('#copyCode').onclick = async () => { try { await navigator.clipboard.writeText(st.code); toast('已複製存檔碼，請存在安全的地方'); } catch (e) { toast('請手動抄下存檔碼：' + st.code); } };
  $('#backupNow').onclick = async () => { try { const t = await Cloud.backup(st.code, st); st.backupT = t; st.syncT = t; save(false); toast('已備份到雲端！'); openSettings(); } catch (e) { toast('連不上雲端，等一下再試試看'); } };
  $('#restoreBtn').onclick = async () => {
    const code = $('#restoreIn').value.trim().toUpperCase();
    if (code.replace(/[^A-Z0-9]/g, '').length !== 16) { toast('存檔碼是 16 個英文或數字（可以有 - ）'); return; }
    try {
      const r = await Cloud.restore(code);
      if (!r || !r.state || !r.state.id || !r.state.room) { toast('找不到這組存檔碼的備份'); return; }
      const s2 = r.state;
      if (!confirmRestore(s2, r.t, { t: r.t, code })) return;
    } catch (e) { toast('連不上雲端，等一下再試試看'); }
  };
  let pendingRestore = null, pendingExtra = null;
  function confirmRestore(s2, t, extra) {
    pendingRestore = s2; pendingExtra = extra || { t };
    $('#restoreInfo').textContent = `找到存檔：「${String(s2.name || '').slice(0, 12)}」，金幣 ${s2.coins | 0}，備份時間 ${new Date(t).toLocaleString()}。還原後，這支手機目前的進度會被取代。`;
    $('#restoreConfirm').style.display = 'flex';
    return false;
  }
  $('#restoreYes').onclick = () => {
    if (!pendingRestore) return;
    const s2 = pendingRestore, ex = pendingExtra; pendingRestore = null;
    applyState(s2, ex);
    $('#restoreConfirm').style.display = 'none'; $('#mSet').classList.remove('show');
    toast((ex && ex.acct ? '登入成功！' : '還原成功！') + '歡迎回來，' + st.name);
  };
  function applyState(s2, extra) {
    extra = extra || {};
    st = Object.assign(newState(), s2); st.room.door = Object.assign({}, HOME_DOOR);
    if (extra.code) st.code = extra.code;
    if (!st.code) st.code = mkCode();
    if (extra.acct) st.acct = extra.acct;
    if (extra.t) { st.syncT = extra.t; st.backupT = extra.t; }
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
    if (creating) { creating = false; $('#mLook').classList.remove('show'); }
    daily();
    partCache.clear(); bgCache.key = ''; for (const k in scenes) delete scenes[k];
    if (mode !== 'home') { wsc = null; setMode('home'); }
    me.path = []; ensureFree(me, st.room); refreshHud(); refreshQuest(); dirty = true;
  }
  // ---------------- 帳號 ----------------
  function refreshAcct() {
    $('#acctOut').style.display = st.acct ? 'none' : ''; $('#acctIn').style.display = st.acct ? '' : 'none';
    $('#acctPwBox').style.display = 'none'; $('#acctOutBox').style.display = 'none'; outForce = false; $('#acctPw').value = '';
    if (st.acct) { $('#acctName').textContent = st.acct; $('#acctSync').textContent = st.syncT ? '上次同步 ' + new Date(st.syncT).toLocaleTimeString() : ''; }
  }
  const acctInput = () => {
    const u = Cloud.normUser($('#acctUser').value), pw = $('#acctPw').value;
    if (!u) { toast('帳號要 3～16 個英文小寫、數字或底線 _'); return null; }
    if (pw.length < 6) { toast('密碼至少 6 個字'); return null; }
    return { u, pw };
  };
  let acctBusy = false;
  const busy = async (btn, fn) => { if (acctBusy) return; acctBusy = true; const t0 = btn.textContent; btn.textContent = '處理中…'; btn.disabled = true; let keep = false; try { keep = await fn(); } finally { acctBusy = false; btn.disabled = false; if (!keep) btn.textContent = t0; } };
  $('#acctReg').onclick = () => busy($('#acctReg'), async () => {
    const a = acctInput(); if (!a) return;
    if (!st.name) { toast('先把角色做好（取名字），再註冊帳號'); return; }
    try {
      const t = await Cloud.backup(st.code, st); st.backupT = t; st.syncT = t;
      await Cloud.register(a.u, a.pw, st.code);
      st.acct = a.u; save(false); refreshAcct(); sfx('coin'); toast('註冊成功！之後在別的裝置用「' + a.u + '」登入就能接著玩');
    } catch (e) { toast(e.code === 'taken' ? '這個帳號已經有人用了，換一個吧' : '連不上雲端，等一下再試試看'); }
  });
  $('#acctLogin').onclick = () => busy($('#acctLogin'), async () => {
    const a = acctInput(); if (!a) return;
    try {
      const c = await Cloud.login(a.u, a.pw);
      if (c === 'nouser') { toast('沒有這個帳號，要不要按「註冊新帳號」？'); return; }
      if (c === 'badpw') { toast('密碼不對喔'); return; }
      const r = await Cloud.restore(c);
      if (!r || !r.state || !r.state.id || !r.state.room) { toast('這個帳號還沒有雲端存檔'); return; }
      const extra = { acct: a.u, code: c, t: r.t };
      if (st.name && st.code !== c) {
        confirmRestore(r.state, r.t, extra);
        $('#restoreInfo').textContent = `帳號「${a.u}」的存檔：「${String(r.state.name || '').slice(0, 12)}」，金幣 ${r.state.coins | 0}。登入後，這台裝置目前的進度會被帳號的進度取代。`;
        return;
      }
      applyState(r.state, extra); $('#mSet').classList.remove('show'); sfx('coin'); toast('登入成功！歡迎回來，' + st.name);
    } catch (e) { toast('連不上雲端，等一下再試試看'); }
  });
  $('#acctPw').addEventListener('keydown', e => { if (e.key === 'Enter') $('#acctLogin').click(); });
  $('#acctPwBtn').onclick = () => { const b = $('#acctPwBox'); b.style.display = b.style.display === 'none' ? 'flex' : 'none'; };
  $('#acctPwOK').onclick = () => busy($('#acctPwOK'), async () => {
    const o = $('#acctOld').value, n = $('#acctNew').value;
    if (n.length < 6) { toast('新密碼至少 6 個字'); return; }
    try {
      if (await Cloud.changePw(st.acct, o, n)) { $('#acctOld').value = ''; $('#acctNew').value = ''; refreshAcct(); toast('密碼改好了！'); }
      else toast('舊密碼不對喔');
    } catch (e) { toast('連不上雲端，等一下再試試看'); }
  });
  // 登出：先跳確認框；確定後把進度存上雲端再清掉這台的資料
  let outForce = false;
  const OUT_MSG = '確定要登出嗎？進度會先存到雲端，之後用帳號密碼登入就能接著玩。登出後這台裝置會回到新玩家畫面。';
  $('#acctOutBtn').onclick = () => { outForce = false; $('#acctOutMsg').textContent = OUT_MSG; $('#acctOutYes').textContent = '確定登出'; $('#acctOutBox').style.display = 'flex'; };
  $('#acctOutNo').onclick = () => { $('#acctOutBox').style.display = 'none'; outForce = false; };
  $('#acctOutYes').onclick = () => busy($('#acctOutYes'), async () => {
    if (!outForce) {
      try { const t = await Cloud.backup(st.code, st); st.backupT = t; st.syncT = t; }
      catch (e) {
        outForce = true; $('#acctOutMsg').textContent = '現在連不上雲端，最近的進度可能還沒存上去。還是要登出嗎？（之前自動備份的進度還在雲端）';
        $('#acctOutYes').textContent = '還是要登出'; return true;
      }
    }
    try { localStorage.removeItem(KEY); } catch (e) {}
    location.reload();
    return true;
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pullIfNewer(); });
  $('#restoreNo').onclick = () => { pendingRestore = null; $('#restoreConfirm').style.display = 'none'; };
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
  $$('[data-close]').forEach(b => b.onclick = () => { const m = b.closest('.modal'); m.classList.remove('show'); if (m.id === 'mSet' && !st.name) openLook(true); });
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
  let frames = 0, loopErr = null, renderMs = 0;
  function loop(now) {
    requestAnimationFrame(loop);              // 先排下一幀：就算這一幀出錯，迴圈也不會停
    frames++;
    const dt = Math.min(0.2, Math.max(0, (now - last) / 1000)); last = now;
    try { if (mode === 'visit') { wanderGuest(now); stepChar(guest, dt); } else stepChar(me, dt); if (mode === 'city') updateLife(dt); }
    catch (e) { loopErr = String(e && e.stack || e); console.error('step', e); }
    if (dirty) { dirty = false; const r0 = performance.now(); try { render(); renderMs = renderMs * 0.95 + (performance.now() - r0) * 0.05; } catch (e) { loopErr = String(e && e.stack || e); console.error('render', e); } }
  }
  ensureFree(me, st.room);
  fit(); refreshHud(); refreshQuest(); requestAnimationFrame(loop);
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('button')) sfx('tap'); }, true);

  if (!st.name) openLook(true); else { daily(); checkLikes(); scheduleCloud(); pullIfNewer(); }
  setInterval(() => { if (mode === 'home') checkLikes(); }, 120000);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

  // 測試用
  window.__nook = { openShop, openProduct, showroomPick, goFurnitureStore, buy, get renderMs() { return renderMs; }, updateLife, openSettings, get code() { return st.code; }, THEMES, weekId, themeNow, loadVisitList, get deliver() { return deliver; }, endDelivery, REQS, finishReq, talkReq, tapPickup, cityInteract, get park() { return park; }, endParkJob, Explore, emit, openQuests, Quests, talkTo, startJob, jobState, get wsc() { return wsc; }, get cam() { return cam; }, enterScene, goOut, goHome, cityTap, get frames() { return frames; }, get loopErr() { return loopErr; }, get st() { return st; }, get mode() { return mode; }, me, guest, setMode, interact, walkTo, render: () => { dirty = true; }, S, M, cleanRoom, cleanLook, get order() { return order; }, toast };
})();
