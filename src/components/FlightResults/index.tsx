'use client'

import { Plane, Clock, Zap } from 'lucide-react'
import type { CategorizedFlights, FlightResult, SearchQuery } from '@/types'
import ExternalLinks from '@/components/ExternalLinks'

interface Props {
  categorized: CategorizedFlights | null
  isLoading: boolean
  error?: string
  query?: SearchQuery | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const AIRLINE_NAMES: Record<string, string> = {
  JL: 'Japan Airlines', NH: 'ANA', MM: 'Peach Aviation',
  BC: 'Skymark', GK: 'Jetstar Japan', NU: 'JTA',
  JW: 'Vanilla Air', SQ: 'Singapore Airlines', TG: 'Thai Airways',
  CX: 'Cathay Pacific', KE: 'Korean Air', OZ: 'Asiana',
  CI: 'China Airlines', BR: 'EVA Air', BA: 'British Airways',
  AF: 'Air France', LH: 'Lufthansa', UA: 'United', DL: 'Delta',
  AA: 'American Airlines', EK: 'Emirates', QR: 'Qatar Airways',
  MH: 'Malaysia Airlines', GA: 'Garuda Indonesia',
}

const AIRLINE_EMOJI: Record<string, string> = {
  JL: '🔴', NH: '🔵', MM: '🟣', JW: '🟠', BC: '🟡', GK: '🟠',
  SQ: '🟢', TG: '🟤', CX: '⚫', KE: '🔵', OZ: '🔵',
  BA: '🔵', AF: '🔵', LH: '🟡', UA: '🔵', DL: '🔵',
  AA: '🔴', EK: '🟢', QR: '🟤',
}

function formatDurationJa(minutes: number): string {
  if (!minutes) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}時間${m > 0 ? `${m}分` : ''}` : `${m}分`
}

function formatDepDate(iso: string): string {
  const d = new Date(iso)
  const dateStr = d.toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Tokyo',
  })
  const h = d.getHours()
  const m = d.getMinutes()
  if (h === 0 && m === 0) return dateStr
  return `${dateStr} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}発`
}

// ─── Flight card ───────────────────────────────────────────────────────────────
function TpCard({ flight, badge }: { flight: FlightResult; badge?: string }) {
  const seg = flight.segments[0]
  const hasAirline = !!seg.carrierCode
  const airlineName = hasAirline
    ? (AIRLINE_NAMES[seg.carrierCode] ?? seg.carrierCode)
    : (seg.carrierName || '各社最安値')
  const emoji = hasAirline ? (AIRLINE_EMOJI[seg.carrierCode] ?? '✈️') : '🌐'

  return (
    <a
      href={flight.bookingLink}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        'flex flex-col sm:flex-row sm:items-center sm:justify-between',
        'gap-4 rounded-2xl border bg-white px-5 py-5',
        'shadow-sm hover:shadow-md transition-all group',
        badge ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-200',
      ].join(' ')}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-3xl shrink-0" aria-hidden="true">{emoji}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900 text-base leading-tight">{airlineName}</p>
            {badge && (
              <span className="text-xs bg-indigo-600 text-white font-bold rounded-full px-2 py-0.5 shrink-0">
                {badge}
              </span>
            )}
          </div>
          {hasAirline && seg.flightNumber && (
            <p className="text-xs text-gray-400 mt-0.5">{seg.flightNumber}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">{formatDepDate(seg.departingAt)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t border-gray-100 pt-3 sm:border-0 sm:pt-0">
        <div>
          <p className="text-2xl font-bold text-indigo-700 tabular-nums leading-none">
            ¥{Math.round(flight.totalPrice).toLocaleString()}
          </p>
          <div className="flex items-center gap-2 mt-1.5 text-xs flex-wrap">
            {flight.stops === 0 ? (
              <span className="flex items-center gap-0.5 text-blue-600 font-semibold">
                <Zap size={11} />直行便
              </span>
            ) : flight.stops != null ? (
              <span className="text-orange-500 font-medium">
                {flight.stops}回乗り継ぎ
              </span>
            ) : null}
            {flight.totalDuration > 0 && (
              <span className="flex items-center gap-0.5 text-gray-500">
                <Clock size={11} />{formatDurationJa(flight.totalDuration)}
              </span>
            )}
          </div>
        </div>

        <span className="bg-green-500 group-hover:bg-green-600 text-white font-bold rounded-xl px-6 py-3 transition-colors whitespace-nowrap text-sm shrink-0">
          今すぐ予約 →
        </span>
      </div>
    </a>
  )
}

// ─── Category section ─────────────────────────────────────────────────────────
interface CategoryConfig {
  key: keyof CategorizedFlights
  icon: string
  title: string
  badge: string
  emptyMsg: string
  headerColor: string
}

const CATEGORIES: CategoryConfig[] = [
  {
    key: 'cheapest',
    icon: '💰',
    title: '最安値',
    badge: '最安',
    emptyMsg: '該当する便が見つかりませんでした',
    headerColor: 'text-indigo-700',
  },
  {
    key: 'cheapestDirect',
    icon: '⚡',
    title: '直行便最安',
    badge: '直行最安',
    emptyMsg: '直行便は見つかりませんでした',
    headerColor: 'text-blue-600',
  },
  {
    key: 'recommended',
    icon: '⭐',
    title: '総合おすすめ',
    badge: 'おすすめ',
    emptyMsg: '該当する便が見つかりませんでした',
    headerColor: 'text-green-600',
  },
]

function CategorySection({
  config,
  flights,
}: {
  config: CategoryConfig
  flights: FlightResult[]
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-0.5">
        <span className="text-lg" aria-hidden="true">{config.icon}</span>
        <h2 className={`font-bold text-base ${config.headerColor}`}>{config.title}</h2>
      </div>
      {flights.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm bg-gray-50 rounded-2xl border border-gray-100">
          {config.emptyMsg}
        </div>
      ) : (
        flights.map((flight, i) => (
          <TpCard key={flight.id} flight={flight} badge={i === 0 ? config.badge : undefined} />
        ))
      )}
    </div>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-6">
      {[...Array(3)].map((_, si) => (
        <div key={si} className="space-y-2">
          <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 px-5 py-5 animate-pulse">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
                  <div className="space-y-2">
                    <div className="h-4 w-28 bg-gray-200 rounded" />
                    <div className="h-3 w-20 bg-gray-100 rounded" />
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="space-y-1.5">
                    <div className="h-6 w-24 bg-gray-200 rounded" />
                    <div className="h-3 w-16 bg-gray-100 rounded" />
                  </div>
                  <div className="h-11 w-28 bg-gray-200 rounded-xl" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Main export ───────────────────────────────────────────────────────────────
export default function FlightResults({ categorized, isLoading, error, query }: Props) {
  const hasQuery = !!(query?.origin && query?.destination && query?.departureDate)
  const hasResults = !!(
    categorized &&
    (categorized.cheapest.length > 0 ||
      categorized.cheapestDirect.length > 0 ||
      categorized.recommended.length > 0)
  )

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600">
        <p className="font-semibold">エラーが発生しました</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {hasQuery && (
        <ExternalLinks
          origin={query!.origin}
          destination={query!.destination}
          departureDate={query!.departureDate}
          returnDate={query!.returnDate}
        />
      )}

      {isLoading ? (
        <Skeleton />
      ) : !hasResults ? (
        <div className="text-center py-16 text-gray-400">
          <Plane size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">検索結果がありません</p>
          <p className="text-sm">条件を変えて再検索してください</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 px-0.5">
            Powered by Travelpayouts · 最大9件を3カテゴリで表示
          </p>
          {CATEGORIES.map((cfg) => (
            <CategorySection
              key={cfg.key}
              config={cfg}
              flights={categorized![cfg.key]}
            />
          ))}
        </>
      )}
    </div>
  )
}
