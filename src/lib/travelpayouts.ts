import type { FlightResult, FlightSegment, SearchQuery } from '@/types'

const TOKEN = process.env.TRAVELPAYOUTS_TOKEN ?? '42275e1b582df74e978c3cd0c9c92308'

/** Aviasales affiliate link  marker=731864 */
export function aviasalesLink(
  origin: string,
  destination: string,
  departureDate: string,
  passengers = 1,
  returnDate?: string,
): string {
  const [, mm, dd] = departureDate.split('-')
  let path = `${origin}${dd}${mm}${destination}`
  if (returnDate) {
    const [, rmm, rdd] = returnDate.split('-')
    path += `${rdd}${rmm}`
  }
  path += `${passengers}`
  return `https://www.aviasales.com/search/${path}?marker=731864`
}

// ─── v1/prices/cheap ──────────────────────────────────────────────────────────
// Response structure: { data: { "OKA": { "0": { airline, price, duration_to, ... } } } }
// Inner key = transfer count (0, 1, 2…)
interface V1Entry {
  airline: string
  price: number
  flight_number: number
  departure_at: string
  duration?: number
  duration_to?: number
}

async function fetchV1(query: SearchQuery): Promise<FlightResult[]> {
  const params = new URLSearchParams({
    origin: query.origin,
    destination: query.destination,
    currency: 'jpy',
    token: TOKEN,
    depart_date: query.departureDate.slice(0, 7),
  })
  if (query.returnDate) params.set('return_date', query.returnDate.slice(0, 7))

  const res = await fetch(
    `https://api.travelpayouts.com/v1/prices/cheap?${params}`,
    { next: { revalidate: 3600 } },
  )
  if (!res.ok) return []

  const json = await res.json() as {
    success: boolean
    data: Record<string, Record<string, V1Entry>>
  }
  if (!json.success || !json.data) return []

  const results: FlightResult[] = []
  for (const [destCode, bucket] of Object.entries(json.data)) {
    for (const [transferKey, entry] of Object.entries(bucket)) {
      const stops = parseInt(transferKey, 10) // bucket key IS the transfer count
      const durationMin = entry.duration_to ?? entry.duration ?? 0
      const departAt = entry.departure_at
      const arriveAt = durationMin > 0
        ? new Date(new Date(departAt).getTime() + durationMin * 60_000).toISOString()
        : departAt

      const seg: FlightSegment = {
        origin: query.origin,
        originName: query.origin,
        destination: destCode,
        destinationName: destCode,
        departingAt: departAt,
        arrivingAt: arriveAt,
        carrierCode: entry.airline,
        carrierName: entry.airline,
        flightNumber: `${entry.airline}${entry.flight_number}`,
        duration: durationMin,
        stops,
      }

      results.push({
        id: `tp-v1-${entry.airline}${entry.flight_number}-${departAt}`,
        totalPrice: entry.price,
        currency: 'JPY',
        totalDuration: durationMin,
        segments: [seg],
        cabinClass: 'economy',
        stops,
        baggageIncluded: false,
        bookingLink: aviasalesLink(query.origin, destCode, query.departureDate, query.passengers, query.returnDate),
      })
    }
  }
  return results
}

// ─── v2/prices/latest ─────────────────────────────────────────────────────────
// Response structure: { data: [ { value, number_of_changes, depart_date, gate, duration, … } ] }
// "gate" = OTA name (Trip.com, Kiwi.com…), no airline code
interface V2Entry {
  origin: string
  destination: string
  value: number
  number_of_changes: number
  depart_date: string
  gate: string
  duration?: number
}

async function fetchV2(query: SearchQuery): Promise<FlightResult[]> {
  const params = new URLSearchParams({
    origin: query.origin,
    destination: query.destination,
    currency: 'jpy',
    token: TOKEN,
    limit: '50',
    sorting: 'price',
  })

  const res = await fetch(
    `https://api.travelpayouts.com/v2/prices/latest?${params}`,
    { next: { revalidate: 3600 } },
  )
  if (!res.ok) return []

  const json = await res.json() as {
    success: boolean
    data: V2Entry[]
  }
  if (!json.success || !Array.isArray(json.data)) return []

  return json.data.map((entry) => {
    const stops = entry.number_of_changes ?? 0
    const durationMin = entry.duration ?? 0
    const departAt = `${entry.depart_date}T00:00:00+09:00`

    const seg: FlightSegment = {
      origin: entry.origin,
      originName: entry.origin,
      destination: entry.destination,
      destinationName: entry.destination,
      departingAt: departAt,
      arrivingAt: departAt,
      carrierCode: '',
      carrierName: entry.gate,  // OTA name e.g. "Trip.com"
      flightNumber: '',
      duration: durationMin,
      stops,
    }

    return {
      id: `tp-v2-${entry.gate}-${entry.depart_date}-${entry.value}`,
      totalPrice: entry.value,
      currency: 'JPY',
      totalDuration: durationMin,
      segments: [seg],
      cabinClass: 'economy',
      stops,
      baggageIncluded: false,
      // Use the query's airport code for the affiliate link (v2 uses city code "TYO")
      bookingLink: aviasalesLink(query.origin, query.destination, entry.depart_date, query.passengers, query.returnDate),
    }
  })
}

// ─── Public entry point ────────────────────────────────────────────────────────
export async function searchCheapFlights(query: SearchQuery): Promise<FlightResult[]> {
  const [v1, v2] = await Promise.all([fetchV1(query), fetchV2(query)])

  // Merge: v1 has airline details, v2 has more date variety — deduplicate by price+stops
  const seen = new Set<string>()
  const merged: FlightResult[] = []

  for (const f of [...v1, ...v2]) {
    const key = `${f.totalPrice}-${f.stops}`
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(f)
    }
  }

  return merged.sort((a, b) => a.totalPrice - b.totalPrice)
}
