require('../js/explore.js');
const E = Explore;
let bad = 0; const t = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) bad++; };
const D = 20000, free = []; for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) free.push([i, j]);
let st = {};
const s1 = E.sparkles(st, 'central', free, D), s2 = E.sparkles(st, 'central', free, D);
t(s1.length === 3 && JSON.stringify(s1) === JSON.stringify(s2), '每區每天 3 個閃光物品，位置固定');
t(JSON.stringify(E.sparkles({}, 'central', free, D + 1)) !== JSON.stringify(s1), '隔天位置不同');
t(new Set(s1.map(s => s.key)).size === 3, '同一天不會重複位置');
const r = E.pickSparkle(st, s1[0].key, 'central', D);
t(r && (r.coins > 0 || r.item), '撿到金幣或紀念品：' + JSON.stringify(r));
t(E.pickSparkle(st, s1[0].key, 'central', D) === null, '同一個不能撿兩次');
t(E.sparkles(st, 'central', free, D).length === 2, '撿走的不會再出現');
// 結果固定：另一個存檔同一天撿同一個，結果一樣
const st2 = {}; t(JSON.stringify(E.pickSparkle(st2, s1[0].key, 'central', D)) === JSON.stringify(r), '同一天同一個位置的結果固定（重開也一樣）');
// 採集
const h = E.harvest(st, 'flower_patch_red', 'park:3,4', D);
t(h && h.mat === 'mat_flower' && h.n >= 1 && st.mats.mat_flower >= 1, '採集紅花叢 → 花瓣 ×' + (h && h.n));
t(E.harvest(st, 'flower_patch_red', 'park:3,4', D) === null && E.harvested(st, 'park:3,4', D), '同一叢今天不能再採');
t(E.harvest(st, 'flower_patch_red', 'park:3,4', D + 1) !== null, '隔天可以再採');
// 調查
const sr = E.search(st, 'fountain', 'central:fountain', D + 1);
t(sr && (sr.item || sr.nothing), '調查噴水池：' + JSON.stringify(sr));
t(E.search(st, 'fountain', 'central:fountain', D + 1).again, '同一天再調查 → 已經找過了');
// 機率大約正確（模擬 3000 天）
let gold = 0; for (let d = 0; d < 3000; d++) { const x = E.search({}, 'fountain', 'f', d); if (x.item === 'gold_coin') gold++; }
t(Math.abs(gold / 3000 - 0.15) < 0.03, '噴水池古金幣機率約 15%：' + (gold / 30).toFixed(1) + '%');
let clover = 0; for (let d = 0; d < 3000; d++) { const x = E.harvest({}, 'herb_bush', 'h', d); if (x.item === 'clover4') clover++; }
t(Math.abs(clover / 3000 - 0.12) < 0.03, '香草叢四葉草機率約 12%：' + (clover / 30).toFixed(1) + '%');
// 打工獎勵
st = {}; E.ensure(st);
t(E.jobBonus(st, 'cafe', 50).item === 'coffee_bean', '第一次打工必得咖啡豆');
t(E.jobBonus(st, 'park', 100) === null, '公園工作不給食物收藏');
// 系列獎勵
const p = E.seriesProgress(st, 'city');
t(p.total === 6 && E.claimSeries(st, 'city') === null, '城市紀念品 6 件，沒集滿不能領');
for (const id of p.ids) E.give(st, id);
const rw = E.claimSeries(st, 'city');
t(rw && rw.coins === 200 && E.claimSeries(st, 'city') === null, '集滿領 200 金幣，只能領一次');
const tot = Object.keys(E.COLLECT).length; t(tot === 24, '收藏品共 ' + tot + ' 件、4 個系列');
console.log(bad ? '問題 ' + bad : '探索測試全部通過');
