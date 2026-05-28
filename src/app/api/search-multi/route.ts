import { NextRequest } from 'next/server'
import { searchSkyscanner } from '@/lib/skyscanner'
import type { MultiCitySegmentQuery, MultiCitySearchResult, SearchQuery } from '@/types'

interface RequestBody {
  segments: MultiCitySegmentQuery[]
  passengers: number
  cabinClass: string
}

export async function POST(request: NextRequest) {
  const body: RequestBody = await request.json()
  const { segments, passengers = 1, cabinClass = 'economy' } = body

  if (!Array.isArray(segments) || segments.length < 2) {
    return Response.json({ error: '区間が不足しています' }, { status: 400 })
  }

  const results = await Promise.all(
    segments.map(async (seg) => {
      const query: SearchQuery = {
        origin: seg.origin,
        destination: seg.destination,
        departureDate: seg.date,
        passengers,
        cabinClass: cabinClass as SearchQuery['cabinClass'],
        rawQuery: '',
      }
      try {
        const flights = await searchSkyscanner(query)
        const sorted = [...flights].sort((a, b) => a.totalPrice - b.totalPrice)
        return {
          origin: seg.origin,
          destination: seg.destination,
          date: seg.date,
          cheapestPrice: sorted[0]?.totalPrice ?? null,
          cheapestFlight: sorted[0] ?? null,
        }
      } catch {
        return {
          origin: seg.origin,
          destination: seg.destination,
          date: seg.date,
          cheapestPrice: null,
          cheapestFlight: null,
        }
      }
    })
  )

  const totalPrice = results.reduce((sum, r) => sum + (r.cheapestPrice ?? 0), 0)

  const response: MultiCitySearchResult = {
    type: 'multi-city',
    segments: results,
    totalPrice,
  }

  return Response.json(response)
}
