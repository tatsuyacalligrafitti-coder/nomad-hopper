import { randomUUID } from 'crypto'
import { Redis } from '@upstash/redis'
import type { AlertRequest } from '@/types'

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
  date: string  // YYYY-MM-DD
  price: number
}

const PRICEHIST_KEY = (origin: string, destination: string, departureDate: string) =>
  `pricehist:${origin}-${destination}-${departureDate}`

export async function recordPriceHistory(
  origin: string,
  destination: string,
  departureDate: string,
  price: number,
  timestamp: string,
): Promise<void> {
  const redis = getRedis()
  if (!redis) {
    console.warn('[alert-store] Redis未設定、価格履歴記録をスキップ')
    return
  }

  const date = timestamp.slice(0, 10) // YYYY-MM-DD
  const key = PRICEHIST_KEY(origin, destination, departureDate)

  try {
    const existing = (await redis.get<PricePoint[]>(key)) ?? []
    // One sample per day: overwrite same-day entry, otherwise append.
    const filtered = existing.filter((p) => p.date !== date)
    filtered.push({ date, price })
    await redis.set(key, filtered)
    console.log('[alert-store] price recorded:', key, `¥${price.toLocaleString()}`)
  } catch (err) {
    console.error('[alert-store] price history error:', err instanceof Error ? err.message : String(err))
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
