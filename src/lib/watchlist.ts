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

// One query per route × offset. Shape matches the cron's alert query
// (passengers 1 / economy / one-way) so both flow through the same pipeline.
export function buildWatchlistQueries(now: Date): SearchQuery[] {
  const DAY_MS = 24 * 60 * 60 * 1000
  const queries: SearchQuery[] = []
  for (const route of WATCHLIST_ROUTES) {
    for (const offset of WATCHLIST_OFFSETS_DAYS) {
      queries.push({
        origin: route.origin,
        destination: route.destination,
        departureDate: toJstDateString(now.getTime() + offset * DAY_MS),
        passengers: 1,
        cabinClass: 'economy',
        rawQuery: '',
      })
    }
  }
  return queries
}
