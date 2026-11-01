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
  await send('Runtime.enable'); await send('Page.enable'); await send('Page.bringToFront'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: `http://127.0.0.1:${httpPort}/index.html` }); await sleep(1500);
  const ident = JSON.parse(fs.readFileSync(IDF, 'utf8'));
  await ev('localStorage.clear()');
  await ev(`localStorage.setItem('pixelnook.v1', JSON.stringify(${JSON.stringify({ id: ident.id, pw: ident.pw, name: '測試帳號' })}))`);
  await send('Page.reload'); await sleep(2000);
  const U = 'nooktest_ui', PW = 'ui-pass-123';
  const fill = (u, p) => ev(`(()=>{document.querySelector('#acctUser').value=${JSON.stringify(u)};document.querySelector('#acctPw').value=${JSON.stringify(p)};})()`);
  const waitBtn = async sel => { for (let k = 0; k < 60; k++) { await sleep(250); if (await ev(`!document.querySelector('${sel}').disabled`)) break; } await sleep(300); };
  const lastToast = () => ev(`document.querySelector('#toast').textContent`);
  // A：註冊（已註冊過就改成登入）
  await ev('__nook.openSettings()'); await sleep(300);
  check(await ev(`document.querySelector('#acctOut').offsetParent!==null`), '設定裡有帳號登入區');
  await fill('ab', '123'); await click('#acctReg'); await sleep(300); check(/3～16/.test(await lastToast()), '帳號太短 → 提示：' + await lastToast());
  await fill(U, PW); await click('#acctReg'); await waitBtn('#acctReg');
  let t = await lastToast(); console.log('   註冊：', t);
  if (/有人用了/.test(t)) { await click('#acctLogin'); await waitBtn('#acctLogin'); if (await ev(`document.querySelector('#restoreConfirm').style.display==='flex'`)) await click('#restoreYes'); }
  check(await ev('__nook.st.acct') === U, '註冊／登入後 st.acct = ' + U);
  const code = await ev('__nook.st.code'), name = await ev('__nook.st.name');
  // 確定備份上去
  await ev(`Cloud.backup(__nook.st.code, __nook.st).then(t=>{__nook.st.syncT=t})`);
  // B：新裝置
  await ev('localStorage.clear()'); await send('Page.reload'); await sleep(2500);
  check(await ev(`document.querySelector('#mLook').classList.contains('show')`), '新裝置：顯示建立角色');
  await click('#lookRestore'); await sleep(300);
  await fill(U, 'wrong-pass'); await click('#acctLogin'); await waitBtn('#acctLogin'); check(/密碼不對/.test(await lastToast()), '密碼錯 → ' + await lastToast());
  await fill(U, PW); await click('#acctLogin'); await waitBtn('#acctLogin');
  check(await ev('__nook.st.acct') === U && await ev('__nook.st.name') === name && await ev('__nook.st.code') === code, '新裝置登入 → 同一份進度：' + await lastToast());
  check(!(await ev(`document.querySelector('#mLook').classList.contains('show')`)) && !(await ev(`document.querySelector('#mSet').classList.contains('show')`)), '登入後視窗都關掉');
  // 另一台裝置存了新進度 → 切回來自動載入
  await ev(`(async()=>{const s=JSON.parse(JSON.stringify(__nook.st)); s.coins=4321; await new Promise(r=>setTimeout(r,800)); await Cloud.backup(s.code, s);})()`);
  await ev(`document.dispatchEvent(new Event('visibilitychange'))`); await sleep(3000);
  check(await ev('__nook.st.coins') === 4321, '其他裝置的新進度自動載入：金幣 ' + await ev('__nook.st.coins'));
  // 改密碼再改回來
  await ev('__nook.openSettings()'); await sleep(200);
  await click('#acctPwBtn'); await ev(`(()=>{document.querySelector('#acctOld').value=${JSON.stringify(PW)};document.querySelector('#acctNew').value='ui-pass-456';})()`); await click('#acctPwOK'); await waitBtn('#acctPwOK');
  check(/改好了/.test(await lastToast()), '改密碼：' + await lastToast());
  check(await ev(`Cloud.changePw('${U}','ui-pass-456','${PW}')`), '改回原密碼');
  // 登出（按兩次）
  await click('#acctOutBtn'); await sleep(200); check(await ev(`document.querySelector('#acctOutBox').style.display`) === 'flex', '按登出 → 跳出確認框');
  await click('#acctOutNo'); await sleep(100); check(await ev(`document.querySelector('#acctOutBox').style.display`) === 'none' && (await ev('__nook.st.acct')) === U, '按取消 → 還是登入中');
  await click('#acctOutBtn'); await sleep(200); await sleep(6000);   // 停很久再按確定也可以（不再有 4 秒限制）
  await click('#acctOutYes'); await sleep(3500);
  check(!(await ev('__nook.st.acct')) && await ev(`document.querySelector('#mLook').classList.contains('show')`), '登出 → 回到新玩家畫面');
  // 還原測試身分
  await ev(`localStorage.setItem('pixelnook.v1', JSON.stringify(${JSON.stringify({ id: ident.id, pw: ident.pw, name: '測試帳號' })}))`);
  console.log(errors.length ? errors : '全部通過');
  done(errors.length ? 1 : 0);
})().catch(e => { console.error(e); done(1); });
