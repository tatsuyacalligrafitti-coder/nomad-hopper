import type { SearchQuery } from '@/types'
import { toJstDateString } from '@/lib/date-jst'

// ─── Fixed watchlist for daily price observation ────────────────────────────────
// The price-monitor cron only checks user-registered alerts. To accumulate
// pricehist data regardless of how many alerts exist, we also observe a fixed
// set of routes every morning. Recording only — never notifies.

export const WATCHLIST_ROUTES: { origin: string; destination: string }[] = [
  { origin: 'HND', destination: 'HAN' },
  { origin: 'HND', destination: 'CEB' },
]

// Days ahead of "now" to sample each route at (captures both near and mid-term).
export const WATCHLIST_OFFSETS_DAYS: number[] = [7, 30]

// Nights between departure and return for the round-trip observation.
//
// Deliberately a fixed number of NIGHTS, not a fixed return date: every morning's
// round-trip observation is then the same product — "a 7-night round trip departing
// N days out" — so the accumulated points stay comparable with each other, which is
// the whole premise of positioning a price within them. A fixed return date would
// shorten the trip by one night every morning and quietly compare unlike things.
//
// 7 nights because the two departure offsets (7 and 30 days out) are leisure
// booking horizons, where a one-week trip is the ordinary shape, and because it
// keeps the return inside the same booking window as the departure.
export const WATCHLIST_RETURN_NIGHTS = 7

// Two queries per route × offset: one-way and round-trip. Both trip types must be
// observed daily, because each is positioned against its own history and a bucket
// nothing writes to never reaches the minimum sample count. Shape otherwise matches
// the cron's alert query (passengers 1 / economy) so all flow through one pipeline.
export function buildWatchlistQueries(now: Date): SearchQuery[] {
  const DAY_MS = 24 * 60 * 60 * 1000
  const queries: SearchQuery[] = []
  for (const route of WATCHLIST_ROUTES) {
    for (const offset of WATCHLIST_OFFSETS_DAYS) {
      const departureDate = toJstDateString(now.getTime() + offset * DAY_MS)
      const returnDate = toJstDateString(
        now.getTime() + (offset + WATCHLIST_RETURN_NIGHTS) * DAY_MS,
      )
      const base = {
        origin: route.origin,
        destination: route.destination,
        departureDate,
        passengers: 1,
        cabinClass: 'economy' as const,
        rawQuery: '',
      }
      queries.push(base)
      queries.push({ ...base, returnDate })
    }
  }
  return queries
}
