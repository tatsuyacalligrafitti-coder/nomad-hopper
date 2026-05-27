import { NextRequest } from 'next/server'
import { parseSearchQuery } from '@/lib/parser'
import { resolveFromDB } from '@/lib/airport-db'

export async function POST(request: NextRequest) {
  const { query } = await request.json()

  if (!query || typeof query !== 'string') {
    return Response.json({ error: 'query is required' }, { status: 400 })
  }

  const parsed = parseSearchQuery(query)

  // Fill in any airport the lightweight parser couldn't resolve using the full DB.
  // We split the raw query on the same separators and try each fragment.
  if (!parsed.origin || !parsed.destination) {
    const SEPARATORS = ['から', '→', '->', '⇒', '〜', '~', '発', ' to ']
    let originFrag = query
    let destFrag = query

    for (const sep of SEPARATORS) {
      const idx = query.indexOf(sep)
      if (idx > 0) {
        originFrag = query.slice(0, idx).trim()
        destFrag = query.slice(idx + sep.length).trim()
        break
      }
    }

    if (!parsed.origin) {
      parsed.origin = resolveFromDB(originFrag) ?? resolveFromDB(query)
    }
    if (!parsed.destination) {
      parsed.destination = resolveFromDB(destFrag) ?? resolveFromDB(query)
    }
  }

  return Response.json(parsed)
}
