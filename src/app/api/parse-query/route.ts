import { NextRequest } from 'next/server'
import { parseSearchQuery } from '@/lib/parser'

export async function POST(request: NextRequest) {
  const { query } = await request.json()

  if (!query || typeof query !== 'string') {
    return Response.json({ error: 'query is required' }, { status: 400 })
  }

  const parsed = parseSearchQuery(query)
  return Response.json(parsed)
}
