import { NextRequest } from 'next/server'
import { findDetour } from '@/lib/detour-search'
import { getAirportByIata, resolveFromDB } from '@/lib/airport-db'
import { hubByIata } from '@/lib/detour-hubs'
import { japaneseNameOf, resolveJapanesePlace } from '@/lib/place-names-ja'
import type { DetourPlace, DetourResponse } from '@/types'

interface RequestBody {
  origin?: string
  destination?: string
  month?: string
}

const IATA = /^[A-Za-z]{3}$/
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

/** Free text ("バンコク", "bangkok") or an IATA code → IATA code. */
function toIata(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (IATA.test(trimmed)) {
    const upper = trimmed.toUpperCase()
    if (getAirportByIata(upper)) return upper
  }
  return resolveJapanesePlace(trimmed) ?? resolveFromDB(trimmed)
}

/** Japanese city/country labels, preferring curated names over the raw (English) DB. */
function describe(iata: string): DetourPlace {
  const hub = hubByIata(iata)
  if (hub) return hub
  const ap = getAirportByIata(iata)
  return {
    iata,
    city: japaneseNameOf(iata) ?? ap?.city ?? iata,
    country: ap?.country ?? '',
  }
}

export async function POST(request: NextRequest) {
  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'リクエストを読み取れませんでした' }, { status: 400 })
  }

  const { origin = '', destination = '', month = '' } = body

  if (!origin.trim() || !destination.trim()) {
    return Response.json({ error: '出発地と行き先を入力してください' }, { status: 400 })
  }
  if (!MONTH.test(month)) {
    return Response.json({ error: '時期は YYYY-MM の形で指定してください' }, { status: 400 })
  }

  const from = toIata(origin)
  if (!from) {
    return Response.json({ error: `出発地「${origin}」の空港が見つかりませんでした` }, { status: 400 })
  }
  const to = toIata(destination)
  if (!to) {
    return Response.json({ error: `行き先「${destination}」の空港が見つかりませんでした` }, { status: 400 })
  }
  if (from === to) {
    return Response.json({ error: '出発地と行き先が同じです' }, { status: 400 })
  }

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
