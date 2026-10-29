'use strict';
// ---------- 音效（Web Audio 即時合成，不用音檔） ----------
// 環境聲：大廳人聲、月台、車上轟隆＋鐵軌「喀噠喀噠」（跟車速走）、山洞、進站煞車
// 單發音效：鳴笛、叮咚、關門警示、蓋章、買票、訊息、說再見
const Sfx = {
  ctx: null, master: null, noise: null, layers: {}, on: true,
  clackAt: 0, interval: 1.6, target: 1.6, squeal: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.on ? 0.8 : 0; this.master.connect(c.destination);
    // 2 秒白噪音，大家共用
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // 持續的環境層：噪音 → 濾波 → 音量（音量平時 0，update() 決定）
    const layer = (type, freq, q) => {
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7;
      const g = c.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
      return { f, g };
    };
    this.layers.rumble = layer('lowpass', 180);
    this.layers.wind = layer('bandpass', 900, 0.4);
    this.layers.crowd = layer('bandpass', 700, 0.6);
    this.layers.crowd2 = layer('bandpass', 1500, 1.2);
  },
  setOn(v) { this.on = v; if (this.master) this.master.gain.setTargetAtTime(v ? 0.8 : 0, this.ctx.currentTime, 0.05); },
  vol(name, v, freq) {
    const L = this.layers[name]; if (!L) return;
    L.g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.4);
    if (freq) L.f.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.4);
  },
  // 每一幀呼叫：place = 'hall' | 'platform' | 'ride'；ride 時給 moving / speed(0~1) / tunnel / braking
  update(st) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const hall = st.place === 'hall', plat = st.place === 'platform', ride = st.place === 'ride';
    const sp = ride ? st.speed : 0;
    this.vol('crowd', hall ? 0.05 + 0.02 * Math.sin(now * 0.3) : plat ? 0.02 : 0, hall ? 650 + 150 * Math.sin(now * 0.7) : 600);
    this.vol('crowd2', hall ? 0.012 : 0);
    this.vol('rumble', ride ? (st.tunnel ? 0.55 : 0.08 + 0.3 * sp) : plat && st.trainNear ? 0.25 : 0, st.tunnel ? 320 : 140 + 120 * sp);
    this.vol('wind', ride ? (st.tunnel ? 0.12 : 0.05 * sp) : 0, st.tunnel ? 500 : 900);
    // 鐵軌接縫：速度越快間隔越短；停著就沒有
    if (ride && sp > 0.05) {
      this.target = 1.5 - 1.05 * sp;
      this.interval += (this.target - this.interval) * 0.02;
      if (now >= this.clackAt) {
        const loud = st.tunnel ? 1.6 : 1;
        this.clack(now, loud); this.clack(now + 0.11, loud * 0.8);          // 前後兩個轉向架
        this.clackAt = now + this.interval * (0.95 + Math.random() * 0.1);
      }
    } else this.clackAt = now + 0.3;
    // 進站煞車吱吱聲
    if (ride && st.braking && !this.squeal) this.squeal = this.tone([3150, 4080], 0.012, 6, 'sine', true);
    if ((!ride || !st.braking) && this.squeal) { this.squeal.stop(); this.squeal = null; }
  },
  clack(at, loud) {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1700 + Math.random() * 400; f.Q.value = 1.5;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.22 * loud, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(at, Math.random()); src.stop(at + 0.1);
    const o = c.createOscillator(); o.frequency.setValueAtTime(95, at); o.frequency.exponentialRampToValueAtTime(45, at + 0.08);
    const og = c.createGain(); og.gain.setValueAtTime(0.0001, at); og.gain.exponentialRampToValueAtTime(0.3 * loud, at + 0.005); og.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
    o.connect(og); og.connect(this.master); o.start(at); o.stop(at + 0.12);
  },
  // 幾個頻率一起響；hold = 持續到 stop()
  tone(freqs, vol, dur, type, hold, at) {
    if (!this.ctx) return null;
    const c = this.ctx; at = at || c.currentTime;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.03);
    if (!hold) g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    g.connect(this.master);
    const os = freqs.map(fr => {
      const o = c.createOscillator(); o.type = type || 'sine'; o.frequency.value = fr;
      if (hold) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 7; lg.gain.value = fr * 0.01; l.connect(lg); lg.connect(o.frequency); l.start(at); }
      o.connect(g); o.start(at); if (!hold) o.stop(at + dur + 0.05); return o;
    });
    return { stop: () => { g.gain.setTargetAtTime(0.0001, c.currentTime, 0.1); os.forEach(o => o.stop(c.currentTime + 0.5)); } };
  },
  play(name) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const c = this.ctx, t = c.currentTime;
    if (name === 'horn') {            // 鳴笛：兩個鋸齒波經過低通，像電聯車的喇叭
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; f.connect(this.master);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.06); g.gain.setValueAtTime(0.18, t + 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0); g.connect(f);
      [349, 440].forEach(fr => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(g); o.start(t); o.stop(t + 1.05); });
    } else if (name === 'chime') {    // 叮咚
      this.tone([659.3, 1318.5], 0.16, 1.2, 'sine', false, t); this.tone([523.3, 1046.5], 0.16, 1.6, 'sine', false, t + 0.45);
    } else if (name === 'announce') { // 到站前的提示音（四個音）
      [784, 659.3, 523.3, 659.3].forEach((fr, i) => this.tone([fr, fr * 2], 0.1, 0.8, 'sine', false, t + i * 0.32));
    } else if (name === 'doorClose') { // 關門警示嗶嗶
      for (let i = 0; i < 4; i++) this.tone([1046], 0.09, 0.14, 'square', false, t + i * 0.3);
    } else if (name === 'door') {     // 車門滑開：噪音掃頻
      const src = c.createBufferSource(); src.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(1600, t + 0.5);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      src.connect(f); f.connect(g); g.connect(this.master); src.start(t); src.stop(t + 0.7);
    } else if (name === 'stamp') {    // 蓋章：低沉的「砰」
      const o = c.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
      const g = c.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.35);
      this.clack(t, 1.2);
    } else if (name === 'ticket') {   // 買票：喀嚓
      this.clack(t, 1); this.clack(t + 0.09, 0.7); this.tone([1318.5], 0.08, 0.25, 'triangle', false, t + 0.15);
    } else if (name === 'pop') {      // 收到訊息
      const o = c.createOscillator(); o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(1250, t + 0.08);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.2);
    } else if (name === 'bye') {      // 快到站，說再見
      [523.3, 659.3, 784, 1046.5].forEach((fr, i) => this.tone([fr], 0.09, 0.6, 'triangle', false, t + i * 0.18));
    } else if (name === 'tap') {
      this.tone([880], 0.05, 0.08, 'triangle', false, t);
    }
  }
};
// iPhone 要使用者點一下才准出聲
['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, () => Sfx.init(), { passive: true }));
