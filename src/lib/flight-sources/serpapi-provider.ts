import type { SearchQuery, FlightResult, FlightSegment } from '@/types'
import { aviasalesLink } from '@/lib/travelpayouts'
import type { FlightProvider } from './base'
import type { NormalizedFlight } from './types'

// SerpAPI Google Flights レスポンス型
interface SerpFlight {
  departure_airport: { name: string; id: string; time: string }
  arrival_airport: { name: string; id: string; time: string }
  duration: number // minutes
  airline: string
  airline_logo: string
  travel_class: string
  flight_number: string
  legroom?: string
  overnight?: boolean
}

interface SerpFlightGroup {
  flights: SerpFlight[]
  layovers?: { duration: number; name: string; id: string }[]
  total_duration: number
  price: number
  type: string
  airline_logo: string
  departure_token?: string
  booking_token?: string
}

interface SerpAPIResponse {
  error?: string
  best_flights?: SerpFlightGroup[]
  other_flights?: SerpFlightGroup[]
}

// "2026-06-08 06:45" → "2026-06-08T06:45:00"
function serpTimeToISO(time: string): string {
  return time.replace(' ', 'T') + ':00'
}

function groupToFlightResult(
  group: SerpFlightGroup,
  query: SearchQuery,
  index: number,
): FlightResult {
  const first = group.flights[0]
  const last = group.flights[group.flights.length - 1]

  const segments: FlightSegment[] = group.flights.map((f) => ({
    origin: f.departure_airport.id,
    originName: f.departure_airport.name,
    destination: f.arrival_airport.id,
    destinationName: f.arrival_airport.name,
    departingAt: serpTimeToISO(f.departure_airport.time),
    arrivingAt: serpTimeToISO(f.arrival_airport.time),
    carrierCode: f.flight_number.split(' ')[0] ?? '',  // "JL 501" → "JL"
    carrierName: f.airline,
    flightNumber: f.flight_number.replace(/\s+/g, ''), // "JL 501" → "JL501"
    duration: f.duration,
    stops: 0,
  }))

  const stops = Math.max(0, group.flights.length - 1)

  return {
    id: `serpapi-${query.origin}-${query.destination}-${query.departureDate}-${index}`,
    totalPrice: group.price,
    currency: 'JPY',
    totalDuration: group.total_duration,
    segments,
    cabinClass: query.cabinClass,
    stops,
    baggageIncluded: false,
    bookingLink: aviasalesLink(
      first?.departure_airport.id ?? query.origin,
      last?.arrival_airport.id ?? query.destination,
      query.departureDate,
      query.passengers,
    ),
  }
}

export class SerpAPIProvider implements FlightProvider {
  readonly name = 'serpapi'

  async search(query: SearchQuery): Promise<NormalizedFlight[]> {
    const apiKey = process.env.SERPAPI_KEY
    if (!apiKey) {
      console.warn('[serpapi] SERPAPI_KEY未設定、スキップ')
      return []
    }

    const isRoundTrip = !!query.returnDate
    const params = new URLSearchParams({
      engine: 'google_flights',
      departure_id: query.origin,
      arrival_id: query.destination,
      outbound_date: query.departureDate,
      type: isRoundTrip ? '1' : '2',
      currency: 'JPY',
      hl: 'ja',
      api_key: apiKey,
    })
    if (isRoundTrip && query.returnDate) {
      params.set('return_date', query.returnDate)
    }

    const url = `https://serpapi.com/search.json?${params.toString()}`
    console.log('[serpapi] API呼び出し開始')

    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) {
      console.error(`[serpapi] request failed (${res.status}):`, await res.text())
      return []
    }

    const data: SerpAPIResponse = await res.json()

    if (data.error) {
      console.warn('[serpapi] APIエラー:', data.error)
      return []
    }

    const groups: SerpFlightGroup[] = [
      ...(data.best_flights ?? []),
      ...(data.other_flights ?? []),
    ]
    console.log(`[serpapi] ${groups.length}件取得`)

    return groups.map((group, i) => {
      const result = groupToFlightResult(group, query, i)
      const first = group.flights[0]

      return {
        origin: query.origin,
        destination: query.destination,
        departureDate: first?.departure_airport.time.split(' ')[0] ?? query.departureDate,
        airline: first?.flight_number.split(' ')[0] ?? '',     // "JL 501" → "JL"
        flightNumber: first?.flight_number.replace(/\s+/g, '') ?? '', // "JL 501" → "JL501"
        price: group.price,
        currency: 'JPY',
        durationMinutes: group.total_duration,
        stops: Math.max(0, group.flights.length - 1),
        sources: [this.name],
        raw: result,
      }
    })
  }
}
