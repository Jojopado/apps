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

  console.log(`7. 小孩亂點亂拖 ${FUZZ} 下`);
  const fuzzSrc = fs.readFileSync(path.join(__dirname, 'fuzz_page.js'), 'utf8');
  const poll = setInterval(async () => { const r = await Promise.race([send('Runtime.evaluate', { expression: 'window.__fz', returnByValue: true }), sleep(3000).then(() => null)]); process.stdout.write(' [' + (r && r.result ? r.result.value : '無回應') + ']'); }, 10000);
  const res = await ev(`(${fuzzSrc})(${FUZZ})`); clearInterval(poll); console.log('');
  console.log('  ', JSON.stringify(res.stats), '最後模式', res.mode, '金幣', res.coins, '家具', res.items);
  if (res.errs.length) errors.push(...res.errs);
  await ev(`document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show'))`);
  if ((await ev('__nook.mode')) === 'edit') await click('#bDone');
  if ((await ev('__nook.mode')) === 'visit') await click('#bHome');
  await sleep(500); await shot('e7_fuzz.png');
  const free = await ev(`!__nook.S.blockedGrid(__nook.st.room)[4][4]`);
  if (free) { [x, y] = await G(4.5, 4.5); await tap(x, y); await idle(); const p = await ev('[Math.floor(__nook.me.i),Math.floor(__nook.me.j)]'); check(p[0] === 4 && p[1] === 4, '亂點之後還能正常走路：' + p); if (!(p[0] === 4 && p[1] === 4)) console.log('   診斷', JSON.stringify(await ev(`({mode:__nook.mode, pose:__nook.me.pose, path:__nook.me.path, el:(document.elementFromPoint(${x},${y})||{}).id, toast:document.querySelector('#toast').textContent, modals:[...document.querySelectorAll('.modal.show')].map(m=>m.id), rot:getComputedStyle(document.querySelector('#rot')).display, frames:__nook.frames, loopErr:__nook.loopErr, vis:document.visibilityState, blocked44:__nook.S.blockedGrid(__nook.st.room)[4][4]})`))); }
  console.log(errors.length ? '問題：\n' + [...new Set(errors)].join('\n') : '全部通過，沒有錯誤');
  ws.close(); done(errors.length ? 1 : 0);
})().catch(e => { console.log('FATAL', e.message); done(2); });
