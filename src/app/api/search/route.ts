import { NextRequest } from 'next/server'
import { searchFlights } from '@/lib/duffel'
import { scoreAndSort } from '@/lib/scoring'
import { generateMockFlights } from '@/lib/mockFlights'
import { searchCheapFlights } from '@/lib/travelpayouts'
import type { SearchQuery, SearchMode } from '@/types'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { query, mode = 'balance' }: { query: SearchQuery; mode: SearchMode } = body

  if (!query?.origin || !query?.destination || !query?.departureDate) {
    return Response.json(
      { error: '出発地・目的地・日程を指定してください' },
      { status: 400 },
    )
  }

  const [duffelFlights, cheapest] = await Promise.all([
    tryDuffel(query),
    tryTravelpayouts(query),
  ])

  let flights = duffelFlights
  if (flights.length === 0) {
    flights = generateMockFlights(query.origin, query.destination, query.departureDate)
  }

  const sorted = scoreAndSort(flights, mode)
  return Response.json({
    flights: sorted,
    cheapest,
    total: sorted.length,
    isMock: flights[0]?.id.startsWith('mock-'),
  })
}

async function tryDuffel(query: SearchQuery) {
  try {
    return await searchFlights(query)
  } catch (err) {
    console.warn('[search] Duffel unavailable:', err instanceof Error ? err.message : err)
    return []
  }
}

async function tryTravelpayouts(query: SearchQuery) {
  try {
    return await searchCheapFlights(query)
  } catch (err) {
    console.warn('[search] Travelpayouts unavailable:', err instanceof Error ? err.message : err)
    return []
  }
}
