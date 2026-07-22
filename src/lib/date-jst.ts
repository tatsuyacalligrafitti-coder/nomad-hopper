// Shared JST (UTC+9) date helpers. Kept in one place so every observation —
// watchlist target dates AND the price-history `date`/`d` fields — uses the same
// calendar-day basis. Records made during the JST morning must not slip to the
// previous UTC day, which the old `timestamp.slice(0,10)` (UTC) approach did.

// Format a UTC epoch (ms) as a JST calendar date "YYYY-MM-DD".
export function toJstDateString(ms: number): string {
  const jst = new Date(ms + 9 * 60 * 60 * 1000)
  const y = jst.getUTCFullYear()
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(jst.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
