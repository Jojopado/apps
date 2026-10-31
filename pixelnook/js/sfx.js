// PixelNook 音效＋背景音樂：全部用 Web Audio 即時合成（沒有音檔、沒有授權問題）
(function (G) {
  'use strict';
  let ac = null, master = null, musicGain = null, on = true, musicOn = true, musicTimer = 0, musicMood = 'home';
  try { const s = JSON.parse(localStorage.getItem('pixelnook.audio') || '{}'); if (s.on === false) on = false; if (s.music === false) musicOn = false; } catch (e) {}
  function ctx() {
    if (!ac) {
      const AC = G.AudioContext || G.webkitAudioContext; if (!AC) return null;
      ac = new AC(); master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
      musicGain = ac.createGain(); musicGain.gain.value = 0.0; musicGain.connect(master);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, t0, dur, type, vol, slideTo, dest) {
    const a = ac, o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(t0, dur, vol, lp) {
    const a = ac, n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let k = 0; k < n; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / n);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = b; f.type = 'lowpass'; f.frequency.value = lp || 800; g.gain.value = vol || 0.2;
    s.connect(f); f.connect(g); g.connect(master); s.start(t0);
  }
  const N = n => 440 * Math.pow(2, (n - 69) / 12);   // MIDI → Hz
  const SOUNDS = {
    tap: t => tone(880, t, 0.05, 'square', 0.06),
    open: t => { tone(660, t, 0.06, 'triangle', 0.08); tone(990, t + 0.05, 0.07, 'triangle', 0.07); },
    coin: t => { tone(N(83), t, 0.07, 'square', 0.1); tone(N(88), t + 0.07, 0.16, 'square', 0.1); },
    good: t => { tone(N(76), t, 0.08, 'triangle', 0.14); tone(N(79), t + 0.08, 0.08, 'triangle', 0.14); tone(N(84), t + 0.16, 0.18, 'triangle', 0.14); },
    bad: t => { tone(N(64), t, 0.12, 'sawtooth', 0.08); tone(N(58), t + 0.12, 0.22, 'sawtooth', 0.08); },
    place: t => tone(420, t, 0.12, 'sine', 0.2, 180),
    pick: t => tone(260, t, 0.1, 'sine', 0.16, 520),
    door: t => { noise(t, 0.18, 0.25, 500); tone(110, t, 0.18, 'sine', 0.2, 70); },
    talk: t => { for (let k = 0; k < 3; k++) tone(500 + Math.random() * 300, t + k * 0.06, 0.04, 'square', 0.04); },
    quest: t => { [72, 76, 79, 84].forEach((n, k) => tone(N(n), t + k * 0.07, 0.12, 'triangle', 0.12)); },
    level: t => { [72, 76, 79, 84, 79, 84, 88].forEach((n, k) => tone(N(n), t + k * 0.09, 0.16, 'square', 0.09)); },
    pickup: t => { tone(N(81), t, 0.06, 'triangle', 0.12); tone(N(88), t + 0.06, 0.1, 'triangle', 0.12); },
    step: t => noise(t, 0.04, 0.05, 300),
  };
  function play(name) {
    if (!on || !SOUNDS[name]) return;
    const a = ctx(); if (!a) return;
    try { SOUNDS[name](a.currentTime + 0.01); } catch (e) {}
  }
  // ---- 背景音樂：五聲音階的輕快小旋律，依場景換調 ----
  const MOODS = {
    home: { root: 60, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], bpm: 84 },
    city: { root: 62, chords: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], bpm: 96 },
    cafe: { root: 57, chords: [[0, 3, 7], [5, 8, 12], [10, 14, 17], [7, 10, 14]], bpm: 78 },
  };
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
  let beat = 0;
  function musicTick() {
    if (!ac || !musicOn || !on) return;
    const m = MOODS[musicMood] || MOODS.home, spb = 60 / m.bpm, t = ac.currentTime + 0.05;
    const chord = m.chords[Math.floor(beat / 4) % m.chords.length];
    if (beat % 4 === 0) tone(N(m.root - 12 + chord[0]), t, spb * 3.6, 'triangle', 0.18, null, musicGain);
    if (beat % 2 === 0) tone(N(m.root + chord[(beat / 2) % 3]), t, spb * 0.9, 'sine', 0.06, null, musicGain);
    if (Math.random() < 0.55) tone(N(m.root + 12 + PENTA[Math.floor(Math.random() * PENTA.length)]), t + (Math.random() < 0.3 ? spb / 2 : 0), spb * 0.7, 'triangle', 0.07, null, musicGain);
    beat++;
    musicTimer = setTimeout(musicTick, spb * 1000);
  }
  function music(mood) {
    if (mood) musicMood = mood;
    const a = ctx(); if (!a) return;
    const want = on && musicOn ? 0.55 : 0;
    musicGain.gain.setTargetAtTime(want, a.currentTime, 0.4);
    if (want && !musicTimer) musicTick();
    if (!want) { clearTimeout(musicTimer); musicTimer = 0; }
  }
  function setOn(v) { on = v; persist(); music(); }
  function setMusic(v) { musicOn = v; persist(); music(); }
  function persist() { try { localStorage.setItem('pixelnook.audio', JSON.stringify({ on, music: musicOn })); } catch (e) {} }
  // 第一次碰螢幕才能開聲音（瀏覽器規定）
  function unlock() { ctx(); music(); G.removeEventListener('pointerdown', unlock, true); }
  if (G.addEventListener) G.addEventListener('pointerdown', unlock, true);
  G.SFX = { play, music, setOn, setMusic, get on() { return on; }, get musicOn() { return musicOn; } };
})(typeof window !== 'undefined' ? window : globalThis);
