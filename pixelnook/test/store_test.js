// 家具店檢查：連續 28 天的展示配置都要「走得到每件展示品、門口和店長不被擋」，並輸出示範圖
require('../js/raster.js'); require('../js/models.js'); require('../js/scene.js');
const fs = require('fs'), path = require('path');
for (const f of ['../js/art/city.js', '../js/art/cafe.js', '../js/art/park.js', '../js/art/shops.js']) { try { require(f); } catch (e) { } }
require('../js/world.js');
const { Pix, Iso, depthSort, toPNG } = PX, M = MODELS, W = WORLD, S = SCENE, I = M.ITEMS;
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('  ✗ ' + m); } };
W.makeScene('commercial');   // 先註冊美術
// 跟 game.js 的 showroomPick 一樣的挑法（特價用假的）
function pick(day) {
  const sets = Object.keys(M.SETS), feat = sets[day % sets.length];
  const vis = Object.keys(I).filter(id => !I[id].hidden && I[id].set).sort();
  const sale = [vis[(day * 7) % vis.length], vis[(day * 13 + 5) % vis.length]];
  const floor = vis.filter(id => I[id].kind !== 'wall' && (I[id].set === feat || sale.includes(id)));
  const wall = vis.filter(id => I[id].kind === 'wall' && (I[id].set === feat || sale.includes(id)));
  const others = vis.filter(id => I[id].kind === 'floor' && I[id].set !== feat && !floor.includes(id));
  floor.push(others[day % others.length], others[(day * 3 + 1) % others.length]);
  return { seed: day, featured: feat, floor, wall };
}
const counts = [];
for (let day = 20000; day < 20028; day++) {
  const o = pick(day), sc = W.makeScene('furniture', o), room = sc.room;
  const g = sc.blocked, dc = S.doorCell(room.door), n = sc.npcs[0];
  ok(!g[dc[0]][dc[1]], day + ' 門口被擋');
  ok(n.talkFrom.some(c => !g[c[0]][c[1]] && W.bfs(g, sc.ni, sc.nj, dc, c)), day + ' 走不到店長');
  const fl = room.items.filter(x => x.shop && I[x.t].kind === 'floor');
  for (const it of fl) {
    const reach = S.cellsOf(it).some(([a, b]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([x, y]) => { const c = [a + x, b + y]; return c[0] >= 0 && c[1] >= 0 && c[0] < sc.ni && c[1] < sc.nj && !g[c[0]][c[1]] && W.bfs(g, sc.ni, sc.nj, dc, c); }));
    ok(reach, day + ' 走不到展示品 ' + it.t);
  }
  for (const it of room.items) ok(S.canPlace(Object.assign({}, room, { items: room.items.filter(x => x !== it) }), it), day + ' 重疊 ' + it.t);
  const walls = room.walls.filter(x => x.shop).length, rugs = room.items.filter(x => x.shop && I[x.t].kind === 'rug').length;
  ok(fl.length >= 6, day + ' 展示品太少：' + fl.length);
  counts.push(fl.length + '+' + rugs + '+' + walls);
  if (day === 20000 || day === 20001) {
    const pix = new Pix(800, 480); S.drawBG(pix, room);
    const iso = new Iso(pix, S.OX, S.OY), list = [];
    for (const it of room.items) if (I[it.t].kind === 'floor') for (const p of M.itemParts(it)) list.push(p);
    const cp = M.charParts(n.i, n.j, n.facing, 0, W.NPCS.hazel.look, 'stand'); list.push(Object.assign({}, cp.aabb, { draw(i2) { for (const p of cp.parts) p.draw(i2); } }));
    for (const p of depthSort(list)) p.draw(iso);
    fs.writeFileSync(path.join(__dirname, 'out', 'store_' + (day - 20000) + '.png'), toPNG(pix, 1));
  }
}
// 商業街：家具店的門走得到
const cm = W.makeScene('commercial'), fb = cm.items.find(o => o.t === 'furniture_building');
ok(fb && fb.enter === 'furniture', '商業街有家具店');
if (fb) { const dc = W.doorCellOf(fb); ok(!cm.blocked[dc[0]][dc[1]] && W.bfs(cm.blocked, cm.ni, cm.nj, [1, 9], dc), '走得到家具店門口 ' + dc); }
console.log('每天展示（地上+地毯+牆上）：' + counts.join(' '));
console.log(bad ? `家具店檢查：${bad} 個問題` : '家具店檢查全部通過');
process.exit(bad ? 1 : 0);
