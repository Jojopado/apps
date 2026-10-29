// 操盤人生 — shared game data (used by player page, admin page and engine)
// Fees follow common real-world brokerage practice:
//   commission 0.1425% (min $20) on both sides, transaction tax 0.3% on sells
//   source: https://www.money101.com.tw/blog/買賣股票手續費怎麼算-一張圖表讓你一看就懂
//           https://school.gugu.fund/blog/gugu_knowledge/7348994481 (0.1425% both sides, min $20; 0.3% tax on sell)
// Volatility ranges are calibrated to typical annualised stock volatility (broad index ~15–20%,
// single stocks ~20–60%): https://en.wikipedia.org/wiki/Volatility_(finance)
(function (root) {
  var GAME = {
    DB: 'https://minigolf-party-default-rtdb.asia-southeast1.firebasedatabase.app/rooms/stk',
    START_CASH: 50000,
    BANKRUPT_BELOW: 1000,
    FEE_RATE: 0.001425, FEE_MIN: 20, TAX_RATE: 0.003,
    STEP_PAY: 0.1,          // $ per step  (1,000 steps = $100)
    STEP_CAP: 30000,        // steps credited per day
    SESSION: { days: [1, 2, 3, 4, 5], open: '09:00', close: '13:30', tzOffsetMin: 480 },
    INDEX_NAME: 'AVX 綜合指數'
  };

  // beta = sensitivity to the whole market, vol = annual volatility of the sector factor
  var SECTORS = [
    { id: 'semi', name: '半導體',   icon: '🔬', beta: 1.3, vol: 0.22 },
    { id: 'soft', name: '軟體與 AI', icon: '🤖', beta: 1.2, vol: 0.22 },
    { id: 'ev',   name: '電動車',   icon: '🔋', beta: 1.5, vol: 0.30 },
    { id: 'enrg', name: '能源',     icon: '🛢️', beta: 0.8, vol: 0.22 },
    { id: 'bank', name: '金融',     icon: '🏦', beta: 1.0, vol: 0.14 },
    { id: 'bio',  name: '生技醫療', icon: '🧬', beta: 0.9, vol: 0.25 },
    { id: 'retl', name: '零售電商', icon: '🛒', beta: 0.9, vol: 0.15 },
    { id: 'ship', name: '航運物流', icon: '🚢', beta: 1.2, vol: 0.30 },
    { id: 'air',  name: '航空旅遊', icon: '✈️', beta: 1.1, vol: 0.24 },
    { id: 'game', name: '遊戲娛樂', icon: '🎮', beta: 1.1, vol: 0.22 },
    { id: 'food', name: '食品民生', icon: '🍞', beta: 0.6, vol: 0.10 },
    { id: 'prop', name: '營建地產', icon: '🏗️', beta: 0.9, vol: 0.18 }
  ];

  // vol = annual idiosyncratic volatility, p = starting price
  var COMPANIES = [
    { sym: 'STRC', name: '星核科技',   sec: 'semi', p: 612,  vol: 0.32, desc: '高階處理器晶片設計，客戶遍布全球手機與伺服器廠' },
    { sym: 'WAFR', name: '晶穹製造',   sec: 'semi', p: 238,  vol: 0.28, desc: '晶圓代工，靠先進製程拿下大單' },
    { sym: 'PHTN', name: '光子記憶',   sec: 'semi', p: 74.5, vol: 0.40, desc: '記憶體晶片，價格隨景氣大起大落' },
    { sym: 'NEUR', name: '神經網路實驗室', sec: 'soft', p: 455, vol: 0.42, desc: 'AI 模型與雲端服務，成長快但很燒錢' },
    { sym: 'CLDW', name: '雲橋軟體',   sec: 'soft', p: 188,  vol: 0.26, desc: '企業雲端軟體訂閱，收入穩定' },
    { sym: 'PIXL', name: '像素安全',   sec: 'soft', p: 52.3, vol: 0.38, desc: '資安防護，駭客事件一多就受惠' },
    { sym: 'VOLT', name: '伏特汽車',   sec: 'ev',   p: 326,  vol: 0.50, desc: '電動車品牌龍頭，股價話題性十足' },
    { sym: 'CELL', name: '鋰源電池',   sec: 'ev',   p: 141,  vol: 0.40, desc: '車用電池芯，跟著車廠訂單走' },
    { sym: 'CHRG', name: '快充網',     sec: 'ev',   p: 18.6, vol: 0.55, desc: '充電站營運，還在虧損的小型股' },
    { sym: 'OILX', name: '深海石油',   sec: 'enrg', p: 96.4, vol: 0.24, desc: '海上油田開採，油價是命脈' },
    { sym: 'SUNR', name: '日昇綠能',   sec: 'enrg', p: 43.8, vol: 0.36, desc: '太陽能與儲能電廠，看政策補助' },
    { sym: 'GRID', name: '城市電網',   sec: 'enrg', p: 65.0, vol: 0.14, desc: '電力公用事業，配息穩、波動小' },
    { sym: 'CRWN', name: '皇冠銀行',   sec: 'bank', p: 58.2, vol: 0.18, desc: '老牌大銀行，利率越高賺越多' },
    { sym: 'SHLD', name: '盾牌保險',   sec: 'bank', p: 82.7, vol: 0.16, desc: '壽險與產險，災害多時理賠壓力大' },
    { sym: 'COIN', name: '閃付金融',   sec: 'bank', p: 34.1, vol: 0.45, desc: '行動支付與加密貨幣交易平台' },
    { sym: 'HELX', name: '螺旋生技',   sec: 'bio',  p: 27.9, vol: 0.65, desc: '新藥研發，臨床試驗結果決定生死' },
    { sym: 'MEDI', name: '仁心醫療',   sec: 'bio',  p: 152,  vol: 0.20, desc: '連鎖醫院與醫材，防禦型股票' },
    { sym: 'GENE', name: '基因密碼',   sec: 'bio',  p: 63.4, vol: 0.50, desc: '基因檢測與精準醫療' },
    { sym: 'CART', name: '快購電商',   sec: 'retl', p: 211,  vol: 0.30, desc: '線上購物平台，大促檔期是重點' },
    { sym: 'MART', name: '家樂量販',   sec: 'retl', p: 47.6, vol: 0.16, desc: '大型量販店，景氣差時反而穩' },
    { sym: 'LUXE', name: '琥珀精品',   sec: 'retl', p: 388,  vol: 0.26, desc: '奢侈品牌，看有錢人心情' },
    { sym: 'TIDE', name: '潮汐海運',   sec: 'ship', p: 39.2, vol: 0.48, desc: '貨櫃航運，運價一漲股價就噴' },
    { sym: 'ARCT', name: '北極物流',   sec: 'ship', p: 71.5, vol: 0.28, desc: '倉儲與冷鏈物流' },
    { sym: 'PORT', name: '港灣碼頭',   sec: 'ship', p: 29.8, vol: 0.22, desc: '港口營運，收入跟貿易量走' },
    { sym: 'SKYW', name: '天際航空',   sec: 'air',  p: 33.6, vol: 0.38, desc: '國際航空公司，油價與旅遊需求兩頭燒' },
    { sym: 'ROAM', name: '漫遊旅行',   sec: 'air',  p: 118,  vol: 0.32, desc: '線上訂房訂票平台' },
    { sym: 'BAYS', name: '海灣度假村', sec: 'air',  p: 54.9, vol: 0.30, desc: '度假村與郵輪' },
    { sym: 'QUST', name: '奇幻遊戲',   sec: 'game', p: 167,  vol: 0.40, desc: '手遊開發商，靠一款爆紅遊戲撐業績' },
    { sym: 'STRM', name: '串流影視',   sec: 'game', p: 245,  vol: 0.30, desc: '影音串流平台，訂閱數是關鍵' },
    { sym: 'ARNA', name: '競技場娛樂', sec: 'game', p: 21.4, vol: 0.45, desc: '電競賽事與演唱會' },
    { sym: 'BAKE', name: '麥香食品',   sec: 'food', p: 44.3, vol: 0.14, desc: '麵包與零食，經典防禦股' },
    { sym: 'FIZZ', name: '氣泡飲料',   sec: 'food', p: 62.8, vol: 0.16, desc: '飲料大廠，配息穩定' },
    { sym: 'FARM', name: '綠野農產',   sec: 'food', p: 25.5, vol: 0.30, desc: '農產品與肥料，天氣影響大' },
    { sym: 'TOWR', name: '高塔建設',   sec: 'prop', p: 36.7, vol: 0.28, desc: '住宅建商，看房市與利率' },
    { sym: 'CRNE', name: '鐵臂工程',   sec: 'prop', p: 49.1, vol: 0.24, desc: '大型公共工程承包' },
    { sym: 'ROOF', name: '屋頂不動產', sec: 'prop', p: 88.0, vol: 0.18, desc: '商辦與購物中心收租' }
  ];

  var api = { GAME: GAME, SECTORS: SECTORS, COMPANIES: COMPANIES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.STOCK_DATA = api;
})(this);
