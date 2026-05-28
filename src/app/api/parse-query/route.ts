import { NextRequest } from 'next/server'
import {
  parseSearchQuery,
  resolveAirport,
  parseDate,
  parsePassengers,
  parseCabinClass,
} from '@/lib/parser'
import { resolveFromDB } from '@/lib/airport-db'
import type { MultiCityParsedQuery, MultiCitySegmentQuery } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function todayPlus(days: number): string {
  return addDays(new Date().toISOString().split('T')[0], days)
}

/** Resolve a free-text city fragment to an IATA code. */
function resolveCity(fragment: string): string | null {
  const trimmed = fragment.trim()
  if (!trimmed) return null
  // Try lightweight parser first (handles Japanese AIRPORT_MAP)
  const p = parseSearchQuery(trimmed)
  const code = p.origin ?? p.destination
  if (code) return code
  // Fall back to full DB (English city names, country names)
  return resolveFromDB(trimmed) ?? resolveAirport(trimmed)
}

/** Extract a usable base date from the full query string. */
function extractBaseDate(query: string): string {
  // Full date (parseDate handles 12月25日, 12/25, ISO, relative)
  const d = parseDate(query)
  if (d) return d
  // Month-only: "7月" → first of that month
  const monthOnly = query.match(/(\d{1,2})月(?!\d)/)
  if (monthOnly) {
    const m = parseInt(monthOnly[1])
    const today = new Date()
    const year = today.getMonth() + 1 > m ? today.getFullYear() + 1 : today.getFullYear()
    return `${year}-${String(m).padStart(2, '0')}-01`
  }
  // Default: 30 days from today
  return todayPlus(30)
}

// ── Multi-city detection ──────────────────────────────────────────────────────

function tryParseMultiCity(query: string): MultiCityParsedQuery | null {
  const passengers = parsePassengers(query)
  const cabinClass = parseCabinClass(query)

  // ── Pattern 1: A→B→C (2+ arrows) ────────────────────────────────────────
  const arrowParts = query.split('→')
  if (arrowParts.length >= 3) {
    const cities: string[] = []
    for (const part of arrowParts) {
      const code = resolveCity(part)
      if (code && (cities.length === 0 || cities[cities.length - 1] !== code)) {
        cities.push(code)
      }
    }
    if (cities.length >= 3) {
      const baseDate = extractBaseDate(query)
      const segments: MultiCitySegmentQuery[] = cities.slice(0, -1).map((city, i) => ({
        origin: city,
        destination: cities[i + 1],
        date: addDays(baseDate, i * 3),
      }))
      return { type: 'multi-city', segments, passengers, cabinClass }
    }
  }

  // ── Pattern 2: 経由 (via) ────────────────────────────────────────────────
  // "東京からバンコク経由でナイロビへ"
  const viaMatch = query.match(/(.+?)から(.+?)経由.{0,4}で(.+?)へ/)
  if (viaMatch) {
    const origin = resolveCity(viaMatch[1])
    const via    = resolveCity(viaMatch[2])
    const dest   = resolveCity(viaMatch[3])
    if (origin && via && dest) {
      const baseDate  = extractBaseDate(query)
      const daysMatch = query.match(/(\d+)日間/)
      const totalDays = daysMatch ? parseInt(daysMatch[1]) : null
      const segments: MultiCitySegmentQuery[] = [
        { origin, destination: via, date: baseDate },
        { origin: via, destination: dest, date: addDays(baseDate, 3) },
        ...(totalDays
          ? [{ origin: dest, destination: origin, date: addDays(baseDate, totalDays) }]
          : []),
      ]
      return { type: 'multi-city', segments, passengers, cabinClass }
    }
  }

  // ── Pattern 3: Multiple "X泊" stay durations ─────────────────────────────
  // "バンコク3泊、ナイロビ5泊して帰国"
  const nightMatches = [...query.matchAll(/([^\s、，,。→]+?)(\d+)泊/g)]
  if (nightMatches.length >= 2) {
    const originMatch =
      query.match(/([^\s、。→]+?)発(?:で|で)?/) ??
      query.match(/([^\s、。→]+?)から/)
    const origin = originMatch ? resolveCity(originMatch[1]) : null

    const stops: Array<{ city: string; nights: number }> = []
    for (const m of nightMatches) {
      const city = resolveCity(m[1])
      if (city) stops.push({ city, nights: parseInt(m[2]) })
    }

    if (origin && stops.length >= 2) {
      const baseDate = extractBaseDate(query)
      const segments: MultiCitySegmentQuery[] = []
      let prev = origin
      let currentDate = baseDate
      for (const stop of stops) {
        segments.push({ origin: prev, destination: stop.city, date: currentDate })
        prev = stop.city
        currentDate = addDays(currentDate, stop.nights)
      }
      if (query.includes('帰国') || query.includes('帰り')) {
        segments.push({ origin: prev, destination: origin, date: currentDate })
      }
      return { type: 'multi-city', segments, passengers, cabinClass }
    }
  }

  return null
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { query } = await request.json()

  if (!query || typeof query !== 'string') {
    return Response.json({ error: 'query is required' }, { status: 400 })
  }

  // Multi-city takes priority
  const multiCity = tryParseMultiCity(query)
  if (multiCity) return Response.json(multiCity)

  // Single-city path
  const parsed = parseSearchQuery(query)

  if (!parsed.origin || !parsed.destination) {
    const SEPARATORS = ['から', '→', '->', '⇒', '〜', '~', '発', ' to ']
    let originFrag = query
    let destFrag = query
    for (const sep of SEPARATORS) {
      const idx = query.indexOf(sep)
      if (idx > 0) {
        originFrag = query.slice(0, idx).trim()
        destFrag   = query.slice(idx + sep.length).trim()
        break
      }
    }
    if (!parsed.origin)      parsed.origin      = resolveFromDB(originFrag) ?? resolveFromDB(query)
    if (!parsed.destination) parsed.destination = resolveFromDB(destFrag)   ?? resolveFromDB(query)
  }

  return Response.json(parsed)
}
