#!/bin/bash
# PreToolUseフック：危険コマンドの決定論的ブロック
# 置き場所の方針：このファイルはリポジトリの外に置く。git管理下に置くと、
# 設定を持たないブランチに切り替えた瞬間にブロックが無効化されるため。
INPUT=$(cat)
# 末尾に残る引用符を除去する。除去しないと "( |$)" で終わるパターン
# （main/develop へのpush）が引用符に阻まれて一致せず、素通りする。
CMD=$(echo "$INPUT" | grep -o '"command"[^,}]*' | cut -d'"' -f4- | sed 's/"$//')

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
