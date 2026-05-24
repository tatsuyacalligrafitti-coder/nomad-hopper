'use client'

import { Plane, Clock, Zap } from 'lucide-react'
import type { FlightResult, SearchQuery } from '@/types'
import ExternalLinks from '@/components/ExternalLinks'

interface Props {
  flights: FlightResult[]
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
function TpCard({ flight, rank }: { flight: FlightResult; rank: number }) {
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
        rank === 1 ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-200',
      ].join(' ')}
    >
      {/* ── Left: airline info ── */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-3xl shrink-0" aria-hidden="true">{emoji}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900 text-base leading-tight">{airlineName}</p>
            {rank === 1 && (
              <span className="text-xs bg-indigo-600 text-white font-bold rounded-full px-2 py-0.5 shrink-0">
                最安
              </span>
            )}
          </div>
          {hasAirline && seg.flightNumber && (
            <p className="text-xs text-gray-400 mt-0.5">{seg.flightNumber}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">{formatDepDate(seg.departingAt)}</p>
        </div>
      </div>

      {/* ── Right: price + meta + button ── */}
      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t border-gray-100 pt-3 sm:border-0 sm:pt-0">
        {/* Price + stops/duration */}
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

        {/* Booking button */}
        <span className="bg-green-500 group-hover:bg-green-600 text-white font-bold rounded-xl px-6 py-3 transition-colors whitespace-nowrap text-sm shrink-0">
          今すぐ予約 →
        </span>
      </div>
    </a>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
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
  )
}

// ─── Main export ───────────────────────────────────────────────────────────────
export default function FlightResults({ flights, isLoading, error, query }: Props) {
  const hasQuery = !!(query?.origin && query?.destination && query?.departureDate)

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600">
        <p className="font-semibold">エラーが発生しました</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
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
      ) : flights.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Plane size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">検索結果がありません</p>
          <p className="text-sm">条件を変えて再検索してください</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 px-0.5">
            {flights.length}件の最安値 · Powered by Travelpayouts
          </p>
          {flights.map((flight, i) => (
            <TpCard key={flight.id} flight={flight} rank={i + 1} />
          ))}
        </>
      )}
    </div>
  )
}
