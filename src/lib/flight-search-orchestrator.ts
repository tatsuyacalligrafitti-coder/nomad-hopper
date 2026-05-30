import type { SearchQuery, FlightResult } from '@/types'
import type { FlightProvider } from './flight-sources/base'
import { RapidAPIProvider } from './flight-sources/rapidapi-provider'
import { DuffelProvider } from './flight-sources/duffel-provider'
import { mergeFlights } from './flight-merge'

// Add AmadeusProvider, KiwiProvider etc. here when API keys are available
const providers: FlightProvider[] = [
  new RapidAPIProvider(),
  new DuffelProvider(),
]

export async function searchAllProviders(query: SearchQuery): Promise<FlightResult[]> {
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

  const merged = mergeFlights(groups)
  console.log(`[orchestrator] 合計${merged.length}件`)
  return merged.map((f) => f.raw)
}
