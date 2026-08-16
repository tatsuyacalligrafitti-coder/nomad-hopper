// SERVER-ONLY. 拍2 — what it costs to just go there.
//
// This goes through searchAllProviders(), the same four-provider stack the top
// page uses. 大阪→ミラノ returned nothing on /asobi while the main search found
// a ¥160,957 Vietnam Airlines fare, because /asobi was reading Travelpayouts
// alone. One route lookup can afford the full stack; the 25 lookups a stopover
// search needs cannot, which is why 拍4 stays on cached fares (detour-search.ts).
//
// Consequence the UI has to respect: the number here is a real, bookable fare,
// and the stopover comparison is estimate-versus-estimate. They are different
// rulers and must never be subtracted from each other.

import { searchAllProviders } from '@/lib/flight-search-orchestrator'
import { findDirectEstimate } from '@/lib/detour-search'
import { toJstDateString } from '@/lib/date-jst'
import type { DirectOutcome, RealFare } from '@/types'

/** YYYY-MM-DD, `days` after `ymd`. */
function addDays(ymd: string, days: number): string {
  const t = Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

/**
 * The main search prices a single day, but /asobi only asks for a month. Prefer
 * the day the cached-fare data says was cheapest — that is the day the estimate
 * refers to, so both halves of the page talk about the same trip. With no
 * estimate to go on, aim at the middle of the month.
 */
function pickDate(
  month: string,
  estimateDate: string | null,
  today: string,
): { date: string; fromEstimate: boolean } | null {
  // Whole month already past: there is nothing to price.
  if (`${month}-28` < today) return null

  if (estimateDate && estimateDate.startsWith(month) && estimateDate > today) {
    return { date: estimateDate, fromEstimate: true }
  }
  const mid = `${month}-15`
  return { date: mid > today ? mid : addDays(today, 3), fromEstimate: false }
}

export async function findDirectFare(
  origin: string,
  destination: string,
  month: string,
): Promise<DirectOutcome> {
  const from = origin.toUpperCase()
  const to = destination.toUpperCase()

  // The cached-fare answer first: it is cheap, it supplies the date to price,
  // and it is the figure the stopover comparison will be built from.
  const estimateOutcome = await findDirectEstimate(from, to, month)
  const estimate = estimateOutcome.status === 'ok' ? estimateOutcome.estimate : null

  const today = toJstDateString(Date.now())
  const picked = pickDate(month, estimate?.departDate ?? null, today)
  if (!picked) return { status: 'no-direct', month }

  let real: RealFare | null = null
  try {
    const { flights } = await searchAllProviders({
      origin: from,
      destination: to,
      departureDate: picked.date,
      passengers: 1,
      cabinClass: 'economy',
      rawQuery: '',
    })
    if (flights.length > 0) {
      const cheapest = flights.reduce((min, f) => (f.totalPrice < min.totalPrice ? f : min), flights[0])
      real = {
        price: cheapest.totalPrice,
        currency: cheapest.currency,
        airline: cheapest.segments[0]?.carrierName || null,
        departDate: picked.date,
        stops: cheapest.stops,
        bookingLink: cheapest.bookingLink,
      }
    }
  } catch (err) {
    // A failure here must not take the page down: the estimate can still stand in.
    console.warn('[direct-fare] 実価格の取得に失敗:', err instanceof Error ? err.message : String(err))
  }

  // Neither source had anything — say so rather than showing an empty card.
  if (!real && !estimate) {
    return estimateOutcome.status === 'unavailable'
      ? { status: 'unavailable', month }
      : { status: 'no-direct', month }
  }

  return {
    status: 'ok',
    month,
    date: picked.date,
    dateFromEstimate: picked.fromEstimate,
    real,
    estimate,
  }
}
