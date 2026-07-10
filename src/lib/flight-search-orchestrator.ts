import type { SearchQuery, FlightResult, PriceInsights } from '@/types'
import type { FlightProvider } from './flight-sources/base'
import { RapidAPIProvider } from './flight-sources/rapidapi-provider'
import { DuffelProvider } from './flight-sources/duffel-provider'
import { SerpAPIProvider } from './flight-sources/serpapi-provider'
import { TravelpayoutsProvider } from './flight-sources/travelpayouts-provider'
import { mergeFlights } from './flight-merge'
import { makeCacheKey, getCached, setCached } from './flight-cache'
import { recordPriceHistory } from './alert-store'

// Add AmadeusProvider, KiwiProvider etc. here when API keys are available
const providers: FlightProvider[] = [
  new RapidAPIProvider(),
  new DuffelProvider(),
  new SerpAPIProvider(),
  new TravelpayoutsProvider(),
]

export async function searchAllProviders(
  query: SearchQuery,
): Promise<{ flights: FlightResult[]; priceInsights?: PriceInsights }> {
  const cacheKey = makeCacheKey(
    query.origin,
    query.destination,
    query.departureDate,
    query.passengers,
    query.cabinClass,
    query.returnDate,
  )

  const cached = await getCached(cacheKey)
  if (cached) {
    console.log('[orchestrator] cache hit:', cacheKey)
    return cached
  }

  const settled = await Promise.allSettled(
    providers.map(async (p) => {
      console.log(`[${p.name}] 検索開始`)
      const results = await p.search(query)
      console.log(`[${p.name}] ${results.length}件取得`)
      return results
    })
  )

  const groups = settled.flatMap((result, i) => {
    if (result.status === 'fulfilled') return [result.value]
    const err = result.reason
    console.warn(`[${providers[i].name}] 失敗:`, err instanceof Error ? err.message : String(err))
    return []
  })

  // Extract price_insights carried by the first SerpAPI flight
  const priceInsights = groups.flat().find((f) => f.serpPriceInsights)?.serpPriceInsights

  const merged = mergeFlights(groups)
  console.log(`[orchestrator] 合計${merged.length}件`)
  const flights = merged.map((f) => f.raw)
  const result = { flights, priceInsights }
  await setCached(cacheKey, result)

  // Best-effort: record today's observed cheapest price for this route so the
  // price-history chart has data for every searched route (not just alerted
  // ones). Runs only on cache miss (real search); recording must never break the
  // search itself, and 0-result searches have no price to record.
  if (flights.length > 0) {
    try {
      const cheapest = flights.reduce(
        (min, f) => (f.totalPrice < min.totalPrice ? f : min),
        flights[0],
      )
      await recordPriceHistory(
        query.origin,
        query.destination,
        query.departureDate,
        cheapest.totalPrice,
        new Date().toISOString(),
      )
    } catch (err) {
      console.warn('[orchestrator] 価格履歴の記録に失敗（検索は継続）:', err instanceof Error ? err.message : String(err))
    }
  }

  return result
}
