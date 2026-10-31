// 任務邏輯測試
require('../js/quests.js');
const Q = Quests;
let bad = 0; const t = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) bad++; };
const D = 20000;
let st = {};
Q.ensure(st, D);
t(st.q.daily.list.length === 3 && new Set(st.q.daily.list.map(x => x.id)).size === 3, '每日抽 3 個不重複的任務');
t(JSON.stringify(Q.pickDaily(D)) === JSON.stringify(Q.pickDaily(D)), '同一天抽到的任務固定');
let diff = 0; for (let d = D; d < D + 30; d++) if (JSON.stringify(Q.pickDaily(d)) !== JSON.stringify(Q.pickDaily(d + 1))) diff++;
t(diff >= 25, '每天的任務會換（30 天內換了 ' + diff + ' 次）');
// 主線依序
t(Q.current(st, D).def.id === 'm1', '主線從 m1 開始');
Q.on(st, 'TALK', { npc: 'mia' }, D);
t(Q.current(st, D).prog === 0, '還沒到 m2 時跟 Mia 說話，不算主線進度');
t(Q.claim(st, 'm1', D) === null, '沒完成不能領');
const done = Q.on(st, 'ENTER', { scene: 'central' }, D);
t(done.some(x => x.id === 'm1'), '走到中央廣場 → m1 完成');
t(Q.claimable(st, D) >= 1, '有可領的獎勵（紅點）');
const r = Q.claim(st, 'm1', D);
t(r && r.coins === 30 && Q.current(st, D).def.id === 'm2', '領 m1：+30，接著 m2');
t(Q.claim(st, 'm1', D) === null, '同一個主線不能領兩次');
Q.on(st, 'TALK', { npc: 'mia' }, D); Q.claim(st, 'm2', D);
Q.on(st, 'JOB', { served: 0, correct: 0 }, D);
t(Q.current(st, D).prog === 0, '打工沒送出任何飲料不算完成');
Q.on(st, 'JOB', { served: 3, correct: 2 }, D); t(Q.claim(st, 'm3', D).coins === 80, 'm3 打工 +80');
Q.on(st, 'HOME', {}, D); Q.claim(st, 'm4', D);
Q.on(st, 'BUY', { item: 'plant_s' }, D); const r5 = Q.claim(st, 'm5', D);
t(r5 && r5.item === 'poster', 'm5 買家具 → 獎勵特別裝飾（海報）');
Q.on(st, 'JOB', { job: 'cafe', served: 2, correct: 2 }, D); t(Q.current(st, D).prog === 0, 'm6 只算公園工作，咖啡廳不算');
Q.on(st, 'JOB', { job: 'park', served: 5, correct: 5 }, D); t(Q.claim(st, 'm6', D).coins === 50, 'm6 清理公園 +50');
Q.on(st, 'COLLECT', { n: 1 }, D); Q.on(st, 'COLLECT', { n: 2 }, D); t(Q.claim(st, 'm7', D).coins === 80, 'm7 收集 3 種收藏品 +80');
Q.on(st, 'TALK', { npc: 'leo' }, D); t(Q.claim(st, 'm8', D).coins === 30, 'm8 認識 Leo');
Q.on(st, 'TALK', { npc: 'nora' }, D); t(Q.claim(st, 'm9', D).coins === 30, 'm9 認識 Nora');
Q.on(st, 'REQ', { npc: 'mia' }, D); t(Q.claim(st, 'm10', D).coins === 100, 'm10 完成委託');
t(Q.current(st, D) === null, '主線全部完成');
Q.addMain({ id: 'm99', title: '新步驟', desc: '', ev: 'TALK', match: d => d.npc === 'oliver', need: 1, coins: 50 });
t(Q.current(st, D).def.id === 'm99', '之後新增的主線步驟會自動接上');
// 每日、每週
st = {}; Q.ensure(st, D);
const ids = st.q.daily.list.map(x => x.id);
for (let k = 0; k < 12; k++) { Q.on(st, 'JOB', { served: 4, correct: 4 }, D); Q.on(st, 'VISIT', {}, D); Q.on(st, 'TALK', { npc: 'mia' }, D); Q.on(st, 'LIKE', {}, D); Q.on(st, 'PLACE', {}, D); Q.on(st, 'BUY', {}, D); Q.on(st, 'ENTER', { scene: 'commercial' }, D); }
let got = 0; for (const id of ids) { const c = Q.claim(st, id, D); if (c) got += c.coins; t(Q.claim(st, id, D) === null, '每日 ' + id + ' 只能領一次'); }
t(got > 0, '每日任務領到 ' + got + ' 金幣');
t(Q.claim(st, 'w_job', D).coins === 300 && Q.claim(st, 'w_visit', D).coins === 200, '每週任務：打工 10 次 300、參觀 5 間 200');
// 換日、換週
Q.ensure(st, D + 1);
t(st.q.daily.day === D + 1 && st.q.daily.list.every(x => !x.claimed && x.prog === 0), '隔天每日任務重置');
const wk = Q.weekNum(D); let d2 = D; while (Q.weekNum(d2) === wk) d2++;
Q.ensure(st, d2 - 1); t(st.q.weekly.list.every(x => x.claimed), '同一週內每週任務維持已領');
Q.ensure(st, d2); t(st.q.weekly.list.every(x => !x.claimed && x.prog === 0), '下一週每週任務重置');
t(Q.on(st, 'JOB', { served: 1, correct: 7 }, d2).length >= 0 && st.q.daily.list.every(x => x.prog <= Q.defOf(x.id).need), '進度不會超過需求');
console.log(bad ? '問題 ' + bad : '任務測試全部通過');
