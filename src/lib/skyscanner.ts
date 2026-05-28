import type { FlightResult, FlightSegment, SearchQuery } from '@/types'
import { aviasalesLink } from './travelpayouts'

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY ?? ''
const API_HOST = 'sky-scrapper.p.rapidapi.com'
const BASE = `https://${API_HOST}/api/v1/flights`

const rapidHeaders = {
  'x-rapidapi-key': RAPIDAPI_KEY,
  'x-rapidapi-host': API_HOST,
}

// ─── Pre-populated entity IDs (avoids 2 API calls per segment) ────────────────
// Verified 2026-05-28 via searchAirport endpoint.
const KNOWN_ENTITIES: Record<string, { skyId: string; entityId: string }> = {
  // Japan
  HND: { skyId: 'HND', entityId: '128667143' },
  NRT: { skyId: 'NRT', entityId: '128668889' },
  KIX: { skyId: 'KIX', entityId: '95673965' },
  FUK: { skyId: 'FUK', entityId: '128668093' },
  CTS: { skyId: 'CTS', entityId: '128667989' },
  OKA: { skyId: 'OKA', entityId: '128668095' },
  NGO: { skyId: 'NGO', entityId: '128668096' },
  // SE Asia
  BKK: { skyId: 'BKK', entityId: '95673349' },
  DMK: { skyId: 'DMK', entityId: '95673350' },
  SIN: { skyId: 'SIN', entityId: '95673375' },
  KUL: { skyId: 'KUL', entityId: '95673456' },
  CGK: { skyId: 'CGK', entityId: '95673340' },
  MNL: { skyId: 'MNL', entityId: '95673326' },
  SGN: { skyId: 'SGN', entityId: '95673379' },
  HAN: { skyId: 'HAN', entityId: '128668079' },
  DAD: { skyId: 'DAD', entityId: '95673615' },
  RGN: { skyId: 'RGN', entityId: '99539623' },
  // East Asia
  ICN: { skyId: 'ICN', entityId: '95673659' },
  HKG: { skyId: 'HKG', entityId: '128668132' },
  TPE: { skyId: 'TPE', entityId: '128667054' },
  PEK: { skyId: 'PEK', entityId: '128658443' },
  PVG: { skyId: 'PVG', entityId: '128658444' },
  // South Asia
  DEL: { skyId: 'DEL', entityId: '95673498' },
  BOM: { skyId: 'BOM', entityId: '95673320' },
  KTM: { skyId: 'KTM', entityId: '95673458' },
  CMB: { skyId: 'CMB', entityId: '95673656' },
  MLE: { skyId: 'MLE', entityId: '104120258' },
  // Middle East
  DXB: { skyId: 'DXB', entityId: '95673506' },
  DOH: { skyId: 'DOH', entityId: '95673852' },
  IST: { skyId: 'IST', entityId: '95673323' },
  AUH: { skyId: 'AUH', entityId: '95673355' },
  // Africa
  NBO: { skyId: 'NBO', entityId: '95673395' },
  ADD: { skyId: 'ADD', entityId: '95673360' },
  JNB: { skyId: 'JNB', entityId: '128669040' },
  // Europe
  LHR: { skyId: 'LHR', entityId: '95565050' },
  CDG: { skyId: 'CDG', entityId: '95565041' },
  FRA: { skyId: 'FRA', entityId: '95673652' },
  AMS: { skyId: 'AMS', entityId: '95565044' },
  FCO: { skyId: 'FCO', entityId: '95565047' },
  MXP: { skyId: 'MXP', entityId: '95565048' },
  MAD: { skyId: 'MAD', entityId: '95565056' },
  BCN: { skyId: 'BCN', entityId: '95565040' },
  ZRH: { skyId: 'ZRH', entityId: '95673316' },
  VIE: { skyId: 'VIE', entityId: '95673320' },
  MUC: { skyId: 'MUC', entityId: '95673654' },
  ATH: { skyId: 'ATH', entityId: '95565043' },
  LIS: { skyId: 'LIS', entityId: '95565053' },
  ARN: { skyId: 'ARN', entityId: '95673310' },
  HEL: { skyId: 'HEL', entityId: '95673326' },
  CPH: { skyId: 'CPH', entityId: '95673302' },
  // Oceania
  SYD: { skyId: 'SYD', entityId: '128667058' },
  MEL: { skyId: 'MEL', entityId: '128668080' },
  AKL: { skyId: 'AKL', entityId: '128667046' },
  // Americas
  LAX: { skyId: 'LAX', entityId: '95673368' },
  JFK: { skyId: 'JFK', entityId: '95565058' },
  SFO: { skyId: 'SFO', entityId: '95673374' },
  YVR: { skyId: 'YVR', entityId: '128668382' },
  YYZ: { skyId: 'YYZ', entityId: '128668383' },
  GRU: { skyId: 'GRU', entityId: '128668384' },
  EZE: { skyId: 'EZE', entityId: '128668385' },
  LIM: { skyId: 'LIM', entityId: '128668386' },
}

// ─── Entity ID cache (server-lifetime) ────────────────────────────────────────
const entityCache = new Map<string, { skyId: string; entityId: string }>(
  Object.entries(KNOWN_ENTITIES),
)

async function lookupEntityId(
  iata: string,
): Promise<{ skyId: string; entityId: string } | null> {
  const hit = entityCache.get(iata)
  if (hit) return hit

  const res = await fetch(
    `${BASE}/searchAirport?query=${encodeURIComponent(iata)}&locale=ja-JP`,
    { headers: rapidHeaders, next: { revalidate: 86400 } },
  )
  if (!res.ok) return null

  const json = await res.json() as { data: Array<{
    navigation: {
      entityId: string
      relevantFlightParams: { skyId: string; entityId: string }
    }
  }> }

  const match = (json.data ?? []).find(
    (r) => r.navigation?.relevantFlightParams?.skyId === iata,
  )
  if (!match) return null

  const entry = {
    skyId: match.navigation.relevantFlightParams.skyId,
    entityId: match.navigation.entityId,
  }
  entityCache.set(iata, entry)
  return entry
}

// ─── Response types ────────────────────────────────────────────────────────────
interface SkyLeg {
  origin: { displayCode: string; name: string }
  destination: { displayCode: string; name: string }
  durationInMinutes: number
  stopCount: number
  departure: string
  arrival: string
  carriers: {
    marketing: Array<{ id: number; alternateId: string; name: string; logoUrl: string }>
  }
  segments: Array<{
    flightNumber: string
    marketingCarrier: { alternateId: string; name: string }
  }>
}

interface SkyItinerary {
  id: string
  price: { raw: number; formatted: string }
  legs: SkyLeg[]
}

// ─── Retry-aware fetch for flight searches ─────────────────────────────────────
// The API sometimes returns HTTP 200 with a body-level error (e.g.
// "Something went wrong") when rate-limited. Retry up to maxRetries times
// with increasing delays to handle both HTTP 429 and body errors.
async function fetchFlights(
  url: string,
  maxRetries = 2,
): Promise<{ itineraries: SkyItinerary[]; status: string }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1500 * attempt))
    }

    let res: Response
    try {
      res = await fetch(url, { headers: rapidHeaders, cache: 'no-store' })
    } catch {
      continue
    }

    if (res.status === 429) {
      console.warn(`[skyscanner] 429 on attempt ${attempt + 1}`)
      continue
    }
    if (!res.ok) continue

    const json = await res.json() as {
      message?: string
      data?: { context?: { status?: string }; itineraries?: SkyItinerary[] }
    }

    // Body-level error: HTTP 200 but payload contains an error message instead of data
    if (json.message && !json.data) {
      console.warn(`[skyscanner] body error "${json.message}" on attempt ${attempt + 1}`)
      continue
    }

    return {
      itineraries: json.data?.itineraries ?? [],
      status: json.data?.context?.status ?? 'complete',
    }
  }

  console.error('[skyscanner] all retry attempts exhausted')
  return { itineraries: [], status: 'error' }
}

// ─── Mapping helpers ───────────────────────────────────────────────────────────
function legToSegment(leg: SkyLeg): FlightSegment {
  const carrier = leg.carriers.marketing[0] ?? { alternateId: '', name: '' }
  const firstSeg = leg.segments[0]
  const flightNum = firstSeg
    ? `${firstSeg.marketingCarrier.alternateId}${firstSeg.flightNumber}`
    : ''

  return {
    origin: leg.origin.displayCode,
    originName: leg.origin.name,
    destination: leg.destination.displayCode,
    destinationName: leg.destination.name,
    departingAt: leg.departure,
    arrivingAt: leg.arrival,
    carrierCode: carrier.alternateId,
    carrierName: carrier.name,
    flightNumber: flightNum,
    duration: leg.durationInMinutes,
    stops: leg.stopCount,
  }
}

function itineraryToResult(
  it: SkyItinerary,
  query: SearchQuery,
): FlightResult {
  const outbound = it.legs[0]
  const segments: FlightSegment[] = it.legs.map(legToSegment)

  const stops = outbound
    ? (outbound.stopCount ?? Math.max(0, outbound.segments.length - 1))
    : 0

  return {
    id: `ss-${it.id}`,
    totalPrice: it.price.raw,
    currency: 'JPY',
    totalDuration: outbound?.durationInMinutes ?? 0,
    segments,
    cabinClass: query.cabinClass,
    stops,
    baggageIncluded: false,
    bookingLink: aviasalesLink(
      query.origin,
      query.destination,
      query.departureDate,
      query.passengers,
    ),
  }
}

// ─── Public entry point ────────────────────────────────────────────────────────
export async function searchSkyscanner(query: SearchQuery): Promise<FlightResult[]> {
  if (!RAPIDAPI_KEY) {
    console.error('[skyscanner] RAPIDAPI_KEY not set')
    return []
  }

  // Entity IDs: served from cache for pre-populated airports → zero extra API calls
  const [originInfo, destInfo] = await Promise.all([
    lookupEntityId(query.origin),
    lookupEntityId(query.destination),
  ])

  if (!originInfo || !destInfo) {
    console.error('[skyscanner] entity ID lookup failed', { originInfo, destInfo })
    return []
  }

  const cabinMap: Record<string, string> = {
    economy: 'economy',
    premium_economy: 'premium_economy',
    business: 'business',
    first: 'first',
  }

  const params = new URLSearchParams({
    originSkyId: originInfo.skyId,
    destinationSkyId: destInfo.skyId,
    originEntityId: originInfo.entityId,
    destinationEntityId: destInfo.entityId,
    date: query.departureDate,
    cabinClass: cabinMap[query.cabinClass] ?? 'economy',
    adults: String(query.passengers),
    currency: 'JPY',
    locale: 'ja-JP',
  })

  if (query.returnDate) params.set('returnDate', query.returnDate)

  const url = `${BASE}/searchFlights?${params}`

  // First search (with built-in retry for body-level errors)
  const first = await fetchFlights(url)
  let itineraries = first.itineraries

  // Skyscanner often returns "incomplete" on first call; poll once for fuller results
  if (first.status === 'incomplete') {
    await new Promise((r) => setTimeout(r, 1500))
    const second = await fetchFlights(url)
    if (second.itineraries.length > itineraries.length) {
      itineraries = second.itineraries
    }
  }

  const results = itineraries.map((it) => itineraryToResult(it, query))

  // Deduplicate by flight number (or carrier + departure time as fallback)
  const seen = new Set<string>()
  return results.filter((r) => {
    const seg = r.segments[0]
    if (!seg) return true
    const key = seg.flightNumber
      ? `${seg.carrierCode}-${seg.flightNumber}`
      : `${seg.carrierCode}-${seg.departingAt}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
