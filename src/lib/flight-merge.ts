import type { NormalizedFlight } from './flight-sources/types'

function dedupKey(f: NormalizedFlight): string {
  // Identified flight: deduplicate across sources by canonical key
  if (f.airline && f.flightNumber) {
    return `${f.airline}-${f.flightNumber}-${f.departureDate}`
  }
  // Unidentified flight (no airline/flightNumber): treat as unique per source so
  // we don't accidentally merge unrelated cheap fares from different OTAs
  return `${f.sources[0]}-${f.departureDate}-${f.price}-${f.stops}`
}

export function mergeFlights(groups: NormalizedFlight[][]): NormalizedFlight[] {
  const map = new Map<string, NormalizedFlight>()

  for (const flights of groups) {
    for (const flight of flights) {
      const key = dedupKey(flight)
      const existing = map.get(key)

      if (!existing) {
        map.set(key, { ...flight, sources: [...flight.sources] })
        continue
      }

      // Same flight seen from another source — keep cheapest raw, union sources
      const merged: NormalizedFlight = {
        ...(flight.price < existing.price ? flight : existing),
        sources: [...new Set([...existing.sources, ...flight.sources])],
      }
      map.set(key, merged)
    }
  }

  return [...map.values()].sort((a, b) => a.price - b.price)
}
