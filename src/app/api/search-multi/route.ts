import { NextRequest } from 'next/server'
import { searchSkyscanner } from '@/lib/skyscanner'
import { getAirportByIata } from '@/lib/airport-db'
import type { MultiCitySegmentQuery, MultiCitySearchResult, SearchQuery } from '@/types'

interface RequestBody {
  segments: MultiCitySegmentQuery[]
  passengers: number
  cabinClass: string
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function POST(request: NextRequest) {
  const body: RequestBody = await request.json()
  const { segments, passengers = 1, cabinClass = 'economy' } = body

  if (!Array.isArray(segments) || segments.length < 2) {
    return Response.json({ error: '区間が不足しています' }, { status: 400 })
  }

  // Search segments sequentially to avoid RapidAPI rate limiting.
  // Each call is an explicit one-way search (no returnDate).
  const results = []
  for (let i = 0; i < segments.length; i++) {
    if (i > 0) await wait(1000)

    const seg = segments[i]
    const originInfo  = getAirportByIata(seg.origin)
    const destInfo    = getAirportByIata(seg.destination)

    const query: SearchQuery = {
      origin: seg.origin,
      destination: seg.destination,
      departureDate: seg.date,
      // returnDate intentionally omitted → one-way search
      passengers,
      cabinClass: cabinClass as SearchQuery['cabinClass'],
      rawQuery: '',
    }

    try {
      const flights = await searchSkyscanner(query)
      const sorted = [...flights].sort((a, b) => a.totalPrice - b.totalPrice)
      results.push({
        origin: seg.origin,
        destination: seg.destination,
        date: seg.date,
        originCity: originInfo?.city,
        destinationCity: destInfo?.city,
        cheapestPrice: sorted[0]?.totalPrice ?? null,
        cheapestFlight: sorted[0] ?? null,
        top5Flights: sorted.slice(0, 5),
      })
    } catch {
      results.push({
        origin: seg.origin,
        destination: seg.destination,
        date: seg.date,
        originCity: originInfo?.city,
        destinationCity: destInfo?.city,
        cheapestPrice: null,
        cheapestFlight: null,
        top5Flights: [],
      })
    }
  }

  const totalPrice = results.reduce((sum, r) => sum + (r.cheapestPrice ?? 0), 0)

  const response: MultiCitySearchResult = {
    type: 'multi-city',
    segments: results,
    totalPrice,
  }

  return Response.json(response)
}
