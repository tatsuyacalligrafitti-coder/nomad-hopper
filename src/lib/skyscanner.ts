import type { FlightResult, FlightSegment, SearchQuery } from '@/types'
import { aviasalesLink } from './travelpayouts'

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY ?? ''
const API_HOST = 'sky-scrapper.p.rapidapi.com'
const BASE = `https://${API_HOST}/api/v1/flights`

const rapidHeaders = {
  'x-rapidapi-key': RAPIDAPI_KEY,
  'x-rapidapi-host': API_HOST,
}

// ─── Entity ID cache (server-lifetime) ────────────────────────────────────────
const entityCache = new Map<string, { skyId: string; entityId: string }>()

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

  // Prefer API-provided stopCount; fall back to segment count - 1 (more reliable)
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

  // Resolve entity IDs in parallel
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

  const res = await fetch(`${BASE}/searchFlights?${params}`, {
    headers: rapidHeaders,
    next: { revalidate: 600 },
  })

  if (res.status === 429) {
    console.error('[skyscanner] rate limit exceeded')
    return []
  }
  if (!res.ok) {
    console.error('[skyscanner] search failed', res.status)
    return []
  }

  const json = await res.json() as { data?: { itineraries?: SkyItinerary[] } }
  const itineraries = json.data?.itineraries ?? []

  const results = itineraries.map((it) => itineraryToResult(it, query))

  // Deduplicate: same carrier + flight number (or departure time) = same flight
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
