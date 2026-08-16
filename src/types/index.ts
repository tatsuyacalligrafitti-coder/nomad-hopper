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

// ── 遊び: 逆探知1段 ────────────────────────────────────────────────────────────
// Prices in this section are cached-fare estimates (Travelpayouts), never live
// bookable fares. The UI must say so wherever it shows one.

export interface Hub {
  iata: string
  city: string
  country: string
}

export interface LegQuote {
  origin: string
  destination: string
  price: number        // JPY, one-way, one passenger
  departDate: string   // YYYY-MM-DD the estimate was priced for
  airline: string | null
  transfers: number
  link: string
}

export interface DetourPlan {
  hub: Hub
  first: LegQuote
  second: LegQuote
  total: number
  saving: number
  datesInconsistent: boolean  // the two legs' cheapest dates don't form a travellable order
  detourRatio: number | null  // 1.24 = 24% further than the direct great circle
}

export type DetourOutcome =
  | { status: 'ok'; month: string; direct: LegQuote; plan: DetourPlan; candidatesPriced: number }
  | { status: 'no-cheaper'; month: string; direct: LegQuote; candidatesPriced: number }
  | { status: 'no-direct'; month: string }
  | { status: 'unavailable'; month: string }

// The first beat: the plain answer, before any stopover has been proposed. Kept
// separate from DetourOutcome because the page must be able to show the direct
// fare without having searched for a detour — the user has not asked yet.
export type DirectOutcome =
  | { status: 'ok'; month: string; direct: LegQuote }
  | { status: 'no-direct'; month: string }
  | { status: 'unavailable'; month: string }

export interface DetourPlace {
  iata: string
  city: string
  country: string
}

export interface DirectResponse {
  origin: DetourPlace
  destination: DetourPlace
  outcome: DirectOutcome
}

export interface DetourResponse {
  origin: DetourPlace
  destination: DetourPlace
  outcome: DetourOutcome
}

export interface ModeConfig {
  id: SearchMode
  label: string
  description: string
  icon: string
  sortKey: (f: FlightResult) => number
}
