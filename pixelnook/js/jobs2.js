// PixelNook 打工小遊戲 2：麵包分類包裝（Leo）、超市收銀找零（Nora）
// 計分都用同一套：Score = 0.7A + 0.2T + 0.1C；薪水 = B × (0.6 + 0.4 × Score / 100)
(function (G) {
  'use strict';
  const J = () => G.CafeJob;   // 共用 levelOf / pay / DAILY_PAID
  // ---------------- 麵包分類 ----------------
  const BREADS = {
    bread_loaf: { name: '吐司', basket: 'square', emoji: '🍞' }, muffin: { name: '瑪芬', basket: 'square', emoji: '🧁' },
    baguette: { name: '法棍', basket: 'long', emoji: '🥖' }, pretzel: { name: '扭結麵包', basket: 'long', emoji: '🥨' },
    bun: { name: '圓麵包', basket: 'round', emoji: '🍔' }, croissant2: { name: '可頌', basket: 'round', emoji: '🥐' },
  };
  const BASKETS = { square: { name: '方形籃', icon: 'basket_loaf' }, long: { name: '長籃', icon: 'basket_long' }, round: { name: '圓籃', icon: 'basket_round' } };
  const BAKERY = { DURATION: 75, TARGET: 22, BASE: 90, PATIENCE: 4.0 };
  function breadScore(st) {
    const n = st.tried || 0, A = n ? st.correct / n * 100 : 0, T = Math.min(100, st.correct / BAKERY.TARGET * 100), C = n ? st.bestStreak / n * 100 : 0;
    return Math.round(0.7 * A + 0.2 * T + 0.1 * C);
  }
  // ---------------- 收銀找零 ----------------
  const GOODS = {
    item_apple: { name: '蘋果', price: 12, emoji: '🍎' }, item_milk: { name: '牛奶', price: 25, emoji: '🥛' }, item_bread: { name: '麵包', price: 30, emoji: '🍞' },
    item_juice: { name: '果汁', price: 20, emoji: '🧃' }, item_eggs: { name: '雞蛋', price: 45, emoji: '🥚' }, item_cheese: { name: '起司', price: 38, emoji: '🧀' },
    item_fish: { name: '魚', price: 60, emoji: '🐟' }, item_cereal: { name: '穀片', price: 42, emoji: '🥣' },
  };
  const COINS = [{ v: 1, icon: 'coin_1' }, { v: 5, icon: 'coin_5' }, { v: 10, icon: 'coin_10' }, { v: 50, icon: 'coin_50' }];
  const CASHIER = { DURATION: 120, TARGET: 6, BASE: 100 };
  function newCustomer(rnd) {
    const ids = Object.keys(GOODS), n = 2 + Math.floor(rnd() * 3), items = [];
    for (let k = 0; k < n; k++) items.push(ids[Math.floor(rnd() * ids.length)]);
    const total = items.reduce((s, id) => s + GOODS[id].price, 0);
    const pays = [50, 100, 200, 500].filter(p => p >= total), exact = rnd() < 0.15;
    return { items, total, paid: exact ? total : pays[0] };
  }
  const changeOf = c => c.paid - c.total;
  function cashierScore(st) {
    const n = st.served || 0, A = n ? st.correct / n * 100 : 0, T = Math.min(100, st.correct / CASHIER.TARGET * 100), C = n ? st.bestStreak / n * 100 : 0;
    return Math.round(0.7 * A + 0.2 * T + 0.1 * C);
  }
  const Logic = { BREADS, BASKETS, BAKERY, breadScore, GOODS, COINS, CASHIER, newCustomer, changeOf, cashierScore };

  // ---------------- 介面共用 ----------------
  function icon(key, emoji, size) {
    const icons = Object.assign({}, G.ART && G.ART.cafe && G.ART.cafe.ICONS, G.ART && G.ART.shops && G.ART.shops.ICONS);
    const c = document.createElement('canvas'); c.width = 32; c.height = 32; c.className = 'ico'; if (size) c.style.width = c.style.height = size + 'px';
    if (icons[key] && G.PX) { try { const pix = new G.PX.Pix(32, 32); icons[key](pix, 0, 0); c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pix.d.buffer.slice(0)), 32, 32), 0, 0); return c; } catch (e) {} }
    const g = c.getContext('2d'); g.font = '24px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emoji || '?', 16, 17); return c;
  }
  const sfx = n => { try { G.SFX && G.SFX.play(n); } catch (e) {} };
  function endScreen(root, title, rows, coins, paid, served, xp, levelUp, newLv, onBack) {
    root.innerHTML = `<div class="jobEnd"><h3>${title}</h3>${rows.map(([a, b]) => `<div class="row"><span>${a}</span><b>${b}</b></div>`).join('')}
      <div class="row big"><span>薪水</span><b>${coins} 金幣</b></div>
      ${paid ? '' : `<div class="note">${served ? `今天已經領過 ${J().DAILY_PAID} 次完整薪水了，明天再來吧！（還是可以繼續練習）` : '這次沒有完成任何工作，沒有薪水'}</div>`}
      <div class="row"><span>熟練度</span><b>+${xp}${levelUp ? `　🎉 升到 Lv.${newLv}！` : ''}</b></div>
      <button class="pri" id="jBack">回到店裡</button></div>`;
    root.querySelector('#jBack').onclick = onBack;
  }
  // ---------------- 麵包分類 UI ----------------
  function openBakery(root, job, onDone) {
    const lv = J().levelOf(job.xp || 0), st = { tried: 0, correct: 0, streak: 0, bestStreak: 0 };
    const kinds = Object.keys(BREADS), patience = Math.max(2.2, BAKERY.PATIENCE - (lv - 1) * 0.35);
    let queue = [], left = BAKERY.DURATION, ended = false, itemT = 0, timer = 0, raf = 0, last = performance.now();
    const next = () => kinds[Math.floor(Math.random() * kinds.length)];
    for (let k = 0; k < 4; k++) queue.push(next());
    root.innerHTML = `<div class="jobTop"><b>🥖 麵包分類包裝</b><span class="sp"></span><span>⏱ <b id="bTime">1:15</b></span><span>✔ <b id="bOk">0</b></span><span>Lv.${lv}</span><button id="bQuit">結束</button></div>
      <div class="belt"><div class="beltItems" id="bBelt"></div><div class="beltBar"><i id="bPat"></i></div></div>
      <div class="hint" style="text-align:center">把輸送帶最前面（左邊大的那個）的麵包放進對的籃子！</div>
      <div class="baskets" id="bBaskets"></div><div class="jobMsg" id="bMsg"></div>`;
    const $ = s => root.querySelector(s);
    for (const b in BASKETS) {
      const el = document.createElement('button'); el.className = 'basket';
      el.appendChild(icon(BASKETS[b].icon, '🧺', 44));
      const n = document.createElement('div'); n.className = 'bn'; n.textContent = BASKETS[b].name; el.appendChild(n);
      const ex = document.createElement('div'); ex.className = 'bex';
      for (const k of kinds.filter(k => BREADS[k].basket === b)) ex.appendChild(icon(k, BREADS[k].emoji, 22));
      el.appendChild(ex);
      el.onclick = () => sort(b); $('#bBaskets').appendChild(el);
    }
    function draw() {
      const belt = $('#bBelt'); belt.innerHTML = '';
      queue.forEach((k, i) => { const w = document.createElement('div'); w.className = 'bi' + (i === 0 ? ' first' : ''); w.appendChild(icon(k, BREADS[k].emoji, i === 0 ? 56 : 34)); if (i === 0) { const n = document.createElement('div'); n.textContent = BREADS[k].name; w.appendChild(n); } belt.appendChild(w); });
    }
    function msg(t, good) { const m = $('#bMsg'); m.textContent = t; m.className = 'jobMsg ' + (good ? 'good' : 'bad'); clearTimeout(m._t); m._t = setTimeout(() => { m.textContent = ''; }, 700); }
    function advance() { queue.shift(); queue.push(next()); itemT = 0; draw(); }
    function sort(b) {
      if (ended) return;
      st.tried++;
      if (BREADS[queue[0]].basket === b) { st.correct++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); msg('放對了！', true); sfx('good'); }
      else { st.streak = 0; msg('放錯籃子了…', false); sfx('bad'); }
      $('#bOk').textContent = st.correct; advance();
    }
    function frame(now) {
      if (ended) return; const dt = (now - last) / 1000; last = now; itemT += dt;
      $('#bPat').style.width = Math.max(0, 100 - itemT / patience * 100) + '%';
      if (itemT >= patience) { st.tried++; st.streak = 0; msg('麵包掉下去了！', false); sfx('bad'); advance(); }
      raf = requestAnimationFrame(frame);
    }
    $('#bQuit').onclick = () => finish(true);
    function finish(quit) {
      if (ended) return; ended = true; clearInterval(timer); cancelAnimationFrame(raf);
      const sc = breadScore(st), paid = job.paidToday < J().DAILY_PAID && st.correct > 0, coins = paid ? J().pay(sc, BAKERY.BASE) : 0, xp = st.correct * 5;
      const newLv = J().levelOf((job.xp || 0) + xp);
      endScreen(root, quit ? '提早下班了' : '下班囉！', [['分類', st.tried + ' 個'], ['放對', `${st.correct} 個（最高連續 ${st.bestStreak}）`], ['工作分數', sc + ' 分']], coins, paid, st.correct, xp, newLv > lv, newLv,
        () => onDone({ served: st.tried, correct: st.correct, score: sc, coins, xp, paid, levelUp: newLv > lv }));
    }
    timer = setInterval(() => { left--; $('#bTime').textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'); if (left <= 0) finish(false); }, 1000);
    draw(); raf = requestAnimationFrame(frame);
    return { stop: () => { ended = true; clearInterval(timer); cancelAnimationFrame(raf); } };
  }
  // ---------------- 收銀找零 UI ----------------
  function openCashier(root, job, onDone) {
    const lv = J().levelOf(job.xp || 0), st = { served: 0, correct: 0, streak: 0, bestStreak: 0 }, rnd = Math.random;
    let cust = newCustomer(rnd), scanned = [], change = [], left = CASHIER.DURATION, ended = false, timer = 0, phase = 'scan';
    root.innerHTML = `<div class="jobTop"><b>🛒 超市收銀</b><span class="sp"></span><span>⏱ <b id="cTime">2:00</b></span><span>✔ <b id="cOk">0</b></span><span>Lv.${lv}</span><button id="cQuit">結束</button></div>
      <div class="cashMain"><div class="cashBox"><div class="lbl">① 點商品掃描</div><div class="goods" id="cGoods"></div><div class="tot">總價：<b id="cTotal">0</b> 元</div></div>
      <div class="cashBox"><div class="lbl">② 客人付 <b id="cPaid">?</b> 元，要找 <b id="cNeed">?</b> 元</div><div class="change" id="cChange"></div><div class="tot">已找：<b id="cGiven">0</b> 元</div>
      <div class="coins" id="cCoins"></div><div class="acts"><button id="cReset">重找</button><button class="pri" id="cDone">找好了 ➜</button></div></div></div>
      <div class="jobMsg" id="cMsg"></div>`;
    const $ = s => root.querySelector(s);
    for (const c of COINS) { const b = document.createElement('button'); b.className = 'coinb'; b.appendChild(icon(c.icon, '🪙', 36)); const n = document.createElement('span'); n.textContent = c.v; b.appendChild(n); b.onclick = () => give(c.v); $('#cCoins').appendChild(b); }
    function msg(t, good) { const m = $('#cMsg'); m.textContent = t; m.className = 'jobMsg ' + (good ? 'good' : 'bad'); clearTimeout(m._t); m._t = setTimeout(() => { m.textContent = ''; }, 1100); }
    function draw() {
      const g = $('#cGoods'); g.innerHTML = '';
      cust.items.forEach((id, k) => { const b = document.createElement('button'); b.className = 'good' + (scanned.includes(k) ? ' done' : ''); b.appendChild(icon(id, GOODS[id].emoji, 36)); const n = document.createElement('span'); n.textContent = `${GOODS[id].name} ${GOODS[id].price}`; b.appendChild(n); b.onclick = () => scan(k); g.appendChild(b); });
      const tot = scanned.reduce((s, k) => s + GOODS[cust.items[k]].price, 0);
      $('#cTotal').textContent = tot;
      const all = scanned.length === cust.items.length;
      $('#cPaid').textContent = all ? cust.paid : '?'; $('#cNeed').textContent = all ? (lv <= 2 ? changeOf(cust) : '？（自己算）') : '?';
      $('#cGiven').textContent = change.reduce((s, v) => s + v, 0);
      const ch = $('#cChange'); ch.innerHTML = ''; for (const v of change) ch.appendChild(icon(COINS.find(c => c.v === v).icon, '🪙', 24));
      root.querySelector('.cashBox:last-child').classList.toggle('off', !all);
    }
    function scan(k) { if (ended || scanned.includes(k)) return; scanned.push(k); sfx('pickup'); if (scanned.length === cust.items.length) { phase = 'change'; msg('客人付了 ' + cust.paid + ' 元', true); } draw(); }
    function give(v) { if (ended || phase !== 'change') { msg('先把商品都掃描完'); return; } if (change.length >= 12) return; change.push(v); sfx('coin'); draw(); }
    $('#cReset').onclick = () => { change = []; draw(); };
    $('#cDone').onclick = () => {
      if (ended) return; if (phase !== 'change') { msg('先把商品都掃描完'); return; }
      st.served++;
      const ok = change.reduce((s, v) => s + v, 0) === changeOf(cust);
      if (ok) { st.correct++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); msg('找錢正確，謝謝光臨！', true); sfx('good'); }
      else { st.streak = 0; msg(`找錯了…應該找 ${changeOf(cust)} 元`, false); sfx('bad'); }
      $('#cOk').textContent = st.correct;
      cust = newCustomer(rnd); scanned = []; change = []; phase = 'scan'; draw();
    };
    $('#cQuit').onclick = () => finish(true);
    function finish(quit) {
      if (ended) return; ended = true; clearInterval(timer);
      const sc = cashierScore(st), paid = job.paidToday < J().DAILY_PAID && st.served > 0, coins = paid ? J().pay(sc, CASHIER.BASE) : 0, xp = st.correct * 15;
      const newLv = J().levelOf((job.xp || 0) + xp);
      endScreen(root, quit ? '提早下班了' : '下班囉！', [['結帳客人', st.served + ' 位'], ['找錢正確', `${st.correct} 位（最高連續 ${st.bestStreak}）`], ['工作分數', sc + ' 分']], coins, paid, st.served, xp, newLv > lv, newLv,
        () => onDone({ served: st.served, correct: st.correct, score: sc, coins, xp, paid, levelUp: newLv > lv }));
    }
    timer = setInterval(() => { left--; $('#cTime').textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'); if (left <= 0) finish(false); }, 1000);
    draw();
    return { stop: () => { ended = true; clearInterval(timer); } };
  }
  G.Jobs2 = Object.assign({ openBakery, openCashier }, Logic);
})(typeof window !== 'undefined' ? window : globalThis);
