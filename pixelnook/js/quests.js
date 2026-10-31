// PixelNook 任務：新手主線、每日任務、每週任務（純邏輯，可在 Node 測試）
// 遊戲發出事件 → Quests.on(state, type, data) 更新進度；領獎用 Quests.claim()，同一個任務只能領一次。
(function (G) {
  'use strict';
  // 主線：依序完成
  const MAIN = [
    { id: 'm1', title: '歡迎來到小鎮', desc: '出門，走到中央廣場', ev: 'ENTER', match: d => d.scene === 'central', need: 1, coins: 30 },
    { id: 'm2', title: '認識新朋友', desc: '到商業街的咖啡廳，跟 Mia 說說話', ev: 'TALK', match: d => d.npc === 'mia', need: 1, coins: 30 },
    { id: 'm3', title: '第一份工作', desc: '在咖啡廳完成一次打工', ev: 'JOB', match: d => d.served > 0 && (d.job || 'cafe') === 'cafe', need: 1, coins: 80 },
    { id: 'm4', title: '回家看看', desc: '回到自己的房間', ev: 'HOME', need: 1, coins: 30 },
    { id: 'm5', title: '打造新生活', desc: '用賺來的錢在商店買一件家具', ev: 'BUY', need: 1, coins: 0, item: 'poster' },
    { id: 'm6', title: '城市小幫手', desc: '到城市公園（中央廣場左下），幫 Oliver 清理公園', ev: 'JOB', match: d => d.job === 'park' && d.served > 0, need: 1, coins: 50 },
    { id: 'm7', title: '小小收藏家', desc: '在城市裡收集 3 種收藏品（閃光物品、採集、調查）', ev: 'COLLECT', count: d => d.n || 0, need: 3, coins: 80 },
    { id: 'm8', title: '麵包的香味', desc: '到商業街的麵包店，認識麵包師傅 Leo', ev: 'TALK', match: d => d.npc === 'leo', need: 1, coins: 30 },
    { id: 'm9', title: '超市新朋友', desc: '到商業街的超市，認識店員 Nora', ev: 'TALK', match: d => d.npc === 'nora', need: 1, coins: 30 },
    { id: 'm10', title: '城市的委託', desc: '完成一位居民的委託（跟 NPC 說話時選「有什麼需要幫忙的嗎？」）', ev: 'REQ', need: 1, coins: 100 },
  ];
  // 每日任務池（每天抽 3 個）
  const DAILY = [
    { id: 'd_job', title: '咖啡廳幫手', desc: '完成 1 次打工', ev: 'JOB', match: d => d.served > 0, need: 1, coins: 50 },
    { id: 'd_good', title: '專業咖啡師', desc: '在咖啡廳做對 5 杯飲料', ev: 'JOB', match: d => (d.job || 'cafe') === 'cafe', count: d => d.correct || 0, need: 5, coins: 50 },
    { id: 'd_park', title: '公園清潔隊', desc: '幫 Oliver 清理公園 1 次', ev: 'JOB', match: d => d.job === 'park' && d.served > 0, need: 1, coins: 50 },
    { id: 'd_bakery', title: '麵包店幫手', desc: '幫 Leo 分類包裝 1 次', ev: 'JOB', match: d => d.job === 'bakery' && d.served > 0, need: 1, coins: 50 },
    { id: 'd_market', title: '收銀員', desc: '幫 Nora 結帳 1 次', ev: 'JOB', match: d => d.job === 'market' && d.served > 0, need: 1, coins: 50 },
    { id: 'd_deliver', title: '快遞員', desc: '幫麵包店外送 1 次', ev: 'JOB', match: d => d.job === 'delivery' && d.served > 0, need: 1, coins: 50 },
    { id: 'd_pick', title: '尋寶家', desc: '撿到 2 個閃光物品', ev: 'PICK', need: 2, coins: 40 },
    { id: 'd_harvest', title: '採集日', desc: '在公園採集 4 次', ev: 'HARVEST', need: 4, coins: 40 },
    { id: 'd_search', title: '好奇寶寶', desc: '調查 3 個地方', ev: 'SEARCH', need: 3, coins: 30 },
    { id: 'd_chat', title: '聊聊近況', desc: '跟 Mia 聊天', ev: 'TALK', match: d => d.npc === 'mia', need: 1, coins: 30 },
    { id: 'd_visit', title: '串門子', desc: '參觀 2 位玩家的房間', ev: 'VISIT', need: 2, coins: 40 },
    { id: 'd_like', title: '給個讚', desc: '幫別人的房間按讚', ev: 'LIKE', need: 1, coins: 30 },
    { id: 'd_place', title: '換個擺設', desc: '在房間擺放 2 件家具', ev: 'PLACE', need: 2, coins: 30 },
    { id: 'd_buy', title: '小小購物', desc: '在商店買 1 件家具', ev: 'BUY', need: 1, coins: 30 },
    { id: 'd_walk', title: '逛街去', desc: '走到商業街', ev: 'ENTER', match: d => d.scene === 'commercial', need: 1, coins: 30 },
  ];
  const WEEKLY = [
    { id: 'w_job', title: '打工達人', desc: '這週完成 10 次打工', ev: 'JOB', match: d => d.served > 0, need: 10, coins: 300 },
    { id: 'w_visit', title: '社交高手', desc: '這週參觀 5 位玩家的房間', ev: 'VISIT', need: 5, coins: 200 },
  ];
  const DAILY_COUNT = 3;

  const dayNum = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  const weekNum = d => Math.floor((d + 3) / 7);           // 以週一為一週的開始
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); return (n ^ (n >>> 15)) >>> 0; }
  function pickDaily(day) {
    const ids = DAILY.map(q => q.id), out = []; let s = hash(day + 7);
    while (out.length < Math.min(DAILY_COUNT, ids.length)) { s = hash(s + 1); const id = ids[s % ids.length]; if (!out.includes(id)) out.push(id); }
    return out;
  }
  // 確保任務資料存在、日期／週次正確（換日換週會重抽、重置）
  function ensure(st, day) {
    day = day === undefined ? dayNum() : day;
    const q = st.q = st.q || {};
    if (typeof q.main !== 'number') q.main = 0;
    q.mainProg = q.mainProg || 0;
    if (!q.daily || q.daily.day !== day) q.daily = { day, list: pickDaily(day).map(id => ({ id, prog: 0, claimed: false })) };
    const wk = weekNum(day);
    if (!q.weekly || q.weekly.week !== wk) q.weekly = { week: wk, list: WEEKLY.map(w => ({ id: w.id, prog: 0, claimed: false })) };
    return q;
  }
  const defOf = id => MAIN.concat(DAILY, WEEKLY).find(x => x.id === id);
  function hit(def, type, data) {
    if (def.ev !== type) return 0;
    if (def.match && !def.match(data || {})) return 0;
    return def.count ? def.count(data || {}) : 1;
  }
  // 回傳「剛完成」的任務清單（給畫面提示用）
  function on(st, type, data, day) {
    const q = ensure(st, day), done = [];
    const m = MAIN[q.main];
    if (m && q.mainProg < m.need) { const n = hit(m, type, data); if (n) { q.mainProg = Math.min(m.need, q.mainProg + n); if (q.mainProg >= m.need) done.push(m); } }
    for (const it of q.daily.list.concat(q.weekly.list)) {
      const d = defOf(it.id); if (it.prog >= d.need) continue;
      const n = hit(d, type, data); if (!n) continue;
      it.prog = Math.min(d.need, it.prog + n); if (it.prog >= d.need) done.push(d);
    }
    return done;
  }
  // 領獎：回傳 {coins, item} 或 null（不能領／已領）
  function claim(st, id, day) {
    const q = ensure(st, day);
    const m = MAIN[q.main];
    if (m && m.id === id) {
      if (q.mainProg < m.need) return null;
      q.main++; q.mainProg = 0;
      return { coins: m.coins, item: m.item || null, def: m };
    }
    const it = q.daily.list.concat(q.weekly.list).find(x => x.id === id);
    if (!it || it.claimed) return null;
    const d = defOf(id); if (it.prog < d.need) return null;
    it.claimed = true;
    return { coins: d.coins, item: null, def: d };
  }
  function claimable(st, day) {
    const q = ensure(st, day); let n = 0;
    const m = MAIN[q.main]; if (m && q.mainProg >= m.need) n++;
    for (const it of q.daily.list.concat(q.weekly.list)) if (!it.claimed && it.prog >= defOf(it.id).need) n++;
    return n;
  }
  function current(st, day) { const q = ensure(st, day); return MAIN[q.main] ? { def: MAIN[q.main], prog: q.mainProg } : null; }
  // 之後新增主線步驟（例如公園開放）時，接在後面即可，已完成的玩家會自動接到新步驟
  function addMain(step) { if (!MAIN.some(m => m.id === step.id)) MAIN.push(step); }
  function addDaily(def) { if (!DAILY.some(m => m.id === def.id)) DAILY.push(def); }

  G.Quests = { MAIN, DAILY, WEEKLY, DAILY_COUNT, dayNum, weekNum, pickDaily, ensure, on, claim, claimable, current, defOf, addMain, addDaily };
})(typeof window !== 'undefined' ? window : globalThis);
