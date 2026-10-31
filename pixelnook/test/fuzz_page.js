async function (N) {
  // 在頁面裡模擬小孩亂點：隨機點、隨機拖、亂按按鈕，途中檢查資料有沒有壞掉
  const W = innerWidth, H = innerHeight, errs = [], sleep = ms => new Promise(r => setTimeout(r, ms));
  const onErr = e => errs.push('EXC ' + e.message);
  addEventListener('error', onErr);
  const S = __nook.S;
  const fire = (el, type, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true }));
  const at = (x, y) => document.elementFromPoint(x, y) || document.body;
  const btns = ['#bEdit', '#bShop', '#bLook', '#bVisit', '#bDone', '#bRot', '#bStore', '#bDesel', '[data-close]', '#pvL', '#pvR', '#lookOK', '#bHome', '#bLike', '#rotOK', '#bOut', '#bGoHome', '#bOut', '#bOut'];
  const stats = { tap: 0, drag: 0, btn: 0, ui: 0 };
  const origError = console.error; console.error = (...a) => { errs.push('CONSOLE ' + a.map(String).join(' ').slice(0, 200)); origError.apply(console, a); };
  for (let k = 0; k < N; k++) {
    window.__fz = k + ' ' + __nook.mode;
    const r = Math.random();
    try {
      if (r < 0.15) { stats.btn++; const b = document.querySelector(btns[Math.floor(Math.random() * btns.length)]); if (b && b.offsetParent && !b.disabled) b.click(); }
      else if (r < 0.3) { stats.ui++; const s = [...document.querySelectorAll('#bag .slot, #shopGrid button, .sw button, #edit .tabs button, #visitTabs button, #visitList .r')].filter(b => b.offsetParent); if (s.length) s[Math.floor(Math.random() * s.length)].click(); }
      else if (r < 0.65) { stats.tap++; const x = Math.random() * W, y = Math.random() * H, el = at(x, y); fire(el, 'pointerdown', x, y); fire(el, 'pointerup', x, y); const c = el.closest && el.closest('button,.slot,.r'); if (c) c.click(); }
      else {
        stats.drag++; const x = Math.random() * W, y = Math.random() * H, el = at(x, y), x1 = Math.random() * W, y1 = Math.random() * H;
        fire(el, 'pointerdown', x, y);
        for (let s = 1; s <= 6; s++) { fire(el, 'pointermove', x + (x1 - x) * s / 6, y + (y1 - y) * s / 6); await sleep(8); }
        fire(el, 'pointerup', x1, y1);
      }
    } catch (e) { errs.push('THROW ' + e.message); }
    await sleep(Math.random() < 0.1 ? 500 : 25);
    if (k % 25 === 24) {
      const st = __nook.st;
      st.room.items.forEach(it => { if (!S.canPlace(st.room, it, it)) errs.push('重疊/出界 ' + it.t + ' ' + it.i + ',' + it.j); });
      st.room.walls.forEach(w => { if (!S.canPlace(st.room, w, w)) errs.push('牆面重疊 ' + w.t); });
      if (st.coins < 0) errs.push('金幣負數');
      for (const id in st.bag) if (!(st.bag[id] > 0)) errs.push('背包數量錯 ' + id);
      const me = __nook.me; if (!isFinite(me.i) || !isFinite(me.j)) errs.push('角色座標壞掉');
      const total = id => (st.bag[id] || 0) + st.room.items.concat(st.room.walls).filter(x => x.t === id).length;
      if (total('bed_wood') !== 1) errs.push('原木床數量變了 ' + total('bed_wood'));
    }
  }
  removeEventListener('error', onErr); console.error = origError;
  return { errs: [...new Set(errs)], stats, mode: __nook.mode, coins: __nook.st.coins, items: __nook.st.room.items.length };
}
