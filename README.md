# pedal-demo

電吉他效果器 / 音箱的 3D 互動介紹，以及用它做的一次跨模型對照：
同一份需求，交給兩個 Claude 模型各自從零做一次。

需求原文在 [sandbox/prompt.txt](sandbox/prompt.txt)：做一個 3D 互動式的介紹，
可以試各種代表性的效果器與音箱、聽到聲音怎麼變、看到波形怎麼變，而且效果可以疊加。

## 內容

| 資料夾 | 是什麼 | 怎麼開 |
|---|---|---|
| [fable/](fable/) | Claude Fable 5.2 的版本（先做的那一個） | 用瀏覽器直接開 `fable/index.html`，需連網載入 three.js 與字型 |
| [sonnet/](sonnet/) | Claude Sonnet 5.5 的版本，在 sandbox 內完成，看不到 `fable/` | `cd sonnet && python3 -m http.server 8765`，再開 `http://localhost:8765` |
| [sandbox/](sandbox/) | 隔離測試台：讓另一個模型重做同一題，且看不到先前的成果 | 見 [sandbox/README.md](sandbox/README.md) |

`sonnet/` 是該次執行的原始輸出，沒有修改過。其中 `sonnet/vendor/` 是 three.js r187（MIT 授權），
與 npm 上 `three@0.187.0` 的檔案逐位元相同。

## 兩個版本的差異

| | Sonnet 5.5 | Fable 5.2 |
|---|---|---|
| 效果器 / 音箱 | 10 種 / 4 款 | 10 種 / 4 款 |
| 疊加方式 | 順序固定，只能開關 | 可增刪、可前後搬移 |
| 看波形 | 吉他原音 vs 最終輸出 | 每一台各有即時波形，可看任一台的前後 |
| 3D 旋鈕 | 可直接拖曳 | 只會跟著滑桿轉 |
| 音源 | 1 段樂句、單音、正弦波、上傳、麥克風 / 吉他輸入 | 4 段樂句、單音、正弦波、上傳 |
| 其他 | 時間軸縮放、3D 頻譜長條、7 組預設 | 相同刻度切換、6 組預設 |
| 檔案結構 | 4 個 JS 模組，three.js 放在本機 | 單一 HTML 檔，three.js 從 CDN 載入 |

兩邊的吉他聲都是程式合成的（Karplus-Strong），效果器與音箱是用瀏覽器內建的濾波器與
波形整形做出該類型的特徵，不是逐一元件的電路模擬。

## 這次對照的條件

- Sonnet 的執行：2026-11-20，Claude Code 2.1.328，無人值守單次執行，17.9 分鐘、43 輪，
  依牌價 1.73 美元。Fable 那次是在 VSCode 裡互動執行，花費沒有記錄。
- 執行紀錄逐筆檢查過：Sonnet 沒有任何一次工具呼叫碰到先前的成果。
- 條件不完全相同，對 Sonnet 稍微不利，細節見 [sandbox/README.md](sandbox/README.md) 的「已知的限制」。
- 這張差異表是 Fable 整理的，也就是比較的其中一方。模型聽不到聲音，音色好壞要靠人實際試聽判斷。
