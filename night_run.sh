#!/bin/bash
# 夜間オフィス起動スクリプト（Sonnet固定・max-turns 40）
cd "$(dirname "$0")"

BRANCH="night/$(date +%Y%m%d)"
git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH"
echo "作業ブランチ: $BRANCH"

TASK="$1"
if [ -z "$TASK" ]; then
  echo "使い方: ./night_run.sh '今夜のタスク内容'"
  exit 1
fi

claude --model claude-sonnet-4-6 --max-turns 40 -p "$TASK

【夜間運用ルール】
- 現在のブランチ（$BRANCH）から出ないこと。mainに触れない
- 区切りごとにgit commitすること
- 進捗と保留事項をPROGRESS.mdに書き出すこと
- 判断に迷うタスクは実行せず、PROGRESS.mdの「朝の保留」欄に記録すること"
