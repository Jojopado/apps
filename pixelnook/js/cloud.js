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
    // 存檔備份：位置是「存檔碼」的 SHA-256，不知道存檔碼就找不到
    async hashCode(code) {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pixelnook:' + code.toUpperCase().replace(/[^A-Z0-9]/g, '')));
      return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
    },
    async backup(code, state) { const h = await this.hashCode(code), t = Date.now(); await req('/xfer/' + h + '.json?print=silent', { method: 'PUT', body: JSON.stringify({ s: JSON.stringify(state), t }) }); return t; },
    async backupTime(code) { const h = await this.hashCode(code); const t = await req('/xfer/' + h + '/t.json'); return typeof t === 'number' ? t : 0; },
    // ---- 帳號密碼：帳號名稱登記在 users/<帳號>（只能註冊一次）；
    // 存檔碼放在 acct/<PBKDF2(帳號+密碼)>，不知道密碼就算不出位置，也就拿不到存檔碼 ----
    normUser(u) { u = String(u || '').trim().toLowerCase(); return /^[a-z0-9_]{3,16}$/.test(u) ? u : null; },
    async acctKey(u, pw) {
      const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pw)), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode('pixelnook-acct:' + u), iterations: 120000 }, base, 256);
      return Array.from(new Uint8Array(bits), x => x.toString(16).padStart(2, '0')).join('');
    },
    async userExists(u) { return (await req('/users/' + u + '.json')) !== null; },
    async register(u, pw, code) {
      if (await this.userExists(u)) { const e = new Error('taken'); e.code = 'taken'; throw e; }
      const k = await this.acctKey(u, pw), t = Date.now(), body = {};
      body['users/' + u] = { t }; body['acct/' + k] = { c: code, t };
      try { await req('.json?print=silent', { method: 'PATCH', body: JSON.stringify(body) }); }
      catch (e) { if (/HTTP 40[13]/.test(e.message)) { const e2 = new Error('taken'); e2.code = 'taken'; throw e2; } throw e; }
    },
    // 回傳存檔碼；帳號不存在回 'nouser'、密碼錯回 'badpw'
    async login(u, pw) {
      const o = await req('/acct/' + (await this.acctKey(u, pw)) + '.json');
      if (o && typeof o.c === 'string') return o.c;
      return (await this.userExists(u)) ? 'badpw' : 'nouser';
    },
    async changePw(u, oldPw, newPw) {
      const k0 = await this.acctKey(u, oldPw), o = await req('/acct/' + k0 + '.json');
      if (!o || typeof o.c !== 'string') return false;
      const k1 = await this.acctKey(u, newPw);
      await req('/acct/' + k1 + '.json?print=silent', { method: 'PUT', body: JSON.stringify({ c: o.c, t: Date.now() }) });
      if (k1 !== k0) await req('/acct/' + k0 + '.json?print=silent', { method: 'DELETE' });
      return true;
    },
    async restore(code) { const h = await this.hashCode(code); const o = await req('/xfer/' + h + '.json'); if (!o || typeof o.s !== 'string') return null; try { return { state: JSON.parse(o.s), t: o.t }; } catch (e) { return null; } },
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
