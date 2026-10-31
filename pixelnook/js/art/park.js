// PixelNook 公園美術：公園物件（OBJS，等角）＋收藏品／材料 2D 圖示（ICONS，32×32）。全部程式繪圖。
// 規則跟 models.js / city.js 一樣：同一物件的零件彼此不重疊（貼齊可以）；細節用凸出 0.01～0.04 格的薄方塊或 bands。
// 物件本地座標：f = 前後（+f 是正面）、s = 左右；W = 左右格數、D = 前後格數；物件中心在 (0,0)。
// 可採集物件：model(on) 的 on === true 表示「已採集」。sparkle 的 on 是閃爍的第二幀。
(function (G) {
  'use strict';
  const { shade, OUT } = G.PX;
  const p = (f, s, wf, ws, h, z, c, b, hi) => ({ f, s, wf, ws, h, z, c, b, hi: hi !== false });
  const B = (f0, f1, s0, s1, z0, z1, c, b, hi) => p((f0 + f1) / 2, (s0 + s1) / 2, f1 - f0, s1 - s0, z1 - z0, z0, c, b, hi);

  // ---------------- 色盤 ----------------
  const K = {
    white: [246, 246, 250], cream: [250, 240, 220], dark: [52, 56, 70], gray: [160, 166, 180], grayL: [206, 210, 220], grayD: [110, 116, 132],
    wood: [190, 132, 84], woodL: [214, 166, 112], woodD: [140, 94, 62], bark: [124, 86, 60], barkL: [158, 112, 76], ring: [226, 186, 128],
    leaf: [96, 168, 92], leafD: [72, 140, 80], leafL: [132, 196, 108], mint: [168, 222, 170], moss: [120, 170, 84],
    red: [226, 92, 86], pink: [244, 168, 190], yellow: [250, 210, 100], orange: [244, 150, 80], lilac: [200, 182, 232],
    blue: [110, 160, 236], blueL: [170, 204, 250], gold: [240, 196, 90], goldD: [196, 146, 60],
    stone: [190, 188, 184], stoneL: [214, 212, 206], stoneD: [150, 148, 146],
    reed: [128, 170, 96], reedD: [100, 146, 80], cattail: [150, 98, 64],
    pad: [92, 176, 110], padD: [70, 146, 92], lotus: [250, 190, 210],
    roof: [96, 156, 150], roofL: [124, 184, 172], gzWood: [236, 220, 190], gzTrim: [176, 120, 80],
    binG: [84, 128, 96], bag: [70, 78, 104], bagL: [96, 106, 136], bottle: [120, 196, 160], paper: [240, 236, 222], paperD: [214, 208, 192],
    shine: [255, 246, 170], shineW: [255, 255, 255],
    mush: [220, 84, 76], mushStem: [246, 234, 210], herb: [112, 186, 120], herbL: [168, 220, 150], herbF: [210, 190, 240],
  };

  // ---------------- 公園物件 ----------------
  function pondRock() {
    return [
      B(-0.34, 0.3, -0.36, 0.26, 0, 12, K.stone, [[0, 2, K.stoneD]]),
      B(-0.26, 0.14, -0.28, 0.1, 12, 22, K.stoneL),
      B(-0.2, 0.0, -0.22, 0.0, 22, 24, K.moss, null, false),              // 頂上的青苔
      B(0.14, 0.38, 0.28, 0.44, 0, 6, K.stoneD),                         // 旁邊的小石頭
      B(0.3, 0.32, -0.3, -0.12, 3, 7, K.moss, null, false),               // 正面一小片苔
    ];
  }
  function reeds() {
    const a = [B(-0.34, 0.34, -0.36, 0.34, 0, 4, K.reedD)];                // 根部的草堆
    const st = [[-0.2, -0.2, 34], [0.02, -0.24, 42], [0.22, -0.02, 28], [-0.16, 0.14, 38], [0.12, 0.22, 46]];
    for (const [f, s, h] of st) {
      a.push(B(f - 0.04, f + 0.04, s - 0.04, s + 0.04, 4, h, K.reed, [[4, 8, K.reedD]], false));
      a.push(B(f - 0.06, f + 0.06, s - 0.06, s + 0.06, h, h + 10, K.cattail, [[h + 8, h + 10, shade(K.cattail, 1.2)]], false));
      a.push(B(f - 0.02, f + 0.02, s - 0.02, s + 0.02, h + 10, h + 14, K.reed, null, false));
    }
    // 兩片寬葉（站在草堆上）
    a.push(B(0.22, 0.32, -0.34, -0.22, 4, 18, K.leaf, null, false), B(-0.34, -0.24, 0.0, 0.1, 4, 16, K.leaf, null, false));
    return a;
  }
  function lilyPad() {   // 圓圓的荷葉（用十字拼出圓角，後面缺一個口）＋旁邊的小葉＋粉紅小花
    return [
      B(-0.18, 0.18, -0.28, 0.28, 0, 2, K.pad, null, false),
      B(0.18, 0.28, -0.18, 0.18, 0, 2, K.pad, null, false),
      B(-0.28, -0.18, -0.18, 0.02, 0, 2, K.pad, null, false),
      B(0.22, 0.36, 0.26, 0.4, 0, 2, K.padD, null, false),
      B(-0.06, 0.06, -0.06, 0.06, 2, 4, K.lotus, null, false), B(-0.02, 0.02, -0.02, 0.02, 4, 5, K.yellow, null, false),
    ];
  }
  function picnicTable() {   // 2×1：中間桌子、前後兩條長凳；座面 z=17
    const a = [];
    // 【層級關鍵】桌子用「中央支柱＋地上橫木」撐：桌上的東西都疊在支柱正上方，跟支柱在地面上重疊 → 不會跟桌腳形成循環
    a.push(B(-0.05, 0.05, -0.24, 0.24, 0, 4, K.woodD, null, false)); // 底座橫木
    a.push(B(-0.06, 0.06, -0.12, 0.12, 4, 26, K.woodD, [[4, 6, shade(K.woodD, 0.8)]], false));    // 中央支柱
    for (const s of [-0.8, 0.8]) for (const f of [-0.335, 0.335]) a.push(B(f - 0.03, f + 0.03, s - 0.03, s + 0.03, 0, 14, K.woodD, null, false)); // 凳腳
    for (const [f0, f1] of [[-0.21, -0.075], [-0.075, 0.075], [0.075, 0.21]]) a.push(B(f0, f1, -0.98, 0.98, 26, 30, f0 === -0.075 ? K.woodL : K.wood));
    for (const sg of [-1, 1]) a.push(B(sg < 0 ? -0.45 : 0.22, sg < 0 ? -0.22 : 0.45, -0.96, 0.96, 14, 17, K.wood));
    // 桌上的格子野餐布（薄片疊在桌面中間）＋籃子
    a.push(B(-0.07, 0.07, -0.8, 0.8, 30, 31, K.red, null, false));                                // 桌巾（只鋪在中間那片木板上）
    a.push(B(-0.12, 0.12, -0.15, 0.15, 31, 40, K.woodL, [[34, 35, K.woodD], [31, 32, K.woodD]]), B(-0.1, 0.1, -0.13, 0.13, 40, 42, K.red, null, false)); // 野餐籃（在支柱正上方）＋蓋布
    return a;
  }
  function gazebo() {   // 3×3：木平台、四根柱子、三面欄杆、尖屋頂
    const a = [], P0 = 1.18, P1 = 1.32, ZP = 86;
    a.push(B(-1.45, 1.45, -1.45, 1.45, 0, 5, K.gzTrim, [[0, 2, shade(K.gzTrim, 0.8)]]));
    for (const f of [-1, 1]) for (const s of [-1, 1]) a.push(B(f < 0 ? -P1 : P0, f < 0 ? -P0 : P1, s < 0 ? -P1 : P0, s < 0 ? -P0 : P1, 5, ZP, K.gzWood, [[5, 9, K.gzTrim]]));
    // 欄杆：上橫木 z20~23、下橫木 z5~7、中間直條
    const rail = (along, v0, v1, u0, u1) => {   // along='s'：沿 s 的欄杆，f 在 v0..v1；u = 範圍
      const R = (a0, a1, z0, z1, c, hi) => along === 's' ? B(v0, v1, a0, a1, z0, z1, c, null, hi) : B(a0, a1, v0, v1, z0, z1, c, null, hi);
      a.push(R(u0, u1, 5, 7, K.gzTrim, false), R(u0, u1, 20, 23, K.gzWood));
      for (let u = u0 + 0.1; u + 0.04 <= u1 - 0.05; u += 0.2) a.push(R(u, u + 0.04, 7, 20, K.gzWood, false));
    };
    rail('s', -1.29, -1.21, -P0, P0);                                   // 背面
    rail('f', -1.29, -1.21, -P0, P0); rail('f', 1.21, 1.29, -P0, P0);   // 左右
    rail('s', 1.21, 1.29, -P0, -0.55); rail('s', 1.21, 1.29, 0.55, P0);   // 正面兩段（中間是入口）
    // 屋簷下的橫樑（四邊，介於柱子之間）
    for (const v of [-1, 1]) {
      a.push(B(v < 0 ? -P1 : P0, v < 0 ? -P0 : P1, -P0, P0, 76, ZP, K.gzWood, [[76, 78, K.gzTrim]]));
      a.push(B(-P0, P0, v < 0 ? -P1 : P0, v < 0 ? -P0 : P1, 76, ZP, K.gzWood, [[76, 78, K.gzTrim]]));
    }
    // 裡面靠背面的長凳
    a.push(B(-1.15, -0.85, -0.8, 0.8, 5, 17, K.woodL, [[5, 7, K.woodD]]));
    // 屋頂：用「同心的方環柱」組成階梯金字塔（每一環都從 ZP 往上長到自己的高度，環與環在地面上互不重疊）。
    // 【層級關鍵】屋頂下的柱子、欄杆、橫樑、長凳都完整落在某一環的地面範圍裡 → 它們跟其他環的前後關係跟所在那一環一致，不會產生循環。
    const rs = [1.5, 1.18, 0.85, 0.55, 0.28], tops = [ZP + 5, ZP + 13, ZP + 21, ZP + 29], cols = [K.gzTrim, K.roof, K.roofL, K.roof];
    for (let k = 0; k < 4; k++) {
      const r0 = rs[k], r1 = rs[k + 1], zt = tops[k], c = cols[k], bd = k ? [[tops[k - 1], tops[k - 1] + 1, shade(K.roof, 0.7)]] : null;
      a.push(B(r1, r0, -r0, r0, ZP, zt, c, bd), B(-r0, -r1, -r0, r0, ZP, zt, c, bd));
      a.push(B(-r1, r1, r1, r0, ZP, zt, c, bd), B(-r1, r1, -r0, -r1, ZP, zt, c, bd));
    }
    const zc = ZP + 36;
    a.push(B(-0.28, 0.28, -0.28, 0.28, ZP, zc, K.roofL, [[tops[3], tops[3] + 1, shade(K.roof, 0.7)]]));
    a.push(B(-0.07, 0.07, -0.07, 0.07, zc, zc + 8, K.gold, null, false), B(-0.11, 0.11, -0.11, 0.11, zc + 8, zc + 13, K.gold));
    return a;
  }
  function parkSign() {   // 木牌：兩根柱子、前面的木板（樹的圖案）、小屋頂
    const a = [
      B(-0.08, 0.0, -0.36, -0.28, 0, 66, K.woodD, null, false), B(-0.08, 0.0, 0.28, 0.36, 0, 66, K.woodD, null, false),
      B(0.0, 0.06, -0.42, 0.42, 30, 62, K.woodL, [[30, 32, K.wood], [60, 62, K.wood]]),
      B(-0.16, 0.14, -0.48, 0.48, 66, 70, K.roof), B(-0.1, 0.08, -0.4, 0.4, 70, 73, K.roofL),
    ];
    // 板子上的圖案：樹（樹冠＋樹幹）＋兩朵小花，全部貼在同一層薄片
    const pl = (s0, s1, z0, z1, c) => a.push(B(0.06, 0.07, s0, s1, z0, z1, c, null, false));
    pl(-0.14, 0.14, 44, 56, K.leaf); pl(-0.04, 0.04, 36, 44, K.bark);
    pl(-0.32, -0.24, 36, 40, K.pink); pl(0.24, 0.32, 36, 40, K.yellow);
    pl(-0.32, -0.24, 48, 50, K.wood); pl(0.24, 0.32, 48, 50, K.wood);
    // 木牌前面的小草（放在屋頂範圍外，避免被屋頂蓋住而產生層級循環）
    a.push(B(0.16, 0.3, -0.44, -0.3, 0, 5, K.leaf, null, false), B(0.16, 0.3, 0.3, 0.44, 0, 5, K.leaf, null, false));
    return a;
  }
  function flowerPatch(col, center) {
    return picked => {
      const a = [B(-0.3, 0.3, -0.3, 0.3, 0, 6, K.leafD), B(-0.16, 0.16, -0.16, 0.16, 6, 9, K.leaf)];
      const spots = [[-0.25, -0.25], [0.25, -0.23], [-0.23, 0.25], [0.25, 0.24]];   // 花在外圈，高 9 以下的葉子上
      if (!picked) {
        for (const [f, s] of spots) {
          a.push(B(f - 0.02, f + 0.02, s - 0.02, s + 0.02, 6, 11, K.leafD, null, false));
          a.push(B(f - 0.07, f + 0.07, s - 0.07, s + 0.07, 11, 15, col, null, false), B(f - 0.025, f + 0.025, s - 0.025, s + 0.025, 15, 16, center, null, false));
        }
        a.push(B(-0.06, 0.06, -0.06, 0.06, 9, 13, col, null, false), B(-0.02, 0.02, -0.02, 0.02, 13, 14, center, null, false));
      } else {
        for (const [f, s] of spots) a.push(B(f - 0.02, f + 0.02, s - 0.02, s + 0.02, 6, 9, K.leaf, null, false)); // 只剩短莖
      }
      return a;
    };
  }
  function herbBush(picked) {   // 香草叢：圓圓的葉堆＋外圈一支支紫色花穗
    const a = [B(-0.32, 0.32, -0.32, 0.32, 0, 8, K.herb, [[0, 2, shade(K.herb, 0.8)]])];
    if (!picked) {
      a.push(B(-0.22, 0.22, -0.22, 0.22, 8, 15, K.herbL));
      a.push(B(-0.1, 0.1, -0.1, 0.1, 15, 20, K.herb));
      const sp = [[-0.29, -0.29, 20], [0.29, -0.06, 18], [-0.06, 0.29, 22], [0.28, 0.28, 16], [-0.29, 0.1, 17]];
      for (const [f, s, h] of sp) {
        a.push(B(f - 0.04, f + 0.04, s - 0.04, s + 0.04, 8, h, K.herb, null, false));
        a.push(B(f - 0.05, f + 0.05, s - 0.05, s + 0.05, h, h + 7, K.herbF, [[h + 3, h + 4, shade(K.herbF, 0.85)]], false));
      }
    } else {
      a.push(B(-0.2, 0.2, -0.2, 0.2, 8, 10, K.herb, null, false));
    }
    return a;
  }
  function mushroomLog(picked) {   // 2×1：沿 s 倒下的木頭
    const a = [
      B(-0.24, 0.24, -0.86, 0.86, 0, 22, K.bark, [[0, 3, shade(K.bark, 0.8)], [10, 11, K.barkL]]),
      // 兩端的年輪（外圈→內圈→芯，一層一層往外疊）
      B(-0.2, 0.2, 0.86, 0.87, 2, 20, K.ring, null, false), B(-0.11, 0.11, 0.87, 0.875, 6, 16, K.woodL, null, false), B(-0.03, 0.03, 0.875, 0.88, 10, 12, K.woodD, null, false),
      B(-0.2, 0.2, -0.87, -0.86, 2, 20, K.ring, null, false), B(-0.11, 0.11, -0.875, -0.87, 6, 16, K.woodL, null, false), B(-0.03, 0.03, -0.88, -0.875, 10, 12, K.woodD, null, false),
      B(-0.2, 0.0, 0.3, 0.7, 22, 23, K.moss, null, false),                // 頂上青苔
      B(0.24, 0.27, -0.7, -0.5, 8, 11, K.cream, null, false), B(0.24, 0.27, 0.42, 0.58, 12, 15, K.cream, null, false), // 側面的層孔菌
    ];
    const mush = [[0.06, -0.55, 8, 0.11], [-0.1, -0.25, 6, 0.08], [0.1, 0.02, 7, 0.09]];
    for (const [f, s, h, r] of mush) {
      if (!picked) {
        a.push(B(f - 0.035, f + 0.035, s - 0.035, s + 0.035, 22, 22 + h, K.mushStem, null, false));
        a.push(B(f - r, f + r, s - r, s + r, 22 + h, 22 + h + 5, K.mush, [[22 + h, 22 + h + 1, shade(K.mush, 0.75)]]));
        a.push(B(f - 0.02, f + 0.02, s - 0.02, s + 0.02, 27 + h, 28 + h, K.white, null, false));
      } else {
        a.push(B(f - 0.035, f + 0.035, s - 0.035, s + 0.035, 22, 24, K.mushStem, null, false));   // 被摘掉後只剩一點蒂頭
      }
    }
    return a;
  }
  function trashCanPark() {   // 木條垃圾桶＋綠色圓頂蓋＋葉子標誌
    const a = [
      B(-0.24, 0.24, -0.24, 0.24, 0, 32, K.woodL, [[0, 3, K.woodD], [10, 11, K.wood], [21, 22, K.wood]]),
      B(-0.24, 0.24, -0.24, 0.24, 32, 36, K.binG), B(-0.18, 0.18, -0.18, 0.18, 36, 40, shade(K.binG, 1.1)), B(-0.06, 0.06, -0.06, 0.06, 40, 43, K.binG),
    ];
    // 正面與右側的葉子標誌（兩片色塊，同一層）
    a.push(B(0.24, 0.25, -0.08, 0.04, 14, 20, K.leaf, null, false), B(0.24, 0.25, 0.04, 0.08, 12, 16, K.leafD, null, false));
    a.push(B(-0.08, 0.04, 0.24, 0.25, 14, 20, K.leaf, null, false), B(0.04, 0.08, 0.24, 0.25, 12, 16, K.leafD, null, false));
    return a;
  }
  function trashBag() {
    return [
      B(-0.15, 0.15, -0.14, 0.14, 0, 8, K.bag, [[0, 1, shade(K.bag, 0.8)]]),
      B(-0.06, 0.06, -0.05, 0.05, 8, 10, K.bagL, null, false),
      B(-0.03, 0.03, -0.1, -0.05, 9, 12, K.bagL, null, false), B(-0.03, 0.03, 0.05, 0.1, 9, 12, K.bagL, null, false),
    ];
  }
  function trashBottle() {   // 倒在地上的空瓶（沿 s）
    return [
      B(-0.06, 0.06, -0.16, 0.06, 0, 7, K.bottle, [[3, 5, K.white]]),
      B(-0.035, 0.035, 0.06, 0.13, 1, 5, K.bottle, null, false),
      B(-0.04, 0.04, 0.13, 0.16, 1, 5, K.red, null, false),
    ];
  }
  function trashPaper() {   // 揉皺的紙屑：幾片低低的紙
    return [
      B(-0.1, 0.06, -0.12, 0.04, 0, 2, K.paper, null, false), B(0.06, 0.14, -0.06, 0.08, 0, 2, K.paperD, null, false),
      B(-0.06, 0.02, -0.08, 0.0, 2, 4, K.white, null, false), B(-0.14, -0.1, 0.06, 0.14, 0, 1, K.paper, null, false),
    ];
  }
  function sparkle(frame) {   // 星形閃光（第二幀換成斜十字小點，閃爍用）
    if (!frame) return [
      B(-0.06, 0.06, -0.06, 0.06, 2, 12, K.shineW, null, false),
      B(0.06, 0.18, -0.04, 0.04, 5, 9, K.shine, null, false), B(-0.18, -0.06, -0.04, 0.04, 5, 9, K.shine, null, false),
      B(-0.04, 0.04, 0.06, 0.18, 5, 9, K.shine, null, false), B(-0.04, 0.04, -0.18, -0.06, 5, 9, K.shine, null, false),
    ];
    return [
      B(-0.05, 0.05, -0.05, 0.05, 3, 10, K.shine, null, false),
      B(0.1, 0.17, 0.1, 0.17, 4, 8, K.shineW, null, false), B(-0.17, -0.1, -0.17, -0.1, 4, 8, K.shineW, null, false),
      B(0.1, 0.17, -0.17, -0.1, 4, 8, K.shineW, null, false), B(-0.17, -0.1, 0.1, 0.17, 4, 8, K.shineW, null, false),
    ];
  }
  function sapling() {   // 小樹苗：土堆、細樹幹、綁在旁邊的支撐木棍、一小團新葉
    return [
      B(-0.14, 0.14, -0.14, 0.14, 0, 3, [150, 110, 76], null, false),
      B(-0.035, 0.035, -0.035, 0.035, 3, 20, K.bark, null, false),
      B(-0.025, 0.025, 0.15, 0.19, 0, 24, K.woodL, null, false),
      B(0.035, 0.15, -0.05, 0.05, 12, 16, K.leafL, null, false), B(-0.15, -0.035, -0.05, 0.05, 8, 12, K.leaf, null, false),
      B(-0.1, 0.1, -0.1, 0.1, 20, 28, K.leafL, [[20, 21, K.leaf]]), B(-0.05, 0.05, -0.05, 0.05, 28, 32, K.leaf, null, false),
    ];
  }
  function treeBig() {   // 2×2 大樹：粗樹幹、根、四層樹冠、四面的小花
    const a = [B(-0.16, 0.16, -0.16, 0.16, 0, 38, K.bark, [[18, 19, K.barkL]])];
    for (const [f0, f1, s0, s1] of [[0.16, 0.26, -0.06, 0.06], [-0.26, -0.16, -0.06, 0.06], [-0.06, 0.06, 0.16, 0.26], [-0.06, 0.06, -0.26, -0.16]]) a.push(B(f0, f1, s0, s1, 0, 6, K.bark, null, false));
    a.push(B(-0.7, 0.7, -0.7, 0.7, 38, 50, K.leafD));
    a.push(B(-0.94, 0.94, -0.94, 0.94, 50, 86, K.leaf, [[50, 52, K.leafD], [66, 68, K.leafL]]));
    a.push(B(-0.76, 0.76, -0.76, 0.76, 86, 100, K.leafL));
    a.push(B(-0.46, 0.46, -0.46, 0.46, 100, 110, K.leafL, [[100, 101, K.leaf]]));
    a.push(B(-0.2, 0.2, -0.2, 0.2, 110, 115, K.leafL));
    const fl = [[-0.5, -0.36, 72, 77, K.pink], [0.1, 0.24, 58, 63, K.white], [0.5, 0.64, 76, 81, K.pink]];
    for (const [u0, u1, z0, z1, c] of fl) {
      a.push(B(0.94, 0.96, u0, u1, z0, z1, c, null, false), B(-0.96, -0.94, -u1, -u0, z0, z1, c, null, false));
      a.push(B(-u1, -u0, 0.94, 0.96, z0, z1, c, null, false), B(u0, u1, -0.96, -0.94, z0, z1, c, null, false));
    }
    return a;
  }
  function hedge() {   // 1×1 修剪過的矮樹籬，左右貼齊格邊 → 一排排起來會連在一起
    return [
      B(-0.3, 0.3, -0.5, 0.5, 0, 22, K.leafD, [[0, 2, shade(K.leafD, 0.8)], [12, 13, K.leaf]]),
      B(-0.26, 0.26, -0.5, 0.5, 22, 26, K.leaf),
      B(-0.2, 0.08, -0.4, -0.12, 26, 30, K.leafL), B(-0.08, 0.2, 0.06, 0.34, 26, 29, K.leafL),
    ];
  }

  // ---------------- 註冊 ----------------
  const OBJS = {};
  function obj(id, name, W, D, model, extra) { OBJS[id] = Object.assign({ id, name, W, D, kind: 'floor', model }, extra || {}); }
  obj('pond_rock', '池邊大石頭', 1, 1, () => pondRock());
  obj('reeds', '蘆葦叢', 1, 1, () => reeds());
  obj('lily_pad', '荷葉', 1, 1, () => lilyPad(), { onWater: true, walkable: true });
  obj('picnic_table', '野餐桌', 2, 1, () => picnicTable(), { seat: { z: 17, spots: [[0.33, -0.45, 2], [0.33, 0.45, 2], [-0.33, -0.45], [-0.33, 0.45]] } });
  obj('gazebo', '涼亭', 3, 3, () => gazebo());
  obj('park_sign', '公園木牌', 1, 1, () => parkSign());
  obj('flower_patch_red', '紅色花叢', 1, 1, flowerPatch(K.red, K.yellow), { gather: 'flower_red', mat: 'mat_flower' });
  obj('flower_patch_yellow', '黃色花叢', 1, 1, flowerPatch(K.yellow, K.orange), { gather: 'flower_yellow', mat: 'mat_flower' });
  obj('flower_patch_blue', '藍色花叢', 1, 1, flowerPatch(K.blue, K.white), { gather: 'flower_blue', mat: 'mat_flower' });
  obj('herb_bush', '香草叢', 1, 1, on => herbBush(on), { gather: true, mat: 'mat_leaf' });
  obj('mushroom_log', '長蘑菇的倒木', 2, 1, on => mushroomLog(on), { gather: 'mushroom', mat: 'mat_mushroom' });
  obj('trash_can_park', '公園垃圾桶', 1, 1, () => trashCanPark());
  obj('trash_bag', '垃圾袋', 1, 1, () => trashBag(), { trash: true, walkable: true });
  obj('trash_bottle', '空瓶', 1, 1, () => trashBottle(), { trash: true, walkable: true });
  obj('trash_paper', '紙屑', 1, 1, () => trashPaper(), { trash: true, walkable: true });
  obj('sparkle', '閃光物品', 1, 1, on => sparkle(on), { walkable: true });
  obj('sapling', '小樹苗', 1, 1, () => sapling());
  obj('tree_big', '大樹', 2, 2, () => treeBig());
  obj('hedge_i', '矮樹籬', 1, 1, () => hedge());
  // 可採集物件都用 on 表示已採集
  for (const id of ['flower_patch_red', 'flower_patch_yellow', 'flower_patch_blue', 'herb_bush', 'mushroom_log']) OBJS[id].gatherable = true;

  // ---------------- 2D 圖示（32×32 正面圖） ----------------
  const R = (pix, x0, y0, x1, y1, c, o) => pix.rect(x0, y0, x1, y1, c, o === undefined ? OUT : o);
  // 用「判斷式」填形狀：在形狀內、且四鄰有一格在形狀外 → 外框色，其餘 → 填色
  function shape(pix, x, y, x0, y0, x1, y1, inside, c, o) {
    for (let v = y0; v <= y1; v++) for (let u = x0; u <= x1; u++) {
      if (!inside(u + 0.5, v + 0.5)) continue;
      const edge = o && (!inside(u - 0.5, v + 0.5) || !inside(u + 1.5, v + 0.5) || !inside(u + 0.5, v - 0.5) || !inside(u + 0.5, v + 1.5));
      pix.px(x + u, y + v, edge ? o : c);
    }
  }
  const circ = (cx, cy, r) => (u, v) => (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
  const oval = (cx, cy, rx, ry) => (u, v) => ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1;
  const ringF = (cx, cy, r1, r0) => (u, v) => { const d = (u - cx) ** 2 + (v - cy) ** 2; return d <= r1 * r1 && d > r0 * r0; };
  const C = (pix, x, y, cx, cy, r, c, o) => shape(pix, x, y, Math.floor(cx - r - 1), Math.floor(cy - r - 1), Math.ceil(cx + r + 1), Math.ceil(cy + r + 1), circ(cx, cy, r), c, o === undefined ? OUT : o);
  const OV = (pix, x, y, cx, cy, rx, ry, c, o) => shape(pix, x, y, Math.floor(cx - rx - 1), Math.floor(cy - ry - 1), Math.ceil(cx + rx + 1), Math.ceil(cy + ry + 1), oval(cx, cy, rx, ry), c, o === undefined ? OUT : o);
  const RING = (pix, x, y, cx, cy, r1, r0, c, o) => shape(pix, x, y, Math.floor(cx - r1 - 1), Math.floor(cy - r1 - 1), Math.ceil(cx + r1 + 1), Math.ceil(cy + r1 + 1), ringF(cx, cy, r1, r0), c, o === undefined ? OUT : o);
  const PL = (pix, x, y, pts, c, o) => pix.poly(pts.map(([u, v]) => [x + u, y + v]), c, o === undefined ? OUT : o);
  const L = (pix, x, y, u0, v0, u1, v1, c) => pix.line(x + u0, y + v0, x + u1, y + v1, c);
  const D = (pix, x, y, pts, c) => { for (const [u, v] of pts) pix.px(x + u, y + v, c); };
  const W = [255, 255, 255];
  // 五瓣星（中心 cx,cy，外半徑 ro、內半徑 ri）
  const starPts = (cx, cy, ro, ri, rot) => { const a = []; for (let k = 0; k < 10; k++) { const t = (rot || 0) - Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? ri : ro; a.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); } return a; };
  function leafShape(pix, x, y, cx, cy, len, wid, ang, c, vein) {   // 細長葉子（兩端尖）
    const ca = Math.cos(ang), sa = Math.sin(ang);
    shape(pix, x, y, 0, 0, 31, 31, (u, v) => {
      const du = u - cx, dv = v - cy, a = du * ca + dv * sa, b = -du * sa + dv * ca;
      if (a < -len || a > len) return false;
      return Math.abs(b) <= wid * (1 - (a / len) ** 2);
    }, c, OUT);
    if (vein) pix.line(x + cx - ca * (len - 2), y + cy - sa * (len - 2), x + cx + ca * (len - 2), y + cy + sa * (len - 2), vein);
  }

  const ICONS = {
    // ---- 城市紀念品 ----
    postcard(pix, x, y) {                                                       // 明信片：左邊風景、右邊郵票和地址線
      R(pix, x + 2, y + 7, x + 29, y + 25, K.cream);
      R(pix, x + 4, y + 9, x + 15, y + 23, [168, 214, 244]);
      PL(pix, x, y, [[4, 23], [4, 19], [8, 16], [12, 18], [15, 15], [15, 23]], K.leaf);
      C(pix, x, y, 11.5, 12.5, 2, K.yellow, null);
      L(pix, x, y, 17, 9, 17, 23, K.paperD);
      R(pix, x + 23, y + 9, x + 27, y + 14, K.red); R(pix, x + 24, y + 10, x + 26, y + 11, K.pink, null);
      for (const v of [17, 20, 23]) L(pix, x, y, 19, v - 1, 27, v - 1, K.grayL);
    },
    badge(pix, x, y) {                                                          // 徽章：圓形別針＋星星＋緞帶
      PL(pix, x, y, [[10, 20], [14, 21], [12, 30], [9, 28], [7, 30]], K.red);
      PL(pix, x, y, [[22, 20], [18, 21], [20, 30], [23, 28], [25, 30]], K.red);
      C(pix, x, y, 16, 13, 11, K.blue);
      RING(pix, x, y, 16, 13, 9, 7.6, K.white, null);
      PL(pix, x, y, starPts(16, 13.5, 6.5, 2.8), K.yellow);
      D(pix, x, y, [[9, 7], [10, 6], [9, 8]], K.blueL);
    },
    old_photo(pix, x, y) {                                                      // 舊照片：白框、泛黃的房子風景、膠帶
      R(pix, x + 4, y + 4, x + 27, y + 29, [244, 238, 222]);
      R(pix, x + 7, y + 7, x + 24, y + 22, [222, 196, 150], null);
      R(pix, x + 7, y + 17, x + 24, y + 22, [188, 152, 108], null);
      PL(pix, x, y, [[10, 17], [10, 13], [14, 10], [18, 13], [18, 17]], [160, 120, 84]);
      R(pix, x + 13, y + 14, x + 15, y + 17, [110, 80, 58], null);
      C(pix, x, y, 21, 12, 2.5, [176, 136, 92], null);
      PL(pix, x, y, [[12, 2], [20, 2], [20, 6], [12, 6]], [240, 222, 150]);
      L(pix, x, y, 8, 25, 18, 25, [214, 206, 190]);
    },
    ticket(pix, x, y) {                                                         // 電影票：兩側缺口、虛線撕線、星星
      PL(pix, x, y, [[2, 9], [29, 9], [29, 14], [27, 16], [29, 18], [29, 23], [2, 23], [2, 18], [4, 16], [2, 14]], K.orange);
      R(pix, x + 4, y + 11, x + 19, y + 21, [250, 196, 120], null);
      for (let v = 11; v <= 21; v += 2) pix.px(x + 22, y + v, K.cream);
      PL(pix, x, y, starPts(11.5, 16, 4.5, 2), K.red, null);
      R(pix, x + 24, y + 12, x + 26, y + 13, K.cream, null); R(pix, x + 24, y + 19, x + 26, y + 20, K.cream, null);
    },
    key_old(pix, x, y) {                                                        // 舊鑰匙：圓環把手、長柄、齒
      RING(pix, x, y, 9, 15, 7, 3.2, K.gold);
      R(pix, x + 15, y + 14, x + 29, y + 17, K.gold);
      R(pix, x + 23, y + 18, x + 25, y + 22, K.gold); R(pix, x + 27, y + 18, x + 29, y + 24, K.gold);
      L(pix, x, y, 16, 15, 28, 15, [252, 228, 150]);
      D(pix, x, y, [[5, 11], [6, 10]], [252, 228, 150]);
    },
    marble(pix, x, y) {                                                         // 彈珠：藍色玻璃球＋漩渦＋反光
      C(pix, x, y, 16, 16, 11, [120, 190, 236]);
      shape(pix, x, y, 5, 5, 27, 27, (u, v) => { const t = Math.atan2(v - 16, u - 16), r = Math.hypot(u - 16, v - 16); return r < 9.5 && Math.abs(Math.sin(t * 1 + r * 0.45)) < 0.32; }, K.orange, null);
      R(pix, x + 10, y + 9, x + 12, y + 10, W, null); pix.px(x + 9, y + 11, W);
      pix.px(x + 21, y + 22, [200, 236, 255]); pix.px(x + 22, y + 21, [200, 236, 255]);
    },
    // ---- 自然收藏 ----
    flower_red(pix, x, y) {                                                     // 紅色鬱金香形的花
      R(pix, x + 15, y + 15, x + 16, y + 29, K.leafD, null);
      leafShape(pix, x, y, 11, 23, 6, 2.5, -0.8, K.leaf); leafShape(pix, x, y, 21, 24, 6, 2.5, 0.8, K.leaf);
      PL(pix, x, y, [[9, 6], [12, 9], [16, 4], [20, 9], [23, 6], [23, 13], [20, 17], [12, 17], [9, 13]], K.red);
      L(pix, x, y, 16, 7, 16, 15, shade(K.red, 0.8)); L(pix, x, y, 11, 10, 11, 13, [250, 150, 140]);
    },
    flower_yellow(pix, x, y) {                                                  // 黃色雛菊：八片花瓣＋橘色花心
      R(pix, x + 15, y + 20, x + 16, y + 29, K.leafD, null);
      leafShape(pix, x, y, 21, 25, 5, 2.2, 0.6, K.leaf);
      for (let k = 0; k < 8; k++) { const t = k * Math.PI / 4; OV(pix, x, y, 16 + Math.cos(t) * 6.5, 12 + Math.sin(t) * 6.5, 3, 3, K.yellow); }
      C(pix, x, y, 16, 12, 4, K.orange); D(pix, x, y, [[14, 10], [15, 10]], [252, 200, 120]);
    },
    flower_blue(pix, x, y) {                                                    // 藍色鈴蘭形：彎莖上掛三朵小鈴鐺
      pix.path([[x + 8, y + 29], [x + 9, y + 18], [x + 12, y + 9], [x + 17, y + 5], [x + 23, y + 5], [x + 26, y + 8]], K.leafD);
      leafShape(pix, x, y, 13, 24, 7, 2.6, -1.1, K.leaf, K.leafD);
      for (const [cx, cy] of [[13, 12], [19, 9], [25, 13]]) {
        L(pix, x, y, cx, cy - 4, cx, cy - 2, K.leafD);
        PL(pix, x, y, [[cx - 3, cy - 2], [cx + 3, cy - 2], [cx + 4, cy + 4], [cx + 2, cy + 3], [cx, cy + 5], [cx - 2, cy + 3], [cx - 4, cy + 4]], K.blue);
        pix.px(x + cx - 1, y + cy, K.blueL);
      }
    },
    leaf_maple(pix, x, y) {                                                     // 楓葉
      PL(pix, x, y, [[16, 2], [19, 9], [24, 6], [23, 12], [30, 12], [26, 17], [28, 19], [20, 21], [17, 24], [15, 24], [12, 21], [4, 19], [6, 17], [2, 12], [9, 12], [8, 6], [13, 9]], [232, 104, 64]);
      L(pix, x, y, 16, 5, 16, 30, [180, 70, 44]);
      L(pix, x, y, 16, 18, 9, 13, [200, 80, 50]); L(pix, x, y, 16, 18, 23, 13, [200, 80, 50]);
      D(pix, x, y, [[12, 13], [13, 14], [20, 11]], [250, 170, 110]);
    },
    acorn(pix, x, y) {                                                          // 橡實：帽子＋果實＋小柄
      OV(pix, x, y, 16, 19, 8, 9, [200, 140, 80]);
      OV(pix, x, y, 13, 18, 2, 4, [226, 172, 110], null);
      PL(pix, x, y, [[6, 13], [7, 9], [11, 6], [21, 6], [25, 9], [26, 13]], [140, 96, 62]);
      for (const u of [9, 13, 17, 21]) L(pix, x, y, u, 8, u + 2, 12, [112, 76, 50]);
      R(pix, x + 15, y + 2, x + 17, y + 5, K.bark);
    },
    clover4(pix, x, y) {                                                        // 四葉草：四片愛心葉
      pix.path([[x + 16, y + 16], [x + 17, y + 22], [x + 20, y + 29]], K.leafD);
      for (const [cx, cy] of [[11, 11], [21, 11], [11, 19], [21, 19]]) C(pix, x, y, cx, cy, 5, K.leaf);
      C(pix, x, y, 16, 15, 2.5, K.leaf, null);
      for (const [a, b, c2, d] of [[16, 15, 12, 11], [16, 15, 20, 11], [16, 15, 12, 19], [16, 15, 20, 19]]) L(pix, x, y, a, b, c2, d, K.leafD);
      D(pix, x, y, [[9, 9], [10, 8], [19, 8]], K.leafL);
    },
    feather(pix, x, y) {                                                        // 羽毛：斜放、淡藍尖端
      const ca = Math.cos(-0.8), sa = Math.sin(-0.8);
      shape(pix, x, y, 0, 0, 31, 31, (u, v) => {
        const du = u - 16, dv = v - 15, a = du * ca + dv * sa, b = -du * sa + dv * ca;
        return a > -10 && a < 12 && Math.abs(b) <= 5.2 * Math.sqrt(Math.max(0, 1 - ((a - 1) / 11.5) ** 2));
      }, K.white, OUT);
      shape(pix, x, y, 0, 0, 31, 31, (u, v) => {
        const du = u - 16, dv = v - 15, a = du * ca + dv * sa, b = -du * sa + dv * ca;
        return a > 5 && a < 11 && Math.abs(b) <= 4.4 * Math.sqrt(Math.max(0, 1 - ((a - 1) / 11.5) ** 2));
      }, K.blueL, null);
      L(pix, x, y, 5, 28, 24, 7, K.grayD);
      for (const [u, v] of [[11, 18], [15, 14]]) { L(pix, x, y, u, v, u - 3, v - 3, K.grayL); L(pix, x, y, u + 1, v + 1, u + 4, v + 4, K.grayL); }
    },
    mushroom(pix, x, y) {                                                       // 紅帽白點蘑菇
      PL(pix, x, y, [[12, 16], [20, 16], [21, 28], [11, 28]], K.mushStem);
      shape(pix, x, y, 2, 2, 30, 18, (u, v) => v <= 17 && ((u - 16) / 13) ** 2 + ((v - 17) / 13) ** 2 <= 1, K.mush, OUT);
      for (const [cx, cy, r] of [[10, 11, 2], [19, 8, 2.5], [23, 14, 1.6], [14, 15, 1.4]]) C(pix, x, y, cx, cy, r, K.white, null);
      L(pix, x, y, 13, 26, 19, 26, K.paperD);
    },
    // ---- 食物收藏 ----
    coffee_bean(pix, x, y) {                                                    // 一顆大咖啡豆
      OV(pix, x, y, 16, 16, 9, 12, [120, 76, 50]);
      pix.path([[x + 16, y + 6], [x + 14, y + 11], [x + 17, y + 16], [x + 15, y + 21], [x + 16, y + 26]], [70, 44, 30]);
      D(pix, x, y, [[11, 9], [11, 10], [12, 8]], [168, 116, 80]);
    },
    croissant(pix, x, y) {                                                      // 可頌：弧形排列的幾節麵包
      const seg = [[5, 21, 3.5], [9, 15, 4.5], [16, 13, 5.5], [23, 15, 4.5], [27, 21, 3.5]];
      seg.forEach(([cx, cy, r], k) => OV(pix, x, y, cx, cy, r, r + 1, k === 2 ? [232, 166, 84] : [214, 144, 70]));
      for (const [cx, cy] of [[9, 13], [16, 10], [23, 13]]) { pix.px(x + cx - 1, y + cy, [250, 210, 140]); pix.px(x + cx, y + cy, [250, 210, 140]); }
    },
    cake_slice(pix, x, y) {                                                     // 草莓蛋糕切片
      PL(pix, x, y, [[3, 14], [24, 9], [29, 14]], [255, 246, 236]);           // 頂面奶油
      R(pix, x + 3, y + 14, x + 29, y + 27, [250, 220, 150]);                  // 正面海綿
      R(pix, x + 4, y + 19, x + 28, y + 21, [255, 246, 236], null);            // 奶油夾層
      R(pix, x + 4, y + 20, x + 28, y + 20, K.pink, null);
      C(pix, x, y, 22, 9, 3, K.red); pix.px(x + 21, y + 8, W); R(pix, x + 22, y + 5, x + 23, y + 6, K.leaf, null);
    },
    macaron(pix, x, y) {                                                        // 馬卡龍：粉色殼＋奶油夾心
      OV(pix, x, y, 16, 21, 12, 5, K.pink);
      R(pix, x + 5, y + 15, x + 27, y + 18, [255, 246, 236]);
      OV(pix, x, y, 16, 12, 12, 5, K.pink);
      for (let u = 6; u <= 26; u += 2) pix.px(x + u, y + 16, [240, 230, 214]);
      D(pix, x, y, [[10, 9], [11, 9], [12, 8]], [255, 210, 222]);
    },
    cookie(pix, x, y) {                                                         // 巧克力豆餅乾
      C(pix, x, y, 16, 16, 12, [214, 160, 96]);
      for (const [cx, cy] of [[11, 11], [19, 9], [21, 18], [13, 20], [17, 15], [24, 13], [9, 16]]) R(pix, x + cx, y + cy, x + cx + 1, y + cy + 1, [92, 58, 40], null);
      D(pix, x, y, [[8, 9], [9, 8]], [236, 196, 140]);
    },
    donut(pix, x, y) {                                                          // 粉紅糖霜甜甜圈＋彩色糖粒
      RING(pix, x, y, 16, 16, 12, 4, [222, 164, 96]);
      shape(pix, x, y, 3, 3, 29, 29, (u, v) => { const d = Math.hypot(u - 16, v - 16); return d <= 10.5 + Math.sin(Math.atan2(v - 16, u - 16) * 6) * 0.8 && d > 5.2; }, K.pink, null);
      const sp = [[10, 9, K.yellow], [20, 8, K.blue], [23, 15, K.white], [21, 22, K.yellow], [11, 22, K.blue], [8, 16, K.white], [15, 7, K.leafL], [25, 19, K.leafL]];
      for (const [u, v, c] of sp) { pix.px(x + u, y + v, c); pix.px(x + u + 1, y + v, c); }
    },
    // ---- 隱藏收藏 ----
    gold_coin(pix, x, y) {                                                      // 古金幣：外圈、內圈、星星浮雕
      C(pix, x, y, 16, 16, 12, K.gold);
      RING(pix, x, y, 16, 16, 9.5, 8.2, K.goldD, null);
      PL(pix, x, y, starPts(16, 16.5, 6, 2.6), [252, 222, 130], K.goldD);
      D(pix, x, y, [[9, 8], [8, 9], [10, 7]], [255, 240, 190]);
      for (let k = 0; k < 12; k++) { const t = k * Math.PI / 6; pix.px(x + Math.round(16 + Math.cos(t) * 11), y + Math.round(16 + Math.sin(t) * 11), K.goldD); }
    },
    music_box(pix, x, y) {                                                      // 音樂盒：打開的蓋子、搖柄、飄出的音符
      PL(pix, x, y, [[5, 15], [7, 8], [24, 8], [26, 15]], [196, 122, 92]);    // 掀開的蓋子（內側）
      R(pix, x + 8, y + 10, x + 23, y + 14, [240, 190, 200], null);
      R(pix, x + 4, y + 16, x + 27, y + 28, [176, 104, 76]);
      R(pix, x + 4, y + 16, x + 27, y + 18, [214, 140, 104]);
      R(pix, x + 13, y + 21, x + 18, y + 24, K.gold);
      R(pix, x + 28, y + 20, x + 29, y + 21, K.goldD, null); R(pix, x + 29, y + 17, x + 30, y + 22, K.goldD, null);
      for (const [u, v, c] of [[4, 1, K.red], [11, 0, [110, 150, 220]]]) { R(pix, x + u, y + v + 4, x + u + 2, y + v + 6, c); L(pix, x, y, u + 2, v, u + 2, v + 4, OUT); pix.px(x + u + 3, y + v + 1, OUT); pix.px(x + u + 4, y + v + 2, OUT); }  // 飄出來的兩個音符
    },
    compass(pix, x, y) {                                                        // 羅盤：黃銅外殼、刻度、紅藍指針
      R(pix, x + 14, y + 1, x + 17, y + 4, K.goldD);
      C(pix, x, y, 16, 17, 12, K.gold);
      C(pix, x, y, 16, 17, 9, K.cream);
      for (let k = 0; k < 8; k++) { const t = k * Math.PI / 4, r = k % 2 ? 7.5 : 7; pix.px(x + Math.round(16 + Math.cos(t) * r), y + Math.round(17 + Math.sin(t) * r), k % 2 ? K.grayL : K.grayD); }
      PL(pix, x, y, [[16, 10], [18, 17], [14, 17]], K.red, null);
      PL(pix, x, y, [[16, 24], [18, 17], [14, 17]], K.blue, null);
      pix.px(x + 16, y + 17, OUT);
    },
    star_shard(pix, x, y) {                                                     // 星星碎片：缺一角的發光星星＋閃光
      PL(pix, x, y, [[15, 3], [19, 11], [27, 12], [21, 18], [20, 22], [14, 20], [10, 27], [11, 18], [4, 12], [12, 11]], [255, 236, 140]);
      PL(pix, x, y, [[15, 7], [17, 12], [12, 13]], [255, 252, 220], null);
      L(pix, x, y, 20, 22, 14, 20, [230, 196, 90]);
      for (const [u, v] of [[26, 4], [5, 22], [27, 25]]) { pix.px(x + u, y + v, K.shine); pix.px(x + u - 1, y + v, K.shine); pix.px(x + u + 1, y + v, K.shine); pix.px(x + u, y + v - 1, K.shine); pix.px(x + u, y + v + 1, K.shine); }
    },
    // ---- 材料 ----
    mat_flower(pix, x, y) {                                                     // 一小把花瓣
      const pet = [[11, 12, 0.5, K.pink], [20, 11, -0.4, K.red], [15, 20, 1.2, K.yellow], [23, 20, 0.2, K.pink], [9, 21, -0.6, K.lilac]];
      for (const [cx, cy, a, c] of pet) leafShape(pix, x, y, cx, cy, 5.5, 3, a, c);
    },
    mat_leaf(pix, x, y) {                                                       // 綠葉
      leafShape(pix, x, y, 16, 15, 12, 6, -0.7, K.leaf, K.leafD);
      L(pix, x, y, 7, 24, 4, 28, K.leafD);
      L(pix, x, y, 14, 17, 12, 12, K.leafD); L(pix, x, y, 18, 13, 22, 16, K.leafD);
    },
    mat_mushroom(pix, x, y) {                                                   // 兩朵咖啡色小蘑菇
      for (const [cx, cy, r] of [[11, 14, 7], [22, 19, 5]]) {
        R(pix, x + cx - 2, y + cy, x + cx + 2, y + cy + r + 4, K.mushStem);
        shape(pix, x, y, cx - r - 1, cy - r - 1, cx + r + 1, cy + 1, (u, v) => v <= cy + 0.5 && (u - cx) ** 2 + (v - cy - 0.5) ** 2 <= r * r, [176, 120, 80], OUT);
        pix.px(x + cx - 2, y + cy - r + 2, [214, 170, 120]);
      }
    },
    mat_wood(pix, x, y) {                                                       // 兩根交叉的樹枝
      PL(pix, x, y, [[4, 24], [24, 6], [27, 9], [7, 27]], K.barkL);
      PL(pix, x, y, [[6, 8], [9, 5], [28, 23], [25, 26]], K.bark);
      PL(pix, x, y, [[20, 10], [23, 4], [25, 5], [22, 12]], K.barkL);
      R(pix, x + 25, y + 23, x + 26, y + 24, K.ring, null);
      D(pix, x, y, [[12, 13], [17, 18]], K.woodD);
    },
    // ---- 其他 ----
    trash_icon(pix, x, y) {                                                     // 垃圾：綁好的垃圾袋
      PL(pix, x, y, [[13, 9], [19, 9], [26, 15], [28, 23], [25, 29], [7, 29], [4, 23], [6, 15]], K.bag);
      PL(pix, x, y, [[13, 9], [11, 3], [15, 6], [17, 6], [21, 3], [19, 9]], K.bagL);
      L(pix, x, y, 12, 10, 20, 10, K.bagL);
      L(pix, x, y, 9, 17, 8, 25, K.bagL); pix.px(x + 10, y + 16, K.bagL);
      L(pix, x, y, 19, 18, 22, 22, shade(K.bag, 0.75));
    },
    locked(pix, x, y) {                                                         // 未取得：灰色圓形剪影＋問號
      C(pix, x, y, 16, 16, 13, [176, 180, 192]);
      C(pix, x, y, 16, 16, 10.5, [150, 154, 168], null);
      const q = [[13, 9], [14, 8], [15, 8], [16, 8], [17, 8], [18, 9], [19, 10], [19, 11], [18, 12], [17, 13], [16, 14], [16, 15], [16, 16], [16, 19], [16, 20]];
      for (const [u, v] of q) { R(pix, x + u, y + v, x + u + 1, y + v + 1, W, null); }
      pix.px(x + 13, y + 10, W); pix.px(x + 12, y + 10, W);
    },
  };

  G.ART = G.ART || {};
  G.ART.park = { OBJS, ICONS, COLORS: K };
})(typeof window !== 'undefined' ? window : globalThis);
