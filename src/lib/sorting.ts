import type { FlightResult, SearchMode } from '@/types'

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0
  return (value - min) / (max - min)
}

function computeScore(
  f: FlightResult,
  mode: SearchMode,
  minP: number, maxP: number,
  minD: number, maxD: number,
): number {
  const normPrice = normalize(f.totalPrice, minP, maxP)
  const normDur = normalize(f.totalDuration || 0, minD, maxD)
  const stopPenalty = (f.stops ?? 0) * 0.20

  switch (mode) {
    case 'price':   return normPrice * 0.90 + normDur * 0.05 + stopPenalty
    case 'balance': return normPrice * 0.50 + normDur * 0.35 + stopPenalty
    case 'elegant': return normPrice * 0.15 + normDur * 0.55 + stopPenalty * 0.60
    case 'fastest': return normDur * 0.85 + stopPenalty + normPrice * 0.05
  }
}

export function sortFlights(flights: FlightResult[], mode: SearchMode): FlightResult[] {
  if (flights.length === 0) return []

  if (mode === 'fastest') {
    return [...flights].sort((a, b) => {
      const stopDiff = (a.stops ?? 0) - (b.stops ?? 0)
      if (stopDiff !== 0) return stopDiff
      return (a.totalDuration || 0) - (b.totalDuration || 0)
    })
  }

  const prices = flights.map(f => f.totalPrice)
  const durations = flights.map(f => f.totalDuration || 0)
  const minP = Math.min(...prices), maxP = Math.max(...prices)
  const minD = Math.min(...durations), maxD = Math.max(...durations)

  return [...flights].sort(
    (a, b) =>
      computeScore(a, mode, minP, maxP, minD, maxD) -
      computeScore(b, mode, minP, maxP, minD, maxD),
  )
}
