// UI、輸入、主迴圈
import { W, H, DT, NIGHT_LEN, NIGHTS, UPGRADES, newGame, step, cmdMove, cmdRetreat, cmdHold, cmdTruck, cmdPickup, cmdBuild, cmdSupport, chooseUpgrade, buildBlock, buildCost, maxTurrets, unitById, allUnits, totalCiv, rank } from './sim.js';
import { Renderer } from './render.js';

const $ = (id) => document.getElementById(id);
const canvas = $('view');
const R = new Renderer(canvas);
let G = null;
let speed = 1, lastSpeed = 1;
const ui = { sel: null, selUnit: null, selSector: null, supMode: null, preview: null };
const cam = { x: W / 2, y: H / 2, z: 0.4, cy: 300, tx: null, ty: null, tz: null };
let coachStep = 0;
const lsGet = (k, d) => { try { const v = localStorage.getItem('ninth:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem('ninth:' + k, JSON.stringify(v)); } catch {} };

// ---- 音效：全部程式合成 ----
const sfx = {
  ctx: null, on: lsGet('sound', true), lastShot: 0, lastBoom: 0, noiseBuf: null,
  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
      const n = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, n, n);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch { this.ctx = null; }
  },
  noise(dur, freq, vol, type = 'bandpass') {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.6, dur + 0.02);
  },
  tone(freq, dur, vol) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  shot(heavy) { const n = performance.now(); if (n - this.lastShot < 70) return; this.lastShot = n; this.noise(heavy ? 0.12 : 0.05, heavy ? 500 : 1900, heavy ? 0.22 : 0.09); },
  boom() { const n = performance.now(); if (n - this.lastBoom < 90) return; this.lastBoom = n; this.noise(0.55, 150, 0.6, 'lowpass'); },
  alarm(l) { this.tone(l >= 2 ? 620 : 440, 0.12, 0.08); },
  click() { this.tone(880, 0.03, 0.04); },
};

// ---- 鏡頭 ----
const insets = () => ({ top: $('top').offsetHeight || 60, bottom: $('bottom').offsetHeight || 170 });
function fitZoom() {
  const { top, bottom } = insets();
  return Math.min(R.vw / W, Math.max(120, R.vh - top - bottom - 90) / H);
}
const zoomMin = () => fitZoom() * 0.92;
const ZOOM_MAX = 2.4;
function clampCam() {
  cam.z = Math.max(zoomMin(), Math.min(ZOOM_MAX, cam.z));
  cam.x = Math.max(-40, Math.min(W + 40, cam.x));
  cam.y = Math.max(-40, Math.min(H + 40, cam.y));
}
function updateCy() {
  const { top, bottom } = insets();
  cam.cy = top + Math.max(100, R.vh - top - bottom) / 2;
}
const toWorld = (sx, sy) => ({ x: cam.x + (sx - R.vw / 2) / cam.z, y: cam.y + (sy - cam.cy) / cam.z });
const toScreen = (x, y) => ({ x: R.vw / 2 + (x - cam.x) * cam.z, y: cam.cy + (y - cam.y) * cam.z });
function flyTo(x, y, z) { cam.tx = x; cam.ty = y; cam.tz = z ?? cam.z; }
function showAll() { flyTo(W / 2, H / 2, fitZoom()); }

// ---- 觸控 ----
const pts = new Map();
let gesture = null;
canvas.addEventListener('pointerdown', (e) => {
  sfx.init();
  try { canvas.setPointerCapture(e.pointerId); } catch {}
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  cam.tx = null;
  if (pts.size === 1) gesture = { kind: 'tap', x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
  else if (pts.size === 2) {
    const [a, b] = [...pts.values()];
    gesture = { kind: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: cam.z, wx: toWorld((a.x + b.x) / 2, (a.y + b.y) / 2) };
  }
  if (ui.supMode) ui.preview = toWorld(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', (e) => {
  const p = pts.get(e.pointerId);
  if (!p) return;
  const px = p.x, py = p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (!gesture) return;
  if (gesture.kind === 'pinch' && pts.size >= 2) {
    const [a, b] = [...pts.values()];
    cam.z = gesture.z * (Math.hypot(a.x - b.x, a.y - b.y) / gesture.d);
    clampCam();
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    cam.x = gesture.wx.x - (mx - R.vw / 2) / cam.z;
    cam.y = gesture.wx.y - (my - cam.cy) / cam.z;
    clampCam();
    return;
  }
  if (gesture.kind === 'pinch') return;
  if (Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 10) gesture.moved = true;
  if (gesture.moved) {
    cam.x -= (e.clientX - px) / cam.z;
    cam.y -= (e.clientY - py) / cam.z;
    clampCam();
  }
  if (ui.supMode) ui.preview = toWorld(e.clientX, e.clientY);
});
function endPointer(e) {
  if (!pts.has(e.pointerId)) return;
  pts.delete(e.pointerId);
  if (e.type === 'pointerup' && gesture && gesture.kind === 'tap' && !gesture.moved && pts.size === 0) tapAt(e.clientX, e.clientY);
  if (pts.size === 0) gesture = null;
  else if (gesture && gesture.kind === 'pinch' && pts.size === 1) gesture = null; // 放開一指不要亂點
  if (pts.size === 0 && ui.preview && !ui.supMode) ui.preview = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const before = toWorld(e.clientX, e.clientY);
  cam.tx = null;
  cam.z *= Math.exp(-e.deltaY * 0.0014);
  clampCam();
  cam.x = before.x - (e.clientX - R.vw / 2) / cam.z;
  cam.y = before.y - (e.clientY - cam.cy) / cam.z;
  clampCam();
}, { passive: false });

function pickUnit(sx, sy) {
  let best = null, bd = 34 * 34;
  for (const u of allUnits(G)) {
    if (u.kind === 'squad' && u.carried) continue;
    const s = toScreen(u.x, u.y), d = (s.x - sx) ** 2 + (s.y - sy) ** 2;
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}
function pickSector(wx, wy) {
  let best = null, bd = Infinity;
  for (const s of G.sectors) {
    const d = Math.hypot(s.x - wx, s.y - wy);
    if (d < 135 && d < bd) { bd = d; best = s; }
  }
  return best;
}
function setSel(u) { ui.sel = u ? u.id : null; ui.selUnit = u || null; ui.selSector = null; panelKey = ''; dockKey = ''; }
function setSector(s) { ui.sel = null; ui.selUnit = null; ui.selSector = s ? s.id : null; panelKey = ''; dockKey = ''; }
function tapAt(sx, sy) {
  if (!G || G.phase !== 'night') return;
  const w = toWorld(sx, sy);
  if (ui.supMode) {
    if (cmdSupport(G, ui.supMode, w.x, w.y)) { sfx.alarm(1); coachFlag.sup = true; }
    ui.supMode = null; ui.preview = null;
    return;
  }
  const sel = ui.selUnit;
  // 卡車選著時，點據點永遠是下令，不會被站在據點上的小隊搶走
  const tapSector = pickSector(w.x, w.y);
  if (sel && sel.kind === 'truck' && tapSector && tapSector.id !== 'hq' && cmdTruck(G, sel.id, tapSector.id)) {
    coachFlag.truck = true;
    R.floats.push({ x: w.x, y: w.y, t: 0.7, s: '◎' });
    sfx.click();
    return;
  }
  // 沒選部隊時，點據點名稱開建造面板
  if (!sel) {
    const lab = G.sectors.find((s) => { const p = toScreen(s.x, s.y - 112); return Math.abs(p.x - sx) < 56 && Math.abs(p.y - sy) < 20; });
    if (lab) { setSector(lab); sfx.click(); return; }
  }
  const hit = pickUnit(sx, sy);
  if (sel && sel.kind === 'heli' && hit && hit.kind === 'squad' && !sel.carry) { cmdPickup(G, sel.id, hit.id); sfx.click(); return; }
  if (hit && hit !== sel) { setSel(hit); sfx.click(); return; }
  if (hit && hit === sel) { setSel(null); return; }
  const sector = pickSector(w.x, w.y);
  if (sel) {
    let ok = false;
    ok = cmdMove(G, sel.id, w.x, w.y); coachFlag.move = true;
    if (ok) { R.floats.push({ x: w.x, y: w.y, t: 0.7, s: '◎' }); sfx.click(); }
    return;
  }
  if (sector) { setSector(sector); sfx.click(); return; }
  setSector(null);
}

// ---- 面板 ----
let panelKey = '', dockKey = '';
const acts = $('acts'), info = $('info'), panel = $('panel');
function setActs(key, html) { if (key !== panelKey) { panelKey = key; acts.innerHTML = html; } }
function updatePanel() {
  const u = ui.selUnit && unitById(G, ui.selUnit.id);
  if (ui.sel && !u) setSel(null);
  if (u) {
    panel.classList.remove('hide');
    let t = `<span class="name">${u.name}</span> `;
    if (u.kind === 'squad') {
      t += `士兵 ${u.soldiers.length}/8　彈藥 ${Math.round(u.ammo)}/${u.ammoMax}`;
      t += u.carried ? '　<span class="dim">機上</span>' : u.ammo < 1 ? '　<span style="color:var(--red)">沒彈藥</span>' : '';
      const near = u.carried ? null : G.sectors.find((s) => s.status !== 'lost' && Math.hypot(s.x - u.x, s.y - u.y) < 130);
      setActs(`sq${u.id}${u.carried}${near ? near.id : ''}`, u.carried ? '' : `<button data-act="hold">就地固守</button><button data-act="retreat">撤回據點</button>${near ? `<button data-act="site" data-s="${near.id}">建設${near.name}</button>` : ''}`);
      if (!u.carried) t += '<br><span class="dim">點地面移動。據點有補給就會自動補彈。</span>';
    } else if (u.kind === 'truck') {
      t += `耐久 ${Math.round(u.hp)}　補給 ${Math.round(u.cargo)}　平民 ${u.civ}`;
      t += u.loop ? `<br><span class="dim">來回 ${G.byId[u.loop].name}，${u.leg === 'out' ? '送補給中' : '載人回基地'}</span>` : '<br><span class="dim">點據點，開始來回運補撤離</span>';
      setActs(`tr${u.id}`, '<button data-act="stop">停車</button><button data-act="retreat">撤回據點</button>');
    } else if (u.kind === 'apc') {
      t += `耐久 ${Math.round(u.hp)}　砲彈 ${Math.round(u.ammo)}<br><span class="dim">只走道路</span>`;
      setActs(`ap${u.id}`, '<button data-act="stop">停車</button><button data-act="retreat">撤回據點</button>');
    } else {
      t += `耐久 ${Math.round(u.hp)}　彈藥 ${Math.round(u.ammo)}`;
      t += u.carry ? `<br><span class="dim">載著 ${u.carry.name}，點地面降落放人</span>` : u.mode === 'pickup' ? '<br><span class="dim">前往接人，落地時會被攻擊</span>' : '<br><span class="dim">點小隊就去接人，點地面就飛過去</span>';
      setActs(`he${u.id}`, '<button data-act="stop">原地盤旋</button><button data-act="home">回基地</button>');
    }
    info.innerHTML = t;
    return;
  }
  const s = ui.selSector && G.byId[ui.selSector];
  if (s) {
    panel.classList.remove('hide');
    const st = { held: '安全', crisis: '危急', lost: '淪陷' }[s.status];
    info.innerHTML = `<span class="name">${s.name}</span> ${st}　平民 ${s.civ}　補給 ${Math.round(s.stock)}　塔 ${s.turrets}/${maxTurrets(s)}`;
    const w = buildBlock(G, s, 'wall'), t = buildBlock(G, s, 'turret');
    setActs(`se${s.id}|${w}|${t}`, `<button data-act="wall" ${w ? 'disabled' : ''}>圍牆 ${buildCost('wall')}${w ? `<br><small>${w}</small>` : ''}</button><button data-act="turret" ${t ? 'disabled' : ''}>機槍塔 ${buildCost('turret')}${t ? `<br><small>${t}</small>` : ''}</button>`);
    return;
  }
  panel.classList.add('hide');
  panelKey = '';
}
acts.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b || !G) return;
  sfx.click();
  const a = b.dataset.act, u = ui.selUnit;
  if (u) {
    if (a === 'site') { const s = G.byId[b.dataset.s]; if (s) setSector(s); }
    else if (a === 'hold' || a === 'stop') cmdHold(G, u.id);
    else if (a === 'retreat') cmdRetreat(G, u.id);
    else if (a === 'home') cmdMove(G, u.id, G.byId.hq.x, G.byId.hq.y + 40);
  } else if (ui.selSector) {
    if (cmdBuild(G, ui.selSector, a)) coachFlag.build = true;
    panelKey = '';
  }
});
const dock = $('dock');
function updateDock() {
  const units = allUnits(G);
  const key = units.map((u) => u.id).join(',') + '|' + ui.sel;
  if (key !== dockKey) {
    dockKey = key;
    dock.innerHTML = units.map((u) => `<button class="card ${u.id === ui.sel ? 'sel' : ''}" data-u="${u.id}"><div>${u.name}</div><div class="bar"><i></i></div><div class="bar am"><i></i></div></button>`).join('');
  }
  for (const c of dock.children) {
    const u = units.find((x) => x.id === Number(c.dataset.u));
    if (!u) continue;
    const [hp, am] = c.querySelectorAll('.bar i');
    hp.style.width = `${Math.round((u.kind === 'squad' ? u.soldiers.length / 8 : u.hp / u.hpMax) * 100)}%`;
    am.style.width = `${Math.round((u.kind === 'truck' ? u.civ / 12 : u.ammo / Math.max(1, u.ammoMax)) * 100)}%`;
  }
}
let lastCard = { id: null, t: 0 };
dock.addEventListener('click', (e) => {
  const c = e.target.closest('[data-u]');
  if (!c || !G) return;
  sfx.click();
  const id = Number(c.dataset.u), u = unitById(G, id);
  if (!u) return;
  const now = performance.now();
  if (lastCard.id === id && now - lastCard.t < 450) flyTo(u.x, u.y, Math.max(cam.z, 1.3));
  else if (ui.selUnit && ui.selUnit.kind === 'heli' && u.kind === 'squad' && !ui.selUnit.carry) cmdPickup(G, ui.selUnit.id, u.id);
  else if (ui.sel === id) setSel(null);
  else setSel(u);
  lastCard = { id, t: now };
});
$('sup').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sup]');
  if (!b || !G || G.phase !== 'night') return;
  sfx.click();
  const k = b.dataset.sup;
  if (!G.support[k]) return;
  ui.supMode = ui.supMode === k ? null : k;
  ui.preview = null;
});
function updateHud() {
  $('night').textContent = `第 ${G.night}/${NIGHTS} 夜`;
  $('clock').firstElementChild.style.width = `${Math.min(100, (G.t / NIGHT_LEN) * 100)}%`;
  const hq = Math.ceil(G.hqHp);
  $('s-hq').textContent = hq;
  $('s-hq').style.color = hq < 300 ? 'var(--red)' : '';
  $('s-stock').textContent = Math.round(G.byId.hq.stock);
  $('s-saved').textContent = G.saved;
  $('s-z').textContent = G.zombies.length;
  const a = $('sup-arty'), s = $('sup-strafe');
  a.textContent = ui.supMode === 'arty' ? '點地圖開砲（會傷友軍）' : `砲擊 ×${G.support.arty}`;
  s.textContent = ui.supMode === 'strafe' ? '點地圖掃射' : `掃射 ×${G.support.strafe}`;
  a.classList.toggle('on', ui.supMode === 'arty'); s.classList.toggle('on', ui.supMode === 'strafe');
  a.disabled = !G.support.arty; s.disabled = !G.support.strafe;
  $('speed').textContent = speed === 0 ? '❚❚' : `${speed}×`;
  $('zoom').textContent = cam.z < 0.62 ? '放大' : '全圖';
}
let shownAlert = null, alertUntil = 0;
function updateAlert() {
  const el = $('alert'), last = G.alerts.at(-1);
  const now = performance.now();
  if (last && last !== shownAlert) {
    shownAlert = last; alertUntil = now + (last.lvl === 0 ? 2800 : 6000);
    el.textContent = last.msg; el.className = `l${last.lvl}`;
    if (last.lvl > 0) sfx.alarm(last.lvl);
  }
  if (now > alertUntil) el.classList.add('hide');
}
$('alert').addEventListener('click', () => { if (shownAlert) flyTo(shownAlert.x, shownAlert.y, Math.max(cam.z, 1)); });
const coachFlag = {};
const COACH = [
  { t: '先點下方「運輸 1」，再點地圖上的磨坊鎮。卡車會自己來回送補給、載平民。', done: () => coachFlag.truck },
  { t: '雙指放大可以看士兵。點部隊再點地面就能移動它。', done: () => coachFlag.move || G.t > 30 },
  { t: '屍潮來時按「砲擊」再點地圖。範圍內的自己人也會被炸。', done: () => coachFlag.sup || G.t > 75 },
  { t: '點駐守的小隊，按「建設」，就能花據點的補給蓋圍牆和機槍塔。', done: () => coachFlag.build || G.t > 120 },
];
function updateCoach() {
  const el = $('coach');
  while (coachStep < COACH.length && COACH[coachStep].done()) coachStep++;
  if (coachStep >= COACH.length || G.night > 1) { el.classList.add('hide'); return; }
  el.classList.remove('hide');
  if (el.textContent !== COACH[coachStep].t) el.textContent = COACH[coachStep].t;
}

// ---- 流程 ----
function hideAll() { for (const id of ['m-title', 'm-pause', 'm-up', 'm-end']) $(id).classList.add('hide'); }
function startGame() {
  sfx.init();
  G = newGame((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  speed = 1; lastSpeed = 1; coachStep = 0;
  for (const k of Object.keys(coachFlag)) delete coachFlag[k];
  ui.sel = ui.selUnit = ui.selSector = ui.supMode = ui.preview = null;
  panelKey = dockKey = ''; shownAlert = null; R.shots = []; R.booms = []; R.marks = []; R.floats = [];
  hideAll();
  $('top').classList.remove('hide'); $('bottom').classList.remove('hide');
  updateHud(); updatePanel(); updateDock();
  layout();
  cam.x = W / 2; cam.y = H / 2; cam.z = fitZoom(); cam.tx = null;
  hookG();
}
function row(a, b) { return `<tr><td>${a}</td><td>${b}</td></tr>`; }
function showUpgrade() {
  ui.supMode = null; ui.preview = null;
  const r = G.report;
  $('up-title').textContent = `第 ${r.night} 夜撐過了`;
  $('up-report').innerHTML = row('這夜救回', `${r.saved} 人`) + row('累計救回', `${r.totalSaved} 人`) + row('平民罹難', `${r.lost} 人`) + row('基地耐久', r.hq);
  $('up-list').innerHTML = G.offer.map((k) => `<button class="upg" data-k="${k}"><b>${UPGRADES[k].name}</b><span>${UPGRADES[k].desc}</span></button>`).join('');
  $('m-up').classList.remove('hide');
  sfx.alarm(0);
}
$('up-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-k]');
  if (!b || !G || G.phase !== 'upgrade') return;
  sfx.click();
  chooseUpgrade(G, b.dataset.k);
  $('m-up').classList.add('hide');
  panelKey = dockKey = '';
  if (speed === 0) speed = lastSpeed || 1;
});
function showEnd() {
  ui.supMode = null; ui.preview = null;
  const win = G.phase === 'win', r = G.report, rk = rank(G), tot = totalCiv(G);
  $('end-rank').textContent = win ? rk : '敗';
  $('end-title').textContent = win ? '撐到了最後的黎明' : G.loseWhy === 'civ' ? '基地守住了，但人沒救到' : '第九基地失守';
  $('end-why').textContent = win ? '撤離任務完成。' : G.loseWhy === 'civ' ? `三夜結束時救回不到四分之一的平民（需要 ${Math.ceil(tot * 0.25)} 人）。` : `在第 ${r.night} 夜被攻破。`;
  $('end-report').innerHTML = row('救回平民', `${G.saved} / ${tot}`) + row('平民罹難', G.civLost) + row('擊殺', G.kills) + row('損失部隊', G.unitsLost);
  $('m-end').classList.remove('hide');
  if (win) {
    const best = lsGet('best', 0);
    if (G.saved > best) lsSet('best', G.saved);
  }
  showBest();
}
function showBest() { const b = lsGet('best', 0); $('best').textContent = b ? `最佳紀錄：救回 ${b} 人` : ''; }
$('start').addEventListener('click', startGame);
$('again').addEventListener('click', startGame);
$('pause').addEventListener('click', () => {
  if (!G || G.phase !== 'night') return;
  sfx.init();
  lastSpeed = speed || lastSpeed; speed = 0;
  updateSound(); $('m-pause').classList.remove('hide');
});
$('resume').addEventListener('click', () => { $('m-pause').classList.add('hide'); speed = lastSpeed || 1; });
$('abandon').addEventListener('click', () => {
  G = null;
  hideAll();
  $('top').classList.add('hide'); $('bottom').classList.add('hide'); $('coach').classList.add('hide');
  $('m-title').classList.remove('hide');
  hookG();
});
function updateSound() { $('sound').textContent = sfx.on ? '音效：開' : '音效：關'; }
$('sound').addEventListener('click', () => { sfx.on = !sfx.on; lsSet('sound', sfx.on); updateSound(); });
$('speed').addEventListener('click', () => {
  if (!G) return;
  sfx.init();
  speed = speed === 1 ? 2 : speed === 2 ? 0 : 1;
  if (speed) lastSpeed = speed;
});
$('zoom').addEventListener('click', () => {
  if (!G) return;
  if (cam.z < 0.62) { const u = ui.selUnit; flyTo(u ? u.x : cam.x, u ? u.y : cam.y, 1.3); }
  else showAll();
});

function layout() {
  R.resize();
  updateCy();
  clampCam();
}
window.addEventListener('resize', () => { layout(); });

// ---- 主迴圈 ----
let last = performance.now(), acc = 0, prevPhase = null, hudT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!G) {
    R.x.setTransform(1, 0, 0, 1, 0, 0); R.x.fillStyle = '#071014'; R.x.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  if (cam.tx !== null) {
    const k = Math.min(1, dt * 7);
    cam.x += (cam.tx - cam.x) * k; cam.y += (cam.ty - cam.y) * k; cam.z += (cam.tz - cam.z) * k;
    clampCam();
    if (Math.abs(cam.tx - cam.x) < 2 && Math.abs(cam.ty - cam.y) < 2 && Math.abs(cam.tz - cam.z) < 0.01) cam.tx = null;
  }
  if (G.phase === 'night' && speed > 0) {
    acc += dt * speed;
    let n = 0;
    while (acc >= DT && n++ < 12) { step(G); acc -= DT; }
    if (n >= 12) acc = 0;
  }
  if (ui.sel) ui.selUnit = unitById(G, ui.sel);
  R.drain(G, sfx);
  R.draw(G, cam, ui, speed === 0 ? 0 : dt);
  if (G.phase !== prevPhase) {
    if (G.phase === 'upgrade') showUpgrade();
    else if (G.phase === 'win' || G.phase === 'lose') showEnd();
    prevPhase = G.phase;
  }
  hudT -= dt;
  if (hudT <= 0) {
    hudT = 0.12;
    if (G.phase === 'night') { updateHud(); updatePanel(); updateDock(); updateAlert(); updateCoach(); updateCy(); }
  }
}
window.__nl = { get G() { return G; }, cam, ui, get speed() { return speed; }, set speed(v) { speed = v; }, step, toScreen };
function hookG() { prevPhase = G ? G.phase : null; }

layout();
showBest();
requestAnimationFrame(frame);
