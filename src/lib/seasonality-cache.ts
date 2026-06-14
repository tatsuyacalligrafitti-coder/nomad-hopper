import type { Redis } from '@upstash/redis'
import { getRedis } from './flight-cache'

// 季節傾向は年単位で安定するため、フライト価格キャッシュ（3時間）より大幅に長く保持する。
const SEASONALITY_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

// 路線×月で安定する部分（タグ・詳細文）のみキャッシュする。
// keyInsight は returnDate や出発までの日数に依存するためキャッシュ対象外（seasonality.ts 参照）。
export interface CachedSeasonality {
  seasonalTags: string[]
  seasonalDetail: string
}

// `seasonality:v1:{origin}-{destination}:{YYYY-MM}`
// passengers / cabinClass / 具体日は含めない（粒度は路線×月）。
export function makeSeasonalityKey(
  origin: string,
  destination: string,
  month: string, // YYYY-MM
): string {
  return `seasonality:v1:${origin}-${destination}:${month}`
}

export async function getSeasonality(key: string): Promise<CachedSeasonality | null> {
  const redis: Redis | null = getRedis()
  if (!redis) return null
  try {
    const value = await redis.get<CachedSeasonality>(key)
    return value ?? null
  } catch (err) {
    console.warn('[seasonality-cache] get error:', err instanceof Error ? err.message : String(err))
    return null
  }
}

export async function setSeasonality(key: string, value: CachedSeasonality): Promise<void> {
  const redis: Redis | null = getRedis()
  if (!redis) return
  try {
    await redis.set(key, value, { ex: SEASONALITY_TTL_SECONDS })
    console.log('[seasonality-cache] cached:', key)
  } catch (err) {
    console.warn('[seasonality-cache] set error:', err instanceof Error ? err.message : String(err))
  }
}
