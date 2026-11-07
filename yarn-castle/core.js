// 毛線城堡 Yarn Castle — pure game logic (browser + node)
(function (root) {
  'use strict';
  const W = 9, H = 13, N = W * H;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const idx = (x, y) => y * W + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const LAYOUT = {
    obst: [[1, 3], [7, 3], [1, 9], [7, 9], [4, 6]],
    balls: [[4, 2], [4, 10], [0, 6], [8, 6]],
    p0: [[1, 11], [4, 12], [7, 11]],
    p1: [[1, 1], [4, 0], [7, 1]],
  };

  function newGame(seed) {
    const s = {
      w: W, h: H, n: N, seed: seed || 1,
      claim: new Int8Array(N).fill(-1),
      obst: new Uint8Array(N),
      yarnOwner: new Int8Array(N).fill(-1),
      yarnCat: new Int8Array(N).fill(-1),
      knot: new Uint8Array(N),
      ball: new Uint8Array(N),
      cats: [],
      round: 1, maxRound: 12, turn: 0, maxSteps: 4,
      startYarn: 14, ballYarn: 8, knotsLeft: [2, 2],
      over: false, winner: -1, events: [],
    };
    s._rngState = (seed || 1) >>> 0;
    for (const [x, y] of LAYOUT.obst) s.obst[idx(x, y)] = 1;
    for (const [x, y] of LAYOUT.balls) s.ball[idx(x, y)] = 1;
    LAYOUT.p0.forEach(([x, y]) => s.cats.push(mkCat(s.cats.length, 0, x, y, s.startYarn)));
    LAYOUT.p1.forEach(([x, y]) => s.cats.push(mkCat(s.cats.length, 1, x, y, s.startYarn)));
    return s;
  }
  function mkCat(id, owner, x, y, yarn) {
    return { id, owner, x, y, yarn, trail: [], moved: false, stuck: false };
  }
  function rnd(s) { // deterministic rng stored in state
    s._rngState = (s._rngState + 0x6D2B79F5) | 0;
    let t = Math.imul(s._rngState ^ s._rngState >>> 15, 1 | s._rngState);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  function clone(s) {
    return {
      w: s.w, h: s.h, n: s.n, seed: s.seed, _rngState: s._rngState,
      claim: s.claim.slice(), obst: s.obst, yarnOwner: s.yarnOwner.slice(), yarnCat: s.yarnCat.slice(),
      knot: s.knot.slice(), ball: s.ball.slice(),
      cats: s.cats.map(c => ({ id: c.id, owner: c.owner, x: c.x, y: c.y, yarn: c.yarn, trail: c.trail.slice(), moved: c.moved, stuck: c.stuck })),
      round: s.round, maxRound: s.maxRound, turn: s.turn, maxSteps: s.maxSteps,
      startYarn: s.startYarn, ballYarn: s.ballYarn, knotsLeft: s.knotsLeft.slice(),
      over: s.over, winner: s.winner, events: [],
    };
  }

  function catAt(s, ci) {
    for (const c of s.cats) if (idx(c.x, c.y) === ci) return c;
    return null;
  }

  // can `cat` step onto cell ci?
  function walkable(s, cat, ci) {
    if (s.obst[ci]) return false;
    const cl = s.claim[ci];
    if (cl !== -1 && cl !== cat.owner) return false;
    const yo = s.yarnOwner[ci];
    if (yo === cat.owner) return false;
    if (yo !== -1 && s.knot[ci]) return false;
    if (catAt(s, ci)) return false;
    return true;
  }

  // path = array of cell indices (not including start). returns '' if ok else reason
  function validatePath(s, cat, path) {
    if (s.over) return 'over';
    if (cat.owner !== s.turn) return 'notYourTurn';
    if (cat.moved) return 'moved';
    if (!Array.isArray(path) || path.length < 1) return 'empty';
    if (path.length > s.maxSteps) return 'tooLong';
    let px = cat.x, py = cat.y;
    const seen = new Set([idx(px, py)]);
    for (const ci of path) {
      if (!Number.isInteger(ci) || ci < 0 || ci >= N) return 'badCell';
      const x = ci % W, y = (ci / W) | 0;
      if (Math.abs(x - px) + Math.abs(y - py) !== 1) return 'notAdjacent';
      if (seen.has(ci)) return 'revisit';
      if (!walkable(s, cat, ci)) return 'blocked';
      seen.add(ci); px = x; py = y;
    }
    return '';
  }

  function cutAt(s, ci) {
    const owner = s.yarnOwner[ci], cid = s.yarnCat[ci];
    if (owner === -1) return 0;
    const cat = s.cats[cid];
    const i = cat.trail.indexOf(ci);
    if (i < 0) { s.yarnOwner[ci] = -1; s.yarnCat[ci] = -1; s.knot[ci] = 0; return 1; }
    let k = -1;
    for (let j = i - 1; j >= 0; j--) if (s.knot[cat.trail[j]]) { k = j; break; }
    const removed = cat.trail.splice(k + 1, i - k);
    for (const r of removed) { s.yarnOwner[r] = -1; s.yarnCat[r] = -1; s.knot[r] = 0; }
    s.events.push({ t: 'cut', cells: removed, owner });
    return removed.length;
  }

  // apply a validated path. returns summary {claimed, cut, ball}
  function applyMove(s, catId, path) {
    const cat = s.cats[catId];
    const err = validatePath(s, cat, path);
    if (err) return { err };
    let cut = 0, ball = 0;
    for (const ci of path) {
      const from = idx(cat.x, cat.y);
      // lay yarn on the cell we leave
      if (s.claim[from] !== cat.owner && cat.yarn > 0) {
        s.yarnOwner[from] = cat.owner; s.yarnCat[from] = cat.id; cat.trail.push(from); cat.yarn--;
      }
      if (s.yarnOwner[ci] !== -1 && s.yarnOwner[ci] !== cat.owner) cut += cutAt(s, ci);
      if (s.ball[ci]) { s.ball[ci] = 0; cat.yarn += s.ballYarn; ball++; s.events.push({ t: 'ball', cell: ci, cat: cat.id }); }
      cat.x = ci % W; cat.y = (ci / W) | 0;
    }
    cat.moved = true;
    const claimed = resolveClaims(s, cat.owner);
    return { claimed, cut, ball };
  }

  function knot(s, catId) {
    const cat = s.cats[catId];
    if (s.over || cat.owner !== s.turn || cat.moved) return false;
    if (s.knotsLeft[cat.owner] <= 0 || cat.trail.length === 0) return false;
    for (const ci of cat.trail) s.knot[ci] = 1;
    s.knotsLeft[cat.owner]--;
    cat.moved = true;
    s.events.push({ t: 'knot', cat: catId });
    return true;
  }

  // flood regions not walled by `owner`; claim any region without enemy presence
  function resolveClaims(s, owner) {
    const wall = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (s.obst[i] || s.claim[i] !== -1 || s.yarnOwner[i] === owner) wall[i] = 1;
    const catCell = new Int8Array(N).fill(-1);
    for (const c of s.cats) { catCell[idx(c.x, c.y)] = c.owner; if (c.owner === owner) wall[idx(c.x, c.y)] = 1; }
    const seen = new Uint8Array(N);
    let total = 0;
    const stack = [];
    for (let st = 0; st < N; st++) {
      if (wall[st] || seen[st]) continue;
      const region = []; let enemy = false;
      stack.length = 0; stack.push(st); seen[st] = 1;
      while (stack.length) {
        const ci = stack.pop(); region.push(ci);
        if (catCell[ci] !== -1 && catCell[ci] !== owner) enemy = true;
        if (s.yarnOwner[ci] !== -1 && s.yarnOwner[ci] !== owner) enemy = true;
        const x = ci % W, y = (ci / W) | 0;
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue;
          const ni = idx(nx, ny); if (wall[ni] || seen[ni]) continue;
          seen[ni] = 1; stack.push(ni);
        }
      }
      if (enemy) continue;
      for (const ci of region) s.claim[ci] = owner;
      // convert adjacent own yarn (and own cat cells) into claimed
      const conv = [];
      for (const ci of region) {
        const x = ci % W, y = (ci / W) | 0;
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue;
          const ni = idx(nx, ny);
          if (s.yarnOwner[ni] === owner) conv.push(ni);
          else if (s.claim[ni] === -1 && catCell[ni] === owner) s.claim[ni] = owner;
        }
      }
      for (const ni of conv) {
        if (s.yarnOwner[ni] !== owner) continue;
        const cat = s.cats[s.yarnCat[ni]];
        const ti = cat.trail.indexOf(ni); if (ti >= 0) cat.trail.splice(ti, 1);
        s.yarnOwner[ni] = -1; s.yarnCat[ni] = -1; s.knot[ni] = 0; s.claim[ni] = owner;
      }
      total += region.length;
      s.events.push({ t: 'claim', owner, cells: region });
    }
    if (total) absorbDeadYarn(s, owner);
    return total;
  }

  // own yarn cells with no empty neighbour (all sides own-claimed / obstacle / edge / own yarn) become territory
  function absorbDeadYarn(s, owner) {
    let changed = true;
    while (changed) {
      changed = false;
      for (let ci = 0; ci < N; ci++) {
        if (s.yarnOwner[ci] !== owner) continue;
        const x = ci % W, y = (ci / W) | 0;
        let open = false;
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue;
          const ni = idx(nx, ny);
          if (s.obst[ni] || s.claim[ni] === owner) continue;
          open = true; break;
        }
        if (open) continue;
        const cat = s.cats[s.yarnCat[ci]];
        const ti = cat.trail.indexOf(ci); if (ti >= 0) cat.trail.splice(ti, 1);
        s.yarnOwner[ci] = -1; s.yarnCat[ci] = -1; s.knot[ci] = 0; s.claim[ci] = owner;
        changed = true;
      }
    }
  }

  function score(s) {
    const sc = [0, 0];
    for (let i = 0; i < N; i++) if (s.claim[i] !== -1) sc[s.claim[i]]++;
    return sc;
  }

  function endTurn(s) {
    if (s.over) return;
    s.turn = 1 - s.turn;
    for (const c of s.cats) if (c.owner === s.turn) c.moved = false;
    if (s.turn === 0) {
      s.round++;
      spawnBalls(s);
      if (s.round > s.maxRound) finish(s);
    }
  }
  function spawnBalls(s) {
    let nb = 0; for (let i = 0; i < N; i++) nb += s.ball[i];
    if (nb >= 3) return;
    const cand = [];
    for (let i = 0; i < N; i++) if (!s.obst[i] && s.claim[i] === -1 && s.yarnOwner[i] === -1 && !s.ball[i] && !catAt(s, i)) cand.push(i);
    if (!cand.length) return;
    const ci = cand[Math.floor(rnd(s) * cand.length)];
    s.ball[ci] = 1; s.events.push({ t: 'spawn', cell: ci });
  }
  function finish(s) {
    s.over = true;
    const sc = score(s);
    s.winner = sc[0] > sc[1] ? 0 : sc[1] > sc[0] ? 1 : -1;
  }

  // ---------- AI ----------
  function enumeratePaths(s, cat) {
    const out = [];
    const seen = new Set([idx(cat.x, cat.y)]);
    const path = [];
    (function dfs(x, y) {
      if (path.length >= s.maxSteps) return;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue;
        const ni = idx(nx, ny); if (seen.has(ni) || !walkable(s, cat, ni)) continue;
        seen.add(ni); path.push(ni); out.push(path.slice());
        dfs(nx, ny);
        path.pop(); seen.delete(ni);
      }
    })(cat.x, cat.y);
    return out;
  }

  function headPotential(s, cat) {
    let p = 0; const x = cat.x, y = cat.y;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny)) { p += 0.5; continue; }
      const ni = idx(nx, ny);
      if (s.claim[ni] === cat.owner || s.yarnOwner[ni] === cat.owner) p += 1;
    }
    return p;
  }

  function evalPath(s, cat, path) {
    const t = clone(s);
    const r = applyMove(t, cat.id, path);
    if (r.err) return { v: -1e9, t };
    const tc = t.cats[cat.id];
    let v = r.claimed * 10 + r.cut * 3 + r.ball * (tc.yarn < 10 ? 5 : 2);
    v += headPotential(t, tc) * 0.6;
    v += Math.min(tc.trail.length, 10) * 0.15;
    if (tc.yarn === 0) v -= 2;
    return { v, t };
  }

  function bestMove(s, cat, depth) {
    const paths = enumeratePaths(s, cat);
    if (!paths.length) return null;
    const scored = paths.map(p => ({ p, ...evalPath(s, cat, p) }));
    scored.sort((a, b) => b.v - a.v);
    if (depth > 0) {
      const top = scored.slice(0, 10);
      for (const c of top) {
        const t2 = c.t; t2.cats[cat.id].moved = false;
        const paths2 = enumeratePaths(t2, t2.cats[cat.id]);
        let best2 = 0;
        for (const p2 of paths2) {
          const u = clone(t2); const r2 = applyMove(u, cat.id, p2);
          if (r2.err) continue;
          const v2 = r2.claimed * 10 + r2.cut * 2;
          if (v2 > best2) best2 = v2;
        }
        c.v += best2 * 0.55;
      }
      top.sort((a, b) => b.v - a.v);
      const bestV = top[0].v;
      const near = top.filter(c => c.v >= bestV - 0.5);
      return near[Math.floor(rnd(s) * near.length)].p;
    }
    return scored[0].p;
  }

  function aiTurn(s, owner, depth) {
    if (owner === undefined) owner = s.turn;
    if (depth === undefined) depth = 1;
    const moves = [];
    for (const cat of s.cats) {
      if (cat.owner !== owner || cat.moved) continue;
      const p = bestMove(s, cat, depth);
      if (!p) { cat.moved = true; cat.stuck = true; continue; }
      const r = applyMove(s, cat.id, p);
      moves.push({ cat: cat.id, path: p, r });
    }
    return moves;
  }

  function randomMove(s, cat, rng) {
    const paths = enumeratePaths(s, cat);
    if (!paths.length) return null;
    return paths[Math.floor(rng() * paths.length)];
  }

  function checkInvariants(s) {
    const errs = [];
    const pos = new Set();
    for (const c of s.cats) {
      const ci = idx(c.x, c.y);
      if (!inb(c.x, c.y)) errs.push('cat oob ' + c.id);
      if (pos.has(ci)) errs.push('cats overlap ' + c.id); pos.add(ci);
      if (s.obst[ci]) errs.push('cat on obstacle ' + c.id);
      if (s.yarnOwner[ci] !== -1) errs.push('cat on yarn ' + c.id);
      if (s.claim[ci] !== -1 && s.claim[ci] !== c.owner) errs.push('cat on enemy claim ' + c.id);
      if (!(c.yarn >= 0) || Number.isNaN(c.yarn)) errs.push('bad yarn ' + c.id);
      const tset = new Set();
      for (const t of c.trail) {
        if (tset.has(t)) errs.push('dup trail ' + c.id); tset.add(t);
        if (s.yarnOwner[t] !== c.owner || s.yarnCat[t] !== c.id) errs.push('trail/yarn mismatch ' + c.id);
        if (s.claim[t] !== -1) errs.push('yarn on claimed ' + c.id);
      }
    }
    let yarnCells = 0;
    for (let i = 0; i < N; i++) {
      if (s.yarnOwner[i] !== -1) { yarnCells++; if (s.claim[i] !== -1) errs.push('yarn+claim ' + i); if (s.obst[i]) errs.push('yarn on obst'); }
      if (s.knot[i] && s.yarnOwner[i] === -1) errs.push('knot w/o yarn ' + i);
      if (s.ball[i] && s.obst[i]) errs.push('ball on obst');
    }
    let trailCells = 0; for (const c of s.cats) trailCells += c.trail.length;
    if (trailCells !== yarnCells) errs.push('trail count ' + trailCells + ' != yarn ' + yarnCells);
    const sc = score(s); if (sc[0] + sc[1] > N) errs.push('score overflow');
    return errs;
  }

  const api = { W, H, N, idx, inb, DIRS, newGame, clone, walkable, validatePath, applyMove, knot, resolveClaims, score, endTurn, aiTurn, bestMove, enumeratePaths, randomMove, checkInvariants, catAt, mulberry };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.YC = api;
})(typeof window !== 'undefined' ? window : globalThis);
