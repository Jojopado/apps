// node test.js  — headless bots + fuzz for Can you parry me?
const { Game, ATTACKS, ENEMIES, STRIKE_MS } = require('./game.js');

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function run(botFn, seed, maxMs, opts) {
  opts = opts || {};
  const rng = mulberry32(seed);
  const g = new Game({ rng });
  g.start(opts.wave || 0);
  const bot = botFn(g, rng);
  const log = { events: {}, attacks: {}, taunts: [] };
  let t = 0;
  const DT = 16;
  while (t < (maxMs || 600000)) {
    bot(DT);
    if (opts.god) g.player.hp = g.player.maxHp;
    g.step(DT);
    t += DT;
    for (const ev of g.events.splice(0)) {
      log.events[ev.type] = (log.events[ev.type] || 0) + 1;
      if (ev.type === 'windup' && !ev.chain) log.attacks[ev.key] = (log.attacks[ev.key] || 0) + 1;
      if (ev.type === 'taunt') log.taunts.push(ev.key);
    }
    // invariants
    const p = g.player;
    if (!(p.hp >= 0 && p.hp <= p.maxHp)) throw new Error('hp out of range ' + p.hp);
    if (Number.isNaN(p.guard) || p.guard < 0 || p.guard > p.guardMax + 1e-6) throw new Error('guard bad ' + p.guard);
    if (g.enemy) {
      if (Number.isNaN(g.enemy.hp) || g.enemy.hp < 0) throw new Error('enemy hp bad');
      if (Number.isNaN(g.enemy.posture) || g.enemy.posture < 0) throw new Error('posture bad ' + g.enemy.posture);
      if (Number.isNaN(g.enemy.stateUntil)) throw new Error('stateUntil NaN');
    }
    if (g.state === 'win' || g.state === 'lose') break;
  }
  return { g, log, t };
}

// ---- bots ----
const idle = () => () => {};

const masher = (g, rng) => {
  let next = 0, t = 0;
  return (dt) => {
    t += dt;
    if (t >= next) {
      const r = rng();
      if (r < 0.4) g.input('parry');
      else if (r < 0.75) g.input('attack');
      else g.input('def', rng() < 0.5);
      next = t + 40 + rng() * 200;
    }
  };
};

const turtle = (g) => { g.input('def', true); return () => { }; };

const perfect = (g) => {
  let lastAtk = -1, parried = false;
  return () => {
    const e = g.enemy; if (!e || g.state !== 'fight') return;
    if (e.attack && (e.state === 'windup' || e.state === 'pause' || e.state === 'strike')) {
      const imp = g.impactTime();
      const until = imp - g.ft;
      if (e.attack.unparryable) { g.input('def', true); }
      else {
        g.input('def', false);
        const id = e.attack.windupStart + ':' + e.attack.hitIndex;
        if (id !== lastAtk) { lastAtk = id; parried = false; }
        if (!parried && until <= 90) { g.input('parry'); parried = true; }
      }
    } else {
      g.input('def', false);
      if (e.state === 'recover' || (e.state === 'stagger' && g.player.combo < 3)) {
        if (g.ft >= g.player.swingUntil) g.input('attack');
      }
    }
  };
};

const early = (g) => {   // always presses 350ms too early, never defs
  let lastAtk = -1;
  return () => {
    const e = g.enemy; if (!e || g.state !== 'fight') return;
    if (e.attack && (e.state === 'windup' || e.state === 'pause')) {
      const id = e.attack.windupStart + ':' + e.attack.hitIndex;
      const until = g.impactTime() - g.ft;
      if (id !== lastAtk && until <= 350) { lastAtk = id; g.input('parry'); }
    }
  };
};

const greedy = (g, rng) => {   // attacks constantly, parries sometimes correctly
  let lastAtk = -1, t = 0;
  return (dt) => {
    t += dt;
    const e = g.enemy; if (!e || g.state !== 'fight') return;
    if (e.attack && (e.state === 'windup' || e.state === 'pause' || e.state === 'strike') && !e.attack.unparryable) {
      const id = e.attack.windupStart + ':' + e.attack.hitIndex;
      if (id !== lastAtk && g.impactTime() - g.ft <= 90) { lastAtk = id; if (rng() < 0.6) g.input('parry'); }
    } else if (g.ft >= g.player.swingUntil) g.input('attack');
  };
};

function pct(a, b) { return b ? Math.round(100 * a / b) + '%' : '-'; }

let fails = 0;
function expect(cond, msg) { if (!cond) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); }

console.log('== perfect bot ==');
{
  const r = run(perfect, 1);
  console.log('  state', r.g.state, 'time', Math.round(r.t / 1000) + 's', 'rank', r.g.rank(), r.g.stats);
  expect(r.g.state === 'win', 'perfect bot wins');
  expect(r.g.stats.hits <= 3, 'perfect bot takes few hits (' + r.g.stats.hits + ')');
  expect(r.t < 240000, 'level under 4 min (' + Math.round(r.t / 1000) + 's)');
}

console.log('== idle bot ==');
{
  const r = run(idle, 2);
  expect(r.g.state === 'lose', 'idle bot loses');
  expect(r.t < 90000, 'idle bot dies quickly (' + Math.round(r.t / 1000) + 's)');
}

console.log('== turtle bot (holds Def forever) ==');
{
  const r0 = run(turtle, 3);
  expect(r0.g.state === 'lose', 'turtle loses eventually (' + Math.round(r0.t / 1000) + 's)');
  const base = run(idle, 3, 60000, { wave: 1, god: true });
  const r = run(turtle, 3, 60000, { wave: 1, god: true });
  const total = Object.values(r.log.attacks).reduce((a, b) => a + b, 0);
  const btotal = Object.values(base.log.attacks).reduce((a, b) => a + b, 0);
  console.log('  knight vs idle', base.log.attacks, '| knight vs turtle', r.log.attacks, 'taunts', r.log.taunts.join(','));
  expect((r.log.attacks.grab || 0) / total > (base.log.attacks.grab || 0) / btotal + 0.1, 'grab share rises vs turtle (' + pct(base.log.attacks.grab || 0, btotal) + ' → ' + pct(r.log.attacks.grab || 0, total) + ')');
  expect(r.log.taunts.includes('grab'), 'AI taunts about Def holding');
}

console.log('== early-presser bot ==');
{
  const base = run(idle, 4, 150000, { wave: 2, god: true });
  const r = run(early, 4, 150000, { wave: 2, god: true });
  const total = Object.values(r.log.attacks).reduce((a, b) => a + b, 0);
  const btotal = Object.values(base.log.attacks).reduce((a, b) => a + b, 0);
  console.log('  shade vs idle', base.log.attacks, '| shade vs early', r.log.attacks, 'taunts', r.log.taunts.join(','));
  expect(r.log.taunts.includes('feint'), 'AI notices early presses');
  expect((r.log.attacks.feint || 0) / total > (base.log.attacks.feint || 0) / btotal + 0.05, 'feint share rises (' + pct(base.log.attacks.feint || 0, btotal) + ' → ' + pct(r.log.attacks.feint || 0, total) + ')');
}

console.log('== greedy bot ==');
{
  const r = run(greedy, 5);
  console.log('  state', r.g.state, 'wave', r.g.wave, 'stats', r.g.stats, 'taunts', r.log.taunts.join(','));
  expect(r.log.taunts.includes('greed'), 'AI notices whiffing');
  expect((r.log.attacks.punish || 0) > 0, 'punish attacks happen (' + (r.log.attacks.punish || 0) + ')');
}

console.log('== masher fuzz x300 ==');
{
  let wins = 0, loses = 0, maxWave = 0, totalT = 0;
  for (let s = 100; s < 400; s++) {
    const r = run(masher, s);
    if (r.g.state === 'win') wins++; else if (r.g.state === 'lose') loses++; else throw new Error('masher stuck in state ' + r.g.state + ' seed ' + s);
    maxWave = Math.max(maxWave, r.g.wave); totalT += r.t;
  }
  console.log('  wins', wins, 'loses', loses, 'maxWave', maxWave, 'avg', Math.round(totalT / 300 / 1000) + 's');
  expect(loses > 250, 'mashing mostly loses');
}

console.log('== perfect bot x20 seeds ==');
{
  let wins = 0, hits = 0;
  for (let s = 10; s < 30; s++) { const r = run(perfect, s); if (r.g.state === 'win') wins++; hits += r.g.stats.hits; }
  console.log('  wins', wins + '/20', 'avg hits', (hits / 20).toFixed(1));
  expect(wins === 20, 'perfect play always wins');
}

console.log(fails ? 'FAILS: ' + fails : 'ALL PASS');
process.exit(fails ? 1 : 0);
