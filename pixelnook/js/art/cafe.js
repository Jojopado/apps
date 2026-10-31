// PixelNook 咖啡廳美術：室內家具（等角零件）、壁紙、地板、牆面裝飾、小遊戲 2D 圖示。
// 規則跟 models.js 一樣：同一物件的零件彼此不重疊；細節用凸出的薄方塊或 bands。
(function (G) {
  'use strict';
  const { shade, OUT } = G.PX;
  const p = (f, s, wf, ws, h, z, c, b, hi) => ({ f, s, wf, ws, h, z, c, b, hi: hi !== false });

  // 咖啡廳色盤
  const K = {
    walnut: [124, 82, 56], walnutD: [96, 62, 44], wood: [176, 120, 78], woodL: [214, 166, 112], woodLL: [232, 194, 142],
    marble: [240, 234, 224], cream: [250, 240, 220], white: [246, 246, 250], dark: [52, 56, 70], steel: [196, 202, 214],
    steelD: [140, 148, 164], red: [214, 84, 74], sage: [150, 188, 140], sageD: [112, 156, 108], terra: [200, 116, 80],
    coffee: [110, 68, 44], latte: [212, 168, 120], bean: [96, 58, 40], glass: [196, 234, 244], chalk: [56, 78, 70],
    pink: [244, 168, 190], mint: [168, 222, 200], yellow: [250, 210, 100], blue: [126, 184, 232], lilac: [200, 182, 232],
    choco: [120, 76, 52], straw: [230, 80, 90], gold: [232, 176, 90], leaf: [96, 168, 92], green: [120, 186, 104],
  };

  // ---------- 等角物件 ----------
  // 櫃台身體（共用給 cafe_counter 與 register）：深色木身＋正面直條木板＋大理石檯面
  function counterBody(w) {
    const a = [
      p(-0.06, 0, 0.78, w - 0.04, 40, 0, K.walnutD, [[0, 4, K.dark]]),   // 身體 f -0.45..0.33
      p(-0.08, 0, 0.82, w, 5, 40, K.marble, [[40, 42, K.walnut]]),      // 檯面 f -0.49..0.33（只蓋在身體上）
      p(0.36, 0, 0.06, w, 5, 40, K.marble, [[40, 42, K.walnut]]),       // 檯面前緣 f 0.33..0.39（蓋在直條上，上面不放東西）
    ];
    // 正面直條木板放在檯面「旁邊」而不是底下 → 檯面上的東西跟直條之間不會有前後循環
    const n = Math.round(w * 4), sw = (w - 0.12) / n;
    for (let k = 0; k < n; k++) {
      const s = -(w - 0.12) / 2 + sw * (k + 0.5);
      a.push(p(0.345, s, 0.03, sw - 0.03, 36, 4, k % 2 ? K.wood : K.woodL, null, false));
    }
    return a;
  }

  const OBJS = {};
  function obj(id, name, W, D, model, extra) {
    OBJS[id] = Object.assign({ id, name, cat: 'cafe', set: 'cafe', price: 0, comfort: 0, W, D, kind: 'floor', model }, extra || {});
  }

  // 櫃台 3×1：正面木頭直條面板、大理石檯面、外帶杯、糖罐、小花瓶
  obj('cafe_counter', '咖啡廳櫃台', 3, 1, () => counterBody(3).concat([
    p(0.12, -1.05, 0.12, 0.12, 12, 45, K.white, [[48, 52, K.coffee]]),        // 外帶杯（咖啡色杯套）
    p(0.12, -0.88, 0.12, 0.12, 12, 45, K.white, [[48, 52, K.terra]]),
    p(0.12, -0.88, 0.1, 0.1, 2, 57, K.walnut, null, false),                  // 杯蓋
    p(0.12, -1.05, 0.1, 0.1, 2, 57, K.walnut, null, false),
    p(0.05, 0.1, 0.16, 0.16, 10, 45, K.glass, [[45, 51, K.white]]),          // 糖罐
    p(0.05, 0.1, 0.12, 0.12, 2, 55, K.steel, null, false),
    p(0.0, 1.0, 0.1, 0.1, 9, 45, K.blue),                                    // 小花瓶
    p(0.0, 1.0, 0.02, 0.02, 6, 54, K.leaf, null, false),
    p(0.0, 1.0, 0.1, 0.1, 4, 60, K.pink, null, false),
  ]));

  // 收銀台 1×1：櫃台的一段＋收銀機（按鍵、錢櫃、朝客人的小螢幕）
  obj('register', '收銀台', 1, 1, () => counterBody(1).concat([
    p(0.0, -0.04, 0.5, 0.62, 10, 45, [96, 100, 118], [[45, 48, [70, 74, 90]]]), // 收銀機身 f -0.25..0.25
    p(-0.07, -0.12, 0.3, 0.32, 2, 55, [206, 210, 222], null, false),          // 鍵盤
    p(-0.14, -0.22, 0.06, 0.06, 1, 57, K.red, null, false),
    p(-0.14, -0.12, 0.06, 0.06, 1, 57, K.yellow, null, false),
    p(-0.14, -0.02, 0.06, 0.06, 1, 57, K.mint, null, false),
    p(0.0, -0.22, 0.06, 0.06, 1, 57, K.white, null, false),
    p(0.0, -0.12, 0.06, 0.06, 1, 57, K.white, null, false),
    p(0.0, -0.02, 0.06, 0.06, 1, 57, K.white, null, false),
    p(0.255, -0.04, 0.01, 0.4, 4, 47, K.steelD, null, false),                // 錢櫃把手
    p(0.15, 0.17, 0.06, 0.06, 9, 55, K.dark, null, false),                   // 小螢幕支柱
    p(0.15, 0.17, 0.08, 0.24, 10, 64, K.dark),                               // 小螢幕
    p(0.195, 0.17, 0.01, 0.18, 6, 66, [130, 220, 200], null, false),         // 螢幕面（朝客人）
    p(-0.3, 0.36, 0.12, 0.12, 4, 45, K.gold, null, false),                   // 服務鈴座
    p(-0.3, 0.36, 0.06, 0.06, 3, 49, K.gold, null, false),
  ]));

  // 咖啡機工作台 1×1：木櫃＋紅色義式咖啡機（壓力錶、沖煮頭、把手、滴盤、杯子、頂部溫杯）
  obj('espresso_machine', '義式咖啡機', 1, 1, () => [
    p(-0.02, 0, 0.86, 0.96, 40, 0, K.walnutD, [[0, 4, K.dark]]),             // 木櫃 f -0.45..0.41
    p(0.42, -0.23, 0.02, 0.42, 30, 6, K.wood, null, false),                  // 櫃門
    p(0.42, 0.23, 0.02, 0.42, 30, 6, K.wood, null, false),
    p(0.435, -0.06, 0.01, 0.04, 8, 22, K.gold, null, false),                 // 門把
    p(0.435, 0.06, 0.01, 0.04, 8, 22, K.gold, null, false),
    p(-0.02, 0, 0.86, 1.0, 4, 40, K.marble, [[40, 42, K.walnut]]),           // 檯面 z40..44（只蓋在木櫃上）
    p(0.44, 0, 0.06, 1.0, 4, 40, K.marble, [[40, 42, K.walnut]]),            // 檯面前緣（蓋在櫃門上）
    p(-0.12, 0, 0.5, 0.74, 30, 44, K.red, [[44, 50, K.steel], [70, 74, K.steel]]), // 機身 f -0.37..0.13
    p(0.15, -0.2, 0.02, 0.14, 8, 62, K.white, null, false),                  // 壓力錶 f 0.14..0.16（跟滴盤俯視重疊）
    p(0.15, 0.2, 0.02, 0.14, 8, 62, K.white, null, false),
    p(0.18, 0, 0.1, 0.18, 6, 56, K.steel),                                   // 沖煮頭 f 0.13..0.23
    p(0.29, 0.03, 0.12, 0.06, 3, 54, K.dark, null, false),                   // 把手 f 0.23..0.35
    p(0.24, 0, 0.18, 0.5, 3, 44, K.steelD, null, false),                     // 滴盤 f 0.15..0.33
    p(0.22, -0.02, 0.1, 0.1, 6, 47, K.white, [[51, 53, K.coffee]]),          // 杯子
    p(0.14, 0.4, 0.06, 0.04, 10, 48, K.steel, null, false),                 // 蒸汽管
    p(-0.22, -0.18, 0.14, 0.14, 7, 74, K.white),                             // 溫杯區的杯子
    p(-0.02, -0.18, 0.14, 0.14, 7, 74, K.mint),
    p(-0.12, 0.2, 0.14, 0.14, 7, 74, K.white),
    p(0.32, -0.38, 0.18, 0.18, 7, 44, K.bean, [[49, 51, K.cream]]),          // 咖啡豆罐
  ]);

  // 咖啡桌 1×1：單腳底座＋方形大理石桌面＋一杯拿鐵和小花
  // （桌面上的東西都要跟桌腳的俯視範圍重疊，否則「桌腳→桌面→杯子→桌腳」會形成前後循環）
  obj('cafe_table', '咖啡桌', 1, 1, () => [
    p(0, 0, 0.44, 0.44, 3, 0, K.dark),
    p(0, 0, 0.2, 0.2, 24, 3, K.dark, [[3, 6, shade(K.dark, 1.3)]]),
    p(0, 0, 0.8, 0.8, 4, 27, K.marble, [[27, 29, K.walnut]]),
    p(0.04, 0.03, 0.16, 0.16, 1, 31, K.white, null, false),                  // 盤子
    p(0.04, 0.03, 0.1, 0.11, 7, 32, K.terra, [[37, 39, K.latte]]),           // 拿鐵（陶色杯）
    p(0.04, 0.105, 0.04, 0.04, 4, 33, K.terra, null, false),                // 杯耳（朝右）
    p(-0.09, -0.09, 0.08, 0.08, 8, 31, K.blue),                              // 花瓶（在後面）
    p(-0.09, -0.09, 0.02, 0.02, 5, 39, K.leaf, null, false),
    p(-0.09, -0.09, 0.08, 0.08, 3, 44, K.yellow, null, false),
  ]);

  // 咖啡椅 1×1：細木腳、鼠尾草綠坐墊、直條椅背；後腳一路延伸成椅背柱（可以坐，座面 z=20）
  obj('cafe_chair', '咖啡椅', 1, 1, () => [
    p(0.25, -0.25, 0.06, 0.06, 15, 0, K.walnut, null, false),                // 前腳
    p(0.25, 0.25, 0.06, 0.06, 15, 0, K.walnut, null, false),
    p(0.04, 0, 0.58, 0.62, 5, 15, K.walnut, [[17, 20, K.sage]]),            // 座板＋坐墊（色帶）f -0.25..0.33
    p(-0.28, -0.25, 0.06, 0.06, 42, 0, K.walnut, null, false),               // 後腳＋椅背柱 f -0.31..-0.25
    p(-0.28, 0.25, 0.06, 0.06, 42, 0, K.walnut, null, false),
    p(-0.28, 0, 0.06, 0.44, 4, 20, K.walnut, null, false),                   // 下橫條
    p(-0.28, 0, 0.06, 0.08, 18, 24, K.walnut, null, false),                  // 中間直條
    p(-0.28, 0, 0.06, 0.56, 6, 42, K.walnut),                                // 椅背頂
  ], { seat: { z: 20, spots: [[0.05, 0]] } });

  // 玻璃甜點櫃 2×1：木頭底櫃＋階梯展示台＋玻璃邊框（用淡藍色邊框表示玻璃，中間開放看得到甜點）
  obj('pastry_case', '玻璃甜點櫃', 2, 1, () => {
    const a = [
      p(-0.02, 0, 0.9, 1.88, 32, 0, K.walnutD, [[0, 4, K.dark]]),            // 底櫃 f -0.47..0.43
      p(0.445, 0, 0.03, 1.92, 24, 5, K.woodL, [[15, 18, K.gold]], false),     // 正面板（金色飾條）
      p(-0.02, 0, 0.9, 1.92, 3, 32, K.white),                                 // 展示台面 f -0.47..0.43
      p(0.455, 0, 0.05, 1.92, 3, 32, K.white),                                // 台面前緣 f 0.43..0.48
      p(-0.24, 0, 0.4, 1.84, 14, 35, K.cream, [[35, 37, K.white]]),          // 後段階梯 f -0.44..-0.04
      p(0.4425, 0, 0.025, 1.84, 5, 35, K.glass, null, false),                // 前面低玻璃 f 0.43..0.455（只站在前緣上）
    ];
    for (const f of [-0.46, 0.46]) for (const s of [-0.98, 0.98]) a.push(p(f, s, 0.04, 0.04, 66, 0, K.steel, null, false)); // 角柱（從地上直通到頂，不站在任何零件上）
    a.push(p(0, -0.98, 0.96, 0.04, 3, 66, K.glass), p(0, 0.98, 0.96, 0.04, 3, 66, K.glass));          // 左右玻璃上框（壓在角柱上）
    a.push(p(0.46, 0, 0.04, 1.92, 3, 66, K.glass), p(-0.46, 0, 0.04, 1.92, 3, 66, K.glass));        // 前後玻璃上框（夾在左右框之間）
    // 前排（低）：草莓蛋糕、巧克力蛋糕、可頌
    a.push(p(0.2, -0.62, 0.32, 0.32, 12, 35, [244, 220, 170], [[39, 41, K.white], [44, 47, K.white]]));
    a.push(p(0.2, -0.62, 0.08, 0.08, 4, 47, K.straw, null, false));
    a.push(p(0.2, -0.16, 0.32, 0.32, 12, 35, K.choco, [[39, 41, K.cream], [45, 47, [90, 56, 40]]]));
    a.push(p(0.2, -0.16, 0.06, 0.06, 3, 47, K.straw, null, false));
    a.push(p(0.13, 0.32, 0.12, 0.24, 6, 35, K.gold), p(0.29, 0.32, 0.12, 0.24, 6, 35, K.gold));
    a.push(p(0.13, 0.7, 0.12, 0.24, 6, 35, K.gold), p(0.29, 0.7, 0.12, 0.24, 6, 35, K.gold));
    // 後排（高）：甜甜圈、馬卡龍
    const dn = [K.pink, K.choco, K.yellow];
    dn.forEach((c, k) => a.push(p(-0.24, -0.7 + k * 0.26, 0.2, 0.2, 5, 49, K.woodLL, [[52, 54, c]])));
    const mc = [K.mint, K.pink, K.lilac, K.yellow, K.blue];
    mc.forEach((c, k) => a.push(p(-0.24, 0.14 + k * 0.16, 0.12, 0.12, 6, 49, c, [[51, 52, K.cream]], false)));
    return a;
  });

  // 立式菜單板 1×1：木框黑板（用色塊代表菜單行）＋咖啡杯圖案
  obj('menu_stand', '立式菜單板', 1, 1, () => {
    const a = [
      p(0, -0.35, 0.3, 0.06, 3, 0, K.walnutD, null, false), p(0, 0.35, 0.3, 0.06, 3, 0, K.walnutD, null, false), // 腳
      p(0, -0.35, 0.06, 0.06, 70, 3, K.walnut, null, false), p(0, 0.35, 0.06, 0.06, 70, 3, K.walnut, null, false), // 立柱
      p(0, 0, 0.04, 0.64, 46, 22, K.wood),                                   // 板子 f -0.02..0.02
      p(0.03, 0, 0.02, 0.56, 40, 25, K.chalk, null, false),                  // 正面黑板 f 0.02..0.04
      p(-0.03, 0, 0.02, 0.56, 40, 25, K.chalk, null, false),                 // 背面黑板
      p(0, 0, 0.04, 0.24, 7, 68, K.cream),                                   // 頂上小牌
      p(0.025, 0, 0.01, 0.1, 3, 70, K.terra, null, false),
    ];
    // 正面：標題列＋三行菜單（每行：一段字＋一個價格點）＋杯子圖案
    a.push(p(0.045, -0.04, 0.01, 0.36, 3, 58, K.pink, null, false));
    for (const [z, len] of [[51, 0.28], [45, 0.2], [39, 0.24]]) {
      a.push(p(0.045, -0.22 + len / 2, 0.01, len, 2, z, K.cream, null, false));
      a.push(p(0.045, 0.19, 0.01, 0.06, 2, z, K.yellow, null, false));
    }
    a.push(p(0.045, -0.1, 0.01, 0.14, 7, 28, K.white, null, false));        // 杯子
    a.push(p(0.045, -0.015, 0.01, 0.03, 4, 30, K.white, null, false));      // 杯耳
    a.push(p(0.045, -0.1, 0.01, 0.03, 3, 36, K.latte, null, false));        // 熱氣
    a.push(p(0.045, 0.14, 0.01, 0.1, 4, 30, K.mint, null, false));          // 小葉子圖案
    return a;
  });

  // 咖啡廳盆栽 1×1：條紋高盆＋層層錯開的大葉子
  obj('plant_cafe', '咖啡廳盆栽', 1, 1, () => [
    p(0, 0, 0.44, 0.44, 24, 0, K.cream, [[0, 3, K.terra], [16, 19, K.terra]]),
    p(0, 0, 0.38, 0.38, 1, 24, K.bean, null, false),                         // 土
    p(0.06, 0.04, 0.6, 0.6, 10, 27, K.leaf),
    p(0.14, 0.14, 0.26, 0.26, 9, 37, K.green),
    p(-0.14, -0.1, 0.26, 0.26, 11, 37, K.sageD),
    p(0.02, -0.02, 0.34, 0.34, 9, 48, K.leaf),
    p(0.02, 0.0, 0.14, 0.14, 7, 57, K.green),
  ]);

  // 杯子層架 2×1：下櫃＋兩層「階梯式」開放層板（越上層越靠後）：馬克杯、咖啡豆罐、疊盤、大罐子
  obj('cup_shelf', '杯子層架', 2, 1, () => {
    const a = [
      p(-0.4, 0, 0.06, 1.76, 92, 0, shade(K.wood, 0.85), null, false),       // 背板 f -0.43..-0.37
      p(-0.03, -0.93, 0.74, 0.1, 98, 0, K.wood), p(-0.03, 0.93, 0.74, 0.1, 98, 0, K.wood), // 側板
      p(0, 0, 0.7, 1.76, 34, 0, K.walnutD, [[0, 4, K.dark]]),               // 下櫃 f -0.35..0.35
      p(0.365, -0.44, 0.03, 0.84, 26, 5, K.woodL, null, false),             // 櫃門
      p(0.365, 0.44, 0.03, 0.84, 26, 5, K.woodL, null, false),
      p(0.385, -0.06, 0.01, 0.04, 8, 18, K.gold, null, false),
      p(0.385, 0.06, 0.01, 0.04, 8, 18, K.gold, null, false),
      p(-0.135, 0, 0.47, 1.76, 3, 62, K.woodL),                             // 中層板 f -0.37..0.1
      p(-0.25, 0, 0.24, 1.76, 3, 92, K.woodL),                              // 頂板 f -0.37..-0.13
    ];
    const cols = [K.white, K.mint, K.pink, K.yellow, K.blue, K.white];
    cols.forEach((c, k) => {
      const s = -0.7 + k * 0.26;
      a.push(p(0.215, s, 0.14, 0.14, 11, 34, c));                            // 馬克杯（下櫃上，前排）
      a.push(p(0.215, s + 0.09, 0.04, 0.04, 6, 36, c, null, false));         // 杯耳
    });
    // 中層：咖啡豆罐 ×3、疊盤、小盆栽
    for (const s of [-0.66, -0.4, -0.14]) a.push(p(-0.02, s, 0.2, 0.2, 16, 65, K.glass, [[65, 77, K.bean], [79, 81, K.cream]]));
    for (let k = 0; k < 3; k++) a.push(p(0, 0.2, 0.2, 0.22, 2, 65 + k * 2, K.white, [[65 + k * 2, 66 + k * 2, shade(K.white, 0.85)]], false));
    a.push(p(-0.02, 0.58, 0.18, 0.18, 9, 65, K.terra), p(-0.02, 0.58, 0.2, 0.2, 8, 74, K.leaf));
    // 頂上：大罐子
    a.push(p(-0.25, -0.5, 0.2, 0.22, 14, 95, K.cream, [[95, 98, K.terra]]), p(-0.25, 0.5, 0.2, 0.2, 18, 95, K.glass, [[95, 108, K.latte]]));
    return a;
  });

  // ---------- 牆紙、地板 ----------
  const WALLS = [
    { name: '焦糖直紋', a: [214, 164, 118], b: [200, 150, 106], stripe: 2 },
    { name: '奶泡圓點', a: [244, 230, 206], b: [222, 196, 160], dots: 1 },
  ];
  const FLOORS = [
    { name: '深胡桃木地板', a: [128, 84, 56], b: [104, 66, 44], plank: 1 },
    { name: '黑白格子', a: [240, 236, 228], b: [66, 68, 82], check: 1 },
  ];

  // ---------- 牆面裝飾 ----------
  const WALLDECO = {};
  function wdef(id, name, W, z0, z1, paint) {
    WALLDECO[id] = { id, name, cat: 'wall', set: 'cafe', price: 0, comfort: 0, W, D: 0, kind: 'wall', z0, z1, paint };
  }
  // 牆上黑板菜單：木框、黑板、色塊代表的菜單行與價格點、杯子圖案
  wdef('menu_board', '黑板菜單', 2, 70, 130, (q, W) => {
    q(0.08, W - 0.08, 70, 130, K.walnut);
    q(0.16, W - 0.16, 75, 125, K.chalk);
    q(0.26, 0.9, 115, 119, K.pink, null);                                   // 標題列
    q(1.1, W - 0.26, 115, 119, K.yellow, null);
    const rows = [[106, 0.56], [99, 0.44], [92, 0.62], [85, 0.38], [78, 0.5]];
    for (const [z, len] of rows) { q(0.26, 0.26 + len, z, z + 3, K.cream, null); q(0.98, 1.06, z, z + 3, K.yellow, null); }
    // 右半：杯子圖案＋小葉子
    q(1.26, 1.56, 80, 98, K.white, null); q(1.56, 1.64, 85, 94, K.white, null); q(1.56, 1.6, 87, 92, K.chalk, null);
    q(1.26, 1.56, 95, 98, K.latte, null); q(1.2, 1.66, 78, 80, K.white, null);
    q(1.34, 1.37, 101, 108, K.cream, null); q(1.44, 1.47, 102, 110, K.cream, null);
    q(1.7, 1.78, 100, 106, K.mint, null);
  });
  // 咖啡杯掛牌：兩條吊繩、圓角木牌、杯子圖案
  wdef('cafe_sign_wall', '咖啡杯掛牌', 1, 78, 124, (q, W) => {
    q(0.28, 0.31, 112, 124, K.dark, null); q(0.69, 0.72, 112, 124, K.dark, null);
    q(0.18, 0.82, 82, 114, K.woodL); q(0.14, 0.86, 86, 110, K.woodL, null);  // 圓角感：兩塊交錯
    q(0.24, 0.76, 86, 110, K.cream, null);
    q(0.34, 0.66, 88, 90, K.walnut, null);                                  // 盤子
    q(0.38, 0.6, 90, 101, K.red, null);                                     // 杯身
    q(0.6, 0.68, 92, 99, K.red, null); q(0.6, 0.64, 94, 97, K.cream, null);  // 杯耳
    q(0.4, 0.58, 98, 100, K.white, null);                                   // 杯口
    q(0.43, 0.46, 102, 107, K.walnut, null); q(0.52, 0.55, 103, 108, K.walnut, null); // 熱氣
    q(0.2, 0.8, 78, 82, K.walnutD);                                         // 底下的木條
  });
  // 牆上杯架：木層板＋兩個托架＋馬克杯和豆罐
  wdef('wall_shelf_cups', '牆上杯架', 2, 88, 128, (q, W) => {
    q(0.28, 0.34, 88, 96, K.walnutD); q(W - 0.34, W - 0.28, 88, 96, K.walnutD);
    q(0.1, W - 0.1, 96, 101, K.walnut);
    const cols = [K.white, K.pink, K.mint, K.yellow];
    cols.forEach((c, k) => {
      const u = 0.2 + k * 0.3;
      q(u, u + 0.15, 101, 112, c); q(u + 0.15, u + 0.2, 104, 109, c);
    });
    q(1.42, 1.66, 101, 122, K.glass); q(1.44, 1.64, 101, 114, K.bean, null); q(1.4, 1.68, 122, 126, K.terra);
    q(1.72, 1.84, 101, 116, K.cream); q(1.74, 1.82, 116, 118, K.terra, null);
  });

  // ---------- 小遊戲 2D 圖示（32×32 正面圖） ----------
  function ell(pix, cx, cy, rx, ry, c, o) {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      const v = (x * x) / (rx * rx + 0.5) + (y * y) / (ry * ry + 0.5);
      if (v > 1) continue;
      const nx = ((Math.abs(x) + 1) ** 2) / (rx * rx + 0.5) + (y * y) / (ry * ry + 0.5);
      const ny = (x * x) / (rx * rx + 0.5) + ((Math.abs(y) + 1) ** 2) / (ry * ry + 0.5);
      pix.px(cx + x, cy + y, o && (nx > 1 || ny > 1) ? o : c);
    }
  }
  const R = (pix, x0, y0, x1, y1, c, o) => pix.rect(x0, y0, x1, y1, c, o === undefined ? OUT : o);
  // C 形杯耳
  function handle(pix, x0, y0, x1, y1, c) {
    pix.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y1 - 3], [x1 - 3, y1 - 3], [x1 - 3, y0 + 3], [x0, y0 + 3]], c, OUT);
  }
  function mug(pix, x, y, body, rimFill) {
    ell(pix, x + 15, y + 27, 13, 3, K.white, OUT);                            // 盤子
    ell(pix, x + 15, y + 27, 9, 1, shade(K.white, 0.86));
    handle(pix, x + 21, y + 13, x + 27, y + 22, body);
    R(pix, x + 6, y + 10, x + 22, y + 26, body);
    R(pix, x + 19, y + 11, x + 21, y + 25, shade(body, 0.86), null);          // 右側陰影
    R(pix, x + 7, y + 11, x + 21, y + 13, rimFill, null);                     // 杯口內容物
    pix.line(x + 7, y + 14, x + 21, y + 14, shade(rimFill, 0.75));
  }
  function steam(pix, x, y, c) {
    for (const dx of [0, 5]) { pix.px(x + dx, y, c); pix.px(x + dx + 1, y + 1, c); pix.px(x + dx, y + 2, c); pix.px(x + dx - 1, y + 3, c); pix.px(x + dx, y + 4, c); }
  }
  function head(pix, x, y, hair, skin) {
    R(pix, x + 5, y + 6, x + 26, y + 28, skin);
    R(pix, x + 23, y + 7, x + 25, y + 27, shade(skin, 0.9), null);
    pix.poly([[x + 4, y + 3], [x + 27, y + 3], [x + 27, y + 14], [x + 22, y + 11], [x + 17, y + 13], [x + 11, y + 10], [x + 4, y + 13]], hair, OUT);
  }
  const ICONS = {
    cup_empty(pix, x, y) { mug(pix, x, y, K.white, [214, 218, 228]); },
    coffee(pix, x, y) {                                                        // 三顆咖啡豆
      for (const [cx, cy, rx, ry] of [[10, 20, 7, 5], [21, 22, 7, 5], [16, 11, 7, 5]]) {
        ell(pix, x + cx, y + cy, rx, ry, K.bean, OUT);
        ell(pix, x + cx - 2, y + cy - 2, 2, 1, shade(K.bean, 1.35));
        pix.line(x + cx - 4, y + cy + 1, x + cx + 4, y + cy - 1, shade(K.bean, 0.6));
      }
    },
    milk(pix, x, y) {                                                          // 牛奶瓶
      R(pix, x + 12, y + 3, x + 19, y + 6, K.blue);                            // 瓶蓋
      pix.poly([[x + 12, y + 7], [x + 19, y + 7], [x + 19, y + 10], [x + 23, y + 14], [x + 23, y + 29], [x + 8, y + 29], [x + 8, y + 14], [x + 12, y + 10]], K.white, OUT);
      R(pix, x + 9, y + 17, x + 22, y + 23, K.blue, null);                     // 標籤
      R(pix, x + 13, y + 19, x + 18, y + 21, K.white, null);
      R(pix, x + 20, y + 15, x + 22, y + 28, shade(K.white, 0.86), null);
      pix.line(x + 10, y + 13, x + 10, y + 15, [255, 255, 255]);
    },
    foam(pix, x, y) {                                                          // 拉花鋼杯＋奶泡
      pix.poly([[x + 7, y + 13], [x + 23, y + 13], [x + 22, y + 29], [x + 8, y + 29]], K.steel, OUT);
      R(pix, x + 18, y + 14, x + 21, y + 28, K.steelD, null);
      handle(pix, x + 22, y + 15, x + 28, y + 24, K.steel);
      pix.poly([[x + 7, y + 13], [x + 3, y + 10], [x + 8, y + 11]], K.steel, OUT); // 尖嘴
      ell(pix, x + 11, y + 11, 5, 4, K.white, OUT); ell(pix, x + 19, y + 10, 5, 5, K.white, OUT); ell(pix, x + 15, y + 6, 5, 4, K.white, OUT);
      ell(pix, x + 15, y + 9, 6, 3, K.white);
      pix.px(x + 13, y + 5, [255, 255, 255]); pix.px(x + 18, y + 8, [255, 255, 255]);
    },
    ice(pix, x, y) {                                                           // 三顆冰塊（正面＋頂面）
      const cube = (cx, cy, s) => {
        pix.poly([[cx, cy], [cx + s, cy], [cx + s + 3, cy - 3], [cx + 3, cy - 3]], [230, 248, 255], OUT);
        pix.poly([[cx + s, cy], [cx + s + 3, cy - 3], [cx + s + 3, cy + s - 3], [cx + s, cy + s]], [150, 204, 232], OUT);
        R(pix, cx, cy, cx + s, cy + s, K.glass);
        pix.line(cx + 2, cy + 2, cx + 4, cy + 2, [255, 255, 255]); pix.line(cx + 2, cy + 3, cx + 2, cy + 4, [255, 255, 255]);
      };
      cube(x + 4, y + 18, 10); cube(x + 16, y + 19, 10); cube(x + 10, y + 7, 10);
    },
    syrup(pix, x, y) {                                                         // 壓頭糖漿瓶
      R(pix, x + 15, y + 2, x + 17, y + 8, K.dark); R(pix, x + 11, y + 2, x + 15, y + 4, K.dark);
      R(pix, x + 13, y + 9, x + 19, y + 12, K.dark);
      R(pix, x + 11, y + 13, x + 21, y + 16, [214, 130, 60]); R(pix, x + 9, y + 16, x + 23, y + 29, [214, 130, 60]);
      R(pix, x + 10, y + 19, x + 22, y + 25, K.cream, null);
      for (const [dy, a, b] of [[19, 16, 16], [20, 15, 17], [21, 14, 18], [22, 14, 18], [23, 15, 17]]) R(pix, x + a, y + dy, x + b, y + dy, [170, 96, 40], null); // 糖漿滴圖案
      R(pix, x + 20, y + 16, x + 22, y + 28, shade([214, 130, 60], 0.8), null);
      pix.line(x + 11, y + 17, x + 11, y + 18, [250, 200, 140]); pix.line(x + 13, y + 14, x + 13, y + 15, [250, 200, 140]);
    },
    latte(pix, x, y) {                                                         // 拿鐵：杯口有愛心拉花
      mug(pix, x, y, K.white, K.latte);
      R(pix, x + 11, y + 11, x + 12, y + 12, K.white, null); R(pix, x + 14, y + 11, x + 15, y + 12, K.white, null);
      R(pix, x + 12, y + 13, x + 14, y + 13, K.white, null);
      R(pix, x + 9, y + 18, x + 17, y + 21, K.terra, null);                    // 杯身色帶
    },
    americano(pix, x, y) {                                                     // 美式：深色＋熱氣
      mug(pix, x, y, [70, 86, 140], K.coffee);
      steam(pix, x + 12, y + 3, [180, 186, 200]);
    },
    iced_latte(pix, x, y) {                                                    // 冰拿鐵：高玻璃杯、分層、冰塊、吸管
      R(pix, x + 18, y + 1, x + 20, y + 12, K.straw);
      pix.poly([[x + 8, y + 7], [x + 24, y + 7], [x + 22, y + 30], [x + 10, y + 30]], [220, 240, 248], OUT);
      pix.fill([[x + 9, y + 16], [x + 23, y + 16], [x + 22.3, y + 23], [x + 9.7, y + 23]], K.cream);
      pix.fill([[x + 9.7, y + 23], [x + 22.3, y + 23], [x + 21.8, y + 29], [x + 10.2, y + 29]], K.latte);
      R(pix, x + 11, y + 10, x + 15, y + 14, [244, 252, 255]); R(pix, x + 16, y + 12, x + 20, y + 16, [244, 252, 255]);
      pix.line(x + 10, y + 9, x + 11, y + 26, [255, 255, 255]);
    },
    cappuccino(pix, x, y) {                                                    // 卡布奇諾：高高的奶泡＋可可粉
      mug(pix, x, y, K.mint, K.white);
      ell(pix, x + 14, y + 10, 8, 4, K.white, OUT);
      ell(pix, x + 14, y + 10, 7, 3, K.white);
      for (const [dx, dy] of [[-3, -1], [1, 0], [4, -2], [-1, 2], [3, 2]]) pix.px(x + 14 + dx, y + 10 + dy, K.choco);
    },
    customer_happy(pix, x, y) {
      head(pix, x, y, [110, 70, 44], [255, 214, 178]);
      for (const ex of [10, 19]) { pix.px(x + ex, y + 17, OUT); pix.px(x + ex + 1, y + 16, OUT); pix.px(x + ex + 2, y + 17, OUT); } // ^ ^
      R(pix, x + 8, y + 20, x + 10, y + 21, [250, 170, 170], null); R(pix, x + 21, y + 20, x + 23, y + 21, [250, 170, 170], null);
      pix.line(x + 13, y + 22, x + 14, y + 23, OUT); pix.line(x + 15, y + 24, x + 16, y + 24, OUT); pix.line(x + 17, y + 23, x + 18, y + 22, OUT);
    },
    customer_wait(pix, x, y) {
      head(pix, x, y, [40, 34, 34], [232, 170, 120]);
      R(pix, x + 10, y + 17, x + 11, y + 18, OUT, null); R(pix, x + 20, y + 17, x + 21, y + 18, OUT, null);
      pix.line(x + 9, y + 14, x + 12, y + 15, OUT); pix.line(x + 19, y + 15, x + 22, y + 14, OUT); // 皺眉
      pix.line(x + 13, y + 23, x + 18, y + 23, OUT);
      pix.poly([[x + 27, y + 9], [x + 29, y + 13], [x + 29, y + 15], [x + 27, y + 16], [x + 25, y + 15], [x + 25, y + 13]], [150, 210, 250], OUT); // 汗滴
    },
  };

  G.ART = G.ART || {};
  G.ART.cafe = { OBJS, WALLS, FLOORS, WALLDECO, ICONS, COLORS: K };
})(typeof window !== 'undefined' ? window : globalThis);
