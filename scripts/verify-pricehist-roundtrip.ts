/**
 * Verification for the one-way / round-trip split of the price log.
 *
 * Runs the REAL application code (recordPriceHistory / assessPriceValidity /
 * buildWatchlistQueries) against a local stand-in for the Upstash REST API, so no
 * credentials and no network are involved and nothing touches the live store.
 *
 * Manual, local run only (NOT registered in package.json):
 *   npx tsx scripts/verify-pricehist-roundtrip.ts
 *
 * What it proves:
 *   1. Pre-existing one-way observations stay readable under the unchanged key.
 *   2. A round-trip search is positioned against round-trip data only, and stays
 *      silent (null) until 5 round-trip observations exist.
 *   3. A one-way search is positioned against one-way data only, and its sample
 *      count never picks up round-trip totals.
 *   4. Each morning's watchlist grows BOTH logs (2 one-way + 2 round-trip points
 *      per route per day).
 *   5. Round-trip points carry the return date; one-way points do not.
 */
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

// ── Local stand-in for the Upstash REST API ──────────────────────────────────────
// The client POSTs a command array (e.g. ["set","k","v","ex",123]) and expects
// {"result": ...}. Only the commands this code path uses are implemented.
const store = new Map<string, string>()
const ttls = new Map<string, number>()

function runCommand(cmd: unknown[]): unknown {
  const name = String(cmd[0]).toLowerCase()
  const key = String(cmd[1])
  if (name === 'get') return store.get(key) ?? null
  if (name === 'set') {
    store.set(key, String(cmd[2]))
    const exIndex = cmd.findIndex((a) => String(a).toLowerCase() === 'ex')
    // SET without EX clears any TTL — same semantics as real Redis, which is why
    // the persistent log can never acquire an expiry by accident.
    if (exIndex > 0) ttls.set(key, Number(cmd[exIndex + 1]))
    else ttls.delete(key)
    return 'OK'
  }
  if (name === 'ttl') return store.has(key) ? (ttls.get(key) ?? -1) : -2
  throw new Error(`未実装のコマンド: ${name}`)
}

const server = createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    let payload: unknown
    try {
      const body = JSON.parse(raw) as unknown[]
      // The client sends a single command (["get","k"]) or, when auto-pipelining
      // kicks in, a batch ([["get","k"],["set","k","v"]]) answered with one entry
      // per command. Both shapes have to be served or half the writes vanish.
      payload = Array.isArray(body[0])
        ? (body as unknown[][]).map((c) => ({ result: runCommand(c) }))
        : { result: runCommand(body) }
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(payload))
  })
})

// ── Assertions ───────────────────────────────────────────────────────────────────
let failures = 0
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  const ok = a === e
  if (!ok) failures++
  console.log(`${ok ? '  OK ' : '  NG '} ${label}: 実際=${a} 期待=${e}`)
}

const DAY_MS = 24 * 60 * 60 * 1000
const OW_KEY = 'pricehist:log:HND-HAN'
const RT_KEY = 'pricehist:log:rt:HND-HAN'

interface LogPoint { d: string; dep: string; p: number; ret?: string }
function read(key: string): LogPoint[] {
  const raw = store.get(key)
  return raw ? (JSON.parse(raw) as LogPoint[]) : []
}

async function main() {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  process.env.KV_REST_API_URL = `http://127.0.0.1:${port}`
  process.env.KV_REST_API_TOKEN = 'local-stand-in'

  // Imported only after the env points at the stand-in, so the module's client
  // never resolves real credentials.
  const { recordPriceHistory, getPriceLog } = await import('@/lib/alert-store')
  const { assessPriceValidity } = await import('@/lib/price-validity')
  const { buildWatchlistQueries } = await import('@/lib/watchlist')

  // ── Seed: the one-way history production already holds ─────────────────────────
  // 71 points over 2026-07-11 .. 2026-08-15, mirroring the live HND-HAN log.
  const seeded: LogPoint[] = []
  const start = new Date('2026-07-11T00:00:00Z').getTime()
  for (let i = 0; i < 36 && seeded.length < 71; i++) {
    const d = new Date(start + i * DAY_MS).toISOString().slice(0, 10)
    for (const offset of [7, 30]) {
      if (seeded.length >= 71) break
      const dep = new Date(start + (i + offset) * DAY_MS).toISOString().slice(0, 10)
      seeded.push({ d, dep, p: 34_000 + ((i * 7 + offset) % 24) * 500 })
    }
  }
  store.set(OW_KEY, JSON.stringify(seeded))

  console.log('■ 1. 記録済みの片道データが、これまでどおり読めているか')
  check('片道ログの点数（種まき直後）', (await getPriceLog('HND', 'HAN')).length, 71)
  check('往復ログの点数（まだ空）', (await getPriceLog('HND', 'HAN', true)).length, 0)
  const owBefore = await assessPriceValidity('HND', 'HAN', 38_000)
  check('片道検索の帯が出る（点数は片道のみ）', owBefore?.sampleCount, 71)

  console.log('\n■ 2. 往復検索は、往復の記録が5点貯まるまで帯を出さない')
  check('往復検索の帯（記録0点）', await assessPriceValidity('HND', 'HAN', 80_000, '2026-08-29'), null)

  console.log('\n■ 3. 毎朝の自動観測が、片道と往復の両方を記録する')
  const days = ['2026-08-16', '2026-08-17', '2026-08-18']
  for (const day of days) {
    const now = new Date(`${day}T00:00:00Z`)
    const queries = buildWatchlistQueries(now)
    if (day === days[0]) {
      check('1日あたりの観測本数（2路線×2出発日×2種類）', queries.length, 8)
      check('うち往復の本数', queries.filter((q) => q.returnDate).length, 4)
      check(
        '往復1本目の日付（出発7日後 / 帰りはその7泊後）',
        [queries[1].departureDate, queries[1].returnDate],
        ['2026-08-23', '2026-08-30'],
      )
    }
    for (const q of queries) {
      // Round trips cost roughly twice a one-way, which is exactly why the two must
      // not share a distribution.
      const price = q.returnDate ? 78_000 + days.indexOf(day) * 900 : 38_000 + days.indexOf(day) * 400
      await recordPriceHistory(q.origin, q.destination, q.departureDate, price, now.toISOString(), q.returnDate)
    }
    const ow = read(OW_KEY).length
    const rt = read(RT_KEY).length
    console.log(`  ${day} 観測後 → 片道ログ ${ow}点 / 往復ログ ${rt}点`)
    if (rt === 4) {
      // The boundary that matters: 4 round-trip points must still say nothing,
      // even though the route has 75 one-way points sitting next to them.
      check('往復4点の時点では帯を出さない', await assessPriceValidity('HND', 'HAN', 80_000, '2026-08-29'), null)
    }
  }
  check('片道ログ（71点 + 3日×2点）', read(OW_KEY).length, 77)
  check('往復ログ（0点 + 3日×2点）', read(RT_KEY).length, 6)
  check('種まき分の最古の点が残っている', read(OW_KEY)[0].d, '2026-07-11')

  console.log('\n■ 4. 片道と往復が混ざっていないか')
  check('往復ログの全点が帰りの日付を持つ', read(RT_KEY).every((e) => typeof e.ret === 'string'), true)
  check('片道ログの全点が帰りの日付を持たない', read(OW_KEY).every((e) => e.ret === undefined), true)
  check('片道ログに往復の価格が入っていない', read(OW_KEY).some((e) => e.p > 60_000), false)

  console.log('\n■ 5. 5点貯まったあと、往復は往復だけを使って位置づけを出す')
  const rtNote = await assessPriceValidity('HND', 'HAN', 80_000, '2026-08-29')
  check('往復検索の帯の点数（往復ログの6点のみ）', rtNote?.sampleCount, 6)
  check('往復の帯が片道の71点を巻き込んでいない', rtNote != null && rtNote.sampleCount < 71, true)
  const owAfter = await assessPriceValidity('HND', 'HAN', 38_000)
  check('片道検索の帯の点数（片道ログの77点のみ）', owAfter?.sampleCount, 77)

  console.log('\n■ 6. 保存期限（前回の調査結果が変わっていないこと）')
  check('片道ログに保存期限が無い（-1）', ttls.get(OW_KEY) ?? -1, -1)
  check('往復ログに保存期限が無い（-1）', ttls.get(RT_KEY) ?? -1, -1)
  const depKey = [...store.keys()].find((k) => k.startsWith('pricehist:HND-HAN-'))
  check('出発日別キーは従来どおり期限つきで書かれている', typeof ttls.get(String(depKey)), 'number')

  console.log('\n' + '─'.repeat(60))
  console.log(failures === 0 ? '全項目 OK' : `NG が ${failures} 件`)
  server.close()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('検証スクリプトが落ちました:', err)
  server.close()
  process.exit(1)
})
