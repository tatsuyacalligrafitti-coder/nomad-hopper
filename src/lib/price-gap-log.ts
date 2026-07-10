import { Redis } from '@upstash/redis'

// ─── Passive price-gap measurement ──────────────────────────────────────────────
// When a user opens the booking panel we fetch live OTA prices. We compare that
// live lowest against the representative (Google Flights derived, ≤3h cached)
// price shown in results, and append the gap here for later analysis. Recording
// is strictly best-effort and must never affect the booking-options response.

export interface PriceGapEntry {
  origin: string
  destination: string
  outboundDate: string
  returnDate?: string | null
  representativePrice: number   // 代表価格（Google Flights由来・≤3hキャッシュ）
  liveLowest: number            // ライブOTA最安
  diff: number                  // liveLowest - representativePrice（+ならライブが高い）
  ratio: number                 // liveLowest / representativePrice
  optionCount: number           // ライブで取得できたOTA件数
  recordedAt: string            // ISO 8601
}

// Single capped list holding every measurement, newest first (LPUSH).
const PRICEGAP_KEY = 'pricegap:log'
const PRICEGAP_MAX = 5000              // keep the latest 5000 samples (LTRIM 0 4999)
const PRICEGAP_TTL_SECONDS = 90 * 24 * 60 * 60 // 90 days, refreshed on every write

// Same connection method as alert-store: no-op when Upstash env is absent.
function getRedis(): Redis | null {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null
  try {
    return Redis.fromEnv()
  } catch {
    return null
  }
}

export async function recordPriceGap(entry: PriceGapEntry): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    await redis.lpush(PRICEGAP_KEY, JSON.stringify(entry))
    await redis.ltrim(PRICEGAP_KEY, 0, PRICEGAP_MAX - 1)
    await redis.expire(PRICEGAP_KEY, PRICEGAP_TTL_SECONDS)
    console.log(
      '[price-gap] recorded:',
      `${entry.origin}-${entry.destination} 代表¥${entry.representativePrice.toLocaleString()} / ライブ¥${entry.liveLowest.toLocaleString()} (diff ${entry.diff >= 0 ? '+' : ''}${entry.diff})`,
    )
  } catch (err) {
    console.warn('[price-gap] record error:', err instanceof Error ? err.message : String(err))
  }
}
