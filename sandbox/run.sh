#!/bin/bash
# 在隔離環境中，用指定模型從零執行 prompt.txt 的任務。
#
#   sandbox/run.sh <label> [model]     例：sandbox/run.sh sonnet claude-sonnet-5-5
#                                          sandbox/run.sh haiku            （model 省略時等於 label）
#                                          sandbox/run.sh sonnet-2 claude-sonnet-5-5
#   sandbox/run.sh --selftest          不呼叫模型，只驗證隔離規則是否生效
#
# 隔離方式：整個 claude 行程（含它開的所有子行程）都包在 macOS sandbox-exec 裡，
# 由作業系統核心擋下讀寫，所以不論模型用 Read、Bash cat、grep 還是子代理都一樣被擋。
set -euo pipefail

HARNESS="$(cd "$(dirname "$0")" && pwd -P)"
REPO="$(cd "$HARNESS/.." && pwd -P)"   # 這個 repo 內含先前各模型的成果，受測端整個看不到
# 各 run 的工作區刻意放在 repo 之外，這樣 repo 可以不留任何開口、整個封鎖。
RUNS_DIR="${RUNS_DIR:-$(dirname "$REPO")/pedal-sandbox/runs}"
mkdir -p "$RUNS_DIR"; RUNS_DIR="$(cd "$RUNS_DIR" && pwd -P)"
case "$RUNS_DIR/" in "$REPO"/*) echo "RUNS_DIR 不能放在 repo 裡面（repo 對受測端是整個封鎖的）。" >&2; exit 1;; esac

UID_N="$(id -u)"
TMP_ROOT="/private/tmp/claude-${UID_N}"
# 預設用 VSCode 擴充套件內建的最新版 Claude Code；找不到才退回 PATH 上的 claude。
CLAUDE_BIN="${CLAUDE_BIN:-$(ls -d "$HOME"/.vscode/extensions/anthropic.claude-code-*/resources/native-binary/claude 2>/dev/null | sort -V | tail -1)}"
CLAUDE_BIN="${CLAUDE_BIN:-$(command -v claude)}"
# 受測模型可用的內建工具。刻意不含 Artifact（可列出並讀取已發佈的頁面）、
# ListAgents / SendMessage（可聯絡這台機器上的其他 session）與排程類工具。
TOOLS="${TOOLS:-Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Skill,Agent,TodoWrite,NotebookEdit,ToolSearch}"

slug() { printf '%s' "$1" | sed 's/[^A-Za-z0-9]/-/g'; }           # Claude Code 為每個工作目錄取的代號
requote() { printf '%s' "$1" | sed 's/[][\.*^$+?(){}|]/\\&/g'; }

blocked_paths() {  # 完全封鎖的路徑，一行一個絕對路徑
  local s f line; s="$(slug "$REPO")"
  echo "$REPO"                          # repo 本身：所有先前的成果、測試台、git 歷史
  echo "$HOME/.claude/projects/$s"      # 在 repo 根目錄開過的 Claude session 的對話紀錄
  echo "$TMP_ROOT/$s"                   # 以及它們的暫存區
  for f in "$HARNESS/blocked-paths.txt" "$HARNESS/blocked-paths.local.txt"; do
    [ -f "$f" ] || continue
    while IFS= read -r line || [ -n "$line" ]; do
      line="$(printf '%s' "$line" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
      case "$line" in
        ''|'#'*) ;;
        '~/'*) echo "$HOME/${line#\~/}" ;;
        /*) echo "$line" ;;
        *) echo "忽略 $(basename "$f") 裡不是絕對路徑的一行：$line" >&2 ;;
      esac
    done < "$f"
  done
}

make_profile() {  # $1=workdir $2=session-id  → 輸出 sandbox profile
  local workdir="$1" sid="$2" s; s="$(slug "$workdir")"
  cat <<EOF
(version 1)
(allow default)

;; A. 寫入保護：家目錄預設唯讀，只開放 Claude Code 與常見工具自己要用的位置
(deny file-write* (subpath "$HOME"))
(allow file-write*
  (subpath "$HOME/.claude")
  (regex #"^$(requote "$HOME")/\.claude\.json")
  (subpath "$HOME/Library")
  (subpath "$HOME/.npm")
  (subpath "$HOME/.cache")
  (subpath "$HOME/.config")
  (subpath "$HOME/.local"))

;; B. 其他 session 的對話紀錄 / 檔案備份 / 暫存區，以及其他模型的 run：內容不可讀
(deny file-read-data file-write*
  (subpath "$HOME/.claude/projects")
  (subpath "$HOME/.claude/file-history")
  (subpath "$TMP_ROOT")
  (subpath "$RUNS_DIR"))

;; C. 只有這一個 run 自己的位置可讀寫
;;    （sandbox 規則裡「指名的操作」優先於萬用字元，所以 file-read-data 必須明寫才蓋得過 B）
(allow file-read* file-read-data file-write*
  (subpath "$workdir")
  (subpath "$HOME/.claude/projects/$s")
  (subpath "$HOME/.claude/file-history/$sid")
  (subpath "$TMP_ROOT/$s"))
;;    Claude Code 啟動時會開啟暫存區的根目錄本身；只放行那一層（看得到其他 session 的目錄名，看不到內容）
(allow file-read-data (literal "$TMP_ROOT"))

;; D. 完全封鎖：連檔名、大小都看不到（放最後，優先權最高）
(deny file-read* file-read-data file-read-metadata file-write*
$(blocked_paths | sed 's/.*/  (subpath "&")/'))
EOF
}

if [ "${1:-}" = "--selftest" ]; then
  RUN="$RUNS_DIR/_selftest"; WORKDIR="$RUN/pedal-demo"; rm -rf "$RUN"; mkdir -p "$WORKDIR"
  make_profile "$WORKDIR" "00000000-0000-0000-0000-000000000000" > "$RUN/sandbox.sb"
  export WORKDIR REPO RUNS_DIR TMP_ROOT
  export BLOCKED="$(blocked_paths)"
  # 在進 sandbox 之前先列出 repo 裡實際存在的幾個檔案，進去之後逐一嘗試讀取
  export PROBES="$(cd "$REPO" && ls -d */index.html README.md sandbox/prompt.txt .git/HEAD 2>/dev/null)"
  export OWN_PROJECT="$HOME/.claude/projects/$(slug "$WORKDIR")" OWN_TMP="$TMP_ROOT/$(slug "$WORKDIR")"
  cd "$WORKDIR"
  set +e
  sandbox-exec -f "$RUN/sandbox.sb" /bin/bash -c '
    fail=0
    no()  { if eval "$2" >/dev/null 2>&1; then echo "LEAK   $1"; fail=1; else echo "ok     擋下：$1"; fi; }
    yes() { if eval "$2" >/dev/null 2>&1; then echo "ok     允許：$1"; else echo "BROKEN $1"; fail=1; fi; }
    while IFS= read -r p; do
      no "列出 $p" "ls \"$p\""
      no "stat $p" "stat \"$p\""
      f="$(find "$p" -type f 2>/dev/null | head -1)"; [ -n "$f" ] && { echo "LEAK   find 看得到 $f"; fail=1; }
      no "在 $p 寫入" "touch \"$p/_x\""
    done <<< "$BLOCKED"
    while IFS= read -r f; do
      [ -n "$f" ] && no "讀取 repo 內的 $f" "cat \"$REPO/$f\""
    done <<< "$PROBES"
    no  "列出所有專案的對話紀錄"   "ls $HOME/.claude/projects"
    no  "列出檔案備份區"           "ls $HOME/.claude/file-history"
    no  "讀取暫存區內其他 session" "find $TMP_ROOT -mindepth 2 2>/dev/null | grep -q ."
    no  "列出其他 run"             "ls \"$RUNS_DIR\""
    no  "寫入家目錄"               "touch $HOME/_sandbox_write_test"
    no  "寫入其他專案目錄"         "touch \"$(dirname "$REPO")/_sandbox_write_test\""
    yes "在自己的工作目錄讀寫"     "echo hi > \"$WORKDIR/_w\" && cat \"$WORKDIR/_w\" && ls \"$WORKDIR\" && rm \"$WORKDIR/_w\""
    yes "寫入自己的對話紀錄區"     "mkdir -p \"$OWN_PROJECT\" && echo hi > \"$OWN_PROJECT/_w\" && cat \"$OWN_PROJECT/_w\" && rm \"$OWN_PROJECT/_w\""
    yes "寫入自己的暫存區"         "mkdir -p \"$OWN_TMP\" && echo hi > \"$OWN_TMP/_w\" && cat \"$OWN_TMP/_w\" && rm \"$OWN_TMP/_w\""
    yes "讀取全域 CLAUDE.md"       "cat $HOME/.claude/CLAUDE.md"
    yes "連網"                     "curl -sS -m 10 -o /dev/null https://cdnjs.cloudflare.com"
    hits="$(grep -rlF -e "Karplus" -e "createWaveShaper" "$HOME/.claude/projects" "$HOME/.claude/file-history" "$TMP_ROOT" "$REPO" "$RUNS_DIR" 2>/dev/null | head -5)"
    if [ -n "$hits" ]; then echo "LEAK   全文搜尋找得到先前成果的內容："; echo "$hits"; fail=1; else echo "ok     全文搜尋找不到先前成果的任何內容"; fi
    exit $fail'
  rc=$?
  rmdir "$OWN_PROJECT" "$OWN_TMP" 2>/dev/null; rm -rf "$RUN"
  [ $rc -eq 0 ] && echo "== 隔離自我測試：全部通過 ==" || echo "== 隔離自我測試：有項目失敗 =="
  exit $rc
fi

LABEL="${1:?用法：sandbox/run.sh <label> [model]　或　sandbox/run.sh --selftest}"
MODEL="${2:-$LABEL}"
RUN="$RUNS_DIR/$LABEL"
WORKDIR="$RUN/pedal-demo"          # 目錄名固定，不透露這是比較實驗
if [ -e "$RUN" ]; then echo "$RUN 已存在。為了確保從零開始，請換一個 label，或先自行刪除該目錄。" >&2; exit 1; fi
mkdir -p "$WORKDIR"
SID="$(uuidgen | tr 'A-Z' 'a-z')"
make_profile "$WORKDIR" "$SID" > "$RUN/sandbox.sb"
PROMPT="$(cat "${PROMPT_FILE:-$HARNESS/prompt.txt}")"   # PROMPT_FILE 可換成別的題目
printf 'label=%s\nmodel=%s\nsession=%s\nclaude=%s\nstarted=%s\n' "$LABEL" "$MODEL" "$SID" "$("$CLAUDE_BIN" --version 2>/dev/null | head -1)" "$(date '+%F %T')" > "$RUN/run-info.txt"

cd "$WORKDIR"
set +e
# env -i：不繼承呼叫端的環境變數。從另一個 Claude session 裡啟動時，環境中會帶有
# 該 session 的 ID、訊息通道與 effort 設定，必須清掉，受測端才是獨立且條件一致的。
env -i HOME="$HOME" USER="$USER" LOGNAME="$USER" SHELL=/bin/zsh PATH="$PATH" \
  LANG="${LANG:-en_US.UTF-8}" TERM=dumb TMPDIR="${TMPDIR:-/tmp}" \
sandbox-exec -f "$RUN/sandbox.sb" "$CLAUDE_BIN" -p "$PROMPT" \
  --model "$MODEL" --session-id "$SID" \
  --tools "$TOOLS" --allowedTools "$TOOLS" --permission-mode acceptEdits \
  --strict-mcp-config \
  --output-format stream-json --verbose \
  < /dev/null > "$RUN/log.jsonl" 2> "$RUN/stderr.log"
rc=$?
printf 'finished=%s\nexit=%s\n' "$(date '+%F %T')" "$rc" >> "$RUN/run-info.txt"
echo "run '${LABEL}' 結束 (exit ${rc})。成果在 ${WORKDIR}"
ls -la "$WORKDIR"
exit $rc
