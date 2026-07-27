#!/bin/bash
# PreToolUseフック：危険コマンドの決定論的ブロック
INPUT=$(cat)
CMD=$(echo "$INPUT" | grep -o '"command"[^,}]*' | cut -d'"' -f4-)

BLOCK_PATTERNS=(
  "rm -rf /"
  "rm -rf ~"
  "sudo "
  "curl.*\|.*bash"
  "curl.*\|.*sh"
  "wget.*\|.*bash"
  "git push --force"
  "git push -f"
  "chmod -R 777"
)

for PATTERN in "${BLOCK_PATTERNS[@]}"; do
  if echo "$CMD" | grep -qE "$PATTERN"; then
    echo "【guard.sh】危険パターンを検出したためブロックしました: $PATTERN" >&2
    exit 2
  fi
done

exit 0
