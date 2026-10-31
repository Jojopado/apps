// PixelNook 模型：方塊人、家具、牆面裝飾、壁紙、地板。全部用程式畫。
// 規則：同一個物件拆成「彼此不重疊」的方塊；細節（手掌、內褲、抽屜線）用色帶畫在方塊表面。
(function (G) {
  'use strict';
  const { shade, Iso, boxPart, depthSort, OUT, TW, TH } = G.PX;

  // ---------------- 方塊人 ----------------
  const DIRS = { SW: [0, 1], SE: [1, 0], NE: [0, -1], NW: [-1, 0] };
  const SKINS = [[255, 214, 178], [255, 200, 150], [232, 170, 120], [196, 132, 90], [140, 92, 64]];
  const HAIRC = [[110, 70, 44], [40, 34, 34], [200, 150, 80], [240, 210, 120], [200, 80, 60], [150, 110, 200], [90, 150, 220], [240, 150, 180], [230, 230, 236]];
  const CLOTH = [[250, 200, 80], [240, 110, 100], [120, 180, 240], [130, 200, 140], [244, 246, 250], [60, 64, 80], [240, 150, 190], [180, 140, 220], [250, 160, 80], [110, 90, 70]];
  const PANTS = [[70, 90, 150], [50, 54, 66], [180, 150, 110], [230, 230, 236], [120, 160, 110], [200, 90, 90], [240, 170, 200], [100, 80, 140]];
  const SHOES = [[60, 50, 60], [244, 246, 250], [200, 70, 70], [80, 120, 200], [150, 100, 60], [250, 200, 80]];
  const HAIRS = ['short', 'long', 'spiky', 'bald'];
  const HAIR_NAMES = { short: '短髮', long: '長髮', spiky: '刺刺頭', bald: '光頭' };
  const DEFAULT_LOOK = { skin: 1, hair: 'short', hairC: 0, shirt: 0, pants: 0, shoes: 0 };

  // 回傳角色的可排序零件（已排好內部層級）＋整體 AABB。pose: 'stand' | 'sit'（seatZ 為座面高度）
  function charParts(ci, cj, facing, step, look, pose, seatZ) {
    look = Object.assign({}, DEFAULT_LOOK, look || {});
    const skin = SKINS[look.skin] || SKINS[1];
    const hair = look.hair === 'bald' ? null : (HAIRC[look.hairC] || HAIRC[0]);
    const shirt = look.shirt < 0 ? null : (CLOTH[look.shirt] || CLOTH[0]);
    const pants = look.pants < 0 ? null : (PANTS[look.pants] || PANTS[0]);
    const shoes = look.shoes < 0 ? null : (SHOES[look.shoes] || SHOES[0]);
    const [fi, fj] = DIRS[facing] || DIRS.SW;
    const alongI = fi !== 0;
    const si = alongI ? 0 : 1, sj = alongI ? 1 : 0;
    const sit = pose === 'sit';
    const out = [];
    function part(fwd, side, wf, ws, h, col, z, hi, bands) {
      const c2i = ci + fi * fwd + si * side, c2j = cj + fj * fwd + sj * side;
      const wi = alongI ? wf : ws, wj = alongI ? ws : wf;
      const p = boxPart(c2i - wi / 2, c2j - wj / 2, wi, wj, h, col, z, hi, bands);
      out.push(p); return p;
    }
    const LEG = 21, BODY = 32, HEAD = 22;
    const zb = sit ? seatZ : LEG, zh = zb + BODY;
    const sw = sit ? 0 : 0.07 * step;
    const legc = pants || skin, topc = shirt || skin, shoe = shoes || skin;
    const LW = 0.19, LD = 0.15, FOOT = 0.09;
    // 腿
    for (const [sgn, mv] of [[-1, sw], [1, -sw]]) {
      const side = sgn * 0.11;
      if (!sit) {
        part(mv, side, LD, LW, LEG, legc, 0, false, shoes ? [[0, 6, shoe]] : null);
        part(mv + LD / 2 + FOOT / 2, side, FOOT, LW, 6, shoe, 0, false);
      } else {
        // 坐著：大腿往前平放在座面上，小腿垂到地上，腳掌往前
        part(0.1925, side, 0.215, LW, 9, legc, seatZ, false);
        if (seatZ > 8) part(0.37, side, 0.14, LW, seatZ + 9, legc, 0, false, shoes ? [[0, 6, shoe]] : null);
        part(0.37 + 0.07 + FOOT / 2, side, FOOT, LW, 6, shoe, 0, false);
      }
    }
    // 身體（窄、薄）
    let tb = null;
    if (!shirt && !pants) tb = [[zb, zb + 10, [240, 240, 244]]];
    else if (shirt && pants) tb = [[zb, zb + 6, pants]];
    part(0, 0, 0.17, 0.44, BODY, topc, zb, true, tb);
    // 手臂（從頭下面垂到大腿；手掌是色帶）
    const armLen = sit ? 26 : 34;
    for (const [sgn, mv] of [[-1, -sw], [1, sw]]) {
      part(mv, sgn * 0.3, 0.17, 0.16, armLen, topc, zh - armLen - 1, true, shirt ? [[zh - armLen - 1, zh - armLen + 7, skin]] : null);
    }
    // 長髮：後腦垂下來的一片
    const HW = 0.40, HD = 0.40;
    if (look.hair === 'long' && hair) part(-HD / 2 - 0.035, 0, 0.07, HW + 0.04, HEAD + 12, hair, zh - 12, false);
    // 頭（俯視正方形）＋臉＋頭髮，當成一個零件（裝飾畫在頭的表面）
    const wi = HD, wj = HW, i0 = ci - wi / 2, j0 = cj - wj / 2, top = zh + HEAD;
    const head = {
      i0, i1: i0 + wi, j0, j1: j0 + wj, z0: zh, z1: top + (hair ? 3 : 0),
      draw(iso) {
        iso.box(i0, j0, wi, wj, HEAD, skin, zh, true);
        if (hair) iso.box(i0 - 0.015, j0 - 0.015, wi + 0.03, wj + 0.03, 3, hair, top, false);
        if (look.hair === 'spiky' && hair) {
          iso.box(i0 + 0.04, j0 + 0.04, 0.14, 0.14, 5, hair, top + 3, false);
          iso.box(i0 + 0.22, j0 + 0.22, 0.14, 0.14, 4, hair, top + 3, false);
          iso.box(i0 + 0.22, j0 + 0.04, 0.12, 0.12, 6, hair, top + 3, false);
        }
        const pix = iso.p, P = (a, b, c) => iso.P(a, b, c);
        const FJ = (u, z) => P(i0 + u, j0 + wj + 0.01, z), FI = (u, z) => P(i0 + wi + 0.01, j0 + u, z);
        const longH = look.hair === 'long' ? 22 : 16;
        const face = (F, Wd) => {
          if (hair) pix.poly([F(0, top), F(Wd, top), F(Wd, top - 7), F(Wd * 0.7, top - 5), F(Wd * 0.45, top - 7), F(Wd * 0.2, top - 5), F(0, top - 8)], hair, OUT);
          for (const u of [Wd * 0.25, Wd * 0.68]) { const [x, y] = F(u, top - 9); pix.rect(x, y, x + 1, y + 1, OUT); }
          const a = F(Wd * 0.32, top - 15), b = F(Wd * 0.62, top - 15); pix.line(a[0], a[1], b[0], b[1], shade(skin, 0.6));
        };
        const back = (F, Wd) => { if (hair) pix.poly([F(0, top), F(Wd, top), F(Wd, top - longH), F(0, top - longH)], hair, OUT); };
        const sideF = (F, Wd, lowBack) => {
          if (hair) {
            const pts = lowBack
              ? [F(0, top), F(Wd, top), F(Wd, top - 6), F(Wd * 0.5, top - 6), F(Wd * 0.45, top - longH), F(0, top - longH)]
              : [F(0, top), F(Wd, top), F(Wd, top - longH), F(Wd * 0.55, top - longH), F(Wd * 0.5, top - 6), F(0, top - 6)];
            pix.poly(pts, shade(hair, 0.82), OUT);
          }
          const [x, y] = F(Wd * (lowBack ? 0.6 : 0.4), top - 10);
          pix.path([[x - 1, y - 2], [x + 1, y - 2], [x + 1, y + 2], [x - 1, y + 2]], shade(skin, 0.7), true);
        };
        if (facing === 'SW') { face(FJ, wi); sideF(FI, wj, true); }
        else if (facing === 'SE') { face(FI, wj); sideF(FJ, wi, true); }
        else if (facing === 'NE') { back(FJ, wi); sideF(FI, wj, false); }
        else { back(FI, wj); sideF(FJ, wi, false); }
      }
    };
    out.push(head);
    const sorted = depthSort(out);
    let a = { i0: 1e9, i1: -1e9, j0: 1e9, j1: -1e9, z0: 1e9, z1: -1e9 };
    for (const p of out) { a.i0 = Math.min(a.i0, p.i0); a.i1 = Math.max(a.i1, p.i1); a.j0 = Math.min(a.j0, p.j0); a.j1 = Math.max(a.j1, p.j1); a.z0 = Math.min(a.z0, p.z0); a.z1 = Math.max(a.z1, p.z1); }
    if (sit) a.z0 = seatZ;    // 坐著時整個人當成座面以上的物件，座面在他下面、椅背依前後判斷
    return { parts: sorted, aabb: a };
  }

  // ---------------- 家具 ----------------
  const C = {
    wood: [190, 132, 84], woodL: [214, 166, 112], woodD: [140, 94, 62],
    pink: [244, 168, 190], mint: [168, 222, 200], lilac: [200, 182, 232], cream: [250, 240, 220],
    blue: [126, 184, 232], white: [244, 246, 250], gray: [150, 158, 172], navy: [70, 86, 140], dark: [52, 56, 70],
    green: [110, 176, 100], leaf: [96, 168, 92], rattan: [214, 176, 116], terra: [196, 110, 74],
    yellow: [250, 210, 100], red: [230, 96, 96], orange: [244, 150, 80],
  };
  const SETS = { wood: '木頭風', pastel: '粉彩風', modern: '藍色現代', green: '森林綠' };
  const CATS = { bed: '床', seat: '椅子沙發', table: '桌子', storage: '櫃子', light: '燈', plant: '植物', tech: '電器', rug: '地毯', wall: '牆面' };

  // 零件規格（物件自己的座標）：f 前後中心、s 左右中心、wf 前後厚、ws 左右寬、h 高、z 離地、c 顏色、b 色帶、hi 亮邊
  const p = (f, s, wf, ws, h, z, c, b, hi) => ({ f, s, wf, ws, h, z, c, b, hi: hi !== false });

  function bed(frame, sheet, blanket) {
    return () => [
      p(-1.42, 0, 0.16, 1.9, 44, 0, frame),                       // 床頭板
      p(0.08, 0, 2.84, 1.9, 14, 0, frame),                        // 床架
      p(0.08, 0, 2.84, 1.9, 10, 14, sheet),                       // 床墊
      p(0.55, 0, 1.9, 1.94, 3, 24, blanket),                      // 被子
      p(-0.95, 0, 0.5, 1.3, 6, 24, [255, 255, 255]),              // 枕頭
    ];
  }
  function sofa(col, cushion) {
    return () => [
      p(0.025, 0, 0.95, 2, 16, 0, col),
      p(-0.355, 0, 0.19, 2, 22, 16, col),
      p(0.095, 0, 0.71, 1.52, 6, 16, cushion),
      p(0.12, -0.88, 0.76, 0.24, 12, 16, col), p(0.12, 0.88, 0.76, 0.24, 12, 16, col),
    ];
  }
  function chair(col, seat) {
    const legs = [[-0.28, -0.28], [-0.28, 0.28], [0.28, -0.28], [0.28, 0.28]].map(([f, s]) => p(f, s, 0.07, 0.07, 14, 0, col, null, false));
    return () => legs.concat([p(0, 0, 0.7, 0.7, 5, 14, seat), p(-0.31, 0, 0.08, 0.7, 26, 19, col)]);
  }
  function desk(col, top, deco) {
    return () => {
      const a = [p(0, -0.92, 0.9, 0.16, 26, 0, col), p(0, 0.92, 0.9, 0.16, 26, 0, col), p(0, 0, 0.96, 2, 6, 26, top)];
      if (deco === 'laptop') a.push(p(-0.05, 0.35, 0.4, 0.55, 3, 32, C.dark), p(-0.24, 0.35, 0.03, 0.55, 22, 35, C.dark, null, false), p(-0.22, 0.35, 0.01, 0.47, 17, 37, [120, 190, 250], null, false));
      if (deco === 'books') a.push(p(-0.15, -0.5, 0.36, 0.26, 6, 32, C.red), p(-0.15, -0.5, 0.32, 0.22, 5, 38, C.blue), p(0.15, 0.4, 0.16, 0.16, 9, 32, C.white));
      return a;
    };
  }
  function ctable(col, top) {
    return () => [
      ...[[-0.25, -0.25], [-0.25, 0.25], [0.25, -0.25], [0.25, 0.25]].map(([f, s]) => p(f, s, 0.08, 0.08, 16, 0, col, null, false)),
      p(0, 0, 0.66, 0.66, 5, 16, top), p(0.05, 0.08, 0.12, 0.12, 8, 21, C.white, null, false),
    ];
  }
  function shelf(col, w) {
    const ws = w - 0.06, a = [p(-0.36, 0, 0.06, ws - 0.2, 80, 0, shade(col, 0.85), null, false)];
    a.push(p(-0.03, -ws / 2 + 0.05, 0.72, 0.1, 82, 0, col), p(-0.03, ws / 2 - 0.05, 0.72, 0.1, 82, 0, col));
    const inner = ws - 0.2, books = [C.red, C.blue, C.yellow, C.green, C.lilac, C.orange, C.navy, C.pink];
    let k = 0;
    for (const z of [0, 27, 54]) {
      a.push(p(0.02, 0, 0.66, inner, 4, z, col, null, false));
      const n = Math.floor(inner / 0.11) - 1;
      for (let b = 0; b < n; b++) {
        if ((b + z) % 5 === 3) continue;
        const h = 14 + ((b * 7 + z) % 3) * 3;
        a.push(p(-0.08, -inner / 2 + 0.07 + b * 0.11, 0.42, 0.09, h, z + 4, books[k++ % books.length], null, false));
      }
    }
    a.push(p(0.02, 0, 0.66, inner, 4, 78, col, null, false));
    return () => a;
  }
  function wardrobe(col, door) {
    return () => [
      p(-0.02, 0, 0.8, 1.9, 92, 0, col),
      p(0.4, -0.47, 0.04, 0.88, 82, 5, door), p(0.4, 0.47, 0.04, 0.88, 82, 5, door),
      p(0.435, -0.08, 0.03, 0.05, 14, 44, C.yellow, null, false), p(0.435, 0.08, 0.03, 0.05, 14, 44, C.yellow, null, false),
    ];
  }
  function lamp(col, shadeOff) {
    return on => [
      p(0, 0, 0.3, 0.3, 3, 0, col, null, false), p(0, 0, 0.06, 0.06, 50, 3, col, null, false),
      p(0, 0, 0.36, 0.36, 16, 53, on ? [255, 236, 150] : shadeOff),
    ];
  }
  function tv(col) {
    return on => [
      p(0.05, 0, 0.7, 1.8, 18, 0, col, [[8, 9, shade(col, 0.8)]]),
      p(-0.1, 0, 0.14, 1.3, 34, 18, C.dark),
      p(-0.02, 0, 0.02, 1.16, 26, 22, on ? [120, 200, 255] : [40, 44, 60], null, false),
    ];
  }
  function plant(pot, big) {
    return () => big
      ? [p(0, 0, 0.4, 0.4, 16, 0, pot), p(0, 0, 0.08, 0.08, 14, 16, C.woodD, null, false),
         p(0, 0, 0.62, 0.62, 12, 30, C.leaf), p(0, 0, 0.46, 0.46, 12, 42, C.green), p(0, 0, 0.28, 0.28, 10, 54, C.leaf)]
      : [p(0, 0, 0.36, 0.36, 14, 0, pot), p(0, 0, 0.44, 0.44, 12, 14, C.leaf), p(0, 0, 0.3, 0.3, 9, 26, C.green), p(0, 0, 0.14, 0.14, 6, 35, C.leaf)];
  }
  function fridge(col) {
    return () => [p(0, 0, 0.8, 0.8, 76, 0, col, [[44, 46, shade(col, 0.7)]]), p(0.415, 0.28, 0.03, 0.06, 18, 50, C.gray, null, false), p(0.415, 0.28, 0.03, 0.06, 14, 24, C.gray, null, false)];
  }
  function nightstand(col) {
    return () => [p(0, 0, 0.62, 0.62, 24, 0, col, [[11, 12, shade(col, 0.75)]]), p(0.325, 0, 0.03, 0.08, 3, 16, C.yellow, null, false), p(0, 0.12, 0.16, 0.16, 10, 24, C.yellow, null, false)];
  }
  function beanbag(col) {
    return () => [p(0, 0, 0.8, 0.8, 10, 0, col), p(0.09, 0, 0.56, 0.64, 5, 10, shade(col, 1.06)), p(-0.29, 0, 0.2, 0.64, 14, 10, col)];
  }
  function fishtank() {
    return () => [
      p(0, 0, 0.7, 1.8, 22, 0, C.wood),
      p(0, 0, 0.6, 1.7, 28, 22, [150, 214, 236], [[22, 26, [230, 210, 160]]]),
      p(0.31, -0.4, 0.02, 0.12, 5, 34, C.orange, null, false), p(0.31, 0.25, 0.02, 0.1, 4, 40, C.yellow, null, false), p(0.31, 0.55, 0.02, 0.08, 4, 30, C.red, null, false),
    ];
  }
  function cushion(col) { return () => [p(0, 0, 0.6, 0.6, 7, 0, col)]; }
  function piano() {
    return () => [p(-0.2, 0, 0.5, 1.8, 44, 0, C.dark), p(0.2, 0, 0.3, 1.6, 4, 26, [250, 250, 250], null, false), p(0.2, -0.85, 0.3, 0.1, 30, 0, C.dark, null, false), p(0.2, 0.85, 0.3, 0.1, 30, 0, C.dark, null, false)];
  }

  // W = 左右格數、D = 前後格數。seat：可以坐（z 座面高、spots 座位在物件座標的位置）；toggle：可開關
  const ITEMS = {};
  function def(id, name, cat, set, price, comfort, W, D, model, extra) {
    ITEMS[id] = Object.assign({ id, name, cat, set, price, comfort, W, D, model, kind: 'floor' }, extra || {});
  }
  const SEAT = (z, spots) => ({ seat: { z, spots } });
  // 木頭風
  def('bed_wood', '原木單人床', 'bed', 'wood', 160, 30, 2, 3, bed(C.wood, C.white, [120, 170, 230]), SEAT(24, [[0.2, 0.7, 1]]));
  def('sofa_wood', '原木沙發', 'seat', 'wood', 140, 24, 2, 1, sofa(C.wood, C.cream), SEAT(22, [[0.1, -0.45], [0.1, 0.45]]));
  def('chair_wood', '原木椅', 'seat', 'wood', 40, 6, 1, 1, chair(C.woodD, C.woodL), SEAT(19, [[0.05, 0]]));
  def('desk_wood', '原木書桌', 'table', 'wood', 90, 10, 2, 1, desk(C.woodD, C.woodL, 'books'));
  def('table_wood', '原木小茶几', 'table', 'wood', 50, 6, 1, 1, ctable(C.woodD, C.woodL));
  def('shelf_wood', '原木書櫃', 'storage', 'wood', 110, 14, 2, 1, shelf(C.wood, 2));
  def('wardrobe_wood', '原木衣櫃', 'storage', 'wood', 130, 12, 2, 1, wardrobe(C.wood, C.woodL));
  def('lamp_wood', '原木立燈', 'light', 'wood', 45, 8, 1, 1, lamp(C.woodD, [214, 200, 170]), { toggle: true });
  def('night_wood', '原木床頭櫃', 'storage', 'wood', 45, 6, 1, 1, nightstand(C.wood));
  // 粉彩風
  def('bed_pastel', '粉彩公主床', 'bed', 'pastel', 180, 34, 2, 3, bed(C.pink, C.cream, C.lilac), SEAT(24, [[0.2, 0.7, 1]]));
  def('sofa_pastel', '薄荷沙發', 'seat', 'pastel', 150, 26, 2, 1, sofa(C.mint, C.cream), SEAT(22, [[0.1, -0.45], [0.1, 0.45]]));
  def('chair_pastel', '粉紅小椅', 'seat', 'pastel', 45, 7, 1, 1, chair(C.pink, C.cream), SEAT(19, [[0.05, 0]]));
  def('bean_pastel', '紫色懶骨頭', 'seat', 'pastel', 60, 10, 1, 1, beanbag(C.lilac), SEAT(15, [[0.08, 0]]));
  def('table_pastel', '奶油小茶几', 'table', 'pastel', 55, 7, 1, 1, ctable(C.pink, C.cream));
  def('wardrobe_pastel', '薄荷衣櫃', 'storage', 'pastel', 140, 13, 2, 1, wardrobe(C.mint, C.cream));
  def('lamp_pastel', '粉紅立燈', 'light', 'pastel', 50, 8, 1, 1, lamp(C.pink, [240, 210, 220]), { toggle: true });
  def('cushion_pastel', '粉紅坐墊', 'seat', 'pastel', 25, 4, 1, 1, cushion(C.pink), SEAT(7, [[0, 0]]));
  def('night_pastel', '紫色床頭櫃', 'storage', 'pastel', 50, 6, 1, 1, nightstand(C.lilac));
  // 藍色現代
  def('bed_modern', '藍色現代床', 'bed', 'modern', 170, 32, 2, 3, bed(C.white, C.white, C.blue), SEAT(24, [[0.2, 0.7, 1]]));
  def('sofa_modern', '藍色沙發', 'seat', 'modern', 150, 25, 2, 1, sofa(C.blue, C.white), SEAT(22, [[0.1, -0.45], [0.1, 0.45]]));
  def('chair_modern', '白色電腦椅', 'seat', 'modern', 50, 7, 1, 1, chair(C.gray, C.white), SEAT(19, [[0.05, 0]]));
  def('desk_modern', '藍色電腦桌', 'table', 'modern', 120, 12, 2, 1, desk(C.blue, C.white, 'laptop'));
  def('tv_modern', '大電視', 'tech', 'modern', 160, 14, 2, 1, tv(C.white), { toggle: true });
  def('fridge_modern', '白色冰箱', 'tech', 'modern', 110, 8, 1, 1, fridge(C.white));
  def('shelf_modern', '白色書櫃', 'storage', 'modern', 110, 14, 2, 1, shelf(C.white, 2));
  def('lamp_modern', '藍色立燈', 'light', 'modern', 50, 8, 1, 1, lamp(C.gray, [200, 214, 230]), { toggle: true });
  def('piano_modern', '黑色鋼琴', 'tech', 'modern', 220, 20, 2, 1, piano());
  // 森林綠
  def('plant_s', '小盆栽', 'plant', 'green', 25, 5, 1, 1, plant(C.terra, false));
  def('plant_b', '大型盆栽', 'plant', 'green', 55, 9, 1, 1, plant(C.white, true));
  def('sofa_green', '森林沙發', 'seat', 'green', 145, 25, 2, 1, sofa(C.green, C.cream), SEAT(22, [[0.1, -0.45], [0.1, 0.45]]));
  def('chair_green', '藤編椅', 'seat', 'green', 45, 7, 1, 1, chair(C.rattan, C.green), SEAT(19, [[0.05, 0]]));
  def('table_green', '藤編茶几', 'table', 'green', 50, 6, 1, 1, ctable(C.rattan, C.rattan));
  def('tank_green', '水草魚缸', 'tech', 'green', 170, 18, 2, 1, fishtank());
  def('bean_green', '綠色懶骨頭', 'seat', 'green', 60, 10, 1, 1, beanbag(C.green), SEAT(15, [[0.08, 0]]));
  def('bed_green', '森林小床', 'bed', 'green', 165, 31, 2, 3, bed(C.rattan, C.cream, C.green), SEAT(24, [[0.2, 0.7, 1]]));

  // 地毯（不擋路，永遠畫在最下面）
  function rugDef(id, name, set, price, comfort, W, D, a, b, pat) {
    ITEMS[id] = { id, name, cat: 'rug', set, price, comfort, W, D, kind: 'rug', colors: [a, b], pat };
  }
  rugDef('rug_wood', '格紋地毯', 'wood', 60, 8, 2, 2, [200, 110, 90], [236, 190, 150], 'frame');
  rugDef('rug_pastel', '粉彩圓點地毯', 'pastel', 70, 9, 3, 2, [244, 190, 210], [255, 236, 244], 'dots');
  rugDef('rug_modern', '藍色長地毯', 'modern', 70, 9, 3, 2, [110, 160, 220], [170, 206, 240], 'frame');
  rugDef('rug_green', '草地地毯', 'green', 60, 8, 2, 2, [120, 180, 100], [160, 210, 130], 'stripe');

  // 牆面裝飾（W = 佔幾格牆、z0/z1 高度範圍）
  function wdef(id, name, set, price, comfort, W, z0, z1, paint) {
    ITEMS[id] = { id, name, cat: 'wall', set, price, comfort, W, D: 0, kind: 'wall', z0, z1, paint };
  }
  // paint(q, W)：q(u0,u1,z0,z1,col,outline) 在牆面上畫平行四邊形，u 是沿牆的格數
  wdef('win_wood', '木框窗戶', 'wood', 60, 6, 2, 56, 126, (q, W) => {
    q(0.15, W - 0.15, 56, 126, [250, 250, 252]); q(0.27, W - 0.27, 62, 120, [150, 204, 240]);
    q(0.27, W - 0.27, 62, 76, [190, 228, 248], null); q(W / 2 - 0.03, W / 2 + 0.03, 62, 120, [250, 250, 252], null);
    q(0.27, W - 0.27, 89, 92, [250, 250, 252], null); q(0.05, W - 0.05, 52, 57, C.woodD);
  });
  wdef('win_blind', '百葉窗', 'modern', 70, 6, 2, 56, 126, (q, W) => {
    q(0.15, W - 0.15, 56, 126, [250, 250, 252]); q(0.27, W - 0.27, 62, 120, [150, 204, 240]);
    for (let z = 66; z < 120; z += 6) q(0.27, W - 0.27, z, z + 2, [228, 238, 248], null);
  });
  wdef('paint_hill', '山丘風景畫', 'green', 40, 5, 1, 70, 110, (q, W) => {
    q(0.15, 0.85, 70, 110, [250, 240, 210]); q(0.24, 0.76, 75, 105, [160, 210, 240]); q(0.24, 0.76, 75, 86, [120, 180, 100], null);
  });
  wdef('paint_sun', '夕陽畫', 'pastel', 40, 5, 1, 70, 110, (q, W) => {
    q(0.15, 0.85, 70, 110, C.white); q(0.24, 0.76, 75, 105, [250, 180, 160]); q(0.4, 0.6, 84, 94, [255, 230, 120], null); q(0.24, 0.76, 75, 82, [120, 140, 200], null);
  });
  wdef('paint_abs', '抽象畫', 'modern', 45, 5, 1, 66, 114, (q, W) => {
    q(0.18, 0.82, 66, 114, C.dark); q(0.25, 0.75, 71, 109, C.white); q(0.3, 0.55, 76, 96, C.blue, null); q(0.5, 0.7, 88, 104, C.yellow, null);
  });
  wdef('clock', '圓點時鐘', 'wood', 35, 3, 1, 96, 122, (q, W) => {
    q(0.3, 0.7, 96, 122, C.white); q(0.36, 0.64, 100, 118, [190, 216, 244]); q(0.48, 0.52, 108, 116, OUT, null); q(0.5, 0.6, 107, 109, OUT, null);
  });
  wdef('mirror', '長鏡子', 'modern', 50, 4, 1, 30, 124, (q, W) => {
    q(0.2, 0.8, 30, 124, C.white); q(0.28, 0.72, 36, 118, [190, 214, 236]); q(0.4, 0.46, 90, 110, [236, 246, 255], null);
  });
  wdef('wall_shelf', '牆上層板', 'wood', 55, 6, 2, 96, 128, (q, W) => {
    const bk = [C.red, C.blue, C.yellow, C.green, C.lilac];
    for (let k = 0; k < 5; k++) q(0.3 + k * 0.16, 0.42 + k * 0.16, 102, 102 + 16 + (k % 3) * 4, bk[k]);
    q(0.1, W - 0.1, 96, 102, C.woodD);
  });
  wdef('poster', '星星海報', 'pastel', 30, 3, 1, 64, 116, (q, W) => {
    q(0.2, 0.8, 64, 116, C.lilac); q(0.44, 0.56, 84, 100, C.yellow, null); q(0.36, 0.64, 90, 94, C.yellow, null);
  });
  wdef('vine', '牆面藤蔓', 'green', 35, 4, 2, 90, 140, (q, W) => {
    for (let k = 0; k < 7; k++) q(0.1 + k * 0.26, 0.26 + k * 0.26, 128 - (k % 3) * 12, 140, k % 2 ? C.green : C.leaf);
  });

  // 牆紙、地板
  const WALLS = [
    { name: '奶油素色', a: [240, 214, 170], b: [240, 214, 170] },
    { name: '蜜桃條紋', a: [242, 196, 160], b: [236, 186, 150], stripe: 4 },
    { name: '粉紅點點', a: [248, 210, 222], b: [255, 236, 242], dots: 1 },
    { name: '薄荷條紋', a: [200, 232, 214], b: [184, 222, 202], stripe: 2 },
    { name: '海軍藍', a: [86, 104, 150], b: [96, 116, 164], stripe: 1 },
    { name: '森林葉子', a: [196, 220, 170], b: [150, 190, 120], dots: 2 },
  ];
  const FLOORS = [
    { name: '淺色木地板', a: [232, 196, 138], b: [214, 174, 116], plank: 1 },
    { name: '深色木地板', a: [170, 110, 70], b: [146, 92, 58], plank: 1 },
    { name: '白色磁磚', a: [236, 238, 242], b: [210, 214, 222], tile: 1 },
    { name: '粉紅格子', a: [250, 214, 224], b: [240, 190, 206], check: 1 },
    { name: '藍色地毯', a: [150, 180, 220], b: [140, 170, 212], check: 0 },
    { name: '苔綠地毯', a: [150, 186, 120], b: [138, 176, 110], check: 0 },
  ];
  const ROT = [[0, 1], [1, 0], [0, -1], [-1, 0]];      // 0 面向左下、1 面向右下、2 面向右上、3 面向左上

  function footprint(defn, r) {
    const along = (r & 1) === 1;
    return along ? [defn.D, defn.W] : [defn.W, defn.D];   // [wi, wj]
  }
  // 把擺好的家具 {t,i,j,r,on} 轉成全域零件
  function itemParts(it) {
    const d = ITEMS[it.t]; if (!d || d.kind !== 'floor') return [];
    const [fi, fj] = ROT[it.r & 3], si = fj, sj = -fi, along = (it.r & 1) === 1;
    const [wi, wj] = footprint(d, it.r);
    const cx = it.i + wi / 2, cy = it.j + wj / 2;
    return d.model(!!it.on).map(q => {
      const c2i = cx + fi * q.f + si * q.s, c2j = cy + fj * q.f + sj * q.s;
      const a = along ? q.wf : q.ws, b = along ? q.ws : q.wf;
      const bp = boxPart(c2i - a / 2, c2j - b / 2, a, b, q.h, q.c, q.z, q.hi, q.b);
      bp.item = it; return bp;
    });
  }
  // 座位的全域位置與朝向
  function seatSpot(it, k) {
    const d = ITEMS[it.t]; const [fi, fj] = ROT[it.r & 3], si = fj, sj = -fi;
    const [wi, wj] = footprint(d, it.r); const sp = d.seat.spots[k % d.seat.spots.length];
    // 第三個值＝朝向轉幾格（床：坐在床邊、面向側面，腳垂到床外）
    return { i: it.i + wi / 2 + fi * sp[0] + si * sp[1], j: it.j + wj / 2 + fj * sp[0] + sj * sp[1], facing: ['SW', 'SE', 'NE', 'NW'][(it.r + (sp[2] || 0)) & 3], z: d.seat.z };
  }

  G.MODELS = { DIRS, SKINS, HAIRC, CLOTH, PANTS, SHOES, HAIRS, HAIR_NAMES, DEFAULT_LOOK, charParts, ITEMS, SETS, CATS, WALLS, FLOORS, ROT, footprint, itemParts, seatSpot, C };
})(typeof window !== 'undefined' ? window : globalThis);
