import type { FlightResult, PriceInsights } from '@/types'

export interface NormalizedFlight {
  origin: string
  destination: string
  departureDate: string       // YYYY-MM-DD
  airline: string             // IATA carrier code; empty string if unknown
  flightNumber: string        // e.g. "NH203"; empty string if unknown
  price: number               // always JPY
  currency: string
  durationMinutes: number
  stops: number
  sources: string[]           // which providers returned this flight
  raw: FlightResult           // original data passed through for UI rendering
  serpPriceInsights?: PriceInsights
}
