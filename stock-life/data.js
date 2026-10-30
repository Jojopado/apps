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
    VIP_CASH: 500000,       // start cash for names on the admin's test-player list
    AI_COUNT: 20,           // computer-controlled traders that keep the market and leaderboard alive
    BANKRUPT_BELOW: 1000,
    FEE_RATE: 0.001425, FEE_MIN: 20, TAX_RATE: 0.003,
    STEP_PAY: 0.1,          // $ per step  (1,000 steps = $100)
    STEP_CAP: 30000,        // steps credited per day
    SESSION: { days: [0, 1, 2, 3, 4, 5, 6], open: '17:00', close: '21:30', tzOffsetMin: 480 },
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
    { id: 'prop', name: '營建地產', icon: '🏗️', beta: 0.9, vol: 0.18 },
    { id: 'tele', name: '電信網路', icon: '📡', beta: 0.6, vol: 0.12 },
    { id: 'auto', name: '汽車機車', icon: '🚗', beta: 1.1, vol: 0.22 },
    { id: 'aero', name: '航太國防', icon: '🚀', beta: 0.9, vol: 0.22 },
    { id: 'mat',  name: '鋼鐵化工', icon: '🏭', beta: 1.2, vol: 0.22 },
    { id: 'fash', name: '服飾時尚', icon: '👗', beta: 1.0, vol: 0.20 },
    { id: 'dine', name: '餐飲連鎖', icon: '🍔', beta: 0.7, vol: 0.14 },
    { id: 'media', name: '媒體廣告', icon: '📺', beta: 1.0, vol: 0.20 },
    { id: 'edu',  name: '教育學習', icon: '📚', beta: 0.7, vol: 0.15 },
    { id: 'pet',  name: '寵物用品', icon: '🐶', beta: 0.8, vol: 0.16 },
    { id: 'sport', name: '運動健身', icon: '🏃', beta: 0.9, vol: 0.18 },
    { id: 'robo', name: '機器人',   icon: '🦾', beta: 1.4, vol: 0.32 },
    { id: 'home', name: '家電家居', icon: '🛋️', beta: 0.9, vol: 0.16 }
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
    { sym: 'ROOF', name: '屋頂不動產', sec: 'prop', p: 88.0, vol: 0.18, desc: '商辦與購物中心收租' },
    { sym: 'WAVE', name: '波段電信',   sec: 'tele', p: 72.4, vol: 0.14, desc: '行動網路與光纖寬頻，用戶數穩定' },
    { sym: 'LINK', name: '連線通訊',   sec: 'tele', p: 38.6, vol: 0.18, desc: '5G 基地台與網通設備' },
    { sym: 'ORBT', name: '軌道衛星網', sec: 'tele', p: 23.2, vol: 0.45, desc: '低軌衛星上網服務，還在燒錢擴張' },
    { sym: 'MOTO', name: '疾風機車',   sec: 'auto', p: 54.8, vol: 0.26, desc: '機車與電動機車大廠' },
    { sym: 'DRVE', name: '馳騁汽車',   sec: 'auto', p: 128,  vol: 0.24, desc: '傳統車廠，正在轉型做電動車' },
    { sym: 'TYRE', name: '圓輪輪胎',   sec: 'auto', p: 41.3, vol: 0.20, desc: '輪胎製造，跟著汽車銷量走' },
    { sym: 'JETS', name: '蒼穹航太',   sec: 'aero', p: 286,  vol: 0.28, desc: '民航客機零件供應商' },
    { sym: 'ARMR', name: '鋼盾防衛',   sec: 'aero', p: 97.5, vol: 0.22, desc: '國防裝備與偵察無人機' },
    { sym: 'RCKT', name: '星箭發射',   sec: 'aero', p: 64.0, vol: 0.55, desc: '火箭發射服務，一次失敗就重挫' },
    { sym: 'IRON', name: '鐵山鋼鐵',   sec: 'mat',  p: 31.7, vol: 0.26, desc: '鋼鐵冶煉，標準的景氣循環股' },
    { sym: 'CHEM', name: '晶化化工',   sec: 'mat',  p: 58.9, vol: 0.24, desc: '塑化原料與特用化學品' },
    { sym: 'GLSS', name: '透光玻璃',   sec: 'mat',  p: 44.6, vol: 0.22, desc: '面板與建築用玻璃' },
    { sym: 'SILK', name: '絲路服飾',   sec: 'fash', p: 76.2, vol: 0.26, desc: '平價快時尚品牌' },
    { sym: 'SNKR', name: '飛步球鞋',   sec: 'fash', p: 142,  vol: 0.30, desc: '潮流球鞋，聯名款一出就搶光' },
    { sym: 'GEMS', name: '星辰珠寶',   sec: 'fash', p: 210,  vol: 0.24, desc: '珠寶與名錶' },
    { sym: 'NOOD', name: '湯頭麵館',   sec: 'dine', p: 48.3, vol: 0.18, desc: '連鎖麵館，靠外送成長' },
    { sym: 'BRGR', name: '大口漢堡',   sec: 'dine', p: 66.1, vol: 0.16, desc: '速食連鎖店' },
    { sym: 'CAFE', name: '晨光咖啡',   sec: 'dine', p: 39.4, vol: 0.20, desc: '連鎖咖啡店，早餐生意最好' },
    { sym: 'NEWS', name: '天天新聞',   sec: 'media', p: 27.5, vol: 0.22, desc: '新聞網站與電視台' },
    { sym: 'ADSX', name: '點擊廣告',   sec: 'media', p: 88.7, vol: 0.32, desc: '網路廣告投放平台' },
    { sym: 'TUNE', name: '旋律音樂',   sec: 'media', p: 52.6, vol: 0.28, desc: '音樂串流與唱片公司' },
    { sym: 'LERN', name: '學海教育',   sec: 'edu',  p: 34.9, vol: 0.18, desc: '線上課程平台' },
    { sym: 'BOOK', name: '書香出版',   sec: 'edu',  p: 21.8, vol: 0.16, desc: '出版社與連鎖書店' },
    { sym: 'LING', name: '語通學習',   sec: 'edu',  p: 46.2, vol: 0.22, desc: '語言學習 App，訂閱制' },
    { sym: 'PAWS', name: '毛孩百貨',   sec: 'pet',  p: 57.3, vol: 0.20, desc: '寵物用品連鎖店' },
    { sym: 'VETS', name: '安心動物醫院', sec: 'pet', p: 83.4, vol: 0.16, desc: '連鎖動物醫院' },
    { sym: 'FEED', name: '汪喵飼料',   sec: 'pet',  p: 29.6, vol: 0.18, desc: '寵物飼料製造' },
    { sym: 'GYMX', name: '鐵人健身房', sec: 'sport', p: 36.8, vol: 0.24, desc: '連鎖健身房，看會員數' },
    { sym: 'BALL', name: '全壘打用品', sec: 'sport', p: 49.5, vol: 0.20, desc: '球類與運動器材' },
    { sym: 'TRAK', name: '足跡穿戴',   sec: 'sport', p: 112,  vol: 0.32, desc: '運動手錶與計步手環' },
    { sym: 'BOTS', name: '小幫手機器人', sec: 'robo', p: 168, vol: 0.40, desc: '掃地機器人與家用機器人' },
    { sym: 'ARMS', name: '精密手臂',   sec: 'robo', p: 254,  vol: 0.36, desc: '工廠自動化機械手臂' },
    { sym: 'DRON', name: '蜂鳥無人機', sec: 'robo', p: 61.2, vol: 0.45, desc: '空拍與送貨無人機' },
    { sym: 'COZY', name: '暖窩家具',   sec: 'home', p: 42.1, vol: 0.18, desc: '平價家具與收納用品' },
    { sym: 'COOL', name: '極地家電',   sec: 'home', p: 95.6, vol: 0.20, desc: '冷氣與冰箱' },
    { sym: 'LITE', name: '亮點照明',   sec: 'home', p: 18.4, vol: 0.26, desc: 'LED 燈具與智慧燈泡' }
  ];

  var api = { GAME: GAME, SECTORS: SECTORS, COMPANIES: COMPANIES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.STOCK_DATA = api;
})(this);
