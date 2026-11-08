// 第九防線：純模擬（不碰畫面），瀏覽器與 node 測試共用
export const W = 1000, H = 1600, DT = 1 / 30, NIGHT_LEN = 170, NIGHTS = 3;
export const MAX_Z = 800, RING_R = 92, RING_N = 16;

const SECTORS = [
  { id: 'pass', name: '北隘口', x: 500, y: 170, civ: 12, stock: 30 },
  { id: 'mill', name: '磨坊鎮', x: 240, y: 480, civ: 30, stock: 50 },
  { id: 'mine', name: '採石場', x: 770, y: 540, civ: 20, stock: 50 },
  { id: 'bridge', name: '鐵橋', x: 510, y: 830, civ: 14, stock: 60 },
  { id: 'farm', name: '麥田村', x: 210, y: 1110, civ: 28, stock: 40 },
  { id: 'dam', name: '水壩站', x: 800, y: 1130, civ: 24, stock: 40 },
  { id: 'hq', name: '第九基地', x: 505, y: 1450, civ: 0, stock: 340 },
];
export const ROADS = [
  ['pass', 'mill', [[360, 300]]], ['pass', 'mine', [[660, 330]]],
  ['mill', 'bridge', [[330, 680]]], ['mine', 'bridge', [[690, 720]]],
  ['bridge', 'farm', [[380, 980]]], ['bridge', 'dam', [[640, 990]]],
  ['farm', 'hq', [[300, 1300]]], ['dam', 'hq', [[710, 1320]]],
];
const NEXT = { pass: ['mill', 'mine'], mill: ['bridge'], mine: ['bridge'], bridge: ['farm', 'dam'], farm: ['hq'], dam: ['hq'], hq: [] };
export const riverY = (x) => 830 + 28 * Math.sin((x - 510) / 130);
const inRiver = (x, y) => Math.abs(y - riverY(x)) < 34 && Math.abs(x - 510) > 46;

export const ZT = {
  w: { hp: 30, spd: 21, dmg: 7, sense: 110, cd: 0.9 },
  r: { hp: 18, spd: 50, dmg: 5, sense: 170, cd: 0.7 },
  b: { hp: 260, spd: 15, dmg: 24, sense: 120, cd: 1.2 },
};

export const UPGRADES = {
  squad: { name: '增援步兵', desc: '立刻多一支 8 人小隊' },
  apc: { name: '增援裝甲車', desc: '立刻多一輛裝甲車' },
  truck: { name: '多一輛卡車', desc: '運補和撤離的量多一輛' },
  cap: { name: '加長貨廂', desc: '每輛卡車多載 4 人、多運 20 補給' },
  ammo: { name: '擴充彈藥袋', desc: '小隊彈藥上限 +30%' },
  dmg: { name: '穿甲彈', desc: '步兵傷害 +30%' },
  turret: { name: '機槍塔校準', desc: '機槍塔傷害 +40%' },
  wall: { name: '混凝土加固', desc: '圍牆耐久 +50%，已蓋的也算' },
  arty: { name: '追加砲彈', desc: '每夜砲擊 +2 次' },
  strafe: { name: '空軍支援', desc: '每夜掃射 +1 次' },
  stock: { name: '空投補給', desc: '基地立刻 +150 補給' },
  heli: { name: '直升機火箭莢艙', desc: '直升機彈藥與傷害 +50%' },
};

// ---- 道路圖 ----
const nodes = [], adj = [];
const addNode = (x, y) => { nodes.push({ x, y }); adj.push([]); return nodes.length - 1; };
const sectorNode = {};
for (const s of SECTORS) sectorNode[s.id] = addNode(s.x, s.y);
for (const [a, b, mids] of ROADS) {
  const A = SECTORS.find((s) => s.id === a), B = SECTORS.find((s) => s.id === b);
  const pts = [[A.x, A.y], ...mids, [B.x, B.y]];
  let prev = sectorNode[a];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 32));
    for (let k = 1; k <= steps; k++) {
      const last = i + 2 === pts.length && k === steps;
      const n = last ? sectorNode[b] : addNode(x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps);
      const d = Math.hypot(nodes[n].x - nodes[prev].x, nodes[n].y - nodes[prev].y);
      adj[prev].push([n, d]); adj[n].push([prev, d]);
      prev = n;
    }
  }
}
function nearestNode(x, y) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const d = (nodes[i].x - x) ** 2 + (nodes[i].y - y) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
export function route(x0, y0, x1, y1) {
  const a = nearestNode(x0, y0), b = nearestNode(x1, y1);
  const dist = new Float64Array(nodes.length).fill(Infinity), prev = new Int32Array(nodes.length).fill(-1), done = new Uint8Array(nodes.length);
  dist[a] = 0;
  for (;;) {
    let u = -1, m = Infinity;
    for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i] < m) { m = dist[i]; u = i; }
    if (u < 0 || u === b) break;
    done[u] = 1;
    for (const [v, d] of adj[u]) if (dist[u] + d < dist[v]) { dist[v] = dist[u] + d; prev[v] = u; }
  }
  const out = [];
  for (let n = b; n >= 0; n = prev[n]) out.push({ x: nodes[n].x, y: nodes[n].y });
  return out.reverse();
}

// ---- 建立遊戲 ----
function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newGame(seed = 1) {
  const G = {
    seed, rnd: rngFrom(seed), tick: 0, t: 0, night: 1, phase: 'night', uid: 1,
    sectors: SECTORS.map((s) => ({ ...s, status: 'held', ring: null, turrets: 0, lostT: 0, backT: 0, nz: 0, nh: 0, startCiv: s.civ })),
    zombies: [], squads: [], vehicles: [], turrets: [], builds: [], strikes: [], corpses: [], humans: [],
    events: [], alerts: [], fx: [],
    hqHp: 1000, hqMax: 1000, saved: 0, civLost: 0, kills: 0, unitsLost: 0,
    support: { arty: 4, strafe: 2 }, supportMax: { arty: 4, strafe: 2 },
    mult: { dmg: 1, ammo: 1, turret: 1, wall: 1, cap: 0, heli: 1 },
    names: { squad: 0, apc: 0, truck: 0, heli: 0 },
    offer: null, report: null, taken: [], nightSaved: 0,
    head: new Int32Array(25 * 40).fill(-1), next: new Int32Array(MAX_Z + 8),
  };
  G.byId = Object.fromEntries(G.sectors.map((s) => [s.id, s]));
  addSquad(G, 'mill'); addSquad(G, 'mine'); addSquad(G, 'bridge');
  addVehicle(G, 'apc', 'bridge');
  addVehicle(G, 'truck', 'hq'); addVehicle(G, 'truck', 'hq');
  addVehicle(G, 'heli', 'hq');
  buildRing(G, G.byId.hq);
  for (let i = 0; i < 2; i++) addTurret(G, G.byId.hq);
  planNight(G);
  return G;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function addSquad(G, at) {
  const s = G.byId[at];
  const name = `${LETTERS[G.names.squad++ % 26]} 隊`;
  const sq = { id: G.uid++, kind: 'squad', name, x: s.x, y: s.y + 20, tx: null, ty: null, order: 'hold', ammo: 0, ammoMax: 0, soldiers: [], carried: false };
  sq.ammoMax = sq.ammo = Math.round(170 * G.mult.ammo);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    sq.soldiers.push({ kind: 'soldier', x: sq.x + Math.cos(a) * 16, y: sq.y + Math.sin(a) * 16, hp: 40, hpMax: 40, cd: G.rnd() * 0.5, rad: 5, dead: false, a: 0 });
  }
  G.squads.push(sq);
  return sq;
}
const VSPEC = {
  apc: { name: '裝甲', hp: 420, spd: 80, rad: 13 },
  truck: { name: '運輸', hp: 260, spd: 88, rad: 11 },
  heli: { name: '獵鷹', hp: 260, spd: 230, rad: 14 },
};
function addVehicle(G, type, at) {
  const s = G.byId[at], sp = VSPEC[type];
  const off = G.vehicles.length * 16 - 40;
  const v = {
    id: G.uid++, kind: type, name: `${sp.name} ${++G.names[type]}`, x: s.x + off, y: s.y + 42, hp: sp.hp, hpMax: sp.hp, rad: sp.rad,
    spd: sp.spd, path: [], pi: 0, dead: false, cd: 0, jam: 0, a: -Math.PI / 2,
    ammo: 0, ammoMax: 0, mode: 'idle', tx: null, ty: null, wait: 0, loop: null, leg: null, cargo: 0, civ: 0, carry: null, pickup: null, landing: 0,
  };
  if (type === 'apc') v.ammo = v.ammoMax = 160;
  if (type === 'heli') v.ammo = v.ammoMax = Math.round(220 * G.mult.heli);
  G.vehicles.push(v);
  return v;
}
function buildRing(G, s) { s.ring = new Array(RING_N).fill(140 * G.mult.wall); s.ringMax = 140 * G.mult.wall; }
function addTurret(G, s) {
  const a = -Math.PI / 2 + (s.turrets - 1) * 0.95;
  s.turrets++;
  G.turrets.push({ kind: 'turret', x: s.x + Math.cos(a) * 58, y: s.y + Math.sin(a) * 58, hp: 170, hpMax: 170, cd: 0, rad: 10, dead: false, s, a: -Math.PI / 2 });
}
export const maxTurrets = (s) => (s.id === 'hq' ? 4 : 3);

const alert = (G, msg, x, y, lvl = 1) => {
  G.alerts.push({ msg, x, y, lvl, t: G.t, n: G.night });
  if (G.alerts.length > 30) G.alerts.shift();
};
const fx = (G, f) => { if (G.fx.length < 500) G.fx.push(f); };
export const allUnits = (G) => [...G.squads, ...G.vehicles];
export const unitById = (G, id) => allUnits(G).find((u) => u.id === id) || null;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clampX = (x) => Math.max(30, Math.min(W - 30, x));
const clampY = (y) => Math.max(30, Math.min(H - 30, y));

// ---- 指令 ----
const live = (G) => G.phase === 'night';
function clearVehicleOrder(v) { v.loop = null; v.leg = null; v.pickup = null; v.path = []; v.pi = 0; }
export function cmdMove(G, id, x, y) {
  if (!live(G) || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const u = unitById(G, id);
  if (!u) return false;
  x = clampX(x); y = clampY(y);
  if (u.kind === 'squad') {
    if (u.carried) return false;
    u.tx = x; u.ty = y; u.order = 'move';
    return true;
  }
  clearVehicleOrder(u);
  if (u.kind === 'heli') { u.tx = x; u.ty = y; u.mode = u.carry ? 'drop' : 'move'; u.wait = 0; u.landing = 0; return true; }
  u.path = route(u.x, u.y, x, y); u.pi = 0; u.mode = 'move';
  return true;
}
export function cmdRetreat(G, id) {
  if (!live(G)) return false;
  const u = unitById(G, id);
  if (!u) return false;
  let best = G.byId.hq, bd = Infinity;
  for (const s of G.sectors) {
    if (s.status === 'lost') continue;
    const danger = s.nz > 6 ? 500 : 0;
    const d = Math.hypot(s.x - u.x, s.y - u.y) + danger;
    if (d < bd) { bd = d; best = s; }
  }
  if (u.kind === 'squad') {
    if (u.carried) return false;
    u.tx = best.x; u.ty = best.y; u.order = 'retreat';
    return true;
  }
  return cmdMove(G, id, best.x, best.y + 30);
}
export function cmdHold(G, id) {
  if (!live(G)) return false;
  const u = unitById(G, id);
  if (!u) return false;
  if (u.kind === 'squad') { u.tx = u.ty = null; u.order = 'hold'; return true; }
  clearVehicleOrder(u); u.mode = 'idle'; u.landing = 0; u.wait = 0;
  return true;
}
export function cmdTruck(G, id, sectorId) {
  if (!live(G)) return false;
  const v = unitById(G, id), s = G.byId[sectorId];
  if (!v || v.kind !== 'truck' || !s || s.id === 'hq') return false;
  clearVehicleOrder(v);
  v.loop = s.id; v.mode = 'loop'; v.wait = 0;
  const atHq = dist(v, G.byId.hq) < 60;
  if (atHq) { truckAtHq(G, v); v.leg = 'out'; v.path = route(v.x, v.y, s.x, s.y); }
  else if (v.cargo > 0) { v.leg = 'out'; v.path = route(v.x, v.y, s.x, s.y); }
  else { v.leg = 'home'; v.path = route(v.x, v.y, G.byId.hq.x, G.byId.hq.y); }
  v.pi = 0;
  return true;
}
export function cmdPickup(G, heliId, squadId) {
  if (!live(G)) return false;
  const v = unitById(G, heliId), sq = unitById(G, squadId);
  if (!v || v.kind !== 'heli' || !sq || sq.kind !== 'squad' || v.carry || sq.carried) return false;
  clearVehicleOrder(v);
  v.pickup = sq.id; v.mode = 'pickup'; v.wait = 0; v.landing = 0;
  return true;
}
export function buildCost(kind) { return kind === 'wall' ? 60 : 45; }
export function buildBlock(G, s, kind) {
  if (!s || s.status === 'lost') return '據點已淪陷';
  if (G.builds.some((b) => b.s === s && b.kind === kind)) return '施工中';
  if (s.stock < buildCost(kind)) return `補給不足 ${buildCost(kind)}`;
  if (kind === 'turret' && s.turrets + G.builds.filter((b) => b.s === s && b.kind === 'turret').length >= maxTurrets(s)) return '已達上限';
  if (kind === 'wall' && s.ring && s.ring.every((h) => h >= s.ringMax - 1)) return '圍牆完好';
  if (s.id !== 'hq' && !G.squads.some((q) => !q.carried && Math.hypot(q.x - s.x, q.y - s.y) < 130)) return '需要小隊駐守';
  return null;
}
export function cmdBuild(G, sectorId, kind) {
  if (!live(G)) return false;
  const s = G.byId[sectorId];
  if (!s || (kind !== 'wall' && kind !== 'turret') || buildBlock(G, s, kind)) return false;
  s.stock -= buildCost(kind);
  G.builds.push({ s, kind, t: 5, total: 5 });
  return true;
}
export function cmdSupport(G, type, x, y) {
  if (!live(G) || !G.support[type] || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  G.support[type]--;
  x = clampX(x); y = clampY(y);
  if (type === 'arty') G.strikes.push({ type, x, y, t: 3.5, total: 3.5, shots: 5, cd: 0 });
  else G.strikes.push({ type, x, y, t: 1.6, total: 1.6, prog: 0 });
  return true;
}
export function chooseUpgrade(G, key) {
  if (G.phase !== 'upgrade' || !G.offer || !G.offer.includes(key)) return false;
  const m = G.mult;
  G.taken.push(key);
  switch (key) {
    case 'squad': addSquad(G, 'hq'); break;
    case 'apc': addVehicle(G, 'apc', 'hq'); break;
    case 'truck': addVehicle(G, 'truck', 'hq'); break;
    case 'cap': m.cap++; break;
    case 'ammo': m.ammo *= 1.3; for (const q of G.squads) { q.ammoMax = Math.round(q.ammoMax * 1.3); } break;
    case 'dmg': m.dmg *= 1.3; break;
    case 'turret': m.turret *= 1.4; break;
    case 'wall': {
      m.wall *= 1.5;
      for (const s of G.sectors) if (s.ring) { s.ringMax *= 1.5; s.ring = s.ring.map((h) => (h > 0 ? h * 1.5 : 0)); }
      break;
    }
    case 'arty': G.supportMax.arty += 2; break;
    case 'strafe': G.supportMax.strafe += 1; break;
    case 'stock': G.byId.hq.stock += 150; break;
    case 'heli': m.heli *= 1.5; for (const v of G.vehicles) if (v.kind === 'heli') { v.ammoMax = Math.round(v.ammoMax * 1.5); } break;
  }
  G.offer = null;
  G.night++;
  G.t = 0;
  G.nightSaved = 0;
  G.phase = 'night';
  G.support = { ...G.supportMax };
  G.byId.hq.stock += 90;
  addSquad(G, 'hq');
  while (G.vehicles.filter((v) => v.kind === 'truck').length < 2) addVehicle(G, 'truck', 'hq');
  // 白天把平民從別處疏散來的人補回各據點
  for (const s of G.sectors) if (s.status !== 'lost' && s.id !== 'hq') s.civ += 6 + Math.floor(G.rnd() * 6);
  planNight(G);
  alert(G, `第 ${G.night} 夜開始，增援 ${G.squads.at(-1).name} 已抵達基地`, G.byId.hq.x, G.byId.hq.y, 0);
  return true;
}

// ---- 導演：波次、伏擊、斷路、圍攻 ----
function planNight(G) {
  const n = G.night, B = [1, 1.9, 3][n - 1];
  const E = (t, type, size, extra = {}) => G.events.push({ t, type, size: Math.round(size), warned: false, ...extra });
  G.events = [];
  E(16, 'wave', 26 * B, { from: 'north' });
  E(34, 'ambush', 7 + 4 * n);
  E(56, 'wave', 36 * B, { from: n > 1 ? 'both' : 'north' });
  if (n >= 2) E(72, 'cut', 16 + 8 * n);
  E(88, 'siege', 30 * B);
  E(104, 'ambush', 8 + 4 * n);
  E(124, 'wave', 50 * B, { from: 'both' });
  E(150, 'wave', 64 * B, { from: 'north', final: true });
  if (n >= 2) E(112, 'assault', n === 2 ? 60 : 110);
  if (n >= 3) E(146, 'assault', 140);
}
const heldSouth = (G, id, depth = 0) => {
  const s = G.byId[id];
  if (s.status !== 'lost' || s.id === 'hq' || depth > 6) return s;
  const nx = NEXT[id];
  return heldSouth(G, nx[Math.floor(G.rnd() * nx.length)], depth + 1);
};
function spawn(G, type, x, y, goal) {
  if (G.zombies.length >= MAX_Z) return null;
  const t = ZT[type];
  const z = { type, x: clampX(x), y: Math.max(4, Math.min(H - 4, y)), hp: t.hp, cd: G.rnd() * 0.5, goal, ox: (G.rnd() - 0.5) * 40, oy: (G.rnd() - 0.5) * 40, t: null, a: 0 };
  G.zombies.push(z);
  return z;
}
function spawnGroup(G, x, y, size, goal, spread = 60) {
  const n = G.night;
  for (let i = 0; i < size; i++) {
    const roll = G.rnd();
    const type = roll < 0.012 + 0.018 * n ? 'b' : roll < 0.1 + 0.11 * n ? 'r' : 'w';
    spawn(G, type, x + (G.rnd() - 0.5) * spread * 2, y + (G.rnd() - 0.5) * spread, goal);
  }
}
function prepareEvent(G, e) {
  if (e.type === 'wave') {
    const sides = e.from === 'both' ? ['north', G.rnd() < 0.5 ? 'west' : 'east'] : ['north'];
    e.spots = sides.map((side) => {
      if (side === 'north') return { x: 300 + G.rnd() * 400, y: 12, goal: heldSouth(G, G.rnd() < 0.5 ? 'pass' : (G.byId.pass.status === 'lost' ? 'mill' : 'pass')), label: '北方' };
      if (side === 'west') return { x: 20, y: 700 + G.rnd() * 300, goal: heldSouth(G, 'farm'), label: '西側山脊' };
      return { x: W - 20, y: 700 + G.rnd() * 300, goal: heldSouth(G, 'dam'), label: '東側山脊' };
    });
    const main = e.spots[0];
    alert(G, `屍潮 ${e.size} 隻將由${e.spots.map((s) => s.label).join('與')}逼近${main.goal.name}`, main.goal.x, main.goal.y, e.final ? 2 : 1);
  } else if (e.type === 'ambush') {
    const trucks = G.vehicles.filter((v) => v.kind === 'truck' && v.path.length - v.pi > 8);
    if (!trucks.length) { e.cancel = true; return; }
    const v = trucks[Math.floor(G.rnd() * trucks.length)];
    e.v = v;
    const ahead = v.path[Math.min(v.path.length - 1, v.pi + 12)];
    e.x = ahead.x; e.y = ahead.y;
    alert(G, `${v.name} 前方路段偵測到伏擊`, e.x, e.y, 2);
  } else if (e.type === 'cut') {
    const [a, b] = ROADS[Math.floor(G.rnd() * ROADS.length)];
    const A = G.byId[a], B = G.byId[b];
    e.x = (A.x + B.x) / 2; e.y = (A.y + B.y) / 2;
    alert(G, `${A.name}與${B.name}之間的道路即將被切斷`, e.x, e.y, 1);
  } else if (e.type === 'assault') {
    e.side = G.rnd() < 0.5 ? 50 : W - 50;
    alert(G, `大群屍潮繞過防線，直撲第九基地`, G.byId.hq.x, G.byId.hq.y, 2);
  } else if (e.type === 'siege') {
    const cand = G.sectors.filter((s) => s.status !== 'lost' && s.id !== 'hq' && s.id !== 'pass');
    if (!cand.length) { e.s = G.byId.hq; } else e.s = cand.reduce((a, b) => (b.stock + b.civ * 2 > a.stock + a.civ * 2 ? b : a));
    alert(G, `${e.s.name} 周圍出現大量訊號，準備被圍攻`, e.s.x, e.s.y, 2);
  }
}
function runEvent(G, e) {
  if (e.cancel) return;
  if (e.type === 'wave') {
    const each = Math.round(e.size / e.spots.length);
    for (const s of e.spots) spawnGroup(G, s.x, s.y, each, s.goal);
  } else if (e.type === 'ambush') {
    const goal = heldSouth(G, 'bridge');
    spawnGroup(G, e.x, e.y, e.size, goal, 44);
  } else if (e.type === 'cut') {
    spawnGroup(G, e.x, e.y, e.size, heldSouth(G, 'bridge'), 50);
  } else if (e.type === 'assault') {
    spawnGroup(G, e.side, 1280, e.size, G.byId.hq, 90);
  } else if (e.type === 'siege') {
    for (let i = 0; i < e.size; i++) {
      const a = G.rnd() * Math.PI * 2, r = 210 + G.rnd() * 60, roll = G.rnd();
      spawn(G, roll < 0.04 * G.night ? 'b' : roll < 0.3 ? 'r' : 'w', e.s.x + Math.cos(a) * r, e.s.y + Math.sin(a) * r, e.s);
    }
  }
}
function director(G) {
  for (const e of G.events) {
    if (!e.warned && G.t >= e.t - 12) { e.warned = true; prepareEvent(G, e); }
    if (!e.done && G.t >= e.t) { e.done = true; runEvent(G, e); }
  }
}

// ---- 空間格 ----
const CELL = 40, COLS = 25, ROWS = 40;
function rebuildGrid(G) {
  G.head.fill(-1);
  const zs = G.zombies;
  for (let i = 0; i < zs.length; i++) {
    const c = cellOf(zs[i].x, zs[i].y);
    G.next[i] = G.head[c];
    G.head[c] = i;
  }
}
function cellOf(x, y) {
  const cx = Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL)));
  const cy = Math.max(0, Math.min(ROWS - 1, Math.floor(y / CELL)));
  return cy * COLS + cx;
}
function eachZ(G, x, y, r, fn) {
  const x0 = Math.max(0, Math.floor((x - r) / CELL)), x1 = Math.min(COLS - 1, Math.floor((x + r) / CELL));
  const y0 = Math.max(0, Math.floor((y - r) / CELL)), y1 = Math.min(ROWS - 1, Math.floor((y + r) / CELL));
  const zs = G.zombies;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    for (let i = G.head[cy * COLS + cx]; i >= 0; i = G.next[i]) fn(zs[i]);
  }
}
function nearestZ(G, x, y, r) {
  let best = null, bd = r * r;
  eachZ(G, x, y, r, (z) => {
    if (z.hp <= 0) return;
    const d = (z.x - x) ** 2 + (z.y - y) ** 2;
    if (d < bd) { bd = d; best = z; }
  });
  return best;
}
function countZ(G, x, y, r) {
  let n = 0;
  const r2 = r * r;
  eachZ(G, x, y, r, (z) => { if (z.hp > 0 && (z.x - x) ** 2 + (z.y - y) ** 2 < r2) n++; });
  return n;
}

// ---- 傷害 ----
function hurt(G, h, d) {
  if (h.dead) return;
  h.hp -= d;
  if (h.hp > 0) return;
  h.dead = true;
  h.hp = 0;
  if (h.kind === 'soldier') {
    G.corpses.push({ x: h.x, y: h.y, t: 3.5 });
    fx(G, { k: 'die', x: h.x, y: h.y });
  } else if (h.kind === 'turret') {
    h.s.turrets = Math.max(0, h.s.turrets - 1);
    fx(G, { k: 'boom', x: h.x, y: h.y, r: 26 });
  } else {
    G.unitsLost++;
    fx(G, { k: 'boom', x: h.x, y: h.y, r: 46 });
    let extra = '';
    if (h.civ > 0) { G.civLost += h.civ; extra = `，車上 ${h.civ} 名平民罹難`; h.civ = 0; }
    if (h.carry) {
      const sq = h.carry;
      h.carry = null;
      sq.carried = false; sq.order = 'hold'; sq.tx = sq.ty = null;
      sq.x = h.x; sq.y = h.y;
      sq.soldiers.forEach((s, i) => { s.x = h.x + Math.cos(i) * 14; s.y = h.y + Math.sin(i) * 14; hurt(G, s, 18); });
    }
    alert(G, `${h.name} 被摧毀${extra}`, h.x, h.y, 2);
  }
}
function explode(G, x, y, r, dmg, friendly = true) {
  fx(G, { k: 'boom', x, y, r });
  const r2 = r * r;
  eachZ(G, x, y, r, (z) => {
    if ((z.x - x) ** 2 + (z.y - y) ** 2 < r2) z.hp -= dmg;
  });
  if (!friendly) return;
  for (const q of G.squads) if (!q.carried) for (const s of q.soldiers) if (dist(s, { x, y }) < r) hurt(G, s, dmg * 0.75);
  for (const v of G.vehicles) if (!(v.kind === 'heli' && !v.landing) && dist(v, { x, y }) < r) hurt(G, v, dmg * 1.2);
  for (const t of G.turrets) if (dist(t, { x, y }) < r) hurt(G, t, dmg * 0.7);
  for (const s of G.sectors) {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < r + RING_R && s.ring) {
      for (let i = 0; i < RING_N; i++) {
        const a = ((i + 0.5) / RING_N) * Math.PI * 2 - Math.PI;
        if (Math.hypot(s.x + Math.cos(a) * RING_R - x, s.y + Math.sin(a) * RING_R - y) < r) s.ring[i] = Math.max(0, s.ring[i] - dmg);
      }
    }
    if (d < r + 20 && s.civ > 0 && s.id !== 'hq') { const k = Math.min(s.civ, 2); s.civ -= k; G.civLost += k; }
  }
}

// ---- 喪屍 ----
function pickGoal(G, g) {
  const nx = NEXT[g.id];
  if (!nx.length) return g;
  return heldSouth(G, nx[Math.floor(G.rnd() * nx.length)]);
}
function updateZombies(G) {
  const zs = G.zombies, humans = G.humans, tick = G.tick;
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i];
    if (z.hp <= 0) continue;
    const T = ZT[z.type];
    z.cd -= DT;
    if ((tick + i) % 10 === 0) {
      let best = null, bd = T.sense * T.sense;
      for (let k = 0; k < humans.length; k++) {
        const h = humans[k], d = (h.x - z.x) ** 2 + (h.y - z.y) ** 2;
        if (d < bd) { bd = d; best = h; }
      }
      z.t = best;
      if (z.goal.status === 'lost' && z.goal.id !== 'hq') z.goal = pickGoal(G, z.goal);
    }
    if (z.t && z.t.dead) z.t = null;
    const tgt = z.t;
    let tx, ty, reach = 0;
    if (tgt) { tx = tgt.x; ty = tgt.y; reach = 8 + tgt.rad; }
    else { tx = z.goal.x + z.ox; ty = z.goal.y + z.oy; }
    let dx = tx - z.x, dy = ty - z.y;
    const d = Math.hypot(dx, dy) || 0.001;
    if (tgt && d <= reach) {
      if (z.cd <= 0) { z.cd = T.cd; hurt(G, tgt, tgt.kind === 'apc' ? T.dmg * 0.4 : T.dmg); }
      continue;
    }
    if (!tgt && d < 34) {
      const g = z.goal;
      if (z.cd <= 0) {
        z.cd = T.cd * 1.4;
        if (g.id === 'hq') { G.hqHp = Math.max(0, G.hqHp - T.dmg); fx(G, { k: 'hit', x: z.x, y: z.y }); }
        else if (g.civ > 0 && g.status !== 'lost') {
          g.civ--; G.civLost++;
          fx(G, { k: 'die', x: z.x, y: z.y });
        } else if (g.civ <= 0 && g.nh === 0) z.goal = pickGoal(G, g);
      }
      continue;
    }
    let spd = T.spd * DT;
    if (inRiver(z.x, z.y)) spd *= 0.42;
    let nx = z.x + (dx / d) * spd, ny = z.y + (dy / d) * spd;
    // 分散，避免疊成一點（隔格做）
    if ((tick + i) % 2 === 0) {
      let px = 0, py = 0, cnt = 0;
      eachZ(G, z.x, z.y, 12, (o) => {
        if (o === z || cnt > 5) return;
        const ox = z.x - o.x, oy = z.y - o.y, od = ox * ox + oy * oy;
        if (od < 100 && od > 0.01) { const l = Math.sqrt(od); px += (ox / l) * (10 - l); py += (oy / l) * (10 - l); cnt++; }
      });
      nx += px * 0.12; ny += py * 0.12;
    }
    // 圍牆只擋由外往內
    let blocked = false;
    for (const s of G.sectors) {
      if (!s.ring) continue;
      const ax = z.x - s.x, ay = z.y - s.y;
      if (Math.abs(ax) > RING_R + 8 || Math.abs(ay) > RING_R + 8) continue;
      const d0 = Math.hypot(ax, ay), d1 = Math.hypot(nx - s.x, ny - s.y);
      if (d0 >= RING_R && d1 < RING_R) {
        const seg = Math.max(0, Math.min(RING_N - 1, Math.floor(((Math.atan2(ay, ax) + Math.PI) / (Math.PI * 2)) * RING_N)));
        if (s.ring[seg] > 0) {
          blocked = true;
          if (z.cd <= 0) { z.cd = T.cd; s.ring[seg] = Math.max(0, s.ring[seg] - T.dmg); }
        }
      }
    }
    if (blocked) continue;
    z.x = clampX(nx); z.y = Math.max(2, Math.min(H - 2, ny));
    z.a = Math.atan2(dy, dx);
  }
}

// ---- 我軍 ----
const RANGE = 112;
function updateSquads(G) {
  for (const q of G.squads) {
    if (q.carried) { q.x = q.carrier.x; q.y = q.carrier.y; continue; }
    if (q.tx !== null) {
      const dx = q.tx - q.x, dy = q.ty - q.y, d = Math.hypot(dx, dy);
      let spd = (q.order === 'retreat' ? 74 : 58) * DT;
      if (inRiver(q.x, q.y)) spd *= 0.55;
      if (d <= spd + 1) { q.x = q.tx; q.y = q.ty; q.tx = q.ty = null; q.order = 'hold'; }
      else { q.x += (dx / d) * spd; q.y += (dy / d) * spd; }
    }
    const n = q.soldiers.length;
    const ring = 12 + n * 1.6;
    q.soldiers.forEach((s, i) => {
      if (s.dead) return;
      const a = (i / n) * Math.PI * 2;
      const sx = q.x + Math.cos(a) * ring, sy = q.y + Math.sin(a) * ring;
      const dx = sx - s.x, dy = sy - s.y, d = Math.hypot(dx, dy);
      if (d > 1) { const st = Math.min(d, 78 * DT); s.x += (dx / d) * st; s.y += (dy / d) * st; }
      s.cd -= DT;
      if (s.cd > 0 || q.order === 'retreat') return;
      const z = nearestZ(G, s.x, s.y, RANGE);
      if (!z) { s.cd = 0.12; return; }
      s.a = Math.atan2(z.y - s.y, z.x - s.x);
      if (q.ammo >= 1) {
        q.ammo--;
        s.cd = 0.5 + G.rnd() * 0.15;
        fx(G, { k: 'shot', x: s.x, y: s.y, x2: z.x, y2: z.y });
        if (G.rnd() < 0.72) z.hp -= 12 * G.mult.dmg;
      } else if ((z.x - s.x) ** 2 + (z.y - s.y) ** 2 < 400) {
        s.cd = 0.8; z.hp -= 5;
      } else s.cd = 0.2;
    });
  }
}
function follow(G, v) {
  if (v.pi >= v.path.length) return true;
  const p = v.path[v.pi], dx = p.x - v.x, dy = p.y - v.y, d = Math.hypot(dx, dy);
  let st = v.spd * DT;
  if (v.jam >= 5) st *= 0.55;
  if (d <= st) { v.x = p.x; v.y = p.y; v.pi++; }
  else { v.x += (dx / d) * st; v.y += (dy / d) * st; v.a = Math.atan2(dy, dx); }
  return v.pi >= v.path.length;
}
function truckAtHq(G, v) {
  const hq = G.byId.hq;
  if (v.civ > 0) {
    G.saved += v.civ; G.nightSaved += v.civ;
    alert(G, `${v.name} 帶回 ${v.civ} 名平民`, hq.x, hq.y, 0);
    fx(G, { k: 'saved', x: v.x, y: v.y, n: v.civ });
    v.civ = 0;
  }
  const load = Math.min(50 + 20 * G.mult.cap - v.cargo, hq.stock - 60); // 基地留 60 給自己的機槍塔
  if (load > 0) { v.cargo += load; hq.stock -= load; }
}
function updateVehicle(G, v) {
  if (v.kind !== 'heli' && G.tick % 6 === v.id % 6) v.jam = countZ(G, v.x, v.y, 26);
  if (v.kind === 'heli') return updateHeli(G, v);
  if (v.kind === 'apc') {
    v.cd -= DT;
    if (v.cd <= 0) {
      const z = nearestZ(G, v.x, v.y, 150);
      if (z && v.ammo >= 1) {
        v.ammo--; v.cd = 0.34;
        fx(G, { k: 'shot', x: v.x, y: v.y, x2: z.x, y2: z.y, heavy: 1 });
        eachZ(G, z.x, z.y, 22, (o) => { if ((o.x - z.x) ** 2 + (o.y - z.y) ** 2 < 484) o.hp -= 26; });
      } else v.cd = 0.15;
    }
    follow(G, v);
    return;
  }
  // 卡車：來回運補＋撤離
  if (v.mode !== 'loop') { follow(G, v); return; }
  if (v.wait > 0) { v.wait -= DT; return; }
  const arrived = follow(G, v);
  if (!arrived) return;
  const s = G.byId[v.loop], hq = G.byId.hq;
  if (v.leg === 'out') {
    if (s.status === 'lost') {
      alert(G, `${s.name} 已淪陷，${v.name} 折返`, v.x, v.y, 1);
    } else {
      s.stock = Math.min(240, s.stock + v.cargo); v.cargo = 0;
      const take = Math.min(8 + 4 * G.mult.cap, s.civ);
      s.civ -= take; v.civ += take;
    }
    v.wait = 1.4; v.leg = 'home';
    v.path = route(v.x, v.y, hq.x, hq.y); v.pi = 0;
  } else {
    truckAtHq(G, v);
    if (s.status === 'lost') { v.mode = 'idle'; v.loop = null; v.path = []; v.pi = 0; return; }
    v.wait = 1.2; v.leg = 'out';
    v.path = route(v.x, v.y, s.x, s.y); v.pi = 0;
  }
}
function updateHeli(G, v) {
  v.cd -= DT;
  if (v.cd <= 0) {
    const z = v.ammo >= 1 ? nearestZ(G, v.x, v.y, 175) : null;
    if (z) {
      v.ammo--; v.cd = 0.16;
      z.hp -= 22 * G.mult.heli;
      fx(G, { k: 'shot', x: v.x, y: v.y, x2: z.x, y2: z.y });
    } else v.cd = 0.15;
  }
  let tx = null, ty = null;
  if (v.mode === 'pickup') {
    const q = unitById(G, v.pickup);
    if (!q || q.carried) { v.mode = 'idle'; v.pickup = null; v.landing = 0; return; }
    tx = q.x; ty = q.y;
  } else if (v.mode === 'move' || v.mode === 'drop') { tx = v.tx; ty = v.ty; }
  if (tx === null) return;
  const dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy), st = v.spd * DT;
  if (d > Math.max(st, 6)) { v.x += (dx / d) * st; v.y += (dy / d) * st; v.a = Math.atan2(dy, dx); v.landing = 0; return; }
  if (v.mode === 'move') { v.mode = 'idle'; return; }
  v.landing = 1; // 落地時會被咬
  v.wait += DT;
  if (v.wait < 1.2) return;
  v.wait = 0; v.landing = 0;
  if (v.mode === 'pickup') {
    const q = unitById(G, v.pickup);
    q.carried = true; q.carrier = v; q.tx = q.ty = null; q.order = 'hold';
    v.carry = q; v.pickup = null; v.mode = 'idle';
    alert(G, `${q.name} 已登機，選目的地`, v.x, v.y, 0);
  } else {
    const q = v.carry;
    q.carried = false; q.carrier = null; q.x = v.x; q.y = v.y;
    q.soldiers.forEach((s, i) => { s.x = v.x + Math.cos(i) * 12; s.y = v.y + Math.sin(i) * 12; });
    v.carry = null; v.mode = 'idle';
  }
}
function updateTurrets(G) {
  for (const t of G.turrets) {
    if (t.dead) continue;
    t.cd -= DT;
    if (t.cd > 0) continue;
    if (t.s.stock <= 0.05) { t.cd = 0.5; continue; }
    const z = nearestZ(G, t.x, t.y, 190);
    if (!z) { t.cd = 0.14; continue; }
    t.a = Math.atan2(z.y - t.y, z.x - t.x);
    t.cd = 0.24;
    t.s.stock = Math.max(0, t.s.stock - 0.07);
    z.hp -= 13 * G.mult.turret;
    fx(G, { k: 'shot', x: t.x, y: t.y, x2: z.x, y2: z.y });
  }
}
function updateStrikes(G) {
  for (const s of G.strikes) {
    s.t -= DT;
    if (s.t > 0) continue;
    if (s.type === 'arty') {
      s.cd -= DT;
      if (s.cd <= 0 && s.shots > 0) {
        s.cd = 0.24; s.shots--;
        explode(G, s.x + (G.rnd() - 0.5) * 130, s.y + (G.rnd() - 0.5) * 130, 74, 95);
      }
      if (s.shots <= 0) s.over = true;
    } else {
      s.prog += DT / 0.7;
      const y = s.y - 230 + 460 * s.prog;
      eachZ(G, s.x, y, 46, (z) => { if (Math.abs(z.x - s.x) < 34 && Math.abs(z.y - y) < 46) z.hp -= 30; });
      fx(G, { k: 'strafe', x: s.x + (G.rnd() - 0.5) * 50, y });
      if (s.prog >= 1) s.over = true;
    }
  }
  G.strikes = G.strikes.filter((s) => !s.over);
}
function updateBuilds(G) {
  for (const b of G.builds) {
    b.t -= DT;
    if (b.s.status === 'lost') { b.over = true; continue; }
    if (b.t > 0) continue;
    b.over = true;
    if (b.kind === 'wall') buildRing(G, b.s); else addTurret(G, b.s);
    alert(G, `${b.s.name}${b.kind === 'wall' ? '圍牆' : '機槍塔'}完工`, b.s.x, b.s.y, 0);
  }
  G.builds = G.builds.filter((b) => !b.over);
}
function resupply(G) {
  const every = 0.25;
  for (const q of G.squads) {
    if (q.carried || q.ammo >= q.ammoMax) continue;
    const s = G.sectors.find((x) => x.status !== 'lost' && x.stock > 0 && Math.hypot(x.x - q.x, x.y - q.y) < 110);
    if (!s) continue;
    const add = Math.min(q.ammoMax - q.ammo, 40 * every, s.stock / 0.22);
    q.ammo += add; s.stock = Math.max(0, s.stock - add * 0.22);
  }
  const hq = G.byId.hq;
  for (const v of G.vehicles) {
    if (Math.hypot(v.x - hq.x, v.y - hq.y) > 130 || hq.stock <= 0) continue;
    if (v.hp < v.hpMax) { const add = Math.min(v.hpMax - v.hp, 30 * every); v.hp += add; hq.stock = Math.max(0, hq.stock - add * 0.1); }
    if (v.ammo < v.ammoMax) { const add = Math.min(v.ammoMax - v.ammo, 50 * every); v.ammo += add; hq.stock = Math.max(0, hq.stock - add * 0.12); }
  }
  for (const v of G.vehicles) if (v.kind === 'apc' && v.ammo < v.ammoMax) {
    const s = G.sectors.find((x) => x.id !== 'hq' && x.status !== 'lost' && x.stock > 0 && Math.hypot(x.x - v.x, x.y - v.y) < 110);
    if (s) { const add = Math.min(v.ammoMax - v.ammo, 30 * every); v.ammo += add; s.stock = Math.max(0, s.stock - add * 0.12); }
  }
  for (const v of G.vehicles) if (v.kind === 'heli' && v.ammo < 1 && v.mode === 'idle' && !v.carry && Math.hypot(v.x - hq.x, v.y - hq.y) > 40) {
    v.tx = hq.x; v.ty = hq.y + 40; v.mode = 'move';
    alert(G, `${v.name} 彈藥耗盡，返回基地`, v.x, v.y, 0);
  }
}
function updateSectors(G) {
  const every = 0.25;
  for (const s of G.sectors) {
    s.nz = countZ(G, s.x, s.y, 135);
    let nh = 0;
    for (const h of G.humans) if ((h.x - s.x) ** 2 + (h.y - s.y) ** 2 < 135 * 135) nh++;
    s.nh = nh;
    if (s.id === 'hq') continue;
    if (s.status !== 'lost') {
      s.status = s.nz >= 6 ? 'crisis' : 'held';
      if (s.nz >= 6 && nh === 0) s.lostT += every; else s.lostT = Math.max(0, s.lostT - every);
      if (s.lostT >= 6) {
        s.status = 'lost'; s.lostT = 0;
        for (let i = 0; i < Math.min(s.civ, 25); i++) spawn(G, 'w', s.x + (G.rnd() - 0.5) * 70, s.y + (G.rnd() - 0.5) * 70, s);
        G.civLost += s.civ; s.civ = 0; s.stock = 0; s.ring = null;
        alert(G, `${s.name} 淪陷`, s.x, s.y, 2);
      }
    } else if (nh > 0 && s.nz <= 2) {
      s.backT += every;
      if (s.backT >= 4) {
        s.backT = 0; s.status = 'held';
        alert(G, `已奪回 ${s.name}`, s.x, s.y, 0);
      }
    } else s.backT = 0;
  }
}
function cleanup(G) {
  const zs = G.zombies;
  let w = 0;
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i];
    if (z.hp <= 0) { G.kills++; fx(G, { k: 'zdie', x: z.x, y: z.y }); continue; }
    zs[w++] = z;
  }
  zs.length = w;
  for (const c of G.corpses) {
    c.t -= DT;
    if (c.t <= 0) { spawn(G, 'w', c.x, c.y, heldSouth(G, 'bridge')); c.over = true; }
  }
  G.corpses = G.corpses.filter((c) => !c.over);
  for (const q of G.squads) q.soldiers = q.soldiers.filter((s) => !s.dead);
  for (const q of G.squads) if (!q.soldiers.length && !q.gone) {
    q.gone = true; G.unitsLost++;
    alert(G, `${q.name} 全滅`, q.x, q.y, 2);
    for (const v of G.vehicles) if (v.pickup === q.id) { v.pickup = null; v.mode = 'idle'; v.landing = 0; }
  }
  G.squads = G.squads.filter((q) => !q.gone);
  G.vehicles = G.vehicles.filter((v) => !v.dead);
  G.turrets = G.turrets.filter((t) => !t.dead);
}
function rebuildHumans(G) {
  const h = G.humans;
  h.length = 0;
  for (const q of G.squads) if (!q.carried) for (const s of q.soldiers) h.push(s);
  for (const v of G.vehicles) if (v.kind !== 'heli' || v.landing) h.push(v);
  for (const t of G.turrets) h.push(t);
}
function dawn(G) {
  G.report = { night: G.night, saved: G.nightSaved, totalSaved: G.saved, lost: G.civLost, kills: G.kills, hq: Math.round(G.hqHp) };
  G.zombies.length = 0; G.corpses.length = 0; G.strikes.length = 0; G.events = [];
  rebuildGrid(G);
  if (G.night >= NIGHTS) {
    if (G.saved / Math.max(1, totalCiv(G)) < 0.25) { G.phase = 'lose'; G.loseWhy = 'civ'; } else G.phase = 'win';
    return;
  }
  const keys = Object.keys(UPGRADES);
  const offer = [];
  while (offer.length < 3) {
    const k = keys[Math.floor(G.rnd() * keys.length)];
    if (!offer.includes(k)) offer.push(k);
  }
  G.offer = offer;
  G.phase = 'upgrade';
}
export const totalCiv = (G) => G.saved + G.civLost + G.sectors.reduce((a, s) => a + s.civ, 0) + G.vehicles.reduce((a, v) => a + v.civ, 0);
export function rank(G) {
  if (G.phase === 'lose') return 'D';
  const r = G.saved / Math.max(1, totalCiv(G));
  return r >= 0.7 ? 'S' : r >= 0.5 ? 'A' : r >= 0.35 ? 'B' : 'C';
}

export function step(G) {
  if (G.phase !== 'night') return;
  G.tick++; G.t += DT;
  director(G);
  rebuildHumans(G);
  rebuildGrid(G);
  updateZombies(G);
  updateSquads(G);
  for (const v of G.vehicles) updateVehicle(G, v);
  updateTurrets(G);
  updateStrikes(G);
  updateBuilds(G);
  if (G.tick % 8 === 0) { resupply(G); rebuildGrid(G); updateSectors(G); }
  cleanup(G);
  if (G.hqHp <= 0) {
    G.phase = 'lose';
    G.loseWhy = 'hq';
    G.report = { night: G.night, saved: G.nightSaved, totalSaved: G.saved, lost: G.civLost, kills: G.kills, hq: 0 };
    return;
  }
  if (G.t >= NIGHT_LEN) dawn(G);
}
