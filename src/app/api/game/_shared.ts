// Shared request handling for the 遊び endpoints.
//
// Both beats of the conversation (the plain fare, then the stopover search) take
// the same three inputs and must resolve them to the same airports and the same
// Japanese labels — otherwise the second answer could quietly be about a
// different route than the first.

import { getAirportByIata, resolveFromDB } from '@/lib/airport-db'
import { hubByIata } from '@/lib/detour-hubs'
import { japaneseNameOf, resolveJapanesePlace } from '@/lib/place-names-ja'
import type { DetourPlace } from '@/types'

const IATA = /^[A-Za-z]{3}$/
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

interface RequestBody {
  origin?: string
  destination?: string
  month?: string
}

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
export function describe(iata: string): DetourPlace {
  const hub = hubByIata(iata)
  if (hub) return hub
  const ap = getAirportByIata(iata)
  return {
    iata,
    city: japaneseNameOf(iata) ?? ap?.city ?? iata,
    country: ap?.country ?? '',
  }
}

export type ParsedRequest =
  | { ok: true; from: string; to: string; month: string }
  | { ok: false; error: string }

export async function parseGameRequest(request: Request): Promise<ParsedRequest> {
  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return { ok: false, error: 'リクエストを読み取れませんでした' }
  }

  const { origin = '', destination = '', month = '' } = body

  if (!origin.trim() || !destination.trim()) {
    return { ok: false, error: '出発地と行き先を入力してください' }
  }
  if (!MONTH.test(month)) {
    return { ok: false, error: '時期は YYYY-MM の形で指定してください' }
  }

  const from = toIata(origin)
  if (!from) return { ok: false, error: `出発地「${origin}」の空港が見つかりませんでした` }

  const to = toIata(destination)
  if (!to) return { ok: false, error: `行き先「${destination}」の空港が見つかりませんでした` }

  if (from === to) return { ok: false, error: '出発地と行き先が同じです' }

  return { ok: true, from, to, month }
}
