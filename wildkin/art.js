// WILDKIN 美術：角色、地形、圖示都是程式畫的 SVG（字型、音效、配樂是外部素材，見 credits）
const eyes = (y = 54, gap = 14, c = '#2b2320') => `
  <circle cx="${50 - gap}" cy="${y}" r="5.4" fill="${c}"/><circle cx="${50 + gap}" cy="${y}" r="5.4" fill="${c}"/>
  <circle cx="${50 - gap + 1.9}" cy="${y - 2}" r="1.9" fill="#fff"/><circle cx="${50 + gap + 1.9}" cy="${y - 2}" r="1.9" fill="#fff"/>`;
const cheeks = (y = 63, gap = 23, c = '#f28f9a') => `
  <ellipse cx="${50 - gap}" cy="${y}" rx="6" ry="3.6" fill="${c}" opacity=".55"/><ellipse cx="${50 + gap}" cy="${y}" rx="6" ry="3.6" fill="${c}" opacity=".55"/>`;
const smile = (y = 66) => `<path d="M44 ${y} Q47 ${y + 4} 50 ${y} Q53 ${y + 4} 56 ${y}" fill="none" stroke="#2b2320" stroke-width="2" stroke-linecap="round"/>`;
const nose = (y = 62, c = '#2b2320') => `<ellipse cx="50" cy="${y}" rx="3.6" ry="2.6" fill="${c}"/>`;

const DRAW = {
  fox: () => `
    <path d="M16 46 L13 9 L44 27Z" fill="#e4813a"/><path d="M84 46 L87 9 L56 27Z" fill="#e4813a"/>
    <path d="M22 37 L20 18 L37 28Z" fill="#fbe3cc"/><path d="M78 37 L80 18 L63 28Z" fill="#fbe3cc"/>
    <path d="M50 22 C79 22 90 42 87 57 C83 75 66 86 50 89 C34 86 17 75 13 57 C10 42 21 22 50 22Z" fill="#ec8b42"/>
    <path d="M50 89 C34 86 17 75 14 58 C29 56 41 62 50 72 C59 62 71 56 86 58 C83 75 66 86 50 89Z" fill="#fff4e6"/>
    ${eyes(53, 17)}${nose(70)}${cheeks(66, 28)}`,
  rabbit: () => `
    <ellipse cx="34" cy="24" rx="10" ry="24" fill="#fbeef0" transform="rotate(-9 34 24)"/><ellipse cx="66" cy="24" rx="10" ry="24" fill="#fbeef0" transform="rotate(9 66 24)"/>
    <ellipse cx="34" cy="25" rx="5" ry="17" fill="#f6b4c4" transform="rotate(-9 34 25)"/><ellipse cx="66" cy="25" rx="5" ry="17" fill="#f6b4c4" transform="rotate(9 66 25)"/>
    <ellipse cx="50" cy="63" rx="35" ry="30" fill="#fff6f4"/>
    ${eyes(60, 15)}<path d="M46.5 67 L53.5 67 L50 71Z" fill="#ea8ba2"/>${smile(72)}${cheeks(69, 24)}`,
  bear: () => `
    <circle cx="23" cy="30" r="14" fill="#8f5e3f"/><circle cx="77" cy="30" r="14" fill="#8f5e3f"/><circle cx="23" cy="30" r="7" fill="#d9a77f"/><circle cx="77" cy="30" r="7" fill="#d9a77f"/>
    <ellipse cx="50" cy="58" rx="39" ry="35" fill="#9c6a48"/><ellipse cx="50" cy="70" rx="18" ry="14" fill="#ecd0b0"/>
    ${eyes(53, 17)}${nose(65)}${smile(72)}${cheeks(66, 30)}`,
  penguin: () => `
    <ellipse cx="50" cy="55" rx="39" ry="38" fill="#2d4258"/>
    <path d="M50 37 C57 28 76 31 79 49 C83 69 67 87 50 87 C33 87 17 69 21 49 C24 31 43 28 50 37Z" fill="#fff"/>
    ${eyes(54, 15)}<path d="M41 62 Q50 57 59 62 Q50 73 41 62Z" fill="#f4a93a"/>${cheeks(66, 24)}`,
  frog: () => `
    <circle cx="28" cy="29" r="16" fill="#79b95a"/><circle cx="72" cy="29" r="16" fill="#79b95a"/><circle cx="28" cy="28" r="10.5" fill="#fff"/><circle cx="72" cy="28" r="10.5" fill="#fff"/>
    <circle cx="29" cy="29" r="6.6" fill="#2b2320"/><circle cx="73" cy="29" r="6.6" fill="#2b2320"/><circle cx="31" cy="26.5" r="2.2" fill="#fff"/><circle cx="75" cy="26.5" r="2.2" fill="#fff"/>
    <ellipse cx="50" cy="63" rx="40" ry="29" fill="#86c566"/><ellipse cx="50" cy="77" rx="26" ry="13" fill="#d3ecb2"/>
    <path d="M30 63 Q50 76 70 63" fill="none" stroke="#2b2320" stroke-width="2.4" stroke-linecap="round"/>${cheeks(60, 31)}`,
  cat: () => `
    <path d="M17 45 L18 11 L44 30Z" fill="#8d7ba8"/><path d="M83 45 L82 11 L56 30Z" fill="#8d7ba8"/>
    <path d="M24 37 L24 21 L37 31Z" fill="#f2bfd0"/><path d="M76 37 L76 21 L63 31Z" fill="#f2bfd0"/>
    <ellipse cx="50" cy="58" rx="39" ry="33" fill="#9d8cb8"/>
    <path d="M50 26 L46 40 L50 38 L54 40Z M34 29 L35 41 L38 37Z M66 29 L65 41 L62 37Z" fill="#73618f"/>
    <ellipse cx="50" cy="71" rx="17" ry="12" fill="#f4eef7"/>
    ${eyes(55, 17)}<path d="M46.5 65 L53.5 65 L50 69Z" fill="#ea8ba2"/>${smile(70)}
    <path d="M18 62 L4 59 M18 68 L4 71 M82 62 L96 59 M82 68 L96 71" stroke="#5f5173" stroke-width="1.8" stroke-linecap="round"/>`,
  squirrel: () => `
    <path d="M73 92 C100 82 100 34 76 30 C62 28 62 47 72 50 C84 54 78 78 62 86Z" fill="#b86f38"/>
    <path d="M21 42 L18 13 L41 33Z" fill="#c67e43"/><path d="M71 42 L74 13 L51 33Z" fill="#c67e43"/>
    <ellipse cx="46" cy="60" rx="33" ry="31" fill="#cd8a4f"/><ellipse cx="46" cy="71" rx="17" ry="14" fill="#f9e7cf"/>
    <g transform="translate(-4 0)">${eyes(55, 14)}${nose(66)}${smile(71)}${cheeks(67, 24)}</g>
    <rect x="42" y="74" width="4.5" height="7" rx="1.2" fill="#fff"/><rect x="46.5" y="74" width="4.5" height="7" rx="1.2" fill="#fff"/>`,
  deer: () => `
    <path d="M33 30 L28 7 M29 17 L19 9 M31 22 L20 21 M67 30 L72 7 M71 17 L81 9 M69 22 L80 21" stroke="#8a6545" stroke-width="4.4" stroke-linecap="round" fill="none"/>
    <ellipse cx="17" cy="45" rx="15" ry="8" fill="#c9915d" transform="rotate(-20 17 45)"/><ellipse cx="83" cy="45" rx="15" ry="8" fill="#c9915d" transform="rotate(20 83 45)"/>
    <ellipse cx="50" cy="59" rx="33" ry="33" fill="#d09a66"/><ellipse cx="50" cy="75" rx="17" ry="15" fill="#f8e6d0"/>
    <circle cx="33" cy="41" r="2.8" fill="#f8e6d0"/><circle cx="43" cy="35" r="2.4" fill="#f8e6d0"/><circle cx="59" cy="35" r="2.4" fill="#f8e6d0"/><circle cx="68" cy="41" r="2.8" fill="#f8e6d0"/>
    ${eyes(56, 15)}${nose(69)}${cheeks(66, 25)}`,
  otter: () => `
    <circle cx="22" cy="38" r="10" fill="#7d5a42"/><circle cx="78" cy="38" r="10" fill="#7d5a42"/>
    <ellipse cx="50" cy="59" rx="39" ry="32" fill="#8b6548"/><ellipse cx="50" cy="71" rx="26" ry="17" fill="#f2dfc3"/>
    ${eyes(52, 19)}${nose(64)}${smile(69)}
    <path d="M28 66 L10 63 M28 72 L10 75 M72 66 L90 63 M72 72 L90 75" stroke="#5b412f" stroke-width="1.8" stroke-linecap="round"/>`,
  hedgehog: () => `
    <path d="M9 67 L4 49 L17 49 L10 31 L24 36 L22 17 L36 27 L41 8 L51 23 L62 9 L66 27 L80 18 L78 36 L92 32 L84 49 L97 50 L91 67Z" fill="#6a5240"/>
    <ellipse cx="50" cy="69" rx="35" ry="23" fill="#f3d8b3"/>
    ${eyes(64, 15)}${nose(73)}${cheeks(74, 24)}`,
};

const ACC = {
  scarf: '<path d="M22 87 Q50 99 78 87 L75 96 Q50 106 25 96Z" fill="#d44d4d"/><path d="M66 94 L72 110 L61 106Z" fill="#d44d4d"/>',
  hat: '<path d="M30 22 L70 22 L65 3 L35 3Z" fill="#3e4a62"/><rect x="22" y="20" width="56" height="6" rx="3" fill="#3e4a62"/><rect x="35" y="14" width="30" height="5" fill="#e6b84a"/>',
  mask: '<path d="M18 46 Q34 39 47 50 L50 53 L53 50 Q66 39 82 46 L81 62 Q66 67 54 58 L50 56 L46 58 Q34 67 19 62Z" fill="#1f2636" opacity=".78"/><circle cx="35" cy="53" r="4.5" fill="#fff"/><circle cx="65" cy="53" r="4.5" fill="#fff"/><circle cx="35" cy="53" r="2.5" fill="#1f2636"/><circle cx="65" cy="53" r="2.5" fill="#1f2636"/>',
  bow: '<path d="M71 25 L88 16 L88 36Z M71 25 L54 16 L54 36Z" fill="#e8628e"/><circle cx="71" cy="26" r="4.4" fill="#c54474"/>',
  leaf: '<path d="M50 24 C39 14 41 3 53 0 C63 8 61 18 50 24Z" fill="#64a851"/><path d="M50 24 L53 4" stroke="#3f7d39" stroke-width="1.4"/>',
  glasses: '<circle cx="35" cy="54" r="10.5" fill="#ffffff55" stroke="#3a3a48" stroke-width="2.6"/><circle cx="65" cy="54" r="10.5" fill="#ffffff55" stroke="#3a3a48" stroke-width="2.6"/><path d="M45 54 L55 54" stroke="#3a3a48" stroke-width="2.6"/>',
  crown: '<path d="M26 26 L24 3 L38 14 L50 0 L62 14 L76 3 L74 26Z" fill="#efbf3e" stroke="#b8862a" stroke-width="1.6" stroke-linejoin="round"/><circle cx="50" cy="16" r="3.4" fill="#d84a4a"/><circle cx="36" cy="20" r="2.4" fill="#4a8fd8"/><circle cx="64" cy="20" r="2.4" fill="#4a8fd8"/>',
};

export function animalSVG(species, acc = '') {
  return `<svg class="art" viewBox="-8 -14 116 132" aria-hidden="true"><g filter="url(#stk)">${(DRAW[species] || DRAW.cat)()}${ACC[acc] || ''}</g></svg>`;
}

const ICON = {
  honey: '<path d="M30 30 h40 l6 12 v38 q0 8 -8 8 h-36 q-8 0 -8 -8 v-38z" fill="#e8a93a"/><rect x="26" y="20" width="48" height="12" rx="4" fill="#c9823a"/><path d="M36 52 q14 14 28 0" stroke="#fff3" stroke-width="5" fill="none"/>',
  acorn: '<path d="M26 44 h48 q2 38 -24 48 q-26 -10 -24 -48z" fill="#c98b4c"/><path d="M20 44 q2 -24 30 -24 q28 0 30 24z" fill="#7b5532"/><rect x="47" y="10" width="6" height="12" fill="#7b5532"/>',
  stone: '<path d="M20 62 q-2 -26 22 -36 q26 -6 38 20 q8 26 -18 34 q-36 8 -42 -18z" fill="#9aa1a8"/><path d="M36 38 q10 -8 22 -2" stroke="#fff6" stroke-width="5" fill="none" stroke-linecap="round"/>',
  shoe: '<path d="M18 40 q10 8 22 2 l34 24 q10 8 8 16 h-62 q-8 -22 -2 -42z" fill="#d9644a"/><path d="M18 82 h64" stroke="#fff" stroke-width="6"/><path d="M6 44 l14 6 M4 58 l14 2" stroke="#7fb8d9" stroke-width="4" stroke-linecap="round"/>',
  leaf: '<path d="M50 10 C86 24 90 66 50 92 C10 66 14 24 50 10Z" fill="#6dbb5c"/><path d="M50 18 V88 M50 42 L30 30 M50 42 L70 30 M50 62 L28 50 M50 62 L72 50" stroke="#3f7d39" stroke-width="3" fill="none"/>',
  cloak: '<path d="M50 12 C22 18 16 54 12 90 L32 80 L50 92 L68 80 L88 90 C84 54 78 18 50 12Z" fill="#6c67a8"/><circle cx="50" cy="38" r="12" fill="#2d2a4a"/>',
  badge: '<path d="M50 10 L86 22 V52 C86 72 66 86 50 92 C34 86 14 72 14 52 V22Z" fill="#5b8fc4"/><path d="M50 26 L58 44 L77 45 L62 57 L67 75 L50 65 L33 75 L38 57 L23 45 L42 44Z" fill="#f4dc78"/>',
  vest: '<path d="M30 14 L42 26 H58 L70 14 L88 30 L76 44 V90 H24 V44 L12 30Z" fill="#8a9a58"/><path d="M36 44 l8 -10 l8 10 M56 58 l8 -10 l8 10 M30 70 l8 -10 l8 10 M52 82 l8 -10 l8 10" stroke="#3e4b24" stroke-width="4" fill="none"/>',
  collar: '<ellipse cx="50" cy="44" rx="36" ry="26" fill="none" stroke="#d44d7b" stroke-width="11"/><path d="M50 62 C42 54 32 62 40 74 L50 86 L60 74 C68 62 58 54 50 62Z" fill="#f4dc78"/>',
  bolt: '<path d="M58 6 L22 56 H46 L38 94 L80 40 H54Z" fill="#f2c53d" stroke="#c28e1e" stroke-width="3" stroke-linejoin="round"/>',
  tree: '<rect x="44" y="66" width="12" height="26" fill="#7b5532"/><path d="M50 8 L78 44 H64 L84 72 H16 L36 44 H22Z" fill="#4f9a55"/>',
  wave: '<path d="M6 40 q11 -16 22 0 t22 0 t22 0 t22 0" stroke="#4f9fce" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M6 66 q11 -16 22 0 t22 0 t22 0 t22 0" stroke="#7fc0e2" stroke-width="9" fill="none" stroke-linecap="round"/>',
  grass: '<path d="M14 88 Q20 50 12 26 Q32 50 34 88Z M40 88 Q44 40 50 12 Q58 42 62 88Z M66 88 Q70 54 90 30 Q84 60 88 88Z" fill="#8cb954"/>',
  wind: '<path d="M8 38 H60 a12 12 0 1 0 -12 -12 M8 58 H80 a11 11 0 1 1 -11 11 M18 76 H50" stroke="#79b3cf" stroke-width="8" fill="none" stroke-linecap="round"/>',
  berry: '<circle cx="34" cy="60" r="22" fill="#c6456e"/><circle cx="68" cy="62" r="20" fill="#a93a64"/><path d="M36 38 Q46 16 74 12 Q72 36 52 42" fill="#6dbb5c"/>',
  map: '<path d="M10 20 L36 12 L64 22 L90 14 V80 L64 88 L36 78 L10 86Z" fill="#ecd9a6" stroke="#b39559" stroke-width="3"/><path d="M26 66 Q40 40 60 54" stroke="#b05b3f" stroke-width="4" stroke-dasharray="7 5" fill="none"/><path d="M60 40 l14 14 M74 40 l-14 14" stroke="#c63f3f" stroke-width="5" stroke-linecap="round"/>',
  horn: '<path d="M12 40 C40 42 66 30 88 12 V82 C66 68 40 60 12 62Z" fill="#d7ab56" stroke="#9a7330" stroke-width="3"/><rect x="24" y="42" width="8" height="19" fill="#9a7330"/>',
  flag: '<rect x="18" y="8" width="7" height="86" rx="3" fill="#7b5532"/><path d="M25 12 Q52 2 88 16 V56 Q54 44 25 54Z" fill="#fff" stroke="#c8c1b4" stroke-width="3"/>',
};
export function iconSVG(name) { return `<svg class="art" viewBox="-8 -8 116 116" aria-hidden="true"><g filter="url(#stk)">${ICON[name] || ICON.leaf}</g></svg>`; }
export const terrainSVG = (id) => iconSVG(id === 'forest' ? 'tree' : id === 'lake' ? 'wave' : 'grass');

// ── 共用濾鏡：白邊＋內陰影＋高光＋落影（貼紙質感）──
export const SVG_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<filter id="stk" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
  <feOffset in="SourceAlpha" dy="-6" result="up"/><feComposite in="SourceAlpha" in2="up" operator="out" result="low"/>
  <feGaussianBlur in="low" stdDeviation="2.6" result="lowB"/><feFlood flood-color="#4a2a12" flood-opacity=".28"/>
  <feComposite in2="lowB" operator="in"/><feComposite in2="SourceAlpha" operator="in" result="shade"/>
  <feOffset in="SourceAlpha" dy="5" result="dn"/><feComposite in="SourceAlpha" in2="dn" operator="out" result="top"/>
  <feGaussianBlur in="top" stdDeviation="2" result="topB"/><feFlood flood-color="#fff" flood-opacity=".42"/>
  <feComposite in2="topB" operator="in"/><feComposite in2="SourceAlpha" operator="in" result="hi"/>
  <feMorphology in="SourceAlpha" operator="dilate" radius="3.4" result="fat"/>
  <feFlood flood-color="#fffdf6"/><feComposite in2="fat" operator="in" result="rim"/>
  <feGaussianBlur in="fat" stdDeviation="2.2" result="fatB"/><feOffset in="fatB" dy="3.5" result="drop"/>
  <feFlood flood-color="#2b1d10" flood-opacity=".38"/><feComposite in2="drop" operator="in" result="shadow"/>
  <feMerge><feMergeNode in="shadow"/><feMergeNode in="rim"/><feMergeNode in="SourceGraphic"/><feMergeNode in="shade"/><feMergeNode in="hi"/></feMerge>
</filter></defs></svg>`;

// ── 數值圖示 ──
const STAT = {
  atk: '<path d="M19 3 L21 3 L21 7 L11 17 L13 19 L11 21 L9 19 L6 22 L2 18 L5 15 L3 13 L5 11 L7 13 L17 3Z" fill="currentColor"/>',
  hp: '<path d="M12 21 C5 15.5 2 12.5 2 8.4 C2 5.4 4.4 3 7.3 3 C9.2 3 10.8 4 12 5.6 C13.2 4 14.8 3 16.7 3 C19.6 3 22 5.4 22 8.4 C22 12.5 19 15.5 12 21Z" fill="currentColor"/>',
  spd: '<path d="M3 13 L13 13 L9 21 L21 9 L12 9 L15 2Z" fill="currentColor"/>',
  shield: '<path d="M12 2 L21 5.5 V11 C21 16.5 17 20.5 12 22 C7 20.5 3 16.5 3 11 V5.5Z" fill="currentColor"/>',
};
export const statIcon = (k) => `<svg class="si" viewBox="0 0 24 24" aria-hidden="true">${STAT[k]}</svg>`;

// ── 地形風景（當作區域背景）──
function rng(seed) { let a = seed; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const W = 160, H = 420;
const grad = (a, b, c) => `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>`;
function forestScene() {
  const r = rng(7);
  let s = grad('#a9d48f', '#c7e3a8', '#9ccb83');
  for (let i = 0; i < 26; i++) {
    const x = r() * W, y = r() * H, h = 22 + r() * 26, w = h * 0.62, c = ['#5f9d55', '#6cab5c', '#4f8a4a', '#78b766'][(r() * 4) | 0];
    s += `<g opacity=".5"><rect x="${x - 2}" y="${y}" width="4" height="${h * 0.3}" fill="#7a5a3a"/><path d="M${x} ${y - h} L${x + w / 2} ${y - h * 0.38} H${x + w * 0.3} L${x + w / 2 + 3} ${y + 2} H${x - w / 2 - 3} L${x - w * 0.3} ${y - h * 0.38} H${x - w / 2}Z" fill="${c}"/></g>`;
  }
  for (let i = 0; i < 7; i++) { const x = r() * W, y = r() * H; s += `<g opacity=".7"><rect x="${x - 1.5}" y="${y}" width="3" height="5" fill="#f4ecd8"/><path d="M${x - 6} ${y + 1} Q${x} ${y - 8} ${x + 6} ${y + 1}Z" fill="#d9584a"/><circle cx="${x - 2}" cy="${y - 2}" r="1.1" fill="#fff"/></g>`; }
  for (let i = 0; i < 4; i++) { const x = r() * W; s += `<path d="M${x} 0 L${x + 22} 0 L${x + 70} ${H} L${x + 40} ${H}Z" fill="#fff8d8" opacity=".14"/>`; }
  return s;
}
function lakeScene() {
  const r = rng(11);
  let s = grad('#8fcbe6', '#b6e0f0', '#86c3e0');
  for (let i = 0; i < 30; i++) { const x = r() * W, y = r() * H, w = 10 + r() * 22; s += `<path d="M${x} ${y} q${w / 4} -4 ${w / 2} 0 t${w / 2} 0" stroke="#fff" stroke-width="2" fill="none" opacity=".5" stroke-linecap="round"/>`; }
  for (let i = 0; i < 9; i++) {
    const x = r() * W, y = r() * H, rr = 7 + r() * 6, a = r() * 360;
    s += `<g transform="rotate(${a} ${x} ${y})" opacity=".75"><path d="M${x} ${y} L${x + rr} ${y - 2} A${rr} ${rr} 0 1 1 ${x + rr} ${y + 2}Z" fill="#7cbf6a"/></g>`;
    if (r() < 0.4) s += `<circle cx="${x + 2}" cy="${y - 3}" r="3" fill="#f6b3cb" opacity=".85"/>`;
  }
  for (const side of [0, W]) for (let i = 0; i < 9; i++) {
    const y = r() * H, d = side ? -1 : 1, x = side + d * r() * 10;
    s += `<path d="M${x} ${y} q${3 * d} -16 ${d} -28" stroke="#5f9a52" stroke-width="2.4" fill="none" opacity=".6"/><ellipse cx="${x + d}" cy="${y - 26}" rx="2.4" ry="6" fill="#8a5b36" opacity=".7"/>`;
  }
  return s;
}
function grassScene() {
  const r = rng(23);
  let s = grad('#e3e49a', '#f0ecb8', '#dcdf8e');
  for (let i = 0; i < 40; i++) { const x = r() * W, y = r() * H, c = ['#a9c45c', '#94b84e', '#b8cf6c'][(r() * 3) | 0]; s += `<path d="M${x - 5} ${y} Q${x - 4} ${y - 9} ${x - 7} ${y - 13} Q${x - 1} ${y - 8} ${x} ${y} Q${x + 1} ${y - 12} ${x + 3} ${y - 16} Q${x + 3} ${y - 7} ${x + 5} ${y}Z" fill="${c}" opacity=".7"/>`; }
  for (let i = 0; i < 22; i++) {
    const x = r() * W, y = r() * H, c = ['#fff', '#f7d24a', '#f3a3c0', '#fff'][(r() * 4) | 0];
    s += `<g opacity=".85">${[0, 72, 144, 216, 288].map((a) => `<circle cx="${x + Math.cos(a * Math.PI / 180) * 2.6}" cy="${y + Math.sin(a * Math.PI / 180) * 2.6}" r="2" fill="${c}"/>`).join('')}<circle cx="${x}" cy="${y}" r="1.4" fill="#e8a43a"/></g>`;
  }
  for (let i = 0; i < 3; i++) { const x = r() * W, y = r() * H; s += `<g opacity=".5"><ellipse cx="${x}" cy="${y}" rx="9" ry="6" fill="#c9c2b0"/><ellipse cx="${x + 6}" cy="${y + 2}" rx="6" ry="4" fill="#b5ad99"/></g>`; }
  return s;
}
const SCENES = { forest: forestScene, lake: lakeScene, grass: grassScene };
const sceneCache = {};
export function sceneURL(id) {
  if (!sceneCache[id]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${(SCENES[id] || grassScene)()}</svg>`;
    sceneCache[id] = `url('data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}')`;
  }
  return sceneCache[id];
}
