// PixelNook 雲端：Firebase Realtime Database REST（不用 SDK、不用帳號）。
// 保護方式：房間存在 nook/rooms/<id>，裡面的 pw 只有主人知道（規則禁止讀 pw，只能讀 t 和 d）；
// 改房間要帶同一個 pw。公開列表 nook/idx 只能跟房間在同一次寫入裡一起更新。
(function (G) {
  'use strict';
  const DB = 'https://stocklife-33366-default-rtdb.asia-southeast1.firebasedatabase.app/nook';
  const TIMEOUT = 8000;
  async function req(path, opt) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      const r = await fetch(DB + path, Object.assign({ signal: ctl.signal, headers: { 'Content-Type': 'application/json' } }, opt || {}));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const txt = await r.text();        // print=silent 會回 204、沒有內容
      return txt ? JSON.parse(txt) : null;
    } finally { clearTimeout(t); }
  }
  const Cloud = {
    // 存自己的房間（同一次寫入：房間＋公開列表）
    async save(id, pw, name, comfort, payload) {
      const t = Date.now();
      const body = {};
      body['rooms/' + id] = { pw, t, d: JSON.stringify(payload) };
      body['idx/' + id] = { n: name, t, c: comfort };
      await req('.json?print=silent', { method: 'PATCH', body: JSON.stringify(body) });
      return t;
    },
    // 每週主題：報名要跟房間同一次寫入（證明是房間主人）
    async submitTheme(week, id, pw, name, comfort, payload) {
      const t = Date.now(), body = {};
      body['rooms/' + id] = { pw, t, d: JSON.stringify(payload) };
      body['idx/' + id] = { n: name, t, c: comfort };
      body['theme/' + week + '/' + id] = { n: name, t, c: comfort };
      await req('.json?print=silent', { method: 'PATCH', body: JSON.stringify(body) });
      return t;
    },
    async themeList(week) { return (await req('/theme/' + encodeURIComponent(week) + '.json')) || {}; },
    async themeVotes(week) { return (await req('/votes/' + encodeURIComponent(week) + '.json')) || {}; },
    async vote(week, id, me, day) { await req('/votes/' + encodeURIComponent(week) + '/' + encodeURIComponent(id) + '/' + encodeURIComponent(me) + '.json?print=silent', { method: 'PUT', body: JSON.stringify(day) }); },
    async recent(n) {
      const o = await req('/idx.json?orderBy=%22t%22&limitToLast=' + (n || 40));
      return Object.entries(o || {}).map(([id, v]) => Object.assign({ id }, v)).sort((a, b) => b.t - a.t);
    },
    async likesAll() { return (await req('/likes.json')) || {}; },
    async idxOf(id) { return await req('/idx/' + encodeURIComponent(id) + '.json'); },
    async room(id) {
      const d = await req('/rooms/' + encodeURIComponent(id) + '/d.json');
      if (typeof d !== 'string') return null;
      try { return JSON.parse(d); } catch (e) { return null; }
    },
    async likeCount(id) {
      const o = await req('/likes/' + encodeURIComponent(id) + '.json?shallow=true');
      return o ? Object.keys(o).length : 0;
    },
    async hasLiked(id, me) { return (await req('/likes/' + encodeURIComponent(id) + '/' + encodeURIComponent(me) + '.json')) !== null; },
    async like(id, me, day) {
      await req('/likes/' + encodeURIComponent(id) + '/' + encodeURIComponent(me) + '.json?print=silent', { method: 'PUT', body: JSON.stringify(day) });
    },
  };
  G.Cloud = Cloud;
})(typeof window !== 'undefined' ? window : globalThis);
