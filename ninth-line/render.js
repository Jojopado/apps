// 繪圖：放大看士兵，縮小變發光戰術圖
import { W, H, RING_R, RING_N, ROADS, riverY } from './sim.js';

const STATUS = { held: '#4ff0d0', crisis: '#ffc24d', lost: '#ff5a4d' };

function noise2(seed) {
  const n = 64, g = new Float32Array(n * n);
  let s = seed;
  for (let i = 0; i < g.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; g[i] = s / 4294967296; }
  const f = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), u = f(x - xi), v = f(y - yi);
    const at = (a, b) => g[((b & 63) * n + (a & 63))];
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * u;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * u;
    return a + (b - a) * v;
  };
}

function makeTerrain() {
  const w = 500, h = 800, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  const n = noise2(77);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const wx = x * 2, wy = y * 2;
    const e = (n(wx / 170, wy / 170) * 0.6 + n(wx / 70, wy / 70) * 0.3 + n(wx / 28, wy / 28) * 0.1);
    const edge = Math.max(0, Math.abs(wx - 500) - 330) / 170;
    const h1 = e + edge * edge * 0.9;
    const band = (h1 * 13) % 1;
    const line = band < 0.09 ? 1 : 0;
    const shade = 11 + edge * 16;
    const i = (y * w + x) * 4;
    d[i] = shade * 0.55 + line * 14;
    d[i + 1] = shade + line * 34;
    d[i + 2] = shade * 1.1 + line * 34;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function sprite(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  x.translate(size / 2, size / 2);
  draw(x);
  return c;
}
const zSprite = (col, r) => sprite(Math.ceil(r * 5), (x) => {
  x.shadowColor = col; x.shadowBlur = r * 1.3;
  x.fillStyle = col;
  x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill();
  x.shadowBlur = 0;
  x.fillStyle = '#1b0805';
  x.beginPath(); x.arc(r * 0.35, -r * 0.3, r * 0.22, 0, 7); x.arc(r * 0.35, r * 0.3, r * 0.22, 0, 7); x.fill();
});

export class Renderer {
  constructor(canvas) {
    this.c = canvas;
    this.x = canvas.getContext('2d', { alpha: false });
    this.terrain = makeTerrain();
    this.spr = { w: zSprite('#b3d36b', 4.6), r: zSprite('#ff8a4a', 3.8), b: zSprite('#e04a6a', 9) };
    this.shots = []; this.booms = []; this.marks = []; this.floats = [];
    this.vw = 1; this.vh = 1; this.dpr = 1;
    this.frame = 0;
  }
  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.vw = window.innerWidth; this.vh = window.innerHeight;
    this.c.width = Math.round(this.vw * this.dpr);
    this.c.height = Math.round(this.vh * this.dpr);
  }
  drain(G, sfx) {
    for (const f of G.fx) {
      if (f.k === 'shot') { if (this.shots.length < 90) this.shots.push({ ...f, t: f.heavy ? 0.1 : 0.06 }); if (sfx) sfx.shot(f.heavy); }
      else if (f.k === 'boom') { this.booms.push({ x: f.x, y: f.y, r: f.r, t: 0.45, T: 0.45 }); if (sfx) sfx.boom(); }
      else if (f.k === 'strafe') { this.booms.push({ x: f.x, y: f.y, r: 12, t: 0.18, T: 0.18 }); }
      else if (f.k === 'zdie' || f.k === 'die') {
        if (this.marks.length > 160) this.marks.shift();
        this.marks.push({ x: f.x, y: f.y, t: 9, c: f.k === 'die' ? '#7a1f1f' : '#50301c' });
      } else if (f.k === 'saved') this.floats.push({ x: f.x, y: f.y, t: 1.4, s: `+${f.n}` });
    }
    G.fx.length = 0;
  }
  draw(G, cam, ui, dt) {
    const x = this.x, z = cam.z * this.dpr, vcx = this.vw / 2, vcy = cam.cy;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = '#071014'; x.fillRect(0, 0, this.c.width, this.c.height);
    x.setTransform(z, 0, 0, z, (vcx - cam.x * cam.z) * this.dpr, (vcy - cam.y * cam.z) * this.dpr);
    const left = cam.x - vcx / cam.z, right = cam.x + vcx / cam.z, top = cam.y - vcy / cam.z, bot = cam.y + (this.vh - vcy) / cam.z;
    const seen = (a, m = 30) => a.x > left - m && a.x < right + m && a.y > top - m && a.y < bot + m;
    const street = Math.max(0, Math.min(1, (cam.z - 0.62) / 0.3)); // 0 = 戰術圖，1 = 街道
    const px = 1 / cam.z;

    x.imageSmoothingEnabled = true;
    x.drawImage(this.terrain, 0, 0, W, H);

    // 河與路
    x.lineJoin = 'round'; x.lineCap = 'round';
    x.strokeStyle = '#123d5c'; x.lineWidth = 62;
    x.beginPath();
    for (let wx = -10; wx <= W + 10; wx += 25) x.lineTo(wx, riverY(wx));
    x.stroke();
    x.strokeStyle = '#1b6ea5'; x.lineWidth = Math.max(1, 1.4 * px); x.globalAlpha = 0.6;
    for (const off of [-31, 31]) { x.beginPath(); for (let wx = -10; wx <= W + 10; wx += 25) x.lineTo(wx, riverY(wx) + off); x.stroke(); }
    x.globalAlpha = 1;
    x.strokeStyle = '#2d4a52'; x.lineWidth = 15;
    x.beginPath(); this._roads(x, G); x.stroke();
    x.strokeStyle = '#6f8f92'; x.lineWidth = 1.2; x.setLineDash([10, 12]);
    x.beginPath(); this._roads(x, G); x.stroke();
    x.setLineDash([]);
    // 橋
    x.fillStyle = '#4a5e63'; x.fillRect(466, riverY(510) - 38, 88, 76);
    x.strokeStyle = '#8fb0b3'; x.lineWidth = 2; x.strokeRect(466, riverY(510) - 38, 88, 76);

    // 地面痕跡
    for (const m of this.marks) {
      m.t -= dt;
      if (street <= 0 || !seen(m)) continue;
      x.globalAlpha = Math.min(0.55, m.t / 4) * street;
      x.fillStyle = m.c;
      x.beginPath(); x.arc(m.x, m.y, 4.5, 0, 7); x.fill();
    }
    this.marks = this.marks.filter((m) => m.t > 0);
    x.globalAlpha = 1;

    for (const s of G.sectors) this._sector(x, G, s, ui, px, street);

    // 機槍塔
    for (const t of G.turrets) {
      if (!seen(t)) continue;
      x.fillStyle = '#20343b'; x.strokeStyle = '#4ff0d0'; x.lineWidth = 1.5;
      x.beginPath(); x.arc(t.x, t.y, 9, 0, 7); x.fill(); x.stroke();
      x.strokeStyle = '#d8f0ec'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(t.x, t.y); x.lineTo(t.x + Math.cos(t.a) * 14, t.y + Math.sin(t.a) * 14); x.stroke();
    }

    // 喪屍：縮小畫點，放大畫小人
    if (street < 1) {
      x.globalAlpha = 1 - street;
      x.fillStyle = '#ff5a4d';
      const s = Math.max(4, 3 * px);
      for (const q of G.zombies) if (seen(q)) x.fillRect(q.x - s / 2, q.y - s / 2, s, s);
      x.globalAlpha = 1;
    }
    if (street > 0) {
      x.globalAlpha = street;
      for (const q of G.zombies) {
        if (!seen(q)) continue;
        const sp = this.spr[q.type], sz = sp.width;
        x.setTransform(z * Math.cos(q.a), z * Math.sin(q.a), -z * Math.sin(q.a), z * Math.cos(q.a), (vcx + (q.x - cam.x) * cam.z) * this.dpr, (vcy + (q.y - cam.y) * cam.z) * this.dpr);
        x.drawImage(sp, -sz / 2, -sz / 2);
      }
      x.setTransform(z, 0, 0, z, (vcx - cam.x * cam.z) * this.dpr, (vcy - cam.y * cam.z) * this.dpr);
      x.globalAlpha = 1;
    }

    // 士兵
    if (street > 0) {
      x.globalAlpha = street;
      for (const q of G.squads) {
        if (q.carried) continue;
        const sel = ui.sel === q.id;
        for (const s of q.soldiers) {
          if (!seen(s)) continue;
          x.strokeStyle = '#d8f0ec'; x.lineWidth = 1.6;
          x.beginPath(); x.moveTo(s.x, s.y); x.lineTo(s.x + Math.cos(s.a) * 8, s.y + Math.sin(s.a) * 8); x.stroke();
          x.fillStyle = s.hp < 16 ? '#ff9a4d' : sel ? '#8bfff0' : '#4ff0d0';
          x.beginPath(); x.arc(s.x, s.y, 4.2, 0, 7); x.fill();
        }
      }
      x.globalAlpha = 1;
    }

    // 載具
    for (const v of G.vehicles) if (seen(v, 60)) this._vehicle(x, v, street);

    // 槍線、爆炸
    x.lineWidth = Math.max(0.8, 0.9 * px);
    for (const s of this.shots) {
      s.t -= dt;
      if (!seen(s, 150)) continue;
      x.strokeStyle = s.heavy ? '#ffd27a' : '#fff0b0';
      x.beginPath(); x.moveTo(s.x, s.y); x.lineTo(s.x2, s.y2); x.stroke();
    }
    this.shots = this.shots.filter((s) => s.t > 0);
    for (const b of this.booms) {
      b.t -= dt;
      const k = 1 - b.t / b.T;
      x.globalAlpha = Math.max(0, 1 - k);
      x.fillStyle = '#ffb45a';
      x.beginPath(); x.arc(b.x, b.y, b.r * (0.35 + k * 0.5), 0, 7); x.fill();
      x.strokeStyle = '#fff2c8'; x.lineWidth = 2.5;
      x.beginPath(); x.arc(b.x, b.y, b.r * (0.5 + k * 0.7), 0, 7); x.stroke();
    }
    x.globalAlpha = 1;
    this.booms = this.booms.filter((b) => b.t > 0);

    // 空襲預告
    for (const s of G.strikes) {
      x.strokeStyle = '#ff5a4d'; x.lineWidth = Math.max(2, 2 * px); x.setLineDash([14, 10]);
      if (s.type === 'arty') {
        x.beginPath(); x.arc(s.x, s.y, 135, 0, 7); x.stroke();
        x.fillStyle = 'rgba(255,90,77,.13)'; x.fill();
      } else {
        x.strokeRect(s.x - 34, s.y - 230, 68, 460);
        x.fillStyle = 'rgba(255,90,77,.1)'; x.fillRect(s.x - 34, s.y - 230, 68, 460);
      }
      x.setLineDash([]);
    }

    // 選取與路線
    const sel = ui.selUnit;
    if (sel) this._selection(x, G, sel, px);

    // 部隊圖示（縮小時的主角）
    const iconA = Math.max(0.35, 1 - street);
    for (const u of [...G.squads, ...G.vehicles]) {
      if (u.kind === 'squad' && u.carried) continue;
      if (seen(u, 60)) this._icon(x, u, px, iconA, ui.sel === u.id);
    }

    for (const s of G.sectors) this._label(x, s, px);

    // 支援模式預覽
    if (ui.preview) {
      x.strokeStyle = '#ff5a4d'; x.lineWidth = 2 * px;
      x.beginPath(); x.arc(ui.preview.x, ui.preview.y, ui.supMode === 'arty' ? 135 : 40, 0, 7); x.stroke();
    }

    for (const f of this.floats) {
      f.t -= dt; f.y -= dt * 30;
      x.font = `700 ${16 * px}px system-ui`; x.fillStyle = '#7dff9a'; x.textAlign = 'center';
      x.fillText(f.s, f.x, f.y);
    }
    this.floats = this.floats.filter((f) => f.t > 0);
    this.frame++;
  }
  _roads(x, G) {
    for (const [a, b, mids] of ROADS) {
      const A = G.byId[a], B = G.byId[b];
      x.moveTo(A.x, A.y);
      for (const [mx, my] of mids) x.lineTo(mx, my);
      x.lineTo(B.x, B.y);
    }
  }
  _sector(x, G, s, ui, px, street) {
    const col = STATUS[s.status], sel = ui.selSector === s.id;
    x.save();
    x.globalAlpha = 0.17 + (s.status === 'crisis' ? 0.13 * (0.5 + 0.5 * Math.sin(this.frame * 0.18)) : 0);
    x.fillStyle = col;
    x.beginPath(); x.arc(s.x, s.y, 135, 0, 7); x.fill();
    x.globalAlpha = sel ? 1 : 0.55;
    x.strokeStyle = col; x.lineWidth = (sel ? 3 : 1.5) * px;
    x.beginPath(); x.arc(s.x, s.y, 135, 0, 7); x.stroke();
    x.restore();
    // 建物
    if (street > 0.02) {
      x.globalAlpha = street;
      let r = (s.x * 13 + s.y) % 97;
      for (let i = 0; i < 7; i++) {
        r = (r * 31 + 17) % 97;
        const a = (i / 7) * 6.28 + r * 0.01, d = 22 + (r % 26), bw = 18 + (r % 14), bh = 14 + (r % 10);
        x.fillStyle = s.status === 'lost' ? '#2c1a1a' : '#1d3039';
        x.strokeStyle = '#3b5a64'; x.lineWidth = 1;
        x.fillRect(s.x + Math.cos(a) * d - bw / 2, s.y + Math.sin(a) * d - bh / 2, bw, bh);
        x.strokeRect(s.x + Math.cos(a) * d - bw / 2, s.y + Math.sin(a) * d - bh / 2, bw, bh);
      }
      // 平民
      x.fillStyle = '#ffe9a8';
      for (let i = 0; i < Math.min(s.civ, 24); i++) {
        const a = i * 2.399, d = 6 + i * 1.5;
        x.beginPath(); x.arc(s.x + Math.cos(a + this.frame * 0.002) * d, s.y + Math.sin(a + this.frame * 0.002) * d, 2.1, 0, 7); x.fill();
      }
      x.globalAlpha = 1;
    }
    // 圍牆
    if (s.ring) {
      x.lineWidth = 6; x.lineCap = 'butt';
      for (let i = 0; i < RING_N; i++) {
        const h = s.ring[i];
        if (h <= 0) continue;
        const a0 = (i / RING_N) * Math.PI * 2 - Math.PI, a1 = ((i + 1) / RING_N) * Math.PI * 2 - Math.PI;
        const k = h / s.ringMax;
        x.strokeStyle = k > 0.6 ? '#8fd6e0' : k > 0.3 ? '#ffc24d' : '#ff5a4d';
        x.beginPath(); x.arc(s.x, s.y, RING_R, a0 + 0.03, a1 - 0.03); x.stroke();
      }
      x.lineCap = 'round';
    }
    for (const b of G.builds) if (b.s === s) {
      x.strokeStyle = '#ffc24d'; x.lineWidth = 4 * px;
      x.beginPath(); x.arc(s.x, s.y, 106, -1.57, -1.57 + 6.283 * (1 - b.t / b.total)); x.stroke();
    }
  }
  _label(x, s, px) {
    const col = STATUS[s.status];
    x.textAlign = 'center';
    const fs = 13 * px;
    x.font = `700 ${fs}px system-ui,"Noto Sans TC",sans-serif`;
    const yy = s.y - 112;
    const label = s.id === 'hq' ? `${s.name}` : `${s.name} ${s.status === 'lost' ? '淪陷' : `民${s.civ}`}`;
    x.lineWidth = 3 * px; x.strokeStyle = '#071014'; x.strokeText(label, s.x, yy);
    x.fillStyle = col; x.fillText(label, s.x, yy);
    if (s.id !== 'hq' && s.status !== 'lost') {
      const t = `補${Math.round(s.stock)}`;
      x.font = `${11 * px}px system-ui`;
      x.strokeText(t, s.x, yy + 14 * px); x.fillStyle = '#b9d4d0'; x.fillText(t, s.x, yy + 14 * px);
    }
  }
  _vehicle(x, v, street) {
    x.save();
    x.translate(v.x, v.y); x.rotate(v.a);
    x.globalAlpha = Math.max(0.35, street);
    if (v.kind === 'truck') {
      x.fillStyle = '#3f6f6a'; x.fillRect(-13, -7, 19, 14);
      x.fillStyle = '#c9e8e3'; x.fillRect(6, -6, 8, 12);
      if (v.civ) { x.fillStyle = '#ffe9a8'; x.fillRect(-11, -4, 14, 8); }
    } else if (v.kind === 'apc') {
      x.fillStyle = '#4b6660'; x.fillRect(-15, -9, 30, 18);
      x.fillStyle = '#b6d3cd'; x.beginPath(); x.arc(0, 0, 6.5, 0, 7); x.fill();
      x.fillRect(0, -1.5, 19, 3);
    } else {
      x.fillStyle = '#6c8a8f'; x.fillRect(-16, -2, 16, 4);
      x.fillRect(-18, -6, 4, 12);
      x.beginPath(); x.ellipse(3, 0, 11, 6.5, 0, 0, 7); x.fill();
      x.restore(); x.save();
      x.translate(v.x, v.y); x.globalAlpha = 0.35 * Math.max(0.35, street);
      x.strokeStyle = '#d8f0ec'; x.lineWidth = 1.5;
      const r = (performance.now() / 45) % 6.283;
      for (const o of [0, 1.571]) { x.beginPath(); x.moveTo(Math.cos(r + o) * -21, Math.sin(r + o) * -21); x.lineTo(Math.cos(r + o) * 21, Math.sin(r + o) * 21); x.stroke(); }
    }
    x.restore();
  }
  _selection(x, G, u, px) {
    x.strokeStyle = '#4ff0d0'; x.lineWidth = 2 * px;
    if (u.kind === 'squad' && u.tx !== null) {
      x.setLineDash([8 * px, 6 * px]); x.beginPath(); x.moveTo(u.x, u.y); x.lineTo(u.tx, u.ty); x.stroke(); x.setLineDash([]);
    } else if (u.kind !== 'squad' && u.kind !== 'heli' && u.pi < u.path.length) {
      x.setLineDash([8 * px, 6 * px]); x.beginPath(); x.moveTo(u.x, u.y);
      for (let i = u.pi; i < u.path.length; i++) x.lineTo(u.path[i].x, u.path[i].y);
      x.stroke(); x.setLineDash([]);
    } else if (u.kind === 'heli' && u.tx !== null && u.mode !== 'idle') {
      x.setLineDash([8 * px, 6 * px]); x.beginPath(); x.moveTo(u.x, u.y); x.lineTo(u.tx ?? u.x, u.ty ?? u.y); x.stroke(); x.setLineDash([]);
    }
    if (u.kind === 'squad' || u.kind === 'apc') {
      x.globalAlpha = 0.5; x.lineWidth = px;
      x.beginPath(); x.arc(u.x, u.y, u.kind === 'squad' ? 112 : 150, 0, 7); x.stroke();
      x.globalAlpha = 1;
    }
    if (u.kind === 'truck' && u.loop) {
      const s = G.byId[u.loop];
      x.strokeStyle = '#ffe9a8'; x.lineWidth = 2 * px;
      x.beginPath(); x.arc(s.x, s.y, 120, 0, 7); x.stroke();
    }
  }
  // 北約軍隊符號風格的小方框
  _icon(x, u, px, alpha, sel) {
    const w = 15 * px, h = 10 * px, off = u.kind === 'squad' ? 0 : -18 * px;
    x.save();
    x.translate(u.x, u.y + off);
    x.globalAlpha = alpha;
    if (sel) { x.fillStyle = 'rgba(79,240,208,.25)'; x.beginPath(); x.arc(0, 0, 20 * px, 0, 7); x.fill(); }
    x.fillStyle = sel ? '#14463f' : '#0d2a30';
    x.strokeStyle = sel ? '#fff' : '#4ff0d0'; x.lineWidth = 1.5 * px;
    x.fillRect(-w, -h, w * 2, h * 2); x.strokeRect(-w, -h, w * 2, h * 2);
    x.beginPath();
    if (u.kind === 'squad') { x.moveTo(-w, -h); x.lineTo(w, h); x.moveTo(w, -h); x.lineTo(-w, h); }
    else if (u.kind === 'apc') { x.ellipse(0, 0, w * 0.68, h * 0.55, 0, 0, 7); }
    else if (u.kind === 'truck') { x.moveTo(-w * 0.7, 0); x.lineTo(w * 0.7, 0); x.moveTo(-w * 0.4, h * 0.65); x.arc(-w * 0.5, h * 0.65, 1.5 * px, 0, 7); x.moveTo(w * 0.6, h * 0.65); x.arc(w * 0.5, h * 0.65, 1.5 * px, 0, 7); }
    else { x.moveTo(-w * 0.7, -h * 0.5); x.lineTo(w * 0.7, h * 0.5); x.lineTo(w * 0.7, -h * 0.5); x.lineTo(-w * 0.7, h * 0.5); x.closePath(); }
    x.stroke();
    // 血量與彈藥
    const hpk = u.kind === 'squad' ? u.soldiers.length / 8 : u.hp / u.hpMax;
    const amk = u.kind === 'truck' ? u.civ / 12 : u.ammo / Math.max(1, u.ammoMax);
    x.fillStyle = '#071014'; x.fillRect(-w, h + 2 * px, w * 2, 6 * px);
    x.fillStyle = hpk > 0.5 ? '#7dff9a' : hpk > 0.25 ? '#ffc24d' : '#ff5a4d'; x.fillRect(-w, h + 2 * px, w * 2 * Math.max(0, Math.min(1, hpk)), 2.6 * px);
    x.fillStyle = u.kind === 'truck' ? '#ffe9a8' : amk > 0.25 ? '#ffc24d' : '#ff5a4d'; x.fillRect(-w, h + 5.2 * px, w * 2 * Math.max(0, Math.min(1, amk)), 2.6 * px);
    x.restore();
  }
}
