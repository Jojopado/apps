// WILDKIN 野境物語：卡牌資料（純資料，之後轉 Unity 可直接對照）
export const TERRAINS = [
  { id: 'forest', name: '森林', tip: '每回合你第一隻進入森林的動物，可查看牌庫頂一張牌，決定要不要放到牌底。' },
  { id: 'lake', name: '湖泊', tip: '每回合湖泊第一次造成傷害的攻擊，會讓目標下回合速度 -2。' },
  { id: 'grass', name: '草原', tip: '回合結束時，草原前排還活著的動物獲得 1 點護盾。' },
];

export const FACTIONS = {
  fox: { name: '狐狸', theme: '詭計與操控', color: '#d9772f', desc: '伏擊後排、干擾手牌與能量，靠精準交換取勝。' },
  rabbit: { name: '兔子', theme: '速度與展開', color: '#d9688f', desc: '便宜又快，搶先出手、連續進攻。' },
  bear: { name: '熊', theme: '防守與反擊', color: '#8a5a3c', desc: '血厚、護盾、被打就反擊，穩穩守住前排。' },
  penguin: { name: '企鵝', theme: '控制與減速', color: '#3f86b8', desc: '凍結與減速，打亂對手的攻擊順序。' },
  cat: { name: '貓咪', theme: '抽牌與資源', color: '#8467b8', desc: '抽更多牌、拿更多能量，組合更完整。' },
};

export const SPECIES = {
  fox: { name: '狐狸', home: 'forest', perk: '攻擊時 ATK +1' },
  squirrel: { name: '松鼠', home: 'forest', perk: '登場時本回合能量 +1' },
  deer: { name: '鹿', home: 'forest', perk: '每回合第一次受到的傷害 -1' },
  penguin: { name: '企鵝', home: 'lake', perk: '登場時獲得冰盾，擋下第一次攻擊' },
  otter: { name: '水獺', home: 'lake', perk: '攻擊後，若後排有空位就退到後排' },
  frog: { name: '青蛙', home: 'lake', perk: '攻擊命中後，目標下回合 SPD -1' },
  rabbit: { name: '兔子', home: 'grass', perk: '登場時本回合 ATK +1、SPD +1' },
  bear: { name: '熊', home: 'grass', perk: '受傷後反擊傷害 +1' },
  hedgehog: { name: '刺蝟', home: 'grass', perk: '被攻擊時反射 1 點傷害' },
  cat: { name: '貓咪', home: null, perk: '' },
};

export const KEYWORDS = {
  ambush: ['伏擊', '攻擊時優先打同區敵方後排，無視守護。'],
  guard: ['守護', '同區敵人的攻擊要先打這隻（伏擊除外）。'],
  counter: ['反擊', '受到攻擊且活下來時，對攻擊者造成傷害。'],
  hide: ['隱匿', '下一次被攻擊會落空。'],
  pursuit: ['追擊', '擊倒敵人後，再攻擊一次。'],
  double: ['連擊', '每回合攻擊兩次。'],
  retreat: ['移動', '攻擊後，若後排有空位就退到後排。'],
};

const a = (id, name, species, fac, cost, atk, hp, spd, text, x = {}) =>
  ({ id, kind: 'animal', name, species, fac, cost, atk, hp, spd, text, kw: x.kw || {}, fx: x.fx || [], bond: x.bond || null, acc: x.acc || '' });
const it = (id, name, kind, cost, t, text, play, x = {}) =>
  ({ id, kind, name, fac: 'neutral', cost, t, text, play, icon: x.icon || 'leaf' });

export const CARDS = [
  // ── 狐狸 ──
  a('f1', '小偷狐', 'fox', 'fox', 1, 1, 2, 3, '伏擊', { kw: { ambush: 1 } }),
  a('f2', '影尾狐', 'fox', 'fox', 2, 2, 2, 3, '伏擊。羈絆（企鵝）：SPD +2', { kw: { ambush: 1 }, bond: { fac: 'penguin', spd: 2 }, acc: 'mask' }),
  a('f3', '迷霧狐', 'fox', 'fox', 2, 1, 3, 2, '隱匿', { kw: { hide: 1 }, acc: 'scarf' }),
  a('f4', '騙術狐', 'fox', 'fox', 3, 2, 3, 3, '登場：對手下回合能量 -1', { fx: [['enter', 'drain', 1]], acc: 'hat' }),
  a('f5', '陷阱狐', 'fox', 'fox', 3, 2, 4, 2, '受到攻擊後：凍結攻擊者', { fx: [['hurt', 'freezeAttacker']], acc: 'leaf' }),
  a('f6', '換位狐', 'fox', 'fox', 2, 2, 3, 4, '登場：同區敵方前後排互換', { fx: [['enter', 'swapFoe']], acc: 'bow' }),
  a('f7', '偷牌狐', 'fox', 'fox', 4, 3, 4, 3, '登場：對手隨機失去 1 張手牌', { fx: [['enter', 'discard', 1]], acc: 'glasses' }),
  a('f8', '九尾狐', 'fox', 'fox', 5, 4, 5, 4, '伏擊、追擊', { kw: { ambush: 1, pursuit: 1 }, acc: 'crown' }),
  // ── 兔子 ──
  a('r1', '跳跳兔', 'rabbit', 'rabbit', 1, 1, 2, 5, '死亡時：抽 1 張', { fx: [['death', 'draw', 1]] }),
  a('r2', '奔奔兔', 'rabbit', 'rabbit', 1, 1, 2, 5, '羈絆（熊）：ATK +1', { bond: { fac: 'bear', atk: 1 }, acc: 'scarf' }),
  a('r3', '雙跳兔', 'rabbit', 'rabbit', 2, 1, 2, 6, '連擊', { kw: { double: 1 }, acc: 'bow' }),
  a('r4', '接力兔', 'rabbit', 'rabbit', 2, 2, 2, 5, '登場：本回合能量 +1', { fx: [['enter', 'energy', 1]], acc: 'hat' }),
  a('r5', '滑滑水獺', 'otter', 'rabbit', 2, 2, 3, 4, '移動', { kw: { retreat: 1 } }),
  a('r6', '衝浪水獺', 'otter', 'rabbit', 3, 3, 3, 5, '追擊', { kw: { pursuit: 1 }, acc: 'glasses' }),
  a('r7', '閃電兔', 'rabbit', 'rabbit', 3, 3, 2, 6, '追擊', { kw: { pursuit: 1 }, acc: 'mask' }),
  a('r8', '兔王', 'rabbit', 'rabbit', 5, 4, 5, 7, '登場：己方全體本回合 ATK +1、SPD +1', { fx: [['enter', 'allTemp', [1, 1]]], acc: 'crown' }),
  // ── 熊 ──
  a('b1', '小熊', 'bear', 'bear', 1, 1, 3, 1, '守護。羈絆（兔子）：ATK +1', { kw: { guard: 1 }, bond: { fac: 'rabbit', atk: 1 } }),
  a('b2', '刺蝟兵', 'hedgehog', 'bear', 1, 1, 2, 2, '反擊 1', { kw: { counter: 1 } }),
  a('b3', '小鹿', 'deer', 'bear', 2, 1, 4, 2, '回合結束：同區友軍回復 1 HP', { fx: [['rend', 'zoneHeal', 1]] }),
  a('b4', '盾牌熊', 'bear', 'bear', 3, 2, 5, 1, '守護。登場：護盾 +1', { kw: { guard: 1 }, fx: [['enter', 'selfShield', 1]], acc: 'hat' }),
  a('b5', '尖刺蝟', 'hedgehog', 'bear', 2, 1, 3, 2, '反擊 2', { kw: { counter: 2 }, acc: 'scarf' }),
  a('b6', '鹿角守衛', 'deer', 'bear', 3, 2, 5, 2, '反擊 1', { kw: { counter: 1 }, acc: 'leaf' }),
  a('b7', '鐵掌熊', 'bear', 'bear', 4, 3, 6, 1, '反擊 2', { kw: { counter: 2 }, acc: 'glasses' }),
  a('b8', '山嶽熊王', 'bear', 'bear', 5, 4, 8, 1, '守護。回合結束：同區友軍護盾 +1', { kw: { guard: 1 }, fx: [['rend', 'zoneShield', 1]], acc: 'crown' }),
  // ── 企鵝 ──
  a('p1', '小企鵝', 'penguin', 'penguin', 1, 1, 3, 2, '登場：同區敵人本回合 SPD -1', { fx: [['enter', 'zoneSlow', 1]] }),
  a('p2', '冰滑企鵝', 'penguin', 'penguin', 2, 2, 3, 3, '攻擊命中：目標下回合 SPD -1。羈絆（狐狸）：ATK +1', { fx: [['attack', 'tgtSlowNext', 1]], bond: { fac: 'fox', atk: 1 }, acc: 'scarf' }),
  a('p3', '呱呱蛙', 'frog', 'penguin', 1, 1, 2, 3, '登場：隨機敵人本回合 SPD -2', { fx: [['enter', 'randSlow', 2]] }),
  a('p4', '長舌蛙', 'frog', 'penguin', 2, 2, 2, 4, '攻擊命中：目標下回合 SPD -2', { fx: [['attack', 'tgtSlowNext', 2]], acc: 'bow' }),
  a('p5', '冰封企鵝', 'penguin', 'penguin', 3, 2, 4, 3, '登場：凍結同區敵方前排', { fx: [['enter', 'freezeFront']], acc: 'hat' }),
  a('p6', '毒沼蛙', 'frog', 'penguin', 3, 2, 4, 4, '登場：同區敵方前排永久 ATK -1', { fx: [['enter', 'weakFront', 1]], acc: 'mask' }),
  a('p7', '冰牆企鵝', 'penguin', 'penguin', 4, 2, 7, 2, '守護。登場：同區敵人本回合 SPD -2', { kw: { guard: 1 }, fx: [['enter', 'zoneSlow', 2]], acc: 'glasses' }),
  a('p8', '極地女王', 'penguin', 'penguin', 5, 4, 6, 3, '登場：凍結所有敵方前排', { fx: [['enter', 'freezeAllFront']], acc: 'crown' }),
  // ── 貓咪 ──
  a('c1', '奶貓', 'cat', 'cat', 1, 1, 1, 3, '死亡時：抽 1 張', { fx: [['death', 'draw', 1]] }),
  a('c2', '囤糧松鼠', 'squirrel', 'cat', 1, 1, 2, 3, '下回合能量 +1', { fx: [['enter', 'energyNext', 1]] }),
  a('c3', '書櫃貓', 'cat', 'cat', 2, 1, 3, 2, '登場：抽 1 張', { fx: [['enter', 'draw', 1]], acc: 'glasses' }),
  a('c4', '松鼠會計', 'squirrel', 'cat', 2, 1, 3, 3, '回合開始：本回合能量 +1', { fx: [['rstart', 'energy', 1]], acc: 'hat' }),
  a('c5', '魔術貓', 'cat', 'cat', 3, 2, 3, 3, '登場：抽 2 張', { fx: [['enter', 'draw', 2]], acc: 'mask' }),
  a('c6', '橘貓老大', 'cat', 'cat', 3, 3, 4, 2, '登場：每有 2 張手牌，永久 ATK +1', { fx: [['enter', 'handAtk']], acc: 'scarf' }),
  a('c7', '藏書松鼠', 'squirrel', 'cat', 3, 2, 4, 2, '回合結束：抽 1 張', { fx: [['rend', 'draw', 1]], acc: 'leaf' }),
  a('c8', '貓神', 'cat', 'cat', 5, 4, 6, 3, '登場：抽 2 張、護盾 +2', { fx: [['enter', 'draw', 2], ['enter', 'selfShield', 2]], acc: 'crown' }),
  // ── 通用：道具 ──
  it('g1', '蜂蜜罐', 'item', 1, 'ally', '友軍回復 3 HP', [['tHeal', 3]], { icon: 'honey' }),
  it('g2', '橡果盾', 'item', 1, 'ally', '友軍護盾 +2', [['tShield', 2]], { icon: 'acorn' }),
  it('g3', '磨爪石', 'item', 1, 'ally', '友軍永久 ATK +1', [['tAtk', 1]], { icon: 'stone' }),
  it('g4', '飛毛鞋', 'item', 1, 'ally', '友軍本回合 SPD +3', [['tTempSpd', 3]], { icon: 'shoe' }),
  it('g5', '傳送葉', 'item', 1, 'ally', '把友軍移到任一空位', [['move']], { icon: 'leaf' }),
  it('g6', '隱形斗篷', 'item', 2, 'ally', '友軍獲得隱匿', [['tHide']], { icon: 'cloak' }),
  it('g7', '守護徽章', 'item', 2, 'ally', '友軍獲得守護、最大 HP +2', [['tGuard'], ['tHp', 2]], { icon: 'badge' }),
  it('g8', '刺刺背心', 'item', 2, 'ally', '友軍反擊 +2', [['tCounter', 2]], { icon: 'vest' }),
  it('g9', '羈絆項圈', 'item', 3, 'ally', '友軍永久 ATK +2、最大 HP +2', [['tAtk', 2], ['tHp', 2]], { icon: 'collar' }),
  // ── 通用：事件 ──
  it('g10', '小石子', 'event', 1, 'enemy', '對敵人造成 1 點傷害', [['tDmg', 1]], { icon: 'stone' }),
  it('g11', '落雷', 'event', 3, 'enemy', '對敵人造成 3 點傷害', [['tDmg', 3]], { icon: 'bolt' }),
  it('g12', '森林蔓延', 'event', 2, 'zone', '選一區，本回合變成森林', [['terrain', 'forest']], { icon: 'tree' }),
  it('g13', '大雨成湖', 'event', 2, 'zone', '選一區，本回合變成湖泊', [['terrain', 'lake']], { icon: 'wave' }),
  it('g14', '野火成原', 'event', 2, 'zone', '選一區，本回合變成草原', [['terrain', 'grass']], { icon: 'grass' }),
  it('g15', '順風', 'event', 2, null, '己方全體本回合 SPD +1', [['allTempSide', [0, 1]]], { icon: 'wind' }),
  it('g16', '野莓', 'event', 0, null, '本回合能量 +1', [['energy', 1]], { icon: 'berry' }),
  it('g17', '尋寶', 'event', 2, null, '抽 2 張', [['draw', 2]], { icon: 'map' }),
  it('g18', '奇襲號角', 'event', 2, null, '己方全體本回合獲得伏擊', [['ambushAll']], { icon: 'horn' }),
  it('g19', '休戰旗', 'event', 2, 'zone', '選一區，本回合該區不能攻擊也不會被攻擊', [['truce']], { icon: 'flag' }),
  it('g20', '逆風', 'event', 2, null, '本回合改由速度低的先攻擊', [['reverse']], { icon: 'wind' }),
];

export const byId = Object.fromEntries(CARDS.map((c) => [c.id, c]));
export const GENERIC_CORE = ['g1', 'g2', 'g3', 'g6', 'g10', 'g11', 'g16', 'g17'];

// 推薦牌組：兩個陣營各 8 種＋8 張通用；只選一個陣營時每張 2 份
export function recommendedDeck(facA, facB) {
  const pick = (f) => CARDS.filter((c) => c.fac === f).map((c) => c.id);
  const animals = facB && facB !== facA ? [...pick(facA), ...pick(facB)] : [...pick(facA), ...pick(facA)];
  return [...animals, ...GENERIC_CORE];
}

export const DECK_SIZE = 24;
export const COPY_LIMIT = 2;
export function deckProblem(ids) {
  if (ids.length !== DECK_SIZE) return `牌組要剛好 ${DECK_SIZE} 張（目前 ${ids.length}）`;
  const count = {};
  for (const id of ids) { count[id] = (count[id] || 0) + 1; if (count[id] > COPY_LIMIT) return '同名卡最多 2 張'; }
  const facs = new Set(ids.map((id) => byId[id].fac).filter((f) => f !== 'neutral'));
  if (facs.size > 2) return '最多 2 個動物陣營';
  return null;
}
