// 雲端規則測試（會在雲端留下兩間「示範小窩」）
const DB = 'https://stocklife-33366-default-rtdb.asia-southeast1.firebasedatabase.app/nook';
const rq = async (p, m, b) => { const r = await fetch(DB + p, { method: m || 'GET', body: b === undefined ? undefined : JSON.stringify(b) }); return [r.status, await r.text()]; };
const rnd = n => Array.from({ length: n }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const demo = n => ({
  v: 1, name: n === 1 ? '示範小窩・木頭' : '示範小窩・粉彩',
  look: n === 1 ? { skin: 1, hair: 'short', hairC: 0, shirt: 3, pants: 0, shoes: 0 } : { skin: 0, hair: 'long', hairC: 7, shirt: 6, pants: 6, shoes: 1 },
  room: n === 1 ? { v: 1, wall: 1, floor: 0, items: [
      { t: 'bed_wood', i: 0, j: 0, r: 1 }, { t: 'rug_wood', i: 4, j: 3, r: 0 }, { t: 'shelf_wood', i: 4, j: 0, r: 0 }, { t: 'desk_wood', i: 6, j: 0, r: 0 },
      { t: 'chair_wood', i: 6, j: 1, r: 2 }, { t: 'sofa_wood', i: 4, j: 6, r: 2 }, { t: 'table_wood', i: 5, j: 4, r: 0 }, { t: 'lamp_wood', i: 0, j: 7, r: 0, on: true },
      { t: 'night_wood', i: 0, j: 2, r: 1 }, { t: 'plant_b', i: 8, j: 2, r: 0 }, { t: 'wardrobe_wood', i: 0, j: 4, r: 1 }],
      walls: [{ t: 'win_wood', side: 'R', u: 1 }, { t: 'clock', side: 'R', u: 3 }, { t: 'wall_shelf', side: 'L', u: 3 }, { t: 'paint_hill', side: 'L', u: 6 }] }
    : { v: 1, wall: 2, floor: 3, items: [
      { t: 'bed_pastel', i: 0, j: 0, r: 1 }, { t: 'rug_pastel', i: 3, j: 3, r: 0 }, { t: 'wardrobe_pastel', i: 4, j: 0, r: 0 }, { t: 'sofa_pastel', i: 4, j: 6, r: 2 },
      { t: 'bean_pastel', i: 7, j: 3, r: 3 }, { t: 'table_pastel', i: 5, j: 4, r: 0 }, { t: 'lamp_pastel', i: 8, j: 0, r: 0, on: true }, { t: 'cushion_pastel', i: 3, j: 4, r: 1 },
      { t: 'night_pastel', i: 0, j: 2, r: 1 }, { t: 'chair_pastel', i: 7, j: 5, r: 3 }, { t: 'plant_s', i: 6, j: 0, r: 0 }],
      walls: [{ t: 'win_wood', side: 'R', u: 1 }, { t: 'poster', side: 'R', u: 6 }, { t: 'paint_sun', side: 'L', u: 3 }, { t: 'mirror', side: 'L', u: 5 }] },
});
(async () => {
  const A = 'demo' + rnd(10), B = 'demo' + rnd(10), pa = rnd(28), pb = rnd(28);
  const save = (id, pw, n, c) => { const t = Date.now(); return rq('.json', 'PATCH', { ['rooms/' + id]: { pw, t, d: JSON.stringify(demo(n)) }, ['idx/' + id]: { n: demo(n).name.slice(0, 12), t, c } }); };
  console.log('建立房間');
  ok((await save(A, pa, 1, 260))[0] === 200, '建立示範房 A');
  ok((await save(B, pb, 2, 270))[0] === 200, '建立示範房 B');
  console.log('攻擊測試');
  ok((await rq('/rooms/' + A + '.json', 'PUT', { pw: rnd(28), t: Date.now(), d: '{}' }))[0] !== 200, '用錯的密碼覆蓋 A → 被擋');
  ok((await rq('/idx/' + A + '.json', 'PUT', { n: '駭客', t: Date.now(), c: 999 }))[0] !== 200, '只改公開列表（不改房間）→ 被擋');
  ok((await rq('/rooms/' + A + '/pw.json'))[0] !== 200, '讀 A 的密碼 → 被擋');
  ok((await rq('/rooms.json'))[0] !== 200, '列出所有房間（含密碼）→ 被擋');
  ok((await rq('/rooms/' + A + '.json', 'DELETE'))[0] !== 200, '刪除 A → 被擋');
  ok((await rq('/rooms/' + A + '/d.json'))[0] === 200, '讀 A 的房間內容 → 可以');
  ok((await rq('/idx.json?orderBy=%22t%22&limitToLast=5'))[0] === 200, '讀最新列表 → 可以');
  ok((await rq('/rooms/' + A + '.json', 'PUT', { pw: pa, t: Date.now(), d: 'x'.repeat(50000) }))[0] !== 200, '塞超大資料 → 被擋');
  ok((await rq('/rooms/' + A + '.json', 'PUT', { pw: pa, t: Date.now(), d: '{}', evil: 1 }))[0] !== 200, '多塞欄位 → 被擋');
  ok((await save(A, pa, 1, 262))[0] === 200, '主人用對的密碼更新 A → 可以');
  console.log('按讚');
  const day = Math.floor(Date.now() / 86400000);
  ok((await rq('/likes/' + A + '/' + B + '.json', 'PUT', day))[0] === 200, 'B 讚 A → 可以');
  ok((await rq('/likes/' + A + '/' + B + '.json', 'PUT', day))[0] !== 200, 'B 再讚 A 一次 → 被擋');
  ok((await rq('/likes/' + A + '/' + A + '.json', 'PUT', day))[0] !== 200, 'A 讚自己 → 被擋');
  ok((await rq('/likes/' + A + '/nobody12345.json', 'PUT', day))[0] !== 200, '不存在的人按讚 → 被擋');
  console.log(`\n通過 ${pass}，失敗 ${fail}`);
  console.log('示範房', A, B);
})();
