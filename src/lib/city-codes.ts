// Airport IATA → Travelpayouts city (metropolitan) IATA.
//
// Travelpayouts' data API is defined on CITIES, not airports: its own docs
// describe `origin`/`destination` as "IATA code of the departure/destination
// city" and use MOW (Moscow, whose airports are SVO/DME/VKO) as the example.
// Asking it about ICN or MXP returns nothing, because Seoul is SEL and Milan is
// MIL. That is what made 東京→ソウル and 東京→ミラノ come back empty on /asobi
// while 東京→セブ worked — Cebu's airport code and city code are both CEB.
//
// So: airport codes everywhere in the app (they are what the map, the labels and
// the booking links need), converted to city codes only at the Travelpayouts
// boundary.
//
// The list below is every differing code reachable from the app's own name
// tables (place resolution, IATA_JP_NAMES, COUNTRY_PREFERRED, the detour hubs),
// audited 2026-08-16. Codes not listed are already city codes, or belong to a
// city with a single airport where the two coincide.

const AIRPORT_TO_CITY: Record<string, string> = {
  // 日本
  HND: 'TYO', NRT: 'TYO',
  KIX: 'OSA', ITM: 'OSA',
  CTS: 'SPK',
  // 東アジア
  ICN: 'SEL', GMP: 'SEL',
  PEK: 'BJS', PKX: 'BJS',
  PVG: 'SHA',
  TSA: 'TPE',
  // 東南アジア
  DMK: 'BKK',
  CGK: 'JKT',
  // 中東
  IKA: 'THR',
  SAW: 'IST',
  // ヨーロッパ
  LHR: 'LON', LGW: 'LON', STN: 'LON',
  CDG: 'PAR', ORY: 'PAR',
  MXP: 'MIL', LIN: 'MIL', BGY: 'MIL',
  FCO: 'ROM', CIA: 'ROM',
  ARN: 'STO',
  OTP: 'BUH',
  SVO: 'MOW', DME: 'MOW', VKO: 'MOW',
  KBP: 'IEV',
  KEF: 'REK',
  // アフリカ
  CMN: 'CAS',
  // 北米
  JFK: 'NYC', EWR: 'NYC', LGA: 'NYC',
  ORD: 'CHI', MDW: 'CHI',
  IAD: 'WAS', DCA: 'WAS',
  YYZ: 'YTO',
  YUL: 'YMQ',
  // 南米
  GRU: 'SAO', CGH: 'SAO',
  GIG: 'RIO', SDU: 'RIO',
  EZE: 'BUE', AEP: 'BUE',
}

// Japanese label for a city code. Needed because a price fetched for TYO covers
// every Tokyo airport, so calling it「東京 羽田」on screen would overstate what the
// number means. Only the codes above need an entry.
const CITY_NAME_JA: Record<string, string> = {
  TYO: '東京', OSA: '大阪', SPK: '札幌',
  SEL: 'ソウル', BJS: '北京', SHA: '上海', TPE: '台北',
  BKK: 'バンコク', JKT: 'ジャカルタ',
  THR: 'テヘラン', IST: 'イスタンブール',
  LON: 'ロンドン', PAR: 'パリ', MIL: 'ミラノ', ROM: 'ローマ',
  STO: 'ストックホルム', BUH: 'ブカレスト', MOW: 'モスクワ',
  IEV: 'キーウ', REK: 'レイキャビク', CAS: 'カサブランカ',
  NYC: 'ニューヨーク', CHI: 'シカゴ', WAS: 'ワシントン',
  YTO: 'トロント', YMQ: 'モントリオール',
  SAO: 'サンパウロ', RIO: 'リオデジャネイロ', BUE: 'ブエノスアイレス',
}

/** The code Travelpayouts wants for this airport. Unchanged when they coincide. */
export function cityCodeOf(iata: string): string {
  const upper = iata.toUpperCase()
  return AIRPORT_TO_CITY[upper] ?? upper
}

/** True when the airport sits under a different city code. */
export function hasDistinctCityCode(iata: string): boolean {
  return iata.toUpperCase() in AIRPORT_TO_CITY
}

/**
 * Japanese label for the area a /asobi price actually covers, or null when the
 * airport is its own city and the usual airport label is already accurate.
 */
export function cityNameJaOf(iata: string): string | null {
  const upper = iata.toUpperCase()
  if (!(upper in AIRPORT_TO_CITY)) return null
  return CITY_NAME_JA[AIRPORT_TO_CITY[upper]] ?? null
}
