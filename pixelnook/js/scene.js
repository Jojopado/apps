// PixelNook 場景：房間背景（牆、地板、牆面裝飾、地毯）＋可排序物件（家具零件、角色）。
// 瀏覽器與 Node 共用，Node 測試直接用它算圖檢查層級。
(function (G) {
  'use strict';
  const { shade, Iso, Pix, depthSort, OUT, TW, TH } = G.PX;
  const M = G.MODELS;
  const NI = 9, NJ = 8, WALL = 150, SW = 800, SH = 480, OX = 390, OY = 172;

  function newRoom() {
    return { v: 1, wall: 1, floor: 0, items: [], walls: [] };
  }

  // ---------- 背景 ----------
  function drawBG(pix, room, opt) {
    opt = opt || {};
    const iso = new Iso(pix, OX, OY), P = (i, j, z) => iso.P(i, j, z);
    const W = M.WALLS[room.wall] || M.WALLS[0], F = M.FLOORS[room.floor] || M.FLOORS[0];
    pix.rect(0, 0, SW - 1, SH - 1, opt.bg || [24, 22, 34]);
    const wR = (u0, u1, z0, z1, c, o) => pix.poly([P(u0, 0, z0), P(u1, 0, z0), P(u1, 0, z1), P(u0, 0, z1)], c, o);
    const wL = (u0, u1, z0, z1, c, o) => pix.poly([P(0, u0, z0), P(0, u1, z0), P(0, u1, z1), P(0, u0, z1)], c, o);
    // 牆（左牆稍暗）
    const wallSide = (q, N, dark) => {
      const a = shade(W.a, dark), b = shade(W.b, dark);
      q(0, N, 0, WALL, a);
      if (W.stripe) { const s = 1 / W.stripe / 2; for (let u = 0, k = 0; u < N - 1e-6; u += s, k++) if (k % 2) q(u, Math.min(N, u + s), 0, WALL, b); }
      if (W.dots) for (let u = 0.25, k = 0; u < N; u += 0.5, k++) for (let z = 18 + (k % 2) * 14; z < WALL - 10; z += 28) {
        if (W.dots === 2) q(u - 0.06, u + 0.06, z, z + 6, b); else q(u - 0.04, u + 0.04, z, z + 4, b);
      }
      q(0, N, 0, 8, shade(dark < 1 ? [180, 136, 90] : [196, 150, 100], 1));
    };
    wallSide(wR, NI, 1); wallSide(wL, NJ, 0.92);
    // 牆頂白色收邊
    const T = 7, A = P(0, 0, WALL), B = P(NI, 0, WALL), Cc = P(0, NJ, WALL);
    pix.poly([A, B, [B[0] + T, B[1] - T / 2], [A[0], A[1] - T]], [246, 246, 250], OUT);
    pix.poly([A, Cc, [Cc[0] - T, Cc[1] - T / 2], [A[0], A[1] - T]], [222, 224, 232], OUT);
    const Bf = P(NI, 0), Cf = P(0, NJ);
    pix.poly([Bf, B, [B[0] + T, B[1] - T / 2], [Bf[0] + T, Bf[1] - T / 2]], [200, 202, 214], OUT);
    pix.poly([Cf, Cc, [Cc[0] - T, Cc[1] - T / 2], [Cf[0] - T, Cf[1] - T / 2]], [236, 236, 242], OUT);
    const A0 = P(0, 0); pix.line(A0[0], A0[1], A[0], A[1], shade(W.a, 0.8));
    // 牆面裝飾
    for (const w of room.walls) drawWallItem(pix, iso, w);
    if (room.door) drawDoor(pix, iso, room.door);
    // 地板
    pix.fill([P(0, 0), P(NI, 0), P(NI, NJ), P(0, NJ)], F.a);
    if (F.plank) {
      for (let j = 0.25; j < NJ; j += 0.25) { const a = P(0, j), b = P(NI, j); pix.line(a[0], a[1], b[0], b[1], F.b); }
      for (let n = 0; n < 90; n++) { const i = (n * 37 % 90) / 10, j = Math.floor(n * 0.25 * 4) / 4 % NJ; if (i + 0.3 < NI) { const a = P(i, j), b = P(i, j + 0.25); pix.line(a[0], a[1], b[0], b[1], F.b); } }
    } else if (F.tile) {
      for (let i = 0.5; i < NI; i += 0.5) { const a = P(i, 0), b = P(i, NJ); pix.line(a[0], a[1], b[0], b[1], F.b); }
      for (let j = 0.5; j < NJ; j += 0.5) { const a = P(0, j), b = P(NI, j); pix.line(a[0], a[1], b[0], b[1], F.b); }
    } else if (F.check) {
      for (let i = 0; i < NI * 2; i++) for (let j = 0; j < NJ * 2; j++) if ((i + j) % 2) pix.fill([P(i / 2, j / 2), P(i / 2 + 0.5, j / 2), P(i / 2 + 0.5, j / 2 + 0.5), P(i / 2, j / 2 + 0.5)], F.b);
    } else {
      for (let n = 0; n < 260; n++) { const i = ((n * 53) % 900) / 100, j = ((n * 71) % 800) / 100; const a = P(i, j); pix.px(a[0], a[1], F.b); }
    }
    // 地板前緣厚度
    const TH2 = 10, Fn = P(NI, NJ);
    pix.poly([Cf, Fn, [Fn[0], Fn[1] + TH2], [Cf[0], Cf[1] + TH2]], shade(F.a, 0.82), OUT);
    pix.poly([Bf, Fn, [Fn[0], Fn[1] + TH2], [Bf[0], Bf[1] + TH2]], shade(F.a, 0.7), OUT);
    // 地毯
    for (const it of room.items) if (M.ITEMS[it.t] && M.ITEMS[it.t].kind === 'rug') drawRug(iso, it);
    // 格線（佈置模式）
    if (opt.grid) {
      for (let i = 1; i < NI; i++) { const a = P(i, 0), b = P(i, NJ); dotted(pix, a, b, [255, 255, 255]); }
      for (let j = 1; j < NJ; j++) { const a = P(0, j), b = P(NI, j); dotted(pix, a, b, [255, 255, 255]); }
    }
    return iso;
  }
  function dotted(pix, a, b, c) {
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    for (let k = 0; k <= n; k += 4) pix.px(Math.round(a[0] + (b[0] - a[0]) * k / n), Math.round(a[1] + (b[1] - a[1]) * k / n), c);
  }
  function drawRug(iso, it) {
    const d = M.ITEMS[it.t], [wi, wj] = M.footprint(d, it.r), [a, b] = d.colors;
    const i = it.i + 0.08, j = it.j + 0.08, A = wi - 0.16, B = wj - 0.16;
    iso.flat(i, j, A, B, a);
    if (d.pat === 'frame') { iso.flat(i + 0.15, j + 0.15, A - 0.3, B - 0.3, b, 0, null); iso.flat(i + 0.35, j + 0.35, A - 0.7, B - 0.7, a, 0, null); }
    else if (d.pat === 'dots') { iso.flat(i + 0.1, j + 0.1, A - 0.2, B - 0.2, b, 0, null); for (let u = 0.35; u < A - 0.2; u += 0.5) for (let v = 0.35; v < B - 0.2; v += 0.5) iso.flat(i + u, j + v, 0.14, 0.14, a, 0, null); }
    else { for (let u = 0.1; u < A - 0.1; u += 0.3) iso.flat(i + u, j + 0.1, 0.15, B - 0.2, b, 0, null); }
  }
  function wallQ(pix, iso, side, base) {
    return side === 'R'
      ? (u0, u1, z0, z1, c, o) => pix.poly([iso.P(base + u0, 0, z0), iso.P(base + u1, 0, z0), iso.P(base + u1, 0, z1), iso.P(base + u0, 0, z1)], c, o === undefined ? OUT : o)
      : (u0, u1, z0, z1, c, o) => pix.poly([iso.P(0, base + u0, z0), iso.P(0, base + u1, z0), iso.P(0, base + u1, z1), iso.P(0, base + u0, z1)], c, o === undefined ? OUT : o);
  }
  // 出入口的門：畫在牆上（side R/L、u 起點，寬 1 格、高 92）
  const DOOR_W = 1, DOOR_H = 92;
  function drawDoor(pix, iso, door) {
    const q = wallQ(pix, iso, door.side, door.u);
    q(0.08, DOOR_W - 0.08, 0, DOOR_H, [250, 246, 238]);                 // 門框
    q(0.16, DOOR_W - 0.16, 0, DOOR_H - 7, door.color || [150, 98, 64]);  // 門板
    q(0.22, DOOR_W - 0.22, 48, DOOR_H - 14, shade(door.color || [150, 98, 64], 1.12), null);
    q(0.22, DOOR_W - 0.22, 8, 40, shade(door.color || [150, 98, 64], 1.12), null);
    q(DOOR_W - 0.3, DOOR_W - 0.24, 40, 46, [250, 210, 100]);            // 門把
    // 門口地墊
    const i = door.side === 'R' ? door.u : 0, j = door.side === 'R' ? 0 : door.u;
    if (door.side === 'R') iso.flat(i + 0.12, j + 0.05, DOOR_W - 0.24, 0.5, [200, 90, 80]);
    else iso.flat(i + 0.05, j + 0.12, 0.5, DOOR_W - 0.24, [200, 90, 80]);
  }
  function doorCell(door) { return door.side === 'R' ? [door.u, 0] : [0, door.u]; }
  function drawWallItem(pix, iso, w) {
    const d = M.ITEMS[w.t]; if (!d || d.kind !== 'wall') return;
    d.paint(wallQ(pix, iso, w.side, w.u), d.W);
  }

  // ---------- 規則：能不能放 ----------
  function cellsOf(it) {
    const d = M.ITEMS[it.t], [wi, wj] = M.footprint(d, it.r), out = [];
    for (let a = 0; a < wi; a++) for (let b = 0; b < wj; b++) out.push([it.i + a, it.j + b]);
    return out;
  }
  function canPlace(room, it, ignore) {
    const d = M.ITEMS[it.t]; if (!d) return false;
    if (d.kind === 'wall') {
      const N = it.side === 'R' ? NI : NJ;
      if (it.u < 0 || it.u + d.W > N) return false;
      if (room.door && room.door.side === it.side) {
        const sepU = it.u + d.W <= room.door.u || room.door.u + DOOR_W <= it.u, sepZ = d.z0 >= DOOR_H;
        if (!sepU && !sepZ) return false;
      }
      for (const w of room.walls) if (w !== ignore && w.side === it.side) {
        const o = M.ITEMS[w.t]; if (!o) continue;
        const sepU = it.u + d.W <= w.u || w.u + o.W <= it.u, sepZ = d.z1 <= o.z0 || o.z1 <= d.z0;
        if (!sepU && !sepZ) return false;
      }
      return true;
    }
    for (const [i, j] of cellsOf(it)) if (i < 0 || j < 0 || i >= NI || j >= NJ) return false;
    const mine = new Set(cellsOf(it).map(c => c[0] + ',' + c[1]));
    for (const o of room.items) {
      if (o === ignore || !M.ITEMS[o.t]) continue;
      if ((M.ITEMS[o.t].kind === 'rug') !== (d.kind === 'rug')) continue;     // 地毯只跟地毯互斥
      for (const [i, j] of cellsOf(o)) if (mine.has(i + ',' + j)) return false;
    }
    return true;
  }
  function blockedGrid(room) {
    const g = []; for (let i = 0; i < NI; i++) { g.push(new Array(NJ).fill(false)); }
    for (const o of room.items) { const d = M.ITEMS[o.t]; if (!d || d.kind !== 'floor') continue; for (const [i, j] of cellsOf(o)) if (i >= 0 && j >= 0 && i < NI && j < NJ) g[i][j] = true; }
    return g;
  }
  // 走路：BFS 找最短格子路徑
  function findPath(room, from, to) {
    const g = blockedGrid(room);
    if (to[0] < 0 || to[1] < 0 || to[0] >= NI || to[1] >= NJ || g[to[0]][to[1]]) return null;
    const key = (i, j) => i * 100 + j, prev = new Map([[key(from[0], from[1]), null]]), q = [from];
    while (q.length) {
      const [i, j] = q.shift();
      if (i === to[0] && j === to[1]) break;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj, k = key(a, b);
        if (a < 0 || b < 0 || a >= NI || b >= NJ || g[a][b] || prev.has(k)) continue;
        prev.set(k, [i, j]); q.push([a, b]);
      }
    }
    if (!prev.has(key(to[0], to[1]))) return null;
    const path = []; let c = to;
    while (c) { path.push(c); c = prev.get(key(c[0], c[1])); }
    return path.reverse();
  }
  function comfortOf(room) {
    let c = 0; const sets = {};
    for (const it of room.items.concat(room.walls)) { const d = M.ITEMS[it.t]; if (!d) continue; c += d.comfort; sets[d.set] = (sets[d.set] || 0) + 1; }
    let bonus = 0; for (const s in sets) bonus += Math.floor(sets[s] / 3) * 15;
    return { base: c, bonus, total: c + bonus, sets };
  }

  // ---------- 物件 ----------
  // chars: [{i,j,facing,step,look,pose,seatZ}]
  function drawables(room, chars) {
    const list = [];
    for (const it of room.items) for (const p of M.itemParts(it)) list.push(p);
    for (const ch of chars || []) {
      const cp = M.charParts(ch.i, ch.j, ch.facing, ch.step || 0, ch.look, ch.pose, ch.seatZ, ch.head);
      const a = cp.aabb;
      list.push({ i0: a.i0, i1: a.i1, j0: a.j0, j1: a.j1, z0: a.z0, z1: a.z1, ch, cp, draw(iso) { for (const p of cp.parts) p.draw(iso); } });
    }
    return depthSort(list);
  }

  // Node／測試：直接整張算好
  function renderFull(room, chars, opt) {
    const pix = new Pix(SW, SH), iso = drawBG(pix, room, opt);
    for (const d of drawables(room, chars)) d.draw(iso);
    return pix;
  }

  G.SCENE = { NI, NJ, WALL, SW, SH, OX, OY, DOOR_W, DOOR_H, newRoom, drawBG, drawDoor, doorCell, drawWallItem, drawRug, wallQ, cellsOf, canPlace, blockedGrid, findPath, comfortOf, drawables, renderFull };
})(typeof window !== 'undefined' ? window : globalThis);
