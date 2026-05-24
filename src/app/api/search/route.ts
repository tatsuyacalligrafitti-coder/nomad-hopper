import { NextRequest } from 'next/server'
import { searchCheapFlights } from '@/lib/travelpayouts'
import type { SearchQuery } from '@/types'

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
    const flights = await searchCheapFlights(query)
    return Response.json({ flights, total: flights.length })
  } catch (err) {
    console.error('[search]', err)
    return Response.json({ error: '検索に失敗しました' }, { status: 500 })
  }
}
