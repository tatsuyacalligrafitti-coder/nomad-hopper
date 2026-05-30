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
    providers.map((p) => p.search(query))
  )

  const groups = settled.flatMap((result, i) => {
    if (result.status === 'fulfilled') return [result.value]
    console.warn(`[orchestrator] provider "${providers[i].name}" failed:`, result.reason)
    return []
  })

  return mergeFlights(groups).map((f) => f.raw)
}
