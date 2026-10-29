'use strict';
// ---------- 社交與內容功能 ----------
// 安全（過濾／封鎖／檢舉）、名片＋旅伴＋約車、話題卡、便當、旅行日記、窗外景點、包廂小遊戲、每日任務
// 用到 app.js / map.js 的全域：S、TR、Net、CFG、MAP、mates、allMates、logChat、sendChat、npcSay、Sfx、toast、openModal…

// ===== 安全：字詞過濾 =====
const BAD = ['幹你娘', '幹您娘', '操你媽', '靠北', '靠杯', '王八蛋', '去死', '智障', '白癡', '白痴', '雞掰', '機掰', '賤人', '婊子', 'fuck', 'shit', 'bitch'];
const BAD_RE = new RegExp(BAD.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
function cleanText(m) {
  return String(m || '')
    .replace(BAD_RE, w => '＊'.repeat(w.length))
    .replace(/(?:\+?886[-\s]?|0)9\d{2}[-\s]?\d{3}[-\s]?\d{3}/g, '（電話已隱藏）')        // 手機號碼
    .replace(/(line|賴|ig|instagram|telegram|tg)\s*(id)?\s*[:：]?\s*@?[a-z0-9._-]{4,}/gi, '（帳號已隱藏）');   // 私下聯絡帳號
}
// ===== 封鎖／檢舉 =====
function blockUser(m) {
  S.blocked = S.blocked || {}; S.blocked[m.id] = m.n || '旅人'; save(); listSig = '';
  toast(`已封鎖 ${m.n}：之後不會被排進同一個包廂，也看不到他的訊息`, 3500);
}
function openReport(m) {
  openModal(`<h2>🚩 檢舉 ${esc(m.n || '旅人')}</h2><p class="note" style="margin-top:0">檢舉會連同最後一句訊息送給管理員。</p>
    <div class="pcRow" id="rpR">${['騷擾、糾纏', '不當言論、歧視', '色情內容', '詐騙、廣告、要私下聯絡', '其他'].map(r => `<button class="pc" data-r="${r}">${r}</button>`).join('')}</div>
    <label class="tog"><input type="checkbox" id="rpB" checked> 同時封鎖他</label>
    <div class="btns"><button class="btn ghost" onclick="closeModal()">取消</button><button class="btn" id="rpOk">送出檢舉</button></div>`);
  let reason = '';
  $('rpR').onclick = e => { const b = e.target.closest('[data-r]'); if (!b) return; reason = b.dataset.r; $('rpR').querySelectorAll('.pc').forEach(x => x.classList.toggle('on', x === b)); };
  $('rpOk').onclick = () => {
    if (!reason) { toast('選一個原因'); return; }
    const rec = { by: S.id, byName: S.name, who: m.id, name: m.n || '', reason, train: S.ride ? S.ride.key : '', last: m.m || '', at: Date.now() };
    if (CFG.db) fetch(CFG.db + '/' + CFG.prefix + 'reports.json', { method: 'POST', body: JSON.stringify(rec) }).catch(() => { });
    S.reports = (S.reports || []).concat([rec]).slice(-20);
    if ($('rpB').checked) blockUser(m); else save();
    closeModal(); toast('已送出檢舉，謝謝你讓車廂更安全', 3000);
  };
}

// ===== 名片＋旅伴 =====
function offerCard(m) {
  if (S.friends && S.friends[m.id]) { toast('你們已經是旅伴了'); return; }
  if (m.npc) {
    logChat('', `你遞出名片給 ${m.n}`);
    setTimeout(() => {
      if (Math.random() < 0.85) { addFriend(m); npcSay(m, pickOne(['好呀！這是我的名片～', '收到！下次一起坐車', '謝謝～我也給你一張']), 0); }
      else npcSay(m, '不好意思，我沒有帶名片 😅', 0);
    }, 1500);
    return;
  }
  S.ride.cd = [...new Set([...(S.ride.cd || []), m.id])]; save(); Net.push();
  logChat('', `你遞出名片給 ${m.n}，等對方也遞給你就成為旅伴`);
}
function addFriend(m) {
  S.friends = S.friends || {};
  if (S.friends[m.id]) return;
  const tr = S.ride && TR[S.ride.key];
  S.friends[m.id] = { n: m.n || '旅人', c: m.c, mb: m.mb, tg: tagArr(m.tg), npc: !!m.npc, met: dateStr(now()), where: tr ? `${tr.no} 次 ${stName(tr.stops[S.ride.from].c)}→${stName(tr.stops[S.ride.dest].c)}` : '' };
  save(); listSig = ''; Sfx.play('chime'); toast(`📇 和 ${m.n} 交換名片，成為旅伴了！`, 3000);
  logChat('', `你和 ${m.n} 交換了名片`); mission('card');
}
function checkCards(t) {
  for (const m of mates(t)) {
    if ((S.ride.cd || []).includes(m.id) && tagArr(m.cd).includes(S.id) && !(S.friends || {})[m.id]) addFriend(m);
    if (tagArr(m.cd).includes(S.id) && !(S.ride.cd || []).includes(m.id) && !(S.ride.cdAsk || {})[m.id]) {
      S.ride.cdAsk = Object.assign(S.ride.cdAsk || {}, { [m.id]: 1 });
      logChat('', `${m.n} 遞名片給你，點他的卡片「⋯」→ 交換名片就成為旅伴`); Sfx.play('pop');
    }
  }
}
// 約車：把自己的位置和車票放到雲端，旅伴打開名單時看得到
let pubLast = '';
function pubStatus() {
  if (!CFG.db) return;
  const sel = S.sel && TR[S.sel.key], ride = S.ride && TR[S.ride.key];
  const st = { n: S.name, c: S.color, st: S.station,
    sel: sel ? { key: S.sel.key, no: sel.no, destC: S.sel.destC, dep: (selInfo(now()) || {}).e || 0 } : null,
    ride: ride ? { no: ride.no, destC: S.ride.destC } : null };
  const js = JSON.stringify(st);
  if (js === pubLast && Date.now() - (pubStatus.at || 0) < 120000) return;
  pubLast = js; pubStatus.at = Date.now();
  st.t = Date.now();
  fetch(CFG.db + '/' + CFG.prefix + 'u' + S.id + '.json', { method: 'PUT', body: JSON.stringify(st) }).catch(() => { });
}
async function friendStatus(id) {
  if (!CFG.db) return null;
  try { return await fetch(CFG.db + '/' + CFG.prefix + 'u' + id + '.json').then(r => r.json()); } catch (e) { return null; }
}
function rideWith(key, destC) {
  const tr = TR[key]; if (!tr) { toast('找不到這班車'); return; }
  if (S.sel || S.ride) { toast('你已經有車票了，先取消再約'); return; }
  const i = tr.stops.findIndex(x => x.c === S.station);
  if (i < 0) { toast('這班車不停你所在的站'); return; }
  let dest = tr.stops.findIndex(x => x.c === destC);
  if (dest <= i || tr.stops[dest].a - tr.stops[i].d > TICKET_MAX) dest = -1;
  if (dest < 0) { openRow = key; listSig = ''; closeModal(); toast('他的下車站離你太遠（超過 2 小時），在時刻表自己選一站'); return; }
  S.sel = { key, dest, destC }; save(); listSig = ''; closeModal(); Sfx.play('ticket');
  toast(`🎫 跟旅伴買了同一班：${tr.no} 次 → ${stName(destC)}`, 3000);
}

// ===== 話題卡 =====
const TOPICS = [
  ['🍜 美食', '最近吃過最好吃的一餐是什麼？', ['巷口那家拉麵！湯頭超濃', '我媽煮的滷肉飯，無敵']],
  ['🍜 美食', '宵夜你會選什麼？', ['鹹酥雞，沒有第二個答案', '泡麵加蛋']],
  ['✈️ 旅行', '如果明天放假一週，你想去哪？', ['想去花東慢慢騎腳踏車', '出國！想去日本泡溫泉']],
  ['✈️ 旅行', '去過最難忘的地方？', ['合歡山看星星', '小時候第一次看到海']],
  ['🎮 遊戲', '最近在玩什麼遊戲？', ['在玩一款農場遊戲，超療癒', '跟朋友打手遊排位']],
  ['🎵 音樂', '最近重複聽最多次的歌？', ['一首很老的歌，但聽了很放鬆', '最近都聽 lo-fi 讀書']],
  ['🎬 電影', '推薦一部你看三次以上的電影', ['動畫電影，每次看都哭', '一部老港片，台詞都會背了']],
  ['📚 閱讀', '最近在看什麼書？', ['一本推理小說，停不下來', '在看旅行散文']],
  ['⚽ 運動', '你平常做什麼運動？', ['偶爾去爬山', '每天走路算嗎哈哈']],
  ['📷 攝影', '手機相簿裡最得意的一張照片？', ['一張夕陽，顏色超美', '我家貓的蠢照']],
  ['🐱 寵物', '你是貓派還是狗派？', ['貓派！高冷的最可愛', '狗派，會撒嬌的']],
  ['🎨 動漫', '最近在追什麼番？', ['在補一部經典老番', '每週等更新好痛苦']],
  ['💻 科技', '你最近買過最值得的東西？', ['一副降噪耳機，坐車必備', '人體工學椅']],
  ['🌿 戶外', '山派還是海派？', ['海派！聽海浪聲最放鬆', '山派，涼涼的很舒服']],
  [null, '小時候的夢想是什麼？', ['想當火車司機！', '想當老師']],
  [null, '你覺得自己最像哪種動物？', ['樹懶，能躺就不坐', '貓頭鷹，越晚越有精神']],
  [null, '今天做過最開心的一件事？', ['剛好趕上這班車', '早餐店阿姨多給我一顆蛋']],
  [null, '如果中了一千萬你第一件事做什麼？', ['先請全家吃大餐', '辭職去環島']],
  [null, '你最常被誤會的一點是？', ['看起來很兇，其實很好聊', '大家以為我很外向']],
  [null, '一個人的時候最喜歡做什麼？', ['窩在家看劇', '去咖啡廳發呆']],
  [null, '坐火車最喜歡做什麼？', ['看窗外發呆', '吃便當！']],
  ['MBTI', '你覺得你的 MBTI 準嗎？', ['蠻準的，被說中好多', '一半一半吧']],
  ['MBTI', 'E 人和 I 人，誰比較適合當旅伴？', ['I 人！安靜又不會尷尬', 'E 人啦，才有話聊']],
  [null, '真心話：最近一次哭是為了什麼？', ['看電影哭到不行', '這題跳過可以嗎哈哈']],
  [null, '真心話：手機裡最後一張照片是什麼？', ['一碗麵', '截圖的時刻表']]
];
function drawTopic() {
  const ms = allMates(now());
  const mine = tagArr(S.prof.tg), shared = new Set(ms.flatMap(m => tagArr(m.tg)).filter(x => mine.includes(x)));
  const pool = TOPICS.filter(x => !x[0] || shared.has(x[0]) || (x[0] === 'MBTI' && Math.random() < 0.4));
  const card = pickOne(pool);
  sendChat('🃏 話題卡：' + card[1]);
  mission('topic');
  const ns = (S.ride && S.ride.npcs) || [];
  if (ns.length) npcSay(pickOne(ns), pickOne(card[2]), 2200 + Math.random() * 1500);
}

// ===== 便當＋地方名產（來源：公視各縣市特色表、食尚玩家網友票選） =====
const LOCAL = { '臺北': '🍜 牛肉麵', '七堵': '🍢 基隆甜不辣', '新竹': '🍡 新竹貢丸', '苗栗': '🍓 大湖草莓', '臺中': '🥮 太陽餅', '彰化': '🥟 彰化肉圓',
  '斗六': '☕ 古坑咖啡', '臺南': '🍜 擔仔麵', '高雄': '🥛 木瓜牛奶', '屏東': '🍖 屏東豬腳', '臺東': '🍈 釋迦', '宜蘭': '🦆 鴨賞', '花蓮': '🍡 花蓮麻糬' };
function openShop() {
  const here = stName(S.station), items = ['🍱 台鐵排骨便當', '🥤 飲料', ...(LOCAL[here] ? [LOCAL[here]] : [])];
  openModal(`<h2>🏪 ${esc(here)}站 便利商店</h2><p class="note" style="margin-top:0">挑一樣帶上車，可以在包廂分給旅伴（一次只能帶一樣）。${LOCAL[here] ? `<br>本站名產：<b>${LOCAL[here]}</b>` : ''}</p>
    <div class="pcRow" id="shopR">${items.map(it => `<button class="pc${S.bag === it ? ' on' : ''}" data-it="${esc(it)}">${esc(it)}${it === LOCAL[here] ? '　<small>本站限定</small>' : ''}</button>`).join('')}</div>
    <div class="btns"><button class="btn ghost" onclick="closeModal()">先不用</button></div>`);
  $('shopR').onclick = e => {
    const b = e.target.closest('[data-it]'); if (!b) return;
    S.bag = b.dataset.it; save(); closeModal(); Sfx.play('ticket'); toast(`🎒 買了 ${S.bag}，上車可以分給旅伴`);
  };
}
function shareBag() {
  if (!S.bag) return;
  const it = S.bag; S.bag = null; save(); listSig = '';
  sendChat(`🍱 拿出 ${it} 分給大家！`);
  mission('bento');
  for (const n of (S.ride.npcs || [])) npcSay(n, pickOne(['哇謝謝！好好吃', '你人也太好了吧！', '我不客氣了 😋', '下次換我請你']), 1500 + Math.random() * 2000);
}

// ===== 旅行日記 =====
const R2 = Math.PI / 180;
function geoKm(a, b) {   // 兩站直線距離（公里）
  const [lo1, la1] = a, [lo2, la2] = b, x = (lo2 - lo1) * R2 * Math.cos((la1 + la2) / 2 * R2), y = (la2 - la1) * R2;
  return Math.sqrt(x * x + y * y) * 6371;
}
function tripKm(tr, fromC, destC) {
  if (!MAP) return 0;
  const f = tr.full || tr.stops, i = f.findIndex(x => x.c === fromC), j = f.findIndex(x => x.c === destC);
  let km = 0;
  for (let k = i; k < j && k >= 0; k++) {   // 沿著鐵路網經過的每一站累加（長途車不停的小站也算進去）
    const p = railPath(f[k].c, f[k + 1].c) || [f[k].c, f[k + 1].c];
    for (let q = 1; q < p.length; q++) { const a = MAP.gps[p[q - 1]], b = MAP.gps[p[q]]; if (a && b) km += geoKm(a, b); }
  }
  return Math.round(km);
}
function recordTrip(tr, met) {
  const fromC = S.ride.fromC, destC = S.ride.destC;
  const path = (tr.full || tr.stops).map(x => x.c), i = path.indexOf(fromC), j = path.indexOf(destC);
  S.trips = (S.trips || []).concat([{ d: dateStr(now()), no: tr.no, cls: tr.cls, fromC, destC, km: tripKm(tr, fromC, destC), met, path: i >= 0 && j > i ? path.slice(i, j + 1) : [fromC, destC] }]).slice(-200);
}
function diaryHTML() {
  const T = S.trips || [], km = T.reduce((n, x) => n + (x.km || 0), 0), people = new Set(T.flatMap(x => x.met || []));
  let svg = '';
  if (MAP) {
    const o = ['<rect x="-50" y="-50" width="400" height="500" fill="#bfe0f2"/>'];
    for (const r of MAP.coast) o.push(`<path d="M${r.map(p => PX(p[0]).toFixed(1) + ' ' + PY(p[1]).toFixed(1)).join('L')}Z" fill="#f3eedf"/>`);
    for (const [a, b] of MAP.edges) { const A = sxy(a), B = sxy(b); o.push(`<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="#b8bfca" stroke-width="1"/>`); }
    for (const x of T) { const pts = (x.path || []).filter(c => MAP.gps[c]).map(c => sxy(String(c)).join(' ')); o.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${clsOf(x.cls).k}" stroke-width="3" stroke-linejoin="round" opacity=".85"/>`); }
    for (const c of Object.keys(S.stamps)) if (MAP.gps[c]) { const [x, y] = sxy(c); o.push(`<circle cx="${x}" cy="${y}" r="3" fill="#ffcf4a" stroke="#2b3446" stroke-width="1"/>`); }
    svg = `<svg class="diaryMap" viewBox="-5 -5 210 370">${o.join('')}</svg>`;
  }
  return `<div class="dTot"><div><b>${T.length}</b>趟</div><div><b>${km}</b>公里</div><div><b>${people.size}</b>位旅伴</div><div><b>${Object.keys(S.stamps).length}</b>個印章</div></div>
    <div class="dWrap">${svg}<div class="dList">${T.length ? [...T].reverse().slice(0, 30).map(x => `<div class="dItem"><b>${esc(x.d.slice(5))}</b> ${badge(x.cls)} ${esc(stName(x.fromC))} → ${esc(stName(x.destC))}<small>${x.km} 公里${x.met && x.met.length ? '・遇見 ' + x.met.map(esc).join('、') : ''}</small></div>`).join('')
      : '<div class="empty">還沒有旅程。坐一趟車，路線會畫在左邊的地圖上。</div>'}</div></div>`;
}

// ===== 窗外景點（來源：微笑台灣 鐵道路線介紹） =====
const SCENIC = [
  { a: '石城', b: '大里', t: '🏝 窗外是太平洋，遠方就是龜山島！', island: true },
  { a: '和仁', b: '崇德', t: '⛰ 清水斷崖就在窗外，山直直切進太平洋' },
  { a: '枋山', b: '內獅', t: '🌊 南迴最美的一段：出了山洞就是大海' }
];
// 長途車不停小站，所以用鐵路網找出兩個停靠站之間實際經過的站，再依時間推算火車在哪
let ADJ = null; const PATHS = {};
function railPath(a, b) {
  const key = a + '-' + b; if (key in PATHS) return PATHS[key];
  if (!ADJ) { ADJ = {}; for (const [x, y] of MAP.edges) { (ADJ[x] = ADJ[x] || []).push(y); (ADJ[y] = ADJ[y] || []).push(x); } }
  const prev = { [a]: null }, q = [a];
  while (q.length) { const u = q.shift(); if (u === b) break; for (const v of ADJ[u] || []) if (!(v in prev)) { prev[v] = u; q.push(v); } }
  if (!(b in prev)) return PATHS[key] = null;
  const path = []; for (let u = b; u != null; u = prev[u]) path.unshift(u);
  return PATHS[key] = path;
}
const codeOf = name => { for (const c in ST) if (ST[c][0] === name) return +c; return null; };
function scenicAt(tr, t) {
  const f = tr.full; if (!f || !MAP) return null;
  for (let k = 0; k < f.length - 1; k++) {
    if (t < f[k].d || t >= f[k + 1].a) continue;
    const path = railPath(f[k].c, f[k + 1].c); if (!path) return null;
    const dist = [0];
    for (let i = 1; i < path.length; i++) { const A = MAP.gps[path[i - 1]], B = MAP.gps[path[i]]; dist.push(dist[i - 1] + (A && B ? geoKm(A, B) : 0)); }
    const cur = (t - f[k].d) / Math.max(1, f[k + 1].a - f[k].d) * dist[dist.length - 1];
    for (const sc of SCENIC) {
      const ia = path.indexOf(sc.ca || (sc.ca = codeOf(sc.a))), ib = path.indexOf(sc.cb || (sc.cb = codeOf(sc.b)));
      if (ia < 0 || ib < 0) continue;
      if (cur >= Math.min(dist[ia], dist[ib]) && cur <= Math.max(dist[ia], dist[ib])) return { ...sc, k: k + '-' + sc.a };
    }
    return null;
  }
  return null;
}

// ===== 包廂小遊戲：猜拳、井字棋（跟真人旅伴或 NPC） =====
const HANDS = { r: '✊', s: '✌️', p: '✋' };
const beats = (a, b) => (a === 'r' && b === 's') || (a === 's' && b === 'p') || (a === 'p' && b === 'r');
function opponent() { const t = now(); return mates(t).find(m => !m.sleep) || (S.ride.npcs || [])[0] || null; }
function openRPS(fromPeer) {
  const op = fromPeer || opponent(); if (!op) { toast('包廂裡沒有人可以一起玩'); return; }
  openModal(`<h2>✊ 跟 ${esc(op.n)} 猜拳</h2><div class="pick2">${Object.entries(HANDS).map(([k, v]) => `<button class="pickBox" data-h="${k}"><div class="pkI">${v}</div></button>`).join('')}</div>
    <div class="btns"><button class="btn ghost" onclick="closeModal()">不玩了</button></div>`);
  $('modalBox').querySelectorAll('[data-h]').forEach(b => b.onclick = () => {
    const h = b.dataset.h; closeModal(); mission('game');
    if (op.npc) {
      const o = pickOne(Object.keys(HANDS)), res = h === o ? '平手！' : beats(h, o) ? '你贏了 🎉' : `${op.n} 贏了`;
      sendChat(`✊ 猜拳！我出 ${HANDS[h]}`);
      npcSay(op, `我出 ${HANDS[o]}！${h === o ? '平手～再來！' : beats(o, h) ? '我贏啦 😎' : '可惡輸了'}`, 1200);
      setTimeout(() => logChat('', `猜拳結果：${res}`), 1400);
      return;
    }
    const r = fromPeer && fromPeer.rps ? fromPeer.rps.r : Date.now();
    S.ride.rps = { r, p: h, w: op.id }; save(); Net.push();
    logChat('', fromPeer ? `你出了 ${HANDS[h]}` : `你向 ${op.n} 發起猜拳（已出拳，等對方）`);
  });
}
function checkRPS(t) {
  const me = S.ride.rps;
  for (const m of mates(t)) {
    const g = m.rps; if (!g || g.w !== S.id) continue;
    if (!me || me.r !== g.r) {   // 對方找我猜拳
      if (!(S.ride.rpsSeen || {})[g.r]) { S.ride.rpsSeen = Object.assign(S.ride.rpsSeen || {}, { [g.r]: 1 }); Sfx.play('pop'); toast(`${m.n} 找你猜拳！`); if ($('modal').hidden) openRPS(m); }
      continue;
    }
    if (!(S.ride.rpsDone || {})[g.r]) {   // 兩邊都出了
      S.ride.rpsDone = Object.assign(S.ride.rpsDone || {}, { [g.r]: 1 });
      logChat('', `猜拳：你 ${HANDS[me.p]} vs ${m.n} ${HANDS[g.p]} → ${me.p === g.p ? '平手' : beats(me.p, g.p) ? '你贏了 🎉' : m.n + ' 贏了'}`);
      Sfx.play('bye');
    }
  }
}
// 井字棋：每個人把自己下的格子放在 ttt.m，棋盤＝雙方合起來；發起的人是 ✕ 先下
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
let tttOpen = null;   // 目前開著的棋局 { g, op }
function tttBoard(op) {
  const me = S.ride.ttt || { m: [] }, them = op.npc ? { m: S.ride.tttNpc || [] } : (allMates(now()).find(x => x.id === op.id) || {}).ttt || { m: [] };
  const mine = tagArr(me.m), theirs = me.g === (them.g || me.g) ? tagArr(them.m) : [];
  const X = me.x ? mine : theirs, O = me.x ? theirs : mine;
  const win = s => LINES.some(l => l.every(i => s.includes(i)));
  const res = win(X) ? 'X' : win(O) ? 'O' : X.length + O.length >= 9 ? 'draw' : '';
  const turnX = X.length === O.length, myTurn = !res && (me.x ? turnX : !turnX);
  return { mine, theirs, X, O, res, myTurn, meX: me.x };
}
function startTTT(fromPeer) {
  const op = fromPeer || opponent(); if (!op) { toast('包廂裡沒有人可以一起玩'); return; }
  const g = fromPeer ? fromPeer.ttt.g : Date.now();
  S.ride.ttt = { g, w: op.id, x: !fromPeer, m: [] }; S.ride.tttNpc = []; save(); Net.push();
  tttOpen = { g, op }; mission('game');
  if (!fromPeer && !op.npc) logChat('', `你邀 ${op.n} 下井字棋`);
  renderTTT();
}
function renderTTT() {
  if (!tttOpen || !S.ride) return;
  const op = tttOpen.op, b = tttBoard(op);
  const cell = i => b.X.includes(i) ? '✕' : b.O.includes(i) ? '◯' : '';
  const status = b.res ? (b.res === 'draw' ? '平手！' : (b.res === 'X') === !!b.meX ? '你贏了 🎉' : `${op.n} 贏了`) : b.myTurn ? `輪到你（${b.meX ? '✕' : '◯'}）` : `等 ${op.n} 下…`;
  const html = `<h2>⭕ 井字棋 vs ${esc(op.n)}</h2><div class="tttS">${status}</div>
    <div class="ttt">${[...Array(9)].map((_, i) => `<button data-c="${i}" ${cell(i) || !b.myTurn ? 'disabled' : ''}>${cell(i)}</button>`).join('')}</div>
    <div class="btns"><button class="btn ghost" id="tttClose">關閉</button>${b.res ? '<button class="btn" id="tttAgain">再一局</button>' : ''}</div>`;
  if ($('modal').hidden || !$('modalBox').querySelector('.ttt')) openModal(html); else if ($('modalBox').dataset.h !== html) $('modalBox').innerHTML = html;
  $('modalBox').dataset.h = html;
  $('tttClose').onclick = () => { tttOpen = null; closeModal(); };
  if ($('tttAgain')) $('tttAgain').onclick = () => startTTT();
  $('modalBox').querySelectorAll('.ttt [data-c]').forEach(btn => btn.onclick = () => {
    S.ride.ttt.m = [...tagArr(S.ride.ttt.m), +btn.dataset.c]; save(); Net.push(); renderTTT();
    if (op.npc) setTimeout(npcTTTMove, 800);
  });
  if (b.res && !(S.ride.tttDone || {})[tttOpen.g]) {
    S.ride.tttDone = Object.assign(S.ride.tttDone || {}, { [tttOpen.g]: 1 });
    logChat('', `井字棋 vs ${op.n}：${status}`); Sfx.play('bye');
  }
}
function npcTTTMove() {   // NPC：能贏就贏、該擋就擋、再來中間、隨便下
  if (!tttOpen || !tttOpen.op.npc) return;
  const b = tttBoard(tttOpen.op); if (b.res || b.myTurn) return;
  const used = [...b.X, ...b.O], free = [...Array(9).keys()].filter(i => !used.includes(i));
  const wins = (s, i) => LINES.some(l => l.includes(i) && l.every(j => j === i || s.includes(j)));
  const mv = free.find(i => wins(b.theirs, i)) ?? free.find(i => wins(b.mine, i)) ?? (free.includes(4) ? 4 : pickOne(free));
  S.ride.tttNpc = [...(S.ride.tttNpc || []), mv]; save(); renderTTT();
}
function checkTTT(t) {
  for (const m of mates(t)) {
    const g = m.ttt; if (!g || g.w !== S.id) continue;
    if (!S.ride.ttt || S.ride.ttt.g !== g.g) {
      if (!(S.ride.tttSeen || {})[g.g] && g.x) { S.ride.tttSeen = Object.assign(S.ride.tttSeen || {}, { [g.g]: 1 }); Sfx.play('pop'); toast(`${m.n} 邀你下井字棋！`); if ($('modal').hidden) startTTT(m); }
    } else if (tttOpen && tttOpen.g === g.g) { tttOpen.op = m; renderTTT(); }
  }
}

// ===== 每日任務 =====
const MISSIONS = {
  ride: ['坐一趟車', 1], transfer: ['轉車：今天坐 2 趟', 2], east: ['坐到東部（宜蘭／花蓮／臺東）', 1], chat: ['在包廂說 5 句話', 5],
  topic: ['抽 2 張話題卡', 2], bento: ['跟旅伴分享便當或名產', 1], card: ['交換 1 張名片', 1], stamp: ['蓋一個新印章', 1],
  game: ['在包廂玩一次小遊戲', 1], mbti: ['跟 MBTI 和你不一樣的人同包廂', 1]
};
function todayMissions() {
  const k = dayKey(now());
  if (!S.daily || S.daily.date !== k) S.daily = { date: k, prog: {}, done: {} };
  const r = rng(hash('m' + k)), rest = Object.keys(MISSIONS).filter(x => x !== 'ride' && x !== 'transfer').sort(() => r() - 0.5);
  return [r() < 0.5 ? 'ride' : 'transfer', rest[0], rest[1]];
}
function mission(key) {
  const list = todayMissions(), P = S.daily.prog;
  P[key] = (P[key] || 0) + 1;
  if (key === 'ride') P.transfer = P.ride;
  for (const m of list) {
    if (!S.daily.done[m] && (P[m] || 0) >= MISSIONS[m][1]) {
      S.daily.done[m] = 1; S.badges = (S.badges || 0) + 1;
      setTimeout(() => { toast(`✅ 每日任務完成：${MISSIONS[m][0]}`, 3000); Sfx.play('bye'); }, 600);
    }
  }
  save();
}
function missionsHTML() {
  const list = todayMissions(), P = S.daily.prog;
  return `<div class="msH">今天的任務（每天換）　🏅 任務章 ${S.badges || 0} 枚</div>` + list.map(m => {
    const [t, n] = MISSIONS[m], v = Math.min(P[m] || 0, n), done = S.daily.done[m];
    return `<div class="ms${done ? ' done' : ''}"><div>${done ? '✅' : '⬜'} ${t}</div><div class="msBar"><i style="width:${v / n * 100}%"></i></div><small>${v}/${n}</small></div>`;
  }).join('');
}

// ===== 旅行手冊（印章／日記／旅伴／任務） =====
function openBook(tab) {
  tab = tab || openBook.tab || 'stamp'; openBook.tab = tab;
  const tabs = [['stamp', '📮 印章'], ['diary', '📔 日記'], ['friends', '👥 旅伴'], ['mission', '✅ 任務']];
  let body = '';
  if (tab === 'stamp') {
    const ent = Object.entries(S.stamps).sort((a, b) => a[1].d < b[1].d ? -1 : 1);
    const total = MAP ? Object.keys(MAP.count).length : 18;
    body = `<div class="msH">${ent.length} / ${total} 站</div>` + (ent.length ? `<div class="stamps">${ent.map(([c, v]) => `<div class="cell">${stampSVG(c, v.d)}${v.n > 1 ? '×' + v.n : ''}</div>`).join('')}</div>`
      : '<div class="empty">還沒有印章。買一張車票、準時上車、坐到站就能蓋第一個！</div>');
  } else if (tab === 'diary') body = diaryHTML();
  else if (tab === 'mission') body = missionsHTML();
  else {
    const F = Object.entries(S.friends || {});
    body = (CFG.db ? '' : '<div class="note" style="margin:0 0 6px">目前是單機，看不到旅伴現在在哪、買了哪班車（開連線後就有）。</div>') +
      (F.length ? F.map(([id, f]) => `<div class="mate"><i style="background:${esc(f.c || '#888')}"></i><div class="mI"><b>${esc(f.n)}</b> <span class="mbti">${esc(f.mb || '?')}</span>${f.npc ? ' <span class="npcTag">NPC</span>' : ''}
        <div class="mD">${esc(f.met)} 認識・${esc(f.where || '')}</div><div class="mD" data-fs="${f.npc ? '' : id}">${f.npc ? 'NPC 旅伴不能約車' : CFG.db ? '查詢中…' : ''}</div></div></div>`).join('')
        : '<div class="empty">還沒有旅伴。在包廂點旅伴卡片的「⋯」→ 交換名片。</div>') +
      (Object.keys(S.blocked || {}).length ? `<div class="msH" style="margin-top:12px">已封鎖</div>${Object.entries(S.blocked).map(([id, n]) => `<div class="mate"><div class="mI">${esc(n)}</div><button class="btn ghost sm" data-unblock="${id}">解除封鎖</button></div>`).join('')}` : '');
  }
  openModal(`<div class="bookTabs">${tabs.map(([k, v]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${v}</button>`).join('')}</div>${body}
    <div class="btns"><button class="btn" onclick="closeModal()">關閉</button></div>`);
  $('modalBox').querySelectorAll('[data-tab]').forEach(b => b.onclick = () => openBook(b.dataset.tab));
  $('modalBox').querySelectorAll('[data-unblock]').forEach(b => b.onclick = () => { delete S.blocked[b.dataset.unblock]; save(); openBook('friends'); });
  // 旅伴現在在哪（約車）
  $('modalBox').querySelectorAll('[data-fs]').forEach(async el => {
    const id = el.dataset.fs; if (!id || !CFG.db) return;
    const st = await friendStatus(id);
    if (!el.isConnected) return;
    if (!st) { el.textContent = '還沒有動態'; return; }
    const ago = Date.now() - (st.t || 0) < 600000 ? '剛剛' : '之前';
    if (st.ride) el.innerHTML = `🚆 ${ago}在 ${esc(st.ride.no)} 次車上，往 ${esc(stName(st.ride.destC))}`;
    else if (st.sel) {
      el.innerHTML = `🎫 在 ${esc(stName(st.st))}，買了 ${esc(st.sel.no)} 次 → ${esc(stName(st.sel.destC))}（${hm(st.sel.dep)} 開）` +
        (+st.st === +S.station && !S.sel && !S.ride ? ` <button class="btn sm" data-with="${esc(st.sel.key)}|${st.sel.destC}">我也買這班</button>` : '');
      const b = el.querySelector('[data-with]'); if (b) b.onclick = () => { const [k, d] = b.dataset.with.split('|'); rideWith(k, +d); };
    } else el.innerHTML = `🚉 ${ago}在 ${esc(stName(st.st))} 大廳`;
  });
}

// ===== 車上：旅伴卡片的動作 =====
function openMateMenu(m) {
  const fr = (S.friends || {})[m.id];
  openModal(`<h2>${esc(m.n || '旅人')} <span class="mbti">${esc(m.mb || '?')}</span>${m.npc ? ' <span class="npcTag">NPC</span>' : ''}</h2>
    <div class="pcRow"><button class="pc" id="mmCard">${fr ? '✅ 已經是旅伴' : '📇 交換名片'}</button>
    ${m.npc ? '' : '<button class="pc" id="mmBlock">🚫 封鎖</button><button class="pc" id="mmReport">🚩 檢舉</button>'}</div>
    <div class="btns"><button class="btn ghost" onclick="closeModal()">關閉</button></div>`);
  $('mmCard').onclick = () => { closeModal(); offerCard(m); };
  if ($('mmBlock')) $('mmBlock').onclick = () => { closeModal(); blockUser(m); };
  if ($('mmReport')) $('mmReport').onclick = () => openReport(m);
}
function rideClick(e) {
  const t = now(), a = e.target.closest('[data-act]');
  if (a) {
    const act = a.dataset.act;
    if (act === 'topic') drawTopic();
    else if (act === 'rps') openRPS();
    else if (act === 'ttt') startTTT();
    else if (act === 'bento') shareBag();
    else if (act === 'swap') swapCompartment();
    return;
  }
  const mm = e.target.closest('[data-mate]');
  if (mm) { const m = allMates(t).find(x => x.id === mm.dataset.mate); if (m) openMateMenu(m); }
}
// B：停靠站可以換包廂（重新配對）
function swapCompartment() {
  const tr = TR[S.ride.key], pos = trainPos(tr, now());
  if (pos.kind !== 'stop') { toast('停靠站才能換包廂'); return; }
  S.ride.excl = S.ride.cp; S.ride.cp = null; S.ride.npcs = []; S.ride.swapAt = pos.i; S.ride.npcBye = 0;
  npcQ.length = 0; tttOpen = null; save(); Net.push(); listSig = '';
  logChat('', '你離開了包廂');
  chooseCompartment();
}

// ===== 每輪（車上）：名片、小遊戲、窗外景點、MBTI 任務 =====
function featTick(t) {
  pubStatus();
  if (!S.ride || S.ride.cp == null) return;
  checkCards(t); checkRPS(t); checkTTT(t);
  const tr = TR[S.ride.key], sc = tr && scenicAt(tr, t);
  if (sc && S.ride.scenic !== sc.k) {
    S.ride.scenic = sc.k; logChat('', '窗外：' + sc.t); Sfx.play('tap');
    const n = (S.ride.npcs || [])[0]; if (n) npcSay(n, pickOne(['哇！你看窗外！', '這段超美的', '快拍照！']), 1200);
  }
  $('scenic').hidden = !sc; if (sc && $('scenic').textContent !== sc.t) $('scenic').textContent = sc.t;
  if (!S.ride.mbtiDone && mates(t).some(m => m.mb && m.mb !== S.prof.mb)) { S.ride.mbtiDone = 1; mission('mbti'); }
}
