// PixelNook 像素繪圖核心：自己做多邊形填色／畫線，保證每個像素都是硬邊（不會被瀏覽器反鋸齒糊掉）。
// 瀏覽器與 Node 共用（Node 測試時用來直接輸出 PNG 檢查層級）。
(function (G) {
  'use strict';
  const TW = 64, TH = 32;
  const OUT = [34, 40, 66];

  const clamp = v => v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
  const shade = (c, k) => [clamp(c[0] * k), clamp(c[1] * k), clamp(c[2] * k)];
  const pack = c => ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;

  class Pix {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Uint32Array(w * h); }
    px(x, y, c) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = pack(c); }
    // 多邊形填色：像素中心在多邊形內就填（相鄰兩面共用邊時不會重疊也不會有縫）
    fill(pts, c) {
      const col = pack(c);
      let y0 = Infinity, y1 = -Infinity;
      for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
      y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(this.h - 1, Math.ceil(y1));
      const n = pts.length, xs = [];
      for (let y = y0; y <= y1; y++) {
        const sy = y + 0.5; xs.length = 0;
        for (let k = 0; k < n; k++) {
          const a = pts[k], b = pts[(k + 1) % n];
          if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) xs.push(a[0] + (sy - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(this.w - 1, Math.ceil(xs[k + 1] - 0.5) - 1);
          const row = y * this.w;
          for (let x = xa; x <= xb; x++) this.d[row + x] = col;
        }
      }
    }
    line(x0, y0, x1, y1, c) {
      if (!(isFinite(x0) && isFinite(y0) && isFinite(x1) && isFinite(y1))) { if (typeof console !== 'undefined') console.error('Pix.line bad coords', x0, y0, x1, y1, String(new Error().stack).replace(/\s+/g, ' ').slice(0, 400)); return; }
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      if (Math.abs(x1 - x0) + Math.abs(y1 - y0) > 20000) return;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        this.px(x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    path(pts, c, close) {
      for (let k = 0; k + 1 < pts.length; k++) this.line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], c);
      if (close && pts.length > 2) this.line(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1], c);
    }
    poly(pts, c, outline) { this.fill(pts, c); if (outline) this.path(pts, outline, true); }
    rect(x0, y0, x1, y1, c, outline) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.px(x, y, c);
      if (outline) this.path([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], outline, true);
    }
    // 把另一張 Pix 貼上來（透明＝0 不貼）
    blit(src, ox, oy) {
      for (let y = 0; y < src.h; y++) {
        const ty = y + oy; if (ty < 0 || ty >= this.h) continue;
        for (let x = 0; x < src.w; x++) {
          const v = src.d[y * src.w + x]; if (!v) continue;
          const tx = x + ox; if (tx < 0 || tx >= this.w) continue;
          this.d[ty * this.w + tx] = v;
        }
      }
    }
    // 依不透明區域裁切
    trim() {
      let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.d[y * this.w + x]) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      if (x1 < 0) return { pix: new Pix(1, 1), x: 0, y: 0 };
      const p = new Pix(x1 - x0 + 1, y1 - y0 + 1);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) p.d[(y - y0) * p.w + (x - x0)] = this.d[y * this.w + x];
      return { pix: p, x: x0, y: y0 };
    }
  }

  // 等角繪圖：P(i,j,z) → 螢幕座標。所有頂點先四捨五入再畫，跟 Python 樣張一致。
  class Iso {
    constructor(pix, ox, oy) { this.p = pix; this.ox = ox; this.oy = oy; }
    P(i, j, z) { return [Math.round(this.ox + (i - j) * TW / 2), Math.round(this.oy + (i + j) * TH / 2 - (z || 0))]; }
    // 實心方塊。bands = [[z0, z1, 顏色]]：直接畫在側面的色帶，不另外疊方塊 → 不會有透出來的頂面。框線最後畫。
    box(i, j, wi, wj, h, col, z, hi, bands) {
      z = z || 0; const P = (a, b, c) => this.P(a, b, c), pix = this.p;
      const top = shade(col, 1.12), left = col, right = shade(col, 0.82);
      const a = P(i, j, z + h), b = P(i + wi, j, z + h), c = P(i + wi, j + wj, z + h), e = P(i, j + wj, z + h);
      const l0 = P(i, j + wj, z), l1 = P(i + wi, j + wj, z), r0 = P(i + wi, j, z);
      pix.fill([l0, l1, c, e], left); pix.fill([r0, l1, c, b], right); pix.fill([a, b, c, e], top);
      if (bands) for (const bd of bands) {
        const z0 = Math.max(bd[0], z), z1 = Math.min(bd[1], z + h); if (z1 <= z0) continue;
        pix.fill([P(i, j + wj, z0), P(i + wi, j + wj, z0), P(i + wi, j + wj, z1), P(i, j + wj, z1)], bd[2]);
        pix.fill([P(i + wi, j, z0), P(i + wi, j + wj, z0), P(i + wi, j + wj, z1), P(i + wi, j, z1)], shade(bd[2], 0.82));
        if (z1 >= z + h) pix.fill([a, b, c, e], shade(bd[2], 1.12));
        else pix.path([P(i, j + wj, z1), P(i + wi, j + wj, z1), P(i + wi, j, z1)], shade(bd[2], 0.7));
      }
      if (hi && h > 3) {
        const hl = shade(col, 1.3);
        pix.line(e[0], e[1] + 1, c[0], c[1] + 1, hl); pix.line(c[0] - 1, c[1] + 1, b[0] - 1, b[1] + 1, hl);
      }
      pix.path([l0, l1, r0, b, a, e, l0], OUT);
      pix.path([e, c, b], OUT);
      pix.line(c[0], c[1], l1[0], l1[1], OUT);
    }
    flat(i, j, wi, wj, col, z, outline) {
      this.p.poly([this.P(i, j, z), this.P(i + wi, j, z), this.P(i + wi, j + wj, z), this.P(i, j + wj, z)], col, outline === undefined ? OUT : outline);
    }
  }

  // ---- 層級排序 ----
  // A 在 B 後面：先看前後左右（i、j）是否分得開；兩者在地面上重疊時（疊在一起）才比上下（z）。
  const E = 1e-6;
  function behind(A, B) {
    if (A.i1 <= B.i0 + E || A.j1 <= B.j0 + E) return true;
    if (B.i1 <= A.i0 + E || B.j1 <= A.j0 + E) return false;
    return A.z1 <= B.z0 + E;
  }
  function depthSort(list) {
    const n = list.length, indeg = new Array(n).fill(0), adj = list.map(() => []);
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      const ab = behind(list[a], list[b]), ba = behind(list[b], list[a]);
      if (ab && !ba) { adj[a].push(b); indeg[b]++; }
      else if (ba && !ab) { adj[b].push(a); indeg[a]++; }
    }
    const key = o => (o.i0 + o.i1 + o.j0 + o.j1) / 2 + (o.z0 + o.z1) * 1e-4;
    const done = new Array(n).fill(false), out = [];
    for (let k = 0; k < n; k++) {
      let best = -1;
      for (let x = 0; x < n; x++) if (!done[x] && indeg[x] === 0 && (best < 0 || key(list[x]) < key(list[best]))) best = x;
      if (best < 0) for (let x = 0; x < n; x++) if (!done[x] && (best < 0 || key(list[x]) < key(list[best]))) best = x; // 有循環時退而求其次
      done[best] = true; out.push(list[best]);
      for (const y of adj[best]) indeg[y]--;
    }
    return out;
  }

  // 方塊零件 → 有 AABB 的可排序物件
  function boxPart(i, j, wi, wj, h, col, z, hi, bands) {
    z = z || 0;
    return { i0: i, i1: i + wi, j0: j, j1: j + wj, z0: z, z1: z + h, draw: iso => iso.box(i, j, wi, wj, h, col, z, hi, bands) };
  }

  // PNG（Node 測試用）
  function toPNG(pix, scale) {
    const zlib = require('zlib'); scale = scale || 1;
    const W = pix.w * scale, H = pix.h * scale, raw = Buffer.alloc((W * 4 + 1) * H);
    for (let y = 0; y < H; y++) {
      raw[y * (W * 4 + 1)] = 0;
      for (let x = 0; x < W; x++) {
        const v = pix.d[((y / scale) | 0) * pix.w + ((x / scale) | 0)], o = y * (W * 4 + 1) + 1 + x * 4;
        raw[o] = v & 255; raw[o + 1] = (v >>> 8) & 255; raw[o + 2] = (v >>> 16) & 255; raw[o + 3] = v ? 255 : 0;
      }
    }
    const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
    const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
    const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  }

  G.PX = { TW, TH, OUT, shade, pack, Pix, Iso, behind, depthSort, boxPart, toPNG };
})(typeof window !== 'undefined' ? window : globalThis);
