// 帳號密碼雲端測試：node test/acct_test.js
// 用固定的測試帳號 nooktest_qa（帳號名稱只能註冊一次，所以重複使用，不會一直多出新帳號）
'use strict';
require('../js/cloud.js');
const Cloud = globalThis.Cloud;
const DB = 'https://stocklife-33366-default-rtdb.asia-southeast1.firebasedatabase.app/nook';
const rq = async (p, m, b) => { const r = await fetch(DB + p, { method: m || 'GET', body: b === undefined ? undefined : JSON.stringify(b) }); return r.status; };
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const U = 'nooktest_qa', PW1 = 'qa-pass-111', PW2 = 'qa-pass-222', CODE = 'QATE-STAC-CTZZ-0001';
(async () => {
  ok(Cloud.normUser(' Abc_12 ') === 'abc_12', '帳號自動轉小寫');
  ok(Cloud.normUser('ab') === null && Cloud.normUser('有中文') === null && Cloud.normUser('a'.repeat(17)) === null, '不合格的帳號被擋');
  // 準備：帳號存在、密碼是 PW1
  if (!(await Cloud.userExists(U))) { await Cloud.register(U, PW1, CODE); console.log('  （第一次執行：註冊測試帳號）'); }
  else if ((await Cloud.login(U, PW1)) !== CODE) { await Cloud.changePw(U, PW2, PW1); }
  await Cloud.backup(CODE, { id: 'qa', name: 'QA', room: { items: [] }, coins: 1 });
  ok((await Cloud.login(U, PW1)) === CODE, '正確密碼登入 → 拿到存檔碼');
  ok((await Cloud.login(U, 'wrong-pass')) === 'badpw', '錯誤密碼 → badpw');
  ok((await Cloud.login('nooktest_none_x', PW1)) === 'nouser', '不存在的帳號 → nouser');
  let taken = false; try { await Cloud.register(U, 'other-pass', 'ZZZZ-ZZZZ-ZZZZ-ZZZZ'); } catch (e) { taken = e.code === 'taken'; }
  ok(taken, '同一個帳號再註冊 → 被擋');
  ok((await rq('/users/' + U + '.json', 'PUT', { t: Date.now() })) !== 200, '直接覆蓋帳號登記 → 被擋');
  ok((await rq('/users/' + U + '.json', 'DELETE')) !== 200, '刪除帳號登記 → 被擋');
  ok((await rq('/users.json')) !== 200, '列出所有帳號 → 被擋');
  ok((await rq('/acct.json')) !== 200, '列出所有帳號資料 → 被擋');
  ok((await rq('/users/BAD-NAME.json', 'PUT', { t: Date.now() })) !== 200, '不合格的帳號名稱 → 被擋');
  ok((await rq('/acct/' + 'a'.repeat(64) + '.json', 'PUT', { c: CODE, t: 1, evil: 1 })) !== 200, '帳號資料多塞欄位 → 被擋');
  ok(await Cloud.changePw(U, PW1, PW2), '改密碼');
  ok((await Cloud.login(U, PW1)) === 'badpw', '舊密碼不能再用');
  ok((await Cloud.login(U, PW2)) === CODE, '新密碼可以登入');
  ok(!(await Cloud.changePw(U, 'wrong-pass', PW1)), '舊密碼錯 → 不能改');
  ok(await Cloud.changePw(U, PW2, PW1), '改回原本的密碼');
  const t = await Cloud.backupTime(CODE);
  ok(t > Date.now() - 60000, '讀得到雲端備份時間');
  console.log(`\n${pass} 通過、${fail} 失敗`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
