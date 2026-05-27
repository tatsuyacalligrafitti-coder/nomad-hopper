import type { ParsedQuery } from '@/types'

const AIRPORT_MAP: Record<string, string> = {
  // ── 北海道 ──────────────────────────────
  北海道: 'CTS',
  札幌: 'CTS',
  新千歳: 'CTS',
  千歳: 'CTS',
  旭川: 'AKJ',
  函館: 'HKD',
  釧路: 'KUH',
  帯広: 'OBO',
  稚内: 'WKJ',
  // ── 東北 ────────────────────────────────
  青森: 'AOJ',
  秋田: 'AXT',
  岩手: 'HNA',
  花巻: 'HNA',
  仙台: 'SDJ',
  山形: 'GAJ',
  福島: 'FKS',
  // ── 関東 ────────────────────────────────
  東京: 'HND',
  羽田: 'HND',
  成田: 'NRT',
  茨城: 'IBR',
  // ── 信越・北陸 ──────────────────────────
  新潟: 'KIJ',
  富山: 'TOY',
  小松: 'KMQ',
  金沢: 'KMQ',
  石川: 'KMQ',
  松本: 'MMJ',
  // ── 東海 ────────────────────────────────
  静岡: 'FSZ',
  名古屋: 'NGO',
  中部: 'NGO',
  セントレア: 'NGO',
  // ── 近畿 ────────────────────────────────
  大阪: 'KIX',
  関西: 'KIX',
  伊丹: 'ITM',
  神戸: 'UKB',
  // ── 中国・四国 ──────────────────────────
  鳥取: 'TTJ',
  米子: 'YGJ',
  岡山: 'OKJ',
  広島: 'HIJ',
  山口: 'UBJ',
  宇部: 'UBJ',
  高松: 'TAK',
  松山: 'MYJ',
  高知: 'KCZ',
  徳島: 'TKS',
  // ── 九州 ────────────────────────────────
  北九州: 'KKJ',
  福岡: 'FUK',
  佐賀: 'HSG',
  長崎: 'NGS',
  熊本: 'KMJ',
  大分: 'OIT',
  宮崎: 'KMI',
  鹿児島: 'KOJ',
  奄美: 'ASJ',
  // ── 沖縄 ────────────────────────────────
  沖縄: 'OKA',
  那覇: 'OKA',
  石垣: 'ISG',
  宮古: 'MMY',
  // ── 東アジア ────────────────────────────
  ソウル: 'ICN',
  仁川: 'ICN',
  金浦: 'GMP',
  釜山: 'PUS',
  台北: 'TPE',
  台湾: 'TPE',
  高雄: 'KHH',
  香港: 'HKG',
  上海: 'PVG',
  浦東: 'PVG',
  北京: 'PEK',
  広州: 'CAN',
  成都: 'CTU',
  重慶: 'CKG',
  深圳: 'SZX',
  // ── 東南アジア ──────────────────────────
  バンコク: 'BKK',
  スワンナプーム: 'BKK',
  ドンムアン: 'DMK',
  プーケット: 'HKT',
  チェンマイ: 'CNX',
  シンガポール: 'SIN',
  クアラルンプール: 'KUL',
  ペナン: 'PEN',
  バリ: 'DPS',
  デンパサール: 'DPS',
  ジャカルタ: 'CGK',
  マニラ: 'MNL',
  セブ: 'CEB',
  ハノイ: 'HAN',
  ホーチミン: 'SGN',
  サイゴン: 'SGN',
  ダナン: 'DAD',
  ヤンゴン: 'RGN',
  // ── 南アジア ────────────────────────────
  デリー: 'DEL',
  ムンバイ: 'BOM',
  コロンボ: 'CMB',
  カトマンズ: 'KTM',
  // ── 中東 ────────────────────────────────
  ドバイ: 'DXB',
  アブダビ: 'AUH',
  カタール: 'DOH',
  ドーハ: 'DOH',
  イスタンブール: 'IST',
  テルアビブ: 'TLV',
  // ── 欧州 ────────────────────────────────
  ロンドン: 'LHR',
  ヒースロー: 'LHR',
  ガトウィック: 'LGW',
  パリ: 'CDG',
  シャルルドゴール: 'CDG',
  アムステルダム: 'AMS',
  フランクフルト: 'FRA',
  ミュンヘン: 'MUC',
  ローマ: 'FCO',
  バルセロナ: 'BCN',
  マドリッド: 'MAD',
  チューリッヒ: 'ZRH',
  ウィーン: 'VIE',
  ヘルシンキ: 'HEL',
  コペンハーゲン: 'CPH',
  ストックホルム: 'ARN',
  プラハ: 'PRG',
  ワルシャワ: 'WAW',
  // ── 北米 ────────────────────────────────
  ニューヨーク: 'JFK',
  ロサンゼルス: 'LAX',
  サンフランシスコ: 'SFO',
  シアトル: 'SEA',
  シカゴ: 'ORD',
  ダラス: 'DFW',
  マイアミ: 'MIA',
  ボストン: 'BOS',
  ワシントン: 'IAD',
  バンクーバー: 'YVR',
  トロント: 'YYZ',
  // ── 太平洋 ──────────────────────────────
  ホノルル: 'HNL',
  ハワイ: 'HNL',
  グアム: 'GUM',
  サイパン: 'SPN',
  パラオ: 'ROR',
  // ── オセアニア ──────────────────────────
  シドニー: 'SYD',
  メルボルン: 'MEL',
  ブリスベン: 'BNE',
  オークランド: 'AKL',
  // ── アフリカ ─────────────────────────────
  ナイロビ: 'NBO',
  モンバサ: 'MBA',
  カイロ: 'CAI',
  ヨハネスブルグ: 'JNB',
  ケープタウン: 'CPT',
  ダルエスサラーム: 'DAR',
  アディスアベバ: 'ADD',
  ラゴス: 'LOS',
  アクラ: 'ACC',
  カサブランカ: 'CMN',
  // ── 中東補足 ─────────────────────────────
  リヤド: 'RUH',
  ジェッダ: 'JED',
  マスカット: 'MCT',
  アンマン: 'AMM',
  // ── 南米・中米 ────────────────────────────
  サンパウロ: 'GRU',
  リオデジャネイロ: 'GIG',
  ブエノスアイレス: 'EZE',
  リマ: 'LIM',
  サンティアゴ: 'SCL',
  ボゴタ: 'BOG',
  ハバナ: 'HAV',
  // ── 東欧・中央アジア補足 ──────────────────
  モスクワ: 'SVO',
  キーウ: 'KBP',
  アルマティ: 'ALA',
  トビリシ: 'TBS',
  エレバン: 'EVN',
  バクー: 'GYD',
  // ── 英語エイリアス ──────────────────────
  tokyo: 'HND',
  haneda: 'HND',
  narita: 'NRT',
  osaka: 'KIX',
  kansai: 'KIX',
  itami: 'ITM',
  nagoya: 'NGO',
  sapporo: 'CTS',
  chitose: 'CTS',
  fukuoka: 'FUK',
  okinawa: 'OKA',
  naha: 'OKA',
  ishigaki: 'ISG',
  sendai: 'SDJ',
  hiroshima: 'HIJ',
  bangkok: 'BKK',
  phuket: 'HKT',
  seoul: 'ICN',
  taipei: 'TPE',
  'hong kong': 'HKG',
  shanghai: 'PVG',
  beijing: 'PEK',
  singapore: 'SIN',
  'kuala lumpur': 'KUL',
  bali: 'DPS',
  jakarta: 'CGK',
  manila: 'MNL',
  hanoi: 'HAN',
  'ho chi minh': 'SGN',
  danang: 'DAD',
  london: 'LHR',
  paris: 'CDG',
  amsterdam: 'AMS',
  frankfurt: 'FRA',
  munich: 'MUC',
  rome: 'FCO',
  barcelona: 'BCN',
  madrid: 'MAD',
  dubai: 'DXB',
  istanbul: 'IST',
  'new york': 'JFK',
  'los angeles': 'LAX',
  'san francisco': 'SFO',
  seattle: 'SEA',
  chicago: 'ORD',
  honolulu: 'HNL',
  hawaii: 'HNL',
  guam: 'GUM',
  sydney: 'SYD',
  melbourne: 'MEL',
}

// Pre-sorted once: longest key first so "新千歳" wins over "千歳"
const SORTED_ENTRIES = Object.entries(AIRPORT_MAP).sort(
  ([a], [b]) => b.length - a.length
)

// Separators tried in order.
// " to " (with spaces) avoids matching "to" inside "tokyo".
const ROUTE_SEPARATORS = ['から', '→', '->', '⇒', '〜', '~', '発', ' to ']

function resolveAirport(fragment: string): string | null {
  const trimmed = fragment.trim()
  if (!trimmed) return null

  // 1. Bare IATA code already in the fragment (e.g. "HND", "(BKK)")
  const iataMatch = trimmed.match(/\b([A-Z]{3})\b/)
  if (iataMatch) return iataMatch[1]

  const lower = trimmed.toLowerCase()

  // 2. Exact key hit (fast path — handles "沖縄", "東京" directly)
  if (AIRPORT_MAP[trimmed]) return AIRPORT_MAP[trimmed]
  if (AIRPORT_MAP[lower]) return AIRPORT_MAP[lower]

  // 3. Substring search: fragment may contain city + date/passengers text
  for (const [key, code] of SORTED_ENTRIES) {
    if (lower.includes(key.toLowerCase())) return code
  }

  return null
}

function parseDate(text: string): string | null {
  const today = new Date()
  const year = today.getFullYear()

  // "12月25日" or "12月25"
  const jpDate = text.match(/(\d{1,2})月(\d{1,2})日?/)
  if (jpDate) {
    const m = jpDate[1].padStart(2, '0')
    const d = jpDate[2].padStart(2, '0')
    const candidate = new Date(`${year}-${m}-${d}`)
    if (candidate < today) candidate.setFullYear(year + 1)
    return candidate.toISOString().split('T')[0]
  }

  // "12/25" or "12-25" (not ISO yyyy-mm-dd)
  const slashDate = text.match(/(\d{1,2})[\/\-](\d{1,2})(?!\d)/)
  if (slashDate) {
    const m = slashDate[1].padStart(2, '0')
    const d = slashDate[2].padStart(2, '0')
    const candidate = new Date(`${year}-${m}-${d}`)
    if (candidate < today) candidate.setFullYear(year + 1)
    return candidate.toISOString().split('T')[0]
  }

  const daysLater = text.match(/(\d+)\s*日後/)
  if (daysLater) {
    const future = new Date(today)
    future.setDate(future.getDate() + parseInt(daysLater[1]))
    return future.toISOString().split('T')[0]
  }

  const weeksLater = text.match(/(\d+)\s*週間?後/)
  if (weeksLater) {
    const future = new Date(today)
    future.setDate(future.getDate() + parseInt(weeksLater[1]) * 7)
    return future.toISOString().split('T')[0]
  }

  if (text.includes('来週')) {
    const future = new Date(today)
    future.setDate(future.getDate() + 7)
    return future.toISOString().split('T')[0]
  }

  if (text.includes('来月')) {
    const future = new Date(today)
    future.setMonth(future.getMonth() + 1)
    return future.toISOString().split('T')[0]
  }

  if (text.includes('今週末')) {
    const future = new Date(today)
    future.setDate(future.getDate() + ((6 - future.getDay() + 7) % 7 || 7))
    return future.toISOString().split('T')[0]
  }

  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return isoMatch[0]

  return null
}

function parseCabinClass(text: string): ParsedQuery['cabinClass'] {
  if (/ビジネス|business\s*class/i.test(text)) return 'business'
  if (/ファースト|first\s*class/i.test(text)) return 'first'
  if (/プレミアムエコノミー|premium[\s_]?economy/i.test(text)) return 'premium_economy'
  return 'economy'
}

function parsePassengers(text: string): number {
  const match = text.match(/(\d+)\s*(人|名|pax|passengers?)/i)
  if (match) return Math.min(Math.max(parseInt(match[1]), 1), 9)
  return 1
}

export function parseSearchQuery(rawQuery: string): ParsedQuery {
  const text = rawQuery.trim()

  let origin: string | null = null
  let destination: string | null = null

  // ── Step 1: Split on separator (indexOf — no regex, no ambiguity) ──────────
  // Each separator is tried in order; the first one found that yields
  // at least one non-empty part on each side wins.
  for (const sep of ROUTE_SEPARATORS) {
    const idx = text.indexOf(sep)
    // separator must exist and have text before it (idx > 0)
    if (idx <= 0) continue

    const beforeSep = text.slice(0, idx).trim()
    const afterSep = text.slice(idx + sep.length).trim()

    if (!beforeSep || !afterSep) continue

    origin = resolveAirport(beforeSep)
    destination = resolveAirport(afterSep)

    // Accept as long as at least one side resolved; the other may resolve
    // later in Step 2 via the full-text scan.
    if (origin !== null || destination !== null) break
  }

  // ── Step 2: Scan full text for known city/airport names ───────────────────
  // Runs if either side is still missing after Step 1.
  if (!origin || !destination) {
    const lower = text.toLowerCase()

    // Collect (position, code) pairs; deduplicate by code (e.g. 沖縄 & 那覇 both = OKA)
    const hits: Array<{ index: number; code: string }> = []
    for (const [key, code] of SORTED_ENTRIES) {
      const idx = lower.indexOf(key.toLowerCase())
      if (idx === -1) continue
      if (hits.some((h) => h.code === code)) continue
      hits.push({ index: idx, code })
    }

    // Sort by appearance in text: first city = origin, second = destination
    hits.sort((a, b) => a.index - b.index)

    if (!origin && hits.length >= 1) origin = hits[0].code
    if (!destination && hits.length >= 2) destination = hits[1].code
    if (!origin && !destination && hits.length === 1) destination = hits[0].code
  }

  // ── Step 3: Parse dates ────────────────────────────────────────────────────
  const tokens = text.split(/[\s、。，,.]+/)
  let departureDate: string | null = parseDate(text) // try full text first
  let returnDate: string | null = null

  for (const token of tokens) {
    const d = parseDate(token)
    if (!d) continue
    if (!departureDate) { departureDate = d; continue }
    if (d !== departureDate && !returnDate) returnDate = d
  }

  return {
    origin,
    destination,
    departureDate,
    returnDate,
    passengers: parsePassengers(text),
    cabinClass: parseCabinClass(text),
  }
}
