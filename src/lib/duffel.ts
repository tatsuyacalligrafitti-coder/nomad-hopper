import { Duffel } from '@duffel/api'
import type { SearchQuery, FlightResult, FlightSegment } from '@/types'

const duffel = new Duffel({
  token: process.env.DUFFEL_API_KEY!,
})

function durationToMinutes(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match) return 0
  return (parseInt(match[1] || '0') * 60) + parseInt(match[2] || '0')
}

function mapCabinClass(
  cls: string
): 'economy' | 'premium_economy' | 'business' | 'first' {
  const map: Record<string, 'economy' | 'premium_economy' | 'business' | 'first'> = {
    economy: 'economy',
    premium_economy: 'premium_economy',
    business: 'business',
    first: 'first',
  }
  return map[cls] ?? 'economy'
}

export async function searchFlights(query: SearchQuery): Promise<FlightResult[]> {
  const offerRequest = await duffel.offerRequests.create({
    slices: [
      {
        origin: query.origin,
        destination: query.destination,
        departure_date: query.departureDate,
        arrival_time: null,
        departure_time: null,
      },
      ...(query.returnDate
        ? [
            {
              origin: query.destination,
              destination: query.origin,
              departure_date: query.returnDate,
              arrival_time: null,
              departure_time: null,
            },
          ]
        : []),
    ],
    passengers: Array.from({ length: query.passengers }, () => ({
      type: 'adult' as const,
    })),
    cabin_class: query.cabinClass,
    return_offers: true,
  })

  const offers = offerRequest.data.offers ?? []

  return offers.slice(0, 30).map((offer): FlightResult => {
    const allSegments: FlightSegment[] = offer.slices.flatMap((slice) =>
      slice.segments.map((seg) => ({
        origin: seg.origin.iata_code ?? seg.origin.id,
        originName: seg.origin.name,
        destination: seg.destination.iata_code ?? seg.destination.id,
        destinationName: seg.destination.name,
        departingAt: seg.departing_at,
        arrivingAt: seg.arriving_at,
        carrierCode: seg.operating_carrier.iata_code ?? seg.marketing_carrier.iata_code ?? '',
        carrierName: seg.operating_carrier.name ?? seg.marketing_carrier.name,
        flightNumber: `${seg.marketing_carrier.iata_code ?? ''}${seg.marketing_carrier_flight_number}`,
        duration: durationToMinutes(seg.duration ?? 'PT0M'),
        stops: 0,
      }))
    )

    const totalDuration = offer.slices.reduce(
      (sum, sl) => sum + durationToMinutes(sl.duration ?? 'PT0M'),
      0
    )

    const stops = offer.slices.reduce(
      (max, sl) => Math.max(max, sl.segments.length - 1),
      0
    )

    const baggageIncluded = offer.passenger_identity_documents_required === false

    return {
      id: offer.id,
      totalPrice: parseFloat(offer.total_amount),
      currency: offer.total_currency,
      totalDuration,
      segments: allSegments,
      cabinClass: mapCabinClass(offer.slices[0]?.segments[0]?.passengers?.[0]?.cabin_class ?? 'economy') as FlightResult['cabinClass'],
      stops,
      baggageIncluded,
    }
  })
}
