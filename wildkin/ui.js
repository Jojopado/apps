// WILDKIN 畫面與操作
import { CARDS, FACTIONS, SPECIES, TERRAINS, KEYWORDS, byId, recommendedDeck, deckProblem, DECK_SIZE, COPY_LIMIT } from './cards.js';
import * as E from './engine.js';
import { aiDeploy, aiTactic, randomDeploy } from './ai.js';
import { animalSVG, iconSVG, terrainSVG, SVG_DEFS, sceneURL, statIcon } from './art.js';
import * as A from './audio.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app'), fxLayer = $('#fx'), modal = $('#modal');
document.body.insertAdjacentHTML('afterbegin', SVG_DEFS);
const coachLayer = document.createElement('div');
coachLayer.id = 'coach';
document.body.appendChild(coachLayer);
const FAST = location.hash.includes('fast');
const store = {
  get(k, d) { try { const v = localStorage.getItem('wildkin.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('wildkin.' + k, JSON.stringify(v)); } catch { /* 私密模式 */ } },
};
const S = {
  g: null, sel: null, moveUid: null, focus: null, busy: false, turbo: false, msg: '',
  facs: store.get('facs', ['rabbit', 'bear']), deck: null, foeFacs: [],
  sound: store.get('sound', true), musicOn: store.get('music', true),
  record: store.get('record', { w: 0, l: 0, d: 0 }),
  diff: store.get('diff', 'easy'),
  coachOff: FAST || store.get('coachDone', false),
  seen: new Set(),
};
window.__wk = { S, E, byId };
A.setOptions({ sfx: S.sound, music: S.musicOn, mute: FAST });

const SFX = new Proxy({}, { get: (_, name) => (o) => A.play(name, o) });
const haptic = (ms = 12) => { try { if (!FAST) navigator.vibrate?.(ms); } catch { /* 不支援 */ } };
const sleep = (ms) => new Promise((r) => setTimeout(r, FAST ? Math.min(ms, 4) : S.turbo ? ms * 0.22 : ms));

// ── 卡牌與單位 ──
const facColor = (c) => (c.fac === 'neutral' ? (c.kind === 'item' ? '#6f8a4a' : '#5f7396') : FACTIONS[c.fac].color);
const picOf = (c) => (c.kind === 'animal' ? animalSVG(c.species, c.acc) : iconSVG(c.icon));
const homeOf = (c) => (c.kind === 'animal' ? SPECIES[c.species].home : null);
function cardHTML(c, attrs = '', cls = '') {
  const home = homeOf(c);
  const bg = home ? sceneURL(home) : c.kind === 'item' ? 'linear-gradient(#f3ecd2,#e2d6ad)' : c.kind === 'event' ? 'linear-gradient(#e2e9f4,#c9d4e8)' : 'linear-gradient(#efe6f5,#d9cbe6)';
  const tag = home ? `<div class="ttl">${terrainSVG(home)}</div>` : `<div class="kind">${c.kind === 'item' ? '道具' : c.kind === 'event' ? '事件' : ''}</div>`;
  const stats = c.kind === 'animal'
    ? `<div class="stats"><span class="s1">${statIcon('atk')}${c.atk}</span><span class="s2">${statIcon('hp')}${c.hp}</span><span class="s3">${statIcon('spd')}${c.spd}</span></div>` : '';
  const rare = c.cost >= 5 ? 'legend' : '';
  return `<button class="card ${c.kind !== 'animal' ? 'it' : ''} ${rare} ${cls}" style="--fc:${facColor(c)}" ${attrs}>
    <div class="art-win" style="background-image:${bg}"><div class="pic">${picOf(c)}</div>${tag}</div>
    <div class="cost">${c.cost}</div><div class="nm">${c.name}</div>
    <div class="desc">${c.text}</div>${stats}</button>`;
}
function unitHTML(g, u, cls = '', order = 0) {
  const c = E.cardOf(u);
  const atk = E.atkOf(g, u), spd = E.spdOf(g, u);
  const bd = [];
  if (u.shield) bd.push(`<i class="bdg sh">${statIcon('shield')}${u.shield}</i>`);
  if (u.block) bd.push('<i class="bdg ic">冰</i>');
  if (u.hide) bd.push('<i class="bdg hd">隱</i>');
  if (E.hasBond(g, u)) bd.push('<i class="bdg bd">♥</i>');
  if (E.isHome(g, u)) bd.push('<i class="bdg hm">★</i>');
  if (u.kw.guard) bd.push('<i class="bdg gd">守</i>');
  const hurt = u.hp < u.maxHp ? 'hurt' : '';
  const ord = order ? `<i class="ord">${order}</i>` : '';
  return `<button class="unit ${u.side ? 'foe' : 'me'} ${u.frozen ? 'frozen' : ''} ${cls}" data-uid="${u.uid}" style="--fc:${FACTIONS[c.fac]?.color || '#888'}">
    <div class="pic">${animalSVG(c.species, c.acc)}</div>${ord}
    <span class="stat spd ${spd < u.spd ? 'down' : spd > u.spd ? 'up' : ''}">${statIcon('spd')}${spd}</span><div class="badges">${bd.join('')}</div>
    <span class="stat atk ${atk > c.atk ? 'up' : atk < c.atk ? 'down' : ''}">${statIcon('atk')}${atk}</span><span class="stat hp ${hurt}">${statIcon('hp')}${u.hp}</span></button>`;
}

function infoHTML(c, u) {
  const kws = c.kind === 'animal' ? Object.keys(c.kw).filter((k) => KEYWORDS[k]).map((k) => `<b>${KEYWORDS[k][0]}</b>：${KEYWORDS[k][1]}`) : [];
  let head = `<b class="iname" style="color:${facColor(c)}">${c.name}</b> `;
  if (c.kind === 'animal') {
    const atk = u ? E.atkOf(S.g, u) : c.atk, hp = u ? `${u.hp}/${u.maxHp}` : c.hp, spd = u ? E.spdOf(S.g, u) : c.spd;
    head += `<span class="ist a">${statIcon('atk')}${atk}</span><span class="ist h">${statIcon('hp')}${hp}</span><span class="ist s">${statIcon('spd')}${spd}</span>`;
    if (!u) head += `<span class="ist c">費用 ${c.cost}</span>`;
  } else head += `<span class="ist c">${c.kind === 'item' ? '道具' : '事件'}・費用 ${c.cost}</span>`;
  const sp = c.kind === 'animal' ? SPECIES[c.species] : null;
  const home = sp?.home ? `<span class="home">在${TERRAINS.find((t) => t.id === sp.home).name}★：${sp.perk}</span>` : '';
  return `${head}<br>${c.text}${home ? '　' + home : ''}${kws.length ? `<br><small>${kws.join('　')}</small>` : ''}`;
}

// ── 畫面：標題／選陣營／牌組 ──
function leaves(n = 10) {
  return Array.from({ length: n }, (_, i) => `<i class="leaf" style="left:${(i * 37) % 100}%;animation-delay:${-(i * 1.7) % 9}s;animation-duration:${8 + (i % 4) * 2}s"></i>`).join('');
}
function title() {
  S.g = null;
  S.deck = null;
  modal.innerHTML = '';
  A.music('title');
  const logos = ['fox', 'rabbit', 'bear', 'penguin', 'cat'].map((s, i) => `<div style="animation-delay:${i * 0.18}s">${animalSVG(s)}</div>`).join('');
  const r = S.record;
  const rec = r.w + r.l + r.d ? `<div class="rec">戰績 ${r.w} 勝 ${r.l} 敗${r.d ? ` ${r.d} 和` : ''}</div>` : '';
  app.innerHTML = `<div class="title">${leaves()}
    <div class="logoRow">${logos}</div>
    <div class="logo"><h1>WILDKIN</h1><h2>野境物語</h2></div>
    <p>森林、湖泊、草原，三塊地一起搶。<br>派出動物、看穿對手，拿下 7 分就贏。</p>
    <button class="btn big" data-act="choose">開始對戰</button>
    <div class="row2"><button class="btn alt" data-act="rules">怎麼玩</button><button class="btn alt" data-act="menu">設定</button></div>
    ${rec}<button class="credit" data-act="credits">製作名單與素材授權</button></div>`;
  coach();
}
function choose() {
  modal.innerHTML = '';
  S.g = null;
  A.music('title');
  const list = Object.entries(FACTIONS).map(([k, f]) => {
    const on = S.facs.includes(k);
    const idx = S.facs.indexOf(k);
    return `<button class="fac ${on ? 'on' : ''}" data-fac="${k}" style="--fc:${f.color}"><div class="pic">${animalSVG(k, on ? 'crown' : '')}</div>
      <div class="ftxt"><b>${f.name}</b><span class="th">${f.theme}</span><small>${f.desc}</small></div>
      ${on ? `<span class="check">${idx + 1}</span>` : ''}</button>`;
  }).join('');
  const diff = `<div class="diff"><span>對手難度</span><button class="${S.diff === 'easy' ? 'on' : ''}" data-diff="easy">新手</button><button class="${S.diff === 'normal' ? 'on' : ''}" data-diff="normal">普通</button></div>`;
  app.innerHTML = `<div class="screen"><h3>選兩個陣營</h3><p class="sub">兩個陣營的卡會組成你的 24 張牌組，不同組合會觸發不同的羈絆。</p>${diff}${list}</div>
    <div class="bottomBar"><button class="btn alt" data-act="title">返回</button><button class="btn alt" data-act="edit" ${S.facs.length ? '' : 'disabled'}>調整牌組</button>
    <button class="btn" data-act="start" ${S.facs.length === 2 ? '' : 'disabled'}>開始對戰</button></div>`;
  coach();
}
function currentDeck() { return S.deck || recommendedDeck(S.facs[0], S.facs[1]); }
function editDeck() {
  const deck = currentDeck();
  S.deck = deck;
  const count = {};
  deck.forEach((id) => { count[id] = (count[id] || 0) + 1; });
  const pool = CARDS.filter((c) => S.facs.includes(c.fac) || c.fac === 'neutral');
  const items = pool.map((c) => `<div class="deckItem ${count[c.id] ? 'in' : ''}">${cardHTML(c, `data-info="${c.id}"`)}
    <div class="deckCtl"><button data-sub="${c.id}" ${count[c.id] ? '' : 'disabled'}>−</button><span>${count[c.id] || 0}</span>
    <button data-add="${c.id}" ${(count[c.id] || 0) >= COPY_LIMIT || deck.length >= DECK_SIZE ? 'disabled' : ''}>＋</button></div></div>`).join('');
  const scrollTop = $('.screen')?.scrollTop || 0;
  const bad = deckProblem(deck);
  app.innerHTML = `<div class="screen"><h3>調整牌組</h3><p class="sub">同名卡最多 2 張。已幫你放好推薦牌組，點卡片看詳細說明。</p><div class="deckGrid">${items}</div></div>
    <div class="bottomBar"><button class="btn alt" data-act="choose">返回</button><button class="btn alt" data-act="resetDeck">推薦</button><div class="deckCount ${bad ? 'bad' : ''}">${deck.length} / ${DECK_SIZE}</div>
    <button class="btn" data-act="start" ${bad ? 'disabled' : ''}>開始對戰</button></div>`;
  $('.screen').scrollTop = scrollTop;
  coach();
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
  S.sel = null; S.moveUid = null; S.focus = null; S.turbo = false; S.busy = true; S.seen = new Set();
  A.music('battle');
  render();
  roundIntro(S.g);
}
const alive = (g) => S.g === g && S.quit !== g;

async function roundIntro(g) {
  g.ev.length = 0;
  S.busy = true;
  S.msg = '';
  render();
  SFX.round();
  banner(g.overtime && g.round === g.maxRounds ? '加時賽' : `第 ${g.round} 回合`, g.turn === 0 ? '你是先攻方：同速時你先打' : '對手是先攻方：同速時對手先打', 'round');
  await sleep(1150);
  if (!alive(g)) return;
  if (S.diff === 'easy' && g.round <= 3) randomDeploy(g, 1); else aiDeploy(g, 1);
  S.busy = false;
  S.msg = '';
  render();
}

function phaseHint(g) {
  if (S.msg) return S.msg;
  if (g.phase === 'deploy') {
    if (S.sel) return '點發亮的格子放下去。金色格子＝牠擅長的地形。';
    return `<b>部署階段</b>　點手牌、再點格子。這回合有 <b>${g.sides[0].energy}</b> 點能量。`;
  }
  if (g.phase === 'tactic') {
    const usable = g.sides[0].hand.some((c) => E.canPlayTactic(g, 0, c.iid));
    return usable ? '<b>戰術階段</b>　對手的布陣揭曉了！可以用道具、事件卡，或直接開戰。' : '<b>戰術階段</b>　沒有可用的道具或事件，按「開戰」吧。';
  }
  if (g.phase === 'battle') return '<b>戰鬥中</b>　頭上的數字是出手順序，速度高的先打。';
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
  const order = {};
  if (g.phase === 'battle') E.attackOrder(g).forEach((u, i) => { order[u.uid] = i + 1; });

  const slotHTML = (side, z, row) => {
    const b = g.sides[side].board[z][row];
    const rowCls = row === 'f' ? 'front' : 'back';
    if (b) {
      let cls = '';
      if (pickTactic && selCard.t !== 'zone' && targetUnits.includes(b)) cls = 'target';
      if (b.uid === S.moveUid) cls = 'sel';
      if (b.uid === S.focus) cls += ' focus';
      if (order[b.uid] === 1) cls += ' next';
      return `<div class="slot ${rowCls}" data-slot="${side}-${z}-${row}">${unitHTML(g, b, cls, order[b.uid] || 0)}</div>`;
    }
    const p = side === 0 && g.phase === 'deploy' ? me.plan.find((x) => x.z === z && x.row === row) : null;
    if (p) {
      const c = byId[p.card.id];
      return `<div class="slot ${rowCls}" data-slot="${side}-${z}-${row}"><button class="unit me planned" data-unplan="${z}-${row}" data-pk="${p.card.iid}"><div class="pic">${animalSVG(c.species, c.acc)}</div>
        <span class="stat atk">${statIcon('atk')}${c.atk}</span><span class="stat hp">${statIcon('hp')}${c.hp}</span><i class="undo">↩</i></button></div>`;
    }
    const can = (pickDeploy && side === 0 && E.canPlan(g, 0, S.sel, z, row)) || (moving && side === 0);
    const homeHint = pickDeploy && can && SPECIES[selCard.species].home === E.terrainAt(g, z);
    const label = row === 'f' ? '前排' : '後排';
    return `<button class="slot ${rowCls} ${can ? 'can' : ''} ${homeHint ? 'homeHint' : ''}" data-slot="${side}-${z}-${row}" ${can ? `data-place="${z}-${row}"` : ''}><span class="rowTag">${homeHint ? '★ ' : ''}${label}</span></button>`;
  };
  const planPower = (z) => me.plan.filter((p) => p.z === z).reduce((n, p) => n + byId[p.card.id].atk, 0);
  const zones = [0, 1, 2].map((z) => {
    const t = E.terrainAt(g, z);
    const myP = E.zonePower(g, 0, z) + (g.phase === 'deploy' ? planPower(z) : 0), foeP = E.zonePower(g, 1, z);
    const zoneTarget = pickTactic && selCard.t === 'zone';
    const lead = myP > foeP ? 'winMe' : foeP > myP ? 'winFoe' : '';
    const hidden = g.phase === 'deploy' ? 'hiddenFoe' : '';
    return `<div class="zone ${t} ${lead}" style="background-image:${sceneURL(t)}">
      <div class="half foe ${hidden}">${slotHTML(1, z, 'b')}${slotHTML(1, z, 'f')}</div>
      <button class="band ${zoneTarget ? 'target' : ''} ${lead}" data-zone="${z}"><span class="p foe">${g.phase === 'deploy' ? '?' : foeP}</span><div class="ico">${terrainSVG(t)}</div><span class="name">${TERRAINS.find((x) => x.id === t).name}${g.truce[z] ? '・休戰' : ''}</span><span class="p me">${myP}</span></button>
      <div class="half mine">${slotHTML(0, z, 'f')}${slotHTML(0, z, 'b')}</div></div>`;
  }).join('');

  const canUseCard = (c) => (g.phase === 'deploy' ? byId[c.id].kind === 'animal' && byId[c.id].cost <= me.energy : g.phase === 'tactic' ? E.canPlayTactic(g, 0, c.iid) : false);
  const hand = [...me.hand].sort((a, b) => byId[a.id].cost - byId[b.id].cost || a.id.localeCompare(b.id));
  const handScroll = $('.hand')?.scrollLeft || 0;
  const handHTML = hand.map((c) => cardHTML(byId[c.id], `data-card="${c.iid}"`, `${c.iid === S.sel ? 'sel' : ''} ${canUseCard(c) ? '' : 'off'}`)).join('');

  let action = '';
  if (!S.busy) {
    if (g.phase === 'deploy') action = `<button class="btn go" data-act="confirm">確認部署</button>`;
    else if (g.phase === 'tactic') action = `<button class="btn go fight" data-act="fight">開戰！</button>`;
    else if (g.phase === 'roundEnd') action = `<button class="btn go" data-act="next">下一回合</button>`;
  } else if (g.phase === 'battle' || g.phase === 'reveal') action = `<button class="btn alt" data-act="turbo">${S.turbo ? '快轉中…' : '快轉 ▶▶'}</button>`;

  const useBtn = pickTactic && !selCard.t ? `<button class="btn" data-act="useCard" ${E.canPlayTactic(g, 0, S.sel) ? '' : 'disabled'}>使用</button>` : '';
  let info = phaseHint(g);
  if (moving) info = '選一個空位，把動物移過去。';
  else if (selCard) {
    const wrong = g.phase === 'deploy' && selCard.kind !== 'animal' ? '<span class="warn">（戰術階段才能用）</span>' : g.phase === 'tactic' && selCard.kind === 'animal' ? '<span class="warn">（部署階段才能放）</span>' : '';
    info = infoHTML(selCard) + wrong;
  } else if (S.focus) {
    const u = E.allUnits(g).find((x) => x.uid === S.focus);
    if (u) info = infoHTML(E.cardOf(u), u);
  }
  const maxE = E.energyForRound(g.round);
  const gems = Array.from({ length: Math.max(maxE, me.energy) }, (_, i) => `<i class="gem ${i < me.energy ? '' : 'used'}"></i>`).join('');
  const pips = (n, side) => Array.from({ length: Math.max(E.RULES.winScore, n) }, (_, i) => `<i class="pip ${i < n ? 'on' : ''}"></i>`).join('');
  app.innerHTML = `
    <div class="top"><button class="iconBtn" data-act="menu" aria-label="選單">≡</button>
      <div class="scoreBox">
        <div class="pts foe"><div class="who"><span class="mini">${animalSVG(S.foeFacs[0])}</span>對手</div><div class="pips">${pips(foe.score, 1)}</div></div>
        <div class="roundInfo"><b>${g.overtime && g.round === g.maxRounds ? '加時' : `${g.round}/${g.maxRounds}`}</b><small>回合</small></div>
        <div class="pts me"><div class="who">你<span class="mini">${animalSVG(S.facs[0])}</span></div><div class="pips">${pips(me.score, 0)}</div></div></div>
      <button class="iconBtn" data-act="rules" aria-label="規則">?</button></div>
    <div class="field ${g.phase}">${zones}</div>
    <div class="msg"><div class="txt">${info}</div>${useBtn}</div>
    <div class="bar"><div class="energy"><span class="elabel">能量</span>${gems}<span class="deckN">牌庫 ${me.deck.length}</span></div>${action}</div>
    <div class="hand">${handHTML}</div>`;
  $('.hand').scrollLeft = handScroll;
  // 新出現的單位：登場動畫
  const now = new Set();
  document.querySelectorAll('.unit[data-uid]').forEach((el) => {
    const k = 'u' + el.dataset.uid;
    now.add(k);
    if (!S.seen.has(k) && !FAST) el.classList.add(el.classList.contains('foe') ? 'flipIn' : 'popIn');
  });
  document.querySelectorAll('.unit[data-pk]').forEach((el) => {
    const k = 'p' + el.dataset.pk;
    now.add(k);
    if (!S.seen.has(k) && !FAST) el.classList.add('popIn');
  });
  S.seen = now;
  coach();
}

// ── 特效 ──
function banner(text, sub = '', kind = '') {
  const el = document.createElement('div');
  el.className = `banner ${kind}`;
  el.innerHTML = `<div class="ribbon">${text}</div>${sub ? `<small>${sub}</small>` : ''}`;
  fxLayer.appendChild(el);
  setTimeout(() => el.remove(), FAST ? 10 : 1300);
}
function slotCenter(key) {
  const el = document.querySelector(`[data-slot="${key}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}
function float(key, text, cls, offset = 0) {
  const p = slotCenter(key);
  if (!p || FAST) return;
  const el = document.createElement('div');
  el.className = `float ${cls}`;
  el.textContent = text;
  el.style.left = `${p.x}px`; el.style.top = `${p.y + offset}px`;
  fxLayer.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
function burst(x, y, colors, n = 12, spread = 60, size = 7) {
  if (FAST) return;
  for (let i = 0; i < n; i++) {
    const el = document.createElement('i');
    el.className = 'pt';
    const s = size * (0.6 + Math.random() * 0.8);
    el.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s}px;background:${colors[i % colors.length]}`;
    fxLayer.appendChild(el);
    const a = Math.random() * Math.PI * 2, d = spread * (0.4 + Math.random() * 0.8);
    el.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 18}px)) scale(.2)`, opacity: 0 },
    ], { duration: 520 + Math.random() * 320, easing: 'cubic-bezier(.2,.7,.3,1)' }).finished.then(() => el.remove(), () => el.remove());
  }
}
function slash(key, foeSide) {
  const p = slotCenter(key);
  if (!p || FAST) return;
  const el = document.createElement('div');
  el.className = `slash ${foeSide ? 'foe' : ''}`;
  el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
  el.innerHTML = '<svg viewBox="0 0 100 100"><path d="M12 80 Q50 50 88 18" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M22 86 Q56 58 92 30" stroke="#ffe08a" stroke-width="4" fill="none" stroke-linecap="round"/></svg>';
  fxLayer.appendChild(el);
  setTimeout(() => el.remove(), 380);
}
function shakeScreen(power = 6) {
  if (FAST) return;
  $('.field')?.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${-power}px,${power / 2}px)` }, { transform: `translate(${power}px,${-power / 2}px)` }, { transform: 'translate(0,0)' }], { duration: 220 });
}
async function lunge(from, to, side) {
  const a = document.querySelector(`[data-slot="${from}"] .unit`);
  const p1 = slotCenter(from), p2 = slotCenter(to);
  if (!a || !p1 || !p2 || FAST) { await sleep(80); return; }
  const dx = (p2.x - p1.x) * 0.7, dy = (p2.y - p1.y) * 0.7;
  a.style.zIndex = 8;
  a.classList.add('attacking');
  const dur = S.turbo ? 120 : 340;
  SFX.swing({ vol: S.turbo ? 0.4 : 1 });
  const anim = a.animate([
    { transform: 'translate(0,0) scale(1)' },
    { transform: `translate(${-dx * 0.08}px,${-dy * 0.08}px) scale(1.05)`, offset: 0.25 },
    { transform: `translate(${dx}px,${dy}px) scale(1.12)`, offset: 0.55 },
    { transform: 'translate(0,0) scale(1)' }], { duration: dur, easing: 'ease-in-out' });
  setTimeout(() => slash(to, side), dur * 0.5);
  await anim.finished.catch(() => {});
  a.classList.remove('attacking');
}
function shake(key) {
  const el = document.querySelector(`[data-slot="${key}"] .unit`);
  if (!el || FAST) return;
  el.animate([{ transform: 'translateX(-6px)', filter: 'brightness(2)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], { duration: 240 });
}

// 播放引擎吐出的事件
async function playEvents(g) {
  const evs = g.ev.splice(0);
  const after = [];
  let peek = null;
  for (const e of evs) {
    if (e.t === 'attack') { await lunge(e.from, e.to, e.side); if (!alive(g)) return; }
    else if (e.t === 'peek' && e.side === 0) peek = e;
    else after.push(e);
  }
  render();
  let i = 0;
  for (const e of after) {
    const off = (i++ % 3) * 14 - 10;
    if (e.t === 'dmg') {
      if (e.n > 0) {
        float(e.slot, `-${e.n}`, e.n >= 3 ? 'dmg big' : 'dmg', off); shake(e.slot); SFX.hit({ rate: e.n >= 3 ? 0.85 : 1.05 });
        const p = slotCenter(e.slot); if (p) burst(p.x, p.y, ['#fff', '#ffd27a', '#ff8a6a'], 6 + e.n * 2, 34 + e.n * 6, 6);
        if (e.n >= 3) { shakeScreen(4 + e.n); haptic(25); } else haptic(10);
      }
      if (e.absorbed > 0) { float(e.slot, `護盾 -${e.absorbed}`, 'shield', off + 20); SFX.shield(); }
      if (e.n === 0 && e.absorbed === 0) float(e.slot, '0', 'miss', off);
    } else if (e.t === 'miss') { float(e.slot, e.text, 'miss', off); SFX.miss(); }
    else if (e.t === 'status') {
      float(e.slot, e.text, e.kind, off);
      if (e.kind === 'ice') SFX.ice(); else if (e.kind === 'shield') SFX.shield(); else SFX.buff();
    } else if (e.t === 'death') {
      float(e.slot, '倒下', 'dead', off + 18); SFX.die();
      const p = slotCenter(e.slot); if (p) { burst(p.x, p.y, ['#f4efe6', '#ddd3c4', '#bfb3a2'], 16, 46, 12); }
    } else if (e.t === 'log') { S.msg = e.msg; }
    else if (e.t === 'tactic' && e.side === 1) { S.msg = `對手使用了「${e.name}」`; SFX.page(); }
    else if (e.t === 'deploy') SFX.place({ vol: 0.6 });
    else if (e.t === 'energy' && e.side === 0) SFX.coin();
  }
  if (peek) await askPeek(g, peek);
}
function askPeek(g, e) {
  return new Promise((done) => {
    const c = byId[e.id];
    SFX.page();
    modal.innerHTML = `<div class="box"><h3>森林偵查</h3><p>你的牌庫頂是這張，要留著下回合抽，還是放到最底？</p><div class="center big">${cardHTML(c)}</div>
      <div class="row"><button class="btn alt" data-peek="keep">留著</button><button class="btn" data-peek="bottom">放到牌底</button></div></div>`;
    S.peekDone = (bottom) => { if (bottom && alive(g)) E.peekToBottom(g, 0); modal.innerHTML = ''; S.peekDone = null; done(); };
  });
}

const foeUsesTactics = (g) => S.diff !== 'easy' || g.round >= 3;
function aiPeek(g) {
  // 對手的森林偵查：太貴的牌就放牌底
  const evs = g.ev.filter((e) => e.t === 'peek' && e.side === 1);
  for (const e of evs) if (byId[e.id].cost >= 5 && g.round <= 2) E.peekToBottom(g, 1);
}

async function reveal(g) {
  S.busy = true; S.sel = null; S.focus = null; S.msg = '';
  E.beginReveal(g);
  render();
  SFX.reveal();
  banner('揭曉！', '', 'reveal');
  await sleep(700);
  while (alive(g) && E.stepReveal(g)) {
    aiPeek(g);
    await playEvents(g);
    await sleep(430);
  }
  if (!alive(g)) return;
  if (g.turn === 1 && foeUsesTactics(g)) { aiTactic(g, 1); aiPeek(g); await playEvents(g); await sleep(500); }
  if (!alive(g)) return;
  S.busy = false;
  S.turbo = false;
  S.msg = '';
  render();
}

async function fight(g) {
  S.busy = true; S.sel = null; S.moveUid = null; S.focus = null; S.msg = '';
  if (g.turn === 0 && foeUsesTactics(g)) { aiTactic(g, 1); aiPeek(g); await playEvents(g); await sleep(500); if (!alive(g)) return; }
  E.beginBattle(g);
  S.msg = '';
  render();
  banner('開戰！', '', 'fight');
  await sleep(750);
  while (alive(g) && E.stepBattle(g)) {
    aiPeek(g);
    await playEvents(g);
    await sleep(400);
  }
  if (!alive(g)) return;
  await settle(g);
}

function flyStar(fromEl, toEl, mine) {
  if (!fromEl || !toEl || FAST) return Promise.resolve();
  const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `star ${mine ? 'me' : 'foe'}`;
  el.textContent = '★';
  el.style.left = `${a.left + a.width / 2}px`; el.style.top = `${a.top + a.height / 2}px`;
  fxLayer.appendChild(el);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  return el.animate([
    { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
    { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 1, offset: 0.25 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.7)`, opacity: 1 }], { duration: 760, easing: 'cubic-bezier(.5,0,.4,1)' })
    .finished.then(() => { el.remove(); burst(b.left + b.width / 2, b.top + b.height / 2, mine ? ['#bff0c3', '#fff3a0'] : ['#ffc2b6', '#fff3a0'], 10, 30, 5); }, () => el.remove());
}

async function settle(g) {
  const before = [g.sides[0].score, g.sides[1].score];
  E.settleRound(g);
  const scoreEv = g.ev.find((e) => e.t === 'score');
  // 先用舊分數畫出盤面，星星飛過去再更新
  const after = [g.sides[0].score, g.sides[1].score];
  g.sides[0].score = before[0]; g.sides[1].score = before[1];
  await playEvents(g);
  S.turbo = false;
  if (!alive(g)) { g.sides[0].score = after[0]; g.sides[1].score = after[1]; return; }
  const myGain = scoreEv.zones.filter((z) => z.win === 0).length, foeGain = scoreEv.zones.filter((z) => z.win === 1).length;
  S.msg = `<b>本回合計分</b>　你 +${myGain}　對手 +${foeGain}${myGain + foeGain < 3 ? '　（平手的地形沒人得分）' : ''}`;
  render();
  const flights = [];
  scoreEv.zones.forEach((z, k) => {
    const band = document.querySelectorAll('.band')[z.z];
    band?.classList.add(z.win === 0 ? 'scoredMe' : z.win === 1 ? 'scoredFoe' : 'scoredTie');
    if (z.win === null) return;
    const pips = document.querySelectorAll(`.pts.${z.win === 0 ? 'me' : 'foe'} .pip`);
    const target = pips[Math.min(pips.length - 1, before[z.win] + scoreEv.zones.slice(0, k).filter((x) => x.win === z.win).length)];
    flights.push(new Promise((r) => setTimeout(r, k * 160)).then(() => { SFX.score({ rate: 1 + k * 0.12 }); return flyStar(band, target, z.win === 0); }));
  });
  await Promise.all(flights);
  g.sides[0].score = after[0]; g.sides[1].score = after[1];
  if (!alive(g)) return;
  render();
  document.querySelectorAll('.band').forEach((b, z) => { const w = scoreEv.zones[z].win; b.classList.add(w === 0 ? 'scoredMe' : w === 1 ? 'scoredFoe' : 'scoredTie'); });
  await sleep(500);
  if (!alive(g)) return;
  if (g.phase === 'over') return showResult(g);
  S.busy = false;
  render();
}

const REASON = { score7: '先拿到 7 分', rounds: '回合結束時分數較高', power: '同分，比較存活動物總戰力', surrender: '對手投降', draw: '加時後仍然平手' };
function confetti() {
  if (FAST) return;
  const colors = ['#f2c53d', '#e8628e', '#4f9fce', '#6dbb5c', '#e2913b', '#fff'];
  for (let i = 0; i < 70; i++) {
    const el = document.createElement('i');
    el.className = 'conf';
    el.style.cssText = `left:${Math.random() * 100}vw;background:${colors[i % colors.length]};animation-delay:${Math.random() * 0.6}s;animation-duration:${1.8 + Math.random() * 1.6}s;--r:${Math.random() * 720 - 360}deg;--x:${Math.random() * 120 - 60}px`;
    fxLayer.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }
}
function showResult(g) {
  S.busy = true;
  render();
  const win = g.winner === 0, draw = g.winner === -1;
  if (S.quit !== g || g.endReason === 'surrender') {
    const r = S.record;
    if (draw) r.d++; else if (win) r.w++; else r.l++;
    store.set('record', r);
  }
  A.music(null);
  if (win) { SFX.win(); confetti(); } else SFX.lose();
  const pic = win ? animalSVG(S.facs[0], 'crown') : animalSVG(draw ? 'cat' : S.foeFacs[0], draw ? '' : 'mask');
  const reason = g.endReason === 'surrender' && !win ? '你投降了' : g.endReason === 'score7' && !win ? '對手先拿到 7 分' : REASON[g.endReason];
  modal.innerHTML = `<div class="box result ${win ? 'win' : draw ? 'draw' : 'lose'}"><div class="rays"></div><div class="pic">${pic}</div><h2>${draw ? '平手' : win ? '勝利！' : '落敗…'}</h2>
    <p class="reason">${reason}</p>
    <div class="final"><div><small>你</small><b>${g.sides[0].score}</b></div><span>：</span><div><small>對手</small><b>${g.sides[1].score}</b></div></div>
    <p class="meta">打了 ${g.round} 回合・${S.diff === 'easy' ? '新手' : '普通'}對手・陣營 ${S.foeFacs.map((f) => FACTIONS[f].name).join('＋')}<br>總戰績 ${S.record.w} 勝 ${S.record.l} 敗${S.record.d ? ` ${S.record.d} 和` : ''}</p>
    <div class="row"><button class="btn alt" data-act="choose">換陣營</button><button class="btn" data-act="start">再來一局</button></div></div>`;
}

function rules() {
  SFX.page();
  modal.innerHTML = `<div class="box rules"><h3>怎麼玩</h3>
    <div class="ruleCard"><b>🎯 目標</b><p>每回合結束時，三個地形各比一次：存活動物 <b>攻擊力總和</b> 較高的一方得 1 分。先拿 <b>7 分</b> 獲勝（最多 5 回合）。</p></div>
    <div class="ruleCard"><b>① 部署</b><p>點手牌、點格子。能量每回合補滿。雙方同時部署，按「確認」後才揭曉。</p></div>
    <div class="ruleCard"><b>② 戰術</b><p>看到對手布陣後，可以用道具和事件卡。</p></div>
    <div class="ruleCard"><b>③ 戰鬥</b><p>動物自動攻擊，速度高的先打（同速時先攻方先打，先攻方每回合輪替）。先打同區前排，同區沒敵人就打別區。</p></div>
    <h4>地形</h4><ul>${TERRAINS.map((t) => `<li><b>${t.name}：</b>${t.tip}</li>`).join('')}</ul>
    <p>動物放在擅長的地形會顯示 ★ 並獲得額外能力。</p>
    <h4>圖示</h4><p class="legend"><span class="ist a">${statIcon('atk')}攻擊</span><span class="ist h">${statIcon('hp')}血量</span><span class="ist s">${statIcon('spd')}速度</span>　點場上的動物可以看詳細能力。</p>
    <div class="row"><button class="btn alt" data-act="replayCoach">重看新手引導</button><button class="btn" data-act="closeModal">知道了</button></div></div>`;
}
function menu() {
  SFX.page();
  const inGame = S.g && S.g.phase !== 'over';
  modal.innerHTML = `<div class="box"><h3>${inGame ? '暫停' : '設定'}</h3>
    <div class="row"><button class="btn alt" data-act="toggleMusic">配樂：${S.musicOn ? '開' : '關'}</button><button class="btn alt" data-act="toggleSound">音效：${S.sound ? '開' : '關'}</button></div>
    ${inGame ? '<div class="row"><button class="btn alt danger" data-act="surrender">投降</button><button class="btn alt" data-act="title">回標題</button></div>' : ''}
    <div class="row"><button class="btn" data-act="closeModal">${inGame ? '繼續' : '關閉'}</button></div></div>`;
}
function credits() {
  modal.innerHTML = `<div class="box credits"><h3>製作名單</h3>
    <p><b>WILDKIN 野境物語</b><br>遊戲設計：Joseph<br>程式與美術：Joseph × Claude</p>
    <h4>配樂</h4><p>"Carefree"、"Sneaky Snitch" — Kevin MacLeod (incompetech.com)<br>Licensed under Creative Commons: By Attribution 4.0<br><small>creativecommons.org/licenses/by/4.0/</small></p>
    <h4>音效</h4><p>Kenney — Interface Sounds、Casino Audio、RPG Audio、Music Jingles（CC0）<br><small>kenney.nl</small></p>
    <h4>字型</h4><p>jf open 粉圓 — justfont（SIL Open Font License 1.1）</p>
    <div class="row"><button class="btn" data-act="closeModal">關閉</button></div></div>`;
}

// ── 新手引導（第一局跟著提示走）──
function coach() {
  coachLayer.innerHTML = '';
  document.querySelectorAll('.coachHi').forEach((el) => el.classList.remove('coachHi'));
  if (S.coachOff || modal.innerHTML) return;
  const g = S.g;
  let target = null, text = '', step = '';
  if (!g) {
    if ($('.title')) { target = $('[data-act="choose"]'); text = '第一次玩？按這裡開始，我會一步步帶你。'; step = 'title'; }
    else if ($('.fac')) { target = S.facs.length === 2 ? $('.bottomBar [data-act="start"]') : $('.fac:not(.on)'); text = S.facs.length === 2 ? '選好兩個陣營了，開始對戰！' : '點兩個陣營，組成你的牌組。'; step = 'choose'; }
  } else if (S.busy) {
    return;
  } else if (g.phase === 'deploy') {
    const me = g.sides[0];
    if (S.sel) { target = $('.slot.homeHint') || $('.slot.can'); text = '點發亮的格子放下去。<b>金色</b>是牠擅長的地形，會多一個能力。'; step = 'place'; }
    else if (!me.plan.length) { target = $('.hand .card:not(.off)'); text = '這是你的手牌。先點一張<b>動物卡</b>（左上角是費用）。'; step = 'pick'; }
    else { target = $('[data-act="confirm"]'); text = me.energy > 0 && me.hand.some((c) => byId[c.id].kind === 'animal' && byId[c.id].cost <= me.energy) ? '還有能量可以再放一隻。放好後按「確認部署」，對手會同時揭曉。' : '按「確認部署」，看看對手放了什麼！'; step = 'confirm'; }
  } else if (g.phase === 'tactic') { target = $('[data-act="fight"]'); text = '現在看得到對手了。可以用<b>道具／事件卡</b>改變戰局，或直接「開戰」。'; step = 'tactic'; }
  else if (g.phase === 'roundEnd') { target = $('.band'); text = '每塊地形比<b>攻擊力總和</b>，高的得 1 分（上面數字是對手、下面是你）。先拿 7 分就贏！'; step = 'score'; }
  if (!target) return;
  target.classList.add('coachHi');
  const r = target.getBoundingClientRect();
  const el = document.createElement('div');
  const below = r.top + r.height / 2 < innerHeight * 0.45;
  el.className = `coachBubble ${below ? 'below' : 'above'} ${S.lastCoach === step + text ? 'still' : ''}`;
  S.lastCoach = step + text;
  el.innerHTML = `<div class="ctext">${text}</div><button class="cskip" data-act="skipCoach">跳過教學</button>`;
  coachLayer.appendChild(el);
  const bw = Math.min(300, innerWidth - 24);
  el.style.width = `${bw}px`;
  const cx = Math.max(12 + bw / 2, Math.min(innerWidth - 12 - bw / 2, r.left + r.width / 2));
  el.style.left = `${cx - bw / 2}px`;
  el.style.setProperty('--ax', `${Math.max(16, Math.min(bw - 16, r.left + r.width / 2 - (cx - bw / 2)))}px`);
  if (below) el.style.top = `${Math.min(innerHeight - 120, r.bottom + 12)}px`;
  else el.style.bottom = `${Math.max(8, innerHeight - r.top + 12)}px`;
  if (step === 'score') S.coachSawScore = true;
}
addEventListener('resize', () => coach());

// ── 操作 ──
const ACT = {
  title, choose, rules, menu, credits,
  edit: editDeck,
  resetDeck() { S.deck = null; editDeck(); },
  start() { modal.innerHTML = ''; startGame(); },
  closeModal() { modal.innerHTML = ''; coach(); },
  toggleSound() { S.sound = !S.sound; store.set('sound', S.sound); A.setOptions({ sfx: S.sound }); menu(); },
  toggleMusic() { S.musicOn = !S.musicOn; store.set('music', S.musicOn); A.setOptions({ music: S.musicOn }); menu(); },
  skipCoach() { S.coachOff = true; store.set('coachDone', true); coach(); },
  replayCoach() { S.coachOff = false; store.set('coachDone', false); modal.innerHTML = ''; coach(); },
  surrender() {
    const g = S.g;
    if (!g || g.phase === 'over') { modal.innerHTML = ''; return; }
    S.quit = g;              // 讓進行中的揭曉／戰鬥動畫停下來
    if (S.peekDone) S.peekDone(false);
    E.surrender(g, 0);
    showResult(g);
  },
  confirm() { if (!S.busy && S.g?.phase === 'deploy') { SFX.confirm(); reveal(S.g); } },
  fight() { if (!S.busy && S.g?.phase === 'tactic') fight(S.g); },
  next() {
    const g = S.g; if (S.busy || g?.phase !== 'roundEnd') return;
    if (S.coachSawScore && !S.coachOff) { S.coachOff = true; store.set('coachDone', true); }
    E.nextRound(g); roundIntro(g);
  },
  turbo() { S.turbo = true; render(); },
  useCard() { tryPlay({}); },
};
function tryPlay(target) {
  const g = S.g;
  if (!g || S.busy || !S.sel) return;
  if (E.playTactic(g, 0, S.sel, target)) { S.sel = null; S.moveUid = null; S.focus = null; S.msg = ''; SFX.place(); haptic(); playEvents(g); render(); }
  else SFX.error();
}
function clickCard(iid) {
  const g = S.g;
  if (!g || S.busy) return;
  S.moveUid = null; S.focus = null;
  S.sel = S.sel === iid ? null : iid;
  SFX.select();
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
  SFX.tap();
  S.focus = uid; S.sel = null; S.moveUid = null;
  render();
}
function clickSlot(z, row) {
  const g = S.g;
  if (!g || S.busy) return;
  if (S.moveUid !== null) { tryPlay({ uid: S.moveUid, dest: { z, row } }); return; }
  if (S.sel && E.plan(g, 0, S.sel, z, row)) { S.sel = null; S.msg = ''; SFX.place(); haptic(); render(); }
}

function handleClick(ev) {
  A.unlock();
  const t = ev.target.closest('button');
  if (!t) return;
  const d = t.dataset;
  if (d.peek) { SFX.tap(); if (S.peekDone) S.peekDone(d.peek === 'bottom'); return; }
  if (d.act) { SFX.tap(); ACT[d.act]?.(); return; }
  if (d.diff) { S.diff = d.diff; store.set('diff', S.diff); SFX.select(); choose(); return; }
  if (d.fac) {
    const i = S.facs.indexOf(d.fac);
    S.deck = null;
    if (i >= 0) S.facs.splice(i, 1);
    else { if (S.facs.length >= 2) S.facs.shift(); S.facs.push(d.fac); }
    SFX.select(); choose(); return;
  }
  if (d.add) { if (S.deck.length < DECK_SIZE && S.deck.filter((x) => x === d.add).length < COPY_LIMIT) { S.deck.push(d.add); SFX.place({ vol: 0.5 }); } editDeck(); return; }
  if (d.sub) { const i = S.deck.indexOf(d.sub); if (i >= 0) { S.deck.splice(i, 1); SFX.tap(); } editDeck(); return; }
  if (d.info) { const c = byId[d.info]; SFX.select(); modal.innerHTML = `<div class="box"><div class="center big">${cardHTML(c)}</div><p class="infoP">${infoHTML(c)}</p><div class="row"><button class="btn" data-act="closeModal">關閉</button></div></div>`; return; }
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
document.addEventListener('pointerdown', () => A.unlock(), { once: true });
title();
