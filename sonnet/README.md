# 電吉他效果器 × 音箱 3D 互動實驗室

## 執行
```bash
cd pedal-demo
python3 -m http.server 8765
# 瀏覽器開啟 http://localhost:8765  → 按「開始」（建議戴耳機）
```
（需要用 http 伺服器開啟，直接雙擊 index.html 會因為 ES Module 被瀏覽器擋掉。Three.js 已放在 vendor/，離線可用。）

## 內容
- 11 個效果器（訊號鏈順序固定）：Comp → Wah → Fuzz → Overdrive → Distortion → **音箱** → Chorus → Phaser → Tremolo → Delay → Reverb
- 4 款音箱 + 箱體模擬：Fender Twin、Vox AC30、Marshall Plexi、Mesa Rectifier，或「直通」
- 7 組預設（Clean / Blues / Rock / Metal / Psychedelic / Ambient / Funk）
- 音源：合成吉他 riff（Karplus-Strong）、單音、正弦波、上傳檔案、麥克風／吉他輸入
- 視覺化：乾聲 vs 效果後的時域波形疊圖、頻譜、3D 頻譜長條、削波類效果的轉換曲線

## 操作
- 點踏板的銀色踩釘 = 開關；旋鈕上按住上下拖曳 = 調整；點踏板／音箱 = 看說明
- 拖曳空白處旋轉視角，滾輪縮放

## 檔案
- `js/data.js` 效果器/音箱的名稱、說明、參數、預設組合
- `js/audio.js` Web Audio 引擎（各效果器 DSP）
- `js/scene.js` Three.js 3D 場景與互動
- `js/main.js` UI、波形/頻譜繪製
