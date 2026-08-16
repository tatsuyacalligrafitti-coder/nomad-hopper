import { NextRequest } from 'next/server'
import { findDetour } from '@/lib/detour-search'
import { describe, parseGameRequest } from '../_shared'
import type { DetourResponse } from '@/types'

// 拍4: the stopover search. Reached only when the user answers yes to Radi's
// question, never as part of the first answer.
export async function POST(request: NextRequest) {
  const parsed = await parseGameRequest(request)
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 })

  const { from, to, month } = parsed
  try {
    const outcome = await findDetour(from, to, month)
    const response: DetourResponse = {
      origin: describe(from),
      destination: describe(to),
      outcome,
    }
    return Response.json(response)
  } catch (err) {
    console.error('[game/detour]', err)
    return Response.json({ error: '価格の取得に失敗しました' }, { status: 500 })
  }
}
