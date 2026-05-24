import type { FlightResult } from '@/types'

// Rough flight-time table between major airport pairs (minutes)
const DURATION_MAP: Record<string, number> = {
  'HND-OKA': 155, 'OKA-HND': 155,
  'NRT-OKA': 165, 'OKA-NRT': 165,
  'HND-CTS': 90,  'CTS-HND': 90,
  'HND-FUK': 110, 'FUK-HND': 110,
  'HND-KIX': 75,  'KIX-HND': 75,
  'HND-BKK': 370, 'BKK-HND': 370,
  'HND-SIN': 390, 'SIN-HND': 390,
  'HND-ICN': 145, 'ICN-HND': 145,
  'HND-TPE': 195, 'TPE-HND': 195,
  'HND-HKG': 245, 'HKG-HND': 245,
  'HND-LHR': 750, 'LHR-HND': 750,
  'HND-CDG': 740, 'CDG-HND': 740,
  'HND-JFK': 780, 'JFK-HND': 780,
  'HND-LAX': 630, 'LAX-HND': 630,
  'HND-SFO': 610, 'SFO-HND': 610,
  'HND-HNL': 430, 'HNL-HND': 430,
  'HND-DXB': 510, 'DXB-HND': 510,
  'KIX-CTS': 180, 'CTS-KIX': 180,
  'KIX-FUK': 70,  'FUK-KIX': 70,
  'KIX-OKA': 140, 'OKA-KIX': 140,
  'NRT-LHR': 760, 'LHR-NRT': 760,
  'NRT-CDG': 750, 'CDG-NRT': 750,
  'NRT-JFK': 790, 'JFK-NRT': 790,
  'NRT-BKK': 360, 'BKK-NRT': 360,
}

// Fictional but plausible carrier + flight numbers
const CARRIERS: Array<{ code: string; name: string }> = [
  { code: 'JL', name: 'Japan Airlines' },
  { code: 'NH', name: 'ANA' },
  { code: 'MM', name: 'Peach Aviation' },
  { code: 'JW', name: 'Vanilla Air' },
  { code: 'SQ', name: 'Singapore Airlines' },
  { code: 'TG', name: 'Thai Airways' },
  { code: 'CX', name: 'Cathay Pacific' },
  { code: 'KE', name: 'Korean Air' },
  { code: 'BA', name: 'British Airways' },
  { code: 'AF', name: 'Air France' },
  { code: 'UA', name: 'United Airlines' },
  { code: 'EK', name: 'Emirates' },
]

// Airport display names
const AIRPORT_NAMES: Record<string, string> = {
  HND: '羽田',
  NRT: '成田',
  OKA: '那覇',
  CTS: '新千歳',
  FUK: '福岡',
  KIX: '関西',
  ITM: '伊丹',
  NGO: '中部',
  SDJ: '仙台',
  HIJ: '広島',
  BKK: 'スワンナプーム',
  SIN: 'シンガポール・チャンギ',
  ICN: '仁川',
  TPE: '台北桃園',
  HKG: '香港チェックラップコック',
  LHR: 'ロンドン・ヒースロー',
  CDG: 'パリ・シャルルドゴール',
  JFK: 'ニューヨーク・JFK',
  LAX: 'ロサンゼルス',
  SFO: 'サンフランシスコ',
  HNL: 'ホノルル',
  DXB: 'ドバイ国際',
  PVG: '上海浦東',
  PEK: '北京首都',
  DPS: 'ングラ・ライ',
  SYD: 'シドニー',
}

function airportName(code: string): string {
  return AIRPORT_NAMES[code] ?? code
}

function addMinutes(base: Date, mins: number): Date {
  return new Date(base.getTime() + mins * 60_000)
}

function isoStr(d: Date): string {
  return d.toISOString().replace('.000Z', '+00:00')
}

function flightNum(carrier: { code: string }, seed: number): string {
  return `${carrier.code}${100 + (seed % 900)}`
}

// Base price lookup (one-way, economy, rough estimate in JPY)
function basePrice(origin: string, dest: string, seed: number): number {
  const dur = DURATION_MAP[`${origin}-${dest}`] ?? 300
  const base = Math.round((dur * 60 + 5000) / 1000) * 1000
  const variation = (seed % 5) * 2000 - 4000
  return Math.max(6000, base + variation)
}

export function generateMockFlights(
  origin: string,
  destination: string,
  departureDate: string,
  count = 6
): FlightResult[] {
  const departure = new Date(`${departureDate}T07:00:00+09:00`)
  const dur = DURATION_MAP[`${origin}-${destination}`] ?? 270
  const results: FlightResult[] = []

  const carrierPool = CARRIERS.slice(0, Math.min(count, CARRIERS.length))

  for (let i = 0; i < count; i++) {
    const carrier = carrierPool[i % carrierPool.length]
    const depOffset = i * 90 // each mock flight departs 90 min later
    const depTime = addMinutes(departure, depOffset)
    const arrTime = addMinutes(depTime, dur)
    const price = basePrice(origin, destination, i * 17 + 3)
    const stops = i % 3 === 2 ? 1 : 0 // every 3rd flight has a stop

    const segments = stops === 0
      ? [{
          origin,
          originName: airportName(origin),
          destination,
          destinationName: airportName(destination),
          departingAt: isoStr(depTime),
          arrivingAt: isoStr(arrTime),
          carrierCode: carrier.code,
          carrierName: carrier.name,
          flightNumber: flightNum(carrier, i * 37 + 1),
          duration: dur,
          stops: 0,
        }]
      : (() => {
          const midArrival = addMinutes(depTime, Math.floor(dur * 0.55))
          const midDeparture = addMinutes(midArrival, 60)
          const stopCode = origin === 'HND' || origin === 'NRT' ? 'ICN' : 'HND'
          return [
            {
              origin,
              originName: airportName(origin),
              destination: stopCode,
              destinationName: airportName(stopCode),
              departingAt: isoStr(depTime),
              arrivingAt: isoStr(midArrival),
              carrierCode: carrier.code,
              carrierName: carrier.name,
              flightNumber: flightNum(carrier, i * 37 + 1),
              duration: Math.floor(dur * 0.55),
              stops: 0,
            },
            {
              origin: stopCode,
              originName: airportName(stopCode),
              destination,
              destinationName: airportName(destination),
              departingAt: isoStr(midDeparture),
              arrivingAt: isoStr(addMinutes(midDeparture, Math.ceil(dur * 0.45))),
              carrierCode: carrier.code,
              carrierName: carrier.name,
              flightNumber: flightNum(carrier, i * 37 + 2),
              duration: Math.ceil(dur * 0.45),
              stops: 0,
            },
          ]
        })()

    results.push({
      id: `mock-${origin}-${destination}-${i}`,
      totalPrice: price,
      currency: 'JPY',
      totalDuration: stops === 0 ? dur : dur + 60,
      segments,
      cabinClass: 'economy',
      stops,
      baggageIncluded: i % 2 === 0,
    })
  }

  return results
}
