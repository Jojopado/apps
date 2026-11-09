// 關卡：z 負＝畫面上方。lake/rocks/thick/water 用圓 [x,z,r]、方 {r:[x0,z0,x1,z1]}、粗線 {seg:[...],w}
// fish: [x,z,種類,朝向]；penguins: [x,z,朝向]；solution＝[x,z,dx,dz,力道]（測試用，確認一定有解）
export const LEVELS = [
  {
    name: '第一鎚', seed: 11, strikes: 2, par: 1, seal: [-2.2, -3.4, 0.6],
    hint: '按住冰面、往旁邊拖，決定裂痕的方向和長度，放開就敲下去。<br>把小海灣切下來，魚就能逃出來！',
    lake: [{ r: [-2.7, -2.2, 2.7, 4.6] }, { r: [-0.75, -4.9, 0.75, -1.8] }],
    fish: [[0, -3.9, 'Fish_Clownfish', 0.6]],
  },
  {
    name: '結冰的河', seed: 23, strikes: 3, par: 2,
    hint: '切下來的冰塊<b>夠小</b>才會碎掉沉下去。<br>拖曳時，會沉的地方會亮起來。',
    lake: [{ r: [-4.6, -0.95, 4.6, 0.95] }],
    rough: 0.12,
    fish: [[0.1, 0, 'Fish_BlueTang', 1.4]],
  },
  {
    name: '別吵醒企鵝', seed: 5, strikes: 2, par: 1,
    hint: '企鵝腳下的冰不能沉！<br>斜斜地切，只把魚那一角切掉。',
    lake: [[0, 0, 2.75]],
    fish: [[1.25, -2.05, 'Fish_YellowTang', 2.2]],
    penguins: [[2.1, -0.25, -1.2], [-0.6, 0.8, 0.4]],
  },
  {
    name: '岩石當牆', seed: 31, strikes: 3, par: 2,
    hint: '裂痕碰到岩石就會停，岩石也能幫你把冰圍起來。',
    lake: [{ r: [-2.7, -4.3, 2.7, 4.3] }],
    rocks: [[0.75, -1.5, 0.55], [-1.6, 2.4, 0.45]],
    fish: [[2.0, -1.5, 'Fish_Pufferfish', 0]],
    penguins: [[-1.2, -0.4, 0.8]],
  },
  {
    name: '厚冰', seed: 47, strikes: 5, par: 4, seal: [1.9, -4.95, -0.4],
    hint: '白白的<b>厚冰</b>敲不破，裂痕會被擋住。<br>魚在湖中間，要用好幾道裂痕把牠圍起來。',
    lake: [{ r: [-2.7, -4.4, 2.7, 4.4] }],
    thick: [[-1.25, -1.1, 0.5], [1.15, -0.6, 0.45], { seg: [-0.6, 0.6, 0.7, 0.9], w: 0.45 }],
    fish: [[0, -0.75, 'Fish_Goldfish', 0.8]],
    penguins: [[-1.6, 2.6, -0.5], [1.7, -3.0, 2.5]],
  },
  {
    name: '舊裂痕', seed: 59, strikes: 3, par: 2,
    hint: '冰上本來就有舊裂痕。<br>新的裂痕碰到它會接起來，好好利用！',
    lake: [[0, -1.6, 2.4], [0, 1.9, 2.3], { r: [-1.6, -1.6, 1.6, 1.9] }],
    cracks: [[0, 0.15, 1, 0.05, 1]],
    fish: [[-1.5, -0.55, 'Fish_EmperorAngelfish', 0.3], [1.55, 1.0, 'Fish_Lionfish', 2.8]],
    penguins: [[0.2, -2.6, 0.2], [-0.3, 2.9, 3.0], [0.5, 1.2, -2]],
  },
];

export const FISH_NAMES = {
  Fish_Clownfish: '小丑魚', Fish_BlueTang: '擬刺尾鯛', Fish_YellowTang: '黃高鰭刺尾鯛', Fish_Pufferfish: '河豚',
  Fish_Goldfish: '金魚', Fish_EmperorAngelfish: '皇后神仙魚', Fish_Lionfish: '獅子魚', Fish_Butterflyfish: '蝴蝶魚',
  Fish_RedSeaBream: '真鯛', Fish_Mackerel: '鯖魚', Fish_Sardine: '沙丁魚', Fish_Bannerfish: '馬夫魚',
};
