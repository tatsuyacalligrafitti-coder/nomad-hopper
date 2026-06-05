import type { SearchQuery } from '@/types'
import { aviasalesLink } from '@/lib/travelpayouts'
import type { FlightProvider } from './base'
import type { NormalizedFlight } from './types'

interface V1Entry {
  airline: string
  price: number
  flight_number: number
  departure_at: string
  duration_to?: number
  duration?: number
}

export class TravelpayoutsProvider implements FlightProvider {
  readonly name = 'travelpayouts'

  async search(query: SearchQuery): Promise<NormalizedFlight[]> {
    const token = process.env.TRAVELPAYOUTS_TOKEN
    if (!token) {
      console.warn('[travelpayouts] TRAVELPAYOUTS_TOKEN未設定、スキップ')
      return []
    }

    const params = new URLSearchParams({
      origin: query.origin,
      destination: query.destination,
      depart_date: query.departureDate.slice(0, 7), // YYYY-MM
      currency: 'jpy',
      limit: '10',
    })

    const res = await fetch(
      `https://api.travelpayouts.com/v1/prices/cheap?${params}`,
      {
        headers: { 'X-Access-Token': token },
        next: { revalidate: 3600 },
      },
    )

    if (!res.ok) {
      console.error(`[travelpayouts] request failed (${res.status}):`, await res.text())
      return []
    }

    const json = await res.json() as {
      success: boolean
      data: Record<string, Record<string, V1Entry>>
    }

    if (!json.success || !json.data) {
      console.warn('[travelpayouts] データなし')
      return []
    }

    const results: NormalizedFlight[] = []

    for (const [destCode, bucket] of Object.entries(json.data)) {
      for (const [transferKey, entry] of Object.entries(bucket)) {
        const stops = parseInt(transferKey, 10)
        const durationMinutes = entry.duration_to ?? entry.duration ?? 0
        const departureDate = entry.departure_at?.split('T')[0] ?? query.departureDate
        const flightNumber = `${entry.airline}${entry.flight_number}`

        results.push({
          origin: query.origin,
          destination: destCode,
          departureDate,
          airline: entry.airline,
          flightNumber,
          price: entry.price,
          currency: 'JPY',
          durationMinutes,
          stops,
          sources: [this.name],
          raw: {
            id: `tp-v1-${flightNumber}-${entry.departure_at}`,
            totalPrice: entry.price,
            currency: 'JPY',
            totalDuration: durationMinutes,
            segments: [
              {
                origin: query.origin,
                originName: query.origin,
                destination: destCode,
                destinationName: destCode,
                departingAt: entry.departure_at,
                arrivingAt: entry.departure_at,
                carrierCode: entry.airline,
                carrierName: entry.airline,
                flightNumber,
                duration: durationMinutes,
                stops,
              },
            ],
            cabinClass: query.cabinClass,
            stops,
            baggageIncluded: false,
            bookingLink: aviasalesLink(query.origin, destCode, departureDate, query.passengers),
          },
        })
      }
    }

    console.log(`[travelpayouts] ${results.length}件取得`)
    return results
  }
}
