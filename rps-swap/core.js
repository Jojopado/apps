// 剋星消消樂 — 純邏輯（瀏覽器與 node 共用）
// 0=石頭 1=布 2=剪刀。石頭剋剪刀、剪刀剋布、布剋石頭。
(function (root) {
  const ROCK = 0, PAPER = 1, SCI = 2;
  const NAMES = ['石頭', '布', '剪刀'];
  const PRED = [PAPER, SCI, ROCK]; // PRED[t] = 剋 t 的那種
  const ROWS = 8, COLS = 7;
  const RULE = { pred: 2, lonely: true }; // 同化門檻

  class Rng {
    constructor(s) { this.s = (s >>> 0) || 1; }
    next() {
      this.s = (this.s + 0x6D2B79F5) >>> 0;
      let t = this.s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    int(n) { return Math.floor(this.next() * n); }
    clone() { const r = new Rng(1); r.s = this.s; return r; }
  }

  const copy = (g) => g.map((row) => row.slice());
  const inside = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
  const N4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function pick(rng, w) {
    const tot = w[0] + w[1] + w[2];
    let x = rng.next() * tot;
    for (let i = 0; i < 3; i++) { if ((x -= w[i]) < 0) return i; }
    return 2;
  }

  function findMatches(g) {
    const set = new Set();
    for (let r = 0; r < ROWS; r++) {
      let c = 0;
      while (c < COLS) {
        let e = c + 1;
        while (e < COLS && g[r][e] === g[r][c]) e++;
        if (g[r][c] >= 0 && e - c >= 3) for (let k = c; k < e; k++) set.add(r * COLS + k);
        c = e;
      }
    }
    for (let c = 0; c < COLS; c++) {
      let r = 0;
      while (r < ROWS) {
        let e = r + 1;
        while (e < ROWS && g[e][c] === g[r][c]) e++;
        if (g[r][c] >= 0 && e - r >= 3) for (let k = r; k < e; k++) set.add(k * COLS + c);
        r = e;
      }
    }
    return [...set].map((i) => [Math.floor(i / COLS), i % COLS]);
  }

  // 落單（四周沒有同伴）又被 2 個以上天敵貼著 → 下一步會被同化
  function threats(g) {
    const out = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = g[r][c];
      if (t < 0) continue;
      let pred = 0, same = 0;
      for (const [dr, dc] of N4) {
        const rr = r + dr, cc = c + dc;
        if (!inside(rr, cc)) continue;
        const n = g[rr][cc];
        if (n === t) same++;
        else if (n === PRED[t]) pred++;
      }
      if ((!RULE.lonely || same === 0) && pred >= RULE.pred) out.push({ r, c, from: t, to: PRED[t] });
    }
    return out;
  }

  function gravity(g, rng, w) {
    const falls = [], spawns = [];
    for (let c = 0; c < COLS; c++) {
      let w8 = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (g[r][c] >= 0) {
          if (w8 !== r) { falls.push({ c, from: r, to: w8 }); g[w8][c] = g[r][c]; g[r][c] = -1; }
          w8--;
        }
      }
      const k = w8 + 1;
      for (let r = 0; r < k; r++) spawns.push({ c, r, from: r - k });
    }
    // 補的新格子盡量不要自己湊成三消（只有三種，隨機補會一直自動連鎖）
    for (let i = spawns.length - 1; i >= 0; i--) {
      const { r, c } = spawns[i];
      g[r][c] = safePick(g, r, c, rng, w);
    }
    return { falls, spawns };
  }

  function makesRun(g, r, c, t) {
    const at = (rr, cc) => (inside(rr, cc) ? g[rr][cc] : -2);
    let h = 1, v = 1;
    for (let k = c - 1; at(r, k) === t; k--) h++;
    for (let k = c + 1; at(r, k) === t; k++) h++;
    for (let k = r - 1; at(k, c) === t; k--) v++;
    for (let k = r + 1; at(k, c) === t; k++) v++;
    return h >= 3 || v >= 3;
  }
  function safePick(g, r, c, rng, w) {
    const ok = [0, 1, 2].map((t) => (makesRun(g, r, c, t) ? 0 : w[t]));
    if (ok[0] + ok[1] + ok[2] === 0) return pick(rng, w);
    return pick(rng, ok);
  }

  function countTypes(g) {
    const n = [0, 0, 0];
    for (const row of g) for (const t of row) if (t >= 0) n[t]++;
    return n;
  }

  function listMoves(g) {
    const out = [];
    const tryS = (r, c, r2, c2) => {
      if (g[r][c] === g[r2][c2]) return;
      const a = g[r][c]; g[r][c] = g[r2][c2]; g[r2][c2] = a;
      if (findMatches(g).length) out.push([[r, c], [r2, c2]]);
      g[r2][c2] = g[r][c]; g[r][c] = a;
    };
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (c + 1 < COLS) tryS(r, c, r, c + 1);
      if (r + 1 < ROWS) tryS(r, c, r + 1, c);
    }
    return out;
  }

  function randomBoard(rng, w, layout) {
    for (let tries = 0; tries < 500; tries++) {
      const g = [];
      for (let r = 0; r < ROWS; r++) {
        g.push([]);
        for (let c = 0; c < COLS; c++) {
          const ch = layout && layout[r] && layout[r][c];
          const fixed = ch === 'R' ? ROCK : ch === 'P' ? PAPER : ch === 'S' ? SCI : -1;
          if (fixed >= 0) { g[r].push(fixed); continue; }
          let t, guard = 0;
          do {
            t = pick(rng, w);
            guard++;
          } while (guard < 30 && ((c >= 2 && g[r][c - 1] === t && g[r][c - 2] === t) ||
                                  (r >= 2 && g[r - 1][c] === t && g[r - 2][c] === t)));
          g[r].push(t);
        }
      }
      if (!findMatches(g).length && listMoves(g).length && (tries > 400 || threats(g).length <= 3)) return g;
    }
    throw new Error('board gen failed');
  }

  function shuffle(st) {
    const flat = [].concat(...st.g);
    for (let tries = 0; tries < 300; tries++) {
      for (let i = flat.length - 1; i > 0; i--) {
        const j = st.rng.int(i + 1); const t = flat[i]; flat[i] = flat[j]; flat[j] = t;
      }
      const g = [];
      for (let r = 0; r < ROWS; r++) g.push(flat.slice(r * COLS, r * COLS + COLS));
      if (!findMatches(g).length && listMoves(g).length) { st.g = g; return; }
    }
    st.g = randomBoard(st.rng, [1, 1, 1]);
  }

  function newState(level, seed) {
    const rng = new Rng(seed);
    const w = level.spawn || [1, 1, 1];
    return {
      level, rng, spawn: w,
      g: randomBoard(rng, level.startW || w, level.layout),
      cleared: [0, 0, 0], evoClears: 0, converted: 0, moves: 0, best: 0, result: 'play',
    };
  }

  // 消除＋掉落直到穩定。fromEvo=這輪是被同化引發的
  function resolve(st, steps, chain, fromEvo) {
    for (;;) {
      const m = findMatches(st.g);
      if (!m.length) return chain;
      chain++;
      const cells = m.map(([r, c]) => ({ r, c, t: st.g[r][c] }));
      for (const x of cells) { st.cleared[x.t]++; st.g[x.r][x.c] = -1; }
      const isEvo = fromEvo === 1;
      if (isEvo) { st.evoClears++; fromEvo = 2; }
      steps.push({ type: 'clear', cells, chain, evo: isEvo, g: copy(st.g) });
      // 原地補新格（不掉落）：連鎖只會來自同化，玩家看得懂、算得到
      const spawns = [];
      for (const x of cells) { st.g[x.r][x.c] = safePick(st.g, x.r, x.c, st.rng, st.spawn); spawns.push({ r: x.r, c: x.c }); }
      steps.push({ type: 'refill', spawns, g: copy(st.g) });
    }
  }

  function adjacent(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1; }

  // 回傳動畫步驟陣列；不合法回傳 null（狀態不變）
  function playMove(st, a, b) {
    if (st.result !== 'play') return null;
    if (!a || !b || !inside(a[0], a[1]) || !inside(b[0], b[1]) || !adjacent(a, b)) return null;
    const g = st.g;
    if (g[a[0]][a[1]] === g[b[0]][b[1]]) return null;
    const t = g[a[0]][a[1]]; g[a[0]][a[1]] = g[b[0]][b[1]]; g[b[0]][b[1]] = t;
    if (!findMatches(g).length) { g[b[0]][b[1]] = g[a[0]][a[1]]; g[a[0]][a[1]] = t; return null; }
    const steps = [{ type: 'swap', a, b, g: copy(g) }];
    let chain = resolve(st, steps, 0, false);
    const conv = threats(st.g);
    if (conv.length) {
      for (const x of conv) st.g[x.r][x.c] = x.to;
      st.converted += conv.length;
      steps.push({ type: 'evolve', conv, g: copy(st.g) });
      chain = resolve(st, steps, chain, 1);
    }
    st.best = Math.max(st.best, chain);
    st.moves++;
    if (!listMoves(st.g).length) { shuffle(st); steps.push({ type: 'shuffle', g: copy(st.g) }); }
    st.result = judge(st);
    steps.push({ type: 'end', result: st.result });
    return steps;
  }

  function goalInfo(st, goal) {
    const n = countTypes(st.g);
    switch (goal.type) {
      case 'collect': {
        const have = goal.tile < 0 ? st.cleared[0] + st.cleared[1] + st.cleared[2] : st.cleared[goal.tile];
        return { have: Math.min(have, goal.n), need: goal.n, done: have >= goal.n };
      }
      case 'evo': return { have: Math.min(st.evoClears, goal.n), need: goal.n, done: st.evoClears >= goal.n };
      case 'survive': return { have: st.moves, need: st.level.moves, done: st.moves >= st.level.moves };
      default: return { have: 0, need: 1, done: false, n };
    }
  }

  function failInfo(st, f) {
    const n = countTypes(st.g)[f.tile];
    if (f.type === 'max') return { n, bad: n >= f.n };
    return { n, bad: n <= f.n };
  }

  function judge(st) {
    const L = st.level;
    const fails = (L.fails || []).some((f) => failInfo(st, f).bad);
    const goals = L.goals.every((g) => goalInfo(st, g).done);
    if (fails) return 'lose';
    if (goals) return 'win';
    if (st.moves >= L.moves) return 'lose';
    return 'play';
  }

  const LEVELS = [
    {
      name: '天敵', moves: 8,
      intro: ['滑動交換相鄰兩格，三個一樣連成一排就消掉。', '石頭剋剪刀、剪刀剋布、布剋石頭。', '每走一步，<b>落單</b>（四周沒有同伴）又被 <b>2 個天敵</b>貼著的格子，會被吃掉、變成天敵。', '會被吃的格子會<b>發抖</b>。8 步內消掉 40 個剪刀！'],
      goals: [{ type: 'collect', tile: SCI, n: 40 }],
    },
    {
      name: '借刀', moves: 8,
      intro: ['格子被吃掉變色後，如果剛好三個連成一排，會自己消掉。', '這叫<b>同化連鎖</b>。觀察發抖的格子，讓牠變色後剛好連成一排！', '8 步內觸發 8 次同化連鎖。'],
      goals: [{ type: 'evo', n: 8 }],
    },
    {
      name: '抱團', moves: 12, spawn: [1, 1, 1.5],
      intro: ['剪刀掉得特別多，布快被吃光了。', '把布<b>湊在一起</b>就不會落單；消掉剪刀也能救布。', '撐過 12 步，布降到 14 個就輸。'],
      goals: [{ type: 'survive' }],
      fails: [{ type: 'min', tile: PAPER, n: 14 }],
    },
    {
      name: '剪刀大軍', moves: 8, spawn: [1, 1, 1.8],
      layout: ['.......', '.......', '.......', 'SS.S...', 'S.SS...', '.SS.S..', 'SS.SS..', 'S.SS...'],
      intro: ['左下角被剪刀佔領了，而且剪刀一直掉下來。', '讓石頭去吃剪刀，再把剪刀消掉。', '8 步內消掉 70 個剪刀；剪刀達到 28 個就輸。'],
      goals: [{ type: 'collect', tile: SCI, n: 70 }],
      fails: [{ type: 'max', tile: SCI, n: 28 }],
    },
    {
      name: '三方平衡', moves: 15, spawn: [1.3, 1, 1],
      intro: ['最後一關：任何一種降到 13 個，生態就崩潰。', '石頭出現得比較多，要小心布被吃、剪刀被壓。撐過 15 步！'],
      goals: [{ type: 'survive' }],
      fails: [{ type: 'min', tile: ROCK, n: 13 }, { type: 'min', tile: PAPER, n: 13 }, { type: 'min', tile: SCI, n: 13 }],
    },
  ];

  const api = { RULE, ROCK, PAPER, SCI, NAMES, PRED, ROWS, COLS, Rng, copy, findMatches, threats, gravity, countTypes,
    listMoves, randomBoard, newState, playMove, goalInfo, failInfo, judge, LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Core = api;
})(typeof window !== 'undefined' ? window : globalThis);
