// 推陣 Shove Tactics — 規則引擎（純邏輯，瀏覽器和 node 共用）
export const W = 5, H = 4, MAX_ROUND = 8, HAND_MAX = 8;
export const DV = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 0上 1右 2下 3左
export const ARROW = ['↑', '→', '↓', '←'];
export const FWD = [0, 2]; // 玩家 0（藍、下方）面向上；玩家 1（紅、上方）面向下
export const HOME = [[2, 3], [0, 1]]; // 可部署的列

export const UNITS = {
  assassin: { name: '刺客', cost: 2, hp: 2, atk: 2, ord: 1, text: '攻擊前方 1 格的敵人。出手最快。' },
  shield:   { name: '盾兵', cost: 2, hp: 5, atk: 1, ord: 5, text: '攻擊前方 1 格。很耐打，長槍穿不過它，弓手／鉤索打到它就停。' },
  lancer:   { name: '長槍', cost: 3, hp: 3, atk: 2, ord: 3, text: '攻擊前方直線 2 格內的所有敵人（穿透，盾兵擋得住）。' },
  hammer:   { name: '鐵錘', cost: 3, hp: 4, atk: 2, ord: 4, text: '攻擊前方 1 格，並把目標往前推 1 格。' },
  archer:   { name: '弓手', cost: 3, hp: 2, atk: 2, ord: 2, text: '越過眼前那格，射直線上第一個敵人。打不到貼臉的。' },
  hook:     { name: '鉤索', cost: 3, hp: 3, atk: 1, ord: 2, text: '勾住直線上第一個敵人，打 1 並拉到自己面前。' },
  cannon:   { name: '砲台', cost: 5, hp: 4, atk: 3, ord: 6, text: '轟炸前方第 2 格為中心的十字，敵我都會炸到。' },
  medic:    { name: '醫療兵', cost: 2, hp: 3, atk: 0, ord: 3, text: '幫上下左右的友軍各補 2 血。' },
  commander:{ name: '指揮官', cost: 0, hp: 7, atk: 1, ord: 7, text: '被打倒就輸。攻擊前方 1 格。被推出場外或掉坑時改受 3 傷害。' },
};
export const TACTICS = {
  push:   { name: '推擠', cost: 1, text: '把任一單位往任一方向推 1 格。撞到東西雙方各扣 1；推出左右場外或掉進坑洞就陣亡。' },
  dash:   { name: '衝鋒', cost: 1, text: '自己的一個單位直線移動最多 2 格（不算本回合的移動）。' },
  swap:   { name: '換位', cost: 2, text: '相鄰的兩個單位交換位置（敵我都可以）。' },
  turn:   { name: '急轉', cost: 1, text: '把任一單位轉到任一方向（可以轉對手的）。' },
  guard:  { name: '護盾', cost: 1, text: '自己的一個單位本回合擋下第一次傷害。' },
  haste:  { name: '搶先', cost: 2, text: '一個單位本回合出手順序變成 0（最先）。' },
  delay:  { name: '延遲', cost: 2, text: '一個單位本回合出手順序變成 9（最後）。' },
  recall: { name: '撤退', cost: 1, text: '把自己的一個單位（非指揮官）收回手上。' },
};
export const isUnit = (c) => !!UNITS[c];
export const cardCost = (c) => (UNITS[c] || TACTICS[c]).cost;
export const cardName = (c) => (UNITS[c] || TACTICS[c]).name;
export const cardText = (c) => (UNITS[c] || TACTICS[c]).text;

export const DECK = ['assassin', 'assassin', 'shield', 'shield', 'lancer', 'lancer', 'hammer', 'hammer',
  'archer', 'hook', 'cannon', 'medic', 'push', 'push', 'dash', 'swap', 'turn', 'guard', 'haste', 'delay', 'recall'];

// ---------- 亂數 ----------
function rng(s) { // mulberry32，狀態存在 s.seed
  let t = (s.seed = (s.seed + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(s, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------- 建立對局 ----------
export function newGame(seed = (Math.random() * 2 ** 32) >>> 0) {
  const s = { seed, round: 1, first: 0, turn: 0, passes: 0, phase: 'action', winner: null, nextId: 1,
    units: [], terrain: {}, players: [], log: [] };
  s.first = s.turn = rng(s) < 0.5 ? 0 : 1;
  // 地形：兩組點對稱，只放在中間兩列
  const spots = [];
  for (let x = 0; x < W; x++) spots.push([x, 1]);
  shuffle(s, spots);
  const types = ['pit', 'rock', 'water'];
  for (const [x, y] of spots.slice(0, 2)) {
    const t = types[Math.floor(rng(s) * 3)];
    s.terrain[x + ',' + y] = t;
    s.terrain[(W - 1 - x) + ',' + (H - 1 - y)] = t;
  }
  for (let p = 0; p < 2; p++) {
    const deck = shuffle(s, DECK.slice());
    // 保證起手有一張 2 費單位
    if (!deck.slice(0, 5).some((c) => isUnit(c) && cardCost(c) <= 2)) {
      const j = deck.findIndex((c) => isUnit(c) && cardCost(c) <= 2);
      [deck[0], deck[j]] = [deck[j], deck[0]];
    }
    s.players.push({ deck, hand: deck.splice(0, 5), energy: 0 });
    const [hx, hy] = p === 0 ? [2, 3] : [2, 0];
    addUnit(s, p, 'commander', hx, hy, FWD[p]);
  }
  startRound(s);
  return s;
}

function addUnit(s, side, type, x, y, f) {
  const d = UNITS[type];
  const u = { id: s.nextId++, side, type, x, y, f, hp: d.hp, maxhp: d.hp, ordOv: null, guard: false, moved: false, rotated: false, fresh: true };
  s.units.push(u);
  return u;
}

function startRound(s) {
  for (const p of s.players) p.energy = Math.min(s.round + 1, 6);
  if (s.round > 1) for (const p of s.players) for (let i = 0; i < 2 && p.deck.length && p.hand.length < HAND_MAX; i++) p.hand.push(p.deck.shift());
  for (const u of s.units) { u.ordOv = null; u.guard = false; u.moved = false; u.rotated = false; u.fresh = false; }
  s.turn = s.first; s.passes = 0; s.phase = 'action';
}

// ---------- 查詢 ----------
export const inB = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
export const unitAt = (s, x, y) => s.units.find((u) => u.x === x && u.y === y);
export const terr = (s, x, y) => s.terrain[x + ',' + y];
export const byId = (s, id) => s.units.find((u) => u.id === id);
export const commander = (s, side) => s.units.find((u) => u.side === side && u.type === 'commander');
export const ordOf = (u) => (u.ordOv ?? UNITS[u.type].ord);
export const atkOf = (s, u) => Math.max(0, UNITS[u.type].atk - (terr(s, u.x, u.y) === 'water' ? 1 : 0));
const walkable = (s, x, y) => inB(x, y) && !unitAt(s, x, y) && terr(s, x, y) !== 'rock' && terr(s, x, y) !== 'pit';
export const canDeployAt = (s, side, x, y) => HOME[side].includes(y) && walkable(s, x, y);

// ---------- 合法行動 ----------
export function legalActions(s, side = s.turn) {
  const A = [{ t: 'pass' }];
  if (s.phase !== 'action' || s.turn !== side) return A;
  const P = s.players[side], en = P.energy;
  const mine = s.units.filter((u) => u.side === side);
  const seen = new Set();
  P.hand.forEach((c, ci) => {
    if (cardCost(c) > en || seen.has(c)) return; // 同名牌只列一次
    seen.add(c);
    if (isUnit(c)) {
      for (const y of HOME[side]) for (let x = 0; x < W; x++) if (canDeployAt(s, side, x, y))
        for (let f = 0; f < 4; f++) A.push({ t: 'deploy', card: ci, x, y, f });
      return;
    }
    for (const u of s.units) {
      const own = u.side === side;
      switch (c) {
        case 'push': for (let d = 0; d < 4; d++) A.push({ t: 'tactic', card: ci, id: u.id, d }); break;
        case 'dash': if (own) for (let d = 0; d < 4; d++) if (walkable(s, u.x + DV[d][0], u.y + DV[d][1])) A.push({ t: 'tactic', card: ci, id: u.id, d }); break;
        case 'swap': for (const d of [1, 2]) { const v = unitAt(s, u.x + DV[d][0], u.y + DV[d][1]); if (v) A.push({ t: 'tactic', card: ci, id: u.id, id2: v.id }); } break;
        case 'turn': for (let f = 0; f < 4; f++) if (f !== u.f) A.push({ t: 'tactic', card: ci, id: u.id, d: f }); break;
        case 'guard': if (own && !u.guard) A.push({ t: 'tactic', card: ci, id: u.id }); break;
        case 'haste': if (u.ordOv !== 0) A.push({ t: 'tactic', card: ci, id: u.id }); break;
        case 'delay': if (u.ordOv !== 9) A.push({ t: 'tactic', card: ci, id: u.id }); break;
        case 'recall': if (own && u.type !== 'commander') A.push({ t: 'tactic', card: ci, id: u.id }); break;
      }
    }
  });
  for (const u of mine) {
    if (!u.moved && en >= 1) for (let d = 0; d < 4; d++) if (walkable(s, u.x + DV[d][0], u.y + DV[d][1])) A.push({ t: 'move', id: u.id, d });
    if (!u.rotated) for (let f = 0; f < 4; f++) if (f !== u.f) A.push({ t: 'rotate', id: u.id, f });
  }
  return A;
}

export function isLegal(s, a) {
  return legalActions(s).some((b) => b.t === a.t && b.card === a.card && b.id === a.id && b.id2 === a.id2 && b.d === a.d && b.f === a.f && b.x === a.x && b.y === a.y)
    || (a.t === 'deploy' && legalActions(s).some((b) => b.t === 'deploy' && s.players[s.turn].hand[b.card] === s.players[s.turn].hand[a.card] && b.x === a.x && b.y === a.y && b.f === a.f));
}

// ---------- 套用行動 ----------
export function apply(s, a, ev = null) {
  const side = s.turn, P = s.players[side];
  const log = (m) => { s.log.push(m); ev && ev.push({ type: 'log', m }); };
  const who = side === 0 ? '你' : 'AI';
  if (a.t === 'pass') {
    s.passes++;
    log(`${who}：結束行動`);
  } else {
    s.passes = 0;
    if (a.t === 'deploy') {
      const c = P.hand[a.card];
      P.energy -= cardCost(c); P.hand.splice(a.card, 1);
      addUnit(s, side, c, a.x, a.y, a.f);
      log(`${who}：部署 ${cardName(c)}`);
    } else if (a.t === 'move') {
      const u = byId(s, a.id);
      P.energy -= 1; u.moved = true; u.x += DV[a.d][0]; u.y += DV[a.d][1];
      log(`${who}：${UNITS[u.type].name} 移動`);
    } else if (a.t === 'rotate') {
      const u = byId(s, a.id); u.f = a.f; u.rotated = true;
      log(`${who}：${UNITS[u.type].name} 轉向 ${ARROW[a.f]}`);
    } else if (a.t === 'tactic') {
      const c = P.hand[a.card];
      P.energy -= cardCost(c); P.hand.splice(a.card, 1);
      const u = byId(s, a.id);
      log(`${who}：使用 ${cardName(c)} → ${u.side === side ? '己方' : '敵方'}${UNITS[u.type].name}`);
      switch (c) {
        case 'push': push(s, u, a.d, ev); break;
        case 'dash': for (let i = 0; i < 2 && walkable(s, u.x + DV[a.d][0], u.y + DV[a.d][1]); i++) { u.x += DV[a.d][0]; u.y += DV[a.d][1]; } break;
        case 'swap': { const v = byId(s, a.id2); [u.x, v.x] = [v.x, u.x]; [u.y, v.y] = [v.y, u.y]; break; }
        case 'turn': u.f = a.d; break;
        case 'guard': u.guard = true; break;
        case 'haste': u.ordOv = 0; break;
        case 'delay': u.ordOv = 9; break;
        case 'recall': s.units.splice(s.units.indexOf(u), 1); P.hand.push(u.type); break;
      }
      checkWin(s);
    }
  }
  if (s.phase === 'over') return s;
  if (s.passes >= 2) { s.phase = 'resolve'; return s; }
  s.turn = 1 - side;
  return s;
}

// ---------- 傷害、推擠 ----------
function damage(s, u, n, ev, src) {
  if (!s.units.includes(u) || n <= 0) return;
  if (u.guard) { u.guard = false; ev && ev.push({ type: 'block', id: u.id }); return; }
  u.hp -= n;
  ev && ev.push({ type: 'dmg', id: u.id, n });
  if (u.hp <= 0) kill(s, u, ev);
}
function kill(s, u, ev) {
  const i = s.units.indexOf(u);
  if (i < 0) return;
  s.units.splice(i, 1);
  ev && ev.push({ type: 'die', id: u.id, x: u.x, y: u.y });
  s.log.push(`${u.side === 0 ? '你的' : 'AI 的'}${UNITS[u.type].name} 陣亡`);
}
function fall(s, u, ev) { // 掉出場外或掉坑
  if (u.type === 'commander') { ev && ev.push({ type: 'fallsave', id: u.id }); u.guard = false; damage(s, u, 3, ev); }
  else { ev && ev.push({ type: 'fall', id: u.id }); kill(s, u, ev); }
}
export function push(s, u, d, ev) {
  if (!s.units.includes(u)) return;
  const nx = u.x + DV[d][0], ny = u.y + DV[d][1];
  if (ny < 0 || ny >= H) { damage(s, u, 1, ev); return; }           // 上下是牆
  if (nx < 0 || nx >= W) { fall(s, u, ev); return; }                // 左右是懸崖
  const v = unitAt(s, nx, ny);
  if (v) { damage(s, u, 1, ev); damage(s, v, 1, ev); return; }
  if (terr(s, nx, ny) === 'rock') { damage(s, u, 1, ev); return; }
  if (terr(s, nx, ny) === 'pit' && u.type === 'commander') { fall(s, u, ev); return; } // 指揮官不掉下去
  u.x = nx; u.y = ny; ev && ev.push({ type: 'move', id: u.id, x: nx, y: ny });
  if (terr(s, nx, ny) === 'pit') fall(s, u, ev);
}

// ---------- 攻擊目標（同時給畫面畫意圖用） ----------
// 回傳 [{x,y,kind:'dmg'|'heal', n}]，以目前盤面計算
export function intentOf(s, u) {
  const out = [], [dx, dy] = DV[u.f], a = atkOf(s, u);
  const enemyAt = (x, y) => { const v = unitAt(s, x, y); return v && v.side !== u.side ? v : null; };
  switch (u.type) {
    case 'assassin': case 'shield': case 'commander': case 'hammer':
      if (inB(u.x + dx, u.y + dy)) out.push({ x: u.x + dx, y: u.y + dy, kind: 'dmg', n: a, push: u.type === 'hammer' });
      break;
    case 'lancer':
      for (let k = 1; k <= 2; k++) {
        const x = u.x + dx * k, y = u.y + dy * k;
        if (!inB(x, y) || terr(s, x, y) === 'rock') break;
        out.push({ x, y, kind: 'dmg', n: a });
        const v = enemyAt(x, y); if (v && v.type === 'shield') break;
      }
      break;
    case 'archer': case 'hook':
      for (let k = u.type === 'archer' ? 2 : 1; ; k++) {
        const x = u.x + dx * k, y = u.y + dy * k;
        if (!inB(x, y) || terr(s, x, y) === 'rock') break;
        const v = enemyAt(x, y);
        if (v) { out.push({ x, y, kind: 'dmg', n: a, pull: u.type === 'hook' }); break; }
        out.push({ x, y, kind: 'path' });
      }
      break;
    case 'cannon': {
      const cx = u.x + dx * 2, cy = u.y + dy * 2;
      for (const [ox, oy] of [[0, 0], ...DV]) if (inB(cx + ox, cy + oy)) out.push({ x: cx + ox, y: cy + oy, kind: 'dmg', n: a, ff: true });
      break;
    }
    case 'medic':
      for (const [ox, oy] of DV) if (inB(u.x + ox, u.y + oy)) out.push({ x: u.x + ox, y: u.y + oy, kind: 'heal', n: 2 });
      break;
  }
  return out;
}

function attack(s, u, ev) {
  const tg = intentOf(s, u);
  for (const t of tg) {
    const v = unitAt(s, t.x, t.y);
    if (t.kind === 'heal') { if (v && v.side === u.side && v.hp < v.maxhp) { const h = Math.min(2, v.maxhp - v.hp); v.hp += h; ev && ev.push({ type: 'heal', id: v.id, n: h }); } continue; }
    if (t.kind !== 'dmg' || !v) continue;
    if (!t.ff && v.side === u.side) continue;
    damage(s, v, t.n, ev, u);
    if (t.push && s.units.includes(v)) push(s, v, u.f, ev);
    if (t.pull && s.units.includes(v)) { // 拉到鉤索面前
      const [dx, dy] = DV[u.f];
      while (s.units.includes(v)) {
        const nx = v.x - dx, ny = v.y - dy;
        if (nx === u.x && ny === u.y) break;
        if (!inB(nx, ny) || unitAt(s, nx, ny) || terr(s, nx, ny) === 'rock') break;
        if (terr(s, nx, ny) === 'pit' && v.type === 'commander') { fall(s, v, ev); break; }
        v.x = nx; v.y = ny; ev && ev.push({ type: 'move', id: v.id, x: nx, y: ny });
        if (terr(s, nx, ny) === 'pit') { fall(s, v, ev); break; }
      }
    }
  }
}

// 出手順序（同順序：本回合先手方先）
export function attackOrder(s) {
  return s.units.slice().sort((a, b) => ordOf(a) - ordOf(b) || (a.side === s.first ? 0 : 1) - (b.side === s.first ? 0 : 1) || a.y - b.y || a.x - b.x);
}

// 結算：steps = [{id, ev:[...]}]，每個出手一步
export function resolve(s, steps = null) {
  const order = attackOrder(s);
  for (const u of order) {
    if (!s.units.includes(u)) continue;
    const ev = steps ? [] : null;
    attack(s, u, ev);
    steps && steps.push({ id: u.id, ev });
    checkWin(s);
    if (s.phase === 'over') return s;
  }
  endRound(s);
  return s;
}

function checkWin(s) {
  const c0 = commander(s, 0), c1 = commander(s, 1);
  if (c0 && c1) return;
  s.phase = 'over';
  s.winner = !c0 && !c1 ? -1 : c0 ? 0 : 1;
}

function endRound(s) {
  if (s.round >= MAX_ROUND) {
    const tot = (sd) => s.units.filter((u) => u.side === sd).reduce((a, u) => a + (u.type === 'commander' ? u.hp * 100 : u.hp), 0);
    const h0 = tot(0), h1 = tot(1); // 先比指揮官血量，一樣再比其他單位總血量
    s.phase = 'over'; s.winner = h0 === h1 ? -1 : h0 > h1 ? 0 : 1; s.timeout = true;
    return;
  }
  s.round++; s.first = 1 - s.first;
  startRound(s);
}

export const clone = (s) => JSON.parse(JSON.stringify(s));

// ---------- AI ----------
function evaluate(s, side) {
  if (s.phase === 'over') return s.winner === side ? 1e4 : s.winner === -1 ? 0 : -1e4;
  let v = 0;
  for (const u of s.units) {
    const d = UNITS[u.type];
    const val = u.type === 'commander' ? u.hp * 6 : 3 + d.cost * 1.2 + u.hp + d.atk;
    v += u.side === side ? val : -val;
  }
  v += (s.players[side].hand.length - s.players[1 - side].hand.length) * 0.8;
  return v;
}
// 假設雙方都不再行動，直接結算看結果
function project(s, side) { const c = clone(s); if (c.phase === 'action') { c.phase = 'resolve'; } if (c.phase === 'resolve') resolve(c); return evaluate(c, side); }

export function aiChoose(s, level = 1) {
  const side = s.turn;
  const base = project(s, side);
  const acts = legalActions(s, side).filter((a) => a.t !== 'pass');
  const scored = [];
  for (const a of acts) {
    const c = clone(s);
    apply(c, a);
    let v = c.phase === 'over' ? evaluate(c, side) : project(c, side);
    if (a.t === 'deploy') { // 不要把單位放在自己人攻擊線上：小偏好往前排
      v += (a.y === HOME[side][side === 0 ? 0 : 1] ? 0.3 : 0);
    }
    if (a.t === 'rotate' || a.t === 'move') v -= 0.05;
    scored.push({ a, v });
  }
  scored.sort((x, y) => y.v - x.v);
  if (!scored.length || scored[0].v <= base + 0.1) return { t: 'pass' };
  if (level === 0 && Math.random() < 0.4) { // 新手：常常選次佳
    const ok = scored.filter((x) => x.v > base + 0.1).slice(0, 4);
    return ok[Math.floor(Math.random() * ok.length)].a;
  }
  return scored[0].a;
}
