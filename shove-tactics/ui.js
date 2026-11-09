import * as E from './engine.js';

const $ = (id) => document.getElementById(id);
const FAST = location.hash.includes('fast');
const wait = (ms) => new Promise((r) => setTimeout(r, FAST ? 0 : ms));
const G = (window.__g = { s: null, sel: null, busy: false, level: 1, errors: [] });
let pickEls = [];

// ---------- 開局 ----------
function start(level) {
  G.level = level;
  G.s = E.newGame();
  G.sel = null; G.busy = false;
  $('oRules').classList.add('hidden'); $('oOver').classList.add('hidden');
  $('bClose').classList.remove('hidden');
  buildBoard();
  render();
  banner(`第 1 回合 · ${G.s.first === 0 ? '你先手' : 'AI 先手'}`).then(next);
}
$('bEasy').onclick = () => start(0);
$('bNormal').onclick = () => start(1);
$('bRules').onclick = () => $('oRules').classList.remove('hidden');
$('bClose').onclick = () => $('oRules').classList.add('hidden');
$('bAgain').onclick = () => start(G.level);
$('bSee').onclick = () => $('oOver').classList.add('hidden');

function tsize() { return $('board').getBoundingClientRect().width / E.W; }

function buildBoard() {
  const b = $('board');
  b.innerHTML = '';
  for (let y = 0; y < E.H; y++) for (let x = 0; x < E.W; x++) {
    const d = document.createElement('div');
    d.className = 'tile';
    d.dataset.x = x; d.dataset.y = y;
    d.onclick = () => tapTile(x, y);
    b.appendChild(d);
  }
}

// ---------- 畫面 ----------
function tileEl(x, y) { return $('board').children[y * E.W + x]; }

function render(dispUnits = null) {
  const s = G.s, units = dispUnits || s.units, ts = tsize();
  const me = s.players[0], ai = s.players[1];
  $('hRound').textContent = `回合 ${s.round}/${E.MAX_ROUND}`;
  $('hMe').innerHTML = `你 <span class="en">${'●'.repeat(me.energy)}</span>`;
  $('hAI').innerHTML = `AI <span class="en">${'●'.repeat(ai.energy)}</span> 🂠${ai.hand.length}`;
  const st = $('status');
  if (s.phase === 'over') { st.textContent = '對局結束'; st.className = ''; }
  else if (dispUnits || s.phase === 'resolve') { st.textContent = '⚔ 結算中…'; st.className = ''; }
  else if (s.turn === 0) { st.textContent = s.passes ? '輪到你（AI 已結束行動）' : '輪到你'; st.className = 'me'; }
  else { st.textContent = 'AI 思考中…'; st.className = 'ai'; }

  // 格子
  const hl = highlights();
  for (let y = 0; y < E.H; y++) for (let x = 0; x < E.W; x++) {
    const t = tileEl(x, y), tr = E.terr(s, x, y);
    t.className = 'tile' + (tr ? ' ' + tr : y >= 2 ? ' home0' : ' home1') + (hl.tiles.has(x + ',' + y) ? ' hl' : '');
    t.innerHTML = tr ? `<span class="tl">${{ pit: '坑洞', rock: '岩石', water: '水 -1' }[tr]}</span>` : '';
  }
  // 意圖（只在行動階段顯示）
  const svg = $('ov');
  let sv = `<defs><marker id="m0" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0L10,5L0,10z" fill="#60a5fa"/></marker><marker id="m1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0L10,5L0,10z" fill="#f87171"/></marker></defs>`;
  let pred = null;
  if (!dispUnits && s.phase === 'action') {
    for (const u of s.units) {
      const tg = E.intentOf(s, u).filter((t) => t.kind !== 'path');
      if (!tg.length) continue;
      const cx = (u.x + 0.5) * ts, cy = (u.y + 0.5) * ts;
      const col = u.type === 'medic' ? '#4ade80' : u.side === 0 ? '#60a5fa' : '#f87171';
      for (const t of tg) {
        if (t.kind === 'dmg') tileEl(t.x, t.y).classList.add(u.side === 0 ? 'thB' : 'thR');
      }
      const far = tg.reduce((a, t) => (Math.abs(t.x - u.x) + Math.abs(t.y - u.y) > Math.abs(a.x - u.x) + Math.abs(a.y - u.y) ? t : a), tg[0]);
      if (u.type === 'cannon' || u.type === 'medic') {
        const c = u.type === 'cannon' ? tg[0] : null;
        if (c) sv += `<line x1="${cx}" y1="${cy}" x2="${(c.x + 0.5) * ts}" y2="${(c.y + 0.5) * ts}" stroke="${col}" stroke-width="3" stroke-dasharray="6 4" marker-end="url(#m${u.side})" opacity=".9"/>`;
        if (c) sv += `<text x="${(c.x + 0.5) * ts}" y="${(c.y + 0.5) * ts + 5}" text-anchor="middle" font-size="16" font-weight="900" fill="${col}">✸${t0(c.n)}</text>`;
      } else {
        const ex = (far.x + 0.5) * ts, ey = (far.y + 0.5) * ts;
        const k = 0.28 * ts / Math.hypot(ex - cx, ey - cy);
        sv += `<line x1="${cx + (ex - cx) * k}" y1="${cy + (ey - cy) * k}" x2="${ex - (ex - cx) * k * 0.6}" y2="${ey - (ey - cy) * k * 0.6}" stroke="${col}" stroke-width="3" marker-end="url(#m${u.side})" opacity=".85"/>`;
      }
    }
    // 預測：直接結算的結果
    const c = E.clone(s); c.phase = 'resolve'; E.resolve(c);
    pred = {};
    for (const u of s.units) { const v = c.units.find((w) => w.id === u.id); pred[u.id] = !v ? '💀' : v.hp !== u.hp ? `→${v.hp}` : ''; }
    if (c.phase === 'over' && c.round === s.round) pred.over = c.winner;
  }
  svg.innerHTML = sv;

  // 單位
  const live = new Set();
  for (const u of units) {
    live.add(String(u.id));
    let el = $('board').parentElement.querySelector(`.unit[data-id="${u.id}"]`);
    if (!el) {
      el = document.createElement('div');
      el.dataset.id = u.id;
      el.onclick = (e) => { e.stopPropagation(); tapUnit(u.id); };
      $('boardWrap').appendChild(el);
    }
    const d = E.UNITS[u.type], o = E.ordOf(u);
    el.className = `unit s${u.side}` + (u.type === 'commander' ? ' cmd' : '') + (G.sel && G.sel.id === u.id ? ' sel' : '') + (hl.units.has(u.id) ? ' hl' : '');
    el.style.left = u.x * ts + 'px'; el.style.top = u.y * ts + 'px';
    el.innerHTML = `<div class="ord${u.ordOv != null ? ' mod' : ''}">${o}</div><div class="face f${u.f}"></div>` +
      `<div class="nm">${d.name.length > 2 ? d.name.slice(0, 2) : d.name}</div><div class="st">♥${u.hp} ⚔${E.atkOf(s, u)}</div>` +
      (u.guard ? '<div class="gd">🛡</div>' : '') + (pred && pred[u.id] ? `<div class="pred">${pred[u.id]}</div>` : '');
  }
  for (const el of [...$('boardWrap').querySelectorAll('.unit')]) if (!live.has(el.dataset.id) && !el.classList.contains('dead')) el.remove();

  renderHand();
  renderInfo(pred);
  renderActs();
  const lg = s.log.slice(-4);
  $('log').innerHTML = lg.map((m) => `<div>${m}</div>`).join('');
}
const t0 = (n) => n;

function myTurn() { return !G.busy && G.s.phase === 'action' && G.s.turn === 0; }
function legal() { return myTurn() ? E.legalActions(G.s, 0) : [{ t: 'pass' }]; }
function cardActs(ci) { const c = G.s.players[0].hand[ci]; return legal().filter((a) => a.card !== undefined && G.s.players[0].hand[a.card] === c); }

function highlights() {
  const tiles = new Set(), units = new Set(), sel = G.sel;
  if (!sel || !myTurn()) return { tiles, units };
  if (sel.kind === 'card') {
    for (const a of cardActs(sel.ci)) { if (a.t === 'deploy') tiles.add(a.x + ',' + a.y); else units.add(a.id); }
  } else if (sel.kind === 'move') {
    for (const a of legal()) if (a.t === 'move' && a.id === sel.id) { const u = E.byId(G.s, a.id); tiles.add((u.x + E.DV[a.d][0]) + ',' + (u.y + E.DV[a.d][1])); }
  } else if (sel.kind === 'tgt2') {
    for (const a of cardActs(sel.ci)) if (a.id === sel.id && a.id2) units.add(a.id2);
  }
  return { tiles, units };
}

function renderHand() {
  const s = G.s, P = s.players[0], h = $('hand');
  h.innerHTML = '';
  P.hand.forEach((c, i) => {
    const d = document.createElement('div'), u = E.UNITS[c];
    const can = myTurn() && E.cardCost(c) <= P.energy && cardActs(i).length > 0;
    d.className = 'card' + (u ? '' : ' tac') + (can ? '' : ' off') + (G.sel && G.sel.ci === i ? ' sel' : '');
    d.innerHTML = `<div class="cc">${E.cardCost(c)}</div><div class="ck">${u ? '單位' : '戰術'}</div><div class="cn">${E.cardName(c)}</div>` +
      (u ? `<div class="cs">♥${u.hp} ⚔${u.atk} 順序${u.ord}</div>` : `<div class="cs">${E.TACTICS[c].text.slice(0, 14)}…</div>`);
    d.onclick = () => tapCard(i);
    h.appendChild(d);
  });
  if (!P.hand.length) h.innerHTML = '<div style="color:var(--dim);font-size:13px;padding:8px">沒有手牌</div>';
}

function renderInfo(pred) {
  const s = G.s, sel = G.sel, el = $('info');
  let html = '';
  if (sel && sel.ci !== undefined) {
    const c = s.players[0].hand[sel.ci];
    html = `<b>${E.cardName(c)}</b>（${E.cardCost(c)} 能量）${E.cardText(c)}<br><span class="warn">${hintFor(sel, c)}</span>`;
  } else if (sel && sel.id) {
    const u = E.byId(s, sel.id);
    if (u) html = unitInfo(u) + (sel.kind === 'move' ? '<br><span class="warn">點黃框的格子移動</span>' : sel.kind === 'rot' ? '<br><span class="warn">選方向</span>' : '');
  } else if (sel && sel.look) {
    const u = E.byId(s, sel.look);
    if (u) html = unitInfo(u);
  } else if (s.phase === 'action' && s.turn === 0) {
    html = '點手牌出牌，或點自己的單位移動／轉向。看懂紅線（AI 這回合要打哪）再決定。';
    if (pred && pred.over !== undefined) html += `<br><span class="warn">⚠ 照現在直接結算：${pred.over === 0 ? '你會贏！' : pred.over === 1 ? '你會輸！' : '平手'}</span>`;
  } else html = '<span style="color:var(--dim)">點任何單位可以看說明</span>';
  el.innerHTML = html;
}
function unitInfo(u) {
  const d = E.UNITS[u.type];
  return `<b style="color:${u.side ? '#fca5a5' : '#93c5fd'}">${u.side ? 'AI' : '你'}的${d.name}</b> ♥${u.hp}/${u.maxhp} ⚔${E.atkOf(G.s, u)} 出手順序 ${E.ordOf(u)}${u.guard ? ' 🛡護盾' : ''}<br>${d.text}`;
}
function hintFor(sel, c) {
  if (sel.kind === 'card') return E.isUnit(c) ? '點黃框格子部署（只能放自己這兩排）' : '點要作用的單位';
  if (sel.kind === 'face') return '選這個單位要面向哪邊（白框＝預設往前）';
  if (sel.kind === 'tgt2') return '點相鄰的另一個單位';
  if (sel.kind === 'dir') return c === 'turn' ? '選要轉向的方向' : '選方向';
  return '';
}

function renderActs() {
  const a = $('acts');
  a.innerHTML = '';
  const add = (txt, fn, cls = '', dis = false) => { const b = document.createElement('button'); b.textContent = txt; b.className = cls; b.disabled = dis; b.onclick = fn; a.appendChild(b); };
  const sel = G.sel;
  if (myTurn() && sel && sel.kind === 'unit') {
    const L = legal();
    add('移動（1 能量）', () => { G.sel = { kind: 'move', id: sel.id }; render(); }, '', !L.some((x) => x.t === 'move' && x.id === sel.id));
    add('轉向（免費）', () => { G.sel = { kind: 'rot', id: sel.id }; render(); showPicker(); }, '', !L.some((x) => x.t === 'rotate' && x.id === sel.id));
    add('取消', clearSel, 'ghost');
    return;
  }
  if (myTurn() && sel) { add('取消', clearSel, 'ghost'); return; }
  add('結束行動 ✋', () => { if (myTurn()) act({ t: 'pass' }); }, 'main', !myTurn());
}

function clearSel() { G.sel = null; clearPicker(); render(); }

// ---------- 方向選擇 ----------
function clearPicker() { pickEls.forEach((e) => e.remove()); pickEls = []; }
function showPicker() {
  clearPicker();
  const sel = G.sel, ts = tsize();
  let x, y, opts, def = -1;
  if (sel.kind === 'face') { x = sel.x; y = sel.y; opts = cardActs(sel.ci).filter((a) => a.t === 'deploy' && a.x === x && a.y === y).map((a) => [a.f, a]); def = E.FWD[0]; }
  else if (sel.kind === 'rot') { const u = E.byId(G.s, sel.id); x = u.x; y = u.y; opts = legal().filter((a) => a.t === 'rotate' && a.id === sel.id).map((a) => [a.f, a]); }
  else if (sel.kind === 'dir') { const u = E.byId(G.s, sel.id); x = u.x; y = u.y; opts = cardActs(sel.ci).filter((a) => a.id === sel.id && a.d !== undefined).map((a) => [a.d, a]); }
  if (!opts || !opts.length) { clearSel(); return; }
  for (const [f, a] of opts) {
    const b = document.createElement('button');
    b.className = 'pick' + (f === def ? ' def' : '');
    b.textContent = E.ARROW[f];
    const px = (x + 0.5) * ts + E.DV[f][0] * ts * 0.62 - 17, py = (y + 0.5) * ts + E.DV[f][1] * ts * 0.62 - 17;
    b.style.left = px + 'px'; b.style.top = py + 'px';
    b.onclick = (e) => { e.stopPropagation(); clearPicker(); act(a); };
    $('boardWrap').appendChild(b);
    pickEls.push(b);
  }
}

// ---------- 點擊 ----------
function tapCard(i) {
  if (!myTurn()) return;
  clearPicker();
  if (G.sel && G.sel.ci === i) { clearSel(); return; }
  if (!cardActs(i).length) { G.sel = null; render(); $('info').innerHTML = `<b>${E.cardName(G.s.players[0].hand[i])}</b>：${E.cardText(G.s.players[0].hand[i])}<br><span class="warn">${E.cardCost(G.s.players[0].hand[i]) > G.s.players[0].energy ? '能量不夠' : '現在沒有可以用的目標'}</span>`; return; }
  G.sel = { kind: 'card', ci: i };
  render();
}

function tapTile(x, y) {
  const sel = G.sel;
  if (!myTurn() || !sel) { if (sel) clearSel(); return; }
  if (sel.kind === 'card' && E.isUnit(G.s.players[0].hand[sel.ci])) {
    if (!cardActs(sel.ci).some((a) => a.t === 'deploy' && a.x === x && a.y === y)) return;
    G.sel = { kind: 'face', ci: sel.ci, x, y };
    render(); showPicker(); return;
  }
  if (sel.kind === 'face' && sel.x === x && sel.y === y) { // 再點一次＝面向前
    const a = cardActs(sel.ci).find((a) => a.t === 'deploy' && a.x === x && a.y === y && a.f === E.FWD[0]);
    if (a) { clearPicker(); act(a); } return;
  }
  if (sel.kind === 'move') {
    const u = E.byId(G.s, sel.id);
    const a = legal().find((a) => a.t === 'move' && a.id === sel.id && u.x + E.DV[a.d][0] === x && u.y + E.DV[a.d][1] === y);
    if (a) { act(a); return; }
  }
  clearSel();
}

function tapUnit(id) {
  const s = G.s, u = E.byId(s, id), sel = G.sel;
  if (!u) return;
  if (myTurn() && sel && sel.kind === 'card' && !E.isUnit(s.players[0].hand[sel.ci])) {
    const A = cardActs(sel.ci).filter((a) => a.id === id);
    if (!A.length) return;
    const c = s.players[0].hand[sel.ci];
    if (c === 'swap') { G.sel = { kind: 'tgt2', ci: sel.ci, id }; render(); return; }
    if (A[0].d !== undefined) { G.sel = { kind: 'dir', ci: sel.ci, id }; render(); showPicker(); return; }
    act(A[0]); return;
  }
  if (myTurn() && sel && sel.kind === 'tgt2') {
    const a = cardActs(sel.ci).find((a) => a.id === sel.id && a.id2 === id);
    if (a) { act(a); return; }
  }
  if (myTurn() && sel && sel.kind === 'card') { // 選了單位牌又點單位：顯示說明
    G.sel = { look: id }; clearPicker(); render(); return;
  }
  clearPicker();
  if (myTurn() && u.side === 0) { G.sel = sel && sel.id === id && sel.kind === 'unit' ? null : { kind: 'unit', id }; render(); return; }
  G.sel = { look: id }; render();
}

// ---------- 流程 ----------
function act(a) {
  if (!myTurn() || !E.isLegal(G.s, a)) return;
  G.sel = null; clearPicker();
  E.apply(G.s, a);
  render();
  next();
}

async function next() {
  const s = G.s;
  if (G.busy) return;
  if (s.phase === 'over') return gameOver();
  if (s.phase === 'resolve') return runResolve();
  if (s.turn === 1) {
    G.busy = true; render();
    await wait(550);
    if (G.s !== s) return; // 已經重開
    const a = E.aiChoose(s, G.level);
    if (a.t !== 'pass') { // 先亮一下 AI 要動的單位
      const id = a.id || null;
      if (id) { const el = document.querySelector(`.unit[data-id="${id}"]`); el && el.classList.add('act'); await wait(250); }
    }
    E.apply(s, a);
    G.busy = false;
    render();
    next();
  }
}

async function runResolve() {
  const s = G.s;
  G.busy = true;
  const disp = E.clone(s).units;
  const round = s.round;
  render(disp);
  await banner('⚔ 結算');
  const steps = [];
  E.resolve(s, steps);
  for (const st of steps) {
    if (G.s !== s) return;
    const u = disp.find((w) => w.id === st.id);
    if (!u) continue;
    if (!st.ev.length && u.type !== 'medic') continue; // 沒打到東西就跳過
    const el = document.querySelector(`.unit[data-id="${u.id}"]`);
    el && el.classList.add('act');
    await wait(260);
    for (const e of st.ev) {
      const v = disp.find((w) => w.id === e.id);
      if (e.type === 'dmg' && v) { v.hp -= e.n; floatAt(v, `-${e.n}`, '#f87171'); }
      if (e.type === 'heal' && v) { v.hp += e.n; floatAt(v, `+${e.n}`, '#4ade80'); }
      if (e.type === 'block' && v) { v.guard = false; floatAt(v, '擋', '#facc15'); }
      if (e.type === 'fallsave' && v) floatAt(v, '撞!', '#facc15');
      if (e.type === 'move' && v) { v.x = e.x; v.y = e.y; }
      if ((e.type === 'die' || e.type === 'fall') && v) {
        if (e.type === 'fall') floatAt(v, '墜落', '#facc15');
        const de = document.querySelector(`.unit[data-id="${v.id}"]`);
        disp.splice(disp.indexOf(v), 1);
        if (de) { de.classList.add('dead'); setTimeout(() => de.remove(), FAST ? 0 : 400); }
      }
    }
    render(disp);
    await wait(380);
  }
  G.busy = false;
  render();
  if (s.phase === 'over') return gameOver();
  await banner(`第 ${s.round} 回合 · ${s.first === 0 ? '你先手' : 'AI 先手'}`);
  next();
}

function floatAt(u, txt, color) {
  const ts = tsize(), f = document.createElement('div');
  f.className = 'float'; f.textContent = txt; f.style.color = color;
  f.style.left = (u.x + 0.3) * ts + 'px'; f.style.top = (u.y + 0.1) * ts + 'px';
  $('boardWrap').appendChild(f);
  setTimeout(() => f.remove(), 750);
}

async function banner(txt) {
  const b = $('banner');
  b.textContent = txt; b.classList.remove('hidden'); b.style.opacity = 1;
  await wait(800);
  b.style.opacity = 0;
  await wait(250);
  b.classList.add('hidden');
}

function gameOver() {
  const s = G.s;
  render();
  const c0 = E.commander(s, 0), c1 = E.commander(s, 1);
  $('ovT').textContent = s.winner === 0 ? '🎉 你贏了！' : s.winner === 1 ? '💀 你輸了' : '🤝 平手';
  $('ovD').innerHTML = s.timeout ? `8 回合結束，比指揮官血量：你 ${c0 ? c0.hp : 0}、AI ${c1 ? c1.hp : 0}` : s.winner === 0 ? 'AI 的指揮官被打倒了' : s.winner === 1 ? '你的指揮官被打倒了' : '雙方指揮官同時倒下';
  $('oOver').classList.remove('hidden');
}

window.addEventListener('resize', () => G.s && render());
window.addEventListener('error', (e) => G.errors.push(String(e.message)));
