// WILDKIN 對手 AI：同時部署，所以只看場上已揭曉的狀況，不偷看玩家的部署
import { byId, SPECIES } from './cards.js';
import { plan, unitsOf, zonePower, terrainAt, rand, canPlayTactic, playTactic, emptySlots, atkOf, isHome } from './engine.js';

const slotScore = (g, side, c, z, row, extra) => {
  const home = SPECIES[c.species].home === terrainAt(g, z);
  const mine = zonePower(g, side, z) + extra[z];
  const theirs = zonePower(g, 1 - side, z);
  let v = rand(g, 100) / 100;
  if (home) v += 2.5;
  if (mine <= theirs) v += 2;               // 還沒贏的區優先補
  if (mine > theirs + 3) v -= 2.5;          // 已經大贏就別再堆
  if (mine === 0 && theirs === 0) v += 1;   // 開新戰線
  const tanky = c.kw.guard || c.hp >= 4;
  const squishy = c.kw.ambush || c.hp <= 2;
  if (row === 'f') v += tanky ? 2 : squishy ? -1.5 : 0.5;
  else v += squishy ? 1.5 : tanky ? -1.5 : 0;
  return v;
};

export function aiDeploy(g, side) {
  const s = g.sides[side];
  const extra = [0, 0, 0];
  const animals = () => s.hand.filter((i) => byId[i.id].kind === 'animal' && byId[i.id].cost <= s.energy)
    .sort((a, b) => byId[b.id].cost - byId[a.id].cost + (rand(g, 3) - 1) * 0.5);
  for (let guard = 0; guard < 8; guard++) {
    const inst = animals()[0];
    if (!inst) break;
    const c = byId[inst.id];
    const slots = emptySlots(g, side).filter((e) => !s.plan.some((p) => p.z === e.z && p.row === e.row));
    if (!slots.length) break;
    let best = null, bestV = -1e9;
    for (const e of slots) {
      const v = slotScore(g, side, c, e.z, e.row, extra);
      if (v > bestV) { bestV = v; best = e; }
    }
    plan(g, side, inst.iid, best.z, best.row);
    extra[best.z] += c.atk;
  }
}

function tacticTarget(g, side, c) {
  const mine = unitsOf(g, side), foes = unitsOf(g, 1 - side);
  const contested = [0, 1, 2].filter((z) => Math.abs(zonePower(g, side, z) - zonePower(g, 1 - side, z)) <= 2 && (zonePower(g, side, z) + zonePower(g, 1 - side, z)) > 0);
  const inContested = mine.filter((u) => contested.includes(u.z));
  const pickBest = (list, f) => list.reduce((a, b) => (f(b) > f(a) ? b : a), list[0]);
  const op = c.play[0][0];
  switch (op) {
    case 'tHeal': { const hurt = mine.filter((u) => u.maxHp - u.hp >= 2); return hurt.length ? { uid: pickBest(hurt, (u) => u.maxHp - u.hp).uid } : null; }
    case 'tShield': case 'tHide': case 'tCounter': case 'tGuard': {
      const front = mine.filter((u) => u.row === 'f');
      return front.length ? { uid: pickBest(front, (u) => atkOf(g, u) + u.hp).uid } : null;
    }
    case 'tAtk': { const list = inContested.length ? inContested : mine; return list.length ? { uid: pickBest(list, (u) => u.hp).uid } : null; }
    case 'tTempSpd': return null;
    case 'tDmg': {
      if (!foes.length) return null;
      const n = c.play[0][1];
      const killable = foes.filter((u) => u.hp + u.shield <= n);
      return { uid: pickBest(killable.length ? killable : foes, (u) => atkOf(g, u)).uid };
    }
    case 'move': {
      const away = mine.filter((u) => !isHome(g, u) && SPECIES[byId[u.cardId].species].home);
      for (const u of away) {
        const dest = emptySlots(g, side).find((e) => terrainAt(g, e.z) === SPECIES[byId[u.cardId].species].home);
        if (dest) return { uid: u.uid, dest };
      }
      return null;
    }
    case 'terrain': return null;   // 地形牌需要精算，原型 AI 先不用，避免亂丟
    case 'truce': {
      const losing = [0, 1, 2].find((z) => zonePower(g, side, z) > zonePower(g, 1 - side, z) && zonePower(g, 1 - side, z) > 0 && unitsOf(g, side).filter((u) => u.z === z).every((u) => u.hp <= 2));
      return losing === undefined ? null : { z: losing };
    }
    case 'energy': return {};
    case 'draw': return {};
    case 'allTempSide': return mine.length >= 3 ? {} : null;
    case 'ambushAll': return mine.length >= 3 && foes.some((u) => u.row === 'b') ? {} : null;
    case 'reverse': {
      const avg = (l) => (l.length ? l.reduce((n, u) => n + u.spd, 0) / l.length : 0);
      return mine.length && foes.length && avg(mine) + 1.5 < avg(foes) ? {} : null;
    }
    default: return null;
  }
}

export function aiTactic(g, side) {
  const s = g.sides[side];
  for (let guard = 0; guard < 10; guard++) {
    let played = false;
    for (const inst of [...s.hand]) {
      if (!canPlayTactic(g, side, inst.iid)) continue;
      const t = tacticTarget(g, side, byId[inst.id]);
      if (t && playTactic(g, side, inst.iid, t)) { played = true; break; }
    }
    if (!played) break;
  }
}

// 對照組：完全亂下的機器人，用來確認 AI 真的比亂下強
export function randomDeploy(g, side) {
  const s = g.sides[side];
  for (const inst of [...s.hand].sort(() => rand(g, 3) - 1)) {
    const c = byId[inst.id];
    if (c.kind !== 'animal' || c.cost > s.energy) continue;
    const slots = emptySlots(g, side).filter((e) => !s.plan.some((p) => p.z === e.z && p.row === e.row));
    if (!slots.length) break;
    const e = slots[rand(g, slots.length)];
    plan(g, side, inst.iid, e.z, e.row);
  }
}
