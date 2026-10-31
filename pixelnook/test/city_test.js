// 城市場景算圖＋檢查：地圖配置、物件不重疊、出入口走得到、門口走得到
require('../js/raster.js'); require('../js/models.js'); require('../js/scene.js');
const fs = require('fs'), path = require('path');
for (const f of ['../js/art/city.js', '../js/art/cafe.js', '../js/art/park.js', '../js/art/shops.js']) { try { require(f); } catch (e) { } }
require('../js/world.js');
const { Pix, Iso, depthSort, toPNG } = PX, M = MODELS, W = WORLD, S = SCENE;
const out = path.join(__dirname, 'out');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('  ✗ ' + m); } };
for (const id of ['central', 'commercial', 'park', 'cafe', 'bakery', 'market']) {
  const sc = W.makeScene(id);
  // 物件互不重疊、在地圖內
  const occ = {};
  for (const o of sc.items) {
    if (sc.interior) break;
    const [w, d] = M.footprint(M.ITEMS[o.t], o.r);
    for (let x = 0; x < w; x++) for (let y = 0; y < d; y++) {
      const k = (o.i + x) + ',' + (o.j + y);
      ok(o.i + x >= 0 && o.j + y >= 0 && o.i + x < sc.ni && o.j + y < sc.nj, id + ' 物件出界 ' + o.t);
      ok(!occ[k], id + ' 物件重疊 ' + o.t + ' 與 ' + occ[k]); occ[k] = o.t;
    }
  }
  // 從中間能走到每個出口與每個門口
  const start = sc.interior ? S.doorCell(sc.room.door) : (() => { for (let i = 0; i < sc.ni; i++) for (let j = 0; j < sc.nj; j++) if (!sc.blocked[i][j] && sc.tiles[i][j] !== 'grass') return [i, j]; })();
  for (const ex of sc.exits || []) for (const c of ex.cells) ok(W.bfs(sc.blocked, sc.ni, sc.nj, start, c), id + ' 走不到出口 ' + c);
  for (const o of sc.items) { const dc = W.doorCellOf(o); if (dc && (o.enter || o.home || o.closed)) ok(W.bfs(sc.blocked, sc.ni, sc.nj, start, dc), id + ' 走不到門口 ' + o.t + ' ' + dc); }
  // 可採集／可調查的東西、NPC：旁邊要有走得到的格子
  const reach = cells => cells.some(([a, b]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([x, y]) => { const c = [a + x, b + y]; return c[0] >= 0 && c[1] >= 0 && c[0] < sc.ni && c[1] < sc.nj && !sc.blocked[c[0]][c[1]] && W.bfs(sc.blocked, sc.ni, sc.nj, start, c); }));
  for (const o of sc.items) if (o.harvest || o.search) ok(reach(S.cellsOf(o)), id + ' 走不到 ' + o.t + ' @' + o.i + ',' + o.j);
  for (const n of sc.npcs || []) ok(n.talkFrom.some(c => !sc.blocked[c[0]][c[1]] && W.bfs(sc.blocked, sc.ni, sc.nj, start, c)), id + ' 走不到 NPC ' + n.id);
  // 算圖：背景＋物件＋一個角色
  const pix = W.drawSceneBG(sc), iso = new Iso(pix, sc.ox, sc.oy);
  const list = [];
  for (const it of sc.items) if (M.ITEMS[it.t].kind === 'floor') for (const p of M.itemParts(it)) list.push(p);
  const c = start;
  const cp = M.charParts(c[0] + 0.5, c[1] + 0.5, 'SW', 0, { shirt: 2 }, 'stand');
  list.push(Object.assign({}, cp.aabb, { draw: is => cp.parts.forEach(p => p.draw(is)) }));
  for (const d of depthSort(list)) d.draw(iso);
  fs.writeFileSync(path.join(out, 'city_' + id + '.png'), toPNG(pix, 1));
  console.log(id, sc.ni + 'x' + sc.nj, '物件', sc.items.length, '世界', sc.ww + 'x' + sc.wh);
}
console.log(bad ? '問題 ' + bad : '城市檢查全部通過');
