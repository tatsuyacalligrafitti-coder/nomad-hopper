// SERVER-ONLY: pulls in airport-db, which loads a ~600KB JSON.
//
// Free text → IATA airport code. Steps 1–5 are a verbatim move from
// src/app/api/parse-query/route.ts (2026-08-16) so /asobi resolves places the
// same way the main search does; keeping two resolvers meant the same words
// produced different airports ("東京" → HND on the top page, TYO on /asobi).
// The order of those steps is load-bearing and was not changed in the move.
//
// Step 6 is new. It holds the names that only /asobi's old private table knew,
// and it runs LAST on purpose: a name the existing chain already resolves never
// reaches it, so migrating those names cannot change any answer the main search
// gives today. It can only add answers where there were none.

import { parseSearchQuery, resolveAirport } from '@/lib/parser'
import { resolveFromDB } from '@/lib/airport-db'
import { IATA_JP_NAMES } from '@/lib/iata-names'

// Inverse lookup: Japanese city name → IATA code, sorted by name length desc
// so longer names (e.g. "東京 羽田") are matched before shorter prefixes ("東京").
const JP_TO_IATA: Array<[string, string]> = Object.entries(IATA_JP_NAMES)
  .map(([iata, jp]) => [jp, iata] as [string, string])
  .sort((a, b) => b[0].length - a[0].length)

// Country name → main gateway airport (for inputs like "ケニア", "フィリピン")
const JP_COUNTRY_IATA: Record<string, string> = {
  'ケニア': 'NBO', 'フィリピン': 'MNL', 'タイ': 'BKK', 'インドネシア': 'CGK',
  'マレーシア': 'KUL', 'ベトナム': 'SGN', 'カンボジア': 'PNH', 'ミャンマー': 'RGN',
  'インド': 'DEL', 'スリランカ': 'CMB', 'ネパール': 'KTM', 'モルディブ': 'MLE',
  'エジプト': 'CAI', 'モロッコ': 'CMN', 'エチオピア': 'ADD',
  '南アフリカ': 'JNB', 'タンザニア': 'DAR', 'ガーナ': 'ACC', 'ナイジェリア': 'LOS',
  '中国': 'PEK', '韓国': 'ICN', '台湾': 'TPE',
  'トルコ': 'IST', 'ギリシャ': 'ATH', 'ポルトガル': 'LIS',
  'オーストラリア': 'SYD', 'ニュージーランド': 'AKL',
  'カナダ': 'YVR', 'メキシコ': 'MEX', 'ブラジル': 'GRU', 'アルゼンチン': 'EZE',
  'ペルー': 'LIM', 'コロンビア': 'BOG',
  // Popular city aliases
  'バリ島': 'DPS', 'バリ': 'DPS',
  'ハワイ': 'HNL', 'ホノルル': 'HNL',
  'ミラノ': 'MXP',
  'バルセロナ': 'BCN',
  'アムステルダム': 'AMS',
  'フランクフルト': 'FRA',
  'イスタンブール': 'IST',
  'クアラルンプール': 'KUL', 'KL': 'KUL',
  'ホーチミン': 'SGN', 'サイゴン': 'SGN',
  'ハノイ': 'HAN',
  'ジャカルタ': 'CGK',
  'マニラ': 'MNL',
  'ケアンズ': 'CNS',
  'シドニー': 'SYD',
  'メルボルン': 'MEL',
}

// Step 6 — see the header. Migrated from the retired src/lib/place-names-ja.ts.
//
// Every one of the 294 names in that table was run through steps 1–5 against the
// live resolver on 2026-08-16. Of those, 203 already agreed, 12 resolved to a
// different airport (left alone — the existing answer wins), and these 79 came
// back empty. Only the empty ones are here, which is why adding them cannot
// change any answer the main search gives today.
//
// Airport codes throughout, matching what steps 1–5 return; the conversion to
// Travelpayouts' city codes happens at that API's boundary (src/lib/city-codes.ts).
const JP_LAST_RESORT: Record<string, string> = {
  // 日本
  'とうきょう': 'HND', 'おおさか': 'KIX', 'なごや': 'NGO',
  'ふくおか': 'FUK', '博多': 'FUK', 'さっぽろ': 'CTS', 'おきなわ': 'OKA',
  // 東アジア
  'ホンコン': 'HKG', 'マカオ': 'MFM', 'シャンハイ': 'PVG', 'ペキン': 'PEK',
  '西安': 'XIY', 'ウランバートル': 'ULN', 'モンゴル': 'ULN',
  // 南アジア・中央アジア
  'ベンガルール': 'BLR', 'コルカタ': 'CCU', 'マーレ': 'MLE', 'ダッカ': 'DAC',
  'カラチ': 'KHI', 'イスラマバード': 'ISB', 'テヘラン': 'IKA',
  'アルマトイ': 'ALA', 'タシケント': 'TAS', 'ウズベキスタン': 'TAS',
  // ヨーロッパ
  '英国': 'LHR', 'マンチェスター': 'MAN', 'エディンバラ': 'EDI',
  'ダブリン': 'DUB', 'アイルランド': 'DUB',
  'ベネチア': 'VCE', 'ナポリ': 'NAP', 'マラガ': 'AGP', 'ポルト': 'OPO',
  'クラクフ': 'KRK', 'ブカレスト': 'OTP', 'ベオグラード': 'BEG',
  'レイキャビク': 'KEF', 'アイスランド': 'KEF',
  'リガ': 'RIX', 'ラトビア': 'RIX', 'タリン': 'TLL', 'エストニア': 'TLL',
  'ビリニュス': 'VNO', 'リトアニア': 'VNO', 'キエフ': 'KBP',
  // アフリカ
  'マラケシュ': 'RAK', 'チュニス': 'TUN', 'チュニジア': 'TUN',
  'ヨハネスブルク': 'JNB', 'ダカール': 'DKR', 'セネガル': 'DKR',
  'モーリシャス': 'MRU', 'マダガスカル': 'TNR',
  // 北米・中米
  '米国': 'JFK', 'ロス': 'LAX', 'ヒューストン': 'IAH', 'アトランタ': 'ATL',
  'デンバー': 'DEN', 'サンディエゴ': 'SAN', 'ポートランド': 'PDX',
  'アンカレジ': 'ANC', 'カルガリー': 'YYC', 'カンクン': 'CUN',
  'グアダラハラ': 'GDL', 'パナマ': 'PTY', 'パナマシティ': 'PTY',
  'サンホセ': 'SJO', 'コスタリカ': 'SJO',
  // 南米
  'キト': 'UIO', 'エクアドル': 'UIO', 'モンテビデオ': 'MVD', 'ウルグアイ': 'MVD',
  'ラパス': 'LPB', 'ボリビア': 'LPB',
  // オセアニア
  'アデレード': 'ADL', 'クイーンズタウン': 'ZQN', 'ナンディ': 'NAN',
  'ポートモレスビー': 'POM', 'パプアニューギニア': 'POM',
}

/** Steps 1–5: unchanged from the original implementation. */
function resolveExisting(trimmed: string): string | null {
  // 1. Full airport DB (English city/airport names, bare IATA codes)
  const fromDB = resolveFromDB(trimmed)
  if (fromDB) return fromDB

  // 1.5. Country name shorthand (e.g. "ケニア" → NBO, "フィリピン" → MNL)
  const fromCountry = JP_COUNTRY_IATA[trimmed]
  if (fromCountry) return fromCountry

  // 2. Japanese name — exact match (resolves "ミラノ" → MXP, "ナイロビ" → NBO, etc.)
  for (const [jp, iata] of JP_TO_IATA) {
    if (trimmed === jp) return iata
  }

  // 3. Japanese name — partial match (fragment contains jp name, or jp name starts with fragment)
  for (const [jp, iata] of JP_TO_IATA) {
    if (trimmed.includes(jp) || jp.startsWith(trimmed)) return iata
  }

  // 4. AIRPORT_MAP lightweight parser (handles common Japanese city names)
  const p = parseSearchQuery(trimmed)
  const code = p.origin ?? p.destination
  if (code) return code

  // 5. Phonetic/fuzzy fallback
  return resolveAirport(trimmed)
}

/** Resolve a free-text city fragment to an IATA code. */
export function resolveCity(fragment: string): string | null {
  const trimmed = fragment.trim()
  if (!trimmed) return null

  const existing = resolveExisting(trimmed)
  if (existing) return existing

  // 6. Names inherited from /asobi's retired table. Reached only when every
  //    step above came back empty, so this cannot override an existing answer.
  return JP_LAST_RESORT[trimmed] ?? JP_LAST_RESORT[trimmed.replace(/\s+/g, '')] ?? null
}

/** Exposed for the migration audit only: what steps 1–5 alone would answer. */
export function resolveCityExistingOnly(fragment: string): string | null {
  const trimmed = fragment.trim()
  return trimmed ? resolveExisting(trimmed) : null
}
