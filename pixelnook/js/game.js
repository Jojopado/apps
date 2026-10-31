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
  function starterRoom() {
    const r = S.newRoom();
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
  let mode = 'home';             // home | edit | visit
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
  function spriteOf(o, padTop) {
    const x0 = Math.floor(OX + (o.i0 - o.j1) * TW / 2) - 3, x1 = Math.ceil(OX + (o.i1 - o.j0) * TW / 2) + 3;
    const y0 = Math.floor(OY + (o.i0 + o.j0) * TH / 2 - o.z1) - (padTop || 4), y1 = Math.ceil(OY + (o.i1 + o.j1) * TH / 2 - o.z0) + 4;
    const pix = new Pix(Math.max(1, x1 - x0), Math.max(1, y1 - y0));
    o.draw(new Iso(pix, OX - x0, OY - y0));
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
  function charDrawable(ch, look) {
    const cp = M.charParts(ch.i, ch.j, ch.facing, ch.step, look, ch.pose, ch.seatZ);
    const a = cp.aabb, o = { i0: a.i0, i1: a.i1, j0: a.j0, j1: a.j1, z0: a.z0, z1: a.z1, isChar: true, draw(iso) { for (const p of cp.parts) p.draw(iso); } };
    o.spr = spriteOf(Object.assign({}, o, { z0: ch.pose === 'sit' ? 0 : a.z0 }), 16);
    return o;
  }
  let order = [];
  function P(i, j, z) { return [OX + (i - j) * TW / 2, OY + (i + j) * TH / 2 - (z || 0)]; }
  function polyPath(pts) { ctx.beginPath(); pts.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }
  function footPoly(it) { const [wi, wj] = M.footprint(I[it.t], it.r); return [P(it.i, it.j), P(it.i + wi, it.j), P(it.i + wi, it.j + wj), P(it.i, it.j + wj)]; }
  function wallPoly(w) { const d = I[w.t], q = w.side === 'R' ? (u, z) => P(w.u + u, 0, z) : (u, z) => P(0, w.u + u, z); return [q(0, d.z0), q(d.W, d.z0), q(d.W, d.z1), q(0, d.z1)]; }
  let ghostWall = { key: '', c: null };

  function render() {
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
    if (mode === 'visit') { const [gi, gj] = toGrid(x, y); walkTo(guest, visit.room, [Math.floor(gi), Math.floor(gj)]); guest.nextT = performance.now() + 6000; return; }
    const h = hitAt(x, y);
    if (h && h.item) { interact(h.item); return; }
    if (h && h.isChar) { toast('嗨，' + st.name + '！'); return; }
    const w = wallHit(x, y); if (w) { toast(I[w.t].name); return; }
    const [gi, gj] = toGrid(x, y), c = [Math.floor(gi), Math.floor(gj)];
    if (c[0] >= 0 && c[1] >= 0 && c[0] < NI && c[1] < NJ) { if (!walkTo(me, st.room, c)) toast('那裡走不過去'); }
  });
  cv.addEventListener('pointercancel', () => { down = null; if (drag) { drag = null; showSelBar(); dirty = true; } });

  function tryPlaceHold() {
    const g = hold, d = I[g.t];
    if (d.kind === 'wall' ? g.side === undefined : g.i === undefined) return;
    if (!S.canPlace(st.room, g)) { toast('這裡放不下'); dirty = true; return; }
    const o = d.kind === 'wall' ? { t: g.t, side: g.side, u: g.u } : { t: g.t, i: g.i, j: g.j, r: g.r };
    (d.kind === 'wall' ? st.room.walls : st.room.items).push(o);
    st.bag[g.t]--; if (st.bag[g.t] <= 0) delete st.bag[g.t];
    if (!st.bag[g.t]) hold = null; else hold = { t: g.t, r: g.r };
    sel = o; save(); refreshHud(); renderBag(); showSelBar(); dirty = true;
  }

  // ---------------- 佈置模式 UI ----------------
  function setMode(m) {
    mode = m; sel = null; hold = null; drag = null;
    $('#edit').style.display = m === 'edit' ? 'block' : 'none';
    $('#hudB').style.display = m === 'home' ? 'flex' : 'none';
    $('#hudR').style.display = m === 'home' ? 'flex' : 'none';
    $('#visitBar').style.display = m === 'visit' ? 'flex' : 'none';
    $('#hudL').style.display = m === 'visit' ? 'none' : 'flex';
    if (m === 'edit') { standUp(me); me.path = []; renderBag(); }
    if (m === 'home') ensureFree(me, st.room);
    hideSelBar(); fit(); dirty = true;
  }
  $('#bEdit').onclick = () => setMode('edit');
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
    st.bag[sel.t] = (st.bag[sel.t] || 0) + 1; toast('收進背包了'); sel = null; hideSelBar(); save(); refreshHud(); renderBag(); dirty = true;
  };
  addEventListener('keydown', e => { if (mode === 'edit' && (e.key === 'r' || e.key === 'R')) { if (hold && hold.i !== undefined) { hold.r = (hold.r + 1) & 3; dirty = true; } else $('#bRot').click(); } if (e.key === 'Escape') { hold = null; sel = null; hideSelBar(); renderBag(); dirty = true; } });

  // ---------------- 商店 ----------------
  let shopCat = 'all';
  function saleIds() {
    const ids = Object.keys(I).sort(); let s = dayNum() * 9301 + 49297; const out = [];
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
    let ids = Object.keys(I).filter(id => shopCat === 'all' || (shopCat === 'sale' ? sale.includes(id) : I[id].cat === shopCat));
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
      setMode('visit'); updateVisitBar();
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
      let msg = '按讚成功！';
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
    const gain = 20 + Math.floor(S.comfortOf(st.room).total / 2);
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
  function refreshHud() {
    $('#name').textContent = st.name ? `🏠 ${st.name} 的小窩` : '像素小窩';
    $('#coins').textContent = st.coins; $('#comfort').textContent = S.comfortOf(st.room).total;
  }
  let toastT = 0;
  function toast(t) { const el = $('#toast'); el.textContent = t; el.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => el.style.display = 'none', 2400); }
  $$('[data-close]').forEach(b => b.onclick = () => b.closest('.modal').classList.remove('show'));
  $$('.modal').forEach(m => m.addEventListener('pointerdown', e => { if (e.target === m && !(m.id === 'mLook' && creating)) m.classList.remove('show'); }));
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
  fit(); refreshHud(); requestAnimationFrame(loop);
  if (!st.name) openLook(true); else { daily(); checkLikes(); scheduleCloud(); }
  setInterval(() => { if (mode === 'home') checkLikes(); }, 120000);

  // 測試用
  window.__nook = { get frames() { return frames; }, get loopErr() { return loopErr; }, get st() { return st; }, get mode() { return mode; }, me, guest, setMode, interact, walkTo, render: () => { dirty = true; }, S, M, cleanRoom, cleanLook, get order() { return order; }, toast };
})();
