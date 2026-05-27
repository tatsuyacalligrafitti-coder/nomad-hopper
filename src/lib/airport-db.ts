// SERVER-ONLY: this file imports a ~600KB JSON and must never be bundled for the browser.
// Only import from API route handlers (src/app/api/**).

import airportData from '@/data/airports.json'

interface AirportRecord {
  iata: string
  name: string
  city: string
  country: string
}

const airports = airportData as AirportRecord[]

// ── Indexes built once at module load ────────────────────────────────────────

// city (lowercase) → best IATA (prefer name containing "International")
const cityIndex = new Map<string, string>()
// partial name search: sorted array for linear scan
const nameEntries: { lower: string; iata: string }[] = []
// country ISO → ordered IATA list (International airports first)
const countryIndex = new Map<string, string[]>()

for (const ap of airports) {
  const cityKey = ap.city.toLowerCase().trim()
  const isIntl = ap.name.toLowerCase().includes('international')

  // city index: overwrite with international airport if one exists
  if (!cityIndex.has(cityKey) || isIntl) {
    cityIndex.set(cityKey, ap.iata)
  }

  // name index
  nameEntries.push({ lower: ap.name.toLowerCase(), iata: ap.iata })

  // country index
  const list = countryIndex.get(ap.country) ?? []
  if (isIntl) list.unshift(ap.iata)
  else list.push(ap.iata)
  countryIndex.set(ap.country, list)
}

// ── Country name → ISO 2-letter code ─────────────────────────────────────────

const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  // ── アフリカ ────────────────────────────────────
  ケニア: 'KE',
  エジプト: 'EG',
  モロッコ: 'MA',
  南アフリカ: 'ZA',
  タンザニア: 'TZ',
  エチオピア: 'ET',
  ガーナ: 'GH',
  ナイジェリア: 'NG',
  // ── 東南アジア ──────────────────────────────────
  フィリピン: 'PH',
  ベトナム: 'VN',
  カンボジア: 'KH',
  ミャンマー: 'MM',
  ラオス: 'LA',
  ブルネイ: 'BN',
  // ── 南アジア ────────────────────────────────────
  インド: 'IN',
  パキスタン: 'PK',
  バングラデシュ: 'BD',
  スリランカ: 'LK',
  ネパール: 'NP',
  モルディブ: 'MV',
  // ── 中東 ────────────────────────────────────────
  サウジアラビア: 'SA',
  クウェート: 'KW',
  バーレーン: 'BH',
  オマーン: 'OM',
  ヨルダン: 'JO',
  イスラエル: 'IL',
  イラン: 'IR',
  // ── 欧州 ────────────────────────────────────────
  イギリス: 'GB',
  フランス: 'FR',
  ドイツ: 'DE',
  イタリア: 'IT',
  スペイン: 'ES',
  オランダ: 'NL',
  スイス: 'CH',
  オーストリア: 'AT',
  ベルギー: 'BE',
  ポルトガル: 'PT',
  スウェーデン: 'SE',
  ノルウェー: 'NO',
  デンマーク: 'DK',
  フィンランド: 'FI',
  ポーランド: 'PL',
  チェコ: 'CZ',
  ハンガリー: 'HU',
  ギリシャ: 'GR',
  クロアチア: 'HR',
  ルーマニア: 'RO',
  // ── 北米 ────────────────────────────────────────
  アメリカ: 'US',
  カナダ: 'CA',
  メキシコ: 'MX',
  // ── 中南米 ──────────────────────────────────────
  ブラジル: 'BR',
  アルゼンチン: 'AR',
  チリ: 'CL',
  ペルー: 'PE',
  コロンビア: 'CO',
  キューバ: 'CU',
  // ── オセアニア ──────────────────────────────────
  オーストラリア: 'AU',
  ニュージーランド: 'NZ',
  フィジー: 'FJ',
  // ── 中央アジア・東欧 ─────────────────────────────
  ロシア: 'RU',
  ウクライナ: 'UA',
  カザフスタン: 'KZ',
  ジョージア: 'GE',
  アルメニア: 'AM',
  アゼルバイジャン: 'AZ',
  // ── English country names ────────────────────────
  kenya: 'KE',
  egypt: 'EG',
  morocco: 'MA',
  'south africa': 'ZA',
  tanzania: 'TZ',
  ethiopia: 'ET',
  ghana: 'GH',
  nigeria: 'NG',
  philippines: 'PH',
  vietnam: 'VN',
  cambodia: 'KH',
  myanmar: 'MM',
  laos: 'LA',
  india: 'IN',
  pakistan: 'PK',
  bangladesh: 'BD',
  'sri lanka': 'LK',
  nepal: 'NP',
  maldives: 'MV',
  'saudi arabia': 'SA',
  kuwait: 'KW',
  bahrain: 'BH',
  oman: 'OM',
  jordan: 'JO',
  israel: 'IL',
  iran: 'IR',
  'united kingdom': 'GB',
  france: 'FR',
  germany: 'DE',
  italy: 'IT',
  spain: 'ES',
  netherlands: 'NL',
  switzerland: 'CH',
  austria: 'AT',
  belgium: 'BE',
  portugal: 'PT',
  sweden: 'SE',
  norway: 'NO',
  denmark: 'DK',
  finland: 'FI',
  poland: 'PL',
  'czech republic': 'CZ',
  hungary: 'HU',
  greece: 'GR',
  croatia: 'HR',
  romania: 'RO',
  'united states': 'US',
  usa: 'US',
  canada: 'CA',
  mexico: 'MX',
  brazil: 'BR',
  argentina: 'AR',
  chile: 'CL',
  peru: 'PE',
  colombia: 'CO',
  cuba: 'CU',
  australia: 'AU',
  'new zealand': 'NZ',
  fiji: 'FJ',
  russia: 'RU',
  ukraine: 'UA',
  kazakhstan: 'KZ',
  georgia: 'GE',
  armenia: 'AM',
  azerbaijan: 'AZ',
}

// ── Preferred IATA per country (overrides first-International heuristic) ──────
const COUNTRY_PREFERRED: Record<string, string> = {
  JP: 'HND', US: 'JFK', GB: 'LHR', FR: 'CDG', DE: 'FRA',
  NL: 'AMS', IT: 'FCO', ES: 'MAD', AU: 'SYD', CN: 'PEK',
  HK: 'HKG', TW: 'TPE', KR: 'ICN', TH: 'BKK', SG: 'SIN',
  MY: 'KUL', ID: 'CGK', PH: 'MNL', VN: 'SGN', KH: 'PNH',
  MM: 'RGN', LA: 'VTE', IN: 'DEL', PK: 'KHI', LK: 'CMB',
  NP: 'KTM', MV: 'MLE', AE: 'DXB', SA: 'RUH', QA: 'DOH',
  KW: 'KWI', BH: 'BAH', OM: 'MCT', JO: 'AMM', IL: 'TLV',
  TR: 'IST', KE: 'NBO', EG: 'CAI', MA: 'CMN', ZA: 'JNB',
  TZ: 'DAR', ET: 'ADD', NG: 'LOS', GH: 'ACC', CA: 'YYZ',
  MX: 'MEX', BR: 'GRU', AR: 'EZE', CL: 'SCL', PE: 'LIM',
  CO: 'BOG', CU: 'HAV', NZ: 'AKL', FJ: 'NAN', RU: 'SVO',
  UA: 'KBP', KZ: 'ALA', GE: 'TBS', AM: 'EVN', AZ: 'GYD',
  SE: 'ARN', NO: 'OSL', DK: 'CPH', FI: 'HEL', PL: 'WAW',
  CZ: 'PRG', HU: 'BUD', GR: 'ATH', HR: 'ZAG', PT: 'LIS',
  BE: 'BRU', CH: 'ZRH', AT: 'VIE',
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Tries to resolve a free-text fragment to an IATA airport code using the DB.
 * Returns null if no match found.
 *
 * Priority:
 * 1. City name exact match
 * 2. Airport name partial match
 * 3. Country name (Japanese or English) → preferred airport for that country
 */
export function resolveFromDB(fragment: string): string | null {
  const lower = fragment.trim().toLowerCase()
  if (!lower) return null

  // 1. City exact match
  if (cityIndex.has(lower)) return cityIndex.get(lower)!

  // 2. City substring match (e.g. "ho chi minh" within longer fragment)
  for (const [city, iata] of cityIndex) {
    if (city.length >= 3 && lower.includes(city)) return iata
  }

  // 3. Airport name partial match (scan for at least 4-char substring)
  if (lower.length >= 4) {
    for (const entry of nameEntries) {
      if (entry.lower.includes(lower)) return entry.iata
    }
  }

  // 4. Country name lookup
  const iso = COUNTRY_NAME_TO_ISO[lower] ?? COUNTRY_NAME_TO_ISO[fragment.trim()]
  if (iso) {
    return COUNTRY_PREFERRED[iso] ?? countryIndex.get(iso)?.[0] ?? null
  }

  return null
}
