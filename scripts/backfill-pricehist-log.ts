/**
 * One-shot backfill: rescue existing departure-keyed price history into the new
 * persistent per-route log (`pricehist:log:${origin}-${destination}`).
 *
 * The departure-keyed keys (`pricehist:${o}-${d}-${dep}`) expire 7 days past
 * departure, so their observations would otherwise be lost. This reads every such
 * key still alive and folds its samples into the never-expiring log key, using the
 * same "one sample per (observation date, departure date)" dedup as recordPriceHistory.
 *
 * Manual, local run only (NOT registered in package.json). Requires KV creds in env:
 *   npx tsx --env-file=.env.local scripts/backfill-pricehist-log.ts
 *
 * Safe by design: prints the number of source keys and parsed observations, then
 * waits for an explicit "yes" before writing anything.
 */
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { Redis } from '@upstash/redis'

// ── Shapes (kept in sync with src/lib/alert-store.ts) ────────────────────────────
interface PricePoint {
  date: string // YYYY-MM-DD
  price: number
}
interface PriceLogPoint {
  d: string // observation date (JST, YYYY-MM-DD)
  dep: string // departure date (YYYY-MM-DD)
  p: number // observed cheapest price
}

const LOG_KEY = (origin: string, destination: string) => `pricehist:log:${origin}-${destination}`
const PRICEHIST_LOG_MAX = 2000

// Parse `pricehist:HND-HAN-2026-08-01` → { origin, destination, departureDate }.
// origin/destination are 3-letter IATA; departure date is the trailing YYYY-MM-DD.
function parseSourceKey(key: string): { origin: string; destination: string; departureDate: string } | null {
  const body = key.slice('pricehist:'.length)
  const parts = body.split('-')
  if (parts.length < 5) return null // need o, d, YYYY, MM, DD
  const [origin, destination, ...rest] = parts
  const departureDate = rest.join('-')
  if (!origin || !destination || !/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) return null
  return { origin, destination, departureDate }
}

async function main() {
  const redis = Redis.fromEnv()

  // ── 1. Enumerate source keys via SCAN (exclude the log keys themselves) ─────────
  const sourceKeys: string[] = []
  let cursor = '0'
  do {
    const [next, batch] = await redis.scan(cursor, { match: 'pricehist:*', count: 200 })
    cursor = next
    for (const k of batch) {
      if (k.startsWith('pricehist:log:')) continue
      sourceKeys.push(k)
    }
  } while (cursor !== '0')

  // ── 2. Read + convert into per-route new points ─────────────────────────────────
  const byRoute = new Map<string, PriceLogPoint[]>() // logKey → new points
  let parsedObservations = 0
  let skippedKeys = 0

  for (const key of sourceKeys) {
    const meta = parseSourceKey(key)
    if (!meta) {
      skippedKeys++
      console.warn('[backfill] キー名を解釈できずスキップ:', key)
      continue
    }
    const points = (await redis.get<PricePoint[]>(key)) ?? []
    const logKey = LOG_KEY(meta.origin, meta.destination)
    const bucket = byRoute.get(logKey) ?? []
    for (const p of points) {
      if (!p || typeof p.date !== 'string' || typeof p.price !== 'number') continue
      bucket.push({ d: p.date, dep: meta.departureDate, p: p.price })
      parsedObservations++
    }
    byRoute.set(logKey, bucket)
  }

  console.log('─'.repeat(60))
  console.log(`[backfill] SCAN 対象キー数（log: 除く）: ${sourceKeys.length}`)
  if (skippedKeys > 0) console.log(`[backfill]   うち解釈不能でスキップ: ${skippedKeys}`)
  console.log(`[backfill] 変換した観測数（投入候補）: ${parsedObservations}`)
  console.log(`[backfill] 影響を受ける路線ログキー数: ${byRoute.size}`)
  console.log('─'.repeat(60))

  if (parsedObservations === 0) {
    console.log('[backfill] 投入対象がありません。終了します。')
    return
  }

  // ── 3. Confirm before any write ─────────────────────────────────────────────────
  const rl = createInterface({ input: stdin, output: stdout })
  const answer = (await rl.question('上記を pricehist:log:* に投入します。続行しますか? (yes/no): ')).trim().toLowerCase()
  rl.close()
  if (answer !== 'yes' && answer !== 'y') {
    console.log('[backfill] 中止しました（書き込みなし）。')
    return
  }

  // ── 4. Merge into each route log with the same dedup rule, then write ────────────
  let insertedObservations = 0
  for (const [logKey, newPoints] of byRoute) {
    const existing = (await redis.get<PriceLogPoint[]>(logKey)) ?? []
    let merged = existing
    for (const np of newPoints) {
      // Same (d, dep): drop existing, then push (new overwrites — matches recordPriceHistory).
      merged = merged.filter((e) => !(e.d === np.d && e.dep === np.dep))
      merged.push(np)
      insertedObservations++
    }
    const capped =
      merged.length > PRICEHIST_LOG_MAX ? merged.slice(merged.length - PRICEHIST_LOG_MAX) : merged
    await redis.set(logKey, capped) // no TTL
    console.log(`[backfill] wrote ${logKey}: ${capped.length} pts`)
  }

  console.log('─'.repeat(60))
  console.log(`[backfill] 完了。読んだキー数: ${sourceKeys.length} / 投入観測数: ${insertedObservations}`)
}

main().catch((err) => {
  console.error('[backfill] 失敗:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
