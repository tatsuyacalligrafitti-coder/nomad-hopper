// SerpAPI booking_token フロー検証スクリプト
// 実行: npx ts-node --esm src/lib/serpapi-booking-test.ts
//   または: npx tsx src/lib/serpapi-booking-test.ts
export {}

const SERPAPI_KEY = process.env.SERPAPI_KEY
if (!SERPAPI_KEY) {
  console.error('ERROR: SERPAPI_KEY が設定されていません')
  process.exit(1)
}

const BASE = 'https://serpapi.com/search.json'

async function serpFetch(params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ ...params, api_key: SERPAPI_KEY! })
  const url = `${BASE}?${qs.toString()}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return res.json()
}

function printBookingOptions(options: any[]): void {
  if (!options || options.length === 0) {
    console.log('  booking_options: なし')
    return
  }
  options.forEach((opt: any, i: number) => {
    // SerpAPI は booking_options[i].together に実データをネスト
    const d = opt.together ?? opt
    console.log(`  [${i + 1}] book_with    : ${d.book_with ?? '(なし)'}`)
    console.log(`       price        : ${d.price != null ? `¥${d.price.toLocaleString()}` : '(なし)'}`)
    const marketed = (d.marketed_as ?? []).join(', ')
    console.log(`       marketed_as  : ${marketed || '(なし)'}`)
    const req = d.booking_request
    if (req) {
      console.log(`       booking_req url      : ${req.url ? req.url.slice(0, 80) : '(なし)'}`)
      console.log(`       booking_req post_data: ${req.post_data ? String(req.post_data).slice(0, 80) + '...' : '(なし)'}`)
    } else {
      console.log('       booking_request: なし')
    }
    // airline: true = 航空会社公式、false/undefined = OTA
    const isAirline = d.airline === true
    console.log(`       種別         : ${isAirline ? '航空会社公式' : 'OTA / 不明'}`)
    console.log()
  })
}

// ─────────────────────────────────────────────
// 往復テスト
// ─────────────────────────────────────────────
async function testRoundTrip(): Promise<void> {
  console.log('════════════════════════════════════════')
  console.log('【往復テスト】HND→OKA  往路:2026-06-23  復路:2026-06-25')
  console.log('════════════════════════════════════════\n')

  const baseParams = {
    engine: 'google_flights',
    departure_id: 'HND',
    arrival_id: 'OKA',
    outbound_date: '2026-06-23',
    return_date: '2026-06-25',
    type: '1',
    currency: 'JPY',
    hl: 'ja',
  }

  // Step 1: 初回検索
  console.log('--- Step 1: 初回検索 ---')
  const step1 = await serpFetch(baseParams)
  if (step1.error) { console.error('APIエラー:', step1.error); return }

  const best0 = step1.best_flights?.[0]
  if (!best0) { console.log('best_flights が空です。レスポンス:', JSON.stringify(step1, null, 2).slice(0, 1000)); return }

  const leg0 = best0.flights?.[0]
  console.log(`  航空会社: ${leg0?.airline ?? '?'}  便名: ${leg0?.flight_number ?? '?'}  価格: ¥${best0.price?.toLocaleString()}`)
  console.log(`  departure_token : ${best0.departure_token ? best0.departure_token.slice(0, 60) + '...' : '(なし)'}`)
  console.log(`  booking_token   : ${best0.booking_token   ? best0.booking_token.slice(0, 60) + '...'   : '(なし)'}`)

  // Step 2: departure_token で往路選択 → booking_token 取得
  if (!best0.departure_token) {
    console.log('\n  departure_token がないため Step 2 をスキップします')
    return
  }

  console.log('\n--- Step 2: departure_token で往路選択 ---')
  const step2 = await serpFetch({ ...baseParams, departure_token: best0.departure_token })
  if (step2.error) { console.error('APIエラー:', step2.error); return }

  const pair0 = step2.best_flights?.[0]
  if (!pair0) { console.log('往復ペアが見つかりません'); return }

  console.log(`  往復ペア取得: 価格 ¥${pair0.price?.toLocaleString()}`)
  console.log(`  booking_token: ${pair0.booking_token ? pair0.booking_token.slice(0, 60) + '...' : '(なし)'}`)

  if (!pair0.booking_token) { console.log('  booking_token がないため Step 3 をスキップ'); return }

  // Step 3: booking_token で booking_options 取得
  console.log('\n--- Step 3: booking_token で予約先取得 ---')
  const step3 = await serpFetch({ ...baseParams, booking_token: pair0.booking_token })
  if (step3.error) { console.error('APIエラー:', step3.error); return }

  const opts = step3.booking_options ?? step3.best_flights?.[0]?.booking_options ?? []
  console.log(`  booking_options 件数: ${opts.length}\n`)
  printBookingOptions(opts)
}

// ─────────────────────────────────────────────
// 片道テスト
// ─────────────────────────────────────────────
async function testOneWay(): Promise<void> {
  console.log('════════════════════════════════════════')
  console.log('【片道テスト】HND→OKA  2026-06-23')
  console.log('════════════════════════════════════════\n')

  const baseParams = {
    engine: 'google_flights',
    departure_id: 'HND',
    arrival_id: 'OKA',
    outbound_date: '2026-06-23',
    type: '2',
    currency: 'JPY',
    hl: 'ja',
  }

  // Step 4: 初回検索
  console.log('--- Step 4: 初回検索 ---')
  const step4 = await serpFetch(baseParams)
  if (step4.error) { console.error('APIエラー:', step4.error); return }

  const best0 = step4.best_flights?.[0]
  if (!best0) { console.log('best_flights が空です'); return }

  const leg0 = best0.flights?.[0]
  console.log(`  航空会社: ${leg0?.airline ?? '?'}  便名: ${leg0?.flight_number ?? '?'}  価格: ¥${best0.price?.toLocaleString()}`)
  console.log(`  booking_token: ${best0.booking_token ? best0.booking_token.slice(0, 60) + '...' : '(なし)'}`)

  if (!best0.booking_token) { console.log('  booking_token がないため Step 5 をスキップ'); return }

  // Step 5: booking_token で booking_options 取得
  console.log('\n--- Step 5: booking_token で予約先取得 ---')
  const step5 = await serpFetch({ ...baseParams, booking_token: best0.booking_token })
  if (step5.error) { console.error('APIエラー:', step5.error); return }

  const opts = step5.booking_options ?? step5.best_flights?.[0]?.booking_options ?? []
  console.log(`  booking_options 件数: ${opts.length}\n`)
  printBookingOptions(opts)
}

// ─────────────────────────────────────────────
// main
// ─────────────────────────────────────────────
;(async () => {
  try {
    await testRoundTrip()
    console.log()
    await testOneWay()
  } catch (err) {
    console.error('予期せぬエラー:', err)
    process.exit(1)
  }
})()
