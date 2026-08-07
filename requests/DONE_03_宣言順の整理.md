# 依頼：宣言順の整理（react-hooks/immutability 3件）

## 背景
2026-08-03 の lint整理（DONE_01）で保留にした React Hooks 系エラーのうち、
「宣言前参照」＝宣言位置を移動するだけで解消できる3件を切り出したもの。
同じファイルに残る `react-hooks/set-state-in-effect`（7件）は手動シナリオ確認が
必要なため**本依頼には含めない**。別便で扱う。

## 対象（実測 2026-08-07 時点、計3件）
| ファイル | 参照箇所 | 宣言箇所 | 対象シンボル |
|---|---|---|---|
| `src/app/page.tsx` | 256:11 | 405 | `handleMultiCitySearch` |
| `src/app/page.tsx` | 258:11 | 578 | `handleSearch` |
| `src/components/MultiCityResults/index.tsx` | 356:11 | 419:24 | `setChatMessages` |

- `page.tsx`: useEffect 内の `.then` コールバック（254〜259行付近）から、
  はるか下（405行 / 578行）で定義された2つの関数を参照している
- `MultiCityResults`: 338行のuseEffect内（356行）で、419行の
  `const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])` を参照している

## 完了条件
- [x] 上記3件の `react-hooks/immutability` エラーが解消される
- [x] `npm run lint` のエラーが 14 → 11 になる（減った分が immutability 3件のみであること）
- [x] `npm run build` が成功する
- [x] `set-state-in-effect` のエラー件数が7件のまま変化していない（=effect本体に触れていない証拠）
- [x] 変更は night 系ブランチにcommitする（mainに直接触れない）

## 制約
- **挙動が同一であれば内部構造の変更は可**（DONE_01 の「ロジック変更禁止」制約はここでは緩和する）
- ただし許可するのは**宣言位置の移動のみ**。以下は禁止:
  - useEffect の中身の書き換え（setState の移動・削除・条件変更）
  - 関数本体のロジック変更、引数・戻り値の変更
  - `useCallback` / `useMemo` でのラップ追加（依存配列の判断が必要になり別種のリスクになるため）
  - 対象3ファイル箇所以外への波及的なリファクタ
- アフィリエイトリンク関連のファイルには触れない

## 進め方の推奨
1. `MultiCityResults` の `setChatMessages` から着手する。
   419〜422行の chat state ブロックを 338行のuseEffectより前に移すだけで済み、影響範囲が最も小さい
2. 次に `page.tsx` の2関数。こちらは関数本体が数十行あり、
   移動先で「関数が参照している state / 定数がまだ宣言されていない」新たなエラーを
   誘発する可能性がある

## 判断に迷ったら停止する条件（重要）
`page.tsx` の関数移動にあたり、以下に該当したら**実行せず保留に回す**:
- 関数を上に移すために、state や定数の宣言順まで芋づる式に組み替える必要が出た場合
- 移動後に新しい `immutability` エラーが別の箇所で発生した場合
- 移動だけでは解消せず、`useCallback` 化など構造変更が必要だと判明した場合

該当した場合は変更を戻し、`MultiCityResults` 分だけをcommitして、
理由を朝レポートの「保留」に記載すること。

## 検証
- `npm run lint` / `npm run build`
- 宣言位置の移動のみであれば挙動は変わらない想定だが、
  `page.tsx` に手を入れた場合は念のため以下を目視確認することを推奨:
  - URLクエリ付きでのトップページ直接アクセス（片道/往復検索が自動実行されること）
  - 同じくマルチシティクエリでの自動実行

## 残タスクとの関係
- `react-hooks/set-state-in-effect` 7件（`page.tsx` 1 / `AIExploreChat` 1 /
  `MultiCityResults` 3 / `OnboardingModal` 2）は別依頼。手動シナリオ確認が前提
- `MultiCityResults:365` の `react-hooks/exhaustive-deps`（warning 1件）も
  上記 set-state-in-effect と同じ useEffect のため、そちらに同梱する

## 完了記録
- 実施日: 2026-08-07
- commit: 97b9b93
- 結果: lint 14 errors → 11 errors（immutability 3件削減）、set-state-in-effect 7件維持、build 成功
- 途中離脱条件: 非該当（全依存が useEffect より前に宣言済みで芋づる式の組み替え不要）
