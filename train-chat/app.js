'use strict';
// Train Chat 趕火車交朋友 — 台鐵真實時刻表 × 包廂聊天
// 畫面三段：① 火車（車站看車進站／車上看窗外） ② 大廳月台／包廂（人物＋對話框） ③ 時刻表／旅伴＋停靠站
// 規則：大廳不能聊天；買票（選班次＋下車站）後就鎖定那班；上車選 2／4 人包廂，系統依個性排位；到站強制下車

const CFG = Object.assign({ db: '', prefix: 'rooms/tc_', allTrains: false }, window.TC_CONFIG || {});
const QS = new URLSearchParams(location.search);
if (QS.get('db')) CFG.db = QS.get('db');
if (QS.get('all')) CFG.allTrains = true;
if (QS.get('pre')) CFG.prefix = QS.get('pre');   // 測試用：每輪用不同的房間前綴
const SAVE_KEY = 'tc_state' + (QS.get('p') || '');   // ?p=2 → 同一台電腦開第二個玩家
const $ = id => document.getElementById(id);
const pad = n => String(Math.floor(n)).padStart(2, '0');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const BOARD = 60;            // 車進站後可以上車的秒數（起站：開車前 60 秒）
const STALE = 50000;         // 多久沒心跳算離線（毫秒）
const BYE = 60;              // 到站前幾秒提醒說再見
const COLORS = ['#e8453c', '#f39c12', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#ec6fa8', '#8d6e63', '#34495e'];
const HAIRS = ['#2b1d14', '#5a3a22', '#a0522d', '#151515', '#d9b56a', '#8a8a8a'];
const CLS = {
  '自強': { b: '#f4f4f0', s: '#d8332a', k: '#d8332a' }, '太魯閣': { b: '#f4f4f0', s: '#e2541e', k: '#e2541e' },
  '普悠瑪': { b: '#e23b2f', s: '#f4f4f0', k: '#b51f1f' }, '莒光': { b: '#e8862a', s: '#f6e7c8', k: '#e8862a' },
  '復興': { b: '#e9eef4', s: '#2f5fb3', k: '#2f5fb3' }, '區間': { b: '#eceee9', s: '#1f6fd6', k: '#3d7be0' },
  '區間快': { b: '#eceee9', s: '#f0a020', k: '#f08a20' }, '普快': { b: '#4a6fa8', s: '#e8e8e0', k: '#4a6fa8' }
};
const clsOf = c => CLS[c] || CLS['區間'];
const badge = c => `<span class="badge" style="background:${clsOf(c).k}">${esc(c)}</span>`;

// ---------- 個性 ----------
const MBTIS = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];
const QUIZ = [
  ['放假比較想？', '跟朋友出去玩', 'E', '在家充電', 'I'],
  ['聊天比較喜歡聊？', '實際發生的事', 'S', '想像、點子', 'N'],
  ['朋友難過時你會？', '幫他想辦法', 'T', '先陪他、聽他說', 'F'],
  ['旅行的時候？', '先排好行程', 'J', '走到哪玩到哪', 'P']
];
const PACES = { talk: '🗣 話多，會主動開話題', quiet: '🙂 慢熱，喜歡先聽' };
const TAGS = ['🎮 遊戲', '🍜 美食', '✈️ 旅行', '🎵 音樂', '🎬 電影', '📚 閱讀', '⚽ 運動', '📷 攝影', '🐱 寵物', '🎨 動漫', '💻 科技', '🌿 戶外'];
const tagArr = v => Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : [];
// 契合度：共同興趣最重要，MBTI 字母相同加分，話多＋慢熱互補
function compat(a, b) {
  if (!a || !b) return 0;
  const ta = tagArr(a.tg), tb = tagArr(b.tg);
  let s = 3 * ta.filter(x => tb.includes(x)).length;
  const ma = a.mb || '', mb = b.mb || '';
  if (ma.length === 4 && mb.length === 4) s += [1, 2, 1, 1].reduce((n, w, i) => n + (ma[i] === mb[i] ? w : 0), 0);
  if (a.pc && b.pc) s += a.pc !== b.pc ? 2 : a.pc === 'talk' ? 1 : 0;
  return s;
}
const stars = s => '★'.repeat(clamp(Math.round(s / 3) + 1, 1, 5)) + '☆'.repeat(5 - clamp(Math.round(s / 3) + 1, 1, 5));

// ---------- 存檔 ----------
let S = (() => {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); } catch (e) { }
  return Object.assign({
    id: 'p' + Math.random().toString(36).slice(2, 10), name: '', color: COLORS[(Math.random() * COLORS.length) | 0],
    hair: HAIRS[(Math.random() * HAIRS.length) | 0], station: 1000, sel: null, ride: null, stamps: {},
    prof: { mb: '', pc: '', tg: [] }, area: 'hall', test: false, tBase: 0, rBase: 0, speed: 1, x: 80, y: 60
  }, s);
})();
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }
const myProf = () => ({ mb: S.prof.mb, pc: S.prof.pc, tg: S.prof.tg });

// ---------- 時間（一律台灣時間） ----------
const TZ = 8 * 3600;
function now() { const r = Date.now() / 1000; return S.test ? S.tBase + (r - S.rBase) * S.speed : r; }
function setGameTime(t, speed) { S.tBase = t; S.rBase = Date.now() / 1000; if (speed) S.speed = speed; save(); dirty = true; }
const dayKey = t => { const d = new Date((t + TZ) * 1000); return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()); };
const midnight = k => Date.UTC(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8)) / 1000 - TZ;
const addDays = (k, n) => dayKey(midnight(k) + n * 86400 + 3600);
const secOfDay = t => ((Math.floor(t) + TZ) % 86400 + 86400) % 86400;
const hm = t => { const s = secOfDay(t); return pad(s / 3600) + ':' + pad(s % 3600 / 60); };
const hms = t => hm(t) + ':' + pad(secOfDay(t) % 60);
const hourOf = t => secOfDay(t) / 3600;
function dur(sec) {
  sec = Math.max(0, Math.round(sec));
  if (sec >= 3600) return Math.floor(sec / 3600) + '時' + pad(sec % 3600 / 60) + '分';
  if (sec >= 600) return Math.floor(sec / 60) + '分';
  return Math.floor(sec / 60) + ':' + pad(sec % 60);
}
const dateStr = t => { const k = dayKey(t); return k.slice(0, 4) + '.' + k.slice(4, 6) + '.' + k.slice(6); };

// ---------- 時刻表資料（預設只用精選班次） ----------
let ST = {}, DATES = [], GAME = null, dirty = true;
const DAY = {}, PEND = {}, TR = {};
const stName = c => (ST[c] || ['?'])[0];
const stEn = c => (ST[c] || ['', ''])[1];
function loadDay(k) {
  if (DAY[k]) return Promise.resolve(DAY[k]);
  if (PEND[k]) return PEND[k];
  let src = k;
  if (DATES.length && !DATES.includes(k)) {      // 超出已下載的範圍 → 借最近一份同星期幾的
    const wd = d => new Date((midnight(d) + TZ) * 1000).getUTCDay();
    src = [...DATES].reverse().find(d => wd(d) === wd(k)) || DATES[DATES.length - 1];
  }
  return PEND[k] = fetch('data/' + src + '.json').then(r => r.json()).then(j => {
    const m = midnight(k);
    const arr = j.t.filter(t => CFG.allTrains || t[3]).map(([no, cls, st]) => {
      const full = st.map(([c, a, d]) => ({ c, a: m + a, d: m + d }));
      return { key: k + '_' + no, date: k, no, cls, full, stops: CFG.allTrains || !GAME ? full : full.filter(x => GAME.has(x.c)) };
    }).filter(t => t.stops.length >= 2);
    for (const t of arr) TR[t.key] = t;
    DAY[k] = arr; delete PEND[k]; dirty = true; return arr;
  }).catch(() => { delete PEND[k]; return []; });
}
function ensureDays() {
  const k = dayKey(now());
  return Promise.all([loadDay(addDays(k, -1)), loadDay(k), loadDay(addDays(k, 1))]);
}

// 某站出發的車（含正在上車中的）
let depCache = { k: '', v: [] };
function departures(code, t, hours) {
  hours = hours || 12;
  const ck = code + '|' + Math.floor(t / 30) + '|' + Object.keys(DAY).length + '|' + hours;
  if (depCache.k === ck && !dirty) return depCache.v;
  const out = [];
  for (const k in DAY) for (const tr of DAY[k]) {
    const st = tr.stops;
    for (let i = 0; i < st.length - 1; i++) if (st[i].c === code) {
      if (st[i].d >= t - 40 && st[i].d <= t + hours * 3600) out.push({ tr, i, d: st[i].d });
      break;
    }
  }
  out.sort((a, b) => a.d - b.d);
  depCache = { k: ck, v: out.slice(0, 30) };
  return depCache.v;
}
// 上車窗口：車到站（或開車前 60 秒）～開車
function boardWin(tr, i) { const s = tr.stops[i]; return [Math.min(s.a, s.d - BOARD), s.d]; }
// 列車現在在哪：before／stop(i)／move(i→i+1, f)／done
function trainPos(tr, t) {
  const st = tr.stops;
  if (t < st[0].d - BOARD) return { kind: 'before', i: 0 };
  for (let i = 0; i < st.length; i++) {
    const s = st[i], open = i === 0 ? s.d - BOARD : s.a;
    if (t < open) return { kind: 'move', i: i - 1, f: clamp((t - st[i - 1].d) / Math.max(1, s.a - st[i - 1].d), 0, 1) };
    if (i === st.length - 1) return { kind: 'done', i };
    if (t <= s.d) return { kind: 'stop', i };
  }
  return { kind: 'done', i: st.length - 1 };
}
const destName = tr => { const f = tr.full || tr.stops; return stName(f[f.length - 1].c); };   // 顯示真實終點站

// ---------- 連線（Firebase REST＋串流；沒設定就單機） ----------
const Net = {
  room: null, es: null, peers: {}, hb: 0,
  url(k) { return CFG.db + '/' + CFG.prefix + this.room + (k ? '/' + k : '') + '.json'; },
  join(room) {
    if (this.room === room) return;
    this.leave();
    this.room = room; this.peers = {}; chat.length = 0; renderLog();
    if (!CFG.db) return;
    try {
      this.es = new EventSource(this.url());
      this.es.addEventListener('put', e => this.apply(JSON.parse(e.data), false));
      this.es.addEventListener('patch', e => this.apply(JSON.parse(e.data), true));
    } catch (e) { this.es = null; }
    this.push();
  },
  leave() {
    if (this.es) { this.es.close(); this.es = null; }
    if (this.room && CFG.db) fetch(this.url(S.id), { method: 'DELETE', keepalive: true }).catch(() => { });
    this.room = null; this.peers = {};
  },
  apply(msg, patch) {
    if (!msg) return;
    const parts = String(msg.path || '/').split('/').filter(Boolean), data = msg.data;
    if (!parts.length) {
      if (!patch) { this.peers = {}; }
      for (const k in (data || {})) this.set(k, data[k]);
    } else if (parts.length === 1) {
      this.set(parts[0], patch ? Object.assign({}, this.peers[parts[0]], data) : data);
    } else {
      const p = Object.assign({}, this.peers[parts[0]]); p[parts[1]] = data; this.set(parts[0], p);
    }
  },
  set(k, v) {
    if (k === S.id) return;
    const old = this.peers[k];
    if (!v || typeof v !== 'object') {
      if (old && S.ride && old.cp === S.ride.cp) logChat('', `${old.n || '旅伴'} 下車了`);
      delete this.peers[k]; return;
    }
    const mine = S.ride && v.cp === S.ride.cp && S.ride.cp != null;
    if (mine && (!old || old.cp !== v.cp)) logChat('', `${v.n || '旅伴'} 進到包廂了`);
    if (mine && v.m && v.mt && (!old || old.mt !== v.mt) && Date.now() - v.mt < 20000) logChat(v.n, v.m);
    this.peers[k] = v;
  },
  push() {
    if (!this.room || !CFG.db) return;
    this.hb = Date.now();
    const me = { n: S.name || '旅人', c: S.color, h: S.hair, x: Math.round(S.x), y: Math.round(S.y), t: Date.now(), ...myProf() };
    if (S.ride) {
      const tr = TR[S.ride.key];
      Object.assign(me, { cp: S.ride.cp, cs: S.ride.cs, st: S.ride.seat, jt: S.ride.jt || 0 });
      if (tr) { me.dt = tr.stops[S.ride.dest].a; me.ds = stName(tr.stops[S.ride.dest].c); }
      if (myMsg.mt) { me.m = myMsg.m; me.mt = myMsg.mt; }
    }
    fetch(this.url(S.id), { method: 'PUT', body: JSON.stringify(me) }).catch(() => { });
  }
};
const roomName = () => S.ride ? 'tr' + S.ride.key : (S.area === 'platform' ? 'pf' : 'st') + S.station;

// ---------- 包廂（同班車的玩家依個性排位） ----------
// 還佔著位子的人：在線的，或離線睡著但還沒到他的下車站
function seatedPeers(t) {
  return Object.entries(Net.peers).filter(([, v]) => v.cp != null && (Date.now() - (v.t || 0) < STALE || (v.dt && v.dt > t)));
}
function comps(t) {
  const out = {};
  for (const [id, v] of seatedPeers(t)) {
    const c = out[v.cp] || (out[v.cp] = { size: v.cs, seats: {}, jt: v.jt || 0 });
    if ((v.jt || 0) < c.jt) { c.jt = v.jt || 0; c.size = v.cs; }
    c.seats[v.st] = { id, ...v };
  }
  return out;
}
// 選最契合、還有空位的包廂；沒有就開新的
function assign(size) {
  const t = now(), all = comps(t);
  let best = null, bs = -1;
  for (const [cp, c] of Object.entries(all)) {
    const occ = Object.values(c.seats);
    if (c.size !== size || occ.length >= size) continue;
    const sc = 3 + occ.reduce((n, p) => n + compat(myProf(), p), 0) / occ.length;
    if (sc > bs) { bs = sc; best = +cp; }
  }
  const cp = best != null ? best : Math.max(0, ...Object.keys(all).map(Number)) + 1;
  const taken = all[cp] ? all[cp].seats : {};
  let seat = 0; while (taken[seat]) seat++;
  Object.assign(S.ride, { cp, cs: size, seat, jt: S.ride.jt || Date.now() });
  save(); Net.push();
  return best != null;
}
// 兩個人同時搶到同一個位子：先上車的留下，後來的換位子
function fixConflicts() {
  if (!S.ride || S.ride.cp == null) return;
  const t = now(), c = comps(t)[S.ride.cp];
  if (!c) return;
  const first = (p) => (p.jt || 0) < S.ride.jt || ((p.jt || 0) === S.ride.jt && p.id < S.id);
  if (c.size !== S.ride.cs && c.jt < S.ride.jt) { assign(S.ride.cs); toast('包廂人數不合，幫你換了一間'); return; }
  const other = c.seats[S.ride.seat];
  if (other && first(other)) {
    let seat = 0; while (c.seats[seat] && seat < S.ride.cs) seat++;
    if (seat < S.ride.cs) { S.ride.seat = seat; save(); Net.push(); }
    else { S.ride.cp = null; assign(S.ride.cs); toast('包廂剛好滿了，幫你換了一間'); }
  }
}
function mates(t) {
  if (!S.ride || S.ride.cp == null) return [];
  return seatedPeers(t).filter(([, v]) => v.cp === S.ride.cp).map(([id, v]) => ({ id, ...v, sleep: Date.now() - (v.t || 0) >= STALE }));
}
const allMates = t => [...mates(t), ...(S.ride && S.ride.npcs || [])];

// ---------- 包廂 NPC 旅客（沒有真人玩家時陪你聊；真人進來就讓位） ----------
const NPC_NAMES = ['小芸', '阿哲', '婷婷', '阿凱', '小蓁', '俊宏', '佳穎', '冠宇', '怡君', '柏翰', '詩涵', '家豪'];
const NPC_ASK = {
  '🍜 美食': d => `你在${d}有想吃什麼嗎？`, '✈️ 旅行': () => '你最喜歡台灣哪裡？', '🎮 遊戲': () => '最近在玩什麼遊戲？',
  '🎵 音樂': () => '坐車都聽什麼歌？', '🎬 電影': () => '最近有看什麼好看的嗎？', '📚 閱讀': () => '你在看什麼書？',
  '⚽ 運動': () => '你平常有在運動嗎？', '📷 攝影': () => '這段風景超適合拍照欸', '🐱 寵物': () => '你有養寵物嗎？',
  '🎨 動漫': () => '最近有在追什麼番嗎？', '💻 科技': () => '你是做什麼的呀？', '🌿 戶外': () => '你喜歡爬山還是去海邊？'
};
const NPC_KW = [
  [/去哪|哪一站|下車|目的地/, n => [`我要去${stName(TR[S.ride.key].stops[n.dest].c)}！你呢？`, `${stName(TR[S.ride.key].stops[n.dest].c)}～去找朋友`]],
  [/嗨|你好|哈囉|安安|hi|hello/i, n => [`嗨嗨！我是${n.n}，要去${stName(TR[S.ride.key].stops[n.dest].c)}～`, `你好呀～我是${n.n}，${n.mb} 一枚`]],
  [/掰|再見|bye/i, () => ['掰掰～', '下次見！']],
  [/吃|美食|便當|餓|好吃|小吃/, () => ['說到吃我就醒了 😋', '車站便當我推排骨的！', '你有私藏的小吃嗎？']],
  [/遊戲|打電動|game|手遊/i, () => ['最近在玩什麼？', '我也超愛打電動！']],
  [/旅行|旅遊|出去玩|景點/, () => ['我最喜歡去花東看海', '旅行最棒的就是坐火車了']],
  [/音樂|歌|耳機/, () => ['你都聽什麼歌？', '坐車聽歌超 chill']],
  [/電影|劇|動畫|番/, () => ['最近有什麼好看的嗎？', '我最近在追一部，超好看']],
  [/mbti|[ei][ns][tf][jp]/i, n => [`我是 ${n.mb}！`, `${n.mb} 的我表示認同`]],
  [/工作|上班|上學|學校|考試|報告/, () => ['辛苦了！坐車剛好放空一下', '加油加油！']],
  [/累|想睡|睏/, () => ['我也是，火車晃晃的好好睡', '可以瞇一下，到站我叫你']],
  [/哈哈|xd|笑死|lol/i, () => ['哈哈哈', 'XD', '笑死']]
];
const pickOne = a => a[(Math.random() * a.length) | 0];
const npcQ = [];   // 排程好的 NPC 發言 {at, id, m}
function npcSay(n, m, delay) { npcQ.push({ at: Date.now() + (delay || 0), id: n.id, m }); }
function npcSpawn(t, max) {
  const tr = TR[S.ride.key], size = S.ride.cs, ns = S.ride.npcs || (S.ride.npcs = []);
  const want = size === 2 ? 1 : 2, pos = trainPos(tr, t), here = pos.kind === 'stop' ? pos.i : Math.max(pos.i, S.ride.from);
  const taken = new Set([S.ride.seat, ...mates(t).map(m => m.st), ...ns.map(n => n.st)]);
  const count = Math.min(max || 9, want - ns.length);
  for (let k = 0; k < count; k++) {
    let seat = 0; while (taken.has(seat) && seat < size) seat++;
    if (seat >= size || here >= tr.stops.length - 1) break;
    taken.add(seat);
    const r = rng(hash(tr.key + S.ride.cp + seat + here + k));
    const n = { id: 'npc' + Math.floor(r() * 1e6), n: pickOne(NPC_NAMES.filter(x => !ns.some(o => o.n === x))), npc: true, st: seat,
      mb: MBTIS[Math.floor(r() * 16)], pc: r() < 0.6 ? 'talk' : 'quiet', tg: [...TAGS].sort(() => r() - 0.5).slice(0, 2),
      c: COLORS[Math.floor(r() * COLORS.length)], h: HAIRS[Math.floor(r() * HAIRS.length)],
      dest: here + 1 + Math.floor(r() * (tr.stops.length - 1 - here)) };
    ns.push(n);
    logChat('', `${n.n} 進到包廂了`);
    const shared = tagArr(S.prof.tg).filter(x => n.tg.includes(x));
    npcSay(n, n.pc === 'talk' ? `嗨！我是${n.n}，要去${stName(tr.stops[n.dest].c)}～你呢？` : '（點頭）你好', 1800 + k * 1500);
    if (shared.length && n.pc === 'talk') npcSay(n, `欸你也喜歡${shared[0].split(' ')[1]}？`, 6000 + k * 1500);
  }
  save();
}
function npcReply(m) {
  const ns = (S.ride && S.ride.npcs) || []; if (!ns.length) return;
  const n = ns.length > 1 && Math.random() < 0.5 ? ns[1] : ns[0];
  let a = null;
  for (const [re, f] of NPC_KW) if (re.test(m)) { a = pickOne(f(n)); break; }
  if (!a && /[?？]|嗎|呢|什麼|哪/.test(m)) a = pickOne(['嗯…我覺得是耶', '好問題！我想想', '應該吧？哈哈', '我也不知道欸，你覺得呢？']);
  if (!a) a = pickOne(n.pc === 'talk' ? ['真的嗎！', '原來如此～', '好酷喔', '然後呢？', '我懂我懂', '哈哈對啊'] : ['嗯嗯', '這樣啊', '（點頭）', '哈哈']);
  npcSay(n, a, 1200 + Math.random() * 1600);
  if (ns.length > 1 && Math.random() < 0.3) npcSay(ns[ns.length - 1 - ns.indexOf(n)], pickOne(['+1', '我也這麼覺得', '哈哈哈']), 3500);
}
let lastTalk = Date.now();
function npcTick(t) {
  if (!S.ride || S.ride.cp == null) return;
  const tr = TR[S.ride.key], ns = S.ride.npcs || (S.ride.npcs = []), real = mates(t).filter(m => !m.sleep);   // 睡著的玩家不會聊天，NPC 照樣陪
  // 真人玩家進來：NPC 全部讓位（NPC 只存在自己的畫面，留著會讓兩邊看到的包廂不一樣）
  for (const n of [...ns]) {
    if (real.length) {
      ns.splice(ns.indexOf(n), 1); logChat('', `${n.n} 去餐車了，把位子讓出來`); save();
    }
  }
  // NPC 到站下車
  for (const n of [...ns]) {
    const a = tr.stops[n.dest].a;
    if (!n.bye && t >= a - 45 && n.dest !== S.ride.dest) { n.bye = 1; npcSay(n, `我要在${stName(tr.stops[n.dest].c)}下車了，掰掰～很高興認識你！`); }
    if (t >= a && n.dest !== S.ride.dest) { ns.splice(ns.indexOf(n), 1); logChat('', `${n.n} 在 ${stName(tr.stops[n.dest].c)} 下車了`); save(); }
  }
  if (!real.length) {
    if (S.ride.npcAt && Date.now() >= S.ride.npcAt) { S.ride.npcAt = 0; npcSpawn(t); }
    // 停靠站時，空位有機會上來新的 NPC
    const pos = trainPos(tr, t);
    if (!S.ride.npcAt && pos.kind === 'stop' && pos.i > S.ride.from && S.ride.lastStop !== pos.i) {
      S.ride.lastStop = pos.i; if (ns.length < (S.ride.cs === 2 ? 1 : 2) && Math.random() < 0.7) npcSpawn(t, 1);
    }
  }
  // 自己快下車：NPC 說再見
  const left = tr.stops[S.ride.dest].a - t;
  if (left <= BYE && !S.ride.npcBye) { S.ride.npcBye = 1; for (const n of ns) npcSay(n, pickOne(['你要下車啦？掰掰～', '很開心跟你聊天！路上小心', '下次再一起坐車！']), 800 + Math.random() * 1500); }
  // 太久沒人說話：話多的 NPC 找話題
  if (Date.now() - lastTalk > 30000 && ns.length) {
    lastTalk = Date.now();
    const n = ns.find(x => x.pc === 'talk') || (Math.random() < 0.3 ? ns[0] : null);
    if (n) { const tag = pickOne([...n.tg, ...tagArr(S.prof.tg)]); npcSay(n, (NPC_ASK[tag] || (() => '你常坐火車嗎？'))(stName(tr.stops[S.ride.dest].c))); }
  }
  // 發送排程好的發言
  for (let i = npcQ.length - 1; i >= 0; i--) {
    const q = npcQ[i]; if (Date.now() < q.at) continue;
    npcQ.splice(i, 1);
    const n = ns.find(x => x.id === q.id); if (!n) continue;
    n.m = q.m; n.mt = Date.now(); lastTalk = Date.now(); logChat(n.n, q.m);
  }
}

// ---------- 聊天（只有包廂裡能聊） ----------
let myMsg = { m: '', mt: 0 };
const chat = [];
function logChat(n, m) { chat.push({ n, m }); if (chat.length > 40) chat.shift(); renderLog(); }
function renderLog() {
  const el = $('chatLog'); if (!el) return;
  el.innerHTML = chat.length ? chat.map(c => c.n ? `<div><b>${esc(c.n)}</b>：${esc(c.m)}</div>` : `<div class="sys">（${esc(c.m)}）</div>`).join('') : '<div style="color:#888">還沒有人說話。</div>';
  el.scrollTop = el.scrollHeight;
}
$('chatBar').addEventListener('submit', e => {
  e.preventDefault();
  if (!S.ride || S.ride.cp == null) return;
  const m = $('chatIn').value.trim().slice(0, 40);
  if (!m) return;
  $('chatIn').value = '';
  myMsg = { m, mt: Date.now() }; lastTalk = Date.now();
  logChat(S.name || '我', m);
  Net.push();
  if (!mates(now()).some(x => !x.sleep)) npcReply(m);
});
$('btnLog').onclick = () => { const el = $('chatLog'); el.hidden = !el.hidden; renderLog(); };

// ---------- 大廳路人（不說話，只是讓車站不冷清） ----------
function npcs(room, t) {
  const r = rng(hash(room + '|' + Math.floor(t / 900)));
  const h = hourOf(t), rush = (h > 7 && h < 9.5) || (h > 17 && h < 19.5);
  const n = h < 5.5 ? 0 : 2 + Math.floor(r() * (rush ? 6 : 3));
  const out = [];
  for (let k = 0; k < n; k++) out.push({ id: 'n' + k, npc: true, x: 14 + r() * (YW - 40), y: 22 + r() * Math.max(10, YH - 36),
    c: ['#6b7280', '#7c6f64', '#4b5563', '#8b7d6b', '#5f6b7a'][Math.floor(r() * 5)], h: HAIRS[Math.floor(r() * HAIRS.length)] });
  return out;
}

// ---------- 畫布 ----------
const scene = $('scene'), yard = document.querySelector('#yardWrap canvas');
const sg = scene.getContext('2d'), yg = yard.getContext('2d');
const SW = 160; let SH = 60, YW = 160, YH = 80;
function resize() {
  SH = Math.max(40, Math.round(SW * scene.clientHeight / Math.max(1, scene.clientWidth)));
  YH = Math.max(50, Math.round(YW * yard.clientHeight / Math.max(1, yard.clientWidth)));
  scene.width = SW; scene.height = SH; yard.width = YW; yard.height = YH;
  sg.imageSmoothingEnabled = yg.imageSmoothingEnabled = false;
}
addEventListener('resize', resize);

function sky(g, W, H, h) {
  let c = h < 5 || h >= 19.5 ? ['#0b1430', '#22305e'] : h < 6.5 ? ['#f6a868', '#7fb2e8'] : h < 17 ? ['#5fa9ee', '#cfe8ff'] : ['#f08a5d', '#5b5f9e'];
  if (h >= 17 && h < 19.5) c = ['#5b5f9e', '#f6a06a'];
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const night = h < 5 || h >= 19.5;
  g.fillStyle = night ? '#f3f0d0' : '#fff6c4';
  const sx = night ? W * 0.8 : W * clamp((h - 6) / 12, 0, 1), sy = night ? 8 : 6 + Math.abs(12 - h) * 1.6;
  g.fillRect(Math.round(sx) - 3, Math.round(sy) - 3, 6, 6);
  if (night) { g.fillStyle = '#fff'; const r = rng(7); for (let i = 0; i < 18; i++) g.fillRect((r() * W) | 0, (r() * H * 0.45) | 0, 1, 1); }
}

function drawTrain(g, x, y, cls, open) {
  const c = clsOf(cls), CAR = 46, n = 4;
  for (let k = 0; k < n; k++) {
    const cx = Math.round(x + k * (CAR + 2));
    g.fillStyle = '#2a2a2a'; g.fillRect(cx + 6, y + 27, 6, 3); g.fillRect(cx + CAR - 12, y + 27, 6, 3);   // 轉向架
    g.fillStyle = c.b; g.fillRect(cx, y + 2, CAR, 25);
    if (k === 0) { g.fillStyle = c.b; g.fillRect(cx - 4, y + 8, 4, 19); g.fillStyle = '#1d2733'; g.fillRect(cx - 4, y + 9, 6, 6); }
    g.fillStyle = c.s; g.fillRect(k === 0 ? cx - 4 : cx, y + 18, CAR + (k === 0 ? 4 : 0), 3);
    g.fillStyle = '#9aa3ad'; g.fillRect(cx, y + 2, CAR, 1);
    if (cls !== '莒光' && cls !== '普快' && k % 2 === 1) { g.fillStyle = '#333'; g.fillRect(cx + 18, y - 2, 10, 1); g.fillRect(cx + 22, y - 1, 2, 3); }
    for (let w = 0; w < 5; w++) { g.fillStyle = '#2b3a4a'; g.fillRect(cx + 4 + w * 8, y + 8, 6, 6); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(cx + 4 + w * 8, y + 8, 2, 2); }
    for (const dx of [2, CAR - 8]) {
      g.fillStyle = open ? '#1a1a1a' : '#c9ccd0'; g.fillRect(cx + dx, y + 7, 6, 18);
      if (!open) { g.fillStyle = '#2b3a4a'; g.fillRect(cx + dx + 1, y + 9, 4, 5); }
    }
  }
}

function drawHallScene(t) {
  const g = sg, W = SW, H = SH, h = hourOf(t);
  sky(g, W, H, h);
  g.fillStyle = '#cfc8b8'; g.fillRect(0, 0, W, H);
  for (let x = 6; x < W; x += 30) { g.fillStyle = '#5a6b7f'; g.fillRect(x, 6, 22, H * 0.55); }   // 高窗
  const gr = g.createLinearGradient(0, 0, 0, H * 0.6), night = h < 5 || h >= 19.5;
  gr.addColorStop(0, night ? '#0b1430' : '#7fb2e8'); gr.addColorStop(1, night ? '#22305e' : '#cfe8ff');
  g.fillStyle = gr; for (let x = 6; x < W; x += 30) g.fillRect(x + 2, 8, 18, H * 0.55 - 4);
  g.fillStyle = '#9b927f'; g.fillRect(0, H * 0.62, W, H); g.fillStyle = '#b5ad9a'; g.fillRect(0, H * 0.62, W, 2);
  g.fillStyle = '#7a7262'; g.fillRect(0, 0, W, 4);
}
function drawStationScene(t) {
  if (S.area === 'hall') return drawHallScene(t);
  const g = sg, W = SW, H = SH, h = hourOf(t);
  sky(g, W, H, h);
  const r = rng(hash('sky' + S.station)), city = r() < 0.6;
  g.fillStyle = h < 5 || h >= 19.5 ? '#141c33' : '#7f94ad';
  for (let x = 0; x < W;) {
    const w = 6 + (r() * 12) | 0, hh = city ? 8 + r() * 22 : 0;
    if (city) g.fillRect(x, H - 10 - 26 - hh * 0.6, w, hh * 0.6 + 26); x += w + 1;
  }
  if (!city) { for (let x = 0; x < W; x++) { const y = H * 0.42 + 8 * Math.sin(x * 0.05 + r() * 0.02 + hash(S.station) % 9) + 4 * Math.sin(x * 0.13); g.fillRect(x, y, 1, H); } }
  g.fillStyle = '#3d3a36'; g.fillRect(0, 0, W, 5); for (let x = 12; x < W; x += 40) g.fillRect(x, 0, 3, H - 9);   // 雨棚
  g.fillStyle = '#6d6259'; g.fillRect(0, H - 9, W, 6); g.fillStyle = '#4a3f37'; for (let x = 0; x < W; x += 5) g.fillRect(x, H - 7, 3, 2);
  g.fillStyle = '#b8bcc2'; g.fillRect(0, H - 9, W, 1);
  g.fillStyle = '#e8e4da'; g.fillRect(0, H - 3, W, 3);

  // 要畫哪一班：我的車票那班優先，不然最近要開的
  const deps = departures(S.station, t);
  let show = null;
  for (const d of deps) {
    const [o, e] = boardWin(d.tr, d.i);
    if (t >= o - 25 && t <= e + 25) { if (!show || (S.sel && d.tr.key === S.sel.key)) show = { ...d, o, e }; }
  }
  sceneTrain = show;
  if (show) {
    const stopX = 10, y = H - 9 - 30;
    let x = stopX;
    if (t < show.o) { const f = (show.o - t) / 25; x = stopX + f * f * (W + 20); }
    else if (t > show.e) { const f = (t - show.e) / 25; x = stopX - f * f * (W + 200); }
    drawTrain(g, x, y, show.tr.cls, t >= show.o && t <= show.e - 3);
  }
}
let sceneTrain = null;

function terrain(tr, i) { return ['field', 'city', 'sea', 'mountain', 'field', 'mountain'][hash(tr.no + '-' + i) % 6]; }
function drawRideScene(t, tr, pos) {
  const g = sg, W = SW, H = SH, h = hourOf(t);
  sky(g, W, H, h);
  const moving = pos.kind === 'move';
  const ter = moving ? terrain(tr, pos.i) : 'station';
  const dist = moving ? (t - tr.stops[pos.i].d) * 26 : 0;
  const night = h < 5 || h >= 19.5;
  const tunnel = ter === 'mountain' && pos.f > 0.35 && pos.f < 0.55;
  if (tunnel) {
    g.fillStyle = '#111'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffd36a'; for (let k = 0; k < 8; k++) g.fillRect(((k * 34 - dist * 1.2) % (W + 40) + W + 40) % (W + 40) - 20, H * 0.4, 6, 2);
  } else {
    g.fillStyle = night ? '#1c2440' : '#7d9bb8';
    for (let x = 0; x < W; x++) g.fillRect(x, H * 0.42 - 6 * (Math.sin((x + dist * 0.06) * 0.035) + 0.6 * Math.sin((x + dist * 0.06) * 0.09 + 2)), 1, H);
    const ground = night ? '#25331f' : '#6cae4a';
    if (ter === 'sea') {
      g.fillStyle = night ? '#132a4a' : '#2f7fc4'; g.fillRect(0, H * 0.52, W, H);
      g.fillStyle = 'rgba(255,255,255,.6)'; for (let k = 0; k < 14; k++) g.fillRect(((k * 23 - dist * 0.2) % W + W) % W, H * 0.56 + (k % 4) * 5, 5, 1);
      g.fillStyle = night ? '#3a3326' : '#e6d6a8'; g.fillRect(0, H * 0.8, W, H);
    } else if (ter === 'city') {
      g.fillStyle = ground; g.fillRect(0, H * 0.7, W, H);
      const off = dist * 0.45, b0 = Math.floor(off / 13);
      for (let b = b0; b < b0 + 15; b++) {
        const rr = rng(hash('b' + b)), hh = 10 + rr() * 26, x = b * 13 - off;
        g.fillStyle = night ? '#2a2f45' : ['#c9c2b5', '#a9b4c0', '#d7cfc0', '#9fa7a0'][Math.floor(rr() * 4)];
        g.fillRect(Math.round(x), H * 0.72 - hh, 11, hh);
        g.fillStyle = night ? '#ffd36a' : '#5b6d80';
        for (let wy = 0; wy < hh - 4; wy += 5) for (let wx = 2; wx < 10; wx += 4) if (rr() < 0.6) g.fillRect(Math.round(x) + wx, H * 0.72 - hh + 2 + wy, 2, 2);
      }
    } else if (ter === 'mountain') {
      g.fillStyle = night ? '#1b2a1b' : '#3f7d3a';
      for (let x = 0; x < W; x++) g.fillRect(x, H * 0.5 - 14 * Math.abs(Math.sin((x + dist * 0.3) * 0.025)), 1, H);
      g.fillStyle = ground; g.fillRect(0, H * 0.78, W, H);
    } else if (ter === 'field') {
      g.fillStyle = ground; g.fillRect(0, H * 0.58, W, H);
      g.fillStyle = night ? '#1d2a18' : '#4f9437';
      for (let row = 0; row < 6; row++) { const yy = H * 0.6 + row * 4, sp = 0.4 + row * 0.15; for (let k = 0; k < 20; k++) g.fillRect(((k * 9 - dist * sp) % W + W) % W, yy, 4, 1); }
    } else {
      g.fillStyle = '#8f949b'; g.fillRect(0, H * 0.62, W, H); g.fillStyle = '#f2c200'; g.fillRect(0, H * 0.62, W, 2);
      g.fillStyle = '#fff'; g.fillRect(W / 2 - 26, H * 0.3, 52, 12); g.fillStyle = '#1f4f9a'; g.fillRect(W / 2 - 26, H * 0.3 + 10, 52, 2);
    }
    if (moving) { g.fillStyle = '#3a3a3a'; for (let k = 0; k < 4; k++) { const x = ((k * 60 - dist * 1.6) % (W + 60) + W + 60) % (W + 60) - 30; g.fillRect(x, H * 0.18, 2, H); } g.fillRect(0, H * 0.22, W, 1); }
  }
  g.fillStyle = '#d6d0c2'; g.fillRect(0, 0, W, 9); g.fillRect(0, H - 14, W, 14); g.fillRect(0, 0, 5, H); g.fillRect(W - 5, 0, 5, H); g.fillRect(W / 2 - 5, 0, 10, H);
  g.fillStyle = '#b6ae9c'; g.fillRect(0, 9, W, 1); g.fillRect(0, H - 14, W, 1);
  g.fillStyle = '#8c8270'; g.fillRect(0, H - 9, W, 3);
}

// ---------- 人物 ----------
const rpos = {};   // id → 畫面上的位置（平滑移動）
function drawPerson(g, p, x, y, sitting, bob) {
  x = Math.round(x); y = Math.round(y);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x - 4, y - 1, 8, 2);
  if (!sitting) { g.fillStyle = '#2c3446'; g.fillRect(x - 3, y - 4, 2, 4); g.fillRect(x + 1, y - 4, 2, 4); }
  const by = y - (sitting ? 7 : 10) - (bob ? 1 : 0);
  g.fillStyle = p.c || '#888'; g.fillRect(x - 4, by, 8, 6);
  g.fillStyle = '#f2c9a0'; g.fillRect(x - 3, by - 6, 6, 6);
  g.fillStyle = p.h || '#222'; g.fillRect(x - 3, by - 7, 6, 2); g.fillRect(x - 4, by - 6, 1, 3); g.fillRect(x + 3, by - 6, 1, 3);
  if (p.sleep) { g.fillStyle = '#222'; g.fillRect(x - 2, by - 3, 2, 1); g.fillRect(x + 1, by - 3, 2, 1); }
  else { g.fillStyle = '#222'; g.fillRect(x - 2, by - 3, 1, 1); g.fillRect(x + 1, by - 3, 1, 1); }
}
// 包廂座位（照草圖：四個角，中間一張桌子；2 人包廂＝上下面對面）
function seatPos(size, i) {
  const top = 30, bot = YH - 8;
  const P = size === 2 ? [[80, top], [80, bot]] : [[42, top], [118, top], [42, bot], [118, bot]];
  const p = P[i] || P[0]; return { x: p[0], y: p[1], top: p[1] === top };
}

function people(t) {
  if (S.ride) {
    if (S.ride.cp == null) return [];
    const list = allMates(t).map(v => ({ id: v.id, n: v.n, c: v.c, h: v.h, s: v.st, m: v.m, mt: v.mt, mb: v.mb, player: true, sleep: v.sleep, isNpc: v.npc }));
    list.push({ id: S.id, n: S.name || '我', c: S.color, h: S.hair, s: S.ride.seat, m: myMsg.m, mt: myMsg.mt, mb: S.prof.mb, player: true, me: true });
    return list;
  }
  const list = npcs(roomName(), t);
  for (const [id, v] of Object.entries(Net.peers)) if (Date.now() - (v.t || 0) < STALE) list.push({ id, n: v.n, c: v.c, h: v.h, x: v.x, y: v.y, player: true });
  list.push({ id: S.id, n: S.name || '我', c: S.color, h: S.hair, x: S.x, y: S.y, player: true, me: true });
  return list;
}

// 大廳物件位置（邏輯座標）：閘門在上面、蓋章台左下、便利商店右下
const HALL = { get stamp() { return [6, YH - 26, 30, 20]; }, get shop() { return [YW - 44, YH - 30, 40, 26]; } };
function drawHall(g, W, H) {
  g.fillStyle = '#e9e4d8'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#ded8ca'; for (let x = 0; x < W; x += 16) for (let y = 14; y < H; y += 16) if (((x + y) / 16) % 2) g.fillRect(x, y, 16, 16);   // 拋光地磚
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 14, W, 2);
  // 驗票閘門（往月台）
  g.fillStyle = '#5b6b82'; g.fillRect(0, 0, W, 12);
  for (let x = 10; x < W - 6; x += 18) { g.fillStyle = '#c9d2de'; g.fillRect(x, 3, 10, 9); g.fillStyle = '#2f6fed'; g.fillRect(x + 3, 5, 4, 2); g.fillStyle = '#3ad16b'; g.fillRect(x + 4, 9, 2, 2); }
  // 長椅
  for (const bx of [44, 94]) { g.fillStyle = '#8a5a32'; g.fillRect(bx, H * 0.5, 24, 5); g.fillStyle = '#5c3b20'; g.fillRect(bx + 2, H * 0.5 + 5, 2, 3); g.fillRect(bx + 20, H * 0.5 + 5, 2, 3); }
  // 蓋章台
  const [sx, sy, sw, sh] = HALL.stamp;
  g.fillStyle = '#7a4b2a'; g.fillRect(sx, sy, sw, sh); g.fillStyle = '#a8703f'; g.fillRect(sx, sy, sw, 4);
  g.fillStyle = '#d23a2e'; g.fillRect(sx + 6, sy + 7, 6, 6); g.fillStyle = '#2a5caa'; g.fillRect(sx + 16, sy + 8, 8, 5);
  // 便利商店
  const [cx, cy, cw, ch] = HALL.shop;
  g.fillStyle = '#f4f4f0'; g.fillRect(cx, cy, cw, ch); g.fillStyle = '#2e9e5b'; g.fillRect(cx, cy, cw, 4); g.fillStyle = '#f08a20'; g.fillRect(cx, cy + 4, cw, 2);
  g.fillStyle = '#9cc8ea'; g.fillRect(cx + 3, cy + 9, cw - 6, 10); g.fillStyle = '#e8453c'; g.fillRect(cx + 6, cy + 12, 4, 6); g.fillStyle = '#f1c40f'; g.fillRect(cx + 13, cy + 13, 4, 5);
  // 盆栽
  g.fillStyle = '#5e7d5e'; g.fillRect(W - 10, 20, 7, 8); g.fillStyle = '#8a5a32'; g.fillRect(W - 9, 28, 5, 4);
}
function drawYard(t, list) {
  const g = yg, W = YW, H = YH;
  if (!S.ride && S.area === 'hall') drawHall(g, W, H);
  else if (!S.ride) {
    g.fillStyle = '#c9c4b8'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#bdb7aa'; for (let x = 0; x < W; x += 12) g.fillRect(x, 10, 1, H); for (let y = 10; y < H; y += 12) g.fillRect(0, y, W, 1);
    g.fillStyle = '#e8e4da'; g.fillRect(0, 0, W, 3);
    g.fillStyle = '#f2c200'; g.fillRect(0, 4, W, 4); g.fillStyle = '#d9ad00'; for (let x = 1; x < W; x += 3) g.fillRect(x, 5, 1, 1), g.fillRect(x + 1, 7, 1, 1);
    for (const bx of [24, 104]) { g.fillStyle = '#8a5a32'; g.fillRect(bx, H * 0.62, 26, 4); g.fillStyle = '#5c3b20'; g.fillRect(bx + 2, H * 0.62 + 4, 2, 3); g.fillRect(bx + 22, H * 0.62 + 4, 2, 3); }
    g.fillStyle = '#d23a2e'; g.fillRect(W - 14, H - 30, 11, 20); g.fillStyle = '#8fd3ff'; g.fillRect(W - 12, H - 27, 7, 6); g.fillStyle = '#fff'; g.fillRect(W - 12, H - 19, 7, 2);
    g.fillStyle = '#5e7d5e'; g.fillRect(4, H - 18, 7, 8); g.fillStyle = '#3f5a3f'; g.fillRect(4, H - 18, 7, 1);
  } else {
    const tr = TR[S.ride.key], c = clsOf(tr ? tr.cls : ''), size = S.ride.cs || 4;
    g.fillStyle = '#7a5a3c'; g.fillRect(0, 0, W, H);                                   // 木頭牆
    g.fillStyle = '#b98a5e'; g.fillRect(6, 6, W - 12, H - 12);                          // 地毯
    g.fillStyle = '#a77a50'; for (let y = 10; y < H - 6; y += 6) g.fillRect(6, y, W - 12, 1);
    g.fillStyle = '#9cc8ea'; g.fillRect(14, 1, W - 28, 4);                              // 上方窗戶
    g.fillStyle = '#5a4128'; g.fillRect(W - 6, H / 2 - 12, 6, 24); g.fillStyle = '#c9a36e'; g.fillRect(W - 5, H / 2 - 2, 2, 4);   // 拉門
    const ty = H / 2 - 7, tw = size === 2 ? 34 : 108;                                   // 桌子
    g.fillStyle = '#5c3b20'; g.fillRect(W / 2 - tw / 2 + 1, ty + 2, tw, 14);
    g.fillStyle = '#e9e1cf'; g.fillRect(W / 2 - tw / 2, ty, tw, 13); g.fillStyle = '#d6ccb4'; g.fillRect(W / 2 - tw / 2, ty + 11, tw, 2);
    g.fillStyle = '#fff'; g.fillRect(W / 2 - 3, ty + 4, 5, 4); g.fillStyle = '#8a5a32'; g.fillRect(W / 2 - 2, ty + 5, 3, 2);     // 一杯茶
    const occupied = new Set(list.map(p => p.s));
    for (let i = 0; i < size; i++) {
      const q = seatPos(size, i);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(q.x - 12, q.y - 22, 26, 26);
      g.fillStyle = c.k; g.fillRect(q.x - 13, q.y - 23, 26, 26);
      g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(q.x - 13, q.top ? q.y - 23 : q.y - 1, 26, 4);       // 椅背（靠牆那側）
      if (!occupied.has(i)) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(q.x - 9, q.y - 14, 18, 8); }
    }
  }
  // 人物（由上往下畫）
  const size = S.ride ? (S.ride.cs || 4) : 0;
  const ordered = list.map(p => {
    let tx = p.x, ty = p.y, sit = false;
    if (S.ride) { const q = seatPos(size, clamp(p.s | 0, 0, size - 1)); tx = q.x; ty = q.y - 4; sit = true; }
    else { tx = clamp(tx, 6, W - 6); ty = clamp(ty, S.area === 'hall' ? 22 : 18, H - 2); }
    const r = rpos[p.id] || (rpos[p.id] = { x: tx, y: ty });
    const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy), step = 1.2;
    if (d > 60 || S.ride) { r.x = tx; r.y = ty; } else if (d > step) { r.x += dx / d * step; r.y += dy / d * step; } else { r.x = tx; r.y = ty; }
    return { p, x: r.x, y: r.y, sit, walk: !S.ride && d > step };
  }).sort((a, b) => a.y - b.y);
  for (const o of ordered) drawPerson(g, o.p, o.x, o.y, o.sit, o.walk && (Date.now() / 150 | 0) % 2);
  return ordered;
}

function drawBubbles(ordered) {
  const k = yard.clientWidth / YW, html = [];
  if (!S.ride && S.area === 'hall') {   // 大廳物件名字
    const lab = (x, y, t) => html.push(`<div class="hallLab" style="left:${x * k}px;top:${y * k}px">${t}</div>`);
    lab(YW / 2, 12.5, '▲ 驗票閘門・往月台');
    lab(HALL.stamp[0] + HALL.stamp[2] / 2, HALL.stamp[1] - 6, '📮 蓋章台');
    lab(HALL.shop[0] + HALL.shop[2] / 2, HALL.shop[1] - 6, '🏪 便利商店');
  }
  if (S.ride && S.ride.cp != null) {   // 空位提示
    const size = S.ride.cs || 4, occ = new Set(ordered.map(o => o.p.s));
    for (let i = 0; i < size; i++) if (!occ.has(i)) { const q = seatPos(size, i); html.push(`<div class="seat-empty" style="left:${q.x * k}px;top:${(q.y - 13) * k}px">空位<br><small>等旅伴</small></div>`); }
  }
  for (const o of ordered) {
    const p = o.p, x = o.x * k;
    const top = S.ride ? seatPos(S.ride.cs || 4, p.s | 0).top : false;
    if (p.player) {
      const tag = p.me ? `▲ ${esc(p.n || '我')}` : esc(p.n || '旅人') + (p.isNpc ? ' <span class="npcTag">NPC</span>' : '');
      const mb = S.ride && p.mb ? ` <span class="mbti">${esc(p.mb)}</span>` : '';
      html.push(`<div class="av-name" style="left:${x}px;top:${(o.y + (S.ride ? 4 : 1)) * k}px;color:${p.me ? '#ffe36a' : p.sleep ? '#ccc' : '#fff'}">${tag}${mb}</div>`);
    }
    if (!S.ride) continue;                 // 大廳不能聊天：不顯示對話框
    const by = (o.y - 16) * k;
    if (p.sleep) { html.push(`<div class="bubble npc${top ? ' down' : ''}" style="left:${x}px;top:${top ? (o.y + 14) * k : by}px">💤</div>`); continue; }
    if (p.m && p.mt && Date.now() - p.mt < 9000)
      html.push(`<div class="bubble${top ? ' down' : ''}" style="left:${clamp(x, 50, yard.clientWidth - 50)}px;top:${top ? (o.y + 14) * k : by}px">${esc(p.m)}</div>`);
  }
  const s = html.join('');
  if (s !== drawBubbles.last) { $('bubbles').innerHTML = s; drawBubbles.last = s; }
}

// 大廳：點地板走過去；包廂：點空位換位子
yard.addEventListener('pointerdown', e => {
  const rect = yard.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width * YW, y = (e.clientY - rect.top) / rect.height * YH;
  if (!S.ride) {
    if (S.area === 'hall') {   // 大廳裡可以點的東西
      if (y < 14) { goPlatform(); return; }
      if (x > HALL.stamp[0] && x < HALL.stamp[0] + HALL.stamp[2] && y > HALL.stamp[1] && y < HALL.stamp[1] + HALL.stamp[3]) { openBook(); return; }
      if (x > HALL.shop[0] && x < HALL.shop[0] + HALL.shop[2] && y > HALL.shop[1] && y < HALL.shop[1] + HALL.shop[3]) { toast('🏪 便利商店：之後可以買便當、飲料帶上車'); return; }
    }
    S.x = clamp(x, 6, YW - 6); S.y = clamp(y + 4, S.area === 'hall' ? 22 : 18, YH - 2);
  }
  else {
    if (S.ride.cp == null) return;
    const size = S.ride.cs || 4;
    let best = -1, bd = 22;
    for (let i = 0; i < size; i++) { const q = seatPos(size, i), d = Math.hypot(q.x - x, q.y - 10 - y); if (d < bd) { bd = d; best = i; } }
    if (best < 0 || best === S.ride.seat) return;
    if (allMates(now()).some(p => p.st === best)) { toast('這個位子有人坐了'); return; }
    S.ride.seat = best;
  }
  save(); Net.push();
});

// ---------- 車票／上車／到站 ----------
function selInfo(t) {
  if (!S.sel) return null;
  const tr = TR[S.sel.key]; if (!tr) return null;
  const i = tr.stops.findIndex(s => s.c === S.station);
  if (i < 0 || S.sel.dest <= i || S.sel.dest >= tr.stops.length) return null;
  const [o, e] = boardWin(tr, i);
  return { tr, i, o, e, open: t >= o && t <= e };
}
function board() {
  const t = now(), si = selInfo(t);
  if (!si || !si.open) return;
  S.ride = { key: si.tr.key, from: si.i, dest: S.sel.dest, fromC: si.tr.stops[si.i].c, destC: si.tr.stops[S.sel.dest].c, cp: null, cs: 0, seat: 0, jt: Date.now() };
  S.sel = null; save();
  myMsg = { m: '', mt: 0 };
  Net.join(roomName());
  dirty = true; listSig = '';
  setTimeout(chooseCompartment, 400);   // 等一下讓同車的人資料進來，再選包廂
}
function chooseCompartment() {
  if (!S.ride || S.ride.cp != null) return;
  const tr = TR[S.ride.key];
  openModal(`<h2>🚆 上車了！選包廂</h2>
    <p class="note" style="margin-top:0">${tr ? `${tr.no} 次 往${esc(destName(tr))}，你在 <b>${esc(stName(tr.stops[S.ride.dest].c))}</b> 下車。` : ''}系統會依你的個性，安排到最合得來的旅伴旁邊。</p>
    <div class="pick2"><button class="pickBox" data-size="2"><div class="pkI">👤👤</div><b>2 人包廂</b><small>一對一，慢慢聊</small></button>
    <button class="pickBox" data-size="4"><div class="pkI">👤👤<br>👤👤</div><b>4 人包廂</b><small>熱鬧，話題多</small></button></div>`, true);
  $('modalBox').querySelectorAll('[data-size]').forEach(b => b.onclick = () => {
    const size = +b.dataset.size, found = assign(size);
    closeModal(true); listSig = '';
    const n = mates(now()).length;
    if (!n) S.ride.npcAt = Date.now() + 1500;
    toast(found && n ? `幫你排到 ${n} 位旅伴的包廂，打聲招呼吧！` : `目前沒有其他玩家，先安排旅客陪你聊；有玩家上車會排進來`, 3500);
  });
}
$('btnBoard').onclick = board;
// 大廳 → 月台：要有車票，車進站前 10 分鐘才開放
const PLATFORM_EARLY = 600;
function canPlatform(t) { const si = selInfo(t); return si && t >= si.o - PLATFORM_EARLY ? si : null; }
function goPlatform() {
  const t = now(), si = selInfo(t);
  if (!si) { toast('要先買票才能過閘門進月台'); return; }
  if (t < si.o - PLATFORM_EARLY) { toast(`車進站前 10 分鐘才能進月台（還要 ${dur(si.o - PLATFORM_EARLY - t)}）`); return; }
  S.area = 'platform'; S.x = 30 + Math.random() * 100; S.y = 40; save(); Net.join(roomName()); listSig = '';
  toast('🎫 過閘門，來到月台了');
}
function goHall() { S.area = 'hall'; S.x = 80; S.y = 30; save(); Net.join(roomName()); listSig = ''; }
$('btnPlatform').onclick = goPlatform;
$('btnHall').onclick = goHall;
scene.addEventListener('click', () => { if (!S.ride && selInfo(now())?.open) board(); });

function arrive(i) {
  const tr = TR[S.ride.key], code = tr.stops[i].c, t = now();
  const st = S.stamps[code] || { d: dateStr(t), n: 0 }; st.n++; S.stamps[code] = st;
  const met = allMates(t).map(m => m.n);
  S.station = code; S.ride = null; S.area = 'hall'; npcQ.length = 0; openRow = null; S.x = 30 + Math.random() * 100; S.y = 50;
  myMsg = { m: '', mt: 0 }; $('chatLog').hidden = true;
  save(); Net.join(roomName()); dirty = true; listSig = '';
  openModal(`<h2>🚪 到站了！列車長請你下車</h2>
    <p style="margin:0 0 4px;font-size:14px">${esc(stName(code))} 站到了，包廂的聊天到這裡結束。${met.length ? `<br>這趟遇到：<b>${met.map(esc).join('、')}</b>` : ''}</p>
    ${stampSVG(code, st.d, 'bigstamp')}
    <p style="text-align:center;margin:8px 0 0">${st.n > 1 ? `第 ${st.n} 次來這站` : '蓋到新印章了！'}　印章簿 ${Object.keys(S.stamps).length} 站</p>
    <div class="btns"><button class="btn ghost" onclick="closeModal()">好</button><button class="btn" onclick="openBook()">看印章簿</button></div>`);
}

// ---------- 印章 ----------
const ICONS = [
  '<path d="M-15 9 L-5 -7 L1 2 L6 -4 L15 9 Z"/>',
  '<path d="M-15 0 q4 -6 8 0 t8 0 t8 0 t8 0 M-15 8 q4 -6 8 0 t8 0 t8 0 t8 0"/>',
  '<rect x="-9" y="-11" width="18" height="18" rx="4"/><rect x="-6" y="-8" width="12" height="6"/><circle cx="-5" cy="3" r="1.6"/><circle cx="5" cy="3" r="1.6"/><path d="M-7 7 L-10 12 M7 7 L10 12"/>',
  '<path d="M0 -12 L-8 1 H8 Z M0 -5 L-11 8 H11 Z M0 8 V12"/>',
  '<circle r="5.5"/><path d="M0 -13V-9 M0 9V13 M-13 0H-9 M9 0H13 M-9 -9L-6.5 -6.5 M9 9L6.5 6.5 M-9 9L-6.5 6.5 M9 -9L6.5 -6.5"/>',
  '<path d="M-15 8 H15 M-15 8 Q0 -14 15 8 M-8 8 V-1 M0 8 V-3 M8 8 V-1"/>',
  '<circle cx="0" cy="-5" r="4"/><circle cx="-6" cy="1" r="4"/><circle cx="6" cy="1" r="4"/><path d="M0 4 V13"/>'
];
function stampSVG(code, d, cls) {
  const nm = stName(code), en = stEn(code).toUpperCase(), h = hash('s' + code);
  const ink = ['#d23a2e', '#2a5caa', '#7b3fa0', '#1f8a5b', '#c4571b'][h % 5], rot = (h >> 3) % 17 - 8;
  const fs = nm.length <= 2 ? 28 : nm.length === 3 ? 22 : 16;
  return `<svg class="${cls || ''}" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="ink${code}"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="${h % 50}"/><feDisplacementMap in="SourceGraphic" scale="2.4"/></filter></defs>
    <g transform="rotate(${rot} 60 60)" filter="url(#ink${code})" opacity=".9">
      <g fill="none" stroke="${ink}"><circle cx="60" cy="60" r="54" stroke-width="4"/><circle cx="60" cy="60" r="47" stroke-width="1.5"/>
      <g transform="translate(60 30)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICONS[(h >> 6) % ICONS.length]}</g></g>
      <g fill="${ink}" text-anchor="middle" font-family="sans-serif"><text x="60" y="${66 + fs / 3}" font-size="${fs}" font-weight="900">${esc(nm)}</text>
      <text x="60" y="88" font-size="7.5" font-weight="700" letter-spacing="1">${esc(en)}</text>
      <text x="60" y="100" font-size="8" font-weight="700">${esc(d)}</text></g>
    </g></svg>`;
}

// ---------- 介面 ----------
let modalLock = false;
function toast(s, ms) { const el = $('toast'); el.textContent = s; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, ms || 2600); }
function openModal(html, lock) { modalLock = !!lock; $('modalBox').classList.remove('mapModal'); $('modalBox').innerHTML = html; $('modal').hidden = false; }
function closeModal(force) { if (modalLock && force !== true) return; modalLock = false; $('modal').hidden = true; $('modalBox').classList.remove('mapModal'); MV.el = null; }
$('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

function openBook() {
  const ent = Object.entries(S.stamps).sort((a, b) => a[1].d < b[1].d ? -1 : 1);
  const total = MAP ? Object.keys(MAP.count).length : Object.keys(ST).filter(c => !stName(c).includes('-')).length;
  openModal(`<h2>📮 印章簿　${ent.length} / ${total} 站</h2>
    ${ent.length ? `<div class="stamps">${ent.map(([c, v]) => `<div class="cell">${stampSVG(c, v.d)}${v.n > 1 ? '×' + v.n : ''}</div>`).join('')}</div>`
      : '<div class="empty">還沒有印章。<br>在時刻表買一張車票（選班次＋下車站），<br>準時上車、坐到站就能蓋第一個！</div>'}
    <div class="btns"><button class="btn" onclick="closeModal()">關閉</button></div>`);
}
$('btnBook').onclick = openBook;
$('btnStation').onclick = () => openStations();

// 個人資料：名字＋顏色＋MBTI（不知道可以做 4 題）＋聊天步調＋興趣
function openProfile(first) {
  const f = { name: S.name, color: S.color, mb: S.prof.mb, pc: S.prof.pc, tg: [...tagArr(S.prof.tg)], quiz: ['', '', '', ''] };
  openModal(`<h2>${first ? '🚆 歡迎來到 Train Chat' : '⚙ 個人資料與設定'}</h2>
    ${first ? `<p class="intro">・時刻表是<b>台鐵真實班次、真實時間</b>（目前開放每天約 20 班長途車）<br>・在大廳<b>買票</b>後只能搭那班，<b>準時上車</b>、到站<b>自動下車</b><br>・大廳不能聊天，<b>上車進包廂</b>才能跟旅伴聊<br>・系統會依你的個性幫你排包廂</p>` : ''}
    <div class="lbl">你的名字</div><input type="text" id="nmIn" maxlength="10" value="${esc(f.name)}" placeholder="例：阿明">
    <div class="lbl">衣服顏色</div><div class="swatches" id="sws">${COLORS.map(c => `<div class="sw${c === f.color ? ' on' : ''}" data-c="${c}" style="background:${c}"></div>`).join('')}</div>
    <div class="lbl">MBTI <small id="mbNow">${f.mb ? '：' + f.mb : ''}</small></div>
    <div class="mbGrid" id="mbG">${MBTIS.map(m => `<button class="mb${m === f.mb ? ' on' : ''}" data-m="${m}">${m}</button>`).join('')}</div>
    <button class="linkBtn" id="quizBtn">不知道自己的 MBTI？回答 4 題 ▾</button>
    <div id="quiz" hidden>${QUIZ.map((q, i) => `<div class="qz"><div>${i + 1}. ${q[0]}</div><div class="qzO"><button data-q="${i}" data-v="${q[2]}">${q[1]}</button><button data-q="${i}" data-v="${q[4]}">${q[3]}</button></div></div>`).join('')}</div>
    <div class="lbl">聊天步調</div><div class="pcRow" id="pcR">${Object.entries(PACES).map(([k, v]) => `<button class="pc${k === f.pc ? ' on' : ''}" data-p="${k}">${v}</button>`).join('')}</div>
    <div class="lbl">興趣（最多 3 個）</div><div class="tagRow" id="tgR">${TAGS.map(t => `<button class="tg${f.tg.includes(t) ? ' on' : ''}" data-t="${esc(t)}">${t}</button>`).join('')}</div>
    ${first ? '' : `<label class="tog"><input type="checkbox" id="tstIn" ${S.test ? 'checked' : ''}> 🧪 測試模式（可以快轉時間，只影響自己）</label>
    <div class="note">連線：${CFG.db ? '已連線伺服器' : '單機（看不到其他玩家）'}<br>時刻表來源：國營臺灣鐵路公司 開放資料（每日時刻表）<br>玩家 ID：${esc(S.id)}</div>`}
    <div class="btns">${first ? '' : '<button class="btn ghost" id="setCancel">取消</button>'}<button class="btn" id="setOk">${first ? '出發！' : '儲存'}</button></div>`, first);
  const box = $('modalBox');
  const pick = (sel, attr, val) => box.querySelectorAll(sel).forEach(b => b.classList.toggle('on', b.dataset[attr] === val));
  $('sws').onclick = e => { const s = e.target.closest('.sw'); if (!s) return; f.color = s.dataset.c; box.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === s)); };
  $('mbG').onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; f.mb = b.dataset.m; pick('.mb', 'm', f.mb); $('mbNow').textContent = '：' + f.mb; };
  $('quizBtn').onclick = () => { $('quiz').hidden = !$('quiz').hidden; };
  $('quiz').onclick = e => {
    const b = e.target.closest('[data-q]'); if (!b) return;
    f.quiz[+b.dataset.q] = b.dataset.v;
    b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    if (f.quiz.every(Boolean)) { f.mb = f.quiz.join(''); pick('.mb', 'm', f.mb); $('mbNow').textContent = '：' + f.mb + '（測出來的）'; }
  };
  $('pcR').onclick = e => { const b = e.target.closest('[data-p]'); if (!b) return; f.pc = b.dataset.p; pick('.pc', 'p', f.pc); };
  $('tgR').onclick = e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    const t = b.dataset.t, i = f.tg.indexOf(t);
    if (i >= 0) f.tg.splice(i, 1); else { if (f.tg.length >= 3) { toast('最多選 3 個'); return; } f.tg.push(t); }
    b.classList.toggle('on', f.tg.includes(t));
  };
  if ($('setCancel')) $('setCancel').onclick = () => closeModal(true);
  $('setOk').onclick = () => {
    f.name = $('nmIn').value.trim().slice(0, 10);
    if (!f.name) { toast('取個名字吧'); return; }
    if (!f.mb) { toast('選一個 MBTI，或回答下面 4 題'); return; }
    if (!f.pc) { toast('選一下聊天步調'); return; }
    if (!f.tg.length) { toast('至少選 1 個興趣，比較好排旅伴'); return; }
    S.name = f.name; S.color = f.color; S.prof = { mb: f.mb, pc: f.pc, tg: f.tg };
    const tst = $('tstIn');
    if (tst && tst.checked !== S.test) { const t = now(); S.test = tst.checked; if (S.test) setGameTime(t, 1); }
    save(); Net.push(); closeModal(true); applyTest(); listSig = '';
  };
}
$('btnSet').onclick = () => openProfile(false);

function applyTest() {
  $('testbar').hidden = !S.test; $('clock').classList.toggle('test', S.test);
  $('speed').value = String(S.speed || 1);
  requestAnimationFrame(resize);
}
$('testbar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const v = b.dataset.t, t = now();
  if (v === 'now') setGameTime(Date.now() / 1000, 1), $('speed').value = '1';
  else if (v === 'jump') {
    const si = selInfo(t);
    if (S.ride) { const tr = TR[S.ride.key]; if (tr) setGameTime(tr.stops[S.ride.dest].a - 50); }
    else if (si) { setGameTime(si.o + 3); if (S.area !== 'platform') { S.area = 'platform'; save(); Net.join(roomName()); } }
    else { const d = departures(S.station, t).find(d => boardWin(d.tr, d.i)[0] > t); if (d) setGameTime(boardWin(d.tr, d.i)[0] + 3); toast('先買一張車票，就會跳到那班'); }
  } else setGameTime(t + (+v));
});
$('speed').onchange = () => setGameTime(now(), +$('speed').value);

// ③ 時刻表（大廳）／旅伴＋停靠站（車上）
let openRow = null, listSig = '';
function renderList(t) {
  if (S.ride) return renderRide(t);
  const deps = departures(S.station, t);
  const tg = waitTarget(t), longWait = tg ? boardWin(tg.tr, tg.i)[0] - t > 600 : false;
  const sig = 'st|' + S.station + '|' + deps.map(d => d.tr.key).join(',') + '|' + openRow + '|' + JSON.stringify(S.sel) + '|' + Object.keys(S.stamps).length + '|' + longWait;
  if (sig === listSig) return updateCountdowns(t);
  listSig = sig;
  $('listHead').innerHTML = `🚉 ${esc(stName(S.station))} 大廳 <small>${S.sel ? '你已經有車票了' : '點一班 → 選下車站＝買票'}</small>`;
  if (!deps.length) { $('list').innerHTML = `<div class="empty">${Object.keys(DAY).length ? '這站接下來 12 小時沒有開放的班次。<br>點左上角站名，用地圖換一站。' : '時刻表載入中…'}</div>`; return; }
  const h = hourOf(t), night = h < 5 || h >= 23.5;
  const wait = tg ? boardWin(tg.tr, tg.i)[0] - t : 0;
  const banner = tg && longWait ? `<div class="waitCard"><div class="wcT">${night ? '😴 深夜沒有車' : '⏳ 下一班要等一下'}</div>
      <div class="wcD">${S.sel ? '你的車票' : night ? '首班' : '下一班'} <b>${hm(tg.d)}</b> ${badge(tg.tr.cls)} 往${esc(destName(tg.tr))}，還要 <b data-wait="${boardWin(tg.tr, tg.i)[0]}">${dur(wait)}</b> 才進站</div>
      <button class="btn" data-skip="1">⏩ 直接跳到車進站（測試用）</button>
      <div class="wcN">正式版是真實時間；跳過會打開測試模式，⚙ 設定可關掉。</div></div>` : '';
  $('list').innerHTML = banner + deps.map(d => {
    const mine = S.sel && S.sel.key === d.tr.key, locked = S.sel && !mine, rest = d.tr.stops.slice(d.i + 1);
    let h = `<div class="row${mine ? ' mine' : ''}${locked ? ' locked' : ''}" data-k="${d.tr.key}">
      <div class="tm">${hm(d.d)}</div>${badge(d.tr.cls)}
      <div class="to">往 ${esc(destName(d.tr))}<small>${d.tr.no} 次</small></div>${mine ? '<span class="tk">🎫</span>' : ''}<div class="cd" data-cd="${d.d}" data-o="${boardWin(d.tr, d.i)[0]}"></div></div>`;
    if (openRow === d.tr.key) h += mine
      ? `<div class="expand"><p>🎫 <b>你的車票</b>：${esc(stName(S.station))} → <b>${esc(stName(d.tr.stops[S.sel.dest].c))}</b>（${hm(d.tr.stops[S.sel.dest].a)} 到）<br>車進站後 60 秒內按「上車！」，錯過車票就作廢。</p>
         <div class="btns"><button class="btn ghost" data-cancel="1">取消車票</button></div></div>`
      : locked ? `<div class="expand"><p>你已經有別班的車票了，要換這班請先取消原本的車票。</p></div>`
      : `<div class="expand"><p>要坐到哪一站？點一下就買好這張票：</p>
      <div class="chips">${rest.map((s, j) => `<div class="chip${S.stamps[s.c] ? ' has' : ''}" data-k="${d.tr.key}" data-i="${d.i}" data-dest="${d.i + 1 + j}">${esc(stName(s.c))}<b>${hm(s.a)}</b></div>`).join('')}</div></div>`;
    return h;
  }).join('');
  updateCountdowns(t);
}
// 要等的那班：有票就是那班，不然是下一班還沒進站的
function waitTarget(t) {
  const si = selInfo(t);
  if (si) return { tr: si.tr, i: si.i, d: si.e };
  const deps = departures(S.station, t);
  if (deps.some(d => t >= boardWin(d.tr, d.i)[0] && t <= d.d)) return null;   // 有車正在上車，就不用等
  return deps.find(d => boardWin(d.tr, d.i)[0] > t) || null;
}
function updateCountdowns(t) {
  document.querySelectorAll('[data-wait]').forEach(el => { const s = dur(+el.dataset.wait - t); if (el.textContent !== s) el.textContent = s; });
  document.querySelectorAll('[data-cd]').forEach(el => {
    const d = +el.dataset.cd, o = +el.dataset.o;
    let s, soon = false;
    if (t > d) s = '已開走';
    else if (t >= o) { s = '🚪 上車中 ' + dur(d - t); soon = true; }
    else { s = dur(d - t); soon = d - t < 300; }
    if (el.textContent !== s) el.textContent = s;
    el.classList.toggle('soon', soon);
    el.parentElement.classList.toggle('gone', t > d);
  });
}
$('list').addEventListener('click', e => {
  if (S.ride) return;
  if (e.target.closest('[data-cancel]')) { S.sel = null; save(); listSig = ''; toast('車票取消了'); return; }
  if (e.target.closest('[data-skip]')) {
    const t = now(), tg = waitTarget(t); if (!tg) return;
    if (!S.test) { S.test = true; S.speed = 1; }
    setGameTime(boardWin(tg.tr, tg.i)[0] + 2); applyTest();
    if (S.sel && S.area !== 'platform') { S.area = 'platform'; save(); Net.join(roomName()); }
    if (!S.sel) openRow = tg.tr.key;
    listSig = ''; $('list').scrollTop = 0;
    toast(S.sel ? '車進站了！快按「上車！」' : '車進站了！先點一個下車站買票，再按「上車！」', 3500);
    return;
  }
  const chip = e.target.closest('.chip');
  if (chip) {
    const k = chip.dataset.k, tr = TR[k];
    if (S.sel) { toast('你已經有車票了，要換請先取消'); return; }
    if (tr && now() > tr.stops[+chip.dataset.i].d) { toast('這班已經開走了'); return; }
    S.sel = { key: k, dest: +chip.dataset.dest, destC: tr.stops[+chip.dataset.dest].c }; save(); listSig = '';
    toast(`🎫 買好了：${tr.no} 次 → ${stName(tr.stops[S.sel.dest].c)}，準時上車喔`);
    return;
  }
  const row = e.target.closest('.row');
  if (row) { openRow = openRow === row.dataset.k ? null : row.dataset.k; listSig = ''; }
});
// 車上：包廂旅伴卡片＋停靠站（不能改下車站、不能提前下車）
function renderRide(t) {
  const tr = TR[S.ride.key]; if (!tr) return;
  const pos = trainPos(tr, t), ms = allMates(t);
  const sig = 'tr|' + tr.key + '|' + pos.kind + pos.i + '|' + S.ride.cp + '|' + S.ride.seat + '|' + ms.map(m => m.id + m.sleep + m.st).join(',') + '|' + !!S.ride.npcAt;
  if (sig === listSig) return;
  if (!listSig.startsWith('tr|' + tr.key)) $('list').scrollTop = 0;
  listSig = sig;
  const dst = tr.stops[S.ride.dest];
  $('listHead').innerHTML = `🚆 ${tr.no} 次 ${badge(tr.cls)} → ${esc(stName(dst.c))} <span class="sp"></span><small>${hm(dst.a)} 下車</small>`;
  let html = '';
  if (S.ride.cp != null) {
    html += `<div class="mates"><div class="matesH">🛋 ${S.ride.cs} 人包廂 #${S.ride.cp}　${ms.length ? `旅伴 ${ms.length} 位` : '等旅伴上車中…'}</div>`;
    for (const m of ms) {
      const sc = compat(myProf(), m), mt = tagArr(m.tg), my = tagArr(S.prof.tg);
      html += `<div class="mate"><i style="background:${esc(m.c || '#888')}"></i><div class="mI"><b>${esc(m.n || '旅人')}</b> <span class="mbti">${esc(m.mb || '?')}</span>${m.npc ? ' <span class="npcTag">NPC</span>' : ''} ${m.sleep ? '💤' : ''}
        <div class="mT">${mt.map(x => `<span class="${my.includes(x) ? 'same' : ''}">${esc(x)}</span>`).join('')}</div>
        <div class="mD">${m.pc ? (m.pc === 'talk' ? '話多' : '慢熱') : ''}${m.ds ? '・在 ' + esc(m.ds) + ' 下車' : m.npc ? '・在 ' + esc(stName(tr.stops[m.dest].c)) + ' 下車' : ''}</div></div><div class="mS" title="契合度">${stars(sc)}</div></div>`;
    }
    if (!ms.length) html += `<div class="mate empty1">${S.ride.npcAt ? '旅客正在找位子…' : '之後在其他站上車、跟你合得來的旅客會被排進這間包廂。'}</div>`;
    html += '</div>';
  }
  html += tr.stops.map((s, i) => {
    const past = i < S.ride.from || (pos.kind === 'stop' ? i < pos.i : i <= pos.i);
    const cur = pos.kind === 'stop' && pos.i === i;
    if (i < S.ride.from || i > S.ride.dest) return '';
    return `<div class="stop${past ? ' past' : ''}${cur ? ' cur' : ''}${i === S.ride.dest ? ' dest' : ''}">
      <div class="dot"></div><div class="nm">${esc(stName(s.c))}${S.stamps[s.c] ? ' ✅' : ''}</div>
      ${i === S.ride.from ? '<span class="tag st">上車</span>' : ''}${i === S.ride.dest ? '<span class="tag">🏁 下車</span>' : ''}
      <div class="t">${hm(i === S.ride.from ? s.d : s.a)}</div></div>`;
  }).join('');
  $('list').innerHTML = html;
}

// LED 看板
function renderBoard(t) {
  let h = '';
  if (!S.ride && S.area === 'hall') { if (renderBoard.last !== '') { $('board').innerHTML = ''; renderBoard.last = ''; } return; }
  if (S.ride) {
    const tr = TR[S.ride.key]; if (!tr) return;
    const pos = trainPos(tr, t), dst = tr.stops[S.ride.dest], left = dst.a - t;
    if (left <= BYE) h = `⏰ 快到 ${esc(stName(dst.c))} 了<br><span class="g">${dur(left)} 後下車，說再見吧</span>`;
    else {
      if (pos.kind === 'stop') h = `停靠 ${esc(stName(tr.stops[pos.i].c))}　${hm(tr.stops[pos.i].d)} 開`;
      else if (pos.kind === 'move') { const n = tr.stops[pos.i + 1]; h = `下一站 ${esc(stName(n.c))}　${dur(n.a - t)}`; }
      else if (pos.kind === 'before') h = `${hm(tr.stops[0].d)} 開車`;
      h += `<br><span class="g">🏁 ${esc(stName(dst.c))} 還有 ${dur(left)}</span>`;
    }
  } else {
    const si = selInfo(t), deps = departures(S.station, t).filter(d => d.d >= t);
    if (si) h = `🎫 ${si.tr.no} 往${esc(destName(si.tr))}<br><span class="g">${si.open ? '🚪 上車！剩 ' + dur(si.e - t) : '開車還有 ' + dur(si.e - t)}</span>`;
    else if (deps.length) { const d = deps[0]; h = `${hm(d.d)} ${esc(d.tr.cls)} 往${esc(destName(d.tr))}<br><span class="g">${t >= boardWin(d.tr, d.i)[0] ? '進站中！要搭先買票' : '還有 ' + dur(d.d - t)}</span>`; }
    else if (Object.keys(DAY).length) h = '今日已無班次';
  }
  if (h !== renderBoard.last) { $('board').innerHTML = h; renderBoard.last = h; $('board').classList.toggle('bye', h.startsWith('⏰')); }
}
function renderHallBoard(t) {
  const el = $('hallBoard');
  if (S.ride || S.area !== 'hall') { if (!el.hidden) el.hidden = true; return; }
  const deps = departures(S.station, t).filter(d => d.d >= t).slice(0, 3);
  const h = `<div class="hbT">${esc(stName(S.station))} 車站　出發 Departures</div>` + (deps.length ? deps.map(d => {
    const o = boardWin(d.tr, d.i)[0], st = t >= o ? '<span class="hbG">進站中</span>' : t >= o - PLATFORM_EARLY ? '<span class="hbY">可進月台</span>' : dur(o - t);
    return `<div class="hbR${S.sel && S.sel.key === d.tr.key ? ' me' : ''}"><b>${hm(d.d)}</b><span>${esc(d.tr.cls)}</span><span class="hbD">${esc(destName(d.tr))}</span><span class="hbS">${st}</span></div>`;
  }).join('') : '<div class="hbR">今日已無班次</div>');
  el.hidden = false;
  if (el.innerHTML !== h) el.innerHTML = h;
}
// 下方輸入列：大廳顯示車票，包廂才有聊天框
function renderBars(t) {
  // 車上：LED 看板搬到窗外畫面右上角，不要擋住包廂座位
  const bd = $('board'), want = S.ride ? $('sceneWrap') : $('yardWrap');
  if (bd.parentElement !== want) want.appendChild(bd);
  const inCp = !!(S.ride && S.ride.cp != null);
  $('chatBar').hidden = !inCp; $('ticketBar').hidden = inCp;
  if (inCp) return;
  let h;
  if (S.ride) h = '🛋 選好包廂就能開始聊天';
  else if (S.sel && TR[S.sel.key]) {
    const tr = TR[S.sel.key], si = selInfo(t);
    const hint = S.area === 'platform' ? '在月台等車，車進站就按「上車！」' : si && t < si.o - PLATFORM_EARLY ? `車進站前 10 分鐘可以進月台（還要 ${dur(si.o - PLATFORM_EARLY - t)}）` : '可以進月台了！';
    h = `🎫 ${tr.no} 次 ${esc(stName(S.station))} → ${esc(stName(tr.stops[S.sel.dest].c))}<small>${hint}</small>`;
  } else h = `🎫 還沒有車票<small>大廳不能聊天，買票上車、進包廂才能聊</small>`;
  if ($('ticketBar').innerHTML !== h) $('ticketBar').innerHTML = h;
}

// ---------- 車票檢查：用站代碼找回索引（舊版存的是「第幾站」，改版後停靠站變少會對不上） ----------
function fixTicket(tk, isRide) {
  const tr = TR[tk.key]; if (!tr) return true;           // 資料還沒載入，先不動
  const at = (code, i, fallbackIdx) => {
    if (code != null) { const j = tr.stops.findIndex(x => x.c === code); if (j >= 0) return j; }
    // 舊存檔：索引是完整停靠站的 → 換成之後第一個開放的站
    const f = tr.full && tr.full[fallbackIdx];
    if (f) { const j = tr.stops.findIndex(x => x.a >= f.a); return j; }
    return i < tr.stops.length ? i : -1;
  };
  const dest = at(tk.destC, tk.dest, tk.dest);
  if (dest < 0) return false;
  tk.dest = dest; tk.destC = tr.stops[dest].c;
  if (isRide) {
    let from = at(tk.fromC, tk.from, tk.from);
    if (from < 0 || from >= dest) from = Math.max(0, dest - 1);
    tk.from = from; tk.fromC = tr.stops[from].c;
  }
  return true;
}
// ---------- 主迴圈 ----------
let lastLogic = 0;
function logic(t) {
  ensureDays();
  if (S.ride && TR[S.ride.key] && !fixTicket(S.ride, true)) {
    // 換算不出下車站：就在目前位置（或最近開放的站）下車，不要卡在車上
    const tr = TR[S.ride.key], p = trainPos(tr, t);
    S.ride.dest = clamp(p.kind === 'move' ? p.i + 1 : p.i, 1, tr.stops.length - 1); S.ride.destC = tr.stops[S.ride.dest].c;
    toast('遊戲改版，車票換到 ' + stName(S.ride.destC) + ' 下車', 4000);
  }
  if (S.sel && TR[S.sel.key] && !fixTicket(S.sel, false)) { S.sel = null; toast('遊戲改版，原本的車票取消了', 4000); }
  if (S.ride) {
    const tr = TR[S.ride.key];
    if (!tr) { if (DAY[S.ride.key.slice(0, 8)]) { S.ride = null; S.area = 'hall'; save(); Net.join(roomName()); toast('這班車已經不在時刻表上了，回到大廳', 4000); } else loadDay(S.ride.key.slice(0, 8)); }
    else if (t >= tr.stops[S.ride.dest].a) { closeModal(true); arrive(S.ride.dest); }
    else { fixConflicts(); if (S.ride.cp == null && $('modal').hidden) chooseCompartment(); }
  } else if (S.sel) {
    const tr = TR[S.sel.key];
    if (tr) {
      const si = selInfo(t);
      if (!si) { S.sel = null; save(); listSig = ''; }
      else if (t > si.e) { toast(`😢 錯過了！${tr.no} 次已經開走，車票作廢`, 3500); S.sel = null; save(); listSig = ''; }
    } else if (DAY[S.sel.key.slice(0, 8)]) { S.sel = null; save(); }
  }
  if (!S.ride && S.area === 'platform' && !S.sel) { goHall(); toast('沒有車票，回到大廳'); }
  if (S.ride) npcTick(t);
  const si = !S.ride && S.area === 'platform' && selInfo(t);
  const cp = !S.ride && S.area === 'hall' && canPlatform(t);
  $('btnPlatform').hidden = !cp;
  if (cp) { $('btnPlatform').textContent = cp.open ? '🚪 車進站了！快去月台' : '🚶 前往月台'; $('btnPlatform').classList.toggle('hot', !!cp.open); }
  $('btnHall').hidden = !(!S.ride && S.area === 'platform');
  renderHallBoard(t);
  $('btnBoard').hidden = !(si && si.open);
  if (si && si.open) $('btnBoard').textContent = `🚪 上車！ ${dur(si.e - t)}`;
  $('stName').textContent = S.ride ? '🚆 ' + (TR[S.ride.key] ? TR[S.ride.key].no + ' 次' : '車上') : stName(S.station) + (S.area === 'platform' ? ' 月台' : ' 大廳');
  $('stampCount').textContent = Object.keys(S.stamps).length;
  $('clock').textContent = hms(t);
  renderBoard(t); renderList(t); renderBars(t);
  let label = '';
  if (S.ride) { const tr = TR[S.ride.key]; if (tr) { const p = trainPos(tr, t); label = p.kind === 'stop' ? `🚉 ${stName(tr.stops[p.i].c)} ${stEn(tr.stops[p.i].c)}` : p.kind === 'move' ? `→ ${stName(tr.stops[p.i + 1].c)}` : ''; } }
  else if (S.area === 'hall') label = '';
  else label = sceneTrain ? `${sceneTrain.tr.no} 次 ${sceneTrain.tr.cls} 往${destName(sceneTrain.tr)}` : `🚉 ${stName(S.station)} 月台`;
  if ($('sceneLabel').textContent !== label) $('sceneLabel').textContent = label;
  if (S.ride && MV.el && MV.el.isConnected && Date.now() - (logic.mapAt || 0) > 1000) { logic.mapAt = Date.now(); drawMap(); }
  if (Date.now() - Net.hb > 20000) Net.push();
  dirty = false;
}
function frame() {
  const t = now();
  if (Date.now() - lastLogic > 250) { lastLogic = Date.now(); try { logic(t); } catch (e) { console.error(e); } }
  try {
    if (S.ride && TR[S.ride.key]) drawRideScene(t, TR[S.ride.key], trainPos(TR[S.ride.key], t)); else drawStationScene(t);
    drawBubbles(drawYard(t, people(t)));
  } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}

// ---------- 開始 ----------
(async function start() {
  resize(); applyTest();
  try {
    let g;
    [ST, DATES, g] = await Promise.all([fetch('data/stations.json').then(r => r.json()), fetch('data/index.json').then(r => r.json()), fetch('data/game.json').then(r => r.json())]);
    GAME = new Set(g);
    await loadMap();
  } catch (e) { toast('時刻表載入失敗，請重新整理', 5000); }
  // 舊存檔：沒有個性資料就重填；所在車站沒有開放班次就回臺北
  if (MAP && !MAP.count[S.station] && !S.ride) { S.station = 1000; S.sel = null; }
  if (!ST[S.station]) S.station = 1000;
  if (!S.ride && S.area === 'platform' && !S.sel) S.area = 'hall';
  await ensureDays();
  if (S.ride) await loadDay(S.ride.key.slice(0, 8));
  Net.join(roomName());
  if (!S.name || !S.prof || !S.prof.mb) { S.prof = S.prof || { mb: '', pc: '', tg: [] }; openProfile(true); }
  requestAnimationFrame(frame);
})();
addEventListener('pagehide', () => { if (Net.es) Net.es.close(); });
