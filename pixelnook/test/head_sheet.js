// 輸出「身體方向 × 頭方向」對照圖：test/out/head_sheet.png
require('../js/raster.js'); require('../js/models.js');
const { Pix, Iso, toPNG } = PX, M = MODELS, fs = require('fs'), path = require('path');
const F = ['SW', 'SE', 'NE', 'NW'], SIDE = { SW: ['SE', 'NW'], NE: ['SE', 'NW'], SE: ['SW', 'NE'], NW: ['SW', 'NE'] };
const cw = 110, rh = 140, pix = new Pix(cw * 3, rh * 4); pix.rect(0, 0, cw * 3 - 1, rh * 4 - 1, [250, 236, 214]);
F.forEach((f, r) => [null].concat(SIDE[f]).forEach((h, c) => {
  const iso = new Iso(pix, c * cw + cw / 2, r * rh + 120);
  for (const p of M.charParts(0, 0, f, 0, { hair: r % 2 ? 'long' : 'short', hat: r === 2 ? [90, 140, 80] : 0 }, 'stand', 0, h).parts) p.draw(iso);
}));
fs.writeFileSync(path.join(__dirname, 'out', 'head_sheet.png'), toPNG(pix, 2));
