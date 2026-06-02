export interface ChangelogEntry {
  date: string
  title: string
  items: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-06-02',
    title: 'AI価格分析がより正確になりました',
    items: [
      'Googleの実際の価格データ（過去最安値・通常価格帯）に基づいて「今買うべきか」を判定',
      '推測ではなくデータに基づく、根拠の明確なアドバイスに',
    ],
  },
  {
    date: '2026-06-02',
    title: '国内線対応と予約体験の強化',
    items: [
      'JAL・ANA・スカイマークなど国内線の検索に対応',
      '予約先パネルから航空会社の公式サイトへ直接ジャンプ',
      '曖昧な日付（「来週」など）はAIが相談モードで提案',
    ],
  },
]
