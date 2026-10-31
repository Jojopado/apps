// PixelNook 麵包店＋超市美術：室內家具（等角零件）、壁紙、地板、牆面裝飾、外送物件、小遊戲 2D 圖示。
// 規則跟 models.js / cafe.js 一樣：同一物件的零件彼此不重疊；細節用凸出的薄方塊或 bands。
// 層架的做法：中間的層板「按欄切段」，同一欄的零件俯視都包含欄中心點 → 只有上下關係；不同欄只靠左右分開 → 不會形成前後循環。
(function (G) {
  'use strict';
  const { shade, OUT } = G.PX;
  const p = (f, s, wf, ws, h, z, c, b, hi) => ({ f, s, wf, ws, h, z, c, b, hi: hi !== false });

  // 色盤
  const K = {
    wood: [186, 128, 82], woodL: [218, 170, 116], woodLL: [236, 200, 150], woodD: [138, 90, 58], woodDD: [104, 66, 44],
    cream: [250, 240, 220], white: [246, 246, 250], dark: [52, 56, 70], steel: [196, 202, 214], steelD: [140, 148, 164], steelL: [226, 230, 238],
    crust: [196, 124, 62], crustL: [222, 156, 88], crustD: [158, 92, 46], crumb: [246, 222, 170], golden: [226, 162, 84], pale: [236, 196, 132],
    choco: [120, 76, 52], pink: [244, 168, 190], pinkL: [252, 210, 222], straw: [226, 70, 82], mint: [168, 222, 200], yellow: [250, 210, 100],
    custard: [252, 222, 120], blue: [126, 184, 232], blueD: [82, 132, 200], lilac: [200, 182, 232], green: [120, 186, 104], leaf: [96, 168, 92],
    red: [222, 86, 80], redD: [176, 60, 58], orange: [244, 150, 70], purple: [150, 96, 180], kiwi: [150, 200, 80],
    brick: [196, 106, 80], mortar: [232, 206, 180], glow: [255, 176, 70], glowL: [255, 226, 140], glass: [196, 234, 244],
    sack: [238, 228, 206], sackD: [214, 200, 172], kraft: [206, 164, 110], kraftD: [176, 134, 86], tape: [232, 204, 140],
    wicker: [214, 168, 102], wickerD: [176, 128, 70], frost: [214, 238, 248], frostD: [176, 214, 232],
    mkGreen: [96, 184, 128], mkGreenD: [66, 146, 98], teal: [120, 214, 200], cheese: [250, 214, 96], banana: [250, 222, 96],
  };

  const OBJS = {};
  function obj(id, name, W, D, model, extra, set) {
    OBJS[id] = Object.assign({ id, name, cat: set || 'bakery', set: set || 'bakery', price: 0, comfort: 0, W, D, kind: 'floor', model }, extra || {});
  }

  // ---------- 麵包小零件（z = 放置面高度） ----------
  const loaf = (f, s, z, col, wf, ws) => [                                    // 長方吐司：身體＋淺色圓頂
    p(f, s, wf || 0.16, ws || 0.24, 8, z, col || K.crust, [[z, z + 2, K.crustD]]),
    p(f, s, (wf || 0.16) - 0.04, (ws || 0.24) - 0.04, 3, z + 8, shade(col || K.crust, 1.15), null, false),
  ];
  const boule = (f, s, z, d, col) => [                                        // 圓麵包（大）
    p(f, s, d, d, 6, z, col || K.crust),
    p(f, s, d - 0.05, d - 0.05, 3, z + 6, shade(col || K.crust, 1.15), null, false),
  ];
  const bun = (f, s, z, d, col) => [p(f, s, d, d, 4, z, col || K.golden), p(f, s, d - 0.04, d - 0.04, 2, z + 4, shade(col || K.golden, 1.14), null, false)];
  const croissant = (f, s, z) => [                                            // 可頌：中段＋兩側小角
    p(f, s, 0.1, 0.1, 5, z, K.golden),
    p(f - 0.02, s - 0.08, 0.06, 0.06, 4, z, K.crustL, null, false),
    p(f - 0.02, s + 0.08, 0.06, 0.06, 4, z, K.crustL, null, false),
  ];
  // 斜插的法棍：三段往 +s 錯開，每段疊在上一段上
  const baguetteUp = (f, s, z, n) => {
    const a = [];
    for (let k = 0; k < (n || 3); k++) a.push(p(f, s + k * 0.03, 0.06, 0.06, 11, z + k * 11, k === (n || 3) - 1 ? K.crustL : K.crust, null, false));
    return a;
  };

  // ======================= 麵包店 =======================

  // 木頭麵包層架 2×1：三層階梯式層板（越上層越靠後），底層：斜插法棍的高籃＋圓麵包、可頌、小餐包托盤；中層：吐司＋瑪芬；上層：躺著的法棍＋餐包堆＋麵包棒罐
  obj('bread_shelf', '麵包層架', 2, 1, () => {
    const a = [
      p(-0.42, 0, 0.06, 1.8, 96, 0, shade(K.wood, 0.82), null, false),       // 背板 f -0.45..-0.39
      p(-0.025, -0.95, 0.85, 0.1, 100, 0, K.wood), p(-0.025, 0.95, 0.85, 0.1, 100, 0, K.wood), // 側板
      p(0.005, 0, 0.79, 1.8, 8, 0, K.woodL, [[0, 3, K.woodDD]]),              // 底座（第一層面）f -0.39..0.4
      p(-0.135, 0, 0.51, 1.8, 28, 8, K.woodDD, null, false),                  // 第二層的墊高（深色＝層架裡的陰影）f -0.39..0.12
      p(-0.135, 0, 0.51, 1.8, 3, 36, K.woodL),                                // 第二層板 z36..39
      p(-0.255, 0, 0.27, 1.8, 27, 39, K.woodDD, null, false),                 // 第三層墊高 f -0.39..-0.12
      p(-0.255, 0, 0.27, 1.8, 3, 66, K.woodL),                                // 第三層板 z66..69
    ];
    // 背板頂的波浪飾邊
    for (let k = 0; k < 6; k++) a.push(p(-0.42, -0.75 + k * 0.3, 0.06, 0.2, k % 2 ? 3 : 5, 96, K.woodL, null, false));
    // 價格小牌（貼在墊高的正面）
    for (const s of [-0.55, 0.05, 0.6]) a.push(p(0.125, s, 0.01, 0.12, 6, 28, K.cream, [[28, 30, K.red]], false));
    for (const s of [-0.4, 0.4]) a.push(p(-0.115, s, 0.01, 0.12, 6, 58, K.cream, [[58, 60, K.mkGreen]], false));
    // 第一層（z8，f 0.12..0.4）：高籃＋三支斜插法棍
    a.push(p(0.26, -0.65, 0.22, 0.3, 14, 8, K.wicker, [[8, 10, K.wickerD], [13, 14, K.wickerD], [19, 22, K.wickerD]]));
    a.push(...baguetteUp(0.2, -0.75, 22, 3), ...baguetteUp(0.28, -0.69, 22, 3), ...baguetteUp(0.34, -0.57, 22, 2));
    // 托盤 1：兩顆大圓麵包
    a.push(p(0.26, -0.15, 0.22, 0.34, 3, 8, K.woodLL));
    a.push(...boule(0.26, -0.24, 11, 0.14), ...boule(0.26, -0.06, 11, 0.14, K.crustD));
    // 托盤 2：兩個可頌
    a.push(p(0.26, 0.26, 0.24, 0.36, 3, 8, K.woodLL));
    a.push(...croissant(0.21, 0.18, 11), ...croissant(0.31, 0.34, 11));
    // 托盤 3：四顆小餐包
    a.push(p(0.26, 0.68, 0.24, 0.3, 3, 8, K.woodLL));
    for (const [f, s] of [[0.2, 0.6], [0.2, 0.76], [0.32, 0.6], [0.32, 0.76]]) a.push(...bun(f, s, 11, 0.1));
    // 第二層（z39，f -0.12..0.12）：吐司 ×4、瑪芬 ×2
    [[K.pale, -0.72], [K.crust, -0.42], [K.crustD, -0.12], [K.pale, 0.18]].forEach(([c, s]) => a.push(...loaf(0, s, 39, c, 0.18, 0.24)));
    for (const [s, top] of [[0.52, K.choco], [0.76, K.lilac]]) {
      a.push(p(0, s, 0.1, 0.1, 5, 39, K.pinkL, [[39, 41, K.pink]], false), p(0, s, 0.14, 0.14, 4, 44, top));
    }
    // 第三層（z69，f -0.39..-0.12）：躺著的法棍 ×2
    a.push(p(-0.32, -0.5, 0.07, 0.62, 5, 69, K.crust, [[72, 74, K.crustL]]), p(-0.21, -0.48, 0.07, 0.62, 5, 69, K.crustL, [[72, 74, K.crumb]]));
    // 餐包堆（三顆＋上面一顆）
    a.push(...[0.02, 0.18, 0.34].map(s => p(-0.26, s, 0.14, 0.14, 6, 69, K.golden)));
    a.push(p(-0.26, 0.18, 0.16, 0.16, 6, 75, K.crustL), p(-0.26, 0.18, 0.1, 0.1, 2, 81, K.golden, null, false));
    // 麵包棒罐
    a.push(p(-0.26, 0.68, 0.16, 0.16, 10, 69, K.glass, [[69, 71, K.steelD]]));
    for (const [df, ds, h] of [[-0.04, -0.03, 10], [0.03, 0.03, 13], [0.03, -0.04, 8], [-0.04, 0.04, 11]]) a.push(p(-0.26 + df, 0.68 + ds, 0.03, 0.03, h, 79, K.pale, null, false));
    return a;
  });

  // 麵包店櫃台 3×1：木頭底櫃＋前面玻璃展示格（角柱、上框、低玻璃，看得到裡面的蛋糕和塔）＋後面工作檯（蛋糕盒、紙袋、服務鈴）
  obj('bakery_counter', '麵包店櫃台', 3, 1, () => {
    const a = [
      p(0, 0, 0.9, 2.96, 30, 0, K.woodD, [[0, 4, K.woodDD]]),               // 底櫃 f -0.45..0.45
      p(-0.25, 0, 0.4, 2.96, 14, 30, K.woodD),                                // 後段工作檯 f -0.45..-0.05
      p(-0.25, 0, 0.4, 2.96, 3, 44, K.cream, [[44, 45, K.woodL]]),            // 工作檯面
      p(0.2, 0, 0.5, 2.88, 2, 30, K.white),                                   // 展示格底（白色蕾絲紙）f -0.05..0.45
      p(0.05, 0, 0.16, 2.8, 12, 32, K.pinkL, [[32, 34, K.white]]),            // 後排墊高 f -0.03..0.13
    ];
    // 正面三塊奶油色面板（金色飾條）
    for (const s of [-1, 0, 1]) a.push(p(0.465, s, 0.03, 0.9, 22, 4, K.cream, [[4, 6, K.woodL], [14, 16, K.golden]], false));
    // 低玻璃（分三段，中間有立柱）
    for (const [s, w] of [[-0.97, 0.94], [0, 0.94], [0.97, 0.94]]) a.push(p(0.435, s, 0.03, w, 6, 32, K.glass, null, false));
    // 角柱與中柱（從底櫃頂站起來）
    for (const s of [-1.46, -0.485, 0.485, 1.46]) a.push(p(0.43, s, 0.04, s === -1.46 || s === 1.46 ? 0.04 : 0.03, 40, 32, K.steel, null, false));
    for (const s of [-1.46, 1.46]) a.push(p(-0.02, s, 0.04, 0.04, 40, 30, K.steel, null, false));
    // 上框
    a.push(p(0.43, 0, 0.04, 2.96, 3, 72, K.glass), p(-0.02, 0, 0.04, 2.96, 3, 70, K.glass));
    a.push(p(0.205, -1.46, 0.41, 0.04, 3, 70, K.glass), p(0.205, 1.46, 0.41, 0.04, 3, 70, K.glass));
    // 前排（z32，f 0.18..0.38）：草莓蛋糕、水果塔、巧克力蛋糕、起司蛋糕、檸檬塔
    a.push(p(0.28, -1.15, 0.2, 0.26, 10, 32, K.cream, [[35, 37, K.pink], [40, 42, K.white]]));
    a.push(p(0.28, -1.21, 0.05, 0.05, 3, 42, K.straw, null, false), p(0.28, -1.09, 0.05, 0.05, 3, 42, K.straw, null, false));
    a.push(p(0.28, -0.6, 0.2, 0.28, 4, 32, K.crustL, [[32, 33, K.crust]]), p(0.28, -0.6, 0.16, 0.24, 1, 36, K.custard, null, false));
    a.push(p(0.28, -0.68, 0.05, 0.05, 2, 37, K.kiwi, null, false), p(0.28, -0.6, 0.05, 0.05, 2, 37, K.straw, null, false), p(0.28, -0.52, 0.05, 0.05, 2, 37, K.purple, null, false));
    a.push(p(0.28, 0, 0.2, 0.26, 11, 32, K.choco, [[36, 38, K.cream]]), p(0.28, 0, 0.06, 0.06, 3, 43, K.straw, null, false));
    a.push(p(0.24, 0.52, 0.12, 0.13, 8, 32, K.cheese, [[32, 34, K.crust]]), p(0.32, 0.68, 0.12, 0.13, 8, 32, K.cheese, [[32, 34, K.crust]]));
    for (const [f, s] of [[0.22, 1.06], [0.22, 1.24], [0.33, 1.15]]) a.push(p(f, s, 0.09, 0.09, 3, 32, K.crustL), p(f, s, 0.06, 0.06, 1, 35, K.yellow, null, false));
    // 後排墊高上（z44，f -0.03..0.13）：馬卡龍、杯子蛋糕、蛋糕捲
    [K.mint, K.pink, K.lilac, K.yellow, K.blue].forEach((c, k) => a.push(p(0.05, -1.22 + k * 0.13, 0.08, 0.08, 5, 44, c, [[46, 47, K.cream]], false)));
    for (const [s, top] of [[-0.35, K.pink], [-0.05, K.white], [0.25, K.choco]]) a.push(p(0.05, s, 0.09, 0.09, 5, 44, K.blue, null, false), p(0.05, s, 0.12, 0.12, 5, 49, top));
    a.push(p(0.05, 0.85, 0.12, 0.42, 8, 44, K.crumb, [[44, 46, K.crustL], [50, 52, K.cream]]));
    // 工作檯上（z47）：粉紅蛋糕盒＋緞帶、紙袋插法棍、服務鈴、一疊紙袋
    a.push(p(-0.25, -1.0, 0.28, 0.34, 13, 47, K.pink, [[47, 49, K.pinkL]]), p(-0.25, -1.0, 0.06, 0.34, 1, 60, K.white, null, false), p(-0.25, -1.0, 0.14, 0.06, 3, 61, K.straw, null, false));
    a.push(p(-0.25, -0.35, 0.26, 0.22, 2, 47, K.kraft), p(-0.25, -0.35, 0.24, 0.2, 2, 49, K.kraftD, null, false));
    a.push(p(-0.25, 0.4, 0.14, 0.22, 18, 47, K.kraft, [[61, 65, K.kraftD]]), ...baguetteUp(-0.25, 0.38, 65, 1), p(-0.25, 0.46, 0.06, 0.06, 7, 65, K.crustL, null, false));
    a.push(p(-0.22, 1.05, 0.12, 0.12, 2, 47, K.dark, null, false), p(-0.22, 1.05, 0.08, 0.08, 4, 49, K.yellow));
    return a;
  });

  // 大烤箱 2×1：紅磚身體（灰泥橫線）、石頭頂、煙囪、金屬拱門＋小窗看得到發光的麵包、溫度旋鈕、灰抽屜
  obj('bakery_oven', '麵包大烤箱', 2, 1, () => {
    const mortar = []; for (let z = 9; z < 76; z += 9) mortar.push([z, z + 1, K.mortar]);
    const a = [
      p(-0.05, 0, 0.8, 1.9, 76, 0, K.brick, [[0, 3, shade(K.brick, 0.7)]].concat(mortar)), // 身體 f -0.45..0.35
      p(-0.05, 0, 0.84, 1.98, 6, 76, [176, 170, 164], [[76, 78, [150, 144, 140]]]),          // 石頭頂
      p(-0.25, 0.6, 0.2, 0.2, 26, 82, K.steelD, [[98, 101, K.dark]]),                       // 煙囪
      p(-0.25, 0.6, 0.24, 0.24, 3, 108, K.dark),
      p(0.365, 0, 0.03, 1.2, 40, 14, K.dark),                                                // 門框 f 0.35..0.38
      p(0.365, 0, 0.03, 1.0, 4, 54, K.dark), p(0.365, 0, 0.03, 0.72, 4, 58, K.dark),         // 拱形門頂（階梯）
      p(0.385, 0, 0.01, 0.92, 22, 20, K.glow, [[20, 24, shade(K.glow, 0.85)], [38, 42, K.glowL]], false), // 發光的小窗 f 0.38..0.39
      p(0.395, -0.22, 0.01, 0.26, 7, 24, K.crust, [[29, 31, K.crustL]], false),             // 窗裡的麵包
      p(0.395, 0.18, 0.01, 0.22, 6, 24, K.crustD, [[28, 30, K.crust]], false),
      p(0.395, 0.18, 0.01, 0.12, 2, 30, K.crustL, null, false),
      p(0.395, -0.32, 0.03, 0.04, 3, 47, K.steel, null, false), p(0.395, 0.32, 0.03, 0.04, 3, 47, K.steel, null, false), // 把手座
      p(0.425, 0, 0.03, 0.72, 3, 47, K.steelL),                                              // 把手 f 0.41..0.44
      p(0.36, -0.78, 0.02, 0.1, 8, 58, K.dark, null, false), p(0.37, -0.78, 0.01, 0.05, 3, 61, K.yellow, null, false), // 旋鈕
      p(0.36, 0.78, 0.02, 0.1, 8, 58, K.dark, null, false), p(0.37, 0.78, 0.01, 0.05, 3, 61, K.red, null, false),
      p(0.355, 0, 0.01, 0.8, 8, 3, [80, 70, 70], null, false),                               // 灰抽屜
      p(0.365, 0, 0.01, 0.2, 2, 6, K.steel, null, false),
      p(0.36, 0.75, 0.02, 0.18, 2, 46, K.steelD, null, false),                              // 溫度計（小橫條）
    ];
    return a;
  });

  // 麵粉袋堆 1×1：木棧板上兩袋＋上面一袋（綁繩）＋前面一小袋、小鏟子、撒出來的麵粉
  obj('flour_sacks', '麵粉袋堆', 1, 1, () => [
    p(0, 0, 0.84, 0.84, 4, 0, K.woodL, [[0, 2, K.woodD]]),
    p(-0.08, -0.2, 0.5, 0.36, 18, 4, K.sack, [[10, 13, K.blue]]), p(-0.08, 0.2, 0.5, 0.36, 18, 4, K.sack, [[10, 13, K.blue]]),
    p(0.175, -0.2, 0.01, 0.03, 5, 14, K.crust, null, false), p(0.175, 0.2, 0.01, 0.03, 5, 14, K.crust, null, false),  // 麥穗小標
    p(-0.1, 0, 0.46, 0.4, 16, 22, K.sack, [[28, 31, K.red]]),
    p(-0.1, 0, 0.3, 0.26, 4, 38, K.sackD), p(-0.1, 0, 0.08, 0.08, 4, 42, K.kraftD, null, false),
    p(0.3, 0.15, 0.2, 0.26, 12, 4, K.sack, [[8, 10, K.green]]), p(0.3, 0.15, 0.12, 0.16, 3, 16, K.sackD, null, false),
    p(0.32, -0.26, 0.14, 0.2, 1, 4, K.white, null, false),
    p(0.3, -0.06, 0.1, 0.1, 5, 4, K.steel), p(0.3, 0.02, 0.06, 0.04, 2, 7, K.steelD, null, false),
  ]);

  // 地上的麵包籃 1×1：藤編籃（橫紋）、格子餐巾、大圓麵包、躺著的法棍、小餐包、立著的法棍
  obj('bread_basket', '麵包籃', 1, 1, () => [
    p(0, 0, 0.62, 0.62, 14, 0, K.wicker, [[0, 2, K.wickerD], [5, 6, K.wickerD], [9, 10, K.wickerD], [12, 14, shade(K.wicker, 1.12)]]),
    p(0, 0, 0.54, 0.54, 1, 14, K.red, null, false),
    p(0.0, 0.0, 0.3, 0.3, 1, 15, K.white, null, false),                     // 餐巾中間的白格
    p(-0.17, 0, 0.08, 0.46, 5, 15, K.crust, [[18, 20, K.crustL]]),          // 躺著的法棍（在後排，壓在紅巾上）
    ...boule(0.04, -0.08, 16, 0.18),                                        // 大圓麵包（在白格上）
    ...bun(0.15, 0.13, 15, 0.1), ...bun(0.15, 0.0, 15, 0.08, K.crustL),
    ...baguetteUp(0.0, 0.14, 16, 3),
  ]);

  // 三層蛋糕架 1×1：木台座＋蕾絲桌面，三層盤子由金色細柱撐起；每層的甜點都放在上一層盤子外圈（俯視不被遮住）
  obj('cake_stand', '三層蛋糕架', 1, 1, () => {
    const a = [
      p(0, 0, 0.46, 0.46, 3, 0, K.woodD), p(0, 0, 0.18, 0.18, 24, 3, K.woodD, [[3, 6, K.woodDD]]),
      p(0, 0, 0.78, 0.78, 4, 27, K.cream, [[27, 29, K.pink]]),
      p(0, 0, 0.7, 0.7, 2, 31, K.white),                                    // 盤 1 z31..33
      p(0, 0, 0.06, 0.06, 12, 33, K.yellow, null, false),                   // 柱 1
      p(0, 0, 0.46, 0.46, 2, 45, K.white),                                  // 盤 2 z45..47
      p(0, 0, 0.05, 0.05, 10, 47, K.yellow, null, false),
      p(0, 0, 0.26, 0.26, 2, 57, K.white),                                  // 盤 3 z57..59
    ];
    // 盤 1 外圈：8 個小蛋糕（角＋邊）
    const ring1 = [[0.28, 0.28, K.pink], [-0.28, 0.28, K.choco], [0.28, -0.28, K.mint], [-0.28, -0.28, K.cheese],
      [0.29, 0, K.lilac], [-0.29, 0, K.pink], [0, 0.29, K.yellow], [0, -0.29, K.choco]];
    for (const [f, s, c] of ring1) a.push(p(f, s, 0.1, 0.1, 6, 33, c, [[35, 36, K.cream]]), p(f, s, 0.04, 0.04, 2, 39, K.straw, null, false));
    // 盤 2 外圈：8 顆馬卡龍
    const mc = [K.pink, K.mint, K.yellow, K.lilac, K.blue, K.pink, K.mint, K.orange];
    [[0.18, 0.18], [-0.18, 0.18], [0.18, -0.18], [-0.18, -0.18], [0.18, 0], [-0.18, 0], [0, 0.18], [0, -0.18]].forEach(([f, s], k) =>
      a.push(p(f, s, 0.08, 0.08, 5, 47, mc[k], [[49, 50, K.cream]], false)));
    // 盤 3：小草莓蛋糕
    a.push(p(0, 0, 0.18, 0.18, 8, 59, K.pinkL, [[62, 64, K.white]]), p(0, 0, 0.06, 0.06, 3, 67, K.straw, null, false));
    return a;
  });

  // 麵包店小桌 1×1：粗木單柱＋十字腳、四邊外擴的圓角桌面、可頌盤、馬克杯、小花瓶（桌上東西都跟桌柱俯視重疊）
  obj('bakery_table', '麵包店小桌', 1, 1, () => [
    p(0, 0, 0.5, 0.12, 3, 0, K.woodD, null, false), p(0, 0.155, 0.12, 0.19, 3, 0, K.woodD, null, false), p(0, -0.155, 0.12, 0.19, 3, 0, K.woodD, null, false), // 十字腳
    p(0, 0, 0.24, 0.24, 25, 3, K.woodD, [[3, 6, K.woodDD]]),
    p(0, 0, 0.64, 0.64, 4, 28, K.woodL, [[28, 30, K.wood]]),                // 桌面中心
    p(0.36, 0, 0.08, 0.48, 4, 28, K.woodL, [[28, 30, K.wood]]), p(-0.36, 0, 0.08, 0.48, 4, 28, K.woodL, [[28, 30, K.wood]]), // 外擴邊（圓角感）
    p(0, 0.36, 0.48, 0.08, 4, 28, K.woodL, [[28, 30, K.wood]]), p(0, -0.36, 0.48, 0.08, 4, 28, K.woodL, [[28, 30, K.wood]]),
    p(0.04, -0.06, 0.22, 0.22, 1, 32, K.white),                             // 盤子
    ...croissant(0.05, -0.06, 33),
    p(0.08, 0.12, 0.1, 0.1, 7, 32, K.mint, [[37, 39, K.choco]]), p(0.08, 0.185, 0.03, 0.03, 4, 33, K.mint, null, false), // 馬克杯＋杯耳
    p(-0.1, 0.08, 0.08, 0.08, 8, 32, K.pinkL), p(-0.1, 0.08, 0.02, 0.02, 5, 40, K.leaf, null, false), p(-0.1, 0.08, 0.08, 0.08, 3, 45, K.yellow, null, false),
  ]);

  // 麵包店椅 1×1：木腳、紅格坐墊、椅背兩橫條中間一顆愛心、拱形頂（可以坐，座面 z=20）
  obj('bakery_chair', '麵包店椅子', 1, 1, () => [
    p(0.25, -0.25, 0.06, 0.06, 15, 0, K.woodD, null, false), p(0.25, 0.25, 0.06, 0.06, 15, 0, K.woodD, null, false),
    p(0.04, 0, 0.58, 0.62, 5, 15, K.wood, [[17, 20, K.red]]),
    p(-0.28, -0.25, 0.06, 0.06, 44, 0, K.woodD, null, false), p(-0.28, 0.25, 0.06, 0.06, 44, 0, K.woodD, null, false),
    p(-0.28, 0, 0.06, 0.44, 4, 22, K.wood, null, false),
    p(-0.28, 0, 0.06, 0.44, 4, 32, K.wood, null, false),
    p(-0.28, 0, 0.04, 0.06, 2, 36, K.red, null, false), p(-0.28, 0, 0.04, 0.14, 3, 38, K.red, null, false), // 愛心
    p(-0.28, -0.045, 0.04, 0.05, 2, 41, K.red, null, false), p(-0.28, 0.045, 0.04, 0.05, 2, 41, K.red, null, false),
    p(-0.28, 0, 0.06, 0.56, 5, 44, K.wood),
    p(-0.28, 0, 0.06, 0.26, 3, 49, K.woodL),
  ], { seat: { z: 20, spots: [[0.05, 0]] } });

  // ======================= 超市 =======================
  const PROD = [K.red, K.blue, K.yellow, K.mkGreen, K.orange, K.pink, K.lilac, K.teal, K.white, K.purple];
  // 一欄一層的商品（俯視都包含欄中心 (cf, s)）；kind 0 盒子、1 兩層罐頭、2 瓶子、3 罐子、4 零食袋
  function product(a, cf, s, wf, z, kind, c, c2) {
    if (kind === 0) a.push(p(cf, s, wf, 0.2, 18, z, c, [[z + 6, z + 10, K.white]]));
    else if (kind === 1) { a.push(p(cf, s, wf, 0.18, 8, z, c, [[z + 2, z + 5, K.white]]), p(cf, s, wf, 0.18, 8, z + 8, c, [[z + 10, z + 13, K.white]])); }
    else if (kind === 2) { a.push(p(cf, s, wf, 0.15, 12, z, c, [[z + 4, z + 8, K.white]]), p(cf, s, wf - 0.04, 0.06, 4, z + 12, c, null, false), p(cf, s, wf - 0.06, 0.06, 2, z + 16, c2, null, false)); }
    else if (kind === 3) { a.push(p(cf, s, wf, 0.18, 10, z, K.glass, [[z, z + 7, c]]), p(cf, s, wf - 0.02, 0.17, 3, z + 10, c2)); }
    else { a.push(p(cf, s, wf, 0.2, 14, z, c, [[z + 11, z + 14, shade(c, 0.8)]]), p(cf, s, wf - 0.06, 0.08, 1, z + 14, shade(c, 0.8), null, false)); }
  }

  // 貨架 2×1：雙面（正反兩面都擺滿），四層；中間隔板、兩端綠色側板、頂上彩條招牌
  obj('market_shelf', '超市貨架', 2, 1, () => {
    const a = [
      p(0, 0, 0.9, 1.88, 8, 0, K.steelL, [[0, 3, K.dark]]),                 // 底座 f -0.45..0.45
      p(0, 0, 0.06, 1.88, 92, 8, K.steel),                                    // 中間隔板 f -0.03..0.03 z8..100
      p(0, -0.97, 0.9, 0.06, 104, 0, K.mkGreen, [[0, 3, K.dark]]), p(0, 0.97, 0.9, 0.06, 104, 0, K.mkGreen, [[0, 3, K.dark]]), // 側板
      p(0, 0, 0.06, 1.5, 12, 100, K.red, [[104, 108, K.yellow]]),             // 頂上招牌（只壓在隔板上）
    ];
    const NC = 8, cw = 1.88 / NC, levels = [8, 32, 56, 80], boards = [29, 53, 77];
    for (const side of [1, -1]) for (let c = 0; c < NC; c++) {
      const s = -0.94 + cw * (c + 0.5), cf = side * 0.235;
      for (const zb of boards) a.push(p(side * 0.24, s, 0.42, cw, 3, zb, K.white));
      levels.forEach((z, L) => {
        const k = (c * 3 + L * 2 + (side > 0 ? 0 : 1)) % 5, col = PROD[(c * 7 + L * 3 + (side > 0 ? 0 : 4)) % PROD.length];
        product(a, cf, s, 0.34, z, k, col, PROD[(c + L + 3) % PROD.length]);
      });
      if (c % 2 === 0) for (const zb of boards) a.push(p(side * 0.455, s, 0.01, 0.1, 4, zb - 2, c % 4 ? K.yellow : K.red, null, false)); // 價格牌
    }
    return a;
  }, null, 'market');

  // 直立冷藏櫃 2×1：白色櫃身、冷藍內壁、頂上綠色燈箱、雙玻璃門（只畫門框，看得到裡面的牛奶和果汁）
  obj('fridge_case', '冷藏櫃', 2, 1, () => {
    const a = [
      p(0, 0, 0.9, 2.0, 10, 0, K.white, [[0, 3, K.dark], [4, 7, K.steelD]]),  // 底座
      p(-0.41, 0, 0.08, 1.88, 86, 10, K.frost, null, false),                  // 冷藍內壁 f -0.45..-0.37
      p(-0.025, -0.97, 0.85, 0.06, 86, 10, K.white), p(-0.025, 0.97, 0.85, 0.06, 86, 10, K.white), // 側板 f -0.45..0.40
      p(0, 0, 0.9, 2.0, 14, 96, K.white, [[100, 107, K.mkGreen]]),            // 頂蓋＋燈箱色帶
      p(0.425, -0.97, 0.05, 0.06, 86, 10, K.steel), p(0.425, 0.97, 0.05, 0.06, 86, 10, K.steel), // 門框外側
      p(0.425, 0, 0.05, 0.14, 86, 10, K.steel),                               // 中間門框（兩扇門）
      p(0.425, -0.505, 0.05, 0.87, 6, 10, K.steel), p(0.425, 0.505, 0.05, 0.87, 6, 10, K.steel), // 下框
      p(0.425, -0.505, 0.05, 0.87, 5, 91, K.steel), p(0.425, 0.505, 0.05, 0.87, 5, 91, K.steel), // 上框
      p(0.465, -0.05, 0.03, 0.03, 32, 36, K.steelD, null, false), p(0.465, 0.05, 0.03, 0.03, 32, 36, K.steelD, null, false), // 門把
    ];
    const NC = 6, cw = 1.88 / NC, levels = [10, 41, 69], boards = [38, 66];
    for (let c = 0; c < NC; c++) {
      const s = -0.94 + cw * (c + 0.5);
      for (const zb of boards) a.push(p(0.015, s, 0.77, cw, 3, zb, K.steelL));
      levels.forEach((z, L) => {
        const k = (c + L * 2) % 3;
        if (k === 0) {                                                        // 牛奶盒（藍標＋屋頂形蓋）
          a.push(p(0.1, s, 0.5, 0.2, 14, z, K.white, [[z + 4, z + 9, L === 1 ? K.pink : K.blue]]), p(0.1, s, 0.5, 0.1, 4, z + 14, L === 1 ? K.pinkL : [190, 216, 244], null, false));
        } else if (k === 1) {                                                 // 果汁瓶
          const jc = [K.orange, K.yellow, K.straw][(c + L) % 3];
          a.push(p(0.1, s, 0.5, 0.18, 15, z, jc, [[z + 5, z + 10, K.white]]), p(0.1, s, 0.46, 0.08, 4, z + 15, jc, null, false), p(0.1, s, 0.44, 0.08, 2, z + 19, K.green, null, false));
        } else {                                                              // 優格杯（兩層）
          a.push(p(0.1, s, 0.5, 0.22, 7, z, K.white, [[z + 2, z + 5, K.lilac]]), p(0.1, s, 0.5, 0.22, 7, z + 7, K.white, [[z + 9, z + 12, K.mint]]));
        }
      });
    }
    return a;
  }, null, 'market');

  // 蔬果攤 2×1：前低後高的木箱（看起來斜斜的）、紅白條紋遮陽棚＋波浪垂邊、小價格牌
  obj('produce_stand', '蔬果攤', 2, 1, () => {
    const a = [
      p(0.22, 0, 0.5, 1.88, 12, 0, K.woodD, [[0, 3, K.woodDD]]),             // 前段平台 f -0.03..0.47
      p(-0.24, 0, 0.42, 1.88, 30, 0, K.woodD, [[0, 3, K.woodDD], [14, 15, K.woodDD]]), // 後段墊高 f -0.45..-0.03
    ];
    for (const f of [-0.42, 0.44]) for (const s of [-0.97, 0.97]) a.push(p(f, s, 0.06, 0.06, 92, 0, K.wood, null, false)); // 四根柱
    for (let k = 0; k < 8; k++) {                                             // 條紋遮陽棚（壓在柱子上，最上層）
      const s = -1 + 0.25 * (k + 0.5), c = k % 2 ? K.cream : K.red;
      a.push(p(0.01, s, 0.92, 0.25, 5, 92, c));
      a.push(p(0.455, s, 0.03, k === 0 || k === 7 ? 0.17 : 0.2, 6, 86, c, null, false)); // 波浪垂邊
    }
    const crate = (f, wf, z, s) => a.push(p(f, s, wf, 0.6, 10, z, K.woodL, [[z, z + 2, K.wood], [z + 5, z + 6, K.wood]]));
    // 前排木箱（z12，f 0.0..0.42）：蘋果、橘子、紅蘿蔔
    const F = 0.21, FW = 0.42, B = -0.24, BW = 0.38;
    [-0.62, 0, 0.62].forEach(s => crate(F, FW, 12, s));
    a.push(p(F, -0.62, 0.36, 0.54, 3, 22, shade(K.red, 0.8), null, false));
    for (const [df, ds] of [[-0.11, -0.17], [-0.11, 0.0], [-0.11, 0.17], [0.07, -0.08], [0.07, 0.09]]) a.push(p(F + df, -0.62 + ds, 0.12, 0.12, 5, 25, K.red), p(F + df, -0.62 + ds, 0.03, 0.03, 2, 30, K.leaf, null, false));
    a.push(p(F, 0, 0.36, 0.54, 3, 22, shade(K.orange, 0.8), null, false));
    for (const [df, ds] of [[-0.1, -0.16], [-0.1, 0.0], [-0.1, 0.16], [0.08, -0.08], [0.08, 0.08]]) a.push(p(F + df, ds, 0.12, 0.12, 5, 25, K.orange), p(F + df, ds, 0.03, 0.03, 1, 30, K.leaf, null, false));
    a.push(p(F, 0.62, 0.36, 0.54, 3, 22, [150, 104, 70], null, false));
    for (const ds of [-0.18, -0.06, 0.06, 0.18]) a.push(p(F + 0.04, 0.62 + ds, 0.26, 0.07, 4, 25, K.orange), p(F - 0.12, 0.62 + ds, 0.06, 0.09, 5, 25, K.green, null, false));
    // 價格小牌（貼在前排木箱正面）
    for (const [s, c] of [[-0.62, K.red], [0, K.orange], [0.62, K.orange]]) a.push(p(0.425, s, 0.01, 0.16, 6, 14, K.cream, [[14, 16, c]], false));
    // 後排木箱（z30，f -0.43..-0.05）：香蕉、葡萄、高麗菜
    [-0.62, 0, 0.62].forEach(s => crate(B, BW, 30, s));
    a.push(p(B, -0.62, 0.32, 0.54, 3, 40, [200, 170, 90], null, false));
    for (const df of [-0.09, 0.07]) {
      a.push(p(B + df, -0.66, 0.1, 0.34, 4, 43, K.banana), p(B + df, -0.47, 0.06, 0.04, 3, 43, [120, 96, 50], null, false));
      a.push(p(B + df - 0.02, -0.7, 0.07, 0.2, 3, 47, shade(K.banana, 1.06), null, false));
    }
    a.push(p(B, 0, 0.32, 0.54, 3, 40, [120, 150, 80], null, false));
    for (const ds of [-0.15, 0.15]) {                                         // 葡萄串：底下三顆＋上面一顆
      for (const [df, dd] of [[-0.06, -0.06], [-0.06, 0.06], [0.06, 0]]) a.push(p(B + df, ds + dd, 0.11, 0.11, 4, 43, K.purple));
      a.push(p(B - 0.02, ds, 0.12, 0.12, 4, 47, shade(K.purple, 1.15)), p(B - 0.02, ds, 0.03, 0.03, 3, 51, K.leaf, null, false));
    }
    a.push(p(B, 0.62, 0.32, 0.54, 3, 40, [120, 150, 80], null, false));
    for (const ds of [-0.13, 0.13]) a.push(p(B, 0.62 + ds, 0.22, 0.22, 7, 43, K.green, [[43, 45, K.leaf]]), p(B, 0.62 + ds, 0.14, 0.14, 3, 50, [180, 224, 150], null, false));
    return a;
  }, null, 'market');

  // 收銀台 2×1：白色櫃身＋綠色條紋、左邊輸送帶（上面有商品和分隔條）、掃描玻璃、收銀機＋朝客人的小螢幕、發票機、正面糖果小架
  obj('checkout_counter', '收銀台', 2, 1, () => {
    const a = [
      p(0, 0, 0.9, 1.96, 38, 0, K.white, [[0, 4, K.dark], [24, 30, K.mkGreen]]), // 櫃身 f -0.45..0.45
      p(0, -0.42, 0.7, 1.08, 4, 38, K.steel),                                  // 輸送帶框 s -0.96..0.12
      p(0, -0.42, 0.6, 1.04, 2, 42, K.dark),                                   // 輸送帶 z42..44
      p(0.05, -0.75, 0.14, 0.12, 12, 44, K.white, [[48, 52, K.blue]]), p(0.05, -0.75, 0.14, 0.06, 3, 56, [190, 216, 244], null, false), // 牛奶
      p(-0.12, -0.52, 0.09, 0.09, 6, 44, K.red), p(0.1, -0.5, 0.09, 0.09, 6, 44, K.red), p(0.1, -0.5, 0.03, 0.03, 2, 50, K.leaf, null, false), // 蘋果
      p(0, -0.25, 0.2, 0.08, 16, 44, K.yellow, [[50, 54, K.red]]),             // 麥片盒
      p(0, -0.05, 0.5, 0.04, 4, 44, K.mkGreen, null, false),                   // 分隔條
      p(0, 0.3, 0.36, 0.24, 1, 38, [70, 80, 96], null, false), p(0, 0.3, 0.36, 0.02, 1, 39, K.red, null, false), // 掃描玻璃＋紅線
      p(-0.1, 0.7, 0.5, 0.46, 10, 38, K.steel, [[38, 41, K.steelD]]),          // 收銀機身
      p(-0.18, 0.7, 0.24, 0.3, 2, 48, K.steelL, null, false),                  // 鍵盤
      p(0.05, 0.82, 0.04, 0.04, 10, 48, K.dark, null, false), p(0.05, 0.82, 0.06, 0.24, 10, 58, K.dark), // 螢幕支柱＋螢幕
      p(0.085, 0.82, 0.01, 0.2, 7, 60, K.teal, null, false),
      p(-0.32, 0.3, 0.12, 0.14, 6, 38, K.white), p(-0.32, 0.3, 0.06, 0.1, 3, 44, K.cream, null, false), // 發票機＋紙
      p(0.47, 0.5, 0.04, 0.62, 2, 14, K.steel, null, false),                   // 正面糖果小架
    ];
    for (const [ds, dd] of [[-0.06, -0.06], [0.04, -0.06], [-0.06, 0.04], [0.04, 0.04]]) a.push(p(-0.18 + ds, 0.7 + dd, 0.06, 0.06, 1, 50, K.white, null, false));
    [K.pink, K.yellow, K.blue, K.red, K.mint].forEach((c, k) => a.push(p(0.47, 0.26 + k * 0.12, 0.04, 0.08, 5, 16, c, null, false)));
    return a;
  }, null, 'market');

  // 購物籃堆 1×1：金屬小底座＋四個疊在一起的紅色購物籃（越上面越大）、白色籃邊、提把
  obj('basket_stack', '購物籃堆', 1, 1, () => [
    p(0, 0, 0.64, 0.56, 3, 0, K.steelD, null, false),
    p(0, 0, 0.44, 0.36, 10, 3, K.red, [[3, 5, K.redD], [7, 8, K.redD], [11, 13, K.white]]),
    p(0, 0, 0.48, 0.4, 6, 13, K.red, [[13, 15, K.redD], [17, 19, K.white]]),
    p(0, 0, 0.52, 0.44, 6, 19, K.red, [[19, 21, K.redD], [23, 25, K.white]]),
    p(0, 0, 0.56, 0.48, 9, 25, K.red, [[25, 27, K.redD], [29, 30, K.redD], [31, 34, K.white]]),
    p(0, 0, 0.46, 0.38, 1, 34, K.redD, null, false),                          // 籃子裡面
    p(0, -0.21, 0.04, 0.04, 9, 34, K.dark, null, false), p(0, 0.21, 0.04, 0.04, 9, 34, K.dark, null, false),
    p(0, 0, 0.05, 0.46, 3, 43, K.dark),                                       // 提把
  ], null, 'market');

  // 購物車 1×1：輪子、四根腳、下層置物架、金屬籃（格線）、後面紅色推把、籃裡露出法棍和瓶子
  obj('cart', '購物車', 1, 1, () => {
    const a = [];
    for (const [f, s] of [[0.32, -0.22], [0.32, 0.22], [-0.26, -0.22], [-0.26, 0.22]]) {
      a.push(p(f, s, 0.07, 0.05, 6, 0, K.dark, null, false));               // 輪子
      a.push(p(f, s, 0.04, 0.04, 16, 6, K.steelD, null, false));            // 腳
    }
    a.push(p(0.03, 0, 0.5, 0.36, 2, 10, K.steel, null, false));              // 下層置物架（在四根腳之間）
    a.push(p(0.04, 0, 0.68, 0.5, 26, 22, K.steelL, [[22, 24, K.steelD], [34, 35, K.steelD], [46, 48, K.steelD]])); // 籃子 f -0.3..0.38
    a.push(p(0.05, 0, 0.6, 0.42, 1, 48, K.steelD, null, false));             // 籃子內底 f -0.25..0.35
    for (const s of [-0.12, 0, 0.12]) a.push(p(0.385, s, 0.01, 0.02, 22, 24, K.steelD, null, false), p(-0.305, s, 0.01, 0.02, 22, 24, K.steelD, null, false)); // 前後格線
    for (const f of [-0.12, 0.04, 0.2]) a.push(p(f, 0.255, 0.02, 0.01, 22, 24, K.steelD, null, false), p(f, -0.255, 0.02, 0.01, 22, 24, K.steelD, null, false)); // 左右格線
    a.push(p(-0.28, -0.22, 0.04, 0.04, 10, 48, K.steelD, null, false), p(-0.28, 0.22, 0.04, 0.04, 10, 48, K.steelD, null, false)); // 推把柱
    a.push(p(-0.28, 0, 0.04, 0.52, 3, 58, K.red));                           // 推把
    a.push(p(0.1, -0.08, 0.06, 0.06, 12, 49, K.crust, null, false), p(0.1, -0.05, 0.06, 0.06, 8, 61, K.crustL, null, false)); // 法棍
    a.push(p(0.2, 0.1, 0.08, 0.08, 10, 49, K.mkGreen, [[52, 55, K.white]]), p(0.2, 0.1, 0.04, 0.04, 3, 59, K.red, null, false)); // 瓶子
    a.push(p(-0.06, 0.08, 0.16, 0.12, 6, 49, K.yellow, [[51, 53, K.red]]));  // 盒子
    return a;
  }, null, 'market');

  // 臥式冰櫃 2×1：白色櫃身＋藍色條紋＋雪花貼紙、側邊散熱孔、冰藍內框、中間滑門軌，裡面有冰淇淋、冰棒盒、冷凍豌豆、冷凍魚
  obj('freezer_chest', '臥式冰櫃', 2, 1, () => {
    const a = [
      p(0, 0, 0.86, 1.92, 30, 0, K.white, [[0, 4, K.steelD], [22, 26, K.blue]]), // 櫃身 f -0.43..0.43
      p(0.405, 0, 0.05, 1.92, 8, 30, K.frost), p(-0.405, 0, 0.05, 1.92, 8, 30, K.frost), // 前後框
      p(0, -0.935, 0.76, 0.05, 8, 30, K.frost), p(0, 0.935, 0.76, 0.05, 8, 30, K.frost), // 左右框
      p(0, 0, 0.76, 1.82, 1, 30, K.frostD, null, false),                       // 內底 z30..31
      p(0, 0, 0.76, 0.04, 7, 31, K.steel, null, false),                        // 中間滑門軌
    ];
    // 雪花貼紙（正面）
    const sf = -0.55;
    a.push(p(0.435, sf, 0.01, 0.16, 2, 12, K.blue, null, false), p(0.435, sf, 0.01, 0.03, 4, 14, K.blue, null, false), p(0.435, sf, 0.01, 0.03, 4, 8, K.blue, null, false));
    for (const [ds, z] of [[-0.05, 15], [0.05, 15], [-0.05, 9], [0.05, 9]]) a.push(p(0.435, sf + ds, 0.01, 0.03, 2, z, K.blue, null, false));
    for (const z of [6, 10, 14]) a.push(p(0, 0.965, 0.3, 0.01, 2, z, K.dark, null, false), p(0, -0.965, 0.3, 0.01, 2, z, K.dark, null, false)); // 散熱孔
    // 左半：冰淇淋桶 ×4（粉、薄荷、巧克力、香草）＋冰棒盒
    [[-0.2, -0.75, K.pink], [-0.2, -0.5, K.mint], [-0.2, -0.25, K.choco], [0.12, -0.75, K.cream]].forEach(([f, s, c]) =>
      a.push(p(f, s, 0.2, 0.2, 7, 31, K.white, [[31, 33, c]]), p(f, s, 0.18, 0.18, 2, 38, c, null, false)));
    a.push(p(0.15, -0.36, 0.26, 0.4, 5, 31, K.blue, [[34, 36, K.white]]), p(0.15, -0.36, 0.1, 0.2, 1, 36, K.yellow, null, false));
    // 右半：冷凍豌豆袋、冷凍魚盒、冰塊袋
    for (const [f, s] of [[-0.18, 0.25], [-0.18, 0.5]]) a.push(p(f, s, 0.22, 0.22, 6, 31, K.green, [[34, 36, K.white]]), p(f, s, 0.12, 0.12, 2, 37, [140, 210, 110], null, false));
    a.push(p(-0.18, 0.78, 0.24, 0.2, 5, 31, K.frost, [[31, 33, K.blue]]));
    a.push(p(0.17, 0.4, 0.2, 0.5, 4, 31, K.white, [[31, 33, K.blueD]]), p(0.17, 0.4, 0.1, 0.34, 2, 35, [150, 180, 200], null, false), p(0.17, 0.62, 0.08, 0.06, 2, 35, [150, 180, 200], null, false));
    a.push(p(0.16, 0.8, 0.18, 0.14, 7, 31, K.lilac, [[34, 36, K.white]]));
    return a;
  }, null, 'market');

  // ======================= 外送 =======================
  // 地上的包裹 1×1：小紙箱（高約 14）、膠帶、白色地址貼（只用灰色條）
  obj('parcel', '包裹', 1, 1, () => [
    p(0, 0, 0.4, 0.34, 12, 0, K.kraft, [[0, 2, K.kraftD]]),
    p(0, 0, 0.4, 0.08, 1, 12, K.tape, null, false),
    p(0.205, 0, 0.01, 0.08, 11, 1, K.tape, null, false),
    p(0.08, 0.11, 0.12, 0.08, 1, 12, K.white, null, false),
    p(0.205, -0.11, 0.01, 0.08, 5, 4, K.white, [[6, 7, K.steelD]], false),
  ], null, 'delivery');

  // 送貨地點地面標記 1×1：黃色圓圈＋橘紅中心點＋四個小三角箭頭（z≤2）
  obj('delivery_spot', '送貨地點', 1, 1, () => {
    const a = [], st = 0.05;
    const disc = (r0, r1, col) => {
      for (let fy = -0.45; fy < 0.45 - 1e-9; fy += st) {
        let run = null;
        const flush = () => { if (run) { a.push(p(fy + st / 2, (run[0] + run[1]) / 2, st, run[1] - run[0], 1, 0, col, null, false)); run = null; } };
        for (let sx = -0.45; sx < 0.45 - 1e-9; sx += st) {
          const r = Math.hypot(fy + st / 2, sx + st / 2), on = r >= r0 && r < r1;
          if (on) { if (run) run[1] = sx + st; else run = [sx, sx + st]; } else flush();
        }
        flush();
      }
    };
    disc(0.27, 0.38, K.yellow);
    disc(0, 0.12, K.red);
    // 四個指向中心的小箭頭（在黃圈和紅點之間）
    for (const [df, ds] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      a.push(p(df * 0.215, ds * 0.215, df ? 0.04 : 0.12, ds ? 0.04 : 0.12, 2, 0, K.orange, null, false));
      a.push(p(df * 0.175, ds * 0.175, df ? 0.04 : 0.06, ds ? 0.04 : 0.06, 2, 0, K.orange, null, false));
    }
    return a;
  }, null, 'delivery');

  // ---------- 牆紙、地板 ----------
  const WALLS = [
    { name: '奶油磚牆', a: [244, 226, 196], b: [228, 204, 168], dots: 2 },
    { name: '明亮白綠', a: [236, 246, 236], b: [206, 236, 212], stripe: 1 },
  ];
  const FLOORS = [
    { name: '紅磚地', a: [200, 120, 92], b: [184, 106, 80], check: 1 },
    { name: '白色大磁磚', a: [244, 246, 248], b: [210, 216, 224], tile: 1 },
  ];

  // ---------- 牆面裝飾 ----------
  const WALLDECO = {};
  function wdef(id, name, W, z0, z1, paint, set) {
    WALLDECO[id] = { id, name, cat: 'wall', set: set || 'bakery', price: 0, comfort: 0, W, D: 0, kind: 'wall', z0, z1, paint };
  }
  // 麵包圖案木牌：兩條吊繩、木牌、奶油色底、圓頂吐司（三道刀痕）
  wdef('bread_sign_wall', '麵包木牌', 1, 80, 126, (q, W) => {
    q(0.29, 0.32, 112, 126, K.dark, null); q(0.68, 0.71, 112, 126, K.dark, null);
    q(0.16, 0.84, 82, 114, K.woodL); q(0.12, 0.88, 86, 110, K.woodL, null);
    q(0.22, 0.78, 86, 110, K.cream, null);
    q(0.3, 0.7, 90, 100, K.crust); q(0.34, 0.66, 100, 103, K.crust, null); q(0.41, 0.59, 103, 105, K.crust, null);
    q(0.33, 0.67, 91, 93, K.crustD, null);
    for (const u of [0.39, 0.49, 0.59]) q(u, u + 0.04, 96, 102, K.crumb, null);
    q(0.2, 0.8, 80, 83, K.woodD);
  });
  // 牆上麥穗：五根麥桿、交錯的麥粒、紅色蝴蝶結
  wdef('wheat_deco', '麥穗裝飾', 1, 72, 130, (q, W) => {
    const stalks = [[0.32, 112], [0.41, 118], [0.5, 122], [0.59, 118], [0.68, 112]];
    for (const [u, top] of stalks) q(u, u + 0.025, 74, top - 12, [214, 176, 96], null);
    for (const [u, top] of stalks) for (let z = top - 12, k = 0; z < top; z += 3, k++) q(u - 0.035 + (k % 2) * 0.035, u + 0.025 + (k % 2) * 0.035, z, z + 3, k % 2 ? [236, 196, 110] : [222, 178, 92]);
    q(0.3, 0.72, 88, 93, K.red); q(0.24, 0.32, 85, 95, K.red); q(0.7, 0.78, 85, 95, K.red); q(0.46, 0.56, 80, 88, K.redD);
  });
  // 特價布條：兩條吊繩、紅布、黃星星、白色/黃色色塊（代替文字）、底下波浪邊
  wdef('sale_banner', '特價布條', 2, 92, 136, (q, W) => {
    q(0.16, 0.19, 124, 136, K.dark, null); q(W - 0.19, W - 0.16, 124, 136, K.dark, null);
    for (let u = 0.1; u < W - 0.15; u += 0.2) q(u, u + 0.1, 94, 100, K.red);
    q(0.1, W - 0.1, 98, 126, K.red);
    q(0.16, W - 0.16, 101, 123, [240, 110, 96], null);
    for (const u of [0.38, W - 0.38]) {
      q(u - 0.14, u + 0.14, 110, 114, K.yellow, null); q(u - 0.04, u + 0.04, 104, 120, K.yellow, null); q(u - 0.08, u + 0.08, 107, 117, K.yellow, null);
    }
    q(0.66, 1.34, 113, 119, K.white, null); q(0.76, 1.24, 105, 109, K.yellow, null);
  }, 'market');
  // 超市時鐘：綠色八角外框、白色鐘面、刻度、指針
  wdef('market_clock', '超市時鐘', 1, 94, 128, (q, W) => {
    q(0.31, 0.69, 94, 128, OUT, null); q(0.23, 0.77, 98, 124, OUT, null);
    q(0.33, 0.67, 95, 127, K.mkGreen, null); q(0.25, 0.75, 99, 123, K.mkGreen, null);
    q(0.36, 0.64, 99, 123, K.white, null); q(0.3, 0.7, 102, 120, K.white, null);
    q(0.49, 0.52, 119, 122, K.dark, null); q(0.49, 0.52, 100, 103, K.dark, null); q(0.31, 0.34, 110, 112, K.dark, null); q(0.66, 0.69, 110, 112, K.dark, null);
    q(0.49, 0.52, 110, 118, K.dark, null); q(0.5, 0.62, 109, 111, K.red, null);
  }, 'market');

  // ---------- 小遊戲 2D 圖示（32×32 正面圖） ----------
  // 用「遮罩」畫：test(u,v) 判斷像素在不在形狀裡，邊緣自動加深藍外框
  const E = (cx, cy, rx, ry) => (u, v) => ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1;
  const Rc = (x0, y0, x1, y1) => (u, v) => u >= x0 && u <= x1 && v >= y0 && v <= y1;
  const Pg = pts => (u, v) => {
    const x = u + 0.5, y = v + 0.5; let ins = false;
    for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
      const [xa, ya] = pts[a], [xb, yb] = pts[b];
      if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) ins = !ins;
    }
    return ins;
  };
  const Cap = (x0, y0, x1, y1, r) => (u, v) => {
    const dx = x1 - x0, dy = y1 - y0, t = Math.max(0, Math.min(1, ((u - x0) * dx + (v - y0) * dy) / (dx * dx + dy * dy)));
    return (u - x0 - t * dx) ** 2 + (v - y0 - t * dy) ** 2 <= r * r;
  };
  const Or = (...fs) => (u, v) => fs.some(f => f(u, v));
  const Not = (a, b) => (u, v) => a(u, v) && !b(u, v);
  function shape(pix, x, y, test, col, out) {
    out = out === undefined ? OUT : out;
    for (let v = 0; v < 32; v++) for (let u = 0; u < 32; u++) {
      if (!test(u, v)) continue;
      const edge = !test(u - 1, v) || !test(u + 1, v) || !test(u, v - 1) || !test(u, v + 1);
      pix.px(x + u, y + v, edge && out ? out : col);
    }
  }
  const dots = (pix, x, y, pts, c) => { for (const [u, v] of pts) pix.px(x + u, y + v, c); };
  const ln = (pix, x, y, u0, v0, u1, v1, c) => pix.line(x + u0, y + v0, x + u1, y + v1, c);
  function star(cx, cy, r1, r2) {
    const pts = [];
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? r2 : r1; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return Pg(pts);
  }
  // 籃子（正面）：彩色藤編＋橫紋
  function basketIcon(pix, x, y, col) {
    shape(pix, x, y, Pg([[3, 15], [29, 15], [26, 30], [6, 30]]), col);
    for (const v of [19, 23, 27]) ln(pix, x, y, 5, v, 26, v, shade(col, 0.75));
    for (let u = 7; u < 26; u += 4) for (const v of [17, 21, 25]) { pix.px(x + u + ((v >> 2) % 2) * 2, y + v, shade(col, 1.2)); }
    shape(pix, x, y, Rc(2, 13, 29, 16), shade(col, 0.82));
    ln(pix, x, y, 3, 14, 28, 14, shade(col, 1.15));
  }
  function coin(pix, x, y, r, col, pat) {
    shape(pix, x, y, E(16, 16, r, r), shade(col, 0.82));
    shape(pix, x, y, E(16, 16, r - 2, r - 2), col, shade(col, 0.65));
    shape(pix, x, y, E(14, 13, Math.max(1, r / 3), Math.max(1, r / 5)), shade(col, 1.18), null);
    if (pat === 'dot') shape(pix, x, y, E(16, 16, 1.5, 1.5), shade(col, 0.7), null);
    if (pat === 'ring') for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; pix.px(x + Math.round(16 + Math.cos(a) * (r - 4)), y + Math.round(16 + Math.sin(a) * (r - 4)), shade(col, 0.66)); }
    if (pat === 'star') shape(pix, x, y, star(16, 16.5, r * 0.5, r * 0.22), shade(col, 0.72), null);
  }
  function badge(pix, x, y, col) {
    shape(pix, x, y, E(16, 16, 14, 14), col);
    shape(pix, x, y, E(16, 16, 12, 12), shade(col, 1.12), null);
  }
  const loafIcon = (pix, x, y, ox, oy, c) => {          // 小吐司剖面（給籃子用）
    shape(pix, x, y, Or(E(ox + 4, oy + 3, 4, 3), E(ox + 10, oy + 3, 4, 3), Rc(ox, oy + 3, ox + 14, oy + 12)), c || [196, 124, 62]);
    shape(pix, x, y, Or(E(ox + 4, oy + 4, 2, 1.5), E(ox + 10, oy + 4, 2, 1.5), Rc(ox + 2, oy + 4, ox + 12, oy + 11)), K.crumb, null);
  };

  const ICONS = {
    // ---- 麵包分類 ----
    bread_loaf(pix, x, y) {                                // 吐司片
      shape(pix, x, y, Or(E(11, 11, 6, 5), E(20, 11, 6, 5), Rc(6, 11, 25, 28)), K.crust);
      shape(pix, x, y, Or(E(11, 12, 4, 3), E(20, 12, 4, 3), Rc(8, 12, 23, 26)), K.crumb, null);
      dots(pix, x, y, [[11, 16], [17, 19], [14, 23], [20, 14], [21, 22], [10, 21]], [228, 196, 140]);
      ln(pix, x, y, 9, 10, 12, 9, [255, 240, 200]);
    },
    baguette(pix, x, y) {                                  // 法棍（斜放、刀痕）
      shape(pix, x, y, Cap(6, 26, 26, 6, 4.5), K.crust);
      shape(pix, x, y, Cap(7, 23, 23, 7, 1.2), K.crustL, null);
      for (const t of [0.25, 0.5, 0.75]) { const cx = 6 + 20 * t, cy = 26 - 20 * t; ln(pix, x, y, Math.round(cx - 3), Math.round(cy + 1), Math.round(cx + 1), Math.round(cy - 3), K.crumb); }
    },
    croissant2(pix, x, y) {                                // 可頌
      shape(pix, x, y, Or(E(16, 17, 6, 6), E(9, 19, 4.5, 4.5), E(23, 19, 4.5, 4.5), E(4.5, 23, 2.5, 2.5), E(27.5, 23, 2.5, 2.5)), K.golden);
      ln(pix, x, y, 12, 13, 12, 22, K.crustD); ln(pix, x, y, 20, 13, 20, 22, K.crustD); ln(pix, x, y, 6, 17, 7, 23, K.crustD); ln(pix, x, y, 26, 17, 25, 23, K.crustD);
      ln(pix, x, y, 14, 13, 18, 13, [250, 214, 150]); dots(pix, x, y, [[9, 16], [23, 16]], [250, 214, 150]);
    },
    bun(pix, x, y) {                                       // 圓麵包（芝麻）
      shape(pix, x, y, E(16, 19, 12, 8), [214, 140, 70]);
      shape(pix, x, y, E(13, 15, 6, 2.5), [236, 172, 100], null);
      for (const [u, v] of [[11, 17], [16, 14], [20, 17], [14, 20], [22, 21], [9, 21]]) { pix.px(x + u, y + v, K.cream); pix.px(x + u + 1, y + v, K.cream); }
    },
    muffin(pix, x, y) {                                    // 瑪芬（條紋紙杯＋巧克力豆）
      shape(pix, x, y, Pg([[7, 17], [26, 17], [23, 30], [10, 30]]), K.pink);
      for (const u of [11, 15, 19, 23]) ln(pix, x, y, u, 18, u - (u - 16) * 0.2, 29, shade(K.pink, 0.8));
      shape(pix, x, y, Or(E(16, 13, 10, 7), E(16, 17, 12, 2.5)), K.crustL);
      shape(pix, x, y, E(13, 10, 4, 2), [240, 190, 120], null);
      dots(pix, x, y, [[11, 14], [17, 11], [21, 15], [15, 16], [19, 8], [8, 16]], K.choco);
    },
    pretzel(pix, x, y) {                                   // 扭結麵包（三個洞）＋鹽粒
      shape(pix, x, y, Not(E(16, 17, 13.5, 11.5), Or(E(10.5, 14, 3.4, 3.8), E(21.5, 14, 3.4, 3.8), E(16, 24, 4.2, 2.4))), [176, 100, 50]);
      dots(pix, x, y, [[7, 10], [16, 8], [25, 11], [6, 20], [26, 20], [12, 22], [20, 22], [16, 17]], K.white);
      dots(pix, x, y, [[9, 8], [22, 8]], [214, 140, 80]);
    },
    basket_loaf(pix, x, y) { loafIcon(pix, x, y, 9, 2); basketIcon(pix, x, y, [96, 150, 220]); },        // 藍籃＝方形麵包
    basket_long(pix, x, y) {                                                                            // 綠籃＝長條麵包
      shape(pix, x, y, Cap(10, 16, 14, 2, 2.5), K.crust); shape(pix, x, y, Cap(17, 16, 22, 3, 2.5), K.crustL);
      basketIcon(pix, x, y, [96, 176, 110]);
    },
    basket_round(pix, x, y) {                                                                           // 橘籃＝圓形麵包
      shape(pix, x, y, E(11, 11, 5, 4.5), [214, 140, 70]); shape(pix, x, y, E(21, 11, 5, 4.5), K.crust); shape(pix, x, y, E(16, 8, 4, 3.5), K.golden);
      basketIcon(pix, x, y, [236, 136, 70]);
    },
    box_gift(pix, x, y) {                                  // 包裝好的禮盒
      shape(pix, x, y, Rc(6, 14, 26, 29), K.pinkL);
      shape(pix, x, y, Rc(4, 10, 28, 15), K.pink);
      shape(pix, x, y, Rc(14, 10, 18, 29), K.red, null); ln(pix, x, y, 14, 10, 14, 29, OUT); ln(pix, x, y, 18, 10, 18, 29, OUT);
      shape(pix, x, y, Not(E(11, 7, 5, 3.5), E(11, 7, 2, 1.2)), K.red); shape(pix, x, y, Not(E(21, 7, 5, 3.5), E(21, 7, 2, 1.2)), K.red);
      shape(pix, x, y, Rc(14, 5, 18, 10), K.redD);
      ln(pix, x, y, 7, 16, 7, 27, [255, 236, 242]);
    },
    // ---- 超市收銀 ----
    item_apple(pix, x, y) {
      shape(pix, x, y, Or(E(11, 19, 8, 9), E(21, 19, 8, 9)), K.red);
      shape(pix, x, y, E(10, 15, 2.5, 3.5), [246, 140, 130], null);
      ln(pix, x, y, 16, 5, 16, 11, K.choco); ln(pix, x, y, 17, 5, 17, 10, K.choco);
      shape(pix, x, y, E(21, 7, 4, 2.2), K.leaf);
    },
    item_milk(pix, x, y) {                                 // 屋頂形牛奶盒
      shape(pix, x, y, Pg([[20, 13], [26, 10], [26, 27], [20, 30]]), [206, 212, 226]);
      shape(pix, x, y, Pg([[14, 5], [20, 2], [26, 10], [20, 13]]), [216, 222, 234]);
      shape(pix, x, y, Rc(7, 13, 20, 30), K.white);
      shape(pix, x, y, Pg([[7, 13.5], [13.5, 5], [20.5, 13.5]]), K.white);
      shape(pix, x, y, Rc(8, 19, 19, 25), K.blue, null);
      shape(pix, x, y, E(13.5, 22, 2, 2), K.white, null);
      shape(pix, x, y, Rc(21, 19, 25, 25), shade(K.blue, 0.8), null);
    },
    item_bread(pix, x, y) {                                // 袋裝吐司（藍色束口）
      shape(pix, x, y, Or(Rc(4, 11, 23, 29), E(13.5, 11, 9.5, 5)), [222, 238, 248]);
      shape(pix, x, y, Or(Rc(6, 12, 21, 27), E(13.5, 12, 7.5, 4)), K.crust, null);
      shape(pix, x, y, Or(Rc(8, 14, 19, 26), E(13.5, 13, 5.5, 2.5)), K.crumb, null);
      shape(pix, x, y, Pg([[23, 16], [28, 13], [29, 21], [23, 23]]), [222, 238, 248]);
      shape(pix, x, y, Rc(22, 16, 25, 22), K.blue);
      ln(pix, x, y, 6, 11, 6, 15, K.white);
    },
    item_juice(pix, x, y) {                                // 鋁箔包果汁＋吸管
      shape(pix, x, y, Rc(18, 0, 20, 8), K.straw);
      shape(pix, x, y, Pg([[22, 9], [26, 7], [26, 27], [22, 30]]), shade(K.orange, 0.8));
      shape(pix, x, y, Pg([[8, 9], [12, 6], [26, 6], [22, 9]]), shade(K.orange, 1.15));
      shape(pix, x, y, Rc(8, 9, 22, 30), K.orange);
      shape(pix, x, y, E(15, 20, 5, 5), K.yellow);
      for (const [u, v] of [[15, 16], [15, 24], [11, 20], [19, 20]]) ln(pix, x, y, 15, 20, u, v, [250, 170, 60]);
      ln(pix, x, y, 10, 11, 10, 15, [255, 200, 140]);
    },
    item_eggs(pix, x, y) {                                 // 蛋盒
      for (const cx of [9, 16, 23]) { shape(pix, x, y, E(cx, 16, 4, 5), [252, 244, 228]); pix.px(x + cx - 1, y + 14, K.white); pix.px(x + cx - 2, y + 15, K.white); }
      shape(pix, x, y, Pg([[2, 19], [30, 19], [27, 29], [5, 29]]), [200, 188, 168]);
      for (const u of [12, 19]) ln(pix, x, y, u, 20, u, 28, shade([200, 188, 168], 0.8));
      ln(pix, x, y, 4, 21, 28, 21, shade([200, 188, 168], 1.12));
    },
    item_cheese(pix, x, y) {                               // 起司（有洞的楔形）
      shape(pix, x, y, Pg([[3, 16], [21, 6], [29, 10], [29, 16]]), [252, 230, 130]);
      shape(pix, x, y, Rc(3, 16, 29, 27), K.cheese);
      for (const [cx, cy, r] of [[9, 21, 2.2], [18, 23, 2], [24, 19, 1.5], [14, 19, 1.2]]) shape(pix, x, y, E(cx, cy, r, r), [222, 170, 60], null);
      shape(pix, x, y, E(21, 11, 2, 1), [232, 190, 80], null);
    },
    item_fish(pix, x, y) {                                 // 魚
      shape(pix, x, y, Pg([[22, 16], [30, 9], [29, 16], [30, 23]]), [110, 150, 200]);
      shape(pix, x, y, E(14, 16, 11, 6.5), [140, 180, 220]);
      shape(pix, x, y, E(14, 19, 8, 2.5), [214, 230, 244], null);
      shape(pix, x, y, Pg([[11, 10], [17, 6], [18, 11]]), [110, 150, 200]);
      ln(pix, x, y, 9, 12, 9, 20, shade([140, 180, 220], 0.72));
      pix.rect(x + 5, y + 14, x + 6, y + 15, OUT); pix.px(x + 5, y + 14, K.white);
    },
    item_cereal(pix, x, y) {                               // 麥片盒（碗的圖案）
      shape(pix, x, y, Pg([[22, 4], [26, 2], [26, 27], [22, 30]]), shade(K.red, 0.78));
      shape(pix, x, y, Pg([[7, 4], [11, 2], [26, 2], [22, 4]]), shade(K.red, 1.15));
      shape(pix, x, y, Rc(7, 4, 22, 30), K.red);
      shape(pix, x, y, Rc(9, 7, 20, 10), K.yellow, null);
      shape(pix, x, y, Rc(9, 12, 16, 13), K.white, null);
      shape(pix, x, y, Pg([[8, 20], [21, 20], [18, 27], [11, 27]]), K.white);
      dots(pix, x, y, [[10, 18], [12, 17], [14, 18], [16, 17], [18, 18], [13, 19], [17, 19]], K.golden);
      ln(pix, x, y, 9, 23, 20, 23, K.blue);
    },
    coin_1(pix, x, y) { coin(pix, x, y, 7, [214, 130, 80], 'dot'); },      // 小銅幣
    coin_5(pix, x, y) { coin(pix, x, y, 9, [206, 212, 224], 'ring'); },    // 銀幣（點點圈）
    coin_10(pix, x, y) { coin(pix, x, y, 11, [236, 190, 80], 'star'); },   // 金幣（小星星）
    coin_50(pix, x, y) {                                                    // 大雙色幣：銀外圈＋金心＋大星
      shape(pix, x, y, E(16, 16, 14, 14), [190, 198, 212]);
      shape(pix, x, y, E(16, 16, 12, 12), [214, 220, 232], [150, 158, 176]);
      shape(pix, x, y, E(16, 16, 8.5, 8.5), [240, 196, 80], [190, 140, 50]);
      shape(pix, x, y, star(16, 16.5, 6.5, 2.8), [255, 236, 150], null);
      shape(pix, x, y, E(10, 8, 3, 1.5), [240, 244, 250], null);
    },
    bill_100(pix, x, y) {                                  // 紙鈔（綠色、中間圓形徽章、四角方塊）
      shape(pix, x, y, Rc(1, 7, 30, 25), [130, 196, 140]);
      shape(pix, x, y, Rc(3, 9, 28, 23), [168, 220, 170], [96, 160, 110]);
      shape(pix, x, y, E(16, 16, 5, 5), [96, 160, 110]);
      shape(pix, x, y, star(16, 16.5, 3.5, 1.5), [220, 244, 210], null);
      for (const [u, v] of [[5, 11], [24, 11], [5, 19], [24, 19]]) shape(pix, x, y, Rc(u, v, u + 2, v + 2), [96, 160, 110], null);
      ln(pix, x, y, 8, 12, 10, 12, [120, 180, 126]); ln(pix, x, y, 21, 20, 23, 20, [120, 180, 126]);
      ln(pix, x, y, 5, 15, 9, 15, [120, 180, 126]); ln(pix, x, y, 22, 15, 26, 15, [120, 180, 126]);
    },
    scanner(pix, x, y) {                                   // 條碼掃描槍
      shape(pix, x, y, Pg([[13, 15], [21, 15], [19, 30], [11, 30]]), [70, 76, 96]);
      shape(pix, x, y, Pg([[3, 6], [24, 6], [28, 10], [28, 15], [3, 15]]), [90, 96, 118]);
      shape(pix, x, y, Rc(4, 7, 22, 8), [130, 138, 160], null);
      shape(pix, x, y, Rc(5, 11, 18, 12), K.yellow, null);
      shape(pix, x, y, Rc(26, 9, 27, 13), K.red, null);
      shape(pix, x, y, Rc(15, 16, 17, 20), K.yellow);
      ln(pix, x, y, 29, 11, 31, 11, K.red);
    },
    // ---- 其他 ----
    parcel_icon(pix, x, y) {                               // 包裹紙箱
      shape(pix, x, y, Pg([[22, 13], [29, 8], [29, 24], [22, 29]]), K.kraftD);
      shape(pix, x, y, Pg([[4, 13], [11, 8], [29, 8], [22, 13]]), shade(K.kraft, 1.12));
      shape(pix, x, y, Rc(4, 13, 22, 29), K.kraft);
      shape(pix, x, y, Pg([[11, 13], [17, 8], [21, 8], [15, 13]]), K.tape, null);
      shape(pix, x, y, Rc(11, 13, 15, 29), K.tape, null);
      shape(pix, x, y, Rc(16, 21, 21, 26), K.white);
      ln(pix, x, y, 17, 23, 19, 23, K.steelD); ln(pix, x, y, 17, 24, 20, 24, K.steelD);
    },
    job_bakery(pix, x, y) {                                // 麵包店工作：橘色徽章＋廚師帽
      badge(pix, x, y, [240, 160, 80]);
      shape(pix, x, y, Or(E(11, 12, 4.5, 4), E(16, 10, 5, 5), E(21, 12, 4.5, 4), Rc(11, 12, 21, 19)), K.white);
      shape(pix, x, y, Rc(10, 19, 22, 23), [236, 236, 244]);
      ln(pix, x, y, 14, 15, 14, 18, [210, 214, 226]); ln(pix, x, y, 18, 15, 18, 18, [210, 214, 226]);
    },
    job_market(pix, x, y) {                                // 超市工作：綠色徽章＋購物籃
      badge(pix, x, y, [96, 184, 128]);
      shape(pix, x, y, Not(E(16, 15, 7, 7), Or(E(16, 15, 5, 5), Rc(0, 15, 31, 31))), K.dark);
      shape(pix, x, y, Pg([[7, 15], [25, 15], [23, 24], [9, 24]]), K.red);
      for (const u of [12, 16, 20]) ln(pix, x, y, u, 17, u, 22, K.redD);
      ln(pix, x, y, 8, 16, 24, 16, K.white);
    },
    job_delivery(pix, x, y) {                              // 外送工作：藍色徽章＋紙箱＋速度線
      badge(pix, x, y, [110, 160, 230]);
      shape(pix, x, y, Pg([[18, 13], [23, 10], [23, 20], [18, 23]]), K.kraftD);
      shape(pix, x, y, Pg([[10, 13], [15, 10], [23, 10], [18, 13]]), shade(K.kraft, 1.12));
      shape(pix, x, y, Rc(10, 13, 18, 23), K.kraft);
      shape(pix, x, y, Rc(13, 13, 15, 23), K.tape, null);
      for (const [v, u0] of [[14, 5], [18, 4], [22, 6]]) ln(pix, x, y, u0, v, u0 + 3, v, K.white);
    },
  };

  G.ART = G.ART || {};
  G.ART.shops = { OBJS, WALLS, FLOORS, WALLDECO, ICONS, COLORS: K };
})(typeof window !== 'undefined' ? window : globalThis);
