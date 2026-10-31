// 自動檢查：①每件家具/角色的零件彼此不重疊（重疊就會透視）②輸出圖片供人工檢查層級
require('../js/raster.js'); require('../js/models.js');
const { Pix, Iso, depthSort, toPNG, behind } = PX, M = MODELS;
const fs = require('fs'), path = require('path');
const outDir = path.join(__dirname, 'out'); fs.mkdirSync(outDir, { recursive: true });
let bad = 0;
function overlaps(a, b) {
  const e = 1e-6;
  return a.i0 < b.i1 - e && b.i0 < a.i1 - e && a.j0 < b.j1 - e && b.j0 < a.j1 - e && a.z0 < b.z1 - e && b.z0 < a.z1 - e;
}
function checkParts(name, parts) {
  for (let x = 0; x < parts.length; x++) for (let y = x + 1; y < parts.length; y++)
    if (overlaps(parts[x], parts[y])) { bad++; console.log('OVERLAP', name, x, y, JSON.stringify([parts[x], parts[y]].map(p => [p.i0, p.i1, p.j0, p.j1, p.z0, p.z1].map(v => +v.toFixed(3))))); }
}
// 家具
for (const id in M.ITEMS) {
  const d = M.ITEMS[id]; if (d.kind !== 'floor') continue;
  for (let r = 0; r < 4; r++) for (const on of [false, true]) checkParts(id + ' r' + r, M.itemParts({ t: id, i: 0, j: 0, r, on }));
}
// 角色（不含頭，頭是一整個零件）
for (const f of ['SW', 'SE', 'NE', 'NW']) for (const st of [-1, 0, 1]) for (const hair of M.HAIRS) {
  checkParts('char ' + f + st + hair, M.charParts(0, 0, f, st, { hair }, 'stand').parts);
  checkParts('charSit ' + f + hair, M.charParts(0, 0, f, 0, { hair, shirt: 1, pants: 1 }, 'sit', 19).parts);
}
console.log(bad ? `重疊 ${bad} 處` : '零件重疊檢查：全部通過');

// 家具圖鑑：每件 4 個方向
const ids = Object.keys(M.ITEMS).filter(k => M.ITEMS[k].kind === 'floor');
const cw = 230, rh = 190, W = cw * 4, H = rh * ids.length;
const pix = new Pix(W, H); pix.rect(0, 0, W - 1, H - 1, [250, 236, 214]);
ids.forEach((id, row) => {
  for (let r = 0; r < 4; r++) {
    const iso = new Iso(pix, r * cw + cw / 2, row * rh + 70);
    iso.flat(0, 0, 3, 3, [232, 196, 138], 0, [214, 174, 116]);
    const parts = depthSort(M.itemParts({ t: id, i: 0.5, j: 0, r, on: r % 2 === 1 }));
    for (const p of parts) p.draw(iso);
  }
});
fs.writeFileSync(path.join(outDir, 'items.png'), toPNG(pix, 1));
console.log('items.png', ids.length, '件');
