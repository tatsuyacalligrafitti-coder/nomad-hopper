import { getRedis } from '@/lib/flight-cache'

// ─── NLU (LLM parser) failure visibility ────────────────────────────────────────
// parseWithLLM silently falls back to the rule-based parser on any failure. When
// the LLM dies wholesale (e.g. API credit exhausted) that fallback is invisible.
// We count failures by reason per UTC day so a "silent death" is observable.
// Best-effort only: never affects parsing. Never receives query text or API keys.

export type NluFailureReason = 'http_error' | 'timeout' | 'json_parse' | 'invalid_shape'

// Per-day hash of reason → count. UTC date keeps it aligned with billing/ops.
const STATS_KEY = (date: string) => `nlufail:stats:${date}`
const STATS_TTL_SECONDS = 90 * 24 * 60 * 60 // 90 days

export async function recordNluFailure(reason: string, detail?: string): Promise<void> {
  // Always surface to Vercel logs, even when Redis is absent. `detail` is expected
  // to be a short token (HTTP status, error name) — never query text or secrets.
  console.warn(`[parseWithLLM] failed: ${reason}${detail ? ' ' + detail : ''}`)

  const redis = getRedis()
  if (!redis) return

  try {
    const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
    const key = STATS_KEY(date)
    await redis.hincrby(key, reason, 1)
    await redis.expire(key, STATS_TTL_SECONDS)
  } catch (err) {
    console.warn('[nlu-failure-log] record error:', err instanceof Error ? err.message : String(err))
  }
}
