import type { FlightResult, SearchMode } from '@/types'
import { LCC_CODES } from './lcc-list'

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0
  return (value - min) / (max - min)
}

function computePriceScore(
  f: FlightResult,
  minP: number, maxP: number,
  minD: number, maxD: number,
): number {
  const normPrice = normalize(f.totalPrice, minP, maxP)
  const normDur = normalize(f.totalDuration || 0, minD, maxD)
  const stopPenalty = (f.stops ?? 0) * 0.20
  return normPrice * 0.90 + normDur * 0.05 + stopPenalty
}

function isLcc(flight: FlightResult): boolean {
  return flight.segments.some(s => LCC_CODES.has(s.carrierCode))
}

function balanceScore(f: FlightResult, minPrice: number, maxPrice: number): number {
  const priceScore = maxPrice === minPrice
    ? 0
    : (f.totalPrice - minPrice) / (maxPrice - minPrice) * 0.4
  const stopScore = (f.stops ?? 0) * 0.3

  let timeScore = 0
  const dep = f.segments[0]?.departingAt
  if (dep) {
    const match = dep.match(/T(\d{2}):(\d{2})/)
    if (match) {
      const totalMinutes = parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
      if (totalMinutes < 6 * 60 || totalMinutes >= 22 * 60) timeScore = 0.3
    }
  }

  return priceScore + stopScore + timeScore
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

  if (mode === 'balance') {
    const prices = flights.map(f => f.totalPrice)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    return [...flights].sort((a, b) => balanceScore(a, minPrice, maxPrice) - balanceScore(b, minPrice, maxPrice))
  }

  if (mode === 'elegant') {
    const filtered = flights.filter(f => !isLcc(f))
    const base = filtered.length > 0 ? filtered : flights
    return [...base].sort((a, b) => {
      const stopDiff = (a.stops ?? 0) - (b.stops ?? 0)
      if (stopDiff !== 0) return stopDiff
      return a.totalPrice - b.totalPrice
    })
  }

  // price mode
  const prices = flights.map(f => f.totalPrice)
  const durations = flights.map(f => f.totalDuration || 0)
  const minP = Math.min(...prices), maxP = Math.max(...prices)
  const minD = Math.min(...durations), maxD = Math.max(...durations)

  return [...flights].sort(
    (a, b) =>
      computePriceScore(a, minP, maxP, minD, maxD) -
      computePriceScore(b, minP, maxP, minD, maxD),
  )
}
