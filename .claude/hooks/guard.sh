#!/bin/bash
# PreToolUseフック：危険コマンドの決定論的ブロック
# 置き場所の方針：このファイルはリポジトリの外に置く。git管理下に置くと、
# 設定を持たないブランチに切り替えた瞬間にブロックが無効化されるため。
INPUT=$(cat)

# ---- コマンド文字列の取り出し -----------------------------------------
# ここは過去に2度、穴が見つかっている。どちらも「文字列の切り出し方」が原因。
#
#   2026-08-12 朝  末尾に残る引用符のせいで "( |$)" で終わるパターン
#                  （main/develop へのpush）が一致せず素通りした
#   2026-08-12 夕  内側の引用符が \" のまま残るため、
#                  bash -c "git push origin main" のように引用符で包んだ形が
#                  素通りした。さらに [^,}]* での切り出しが「,」や「}」で
#                  値を途中で打ち切っていた（例: echo a, sudo rm → sudoを見落とす）
#
# そこで切り出しを次の手順に変えた。ブロック規則そのものは1つも変えていない。
#   1. "command" が出てくるたびに、その値を取り出す（出現順に依存しない）
#   2. \\ と \" をいったん目印に退避し、次の「生の "」までを値とする
#      （= 内側の引用符で値が途切れない。「,」「}」でも途切れない）
#   3. 退避した目印と残った \ は空白に戻す
#      （引用符・改行などの区切りを空白として扱うので、
#        引用符で包まれていても "main" の直後が空白になり、パターンに当たる）
CMD=""
REST="$INPUT"
while :; do
  case "$REST" in
    *'"command"'*) ;;
    *) break ;;
  esac
  REST="${REST#*\"command\"}"
  S="${REST#*:}"
  S="${S#*\"}"
  S="${S//\\\\/$'\001'}"
  S="${S//\\\"/$'\002'}"
  S="${S%%\"*}"
  S="${S//$'\002'/ }"
  S="${S//$'\001'/ }"
  S="${S//\\/ }"
  CMD="${CMD}
${S}"
done

BLOCK_PATTERNS=(
  "git push.*origin (main|develop)( |$)"
  "git push.*origin .*:(main|develop)( |$)"
  "git push --force"
  "git push -f"
  "rm -rf /"
  "rm -rf ~"
  "sudo "
  "curl.*\|.*bash"
  "curl.*\|.*sh"
  "wget.*\|.*bash"
  "chmod -R 777"
  "vercel.*--prod"
  "npx vercel.*--prod"
)

for PATTERN in "${BLOCK_PATTERNS[@]}"; do
  if echo "$CMD" | grep -qE "$PATTERN"; then
    echo "【guard.sh】危険パターンを検出したためブロックしました: $PATTERN" >&2
    exit 2
  fi
done

exit 0
