import type { SearchQuery, FlightResult, FlightSegment } from '@/types'
import { aviasalesLink } from '@/lib/travelpayouts'
import type { FlightProvider } from './base'
import type { NormalizedFlight } from './types'

// ─── ISO 8601 duration → minutes ──────────────────────────────────────────────
// Handles: PT10H30M, PT1H, PT45M, P1DT2H30M, etc.
function parseDuration(iso: string): number {
  const m = iso.match(/P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?/)
  if (!m) return 0
  return (parseInt(m[1] ?? '0', 10) * 1440)
       + (parseInt(m[2] ?? '0', 10) * 60)
       + parseInt(m[3] ?? '0', 10)
}

// ─── Duffel response types ─────────────────────────────────────────────────────
interface DuffelPlace { iata_code: string; name: string }

interface DuffelSegment {
  origin: DuffelPlace
  destination: DuffelPlace
  departing_at: string
  arriving_at: string
  marketing_carrier: { iata_code: string; name: string }
  marketing_carrier_flight_number: string
  duration: string
}

interface DuffelSlice {
  duration: string
  segments: DuffelSegment[]
}

interface DuffelOffer {
  id: string
  total_amount: string
  total_currency: string
  slices: DuffelSlice[]
}

// ─── Mapping ───────────────────────────────────────────────────────────────────
function sliceToSegment(slice: DuffelSlice): FlightSegment {
  const first = slice.segments[0]
  const last = slice.segments[slice.segments.length - 1]
  const carrier = first.marketing_carrier

  return {
    origin: first.origin.iata_code,
    originName: first.origin.name,
    destination: last.destination.iata_code,
    destinationName: last.destination.name,
    departingAt: first.departing_at,
    arrivingAt: last.arriving_at,
    carrierCode: carrier.iata_code,
    carrierName: carrier.name,
    flightNumber: `${carrier.iata_code}${first.marketing_carrier_flight_number}`,
    duration: parseDuration(slice.duration),
    stops: Math.max(0, slice.segments.length - 1),
  }
}

function offerToFlightResult(offer: DuffelOffer, query: SearchQuery): FlightResult {
  const outbound = offer.slices[0]
  const segments: FlightSegment[] = offer.slices.map(sliceToSegment)
  const totalDuration = outbound ? parseDuration(outbound.duration) : 0
  const stops = outbound ? Math.max(0, outbound.segments.length - 1) : 0

  return {
    id: `duffel-${offer.id}`,
    totalPrice: parseFloat(offer.total_amount),
    currency: offer.total_currency,
    totalDuration,
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

// ─── Provider ─────────────────────────────────────────────────────────────────
export class DuffelProvider implements FlightProvider {
  readonly name = 'duffel'

  async search(query: SearchQuery): Promise<NormalizedFlight[]> {
    const apiKey = process.env.DUFFEL_API_KEY
    if (!apiKey) {
      console.warn('[duffel] DUFFEL_API_KEY not set — skipping')
      return []
    }

    const passengers = Array.from(
      { length: query.passengers },
      () => ({ type: 'adult' as const }),
    )

    const res = await fetch(
      'https://api.duffel.com/air/offer_requests?return_offers=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Duffel-Version': 'v2',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          data: {
            slices: [
              {
                origin: query.origin,
                destination: query.destination,
                departure_date: query.departureDate,
              },
            ],
            passengers,
            cabin_class: query.cabinClass,
          },
        }),
      },
    )

    if (!res.ok) {
      console.error(`[duffel] request failed (${res.status}):`, await res.text())
      return []
    }

    const json = await res.json() as { data: { offers?: DuffelOffer[] } }
    const offers = json.data?.offers ?? []

    return offers.map((offer) => {
      const result = offerToFlightResult(offer, query)
      const firstSeg = offer.slices[0]?.segments[0]

      return {
        origin: query.origin,
        destination: query.destination,
        departureDate: firstSeg?.departing_at?.split('T')[0] ?? query.departureDate,
        airline: firstSeg?.marketing_carrier.iata_code ?? '',
        flightNumber: firstSeg
          ? `${firstSeg.marketing_carrier.iata_code}${firstSeg.marketing_carrier_flight_number}`
          : '',
        price: result.totalPrice,
        currency: result.currency,
        durationMinutes: result.totalDuration,
        stops: result.stops,
        sources: [this.name],
        raw: result,
      }
    })
  }
}
