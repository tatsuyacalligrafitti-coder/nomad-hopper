// ─── Demand calendar ─────────────────────────────────────────────────────────
// A data asset describing when travel demand rises on each SIDE of an international
// route — the Japan side AND the counterpart country side — so price levels can be
// explained by real-world demand (holidays, diaspora returns, seasons) rather than
// guessed at. This module is DATA + PURE JUDGEMENT ONLY. It is deliberately not
// wired to any UI or API in this change; a later PR connects it.
//
// Trust model (important): only entries marked `verified: true` are used by the
// judgement functions. `verified: false` rows are candidates awaiting a human check
// against a primary source — they are ignored until someone confirms them, fills in
// sourceUrl/verifiedAt, and flips the flag. See docs/demand-calendar-review.md.

export type Country = 'JP' | 'PH' | 'VN' | 'KE'

export type DemandIntensity = 'high' | 'medium' | 'low'

// outbound = demand to leave this country rises (its residents travel out)
// inbound  = demand to enter this country rises (people fly in)
// both     = demand moves in both directions
export type DemandDirection = 'outbound' | 'inbound' | 'both'

export interface DemandPeriod {
  country: Country
  name: string          // Japanese label (e.g. お盆, テト, OFWクリスマス帰国)
  nameLocal?: string    // local/English name
  start: string         // YYYY-MM-DD
  end: string           // YYYY-MM-DD (inclusive)
  intensity: DemandIntensity
  direction: DemandDirection
  reason: string        // who moves and how, 1–2 sentences (Japanese)
  sourceUrl: string     // primary source URL ('' if unknown)
  verified: boolean     // confirmed against a primary source?
  verifiedAt: string    // YYYY-MM-DD ('' if unverified)
}

// Date this batch of calendar-fixed entries was asserted. Fixed public holidays /
// customary fixed dates need no external URL — the calendar itself is the source.
const ASSERTED_ON = '2026-07-22'

// ─── Calendar data (2026-01-01 〜 2027-12-31) ─────────────────────────────────
// verified: true  → determined by the Gregorian calendar or fixed-date holiday law.
// verified: false → moves yearly (lunar/Easter/Islamic), or is a seasonal/estimated
//                   window. MUST be confirmed by a human before use (stays ignored).
export const DEMAND_PERIODS: DemandPeriod[] = [
  // ── JP: departure side (Japanese residents travelling out) ──────────────────
  {
    country: 'JP',
    name: '年始',
    nameLocal: 'New Year holidays',
    start: '2026-01-01',
    end: '2026-01-03',
    intensity: 'high',
    direction: 'outbound',
    reason: '元日を含む三が日。年末年始休暇の日本人旅行者が海外へ出るため、日本発の座席需要が高まる。',
    sourceUrl: '',
    verified: true,
    verifiedAt: ASSERTED_ON,
  },
  {
    country: 'JP',
    name: 'ゴールデンウィーク',
    nameLocal: 'Golden Week',
    start: '2026-04-29',
    end: '2026-05-06',
    intensity: 'high',
    direction: 'outbound',
    reason: '昭和の日・憲法記念日・みどりの日・こどもの日が並ぶ大型連休。日本人の海外旅行が集中し、日本発の航空需要がピークになる。',
    sourceUrl: '',
    verified: true,
    verifiedAt: ASSERTED_ON,
  },
  {
    country: 'JP',
    name: 'お盆',
    nameLocal: 'Obon',
    start: '2026-08-13',
    end: '2026-08-16',
    intensity: 'high',
    direction: 'outbound',
    reason: '夏季最大の帰省・旅行シーズン。日本人の海外旅行と帰省移動が重なり、日本発の座席在庫が逼迫する。',
    sourceUrl: '',
    verified: true,
    verifiedAt: ASSERTED_ON,
  },
  {
    country: 'JP',
    name: '年末年始',
    nameLocal: 'Year-end and New Year holidays',
    start: '2026-12-29',
    end: '2027-01-03',
    intensity: 'high',
    direction: 'outbound',
    reason: '行政機関の休日（12/29〜1/3）を軸とした最大級の連休。日本人旅行者が一斉に海外へ出るため、日本発の需要が急増する。',
    sourceUrl: '',
    verified: true,
    verifiedAt: ASSERTED_ON,
  },
  {
    country: 'JP',
    name: 'ゴールデンウィーク',
    nameLocal: 'Golden Week',
    start: '2027-04-29',
    end: '2027-05-05',
    intensity: 'high',
    direction: 'outbound',
    reason: '祝日が連続する大型連休。日本人の海外旅行が集中し、日本発の航空需要がピークになる。',
    sourceUrl: '',
    verified: true,
    verifiedAt: ASSERTED_ON,
  },
  {
    country: 'JP',
    name: 'お盆',
    nameLocal: 'Obon',
    start: '2027-08-13',
    end: '2027-08-16',
    intensity: 'high',
    direction: 'outbound',
    reason: '夏季最大の帰省・旅行シーズン。日本人の海外旅行と帰省移動が重なり、日本発の座席在庫が逼迫する。',
    sourceUrl: '',
    verified: true,
    verifiedAt: ASSERTED_ON,
  },
  // JP — candidates needing review (year-variable / estimated windows)
  {
    country: 'JP',
    name: 'シルバーウィーク',
    nameLocal: 'Silver Week',
    start: '2026-09-19',
    end: '2026-09-23',
    intensity: 'medium',
    direction: 'outbound',
    reason: '敬老の日と秋分の日が近接する年の秋の連休。日本人の短中距離の海外旅行需要が高まる。秋分の日は天文計算で決まり連休成立が年により変動するため要確認。',
    sourceUrl: '',
    verified: false,
    verifiedAt: '',
  },
  {
    country: 'JP',
    name: '学校夏休み',
    nameLocal: 'School summer break',
    start: '2026-07-21',
    end: '2026-08-31',
    intensity: 'medium',
    direction: 'outbound',
    reason: '小中高の夏季休暇。家族連れの日本人旅行者が海外へ出る需要が続く。地域・学校で期間が異なるため要確認。',
    sourceUrl: '',
    verified: false,
    verifiedAt: '',
  },
  {
    country: 'JP',
    name: '春休み',
    nameLocal: 'School spring break',
    start: '2026-03-25',
    end: '2026-04-05',
    intensity: 'medium',
    direction: 'outbound',
    reason: '学年末の春季休暇。学生・家族連れの日本人旅行需要が高まる。期間は学校により異なるため要確認。',
    sourceUrl: '',
    verified: false,
    verifiedAt: '',
  },

  // ── PH: OFW returns, Holy Week, dry/wet season ──────────────────────────────
  {
    country: 'PH',
    name: 'OFWクリスマス帰国',
    nameLocal: 'OFW Christmas homecoming',
    start: '2026-12-01',
    end: '2027-01-06',
    intensity: 'high',
    direction: 'inbound',
    reason: '世界中で働くフィリピン人（OFW）がクリスマス〜公現祭にかけて一斉帰国するため、フィリピン着の座席在庫が逼迫し運賃が上がる。期間は帰省の実態に基づく推定のため要確認。',
    sourceUrl: '',
    verified: false,
    verifiedAt: '',
  },
  {
    country: 'PH',
    name: 'ホーリーウィーク',
    nameLocal: 'Holy Week (Semana Santa)',
    start: '2026-03-29',
    end: '2026-04-05',
    intensity: 'high',
    direction: 'both',
    reason: 'カトリック国フィリピン最大の宗教連休。フィリピン人の国内外への旅行と、在外フィリピン人の帰省が重なる。イースター基準で毎年日付が動くため要確認。',
    sourceUrl: '',
    verified: false,
    verifiedAt: '',
  },
  {
    country: 'PH',
    name: 'ホーリーウィーク',
    nameLocal: 'Holy Week (Semana Santa)',
    start: '2027-03-21',
    end: '2027-03-28',
    intensity: 'high',
    direction: 'both',
    reason: 'カトリック国フィリピン最大の宗教連休。フィリピン人の国内外への旅行と、在外フィリピン人の帰省が重なる。イースター基準で毎年日付が動くため要確認。',
    sourceUrl: '',
    verified: false,
    verifiedAt: '',
  },
  {
    country: 'PH',
    name: '乾季（観光ハイシーズン）',
    nameLocal: 'Dry season',
    start: '2026-11-01',
    end: '2027-04-30',
    intensity: 'medium',
    direction: 'inbound',
    reason: '天候が安定する乾季はビーチ観光の最盛期で、フィリピンへ入る外国人旅行者の需要が高まる。気候に基づく推定期間のため要確認。',
    sourceUrl: '',
    verified: false,
    verifiedAt: '',
  },
  {
    country: 'PH',
    name: '雨季',
    nameLocal: 'Wet season',
    start: '2026-06-01',
    end: '2026-10-31',
    intensity: 'low',
    direction: 'inbound',
    reason: '台風・雨の多い雨季は観光需要が落ち、フィリピンへ入る旅行需要が弱まる。気候に基づく推定期間のため要確認。',
    sourceUrl: '',
    verified: false,
    verifiedAt: '',
  },

  // ── VN: Tet, Reunification+Labour, summer break, seasons ────────────────────
  {
    country: 'VN',
    name: 'テト（旧正月）',
    nameLocal: 'Tết Nguyên Đán (Lunar New Year)',
    start: '2026-02-14',
    end: '2026-02-22',
    intensity: 'high',
    direction: 'both',
    reason: 'ベトナム最大の祝祭。ベトナム人の帰省・国内外旅行と、在外ベトナム人の帰国が重なり、双方向で需要が急増する。旧暦基準で毎年日付が動くため要確認。',
    sourceUrl: '',
    verified: false,
    verifiedAt: '',
  },
  {
    country: 'VN',
    name: 'テト（旧正月）',
    nameLocal: 'Tết Nguyên Đán (Lunar New Year)',
    start: '2027-02-03',
    end: '2027-02-11',
    intensity: 'high',
    direction: 'both',
    reason: 'ベトナム最大の祝祭。ベトナム人の帰省・国内外旅行と、在外ベトナム人の帰国が重なり、双方向で需要が急増する。旧暦基準で毎年日付が動くため要確認。',
    sourceUrl: '',
    verified: false,
    verifiedAt: '',
  },
  {
    country: 'VN',
    name: '統一記念日〜メーデー連休',
    nameLocal: 'Reunification Day & Labour Day',
    start: '2026-04-30',
    end: '2026-05-03',
    intensity: 'high',
    direction: 'both',
    reason: '統一記念日（4/30）とメーデー（5/1）が並ぶ大型連休。ベトナム人の国内外旅行が集中する。祝日は固定だが橋渡し連休の範囲が年により変動するため要確認。',
    sourceUrl: '',
    verified: false,
    verifiedAt: '',
  },
  {
    country: 'VN',
    name: '学校夏休み',
    nameLocal: 'School summer break',
    start: '2026-06-01',
    end: '2026-08-15',
    intensity: 'medium',
    direction: 'outbound',
    reason: '学校夏季休暇。ベトナム人の家族旅行需要が高まり、ベトナム発の旅行が増える。期間は地域・学校で異なるため要確認。',
    sourceUrl: '',
    verified: false,
    verifiedAt: '',
  },
  {
    country: 'VN',
    name: '乾季（南部・観光ハイシーズン）',
    nameLocal: 'Dry season (South)',
    start: '2026-11-01',
    end: '2027-04-30',
    intensity: 'medium',
    direction: 'inbound',
    reason: '南部の乾季は観光の最盛期で、ベトナムへ入る外国人旅行者の需要が高まる。地域差が大きく気候に基づく推定のため要確認。',
    sourceUrl: '',
    verified: false,
    verifiedAt: '',
  },

  // ── KE: Christmas high season, rains, safari high season ─────────────────────
  {
    country: 'KE',
    name: 'クリスマス〜年始ハイシーズン',
    nameLocal: 'Christmas–New Year high season',
    start: '2026-12-20',
    end: '2027-01-05',
    intensity: 'high',
    direction: 'inbound',
    reason: '欧州などからの観光客とケニア在外者がクリスマス休暇に集中して訪れ、ケニアへ入る需要とサファリ・海岸リゾートの予約が急増する。期間は観光実態に基づく推定のため要確認。',
    sourceUrl: '',
    verified: false,
    verifiedAt: '',
  },
  {
    country: 'KE',
    name: 'サファリ・ハイシーズン（大移動）',
    nameLocal: 'Safari high season / Great Migration',
    start: '2026-07-01',
    end: '2026-10-31',
    intensity: 'high',
    direction: 'inbound',
    reason: 'マサイマラのヌー大移動が見られる乾季で、世界中からサファリ観光客がケニアへ入る需要が最も高まる。野生動物・気候に基づく推定期間のため要確認。',
    sourceUrl: '',
    verified: false,
    verifiedAt: '',
  },
  {
    country: 'KE',
    name: '長雨（ロングレインズ）',
    nameLocal: 'Long rains',
    start: '2026-03-01',
    end: '2026-05-31',
    intensity: 'low',
    direction: 'inbound',
    reason: '長雨の季節は観光のローシーズンで、ケニアへ入る旅行需要が弱まる。気候に基づく推定期間のため要確認。',
    sourceUrl: '',
    verified: false,
    verifiedAt: '',
  },
  {
    country: 'KE',
    name: '短雨（ショートレインズ）',
    nameLocal: 'Short rains',
    start: '2026-11-01',
    end: '2026-12-15',
    intensity: 'low',
    direction: 'inbound',
    reason: '短い雨季で観光需要がやや落ちる。気候に基づく推定期間のため要確認。',
    sourceUrl: '',
    verified: false,
    verifiedAt: '',
  },
]

// ─── Airport → country ───────────────────────────────────────────────────────
// A dedicated mapping already exists in src/lib/airport-db.ts (getAirportByIata),
// but that module eagerly imports a ~600KB airports.json and is explicitly
// server-only ("must never be bundled for the browser"). Since the demand calendar
// only concerns four countries / a handful of airports, we keep a tiny local map
// here so this module stays lightweight and safe to import from anywhere. Extend
// this list as route coverage grows.
const AIRPORT_COUNTRY: Record<string, Country> = {
  HND: 'JP',
  NRT: 'JP',
  KIX: 'JP',
  CEB: 'PH',
  MNL: 'PH',
  HAN: 'VN',
  SGN: 'VN',
  NBO: 'KE',
}

export function airportToCountry(iata: string): Country | null {
  return AIRPORT_COUNTRY[iata.toUpperCase()] ?? null
}

// ─── Judgement ───────────────────────────────────────────────────────────────
export type DemandPhase = 'peak' | 'pre-peak' | 'post-peak' | 'off'

export interface DemandPhaseResult {
  phase: DemandPhase
  periods: DemandPeriod[] // the verified periods that drive the returned phase
}

const DAY_MS = 24 * 60 * 60 * 1000
const PADDING_DAYS = 7

function toMs(ymd: string): number {
  return new Date(`${ymd}T00:00:00Z`).getTime()
}

// Relation of a single date to one period's window (with ±7d shoulders).
function phaseFor(period: DemandPeriod, dateMs: number): DemandPhase {
  const startMs = toMs(period.start)
  const endMs = toMs(period.end)
  if (dateMs >= startMs && dateMs <= endMs) return 'peak'
  if (dateMs >= startMs - PADDING_DAYS * DAY_MS && dateMs < startMs) return 'pre-peak'
  if (dateMs > endMs && dateMs <= endMs + PADDING_DAYS * DAY_MS) return 'post-peak'
  return 'off'
}

// Strongest-phase precedence: peak > pre-peak > post-peak > off.
const PHASE_RANK: Record<DemandPhase, number> = {
  peak: 0,
  'pre-peak': 1,
  'post-peak': 2,
  off: 3,
}

// Assess where `date` sits relative to a country's VERIFIED demand periods.
// Returns null when the country has no verified periods at all — we stay silent
// rather than speak from unverified data.
export function assessDemandPhase(country: Country, date: string): DemandPhaseResult | null {
  const verified = DEMAND_PERIODS.filter((p) => p.country === country && p.verified)
  if (verified.length === 0) return null

  const dateMs = toMs(date)
  if (!Number.isFinite(dateMs)) return null

  let best: DemandPhase = 'off'
  const contributing: DemandPeriod[] = []
  for (const period of verified) {
    const ph = phaseFor(period, dateMs)
    if (ph === 'off') continue
    if (PHASE_RANK[ph] < PHASE_RANK[best]) {
      best = ph
      contributing.length = 0
      contributing.push(period)
    } else if (ph === best) {
      contributing.push(period)
    }
  }

  return { phase: best, periods: contributing }
}

export interface RouteDemandLeg {
  country: Country
  demand: DemandPhaseResult | null
}

export interface RouteDemand {
  departureDate: string
  origin: RouteDemandLeg
  destination: RouteDemandLeg
}

// Facts side by side for both ends of a route — no blended/composite score. The
// caller decides how to present the two independent signals.
export function assessRouteDemand(
  originCountry: Country,
  destinationCountry: Country,
  departureDate: string,
): RouteDemand {
  return {
    departureDate,
    origin: {
      country: originCountry,
      demand: assessDemandPhase(originCountry, departureDate),
    },
    destination: {
      country: destinationCountry,
      demand: assessDemandPhase(destinationCountry, departureDate),
    },
  }
}
