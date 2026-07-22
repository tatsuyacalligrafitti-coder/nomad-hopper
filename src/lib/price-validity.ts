import type { ValidityNote } from '@/types'
import { getPriceLog } from '@/lib/alert-store'
import { toJstDateString } from '@/lib/date-jst'

// Assess where `currentPrice` sits within Tobira's own past observations for a
// route, drawn from the persistent per-route log (pricehist:log:*). This states a
// position within observed history — it is NOT a forecast and never a guarantee.
//
// Returns null (→ UI shows nothing) when we shouldn't speak:
//   a. no observations for the route
//   b. fewer than MIN_SAMPLES observations (too little data to position honestly)
//   c. the newest observation is STALE_AFTER_DAYS or more old (data too stale)
//
// Comparison is against ALL observations for the route regardless of departure
// date. The log keeps `dep` per point so future work can stratify by departure;
// this first version deliberately does not.

const MIN_SAMPLES = 5
const STALE_AFTER_DAYS = 14
const LOW_PERCENTILE = 25
const HIGH_PERCENTILE = 75
const DAY_MS = 24 * 60 * 60 * 1000

// Parse a "YYYY-MM-DD" calendar date to a UTC epoch (midnight UTC). Used only for
// day-count differences, so the fixed offset cancels out.
function dateToMs(ymd: string): number {
  return new Date(`${ymd}T00:00:00Z`).getTime()
}

export async function assessPriceValidity(
  origin: string,
  destination: string,
  currentPrice: number,
): Promise<ValidityNote | null> {
  const log = await getPriceLog(origin, destination)

  // Keep only well-formed points.
  const points = log.filter(
    (e) => e && typeof e.p === 'number' && Number.isFinite(e.p) && typeof e.d === 'string',
  )

  // (a)/(b): not enough to speak.
  if (points.length < MIN_SAMPLES) return null

  // (c): freshness — newest observation date must be within STALE_AFTER_DAYS of today (JST).
  const todayMs = dateToMs(toJstDateString(Date.now()))
  const dates = points.map((e) => dateToMs(e.d)).filter((ms) => Number.isFinite(ms))
  if (dates.length === 0) return null
  const newestMs = Math.max(...dates)
  const oldestMs = Math.min(...dates)
  const daysSinceNewest = Math.floor((todayMs - newestMs) / DAY_MS)
  if (daysSinceNewest >= STALE_AFTER_DAYS) return null

  // Position from the cheap end: share of observations strictly cheaper than now.
  const cheaperCount = points.filter((e) => e.p < currentPrice).length
  const percentile = Math.round((cheaperCount / points.length) * 100)

  const spanDays = Math.round((newestMs - oldestMs) / DAY_MS)

  const tone: ValidityNote['tone'] =
    percentile <= LOW_PERCENTILE ? 'low' : percentile >= HIGH_PERCENTILE ? 'high' : 'mid'

  return { percentile, sampleCount: points.length, spanDays, tone }
}
