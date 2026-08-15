import { randomUUID } from 'crypto'
import { Redis } from '@upstash/redis'
import type { AlertRequest } from '@/types'
import { toJstDateString } from '@/lib/date-jst'

// ─── Stored alert shape ─────────────────────────────────────────────────────────
// AlertRequest fields + bookkeeping. lastNotifiedAt stays null until the price
// monitor batch actually sends a drop notification.
export interface StoredAlert extends AlertRequest {
  alertId: string
  createdAt: string            // ISO 8601
  lastNotifiedAt: string | null
}

// Key namespace — kept distinct from the search cache (flight:v1:) to avoid collisions.
const ALERT_KEY = (id: string) => `alert:${id}`
const INDEX_KEY = 'alerts:index'

function getRedis(): Redis | null {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null
  try {
    return Redis.fromEnv()
  } catch {
    return null
  }
}

// Save a new alert. Returns the stored alert (with generated id) on success,
// or null when Redis is unavailable (graceful no-op).
export async function saveAlert(alert: AlertRequest): Promise<StoredAlert | null> {
  const stored: StoredAlert = {
    ...alert,
    alertId: randomUUID(),
    createdAt: new Date().toISOString(),
    lastNotifiedAt: null,
  }

  const redis = getRedis()
  if (!redis) {
    console.warn('[alert-store] Redis未設定、保存をスキップ (no-op)')
    return null
  }

  try {
    await redis.set(ALERT_KEY(stored.alertId), stored)
    await redis.sadd(INDEX_KEY, stored.alertId)
    console.log('[alert-store] saved:', ALERT_KEY(stored.alertId))
    return stored
  } catch (err) {
    console.error('[alert-store] save error:', err instanceof Error ? err.message : String(err))
    return null
  }
}

export async function getAlert(alertId: string): Promise<StoredAlert | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    return (await redis.get<StoredAlert>(ALERT_KEY(alertId))) ?? null
  } catch (err) {
    console.error('[alert-store] get error:', err instanceof Error ? err.message : String(err))
    return null
  }
}

// List every stored alert (batch entry point). Returns [] when Redis is unavailable.
export async function listAllAlerts(): Promise<StoredAlert[]> {
  const redis = getRedis()
  if (!redis) {
    console.warn('[alert-store] Redis未設定、空配列を返す')
    return []
  }
  try {
    const ids = await redis.smembers(INDEX_KEY)
    if (!ids || ids.length === 0) return []

    const alerts = await Promise.all(ids.map((id) => redis.get<StoredAlert>(ALERT_KEY(id))))
    return alerts.filter((a): a is StoredAlert => a != null)
  } catch (err) {
    console.error('[alert-store] list error:', err instanceof Error ? err.message : String(err))
    return []
  }
}

export async function updateAlertNotifiedAt(alertId: string, timestamp: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    const existing = await redis.get<StoredAlert>(ALERT_KEY(alertId))
    if (!existing) return
    await redis.set(ALERT_KEY(alertId), { ...existing, lastNotifiedAt: timestamp })
    console.log('[alert-store] updated lastNotifiedAt:', alertId)
  } catch (err) {
    console.error('[alert-store] update error:', err instanceof Error ? err.message : String(err))
  }
}

export async function deleteAlert(alertId: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.del(ALERT_KEY(alertId))
    await redis.srem(INDEX_KEY, alertId)
    console.log('[alert-store] deleted:', alertId)
  } catch (err) {
    console.error('[alert-store] delete error:', err instanceof Error ? err.message : String(err))
  }
}

// ─── Price history (one observed cheapest price per route+date, per day) ─────────
export interface PricePoint {
  date: string  // YYYY-MM-DD (JST observation date)
  price: number
}

const PRICEHIST_KEY = (origin: string, destination: string, departureDate: string) =>
  `pricehist:${origin}-${destination}-${departureDate}`

// Keep a route's history for 7 days past its departure, then let it expire so keys
// don't accumulate forever once every search records (not just alerted routes).
const PRICEHIST_TTL_BUFFER_DAYS = 7

// ─── Persistent per-route observation log (no TTL) ───────────────────────────────
// The departure-keyed history above expires 7 days past departure, so observations
// are never retained as a long-term asset. This companion key accumulates every
// observation for a route across all departure dates and never expires.
export interface PriceLogPoint {
  d: string    // observation date (JST, YYYY-MM-DD)
  dep: string  // departure date (YYYY-MM-DD)
  p: number    // observed cheapest price
  ret?: string // return date (YYYY-MM-DD) — present only on round-trip observations
}

// One-way fares and round-trip totals are different products, so they get separate
// keys. Pooled together, a round-trip total always lands at the expensive end of a
// one-way-dominated distribution and the position we state is simply wrong.
// The one-way key name is deliberately unchanged: the observations accumulated
// since 2026-07-11 keep being read by exactly the same key.
const PRICEHIST_LOG_KEY = (origin: string, destination: string, roundTrip: boolean) =>
  roundTrip ? `pricehist:log:rt:${origin}-${destination}` : `pricehist:log:${origin}-${destination}`

// Treat an absent/empty return date as one-way, so a form sending "" never lands in
// the round-trip bucket. Every trip-type decision in this file goes through here.
function normalizeReturnDate(returnDate?: string | null): string | undefined {
  return returnDate && returnDate.length > 0 ? returnDate : undefined
}

// Safety valve against unbounded growth. Not expected to be reached in practice
// (2 routes × 2 offsets × daily ≈ years of runway), but we never let a key grow
// without bound. On overflow we drop the oldest entries (array is append-ordered).
const PRICEHIST_LOG_MAX = 2000

// Seconds from `timestamp` until (departureDate + buffer). Returns <= 0 (or NaN)
// when the departure is already past the buffer — caller treats that as "skip".
function priceHistoryTtlSeconds(departureDate: string, timestamp: string): number {
  const nowMs = new Date(timestamp).getTime()
  const expiryMs =
    new Date(`${departureDate}T00:00:00Z`).getTime() +
    PRICEHIST_TTL_BUFFER_DAYS * 24 * 60 * 60 * 1000
  return Math.ceil((expiryMs - nowMs) / 1000)
}

export async function recordPriceHistory(
  origin: string,
  destination: string,
  departureDate: string,
  price: number,
  timestamp: string,
  returnDate?: string,
): Promise<void> {
  const redis = getRedis()
  if (!redis) {
    console.warn('[alert-store] Redis未設定、価格履歴記録をスキップ')
    return
  }

  // Observation date on the JST calendar (records made in the JST morning must
  // not slip to the previous UTC day). Shared with watchlist target-date logic.
  const date = toJstDateString(new Date(timestamp).getTime()) // YYYY-MM-DD (JST)
  const key = PRICEHIST_KEY(origin, destination, departureDate)

  // Guard: skip past departures so we never pass a non-positive TTL to Redis.
  const ttlSeconds = priceHistoryTtlSeconds(departureDate, timestamp)
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    console.log('[alert-store] 出発日が過ぎている（+7日超）ため記録をスキップ:', key)
    return
  }

  try {
    const existing = (await redis.get<PricePoint[]>(key)) ?? []
    // One sample per day: overwrite same-day entry, otherwise append.
    const filtered = existing.filter((p) => p.date !== date)
    filtered.push({ date, price })
    await redis.set(key, filtered, { ex: ttlSeconds })
    console.log('[alert-store] price recorded:', key, `¥${price.toLocaleString()}`, `(ttl ${ttlSeconds}s)`)
  } catch (err) {
    console.error('[alert-store] price history error:', err instanceof Error ? err.message : String(err))
  }

  // Persistent per-route log (no TTL). Separate try/catch so a failure here never
  // undoes the departure-keyed record above. Command budget: GET + SET (the two
  // commands this persistent log adds per recording).
  try {
    const ret = normalizeReturnDate(returnDate)
    const logKey = PRICEHIST_LOG_KEY(origin, destination, ret != null)
    const existingLog = (await redis.get<PriceLogPoint[]>(logKey)) ?? []
    // One sample per (observation date, departure date, return date): overwrite, else
    // append. One-way points carry no `ret`, so undefined === undefined keeps the
    // pre-existing two-field dedup behaviour for the one-way key unchanged.
    const filteredLog = existingLog.filter(
      (e) => !(e.d === date && e.dep === departureDate && e.ret === ret),
    )
    filteredLog.push(ret ? { d: date, dep: departureDate, p: price, ret } : { d: date, dep: departureDate, p: price })
    // Safety valve: keep the newest PRICEHIST_LOG_MAX, dropping oldest first.
    const capped =
      filteredLog.length > PRICEHIST_LOG_MAX
        ? filteredLog.slice(filteredLog.length - PRICEHIST_LOG_MAX)
        : filteredLog
    await redis.set(logKey, capped) // no TTL — permanent asset
    console.log('[alert-store] price logged (persistent):', logKey, `(${capped.length} pts)`)
  } catch (err) {
    console.error('[alert-store] price log error:', err instanceof Error ? err.message : String(err))
  }
}

export async function getPriceHistory(
  origin: string,
  destination: string,
  departureDate: string,
): Promise<PricePoint[]> {
  const redis = getRedis()
  if (!redis) return []
  try {
    return (await redis.get<PricePoint[]>(PRICEHIST_KEY(origin, destination, departureDate))) ?? []
  } catch (err) {
    console.error('[alert-store] get price history error:', err instanceof Error ? err.message : String(err))
    return []
  }
}

// Read the persistent per-route log for one trip type (all departure dates). Single
// GET; returns [] when Redis is unavailable or the key doesn't exist yet — which is
// also what the round-trip key returns until observations start accumulating.
export async function getPriceLog(
  origin: string,
  destination: string,
  roundTrip = false,
): Promise<PriceLogPoint[]> {
  const redis = getRedis()
  if (!redis) return []
  try {
    return (await redis.get<PriceLogPoint[]>(PRICEHIST_LOG_KEY(origin, destination, roundTrip))) ?? []
  } catch (err) {
    console.error('[alert-store] get price log error:', err instanceof Error ? err.message : String(err))
    return []
  }
}
