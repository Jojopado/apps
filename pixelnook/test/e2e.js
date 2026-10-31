// 瀏覽器實測（Edge headless + CDP，觸控事件，跟 iPhone 一樣）：node test/e2e.js [亂點次數]
// 測試帳號存在 test/out/test_identity.json，重複使用，不會每次在雲端多一間房間。
'use strict';
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = path.join(__dirname, 'out'), FUZZ = +(process.argv[2] || 400), IDF = path.join(OUT, 'test_identity.json');
const W = 844, H = 390;
const port = 9300 + Math.floor(Math.random() * 500), httpPort = 8700 + Math.floor(Math.random() * 200);
const srv = spawn('python', ['-m', 'http.server', String(httpPort), '--bind', '127.0.0.1'], { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
const prof = require('os').tmpdir() + '/nook_cdp_' + port;
const br = spawn(EDGE, ['--headless=new', '--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-features=IntensiveWakeUpThrottling', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
function done(code) { try { br.kill(); srv.kill(); } catch (e) {} setTimeout(() => { try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {} process.exit(code); }, 500); }
(async () => {
  let ws;
  for (let i = 0; i < 60 && !ws; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const pg = l.find(x => x.type === 'page'); if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl); } catch (e) {} await sleep(250); }
  if (!ws) throw new Error('no CDP');
  if (ws.readyState !== 1) await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {};
  ws.onmessage = e => {
    const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m.result || m.error); delete pend[m.id]; }
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('CONSOLE ' + JSON.stringify(m.params.args.map(a => a.value || a.description)).slice(0, 300));
  };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(expr.slice(0, 80) + ' → ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result && r.result.value;
  };
  const shot = async n => { const s = await send('Page.captureScreenshot', { format: 'png' }); await send('Page.bringToFront'); fs.writeFileSync(path.join(OUT, n), Buffer.from(s.data, 'base64')); };
  // 手指操作：在頁面裡發出跟 iPhone 一樣的 pointer 事件（pointerType = touch）
  const fireJS = (type, x, y) => `(()=>{const el=document.elementFromPoint(${x},${y})||document.body; el.dispatchEvent(new PointerEvent('${type}',{bubbles:true,cancelable:true,clientX:${x},clientY:${y},pointerId:7,pointerType:'touch',isPrimary:true}));})()`;
  const tap = async (x, y) => { await ev(fireJS('pointerdown', x, y)); await ev(fireJS('pointerup', x, y)); await sleep(60); };
  const dragTo = async (x0, y0, x1, y1) => {
    await ev(fireJS('pointerdown', x0, y0));
    for (let k = 1; k <= 6; k++) { await ev(`(()=>{document.querySelector('#cv').dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:${x0 + (x1 - x0) * k / 6},clientY:${y0 + (y1 - y0) * k / 6},pointerId:7,pointerType:'touch',isPrimary:true}));})()`); await sleep(20); }
    await ev(`(()=>{document.querySelector('#cv').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:${x1},clientY:${y1},pointerId:7,pointerType:'touch',isPrimary:true}));})()`); await sleep(60);
  };
  const L = (lx, ly) => ev(`(()=>{const r=document.querySelector('#cv').getBoundingClientRect();return [r.left+${lx}/800*r.width, r.top+${ly}/480*r.height]})()`);
  const G = (i, j, z = 0) => L(390 + (i - j) * 32, 172 + (i + j) * 16 - z);
  const click = sel => ev(`(()=>{const b=document.querySelector(${JSON.stringify(sel)}); if(!b) return false; b.click(); return true})()`);
  const idle = async () => { for (let k = 0; k < 60; k++) { await sleep(200); if (await ev('__nook.me.path.length === 0')) break; } await sleep(300); };
  const check = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) errors.push('CHECK ' + m); };

  await send('Runtime.enable'); await send('Page.enable'); await send('Page.bringToFront'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  setInterval(() => send('Emulation.setFocusEmulationEnabled', { enabled: true }), 5000);
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: `http://127.0.0.1:${httpPort}/index.html` });
  await sleep(1500);
  let ident = null; try { ident = JSON.parse(fs.readFileSync(IDF, 'utf8')); } catch (e) {}
  await ev('localStorage.clear()');
  if (ident) await ev(`localStorage.setItem('pixelnook.v1', JSON.stringify(${JSON.stringify({ id: ident.id, pw: ident.pw, name: '' })}))`);
  await send('Page.reload'); await sleep(1500);

  console.log('畫面更新次數/秒：', await ev('new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else r((n/2).toFixed(1));}; requestAnimationFrame(f);})'));
  console.log('1. 建立角色');
  check(await ev(`document.querySelector('#mLook').classList.contains('show')`), '第一次打開會跳出建立角色');
  await click('#lookOK'); await sleep(200);
  check(await ev(`document.querySelector('#mLook').classList.contains('show')`), '沒填名字不能關掉');
  await ev(`(()=>{const i=document.querySelector('#lookOpts input'); i.value='測試帳號'; i.dispatchEvent(new Event('input'));})()`);
  await ev(`document.querySelectorAll('#lookOpts .sw button')[7].click()`);
  await click('#lookOK'); await sleep(600);
  check(!(await ev(`document.querySelector('#mLook').classList.contains('show')`)), '填名字後關閉');
  check((await ev('__nook.st.coins')) > 300, '領到每日收入（金幣 > 300）');
  fs.writeFileSync(IDF, JSON.stringify(await ev('({id:__nook.st.id, pw:__nook.st.pw})')));
  await shot('e1_home.png');

  console.log('2. 走路（手指點地板）');
  let [x, y] = await G(5.5, 6.5); await tap(x, y); await idle();
  const me = await ev('[Math.floor(__nook.me.i),Math.floor(__nook.me.j)]');
  check(me[0] === 5 && me[1] === 6, '點地板走到 (5,6)：實際 ' + me);

  console.log('3. 坐椅子、開關燈');
  [x, y] = await G(7.5, 4.5, 20); await tap(x, y); await idle();
  check((await ev('__nook.me.pose')) === 'sit', '點椅子會走過去坐下');
  await shot('e2_sit.png');
  const lampOn = await ev(`__nook.st.room.items.find(x=>x.t==='lamp_wood').on`);
  [x, y] = await G(0.5, 7.5, 60); await tap(x, y); await idle();
  check((await ev(`__nook.st.room.items.find(x=>x.t==='lamp_wood').on`)) === !lampOn, '點立燈會開關');

  console.log('4. 商店買東西');
  await click('#bShop'); await sleep(300);
  const before = await ev('__nook.st.coins');
  await ev(`(()=>{const c=[...document.querySelectorAll('#shopGrid .card')].find(c=>c.querySelector('.t').textContent==='小盆栽'); c.querySelector('button').click();})()`);
  check((await ev('__nook.st.coins')) < before && (await ev('__nook.st.bag.plant_s')) === 1, '買小盆栽：扣錢、進背包');
  await shot('e3_shop.png');
  await click('#mShop [data-close]');

  console.log('5. 佈置：放下、拖曳、旋轉、收起');
  await click('#bEdit'); await sleep(300);
  await ev(`document.querySelector('#bag .slot').click()`);
  [x, y] = await G(2.5, 6.5); await tap(x, y); await sleep(200);
  check(!!(await ev(`__nook.st.room.items.find(x=>x.t==='plant_s'&&x.i===2&&x.j===6)`)), '把盆栽放到 (2,6)');
  [x, y] = await G(2.5, 6.5, 10); const [x2, y2] = await G(3.5, 7.5, 10); await dragTo(x, y, x2, y2); await sleep(200);
  check(!!(await ev(`__nook.st.room.items.find(x=>x.t==='plant_s'&&x.i===3&&x.j===7)`)), '手指拖曳盆栽到 (3,7)');
  [x, y] = await G(7.5, 4.5, 20); await tap(x, y); await sleep(150);
  const r0 = await ev(`__nook.st.room.items.find(x=>x.t==='chair_wood').r`);
  await click('#bRot'); await sleep(150);
  check((await ev(`__nook.st.room.items.find(x=>x.t==='chair_wood').r`)) === ((r0 + 1) & 3), '旋轉椅子');
  await shot('e4_edit.png');
  await click('#bStore'); await sleep(150);
  check(!(await ev(`__nook.st.room.items.find(x=>x.t==='chair_wood')`)) && (await ev('__nook.st.bag.chair_wood')) === 1, '收起椅子進背包');
  await ev(`document.querySelector('#edit .tabs [data-tab=paper]').click()`); await ev(`document.querySelectorAll('#bag .slot')[3].click()`);
  check((await ev('__nook.st.room.wall')) === 3, '換壁紙');
  await ev(`document.querySelector('#edit .tabs [data-tab=floor]').click()`);
  await click('#bDone'); await sleep(300);
  await shot('e5_after.png');

  console.log('6. 雲端存檔＋參觀');
  await sleep(3000);
  check(await ev('__nook.st.published'), '房間已上傳雲端');
  await click('#bVisit'); await sleep(2500);
  const rows = await ev(`document.querySelectorAll('#visitList .r').length`);
  check(rows > 0, '參觀列表有房間：' + rows);
  await ev(`(()=>{const r=[...document.querySelectorAll('#visitList .r')].find(r=>r.textContent.includes('示範')); (r||document.querySelector('#visitList .r')).click();})()`);
  await sleep(3000);
  check((await ev('__nook.mode')) === 'visit', '進入參觀模式');
  await shot('e6_visit.png');
  await sleep(1500);
  const liked = await ev(`document.querySelector('#bLike').disabled`), c0 = await ev('__nook.st.coins');
  if (!liked) { await click('#bLike'); await sleep(1500); }
  check(liked || ((await ev('__nook.st.coins')) === c0 + 5 && (await ev(`document.querySelector('#bLike').disabled`))), liked ? '今天已讚過（按鈕停用）' : '按讚 +5 金幣、按鈕變成已讚');
  await click('#bHome'); await sleep(500);
  check((await ev('__nook.mode')) === 'home', '回家');

  console.log('6b. 城市：出門、換區域、進咖啡廳、回家');
  const W2L = async (i, j, z = 0) => { const v = await ev(`(()=>{const w=__nook.wsc, c=__nook.cam; return [w.ox+(${i}-${j})*32-c[0], w.oy+(${i}+${j})*16-${z}-c[1]];})()`); return L(v[0], v[1]); };
  const scene = () => ev('__nook.wsc && __nook.wsc.id');
  const freeNear = (i, j) => ev(`(()=>{const w=__nook.wsc,b=w.blocked; let best=null,bd=1e9; for(let a=0;a<w.ni;a++)for(let c=0;c<w.nj;c++) if(!b[a][c]){const d=Math.abs(a-${Math.floor(i)})+Math.abs(c-${Math.floor(j)}); if(d<bd){bd=d;best=[a+0.5,c+0.5];}} return best;})()`);
  const hop = async (i, j) => {
    for (let k = 0; k < 8; k++) {
      const f = await freeNear(i, j);
      // 目標在畫面內就直接點；不在就往那個方向、在畫面邊緣找一格先走過去
      const v = await ev(`(()=>{const w=__nook.wsc,c=__nook.cam; const sx=w.ox+(${f[0]}-${f[1]})*32-c[0], sy=w.oy+(${f[0]}+${f[1]})*16-c[1]; return [sx,sy];})()`);
      if (v[0] > 40 && v[0] < 760 && v[1] > 70 && v[1] < 440) { [x, y] = await L(v[0], v[1]); await tap(x, y); await settle(); return; }
      const cx = Math.max(60, Math.min(740, v[0])), cy = Math.max(90, Math.min(420, v[1]));
      const g = await ev(`(()=>{const w=__nook.wsc,c=__nook.cam; const a=(${cx}+c[0]-w.ox)/32, b=(${cy}+c[1]-w.oy)/16; return [(a+b)/2,(b-a)/2];})()`);
      const f2 = await freeNear(g[0], g[1]); const v2 = await ev(`(()=>{const w=__nook.wsc,c=__nook.cam; return [w.ox+(${f2[0]}-${f2[1]})*32-c[0], w.oy+(${f2[0]}+${f2[1]})*16-c[1]];})()`);
      [x, y] = await L(v2[0], v2[1]); await tap(x, y); await settle();
    }
  };
  const goExit = async (i, j) => { await hop(i, j); const v = await ev(`(()=>{const w=__nook.wsc,c=__nook.cam; return [w.ox+(${i}-${j})*32-c[0], w.oy+(${i}+${j})*16-c[1]];})()`); [x, y] = await L(v[0], v[1]); await tap(x, y); await settle(); await settle(); };
  const settle = async () => { await idle(); await sleep(500); };
  await click('#bOut'); await settle();
  check((await ev('__nook.mode')) === 'city' && (await scene()) === 'central', '按「出門」走到門口、來到中央廣場：' + (await scene()));
  await shot('c1_central.png');
  for (const [i, j] of [[12.5, 8.5], [18.5, 8.5]]) await hop(i, j);
  [x, y] = await W2L(23.5, 8.5); await tap(x, y); await settle(); await settle();
  check((await scene()) === 'commercial', '走到右下出口 → 商業街：' + (await scene()));
  await shot('c2_commercial.png');
  const cafeDoor = await ev(`(()=>{const o=__nook.wsc.items.find(o=>o.t==='cafe_building'); const [w,d]=__nook.M.footprint(__nook.M.ITEMS[o.t],o.r); return [o.i+w/2, o.j+d/2];})()`);
  [x, y] = await W2L(cafeDoor[0], cafeDoor[1], 60); await tap(x, y); await settle(); await settle();
  check((await scene()) === 'cafe', '點咖啡廳 → 走到門口進去：' + (await scene()));
  await shot('c3_cafe.png');
  // Mia：對話 → 打工 → 領薪水
  const miaPos = await ev(`(()=>{const n=__nook.wsc.npcs[0]; return [n.i, n.j];})()`);
  [x, y] = await W2L(miaPos[0], miaPos[1], 50); await tap(x, y); await settle();
  check(await ev(`document.querySelector('#mTalk').classList.contains('show') && document.querySelector('#talkName').textContent==='Mia'`), '點 Mia → 走過去、跳出對話');
  console.log('   診斷', JSON.stringify(await ev(`({me:[__nook.me.i,__nook.me.j,__nook.me.pose], path:__nook.me.path, toast:document.querySelector('#toast').textContent, scene:__nook.wsc&&__nook.wsc.id, hit:(()=>{const o=__nook.order; return o.length})(), err:__nook.loopErr, xy:[${x},${y}], el:(document.elementFromPoint(${x},${y})||{}).id})`)), errors.slice(-3));
  await shot('c4_talk.png');
  const coinsBefore = await ev('__nook.st.coins');
  await ev(`[...document.querySelectorAll('#talkOpts button')].find(b=>/打工|幫忙/.test(b.textContent)).click()`); await sleep(300);
  check(await ev(`document.querySelector('#mJob').classList.contains('show')`), '選「打工」→ 打開咖啡廳打工');
  // 做 4 杯對的、1 杯錯的
  const made = await ev(`(async()=>{
    const J=CafeJob, sl=ms=>new Promise(r=>setTimeout(r,ms)), q=s=>document.querySelector(s);
    const btn=name=>[...document.querySelectorAll('#jIngs .ing')].find(b=>b.textContent.trim()===name);
    const nameOf=id=>J.INGS.find(x=>x.id===id).name; let ok=0;
    for(let k=0;k<5;k++){
      const ord=q('#jOrder').textContent, key=Object.keys(J.RECIPES).find(k=>J.RECIPES[k].name===ord), r=J.RECIPES[key];
      btn(r.cup==='hot'?'熱杯':'冰杯').click();
      const items = k===4 ? r.items.concat(['milk']) : r.items;
      for(const it of items) btn(nameOf(it)).click();
      q('#jServe').click(); await sl(800);
    }
    return q('#jOk').textContent;
  })()`);
  check(made === '4', '做了 5 杯、對 4 杯：' + made);
  await shot('c5_job.png');
  await ev(`document.querySelector('#jQuit').click()`); await sleep(300);
  await shot('c6_result.png');
  const result = await ev(`document.querySelector('.jobEnd').textContent`);
  await ev(`document.querySelector('#jBack').click()`); await sleep(400);
  const coinsAfter = await ev('__nook.st.coins');
  // 分數：A=80、T=50、C=80 → 0.7*80+0.2*50+0.1*80 = 74 → 100*(0.6+0.4*0.74)=89.6 → 90
  check(result.includes('74 分') && result.includes('90 金幣') && coinsAfter - coinsBefore >= 90, `薪水依公式計算（74 分 → 90 金幣）：實際 +${coinsAfter - coinsBefore}`);
  check(await ev(`document.querySelector('#mTalk').classList.contains('show') && document.querySelector('#talkText').textContent.includes('薪水')`), '下班後 Mia 發薪水的對話');
  check((await ev('__nook.jobState().paid')) === 1 && (await ev('__nook.jobState().xp')) === 45, '紀錄：今天領薪 1 次、熟練度 +45');
  await ev(`[...document.querySelectorAll('#talkOpts button')].find(b=>b.textContent.includes('再見')).click()`); await sleep(200);
  // 點室內的門出去
  [x, y] = await W2L(1.5, 0, 40); await tap(x, y); await settle(); await settle();
  check((await scene()) === 'commercial', '點咖啡廳的門 → 回到商業街：' + (await scene()));
  const near = await ev(`(()=>{const o=__nook.wsc.items.find(o=>o.t==='cafe_building'); const m=__nook.me; return Math.abs(m.j-(o.j+__nook.M.footprint(__nook.M.ITEMS[o.t],o.r)[1]))<2;})()`);
  check(near, '出來時站在咖啡廳門口');
  // 走回中央廣場、點自己的家
  for (const [i, j] of [[8.5, 9.5], [3.5, 9.5]]) await hop(i, j);
  [x, y] = await W2L(0.5, 9.5); await tap(x, y); await settle(); await settle();
  check((await scene()) === 'central', '走左邊出口 → 回中央廣場：' + (await scene()));
  for (const [i, j] of [[16.5, 9.5], [9.5, 8.5], [5.5, 7.5]]) await hop(i, j);
  const house = await ev(`(()=>{const o=__nook.wsc.items.find(o=>o.home); const [w,d]=__nook.M.footprint(__nook.M.ITEMS[o.t],o.r); return [o.i+w/2, o.j+d/2];})()`);
  [x, y] = await W2L(house[0], house[1], 50); await tap(x, y); await settle(); await settle();
  check((await ev('__nook.mode')) === 'home', '點自己的家 → 回到房間：' + (await ev('__nook.mode')));
  if ((await ev('__nook.mode')) !== 'home') console.log('   診斷', JSON.stringify(await ev(`({me:[__nook.me.i,__nook.me.j], scene:__nook.wsc&&__nook.wsc.id, toast:document.querySelector('#toast').textContent, cam:__nook.cam, house:${JSON.stringify(house)}})`)));
  // 「回家」按鈕
  await click('#bOut'); await settle(); await click('#bGoHome'); await settle();
  check((await ev('__nook.mode')) === 'home', '城市裡按「回家」→ 回到房間');
  // 任務：一路走下來，新手主線應該已經完成 1～4 步，現在停在「買一件家具」
  const qm = await ev('__nook.st.q.main');
  check(qm === 4, '新手主線自動前進到第 5 步（買家具）：目前第 ' + (qm + 1) + ' 步');
  check((await ev(`document.querySelector('#qText').textContent`)).includes('買一件家具'), '左上目標顯示「買一件家具」');
  await click('#bShop'); await sleep(300);
  await ev(`(()=>{const c=[...document.querySelectorAll('#shopGrid .card')].find(c=>c.querySelector('.t').textContent==='小盆栽'); c.querySelector('button').click();})()`);
  await click('#mShop [data-close]'); await sleep(600);
  check((await ev('__nook.st.q.main')) === 5 && (await ev('__nook.st.bag.poster')) >= 1, '買家具 → 主線完成，獲得禮物「星星海報」');
  await ev('__nook.openQuests()'); await sleep(300);
  const qcards = await ev(`document.querySelectorAll('#questList .qcard').length`);
  check(qcards === 7, '任務面板：主線＋3 個每日＋3 個每週：' + qcards);
  await shot('q1_panel.png');
  const before2 = await ev('__nook.st.coins');
  await ev(`[...document.querySelectorAll('#questList .qcard button')].filter(b=>!b.disabled).forEach(b=>b.click())`); await sleep(300);
  const claimedAll = await ev(`[...document.querySelectorAll('#questList .qcard button')].filter(b=>!b.disabled).length`);
  check(claimedAll === 0, '可以領的都領了（金幣 +' + ((await ev('__nook.st.coins')) - before2) + '）');
  await click('#mQuest [data-close]');
  console.log('6c. 公園：Oliver、清理公園、採集、調查、閃光物品、背包');
  await click('#bOut'); await settle();
  await goExit(11.5, 17.5);
  check((await scene()) === 'park', '中央廣場左下出口 → 城市公園：' + (await scene()));
  if ((await scene()) !== 'park') console.log('   診斷', JSON.stringify(await ev(`({me:[__nook.me.i,__nook.me.j], cam:__nook.cam, toast:document.querySelector('#toast').textContent, ex:__nook.wsc.exits, b1617:[__nook.wsc.blocked[11][16],__nook.wsc.blocked[11][17],__nook.wsc.blocked[12][17]]})`)), x, y);
  await shot('p1_park.png');
  const ol = await ev(`(()=>{const n=__nook.wsc.npcs[0]; return [n.i, n.j];})()`);
  [x, y] = await W2L(ol[0], ol[1], 55); await tap(x, y); await settle();
  check(await ev(`document.querySelector('#mTalk').classList.contains('show') && document.querySelector('#talkName').textContent==='Oliver'`), '點 Oliver → 對話');
  const c0p = await ev('__nook.st.coins');
  await ev(`[...document.querySelectorAll('#talkOpts button')].find(b=>/清理|交給/.test(b.textContent)).click()`); await sleep(400);
  check(await ev('!!__nook.park && __nook.wsc.pickups.filter(p=>p.kind==="trash").length===8'), '開始清理：地圖上出現 8 個垃圾');
  await shot('p2_trash.png');
  for (let k = 0; k < 12; k++) {
    const left = await ev(`(()=>{const p=__nook.wsc.pickups.filter(p=>p.kind==='trash'); if(!p.length) return 0; const m=__nook.me; p.sort((a,b)=>Math.abs(a.i-m.i)+Math.abs(a.j-m.j)-Math.abs(b.i-m.i)-Math.abs(b.j-m.j)); __nook.tapPickup(p[0]); return p.length;})()`);
    if (!left) break; await settle();
  }
  await sleep(600);
  check(!(await ev('__nook.park')), '8 個垃圾撿完 → 工作結束');
  console.log('   診斷', JSON.stringify(await ev(`({park:__nook.park&&{picked:__nook.park.picked,left:__nook.park.left}, left:(__nook.wsc.pickups||[]).filter(p=>p.kind==='trash').map(p=>[p.i,p.j]), me:[__nook.me.i,__nook.me.j], path:__nook.me.path.length, toast:document.querySelector('#toast').textContent, modal:[...document.querySelectorAll('.modal.show')].map(m=>m.id), err:__nook.loopErr})`)));
  check((await ev(`__nook.jobState('park').paid`)) === 1 && (await ev(`document.querySelector('#talkName').textContent`)) === 'Oliver', 'Oliver 發薪水（今天領薪 1 次）');
  check((await ev('__nook.st.coins')) > c0p, '金幣增加：+' + ((await ev('__nook.st.coins')) - c0p));
  check((await ev('__nook.st.q.main')) >= 6, '主線「幫 Oliver 清理公園」完成');
  await ev(`document.querySelector('#mTalk').classList.remove('show')`);
  // 採集：最近的花叢
  const fl = await ev(`(()=>{const m=__nook.me; const o=__nook.wsc.items.filter(o=>o.harvest&&!o.on).sort((a,b)=>Math.abs(a.i-m.i)+Math.abs(a.j-m.j)-Math.abs(b.i-m.i)-Math.abs(b.j-m.j))[0]; return o?[o.i+0.5,o.j+0.5,o.t]:null;})()`);
  const mats0 = await ev('JSON.stringify(__nook.st.mats||{})');
  await ev(`__nook.cityInteract(__nook.wsc.items.find(o=>o.harvest&&!o.on&&o.i+0.5===${fl[0]}&&o.j+0.5===${fl[1]}))`); await settle();
  check((await ev('JSON.stringify(__nook.st.mats||{})')) !== mats0, '採集 ' + fl[2] + ' → 拿到材料：' + (await ev('JSON.stringify(__nook.st.mats)')));
  // 調查：最近的可調查地點
  const se = await ev(`(()=>{const m=__nook.me; const o=__nook.wsc.items.filter(o=>o.search).sort((a,b)=>Math.abs(a.i-m.i)+Math.abs(a.j-m.j)-Math.abs(b.i-m.i)-Math.abs(b.j-m.j))[0]; const [w,d]=__nook.M.footprint(__nook.M.ITEMS[o.t],o.r); return [o.i+w/2,o.j+d/2,o.t];})()`);
  await ev(`(()=>{const m=__nook.me; const o=__nook.wsc.items.filter(o=>o.search).sort((a,b)=>Math.abs(a.i-m.i)+Math.abs(a.j-m.j)-Math.abs(b.i-m.i)-Math.abs(b.j-m.j))[0]; __nook.cityInteract(o);})()`); await settle(); await sleep(1800);
  check(await ev(`Object.keys(__nook.st.ex.done).some(k=>k.startsWith('se:'))`), '調查 ' + se[2] + '：' + (await ev(`document.querySelector('#toast').textContent`)));
  // 閃光物品
  const sp = await ev(`(()=>{const p=(__nook.wsc.pickups||[]).filter(p=>p.kind==='sparkle'); return p.length?[p[0].i+0.5,p[0].j+0.5,p.length]:null;})()`);
  if (sp) { await ev(`__nook.tapPickup(__nook.wsc.pickups.filter(p=>p.kind==='sparkle')[0])`); await settle();
    check((await ev(`(__nook.wsc.pickups||[]).filter(p=>p.kind==='sparkle').length`)) === sp[2] - 1, '撿到閃光物品：' + (await ev(`document.querySelector('#toast').textContent`))); }
  await click('#bBag'); await sleep(300);
  check((await ev(`document.querySelectorAll('#bagBody .colc').length`)) === 24, '背包：收藏圖鑑 24 格');
  await shot('p3_bag.png');
  await click('#mBag [data-close]');
  await click('#bGoHome'); await settle();

  console.log('6d. 麵包店、外送、超市、委託');
  const talkNpc = async (scn) => { await ev(`__nook.enterScene('${scn}', null, 'SW')`); await sleep(600); const n = await ev(`(()=>{const n=__nook.wsc.npcs[0]; return [n.i,n.j,n.id];})()`); [x, y] = await W2L(n[0], n[1], 55); await tap(x, y); await settle(); return n[2]; };
  const opt = re => ev(`(()=>{const b=[...document.querySelectorAll('#talkOpts button')].find(b=>${re}.test(b.textContent)); if(b) b.click(); return !!b;})()`);
  // 麵包店
  let who = await talkNpc('bakery');
  check(who === 'leo' && await ev(`document.querySelector('#talkName').textContent==='Leo'`), '麵包店：點 Leo → 對話');
  await opt('/分類|幫忙/'); await sleep(400);
  const sorted = await ev(`(async()=>{const J=Jobs2, sl=ms=>new Promise(r=>setTimeout(r,ms)); let n=0;
    for(let k=0;k<8;k++){ const nm=document.querySelector('#bBelt .bi.first div').textContent; const key=Object.keys(J.BREADS).find(k=>J.BREADS[k].name===nm); const b=J.BREADS[key].basket;
      const btn=[...document.querySelectorAll('#bBaskets .basket')].find(x=>x.querySelector('.bn').textContent===J.BASKETS[b].name); btn.click(); n++; await sl(120);} return document.querySelector('#bOk').textContent;})()`);
  check(sorted === '8', '麵包分類：8 個都放對：' + sorted);
  await shot('s1_bakery.png');
  await ev(`document.querySelector('#bQuit').click()`); await sleep(300); await ev(`document.querySelector('#jBack').click()`); await sleep(400);
  check((await ev(`__nook.jobState('bakery').paid`)) === 1, '麵包店薪水已發（今天第 1 次）');
  // 外送
  await opt('/再見|好的/'); await sleep(200);
  [x, y] = await W2L((await ev('__nook.wsc.npcs[0].i')), (await ev('__nook.wsc.npcs[0].j')), 55); await tap(x, y); await settle();
  await opt('/外送/'); await sleep(300);
  check(!!(await ev('__nook.deliver')), '接下外送單：' + (await ev('__nook.deliver && __nook.deliver.sp.name')));
  await opt('/出發/');
  const dsp = await ev('__nook.deliver.sp');
  const c1 = await ev('__nook.st.coins');
  await ev(`__nook.enterScene('${dsp.scene}', [${dsp.cell[0]}, ${dsp.cell[1]}+1], 'NE')`); await sleep(600);
  check(await ev(`__nook.wsc.pickups.some(p=>p.kind==='deliver')`), '目的地出現外送標記');
  await ev(`__nook.tapPickup(__nook.wsc.pickups.find(p=>p.kind==='deliver'))`); await settle();
  check(!(await ev('__nook.deliver')) && (await ev('__nook.st.coins')) > c1, '包裹送達、拿到外送費 +' + ((await ev('__nook.st.coins')) - c1));
  // 超市
  who = await talkNpc('market');
  check(who === 'nora', '超市：點 Nora → 對話');
  await opt('/結帳|交給/'); await sleep(400);
  const cashed = await ev(`(async()=>{const J=Jobs2, sl=ms=>new Promise(r=>setTimeout(r,ms)), q=s=>document.querySelector(s);
    for(let k=0;k<3;k++){
      const goods=[...document.querySelectorAll('#cGoods .good')]; let total=0;
      for(const g of goods){ const t=g.querySelector('span').textContent; total+=+t.split(' ').pop(); g.click(); await sl(60); }
      const paid=+q('#cPaid').textContent; let ch=paid-total;
      const coins=[...document.querySelectorAll('#cCoins .coinb')].map(b=>[+b.querySelector('span').textContent,b]).sort((a,b)=>b[0]-a[0]);
      for(const [v,b] of coins){ while(ch>=v){ b.click(); ch-=v; await sl(20);} }
      q('#cDone').click(); await sl(300);
    } return q('#cOk').textContent; })()`);
  check(cashed === '3', '收銀：3 位客人都找對錢：' + cashed);
  await shot('s2_market.png');
  await ev(`document.querySelector('#cQuit').click()`); await sleep(300); await ev(`document.querySelector('#jBack').click()`); await sleep(400);
  check((await ev(`__nook.jobState('market').paid`)) === 1, '超市薪水已發（今天第 1 次）');
  await opt('/再見|好的/');
  // 委託：Mia 要 3 份花瓣
  await ev(`__nook.st.mats.mat_flower = 5`);
  await talkNpc('cafe');
  check(await opt('/幫忙|委託/'), '跟 Mia 說話出現「委託」選項');
  await sleep(200);
  check(await opt('/交給你/'), '材料夠了 → 可以交付');
  await sleep(300);
  check((await ev(`__nook.st.req.mia`)) === 'done' && (await ev('__nook.st.mats.mat_flower')) === 2 && (await ev('__nook.st.bag.plant_cafe')) >= 1, '委託完成：扣 3 份花瓣、拿到咖啡廳盆栽');
  await opt('/不客氣/');
  await click('#bGoHome'); await settle();

  console.log('6e. 社群：本週主題、投票、收藏');
  await click('#bVisit'); await sleep(1500);
  await ev(`document.querySelector('#visitTabs [data-v=theme]').click()`); await sleep(2000);
  check(await ev(`!!document.querySelector('.themeHead') && document.querySelector('.themeHead .tn').textContent.length>0`), '本週主題分頁：' + (await ev(`document.querySelector('.themeHead .tn') && document.querySelector('.themeHead .tn').textContent`)));
  const c2 = await ev('__nook.st.coins');
  await ev(`document.querySelector('.themeHead button').click()`); await sleep(2500);
  const mineIn = await ev(`[...document.querySelectorAll('#visitList .r .nm')].some(e=>e.textContent.includes('（我）'))`);
  check(mineIn, '提交參賽 → 自己的房間出現在排行裡' + ((await ev('__nook.st.coins')) > c2 ? '（金幣 +50）' : '（本週已領過）'));
  const selfBtn = await ev(`(()=>{const r=[...document.querySelectorAll('#visitList .r')].find(r=>r.querySelector('.nm').textContent.includes('（我）')); return r && r.querySelector('button').disabled;})()`);
  check(selfBtn, '不能投給自己（按鈕停用）');
  await shot('t1_theme.png');
  await ev(`document.querySelector('#visitTabs [data-v=recent]').click()`); await sleep(1500);
  await ev(`(()=>{const r=[...document.querySelectorAll('#visitList .r')].find(r=>r.textContent.includes('示範')); (r||document.querySelector('#visitList .r')).click();})()`); await sleep(2500);
  await click('#bFav'); await sleep(200);
  check((await ev('(__nook.st.favs||[]).length')) >= 1 && (await ev(`document.querySelector('#bFav').textContent`)).includes('已收藏'), '參觀時按收藏 → 已收藏');
  await click('#bHome'); await sleep(500);
  await click('#bVisit'); await sleep(1500); await ev(`document.querySelector('#visitTabs [data-v=fav]').click()`); await sleep(1500);
  check((await ev(`document.querySelectorAll('#visitList .r').length`)) >= 1, '收藏分頁列出收藏的房間');
  await click('#mVisit [data-close]');

  console.log('6f. 存檔碼：備份 → 模擬換手機 → 還原');
  await ev('__nook.openSettings()'); await sleep(300);
  const code = await ev(`document.querySelector('#setCode').textContent`);
  check(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code), '設定裡顯示存檔碼：' + code);
  await ev(`document.querySelector('#backupNow').click()`); await sleep(2500);
  const snap = await ev(`({name:__nook.st.name, coins:__nook.st.coins, col:Object.keys(__nook.st.col||{}).length, items:__nook.st.room.items.length, q:__nook.st.q.main})`);
  await shot('v1_settings.png');
  await ev('localStorage.clear()'); await send('Page.reload'); await sleep(2000);
  check(await ev(`document.querySelector('#mLook').classList.contains('show') && document.querySelector('#lookRestore').offsetParent!==null`), '新手機：建立角色畫面有「我有存檔碼」');
  await ev(`document.querySelector('#lookRestore').click()`); await sleep(300);
  await ev(`(()=>{const i=document.querySelector('#restoreIn'); i.value='${code}'.toLowerCase();})()`);
  await ev(`document.querySelector('#restoreBtn').click()`); await sleep(2500);
  check(await ev(`document.querySelector('#restoreConfirm').style.display==='flex'`), '輸入存檔碼（小寫也可以）→ 找到備份：' + (await ev(`document.querySelector('#restoreInfo').textContent`)).slice(0, 40));
  await ev(`document.querySelector('#restoreYes').click()`); await sleep(800);
  const after = await ev(`({name:__nook.st.name, coins:__nook.st.coins, col:Object.keys(__nook.st.col||{}).length, items:__nook.st.room.items.length, q:__nook.st.q.main})`);
  check(JSON.stringify(after) === JSON.stringify(snap), '還原後名字、金幣、收藏、家具、主線都一樣：' + JSON.stringify(after));
  check(!(await ev(`document.querySelector('#mLook').classList.contains('show')`)) && (await ev('__nook.mode')) === 'home', '還原後直接回到自己的房間');
  await ev(`(()=>{document.querySelector('#restoreIn').value='AAAA-BBBB-CCCC-DDDD'; document.querySelector('#restoreBtn').click();})()`); await sleep(2000);
  check((await ev(`document.querySelector('#toast').textContent`)).includes('找不到'), '亂打的存檔碼 → 找不到');
  await ev(`document.querySelector('#mSet').classList.remove('show')`);

  const perf = await ev(`(async()=>{__nook.enterScene('central',[12,12],'SW'); await new Promise(r=>setTimeout(r,300)); const f0=__nook.frames, t0=performance.now(); __nook.cityTap(400,300); await new Promise(r=>setTimeout(r,2000)); return Math.round((__nook.frames-f0)/((performance.now()-t0)/1000));})()`);
  console.log('   城市走路時每秒畫面：', perf);
  await click('#bGoHome'); await settle();

  console.log(`7. 小孩亂點亂拖 ${FUZZ} 下`);
  const fuzzSrc = fs.readFileSync(path.join(__dirname, 'fuzz_page.js'), 'utf8');
  const poll = setInterval(async () => { const r = await Promise.race([send('Runtime.evaluate', { expression: 'window.__fz', returnByValue: true }), sleep(3000).then(() => null)]); process.stdout.write(' [' + (r && r.result ? r.result.value : '無回應') + ']'); }, 10000);
  const res = await ev(`(${fuzzSrc})(${FUZZ})`); clearInterval(poll); console.log('');
  console.log('  ', JSON.stringify(res.stats), '最後模式', res.mode, '金幣', res.coins, '家具', res.items);
  if (res.errs.length) errors.push(...res.errs);
  await ev(`document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show'))`);
  if ((await ev('__nook.mode')) === 'edit') await click('#bDone');
  if ((await ev('__nook.mode')) === 'visit') await click('#bHome');
  if ((await ev('__nook.mode')) === 'city') { await click('#bGoHome'); await sleep(800); }
  await sleep(500); await shot('e7_fuzz.png');
  const free = await ev(`!__nook.S.blockedGrid(__nook.st.room)[4][4]`);
  if (free) { [x, y] = await G(4.5, 4.5); await tap(x, y); await idle(); const p = await ev('[Math.floor(__nook.me.i),Math.floor(__nook.me.j)]'); check(p[0] === 4 && p[1] === 4, '亂點之後還能正常走路：' + p); if (!(p[0] === 4 && p[1] === 4)) console.log('   診斷', JSON.stringify(await ev(`({mode:__nook.mode, pose:__nook.me.pose, path:__nook.me.path, el:(document.elementFromPoint(${x},${y})||{}).id, toast:document.querySelector('#toast').textContent, modals:[...document.querySelectorAll('.modal.show')].map(m=>m.id), rot:getComputedStyle(document.querySelector('#rot')).display, frames:__nook.frames, loopErr:__nook.loopErr, vis:document.visibilityState, blocked44:__nook.S.blockedGrid(__nook.st.room)[4][4]})`))); }
  for (let k = errors.length - 1; k >= 0; k--) if (/message channel closed|Receiving end does not exist/.test(errors[k])) errors.splice(k, 1);   // 瀏覽器擴充功能的訊息，跟遊戲無關
  console.log(errors.length ? '問題：\n' + [...new Set(errors)].join('\n') : '全部通過，沒有錯誤');
  ws.close(); done(errors.length ? 1 : 0);
})().catch(e => { console.log('FATAL', e.message); done(2); });
