import { NextRequest } from 'next/server'
import {
  parseSearchQuery,
  resolveAirport,
  parseDate,
  parsePassengers,
  parseCabinClass,
} from '@/lib/parser'
import { resolveFromDB } from '@/lib/airport-db'
import { IATA_JP_NAMES } from '@/lib/iata-names'
import type { MultiCityParsedQuery, MultiCitySegmentQuery } from '@/types'

// Inverse lookup: Japanese city name → IATA code, sorted by name length desc
// so longer names (e.g. "東京 羽田") are matched before shorter prefixes ("東京").
const JP_TO_IATA: Array<[string, string]> = Object.entries(IATA_JP_NAMES)
  .map(([iata, jp]) => [jp, iata] as [string, string])
  .sort((a, b) => b[0].length - a[0].length)

// Country name → main gateway airport (for inputs like "ケニア", "フィリピン")
const JP_COUNTRY_IATA: Record<string, string> = {
  'ケニア': 'NBO', 'フィリピン': 'MNL', 'タイ': 'BKK', 'インドネシア': 'CGK',
  'マレーシア': 'KUL', 'ベトナム': 'SGN', 'カンボジア': 'PNH', 'ミャンマー': 'RGN',
  'インド': 'DEL', 'スリランカ': 'CMB', 'ネパール': 'KTM', 'モルディブ': 'MLE',
  'エジプト': 'CAI', 'モロッコ': 'CMN', 'エチオピア': 'ADD',
  '南アフリカ': 'JNB', 'タンザニア': 'DAR', 'ガーナ': 'ACC', 'ナイジェリア': 'LOS',
  '中国': 'PEK', '韓国': 'ICN', '台湾': 'TPE',
  'トルコ': 'IST', 'ギリシャ': 'ATH', 'ポルトガル': 'LIS',
  'オーストラリア': 'SYD', 'ニュージーランド': 'AKL',
  'カナダ': 'YVR', 'メキシコ': 'MEX', 'ブラジル': 'GRU', 'アルゼンチン': 'EZE',
  'ペルー': 'LIM', 'コロンビア': 'BOG',
}

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

  // 1. Full airport DB (English city/airport names, bare IATA codes)
  const fromDB = resolveFromDB(trimmed)
  if (fromDB) return fromDB

  // 1.5. Country name shorthand (e.g. "ケニア" → NBO, "フィリピン" → MNL)
  const fromCountry = JP_COUNTRY_IATA[trimmed]
  if (fromCountry) return fromCountry

  // 2. Japanese name — exact match (resolves "ミラノ" → MXP, "ナイロビ" → NBO, etc.)
  for (const [jp, iata] of JP_TO_IATA) {
    if (trimmed === jp) return iata
  }

  // 3. Japanese name — partial match (fragment contains jp name, or jp name starts with fragment)
  for (const [jp, iata] of JP_TO_IATA) {
    if (trimmed.includes(jp) || jp.startsWith(trimmed)) return iata
  }

  // 4. AIRPORT_MAP lightweight parser (handles common Japanese city names)
  const p = parseSearchQuery(trimmed)
  const code = p.origin ?? p.destination
  if (code) return code

  // 5. Phonetic/fuzzy fallback
  return resolveAirport(trimmed)
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
      // Strip embedded dates/punctuation before resolving city name
      const cleanPart = part
        .replace(/\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}/g, '')
        .replace(/[,、\s]+/g, ' ')
        .trim()
      const code = resolveCity(cleanPart) ?? resolveCity(part.trim())
      if (code && (cities.length === 0 || cities[cities.length - 1] !== code)) {
        cities.push(code)
      }
    }
    if (cities.length >= 3) {
      const numSegs = cities.length - 1
      // Use explicitly listed dates when count matches number of segments
      const allDates = [...query.matchAll(/(\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})/g)]
        .map(m => parseDate(m[0]))
        .filter((d): d is string => d !== null)
      const baseDate = allDates[0] ?? extractBaseDate(query)
      const segDates: string[] = allDates.length >= numSegs
        ? allDates.slice(0, numSegs)
        : cities.slice(0, -1).map((_, i) => addDays(baseDate, i * 3))
      const segments: MultiCitySegmentQuery[] = cities.slice(0, -1).map((city, i) => ({
        origin: city,
        destination: cities[i + 1],
        date: segDates[i],
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

  // ── Pattern 4: comma-separated stops + 帰国 ─────────────────────────────────
  // Handles queries the previous patterns miss, e.g.:
  //   "AからB経由でC、Dを回って帰国" → A→B→C→D→A
  //   "AからB、C、Dを経由して帰国"   → A→B→C→D→A

  function buildKaeriSegments(origin: string, stops: string[], baseDate: string, totalDays: number | null): MultiCitySegmentQuery[] {
    const cities = [origin, ...stops]
    const segs: MultiCitySegmentQuery[] = cities.slice(0, -1).map((city, i) => ({
      origin: city,
      destination: cities[i + 1],
      date: addDays(baseDate, i * 3),
    }))
    segs.push({
      origin: cities[cities.length - 1],
      destination: origin,
      date: totalDays
        ? addDays(baseDate, totalDays)
        : addDays(baseDate, cities.length * 3),
    })
    return segs
  }

  function cleanFragment(s: string): string {
    return s.replace(/(?:を回って|を回り|して|へ)\s*$/, '').trim()
  }

  // Case A: "AからB経由でC、D...を回って帰国"
  const mViaComma = query.match(/(.+?)から(.+?)経由で(.+?)帰国/)
  if (mViaComma) {
    const origin = resolveCity(mViaComma[1])
    const afterDe = cleanFragment(mViaComma[3])
    const rawStops = `${mViaComma[2].trim()},${afterDe}`
    const stops = rawStops.split(/[、，,]/).map(s => cleanFragment(s)).filter(Boolean)
      .map(v => resolveCity(v)).filter((c): c is string => !!c)
    if (origin && stops.length >= 2) {
      const baseDate = extractBaseDate(query)
      const daysMatch = query.match(/(\d+)日間/)
      const totalDays = daysMatch ? parseInt(daysMatch[1]) : null
      return {
        type: 'multi-city',
        segments: buildKaeriSegments(origin, stops, baseDate, totalDays),
        passengers,
        cabinClass,
      }
    }
  }

  // Case B: "AからB、C、D...を経由して帰国" / "...を回って帰国"
  const mCommaKaeri = query.match(/(.+?)から(.+?)(?:を経由して|を回って)帰国/)
  if (mCommaKaeri) {
    const origin = resolveCity(mCommaKaeri[1])
    const stops = mCommaKaeri[2].split(/[、，,]/).map(s => s.trim()).filter(Boolean)
      .map(v => resolveCity(v)).filter((c): c is string => !!c)
    if (origin && stops.length >= 1) {
      const baseDate = extractBaseDate(query)
      const daysMatch = query.match(/(\d+)日間/)
      const totalDays = daysMatch ? parseInt(daysMatch[1]) : null
      return {
        type: 'multi-city',
        segments: buildKaeriSegments(origin, stops, baseDate, totalDays),
        passengers,
        cabinClass,
      }
    }
  }

  // ── Pattern 5: Date+city enumeration ─────────────────────────────────────
  // Handles queries where each stop is expressed as "[date] + [city]":
  //   "東京から7月3日にバンコク、7月8日にプラハ、7月14日に東京へ戻る"
  //   "7月3日東京発バンコク経由、7月8日プラハへ、7月14日帰国"
  {
    const DATE_RX = /\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}/

    // Identify departure origin: from "Xから" or "[date]X発"
    let dcOrigin: string | null = null
    const fromM = query.match(/^(.{1,15}?)から/)
    if (fromM) dcOrigin = resolveCity(fromM[1].trim())
    if (!dcOrigin) {
      const hatsuM = query.match(/(?:\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2})?(.{1,10}?)発/)
      if (hatsuM?.[1]) dcOrigin = resolveCity(hatsuM[1].trim())
    }

    if (dcOrigin) {
      const chunks = query.split(/[、，,。]/).filter(Boolean)
      const pairs: Array<{ date: string; iata: string }> = []

      for (const chunk of chunks) {
        const dateM = chunk.match(DATE_RX)
        if (!dateM) continue
        const date = parseDate(dateM[0])
        if (!date) continue

        // Return-home keywords → return to origin
        if (/帰国|帰り|帰る|戻る/.test(chunk)) {
          pairs.push({ date, iata: dcOrigin })
          continue
        }

        const cityText = chunk
          .replace(DATE_RX, '')         // remove date token
          .replace(/^.+?から/, '')      // strip "Xから" prefix
          .replace(/^.+?発/, '')        // strip "X発" prefix (e.g. "東京発")
          .replace(/経由.*$/, '')       // strip "経由..." suffix (keep city before it)
          .replace(/[にへでは]\s*/g, '') // remove Japanese particles
          .replace(/戻る|帰国|帰り|旅程/, '')
          .trim()

        const iata = cityText ? resolveCity(cityText) : null
        if (iata) pairs.push({ date, iata })
      }

      if (pairs.length >= 2) {
        const segments: MultiCitySegmentQuery[] = []
        let prev = dcOrigin
        for (const { date, iata } of pairs) {
          segments.push({ origin: prev, destination: iata, date })
          prev = iata
        }
        if (segments.length >= 2) {
          return { type: 'multi-city', segments, passengers, cabinClass }
        }
      }
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
