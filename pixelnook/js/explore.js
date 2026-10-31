// PixelNook 探索與收藏（純邏輯，可在 Node 測試）
// 閃光物品：每個戶外區域每天 3 個固定位置；採集：每個花叢每天一次；調查：每個地點每天一次。
// 結果用「日期＋地點」當種子決定，重新整理也不會變（不能靠重開刷寶物）。
(function (G) {
  'use strict';
  const SERIES = {
    city:   { name: '城市紀念品', reward: { coins: 200 } },
    nature: { name: '自然收藏',   reward: { coins: 200, item: 'plant_b' } },
    food:   { name: '食物收藏',   reward: { coins: 250 } },
    hidden: { name: '隱藏收藏',   reward: { coins: 600, item: 'piano_modern' } },
  };
  const COLLECT = {
    postcard: { name: '明信片', series: 'city', emoji: '💌' }, badge: { name: '徽章', series: 'city', emoji: '🎖️' },
    old_photo: { name: '舊照片', series: 'city', emoji: '🖼️' }, ticket: { name: '電影票', series: 'city', emoji: '🎟️' },
    key_old: { name: '舊鑰匙', series: 'city', emoji: '🗝️' }, marble: { name: '彈珠', series: 'city', emoji: '🔮' },
    flower_red: { name: '紅色小花', series: 'nature', emoji: '🌺' }, flower_yellow: { name: '黃色小花', series: 'nature', emoji: '🌼' },
    flower_blue: { name: '藍色小花', series: 'nature', emoji: '💠' }, leaf_maple: { name: '楓葉', series: 'nature', emoji: '🍁' },
    acorn: { name: '橡實', series: 'nature', emoji: '🌰' }, clover4: { name: '四葉草', series: 'nature', emoji: '🍀' },
    feather: { name: '羽毛', series: 'nature', emoji: '🪶' }, mushroom: { name: '蘑菇', series: 'nature', emoji: '🍄' },
    coffee_bean: { name: '咖啡豆', series: 'food', emoji: '☕' }, croissant: { name: '可頌', series: 'food', emoji: '🥐' },
    cake_slice: { name: '蛋糕', series: 'food', emoji: '🍰' }, macaron: { name: '馬卡龍', series: 'food', emoji: '🧁' },
    cookie: { name: '餅乾', series: 'food', emoji: '🍪' }, donut: { name: '甜甜圈', series: 'food', emoji: '🍩' },
    gold_coin: { name: '古金幣', series: 'hidden', emoji: '🪙' }, music_box: { name: '音樂盒', series: 'hidden', emoji: '🎵' },
    compass: { name: '羅盤', series: 'hidden', emoji: '🧭' }, star_shard: { name: '星星碎片', series: 'hidden', emoji: '⭐' },
  };
  const MATS = { mat_flower: { name: '花瓣', emoji: '🌸' }, mat_leaf: { name: '葉子', emoji: '🌿' }, mat_mushroom: { name: '蘑菇', emoji: '🍄' }, mat_wood: { name: '樹枝', emoji: '🪵' } };
  // 採集：物件種類 → [材料, 數量範圍, 收藏品, 機率]
  const HARVEST = {
    flower_patch_red: ['mat_flower', [1, 2], 'flower_red', 0.3], flower_patch_yellow: ['mat_flower', [1, 2], 'flower_yellow', 0.3],
    flower_patch_blue: ['mat_flower', [1, 2], 'flower_blue', 0.3], herb_bush: ['mat_leaf', [1, 3], 'clover4', 0.12],
    mushroom_log: ['mat_mushroom', [1, 2], 'mushroom', 0.25], tree_big: ['mat_wood', [1, 2], 'acorn', 0.2],
  };
  // 調查：地點種類 → [[收藏品, 機率], ...]
  const SEARCH = {
    fountain: [['gold_coin', 0.15], ['marble', 0.3]], mailbox: [['postcard', 0.35], ['old_photo', 0.2]],
    bench: [['ticket', 0.25], ['key_old', 0.15]], bulletin_board: [['badge', 0.3], ['postcard', 0.15]],
    gazebo: [['music_box', 0.12], ['feather', 0.3]], pond_rock: [['compass', 0.12], ['marble', 0.2]],
    tree_round: [['leaf_maple', 0.3], ['feather', 0.15]], picnic_table: [['cookie', 0.2], ['ticket', 0.1]],
  };
  const SPARKLES_PER_AREA = 3;

  function hash(str) { let h = 2166136261; for (let k = 0; k < str.length; k++) { h ^= str.charCodeAt(k); h = Math.imul(h, 16777619); } return h >>> 0; }
  const rnd = key => (hash(key) % 100000) / 100000;   // 0~1，同一個 key 永遠一樣
  const dayNum = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);

  function ensure(st, day) {
    day = day === undefined ? dayNum() : day;
    st.mats = st.mats || {}; st.col = st.col || {}; st.seriesDone = st.seriesDone || {};
    if (!st.ex || st.ex.day !== day) st.ex = { day, done: {} };
    return st.ex;
  }
  // 今天這個區域的閃光物品位置（free = 可以走的格子清單）
  function sparkles(st, area, free, day) {
    const ex = ensure(st, day), out = [];
    if (!free.length) return out;
    const used = new Set();
    // 先決定今天固定的 3 個位置，再拿掉已經撿走的（撿走不會補新的）
    for (let k = 0; used.size < Math.min(SPARKLES_PER_AREA, free.length) && k < 50; k++) {
      const c = free[hash(ex.day + ':' + area + ':s' + k) % free.length], key = 'sp:' + area + ':' + c[0] + ',' + c[1];
      if (used.has(key)) continue; used.add(key);
      out.push({ key, i: c[0], j: c[1] });
    }
    return out.filter(s => !ex.done[s.key]);
  }
  function give(st, id, n) {
    if (COLLECT[id]) { const first = !st.col[id]; st.col[id] = (st.col[id] || 0) + (n || 1); return first; }
    if (MATS[id]) { st.mats[id] = (st.mats[id] || 0) + (n || 1); return false; }
    return false;
  }
  // 撿閃光物品
  function pickSparkle(st, key, area, day) {
    const ex = ensure(st, day); if (ex.done[key]) return null; ex.done[key] = 1;
    const r = rnd(ex.day + key), night = new Date().getHours() >= 19 || new Date().getHours() < 5;
    if (night && r < 0.06) { const f = give(st, 'star_shard'); return { item: 'star_shard', first: f }; }
    if (r < 0.55) return { coins: 5 + Math.floor(rnd(ex.day + key + 'c') * 26) };
    const pool = area === 'park' ? ['acorn', 'feather', 'leaf_maple', 'clover4'] : ['postcard', 'badge', 'old_photo', 'ticket', 'key_old', 'marble'];
    const id = pool[Math.floor(rnd(ex.day + key + 'i') * pool.length)], f = give(st, id);
    return { item: id, first: f };
  }
  function harvested(st, key, day) { return !!ensure(st, day).done['hv:' + key]; }
  function harvest(st, kind, key, day) {
    const ex = ensure(st, day), h = HARVEST[kind]; if (!h || ex.done['hv:' + key]) return null;
    ex.done['hv:' + key] = 1;
    const [mat, [a, b], col, p] = h, n = a + Math.floor(rnd(ex.day + key + 'n') * (b - a + 1));
    give(st, mat, n);
    const res = { mat, n };
    if (rnd(ex.day + key + 'x') < p) { res.item = col; res.first = give(st, col); }
    return res;
  }
  function searched(st, key, day) { return !!ensure(st, day).done['se:' + key]; }
  function search(st, kind, key, day) {
    const ex = ensure(st, day), list = SEARCH[kind]; if (!list) return null;
    if (ex.done['se:' + key]) return { again: true };
    ex.done['se:' + key] = 1;
    let r = rnd(ex.day + key + 'se');
    for (const [id, p] of list) { if (r < p) return { item: id, first: give(st, id) }; r -= p; }
    return { nothing: true };
  }
  // 打工獎勵：咖啡豆（第一次必給）、表現好有機會拿到點心
  function jobBonus(st, job, score, day) {
    if (job !== 'cafe') return null;
    if (!st.col.coffee_bean) return { item: 'coffee_bean', first: give(st, 'coffee_bean') };
    if (score >= 80 && Math.random() < 0.4) { const pool = ['croissant', 'cake_slice', 'macaron', 'cookie', 'donut']; const id = pool[Math.floor(Math.random() * pool.length)]; return { item: id, first: give(st, id) }; }
    return null;
  }
  function seriesProgress(st, s) { const ids = Object.keys(COLLECT).filter(k => COLLECT[k].series === s); return { have: ids.filter(k => st.col && st.col[k]).length, total: ids.length, ids }; }
  function claimSeries(st, s) {
    ensure(st); const p = seriesProgress(st, s);
    if (p.have < p.total || st.seriesDone[s]) return null;
    st.seriesDone[s] = 1; return SERIES[s].reward;
  }
  G.Explore = { SERIES, COLLECT, MATS, HARVEST, SEARCH, SPARKLES_PER_AREA, ensure, sparkles, pickSparkle, harvest, harvested, search, searched, jobBonus, seriesProgress, claimSeries, give, rnd };
})(typeof window !== 'undefined' ? window : globalThis);
