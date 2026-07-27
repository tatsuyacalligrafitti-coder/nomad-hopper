#!/bin/bash
# コンテキスト肥大の機械的警告（UserPromptSubmitフック）
INPUT=$(cat)
TRANSCRIPT=$(echo "$INPUT" | grep -o '"transcript_path"[^,]*' | cut -d'"' -f4)
if [ -f "$TRANSCRIPT" ]; then
  SIZE=$(wc -c < "$TRANSCRIPT")
  if [ "$SIZE" -gt 1500000 ]; then
    echo "【システム警告】このセッションの会話ログが肥大しています（$((SIZE/1000))KB）。ユーザーに対し、区切りの良いところで進捗をファイルに書き出して/clearすることを、次の回答で必ず提案してください。"
  fi
fi
exit 0
