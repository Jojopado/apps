// WILDKIN 規則引擎：不碰畫面，UI 與機器人共用。side 0＝玩家、1＝對手。
import { CARDS, TERRAINS, SPECIES, byId } from './cards.js';

export const RULES = { winScore: 7, maxRounds: 5, handLimit: 7, startHand: 4, shieldCap: 5 };
export const energyForRound = (r) => Math.min(3 + r - 1, 7);

function mulberry(g) {
  g.rs = (g.rs + 0x6d2b79f5) | 0;
  let t = g.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rand = (g, n) => Math.floor(mulberry(g) * n);
function shuffle(g, arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = rand(g, i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

const emit = (g, e) => g.ev.push(e);
const say = (g, msg) => emit(g, { t: 'log', msg });

function makeSide(g, deckIds) {
  let iid = 0;
  const deck = deckIds.map((id) => ({ iid: `${g.sides.length}-${iid++}`, id }));
  return {
    deck, hand: [], grave: [], energy: 0, nextE: 0, score: 0, plan: [], peeked: false,
    board: [{ f: null, b: null }, { f: null, b: null }, { f: null, b: null }],
  };
}

export function newGame(deckA, deckB, seed = (Math.random() * 1e9) | 0) {
  const g = {
    rs: seed | 0, round: 0, maxRounds: RULES.maxRounds, overtime: false, turn: 0, phase: 'init', sides: [], ev: [],
    zoneOv: [null, null, null], truce: [false, false, false], lakeUsed: false, reverse: false, ambushAll: [false, false],
    uid: 1, queue: [], acted: new Set(), winner: null, endReason: '', stats: { attacks: 0, roundsNoAttack: 0, thisRoundAttacks: 0 },
  };
  g.sides.push(makeSide(g, deckA));
  g.sides.push(makeSide(g, deckB));
  g.turn = rand(g, 2);
  for (const s of g.sides) {
    // 起手保證至少有一張能在第 1 回合上場的動物，省掉換牌流程
    for (let tries = 0; tries < 30; tries++) {
      shuffle(g, s.deck);
      if (s.deck.slice(0, RULES.startHand).some((c) => byId[c.id].kind === 'animal' && byId[c.id].cost <= 3)) break;
    }
    for (let i = 0; i < RULES.startHand; i++) s.hand.push(s.deck.pop());
  }
  g.turn = 1 - g.turn; // nextRound 會換回來
  nextRound(g);
  return g;
}

export const terrainAt = (g, z) => g.zoneOv[z] || TERRAINS[z].id;
export const cardOf = (u) => byId[u.cardId];
export const unitsOf = (g, side) => {
  const out = [];
  g.sides[side].board.forEach((b) => { if (b.f) out.push(b.f); if (b.b) out.push(b.b); });
  return out;
};
export const allUnits = (g) => [...unitsOf(g, 0), ...unitsOf(g, 1)];
export const isHome = (g, u) => SPECIES[cardOf(u).species].home === terrainAt(g, u.z);
const bondOn = (g, u) => {
  const b = cardOf(u).bond;
  return b && unitsOf(g, u.side).some((o) => o !== u && cardOf(o).fac === b.fac) ? b : null;
};
export const hasBond = (g, u) => !!bondOn(g, u);
export function atkOf(g, u) { return Math.max(0, u.atk + u.tAtk + (bondOn(g, u)?.atk || 0)); }
export function spdOf(g, u) { return Math.max(0, u.spd + u.tSpd - u.slow + (bondOn(g, u)?.spd || 0)); }
export function zonePower(g, side, z) {
  const b = g.sides[side].board[z];
  return (b.f ? atkOf(g, b.f) : 0) + (b.b ? atkOf(g, b.b) : 0);
}

function draw(g, side, n) {
  const s = g.sides[side];
  for (let i = 0; i < n; i++) {
    if (!s.deck.length || s.hand.length >= RULES.handLimit) return;
    s.hand.push(s.deck.pop());
    emit(g, { t: 'draw', side });
  }
}
const slotOf = (u) => `${u.side}-${u.z}-${u.row}`;
const addShield = (g, u, n) => { u.shield = Math.min(RULES.shieldCap, u.shield + n); emit(g, { t: 'status', slot: slotOf(u), text: `護盾+${n}`, kind: 'shield' }); };
function heal(g, u, n) {
  const v = Math.min(n, u.maxHp - u.hp);
  if (v > 0) { u.hp += v; emit(g, { t: 'status', slot: slotOf(u), text: `+${v}`, kind: 'heal' }); }
}
function freeze(g, u) { u.frozen = 1; emit(g, { t: 'status', slot: slotOf(u), text: '凍結', kind: 'ice' }); }
function slow(g, u, n, next) {
  if (next) u.slowNext += n; else u.slow += n;
  emit(g, { t: 'status', slot: slotOf(u), text: `速度-${n}`, kind: 'ice' });
}
const zoneFoes = (g, u) => { const b = g.sides[1 - u.side].board[u.z]; return [b.f, b.b].filter(Boolean); };
const zoneAllies = (g, u) => { const b = g.sides[u.side].board[u.z]; return [b.f, b.b].filter(Boolean); };

function kill(g, u) {
  const s = g.sides[u.side];
  s.board[u.z][u.row] = null;
  s.grave.push(u.cardId);
  emit(g, { t: 'death', slot: slotOf(u), name: cardOf(u).name });
  runFx(g, u, 'death');
}

// isAttack：一般攻擊才會被隱匿／冰盾擋下，也才會觸發反擊
function damage(g, target, n, attacker, isAttack) {
  const slot = slotOf(target);
  if (isAttack && target.hide) { target.hide = false; emit(g, { t: 'miss', slot, text: '落空' }); return { hit: false, hp: 0, killed: false }; }
  if (isAttack && target.block > 0) { target.block--; emit(g, { t: 'miss', slot, text: '冰盾' }); return { hit: false, hp: 0, killed: false }; }
  let left = n;
  if (isHomeDeer(g, target) && !target.deerUsed && left > 0) { target.deerUsed = true; left = Math.max(0, left - 1); }
  const absorbed = Math.min(target.shield, left);
  target.shield -= absorbed;
  left -= absorbed;
  target.hp -= left;
  emit(g, { t: 'dmg', slot, n: left, absorbed });
  const killed = target.hp <= 0;
  if (killed) kill(g, target);
  return { hit: true, hp: left, killed };
}
const isHomeDeer = (g, u) => cardOf(u).species === 'deer' && isHome(g, u);

function randomFoe(g, side) { const list = unitsOf(g, 1 - side); return list.length ? list[rand(g, list.length)] : null; }

const OPS = {
  draw: (c, n) => draw(c.g, c.side, n),
  energy: (c, n) => { c.g.sides[c.side].energy += n; emit(c.g, { t: 'energy', side: c.side, n }); },
  energyNext: (c, n) => { c.g.sides[c.side].nextE += n; },
  drain: (c, n) => { c.g.sides[1 - c.side].nextE -= n; say(c.g, '對手下回合能量減少'); },
  discard: (c, n) => {
    const h = c.g.sides[1 - c.side].hand;
    for (let i = 0; i < n && h.length; i++) { const [lost] = h.splice(rand(c.g, h.length), 1); c.g.sides[1 - c.side].grave.push(lost.id); say(c.g, `手牌「${byId[lost.id].name}」被偷走了`); }
  },
  allTemp: (c, [a, s]) => unitsOf(c.g, c.side).forEach((u) => { u.tAtk += a; u.tSpd += s; }),
  allTempSide: (c, [a, s]) => unitsOf(c.g, c.side).forEach((u) => { u.tAtk += a; u.tSpd += s; }),
  selfShield: (c, n) => addShield(c.g, c.u, n),
  zoneShield: (c, n) => zoneAllies(c.g, c.u).forEach((u) => { if (u !== c.u) addShield(c.g, u, n); }),
  zoneHeal: (c, n) => zoneAllies(c.g, c.u).forEach((u) => heal(c.g, u, n)),
  handAtk: (c) => { c.u.atk += Math.floor(c.g.sides[c.side].hand.length / 2); },
  zoneSlow: (c, n) => zoneFoes(c.g, c.u).forEach((u) => slow(c.g, u, n, false)),
  randSlow: (c, n) => { const u = randomFoe(c.g, c.side); if (u) slow(c.g, u, n, false); },
  tgtSlowNext: (c, n) => { if (c.t && c.t.hp > 0) slow(c.g, c.t, n, true); },
  freezeFront: (c) => { const f = c.g.sides[1 - c.side].board[c.u.z].f; if (f) freeze(c.g, f); },
  freezeAllFront: (c) => c.g.sides[1 - c.side].board.forEach((b) => { if (b.f) freeze(c.g, b.f); }),
  freezeAttacker: (c) => { if (c.t && c.t.hp > 0) freeze(c.g, c.t); },
  swapFoe: (c) => {
    const b = c.g.sides[1 - c.side].board[c.u.z];
    [b.f, b.b] = [b.b, b.f];
    if (b.f) b.f.row = 'f';
    if (b.b) b.b.row = 'b';
    if (b.f || b.b) say(c.g, '敵方前後排互換了');
  },
  weakFront: (c, n) => { const f = c.g.sides[1 - c.side].board[c.u.z].f; if (f) { f.atk = Math.max(0, f.atk - n); emit(c.g, { t: 'status', slot: slotOf(f), text: `攻擊-${n}`, kind: 'ice' }); } },
  // 道具／事件
  tHeal: (c, n) => heal(c.g, c.t, n),
  tShield: (c, n) => addShield(c.g, c.t, n),
  tAtk: (c, n) => { c.t.atk += n; emit(c.g, { t: 'status', slot: slotOf(c.t), text: `攻擊+${n}`, kind: 'buff' }); },
  tTempSpd: (c, n) => { c.t.tSpd += n; emit(c.g, { t: 'status', slot: slotOf(c.t), text: `速度+${n}`, kind: 'buff' }); },
  tHide: (c) => { c.t.hide = true; emit(c.g, { t: 'status', slot: slotOf(c.t), text: '隱匿', kind: 'buff' }); },
  tGuard: (c) => { c.t.kw.guard = 1; },
  tHp: (c, n) => { c.t.maxHp += n; c.t.hp += n; emit(c.g, { t: 'status', slot: slotOf(c.t), text: `HP+${n}`, kind: 'heal' }); },
  tCounter: (c, n) => { c.t.kw.counter = (c.t.kw.counter || 0) + n; emit(c.g, { t: 'status', slot: slotOf(c.t), text: `反擊+${n}`, kind: 'buff' }); },
  tDmg: (c, n) => { damage(c.g, c.t, n, null, false); },
  terrain: (c, id) => { c.g.zoneOv[c.z] = id; say(c.g, `${TERRAINS[c.z].name}區本回合變成${TERRAINS.find((x) => x.id === id).name}`); },
  truce: (c) => { c.g.truce[c.z] = true; say(c.g, `${TERRAINS[c.z].name}區本回合休戰`); },
  reverse: (c) => { c.g.reverse = true; say(c.g, '本回合改由速度低的先攻擊'); },
  ambushAll: (c) => { c.g.ambushAll[c.side] = true; say(c.g, '全體獲得伏擊'); },
  move: (c, _n) => moveUnit(c.g, c.t, c.dest.z, c.dest.row),
};

function runFx(g, u, trig, t) {
  for (const [when, op, arg] of cardOf(u).fx) if (when === trig) OPS[op]({ g, side: u.side, u, t }, arg);
}

function moveUnit(g, u, z, row) {
  const s = g.sides[u.side];
  s.board[u.z][u.row] = null;
  u.z = z; u.row = row;
  s.board[z][row] = u;
  checkForestPeek(g, u);
}

function checkForestPeek(g, u) {
  const s = g.sides[u.side];
  if (terrainAt(g, u.z) === 'forest' && !s.peeked && s.deck.length) {
    s.peeked = true;
    emit(g, { t: 'peek', side: u.side, iid: s.deck[s.deck.length - 1].iid, id: s.deck[s.deck.length - 1].id });
  }
}
export function peekToBottom(g, side) {
  const s = g.sides[side];
  if (s.deck.length > 1) s.deck.unshift(s.deck.pop());
}

function spawn(g, side, cardId, z, row) {
  const c = byId[cardId];
  const u = {
    uid: g.uid++, cardId, side, z, row, atk: c.atk, hp: c.hp, maxHp: c.hp, spd: c.spd, tAtk: 0, tSpd: 0, slow: 0, slowNext: 0,
    shield: 0, block: 0, hide: !!c.kw.hide, frozen: 0, deerUsed: false, kw: { ...c.kw },
  };
  g.sides[side].board[z][row] = u;
  emit(g, { t: 'deploy', slot: slotOf(u), side, name: c.name });
  if (isHome(g, u)) {
    if (c.species === 'squirrel') OPS.energy({ g, side }, 1);
    if (c.species === 'rabbit') { u.tAtk += 1; u.tSpd += 1; }
    if (c.species === 'penguin') u.block = 1;
  }
  checkForestPeek(g, u);
  runFx(g, u, 'enter');
  return u;
}

export function nextRound(g) {
  g.round++;
  g.turn = 1 - g.turn;
  g.zoneOv = [null, null, null];
  g.truce = [false, false, false];
  g.lakeUsed = false; g.reverse = false; g.ambushAll = [false, false];
  g.stats.thisRoundAttacks = 0;
  const order = [g.turn, 1 - g.turn];
  for (const side of order) {
    const s = g.sides[side];
    s.peeked = false; s.plan = [];
    draw(g, side, 1);
    s.energy = Math.max(0, energyForRound(g.round) + s.nextE);
    s.nextE = 0;
  }
  for (const u of allUnits(g)) { u.slow = u.slowNext; u.slowNext = 0; u.deerUsed = false; }
  for (const side of order) for (const u of unitsOf(g, side)) runFx(g, u, 'rstart');
  g.phase = 'deploy';
  emit(g, { t: 'round', round: g.round, turn: g.turn });
}

// ── 部署（雙方同時，揭曉前對手看不到）──
export function canPlan(g, side, iid, z, row) {
  if (g.phase !== 'deploy' || ![0, 1, 2].includes(z) || !['f', 'b'].includes(row)) return false;
  const s = g.sides[side];
  const card = s.hand.find((c) => c.iid === iid);
  if (!card || byId[card.id].kind !== 'animal' || byId[card.id].cost > s.energy) return false;
  return !s.board[z][row] && !s.plan.some((p) => p.z === z && p.row === row);
}
export function plan(g, side, iid, z, row) {
  if (!canPlan(g, side, iid, z, row)) return false;
  const s = g.sides[side];
  const idx = s.hand.findIndex((c) => c.iid === iid);
  const [card] = s.hand.splice(idx, 1);
  s.energy -= byId[card.id].cost;
  s.plan.push({ card, z, row });
  return true;
}
export function unplan(g, side, z, row) {
  if (g.phase !== 'deploy') return false;
  const s = g.sides[side];
  const i = s.plan.findIndex((p) => p.z === z && p.row === row);
  if (i < 0) return false;
  const [p] = s.plan.splice(i, 1);
  s.hand.push(p.card);
  s.energy += byId[p.card.id].cost;
  return true;
}
export function beginReveal(g) {
  if (g.phase !== 'deploy') return false;
  g.phase = 'reveal';
  g.queue = [g.turn, 1 - g.turn].flatMap((side) => g.sides[side].plan.map((p) => ({ side, ...p })));
  g.sides.forEach((s) => { s.plan = []; });
  return true;
}
export function stepReveal(g) {
  if (g.phase !== 'reveal') return false;
  const p = g.queue.shift();
  if (!p) { g.phase = 'tactic'; return false; }
  spawn(g, p.side, p.card.id, p.z, p.row);
  return true;
}

// ── 戰術階段：道具與事件 ──
export function validTargets(g, side, card) {
  // 回傳此卡可選的目標；null 代表不需要目標
  if (card.t === 'ally') return unitsOf(g, side);
  if (card.t === 'enemy') return unitsOf(g, 1 - side);
  if (card.t === 'zone') return [0, 1, 2];
  return null;
}
export function emptySlots(g, side) {
  const out = [];
  g.sides[side].board.forEach((b, z) => { for (const row of ['f', 'b']) if (!b[row]) out.push({ z, row }); });
  return out;
}
export function canPlayTactic(g, side, iid) {
  if (g.phase !== 'tactic') return false;
  const s = g.sides[side];
  const inst = s.hand.find((c) => c.iid === iid);
  if (!inst) return false;
  const c = byId[inst.id];
  if (c.kind === 'animal' || c.cost > s.energy) return false;
  const t = validTargets(g, side, c);
  if (t && !t.length) return false;
  if (c.play[0][0] === 'move' && !emptySlots(g, side).length) return false;
  return true;
}
// target: {uid} 或 {z}；傳送葉另加 dest:{z,row}
export function playTactic(g, side, iid, target = {}) {
  if (!canPlayTactic(g, side, iid)) return false;
  const s = g.sides[side];
  const idx = s.hand.findIndex((c) => c.iid === iid);
  const c = byId[s.hand[idx].id];
  const ctx = { g, side };
  if (c.t === 'ally' || c.t === 'enemy') {
    const pool = validTargets(g, side, c);
    ctx.t = pool.find((u) => u.uid === target.uid);
    if (!ctx.t) return false;
  }
  if (c.t === 'zone') { if (![0, 1, 2].includes(target.z)) return false; ctx.z = target.z; }
  if (c.play[0][0] === 'move') {
    const d = target.dest;
    if (!d || !emptySlots(g, side).some((e) => e.z === d.z && e.row === d.row)) return false;
    ctx.dest = d;
  }
  const [inst] = s.hand.splice(idx, 1);
  s.energy -= c.cost;
  s.grave.push(inst.id);
  emit(g, { t: 'tactic', side, name: c.name });
  for (const [op, arg] of c.play) {
    if (ctx.t && ctx.t.hp <= 0) break;
    OPS[op](ctx, arg);
  }
  return true;
}

// ── 戰鬥 ──
export function beginBattle(g) {
  if (g.phase !== 'tactic') return false;
  g.phase = 'battle';
  g.acted = new Set();
  g.pendingExtra = null;
  return true;
}
function compareUnits(g, a, b) {
  const sa = spdOf(g, a), sb = spdOf(g, b);
  if (sa !== sb) return g.reverse ? sa - sb : sb - sa;
  if (a.side !== b.side) return a.side === g.turn ? -1 : 1;
  if (a.z !== b.z) return a.z - b.z;
  return a.row === 'f' ? -1 : 1;
}
export function attackOrder(g) {
  return allUnits(g).filter((u) => !g.acted.has(u.uid)).sort((a, b) => compareUnits(g, a, b));
}
// 目標順序：同區（伏擊→守護→前排→後排），同區沒敵人就依距離找別區
export function pickTarget(g, u) {
  if (g.truce[u.z]) return null;
  const foe = g.sides[1 - u.side].board;
  const zones = [0, 1, 2].filter((z) => !g.truce[z]).sort((a, b) => Math.abs(a - u.z) - Math.abs(b - u.z) || a - b);
  for (const z of zones) {
    const { f, b } = foe[z];
    if (!f && !b) continue;
    if (z === u.z && (u.kw.ambush || g.ambushAll[u.side]) && b) return b;
    if (f?.kw.guard) return f;
    if (b?.kw.guard) return b;
    return f || b;
  }
  return null;
}
function performAttack(g, u) {
  const t = pickTarget(g, u);
  if (!t) return null;
  g.stats.attacks++; g.stats.thisRoundAttacks++;
  const home = isHome(g, u);
  const sp = cardOf(u).species;
  const dmg = atkOf(g, u) + (home && sp === 'fox' ? 1 : 0);
  emit(g, { t: 'attack', from: slotOf(u), to: slotOf(t), side: u.side });
  const tSp = cardOf(t).species;
  const tHome = isHome(g, t);
  const lakeZone = terrainAt(g, t.z) === 'lake';
  const res = damage(g, t, dmg, u, true);
  if (res.hit) {
    if (lakeZone && !g.lakeUsed && res.hp > 0 && !res.killed) { g.lakeUsed = true; slow(g, t, 2, true); }
    if (!res.killed) {
      runFx(g, u, 'attack', t);
      if (home && sp === 'frog') slow(g, t, 1, true);
    }
    // 反射與反擊：只由一般攻擊觸發，不會互相連鎖
    if (t.hp > 0 || res.killed) {
      if (tHome && tSp === 'hedgehog' && u.hp > 0) damage(g, u, 1, t, false);
      if (t.hp > 0 && res.hp > 0 && u.hp > 0) {
        const n = (t.kw.counter || 0) + (tHome && tSp === 'bear' ? 1 : 0);
        if (n > 0) { emit(g, { t: 'status', slot: slotOf(t), text: '反擊', kind: 'buff' }); damage(g, u, n, t, false); }
      }
      if (t.hp > 0 && res.hp > 0) runFx(g, t, 'hurt', u);
    }
  }
  return res;
}
export function stepBattle(g) {
  if (g.phase !== 'battle') return false;
  let u = null;
  const extra = g.pendingExtra;
  if (extra) {
    g.pendingExtra = null;
    if (extra.hp > 0 && g.sides[extra.side].board[extra.z][extra.row] === extra) u = extra;
  }
  let isExtra = !!u;
  while (!u) {
    const next = attackOrder(g)[0];
    if (!next) { g.phase = 'settle'; return false; }
    g.acted.add(next.uid);
    if (next.frozen > 0) { next.frozen = 0; emit(g, { t: 'status', slot: slotOf(next), text: '凍結中', kind: 'ice' }); return true; }
    if (!pickTarget(g, next)) continue;
    u = next;
  }
  const res = performAttack(g, u);
  if (u.hp > 0) {
    if (!isExtra && u.kw.double) g.pendingExtra = u;
    else if (res?.killed && u.kw.pursuit && !isExtra) g.pendingExtra = u;
    // 水獺在湖泊或有「移動」：打完退到後排
    const canRetreat = u.kw.retreat || (cardOf(u).species === 'otter' && isHome(g, u));
    if (!g.pendingExtra && canRetreat && u.row === 'f' && !g.sides[u.side].board[u.z].b) {
      const from = slotOf(u);
      moveUnit(g, u, u.z, 'b');
      emit(g, { t: 'moved', from, to: slotOf(u) });
    }
  }
  return true;
}

// 地形→回合結束效果→計分→勝負
export function settleRound(g) {
  if (g.phase !== 'settle') return false;
  if (g.stats.thisRoundAttacks === 0 && allUnits(g).length) g.stats.roundsNoAttack++;
  for (const side of [g.turn, 1 - g.turn]) {
    g.sides[side].board.forEach((b, z) => {
      if (terrainAt(g, z) === 'grass' && b.f) addShield(g, b.f, 1);
    });
  }
  for (const side of [g.turn, 1 - g.turn]) for (const u of unitsOf(g, side)) if (u.hp > 0) runFx(g, u, 'rend');
  const zones = [0, 1, 2].map((z) => {
    const a = zonePower(g, 0, z), b = zonePower(g, 1, z);
    const win = a > b ? 0 : b > a ? 1 : null;
    if (win !== null) g.sides[win].score++;
    return { z, a, b, win };
  });
  emit(g, { t: 'score', zones });
  for (const u of allUnits(g)) { u.tAtk = 0; u.tSpd = 0; }
  checkEnd(g);
  return true;
}
const totalPower = (g, side) => unitsOf(g, side).reduce((n, u) => n + atkOf(g, u) + u.hp, 0);
function finish(g, winner, reason) { g.winner = winner; g.endReason = reason; g.phase = 'over'; }
function checkEnd(g) {
  const [a, b] = [g.sides[0].score, g.sides[1].score];
  const reached = a >= RULES.winScore || b >= RULES.winScore;
  if (reached && a !== b) return finish(g, a > b ? 0 : 1, 'score7');
  if (g.round >= g.maxRounds || reached) {
    if (a !== b) return finish(g, a > b ? 0 : 1, 'rounds');
    const pa = totalPower(g, 0), pb = totalPower(g, 1);
    if (pa !== pb) return finish(g, pa > pb ? 0 : 1, 'power');
    if (!g.overtime) { g.overtime = true; g.maxRounds = g.round + 1; g.phase = 'roundEnd'; return; }
    return finish(g, -1, 'draw');
  }
  g.phase = 'roundEnd';
}
export function surrender(g, side) { finish(g, 1 - side, 'surrender'); }

// 檢查整體狀態是否合法（測試用）
export function invariantErrors(g) {
  const bad = [];
  g.sides.forEach((s, i) => {
    if (s.energy < 0 || !Number.isFinite(s.energy)) bad.push(`side${i} energy ${s.energy}`);
    if (s.hand.length > RULES.handLimit) bad.push(`side${i} hand ${s.hand.length}`);
    s.board.forEach((b, z) => {
      for (const row of ['f', 'b']) {
        const u = b[row];
        if (!u) continue;
        if (u.z !== z || u.row !== row || u.side !== i) bad.push(`unit position mismatch ${u.uid}`);
        if (!(u.hp > 0) || u.hp > u.maxHp) bad.push(`hp ${u.cardId} ${u.hp}/${u.maxHp}`);
        if (![u.atk, u.spd, u.shield, u.tAtk, u.tSpd, u.slow].every(Number.isFinite)) bad.push(`NaN ${u.cardId}`);
        if (u.atk < 0 || u.shield < 0 || u.shield > RULES.shieldCap) bad.push(`range ${u.cardId}`);
      }
    });
  });
  return bad;
}
