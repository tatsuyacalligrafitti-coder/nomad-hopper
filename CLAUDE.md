# CLAUDE.md

## このプロジェクト
Tobira: 旅行検索AIコンシェルジュ（tobira-world.jp、Next.js/TypeScript/Tailwind/Vercel）
収益はTravelpayoutsアフィリエイト（marker=731864）のみ。現在は保守中心の受動運用

## 権限運用ルール（最重要・毎セッション適用）
- 権限は .claude/settings.json の3層（allow/ask/deny）＋PreToolUseフック（guard.sh）で管理する
- allow（自動実行）: プロジェクト内の読み書き・編集、build/test/lint、ローカルcommit
- ask（停止して人間承認）: git push、デプロイ、npm install、rm、gh操作。
  Remote Control経由でスマホから承認可
- deny（機械的拒否）: force push、sudo、.env・SSH鍵・GCPキーの読み取り
- 夜間・無人実行時：作業は必ず night/日付 ブランチで行い、mainに触れない。
  区切りごとにcommitする。判断に迷うタスクは停止せず、朝レポートの保留に回す

## デプロイ前チェック（Vercel）
1. npm run build がローカルで成功していること
2. .env の変更がある場合はVercel側の環境変数も更新済みか確認を促すこと
3. デプロイはask対象。人間の承認を待つ

## 秘密情報の扱い
- APIキー（Anthropic/RapidAPI/SerpAPI/Travelpayouts等）は .env のみ。
  コード・設定ファイル・allowlistに平文で書かない
- .env 系ファイルがgit管理に入っていないか、触るたびに確認

## セッション長の自己申告
- コンテキストの自動圧縮（auto-compact）警告が出たら、またはタスクの区切りが来たら、
  「ここで/clearして新セッションにすることを推奨します。引き継ぎ事項は○○です」と
  ユーザーに伝えること
- 長時間の連続作業では、区切りごとに進捗をPROGRESS.mdに書き出し、
  セッションをいつでも畳める状態を常に保つこと

## 更新履歴
- 2026-07-23 初版作成
- 2026-07-27 権限運用ルールを3層方式（allow/ask/deny＋guard.sh）に更新、
  夜間・無人実行ルールを追加、セッション長の自己申告を追加