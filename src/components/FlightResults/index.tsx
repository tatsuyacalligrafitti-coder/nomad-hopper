'use client'

import { Plane } from 'lucide-react'
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
  // Show time only if not midnight
  const h = d.getHours()
  const m = d.getMinutes()
  if (h === 0 && m === 0) return dateStr
  return `${dateStr} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}発`
}

function stopsLabel(stops: number | undefined): string {
  if (stops == null) return ''
  return stops === 0 ? '直行' : `${stops}回乗り継ぎ`
}

// ─── Flight card (Travelpayouts) ──────────────────────────────────────────────
function TpCard({ flight, rank }: { flight: FlightResult; rank: number }) {
  const seg = flight.segments[0]
  const hasAirline = !!seg.carrierCode
  const airlineName = hasAirline
    ? (AIRLINE_NAMES[seg.carrierCode] ?? seg.carrierCode)
    : (seg.carrierName || '各社最安値')
  const emoji = hasAirline ? (AIRLINE_EMOJI[seg.carrierCode] ?? '✈️') : '🌐'

  const meta = [
    formatDepDate(seg.departingAt),
    stopsLabel(flight.stops),
    flight.totalDuration > 0 ? formatDurationJa(flight.totalDuration) : '',
  ].filter(Boolean).join(' · ')

  return (
    <a
      href={flight.bookingLink}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        'flex items-center justify-between gap-4 rounded-2xl border bg-white px-4 py-4 shadow-sm hover:shadow-md transition-all group',
        rank === 1 ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-200',
      ].join(' ')}
    >
      {/* ── Airline info ── */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-2xl shrink-0">{emoji}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-gray-900 truncate">{airlineName}</p>
            {rank === 1 && (
              <span className="shrink-0 text-xs bg-indigo-600 text-white font-bold rounded-full px-2 py-0.5">
                最安
              </span>
            )}
          </div>
          {hasAirline && seg.flightNumber && (
            <p className="text-xs text-gray-400">{seg.flightNumber}</p>
          )}
          <p className="text-xs text-gray-500 mt-0.5">{meta}</p>
        </div>
      </div>

      {/* ── Price + button ── */}
      <div className="flex items-center gap-3 shrink-0">
        <p className="text-2xl sm:text-3xl font-extrabold text-indigo-700 tabular-nums">
          ¥{Math.round(flight.totalPrice).toLocaleString()}
        </p>
        <span className="text-sm bg-indigo-600 group-hover:bg-indigo-700 text-white font-bold rounded-xl px-3 py-2 transition-colors whitespace-nowrap">
          予約する →
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
        <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200" />
            <div className="space-y-2">
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-3 w-48 bg-gray-100 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-24 bg-gray-200 rounded" />
            <div className="h-9 w-20 bg-gray-100 rounded-xl" />
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
      {/* External links */}
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
