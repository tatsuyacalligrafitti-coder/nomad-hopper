import { NextRequest } from 'next/server'
import { searchAllProviders } from '@/lib/flight-search-orchestrator'
import { assessPriceValidity } from '@/lib/price-validity'
import type { FlightResult, SearchQuery, CategorizedFlights } from '@/types'

function balanceScore(
  f: FlightResult,
  minPrice: number,
  minDuration: number,
): number {
  const priceFactor = f.totalPrice / (minPrice || 1) - 1
  const durFactor =
    f.totalDuration > 0 ? f.totalDuration / (minDuration || 1) - 1 : 0
  const stopsPenalty = f.stops * 0.3
  return priceFactor * 0.5 + durFactor * 0.3 + stopsPenalty
}

// 航空会社ごとの最安1件を抽出してから価格順に並べる（多様性保証）
function cheapestPerAirline(flights: FlightResult[], limit: number): FlightResult[] {
  const sorted = [...flights].sort((a, b) => a.totalPrice - b.totalPrice)
  const seen = new Map<string, FlightResult>()
  for (const f of sorted) {
    const carrier = f.segments[0]?.carrierCode || f.segments[0]?.carrierName || 'unknown'
    if (!seen.has(carrier)) seen.set(carrier, f)
  }
  return [...seen.values()]
    .sort((a, b) => a.totalPrice - b.totalPrice)
    .slice(0, limit)
}

function categorize(flights: FlightResult[]): CategorizedFlights {
  if (flights.length === 0) {
    return { cheapest: [], cheapestDirect: [], recommended: [] }
  }

  const cheapest = cheapestPerAirline(flights, 5)

  const directOnly = flights.filter((f) => f.stops === 0)
  const cheapestDirect = cheapestPerAirline(directOnly, 5)

  const byPrice = [...flights].sort((a, b) => a.totalPrice - b.totalPrice)
  const minPrice = byPrice[0].totalPrice
  const durations = flights.filter((f) => f.totalDuration > 0).map((f) => f.totalDuration)
  const minDuration = durations.length > 0 ? Math.min(...durations) : 1

  const recommended = [...flights]
    .sort(
      (a, b) =>
        balanceScore(a, minPrice, minDuration) -
        balanceScore(b, minPrice, minDuration),
    )
    .slice(0, 5)

  return { cheapest, cheapestDirect, recommended }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { query }: { query: SearchQuery } = body

  if (!query?.origin || !query?.destination || !query?.departureDate) {
    return Response.json(
      { error: '出発地・目的地・日程を指定してください' },
      { status: 400 },
    )
  }

  try {
    const { flights, priceInsights } = await searchAllProviders(query)
    const categorized = categorize(flights)
    if (priceInsights) categorized.priceInsights = priceInsights

    // Position the current lowest price within our own observed history. Best-effort:
    // a failure here must never degrade silently (warn) nor block the search.
    if (flights.length > 0) {
      try {
        const currentPrice = Math.min(...flights.map((f) => f.totalPrice))
        categorized.validityNote = await assessPriceValidity(
          query.origin,
          query.destination,
          currentPrice,
        )
      } catch (err) {
        console.warn(
          '[search] 価格妥当性の判定に失敗（検索は継続）:',
          err instanceof Error ? err.message : String(err),
        )
        categorized.validityNote = null
      }
    }

    return Response.json({ categorized, total: flights.length })
  } catch (err) {
    console.error('[search]', err)
    return Response.json({ error: '検索に失敗しました' }, { status: 500 })
  }
}
