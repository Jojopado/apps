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
  for (const sc of ['central', 'commercial', 'park', 'cafe', 'bakery']) {
    await ev(`__nook.enterScene('${sc}', null, 'SW')`); await sleep(4000);
    const r = await ev(`({ms: __nook.renderMs.toFixed(2), w: __nook.wsc.life.walkers.length, a: __nook.wsc.life.animals.length, sit: __nook.wsc.life.walkers.filter(w=>w.pose==='sit').length, err: __nook.loopErr})`);
    console.log(sc, JSON.stringify(r)); await shot('life_' + sc + '.png');
  }
  // 透視：把玩家放到樹後面
  const res = await ev(`(()=>{__nook.enterScene('central', null, 'SW'); const sc=__nook.wsc; const t=sc.items.filter(o=>/tree/.test(o.t));
    for(const o of t){ for(const [di,dj] of [[-1,-1],[-1,0],[0,-1]]){ const c=[o.i+di,o.j+dj]; if(c[0]>=0&&c[1]>=0&&!sc.blocked[c[0]][c[1]]){ __nook.me.i=c[0]+.5; __nook.me.j=c[1]+.5; __nook.render(); return [o.t,o.i,o.j,c]; } } } return null; })()`);
  console.log('behind tree', JSON.stringify(res)); await sleep(500); await shot('life_xray.png');
  // 長椅
  const b = await ev(`(()=>{const sc=__nook.wsc; const o=sc.items.find(o=>o.t==='bench'); __nook.cityInteract(o); return [o.i,o.j];})()`);
  for (let k = 0; k < 30; k++) { await sleep(200); if (await ev('__nook.me.pose==="sit"')) break; }
  console.log('bench', JSON.stringify(b), 'pose', await ev('__nook.me.pose')); await shot('life_bench.png');
  console.log('errors', errors);
  done(0);
})().catch(e => { console.error(e); done(1); });
