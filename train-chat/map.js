'use strict';
// ---------- 台灣地圖選站（拖曳移動、雙指／滾輪縮放、點車站切換） ----------
// 用到 app.js 的 S、ST、TR、MAP 資料與共用函式；app.js 的 openStations 會呼叫這裡
let MAP = null;
const PX = lo => (lo - 119.9) * 91.6, PY = la => (25.4 - la) * 100;   // 簡單等距投影（緯度 23.7° 修正）
const MV = { x: 0, y: 0, w: 200, h: 360, sel: null, el: null };
async function loadMap() { if (!MAP) MAP = await fetch('data/map.json').then(r => r.json()); return MAP; }
// 只有精選班次會停的站可以選；其他站畫成小灰點
const mapStations = () => Object.keys(MAP.gps).filter(c => ST[c] && !stName(c).includes('-') && (CFG.allTrains || MAP.count[c]));
const offStations = () => Object.keys(MAP.gps).filter(c => ST[c] && !stName(c).includes('-') && !CFG.allTrains && !MAP.count[c]);
const sxy = c => { const g = MAP.gps[c]; return [PX(g[0]), PY(g[1])]; };

async function openStations() {
  try { await loadMap(); } catch (e) { toast('地圖載入失敗'); return; }
  const rideTr = S.ride && TR[S.ride.key];
  openModal(`<div class="mapHead"><b>${rideTr ? '🗺 我的位置' : '🗺 選車站'}</b>
      <input type="search" id="stQ" placeholder="搜尋站名（花蓮、Taichung）"><button class="mapX" id="mapClose">✕</button></div>
    <div id="stL" class="stlist mapRes" hidden></div>
    <div id="mapBox"><svg id="mapSvg" xmlns="http://www.w3.org/2000/svg"></svg>
      <div class="mapZoom"><button data-z="0.6">＋</button><button data-z="1.6">－</button><button data-z="me">📍</button></div>
      <div class="mapLegend"><span><i style="background:#ffcf4a"></i>已蓋章</span><span><i style="background:#fff"></i>還沒去</span><span><i style="background:#e0441f"></i>你在這</span><span><i style="background:#a9b1bd;width:6px;height:6px;border:0"></i>沒開放</span></div></div>
    <div id="mapCard"></div>`);
  $('modalBox').classList.add('mapModal');
  $('mapClose').onclick = closeModal;
  MV.el = $('mapSvg'); MV.sel = null;
  const box = $('mapBox').getBoundingClientRect(), asp = box.height / Math.max(1, box.width);
  MV.w = Math.max(205, 365 / asp); MV.h = MV.w * asp; MV.x = 100 - MV.w / 2; MV.y = 178 - MV.h / 2;     // 整個台灣
  const here = rideTr ? null : String(S.station);
  if (here && MAP.gps[here]) { MV.sel = here; zoomTo(here, 120); }
  else { const p = myMapPos(); if (p) { MV.x = p[0] - MV.w / 2; MV.y = p[1] - MV.h / 2; } }
  drawMap(); mapCard(); bindMap();
  $('stQ').oninput = () => {
    const q = $('stQ').value.trim().toLowerCase(), L = $('stL');
    if (!q) { L.hidden = true; return; }
    const hit = mapStations().filter(c => stName(c).includes(q) || stEn(c).toLowerCase().includes(q)).slice(0, 8);
    L.hidden = false;
    L.innerHTML = hit.map(c => `<div data-c="${c}">${S.stamps[c] ? '✅ ' : ''}${esc(stName(c))}<small>${esc(stEn(c))}</small></div>`).join('') || '<div class="empty">找不到</div>';
  };
  $('stL').onclick = e => {
    const c = e.target.closest('[data-c]'); if (!c) return;
    $('stL').hidden = true; $('stQ').value = ''; $('stQ').blur();
    MV.sel = c.dataset.c; zoomTo(MV.sel, 60); drawMap(); mapCard();
  };
  $('mapBox').querySelector('.mapZoom').onclick = e => {
    const z = e.target.dataset.z; if (!z) return;
    if (z === 'me') { const p = myMapPos(); if (p) { MV.x = p[0] - MV.w / 2; MV.y = p[1] - MV.h / 2; } }
    else zoomAt(+z, MV.x + MV.w / 2, MV.y + MV.h / 2);
    drawMap();
  };
}
function zoomTo(c, w) { const [x, y] = sxy(c), r = MV.h / MV.w; MV.w = w; MV.h = w * r; MV.x = x - MV.w / 2; MV.y = y - MV.h / 2; }
function zoomAt(f, cx, cy) {
  const nw = clamp(MV.w * f, 12, fitW()); f = nw / MV.w;
  MV.x = cx - (cx - MV.x) * f; MV.y = cy - (cy - MV.y) * f; MV.w = nw; MV.h *= f;
}
// 最遠只能縮到剛好看見整個台灣；拖曳時畫面中心不能離開台灣
const fitW = () => Math.max(205, 365 * MV.w / Math.max(1, MV.h));
function clampView() {
  const cx = clamp(MV.x + MV.w / 2, Math.min(100, MV.w / 2 - 10), Math.max(100, 210 - MV.w / 2));
  const cy = clamp(MV.y + MV.h / 2, Math.min(178, MV.h / 2 - 10), Math.max(178, 366 - MV.h / 2));
  MV.x = cx - MV.w / 2; MV.y = cy - MV.h / 2;
}
// 我在地圖上的位置：車上就用列車位置內插
function myMapPos() {
  if (!MAP) return null;
  if (!S.ride) return MAP.gps[S.station] ? sxy(String(S.station)) : null;
  const tr = TR[S.ride.key]; if (!tr) return null;
  const p = trainPos(tr, now()), a = String(tr.stops[p.i].c);
  if (p.kind !== 'move' || !MAP.gps[a] || !MAP.gps[tr.stops[p.i + 1].c]) return MAP.gps[a] ? sxy(a) : null;
  const A = sxy(a), B = sxy(String(tr.stops[p.i + 1].c));
  return [A[0] + (B[0] - A[0]) * p.f, A[1] + (B[1] - A[1]) * p.f];
}
function drawMap() {
  if (!MV.el || !MV.el.isConnected) return;
  const svg = MV.el, k = MV.w / Math.max(1, svg.clientWidth);   // 1 螢幕像素 = k 地圖單位
  clampView();
  svg.setAttribute('viewBox', `${MV.x} ${MV.y} ${MV.w} ${MV.h}`);
  const o = ['<rect x="-500" y="-500" width="1300" height="1400" fill="#bfe0f2"/>'];
  for (const r of MAP.coast) o.push(`<path d="M${r.map(p => PX(p[0]).toFixed(2) + ' ' + PY(p[1]).toFixed(2)).join('L')}Z" fill="#f3eedf" stroke="#9fb7a2" stroke-width="${0.8 * k}"/>`);
  o.push(`<g stroke="#5b6b82" stroke-width="${3.2 * k}" stroke-linecap="round">`);
  for (const [a, b] of MAP.edges) { const A = sxy(a), B = sxy(b); o.push(`<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}"/>`); }
  o.push('</g>');
  const rideTr = S.ride && TR[S.ride.key];
  if (rideTr) {   // 我這班車的路線
    const pts = rideTr.stops.filter(s => MAP.gps[s.c]).map(s => sxy(String(s.c)).join(' '));
    o.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${clsOf(rideTr.cls).k}" stroke-width="${5 * k}" stroke-linejoin="round" opacity=".75"/>`);
  }
  for (const c of offStations()) { const [x, y] = sxy(c); o.push(`<circle cx="${x}" cy="${y}" r="${1.6 * k}" fill="#a9b1bd"/>`); }
  const codes = mapStations(), zoomed = MV.w < 70;
  const HUBS = ['臺北', '臺中', '高雄', '花蓮', '臺東', '宜蘭', '新竹', '嘉義', '臺南', '屏東', '基隆', '彰化'];   // 先顯示這些站名
  const hub = c => { const i = HUBS.indexOf(stName(c)); return i < 0 ? 99 : i; };
  const rank = [...codes].sort((a, b) => hub(a) - hub(b) || (MAP.count[b] || 0) - (MAP.count[a] || 0));
  const major = new Set(rank.slice(0, MV.w < 120 ? 40 : 18));
  for (const c of codes) {
    const [x, y] = sxy(c), me = !S.ride && +c === S.station, sel = MV.sel === c;
    const r = (major.has(c) ? 4.2 : 3) * k * (sel ? 1.5 : 1);
    o.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${me ? '#e0441f' : S.stamps[c] ? '#ffcf4a' : '#fff'}" stroke="#2b3446" stroke-width="${(sel ? 2.2 : 1.3) * k}"/>`);
  }
  // 站名：大站一直顯示，放大後全部顯示（字固定螢幕大小）
  o.push(`<g font-family="sans-serif" font-weight="700" paint-order="stroke" stroke="#f3eedf" stroke-width="${3 * k}" fill="#2b3446">`);
  const placed = [], order = [...(MV.sel ? [MV.sel] : []), ...rank.filter(c => c !== MV.sel)];
  for (const c of order) {
    if (!(zoomed || major.has(c) || MV.sel === c)) continue;
    const [x, y] = sxy(c), fs = (MV.sel === c ? 15 : major.has(c) ? 12 : 10.5) * k;
    const w = stName(c).length * fs + 6 * k, box = [x + 5 * k, y - fs * 0.6, x + 5 * k + w, y + fs * 0.6];
    if (placed.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;   // 跟別的站名重疊就不畫（大站優先）
    placed.push(box);
    o.push(`<text x="${x + 6 * k}" y="${y + fs * 0.35}" font-size="${fs}">${esc(stName(c))}</text>`);
  }
  o.push('</g>');
  const me = myMapPos();
  if (me) o.push(`<g transform="translate(${me[0]} ${me[1]}) scale(${k})"><circle r="11" fill="#e0441f" opacity=".25"><animate attributeName="r" values="6;16;6" dur="1.6s" repeatCount="indefinite"/></circle>
    <text y="-9" font-size="18" text-anchor="middle">${S.ride ? '🚆' : '📍'}</text></g>`);
  svg.innerHTML = o.join('');
}
function mapCard() {
  const el = $('mapCard'); if (!el) return;
  const c = MV.sel;
  if (!c) { el.innerHTML = `<div class="mcHint">${S.ride ? '🚆 是你現在的位置。在車上不能換站，到站後再來選。' : '點地圖上的車站，或上面搜尋。兩指／滾輪可以縮放。'}</div>`; return; }
  const t = now(), deps = departures(+c, t).filter(d => d.d >= t), n = MAP.count[c] || 0;
  const here = !S.ride && +c === S.station, st = S.stamps[c];
  el.innerHTML = `<div class="mc"><div class="mcTop"><div><div class="mcName">${esc(stName(c))}</div><div class="mcEn">${esc(stEn(c))}</div></div>
      ${st ? `<div class="mcStamp">${stampSVG(c, st.d)}</div>` : '<div class="mcNo">還沒<br>蓋章</div>'}</div>
    <div class="mcInfo">每天約 ${n} 班開放班次${deps.length ? `<br>下一班 <b>${hm(deps[0].d)}</b> ${badge(deps[0].tr.cls)} 往${esc(destName(deps[0].tr))}` : ''}</div>
    ${S.ride ? '' : here ? '<button class="btn ghost" disabled>📍 你在這站</button>' : S.sel ? '<button class="btn ghost" disabled>🎫 有車票時不能換站（先取消車票）</button>' : `<button class="btn" id="goSt">🚉 切換到 ${esc(stName(c))}</button>`}</div>`;
  const go = $('goSt');
  if (go) go.onclick = () => {
    S.station = +c; S.sel = null; openRow = null; S.x = 30 + Math.random() * 100; S.y = 50;
    save(); Net.join(roomName()); dirty = true; listSig = ''; closeModal(); toast('來到 ' + stName(c) + ' 站');
  };
}
function bindMap() {
  const svg = MV.el, pts = new Map();
  let moved = 0, pinch = 0, raf = 0;
  const redraw = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; drawMap(); }); };
  const toMap = (cx, cy) => { const r = svg.getBoundingClientRect(); return [MV.x + (cx - r.left) / r.width * MV.w, MV.y + (cy - r.top) / r.height * MV.h]; };
  svg.onpointerdown = e => { try { svg.setPointerCapture(e.pointerId); } catch (x) { } pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; pinch = 0; };
  svg.onpointermove = e => {
    if (!pts.has(e.pointerId)) return;
    const old = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    const r = svg.getBoundingClientRect();
    if (pts.size === 1) {
      const dx = e.clientX - old[0], dy = e.clientY - old[1]; moved += Math.abs(dx) + Math.abs(dy);
      MV.x -= dx / r.width * MV.w; MV.y -= dy / r.height * MV.h; redraw();
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch && d > 0) { const [cx, cy] = toMap((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); zoomAt(pinch / d, cx, cy); redraw(); }
      pinch = d; moved = 99;
    }
  };
  svg.onpointerup = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size || moved > 8) return;
    // 點一下：找最近的車站（螢幕 22px 內）
    const [mx, my] = toMap(e.clientX, e.clientY), k = MV.w / svg.clientWidth;
    let best = null, bd = 22 * k;
    for (const c of mapStations()) { const [x, y] = sxy(c), d = Math.hypot(x - mx, y - my); if (d < bd) { bd = d; best = c; } }
    MV.sel = best; drawMap(); mapCard();
  };
  svg.onpointercancel = e => pts.delete(e.pointerId);
  svg.onwheel = e => { e.preventDefault(); const [cx, cy] = toMap(e.clientX, e.clientY); zoomAt(e.deltaY > 0 ? 1.18 : 0.85, cx, cy); redraw(); };
}
