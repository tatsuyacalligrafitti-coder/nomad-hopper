import { NextRequest } from 'next/server'
import { findDirectFare } from '@/lib/direct-fare'
import { describe, parseGameRequest } from '../_shared'
import type { DirectResponse } from '@/types'

// 拍2: the plain answer. Deliberately does not look for a stopover — that only
// happens after the user says yes at /api/game/detour.
export async function POST(request: NextRequest) {
  const parsed = await parseGameRequest(request)
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 })

  const { from, to, month } = parsed
  try {
    const outcome = await findDirectFare(from, to, month)
    const response: DirectResponse = {
      origin: describe(from),
      destination: describe(to),
      outcome,
    }
    return Response.json(response)
  } catch (err) {
    console.error('[game/direct]', err)
    return Response.json({ error: '価格の取得に失敗しました' }, { status: 500 })
  }
}
