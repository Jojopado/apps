/* Can you parry me? - core logic (no DOM). Used by index.html and by test.js (node). */
(function (root) {
  'use strict';

  // ---------- attack definitions ----------
  const ATTACKS = {
    slash:  { name: '橫斬',   kind: 'red',    windup: [650, 950],   dmg: 14, posture: 22, dir: 'side' },
    quick:  { name: '快刺',   kind: 'red',    windup: [380, 520],   dmg: 9,  posture: 15, dir: 'side' },
    heavy:  { name: '重劈',   kind: 'purple', windup: [950, 1300],  dmg: 26, posture: 0,  dir: 'over', unparryable: true },
    feint:  { name: '假動作', kind: 'red',    windup: [550, 750], pause: [280, 480], dmg: 15, posture: 22, dir: 'side' },
    grab:   { name: '擒抱',   kind: 'gold',   windup: [850, 1100],  dmg: 22, posture: 45, dir: 'over', unblockable: true },
    chain:  { name: '連段',   kind: 'red',    windup: [600, 800], gap: [300, 480], dmg: 10, posture: 14, dir: 'side' },
    punish: { name: '懲擊',   kind: 'red',    windup: [300, 380],   dmg: 18, posture: 20, dir: 'side' },
  };

  const ENEMIES = [
    { id: 'goblin', name: '野武士', hp: 90,  posture: 60,  speed: 1.0,  idle: [500, 1200], exploit: 0.6,
      weights: { slash: 4, quick: 3, feint: 1, chain: 1.5 }, chainMax: 2, color: '#6cbf4a',
      intro: '出手快、愛耍小聰明。紅光→命中前一刻按 Parry。' },
    { id: 'knight', name: '鎧武者',   hp: 170, posture: 90,  speed: 1.15, idle: [600, 1300], exploit: 0.9,
      weights: { slash: 3, heavy: 3, grab: 1.5, chain: 1.5, quick: 1 }, chainMax: 3, color: '#9aa3b2',
      intro: '紫光重劈不能彈反、只能長按 Def；金光擒抱防不住、只能 Parry。' },
    { id: 'shade',  name: '影忍',       hp: 260, posture: 100, speed: 0.9,  idle: [350, 1000], exploit: 1.3,
      weights: { slash: 3, quick: 2.5, feint: 2.5, heavy: 1.5, grab: 1.5, chain: 3 }, chainMax: 4, color: '#7a4fd1',
      intro: '會記住你的習慣，專挑你擋不好的招。', phase2: true },
  ];

  const PARRY_WINDOW = 170;     // ms active after press
  const PARRY_RECOVER = 220;    // ms after window before next parry
  const STRIKE_MS = 140;        // blade travel time
  const SWING_MS = 260;         // player attack commitment
  const SWING_HIT_AT = 110;
  const EXPOSED_MS = 650;
  const PLAYER_ATK = 12;

  const TAUNTS = {
    feint: '👁 它發現你愛提早按',
    grab: '👁 它注意到你老是長按 Def',
    heavy: '👁 它看你一直狂按 Parry',
    greed: '👁 它看穿你亂揮',
    weak: '👁 它專挑你擋不好的招',
    wary: '它受傷了，開始保持距離',
    phase2: '影忍進入第二階段！',
    fast: '👁 它發現你怕快招',
  };

  function lerp(a, b, t) { return a + (b - a) * t; }

  class Game {
    constructor(opts) {
      opts = opts || {};
      this.rng = opts.rng || Math.random;
      this.reset();
    }

    rand(a, b) { return a + (b - a) * this.rng(); }

    reset() {
      this.state = 'title';
      this.ft = 0;            // fight time (scaled ms)
      this.rt = 0;            // real time ms
      this.slowUntil = 0;
      this.events = [];
      this.wave = -1;
      this.enemy = null;
      this.message = null;
      this.taunt = null;
      this.hintsShown = {};
      this.player = {
        hp: 100, maxHp: 100, guard: 100, guardMax: 100,
        defHeld: false, parryActiveUntil: 0, parryRecoverUntil: 0, lastParryPress: -9999,
        parryWindow: PARRY_WINDOW, swingUntil: 0, swingHitAt: 0, swingResolved: true,
        exposedUntil: 0, stunUntil: 0, combo: 0, hitFlashUntil: 0,
      };
      this.profile = {
        defEMA: 0, offsets: [], earlyMiss: 0, attempts: 0, spamPress: 0,
        encounter: {}, perfect: {}, whiffs: [], parryPresses: [], hitsBy: {},
      };
      this.stats = { perfect: 0, hits: 0, whiffs: 0, blocks: 0, time: 0, damageTaken: 0 };
      this.lastTaunt = { key: null, at: -99999 };
    }

    emit(type, data) { const ev = Object.assign({ type: type, ft: this.ft }, data || {}); this.events.push(ev); return ev; }

    start(wave) {
      this.reset();
      this.wave = (wave || 0) - 1;
      this.nextWave();
    }

    nextWave() {
      this.wave++;
      this.taunt = null;
      if (this.wave >= ENEMIES.length) { this.state = 'win'; this.emit('win'); return; }
      const def = ENEMIES[this.wave];
      this.enemy = {
        def: def, hp: def.hp, maxHp: def.hp, posture: 0, postureMax: def.posture,
        state: 'idle', stateUntil: 0, attack: null, lastParriedAt: -9999, phase: 1,
        punishCooldownUntil: 0, wary: false, mood: 'idle', deadAt: 0, flinchUntil: 0, greedy: false,
      };
      if (this.wave > 0) this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
      this.player.guard = this.player.guardMax;
      this.player.exposedUntil = 0; this.player.stunUntil = 0; this.player.swingResolved = true; this.player.swingUntil = 0;
      this.state = 'intro';
      this.introUntil = this.rt + 2200;
      this.emit('intro', { name: def.name, text: def.intro, wave: this.wave });
    }

    // ---------- input ----------
    // name: 'parry' | 'attack' | 'def'  ; down: for def true/false
    input(name, down) {
      const p = this.player;
      if (name === 'def') { p.defHeld = !!down; return; }
      if (this.state !== 'fight') return;
      if (this.rt < p.stunUntil) return;
      if (name === 'parry') {
        if (this.ft < p.swingUntil) return;                       // committed to a swing
        if (this.ft < p.parryRecoverUntil) { this.profile.spamPress++; return; }
        // spam shrink
        if (this.ft - p.lastParryPress < 450) p.parryWindow = Math.max(70, p.parryWindow - 45);
        else p.parryWindow = PARRY_WINDOW;
        p.lastParryPress = this.ft;
        p.parryActiveUntil = this.ft + p.parryWindow;
        p.parryRecoverUntil = p.parryActiveUntil + PARRY_RECOVER;
        this.profile.parryPresses.push(this.ft);
        // record offset relative to incoming impact
        const e = this.enemy;
        if (e && (e.state === 'windup' || e.state === 'pause' || e.state === 'strike')) {
          const impactAt = this.impactTime();
          const off = this.ft - impactAt;
          this.profile.offsets.push(off); if (this.profile.offsets.length > 10) this.profile.offsets.shift();
          this.profile.attempts++;
          if (off < -p.parryWindow) this.profile.earlyMiss++;
        } else {
          this.profile.spamPress++;
        }
        this.emit('parryPress');
      } else if (name === 'attack') {
        if (this.ft < p.swingUntil) return;
        if (this.ft < p.parryActiveUntil) return; // can't swing while parry arm is out
        p.swingUntil = this.ft + SWING_MS;
        p.swingHitAt = this.ft + SWING_HIT_AT;
        p.swingResolved = false;
        const es = this.enemy ? this.enemy.state : '';
        p.swingValid = es === 'recover' || es === 'stagger';
        p.parryActiveUntil = 0;
        this.emit('swing');
      }
    }

    impactTime() {
      const e = this.enemy;
      if (e.state === 'windup') return e.stateUntil + (e.attack.pauseMs || 0) + STRIKE_MS;
      if (e.state === 'pause') return e.stateUntil + STRIKE_MS;
      if (e.state === 'strike') return e.stateUntil;
      return Infinity;
    }

    // ---------- main step ----------
    step(dtReal) {
      dtReal = Math.min(dtReal, 50);
      this.rt += dtReal;
      if (this.state === 'intro') {
        if (this.rt >= this.introUntil) { this.state = 'fight'; this.enemy.stateUntil = this.ft + this.rand(600, 1000); this.emit('fightStart'); }
        return;
      }
      if (this.state === 'clear') {
        if (this.rt >= this.clearUntil) this.nextWave();
        return;
      }
      if (this.state !== 'fight') return;
      const scale = this.rt < this.slowUntil ? 0.3 : 1;
      const dt = dtReal * scale;
      this.ft += dt;
      this.stats.time += dt;
      const p = this.player, e = this.enemy;

      // profile EMA of def holding
      this.profile.defEMA += ((p.defHeld ? 1 : 0) - this.profile.defEMA) * Math.min(1, dt / 6000);

      // guard regen
      if (!p.defHeld && this.ft > p.stunUntil) p.guard = Math.min(p.guardMax, p.guard + 22 * dt / 1000);

      // player swing resolve
      if (!p.swingResolved && this.ft >= p.swingHitAt) {
        p.swingResolved = true;
        this.resolveSwing();
      }

      // enemy posture decay
      if (e.state !== 'stagger' && this.ft - e.lastParriedAt > 1500) e.posture = Math.max(0, e.posture - 9 * dt / 1000);

      // enemy state machine
      if (e.state === 'dead') {
        return;
      }
      if (this.ft >= e.stateUntil) this.advanceEnemy();
    }

    advanceEnemy() {
      const e = this.enemy;
      switch (e.state) {
        case 'idle':
          this.chooseAction();
          break;
        case 'windup':
          if (e.attack.pauseMs) { e.state = 'pause'; e.stateUntil = this.ft + e.attack.pauseMs; }
          else { e.state = 'strike'; e.stateUntil = this.ft + STRIKE_MS; this.emit('strikeStart', { dir: e.attack.dir, kind: e.attack.kind }); }
          break;
        case 'pause':
          e.state = 'strike'; e.stateUntil = this.ft + STRIKE_MS; this.emit('strikeStart', { dir: e.attack.dir, kind: e.attack.kind });
          break;
        case 'strike':
          this.resolveImpact();
          break;
        case 'recover':
          e.state = 'idle'; e.mood = 'idle';
          e.stateUntil = this.ft + this.idleTime();
          break;
        case 'stagger':
          e.state = 'idle'; e.mood = 'idle'; e.posture = e.postureMax * 0.25;
          e.stateUntil = this.ft + this.rand(300, 600);
          break;
      }
    }

    idleTime() {
      const e = this.enemy, d = e.def, p = this.player;
      let t = this.rand(d.idle[0], d.idle[1]);
      if (e.greedy) t *= 0.45;
      if (p.hp < 30) t *= 0.7;
      if (e.phase === 2) t *= 0.75;
      if (e.hp < e.maxHp * 0.25 && this.rng() < 0.35) { t = this.rand(1200, 2000); e.wary = true; e.mood = 'wary'; this.showTaunt('wary'); }
      else e.wary = false;
      return t;
    }

    successRate(key) {
      const pr = this.profile;
      const n = pr.encounter[key] || 0, k = pr.perfect[key] || 0;
      return { rate: (k + 1) / (n + 2), n: n };
    }

    // ---------- the "smart" part ----------
    chooseAction() {
      const e = this.enemy, d = e.def, pr = this.profile, p = this.player;
      const ex = d.exploit * (e.phase === 2 ? 1.3 : 1);
      const w = Object.assign({}, d.weights);
      let tactic = null, tacticStrength = 0;
      const mark = (key, s) => { if (s > tacticStrength) { tacticStrength = s; tactic = key; } };

      // 1) early presser -> feints + longer windups
      const earlyRate = pr.attempts >= 3 ? pr.earlyMiss / pr.attempts : 0;
      if (earlyRate > 0.3 && w.feint) { w.feint *= 1 + 2.2 * ex; mark('feint', earlyRate * ex); }
      // 2) turtle (holds Def) -> grab
      if (pr.defEMA > 0.45 && w.grab) { w.grab *= 1 + 2.5 * ex; mark('grab', pr.defEMA * ex); }
      // 3) parry spammer -> heavy (unparryable)
      const recentPresses = pr.parryPresses.filter(t => this.ft - t < 8000).length;
      const recentAttacks = pr.recentAttacks || 1;
      const spamRatio = recentPresses / Math.max(1, recentAttacks);
      if (spamRatio > 1.8 && w.heavy) { w.heavy *= 1 + 1.8 * ex; mark('heavy', (spamRatio - 1.5) * ex); }
      // 4) whiffer -> greed punish (fast follow-ups)
      const recentWhiffs = pr.whiffs.filter(t => this.ft - t < 8000).length;
      e.greedy = recentWhiffs >= 2;
      if (e.greedy) { if (w.quick) w.quick *= 1 + 1.5 * ex; if (w.chain) w.chain *= 1 + 1.2 * ex; mark('greed', 0.9 * ex); }
      // 5) generic: prefer what the player handles worst
      let worst = null, worstRate = 1;
      for (const key in w) {
        const sr = this.successRate(key);
        if (ATTACKS[key].unparryable) continue;
        w[key] *= 1 + ex * (1 - sr.rate) * 1.2;
        if (sr.n >= 3 && sr.rate < worstRate) { worstRate = sr.rate; worst = key; }
      }
      if (worst && worstRate < 0.4) mark(worst === 'quick' ? 'fast' : 'weak', (0.5 - worstRate) * 2 * ex);

      if (tactic && tacticStrength > 0.35) this.showTaunt(tactic);

      // weighted pick
      let total = 0; for (const k in w) total += w[k];
      let r = this.rng() * total, key = 'slash';
      for (const k in w) { r -= w[k]; if (r <= 0) { key = k; break; } }
      this.startAttack(key);
    }

    startAttack(key, opts) {
      opts = opts || {};
      const e = this.enemy, d = e.def, pr = this.profile, def = ATTACKS[key];
      let windup = this.rand(def.windup[0], def.windup[1]) * d.speed;
      if (e.phase === 2) windup *= 0.85;
      // early pressers get stretched windups
      const earlyRate = pr.attempts >= 3 ? pr.earlyMiss / pr.attempts : 0;
      if (earlyRate > 0.3 && key !== 'quick') windup += this.rand(80, 220);
      if (opts.windup) windup = opts.windup;
      const atk = {
        key: key, name: def.name, kind: def.kind, dmg: def.dmg, posture: def.posture,
        dir: def.dir === 'side' ? (this.rng() < 0.5 ? 'L' : 'R') : 'over',
        unparryable: !!def.unparryable, unblockable: !!def.unblockable,
        pauseMs: def.pause ? this.rand(def.pause[0], def.pause[1]) : 0,
        hitsLeft: 0, hitIndex: 0, windupStart: this.ft, windupMs: windup,
      };
      if (key === 'chain') {
        const max = e.phase === 2 ? d.chainMax : Math.min(d.chainMax, 3);
        atk.hitsLeft = Math.floor(this.rand(2, max + 1)) - 1; // additional hits after the first
      }
      e.attack = atk;
      e.state = 'windup'; e.mood = 'attack';
      e.stateUntil = this.ft + windup;
      pr.recentAttacks = (pr.recentAttacks || 0) + 1;
      this.emit('windup', { kind: atk.kind, dir: atk.dir, key: key });
      this.hint(key);
    }

    hint(key) {
      const kind = ATTACKS[key].kind;
      const map = { red: '紅光：命中前一刻按 Parry', purple: '紫光不能彈反！長按 Def', gold: '金光防不住！只能 Parry' };
      if (!this.hintsShown[kind]) { this.hintsShown[kind] = true; this.emit('hint', { text: map[kind] }); }
    }

    showTaunt(key) {
      if (this.lastTaunt.key === key && this.ft - this.lastTaunt.at < 15000) return;
      if (this.ft - this.lastTaunt.at < 5000) return;
      this.lastTaunt = { key: key, at: this.ft };
      this.taunt = { text: TAUNTS[key], until: this.ft + 3500 };
      this.emit('taunt', { key: key, text: TAUNTS[key] });
    }

    resolveImpact() {
      const e = this.enemy, p = this.player, atk = e.attack, pr = this.profile;
      const parryable = !atk.unparryable;
      const parryActive = this.ft <= p.parryActiveUntil && this.ft >= p.swingUntil;
      const blocking = p.defHeld && !parryActive && this.ft >= p.swingUntil && this.rt >= p.stunUntil;
      const exposed = this.ft < p.exposedUntil;
      let result;
      if (parryable) pr.encounter[atk.key] = (pr.encounter[atk.key] || 0) + 1;

      if (parryActive && parryable) {
        // PERFECT PARRY
        result = 'perfect';
        pr.perfect[atk.key] = (pr.perfect[atk.key] || 0) + 1;
        this.stats.perfect++;
        e.lastParriedAt = this.ft;
        e.posture += atk.posture;
        p.parryActiveUntil = 0; p.parryRecoverUntil = this.ft + 60; // parry success refreshes
        p.parryWindow = PARRY_WINDOW;
        this.slowUntil = this.rt + 130;
        this.emit('perfect', { key: atk.key, dir: atk.dir });
        if (atk.key === 'grab') { e.posture = e.postureMax; }
        if (e.posture >= e.postureMax) { this.stagger(); return; }
      } else if (parryActive && !parryable) {
        result = 'hit';
        this.damagePlayer(atk.dmg * (exposed ? 1.5 : 1), '重劈擊穿了彈反！');
      } else if (blocking && !atk.unblockable) {
        result = 'block';
        this.stats.blocks++;
        const mult = atk.kind === 'purple' ? 0.5 : 0.2;
        const cost = atk.kind === 'purple' ? 38 : 16;
        p.guard -= cost;
        if (p.guard <= 0) {
          p.guard = 0; p.stunUntil = this.rt + 900;
          this.damagePlayer(atk.dmg, '防禦被打破！');
          this.emit('guardBreak');
          result = 'hit';
        } else {
          this.damagePlayer(atk.dmg * mult, null, true);
          this.emit('block', { key: atk.key });
        }
      } else if (blocking && atk.unblockable) {
        result = 'hit';
        p.guard = Math.max(0, p.guard - 40);
        this.damagePlayer(atk.dmg, '擒抱抓破了防禦！');
      } else {
        result = 'hit';
        this.damagePlayer(atk.dmg * (exposed ? 2 : 1), exposed ? '揮空被懲罰！' : null);
      }
      if (result === 'hit') pr.hitsBy[atk.key] = (pr.hitsBy[atk.key] || 0) + 1;
      if (this.state !== 'fight') return;

      // continue chain or recover
      if (atk.hitsLeft > 0 && result !== 'perfect' || (atk.hitsLeft > 0 && result === 'perfect')) {
        atk.hitsLeft--; atk.hitIndex++;
        atk.dir = this.rng() < 0.5 ? 'L' : 'R';
        atk.pauseMs = 0;
        let gap = this.rand(ATTACKS.chain.gap[0], ATTACKS.chain.gap[1]) * e.def.speed;
        if (e.def.id === 'shade') gap = this.rand(220, 600) * (e.phase === 2 ? 0.85 : 1);
        atk.windupStart = this.ft; atk.windupMs = gap;
        e.state = 'windup'; e.stateUntil = this.ft + gap;
        this.emit('windup', { kind: atk.kind, dir: atk.dir, key: atk.key, chain: true });
        return;
      }
      let rec = result === 'perfect' ? 750 : result === 'block' ? 480 : 340;
      if (atk.kind === 'purple' && result === 'block') rec = 820;
      if (atk.key === 'quick' || atk.key === 'punish') rec *= 0.75;
      e.state = 'recover'; e.mood = 'recover';
      e.stateUntil = this.ft + rec;
      e.attack = null;
    }

    stagger() {
      const e = this.enemy;
      e.state = 'stagger'; e.mood = 'stagger';
      e.stateUntil = this.ft + 1700;
      e.attack = null;
      this.player.combo = 0;
      this.emit('stagger');
    }

    damagePlayer(amount, text, chip) {
      const p = this.player;
      amount = Math.round(amount);
      p.hp = Math.max(0, p.hp - amount);
      this.stats.damageTaken += amount;
      if (!chip) { this.stats.hits++; p.hitFlashUntil = this.rt + 200; }
      this.emit(chip ? 'chip' : 'hurt', { amount: amount, text: text });
      if (p.hp <= 0) { this.state = 'lose'; this.emit('lose'); }
    }

    resolveSwing() {
      const e = this.enemy, p = this.player;
      if (e.state === 'stagger') {
        if (p.combo >= 3) { this.whiff(); return; }
        p.combo++;
        const mult = [1, 1.3, 1.7][p.combo - 1];
        this.damageEnemy(Math.round(PLAYER_ATK * mult), p.combo);
      } else if (e.state === 'recover' || (p.swingValid && e.state === 'idle')) {
        this.damageEnemy(PLAYER_ATK, 0);
      } else if (e.state === 'dead') {
        // nothing
      } else {
        this.whiff();
      }
    }

    whiff() {
      const p = this.player, e = this.enemy;
      p.exposedUntil = this.ft + EXPOSED_MS;
      this.stats.whiffs++;
      this.profile.whiffs.push(this.ft);
      this.emit('whiff');
      if (e.state === 'idle' && this.ft >= e.punishCooldownUntil && !e.wary) {
        e.punishCooldownUntil = this.ft + 4000;
        this.startAttack('punish');
      }
    }

    damageEnemy(amount, combo) {
      const e = this.enemy;
      e.hp = Math.max(0, e.hp - amount);
      e.flinchUntil = this.ft + 180;
      this.emit('enemyHit', { amount: amount, combo: combo });
      if (e.def.phase2 && e.phase === 1 && e.hp <= e.maxHp * 0.5) {
        e.phase = 2; this.showTaunt('phase2'); this.emit('phase2');
      }
      if (e.hp <= 0) {
        e.state = 'dead'; e.mood = 'dead'; e.deadAt = this.ft; e.attack = null;
        this.state = 'clear'; this.clearUntil = this.rt + 1600;
        this.emit('enemyDead', { name: e.def.name });
      }
    }

    rank() {
      const s = this.stats;
      if (s.hits <= 2 && s.whiffs <= 1) return 'S';
      if (s.hits <= 5 && s.whiffs <= 3) return 'A';
      if (s.hits <= 9) return 'B';
      return 'C';
    }
  }

  const api = { Game, ATTACKS, ENEMIES, TAUNTS, PARRY_WINDOW, STRIKE_MS, SWING_MS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CanYouParryMe = api;
})(typeof window !== 'undefined' ? window : globalThis);
