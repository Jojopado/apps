// PixelNook 城市外觀美術：地面格子（TILES）＋建築外觀與街道小物（OBJS）。全部程式繪圖。
// 規則跟 models.js 一樣：同一物件的零件彼此不重疊（貼齊可以）；細節用凸出 0.01～0.07 格的薄方塊或 bands。
// 物件本地座標：f = 前後（+f 是正面）、s = 左右；W = 左右格數、D = 前後格數；物件中心在 (0,0)。
(function (G) {
  'use strict';
  const { shade, OUT } = G.PX;
  const p = (f, s, wf, ws, h, z, c, b, hi) => ({ f, s, wf, ws, h, z, c, b, hi: hi !== false });
  // 用範圍寫方塊比較不容易重疊：f0..f1、s0..s1、z0..z1
  const B = (f0, f1, s0, s1, z0, z1, c, b, hi) => p((f0 + f1) / 2, (s0 + s1) / 2, f1 - f0, s1 - s0, z1 - z0, z0, c, b, hi);

  // ---------------- 色盤 ----------------
  const K = {
    white: [246, 246, 250], cream: [250, 240, 220], dark: [52, 56, 70], gray: [160, 166, 180], grayL: [206, 210, 220], grayD: [110, 116, 132],
    glass: [150, 206, 238], glassL: [206, 238, 252], gold: [240, 196, 90], wood: [190, 132, 84], woodL: [214, 166, 112], woodD: [140, 94, 62],
    leaf: [96, 168, 92], leafD: [72, 140, 80], leafL: [132, 196, 108], pine: [70, 140, 96], pineD: [56, 118, 82], trunk: [140, 94, 62],
    red: [226, 92, 86], pink: [244, 168, 190], yellow: [250, 210, 100], orange: [244, 150, 80], lilac: [200, 182, 232], blue: [126, 184, 232],
    water: [104, 178, 232], waterL: [176, 224, 250], stone: [214, 210, 204], stoneD: [176, 170, 164],
    // 咖啡廳
    cafeWall: [240, 222, 190], brick: [184, 110, 84], cafeTrim: [122, 84, 60], awnA: [208, 92, 78], awnB: [250, 238, 214], signDark: [96, 64, 46],
    coffee: [120, 76, 50], latte: [214, 170, 122], cafeDoor: [98, 150, 130], cafeRoof: [120, 84, 66],
    // 麵包店
    bakeWall: [252, 222, 206], bakeLow: [250, 244, 230], bakeTrim: [176, 118, 84], bakeRoof: [168, 98, 76], bakeRoofL: [190, 120, 92],
    loaf: [222, 156, 84], loafL: [238, 184, 108], loafD: [176, 108, 58], awnPink: [236, 128, 140], bakeDoor: [214, 120, 104],
    // 超市
    martWall: [236, 240, 244], green: [92, 176, 112], greenD: [66, 140, 88], crate: [200, 150, 96], martRoof: [176, 182, 196],
    // 公寓
    aptWall: [222, 160, 128], aptBand: [246, 232, 210], aptRoof: [150, 140, 150], aptDoor: [96, 112, 150],
    // 家
    homeWall: [252, 234, 184], homeRoof: [222, 104, 92], homeRoofL: [236, 128, 110], homeDoor: [96, 170, 176], shutter: [126, 178, 214],
    // 街道
    iron: [70, 84, 104], lampOn: [255, 236, 150], lampOff: [226, 222, 196], bench: [214, 150, 92], cork: [196, 146, 98],
    mailbox: [92, 140, 206], bin: [110, 170, 130], barrier: [250, 150, 60], sign: [80, 150, 210],
  };

  // ---------------- 建築共用：牆面、窗、門 ----------------
  // bd = 主體範圍 {fF 正面, fB 背面, sL 左, sR 右}。face: 'F' 正面(+f) 'K' 背面(-f) 'R' 右(+s) 'L' 左(-s)。
  // u = 沿著牆面的座標（F/K 用 s，R/L 用 f），d0..d1 = 離牆面往外的距離。
  // 【層級關鍵】d0 < 0.06 的是「貼牆薄片」：不管傳進來的 d0/d1，一律照呼叫順序疊成一層一層（每層 0.0002 格），
  // 後畫的永遠在前面一層 → 薄片之間只會用前後分開、不會出現「上下 vs 左右」互相矛盾的循環，排序永遠正確。
  // d0 >= 0.06 的是真正凸出的方塊（遮陽棚、花箱…），照給的深度放。
  const LAYER = 0.0002, PLATE_MAX = 0.05;
  function faceFn(bd) {
    const cnt = { F: 0, K: 0, R: 0, L: 0 };
    return (face, u0, u1, z0, z1, d0, d1, c, b, hi) => {
      hi = hi === true;
      if (d0 < 0.06) {
        d0 = cnt[face] * LAYER; d1 = d0 + LAYER; cnt[face]++;
        if (d1 > PLATE_MAX) throw new Error('too many wall plates on face ' + face);
      }
      if (face === 'F') return B(bd.fF + d0, bd.fF + d1, u0, u1, z0, z1, c, b, hi);
      if (face === 'K') return B(bd.fB - d1, bd.fB - d0, u0, u1, z0, z1, c, b, hi);
      if (face === 'R') return B(u0, u1, bd.sR + d0, bd.sR + d1, z0, z1, c, b, hi);
      return B(u0, u1, bd.sL - d1, bd.sL - d0, z0, z1, c, b, hi);
    };
  }
  // 窗戶：外框(0~0.02) → 玻璃(0.02~0.035，上段反光) → 十字窗格(0.035~0.045)；窗台在下面
  function windowOn(a, fb, face, u0, u1, z0, z1, o) {
    o = o || {};
    const fr = o.frame || K.white, gl = o.glass || K.glass, m = o.inset || 0.06, zt = z1 - 4, zb = z0 + 4;
    a.push(fb(face, u0, u1, z0, z1, 0, 0.02, fr));
    a.push(fb(face, u0 + m, u1 - m, zb, zt, 0.02, 0.035, gl, [[zt - Math.max(4, Math.round((zt - zb) * 0.28)), zt, K.glassL]]));
    if (o.mull !== false) {
      const mid = (u0 + u1) / 2, zc = Math.round((zb + zt) / 2);
      a.push(fb(face, mid - 0.02, mid + 0.02, zb, zt, 0.035, 0.045, fr));
      if (o.cross !== false) {
        a.push(fb(face, u0 + m, mid - 0.02, zc - 1, zc + 2, 0.035, 0.045, fr));
        a.push(fb(face, mid + 0.02, u1 - m, zc - 1, zc + 2, 0.035, 0.045, fr));
      }
    }
    if (o.sill !== false) a.push(fb(face, u0 - 0.04, u1 + 0.04, z0 - 4, z0, 0, 0.07, o.sillC || fr));
    if (o.flowers) {           // 窗台下的花箱：箱子＋葉子＋花
      const fz = z0 - 4;
      a.push(fb(face, u0, u1, fz - 9, fz, 0.06, 0.14, K.woodD));
      a.push(fb(face, u0 + 0.02, u1 - 0.02, fz, fz + 3, 0.07, 0.13, K.leaf));
      const cols = o.flowers === true ? [K.red, K.yellow, K.pink] : o.flowers;
      for (let k = 0, u = u0 + 0.06; u + 0.1 <= u1 - 0.02; u += 0.16, k++) a.push(fb(face, u, u + 0.1, fz + 3, fz + 7, 0.08, 0.12, cols[k % cols.length]));
    }
    if (o.shutters) {          // 窗戶兩側的百葉板
      const sc = o.shutters;
      a.push(fb(face, u0 - 0.15, u0 - 0.03, z0, z1, 0, 0.03, sc, [[z0 + 8, z0 + 10, shade(sc, 0.8)], [z1 - 10, z1 - 8, shade(sc, 0.8)]]));
      a.push(fb(face, u1 + 0.03, u1 + 0.15, z0, z1, 0, 0.03, sc, [[z0 + 8, z0 + 10, shade(sc, 0.8)], [z1 - 10, z1 - 8, shade(sc, 0.8)]]));
    }
  }
  // 門：門框(0~0.02) → 門板(0.02~0.035) → 門上小窗、門把(0.035~)
  function doorOn(a, fb, face, u0, u1, h, o) {
    o = o || {};
    const fr = o.frame || K.white, col = o.col || K.woodD;
    a.push(fb(face, u0 - 0.06, u1 + 0.06, 0, h + 6, 0, 0.02, fr));
    a.push(fb(face, u0, u1, 0, h, 0.02, 0.035, col, [[0, 4, shade(col, 0.8)]]));
    if (o.glass !== false) a.push(fb(face, u0 + 0.1, u1 - 0.1, Math.round(h * 0.56), h - 9, 0.035, 0.045, K.glass, [[h - 15, h - 9, K.glassL]]));
    if (o.panel) a.push(fb(face, u0 + 0.1, u1 - 0.1, 10, Math.round(h * 0.4), 0.035, 0.045, shade(col, 1.1)));
    const kn = o.knobLeft ? u0 + 0.07 : u1 - 0.1;
    a.push(fb(face, kn, kn + 0.04, Math.round(h * 0.46), Math.round(h * 0.46) + 4, 0.035, 0.065, K.gold));
  }
  // 階梯式斜屋頂（屋脊沿左右 s）：每層往內縮 step、高 lh；回傳最後一層的頂高
  function steppedRoof(a, f0, f1, s0, s1, z, n, step, lh, colA, colB) {
    for (let k = 0; k < n; k++) a.push(B(f0 + step * k, f1 - step * k, s0, s1, z + lh * k, z + lh * (k + 1), k % 2 ? colB : colA, [[z + lh * k, z + lh * k + 1, shade(colA, 0.78)]]));
    return z + lh * n;
  }
  // 平屋頂女兒牆（四邊不重疊）
  function parapet(a, f0, f1, s0, s1, z0, z1, t, col) {
    a.push(B(f1 - t, f1, s0, s1, z0, z1, col), B(f0, f0 + t, s0, s1, z0, z1, col));
    a.push(B(f0 + t, f1 - t, s0, s0 + t, z0, z1, col), B(f0 + t, f1 - t, s1 - t, s1, z0, z1, col));
  }
  // 條紋遮陽棚（兩層階梯＋前面的波浪垂邊），條紋沿 s
  function awning(a, fF, s0, s1, z, depth, cA, cB) {
    const n = Math.max(2, Math.round((s1 - s0) / 0.26)), w = (s1 - s0) / n, h = depth / 2;
    for (let k = 0; k < n; k++) {
      const u0 = s0 + w * k, u1 = u0 + w, c = k % 2 ? cB : cA;
      a.push(B(fF + 0.06, fF + h, u0, u1, z + 6, z + 12, c));
      a.push(B(fF + h, fF + depth, u0, u1, z, z + 6, c));
      a.push(B(fF + depth, fF + depth + 0.03, u0, u1, k % 2 ? z - 5 : z - 9, z + 6, c, null, false));
    }
  }

  // ---------------- 建築 ----------------
  // 咖啡廳 5×4：奶油色牆＋紅磚腰、大窗戶、紅白遮陽棚、正面咖啡杯招牌＋屋頂大咖啡杯
  function cafeBuilding() {
    const bd = { fF: 1.3, fB: -1.9, sL: -2.4, sR: 2.4 }, fb = faceFn(bd), H = 148, a = [];
    a.push(B(bd.fB, bd.fF, bd.sL, bd.sR, 0, H, K.cafeWall, [[0, 22, K.brick], [22, 25, K.cafeTrim], [144, 148, K.cafeTrim]]));
    // 正面：兩扇大窗＋中間的門
    const wo = { frame: K.cafeTrim, sillC: K.cafeTrim };
    windowOn(a, fb, 'F', -2.2, -0.7, 30, 92, wo);
    windowOn(a, fb, 'F', 0.7, 2.2, 30, 92, wo);
    doorOn(a, fb, 'F', -0.36, 0.36, 86, { frame: K.cafeTrim, col: K.cafeDoor });
    a.push(fb('F', -0.64, -0.5, 64, 78, 0, 0, K.cafeTrim), fb('F', 0.5, 0.64, 64, 78, 0, 0, K.cafeTrim), fb('F', -0.62, -0.52, 66, 76, 0, 0, K.lampOn), fb('F', 0.52, 0.62, 66, 76, 0, 0, K.lampOn));  // 壁燈
    awning(a, bd.fF, -2.35, 2.35, 100, 0.5, K.awnA, K.awnB);
    // 正面招牌：深色木板＋咖啡杯圖案＋兩側咖啡豆
    a.push(fb('F', -1.4, 1.4, 117, 143, 0, 0.02, K.signDark, [[117, 119, K.cafeTrim], [141, 143, K.cafeTrim]]));
    a.push(fb('F', -0.42, 0.28, 121, 124, 0, 0.02, K.cream));                 // 杯盤
    a.push(fb('F', -0.3, 0.16, 124, 139, 0, 0.02, K.cream, [[135, 139, K.latte]])); // 杯身
    a.push(fb('F', 0.16, 0.34, 134, 137, 0, 0.02, K.cream), fb('F', 0.28, 0.34, 128, 134, 0, 0.02, K.cream), fb('F', 0.16, 0.28, 128, 131, 0, 0.02, K.cream)); // 把手
    for (const s of [-1.1, -0.8, 0.66, 0.96]) a.push(fb('F', s, s + 0.16, 127, 135, 0, 0.02, K.latte, [[130, 132, K.coffee]]));
    // 門口：台階＋兩個花槽
    a.push(B(1.37, 1.62, -0.46, 0.46, 0, 3, K.stone));
    for (const sg of [-1, 1]) {
      const s0 = sg < 0 ? -2.2 : 1.5, s1 = sg < 0 ? -1.5 : 2.2;
      a.push(B(1.4, 1.78, s0, s1, 0, 13, K.woodD, [[0, 2, shade(K.woodD, 0.8)]]));
      a.push(B(1.42, 1.76, s0 + 0.02, s1 - 0.02, 13, 23, K.leaf));
      a.push(B(1.52, 1.64, s0 + 0.12, s0 + 0.24, 23, 27, K.red, null, false), B(1.5, 1.62, s1 - 0.26, s1 - 0.14, 23, 27, K.yellow, null, false));
    }
    // 側面、背面
    for (const f of ['R', 'L']) { windowOn(a, fb, f, -1.5, -0.5, 36, 92, wo); windowOn(a, fb, f, 0.1, 1.0, 36, 92, wo); }
    windowOn(a, fb, 'K', -1.7, -0.7, 40, 90, wo);
    doorOn(a, fb, 'K', 0.6, 1.3, 84, { frame: K.cafeTrim, col: K.woodD, glass: false, panel: true });
    // 屋頂：平頂＋女兒牆＋屋頂上的大咖啡杯
    a.push(B(bd.fB, bd.fF, bd.sL, bd.sR, H, H + 7, K.cafeRoof));
    parapet(a, bd.fB, bd.fF, bd.sL, bd.sR, H + 7, H + 13, 0.1, K.cafeTrim);
    const z = H + 7;
    a.push(B(-0.85, 0.25, -0.55, 0.55, z, z + 4, K.white, [[z, z + 1, K.grayL]]));                  // 杯盤
    a.push(B(-0.7, 0.1, -0.4, 0.4, z + 4, z + 26, K.white, [[z + 4, z + 8, K.awnA]]));          // 杯身
    a.push(B(-0.7, 0.1, -0.4, 0.4, z + 26, z + 27, K.coffee, null, false));                      // 咖啡面（比杯緣低）
    parapet(a, -0.7, 0.1, -0.4, 0.4, z + 27, z + 30, 0.07, K.white);                             // 杯緣
    a.push(B(0.1, 0.12, -0.12, 0.12, z + 13, z + 22, K.awnA, null, false));                          // 杯身正面的紅色標記
    a.push(B(-0.38, -0.22, 0.4, 0.56, z + 20, z + 25, K.white), B(-0.38, -0.22, 0.5, 0.56, z + 11, z + 20, K.white), B(-0.38, -0.22, 0.4, 0.5, z + 11, z + 15, K.white)); // 把手
    return a;
  }

  // 麵包店 4×4：粉色兩層樓、粉白遮陽棚、立體麵包招牌、階梯斜屋頂＋烤爐煙囪
  function bakeryBuilding() {
    const bd = { fF: 1.3, fB: -1.9, sL: -1.85, sR: 1.85 }, fb = faceFn(bd), H = 150, a = [];
    a.push(B(bd.fB, bd.fF, bd.sL, bd.sR, 0, H, K.bakeWall, [[0, 96, K.bakeLow], [0, 8, K.bakeTrim], [96, 100, K.bakeTrim], [146, 150, K.bakeTrim]]));
    const wo = { frame: K.bakeTrim, sillC: K.bakeTrim };
    // 一樓：大展示窗＋門（門在右邊那一格）
    windowOn(a, fb, 'F', -1.72, -0.05, 18, 86, Object.assign({ cross: false }, wo));
    doorOn(a, fb, 'F', 0.18, 0.82, 86, { frame: K.bakeTrim, col: K.bakeDoor });
    a.push(fb('F', 1.1, 1.7, 30, 70, 0, 0.03, K.bakeTrim));                       // 門旁的小黑板（色塊）
    a.push(fb('F', 1.16, 1.64, 34, 66, 0.03, 0.04, [64, 84, 76], [[56, 58, K.cream], [48, 50, K.cream], [40, 42, K.pink]]));
    awning(a, bd.fF, -1.8, 1.8, 100, 0.5, K.awnPink, K.white);
    // 二樓：兩扇窗＋中間的麵包招牌
    windowOn(a, fb, 'F', -1.6, -0.75, 116, 142, wo);
    windowOn(a, fb, 'F', 0.75, 1.6, 116, 142, wo);
    a.push(fb('F', -0.6, 0.6, 114, 145, 0, 0.02, K.cream, [[114, 116, K.bakeTrim], [143, 145, K.bakeTrim]]));
        a.push(fb('F', -0.44, 0.44, 119, 131, 0, 0, K.loaf, [[119, 121, K.loafD]]));             // 麵包下半
    a.push(fb('F', -0.34, 0.34, 131, 137, 0, 0, K.loafL));                                   // 麵包上半（圓頂）
    a.push(fb('F', -0.24, 0.24, 137, 139, 0, 0, K.loafL));
    for (const s of [-0.26, -0.04, 0.18]) a.push(fb('F', s, s + 0.08, 127, 135, 0, 0, K.loafD)); // 割紋
    // 門口：麵包籃
    for (const s0 of [-1.72, -1.15]) {
      a.push(B(1.42, 1.76, s0, s0 + 0.46, 0, 14, K.woodL, [[5, 6, K.woodD], [10, 11, K.woodD]]));
      for (let k = 0; k < 3; k++) a.push(B(1.52 + (k % 2) * 0.08, 1.6 + (k % 2) * 0.08, s0 + 0.06 + k * 0.13, s0 + 0.15 + k * 0.13, 14, 30 - k * 2, K.loaf, [[24 - k * 2, 26 - k * 2, K.loafD]], false));
    }
    a.push(B(1.37, 1.6, 0.12, 0.88, 0, 3, K.stone));
    // 側面、背面
    for (const f of ['R', 'L']) {
      windowOn(a, fb, f, -1.2, -0.2, 26, 82, wo);
      windowOn(a, fb, f, -1.3, -0.5, 116, 140, Object.assign({ flowers: true }, wo));
      windowOn(a, fb, f, 0.2, 1.0, 116, 140, Object.assign({ flowers: [K.pink, K.white, K.lilac] }, wo));
    }
    windowOn(a, fb, 'K', -1.4, -0.5, 116, 140, wo); windowOn(a, fb, 'K', 0.5, 1.4, 116, 140, wo);
    doorOn(a, fb, 'K', -0.4, 0.3, 84, { frame: K.bakeTrim, col: K.woodD, glass: false, panel: true });
    // 屋頂＋煙囪（煙囪站在第 2 層上，旁邊剛好是第 3 層的邊）
    const rf0 = bd.fB, rf1 = bd.fF;
    steppedRoof(a, rf0, rf1, bd.sL, bd.sR, H, 7, 0.22, 6, K.bakeRoof, K.bakeRoofL);
    const cz = H + 12, cf0 = rf0 + 0.24, cf1 = rf0 + 0.44;
    a.push(B(cf0, cf1, -1.4, -1.06, cz, cz + 46, K.brick, [[cz + 20, cz + 22, shade(K.brick, 0.8)], [cz + 34, cz + 36, shade(K.brick, 0.8)]]));
    a.push(B(cf0 - 0.04, cf1 + 0.04, -1.44, -1.02, cz + 46, cz + 51, K.stoneD));
    return a;
  }

  // 超市 6×5：白牆＋綠色招牌帶、整面玻璃、自動門、門口水果攤、屋頂立牌
  function marketBuilding() {
    const bd = { fF: 1.7, fB: -2.4, sL: -2.9, sR: 2.9 }, fb = faceFn(bd), H = 120, a = [];
    a.push(B(bd.fB, bd.fF, bd.sL, bd.sR, 0, H, K.martWall, [[0, 8, K.grayD], [98, 120, K.green], [98, 100, K.greenD]]));
    const wo = { frame: K.grayD, sill: false, cross: false };
    windowOn(a, fb, 'F', -2.75, -1.55, 10, 82, wo); windowOn(a, fb, 'F', -1.5, -0.32, 10, 82, wo);
    windowOn(a, fb, 'F', 1.32, 2.75, 10, 82, wo);
    // 自動門：外框＋兩片玻璃（中間露出一條框）＋感應器
    a.push(fb('F', -0.26, 1.26, 0, 90, 0, 0.02, K.dark));
    a.push(fb('F', -0.2, 0.48, 0, 84, 0.02, 0.035, K.glass, [[64, 84, K.glassL], [0, 3, K.grayD]]));
    a.push(fb('F', 0.52, 1.2, 0, 84, 0.02, 0.035, K.glass, [[64, 84, K.glassL], [0, 3, K.grayD]]));
    a.push(fb('F', 0.38, 0.62, 85, 89, 0.02, 0.07, K.grayL));
    a.push(fb('F', 0.4, 0.44, 30, 54, 0.035, 0.05, K.grayL), fb('F', 0.56, 0.6, 30, 54, 0.035, 0.05, K.grayL)); // 門把條
    // 雨遮＋招牌
    a.push(B(bd.fF + 0.06, bd.fF + 0.55, -2.85, 2.85, 92, 98, K.white, [[92, 94, K.greenD]]));
    a.push(fb('F', -1.9, 1.9, 101, 117, 0, 0.02, K.white, [[101, 102, K.grayL], [116, 117, K.grayL]]));
    a.push(fb('F', -0.24, 0.24, 103, 112, 0, 0.02, K.orange));                             // 購物袋
    a.push(fb('F', -0.15, -0.11, 112, 115, 0, 0.02, K.greenD), fb('F', 0.11, 0.15, 112, 115, 0, 0.02, K.greenD), fb('F', -0.15, 0.15, 115, 116, 0, 0.02, K.greenD));
    a.push(fb('F', -1.4, -1.12, 103, 111, 0, 0.02, K.red), fb('F', -1.28, -1.2, 111, 114, 0, 0.02, K.leaf));   // 蘋果
    a.push(fb('F', 1.12, 1.4, 103, 111, 0, 0.02, K.yellow), fb('F', 1.22, 1.3, 111, 114, 0, 0.02, K.leaf));    // 檸檬
    // 門口：踏墊、水果攤、盆栽
    a.push(B(1.78, 2.3, -0.2, 1.2, 0, 1, K.greenD, null, false));
    a.push(B(1.8, 2.36, -2.75, -0.9, 0, 14, K.woodL, [[0, 2, K.woodD]]));
    const fruit = [K.red, K.orange, K.leafL];
    for (let k = 0; k < 3; k++) a.push(B(1.84, 2.32, -2.7 + k * 0.6, -2.18 + k * 0.6, 14, 22, K.crate, [[20, 22, fruit[k]]]));
    for (const s0 of [1.6, 2.25]) { a.push(B(1.9, 2.24, s0, s0 + 0.34, 0, 12, K.white, [[0, 2, K.grayL]])); a.push(B(1.92, 2.22, s0 + 0.02, s0 + 0.32, 12, 24, K.leaf)); }
    // 側面、背面
    for (const f of ['R', 'L']) { windowOn(a, fb, f, -2.0, -0.8, 50, 80, { frame: K.grayD, cross: false }); windowOn(a, fb, f, 0.2, 1.4, 50, 80, { frame: K.grayD, cross: false }); }
    a.push(fb('K', -2.0, -0.4, 0, 72, 0, 0.02, K.grayD));                                    // 卸貨捲門
    a.push(fb('K', -1.92, -0.48, 0, 66, 0.02, 0.035, K.grayL, [[8, 10, K.gray], [18, 20, K.gray], [28, 30, K.gray], [38, 40, K.gray], [48, 50, K.gray], [58, 60, K.gray]]));
    doorOn(a, fb, 'K', 0.8, 1.45, 84, { frame: K.grayD, col: K.gray, glass: false, panel: true });
    // 屋頂：平頂、女兒牆、冷氣機、立牌
    a.push(B(bd.fB, bd.fF, bd.sL, bd.sR, H, H + 6, K.martRoof));
    parapet(a, bd.fB, bd.fF, bd.sL, bd.sR, H + 6, H + 12, 0.1, K.grayL);
    const z = H + 6;
    a.push(B(-2.0, -1.4, -2.5, -1.9, z, z + 14, K.grayL, [[z + 4, z + 5, K.gray], [z + 8, z + 9, K.gray]]), B(-2.0, -1.4, 1.9, 2.5, z, z + 14, K.grayL, [[z + 4, z + 5, K.gray], [z + 8, z + 9, K.gray]]));
    a.push(B(-1.0, -0.9, -1.5, -1.4, z, z + 26, K.grayD, null, false), B(-1.0, -0.9, 1.4, 1.5, z, z + 26, K.grayD, null, false)); // 立牌支柱
    a.push(B(-0.9, -0.82, -1.7, 1.7, z + 10, z + 42, K.green, [[z + 10, z + 13, K.greenD], [z + 39, z + 42, K.greenD]]));
    a.push(B(-0.82, -0.8, -0.3, 0.3, z + 16, z + 32, K.white), B(-0.82, -0.8, -0.18, -0.12, z + 32, z + 36, K.white), B(-0.82, -0.8, 0.12, 0.18, z + 32, z + 36, K.white));
    return a;
  }

  // 公寓 5×4：磚色三層樓、雨遮入口、窗戶格、陽台、屋頂水塔
  function apartmentBuilding() {
    const bd = { fF: 1.4, fB: -1.9, sL: -2.4, sR: 2.4 }, fb = faceFn(bd), H = 212, a = [];
    a.push(B(bd.fB, bd.fF, bd.sL, bd.sR, 0, H, K.aptWall, [[0, 8, K.grayD], [98, 102, K.aptBand], [154, 158, K.aptBand], [206, 212, K.aptBand]]));
    const wo = { frame: K.aptBand, sillC: K.aptBand };
    // 一樓：玻璃雙門＋雨遮＋兩扇窗＋門牌
    a.push(fb('F', -0.5, 0.5, 0, 92, 0, 0.02, K.aptBand));
    a.push(fb('F', -0.44, -0.01, 0, 86, 0.02, 0.035, K.aptDoor), fb('F', 0.01, 0.44, 0, 86, 0.02, 0.035, K.aptDoor));
    a.push(fb('F', -0.36, -0.09, 30, 78, 0.035, 0.045, K.glass, [[66, 78, K.glassL]]), fb('F', 0.09, 0.36, 30, 78, 0.035, 0.045, K.glass, [[66, 78, K.glassL]]));
    a.push(B(bd.fF + 0.06, bd.fF + 0.45, -0.8, 0.8, 93, 99, K.aptBand, [[93, 95, K.grayD]]));
    a.push(B(bd.fF + 0.45, bd.fF + 0.53, -0.78, -0.7, 0, 101, K.grayD, null, false), B(bd.fF + 0.45, bd.fF + 0.53, 0.7, 0.78, 0, 101, K.grayD, null, false));
    a.push(fb('F', 0.58, 0.78, 60, 70, 0, 0.03, K.gold));
    windowOn(a, fb, 'F', -2.1, -1.0, 30, 80, wo); windowOn(a, fb, 'F', 1.0, 2.1, 30, 80, wo);
    a.push(B(bd.fF + 0.07, bd.fF + 0.4, -0.5, 0.5, 0, 3, K.stone));
    a.push(B(bd.fF + 0.08, bd.fF + 0.42, -2.2, -1.2, 0, 12, K.stoneD), B(bd.fF + 0.1, bd.fF + 0.4, -2.18, -1.22, 12, 24, K.leaf));
    // 二、三樓
    for (const fz of [102, 158]) {
      for (const [u0, u1] of [[-2.0, -1.2], [-0.4, 0.4], [1.2, 2.0]]) windowOn(a, fb, 'F', u0, u1, fz + 12, fz + 46, Object.assign({ flowers: fz === 102 && u0 !== -0.4 ? true : false }, wo));
    }
    // 三樓中間的陽台
    const bz = 158;
    a.push(B(bd.fF + 0.06, bd.fF + 0.4, -0.5, 0.5, bz + 2, bz + 6, K.aptBand));
    a.push(B(bd.fF + 0.36, bd.fF + 0.4, -0.5, 0.5, bz + 6, bz + 20, K.iron, [[bz + 6, bz + 8, shade(K.iron, 1.2)]], false));
    a.push(B(bd.fF + 0.06, bd.fF + 0.36, -0.5, -0.46, bz + 6, bz + 20, K.iron, null, false), B(bd.fF + 0.06, bd.fF + 0.36, 0.46, 0.5, bz + 6, bz + 20, K.iron, null, false));
    a.push(B(bd.fF + 0.08, bd.fF + 0.24, -0.42, -0.28, bz + 6, bz + 14, K.orange), B(bd.fF + 0.1, bd.fF + 0.22, -0.41, -0.29, bz + 14, bz + 22, K.leaf));
    // 側面、背面
    for (const f of ['R', 'L']) for (const fz of [0, 102, 158]) {
      windowOn(a, fb, f, -1.4, -0.6, fz + (fz ? 12 : 30), fz + (fz ? 46 : 80), wo);
      windowOn(a, fb, f, 0.2, 1.0, fz + (fz ? 12 : 30), fz + (fz ? 46 : 80), wo);
    }
    for (const fz of [102, 158]) for (const [u0, u1] of [[-2.0, -1.2], [-0.4, 0.4], [1.2, 2.0]]) windowOn(a, fb, 'K', u0, u1, fz + 12, fz + 46, wo);
    doorOn(a, fb, 'K', -0.35, 0.35, 84, { frame: K.aptBand, col: K.aptDoor, glass: false, panel: true });
    // 屋頂
    a.push(B(bd.fB, bd.fF, bd.sL, bd.sR, H, H + 6, K.aptRoof));
    parapet(a, bd.fB, bd.fF, bd.sL, bd.sR, H + 6, H + 12, 0.1, K.aptBand);
    const z = H + 6;
    a.push(B(-1.4, -0.3, 0.8, 1.9, z, z + 30, K.aptBand, [[z, z + 3, K.grayD]]));                 // 樓梯間
    a.push(B(-0.3, -0.28, 1.1, 1.5, z, z + 22, K.aptDoor, null, false));
    a.push(B(-1.5, -0.7, -1.9, -1.1, z, z + 6, K.grayD));                                          // 水塔
    a.push(B(-1.45, -0.75, -1.85, -1.15, z + 6, z + 28, K.blue, [[z + 14, z + 16, shade(K.blue, 0.8)]]));
    return a;
  }

  // 玩家的家 3×3：鵝黃小屋、紅色階梯屋頂、門上雨遮、百葉窗、煙囪
  function housePlayer() {
    const bd = { fF: 0.9, fB: -1.35, sL: -1.35, sR: 1.35 }, fb = faceFn(bd), H = 100, a = [];
    a.push(B(bd.fB, bd.fF, bd.sL, bd.sR, 0, H, K.homeWall, [[0, 8, K.woodD], [8, 10, K.woodL]]));
    doorOn(a, fb, 'F', -0.34, 0.34, 86, { col: K.homeDoor, panel: true });
    const wo = { shutters: K.shutter };
    windowOn(a, fb, 'F', -1.15, -0.65, 40, 80, Object.assign({ flowers: true }, wo));
    windowOn(a, fb, 'F', 0.65, 1.15, 40, 80, Object.assign({ flowers: [K.pink, K.white, K.lilac] }, wo));
    a.push(B(bd.fF + 0.06, bd.fF + 0.4, -0.52, 0.52, 94, 100, K.homeRoof, [[94, 96, shade(K.homeRoof, 0.8)]]));  // 門上雨遮
    a.push(B(0.97, 1.32, -0.46, 0.46, 0, 4, K.stone));                                                       // 台階
    a.push(B(1.06, 1.36, -1.25, -0.8, 0, 10, K.woodL), B(1.08, 1.34, -1.23, -0.82, 10, 20, K.leaf));         // 門口小花槽
    a.push(B(1.06, 1.36, 0.8, 1.25, 0, 10, K.woodL), B(1.08, 1.34, 0.82, 1.23, 10, 20, K.leaf));
    a.push(B(1.16, 1.26, -1.1, -0.98, 20, 24, K.red, null, false), B(1.16, 1.26, 0.98, 1.1, 20, 24, K.yellow, null, false));
    // 側面、背面
    for (const f of ['R', 'L']) windowOn(a, fb, f, -0.8, 0.2, 40, 80, { frame: K.white });
    windowOn(a, fb, 'K', -0.9, -0.2, 40, 80, {}); windowOn(a, fb, 'K', 0.3, 1.0, 40, 80, {});
    // 屋頂（6 層）＋煙囪（站在第 3 層上）
    const rf0 = bd.fB, rf1 = bd.fF;
    steppedRoof(a, rf0, rf1, bd.sL, bd.sR, H, 6, 0.2, 7, K.homeRoof, K.homeRoofL);
    const cz = H + 21, cf0 = rf0 + 0.4, cf1 = rf0 + 0.6;
    a.push(B(cf0, cf1, 0.6, 0.88, cz, cz + 36, K.brick, [[cz + 14, cz + 16, shade(K.brick, 0.8)], [cz + 26, cz + 28, shade(K.brick, 0.8)]]));
    a.push(B(cf0 - 0.03, cf1 + 0.03, 0.57, 0.91, cz + 36, cz + 40, K.stoneD));
    return a;
  }

  // ---------------- 街道小物 ----------------
  function streetLamp(on) {
    const glow = on ? K.lampOn : K.lampOff;
    return [
      B(-0.16, 0.16, -0.16, 0.16, 0, 6, K.iron), B(-0.1, 0.1, -0.1, 0.1, 6, 12, K.iron),
      B(-0.04, 0.04, -0.04, 0.04, 12, 92, K.iron, null, false),
      B(-0.13, 0.13, -0.13, 0.13, 92, 96, K.iron), B(-0.11, 0.11, -0.11, 0.11, 96, 110, glow, [[96, 98, shade(glow, 0.85)]]),
      B(-0.16, 0.16, -0.16, 0.16, 110, 114, K.iron), B(-0.08, 0.08, -0.08, 0.08, 114, 118, K.iron), B(-0.03, 0.03, -0.03, 0.03, 118, 122, K.gold, null, false),
    ];
  }
  function bench() {   // 2×1，面向 +f；座面 z=18
    const a = [];
    for (const sg of [-1, 1]) {
      const s0 = sg < 0 ? -0.95 : 0.85, s1 = s0 + 0.1;
      a.push(B(-0.25, 0.27, s0, s1, 0, 18, K.iron), B(-0.32, -0.25, s0, s1, 18, 40, K.iron, null, false));
      a.push(B(-0.25, 0.27, s0, s1, 22, 25, K.iron, null, false));      // 扶手
    }
    for (const [f0, f1] of [[-0.25, -0.09], [-0.07, 0.09], [0.11, 0.27]]) a.push(B(f0, f1, -0.85, 0.85, 14, 18, K.bench));
    a.push(B(-0.32, -0.26, -0.85, 0.85, 22, 28, K.bench), B(-0.32, -0.26, -0.85, 0.85, 32, 38, K.bench));
    return a;
  }
  function treeRound() {
    return [
      B(-0.08, 0.08, -0.08, 0.08, 0, 28, K.trunk, null, false),
      B(-0.34, 0.34, -0.34, 0.34, 28, 36, K.leafD), B(-0.46, 0.46, -0.46, 0.46, 36, 60, K.leaf, [[46, 48, K.leafL]]),
      B(-0.36, 0.36, -0.36, 0.36, 60, 70, K.leafL), B(-0.2, 0.2, -0.2, 0.2, 70, 76, K.leafL),
      B(0.46, 0.48, -0.2, -0.1, 50, 56, K.red, null, false), B(-0.06, 0.04, 0.46, 0.48, 42, 48, K.red, null, false), B(0.18, 0.28, 0.46, 0.48, 52, 58, K.red, null, false),
    ];
  }
  function treePine() {
    const a = [B(-0.07, 0.07, -0.07, 0.07, 0, 16, K.trunk, null, false)];
    const tiers = [[0.46, 16, 32], [0.37, 32, 48], [0.28, 48, 62], [0.18, 62, 74], [0.08, 74, 82]];
    tiers.forEach(([r, z0, z1], k) => a.push(B(-r, r, -r, r, z0, z1, k % 2 ? K.pine : K.pineD, [[z0, z0 + 2, shade(K.pineD, 0.85)]])));
    return a;
  }
  function bush() {
    return [
      B(-0.38, 0.38, -0.38, 0.38, 0, 14, K.leaf), B(-0.28, 0.28, -0.28, 0.28, 14, 22, K.leafL),
      B(0.38, 0.4, -0.22, -0.12, 6, 10, K.pink, null, false), B(0.38, 0.4, 0.14, 0.24, 9, 13, K.white, null, false),
      B(-0.1, 0.0, 0.38, 0.4, 7, 11, K.pink, null, false), B(0.16, 0.26, 0.38, 0.4, 4, 8, K.yellow, null, false),
    ];
  }
  function flowerBed() {   // 2×1
    const a = [
      B(0.3, 0.4, -0.95, 0.95, 0, 10, K.woodL), B(-0.4, -0.3, -0.95, 0.95, 0, 10, K.woodL),
      B(-0.3, 0.3, -0.95, -0.85, 0, 10, K.woodL), B(-0.3, 0.3, 0.85, 0.95, 0, 10, K.woodL),
      B(-0.3, 0.3, -0.85, 0.85, 0, 7, [150, 104, 72]),
    ];
    const cols = [K.red, K.yellow, K.pink, K.lilac, K.white];
    let k = 0;
    for (const f of [-0.15, 0.13]) for (let s = -0.7; s <= 0.71; s += 0.35) {
      const ss = s + (f > 0 ? 0.17 : 0);
      if (ss > 0.75) continue;
      a.push(B(f - 0.02, f + 0.02, ss - 0.02, ss + 0.02, 7, 13, K.leafD, null, false));
      a.push(B(f - 0.06, f + 0.06, ss - 0.06, ss + 0.06, 13, 18, cols[k++ % cols.length], null, false));
    }
    return a;
  }
  function fountain() {   // 3×3
    const w = K.water, st = K.stone;
    return [
      B(1.2, 1.42, -1.42, 1.42, 0, 18, st, [[15, 18, K.white]]), B(-1.42, -1.2, -1.42, 1.42, 0, 18, st, [[15, 18, K.white]]),
      B(-1.2, 1.2, -1.42, -1.2, 0, 18, st, [[15, 18, K.white]]), B(-1.2, 1.2, 1.2, 1.42, 0, 18, st, [[15, 18, K.white]]),
      B(-1.2, 1.2, -1.2, 1.2, 0, 11, shade(w, 0.9), [[9, 11, w]], false),
      B(-0.2, 0.2, -0.2, 0.2, 11, 34, st, [[11, 14, K.stoneD]]),
      B(-0.55, 0.55, -0.55, 0.55, 34, 41, st, [[34, 36, K.stoneD], [39, 41, w]]),
      B(-0.09, 0.09, -0.09, 0.09, 41, 54, K.waterL, null, false),
      B(-0.15, 0.15, -0.15, 0.15, 54, 58, K.waterL, null, false),
      // 從上層水盤流下來的水簾（四面各一片）
      B(0.55, 0.58, -0.3, 0.3, 11, 34, K.waterL, null, false), B(-0.58, -0.55, -0.3, 0.3, 11, 34, K.waterL, null, false),
      B(-0.3, 0.3, 0.55, 0.58, 11, 34, K.waterL, null, false), B(-0.3, 0.3, -0.58, -0.55, 11, 34, K.waterL, null, false),
    ];
  }
  function bulletinBoard() {   // 2×1
    const a = [
      B(-0.05, 0.05, -0.92, -0.82, 0, 72, K.woodD), B(-0.05, 0.05, 0.82, 0.92, 0, 72, K.woodD),
      B(-0.06, 0.06, -0.82, 0.82, 26, 72, K.cork, [[26, 29, K.woodD], [69, 72, K.woodD]]),
      B(-0.16, 0.16, -1.0, 1.0, 72, 77, K.homeRoof), B(-0.1, 0.1, -0.9, 0.9, 77, 80, K.homeRoofL),
    ];
    const notes = [[-0.72, -0.34, 38, 64, K.white], [-0.26, 0.1, 44, 66, K.yellow], [0.18, 0.46, 34, 58, [190, 226, 250]], [0.52, 0.74, 46, 64, K.pink]];
    for (const [s0, s1, z0, z1, c] of notes) {
      a.push(B(0.06, 0.075, s0, s1, z0, z1, c, [[z1 - 7, z1 - 6, K.grayD], [z1 - 11, z1 - 10, K.gray], [z1 - 15, z1 - 14, K.gray]], false));
      a.push(B(0.075, 0.09, (s0 + s1) / 2 - 0.02, (s0 + s1) / 2 + 0.02, z1 - 4, z1 - 1, K.red, null, false));   // 圖釘
    }
    return a;
  }
  function trashBin() {
    return [
      B(-0.22, 0.22, -0.22, 0.22, 0, 30, K.bin, [[0, 3, shade(K.bin, 0.75)], [12, 14, shade(K.bin, 0.85)], [22, 24, shade(K.bin, 0.85)]]),
      B(-0.25, 0.25, -0.25, 0.25, 30, 34, shade(K.bin, 0.85)), B(-0.1, 0.1, -0.04, 0.04, 34, 37, K.iron, null, false),
      B(0.25, 0.27, -0.08, 0.08, 16, 21, K.white, null, false),
    ];
  }
  function mailbox() {
    return [
      B(-0.12, 0.12, -0.12, 0.12, 0, 4, K.iron), B(-0.04, 0.04, -0.04, 0.04, 4, 36, K.iron, null, false),
      B(-0.22, 0.22, -0.15, 0.15, 36, 54, K.mailbox, [[36, 38, shade(K.mailbox, 0.8)]]), B(-0.2, 0.2, -0.13, 0.13, 54, 57, shade(K.mailbox, 1.1)),
      B(0.22, 0.24, -0.08, 0.08, 46, 49, K.dark, null, false),
      B(-0.08, -0.04, 0.15, 0.17, 44, 60, K.iron, null, false), B(-0.04, 0.1, 0.15, 0.17, 54, 60, K.red, null, false),
    ];
  }
  // 施工圍欄：沿 s（fence_i）或沿 f（fence_j）的 1 格長條；兩支立腳＋橘白條紋橫板＋警示燈
  function barrier(alongF) {
    const a = [], P = (u0, u1, v0, v1, z0, z1, c, b, hi) => alongF ? B(u0, u1, v0, v1, z0, z1, c, b, hi) : B(v0, v1, u0, u1, z0, z1, c, b, hi);
    for (const u of [-0.4, 0.4]) {
      a.push(P(u - 0.05, u + 0.05, -0.24, 0.24, 0, 4, K.iron));
      a.push(P(u - 0.04, u + 0.04, -0.04, 0.04, 4, 40, K.grayL, null, false));
      a.push(P(u - 0.05, u + 0.05, -0.05, 0.05, 40, 46, u < 0 ? K.orange : K.yellow, null, false));
    }
    const n = 6, w = 0.96 / n;
    for (const [z0, z1] of [[16, 24], [29, 37]]) for (let k = 0; k < n; k++) {
      a.push(P(-0.48 + w * k, -0.48 + w * (k + 1), 0.04, 0.09, z0, z1, (k + (z0 > 20 ? 1 : 0)) % 2 ? K.white : K.barrier, null, false));
    }
    return a;
  }
  function signArrow() {
    const sc = K.sign, a = [
      B(-0.12, 0.12, -0.12, 0.12, 0, 4, K.iron), B(-0.04, 0.04, -0.04, 0.04, 4, 74, K.grayD, null, false), B(-0.06, 0.06, -0.06, 0.06, 74, 78, K.gold),
    ];
    // 上：往 +s 的箭頭；下：往 -s 的箭頭（板子貼在柱子正面）
    a.push(B(0.04, 0.08, -0.1, 0.36, 56, 68, sc, [[56, 57, K.white], [67, 68, K.white]], false), B(0.04, 0.08, 0.36, 0.42, 58, 66, sc, null, false), B(0.04, 0.08, 0.42, 0.46, 60, 64, sc, null, false));
    a.push(B(0.04, 0.08, -0.36, 0.1, 40, 52, K.green, [[40, 41, K.white], [51, 52, K.white]], false), B(0.04, 0.08, -0.42, -0.36, 42, 50, K.green, null, false), B(0.04, 0.08, -0.46, -0.42, 44, 48, K.green, null, false));
    return a;
  }

  // ---------------- 註冊 ----------------
  const OBJS = {};
  function obj(id, name, W, D, model, extra) { OBJS[id] = Object.assign({ id, name, W, D, kind: 'floor', model }, extra || {}); }
  // door = 門口那一格在本地座標的中心（正面外側半格）；偶數寬的建築把門放在格子中心 s=±0.5
  obj('cafe_building', '咖啡廳', 5, 4, () => cafeBuilding(), { door: { f: 2.5, s: 0 } });
  obj('bakery_building', '麵包店', 4, 4, () => bakeryBuilding(), { door: { f: 2.5, s: 0.5 } });
  obj('market_building', '超市', 6, 5, () => marketBuilding(), { door: { f: 3.0, s: 0.5 } });
  obj('apartment_building', '公寓', 5, 4, () => apartmentBuilding(), { door: { f: 2.5, s: 0 } });
  obj('house_player', '我的家', 3, 3, () => housePlayer(), { door: { f: 2.0, s: 0 } });
  obj('street_lamp', '路燈', 1, 1, on => streetLamp(on), { toggle: true });
  obj('bench', '長椅', 2, 1, () => bench(), { seat: { z: 18, spots: [[0.05, -0.45], [0.05, 0.45]] } });
  obj('tree_round', '圓樹', 1, 1, () => treeRound());
  obj('tree_pine', '松樹', 1, 1, () => treePine());
  obj('bush', '灌木', 1, 1, () => bush());
  obj('flower_bed', '花圃', 2, 1, () => flowerBed());
  obj('fountain', '噴水池', 3, 3, () => fountain());
  obj('bulletin_board', '公告欄', 2, 1, () => bulletinBoard());
  obj('trash_bin', '垃圾桶', 1, 1, () => trashBin());
  obj('mailbox', '信箱', 1, 1, () => mailbox());
  obj('fence_i', '施工圍欄（橫）', 1, 1, () => barrier(false));
  obj('fence_j', '施工圍欄（直）', 1, 1, () => barrier(true));
  obj('sign_arrow', '路標', 1, 1, () => signArrow());

  // ---------------- 地面格子 ----------------
  const T = {
    grass: [134, 196, 106], grassD: [112, 176, 90], grassL: [160, 212, 124],
    road: [96, 100, 116], roadD: [86, 90, 106], roadL: [110, 114, 130], line: [246, 236, 196], zebra: [240, 240, 236],
    walk: [218, 210, 198], walkB: [208, 198, 186], walkG: [186, 176, 166],
    plaza: [232, 210, 172], plazaB: [222, 196, 158], plazaG: [198, 172, 136], plazaL: [242, 224, 190],
    dirt: [200, 156, 106], dirtD: [176, 132, 88], dirtL: [216, 176, 128],
    water: K.water, waterD: [90, 160, 216], waterL: K.waterL,
  };
  const hash = (i, j, k) => { let h = (i * 374761393 + j * 668265263 + k * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
  const quad = (iso, i, j, wi, wj, c) => iso.p.fill([iso.P(i, j), iso.P(i + wi, j), iso.P(i + wi, j + wj), iso.P(i, j + wj)], c);
  const seg = (iso, a0, b0, a1, b1, c) => { const p0 = iso.P(a0, b0), p1 = iso.P(a1, b1); iso.p.line(p0[0], p0[1], p1[0], p1[1], c); };
  const dots = (iso, i, j, n, k0, c, m) => {
    for (let k = 0; k < n; k++) {
      const h = hash(i, j, k0 + k); m = m || 0.08;
      const u = m + (h % 1000) / 1000 * (1 - 2 * m), v = m + ((h >>> 10) % 1000) / 1000 * (1 - 2 * m);
      const pt = iso.P(i + u, j + v); iso.p.px(pt[0], pt[1], c);
    }
  };
  function asphalt(iso, i, j) {
    quad(iso, i, j, 1, 1, T.road);
    dots(iso, i, j, 7, 10, T.roadD); dots(iso, i, j, 4, 30, T.roadL);
  }
  // 虛線：沿 i（along=0）或沿 j，位置 v（0..1）、寬 w
  function dash(iso, i, j, alongJ, v, w) {
    for (const [a0, a1] of [[0.1, 0.4], [0.6, 0.9]]) {
      if (!alongJ) quad(iso, i + a0, j + v, a1 - a0, w, T.line);
      else quad(iso, i + v, j + a0, w, a1 - a0, T.line);
    }
  }
  function zebra(iso, i, j, alongJ) {   // 斑馬線條紋跟車流方向平行
    asphalt(iso, i, j);
    for (let v = 0.065; v < 0.95; v += 0.25) {
      if (!alongJ) quad(iso, i + 0.1, j + v, 0.8, 0.12, T.zebra);
      else quad(iso, i + v, j + 0.1, 0.12, 0.8, T.zebra);
    }
  }
  const TILES = {
    grass(iso, i, j) {
      quad(iso, i, j, 1, 1, T.grass);
      dots(iso, i, j, 6, 0, T.grassD); dots(iso, i, j, 3, 20, T.grassL);
      const h = hash(i, j, 99);
      if (h % 3 === 0) {             // 草叢
        const pt = iso.P(i + 0.2 + (h % 60) / 100, j + 0.2 + ((h >>> 8) % 60) / 100), x = pt[0], y = pt[1];
        iso.p.px(x - 2, y, T.grassD); iso.p.px(x - 2, y - 1, T.grassD); iso.p.px(x, y, T.grassD); iso.p.px(x, y - 1, T.grassD); iso.p.px(x, y - 2, T.grassD); iso.p.px(x + 2, y, T.grassD); iso.p.px(x + 2, y - 1, T.grassD);
      }
      if (h % 13 === 5) {            // 小花
        const pt = iso.P(i + 0.3 + ((h >>> 4) % 40) / 100, j + 0.3 + ((h >>> 12) % 40) / 100), c = h % 2 ? K.white : K.yellow;
        iso.p.px(pt[0], pt[1], c); iso.p.px(pt[0] - 1, pt[1], c); iso.p.px(pt[0] + 1, pt[1], c); iso.p.px(pt[0], pt[1] - 1, c); iso.p.px(pt[0], pt[1] + 1, K.red);
      }
    },
    road: asphalt,                                                     // 純柏油（多線道的中間格）
    road_i(iso, i, j) { asphalt(iso, i, j); dash(iso, i, j, false, 0.46, 0.08); },
    road_j(iso, i, j) { asphalt(iso, i, j); dash(iso, i, j, true, 0.46, 0.08); },
    // 兩格寬的路：a 在上排（中線畫在它的 j+1 邊）、b 在下排（中線畫在它的 j 邊），合起來是一條置中的虛線
    road_i_a(iso, i, j) { asphalt(iso, i, j); dash(iso, i, j, false, 0.95, 0.05); },
    road_i_b(iso, i, j) { asphalt(iso, i, j); dash(iso, i, j, false, 0, 0.05); },
    road_j_a(iso, i, j) { asphalt(iso, i, j); dash(iso, i, j, true, 0.95, 0.05); },
    road_j_b(iso, i, j) { asphalt(iso, i, j); dash(iso, i, j, true, 0, 0.05); },
    crosswalk_i(iso, i, j) { zebra(iso, i, j, false); },
    crosswalk_j(iso, i, j) { zebra(iso, i, j, true); },
    sidewalk(iso, i, j) {
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) quad(iso, i + a / 2, j + b / 2, 0.5, 0.5, hash(i * 2 + a, j * 2 + b, 7) % 4 === 0 ? T.walkB : T.walk);
      seg(iso, i, j, i + 1, j, T.walkG); seg(iso, i, j, i, j + 1, T.walkG);
      seg(iso, i + 0.5, j, i + 0.5, j + 1, T.walkG); seg(iso, i, j + 0.5, i + 1, j + 0.5, T.walkG);
    },
    plaza(iso, i, j) {
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
        const h = hash(i * 2 + a, j * 2 + b, 3);
        quad(iso, i + a / 2, j + b / 2, 0.5, 0.5, h % 7 === 0 ? T.plazaL : (a + b) % 2 ? T.plazaB : T.plaza);
      }
      seg(iso, i, j, i + 1, j, T.plazaG); seg(iso, i, j, i, j + 1, T.plazaG);
      seg(iso, i + 0.5, j, i + 0.5, j + 1, T.plazaG); seg(iso, i, j + 0.5, i + 1, j + 0.5, T.plazaG);
    },
    dirt(iso, i, j) {
      quad(iso, i, j, 1, 1, T.dirt);
      dots(iso, i, j, 8, 40, T.dirtD); dots(iso, i, j, 4, 60, T.dirtL);
      const h = hash(i, j, 77);
      if (h % 2) { const pt = iso.P(i + 0.25 + (h % 50) / 100, j + 0.25 + ((h >>> 8) % 50) / 100); iso.p.rect(pt[0] - 1, pt[1], pt[0] + 1, pt[1] + 1, T.dirtD); iso.p.px(pt[0], pt[1], T.dirtL); }
    },
    water(iso, i, j) {
      quad(iso, i, j, 1, 1, T.water);
      for (let k = 0; k < 3; k++) {
        const h = hash(i, j, 200 + k), pt = iso.P(i + 0.15 + (h % 70) / 100, j + 0.15 + ((h >>> 9) % 70) / 100);
        iso.p.line(pt[0] - 3, pt[1], pt[0] + 3, pt[1], k ? T.waterL : T.waterD);
        if (k) { iso.p.px(pt[0] - 4, pt[1] + 1, T.waterL); iso.p.px(pt[0] + 4, pt[1] + 1, T.waterL); }
      }
    },
  };

  G.ART = G.ART || {};
  G.ART.city = { OBJS, TILES, COLORS: { water: K.water, waterL: K.waterL, grass: T.grass } };
})(typeof window !== 'undefined' ? window : globalThis);
