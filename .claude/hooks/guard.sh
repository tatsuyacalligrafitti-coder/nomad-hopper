#!/bin/bash
INPUT=$(cat)
CMD=$(echo "$INPUT" | grep -o '"command"[^,}]*' | cut -d'"' -f4-)
BLOCK_PATTERNS=(
  "git push.*origin (main|develop)( |$)"
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
for P in "${BLOCK_PATTERNS[@]}"; do
  if echo "$CMD" | grep -qE "$P"; then
    echo "【guard.sh】この操作は禁止されています: $P" >&2
    exit 2
  fi
done
exit 0
