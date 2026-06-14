import { Redis } from '@upstash/redis'
import type { FlightResult, PriceInsights } from '@/types'

const CACHE_TTL_SECONDS = 60 * 60 * 3 // 3 hours

export interface CachedSearchResult {
  flights: FlightResult[]
  priceInsights?: PriceInsights
}

export function getRedis(): Redis | null {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null
  try {
    return Redis.fromEnv()
  } catch {
    return null
  }
}

export function makeCacheKey(
  origin: string,
  destination: string,
  departureDate: string,
  passengers: number,
  cabinClass: string,
  returnDate?: string,
): string {
  const leg = returnDate
    ? `${origin}-${destination}-${departureDate}-${returnDate}`
    : `${origin}-${destination}-${departureDate}`
  return `flight:v1:${leg}:${passengers}:${cabinClass}`
}

export async function getCached(key: string): Promise<CachedSearchResult | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const value = await redis.get<CachedSearchResult>(key)
    return value ?? null
  } catch (err) {
    console.warn('[flight-cache] get error:', err instanceof Error ? err.message : String(err))
    return null
  }
}

export async function setCached(key: string, value: CachedSearchResult): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.set(key, value, { ex: CACHE_TTL_SECONDS })
    console.log('[flight-cache] cached:', key)
  } catch (err) {
    console.warn('[flight-cache] set error:', err instanceof Error ? err.message : String(err))
  }
}
