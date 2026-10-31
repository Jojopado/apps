require('../js/raster.js'); require('../js/models.js'); require('../js/scene.js');
const fs = require('fs'), path = require('path'), S = SCENE, M = MODELS;
const out = path.join(__dirname, 'out');
// 場景 1：一般房間，角色站在家具前後
const room = S.newRoom();
room.wall = 1; room.floor = 0;
room.items = [
  { t: 'rug_modern', i: 3, j: 3, r: 0 },
  { t: 'bed_wood', i: 0, j: 3, r: 1 },
  { t: 'shelf_wood', i: 4, j: 0, r: 0 },
  { t: 'desk_modern', i: 6, j: 0, r: 0 }, { t: 'chair_modern', i: 6, j: 1, r: 2 },
  { t: 'sofa_pastel', i: 4, j: 6, r: 2 }, { t: 'table_wood', i: 5, j: 4, r: 0 },
  { t: 'plant_b', i: 8, j: 2, r: 0 }, { t: 'lamp_wood', i: 3, j: 7, r: 0, on: true },
  { t: 'tv_modern', i: 8, j: 4, r: 3, on: true }, { t: 'tank_green', i: 0, j: 0, r: 1 },
];
room.walls = [{ t: 'win_wood', side: 'R', u: 1 }, { t: 'clock', side: 'R', u: 3 }, { t: 'paint_hill', side: 'L', u: 2 }, { t: 'wall_shelf', side: 'L', u: 5 }];
const look = { hair: 'short', shirt: 0, pants: 0, shoes: 0 };
const chars = [
  { i: 5.5, j: 1.5, facing: 'SW', step: 0, look },                       // 書櫃前面
  { i: 4.5, j: 5.2, facing: 'SE', step: 1, look: { hair: 'long', hairC: 3, shirt: 6, pants: 3 } },  // 沙發後面
  { i: 7.5, j: 3.3, facing: 'NE', step: -1, look: { hair: 'spiky', hairC: 1, shirt: 2, pants: 1 } }, // 書桌前
];
// 坐在椅子／沙發上
const ch = room.items.find(x => x.t === 'chair_modern'); const sp = M.seatSpot(ch, 0);
chars.push({ i: sp.i, j: sp.j, facing: sp.facing, look: { hair: 'bald', skin: 3, shirt: 4, pants: 1 }, pose: 'sit', seatZ: sp.z });
const so = room.items.find(x => x.t === 'sofa_pastel'); const s2 = M.seatSpot(so, 1);
chars.push({ i: s2.i, j: s2.j, facing: s2.facing, look: { hair: 'long', hairC: 4, shirt: 3, pants: 0 }, pose: 'sit', seatZ: s2.z });
const bd = room.items.find(x => x.t === 'bed_wood'); const s3 = M.seatSpot(bd, 0);
chars.push({ i: s3.i, j: s3.j, facing: s3.facing, look: { hairC: 2, shirt: 1, pants: 2 }, pose: 'sit', seatZ: s3.z });
fs.writeFileSync(path.join(out, 'room1.png'), PX.toPNG(S.renderFull(room, chars), 2));
console.log('comfort', JSON.stringify(S.comfortOf(room)));
// 場景 2：每種座位 × 4 個方向坐下（各一張）
for (const t of ['chair_wood', 'sofa_wood', 'bean_pastel', 'cushion_pastel', 'bed_pastel']) {
  const r2 = S.newRoom(); r2.floor = 2; r2.wall = 0; const c2 = [];
  const spots = [[1, 1], [5, 1], [1, 4], [5, 4]];
  for (let r = 0; r < 4; r++) {
    const it = { t, i: spots[r][0], j: spots[r][1], r }; r2.items.push(it);
    const s = M.seatSpot(it, 0); c2.push({ i: s.i, j: s.j, facing: s.facing, look: { shirt: r + 1, pants: r, hair: ['short','long','spiky','short'][r] }, pose: 'sit', seatZ: s.z });
  }
  fs.writeFileSync(path.join(out, 'seat_' + t + '.png'), PX.toPNG(S.renderFull(r2, c2), 2));
}
// 路徑測試
console.log('path', JSON.stringify(S.findPath(room, [3, 4], [7, 6])));
