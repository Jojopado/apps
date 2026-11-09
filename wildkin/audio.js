// WILDKIN 音效與配樂
// 音效：Kenney（CC0）；配樂：Kevin MacLeod（CC BY 4.0），出處見製作名單
const SFX_NAMES = ['tap', 'select', 'place', 'reveal', 'swing', 'hit', 'shield', 'miss', 'die', 'buff', 'ice', 'score', 'confirm', 'error', 'coin', 'page', 'win', 'lose', 'round'];
const VOL = { tap: 0.5, select: 0.55, place: 0.8, reveal: 0.7, swing: 0.45, hit: 0.85, shield: 0.6, miss: 0.6, die: 0.8, buff: 0.45, ice: 0.6, score: 0.8, confirm: 0.6, error: 0.5, coin: 0.5, page: 0.6, win: 0.8, lose: 0.8, round: 0.55 };

let ac = null, master = null;
const buffers = {};
let loading = null;
const opt = { sfx: true, music: true, mute: false };

function ctx() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.9;
    master.connect(ac.destination);
  }
  return ac;
}
function load() {
  if (loading || !ctx()) return loading;
  loading = Promise.all(SFX_NAMES.map(async (n) => {
    try {
      const r = await fetch(`assets/sfx/${n}.mp3`);
      const ab = await r.arrayBuffer();
      buffers[n] = await new Promise((ok, bad) => ac.decodeAudioData(ab, ok, bad));
    } catch { /* 少一個音效也能玩 */ }
  }));
  return loading;
}

export function play(name, { rate = 1, vol = 1 } = {}) {
  if (opt.mute || !opt.sfx) return;
  const c = ctx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const b = buffers[name];
  if (!b) { load(); return; }
  try {
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = b;
    src.playbackRate.value = rate * (0.96 + Math.random() * 0.08);
    g.gain.value = (VOL[name] ?? 0.6) * vol;
    src.connect(g).connect(master);
    src.start();
  } catch { /* 忽略 */ }
}

// 配樂：HTMLAudio 循環，切換時淡入淡出
const tracks = {};
let current = null, wanted = null;
function track(name) {
  if (!tracks[name]) {
    const a = new Audio(`assets/music/${name}.mp3`);
    a.loop = true; a.preload = 'auto'; a.volume = 0;
    tracks[name] = a;
  }
  return tracks[name];
}
function fade(a, to, ms = 700) {
  const from = a.volume, t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k < 1) requestAnimationFrame(step);
    else if (to === 0) a.pause();
  };
  requestAnimationFrame(step);
}
const MUSIC_VOL = 0.32;
export function music(name) {
  wanted = name;
  if (opt.mute || !opt.music || !unlocked) return;
  if (current === name) return;
  if (current) fade(track(current), 0);
  current = name;
  if (!name) return;
  const a = track(name);
  a.play().then(() => fade(a, MUSIC_VOL)).catch(() => { current = null; });
}
export function setOptions(o) {
  Object.assign(opt, o);
  if (opt.mute || !opt.music) { if (current) fade(track(current), 0, 300); current = null; }
  else music(wanted);
}
export const options = () => ({ ...opt });

// 手機要使用者先點一下才能出聲
let unlocked = false;
export function unlock() {
  if (unlocked) return;
  unlocked = true;
  const c = ctx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
  load();
  music(wanted);
}
// 切到背景時暫停配樂
document.addEventListener('visibilitychange', () => {
  if (!current) return;
  const a = track(current);
  if (document.hidden) a.pause(); else if (!opt.mute && opt.music) a.play().catch(() => {});
});
