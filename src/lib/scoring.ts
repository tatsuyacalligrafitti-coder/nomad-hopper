import type { FlightResult, SearchMode } from '@/types'

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0
  return (value - min) / (max - min)
}

export function scoreAndSort(flights: FlightResult[], mode: SearchMode): FlightResult[] {
  if (flights.length === 0) return []

  const prices = flights.map((f) => f.totalPrice)
  const durations = flights.map((f) => f.totalDuration)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const minDur = Math.min(...durations)
  const maxDur = Math.max(...durations)

  const scored = flights.map((f) => {
    const normPrice = normalize(f.totalPrice, minPrice, maxPrice)
    const normDur = normalize(f.totalDuration, minDur, maxDur)
    // Stops penalty: each connection adds equivalent of 20% of score range
    const stopPenalty = f.stops * 0.20

    let score: number
    switch (mode) {
      case 'price':
        // 価格優先: 最安値をトップに。時間・乗換は軽い参考値
        score = normPrice * 0.80 + normDur * 0.05 + stopPenalty
        break
      case 'balance':
        // バランス: 価格と時間を均等に重視
        score = normPrice * 0.50 + normDur * 0.35 + stopPenalty
        break
      case 'elegant':
        // 優雅: 直行・短時間優先。価格は二の次
        score = normPrice * 0.15 + normDur * 0.55 + stopPenalty * 0.60
        break
      case 'fastest':
        // 最速: 総所要時間のみで判断
        score = normPrice * 0.05 + normDur * 0.85 + stopPenalty
        break
    }

    return { ...f, score, mode }
  })

  // Ascending score = best first
  return scored.sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
}
