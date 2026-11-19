# sandbox：用其他模型重做同一題的隔離測試台

用途：把 `prompt.txt` 這一題交給另一個模型從零做一次，
並確保它看不到這個 repo 裡任何先前的成果。

## 怎麼用

在 repo 根目錄執行：

```bash
sandbox/run.sh --selftest                      # 不呼叫模型，只驗證隔離規則（約 10 秒）
sandbox/run.sh sonnet claude-sonnet-5-5        # label=sonnet，模型用 Sonnet 5.5
sandbox/run.sh haiku                           # label 與模型別名相同時可省略第二個參數
sandbox/run.sh sonnet-2 claude-sonnet-5-5      # 同一個模型再跑一次，要換 label
PROMPT_FILE=other.txt sandbox/run.sh x sonnet  # 換一份題目
```

各 run 的工作區在 repo **外面**，預設是與 repo 同層的 `pedal-sandbox/runs/`
（可用環境變數 `RUNS_DIR` 改）。放在外面是為了讓 repo 可以整個封鎖、不留開口。

| 路徑 | 內容 |
|---|---|
| `<RUNS_DIR>/<label>/pedal-demo/` | 受測模型的工作目錄，成果在這裡 |
| `<RUNS_DIR>/<label>/log.jsonl` | 完整過程（每一次工具呼叫與回覆），最後一行是結果與花費 |
| `<RUNS_DIR>/<label>/run-info.txt` | 模型、Claude Code 版本、起訖時間 |
| `<RUNS_DIR>/<label>/sandbox.sb` | 這個 run 實際套用的隔離規則，可事後稽核 |

想把某次成果留進 repo，就把它的 `pedal-demo/` 複製成 repo 根目錄下的一個資料夾
（`sonnet/` 就是這樣來的）。

## 受測端拿到什麼

- 題目：`prompt.txt`，是當初的原始需求，一字未改。沒有任何「這是比較實驗」的提示。
- 空的工作目錄，目錄名固定叫 `pedal-demo`，不在任何 git repo 裡。
- 與第一次相同的 Claude Code 執行檔（VSCode 擴充套件內建的那一版）與同一份全域 `~/.claude/CLAUDE.md`。
- 工具：Bash、Read、Write、Edit、Glob、Grep、WebSearch、Skill、子代理、NotebookEdit、ToolSearch。
- 可以連網（查文件、載入 CDN 函式庫都需要）。

## 受測端拿不到什麼

整個 `claude` 行程包在 macOS `sandbox-exec` 裡，由作業系統核心擋下，
所以不管它用 Read、`cat`、`grep`、`find` 還是子代理，結果都一樣。

| 被擋的東西 | 原因 |
|---|---|
| 這個 repo 整個（連檔名都看不到） | 所有先前的成果、測試台本身、git 歷史 |
| 在 repo 根目錄開過的 Claude session 的對話紀錄與暫存區 | 裡面有成果的完整內容 |
| `blocked-paths.txt` 與 `blocked-paths.local.txt` 另外列的路徑 | 其他存放成果的位置 |
| `~/.claude/projects/` 與 `~/.claude/file-history/` 裡其他 session 的內容 | 任何對話紀錄都可能含有成果 |
| `/tmp/claude-<uid>/` 裡其他 session 的內容 | 同上（只看得到目錄名） |
| 其他 run 的工作區 | 不同模型的 run 之間也互相看不到 |
| Artifact 工具 | 它能列出並讀取已發佈到 claude.ai 的頁面 |
| ListAgents / SendMessage、所有 MCP 連接器 | 能聯絡這台機器上的其他 Claude session |
| 呼叫端的環境變數 | 從另一個 Claude session 啟動時會帶有該 session 的 ID 與訊息通道 |

另外，家目錄對受測端預設唯讀（只開放它自己的工作目錄與 Claude Code、常見工具的設定 / 快取位置），
所以它不會動到其他專案。

## 已知的限制

- **網路沒有封鎖。** 成果若已發佈到網路上（例如 claude.ai 的頁面或這個 GitHub repo），
  受測端沒有 Artifact 工具、也不知道網址，但 sandbox 並沒有在網路層擋它。
- **與第一次的條件差異：** 第一次有 Artifact 工具（發佈前會拿到一份頁面設計準則），受測端沒有；
  第一次是在 VSCode 裡互動執行，受測端是無人值守的單次執行，無法向使用者提問。
- **sandbox 內無法再開第二層 sandbox。** 無頭 Chrome 預設會啟動自己的 sandbox，在這裡會失敗
  （`sandbox initialization failed`），受測端要自己發現並加上 `--no-sandbox` 才能截圖驗證。
  第一次沒有這個障礙，Sonnet 那次為此多花了至少兩次嘗試。
- `sandbox-exec` 是 macOS 專用，Apple 已標示為 deprecated 但仍可用。
- 換了機器或新增了存放成果的位置之後，先跑一次 `--selftest`。
