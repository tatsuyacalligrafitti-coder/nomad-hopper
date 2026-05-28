export type SearchMode = 'price' | 'balance' | 'elegant' | 'fastest'

export interface SearchQuery {
  origin: string
  destination: string
  departureDate: string
  returnDate?: string
  passengers: number
  cabinClass: 'economy' | 'premium_economy' | 'business' | 'first'
  rawQuery: string
}

export interface FlightSegment {
  origin: string
  originName: string
  destination: string
  destinationName: string
  departingAt: string
  arrivingAt: string
  carrierCode: string
  carrierName: string
  flightNumber: string
  duration: number // minutes
  stops: number
}

export interface FlightResult {
  id: string
  totalPrice: number
  currency: string
  totalDuration: number // minutes
  segments: FlightSegment[]
  cabinClass: string
  stops: number
  baggageIncluded: boolean
  bookingLink?: string
  mode?: SearchMode
  score?: number
}

export interface ParsedQuery {
  origin: string | null
  destination: string | null
  departureDate: string | null
  returnDate: string | null
  passengers: number
  cabinClass: 'economy' | 'premium_economy' | 'business' | 'first'
}

export interface AlertRequest {
  email?: string
  lineToken?: string
  flightId: string
  targetPrice: number
  origin: string
  destination: string
  departureDate: string
}

export interface CategorizedFlights {
  cheapest: FlightResult[]
  cheapestDirect: FlightResult[]
  recommended: FlightResult[]
}

// ── Multi-city ────────────────────────────────────────────────────────────────

export interface MultiCitySegmentQuery {
  origin: string
  destination: string
  date: string
}

export interface MultiCityParsedQuery {
  type: 'multi-city'
  segments: MultiCitySegmentQuery[]
  passengers: number
  cabinClass: 'economy' | 'premium_economy' | 'business' | 'first'
}

export interface MultiCitySegmentResult {
  origin: string
  destination: string
  date: string
  originCity?: string
  destinationCity?: string
  cheapestPrice: number | null
  cheapestFlight: FlightResult | null
}

export interface MultiCitySearchResult {
  type: 'multi-city'
  segments: MultiCitySegmentResult[]
  totalPrice: number
}

export interface ModeConfig {
  id: SearchMode
  label: string
  description: string
  icon: string
  sortKey: (f: FlightResult) => number
}
