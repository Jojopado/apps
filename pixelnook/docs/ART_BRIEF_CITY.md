# PixelNook 城市美術說明書（給美術助手）

專案：`C:\Users\newto\AppPages\pixelnook`（純 JavaScript、HTML5 Canvas、全部程式繪圖）。
**先讀** `js/raster.js`（繪圖 API）、`js/models.js`（家具模型寫法、`p()` 零件規格、`ITEMS` 格式、方塊人）、`js/scene.js`（房間背景怎麼畫）、`test/check.js`（重疊檢查＋圖鑑輸出範例）。

## 絕對規則
1. **只新增自己的檔案**，不要修改任何現有檔案（raster.js、models.js、scene.js、game.js…都不能動）。
2. 全部用程式畫：不下載、不購買任何素材，不用漸層、不用模糊、不用半透明。
3. 2:1 等角，地板格子 64×32 px，`z` 單位是像素（往上）。角色身高約 90 px（頭頂約 z=75～78）、門要讓角色走得進去：門高約 80～90 px、寬約 0.6～0.8 格。
4. 風格跟現有家具一致：深藍外框 `PX.OUT`、方塊三面著色（`Iso.box` 自動處理）、頂面亮邊 `hi`、顏色乾淨飽和、可愛溫暖。不要寫實、不要做任何既有遊戲的角色或建築。不要放中國／台灣特定元素（不要招牌中文字、不要廟宇、夜市、101 之類）。
5. **層級規則（最重要）**：同一個物件拆成「彼此完全不重疊」的方塊（AABB 不能有體積交集，貼齊可以）。
   - 細節（窗框、門把、招牌、條紋）用「凸出 0.01～0.04 格的薄方塊」貼在看得到的面前面，或用 `bands`（只能畫水平色帶）。
   - 不要把小方塊塞進大方塊裡面（會從裡面透出來）。
   - 物件「前面」= 本地座標 +f 方向；`r=0` 時面向畫面左下。建築的門、招牌放在前面（+f）那一面。
6. 交件前**必須**跑你自己的檢查腳本：①所有物件 × 4 個旋轉（r=0..3）零件兩兩不重疊 ②輸出圖鑑 PNG。然後用 Read 工具**親眼看圖**，確認每個物件 4 個方向都正確，沒有透視、沒有錯位，才算完成。

## 交付格式
在你的檔案裡註冊到全域 `ART`：

```js
(function (G) {
  'use strict';
  const { shade, OUT } = G.PX;
  const p = (f, s, wf, ws, h, z, c, b, hi) => ({ f, s, wf, ws, h, z, c, b, hi: hi !== false }); // 跟 models.js 一樣
  G.ART = G.ART || {};
  G.ART.<你的區塊名> = {
    // 物件：格式跟 MODELS.ITEMS 相同（kind:'floor'），W = 左右格數、D = 前後格數，model(on) 回傳零件陣列
    OBJS: { cafe_building: { id: 'cafe_building', name: '咖啡廳', W: 5, D: 4, kind: 'floor', model: () => [ p(...), ... ],
            door: { f: 2.0, s: 0.0 } /* 門口在本地座標的位置（前面那一面外側一點），沒有門就不寫 */ }, ... },
    // 地面格子（只有城市外觀那位要做）：tile(iso, i, j) 在格子 (i,j)~(i+1,j+1) 的菱形裡平面繪製（z=0），可用 (i,j) 做固定的偽隨機花紋
    TILES: { grass: (iso, i, j) => {...}, ... },
  };
})(typeof window !== 'undefined' ? window : globalThis);
```

零件轉成畫面的方法：`MODELS.itemParts({ t:id, i, j, r })` 只認 `MODELS.ITEMS`，測試時請在你的腳本裡**暫時** `Object.assign(MODELS.ITEMS, G.ART.xxx.OBJS)` 再呼叫（不要改 models.js）。

## A：城市外觀（檔案 `js/art/city.js`，區塊名 `city`，測試 `test/art_city.js`，圖輸出到 `test/out/art_city_*.png`）
地面 TILES：`grass`（草地，有少量草叢點）、`road_i`／`road_j`（柏油路，沿 i 或沿 j 方向，中線虛線）、`sidewalk`（人行道磚）、`crosswalk_i`／`crosswalk_j`（斑馬線）、`plaza`（廣場石磚）、`dirt`（泥土小徑）、`water`（水面，給噴水池／池塘用）。
物件 OBJS（每件寫 name 中文名）：
- 建築外觀：`cafe_building`（咖啡廳，約 5×4 格、高約 150～180 px，有門、大窗戶、遮陽棚、咖啡杯造型招牌）、`bakery_building`（麵包店，有麵包造型招牌）、`market_building`（超市，較大，自動門造型）、`apartment_building`（住宅區入口用，先做外觀即可）、`house_player`（玩家的家：小房子，門是回房間的入口）。建築的門口位置用 `door` 標出來。
- 街道小物：`street_lamp`、`bench`、`tree_round`、`tree_pine`、`bush`、`flower_bed`、`fountain`（2×2 或 3×3，水用 TILES 的水色做頂面）、`bulletin_board`（公告欄）、`trash_bin`、`mailbox`、`fence_i`／`fence_j`（施工圍欄，用來擋住未開放道路）、`sign_arrow`（路標）。
另外做一張「示範街景」圖：24×18 格的地圖（中央廣場：廣場磚＋噴水池＋公告欄＋長椅＋樹，往下接一條路通往商業街），所有物件依層級排序後畫出來（可參考 `js/scene.js` 的 `drawables` + `PX.depthSort`），讓我看整體感覺。圖可以很大（例如 1600×1000），也輸出一張縮小版。

## B：咖啡廳室內＋人物配件（檔案 `js/art/cafe.js`，區塊名 `cafe`，測試 `test/art_cafe.js`，圖輸出到 `test/out/art_cafe_*.png`）
室內會用現有房間系統畫（9×8 格、牆高 150、左右兩面牆），所以請做：
- 物件 OBJS：`cafe_counter`（櫃台，3×1，正面木頭面板、檯面）、`espresso_machine`（放在櫃台後面的小桌或做成 1×1 的工作台＋咖啡機）、`cafe_table`（小圓桌風格的方桌 1×1）、`cafe_chair`（1×1，要能坐：在物件定義加 `seat: { z: 座面高, spots: [[f, s]] }`，格式參考 models.js 的 SEAT）、`pastry_case`（玻璃甜點櫃 2×1）、`menu_stand`（立式菜單板）、`plant_cafe`（盆栽）、`register`（收銀機，可放在櫃台上 → 請做成櫃台的一部分或獨立 1×1）、`cup_shelf`（杯子層架 2×1）。
- 牆面：在 `G.ART.cafe.WALLS`（格式跟 `MODELS.WALLS` 一樣 {name,a,b,stripe?,dots?}）加 2 種咖啡廳壁紙；`G.ART.cafe.FLOORS`（格式跟 `MODELS.FLOORS` 一樣）加 2 種地板（例如深色木地板、黑白格子）。
- 牆面裝飾：`G.ART.cafe.WALLDECO`，格式跟 models.js 裡 `wdef(...)` 產生的物件一樣（kind:'wall', W, z0, z1, paint(q, W)），做：`menu_board`（牆上黑板菜單，用色塊表示文字行，不要寫字）、`cafe_sign_wall`（咖啡杯圖案掛牌）、`wall_shelf_cups`。
- 小遊戲用的 2D 小圖（不是等角，是正面圖示）：`G.ART.cafe.ICONS = { latte: (pix, x, y) => {...}, ... }` 在 Pix 上 32×32 範圍內畫：`cup_empty`、`coffee`（咖啡豆或咖啡壺）、`milk`（牛奶瓶）、`foam`（奶泡）、`ice`（冰塊）、`syrup`（糖漿瓶）、`latte`、`americano`、`iced_latte`、`cappuccino`（成品飲料）、`customer_happy`、`customer_wait`（方塊人頭像表情）。
另外做一張「示範咖啡廳」圖：用 `SCENE.renderFull` 的方式（可以參考 test/scene_test.js），把你的壁紙、地板、物件擺成一間像樣的咖啡廳（櫃台在後面、桌椅在前面），加 2 個坐著的客人和 1 個站在櫃台後面的店員（用 `MODELS.charParts`，店員可以穿任意顏色上衣），輸出 PNG 給我看；再輸出一張 ICONS 的 4 倍放大圖。

## 回報
完成後回報：新增的檔案、每個物件的 id／中文名／尺寸、檢查腳本結果（重疊 0 處）、圖檔路徑、你自己覺得還不夠好的地方。
