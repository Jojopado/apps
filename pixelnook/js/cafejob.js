// PixelNook 咖啡廳打工：規則（純函式，可在 Node 測試）＋介面（瀏覽器）
// 計分：Score = 0.7A + 0.2T + 0.1C；薪水 = B × (0.6 + 0.4 × Score / 100)，B = 100
(function (G) {
  'use strict';
  const RECIPES = {
    americano:      { name: '熱美式',   cup: 'hot',  items: ['coffee'],                  lv: 1, icon: 'americano' },
    latte:          { name: '熱拿鐵',   cup: 'hot',  items: ['coffee', 'milk'],          lv: 1, icon: 'latte' },
    iced_americano: { name: '冰美式',   cup: 'iced', items: ['ice', 'coffee'],           lv: 1, icon: 'americano' },
    iced_latte:     { name: '冰拿鐵',   cup: 'iced', items: ['ice', 'coffee', 'milk'],   lv: 1, icon: 'iced_latte' },
    cappuccino:     { name: '卡布奇諾', cup: 'hot',  items: ['coffee', 'milk', 'foam'],  lv: 2, icon: 'cappuccino' },
    caramel_latte:  { name: '焦糖拿鐵', cup: 'hot',  items: ['coffee', 'milk', 'syrup'], lv: 3, icon: 'latte' },
  };
  const INGS = [
    { id: 'cup_hot', name: '熱杯', icon: 'cup_empty', emoji: '☕' },
    { id: 'cup_iced', name: '冰杯', icon: 'cup_empty', emoji: '🥤' },
    { id: 'coffee', name: '咖啡', icon: 'coffee', emoji: '🫘' },
    { id: 'milk', name: '牛奶', icon: 'milk', emoji: '🥛' },
    { id: 'foam', name: '奶泡', icon: 'foam', emoji: '☁️' },
    { id: 'ice', name: '冰塊', icon: 'ice', emoji: '🧊' },
    { id: 'syrup', name: '焦糖', icon: 'syrup', emoji: '🍯' },
  ];
  const LEVELS = [0, 100, 300, 600, 1000];
  const DURATION = 120, TARGET = 8, BASE_PAY = 100, DAILY_PAID = 3;

  const levelOf = xp => { let l = 1; for (let k = 1; k < LEVELS.length; k++) if (xp >= LEVELS[k]) l = k + 1; return l; };
  const menuFor = lv => Object.keys(RECIPES).filter(k => RECIPES[k].lv <= lv);
  function newOrder(lv, rnd, prev) {
    const m = menuFor(lv); let k;
    do { k = m[Math.floor(rnd() * m.length)]; } while (m.length > 1 && k === prev);
    return k;
  }
  // 杯子內容是否符合訂單（材料順序不重要，但不能多也不能少）
  function matches(cup, key) {
    const r = RECIPES[key]; if (!r || !cup.cup || cup.cup !== r.cup) return false;
    const a = cup.items.slice().sort(), b = r.items.slice().sort();
    return a.length === b.length && a.every((x, k) => x === b[k]);
  }
  function score(stats) {
    const served = stats.served || 0;
    const A = served ? stats.correct / served * 100 : 0;
    const T = Math.min(100, stats.correct / TARGET * 100);
    const C = served ? stats.bestStreak / served * 100 : 0;
    return Math.round(0.7 * A + 0.2 * T + 0.1 * C);
  }
  const pay = (sc, base) => Math.round((base || BASE_PAY) * (0.6 + 0.4 * sc / 100));

  const Logic = { RECIPES, INGS, LEVELS, DURATION, TARGET, BASE_PAY, DAILY_PAID, levelOf, menuFor, newOrder, matches, score, pay };

  // ---------------- 介面 ----------------
  function iconCanvas(key, emoji) {
    const icons = G.ART && G.ART.cafe && G.ART.cafe.ICONS;
    const c = document.createElement('canvas'); c.width = 32; c.height = 32; c.className = 'ico';
    if (icons && icons[key] && G.PX) {
      try { const pix = new G.PX.Pix(32, 32); icons[key](pix, 0, 0); c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pix.d.buffer.slice(0)), 32, 32), 0, 0); return c; } catch (e) {}
    }
    const g = c.getContext('2d'); g.font = '24px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emoji || '?', 16, 17);
    return c;
  }
  // job = { xp, paidToday }；onDone({correct, served, score, coins, xp, levelUp, paid})
  function open(root, job, onDone) {
    const lv = levelOf(job.xp || 0), rnd = Math.random;
    const st = { served: 0, correct: 0, streak: 0, bestStreak: 0 };
    let order = newOrder(lv, rnd), cup = { cup: null, items: [] }, left = DURATION, timer = 0, ended = false, lock = false;
    const hint = lv <= 2;
    root.innerHTML = `
      <div class="jobTop"><b>☕ 咖啡廳打工</b><span class="sp"></span><span class="tm">⏱ <b id="jTime">2:00</b></span>
        <span>✔ <b id="jOk">0</b></span><span>Lv.${lv}</span><button id="jQuit">結束</button></div>
      <div class="jobMain">
        <div class="jobCust"><div class="face" id="jFace"></div><div class="bubble"><div id="jOrderIco"></div><div><b id="jOrder"></b><div class="hint" id="jHint"></div></div></div></div>
        <div class="jobCup"><div class="lbl">你的杯子</div><div class="cup" id="jCup"></div>
          <div class="acts"><button id="jTrash">🗑 倒掉重做</button><button class="pri" id="jServe">送出 ➜</button></div></div>
      </div>
      <div class="jobIngs" id="jIngs"></div>
      <div class="jobMsg" id="jMsg"></div>`;
    const $ = s => root.querySelector(s);
    const ings = $('#jIngs');
    for (const g of INGS) {
      const b = document.createElement('button'); b.className = 'ing';
      b.appendChild(iconCanvas(g.icon, g.emoji));
      const n = document.createElement('span'); n.textContent = g.name; b.appendChild(n);
      b.onclick = () => add(g.id); ings.appendChild(b);
    }
    function drawOrder() {
      const r = RECIPES[order];
      $('#jOrder').textContent = r.name;
      const nm = id => (INGS.find(x => x.id === id) || {}).name;
      $('#jHint').textContent = hint ? '做法：' + (r.cup === 'hot' ? '熱杯' : '冰杯') + ' ＋ ' + r.items.map(nm).join(' ＋ ') : '';
      const oi = $('#jOrderIco'); oi.innerHTML = ''; oi.appendChild(iconCanvas(r.icon, r.cup === 'iced' ? '🧋' : '☕'));
      const f = $('#jFace'); f.innerHTML = ''; f.appendChild(iconCanvas('customer_wait', '🙂'));
    }
    function drawCup() {
      const c = $('#jCup'); c.innerHTML = '';
      if (!cup.cup) { c.textContent = '先選一個杯子'; return; }
      const add1 = (key, emoji, name) => { const w = document.createElement('div'); w.className = 'ci'; w.appendChild(iconCanvas(key, emoji)); const s = document.createElement('span'); s.textContent = name; w.appendChild(s); c.appendChild(w); };
      add1('cup_empty', cup.cup === 'hot' ? '☕' : '🥤', cup.cup === 'hot' ? '熱杯' : '冰杯');
      for (const id of cup.items) { const g = INGS.find(x => x.id === id); add1(g.icon, g.emoji, g.name); }
    }
    function msg(t, good) { const m = $('#jMsg'); m.textContent = t; m.className = 'jobMsg ' + (good ? 'good' : 'bad'); clearTimeout(m._t); m._t = setTimeout(() => { m.textContent = ''; }, 1100); }
    function add(id) {
      if (ended || lock) return;
      if (id === 'cup_hot' || id === 'cup_iced') { if (cup.cup) { msg('已經有杯子了，要重做請先倒掉'); return; } cup.cup = id === 'cup_hot' ? 'hot' : 'iced'; }
      else { if (!cup.cup) { msg('先選杯子喔'); return; } if (cup.items.length >= 5) { msg('杯子滿了'); return; } cup.items.push(id); }
      drawCup();
    }
    $('#jTrash').onclick = () => { if (ended) return; cup = { cup: null, items: [] }; drawCup(); };
    $('#jServe').onclick = () => {
      if (ended || lock) return;
      if (!cup.cup) { msg('杯子是空的'); return; }
      st.served++;
      const ok = matches(cup, order);
      if (ok) { st.correct++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); msg('完美！客人很開心 😊', true); }
      else { st.streak = 0; msg('做錯了…客人有點失望', false); }
      const f = $('#jFace'); f.innerHTML = ''; f.appendChild(iconCanvas(ok ? 'customer_happy' : 'customer_wait', ok ? '😊' : '😕'));
      $('#jOk').textContent = st.correct;
      lock = true;
      setTimeout(() => { lock = false; if (ended) return; order = newOrder(lv, rnd, order); cup = { cup: null, items: [] }; drawOrder(); drawCup(); }, 650);
    };
    $('#jQuit').onclick = () => finish(true);
    function tick() {
      left--; const m = Math.floor(left / 60), s = left % 60;
      $('#jTime').textContent = m + ':' + String(s).padStart(2, '0');
      if (left <= 0) finish(false);
    }
    function finish(quit) {
      if (ended) return; ended = true; clearInterval(timer);
      const sc = score(st), paid = job.paidToday < DAILY_PAID && st.served > 0;
      const coins = paid ? pay(sc) : 0, xp = st.correct * 10 + (st.served ? 5 : 0);
      const newLv = levelOf((job.xp || 0) + xp), levelUp = newLv > lv;
      root.innerHTML = `<div class="jobEnd"><h3>${quit ? '提早下班了' : '下班囉！'}</h3>
        <div class="row"><span>送出飲料</span><b>${st.served} 杯</b></div>
        <div class="row"><span>做對</span><b>${st.correct} 杯（最高連續 ${st.bestStreak}）</b></div>
        <div class="row"><span>工作分數</span><b>${sc} 分</b></div>
        <div class="row big"><span>薪水</span><b>${coins} 金幣</b></div>
        ${paid ? '' : `<div class="note">${st.served ? `今天已經領過 ${DAILY_PAID} 次完整薪水了，明天再來吧！（還是可以繼續練習）` : '沒有送出任何飲料，這次沒有薪水'}</div>`}
        <div class="row"><span>熟練度</span><b>+${xp}${levelUp ? `　🎉 升到 Lv.${newLv}！` : ''}</b></div>
        ${levelUp && newLv === 2 ? '<div class="note">解鎖新飲料：卡布奇諾</div>' : ''}${levelUp && newLv === 3 ? '<div class="note">解鎖新飲料：焦糖拿鐵</div>' : ''}
        <button class="pri" id="jBack">回到咖啡廳</button></div>`;
      root.querySelector('#jBack').onclick = () => onDone({ correct: st.correct, served: st.served, score: sc, coins, xp, levelUp, paid, quit });
    }
    drawOrder(); drawCup();
    timer = setInterval(tick, 1000);
    return { stop: () => { ended = true; clearInterval(timer); } };
  }

  G.CafeJob = Object.assign({ open }, Logic);
})(typeof window !== 'undefined' ? window : globalThis);
