import type { SearchQuery } from '@/types'
import { searchSkyscanner } from '@/lib/skyscanner'
import type { FlightProvider } from './base'
import type { NormalizedFlight } from './types'

export class RapidAPIProvider implements FlightProvider {
  readonly name = 'rapidapi'

  async search(query: SearchQuery): Promise<NormalizedFlight[]> {
    const results = await searchSkyscanner(query)

    return results.map((r) => {
      const seg = r.segments[0]
      const departureDate = seg?.departingAt?.split('T')[0] ?? query.departureDate

      return {
        origin: query.origin,
        destination: query.destination,
        departureDate,
        airline: seg?.carrierCode ?? '',
        flightNumber: seg?.flightNumber ?? '',
        price: r.totalPrice,
        currency: r.currency,
        durationMinutes: r.totalDuration,
        stops: r.stops,
        sources: [this.name],
        raw: r,
      }
    })
  }
}
