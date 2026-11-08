// WILDKIN 畫面與操作
import { CARDS, FACTIONS, SPECIES, TERRAINS, KEYWORDS, byId, recommendedDeck, deckProblem, DECK_SIZE, COPY_LIMIT } from './cards.js';
import * as E from './engine.js';
import { aiDeploy, aiTactic } from './ai.js';
import { animalSVG, iconSVG, terrainSVG } from './art.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app'), fxLayer = $('#fx'), modal = $('#modal');
const FAST = location.hash.includes('fast');
const store = {
  get(k, d) { try { const v = localStorage.getItem('wildkin.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('wildkin.' + k, JSON.stringify(v)); } catch { /* 私密模式 */ } },
};
const S = {
  g: null, sel: null, moveUid: null, focus: null, busy: false, turbo: false, msg: '',
  facs: store.get('facs', ['rabbit', 'bear']), deck: null, foeFacs: [], sound: store.get('sound', true),
};
window.__wk = { S, E, byId };

// ── 音效：WebAudio 合成 ──
let ac = null;
function beep(freq, dur = 0.09, type = 'triangle', vol = 0.09) {
  if (!S.sound || FAST) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.connect(g).connect(ac.destination);
    o.start(); o.stop(ac.currentTime + dur);
  } catch { /* 沒有音效也能玩 */ }
}
const SFX = {
  tap: () => beep(620, 0.05), place: () => beep(420, 0.1), hit: () => beep(150, 0.14, 'square', 0.07), miss: () => beep(880, 0.08, 'sine'),
  score: () => { beep(660, 0.12); setTimeout(() => beep(880, 0.16), 90); }, die: () => beep(95, 0.24, 'sawtooth', 0.06),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, FAST ? Math.min(ms, 4) : S.turbo ? ms * 0.22 : ms));

// ── 卡牌與單位 ──
const headColor = (c) => (c.fac === 'neutral' ? (c.kind === 'item' ? '#7b8a55' : '#6b7a92') : FACTIONS[c.fac].color);
const picOf = (c) => (c.kind === 'animal' ? animalSVG(c.species, c.acc) : iconSVG(c.icon));
function cardHTML(c, attrs = '', cls = '') {
  const home = c.kind === 'animal' && SPECIES[c.species].home;
  const tag = home ? `<div class="ttl">${TERRAINS.find((t) => t.id === home).name}</div>` : '';
  const stats = c.kind === 'animal'
    ? `<div class="stats"><span class="s1">${c.atk}</span><span class="s2">${c.hp}</span><span class="s3">${c.spd}</span></div>` : '';
  return `<button class="card ${c.kind !== 'animal' ? 'it' : ''} ${cls}" ${attrs}>
    <div class="cost">${c.cost}</div><div class="head" style="background:${headColor(c)}">${c.name}</div>
    ${tag}<div class="pic">${picOf(c)}</div><div class="desc">${c.text}</div>${stats}</button>`;
}
function unitHTML(g, u, cls = '') {
  const c = E.cardOf(u);
  const atk = E.atkOf(g, u), spd = E.spdOf(g, u);
  const bd = [];
  if (u.shield) bd.push(`<i class="bdg sh">盾${u.shield}</i>`);
  if (u.block) bd.push('<i class="bdg ic">冰</i>');
  if (u.hide) bd.push('<i class="bdg hd">隱</i>');
  if (E.hasBond(g, u)) bd.push('<i class="bdg bd">♥</i>');
  if (E.isHome(g, u)) bd.push('<i class="bdg hm">★</i>');
  return `<button class="unit ${u.side ? 'foe' : ''} ${u.kw.guard ? 'guard' : ''} ${u.frozen ? 'frozen' : ''} ${cls}" data-uid="${u.uid}">
    <div class="pic">${animalSVG(c.species, c.acc)}</div>
    <span class="stat spd ${spd < u.spd ? 'down' : ''}">${spd}</span><div class="badges">${bd.join('')}</div>
    <span class="stat atk ${atk > c.atk ? 'up' : ''}">${atk}</span><span class="stat hp">${u.hp}</span></button>`;
}

function describe(c) {
  const lines = [c.text];
  const kws = c.kind === 'animal' ? Object.keys(c.kw).filter((k) => KEYWORDS[k]).map((k) => `${KEYWORDS[k][0]}：${KEYWORDS[k][1]}`) : [];
  return { lines, kws };
}
function infoHTML(c, u) {
  const { kws } = describe(c);
  let head = `<b>${c.name}</b>　`;
  if (c.kind === 'animal') {
    head += u ? `ATK ${E.atkOf(S.g, u)}・HP ${u.hp}/${u.maxHp}・SPD ${E.spdOf(S.g, u)}` : `費用 ${c.cost}・ATK ${c.atk}・HP ${c.hp}・SPD ${c.spd}`;
  } else head += `${c.kind === 'item' ? '道具' : '事件'}・費用 ${c.cost}`;
  const sp = c.kind === 'animal' ? SPECIES[c.species] : null;
  const home = sp?.home ? `<span class="home">在${TERRAINS.find((t) => t.id === sp.home).name}：${sp.perk}</span>` : '';
  return `${head}<br>${c.text}${home ? '　' + home : ''}${kws.length ? `<br><small>${kws.join('　')}</small>` : ''}`;
}

// ── 畫面：標題／選陣營／牌組 ──
function title() {
  S.g = null;
  S.deck = null;
  const logos = ['fox', 'rabbit', 'bear', 'penguin', 'cat'].map((s) => `<div>${animalSVG(s)}</div>`).join('');
  app.innerHTML = `<div class="title">
    <div class="logoRow">${logos}</div><h1>WILDKIN</h1><h2>野境物語</h2>
    <p>在森林、湖泊、草原部署動物。牠們會自己打架，打贏的區域就是你的分數。先拿 7 分獲勝。</p>
    <button class="btn" data-act="choose">開始玩</button>
    <button class="btn alt" data-act="rules">怎麼玩</button></div>`;
}
function choose() {
  modal.innerHTML = '';
  S.g = null;
  const list = Object.entries(FACTIONS).map(([k, f]) => {
    const on = S.facs.includes(k);
    return `<button class="fac ${on ? 'on' : ''}" data-fac="${k}"><div class="pic">${animalSVG(k)}</div>
      <div><b>${f.name}</b><span class="th" style="color:${f.color}">${f.theme}</span><small>${f.desc}</small></div>
      ${on ? '<span class="check">已選</span>' : ''}</button>`;
  }).join('');
  app.innerHTML = `<div class="screen"><h3>選兩個陣營</h3><p class="sub">兩個陣營的卡會組成你的 24 張牌組，不同組合的羈絆也不一樣。</p>${list}</div>
    <div class="bottomBar"><button class="btn alt" data-act="title">返回</button><button class="btn alt" data-act="edit" ${S.facs.length ? '' : 'disabled'}>調整牌組</button>
    <button class="btn" data-act="start" ${S.facs.length === 2 ? '' : 'disabled'}>開始對戰</button></div>`;
}
function currentDeck() { return S.deck || recommendedDeck(S.facs[0], S.facs[1]); }
function editDeck() {
  const deck = currentDeck();
  S.deck = deck;
  const count = {};
  deck.forEach((id) => { count[id] = (count[id] || 0) + 1; });
  const pool = CARDS.filter((c) => S.facs.includes(c.fac) || c.fac === 'neutral');
  const items = pool.map((c) => `<div class="deckItem">${cardHTML(c, `data-info="${c.id}"`)}
    <div class="deckCtl"><button data-sub="${c.id}" ${count[c.id] ? '' : 'disabled'}>−</button><span>${count[c.id] || 0}</span>
    <button data-add="${c.id}" ${(count[c.id] || 0) >= COPY_LIMIT || deck.length >= DECK_SIZE ? 'disabled' : ''}>＋</button></div></div>`).join('');
  const scrollTop = $('.screen')?.scrollTop || 0;
  const bad = deckProblem(deck);
  app.innerHTML = `<div class="screen"><h3>調整牌組</h3><p class="sub">同名卡最多 2 張。已幫你放好推薦牌組，想換再換。</p><div class="deckGrid">${items}</div></div>
    <div class="bottomBar"><button class="btn alt" data-act="choose">返回</button><button class="btn alt" data-act="resetDeck">推薦</button><div class="deckCount ${bad ? 'bad' : ''}">${deck.length} / ${DECK_SIZE}</div>
    <button class="btn" data-act="start" ${bad ? 'disabled' : ''}>開始對戰</button></div>`;
  $('.screen').scrollTop = scrollTop;
}

// ── 戰鬥主畫面 ──
function startGame() {
  const keys = Object.keys(FACTIONS);
  const pick = () => {
    const a = keys[Math.floor(Math.random() * keys.length)];
    let b = a;
    while (b === a) b = keys[Math.floor(Math.random() * keys.length)];
    return [a, b];
  };
  S.foeFacs = pick();
  store.set('facs', S.facs);
  const deck = currentDeck();
  if (deckProblem(deck)) return;
  S.g = E.newGame(deck, recommendedDeck(...S.foeFacs));
  S.sel = null; S.moveUid = null; S.focus = null; S.turbo = false; S.busy = true;
  render();
  const g = S.g;
  (async () => {
    if (!store.get('tutorialDone', false) && !FAST) { store.set('tutorialDone', true); rules(); }
    await roundIntro(g);
  })();
}
const alive = (g) => S.g === g && S.quit !== g;

async function roundIntro(g) {
  g.ev.length = 0;
  S.busy = true;
  S.msg = '';
  render();
  banner(`第 ${g.round} 回合`, g.turn === 0 ? '你是先攻方（同速時你先打）' : '對手是先攻方');
  await sleep(1000);
  if (!alive(g)) return;
  aiDeploy(g, 1);
  S.busy = false;
  S.msg = '';
  render();
}

function phaseHint(g) {
  if (S.msg) return S.msg;
  if (g.phase === 'deploy') {
    if (S.sel) return '點綠色格子放下去，金色是牠擅長的地形。';
    return '點手牌，再點格子部署。雙方同時部署，按「確認」後才揭曉。';
  }
  if (g.phase === 'tactic') {
    const s = g.sides[0];
    const usable = s.hand.some((c) => E.canPlayTactic(g, 0, c.iid));
    return usable ? '戰術階段：現在看得到對手的布陣了，可以用道具和事件卡。' : '沒有可用的道具或事件，按「開戰」吧。';
  }
  if (g.phase === 'battle') return '戰鬥中：速度高的先打。';
  return '';
}

function render() {
  const g = S.g;
  if (!g) return;
  const [me, foe] = g.sides;
  const sel = S.sel ? me.hand.find((c) => c.iid === S.sel) : null;
  const selCard = sel ? byId[sel.id] : null;
  const pickDeploy = g.phase === 'deploy' && selCard?.kind === 'animal';
  const pickTactic = g.phase === 'tactic' && selCard && selCard.kind !== 'animal';
  const moving = S.moveUid !== null;
  const targetUnits = pickTactic && !moving && selCard.t ? E.validTargets(g, 0, selCard) : [];

  const slotHTML = (side, z, row) => {
    const b = g.sides[side].board[z][row];
    if (b) {
      let cls = '';
      if (pickTactic && selCard.t !== 'zone' && targetUnits.includes(b)) cls = 'target';
      if (b.uid === S.moveUid) cls = 'sel';
      return `<div class="slot" data-slot="${side}-${z}-${row}">${unitHTML(g, b, cls)}</div>`;
    }
    const p = side === 0 && g.phase === 'deploy' ? me.plan.find((x) => x.z === z && x.row === row) : null;
    if (p) {
      const c = byId[p.card.id];
      return `<div class="slot" data-slot="${side}-${z}-${row}"><button class="unit planned" data-unplan="${z}-${row}"><div class="pic">${animalSVG(c.species, c.acc)}</div>
        <span class="stat atk">${c.atk}</span><span class="stat hp">${c.hp}</span></button></div>`;
    }
    const can = (pickDeploy && side === 0 && E.canPlan(g, 0, S.sel, z, row)) || (moving && side === 0);
    const homeHint = pickDeploy && can && SPECIES[selCard.species].home === E.terrainAt(g, z);
    const label = row === 'f' ? '前排' : '後排';
    return `<button class="slot ${can ? 'can' : ''} ${homeHint ? 'homeHint' : ''}" data-slot="${side}-${z}-${row}" ${can ? `data-place="${z}-${row}"` : ''}><span class="rowTag">${label}</span></button>`;
  };
  const planPower = (z) => me.plan.filter((p) => p.z === z).reduce((n, p) => n + byId[p.card.id].atk, 0);
  const zones = [0, 1, 2].map((z) => {
    const t = E.terrainAt(g, z);
    const myP = E.zonePower(g, 0, z) + (g.phase === 'deploy' ? planPower(z) : 0), foeP = E.zonePower(g, 1, z);
    const zoneTarget = pickTactic && selCard.t === 'zone';
    const lead = myP > foeP ? 'winMe' : foeP > myP ? 'winFoe' : '';
    return `<div class="zone ${t}">
      ${slotHTML(1, z, 'b')}${slotHTML(1, z, 'f')}
      <button class="band ${zoneTarget ? 'target' : ''} ${lead}" data-zone="${z}"><span class="p foe">${foeP}</span><div class="ico">${terrainSVG(t)}</div><span class="name">${TERRAINS.find((x) => x.id === t).name}${g.truce[z] ? '·休戰' : ''}</span><span class="p me">${myP}</span></button>
      ${slotHTML(0, z, 'f')}${slotHTML(0, z, 'b')}</div>`;
  }).join('');

  const canUseCard = (c) => (g.phase === 'deploy' ? byId[c.id].kind === 'animal' && byId[c.id].cost <= me.energy : g.phase === 'tactic' ? E.canPlayTactic(g, 0, c.iid) : false);
  const hand = [...me.hand].sort((a, b) => byId[a.id].cost - byId[b.id].cost || a.id.localeCompare(b.id));
  const handScroll = $('.hand')?.scrollLeft || 0;
  const handHTML = hand.map((c) => cardHTML(byId[c.id], `data-card="${c.iid}"`, `${c.iid === S.sel ? 'sel' : ''} ${canUseCard(c) ? '' : 'off'}`)).join('');

  let action = '';
  if (!S.busy) {
    if (g.phase === 'deploy') action = `<button class="btn" data-act="confirm">確認部署</button>`;
    else if (g.phase === 'tactic') action = `<button class="btn" data-act="fight">開戰</button>`;
    else if (g.phase === 'roundEnd') action = `<button class="btn" data-act="next">下一回合</button>`;
  } else if (g.phase === 'battle' || g.phase === 'reveal') action = `<button class="btn alt" data-act="turbo">${S.turbo ? '快轉中' : '快轉'}</button>`;

  const useBtn = pickTactic && !selCard.t ? `<button class="btn" data-act="useCard" ${E.canPlayTactic(g, 0, S.sel) ? '' : 'disabled'}>使用</button>` : '';
  let info = phaseHint(g);
  if (moving) info = '選一個空位，把動物移過去。';
  else if (selCard) {
    const wrong = g.phase === 'deploy' && selCard.kind !== 'animal' ? '（戰術階段才能用）' : g.phase === 'tactic' && selCard.kind === 'animal' ? '（部署階段才能放）' : '';
    info = infoHTML(selCard) + wrong;
  }
  else if (S.focus) {
    const u = E.allUnits(g).find((x) => x.uid === S.focus);
    if (u) info = infoHTML(E.cardOf(u), u);
  }
  const gems = Array.from({ length: Math.max(0, me.energy) }, () => '<i class="gem"></i>').join('');
  app.innerHTML = `
    <div class="top"><button class="iconBtn" data-act="menu" aria-label="選單">≡</button>
      <div class="scoreBox"><div class="pts foe"><small>對手</small>${foe.score}</div>
      <div class="roundInfo"><b>${g.overtime && g.round === g.maxRounds ? '加時' : `第 ${g.round}/${g.maxRounds} 回合`}</b>${E.RULES.winScore} 分獲勝</div>
      <div class="pts me"><small>你</small>${me.score}</div></div>
      <button class="iconBtn" data-act="rules" aria-label="規則">?</button></div>
    <div class="field">${zones}</div>
    <div class="msg"><div class="txt">${info}</div>${useBtn}</div>
    <div class="bar"><div class="energy">能量 ${me.energy} ${gems}<span style="margin-left:auto;font-size:12px;opacity:.85">牌庫 ${me.deck.length}</span></div>${action}</div>
    <div class="hand">${handHTML}</div>`;
  $('.hand').scrollLeft = handScroll;
}

function banner(text, sub = '') {
  const el = document.createElement('div');
  el.className = 'banner';
  el.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
  fxLayer.appendChild(el);
  setTimeout(() => el.remove(), FAST ? 10 : 1000);
}
function slotCenter(key) {
  const el = document.querySelector(`[data-slot="${key}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
function float(key, text, cls, offset = 0) {
  const p = slotCenter(key);
  if (!p) return;
  const el = document.createElement('div');
  el.className = `float ${cls}`;
  el.textContent = text;
  el.style.left = `${p.x}px`; el.style.top = `${p.y + offset}px`;
  fxLayer.appendChild(el);
  setTimeout(() => el.remove(), FAST ? 10 : 900);
}
async function lunge(from, to) {
  const a = document.querySelector(`[data-slot="${from}"] .unit`);
  const p1 = slotCenter(from), p2 = slotCenter(to);
  if (!a || !p1 || !p2 || FAST) { await sleep(80); return; }
  const dx = (p2.x - p1.x) * 0.72, dy = (p2.y - p1.y) * 0.72;
  a.style.zIndex = 6;
  const dur = S.turbo ? 110 : 300;
  await a.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${dx}px,${dy}px) scale(1.08)`, offset: 0.55 }, { transform: 'translate(0,0)' }], { duration: dur, easing: 'ease-in-out' }).finished.catch(() => {});
}
function shake(key) {
  const el = document.querySelector(`[data-slot="${key}"] .unit`);
  if (el && !FAST) el.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 170 });
}

// 播放引擎吐出的事件
async function playEvents(g) {
  const evs = g.ev.splice(0);
  const after = [];
  let peek = null;
  for (const e of evs) {
    if (e.t === 'attack') { await lunge(e.from, e.to); if (!alive(g)) return; }
    else if (e.t === 'peek' && e.side === 0) peek = e;
    else after.push(e);
  }
  render();
  let i = 0;
  for (const e of after) {
    const off = (i++ % 3) * 12 - 8;
    if (e.t === 'dmg') {
      if (e.n > 0) { float(e.slot, `-${e.n}`, 'dmg', off); shake(e.slot); SFX.hit(); }
      if (e.absorbed > 0) float(e.slot, `護盾擋${e.absorbed}`, 'shield', off + 18);
      if (e.n === 0 && e.absorbed === 0) float(e.slot, '0', 'miss', off);
    } else if (e.t === 'miss') { float(e.slot, e.text, 'miss', off); SFX.miss(); }
    else if (e.t === 'status') float(e.slot, e.text, e.kind, off);
    else if (e.t === 'death') { float(e.slot, '倒下', 'dmg', off + 18); SFX.die(); }
    else if (e.t === 'log') { S.msg = e.msg; }
    else if (e.t === 'tactic' && e.side === 1) { S.msg = `對手使用了「${e.name}」`; }
    else if (e.t === 'deploy') SFX.place();
  }
  if (peek) await askPeek(g, peek);
}
function askPeek(g, e) {
  return new Promise((done) => {
    const c = byId[e.id];
    modal.innerHTML = `<div class="box"><h3>森林偵查</h3><p>你的牌庫頂是這張：</p><div class="center">${cardHTML(c)}</div>
      <div class="row"><button class="btn alt" data-peek="keep">留著</button><button class="btn" data-peek="bottom">放到牌底</button></div></div>`;
    S.peekDone = (bottom) => { if (bottom && alive(g)) E.peekToBottom(g, 0); modal.innerHTML = ''; S.peekDone = null; done(); };
  });
}

function aiPeek(g) {
  // 對手的森林偵查：太貴的牌就放牌底
  const evs = g.ev.filter((e) => e.t === 'peek' && e.side === 1);
  for (const e of evs) if (byId[e.id].cost >= 5 && g.round <= 2) E.peekToBottom(g, 1);
}

async function reveal(g) {
  S.busy = true; S.sel = null; S.focus = null; S.msg = '';
  E.beginReveal(g);
  render();
  banner('揭曉！');
  await sleep(600);
  while (alive(g) && E.stepReveal(g)) {
    aiPeek(g);
    await playEvents(g);
    await sleep(430);
  }
  if (!alive(g)) return;
  if (g.turn === 1) { aiTactic(g, 1); aiPeek(g); await playEvents(g); await sleep(500); }
  if (!alive(g)) return;
  S.busy = false;
  S.turbo = false;
  S.msg = '';
  render();
}

async function fight(g) {
  S.busy = true; S.sel = null; S.moveUid = null; S.focus = null; S.msg = '';
  if (g.turn === 0) { aiTactic(g, 1); aiPeek(g); await playEvents(g); await sleep(500); if (!alive(g)) return; }
  E.beginBattle(g);
  S.msg = '';
  render();
  banner('開戰！');
  await sleep(600);
  while (alive(g) && E.stepBattle(g)) {
    aiPeek(g);
    await playEvents(g);
    await sleep(380);
  }
  if (!alive(g)) return;
  await settle(g);
}

async function settle(g) {
  E.settleRound(g);
  const scoreEv = g.ev.find((e) => e.t === 'score');
  await playEvents(g);
  S.turbo = false;
  if (!alive(g)) return;
  const myGain = scoreEv.zones.filter((z) => z.win === 0).length, foeGain = scoreEv.zones.filter((z) => z.win === 1).length;
  if (myGain || foeGain) SFX.score();
  S.msg = `本回合計分：你 +${myGain}，對手 +${foeGain}`;
  scoreEv.zones.forEach((z) => {
    if (z.win !== null) float(`${z.win}-${z.z}-f`, '+1 分', z.win === 0 ? 'heal' : 'dmg');
  });
  await sleep(900);
  if (!alive(g)) return;
  if (g.phase === 'over') return showResult(g);
  S.busy = false;
  render();
}

const REASON = { score7: '先拿到 7 分', rounds: '回合結束時分數較高', power: '同分，比較存活動物總戰力', surrender: '對手投降', draw: '加時後仍然平手' };
function showResult(g) {
  S.busy = true;
  render();
  const win = g.winner === 0, draw = g.winner === -1;
  const pic = win ? animalSVG(S.facs[0], 'crown') : animalSVG(draw ? 'cat' : S.foeFacs[0], draw ? '' : 'mask');
  const reason = g.endReason === 'surrender' && !win ? '你投降了' : REASON[g.endReason];
  modal.innerHTML = `<div class="box result"><div class="pic">${pic}</div><h2>${draw ? '平手' : win ? '你贏了！' : '你輸了'}</h2>
    <p>${reason}<br>比分 ${g.sides[0].score}：${g.sides[1].score}（打了 ${g.round} 回合）</p>
    <p>對手陣營：${S.foeFacs.map((f) => FACTIONS[f].name).join('＋')}</p>
    <div class="row"><button class="btn alt" data-act="choose">換陣營</button><button class="btn" data-act="start">再來一局</button></div></div>`;
}

function rules() {
  modal.innerHTML = `<div class="box"><h3>怎麼玩</h3>
    <h4>目標</h4><p>每回合計分一次：三個地形裡，存活動物 <b>ATK 總和較高</b> 的一方得 1 分。先拿 <b>7 分</b> 獲勝，最多打 5 回合。</p>
    <h4>每回合流程</h4><ul>
    <li><b>部署：</b>點手牌、點格子，能量每回合補滿。雙方同時部署，互相看不到。</li>
    <li><b>戰術：</b>揭曉後能看到對手布陣，可以用道具和事件卡。</li>
    <li><b>戰鬥：</b>動物自動攻擊，速度高的先打。同速時先攻方先打，先攻方每回合輪替。</li></ul>
    <h4>攻擊誰</h4><p>先打同區敵方前排，前排沒了打後排。<b>同區沒有敵人時，會改打其他區的敵人</b>，所以躲不掉戰鬥。</p>
    <h4>地形</h4><ul>${TERRAINS.map((t) => `<li><b>${t.name}：</b>${t.tip}</li>`).join('')}</ul>
    <p>大部分動物有擅長的地形，放對地方會顯示 ★ 並獲得額外能力。</p>
    <h4>圖示</h4><p>橘色數字是 ATK、紅色是 HP、藍色是 SPD。點場上的動物可以看詳細能力。</p>
    <div class="row"><button class="btn" data-act="closeModal">知道了</button></div></div>`;
}
function menu() {
  modal.innerHTML = `<div class="box"><h3>選單</h3>
    <div class="row"><button class="btn alt" data-act="toggleSound">音效：${S.sound ? '開' : '關'}</button></div>
    <div class="row"><button class="btn alt" data-act="surrender">投降</button><button class="btn" data-act="closeModal">繼續</button></div></div>`;
}

// ── 操作 ──
const ACT = {
  title, choose, rules, menu,
  edit: editDeck,
  resetDeck() { S.deck = null; editDeck(); },
  start() { modal.innerHTML = ''; startGame(); },
  closeModal() { modal.innerHTML = ''; },
  toggleSound() { S.sound = !S.sound; store.set('sound', S.sound); menu(); },
  surrender() {
    const g = S.g;
    if (!g || g.phase === 'over') { modal.innerHTML = ''; return; }
    S.quit = g;              // 讓進行中的揭曉／戰鬥動畫停下來
    if (S.peekDone) S.peekDone(false);
    E.surrender(g, 0);
    showResult(g);
  },
  confirm() { if (!S.busy && S.g?.phase === 'deploy') reveal(S.g); },
  fight() { if (!S.busy && S.g?.phase === 'tactic') fight(S.g); },
  next() { const g = S.g; if (S.busy || g?.phase !== 'roundEnd') return; E.nextRound(g); roundIntro(g); },
  turbo() { S.turbo = true; render(); },
  useCard() { tryPlay({}); },
};
function tryPlay(target) {
  const g = S.g;
  if (!g || S.busy || !S.sel) return;
  if (E.playTactic(g, 0, S.sel, target)) { S.sel = null; S.moveUid = null; S.focus = null; S.msg = ''; SFX.place(); playEvents(g); render(); }
}
function clickCard(iid) {
  const g = S.g;
  if (!g || S.busy) return;
  S.moveUid = null; S.focus = null;
  S.sel = S.sel === iid ? null : iid;
  SFX.tap();
  render();
}
function clickUnit(uid) {
  const g = S.g;
  if (!g || S.busy) { if (g) { S.focus = uid; render(); } return; }
  const inst = S.sel ? g.sides[0].hand.find((c) => c.iid === S.sel) : null;
  const c = inst ? byId[inst.id] : null;
  if (g.phase === 'tactic' && c && c.kind !== 'animal' && S.moveUid === null) {
    if (c.play[0][0] === 'move') {
      if (E.unitsOf(g, 0).some((u) => u.uid === uid)) { S.moveUid = uid; render(); return; }
    } else if (c.t === 'ally' || c.t === 'enemy') {
      if (E.validTargets(g, 0, c).some((u) => u.uid === uid)) { tryPlay({ uid }); return; }
    }
  }
  S.focus = uid; S.sel = null; S.moveUid = null;
  render();
}
function clickSlot(z, row) {
  const g = S.g;
  if (!g || S.busy) return;
  if (S.moveUid !== null) { tryPlay({ uid: S.moveUid, dest: { z, row } }); return; }
  if (S.sel && E.plan(g, 0, S.sel, z, row)) { S.sel = null; S.msg = ''; SFX.place(); render(); }
}

function handleClick(ev) {
  const t = ev.target.closest('button');
  if (!t) return;
  const d = t.dataset;
  if (d.peek) { if (S.peekDone) S.peekDone(d.peek === 'bottom'); return; }
  if (d.act) { SFX.tap(); ACT[d.act]?.(); return; }
  if (d.fac) {
    const i = S.facs.indexOf(d.fac);
    S.deck = null;
    if (i >= 0) S.facs.splice(i, 1);
    else { if (S.facs.length >= 2) S.facs.shift(); S.facs.push(d.fac); }
    SFX.tap(); choose(); return;
  }
  if (d.add) { if (S.deck.length < DECK_SIZE && S.deck.filter((x) => x === d.add).length < COPY_LIMIT) S.deck.push(d.add); editDeck(); return; }
  if (d.sub) { const i = S.deck.indexOf(d.sub); if (i >= 0) S.deck.splice(i, 1); editDeck(); return; }
  if (d.info) { const c = byId[d.info]; modal.innerHTML = `<div class="box"><div class="center">${cardHTML(c)}</div><p>${infoHTML(c)}</p><div class="row"><button class="btn" data-act="closeModal">關閉</button></div></div>`; return; }
  if (d.card) return clickCard(d.card);
  if (d.unplan) { const [z, row] = d.unplan.split('-'); if (!S.busy && S.g && E.unplan(S.g, 0, +z, row)) { SFX.tap(); render(); } return; }
  if (d.uid) return clickUnit(+d.uid);
  if (d.place) { const [z, row] = d.place.split('-'); return clickSlot(+z, row); }
  if (d.zone) {
    const g = S.g;
    if (!g || S.busy || !S.sel) return;
    const inst = g.sides[0].hand.find((c) => c.iid === S.sel);
    if (inst && byId[inst.id].t === 'zone') tryPlay({ z: +d.zone });
    return;
  }
}
document.addEventListener('click', handleClick);
title();
