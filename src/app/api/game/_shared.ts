// Shared request handling for the 遊び endpoints.
//
// Both beats of the conversation (the plain fare, then the stopover search) take
// the same three inputs and must resolve them to the same airports and the same
// Japanese labels — otherwise the second answer could quietly be about a
// different route than the first.

import { getAirportByIata } from '@/lib/airport-db'
import { hubByIata } from '@/lib/detour-hubs'
import { resolveCity } from '@/lib/resolve-place'
import { cityNameJaOf } from '@/lib/city-codes'
import { IATA_JP_NAMES } from '@/lib/iata-names'
import type { DetourPlace } from '@/types'

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

interface RequestBody {
  origin?: string
  destination?: string
  month?: string
}

/**
 * Japanese labels for a resolved airport.
 *
 * The city name is the area the /asobi price actually covers, not the airport we
 * resolved to: fares here are fetched per city code, so a HND result is really
 * "cheapest out of Tokyo" and must not be labelled 東京 羽田.
 */
export function describe(iata: string): DetourPlace {
  const cityWide = cityNameJaOf(iata)
  const hub = hubByIata(iata)
  const ap = getAirportByIata(iata)
  return {
    iata,
    city: cityWide ?? hub?.city ?? IATA_JP_NAMES[iata] ?? ap?.city ?? iata,
    country: hub?.country ?? ap?.country ?? '',
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

  // Same resolver as the top-page search, so the same words give the same airport.
  const from = resolveCity(origin)
  if (!from) return { ok: false, error: `出発地「${origin}」の空港が見つかりませんでした` }

  const to = resolveCity(destination)
  if (!to) return { ok: false, error: `行き先「${destination}」の空港が見つかりませんでした` }

  if (from === to) return { ok: false, error: '出発地と行き先が同じです' }

  return { ok: true, from, to, month }
}
