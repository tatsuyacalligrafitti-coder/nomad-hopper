#!/bin/bash
# 通常の実装作業がひととおり最後まで通るかの自動検査
# 使い方:  bash scripts/check-workflow.sh
#
# 【この検査で分かること】
#   ファイル作成・編集・型検査・lint・ビルド・保存・送信・ブランチ切替が
#   途中で失敗せず最後まで通るか。
#
# 【この検査で分からないこと】
#   Claudeの画面に確認ダイアログが出たかどうか。ダイアログはパソコンの中では
#   なくClaude側で起きるため、スクリプトからは観測できません。そちらはClaudeが
#   同じ操作を実際に行って確認します。

set -u

TMP_SRC="src/lib/__selftest_tmp.ts"
TMP_CLAUDE=".claude/__selftest_tmp.json"
TMP_SCRIPT="scripts/__selftest_tmp.sh"
BRANCH_NAME="selftest/workflow-check"
ORIGINAL_BRANCH=""
FAILED_AT=""
FAILED_DESC=""

cleanup() {
  rm -f "$TMP_SRC" "$TMP_CLAUDE" "$TMP_SCRIPT"
  if [ -n "$ORIGINAL_BRANCH" ]; then
    git checkout --quiet "$ORIGINAL_BRANCH" 2>/dev/null
    git branch -D "$BRANCH_NAME" >/dev/null 2>&1
  fi
}
trap cleanup EXIT

fail() {
  FAILED_AT="$1"
  FAILED_DESC="$2"
}

# --- 0. 前提確認 --------------------------------------------------------

if [ -n "$(git status --porcelain)" ]; then
  echo "検査を始められません：保存していない変更が残っています。"
  echo "先に保存(コミット)するか、変更を元に戻してから実行してください。"
  exit 1
fi

ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# --- 検査本体 -----------------------------------------------------------

run_checks() {
  # 1. ブランチの切り替え
  git checkout --quiet -b "$BRANCH_NAME" 2>/dev/null || { fail 1 "検査用ブランチの作成と切り替え"; return; }

  # 2. 通常のソースファイルの新規作成
  cat > "$TMP_SRC" <<'EOF'
// 自動検査用の一時ファイル。検査終了時に自動削除されます。
export const selfTestValue = 1
EOF
  [ -f "$TMP_SRC" ] || { fail 2 "通常のソースファイルの新規作成"; return; }

  # 3. 通常のソースファイルの編集
  cat > "$TMP_SRC" <<'EOF'
// 自動検査用の一時ファイル。検査終了時に自動削除されます。
export const selfTestValue = 2
export function selfTestDouble(n: number): number {
  return n * 2
}
EOF
  grep -q selfTestDouble "$TMP_SRC" || { fail 3 "通常のソースファイルの編集"; return; }

  # 4. .claude/ 配下のファイルの新規作成
  echo '{"selftest": true}' > "$TMP_CLAUDE"
  [ -f "$TMP_CLAUDE" ] || { fail 4 "設定フォルダ内へのファイル新規作成"; return; }

  # 5. スクリプトファイルの作成と実行権限の付与
  echo '#!/bin/bash' > "$TMP_SCRIPT"
  echo 'exit 0' >> "$TMP_SCRIPT"
  chmod +x "$TMP_SCRIPT" || { fail 5 "スクリプトへの実行権限の付与"; return; }
  [ -x "$TMP_SCRIPT" ] || { fail 5 "スクリプトへの実行権限の付与"; return; }

  # 6. 型検査
  npx tsc --noEmit >/dev/null 2>&1 || { fail 6 "型検査"; return; }

  # 7. lint
  npx eslint "$TMP_SRC" >/dev/null 2>&1 || { fail 7 "lint（書き方の検査）"; return; }

  # 8. ビルド
  npm run build >/dev/null 2>&1 || { fail 8 "ビルド（本番と同じ組み立て）"; return; }

  # 9. 保存(コミット)
  git add "$TMP_SRC" >/dev/null 2>&1 || { fail 9 "保存対象への追加"; return; }
  git commit --quiet -m "chore: 自動検査用の一時コミット" >/dev/null 2>&1 || { fail 9 "保存(コミット)"; return; }

  # 10. 通常ブランチへの送信（実際には送らない確認モード）
  git push --dry-run origin "$BRANCH_NAME" >/dev/null 2>&1 || { fail 10 "通常ブランチへの送信"; return; }

  # 11. 元のブランチへの切り替え
  git checkout --quiet "$ORIGINAL_BRANCH" 2>/dev/null || { fail 11 "元のブランチへの切り替え"; return; }
}

run_checks

# --- 結果 ---------------------------------------------------------------

if [ -z "$FAILED_AT" ]; then
  echo "全て正常です（11項目すべて最後まで通りました）"
  echo "※ 確認ダイアログが出たかどうかは、この検査では分かりません。"
  exit 0
fi

echo "${FAILED_AT}番目で失敗しました → ${FAILED_DESC}"
exit 1
