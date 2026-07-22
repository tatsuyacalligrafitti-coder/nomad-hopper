export type SearchMode = 'price' | 'balance' | 'elegant' | 'fastest'

// ── Unified query schema (LLM parser output format) ────────────────────────────
export type DateRole = 'departure' | 'arrival' | 'deadline'

export interface UnifiedLeg {
  origin: string       // IATA code
  destination: string  // IATA code
  date: string         // ISO 8601 (yyyy-mm-dd)
  date_role: DateRole
}

export interface UnifiedQuery {
  type: 'one-way' | 'round-trip' | 'multi-city'
  legs: UnifiedLeg[]
  passengers: number
  cabinClass: 'economy' | 'premium_economy' | 'business' | 'first'
}

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
  serpBookingToken?: string
  serpDepartureToken?: string
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
  lineUserId?: string
  flightId: string
  targetPrice: number
  currentPrice?: number
  origin: string
  destination: string
  departureDate: string
}

export interface PriceInsights {
  lowestPrice: number
  priceLevel: 'low' | 'typical' | 'high' | string
  typicalPriceRange: [number, number] | null
  priceHistory: { price: number; date: string }[] | null
  estimatedSavings: number | null
}

// Position of the current price within Tobira's own past observations for a route.
// Honest positioning only — never a prediction. Null upstream means "don't show".
export interface ValidityNote {
  percentile: number   // 0–100, position from the cheap end (count of cheaper observations / total)
  sampleCount: number  // number of observations the position is drawn from
  spanDays: number     // days between the oldest and newest observation
  tone: 'low' | 'mid' | 'high'
}

export interface CategorizedFlights {
  cheapest: FlightResult[]
  cheapestDirect: FlightResult[]
  recommended: FlightResult[]
  priceInsights?: PriceInsights
  validityNote?: ValidityNote | null
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
  top5Flights: FlightResult[]
  priceInsights?: PriceInsights | null
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
